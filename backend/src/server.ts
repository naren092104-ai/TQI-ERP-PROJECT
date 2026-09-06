import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createHash, randomBytes, randomInt, randomUUID } from 'crypto';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import cors from 'cors';
import { sendLoginOtp, sendOnboardingCredentialsEmail, sendWorkflowEmail } from './authMailer.js';
import * as archiverModule from 'archiver';
import { pool, getDatabaseStatus, initializeDatabase } from './db/connection.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

const archiver: any = (archiverModule as any).default || archiverModule;
const PROJECT_ROOT = fs.existsSync(path.join(process.cwd(), 'frontend'))
  ? process.cwd()
  : path.resolve(process.cwd(), '..');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || 'replace-with-a-secret';
const UPLOADS_DIR = path.join(PROJECT_ROOT, process.env.UPLOADS_DIR || 'storage/uploads');

app.use(cors({
  origin: true,
  credentials: true,
}));


const normalizeRole = (role: string | null | undefined): 'Super Admin' | 'Cluster Admin' =>
  role === 'SUPER_ADMIN' ? 'Super Admin' : 'Cluster Admin';

const toDbRole = (role: string): 'SUPER_ADMIN' | 'CLUSTER_ADMIN' =>
  role === 'Super Admin' ? 'SUPER_ADMIN' : 'CLUSTER_ADMIN';

const serializeUser = (row: any) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: normalizeRole(row.role),
  clusterId: row.cluster_id || 'all',
  clusterName: row.cluster_id ? `${row.cluster_id} Cluster` : 'All Clusters',
    collegeId: row.college_id || '',
    collegeName: row.college_name || '',
  phone: row.phone || '',
  status: row.status === 'ACTIVE' ? 'Active' : 'Inactive',
  mustChangePassword: Boolean(row.must_change_password),
});

async function notifyWorkflow({
  clusterId,
  title,
  summary,
  details,
}: {
  clusterId?: string;
  title: string;
  summary: string;
  details: Array<{ label: string; value: string }>;
}): Promise<void> {
  const [rows] = await pool.query<any[]>(
    `SELECT name, email FROM users WHERE status = 'ACTIVE' AND email IS NOT NULL AND TRIM(email) <> ''
     AND (role = 'SUPER_ADMIN' OR (role = 'CLUSTER_ADMIN' AND cluster_id = ?))`,
    [clusterId || ''],
  );
  const loginUrl = process.env.APP_URL || 'http://localhost:5173';
  await Promise.all(rows.map((row) => sendWorkflowEmail({
    recipient: row.email,
    recipientName: row.name || 'TQI Administrator',
    title,
    summary,
    details,
    actionLabel: 'Open TQI ERP',
    actionUrl: loginUrl,
    projectRoot: PROJECT_ROOT,
  })));
}

// ============================================================
// Phase 4: Session Status Flow Enforcement
// ============================================================
// Status flow: SCHEDULED → IN_PROGRESS → SUBMITTED → PENDING_REVIEW
//              → APPROVED → COMPLETED
//              → RESUBMISSION_REQUIRED → RESUBMITTED → REVIEW → APPROVED → COMPLETED

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  'Draft':                   ['Scheduled', 'In Progress'],
  'Scheduled':               ['In Progress', 'Cancelled'],
  'In Progress':             ['Submitted'],
  'Submitted':               ['Pending Review'],
  'Pending Review':          ['Approved', 'Resubmission Required'],
  'Approved':                ['Completed'],
  'Resubmission Required':   ['In Progress'],
  'Resubmitted':             ['Pending Review'],
  'Completed':               [],
  'Cancelled':               ['Scheduled'],
};

const EDITABLE_STATUSES = new Set([
  'Draft', 'Scheduled', 'In Progress', 'Resubmission Required',
]);

const isSessionEditable = async (sessionId: string): Promise<{ editable: boolean; reason?: string }> => {
  try {
    const [submissions] = await pool.query<any>(
      'SELECT status FROM session_submissions WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1',
      [sessionId]
    );
    if (submissions.length === 0) return { editable: true };
    const status = submissions[0].status;
    if (EDITABLE_STATUSES.has(status)) return { editable: true };
    return { editable: false, reason: `Session is in '${status}' status. Editing is disabled.` };
  } catch {
    return { editable: true }; // fail-open if table doesn't exist yet
  }
};

const autoTransitionToInProgress = async (sessionId: string): Promise<void> => {
  try {
    await pool.query<any>(
      "UPDATE sessions SET session_status = 'In Progress' WHERE id = ? AND session_status IN ('Draft', 'Scheduled')",
      [sessionId]
    );
  } catch {
    // ignore — session may not exist or may already be in progress
  }
};

const createAuthToken = (userRow: any) => {
  const user = serializeUser(userRow);
  const token = jwt.sign(
    { id: user.id, email: user.email, role: toDbRole(user.role), cluster_id: user.clusterId === 'all' ? null : user.clusterId },
    JWT_SECRET,
    { expiresIn: '8h' },
  );
  return { token, user };
};

interface AuthenticatedRequest extends Request {
  user?: any;
}

const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    const payload = jwt.verify(token, JWT_SECRET) as any;
    const [rows] = await pool.query<any[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [payload.id]);
    if (!rows.length) {
      res.status(401).json({ success: false, error: 'Invalid session.' });
      return;
    }

    req.user = serializeUser(rows[0]);
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid or expired session.' });
  }
};

const runSqlFiles = async () => {
  const migrationDir = path.join(PROJECT_ROOT, 'database', 'migrations');
  if (!fs.existsSync(migrationDir)) return;

  // Create schema_migrations table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [appliedRows] = await pool.query<any[]>('SELECT version FROM schema_migrations');
  const appliedSet = new Set(appliedRows.map((r) => r.version));

  const files = fs.readdirSync(migrationDir).filter((file) => file.endsWith('.sql')).sort();
  const pendingFiles = files.filter((file) => !appliedSet.has(file));

  if (pendingFiles.length === 0) {
    console.log(`[DB] Database schema is up to date (${files.length} migration(s) applied).`);
    return;
  }

  console.log(`[DB] Applying ${pendingFiles.length} pending SQL migration(s)...`);
  for (const file of pendingFiles) {
    const filePath = path.join(migrationDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = sql
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      if (!statement) continue;
      try {
        await pool.query(statement);
      } catch (error: any) {
        if (!['ER_DUP_FIELDNAME', 'ER_TABLE_EXISTS_ERROR', 'ER_DUP_KEYNAME', 'ER_CANT_DROP_FIELD_OR_KEY', 'ER_KEY_COLUMN_DOES_NOT_EXITS', 'ER_DUP_ENTRY'].includes(error?.code)) {
          console.warn(`[DB MIGRATION WARNING] in ${file}:`, error.message);
        }
      }
    }
    await pool.query('INSERT IGNORE INTO schema_migrations (version) VALUES (?)', [file]);
    console.log(`[DB] Applied migration: ${file}`);
  }
  console.log('[DB] All database migrations are up to date.');
};


const ensureAcademicSetupTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS academic_setup (
      day_number INT PRIMARY KEY,
      academic_year VARCHAR(50) NOT NULL,
      session_name VARCHAR(255) NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

const buildWhereClause = (user: any, extra = '') => {
  if (!user || user.role !== 'Cluster Admin') return extra || '1=1';
  return `${extra ? `${extra} AND` : 'WHERE'} cluster_id = ?`;
};

const mapCluster = (row: any) => ({
  id: row.id,
  name: row.name,
  district: row.district || 'Tamil Nadu',
  state: row.state || 'Tamil Nadu',
  code: row.code || row.id.toUpperCase(),
  activePanchayats: Number(row.active_panchayats || 0),
  totalStudents: Number(row.total_students || 0),
  totalVolunteers: Number(row.total_volunteers || 0),
  adminId: row.admin_id || '',
  adminName: row.admin_name || '',
  adminEmail: row.admin_email || '',
  adminPhone: row.admin_phone || row.spoc_mobile || '',
  adminStatus: row.admin_status || 'ACTIVE',
  status: row.status === 'ACTIVE' ? 'Active' : 'Inactive',
  completedSessions: 0,
  totalSessions: 0,
  collegeName: row.college_name || row.college_resolved_name || '',
  collegeId: row.college_id || '',
  spocName: row.spoc_name || '',
  spocMobile: row.spoc_mobile || '',
});

const mapStudent = (row: any) => ({
  id: row.id,
  code: row.code || row.id,
  name: row.name,
  gender: row.gender || 'female',
  dob: row.dob || '2014-01-01',
  standard: row.standard || '6th Standard',
  clusterId: row.cluster_id,
  panchayatId: row.panchayat_id,
  panchayatName: row.panchayat_name || row.panchayat_id,
  villageId: row.village_id,
  villageName: row.village_name || row.village_id,
  parentName: row.parent_name || 'Parent',
  phone: row.phone || '',
  status: row.status || 'active',
  avatarLetter: (row.name || 'S').charAt(0).toUpperCase(),
  avatarBg: '#0B3D91',
});

const mapVolunteer = (row: any) => ({
  id: row.id,
  name: row.name,
  email: row.email || '',
  phone: row.phone || '',
  college: row.college_name || row.college_resolved_name || '',
  collegeId: row.college_id || '',
  department: row.department || 'Community Program',
  stream: row.stream || '',
  year: '2026',
  passingOutYear: row.passing_out_year || '',
  role: row.role || 'Mentor',
  clusterId: row.cluster_id,
  panchayatId: row.panchayat_id,
  panchayatName: row.panchayat_name || row.panchayat_id || '',
  villageId: row.village_id || '',
  villageName: row.village_name || row.village_id || '',
  module: '',
  status: row.status || 'Active',
  totalSessions: 0,
  attendanceRate: 100,
  recentSessions: [],
  avatarText: (row.name || 'V').split(' ').map((part: string) => part[0]).slice(0, 2).join('').toUpperCase(),
});

const mapSession = (row: any) => ({
  id: row.id,
  code: row.code || row.id,
  name: row.session_name || row.name || '',
  title: row.session_name || row.name || '',
  moduleId: row.module_id || '',
  module: row.module_name || '',
  clusterId: row.cluster_id,
  clusterName: row.cluster_name || row.cluster_id,
  academicYear: row.academic_year || '',
  academicYearId: row.academic_year_id || '',
  dayNumber: Number(row.day_number || 1),
  dayId: row.day_id || '',
  date: row.date ? new Date(row.date).toISOString().slice(0, 10) : '',
  dateFixed: Boolean(row.session_date_fixed),
  dateFixedAt: row.session_date_fixed_at || '',
  dateFixedBy: row.session_date_fixed_by || '',
  day: `Day ${row.day_number || 1}`,
  time: row.time || '09:00',
  endTime: row.end_time || '11:00',
  panchayatId: row.panchayat_id,
  panchayatName: row.panchayat_name || row.panchayat_id,
  villageId: row.village_id,
  villageName: row.village_name || '',
  volunteerId: row.volunteer_id,
  volunteerName: row.volunteer_name || 'Volunteer',
  status: row.session_status || 'Draft',
  sessionType: 'Academic',
  description: row.description || '',
  lessonPlanId: row.lesson_plan_id || '',
  attendanceCount: 0,
  totalStudents: 0,
});

const mapFinanceEntry = (row: any) => ({
  id: row.id,
  title: row.title || row.description,
  description: row.description,
  category: row.category || 'General',
  amount: Number(row.amount || 0),
  clusterId: row.cluster_id,
  clusterName: row.cluster_name || row.cluster_id,
  date: row.date || new Date().toISOString().split('T')[0],
  createdBy: row.created_by,
  status: row.status || 'Draft',
  billReference: row.bill_reference || '',
  panchayatId: row.panchayat_id || '',
  panchayatName: row.panchayat_name || '',
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

const PHOTO_STORAGE_DIR = path.join(PROJECT_ROOT, 'storage', 'uploads');

const photoUploadStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    fs.mkdirSync(PHOTO_STORAGE_DIR, { recursive: true });
    callback(null, PHOTO_STORAGE_DIR);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname) || '.png';
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  },
});

const photoUploadMiddleware = multer({
  storage: photoUploadStorage,
  limits: {
    files: 20,
    fileSize: 20 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error('Only JPG, PNG, and WEBP images are allowed.'));
  },
});

const mapSessionPhotoRow = (row: any, userName?: string): any => ({
  id: row.id,
  clusterId: row.cluster_id,
  clusterName: row.cluster_id || 'Dharmapuri',
  sessionId: row.session_id || row.id,
  sessionTitle: row.original_filename || `Day ${row.day_number || 1} Photos`,
  dayNumber: Number(row.day_number || 1),
  date: row.uploaded_at ? new Date(row.uploaded_at).toISOString().slice(0, 10) : '',
  panchayatId: '',
  panchayatName: '',
  villageId: '',
  villageName: '',
  filePath: row.file_path,
  fileUrl: row.file_url || `/api/session-photos/file/${row.id}`,
  originalFilename: row.original_filename || 'photo.jpg',
  mimeType: row.mime_type || 'image/jpeg',
  fileSize: Number(row.file_size || 0),
  uploadedBy: row.uploaded_by || userName || 'Cluster Admin',
  uploadedRole: 'Cluster Admin',
  uploadedAt: row.uploaded_at,
  status: 'active',
  caption: row.original_filename || `Day ${row.day_number || 1} photo`,
  academicYearId: row.academic_year_id || '',
  deleteRequestStatus: row.delete_request_status || null,
  deleteRequestId: row.delete_request_id || null,
  deleteRequestReason: row.delete_request_reason || null,
});

app.get('/api/health', async (_req: Request, res: Response) => {
  const dbState = await getDatabaseStatus();
  res.json({
    success: dbState === 'connected',
    database: dbState,
  });
});

app.post('/api/auth/request-otp', async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email) {
      res.status(400).json({ success: false, error: 'Email is required.' });
      return;
    }

    const [rows] = await pool.query<any[]>('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    if (!rows.length) {
      // Don't leak whether email exists or not
      res.json({ success: true, otpRequired: true, message: 'If the email exists, a verification code was sent.' });
      return;
    }

    const userRow = rows[0];

    const otp = String(randomInt(0, 1000000)).padStart(6, '0');
    const otpHash = await bcrypt.hash(otp, 10);
    const expiryMinutes = 10;
    await pool.query('UPDATE auth_otps SET used_at = NOW() WHERE email = ? AND used_at IS NULL', [email]);
    await pool.query(
      'INSERT INTO auth_otps (email, otp_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
      [email, otpHash],
    );
    await sendLoginOtp({ recipient: email, name: userRow.name || 'TQI user', otp, projectRoot: PROJECT_ROOT, expiryMinutes });

    res.json({ success: true, otpRequired: true, message: 'A verification code was sent to your email.' });
  } catch (error) {
    console.error('OTP request failed:', error);
    res.status(500).json({ success: false, error: 'Unable to send verification code. Please try again.' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const otp = String(req.body.otp || '').trim();

    if (!email) {
      res.status(400).json({ success: false, error: 'Email is required.' });
      return;
    }
    if (password && otp) {
      res.status(400).json({ success: false, error: 'Use either password login or OTP login.' });
      return;
    }
    if (!password && !otp) {
      res.status(400).json({ success: false, error: 'Password or OTP is required.' });
      return;
    }

    const [rows] = await pool.query<any[]>(`SELECT u.*, c.college_id, co.name AS college_name
      FROM users u LEFT JOIN clusters c ON c.id = u.cluster_id LEFT JOIN colleges co ON co.id = c.college_id
      WHERE u.email = ? OR u.name = ? OR u.id = ? LIMIT 1`, [email, email, email]);

    if (!rows.length) {
      res.status(401).json({ success: false, error: 'Invalid credentials.' });
      return;
    }

    if (rows[0].status !== 'ACTIVE') {
      res.status(403).json({ success: false, error: rows[0].status === 'BLOCKED' ? 'Your account has been blocked. Please contact the administrator.' : 'This user account is inactive.' });
      return;
    }

    if (password) {
      if (!(await bcrypt.compare(password, rows[0].password_hash || ''))) {
        res.status(401).json({ success: false, error: 'Invalid credentials.' });
        return;
      }
      const { token, user } = createAuthToken(rows[0]);
      res.json({ success: true, token, user, authenticationMethod: 'password', mustChangePassword: user.mustChangePassword });
      return;
    }

    const [otpRows] = await pool.query<any[]>(
      'SELECT * FROM auth_otps WHERE email = ? AND used_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email],
    );
    if (!otpRows.length || !(await bcrypt.compare(otp, otpRows[0].otp_hash))) {
      if (otpRows.length) await pool.query('UPDATE auth_otps SET attempts = attempts + 1 WHERE id = ?', [otpRows[0].id]);
      res.status(401).json({ success: false, error: 'Invalid or expired verification code.' });
      return;
    }

    await pool.query('UPDATE auth_otps SET used_at = NOW() WHERE id = ?', [otpRows[0].id]);
    const { token, user } = createAuthToken(rows[0]);
    res.json({ success: true, token, user, authenticationMethod: 'otp', mustChangePassword: user.mustChangePassword });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ success: false, error: 'Unable to sign in. Please try again.' });
  }
});

app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, user: req.user, activeRole: req.user.role, clusterId: req.user.clusterId });
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) { res.status(400).json({ success: false, error: 'Email is required.' }); return; }
  try {
    const [rows] = await pool.query<any[]>('SELECT u.id, u.name, u.email, c.name AS cluster_name, c.college_name FROM users u LEFT JOIN clusters c ON c.id = u.cluster_id WHERE LOWER(u.email) = ? AND u.status = \'ACTIVE\' LIMIT 1', [email]);
    if (rows.length) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [rows[0].id]);
      await pool.query('INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))', [randomUUID(), rows[0].id, tokenHash]);
      const resetUrl = `${process.env.APP_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;
      const sent = await sendWorkflowEmail({ recipient: rows[0].email, recipientName: rows[0].name, title: 'TQI — Reset Your Password', summary: 'A secure password reset was requested for your TQI account. This link expires in 30 minutes and can be used once.', details: [{ label: 'College', value: rows[0].college_name || '' }, { label: 'Cluster', value: rows[0].cluster_name || 'Central Administration' }], actionLabel: 'Reset Password', actionUrl: resetUrl, projectRoot: PROJECT_ROOT });
      await pool.query('INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [randomUUID(), rows[0].id, rows[0].name, 'AUTH', null, sent ? 'PASSWORD_RESET_EMAIL_SENT' : 'PASSWORD_RESET_EMAIL_FAILED', 'AUTH', rows[0].id, JSON.stringify({ recipient: rows[0].email, status: sent ? 'sent' : 'failed' })]).catch(() => undefined);
    }
    res.json({ success: true, message: 'If an active account exists for that email, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot-password request failed:', error);
    res.status(503).json({ success: false, error: 'Unable to process the password reset request.' });
  }
});

app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  const token = String(req.body.token || '').trim();
  const newPassword = String(req.body.newPassword || '');
  if (!token || newPassword.length < 8) { res.status(400).json({ success: false, error: 'A valid reset token and password of at least 8 characters are required.' }); return; }
  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.query<any[]>('SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1', [tokenHash]);
    if (!rows.length) { res.status(400).json({ success: false, error: 'This reset link is invalid or has expired.' }); return; }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('START TRANSACTION');
    await pool.query('UPDATE users SET password_hash = ?, must_change_password = FALSE WHERE id = ?', [passwordHash, rows[0].user_id]);
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = ?', [tokenHash]);
    await pool.query('COMMIT');
    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    res.status(503).json({ success: false, error: 'Unable to reset password.' });
  }
});

app.post('/api/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (newPassword.length < 8) {
    res.status(400).json({ success: false, error: 'New password must be at least 8 characters long.' });
    return;
  }
  try {
    const [rows] = await pool.query<any[]>('SELECT password_hash, must_change_password FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'User account not found.' });
      return;
    }

    const isFirstTimeOnboarding = Boolean(rows[0].must_change_password);
    if (!isFirstTimeOnboarding) {
      const match = await bcrypt.compare(currentPassword, rows[0].password_hash || '');
      if (!match) {
        res.status(401).json({ success: false, error: 'The current password provided is incorrect.' });
        return;
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ?, must_change_password = FALSE WHERE id = ?', [passwordHash, req.user.id]);

    // Record audit log for password update
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        `aud-${randomUUID()}`,
        req.user.id,
        req.user.name,
        req.user.role,
        req.user.clusterId === 'all' ? null : req.user.clusterId,
        isFirstTimeOnboarding ? 'ONBOARDING_PASSWORD_SET' : 'PASSWORD_CHANGED',
        'AUTH',
        req.user.id,
        `User ${req.user.email} successfully updated account password.`,
      ],
    ).catch(() => undefined);

    res.json({ success: true, message: 'Password updated successfully. You are now logged in.' });
  } catch (error) {
    console.error('Password change failed:', error);
    res.status(503).json({ success: false, error: 'Unable to update password. Please try again.' });
  }
});

app.get('/api/modules', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT id, name, code, description, is_active, academic_year, day_number, created_at FROM modules WHERE is_active = 1 ORDER BY code ASC, name ASC');
    const [resourceRows] = await pool.query<any[]>(
      'SELECT id, module_id, file_url, original_filename, mime_type, file_size, created_at FROM module_resources ORDER BY created_at DESC'
    );
    const resourcesByModule = new Map<string, any[]>();
    resourceRows.forEach((resource) => {
      const resources = resourcesByModule.get(resource.module_id) || [];
      resources.push({
        id: resource.id,
        url: resource.file_url,
        fileName: resource.original_filename,
        mimeType: resource.mime_type,
        fileSize: resource.file_size,
        createdAt: resource.created_at,
      });
      resourcesByModule.set(resource.module_id, resources);
    });
    res.json({
      success: true,
      modules: rows.map((row) => ({
        id: row.id,
        moduleNumber: row.code || row.id,
        moduleName: row.name,
        topic: row.name,
        academicYear: row.academic_year || '',
        description: row.description || '',
        status: row.is_active ? 'Active' : 'Archived',
        version: 1,
        resources: resourcesByModule.get(row.id) || [],
        dayNumber: row.day_number || 1,
        createdBy: '',
        createdAt: row.created_at,
        updatedAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('Failed to load modules:', error);
    res.status(503).json({ success: false, error: 'Unable to load modules. Please try again.' });
  }
});

app.put('/api/modules/:id/academic-setup', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can edit academic setup.' });
    return;
  }

  const academicYear = String(req.body.academicYear || '').trim();
  const dayNumber = req.body.dayNumber === null || req.body.dayNumber === undefined || req.body.dayNumber === ''
    ? null
    : Number(req.body.dayNumber);

  if (!/^\d{4}-\d{4}$/.test(academicYear) || (dayNumber !== null && (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 8))) {
    res.status(400).json({ success: false, error: 'Academic year or programme day is invalid.' });
    return;
  }

  try {
    const [result] = await pool.query<any>(
      'UPDATE modules SET academic_year = ?, day_number = ? WHERE id = ?',
      [academicYear, dayNumber, req.params.id],
    );
    if (!result.affectedRows) {
      res.status(404).json({ success: false, error: 'Module not found.' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update academic setup:', error);
    res.status(503).json({ success: false, error: 'Unable to save academic setup.' });
  }
});

app.get('/api/academic-setup', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    await ensureAcademicSetupTable();
    const [rows] = await pool.query<any[]>('SELECT day_number, academic_year, session_name FROM academic_setup ORDER BY day_number ASC');
    res.json({ success: true, setup: rows });
  } catch (error) {
    console.error('Failed to load academic setup:', error);
    res.status(503).json({ success: false, error: 'Unable to load academic setup.' });
  }
});

app.get('/api/program-days', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const academicYearId = String(req.query.academicYearId || '').trim();
    const [rows] = await pool.query<any[]>(
      'SELECT * FROM program_days WHERE (? = \'\' OR academic_year_id = ?) AND status = \'ACTIVE\' ORDER BY day_number ASC',
      [academicYearId, academicYearId],
    );
    res.json({ success: true, programDays: rows });
  } catch (error) {
    console.error('Failed to load program days:', error);
    res.status(503).json({ success: false, error: 'Unable to load programme days.' });
  }
});

app.post('/api/program-days', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, message: 'Only Super Admin can add programme days.' });
    return;
  }
  const academicYearId = String(req.body.academicYearId || '').trim();
  const dayNumber = Number(req.body.dayNumber);
  const dayName = String(req.body.dayName || '').trim();
  if (!academicYearId || !Number.isInteger(dayNumber) || dayNumber < 1) {
    res.status(400).json({ success: false, message: 'Academic year and valid day number are required.' });
    return;
  }
  try {
    const [years] = await pool.query<any[]>('SELECT id FROM academic_years WHERE id = ? LIMIT 1', [academicYearId]);
    if (!years.length) { res.status(404).json({ success: false, message: 'Academic year not found.' }); return; }
    const id = `${academicYearId}-day-${dayNumber}`;
    await pool.query(
      `INSERT INTO program_days (id, academic_year_id, day_number, day_name, status)
       VALUES (?, ?, ?, ?, 'ACTIVE')
       ON DUPLICATE KEY UPDATE day_name = VALUES(day_name), status = 'ACTIVE'`,
      [id, academicYearId, dayNumber, dayName],
    );
    res.status(201).json({ success: true, data: { id, academicYearId, dayNumber, dayName, status: 'ACTIVE' }, programDay: { id, academicYearId, dayNumber, dayName, status: 'ACTIVE' } });
  } catch (error) {
    console.error('Failed to add program day:', error);
    res.status(503).json({ success: false, message: 'Unable to save programme day.' });
  }
});

app.put('/api/program-days/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, message: 'Only Super Admin can edit programme days.' });
    return;
  }
  const dayName = String(req.body.dayName || '').trim();
  try {
    const [result] = await pool.query<any>('UPDATE program_days SET day_name = ? WHERE id = ?', [dayName, req.params.id]);
    if (!result.affectedRows) { res.status(404).json({ success: false, message: 'Programme day not found.' }); return; }
    res.json({ success: true, data: { id: req.params.id, dayName }, programDay: { id: req.params.id, dayName } });
  } catch (error) {
    console.error('Failed to update program day:', error);
    res.status(503).json({ success: false, message: 'Unable to update programme day.' });
  }
});

app.put('/api/academic-setup', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can edit academic setup.' });
    return;
  }

  const academicYear = String(req.body.academicYear || '').trim();
  const days = Array.isArray(req.body.days) ? req.body.days : [];
  if (!/^\d{4}-\d{4}$/.test(academicYear) || days.length !== 8 || days.some((day: any) => !Number.isInteger(Number(day.dayNumber)) || Number(day.dayNumber) < 1 || Number(day.dayNumber) > 8)) {
    res.status(400).json({ success: false, error: 'Academic year or session days are invalid.' });
    return;
  }

  try {
    await ensureAcademicSetupTable();
    await pool.query('START TRANSACTION');
    for (const day of days) {
      await pool.query(
        'INSERT INTO academic_setup (day_number, academic_year, session_name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE academic_year = VALUES(academic_year), session_name = VALUES(session_name)',
        [Number(day.dayNumber), academicYear, String(day.sessionName || '').trim() || null],
      );
    }
    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    console.error('Failed to save academic setup:', error);
    res.status(503).json({ success: false, error: 'Unable to save academic setup.' });
  }
});

app.get('/api/session-photos', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const cluster = String(req.query.cluster || req.query.clusterId || 'all').toLowerCase();
    const academicYearId = String(req.query.academicYearId || '').trim();
    const dayNumber = req.query.dayNumber ? Number(req.query.dayNumber) : null;
    let sql = 'SELECT * FROM session_photos WHERE 1=1';
    const params: any[] = [];

    if (academicYearId) {
      sql += ' AND (academic_year_id = ? OR academic_year_id = "" OR academic_year_id IS NULL OR academic_year_id = (SELECT name FROM academic_years WHERE id = ? LIMIT 1) OR academic_year_id = (SELECT id FROM academic_years WHERE name = ? LIMIT 1) OR EXISTS (SELECT 1 FROM sessions s WHERE s.id = session_photos.session_id AND s.academic_year_id = ?))';
      params.push(academicYearId, academicYearId, academicYearId, academicYearId);
    }

    if (req.user.role === 'Cluster Admin') {
      // Security: Cluster Admin cannot query another cluster's photos
      const reqCluster = req.query.cluster || req.query.clusterId;
      if (reqCluster && reqCluster !== 'all' && String(reqCluster).toLowerCase() !== String(req.user.clusterId).toLowerCase()) {
        res.status(403).json({ success: false, error: 'Forbidden. You do not have permission to access session photos for another cluster.' });
        return;
      }
      sql += ' AND cluster_id = ?';
      params.push(req.user.clusterId);
    } else if (cluster !== 'all') {
      sql += ' AND (LOWER(cluster_id) = LOWER(?) OR LOWER(cluster_id) IN (SELECT LOWER(id) FROM clusters WHERE LOWER(name) = LOWER(?)))';
      params.push(cluster, cluster);
    }

    if (dayNumber && Number.isFinite(dayNumber)) {
      sql += ' AND day_number = ?';
      params.push(dayNumber);
    }

    sql += ' ORDER BY day_number ASC, uploaded_at DESC';
    const [rows] = await pool.query<any[]>(sql, params);
    const photos = rows.map((row) => mapSessionPhotoRow(row, req.user?.name));
    res.json({ success: true, photos });
  } catch (error) {
    console.error('Failed to load session photos:', error);
    res.status(503).json({ success: false, error: 'Unable to load session photos. Please try again.' });
  }
});

app.get('/api/session-photos/file/:id', async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const cleanId = rawId.replace(/\.[a-zA-Z0-9]+$/, '');
    const [rows] = await pool.query<any[]>(
      'SELECT * FROM session_photos WHERE id = ? OR id = ? LIMIT 1',
      [rawId, cleanId]
    );

    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Photo record not found.' });
      return;
    }

    const photo = rows[0];
    let filePath = photo.file_path;

    if (!filePath || !fs.existsSync(filePath)) {
      if (photo.file_path) {
        const basename = path.basename(photo.file_path);
        const altPath = path.join(PHOTO_STORAGE_DIR, basename);
        if (fs.existsSync(altPath)) {
          filePath = altPath;
        }
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'Photo file not found on disk.' });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime =
      photo.mime_type ||
      (ext === '.png'
        ? 'image/png'
        : ext === '.webp'
        ? 'image/webp'
        : ext === '.gif'
        ? 'image/gif'
        : 'image/jpeg');

    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Failed to serve photo file:', error);
    res.status(500).json({ success: false, error: 'Unable to serve photo file.' });
  }
});

app.get('/api/session-photos/:id/download', async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const cleanId = rawId.replace(/\.[a-zA-Z0-9]+$/, '');
    const [rows] = await pool.query<any[]>(
      'SELECT * FROM session_photos WHERE id = ? OR id = ? LIMIT 1',
      [rawId, cleanId]
    );

    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Photo not found.' });
      return;
    }

    const photo = rows[0];
    let filePath = photo.file_path;

    if (!filePath || !fs.existsSync(filePath)) {
      if (photo.file_path) {
        const basename = path.basename(photo.file_path);
        const altPath = path.join(PHOTO_STORAGE_DIR, basename);
        if (fs.existsSync(altPath)) {
          filePath = altPath;
        }
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'Photo file not found on disk.' });
      return;
    }

    res.download(path.resolve(filePath), photo.original_filename || `photo-${rawId}.jpg`);
  } catch (error) {
    console.error('Failed to download photo file:', error);
    res.status(500).json({ success: false, error: 'Unable to download photo file.' });
  }
});

app.get('/api/session-photos/day-statuses', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawCluster = req.user.role === 'Cluster Admin' ? req.user.clusterId : String(req.query.clusterId || req.query.cluster || 'all');
    const academicYearId = String(req.query.academicYearId || '').trim();

    // Query all clusters for cluster summaries
    const [clusters] = await pool.query<any[]>('SELECT id, name, district FROM clusters ORDER BY name ASC');

    let sql = 'SELECT * FROM session_photo_submissions WHERE 1=1';
    const params: any[] = [];
    if (rawCluster && rawCluster !== 'all') {
      sql += ' AND (LOWER(cluster_id) = LOWER(?) OR LOWER(cluster_id) IN (SELECT LOWER(id) FROM clusters WHERE LOWER(name) = LOWER(?)))';
      params.push(rawCluster, rawCluster);
    }
    if (academicYearId) {
      sql += ' AND (academic_year_id = ? OR academic_year_id = "" OR academic_year_id IS NULL OR academic_year_id = (SELECT name FROM academic_years WHERE id = ? LIMIT 1) OR academic_year_id = (SELECT id FROM academic_years WHERE name = ? LIMIT 1))';
      params.push(academicYearId, academicYearId, academicYearId);
    }
    const [rows] = await pool.query<any[]>(sql, params);

    const approvedChangeParams: any[] = [];
    let approvedChangeSql = `
      SELECT DISTINCT r.day_number
      FROM photo_change_requests r
      WHERE r.status = 'APPROVED'
        AND (
          LOWER(r.cluster_id) = LOWER(?)
          OR LOWER(r.cluster_id) IN (SELECT LOWER(id) FROM clusters WHERE LOWER(name) = LOWER(?))
        )`;
    approvedChangeParams.push(rawCluster, rawCluster);
    if (academicYearId) {
      approvedChangeSql += ' AND (r.academic_year_id = ? OR r.academic_year_id = "" OR r.academic_year_id IS NULL)';
      approvedChangeParams.push(academicYearId);
    }
    const [approvedChangeRows] = rawCluster && rawCluster !== 'all'
      ? await pool.query<any[]>(approvedChangeSql, approvedChangeParams)
      : await pool.query<any[]>(
          `SELECT DISTINCT day_number FROM photo_change_requests WHERE status = 'APPROVED'${academicYearId ? ' AND (academic_year_id = ? OR academic_year_id = "" OR academic_year_id IS NULL)' : ''}`,
          academicYearId ? [academicYearId] : [],
        );
    const approvedChangeDays = new Set(approvedChangeRows.map((row: any) => Number(row.day_number)));

    let countSql = 'SELECT cluster_id, day_number, COUNT(*) as count FROM session_photos WHERE 1=1';
    const countParams: any[] = [];
    if (rawCluster && rawCluster !== 'all') {
      countSql += ' AND (LOWER(cluster_id) = LOWER(?) OR LOWER(cluster_id) IN (SELECT LOWER(id) FROM clusters WHERE LOWER(name) = LOWER(?)))';
      countParams.push(rawCluster, rawCluster);
    }
    if (academicYearId) {
      countSql += ' AND (academic_year_id = ? OR academic_year_id = "" OR academic_year_id IS NULL OR academic_year_id = (SELECT name FROM academic_years WHERE id = ? LIMIT 1) OR academic_year_id = (SELECT id FROM academic_years WHERE name = ? LIMIT 1))';
      countParams.push(academicYearId, academicYearId, academicYearId);
    }
    countSql += ' GROUP BY cluster_id, day_number';
    const [countRows] = await pool.query<any[]>(countSql, countParams);

    const countMap: Record<number, number> = {};
    for (const c of countRows) {
      const dNum = Number(c.day_number);
      countMap[dNum] = (countMap[dNum] || 0) + Number(c.count);
    }

    const dayDataList: any[] = [];
    for (let d = 1; d <= 20; d++) {
      const foundStatus = rows.find((r: any) => Number(r.day_number) === d);
      dayDataList.push({
        dayNumber: d,
        status: approvedChangeDays.has(d) ? 'EDIT_APPROVED' : foundStatus ? foundStatus.status : 'DRAFT',
        photoCount: countMap[d] || 0,
        maxPhotos: 50,
      });
    }

    // Also build clusterSummaries for Super Admin view
    let allSubsSql = 'SELECT * FROM session_photo_submissions WHERE 1=1';
    const allSubsParams: any[] = [];
    if (academicYearId) {
      allSubsSql += ' AND (academic_year_id = ? OR academic_year_id = "" OR academic_year_id IS NULL OR academic_year_id = (SELECT name FROM academic_years WHERE id = ? LIMIT 1) OR academic_year_id = (SELECT id FROM academic_years WHERE name = ? LIMIT 1))';
      allSubsParams.push(academicYearId, academicYearId, academicYearId);
    }
    const [allSubs] = await pool.query<any[]>(allSubsSql, allSubsParams);

    let allCountsSql = 'SELECT cluster_id, day_number, COUNT(*) as count FROM session_photos WHERE 1=1';
    const allCountsParams: any[] = [];
    if (academicYearId) {
      allCountsSql += ' AND (academic_year_id = ? OR academic_year_id = "" OR academic_year_id IS NULL OR academic_year_id = (SELECT name FROM academic_years WHERE id = ? LIMIT 1) OR academic_year_id = (SELECT id FROM academic_years WHERE name = ? LIMIT 1))';
      allCountsParams.push(academicYearId, academicYearId, academicYearId);
    }
    allCountsSql += ' GROUP BY cluster_id, day_number';
    const [allCounts] = await pool.query<any[]>(allCountsSql, allCountsParams);

    const clusterSummaries = clusters.map((c) => {
      const cSubs = allSubs.filter((s) => String(s.cluster_id).toLowerCase() === String(c.id).toLowerCase() || String(s.cluster_id).toLowerCase() === String(c.name).toLowerCase());
      const cCounts = allCounts.filter((cnt) => String(cnt.cluster_id).toLowerCase() === String(c.id).toLowerCase() || String(cnt.cluster_id).toLowerCase() === String(c.name).toLowerCase());

      const cCountMap: Record<number, number> = {};
      let totalClusterPhotos = 0;
      for (const cnt of cCounts) {
        const num = Number(cnt.day_number);
        const count = Number(cnt.count);
        cCountMap[num] = count;
        totalClusterPhotos += count;
      }

      let submittedDaysCount = 0;
      const days = [];
      for (let d = 1; d <= 8; d++) {
        const sub = cSubs.find((s) => Number(s.day_number) === d);
        const st = sub ? String(sub.status).toUpperCase() : 'DRAFT';
        if (['SUBMITTED', 'PENDING REVIEW', 'APPROVED', 'EDIT_REQUESTED'].includes(st)) {
          submittedDaysCount++;
        }
        days.push({
          dayNumber: d,
          status: st,
          photoCount: cCountMap[d] || 0,
          maxPhotos: 50,
          submittedBy: sub?.submitted_by || null,
          submittedAt: sub?.submitted_at || null,
          isLocked: ['SUBMITTED', 'PENDING REVIEW', 'APPROVED', 'EDIT_REQUESTED'].includes(st),
        });
      }

      return {
        clusterId: c.id,
        clusterName: c.name,
        district: c.district,
        totalPhotos: totalClusterPhotos,
        submittedDaysCount,
        days,
      };
    });

    res.json({
      success: true,
      statuses: rows,
      counts: countMap,
      data: dayDataList,
      clusterSummaries,
    });
  } catch (error) {
    console.error('Failed to get day photo statuses:', error);
    res.status(500).json({ success: false, error: 'Unable to get photo submission statuses.' });
  }
});

app.post('/api/session-photos/submissions/approve', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== 'Super Admin') {
      res.status(403).json({ success: false, error: 'Only Super Admin can approve day photo submissions.' });
      return;
    }
    const clusterId = String(req.body.clusterId || '').trim();
    const dayNumber = Number(req.body.dayNumber);
    const academicYearId = String(req.body.academicYearId || '').trim();

    await pool.query(
      `UPDATE session_photo_submissions 
       SET status = 'APPROVED', reviewed_by = ?, reviewed_at = NOW() 
       WHERE (LOWER(cluster_id) = LOWER(?) OR LOWER(cluster_id) IN (SELECT LOWER(id) FROM clusters WHERE LOWER(name) = LOWER(?)))
         AND day_number = ?
         AND (academic_year_id = ? OR ? = "" OR academic_year_id = (SELECT name FROM academic_years WHERE id = ? LIMIT 1))`,
      [req.user.name || 'Super Admin', clusterId, clusterId, dayNumber, academicYearId, academicYearId, academicYearId]
    );

    // Notification for Cluster Admin
    await pool.query(
      'INSERT INTO notifications (id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [randomUUID(), 'Session photos approved.', `Super Admin approved Day ${dayNumber} photos for cluster ${clusterId}.`, 'session_photos']
    );

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, clusterId, 'DAY_PHOTOS_APPROVED', 'Session Photos', `${clusterId}-day-${dayNumber}`, `Super Admin approved Day ${dayNumber} photos collection.`]
    );

    res.json({ success: true, message: `Day ${dayNumber} photos approved successfully.` });
  } catch (error) {
    console.error('Failed to approve day photos:', error);
    res.status(500).json({ success: false, error: 'Unable to approve day photos.' });
  }
});

app.post('/api/session-photos/upload', requireAuth, photoUploadMiddleware.array('photos', 50), async (req: AuthenticatedRequest & { files?: Express.Multer.File[] }, res: Response) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      res.status(400).json({ success: false, error: 'No photos were selected to upload.' });
      return;
    }

    const targetCluster = String(req.body.clusterId || req.user.clusterId || 'dharmapuri').toLowerCase();
    if (req.user.role === 'Cluster Admin') {
      if (targetCluster && targetCluster !== String(req.user.clusterId).toLowerCase()) {
        res.status(403).json({ success: false, error: 'Forbidden. You can only upload photos for your assigned cluster.' });
        return;
      }
    }
    const clusterId = req.user.role === 'Cluster Admin' ? req.user.clusterId : targetCluster;
    const sessionId = String(req.body.sessionId || `session-${Date.now()}`);
    const dayNumber = Number(req.body.dayNumber || 1);
    const academicYearId = String(req.body.academicYearId || '').trim();
    const uploadedBy = String(req.body.uploadedBy || req.user.name || 'Cluster Admin');
    const uploadedRole = String(req.body.uploadedRole || req.user.role || 'Cluster Admin');
    const sessionTitle = String(req.body.sessionTitle || `Session Day ${dayNumber}`);
    const uploaderName = uploadedBy || req.user.name || 'Cluster Admin';

    // 1. Check Submission Lock
    if (req.user.role === 'Cluster Admin') {
      const [subRows] = await pool.query<any[]>(
        'SELECT status FROM session_photo_submissions WHERE cluster_id = ? AND day_number = ? AND (academic_year_id = ? OR ? = "") LIMIT 1',
        [clusterId, dayNumber, academicYearId, academicYearId]
      );
      if (subRows.length > 0) {
        const subStatus = String(subRows[0].status).toUpperCase();
        if (['SUBMITTED', 'PENDING REVIEW', 'APPROVED', 'EDIT_REQUESTED'].includes(subStatus)) {
          res.status(403).json({
            success: false,
            error: 'Photos for this day/session are submitted and locked. Direct photo upload is not permitted. Please request approval from Super Admin.',
          });
          return;
        }
      }
    }

    // 2. Enforce 50 photos PER DAY/SESSION Limit
    const [countRows] = await pool.query<any[]>(
      'SELECT COUNT(*) as count FROM session_photos WHERE cluster_id = ? AND day_number = ? AND (academic_year_id = ? OR ? = "" OR academic_year_id IS NULL)',
      [clusterId, dayNumber, academicYearId, academicYearId]
    );
    const currentCount = Number(countRows[0]?.count || 0);
    if (currentCount + files.length > 50) {
      res.status(400).json({
        success: false,
        error: `Maximum 50 photos per Day/Session allowed. Currently ${currentCount}/50. Cannot upload ${files.length} more photo(s).`,
      });
      return;
    }

    const savedPhotos: any[] = [];
    for (const file of files) {
      const rowId = randomUUID();
      const filePath = path.join(PHOTO_STORAGE_DIR, file.filename);
      const fileUrl = `/api/session-photos/file/${rowId}`;
      const originalName = file.originalname || 'photo.jpg';

      await pool.query(
        'INSERT INTO session_photos (id, cluster_id, session_id, day_number, file_path, file_url, original_filename, mime_type, file_size, uploaded_by, academic_year_id, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
        [rowId, clusterId, sessionId, dayNumber, filePath, fileUrl, originalName, file.mimetype, file.size, uploaderName, academicYearId || null],
      );

      savedPhotos.push(mapSessionPhotoRow({
        id: rowId,
        cluster_id: clusterId,
        session_id: sessionId,
        day_number: dayNumber,
        file_path: filePath,
        file_url: fileUrl,
        original_filename: originalName,
        mime_type: file.mimetype,
        file_size: file.size,
        uploaded_by: uploaderName,
        academic_year_id: academicYearId,
        uploaded_at: new Date().toISOString(),
      }, req.user.name));
    }

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, clusterId, 'PHOTO_UPLOADED', 'Session Photos', sessionId, `Uploaded ${savedPhotos.length} photo(s) for Day ${dayNumber}. Total now: ${currentCount + savedPhotos.length}/50`]
    );

    res.json({
      success: true,
      message: `Uploaded ${savedPhotos.length} photo(s).`,
      photos: savedPhotos,
      data: savedPhotos[0] || null,
      sessionTitle,
      count: currentCount + savedPhotos.length,
      maxPhotos: 50,
    });
  } catch (error) {
    console.error('Failed to upload session photos:', error);
    res.status(500).json({ success: false, error: 'Unable to upload session photos.' });
  }
});

app.delete('/api/session-photos/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const photoId = String(req.params.id);
    const [rows] = await pool.query<any[]>('SELECT * FROM session_photos WHERE id = ? LIMIT 1', [photoId]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Photo not found.' });
      return;
    }
    const photo = rows[0];

    // Cluster ownership check
    if (req.user.role === 'Cluster Admin') {
      if (String(photo.cluster_id).toLowerCase() !== String(req.user.clusterId).toLowerCase()) {
        res.status(403).json({ success: false, error: 'Forbidden. You do not have permission to delete photos for another cluster.' });
        return;
      }
    }

    // Lock check: if submitted, direct delete is forbidden!
    if (req.user.role === 'Cluster Admin') {
      const [subRows] = await pool.query<any[]>(
        'SELECT status FROM session_photo_submissions WHERE cluster_id = ? AND day_number = ? AND (academic_year_id = ? OR ? = "" OR academic_year_id IS NULL) LIMIT 1',
        [photo.cluster_id, photo.day_number, photo.academic_year_id || '', photo.academic_year_id || '']
      );
      if (subRows.length > 0) {
        const subStatus = String(subRows[0].status).toUpperCase();
        if (['SUBMITTED', 'PENDING REVIEW', 'APPROVED', 'EDIT_REQUESTED'].includes(subStatus)) {
          res.status(403).json({
            success: false,
            error: 'Photos for this day have been submitted and locked. Direct deletion is not allowed. Please submit a delete request for Super Admin approval.',
          });
          return;
        }
      }
    }

    // Direct deletion allowed (Draft or Super Admin)
    // 1. Unlink physical file
    if (photo.file_path && fs.existsSync(photo.file_path)) {
      try {
        fs.unlinkSync(photo.file_path);
      } catch (err) {
        console.warn(`[WARN] Could not unlink file ${photo.file_path}:`, err);
      }
    }

    // 2. Delete DB records
    await pool.query('DELETE FROM photo_delete_requests WHERE photo_id = ?', [photoId]);
    await pool.query('DELETE FROM session_photos WHERE id = ?', [photoId]);

    // 3. Audit log
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, photo.cluster_id, 'PHOTO_DELETED', 'Session Photos', photoId, `Deleted photo ${photo.original_filename || photoId} from Day ${photo.day_number}`]
    );

    res.json({
      success: true,
      message: 'Photo deleted successfully.',
    });
  } catch (error) {
    console.error('Failed to delete photo:', error);
    res.status(500).json({ success: false, error: 'Unable to delete photo.' });
  }
});

app.post('/api/session-photos/submit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dayNumber = Number(req.body.dayNumber);
    const academicYearId = String(req.body.academicYearId || '').trim();
    const targetCluster = String(req.body.clusterId || req.user.clusterId || '').trim().toLowerCase();

    if (req.user.role === 'Cluster Admin') {
      if (targetCluster && targetCluster !== String(req.user.clusterId).toLowerCase()) {
        res.status(403).json({ success: false, error: 'Forbidden. You cannot submit photos for another cluster.' });
        return;
      }
    }
    const clusterId = req.user.role === 'Cluster Admin' ? req.user.clusterId : targetCluster;

    if (!dayNumber || !clusterId) {
      res.status(400).json({ success: false, error: 'Day number and cluster are required.' });
      return;
    }

    // Ensure at least 1 photo exists
    const [photos] = await pool.query<any[]>(
      'SELECT id FROM session_photos WHERE cluster_id = ? AND day_number = ? AND (academic_year_id = ? OR ? = "" OR academic_year_id IS NULL)',
      [clusterId, dayNumber, academicYearId, academicYearId]
    );
    if (!photos.length) {
      res.status(400).json({ success: false, error: 'Please upload at least one photograph before submitting.' });
      return;
    }

    const subId = randomUUID();
    await pool.query(
      `INSERT INTO session_photo_submissions (id, cluster_id, academic_year_id, day_number, status, submitted_by, submitted_at)
       VALUES (?, ?, ?, ?, 'SUBMITTED', ?, NOW())
       ON DUPLICATE KEY UPDATE status = 'SUBMITTED', submitted_by = VALUES(submitted_by), submitted_at = NOW()`,
      [subId, clusterId, academicYearId, dayNumber, req.user.name || req.user.id]
    );

    // Register in approvals table for Super Admin
    const approvalId = randomUUID();
    await pool.query(
      `INSERT INTO approvals (id, module, type, reference, record_id, status, requested_by, requestedBy, remarks, cluster_id, clusterId, academic_year_id, created_at)
       VALUES (?, 'Session Photos', 'Day Photos Submission', ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, NOW())`,
      [approvalId, `Day ${dayNumber} Photos`, subId, req.user.name, req.user.name, `Day ${dayNumber} photo collection submitted for review (${photos.length} photos)`, clusterId, clusterId, academicYearId]
    );

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, clusterId, 'PHOTO_SUBMITTED', 'Session Photos', subId, `Submitted Day ${dayNumber} photos for review (${photos.length} photos)`]
    );

    // Notification for Super Admin
    await pool.query(
      'INSERT INTO notifications (id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [randomUUID(), 'New session photos submitted for review.', `Cluster ${clusterId} submitted ${photos.length} photos for Day ${dayNumber}.`, 'session_photos']
    );

    res.json({
      success: true,
      message: 'Session photos submitted for review successfully.',
      status: 'SUBMITTED',
    });
  } catch (error) {
    console.error('Failed to submit session photos:', error);
    res.status(500).json({ success: false, error: 'Unable to submit session photos.' });
  }
});

app.post('/api/session-photos/request-delete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const photoId = String(req.body.photoId || '').trim();
    const reason = String(req.body.reason || '').trim();

    if (!photoId) {
      res.status(400).json({ success: false, error: 'Photo ID is required.' });
      return;
    }
    if (!reason) {
      res.status(400).json({ success: false, error: 'Reason for deletion is mandatory.' });
      return;
    }

    const [rows] = await pool.query<any[]>('SELECT * FROM session_photos WHERE id = ? LIMIT 1', [photoId]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Photo was not found.' });
      return;
    }

    const photo = rows[0];
    if (req.user.role === 'Cluster Admin') {
      if (String(photo.cluster_id).toLowerCase() !== String(req.user.clusterId).toLowerCase()) {
        res.status(403).json({ success: false, error: 'Forbidden. You do not have permission to request deletion for this photo.' });
        return;
      }
    }

    // Check if delete request already pending
    const [existingReq] = await pool.query<any[]>(
      'SELECT id FROM photo_delete_requests WHERE photo_id = ? AND status = "PENDING" LIMIT 1',
      [photoId]
    );
    if (existingReq.length > 0) {
      res.status(400).json({ success: false, error: 'A delete request is already pending approval for this photograph.' });
      return;
    }

    const requestId = randomUUID();
    await pool.query(
      `INSERT INTO photo_delete_requests (id, photo_id, cluster_id, academic_year_id, day_number, session_id, requested_by, requested_by_name, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW())`,
      [requestId, photoId, photo.cluster_id, photo.academic_year_id || '', photo.day_number, photo.session_id, req.user.id, req.user.name, reason]
    );

    // Update photo delete request status
    await pool.query(
      'UPDATE session_photos SET delete_request_status = "PENDING", delete_request_id = ? WHERE id = ?',
      [requestId, photoId]
    );

    // Add to approvals table
    const approvalId = randomUUID();
    await pool.query(
      `INSERT INTO approvals (id, module, type, reference, record_id, status, requested_by, requestedBy, remarks, cluster_id, clusterId, academic_year_id, created_at)
       VALUES (?, 'Session Photos', 'Photo Deletion', ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, NOW())`,
      [approvalId, photo.original_filename || `Day ${photo.day_number} Photo`, requestId, req.user.name, req.user.name, reason, photo.cluster_id, photo.cluster_id, photo.academic_year_id || '']
    );

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, photo.cluster_id, 'PHOTO_DELETE_REQUESTED', 'Session Photos', photoId, `Delete requested for ${photo.original_filename}. Reason: ${reason}`]
    );

    // Notification for Super Admin
    await pool.query(
      'INSERT INTO notifications (id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [randomUUID(), 'Photo deletion request requires approval.', `Cluster Admin ${req.user.name} requested deletion of photo ${photo.original_filename}. Reason: ${reason}`, 'session_photos']
    );

    res.json({
      success: true,
      message: 'Photo deletion request submitted for Super Admin review.',
      requestId,
      data: { id: requestId },
    });
  } catch (error) {
    console.error('Failed to submit photo delete request:', error);
    res.status(500).json({ success: false, error: 'Unable to submit delete request.' });
  }
});

app.get('/api/session-photos/delete-requests', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let sql = `
      SELECT pdr.*,
             sp.original_filename,
             sp.file_url,
             sp.file_path,
             c.name as cluster_name,
             ay.name as academic_year_name,
             pd.day_name,
             s.title as session_title,
             asetup.session_name
      FROM photo_delete_requests pdr
      LEFT JOIN session_photos sp ON sp.id = pdr.photo_id
      LEFT JOIN clusters c ON c.id = pdr.cluster_id
      LEFT JOIN academic_years ay ON ay.id = pdr.academic_year_id
      LEFT JOIN program_days pd ON (pd.day_number = pdr.day_number AND pd.academic_year_id = pdr.academic_year_id)
      LEFT JOIN sessions s ON s.id = pdr.session_id
      LEFT JOIN academic_setup asetup ON (asetup.day_number = pdr.day_number AND (asetup.academic_year = ay.name OR ay.name IS NULL))
      WHERE 1=1
    `;
    const params: any[] = [];
    if (req.user.role === 'Cluster Admin') {
      sql += ' AND pdr.cluster_id = ?';
      params.push(req.user.clusterId);
    } else if (req.query.clusterId && req.query.clusterId !== 'all') {
      sql += ' AND pdr.cluster_id = ?';
      params.push(String(req.query.clusterId));
    }
    sql += ' ORDER BY pdr.created_at DESC';

    const [rows] = await pool.query<any[]>(sql, params);
    const requests = rows.map((r) => ({
      id: r.id,
      photoId: r.photo_id,
      clusterId: r.cluster_id,
      clusterName: r.cluster_name || r.cluster_id,
      academicYearId: r.academic_year_id,
      academicYear: r.academic_year_name || '2025–2026',
      dayNumber: Number(r.day_number),
      dayName: r.day_name || `Day ${r.day_number}`,
      sessionName: r.session_name || r.session_title || `Day ${r.day_number} Session`,
      fileName: r.original_filename || 'photo.jpg',
      fileUrl: r.file_url || `/api/session-photos/file/${r.photo_id}`,
      requestedBy: r.requested_by_name || 'Cluster Admin',
      reason: r.reason,
      requestedDate: r.created_at,
      status: r.status,
      reviewedBy: r.reviewed_by,
      reviewedAt: r.reviewed_at,
    }));

    res.json({ success: true, requests });
  } catch (error) {
    console.error('Failed to load photo delete requests:', error);
    res.status(500).json({ success: false, error: 'Unable to load delete requests.' });
  }
});

app.post('/api/session-photos/delete-requests/:id/approve', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can approve photo deletion requests.' });
    return;
  }

  try {
    const [reqRows] = await pool.query<any[]>('SELECT * FROM photo_delete_requests WHERE id = ? LIMIT 1', [req.params.id]);
    if (!reqRows.length) {
      res.status(404).json({ success: false, error: 'Delete request not found.' });
      return;
    }
    const delReq = reqRows[0];
    if (delReq.status !== 'PENDING') {
      res.status(409).json({ success: false, error: `This request has already been ${delReq.status.toLowerCase()}.` });
      return;
    }

    // 1. Fetch photo details
    const [photoRows] = await pool.query<any[]>('SELECT * FROM session_photos WHERE id = ? LIMIT 1', [delReq.photo_id]);
    const photo = photoRows[0];

    // 2. Delete actual file from physical storage
    if (photo && photo.file_path && fs.existsSync(photo.file_path)) {
      try {
        fs.unlinkSync(photo.file_path);
      } catch (unlinkErr) {
        console.warn('Physical photo file unlink warning:', unlinkErr);
      }
    }

    // 3. Delete record from session_photos database
    await pool.query('DELETE FROM session_photos WHERE id = ?', [delReq.photo_id]);

    // 4. Update photo_delete_requests
    await pool.query(
      'UPDATE photo_delete_requests SET status = "APPROVED", reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      [req.user.name || 'Super Admin', delReq.id]
    );

    // 5. Update approvals table
    await pool.query(
      'UPDATE approvals SET status = "Approved", reviewed_by = ?, reviewed_at = NOW() WHERE record_id = ? OR id = ?',
      [req.user.name || 'Super Admin', delReq.id, delReq.id]
    );

    // 6. Audit logs
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, delReq.cluster_id, 'PHOTO_DELETE_APPROVED', 'Session Photos', delReq.photo_id, `Approved deletion of photo ${photo?.original_filename || delReq.photo_id}. Reason: ${delReq.reason}`]
    );
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, delReq.cluster_id, 'PHOTO_DELETED', 'Session Photos', delReq.photo_id, `Photo permanently removed from database and storage by Super Admin approval.`]
    );

    // 7. Notify Cluster Admin
    await pool.query(
      'INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())',
      [randomUUID(), delReq.requested_by, 'Your photo deletion request has been approved.', `Your request to delete photo ${photo?.original_filename || delReq.photo_id} was approved by Super Admin.`, 'session_photos']
    );

    res.json({ success: true, message: 'Photo deleted successfully.' });
  } catch (error) {
    console.error('Failed to approve photo delete request:', error);
    res.status(500).json({ success: false, error: 'Unable to process photo deletion approval.' });
  }
});

app.post('/api/session-photos/delete-requests/:id/reject', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can reject photo deletion requests.' });
    return;
  }

  try {
    const [reqRows] = await pool.query<any[]>('SELECT * FROM photo_delete_requests WHERE id = ? LIMIT 1', [req.params.id]);
    if (!reqRows.length) {
      res.status(404).json({ success: false, error: 'Delete request not found.' });
      return;
    }
    const delReq = reqRows[0];
    if (delReq.status !== 'PENDING') {
      res.status(409).json({ success: false, error: `This request has already been ${delReq.status.toLowerCase()}.` });
      return;
    }

    const remarks = req.body.remarks ? String(req.body.remarks).trim() : null;

    // Update photo_delete_requests
    await pool.query(
      'UPDATE photo_delete_requests SET status = "REJECTED", reviewed_by = ?, reviewed_at = NOW(), review_remarks = ? WHERE id = ?',
      [req.user.name || 'Super Admin', remarks, delReq.id]
    );

    // Update session_photos
    await pool.query(
      'UPDATE session_photos SET delete_request_status = "REJECTED" WHERE id = ?',
      [delReq.photo_id]
    );

    // Update approvals table
    await pool.query(
      'UPDATE approvals SET status = "Rejected", reviewed_by = ?, reviewed_at = NOW() WHERE record_id = ? OR id = ?',
      [req.user.name || 'Super Admin', delReq.id, delReq.id]
    );

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, delReq.cluster_id, 'PHOTO_DELETE_REJECTED', 'Session Photos', delReq.photo_id, `Rejected deletion request for photo ${delReq.photo_id}. Remarks: ${remarks || 'None'}`]
    );

    // Notify Cluster Admin
    await pool.query(
      'INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())',
      [randomUUID(), delReq.requested_by, 'Your photo deletion request has been rejected.', remarks ? `Your request was rejected. Remarks: ${remarks}` : 'Your photo deletion request has been rejected by Super Admin.', 'session_photos']
    );

    res.json({ success: true, message: 'Photo delete request rejected.' });
  } catch (error) {
    console.error('Failed to reject photo delete request:', error);
    res.status(500).json({ success: false, error: 'Unable to process photo delete rejection.' });
  }
});

app.post('/api/session-photos/request-change', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dayNumber = Number(req.body.dayNumber);
    const academicYearId = String(req.body.academicYearId || '').trim();
    const reason = String(req.body.reason || '').trim();
    const targetCluster = String(req.body.clusterId || req.user.clusterId || '').trim().toLowerCase();

    if (req.user.role === 'Cluster Admin') {
      if (targetCluster && targetCluster !== String(req.user.clusterId).toLowerCase()) {
        res.status(403).json({ success: false, error: 'Forbidden. You cannot request changes for another cluster.' });
        return;
      }
    }
    const clusterId = req.user.role === 'Cluster Admin' ? req.user.clusterId : targetCluster;

    if (!dayNumber || !clusterId) {
      res.status(400).json({ success: false, error: 'Day number and cluster are required.' });
      return;
    }
    if (!reason) {
      res.status(400).json({ success: false, error: 'Reason for photo correction/change is mandatory.' });
      return;
    }

    const reqId = randomUUID();
    await pool.query(
      `INSERT INTO photo_change_requests (id, cluster_id, academic_year_id, day_number, requested_by, requested_by_name, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW())`,
      [reqId, clusterId, academicYearId, dayNumber, req.user.id, req.user.name, reason]
    );

    // Set status to EDIT_REQUESTED
    await pool.query(
      'UPDATE session_photo_submissions SET status = "EDIT_REQUESTED" WHERE cluster_id = ? AND day_number = ? AND (academic_year_id = ? OR ? = "")',
      [clusterId, dayNumber, academicYearId, academicYearId]
    );

    // Register in approvals
    const approvalId = randomUUID();
    await pool.query(
      `INSERT INTO approvals (id, module, type, reference, record_id, status, requested_by, requestedBy, remarks, cluster_id, clusterId, academic_year_id, created_at)
       VALUES (?, 'Session Photos', 'Photo Change', ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, NOW())`,
      [approvalId, `Day ${dayNumber} Photo Change`, reqId, req.user.name, req.user.name, reason, clusterId, clusterId, academicYearId]
    );

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, clusterId, 'PHOTO_EDIT_REQUESTED', 'Session Photos', reqId, `Photo change requested for Day ${dayNumber}. Reason: ${reason}`]
    );

    // Notify Super Admin
    await pool.query(
      'INSERT INTO notifications (id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [randomUUID(), 'Photo change request requires approval.', `Cluster ${clusterId} requested photo changes for Day ${dayNumber}. Reason: ${reason}`, 'session_photos']
    );

    res.json({ success: true, message: 'Photo change request submitted for Super Admin review.' });
  } catch (error) {
    console.error('Failed to submit photo change request:', error);
    res.status(500).json({ success: false, error: 'Unable to submit photo change request.' });
  }
});

app.post('/api/session-photos/change-requests/:id/approve', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can approve photo change requests.' });
    return;
  }

  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM photo_change_requests WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Change request not found.' });
      return;
    }
    const cReq = rows[0];

    // Unlock ONLY that specific Day/Session collection for that cluster
    await pool.query(
      'UPDATE session_photo_submissions SET status = "EDIT_APPROVED" WHERE cluster_id = ? AND day_number = ? AND (academic_year_id = ? OR ? = "")',
      [cReq.cluster_id, cReq.day_number, cReq.academic_year_id || '', cReq.academic_year_id || '']
    );

    await pool.query(
      'UPDATE photo_change_requests SET status = "APPROVED", reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      [req.user.name || 'Super Admin', cReq.id]
    );

    await pool.query(
      'UPDATE approvals SET status = "Approved", reviewed_by = ?, reviewed_at = NOW() WHERE record_id = ? OR id = ?',
      [req.user.name || 'Super Admin', cReq.id, cReq.id]
    );

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, cReq.cluster_id, 'PHOTO_EDIT_APPROVED', 'Session Photos', cReq.id, `Approved photo change request for Day ${cReq.day_number}. Scope unlocked.`]
    );

    // Notify Cluster Admin
    await pool.query(
      'INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())',
      [randomUUID(), cReq.requested_by, 'Photo change request approved.', `You may now make corrections/additions to Day ${cReq.day_number} photos.`, 'session_photos']
    );

    res.json({ success: true, message: 'Photo change request approved. Day collection unlocked for editing.' });
  } catch (error) {
    console.error('Failed to approve photo change request:', error);
    res.status(500).json({ success: false, error: 'Unable to approve photo change request.' });
  }
});

app.post('/api/session-photos/change-requests/:id/reject', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can reject photo change requests.' });
    return;
  }

  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM photo_change_requests WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Change request not found.' });
      return;
    }
    const cReq = rows[0];
    const remarks = req.body.remarks ? String(req.body.remarks).trim() : null;

    // Reset status back to SUBMITTED
    await pool.query(
      'UPDATE session_photo_submissions SET status = "SUBMITTED" WHERE cluster_id = ? AND day_number = ? AND (academic_year_id = ? OR ? = "")',
      [cReq.cluster_id, cReq.day_number, cReq.academic_year_id || '', cReq.academic_year_id || '']
    );

    await pool.query(
      'UPDATE photo_change_requests SET status = "REJECTED", reviewed_by = ?, reviewed_at = NOW(), review_remarks = ? WHERE id = ?',
      [req.user.name || 'Super Admin', remarks, cReq.id]
    );

    await pool.query(
      'UPDATE approvals SET status = "Rejected", reviewed_by = ?, reviewed_at = NOW() WHERE record_id = ? OR id = ?',
      [req.user.name || 'Super Admin', cReq.id, cReq.id]
    );

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, cReq.cluster_id, 'PHOTO_EDIT_REJECTED', 'Session Photos', cReq.id, `Rejected photo change request for Day ${cReq.day_number}. Remarks: ${remarks || 'None'}`]
    );

    // Notify Cluster Admin
    await pool.query(
      'INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())',
      [randomUUID(), cReq.requested_by, 'Photo change request rejected.', remarks ? `Your request was rejected. Remarks: ${remarks}` : 'Your photo change request was rejected by Super Admin.', 'session_photos']
    );

    res.json({ success: true, message: 'Photo change request rejected.' });
  } catch (error) {
    console.error('Failed to reject photo change request:', error);
    res.status(500).json({ success: false, error: 'Unable to reject photo change request.' });
  }
});


app.get('/api/approvals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let sql = 'SELECT * FROM approvals WHERE 1=1';
    const params: any[] = [];
    const academicYearId = String(req.query.academicYearId || '').trim();
    if (academicYearId) {
      sql += ' AND (academic_year_id = ? OR (sessionId IS NOT NULL AND EXISTS (SELECT 1 FROM sessions s WHERE s.id = approvals.sessionId AND s.academic_year_id = ?)))';
      params.push(academicYearId, academicYearId);
    }
    if (req.user.role === 'Cluster Admin') {
      sql += ' AND cluster_id = ?';
      params.push(req.user.clusterId);
    } else if (req.query.clusterId && req.query.clusterId !== 'all') {
      sql += ' AND cluster_id = ?';
      params.push(String(req.query.clusterId));
    }
    sql += ' ORDER BY created_at DESC, id DESC';
    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, approvals: rows.map((row) => ({
      id: row.id,
      module: row.module || 'Sessions',
      recordId: row.record_id || row.id,
      recordTitle: row.record_id || 'Approval request',
      submittedBy: row.requested_by || '',
      submittedAt: row.created_at,
      status: row.status === 'PENDING' ? 'Pending' : row.status,
      clusterId: row.cluster_id || 'all',
      clusterName: row.cluster_id || 'All Clusters',
      details: '',
      correctionReason: undefined,
    })) });
  } catch (error) {
    console.error('Failed to load approvals:', error);
    res.status(503).json({ success: false, error: 'Unable to load approvals. Please try again.' });
  }
});

app.post('/api/approvals/:id/:action', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== 'Super Admin') {
      res.status(403).json({ success: false, error: 'Only Super Admin can review submissions.' });
      return;
    }
    const action = String(req.params.action);
    const status = action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : action === 'request-correction' ? 'Correction Requested' : null;
    if (!status) {
      res.status(400).json({ success: false, error: 'Unsupported approval action.' });
      return;
    }
    const remarks = req.body.remarks ? String(req.body.remarks).trim() : null;

    const [approvalRows] = await pool.query<any[]>('SELECT * FROM approvals WHERE id = ? LIMIT 1', [req.params.id]);
    if (!approvalRows.length) {
      res.status(404).json({ success: false, error: 'Approval request not found.' });
      return;
    }
    const approval = approvalRows[0];
    if (['Approved', 'Rejected', 'DELETED'].includes(String(approval.status))) {
      res.status(409).json({ success: false, error: 'This submission has already reached a final status.' });
      return;
    }

    await pool.query('UPDATE approvals SET status = ?, updated_at = NOW() WHERE id = ?', [status, req.params.id]);

    // Handle Session Photos module specific side-effects
    if (approval.module === 'Session Photos') {
      if (approval.type === 'Photo Deletion') {
        const [delRows] = await pool.query<any[]>(
          'SELECT * FROM photo_delete_requests WHERE id = ? OR photo_id = ? LIMIT 1',
          [approval.record_id, approval.record_id]
        );
        if (delRows.length > 0) {
          const delReq = delRows[0];
          if (action === 'approve') {
            const [photoRows] = await pool.query<any[]>('SELECT * FROM session_photos WHERE id = ? LIMIT 1', [delReq.photo_id]);
            if (photoRows.length > 0) {
              const photo = photoRows[0];
              if (photo.file_path && fs.existsSync(photo.file_path)) {
                try {
                  fs.unlinkSync(photo.file_path);
                } catch (e) {
                  console.warn('Physical file deletion warning in approval handler:', e);
                }
              }
              await pool.query('DELETE FROM session_photos WHERE id = ?', [delReq.photo_id]);
            }
            await pool.query('UPDATE photo_delete_requests SET status = "APPROVED", reviewed_by = ?, reviewed_at = NOW() WHERE id = ?', [req.user.name || 'Super Admin', delReq.id]);
          } else if (action === 'reject') {
            await pool.query('UPDATE photo_delete_requests SET status = "REJECTED", reviewed_by = ?, reviewed_at = NOW(), review_remarks = ? WHERE id = ?', [req.user.name || 'Super Admin', remarks, delReq.id]);
            await pool.query('UPDATE session_photos SET delete_request_status = "REJECTED" WHERE id = ?', [delReq.photo_id]);
          }
        }
      } else if (approval.type === 'Photo Change') {
        const [changeRows] = await pool.query<any[]>(
          'SELECT * FROM photo_change_requests WHERE id = ? LIMIT 1',
          [approval.record_id]
        );
        if (changeRows.length > 0) {
          const cReq = changeRows[0];
          if (action === 'approve') {
            await pool.query(
              'UPDATE session_photo_submissions SET status = "EDIT_APPROVED" WHERE cluster_id = ? AND day_number = ? AND (academic_year_id = ? OR ? = "")',
              [cReq.cluster_id, cReq.day_number, cReq.academic_year_id || '', cReq.academic_year_id || '']
            );
            await pool.query('UPDATE photo_change_requests SET status = "APPROVED", reviewed_by = ?, reviewed_at = NOW() WHERE id = ?', [req.user.name || 'Super Admin', cReq.id]);
          } else {
            await pool.query(
              'UPDATE session_photo_submissions SET status = "SUBMITTED" WHERE cluster_id = ? AND day_number = ? AND (academic_year_id = ? OR ? = "")',
              [cReq.cluster_id, cReq.day_number, cReq.academic_year_id || '', cReq.academic_year_id || '']
            );
            await pool.query('UPDATE photo_change_requests SET status = "REJECTED", reviewed_by = ?, reviewed_at = NOW(), review_remarks = ? WHERE id = ?', [req.user.name || 'Super Admin', remarks, cReq.id]);
          }
        }
      } else if (approval.type === 'Day Photos Submission') {
        const newSubStatus = action === 'approve' ? 'APPROVED' : 'RESUBMISSION_REQUIRED';
        await pool.query(
          'UPDATE session_photo_submissions SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
          [newSubStatus, req.user.name || 'Super Admin', approval.record_id]
        );
      }
    }

    // Handle Attendance module specific side-effects
    if (approval.module === 'Attendance') {
      const attId = approval.sessionId || approval.record_id || approval.reference;
      if (approval.type === 'Attendance Edit Request') {
        if (action === 'approve') {
          await pool.query(
            'UPDATE attendance_sessions SET status = "Edit Approved", reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?',
            [req.user.name || 'Super Admin', attId]
          );
        } else if (action === 'reject') {
          await pool.query(
            'UPDATE attendance_sessions SET status = "Submitted - Pending Review", reviewed_by = ?, reviewed_at = NOW(), review_remarks = ?, updated_at = NOW() WHERE id = ?',
            [req.user.name || 'Super Admin', remarks, attId]
          );
        }
      } else {
        // Attendance Submission
        if (action === 'approve') {
          await pool.query(
            'UPDATE attendance_sessions SET status = "Approved", reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?',
            [req.user.name || 'Super Admin', attId]
          );
        } else if (action === 'reject') {
          await pool.query(
            'UPDATE attendance_sessions SET status = "Rejected", reviewed_by = ?, reviewed_at = NOW(), review_remarks = ?, updated_at = NOW() WHERE id = ?',
            [req.user.name || 'Super Admin', remarks, attId]
          );
        } else if (action === 'request-correction') {
          await pool.query(
            'UPDATE attendance_sessions SET status = "Edit Approved", reviewed_by = ?, reviewed_at = NOW(), review_remarks = ?, updated_at = NOW() WHERE id = ?',
            [req.user.name || 'Super Admin', remarks, attId]
          );
        }
      }
    }

    const actionName = action === 'approve' ? 'APPROVE' : action === 'reject' ? 'REJECT' : 'REQUEST_RESUBMISSION';
    const recordId = approval.record_id || approval.id;
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, 'SUPER_ADMIN', approval.cluster_id || null, actionName, approval.module || 'Submission', recordId, remarks || `Status changed to ${status}`],
    );
    await pool.query(
      'INSERT INTO notifications (id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [randomUUID(), action === 'approve' ? 'Submission approved' : action === 'reject' ? 'Submission rejected' : 'Submission requires resubmission', remarks || `Submission ${recordId} status changed to ${status}.`, actionName.toLowerCase()],
    );
    res.json({ success: true, status });
  } catch (error) {
    console.error('Failed to update approval:', error);
    res.status(503).json({ success: false, error: 'Unable to update approval. Please try again.' });
  }
});

app.get('/api/clusters', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let sql = "SELECT c.*, colleges.name AS college_resolved_name, u.name AS admin_name, u.email AS admin_email, u.phone AS admin_phone, u.status AS admin_status, (SELECT COUNT(*) FROM panchayats p WHERE p.cluster_id = c.id) AS active_panchayats, (SELECT COUNT(*) FROM students s WHERE s.cluster_id = c.id AND s.status NOT IN ('inactive', 'INACTIVE')) AS total_students, (SELECT COUNT(*) FROM volunteers v WHERE v.cluster_id = c.id AND v.status NOT IN ('inactive', 'INACTIVE')) AS total_volunteers FROM clusters c LEFT JOIN colleges ON colleges.id = c.college_id LEFT JOIN users u ON u.id = c.admin_id WHERE c.status <> 'INACTIVE'";
    const params: any[] = [];
    if (req.user.role === 'Cluster Admin') {
      sql += ' AND c.id = ?';
      params.push(req.user.clusterId);
    }

    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, clusters: rows.map(mapCluster) });
  } catch (error) {
    console.error('Failed to load clusters:', error);
    res.status(503).json({ success: false, error: 'Unable to load data. Please try again.' });
  }
});

app.post('/api/clusters', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can manage clusters.' });
    return;
  }

  const collegeName = String(req.body.collegeName || '').trim();
  const district = String(req.body.district || 'Tamil Nadu').trim();
  const spocName = String(req.body.spocName || req.body.adminName || '').trim();
  const spocMobile = String(req.body.spocMobile || req.body.adminPhone || '').trim();
  const adminEmail = String(req.body.adminEmail || req.body.spocEmail || req.body.email || '').trim().toLowerCase();
  const adminName = String(req.body.adminName || spocName).trim();
  const name = String(req.body.name || `${collegeName} (${district})`).trim();
  const cleanIdPart = `${district}-${collegeName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const clusterId = String(req.body.id || cleanIdPart || `cluster-${Date.now()}`);
  const collegeId = `college-${randomUUID()}`;
  const code = String(req.body.code || `TQI-${district.slice(0, 3).toUpperCase()}`).trim();
  const initialPassword = 'TQI123';

  if (!collegeName || !district || !spocName || !spocMobile || !adminEmail) {
    res.status(400).json({ success: false, error: 'College name, district, SPOC name, SPOC mobile, and login email are required.' });
    return;
  }
  const adminId = String(req.body.adminId || `usr-${randomUUID()}`);
  const passwordHash = await bcrypt.hash(initialPassword, 10);
  const setupToken = randomBytes(32).toString('hex');
  const setupTokenHash = createHash('sha256').update(setupToken).digest('hex');
  try {
    await pool.query('START TRANSACTION');
    await pool.query('INSERT INTO colleges (id, name, district) VALUES (?, ?, ?)', [collegeId, collegeName, district]);
    await pool.query(
      `INSERT INTO clusters (id, name, district, state, code, college_name, college_id, spoc_name, spoc_mobile, admin_id, status) VALUES (?, ?, ?, 'Tamil Nadu', ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [clusterId, name, district, code, collegeName, collegeId, spocName, spocMobile, adminId],
    );
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, cluster_id, phone, must_change_password, status) VALUES (?, ?, ?, ?, 'CLUSTER_ADMIN', ?, ?, TRUE, 'ACTIVE')`,
      [adminId, adminName, adminEmail, passwordHash, clusterId, spocMobile],
    );
    await pool.query(
      'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))',
      [randomUUID(), adminId, setupTokenHash],
    );

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        `aud-${randomUUID()}`,
        req.user.id,
        req.user.name,
        req.user.role,
        clusterId,
        'CREATE_CLUSTER',
        'CLUSTERS',
        clusterId,
        `Registered college ${collegeName} (${district}) and assigned Cluster Admin ${adminName} (${adminEmail})`,
      ],
    ).catch(() => undefined);

    await pool.query('COMMIT');

    const setupUrl = `${process.env.APP_URL || 'http://localhost:5173'}/reset-password?token=${setupToken}`;
    const setupEmailSent = await sendWorkflowEmail({
      recipient: adminEmail,
      recipientName: adminName,
      title: 'TQI Account Setup',
      summary: 'Your TQI Cluster Admin account has been created. Use the secure link below to create your password. This link expires in 30 minutes and can be used once.',
      details: [
        { label: 'College', value: collegeName },
        { label: 'District', value: district },
        { label: 'Cluster', value: name },
        { label: 'Login Email', value: adminEmail },
      ],
      actionLabel: 'Set Up Account',
      actionUrl: setupUrl,
      projectRoot: PROJECT_ROOT,
    });
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, clusterId, setupEmailSent ? 'ACCOUNT_SETUP_EMAIL_SENT' : 'ACCOUNT_SETUP_EMAIL_FAILED', 'CLUSTERS', clusterId, JSON.stringify({ recipient: adminEmail, status: setupEmailSent ? 'sent' : 'failed' })],
    ).catch(() => undefined);

    res.status(201).json({
      success: true,
      warning: setupEmailSent ? undefined : 'Cluster created, but the account setup email could not be sent.',
      cluster: mapCluster({ id: clusterId, name, district, state: 'Tamil Nadu', code, college_name: collegeName, spoc_name: spocName, spoc_mobile: spocMobile, admin_id: adminId, admin_name: adminName, admin_email: adminEmail, admin_phone: spocMobile, status: 'ACTIVE' }),
      user: serializeUser({ id: adminId, name: adminName, email: adminEmail, role: 'CLUSTER_ADMIN', cluster_id: clusterId, phone: spocMobile, status: 'ACTIVE', must_change_password: true }),
    });
  } catch (error: any) {
    await pool.query('ROLLBACK').catch(() => undefined);
    const duplicate = error?.code === 'ER_DUP_ENTRY';
    res.status(duplicate ? 409 : 503).json({ success: false, error: duplicate ? 'A cluster with this ID or an admin with this email already exists in the system.' : 'Unable to create cluster.' });
  }
});

app.post('/api/users/:id/request-password-reset', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') { res.status(403).json({ success: false, error: 'Only Super Admin can request password resets.' }); return; }
  try {
    const [rows] = await pool.query<any[]>('SELECT u.id, u.name, u.email, u.cluster_id, c.name AS cluster_name, c.college_name, c.district FROM users u LEFT JOIN clusters c ON c.id = u.cluster_id WHERE u.id = ? AND u.role = \'CLUSTER_ADMIN\' LIMIT 1', [req.params.id]);
    if (!rows.length) { res.status(404).json({ success: false, error: 'Cluster Admin not found.' }); return; }
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [req.params.id]);
    await pool.query('INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))', [randomUUID(), req.params.id, tokenHash]);
    const resetUrl = `${process.env.APP_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;
    const emailSent = await sendWorkflowEmail({ recipient: rows[0].email, recipientName: rows[0].name, title: 'TQI — Reset Your Password', summary: 'A secure password reset was requested for your TQI Cluster Admin account. This link expires in 30 minutes and can be used once.', details: [{ label: 'College', value: rows[0].college_name || '' }, { label: 'Cluster', value: rows[0].cluster_name || rows[0].cluster_id }, { label: 'Account', value: rows[0].email }], actionLabel: 'Reset Password', actionUrl: resetUrl, projectRoot: PROJECT_ROOT });
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, rows[0].cluster_id, emailSent ? 'PASSWORD_RESET_EMAIL_SENT' : 'PASSWORD_RESET_EMAIL_FAILED', 'AUTH', req.params.id, JSON.stringify({ recipient: rows[0].email, status: emailSent ? 'sent' : 'failed' })],
    ).catch(() => undefined);
    res.json({ success: true, message: emailSent ? 'Password reset link sent successfully.' : 'Reset link created, but the email could not be sent.', warning: emailSent ? undefined : 'Unable to deliver the password reset email.' });
  } catch (error) {
    console.error('Failed to request password reset:', error);
    res.status(503).json({ success: false, error: 'Unable to send password reset email.' });
  }
});

app.get('/api/panchayats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    const user = req.user;
    let sql = "SELECT p.id, p.name, p.cluster_id, p.status, c.name AS cluster_name, COUNT(DISTINCT v.id) AS villages_count, (SELECT COUNT(*) FROM students s WHERE s.panchayat_id = p.id AND s.status NOT IN ('inactive', 'INACTIVE')) AS students_count, (SELECT COUNT(*) FROM volunteers vol WHERE vol.panchayat_id = p.id AND vol.status NOT IN ('inactive', 'INACTIVE')) AS volunteers_count FROM panchayats p LEFT JOIN villages v ON v.panchayat_id = p.id LEFT JOIN clusters c ON c.id = p.cluster_id";
    const params: any[] = [];
    const where: string[] = [];

    if (user.role === 'Cluster Admin') {
      where.push('p.cluster_id = ?');
      params.push(user.clusterId);
    } else if (cluster !== 'all') {
      where.push('p.cluster_id = ?');
      params.push(cluster);
    }

    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' GROUP BY p.id, p.name, p.cluster_id, p.status, c.name ORDER BY p.name ASC';

    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, panchayats: rows.map((row) => ({
      id: row.id,
      name: row.name,
      cluster: row.cluster_name || row.cluster_id,
      clusterId: row.cluster_id,
      villagesCount: Number(row.villages_count || 0),
      activeStudents: Number(row.students_count || 0),
      volunteersCount: Number(row.volunteers_count || 0),
      status: row.status === 'ACTIVE' ? 'On Track' : row.status || 'On Track',
      villages: [],
    })) });
  } catch (error) {
    console.error('Failed to load panchayats:', error);
    res.status(503).json({ success: false, error: 'Unable to load data. Please try again.' });
  }
});

app.post('/api/panchayats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clusterId = req.user.role === 'Cluster Admin' ? req.user.clusterId : String(req.body.clusterId || req.body.cluster || 'dharmapuri');
    const panchayatId = String(req.body.id || req.body.name || `panchayat-${Date.now()}`).trim().toLowerCase().replace(/\s+/g, '-');
    const name = String(req.body.name || 'New Panchayat').trim();
    if (!name || !clusterId || (req.user.role === 'Cluster Admin' && clusterId !== req.user.clusterId)) {
      res.status(400).json({ success: false, error: 'A valid panchayat name and authorized cluster are required.' });
      return;
    }
    const [clusterRows] = await pool.query<any[]>('SELECT id FROM clusters WHERE id = ? AND status <> \'INACTIVE\' LIMIT 1', [clusterId]);
    if (!clusterRows.length) { res.status(404).json({ success: false, error: 'Cluster not found.' }); return; }

    await pool.query(
      'INSERT INTO panchayats (id, name, cluster_id, status) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), cluster_id = VALUES(cluster_id), status = VALUES(status)',
      [panchayatId, name, clusterId, String(req.body.status || 'ACTIVE')]
    );

    res.json({ success: true, panchayat: { id: panchayatId, name, clusterId, cluster: clusterId, villagesCount: 0, activeStudents: 0, volunteersCount: 0, status: 'On Track', villages: [] } });
  } catch (error) {
    console.error('Failed to create panchayat:', error);
    res.status(500).json({ success: false, error: 'Unable to save panchayat.' });
  }
});

app.get('/api/students', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    const panchayatId = req.query.panchayatId ? String(req.query.panchayatId) : null;
    const villageId = req.query.villageId ? String(req.query.villageId) : null;

    let sql = `SELECT s.id, s.name, s.code, s.gender, s.dob, s.standard, s.cluster_id, s.panchayat_id, s.village_id, s.parent_name, s.phone, s.status, p.name AS panchayat_name, v.name AS village_name FROM students s LEFT JOIN panchayats p ON p.id = s.panchayat_id LEFT JOIN villages v ON v.id = s.village_id WHERE 1=1`;
    const params: any[] = [];

    if (req.user.role === 'Cluster Admin') {
      sql += ' AND s.cluster_id = ?';
      params.push(req.user.clusterId);
    } else if (cluster !== 'all') {
      sql += ' AND s.cluster_id = ?';
      params.push(cluster);
    }

    if (panchayatId && panchayatId !== 'all') {
      sql += ' AND s.panchayat_id = ?';
      params.push(panchayatId);
    }
    if (villageId && villageId !== 'all') {
      sql += ' AND s.village_id = ?';
      params.push(villageId);
    }

    sql += ' ORDER BY s.name ASC';
    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, students: rows.map(mapStudent) });
  } catch (error) {
    console.error('Failed to load students:', error);
    res.status(503).json({ success: false, error: 'Unable to load data. Please try again.' });
  }
});

app.post('/api/students', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const panchayatId = String(req.body.panchayatId || '').trim();
    const villageId = String(req.body.villageId || '').trim();
    const [parentRows] = await pool.query<any[]>('SELECT id, cluster_id FROM panchayats WHERE id = ? LIMIT 1', [panchayatId]);
    if (!parentRows.length || (req.user.role === 'Cluster Admin' && parentRows[0].cluster_id !== req.user.clusterId)) {
      res.status(403).json({ success: false, error: 'You are not authorized to add a student under this panchayat.' });
      return;
    }
    const clusterId = parentRows[0].cluster_id;
    if (villageId) {
      const [villageRows] = await pool.query<any[]>('SELECT id FROM villages WHERE id = ? AND panchayat_id = ? AND cluster_id = ? LIMIT 1', [villageId, panchayatId, clusterId]);
      if (!villageRows.length) { res.status(400).json({ success: false, error: 'The selected village does not belong to this panchayat.' }); return; }
    }
    const [clusterRows] = await pool.query<any[]>('SELECT college_id FROM clusters WHERE id = ? LIMIT 1', [clusterId]);
    const collegeId = clusterRows[0]?.college_id || null;
    const id = String(req.body.id || `student-${Date.now()}`).trim();
    const name = String(req.body.name || 'New Student').trim();
    await pool.query(
      `INSERT INTO students (id, code, name, gender, dob, standard, cluster_id, college_id, panchayat_id, village_id, parent_name, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE code = VALUES(code), name = VALUES(name), gender = VALUES(gender), dob = VALUES(dob), standard = VALUES(standard), cluster_id = VALUES(cluster_id), college_id = VALUES(college_id), panchayat_id = VALUES(panchayat_id), village_id = VALUES(village_id), parent_name = VALUES(parent_name), phone = VALUES(phone), status = VALUES(status)`,
      [id, String(req.body.code || id), name, String(req.body.gender || 'female'), String(req.body.dob || '2014-01-01'), String(req.body.standard || '6th Standard'), clusterId, collegeId, panchayatId, villageId, String(req.body.parentName || 'Parent'), String(req.body.phone || ''), String(req.body.status || 'active')]
    );

    res.json({ success: true, student: { id, code: String(req.body.code || id), name, gender: req.body.gender || 'female', dob: req.body.dob || '2014-01-01', standard: req.body.standard || '6th Standard', clusterId, panchayatId, panchayatName: req.body.panchayatName || panchayatId, villageId, villageName: req.body.villageName || villageId, parentName: req.body.parentName || 'Parent', phone: req.body.phone || '', status: req.body.status || 'active' } });
  } catch (error) {
    console.error('Failed to create student:', error);
    res.status(500).json({ success: false, error: 'Unable to save student.' });
  }
});

app.get('/api/volunteers', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    let sql = `SELECT v.id, v.name, v.email, v.phone, v.department, v.stream, v.passing_out_year, v.cluster_id, v.college_id, colleges.name AS college_name, v.panchayat_id, p.name AS panchayat_name, v.village_id, vi.name AS village_name, v.role, v.status FROM volunteers v LEFT JOIN colleges ON colleges.id = v.college_id LEFT JOIN panchayats p ON p.id = v.panchayat_id LEFT JOIN villages vi ON vi.id = v.village_id WHERE 1=1`;
    const params: any[] = [];

    if (req.user.role === 'Cluster Admin') {
      sql += ' AND v.cluster_id = ?';
      params.push(req.user.clusterId);
    } else if (cluster !== 'all') {
      sql += ' AND v.cluster_id = ?';
      params.push(cluster);
    }

    sql += ' ORDER BY v.name ASC';
    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, volunteers: rows.map(mapVolunteer) });
  } catch (error) {
    console.error('Failed to load volunteers:', error);
    res.status(503).json({ success: false, error: 'Unable to load data. Please try again.' });
  }
});

app.post('/api/volunteers', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clusterId = req.user.role === 'Cluster Admin' ? req.user.clusterId : String(req.body.clusterId || 'dharmapuri');
    const [clusterRows] = await pool.query<any[]>('SELECT college_id FROM clusters WHERE id = ? AND status <> \'INACTIVE\' LIMIT 1', [clusterId]);
    if (!clusterRows.length) { res.status(404).json({ success: false, error: 'Assigned cluster not found.' }); return; }
    const collegeId = clusterRows[0].college_id || null;
    const [collegeRows] = collegeId ? await pool.query<any[]>('SELECT name FROM colleges WHERE id = ? LIMIT 1', [collegeId]) : [[]];
    const collegeName = collegeRows[0]?.name || '';
    const id = String(req.body.id || `volunteer-${Date.now()}`).trim();
    await pool.query(
      'INSERT INTO volunteers (id, name, email, phone, cluster_id, college_id, panchayat_id, village_id, department, stream, passing_out_year, role, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), phone = VALUES(phone), cluster_id = VALUES(cluster_id), college_id = VALUES(college_id), panchayat_id = VALUES(panchayat_id), village_id = VALUES(village_id), department = VALUES(department), stream = VALUES(stream), passing_out_year = VALUES(passing_out_year), role = VALUES(role), status = VALUES(status)',
      [id, String(req.body.name || 'Volunteer').trim(), String(req.body.email || ''), String(req.body.phone || ''), clusterId, collegeId, String(req.body.panchayatId || ''), String(req.body.villageId || ''), String(req.body.department || 'Community Program'), String(req.body.stream || ''), req.body.passingOutYear ? Number(req.body.passingOutYear) : null, String(req.body.role || 'Mentor'), String(req.body.status || 'Active'), req.user.id]
    );
    res.json({ success: true, volunteer: { id, name: req.body.name || 'Volunteer', email: req.body.email || '', phone: req.body.phone || '', collegeId, college: collegeName, clusterId, panchayatId: req.body.panchayatId || '', department: req.body.department || 'Community Program', stream: req.body.stream || '', passingOutYear: req.body.passingOutYear || '', role: req.body.role || 'Mentor', status: req.body.status || 'Active' } });
  } catch (error) {
    console.error('Failed to save volunteer:', error);
    res.status(500).json({ success: false, error: 'Unable to save volunteer.' });
  }
});

app.get('/api/sessions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    const academicYearId = String(req.query.academicYearId || '').trim();
    let sql = `
      SELECT
        COALESCE(s.id, CONCAT('pending-session-', ay.id, '-', c.id, '-', pd.day_number)) AS id,
        CONCAT('DAY-', pd.day_number) AS code,
        ay.name AS academic_year,
        ay.id AS academic_year_id,
        pd.id AS day_id,
        pd.day_number,
        COALESCE(NULLIF(NULLIF(TRIM(pd.day_name), ''), CONCAT('Day ', pd.day_number)), '') AS session_name,
        c.id AS cluster_id,
        c.name AS cluster_name,
        s.date,
        COALESCE(s.session_date_fixed, FALSE) AS session_date_fixed,
        s.session_date_fixed_at,
        s.session_date_fixed_by,
        s.panchayat_id,
        s.village_id,
        s.volunteer_id,
        COALESCE(s.session_status, 'Pending') AS session_status,
        s.module_id
      FROM academic_years ay
      INNER JOIN program_days pd ON pd.academic_year_id = ay.id AND pd.status = 'ACTIVE'
      CROSS JOIN clusters c
      LEFT JOIN sessions s
        ON s.academic_year_id = ay.id
       AND s.day_id = pd.id
       AND s.cluster_id = c.id
      WHERE ((? = '' AND ay.is_active = 1) OR ay.id = ?)`;
    const params: any[] = [academicYearId, academicYearId];

    if (req.user.role === 'Cluster Admin') {
      sql += ' AND c.id = ?';
      params.push(req.user.clusterId);
    } else if (cluster !== 'all') {
      sql += ' AND c.id = ?';
      params.push(cluster);
    }

    if (req.query.panchayatId && req.query.panchayatId !== 'all') {
      sql += ' AND s.panchayat_id = ?';
      params.push(String(req.query.panchayatId));
    }

    sql += ' ORDER BY c.name ASC, pd.day_number ASC';
    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, sessions: rows.map(mapSession) });
  } catch (error) {
    console.error('Failed to load sessions:', error);
    res.status(503).json({ success: false, error: 'Unable to load data. Please try again.' });
  }
});

app.post('/api/sessions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clusterId = req.user.role === 'Cluster Admin' ? req.user.clusterId : String(req.body.clusterId || 'dharmapuri');
    const id = String(req.body.id || `session-${Date.now()}`).trim();
    const date = String(req.body.date || new Date().toISOString().split('T')[0]);

    await pool.query(
      'INSERT INTO sessions (id, code, name, module_id, cluster_id, panchayat_id, village_id, volunteer_id, date, time, session_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE code = VALUES(code), name = VALUES(name), module_id = VALUES(module_id), cluster_id = VALUES(cluster_id), panchayat_id = VALUES(panchayat_id), village_id = VALUES(village_id), volunteer_id = VALUES(volunteer_id), date = VALUES(date), time = VALUES(time), session_status = VALUES(session_status)',
      [id, String(req.body.code || id), String(req.body.name || 'Session').trim(), String(req.body.moduleId || 'module-english'), clusterId, String(req.body.panchayatId || ''), String(req.body.villageId || ''), String(req.body.volunteerId || ''), date, String(req.body.time || '09:00'), String(req.body.status || 'Draft')]
    );

    res.json({ success: true, session: { id, code: String(req.body.code || id), name: req.body.name || 'Session', clusterId, panchayatId: req.body.panchayatId || '', villageId: req.body.villageId || '', date, time: req.body.time || '09:00', status: req.body.status || 'Draft' } });
  } catch (error) {
    console.error('Failed to save session:', error);
    res.status(500).json({ success: false, error: 'Unable to save session.' });
  }
});

app.put('/api/sessions/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Cluster Admin') {
    res.status(403).json({ success: false, error: 'Only Cluster Admin can update session schedules.' });
    return;
  }

  const sessionId = String(req.params.id || '').trim();
  const dayNumber = Number(req.body.dayNumber);
  const academicYearId = String(req.body.academicYearId || '').trim();
  const dayId = String(req.body.dayId || '').trim();
  const date = req.body.date ? String(req.body.date).trim() : '';
  if (!sessionId || !academicYearId || !dayId || !Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 8) {
    res.status(400).json({ success: false, error: 'Valid session, academic year and programme day IDs are required.' });
    return;
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ success: false, error: 'A valid session date is required.' });
    return;
  }

  try {
    const isPendingSession = sessionId.startsWith('pending-session-');
    const [existingRows] = await pool.query<any[]>(
      'SELECT id, cluster_id, date, academic_year_id, day_id, day_number, session_date_fixed FROM sessions WHERE id = ? AND cluster_id = ? LIMIT 1',
      [sessionId, req.user.clusterId],
    );
    if (!existingRows.length && !isPendingSession) {
      res.status(404).json({ success: false, error: 'Session not found in your assigned cluster.' });
      return;
    }

    const [days] = await pool.query<any[]>(
      `SELECT ay.id, ay.start_date, ay.end_date, pd.id AS day_id, pd.day_name
       FROM academic_years ay INNER JOIN program_days pd ON pd.academic_year_id = ay.id
       WHERE ay.id = ? AND ay.is_active = 1 AND pd.id = ? AND pd.day_number = ? LIMIT 1`,
      [academicYearId, dayId, dayNumber],
    );
    if (!days.length) {
      res.status(400).json({ success: false, error: 'The academic year or programme day is not active.' });
      return;
    }
    const { start_date: startDate, end_date: endDate } = days[0];
    if (!isPendingSession && ((startDate && date < new Date(startDate).toISOString().slice(0, 10)) || (endDate && date > new Date(endDate).toISOString().slice(0, 10)))) {
      res.status(400).json({ success: false, error: 'Session date must be within the active academic year.' });
      return;
    }

    const existingDate = existingRows[0]?.date ? String(existingRows[0].date).slice(0, 10) : '';
    if (existingDate && existingDate !== date) {
      res.status(409).json({ success: false, error: 'This session date is locked. Submit a date change request instead.' });
      return;
    }

    const sessionName = String(days[0]?.day_name || '').trim();
    await pool.query(
      `INSERT INTO sessions (id, title, cluster_id, academic_year_id, day_id, day_number, session_name_snapshot, panchayat_id, village_id, volunteer_id, date, session_date_fixed, session_date_fixed_at, session_date_fixed_by, session_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW(), ?, 'Scheduled')
       ON DUPLICATE KEY UPDATE title = VALUES(title), session_name_snapshot = VALUES(session_name_snapshot), panchayat_id = VALUES(panchayat_id), village_id = VALUES(village_id), volunteer_id = VALUES(volunteer_id), date = VALUES(date), session_date_fixed = TRUE, session_date_fixed_at = NOW(), session_date_fixed_by = VALUES(session_date_fixed_by), session_status = 'Scheduled'`,
      [
        sessionId,
        sessionName,
        req.user.clusterId,
        academicYearId,
        dayId,
        dayNumber,
        sessionName,
        req.body.panchayatId ? String(req.body.panchayatId) : null,
        req.body.villageId ? String(req.body.villageId) : null,
        req.body.volunteerId ? String(req.body.volunteerId) : null,
        date,
        req.user.id,
      ],
    );
    await pool.query(
      'INSERT INTO notifications (id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [randomUUID(), 'Session date confirmed', `${req.user.name} confirmed Day ${dayNumber} for ${date} in cluster ${req.user.clusterId}.`, 'session_schedule'],
    );
    void notifyWorkflow({
      clusterId: req.user.clusterId,
      title: 'Session date confirmed',
      summary: 'A Cluster Admin confirmed a session date. The date is now locked in the TQI schedule.',
      details: [
        { label: 'Cluster', value: req.user.clusterId },
        { label: 'Day', value: `Day ${dayNumber}` },
        { label: 'Session Date', value: date },
        { label: 'Status', value: 'Scheduled' },
        { label: 'Confirmed By', value: req.user.name },
      ],
    }).catch((error) => console.error('[SMTP ERROR] Schedule notification failed:', error.message));
    res.json({ success: true, status: 'Scheduled', date, dateFixed: true, dateFixedAt: new Date().toISOString(), dateFixedBy: req.user.id, sessionId });
  } catch (error) {
    console.error('Failed to update session schedule:', error);
    res.status(503).json({ success: false, error: 'Unable to save session schedule.' });
  }
});

app.get('/api/attendance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    const academicYearId = String(req.query.academicYearId || '').trim();
    let sql = 'SELECT a.* FROM attendance_sessions a WHERE 1=1';
    const params: any[] = [];

    if (academicYearId) {
      sql += ' AND (a.academic_year_id = ? OR EXISTS (SELECT 1 FROM sessions s WHERE s.id = a.session_id AND s.academic_year_id = ?))';
      params.push(academicYearId, academicYearId);
    }

    if (req.user.role === 'Cluster Admin') {
      sql += ' AND a.cluster_id = ?';
      params.push(req.user.clusterId);
    } else if (cluster !== 'all') {
      sql += ' AND a.cluster_id = ?';
      params.push(cluster);
    }

    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, attendanceSessions: rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      clusterId: row.cluster_id,
      panchayatId: row.panchayat_id,
      panchayatName: row.panchayat_id || '',
      villageId: row.village_id,
      villageName: row.village_id || '',
      dayNumber: Number(row.day_number || 1),
      status: row.status || 'Draft',
      totalCount: Number(row.total_count || 0),
      presentCount: Number(row.present_count || 0),
      absentCount: Math.max(0, Number(row.total_count || 0) - Number(row.present_count || 0) - Number(row.not_marked_count || 0)),
      taskCompletedCount: Number(row.task_completed_count || 0),
      notMarkedCount: Number(row.not_marked_count || 0),
      editReason: row.edit_reason || '',
      editRequestedBy: row.edit_requested_by || '',
      editRequestedAt: row.edit_requested_at || null,
      reviewedBy: row.reviewed_by || '',
      reviewedAt: row.reviewed_at || null,
      reviewRemarks: row.review_remarks || '',
      records: [],
      volunteerAttendance: [],
    })) });
  } catch (error) {
    console.error('Failed to load attendance:', error);
    res.status(503).json({ success: false, error: 'Unable to load data. Please try again.' });
  }
});

app.get('/api/attendance/session', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const villageId = String(req.query.villageId || '').trim();
    const dayNumber = Number(req.query.dayNumber || 1);
    const clusterId = req.user.role === 'Cluster Admin' ? req.user.clusterId : String(req.query.clusterId || '');
    const academicYearId = String(req.query.academicYearId || '').trim();

    if (!villageId) {
      res.status(400).json({ success: false, error: 'villageId is required.' });
      return;
    }

    let sessionSql = 'SELECT * FROM attendance_sessions WHERE village_id = ? AND day_number = ?';
    const params: any[] = [villageId, dayNumber];
    if (clusterId && clusterId !== 'all') {
      sessionSql += ' AND cluster_id = ?';
      params.push(clusterId);
    }
    if (academicYearId) {
      sessionSql += ' AND (academic_year_id = ? OR academic_year_id IS NULL)';
      params.push(academicYearId);
    }
    sessionSql += ' ORDER BY updated_at DESC LIMIT 1';
    const [sessionRows] = await pool.query<any[]>(sessionSql, params);

    let sessionObj = null;
    let records: any[] = [];
    if (sessionRows.length > 0) {
      const row = sessionRows[0];
      sessionObj = {
        id: row.id,
        sessionId: row.session_id,
        clusterId: row.cluster_id,
        panchayatId: row.panchayat_id,
        villageId: row.village_id,
        dayNumber: Number(row.day_number || 1),
        status: row.status || 'Draft',
        totalCount: Number(row.total_count || 0),
        presentCount: Number(row.present_count || 0),
        absentCount: Math.max(0, Number(row.total_count || 0) - Number(row.present_count || 0) - Number(row.not_marked_count || 0)),
        taskCompletedCount: Number(row.task_completed_count || 0),
        notMarkedCount: Number(row.not_marked_count || 0),
        editReason: row.edit_reason || '',
        editRequestedBy: row.edit_requested_by || '',
        editRequestedAt: row.edit_requested_at || null,
        reviewedBy: row.reviewed_by || '',
        reviewedAt: row.reviewed_at || null,
        reviewRemarks: row.review_remarks || '',
      };

      const [attRows] = await pool.query<any[]>(
        'SELECT student_id, present, round_number, task_status FROM student_attendance WHERE attendance_session_id = ?',
        [row.id]
      );
      records = attRows.map((r) => ({
        studentId: r.student_id,
        present: r.present === null ? null : Boolean(r.present),
        status: r.present === 1 || r.present === true ? 'Present' : r.present === 0 || r.present === false ? 'Absent' : 'Not Marked',
        taskStatus: r.task_status || 'Not Marked',
        roundNumber: Number(r.round_number || 1),
      }));
      const [volunteerRows] = await pool.query<any[]>(
        'SELECT volunteer_id, present, round_number FROM volunteer_attendance WHERE attendance_session_id = ?',
        [row.id]
      );
      return res.json({
        success: true,
        session: sessionObj,
        records,
        volunteerRecords: volunteerRows.map((r) => ({
          volunteerId: r.volunteer_id,
          present: Boolean(r.present),
          roundNumber: Number(r.round_number || 1),
        })),
      });
    }

    res.json({ success: true, session: sessionObj, records, volunteerRecords: [] });
  } catch (error) {
    console.error('Failed to load attendance session:', error);
    res.status(500).json({ success: false, error: 'Unable to load attendance session.' });
  }
});

app.get('/api/attendance/village-report', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const villageId = String(req.query.villageId || '').trim();
    if (!villageId) {
      res.status(400).json({ success: false, error: 'villageId is required.' });
      return;
    }

    // Fetch Village details
    const [villageRows] = await pool.query<any[]>(
      'SELECT v.id, v.name, v.panchayat_id, v.cluster_id, p.name AS panchayat_name, c.name AS cluster_name, c.college_id, col.name AS college_name FROM villages v LEFT JOIN panchayats p ON p.id = v.panchayat_id LEFT JOIN clusters c ON c.id = v.cluster_id LEFT JOIN colleges col ON col.id = c.college_id WHERE v.id = ? LIMIT 1',
      [villageId]
    );

    if (!villageRows.length) {
      res.status(404).json({ success: false, error: 'Village not found.' });
      return;
    }

    const village = villageRows[0];
    const clusterId = village.cluster_id;

    // Security Check: If user is Cluster Admin, they must belong to this cluster
    if (req.user.role === 'Cluster Admin') {
      const userCluster = req.user.clusterId || req.user.cluster_id;
      if (userCluster && userCluster !== clusterId && !clusterId.startsWith(userCluster)) {
        res.status(403).json({ success: false, error: 'Access denied: You cannot access data for another cluster.' });
        return;
      }
    }

    // Fetch students belonging strictly to this village
    const standardFilter = req.query.standard ? String(req.query.standard).trim() : '';
    let studentSql = `
      SELECT s.id, s.code, s.name, s.gender, s.dob, s.standard, s.panchayat_id, s.village_id, s.parent_name, s.phone, s.status, p.name AS panchayat_name
      FROM students s
      LEFT JOIN panchayats p ON p.id = s.panchayat_id
      WHERE s.village_id = ?
    `;
    const studentParams: any[] = [villageId];

    if (standardFilter && standardFilter !== 'all') {
      studentSql += ' AND (s.standard = ? OR s.standard LIKE ?)';
      studentParams.push(standardFilter, `%${standardFilter}%`);
    }

    studentSql += ' ORDER BY s.name ASC';
    const [students] = await pool.query<any[]>(studentSql, studentParams);

    // Fetch scheduled session dates for Day 1 through Day 8
    const [sessionRows] = await pool.query<any[]>(
      'SELECT day_number, date FROM sessions WHERE cluster_id = ? AND (panchayat_id = ? OR panchayat_id IS NULL) ORDER BY day_number ASC',
      [clusterId, village.panchayat_id]
    );

    const sessionDates: Record<number, string> = {};
    for (const sess of sessionRows) {
      if (sess.day_number && sess.date) {
        const d = new Date(sess.date);
        const dayStr = String(d.getDate()).padStart(2, '0');
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        sessionDates[Number(sess.day_number)] = `${dayStr}/${monthStr}`;
      }
    }

    // Fetch student attendance for Day 1 through Day 8
    const studentIds = students.map((s) => s.id);
    const attendanceMap: Record<string, Record<number, 'P' | 'A'>> = {};

    if (studentIds.length > 0) {
      const [attRows] = await pool.query<any[]>(
        `SELECT sa.student_id, att.day_number, sa.present
         FROM student_attendance sa
         JOIN attendance_sessions att ON att.id = sa.attendance_session_id
         WHERE sa.student_id IN (?)`,
        [studentIds]
      );

      for (const row of attRows) {
        const sId = row.student_id;
        const day = Number(row.day_number);
        if (!attendanceMap[sId]) attendanceMap[sId] = {};
        attendanceMap[sId][day] = row.present ? 'P' : 'A';
      }
    }

    // Build student attendance records
    const formattedStudents = students.map((s, index) => {
      const studentAtt = attendanceMap[s.id] || {};
      const dayRecords: Record<string, string> = {};
      for (let d = 1; d <= 8; d++) {
        dayRecords[`D${d}`] = studentAtt[d] || '';
      }

      return {
        no: index + 1,
        id: s.id,
        code: s.code || s.id,
        name: s.name,
        gender: s.gender || 'other',
        standard: s.standard || '',
        panchayatName: s.panchayat_name || village.panchayat_name || '',
        contactNumber: s.phone || '',
        status: s.status || 'active',
        attendance: dayRecords,
      };
    });

    // Determine academic year from query, academic_setup, or academic_years
    const queryAcademicYear = req.query.academicYear ? String(req.query.academicYear).trim() : '';
    let academicYear = queryAcademicYear;

    if (!academicYear) {
      try {
        const [setupRows] = await pool.query<any[]>(
          'SELECT academic_year FROM academic_setup WHERE academic_year IS NOT NULL AND academic_year != "" ORDER BY updated_at DESC LIMIT 1'
        );
        if (setupRows.length && setupRows[0].academic_year) {
          academicYear = setupRows[0].academic_year;
        } else {
          const [ayRows] = await pool.query<any[]>(
            'SELECT name FROM academic_years WHERE is_active = 1 LIMIT 1'
          );
          if (ayRows.length && ayRows[0].name) {
            academicYear = ayRows[0].name;
          }
        }
      } catch (ayErr) {
        console.warn('Could not determine academic year for village report:', ayErr);
      }
    }
    if (!academicYear) {
      academicYear = '2025-2026';
    }

    res.json({
      success: true,
      data: {
        cluster: {
          id: clusterId,
          name: village.cluster_name || clusterId,
          collegeName: village.college_name || '',
        },
        panchayat: {
          id: village.panchayat_id,
          name: village.panchayat_name || '',
        },
        village: {
          id: village.id,
          name: village.name,
        },
        academicYear,
        standard: standardFilter && standardFilter !== 'all' ? standardFilter : 'All',
        sessionDates,
        students: formattedStudents,
        totalStudentsCount: formattedStudents.length,
      },
    });
  } catch (error) {
    console.error('Failed to generate village attendance report:', error);
    res.status(500).json({ success: false, error: 'Unable to load village attendance report.' });
  }
});

app.post('/api/attendance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== 'Cluster Admin') {
      res.status(403).json({ success: false, error: 'Only Cluster Admin can submit attendance.' });
      return;
    }
    const clusterId = req.user.clusterId;
    const panchayatId = req.body.panchayatId ? String(req.body.panchayatId) : '';
    const villageId = req.body.villageId ? String(req.body.villageId) : '';
    const requestedDay = Number(req.body.dayNumber || 1);
    const requestedAcademicYearId = req.body.academicYearId ? String(req.body.academicYearId) : '';

    if (!clusterId) {
      res.status(403).json({ success: false, error: 'Cluster assignment is missing for this account.' });
      return;
    }

    if (panchayatId) {
      const [panchayatRows] = await pool.query<any[]>('SELECT id, cluster_id FROM panchayats WHERE id = ? AND cluster_id = ? LIMIT 1', [panchayatId, clusterId]);
      if (!panchayatRows.length) {
        res.status(403).json({ success: false, error: 'Access denied: Panchayat does not belong to your cluster.' });
        return;
      }
    }

    if (villageId) {
      const [villageRows] = await pool.query<any[]>('SELECT id, panchayat_id, cluster_id FROM villages WHERE id = ? AND cluster_id = ? LIMIT 1', [villageId, clusterId]);
      if (!villageRows.length) {
        res.status(403).json({ success: false, error: 'Access denied: Village does not belong to your cluster.' });
        return;
      }
      if (panchayatId && villageRows[0].panchayat_id !== panchayatId) {
        res.status(403).json({ success: false, error: 'Access denied: Village does not belong to the selected panchayat.' });
        return;
      }
    }

    if (requestedAcademicYearId) {
      const [ayRows] = await pool.query<any[]>('SELECT id FROM academic_years WHERE id = ? LIMIT 1', [requestedAcademicYearId]);
      if (!ayRows.length) {
        res.status(400).json({ success: false, error: 'Academic year is invalid.' });
        return;
      }
    }

    if (requestedDay < 1 || requestedDay > 8) {
      res.status(400).json({ success: false, error: 'Day number is outside the configured program range.' });
      return;
    }

    const sessionId = String(req.body.sessionId || '');
    // Phase 4: Check if session is editable
    if (sessionId) {
      const editCheck = await isSessionEditable(sessionId);
      if (!editCheck.editable) {
        res.status(403).json({ success: false, error: editCheck.reason });
        return;
      }
      // Auto-transition session to 'In Progress' on first data entry
      await autoTransitionToInProgress(sessionId);
    }
    const id = String(req.body.id || `attendance-${Date.now()}`).trim();
    const totalCount = Number(req.body.totalCount || 0);
    const presentCount = Number(req.body.presentCount || 0);
    const taskCompletedCount = Number(req.body.taskCompletedCount || 0);
    const notMarkedCount = Number(req.body.notMarkedCount || 0);
    const requestedStatus = String(req.body.status || 'Draft');
    let status = 'Draft';
    if (requestedStatus === 'Submitted' || requestedStatus === 'SUBMITTED' || requestedStatus === 'Submitted - Pending Review') {
      status = 'Submitted - Pending Review';
    } else if (requestedStatus === 'Resubmission') {
      status = 'Submitted - Pending Review';
    } else if (['Edit Requested', 'Edit Approved', 'Approved', 'Rejected'].includes(requestedStatus)) {
      status = requestedStatus;
    }

    await pool.query('START TRANSACTION');

    await pool.query(
      `INSERT INTO attendance_sessions (id, session_id, cluster_id, panchayat_id, village_id, day_number, academic_year_id, status, present_count, total_count, task_completed_count, not_marked_count) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
         session_id = VALUES(session_id), 
         cluster_id = VALUES(cluster_id), 
         panchayat_id = VALUES(panchayat_id), 
         village_id = VALUES(village_id), 
         day_number = VALUES(day_number), 
         academic_year_id = VALUES(academic_year_id), 
         status = VALUES(status), 
         present_count = VALUES(present_count), 
         total_count = VALUES(total_count),
         task_completed_count = VALUES(task_completed_count),
         not_marked_count = VALUES(not_marked_count),
         updated_at = NOW()`,
      [
        id,
        String(req.body.sessionId || id),
        clusterId,
        String(req.body.panchayatId || ''),
        String(req.body.villageId || ''),
        Number(req.body.dayNumber || 1),
        requestedAcademicYearId || null,
        status,
        presentCount,
        totalCount,
        taskCompletedCount,
        notMarkedCount,
      ]
    );

    if (req.body.attendanceSubject !== 'volunteers' && Array.isArray(req.body.records)) {
      await pool.query('DELETE FROM student_attendance WHERE attendance_session_id = ?', [id]);
      for (const record of req.body.records) {
        let isPresent: number | null = null;
        if (record.present !== undefined && record.present !== null) {
          isPresent = record.present ? 1 : 0;
        } else if (record.status === 'Present') {
          isPresent = 1;
        } else if (record.status === 'Absent') {
          isPresent = 0;
        }
        const taskStatus = record.taskStatus && record.taskStatus !== 'Not Marked' ? record.taskStatus : null;

        await pool.query(
          'INSERT INTO student_attendance (id, attendance_session_id, student_id, present, round_number, task_status) VALUES (?, ?, ?, ?, ?, ?)',
          [randomUUID(), id, record.studentId, isPresent, Number(record.roundNumber || 1), taskStatus]
        );
      }
    }

    if (Array.isArray(req.body.volunteerAttendance)) {
      await pool.query('DELETE FROM volunteer_attendance WHERE attendance_session_id = ?', [id]);
      for (const record of req.body.volunteerAttendance) {
        await pool.query(
          'INSERT INTO volunteer_attendance (id, attendance_session_id, volunteer_id, present, round_number) VALUES (?, ?, ?, ?, ?)',
          [randomUUID(), id, record.volunteerId, Boolean(record.present), Number(record.roundNumber || 1)]
        );
      }
    }

    if (status === 'Submitted - Pending Review') {
      await pool.query(
        `INSERT INTO approvals (id, module, type, reference, record_id, requested_by, requestedBy, date, status, remarks, sessionId, cluster_id, clusterId, created_at, updated_at)
         VALUES (?, 'Attendance', 'Attendance Submission', ?, ?, ?, ?, CURDATE(), 'Pending', '', ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE status = 'Pending', updated_at = NOW()`,
        [randomUUID(), id, id, req.user.name, req.user.name, id, clusterId, clusterId],
      );
    }
    
    await pool.query('COMMIT');

    if (status === 'Submitted - Pending Review') {
      void notifyWorkflow({
        clusterId,
        title: 'Attendance submitted for review',
        summary: 'Attendance has been submitted successfully and is now waiting for Super Admin review.',
        details: [
          { label: 'Session', value: sessionId || id },
          { label: 'Day', value: `Day ${Number(req.body.dayNumber || 1)}` },
          { label: 'Present', value: `${presentCount} of ${totalCount}` },
          { label: 'Status', value: 'Submitted - Pending Review' },
          { label: 'Submitted By', value: req.user.name },
        ],
      }).catch((error) => console.error('[SMTP ERROR] Attendance workflow notification failed:', error.message));
    }

    res.json({
      success: true,
      attendanceSession: {
        id,
        sessionId: req.body.sessionId || id,
        clusterId,
        panchayatId: req.body.panchayatId || '',
        villageId: req.body.villageId || '',
        dayNumber: Number(req.body.dayNumber || 1),
        status,
        presentCount,
        totalCount,
        taskCompletedCount,
        notMarkedCount,
      },
    });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    console.error('Failed to save attendance:', error);
    res.status(500).json({ success: false, error: 'Unable to save attendance.' });
  }
});

app.post('/api/attendance/request-edit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== 'Cluster Admin') {
      res.status(403).json({ success: false, error: 'Only Cluster Admin can request edits.' });
      return;
    }
    const { attendanceSessionId, villageId, dayNumber, reason } = req.body;
    if (!reason || !String(reason).trim()) {
      res.status(400).json({ success: false, error: 'Reason for edit is mandatory.' });
      return;
    }

    let sessionId = attendanceSessionId;
    if (!sessionId && villageId && dayNumber) {
      const [rows] = await pool.query<any[]>(
        'SELECT id FROM attendance_sessions WHERE village_id = ? AND day_number = ? AND cluster_id = ? LIMIT 1',
        [villageId, dayNumber, req.user.clusterId]
      );
      if (rows.length) sessionId = rows[0].id;
    }

    if (!sessionId) {
      res.status(404).json({ success: false, error: 'Attendance session not found.' });
      return;
    }

    await pool.query(
      'UPDATE attendance_sessions SET status = "Edit Requested", edit_reason = ?, edit_requested_by = ?, edit_requested_at = NOW(), updated_at = NOW() WHERE id = ?',
      [String(reason).trim(), req.user.name, sessionId]
    );

    await pool.query(
      `INSERT INTO approvals (id, module, type, reference, record_id, requested_by, requestedBy, status, remarks, sessionId, cluster_id, clusterId, date, created_at, updated_at)
       VALUES (?, 'Attendance', 'Attendance Edit Request', ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, CURDATE(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE status = 'Pending', remarks = VALUES(remarks), updated_at = NOW()`,
      [randomUUID(), sessionId, sessionId, req.user.name, req.user.name, String(reason).trim(), sessionId, req.user.clusterId, req.user.clusterId]
    );

    void notifyWorkflow({
      clusterId: req.user.clusterId,
      title: 'Attendance edit requested',
      summary: `Cluster Admin requested an edit for attendance session ${sessionId}.`,
      details: [
        { label: 'Session ID', value: sessionId },
        { label: 'Reason', value: String(reason).trim() },
        { label: 'Requested By', value: req.user.name },
      ],
    }).catch((e) => console.error('[SMTP ERROR] Edit request notification failed:', e.message));

    res.json({ success: true, message: 'Edit request submitted successfully.', status: 'Edit Requested' });
  } catch (error) {
    console.error('Failed to request attendance edit:', error);
    res.status(500).json({ success: false, error: 'Unable to submit edit request.' });
  }
});

app.get('/api/lesson-plans', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    const academicYearId = String(req.query.academicYearId || '').trim();
    let sql = 'SELECT lp.* FROM lesson_plans lp WHERE 1=1';
    const params: any[] = [];

    if (academicYearId) {
      sql += ' AND (lp.academic_year_id = ? OR EXISTS (SELECT 1 FROM sessions s WHERE s.id = lp.session_id AND s.academic_year_id = ?))';
      params.push(academicYearId, academicYearId);
    }

    if (req.user.role === 'Cluster Admin') {
      sql += ' AND lp.cluster_id = ?';
      params.push(req.user.clusterId);
    } else if (cluster !== 'all') {
      sql += ' AND lp.cluster_id = ?';
      params.push(cluster);
    }

    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, lessonPlans: rows.map((row) => ({ id: row.id, sessionId: row.session_id, moduleId: row.module_id, clusterId: row.cluster_id, panchayatId: row.panchayat_id, title: row.title, status: row.status || 'Draft', createdBy: row.created_by })) });
  } catch (error) {
    console.error('Failed to load lesson plans:', error);
    res.status(503).json({ success: false, error: 'Unable to load data. Please try again.' });
  }
});

app.post('/api/lesson-plans', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clusterId = req.user.role === 'Cluster Admin' ? req.user.clusterId : String(req.body.clusterId || 'dharmapuri');
    const id = String(req.body.id || `lesson-${Date.now()}`).trim();
    // Phase 4: Check if session is editable
    const lpSessionId = String(req.body.sessionId || '');
    if (lpSessionId) {
      const editCheck = await isSessionEditable(lpSessionId);
      if (!editCheck.editable) {
        res.status(403).json({ success: false, error: editCheck.reason });
        return;
      }
      await autoTransitionToInProgress(lpSessionId);
    }
    await pool.query(
      `INSERT INTO lesson_plans (id, session_id, module_id, cluster_id, panchayat_id, title, topic, objective, activities, materials, duration, remarks, teaching_method, assessment_task, target_standard, learning_outcomes, day_number, volunteer_id, status, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE session_id = VALUES(session_id), module_id = VALUES(module_id), cluster_id = VALUES(cluster_id), panchayat_id = VALUES(panchayat_id), title = VALUES(title), topic = VALUES(topic), objective = VALUES(objective), activities = VALUES(activities), materials = VALUES(materials), duration = VALUES(duration), remarks = VALUES(remarks), teaching_method = VALUES(teaching_method), assessment_task = VALUES(assessment_task), target_standard = VALUES(target_standard), learning_outcomes = VALUES(learning_outcomes), day_number = VALUES(day_number), volunteer_id = VALUES(volunteer_id), status = VALUES(status), created_by = VALUES(created_by)`,
      [
        id, String(req.body.sessionId || ''), String(req.body.moduleId || 'module-english'), clusterId, String(req.body.panchayatId || ''), String(req.body.title || 'Lesson Plan').trim(),
        req.body.topic ? String(req.body.topic) : null,
        req.body.objective ? String(req.body.objective) : null,
        req.body.activities ? (typeof req.body.activities === 'string' ? req.body.activities : JSON.stringify(req.body.activities)) : null,
        req.body.materials ? String(req.body.materials) : null,
        req.body.duration ? Number(req.body.duration) : null,
        req.body.remarks ? String(req.body.remarks) : null,
        req.body.teachingMethod ? String(req.body.teachingMethod) : null,
        req.body.assessmentTask ? String(req.body.assessmentTask) : null,
        req.body.targetStandard ? String(req.body.targetStandard) : null,
        req.body.learningOutcomes ? String(req.body.learningOutcomes) : null,
        req.body.dayNumber ? Number(req.body.dayNumber) : null,
        req.body.volunteerId ? String(req.body.volunteerId) : null,
        String(req.body.status || 'Draft'), String(req.user.id)
      ]
    );

    res.json({ success: true, lessonPlan: { id, title: req.body.title || 'Lesson Plan', clusterId, status: req.body.status || 'Draft' } });
  } catch (error) {
    console.error('Failed to save lesson plan:', error);
    res.status(500).json({ success: false, error: 'Unable to save lesson plan.' });
  }
});

app.get('/api/finance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    const academicYearId = String(req.query.academicYearId || '').trim();
    let sql = 'SELECT f.* FROM finance_entries f WHERE 1=1';
    const params: any[] = [];

    if (academicYearId) {
      sql += ' AND (f.academic_year_id = ? OR EXISTS (SELECT 1 FROM sessions s WHERE s.id = f.session_id AND s.academic_year_id = ?))';
      params.push(academicYearId, academicYearId);
    }

    if (req.user.role === 'Cluster Admin') {
      sql += ' AND f.cluster_id = ?';
      params.push(req.user.clusterId);
    } else if (cluster !== 'all') {
      sql += ' AND f.cluster_id = ?';
      params.push(cluster);
    }

    sql += ' ORDER BY date DESC';
    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, financeEntries: rows.map(mapFinanceEntry) });
  } catch (error) {
    console.error('Failed to load finance:', error);
    res.status(503).json({ success: false, error: 'Unable to load data. Please try again.' });
  }
});

app.post('/api/finance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clusterId = req.user.role === 'Cluster Admin' ? req.user.clusterId : String(req.body.clusterId || 'dharmapuri');
    const id = String(req.body.id || `finance-${Date.now()}`).trim();
    // Phase 4: Check if linked session is editable
    const finSessionId = String(req.body.sessionId || '');
    if (finSessionId) {
      const editCheck = await isSessionEditable(finSessionId);
      if (!editCheck.editable) {
        res.status(403).json({ success: false, error: editCheck.reason });
        return;
      }
    }
    const amount = Number(req.body.amount || 0);
    const date = String(req.body.date || new Date().toISOString().split('T')[0]);
    const sessionId = String(req.body.sessionId || '').trim();
    let academicYearId = String(req.body.academicYearId || '').trim();
    if (!academicYearId && sessionId) {
      const [sessionRows] = await pool.query<any[]>('SELECT academic_year_id FROM sessions WHERE id = ? LIMIT 1', [sessionId]);
      academicYearId = String(sessionRows[0]?.academic_year_id || '');
    }

    await pool.query(
      'INSERT INTO finance_entries (id, cluster_id, session_id, academic_year_id, date, description, category, amount, created_by, status, bill_reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE cluster_id = VALUES(cluster_id), session_id = VALUES(session_id), academic_year_id = VALUES(academic_year_id), date = VALUES(date), description = VALUES(description), category = VALUES(category), amount = VALUES(amount), created_by = VALUES(created_by), status = VALUES(status), bill_reference = VALUES(bill_reference)',
      [id, clusterId, sessionId || null, academicYearId || null, date, String(req.body.description || 'Finance Entry').trim(), String(req.body.category || 'General'), amount, String(req.user.id), String(req.body.status || 'Draft'), String(req.body.billReference || '')]
    );

    res.json({ success: true, financeEntry: { id, clusterId, date, description: req.body.description || 'Finance Entry', category: req.body.category || 'General', amount, status: req.body.status || 'Draft', billReference: req.body.billReference || '' } });
  } catch (error) {
    console.error('Failed to save finance entry:', error);
    res.status(500).json({ success: false, error: 'Unable to save finance entry.' });
  }
});

app.get('/api/notifications', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200');
    res.json({ success: true, notifications: rows.map((row) => ({ id: row.id, title: row.title || 'TQI notification', message: row.message || '', type: row.type || 'system', isRead: !!row.is_read, timeAgo: row.created_at ? new Date(row.created_at).toLocaleString() : 'Just now' })) });
  } catch (error) {
    console.error('Failed to load notifications:', error);
    res.status(503).json({ success: false, error: 'Unable to load data. Please try again.' });
  }
});

app.get('/api/audit-logs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (req.user.role === 'Cluster Admin') {
      sql += ' AND cluster_id = ?';
      params.push(req.user.clusterId);
    } else if (cluster !== 'all') {
      sql += ' AND cluster_id = ?';
      params.push(cluster);
    }

    sql += ' ORDER BY created_at DESC LIMIT 100';
    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, auditLogs: rows.map((row) => ({ id: row.id, timestamp: row.created_at, userId: row.user_id, userName: row.user_name, userRole: row.role, action: row.action, module: row.module, recordId: row.record_id, clusterId: row.cluster_id, clusterName: row.cluster_id || '', details: row.details })) });
  } catch (error) {
    console.error('Failed to load audit logs:', error);
    res.status(503).json({ success: false, error: 'Unable to load data. Please try again.' });
  }
});

app.get('/api/users', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const params: any[] = [];
    let sql = "SELECT * FROM users WHERE status = 'ACTIVE'";
    if (req.user.role === 'Cluster Admin') {
      sql += ' AND cluster_id = ?';
      params.push(req.user.clusterId);
    }
    sql += ' ORDER BY name ASC';
    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, users: rows.map(serializeUser) });
  } catch (error) {
    console.error('Failed to load users:', error);
    res.status(503).json({ success: false, error: 'Unable to load data. Please try again.' });
  }
});

app.post('/api/users', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can create user accounts.' });
    return;
  }

  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const role = req.body.role === 'Super Admin' ? 'SUPER_ADMIN' : 'CLUSTER_ADMIN';
  const clusterId = role === 'CLUSTER_ADMIN' ? (String(req.body.clusterId || '').trim() || null) : null;
  const temporaryPassword = String(req.body.temporaryPassword || `TQI@Admin${randomInt(1000, 9999)}`).trim();

  if (!name || !email) {
    res.status(400).json({ success: false, error: 'Name and email are required.' });
    return;
  }

  if (role === 'CLUSTER_ADMIN' && !clusterId) {
    res.status(400).json({ success: false, error: 'Please select a cluster for the Cluster Admin role.' });
    return;
  }

  const userId = String(req.body.id || `usr-${randomUUID()}`);
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  try {
    await pool.query('START TRANSACTION');
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, cluster_id, phone, must_change_password, status) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, 'ACTIVE')`,
      [userId, name, email, passwordHash, role, clusterId, phone],
    );

    if (clusterId && role === 'CLUSTER_ADMIN') {
      await pool.query('UPDATE clusters SET admin_id = ? WHERE id = ?', [userId, clusterId]);
    }

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        `aud-${randomUUID()}`,
        req.user.id,
        req.user.name,
        req.user.role,
        clusterId,
        'CREATE_USER',
        'USERS',
        userId,
        `Created ${role === 'SUPER_ADMIN' ? 'Super Admin' : 'Cluster Admin'} user ${name} (${email})`,
      ],
    ).catch(() => undefined);

    await pool.query('COMMIT');

    // Fetch cluster name if any for email dispatch
    let clusterName = '';
    if (clusterId) {
      const [cRows] = await pool.query<any[]>('SELECT name FROM clusters WHERE id = ? LIMIT 1', [clusterId]);
      if (cRows.length) clusterName = cRows[0].name;
    }

    sendOnboardingCredentialsEmail({
      recipient: email,
      name,
      temporaryPassword,
      role,
      clusterName: clusterName || undefined,
      projectRoot: PROJECT_ROOT,
    }).catch((err) => console.error('[ONBOARDING EMAIL ERROR]:', err));
    void notifyWorkflow({
      clusterId: clusterId || undefined,
      title: `${role === 'SUPER_ADMIN' ? 'Super Admin' : 'Cluster Admin'} account created`,
      summary: 'A new TQI ERP administrative account has been created and onboarding credentials were sent to the user.',
      details: [
        { label: 'Administrator', value: name },
        { label: 'Login Email', value: email },
        { label: 'Role', value: role === 'SUPER_ADMIN' ? 'Super Admin' : 'Cluster Admin' },
        { label: 'Cluster', value: clusterName || 'All Clusters' },
        { label: 'Created By', value: req.user.name },
      ],
    }).catch((err) => console.error('[SMTP ERROR] User creation notification failed:', err.message));

    const [createdRows] = await pool.query<any[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);

    res.status(201).json({
      success: true,
      temporaryPassword,
      user: serializeUser(createdRows[0] || { id: userId, name, email, role, cluster_id: clusterId, phone, status: 'ACTIVE', must_change_password: true }),
    });
  } catch (error: any) {
    await pool.query('ROLLBACK').catch(() => undefined);
    const duplicate = error?.code === 'ER_DUP_ENTRY';
    res.status(duplicate ? 409 : 503).json({ success: false, error: duplicate ? 'Email address already belongs to an existing user.' : 'Unable to create user.' });
  }
});

app.put('/api/users/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can edit users.' });
    return;
  }
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const role = req.body.role === 'Super Admin' ? 'SUPER_ADMIN' : 'CLUSTER_ADMIN';
  const clusterId = role === 'CLUSTER_ADMIN' ? String(req.body.clusterId || '').trim() || null : null;
  if (!name || !email) { res.status(400).json({ success: false, error: 'Name and email are required.' }); return; }
  try {
    await pool.query('UPDATE users SET name = ?, email = ?, phone = ?, role = ?, cluster_id = ? WHERE id = ?', [name, email, phone, role, clusterId, req.params.id]);
    await pool.query('UPDATE clusters SET admin_id = NULL WHERE admin_id = ?', [req.params.id]);
    if (clusterId) await pool.query('UPDATE clusters SET admin_id = ? WHERE id = ?', [req.params.id, clusterId]);
    const [rows] = await pool.query<any[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) { res.status(404).json({ success: false, error: 'User not found.' }); return; }
    res.json({ success: true, user: serializeUser(rows[0]) });
  } catch (error: any) {
    res.status(error?.code === 'ER_DUP_ENTRY' ? 409 : 503).json({ success: false, error: error?.code === 'ER_DUP_ENTRY' ? 'Email already belongs to another user.' : 'Unable to update user.' });
  }
});

app.delete('/api/users/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') { res.status(403).json({ success: false, error: 'Only Super Admin can delete users.' }); return; }
  if (req.params.id === req.user.id) { res.status(400).json({ success: false, error: 'You cannot delete your own account.' }); return; }
  try {
    await pool.query('UPDATE clusters SET admin_id = NULL WHERE admin_id = ?', [req.params.id]);
    const [result] = await pool.query<any>("UPDATE users SET status = 'INACTIVE' WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'User not found.' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Unable to delete user.' });
  }
});

app.post('/api/users/:id/reset-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') { res.status(403).json({ success: false, error: 'Only Super Admin can reset passwords.' }); return; }
  const password = String(req.body.password || '');
  if (password.length < 8) { res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' }); return; }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query<any>('UPDATE users SET password_hash = ?, must_change_password = FALSE WHERE id = ?', [passwordHash, req.params.id]);
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'User not found.' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Unable to reset password.' });
  }
});

// --- NEW ENDPOINTS ADDED IN PHASE 2 (PART 1) ---

// 1. PUT /api/clusters/:id
app.put('/api/clusters/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') { res.status(403).json({ success: false, error: 'Only Super Admin can update clusters.' }); return; }
  const name = String(req.body.name || '').trim();
  const college_name = String(req.body.college_name || req.body.collegeName || '').trim();
  const spoc_name = String(req.body.spoc_name || req.body.spocName || '').trim();
  const spoc_mobile = String(req.body.spoc_mobile || req.body.spocMobile || '').trim();
  const adminEmail = String(req.body.spocEmail || req.body.adminEmail || '').trim().toLowerCase();
  const district = String(req.body.district || '').trim();
  const state = String(req.body.state || 'Tamil Nadu').trim();
  if (!req.body.contactOnly && (!name || !college_name || !district || !spoc_name || !spoc_mobile || !adminEmail)) { res.status(400).json({ success: false, error: 'All cluster, college, district, SPOC, phone, and email fields are required.' }); return; }
  try {
    if (req.body.contactOnly) {
      const contactEmail = adminEmail;
      if (!spoc_name || !spoc_mobile || !contactEmail) { res.status(400).json({ success: false, error: 'SPOC name, contact mobile, and email are required.' }); return; }
      const [contactRows] = await pool.query<any[]>('SELECT c.name, c.college_name, c.district, c.admin_id FROM clusters c WHERE c.id = ? AND c.status <> \'INACTIVE\' LIMIT 1', [req.params.id]);
      if (!contactRows.length) { res.status(404).json({ success: false, error: 'Cluster not found.' }); return; }
      const [contactResult] = await pool.query<any>('UPDATE clusters SET spoc_name = ?, spoc_mobile = ? WHERE id = ? AND status <> \'INACTIVE\'', [spoc_name, spoc_mobile, req.params.id]);
      if (!contactResult.affectedRows) { res.status(404).json({ success: false, error: 'Cluster not found.' }); return; }
      if (contactRows[0].admin_id) await pool.query('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?', [spoc_name, contactEmail, spoc_mobile, contactRows[0].admin_id]);
      const emailSent = await sendWorkflowEmail({
        recipient: contactEmail,
        recipientName: spoc_name,
        title: 'Cluster Contact Details Updated',
        summary: 'Your TQI Cluster contact details were updated by the Super Admin.',
        details: [{ label: 'College', value: contactRows[0].college_name || '' }, { label: 'Cluster', value: contactRows[0].name }, { label: 'Updated SPOC', value: spoc_name }, { label: 'Updated Phone', value: spoc_mobile }, { label: 'Updated Email', value: contactEmail }],
        projectRoot: PROJECT_ROOT,
      });
      await pool.query('INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [randomUUID(), req.user.id, req.user.name, req.user.role, req.params.id, emailSent ? 'CONTACT_UPDATE_EMAIL_SENT' : 'CONTACT_UPDATE_EMAIL_FAILED', 'CLUSTERS', req.params.id, JSON.stringify({ recipient: contactEmail, status: emailSent ? 'sent' : 'failed' })]).catch(() => undefined);
      res.json({ success: true, data: { id: req.params.id, spocName: spoc_name, spocMobile: spoc_mobile, adminEmail: contactEmail }, warning: emailSent ? undefined : 'Cluster details updated, but notification email could not be sent.' });
      return;
    }
    const [clusterRows] = await pool.query<any[]>('SELECT college_id FROM clusters WHERE id = ? LIMIT 1', [req.params.id]);
    if (!clusterRows.length) { res.status(404).json({ success: false, error: 'Cluster not found.' }); return; }
    if (clusterRows[0].college_id) {
      await pool.query('UPDATE colleges SET name = ?, district = ? WHERE id = ?', [college_name, district, clusterRows[0].college_id]);
    }
    const [result] = await pool.query<any>(
      'UPDATE clusters SET name = ?, college_name = ?, spoc_name = ?, spoc_mobile = ?, district = ?, state = ? WHERE id = ?',
      [name, college_name, spoc_name, spoc_mobile, district, state, req.params.id]
    );
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Cluster not found.' }); return; }
    const [adminRows] = await pool.query<any[]>('SELECT admin_id FROM clusters WHERE id = ? LIMIT 1', [req.params.id]);
    if (adminRows[0]?.admin_id) {
      await pool.query('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?', [spoc_name, adminEmail, spoc_mobile, adminRows[0].admin_id]);
    }
    await pool.query('INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), req.user.id, 'UPDATE_CLUSTER', 'CLUSTER', req.params.id, JSON.stringify(req.body)]);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to update cluster.' });
  }
});

// 2. DELETE /api/clusters/:id
app.delete('/api/clusters/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') { res.status(403).json({ success: false, error: 'Only Super Admin can delete clusters.' }); return; }
  let connection: any;
  try {
    const dependencyTables = ['panchayats', 'villages', 'students', 'volunteers', 'sessions', 'attendance_sessions', 'session_photos', 'lesson_plans', 'session_reports', 'finance_entries', 'finance_drafts', 'approvals', 'correction_requests', 'date_change_requests', 'session_submissions'];
    const dependencyCounts = await Promise.all(dependencyTables.map(async (table) => {
      const [rows] = await pool.query<any[]>(`SELECT COUNT(*) AS count FROM ${table} WHERE cluster_id = ?`, [req.params.id]);
      return { table, count: Number(rows[0]?.count || 0) };
    }));
    if (dependencyCounts.some((dependency) => dependency.count > 0)) {
      res.status(409).json({ success: false, error: 'This cluster contains operational data and cannot be permanently deleted.', dependencies: dependencyCounts.filter((dependency) => dependency.count > 0) });
      return;
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [clusterRows] = await connection.query('SELECT id, college_id FROM clusters WHERE id = ? LIMIT 1', [req.params.id]) as [any[], any];
    if (!clusterRows.length) {
      await connection.rollback();
      res.status(404).json({ success: false, error: 'Cluster not found.' });
      return;
    }
    await connection.query("DELETE FROM users WHERE cluster_id = ? AND role = 'CLUSTER_ADMIN'", [req.params.id]);
    await connection.query('DELETE FROM clusters WHERE id = ?', [req.params.id]);
    if (clusterRows[0].college_id) {
      const [otherClusters] = await connection.query('SELECT id FROM clusters WHERE college_id = ? LIMIT 1', [clusterRows[0].college_id]) as [any[], any];
      if (!otherClusters.length) await connection.query('DELETE FROM colleges WHERE id = ?', [clusterRows[0].college_id]);
    }
    await connection.query('INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), req.user.id, 'DELETE_CLUSTER', 'CLUSTER', req.params.id, '{}']);
    await connection.commit();
    res.json({ success: true, deletedClusterId: req.params.id });
  } catch (error) {
    await connection?.rollback().catch(() => undefined);
    res.status(503).json({ success: false, error: 'Failed to delete cluster.' });
  } finally {
    connection?.release();
  }
});

app.put('/api/clusters/:id/admin-status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') { res.status(403).json({ success: false, error: 'Only Super Admin can block administrators.' }); return; }
  const status = req.body.status === 'BLOCKED' ? 'BLOCKED' : req.body.status === 'ACTIVE' ? 'ACTIVE' : null;
  if (!status) { res.status(400).json({ success: false, error: 'Invalid administrator status.' }); return; }
  try {
    const [adminRows] = await pool.query<any[]>('SELECT u.id, u.name, u.email, c.name AS cluster_name, c.college_name, c.spoc_mobile FROM users u INNER JOIN clusters c ON c.id = u.cluster_id WHERE c.id = ? AND u.role = \'CLUSTER_ADMIN\' LIMIT 1', [req.params.id]);
    if (!adminRows.length) { res.status(404).json({ success: false, error: 'Cluster Admin not found.' }); return; }
    const [result] = await pool.query<any>("UPDATE users SET status = ? WHERE cluster_id = ? AND role = 'CLUSTER_ADMIN'", [status, req.params.id]);
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Cluster Admin not found.' }); return; }
    await pool.query('INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), req.user.id, status === 'BLOCKED' ? 'BLOCK_CLUSTER_ADMIN' : 'UNBLOCK_CLUSTER_ADMIN', 'CLUSTER', req.params.id, JSON.stringify({ reason: req.body.reason || '' })]);
    const emailSent = await sendWorkflowEmail({
      recipient: adminRows[0].email,
      recipientName: adminRows[0].name,
      title: status === 'BLOCKED' ? 'Cluster Admin Account Blocked' : 'Cluster Admin Account Restored',
      summary: status === 'BLOCKED' ? 'Your TQI Cluster Admin login has been blocked by the Super Admin.' : 'Your TQI Cluster Admin login has been restored and is active again.',
      details: [{ label: 'College', value: adminRows[0].college_name || '' }, { label: 'Cluster', value: adminRows[0].cluster_name || req.params.id }, ...(status === 'BLOCKED' ? [{ label: 'Reason', value: String(req.body.reason || 'Administrative action') }] : []), { label: 'Contact', value: adminRows[0].spoc_mobile || '' }],
      projectRoot: PROJECT_ROOT,
    });
    await pool.query('INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), req.user.id, emailSent ? 'ADMIN_STATUS_EMAIL_SENT' : 'ADMIN_STATUS_EMAIL_FAILED', 'CLUSTER', req.params.id, JSON.stringify({ recipient: adminRows[0].email, status: emailSent ? 'sent' : 'failed' })]).catch(() => undefined);
    res.json({ success: true, status, warning: emailSent ? undefined : 'Account status updated, but notification email could not be sent.' });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Unable to update administrator status.' });
  }
});

// 3. GET /api/villages
app.get('/api/villages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestedCluster = String(req.query.cluster || '').trim();
  const targetClusterId = req.user.role !== 'Super Admin' ? req.user.clusterId : (requestedCluster && requestedCluster !== 'all' ? requestedCluster : null);
  const targetPanchayatId = req.query.panchayat ? String(req.query.panchayat).trim() : null;
  
  let sql = `
    SELECT v.*, p.name as panchayat_name,
      (SELECT COUNT(*) FROM students s WHERE s.village_id = v.id AND s.status NOT IN ('inactive', 'INACTIVE')) AS students_count,
      (SELECT COUNT(*) FROM volunteers vol WHERE vol.village_id = v.id AND vol.status NOT IN ('inactive', 'INACTIVE')) AS volunteers_count
    FROM villages v
    LEFT JOIN panchayats p ON v.panchayat_id = p.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (targetClusterId) {
    sql += ' AND v.cluster_id = ?';
    params.push(targetClusterId);
  }
  if (targetPanchayatId) {
    sql += ' AND v.panchayat_id = ?';
    params.push(targetPanchayatId);
    if (targetClusterId) {
      sql += ' AND p.cluster_id = ?';
      params.push(targetClusterId);
    }
  }
  
  try {
    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, villages: rows.map((row: any) => ({ ...row, studentCount: Number(row.students_count || 0), volunteerCount: Number(row.volunteers_count || 0), panchayatId: row.panchayat_id, clusterId: row.cluster_id, status: row.status || 'ACTIVE' })), data: rows });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to fetch villages.' });
  }
});

// 4. POST /api/villages
app.post('/api/villages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const panchayatId = String(req.body.panchayat_id || req.body.panchayatId || '').trim();
    const name = String(req.body.name || '').trim();
    if (!name || !panchayatId) { res.status(400).json({ success: false, message: 'Village name and panchayat are required.' }); return; }
    const [parentRows] = await pool.query<any[]>('SELECT id, cluster_id FROM panchayats WHERE id = ? LIMIT 1', [panchayatId]);
    if (!parentRows.length || (req.user.role === 'Cluster Admin' && parentRows[0].cluster_id !== req.user.clusterId)) {
      res.status(403).json({ success: false, message: 'You are not authorized to add a village under this panchayat.' }); return;
    }
    const clusterId = parentRows[0].cluster_id;
    const finalId = randomUUID();
    await pool.query(
      'INSERT INTO villages (id, name, panchayat_id, cluster_id, status) VALUES (?, ?, ?, ?, ?)',
      [finalId, name, panchayatId, clusterId, req.body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE']
    );
    res.json({ success: true, village: { id: finalId, name, panchayatId, clusterId, status: req.body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' } });
  } catch (error) {
    console.error('Failed to create village:', error);
    res.status(503).json({ success: false, message: 'Village could not be created.' });
  }
});

app.put('/api/villages/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) { res.status(400).json({ success: false, message: 'Village name is required.' }); return; }
    const [rows] = await pool.query<any[]>(
      'SELECT v.id, v.panchayat_id, v.cluster_id FROM villages v INNER JOIN panchayats p ON p.id = v.panchayat_id WHERE v.id = ? AND (? = \'Super Admin\' OR p.cluster_id = ?) LIMIT 1',
      [req.params.id, req.user.role, req.user.clusterId]
    );
    if (!rows.length) { res.status(404).json({ success: false, message: 'Village not found or not authorized.' }); return; }
    const status = req.body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await pool.query('UPDATE villages SET name = ?, status = ? WHERE id = ?', [name, status, req.params.id]);
    res.json({ success: true, village: { id: req.params.id, name, panchayatId: rows[0].panchayat_id, clusterId: rows[0].cluster_id, status } });
  } catch (error) {
    console.error('Failed to update village:', error);
    res.status(503).json({ success: false, message: 'Village could not be updated.' });
  }
});

// 5. DELETE /api/villages/:id
app.delete('/api/villages/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [villageRows] = await pool.query<any[]>("SELECT v.id FROM villages v INNER JOIN panchayats p ON p.id = v.panchayat_id WHERE v.id = ? AND (? = 'Super Admin' OR p.cluster_id = ?) LIMIT 1", [req.params.id, req.user.role, req.user.clusterId]);
    if (!villageRows.length) { res.status(404).json({ success: false, message: 'Village not found.' }); return; }
    const [dependencyRows] = await pool.query<any[]>(
      `SELECT (SELECT COUNT(*) FROM students WHERE village_id = ?) +
              (SELECT COUNT(*) FROM volunteers WHERE village_id = ?) +
              (SELECT COUNT(*) FROM sessions WHERE village_id = ?) +
              (SELECT COUNT(*) FROM session_reports WHERE village_id = ?) AS dependency_count`,
      [req.params.id, req.params.id, req.params.id, req.params.id]
    );
    if (Number(dependencyRows[0]?.dependency_count || 0) > 0) {
      res.status(409).json({ success: false, message: 'This village has linked records and cannot be permanently deleted.' });
      return;
    }
    const [result] = await pool.query<any>('DELETE FROM villages WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) { res.status(404).json({ success: false, message: 'Village not found.' }); return; }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete village:', error);
    res.status(503).json({ success: false, message: 'Village could not be deleted.' });
  }
});

// 6. DELETE /api/panchayats/:id
app.delete('/api/panchayats/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [result] = await pool.query<any>("DELETE FROM panchayats WHERE id = ? AND (? = 'Super Admin' OR cluster_id = ?)", [req.params.id, req.user.role, req.user.clusterId]);
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Panchayat not found.' }); return; }
    await pool.query("DELETE FROM villages WHERE panchayat_id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to delete panchayat.' });
  }
});

// 7. PUT /api/students/:id
app.put('/api/students/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { name, gender, dob, standard, panchayat_id, village_id, parent_name, phone, status } = req.body;
  try {
    const [result] = await pool.query<any>(
      'UPDATE students SET name = ?, gender = ?, dob = ?, standard = ?, panchayat_id = ?, village_id = ?, parent_name = ?, phone = ?, status = ? WHERE id = ?',
      [name, gender, dob, standard, panchayat_id, village_id, parent_name, phone, status, req.params.id]
    );
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Student not found.' }); return; }
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to update student.' });
  }
});

// 8. DELETE /api/students/:id
app.delete('/api/students/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [result] = await pool.query<any>("UPDATE students SET status = 'inactive' WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Student not found.' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to delete student.' });
  }
});

// 9. POST /api/students/bulk
app.post('/api/students/bulk', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { students } = req.body;
  const clusterId = req.user.role === 'Cluster Admin' ? req.user.clusterId : String(req.body.clusterId || '');
  if (!Array.isArray(students) || !clusterId) {
    res.status(400).json({ success: false, error: 'Invalid payload.' });
    return;
  }
  let count = 0;
  try {
    await pool.query('START TRANSACTION');
    for (const student of students) {
      const [parentRows] = await pool.query<any[]>('SELECT id FROM panchayats WHERE id = ? AND cluster_id = ? LIMIT 1', [student.panchayatId, clusterId]);
      if (!parentRows.length) throw new Error('A student row references an unauthorized panchayat.');
      const [villageRows] = await pool.query<any[]>('SELECT id FROM villages WHERE id = ? AND panchayat_id = ? AND cluster_id = ? LIMIT 1', [student.villageId, student.panchayatId, clusterId]);
      if (!villageRows.length) throw new Error('A student row references an invalid village.');
      await pool.query(
        'INSERT INTO students (id, cluster_id, name, gender, dob, standard, panchayat_id, village_id, parent_name, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [randomUUID(), clusterId, student.name, student.gender, student.dob, student.standard, student.panchayatId, student.villageId, '', student.phone, 'active']
      );
      count++;
    }
    await pool.query('COMMIT');
    res.json({ success: true, count });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    res.status(503).json({ success: false, error: 'Failed to bulk import students.' });
  }
});

// 10. PUT /api/volunteers/:id
app.put('/api/volunteers/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, phone, department, stream, passingOutYear, role, status } = req.body;
  const panchayat_id = req.body.panchayat_id || req.body.panchayatId || '';
  const village_id = req.body.village_id || req.body.villageId || '';
  try {
    const [result] = await pool.query<any>(
      'UPDATE volunteers SET name = ?, email = ?, phone = ?, department = ?, stream = ?, passing_out_year = ?, role = ?, panchayat_id = ?, village_id = ?, status = ? WHERE id = ?',
      [name, email, phone, department, stream, passingOutYear ? Number(passingOutYear) : null, role, panchayat_id, village_id, status, req.params.id]
    );
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Volunteer not found.' }); return; }
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to update volunteer.' });
  }
});

// 11. DELETE /api/volunteers/:id
app.delete('/api/volunteers/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [result] = await pool.query<any>("UPDATE volunteers SET status = 'Inactive' WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Volunteer not found.' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to delete volunteer.' });
  }
});

// 12. POST /api/volunteers/bulk
app.post('/api/volunteers/bulk', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { volunteers, clusterId } = req.body;
  if (!Array.isArray(volunteers) || !clusterId) {
    res.status(400).json({ success: false, error: 'Invalid payload.' });
    return;
  }
  let count = 0;
  try {
    for (const vol of volunteers) {
      await pool.query(
        'INSERT INTO volunteers (id, cluster_id, name, email, phone, department, stream, passing_out_year, role, panchayat_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), clusterId, vol.name, vol.email, vol.phone, vol.department, vol.stream || '', vol.passingOutYear ? Number(vol.passingOutYear) : null, vol.role, vol.panchayatId || null, 'Active']
      );
      count++;
    }
    res.json({ success: true, count });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to bulk import volunteers.' });
  }
});

// 13. DELETE /api/sessions/:id
app.delete('/api/sessions/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await pool.query("DELETE FROM session_attendance WHERE session_id = ?", [req.params.id]);
    const [result] = await pool.query<any>("DELETE FROM sessions WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Session not found.' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to delete session.' });
  }
});

// 14. DELETE /api/lesson-plans/:id
app.delete('/api/lesson-plans/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [result] = await pool.query<any>("DELETE FROM lesson_plans WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Lesson plan not found.' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to delete lesson plan.' });
  }
});

// --- 1. Date Change Requests ---
app.post('/api/date-change-requests', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Cluster Admin') {
    res.status(403).json({ success: false, error: 'Only Cluster Admin can request a date change.' });
    return;
  }
  try {
    const { sessionId, originalDate, requestedDate, reason } = req.body;
    const clusterId = req.user.clusterId;
    if (!sessionId || !originalDate || !requestedDate || !reason || !/^\d{4}-\d{2}-\d{2}$/.test(String(requestedDate))) {
      res.status(400).json({ success: false, error: 'Session, dates, and a reason are required.' });
      return;
    }
    const [sessions] = await pool.query<any[]>(
      `SELECT id, cluster_id, academic_year_id, day_id, day_number, date, session_status
       FROM sessions WHERE id = ? AND cluster_id = ? LIMIT 1`,
      [sessionId, clusterId],
    );
    if (!sessions.length) {
      res.status(404).json({ success: false, error: 'Session not found for your assigned cluster.' });
      return;
    }
    const session = sessions[0];
    const storedDate = session.date instanceof Date
      ? session.date.toISOString().slice(0, 10)
      : /^\d{4}-\d{2}-\d{2}/.test(String(session.date || ''))
        ? String(session.date).slice(0, 10)
        : new Date(session.date).toISOString().slice(0, 10);
    const requestOriginalDate = storedDate || String(originalDate).slice(0, 10);
    const [pending] = await pool.query<any[]>(
      'SELECT * FROM date_change_requests WHERE session_id = ? AND status = \'PENDING\' LIMIT 1',
      [sessionId],
    );
    if (pending.length) {
      const existing = pending[0];
      res.json({
        success: true,
        alreadyPending: true,
        dateChangeRequest: {
          id: existing.id,
          sessionId: existing.session_id,
          clusterId: existing.cluster_id,
          originalDate: existing.original_date,
          requestedDate: existing.requested_date,
          reason: existing.reason,
          status: existing.status,
          requestedBy: existing.requested_by,
          createdAt: existing.created_at,
        },
      });
      return;
    }
    const id = `dcr-${randomUUID()}`;

    await pool.query(
      'INSERT INTO date_change_requests (id, session_id, cluster_id, academic_year_id, day_id, day_number, original_date, requested_date, reason, status, requested_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, sessionId, clusterId, session.academic_year_id, session.day_id, session.day_number, requestOriginalDate, requestedDate, reason, 'PENDING', req.user.id]
    );

    await pool.query(
      'INSERT INTO notifications (id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [randomUUID(), 'Date Change Request', `New date change request for session ${sessionId} from cluster ${clusterId}.`, 'date_change']
    ).catch((error) => console.error('Failed to create date-change notification:', error));

    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, clusterId, 'CREATE_DATE_CHANGE_REQUEST', 'DATE_CHANGES', id, `Requested date change for session ${sessionId}`]
    ).catch((error) => console.error('Failed to create date-change audit log:', error));

    res.json({ success: true, request: { id, sessionId, clusterId, originalDate: requestOriginalDate, requestedDate, reason, status: 'PENDING' }, dateChangeRequest: { id, sessionId, clusterId, originalDate: requestOriginalDate, requestedDate, reason, status: 'PENDING' } });
  } catch (error) {
    console.error('Failed to submit date change request:', error);
    res.status(500).json({ success: false, error: 'Unable to submit request.' });
  }
});

app.get('/api/date-change-requests', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let sql = 'SELECT d.*, c.name AS cluster_name FROM date_change_requests d LEFT JOIN clusters c ON c.id = d.cluster_id WHERE 1=1';
    const params: any[] = [];
    const academicYearId = String(req.query.academicYearId || '').trim();
    if (academicYearId) {
      sql += ' AND (d.academic_year_id = ? OR EXISTS (SELECT 1 FROM sessions s WHERE s.id = d.session_id AND s.academic_year_id = ?))';
      params.push(academicYearId, academicYearId);
    }

    if (req.user.role === 'Cluster Admin') {
      sql += ' AND d.cluster_id = ?';
      params.push(req.user.clusterId);
    }

    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query<any[]>(sql, params);
    res.json({
      success: true,
      data: rows,
      dateChangeRequests: rows.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        clusterId: row.cluster_id,
        clusterName: row.cluster_name || row.cluster_id || '',
        academicYearId: row.academic_year_id,
        dayId: row.day_id,
        dayNumber: row.day_number,
        originalDate: row.original_date,
        requestedDate: row.requested_date,
        reason: row.reason,
        status: row.status,
        requestedBy: row.requested_by,
        reviewedBy: row.reviewed_by,
        reviewRemarks: row.review_remarks,
        reviewedAt: row.reviewed_at,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch date change requests:', error);
    res.status(503).json({ success: false, error: 'Unable to load data.' });
  }
});

app.put('/api/date-change-requests/:id/:action', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can review date change requests.' });
    return;
  }
  
  const { action } = req.params;
  const { remarks } = req.body;
  const status = action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : null;

  if (!status) {
    res.status(400).json({ success: false, error: 'Invalid action.' });
    return;
  }

  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM date_change_requests WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Request not found.' });
      return;
    }
    const request = rows[0];

    await pool.query('START TRANSACTION');

    await pool.query(
      'UPDATE date_change_requests SET status = ?, reviewed_by = ?, review_remarks = ?, reviewed_at = NOW() WHERE id = ?',
      [status, req.user.id, remarks, req.params.id]
    );

    if (status === 'APPROVED') {
      await pool.query(
        "UPDATE sessions SET date = ?, session_status = 'Scheduled' WHERE id = ? AND cluster_id = ?",
        [request.requested_date, request.session_id, request.cluster_id]
      );
    }

    await pool.query(
      'INSERT INTO notifications (id, title, message, type, is_read, created_at, user_id) VALUES (?, ?, ?, ?, 0, NOW(), ?)',
      [randomUUID(), `Date Change ${status}`, `Your date change request for session ${request.session_id} was ${status.toLowerCase()}.`, 'date_change_reply', request.requested_by]
    );

    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, request.cluster_id, `REVIEW_DATE_CHANGE_${status}`, 'DATE_CHANGES', req.params.id, remarks]
    );

    await pool.query('COMMIT');
    res.json({ success: true, status, dateChangeRequest: { ...request, status, reviewed_by: req.user.id, review_remarks: remarks } });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    console.error('Failed to update date change request:', error);
    res.status(503).json({ success: false, error: 'Unable to process request.' });
  }
});

// --- 2. Session Reports ---
app.get('/api/session-reports', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let sql = 'SELECT * FROM session_reports WHERE 1=1';
    const params: any[] = [];
    const academicYearId = String(req.query.academicYearId || '').trim();
    if (academicYearId) {
      sql += ' AND (academic_year_id = ? OR EXISTS (SELECT 1 FROM sessions s WHERE s.id = session_reports.session_id AND s.academic_year_id = ?))';
      params.push(academicYearId, academicYearId);
    }
    if (req.user.role === 'Cluster Admin') {
      sql += ' AND cluster_id = ?';
      params.push(req.user.clusterId);
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, data: rows, sessionReports: rows });
  } catch (error) {
    console.error('Failed to fetch session reports:', error);
    res.status(503).json({ success: false, error: 'Unable to load data.' });
  }
});

app.post('/api/session-reports', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, sessionId, clusterId, dayNumber, sessionSummary, studentCount, attendanceSummary, activities, issues, remarks, status } = req.body;
    const recordId = id || `report-${randomUUID()}`;
    const cId = clusterId || req.user.clusterId;

    await pool.query(
      `INSERT INTO session_reports (id, session_id, cluster_id, day_number, session_summary, student_count, attendance_summary, activities, issues, remarks, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE session_summary = VALUES(session_summary), student_count = VALUES(student_count), attendance_summary = VALUES(attendance_summary), activities = VALUES(activities), issues = VALUES(issues), remarks = VALUES(remarks), status = VALUES(status)`,
      [recordId, sessionId, cId, dayNumber, sessionSummary, studentCount, attendanceSummary, typeof activities === 'string' ? activities : JSON.stringify(activities), issues, remarks, status || 'Draft', req.user.id]
    );

    res.json({ success: true, data: { id: recordId } });
  } catch (error) {
    console.error('Failed to save session report:', error);
    res.status(500).json({ success: false, error: 'Unable to save report.' });
  }
});

app.delete('/api/session-reports/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM session_reports WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete session report:', error);
    res.status(500).json({ success: false, error: 'Unable to delete report.' });
  }
});

// --- 3. Session Submissions ---
app.post('/api/session-submissions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Cluster Admin') {
    res.status(403).json({ success: false, error: 'Only Cluster Admin can submit sessions.' });
    return;
  }
  try {
    const { sessionId } = req.body;
    const [sessionRows] = await pool.query<any[]>('SELECT id, cluster_id, day_number FROM sessions WHERE id = ? AND cluster_id = ? LIMIT 1', [sessionId, req.user.clusterId]);
    if (!sessionRows.length) {
      res.status(404).json({ success: false, error: 'Session not found for your assigned cluster.' });
      return;
    }
    const session = sessionRows[0];
    const cId = session.cluster_id;
    const dayNumber = Number(session.day_number);
    const recordId = `sub-${sessionId}`;

    const [attRows] = await pool.query<any[]>('SELECT id FROM attendance_sessions WHERE session_id = ? AND day_number = ? AND status != "DRAFT"', [sessionId, dayNumber]);
    const attendanceComplete = attRows.length > 0;

    const [lpRows] = await pool.query<any[]>('SELECT id FROM lesson_plans WHERE session_id = ?', [sessionId]);
    const lessonPlanComplete = lpRows.length > 0;

    const [photoRows] = await pool.query<any[]>('SELECT id FROM session_photos WHERE session_id = ?', [sessionId]);
    const photosComplete = photoRows.length > 0;

    const [repRows] = await pool.query<any[]>('SELECT id FROM session_reports WHERE session_id = ?', [sessionId]);
    const reportComplete = repRows.length > 0;

    const [finRows] = await pool.query<any[]>('SELECT id FROM finance_entries WHERE cluster_id = ? AND session_id = ?', [cId, sessionId]);
    const financeComplete = finRows.length > 0;

    const allComplete = attendanceComplete && lessonPlanComplete && photosComplete && reportComplete && financeComplete;

    if (!allComplete) {
      const missing = [];
      if (!attendanceComplete) missing.push('Attendance');
      if (!lessonPlanComplete) missing.push('Lesson Plan');
      if (!photosComplete) missing.push('Photos');
      if (!reportComplete) missing.push('Session Report');
      if (!financeComplete) missing.push('Finance');
      res.status(400).json({ success: false, error: 'Missing requirements.', missing });
      return;
    }

    await pool.query('START TRANSACTION');

    await pool.query(
      `INSERT INTO session_submissions (id, session_id, cluster_id, day_number, attendance_complete, lesson_plan_complete, photos_complete, report_complete, finance_complete, status, submitted_at, submitted_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE attendance_complete=VALUES(attendance_complete), lesson_plan_complete=VALUES(lesson_plan_complete), photos_complete=VALUES(photos_complete), report_complete=VALUES(report_complete), finance_complete=VALUES(finance_complete), status=VALUES(status), submitted_at=VALUES(submitted_at), submitted_by=VALUES(submitted_by)`,
      [recordId, sessionId, cId, dayNumber, attendanceComplete, lessonPlanComplete, photosComplete, reportComplete, financeComplete, 'SUBMITTED', req.user.id]
    );

    await pool.query('UPDATE sessions SET status = "Submitted" WHERE id = ?', [sessionId]);

    await pool.query(
      'INSERT INTO notifications (id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [randomUUID(), 'Session Submitted', `Session ${sessionId} has been submitted for review.`, 'submission']
    );

    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, cId, 'SUBMIT_SESSION', 'SUBMISSIONS', recordId, `Submitted session ${sessionId}`]
    );

    await pool.query('COMMIT');
    void notifyWorkflow({
      clusterId: cId,
      title: 'Session submitted for review',
      summary: 'The complete session workflow has been submitted and is ready for Super Admin review.',
      details: [
        { label: 'Session', value: sessionId },
        { label: 'Day', value: `Day ${dayNumber}` },
        { label: 'Status', value: 'Pending Review' },
        { label: 'Submitted By', value: req.user.name },
      ],
    }).catch((error) => console.error('[SMTP ERROR] Session workflow notification failed:', error.message));
    res.json({ success: true, data: { id: recordId, status: 'SUBMITTED' } });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    console.error('Failed to submit session:', error);
    res.status(500).json({ success: false, error: 'Unable to submit session.' });
  }
});

app.get('/api/session-submissions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let sql = 'SELECT * FROM session_submissions WHERE 1=1';
    const params: any[] = [];
    const academicYearId = String(req.query.academicYearId || '').trim();
    if (academicYearId) {
      sql += ' AND (academic_year_id = ? OR EXISTS (SELECT 1 FROM sessions s WHERE s.id = session_submissions.session_id AND s.academic_year_id = ?))';
      params.push(academicYearId, academicYearId);
    }
    if (req.user.role === 'Cluster Admin') {
      sql += ' AND cluster_id = ?';
      params.push(req.user.clusterId);
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, data: rows, sessionSubmissions: rows });
  } catch (error) {
    console.error('Failed to fetch session submissions:', error);
    res.status(503).json({ success: false, error: 'Unable to load data.' });
  }
});

app.put('/api/session-submissions/:id/review', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can review submissions.' });
    return;
  }
  
  const { action, remarks } = req.body;
  const status = action === 'approve' ? 'APPROVED' : action === 'resubmission' ? 'RESUBMISSION_REQUIRED' : null;

  if (!status) {
    res.status(400).json({ success: false, error: 'Invalid action.' });
    return;
  }

  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM session_submissions WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Submission not found.' });
      return;
    }
    const submission = rows[0];

    await pool.query('START TRANSACTION');

    if (status === 'APPROVED') {
      await pool.query('UPDATE session_submissions SET status = ?, reviewed_at = NOW(), review_remarks = ? WHERE id = ?', [status, remarks, req.params.id]);
      await pool.query('UPDATE sessions SET status = "Completed" WHERE id = ?', [submission.session_id]);
    } else {
      await pool.query('UPDATE session_submissions SET status = ?, resubmission_reason = ? WHERE id = ?', [status, remarks, req.params.id]);
    }

    await pool.query(
      'INSERT INTO notifications (id, title, message, type, is_read, created_at, user_id) VALUES (?, ?, ?, ?, 0, NOW(), ?)',
      [randomUUID(), `Submission ${status}`, `Session ${submission.session_id} submission was ${status}. Remarks: ${remarks}`, 'review', submission.submitted_by]
    );

    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, submission.cluster_id, `REVIEW_SUBMISSION_${status}`, 'SUBMISSIONS', req.params.id, remarks]
    );

    await pool.query('COMMIT');
    res.json({ success: true, status });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    console.error('Failed to review submission:', error);
    res.status(503).json({ success: false, error: 'Unable to process review.' });
  }
});

app.put('/api/session-submissions/:id/resubmit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Cluster Admin') {
    res.status(403).json({ success: false, error: 'Only Cluster Admin can resubmit sessions.' });
    return;
  }
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM session_submissions WHERE id = ? AND cluster_id = ?', [req.params.id, req.user.clusterId]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Submission not found.' });
      return;
    }
    const submission = rows[0];

    const [attRows] = await pool.query<any[]>('SELECT id FROM attendance_sessions WHERE session_id = ? AND day_number = ? AND status != "DRAFT"', [submission.session_id, submission.day_number]);
    const attendanceComplete = attRows.length > 0;
    const [lpRows] = await pool.query<any[]>('SELECT id FROM lesson_plans WHERE session_id = ?', [submission.session_id]);
    const lessonPlanComplete = lpRows.length > 0;
    const [photoRows] = await pool.query<any[]>('SELECT id FROM session_photos WHERE cluster_id = ? AND day_number = ?', [submission.cluster_id, submission.day_number]);
    const photosComplete = photoRows.length > 0;
    const [repRows] = await pool.query<any[]>('SELECT id FROM session_reports WHERE session_id = ?', [submission.session_id]);
    const reportComplete = repRows.length > 0;
    const [finRows] = await pool.query<any[]>('SELECT id FROM finance_entries WHERE cluster_id = ?', [submission.cluster_id]);
    const financeComplete = finRows.length > 0;

    const allComplete = attendanceComplete && lessonPlanComplete && photosComplete && reportComplete && financeComplete;

    if (!allComplete) {
      res.status(400).json({ success: false, error: 'Missing requirements for resubmission.' });
      return;
    }

    await pool.query('START TRANSACTION');

    await pool.query(
      'UPDATE session_submissions SET status = "RESUBMITTED", resubmitted_at = NOW(), attendance_complete=?, lesson_plan_complete=?, photos_complete=?, report_complete=?, finance_complete=? WHERE id = ?',
      [attendanceComplete, lessonPlanComplete, photosComplete, reportComplete, financeComplete, req.params.id]
    );

    await pool.query(
      'INSERT INTO notifications (id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [randomUUID(), 'Session Resubmitted', `Session ${submission.session_id} has been resubmitted.`, 'resubmission']
    );

    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, submission.cluster_id, 'RESUBMIT_SESSION', 'SUBMISSIONS', req.params.id, 'Resubmitted session']
    );

    await pool.query('COMMIT');
    res.json({ success: true, status: 'RESUBMITTED' });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    console.error('Failed to resubmit session:', error);
    res.status(503).json({ success: false, error: 'Unable to resubmit.' });
  }
});

// --- 4. Modules CRUD ---
app.post('/api/modules', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { moduleNumber, moduleName, topic, description, academicYear, dayNumber } = req.body;
    const id = `mod-${randomUUID()}`;

    await pool.query(
      'INSERT INTO modules (id, code, name, description, is_active, academic_year, day_number) VALUES (?, ?, ?, ?, 1, ?, ?)',
      [id, moduleNumber, moduleName || topic, description, academicYear, dayNumber]
    );

    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, 'CREATE_MODULE', 'MODULES', id, `Created module ${moduleName}`]
    );

    res.json({ success: true, module: { id } });
  } catch (error) {
    console.error('Failed to create module:', error);
    res.status(500).json({ success: false, error: 'Unable to create module.' });
  }
});

app.put('/api/modules/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { moduleNumber, moduleName, topic, description, academicYear, dayNumber } = req.body;
    await pool.query(
      'UPDATE modules SET code = ?, name = ?, description = ?, academic_year = ?, day_number = ? WHERE id = ?',
      [moduleNumber, moduleName || topic, description, academicYear, dayNumber, req.params.id]
    );

    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, 'UPDATE_MODULE', 'MODULES', req.params.id, `Updated module ${req.params.id}`]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update module:', error);
    res.status(500).json({ success: false, error: 'Unable to update module.' });
  }
});

app.delete('/api/modules/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM module_resources WHERE module_id = ?', [req.params.id]);
    const [result] = await pool.query<any>('DELETE FROM modules WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) {
      res.status(404).json({ success: false, error: 'Module not found.' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete module:', error);
    res.status(500).json({ success: false, error: 'Unable to delete module.' });
  }
});

const moduleUploadMiddleware = multer({ 
  storage: multer.diskStorage({ 
    destination: (req, file, cb) => { 
      const dir = path.join(UPLOADS_DIR, 'modules'); 
      fs.mkdirSync(dir, { recursive: true }); 
      cb(null, dir); 
    }, 
    filename: (req, file, cb) => cb(null, randomUUID() + path.extname(file.originalname)) 
  }) 
});

app.post('/api/modules/:id/resources', requireAuth, moduleUploadMiddleware.single('file'), async (req: AuthenticatedRequest & { file?: Express.Multer.File }, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded.' });
      return;
    }
    const resourceId = `res-${randomUUID()}`;
    const filePath = path.join(UPLOADS_DIR, 'modules', req.file.filename);
    const fileUrl = `/api/modules/${req.params.id}/resources/${resourceId}/download`;

    await pool.query(
      'INSERT INTO module_resources (id, module_id, file_path, file_url, original_filename, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [resourceId, req.params.id, filePath, fileUrl, req.file.originalname, req.file.mimetype, req.file.size]
    );

    res.json({
      success: true,
      resource: {
        id: resourceId,
        url: fileUrl,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
      },
    });
  } catch (error) {
    console.error('Failed to upload module resource:', error);
    res.status(500).json({ success: false, error: 'Unable to upload resource.' });
  }
});

app.get('/api/modules/:id/resources/:resourceId/download', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT file_path, original_filename FROM module_resources WHERE id = ?', [req.params.resourceId]);
    if (!rows.length || !fs.existsSync(rows[0].file_path)) {
      res.status(404).json({ success: false, error: 'Resource not found.' });
      return;
    }
    res.download(rows[0].file_path, rows[0].original_filename);
  } catch (error) {
    console.error('Failed to download module resource:', error);
    res.status(500).json({ success: false, error: 'Unable to download resource.' });
  }
});

app.delete('/api/modules/:id/resources/:resourceId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can delete module resources.' });
    return;
  }

  try {
    const [rows] = await pool.query<any[]>(
      'SELECT file_path FROM module_resources WHERE id = ? AND module_id = ? LIMIT 1',
      [req.params.resourceId, req.params.id]
    );
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Resource not found.' });
      return;
    }

    if (rows[0].file_path && fs.existsSync(rows[0].file_path)) {
      fs.unlinkSync(rows[0].file_path);
    }
    await pool.query('DELETE FROM module_resources WHERE id = ? AND module_id = ?', [req.params.resourceId, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete module resource:', error);
    res.status(500).json({ success: false, error: 'Unable to delete resource.' });
  }
});

// --- 5. Academic Years ---
app.get('/api/academic-years', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM academic_years ORDER BY start_date DESC');
    res.json({ success: true, data: rows, academicYears: rows });
  } catch (error) {
    console.error('Failed to fetch academic years:', error);
    res.status(503).json({ success: false, error: 'Unable to load data.' });
  }
});

app.post('/api/academic-years', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can manage academic years.' });
    return;
  }
  try {
    const { name, startDate, endDate, isActive } = req.body;
    if (!name || !startDate || !endDate || String(startDate) >= String(endDate)) {
      res.status(400).json({ success: false, error: 'Name, valid start date, and end date are required.' });
      return;
    }
    const id = `ay-${randomUUID()}`;

    await pool.query('START TRANSACTION');
    if (isActive) {
      await pool.query('UPDATE academic_years SET is_active = 0');
    }

    await pool.query(
      'INSERT INTO academic_years (id, name, start_date, end_date, is_active, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, startDate, endDate, Boolean(isActive), isActive ? 'ACTIVE' : 'DRAFT', req.user.id]
    );

    await pool.query('COMMIT');
    res.json({ success: true, data: { id } });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    console.error('Failed to create academic year:', error);
    res.status(500).json({ success: false, error: 'Unable to create.' });
  }
});

app.put('/api/academic-years/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can manage academic years.' });
    return;
  }
  try {
    const { name, startDate, endDate, isActive } = req.body;
    if (!name || !startDate || !endDate || String(startDate) >= String(endDate)) {
      res.status(400).json({ success: false, error: 'Name, valid start date, and end date are required.' });
      return;
    }

    await pool.query('START TRANSACTION');
    if (isActive) {
      await pool.query('UPDATE academic_years SET is_active = 0');
    }

    await pool.query(
      'UPDATE academic_years SET name = ?, start_date = ?, end_date = ?, is_active = ?, status = ? WHERE id = ?',
      [name, startDate, endDate, Boolean(isActive), isActive ? 'ACTIVE' : 'DRAFT', req.params.id]
    );

    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    console.error('Failed to update academic year:', error);
    res.status(500).json({ success: false, error: 'Unable to update.' });
  }
});

app.delete('/api/academic-years/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can manage academic years.' });
    return;
  }
  try {
    await pool.query('DELETE FROM academic_years WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete academic year:', error);
    res.status(500).json({ success: false, error: 'Unable to delete.' });
  }
});

app.get('/api/health', async (_req, res) => {
  const dbStatus = await getDatabaseStatus();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    port: PORT,
  });
});

app.use('/assets', express.static(path.join(PROJECT_ROOT, 'frontend', 'public', 'assets')));
app.use('/storage/uploads', express.static(UPLOADS_DIR));

const startServer = async () => {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    await initializeDatabase();
    await runSqlFiles();

    const dbStatus = await getDatabaseStatus();
    if (dbStatus === 'disconnected') {
      console.warn('[DB WARNING] MySQL connection test reported disconnected. Please check database service.');
    } else {
      console.log('[DB] MySQL connection active.');
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n==================================================`);
      console.log(`🚀 TQI Backend API running on http://localhost:${PORT}`);
      console.log(`   Health Check: http://localhost:${PORT}/api/health`);
      console.log(`==================================================\n`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
};

startServer();

