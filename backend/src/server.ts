import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { randomInt, randomUUID } from 'crypto';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import cors from 'cors';
import { sendLoginOtp, sendOnboardingCredentialsEmail } from './authMailer.js';
import * as archiverModule from 'archiver';
import { pool, getDatabaseStatus, initializeDatabase } from './db/connection.js';
import { initDatabaseSchema } from './db/init.js';

dotenv.config();
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


// DB historically stored a few legacy uppercase role aliases such as
// SUPER_ADMIN and CLUSTER_ADMIN. Normalize them to the canonical Title-Case
// values expected by the application, while still accepting legacy values at
// runtime.
const normalizeRole = (role: string | null | undefined): 'Super Admin' | 'Cluster Admin' => {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'super_admin' || normalized === 'super admin' || normalized === 'admin') return 'Super Admin';
  if (normalized === 'cluster_admin' || normalized === 'cluster admin') return 'Cluster Admin';
  return (normalized === 'super admin' || normalized === 'super_admin') ? 'Super Admin' : 'Cluster Admin';
};

const toDbRole = (role: string): 'Super Admin' | 'Cluster Admin' => normalizeRole(role);

const serializeUser = (row: any) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: normalizeRole(row.role),
  clusterId: row.cluster_id || 'all',
  clusterName: row.cluster_id ? `${row.cluster_id} Cluster` : 'All Clusters',
  phone: row.phone || '',
  status: row.status,
  mustChangePassword: Boolean(row.must_change_password),
});

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

    let hadFatalError = false;
    for (const statement of statements) {
      if (!statement) continue;
      try {
        await pool.query(statement);
      } catch (error: any) {
        if (!['ER_DUP_FIELDNAME', 'ER_TABLE_EXISTS_ERROR', 'ER_DUP_KEYNAME', 'ER_CANT_DROP_FIELD_OR_KEY', 'ER_KEY_COLUMN_DOES_NOT_EXITS', 'ER_DUP_ENTRY'].includes(error?.code)) {
          console.warn(`[DB MIGRATION WARNING] in ${file}:`, error.message);
          hadFatalError = true;
        }
      }
    }
    // Only record the migration as applied if every statement succeeded.
    // Otherwise leave the row out so a corrected file gets retried next boot.
    if (hadFatalError) {
      console.error(`[DB MIGRATION FAILED] ${file} — leaving unrecorded, will retry next start.`);
      continue;
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
  // Self-heal: some earlier deployments marked 212_academic_setup_session_date.sql
  // as applied even though the column was never created (the file used
  // PostgreSQL-only `IF NOT EXISTS` syntax). Adding the column here is idempotent
  // — ER_DUP_FIELDNAME (1060) is harmless — so a fresh start always leaves the
  // table in the expected shape regardless of migration history.
  await pool.query(
    `ALTER TABLE academic_setup ADD COLUMN session_date DATE NULL AFTER session_name`
  ).catch((error: any) => {
    if (error?.code !== 'ER_DUP_FIELDNAME') {
      console.warn('[DB] ensureAcademicSetupTable: failed to add session_date:', error.message);
    }
  });

  // Ensure clusters has college_district column
  await pool.query(
    `ALTER TABLE clusters ADD COLUMN college_district VARCHAR(255) NULL AFTER district`
  ).catch((error: any) => {
    if (error?.code !== 'ER_DUP_FIELDNAME') {
      console.warn('[DB] failed to add college_district to clusters:', error.message);
    }
  });

  // Ensure modules has academic_year and day_number columns
  await pool.query(
    `ALTER TABLE modules ADD COLUMN academic_year VARCHAR(50) NULL, ADD COLUMN day_number INT NULL`
  ).catch((error: any) => {
    if (error?.code !== 'ER_DUP_FIELDNAME') {
      console.warn('[DB] failed to add academic_year/day_number to modules:', error.message);
    }
  });
};

const buildWhereClause = (user: any, extra = '') => {
  if (!user || user.role !== 'Cluster Admin') return extra || '1=1';
  return `${extra ? `${extra} AND` : 'WHERE'} cluster_id = ?`;
};

const mapCluster = (row: any) => ({
  id: row.id,
  name: row.name,
  district: row.district || 'Tamil Nadu',
  collegeDistrict: row.college_district || row.district || 'Tamil Nadu',
  state: row.state || 'Tamil Nadu',
  code: row.code || row.id.toUpperCase(),
  activePanchayats: 0,
  totalStudents: 0,
  totalVolunteers: 0,
  adminId: row.admin_id || '',
  adminName: row.admin_name || '',
  adminEmail: row.admin_email || '',
  adminPhone: row.admin_phone || row.spoc_mobile || '',
  status: row.status,
  completedSessions: 0,
  totalSessions: 0,
  collegeName: row.college_name || '',
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
  college: '',
  department: row.department || 'Community Program',
  year: '2026',
  role: row.role || 'Mentor',
  clusterId: row.cluster_id,
  panchayatId: row.panchayat_id,
  panchayatName: row.panchayat_name || row.panchayat_id || '',
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
  name: row.session_name || row.name || `Day ${row.day_number || 1}`,
  title: row.session_name || row.name || `Day ${row.day_number || 1}`,
  moduleId: row.module_id || '',
  module: row.module_name || '',
  clusterId: row.cluster_id,
  clusterName: row.cluster_name || row.cluster_id,
  academicYear: row.academic_year || '',
  dayNumber: Number(row.day_number || 1),
  date: row.date ? new Date(row.date).toISOString().slice(0, 10) : '',
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

const parsePhotoType = (caption?: string, originalType?: string): 'session' | 'homework' | 'feedback' => {
  if (originalType === 'homework' || originalType === 'feedback' || originalType === 'session') {
    return originalType;
  }
  if (!caption) return 'session';
  const lower = caption.toLowerCase();
  if (lower.startsWith('[homework]') || lower.includes('#homework')) return 'homework';
  if (lower.startsWith('[feedback]') || lower.includes('#feedback')) return 'feedback';
  return 'session';
};

const mapSessionPhotoRow = (row: any, userName?: string): any => {
  const photoType = parsePhotoType(row.caption || row.original_filename, row.photo_type);
  return {
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
    caption: row.caption || row.original_filename || `Day ${row.day_number || 1} photo`,
    photoType,
  };
};

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

    // Security: only match by email. The legacy name/id fallback was a hole
    // (a Super Admin alias row with email='admin' made name-based login a
    // bypass).
    const [rows] = await pool.query<any[]>('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);

    if (!rows.length) {
      res.status(401).json({ success: false, error: 'Invalid credentials.' });
      return;
    }

    const user = rows[0];
    const rawStatus = user.status;
    const userStatus = String(rawStatus || '').trim().toLowerCase();

    console.log(`[AUTH LOGIN] Attempt for: ${email} | Found ID: ${user.id} | Status: "${rawStatus}" -> parsed: "${userStatus}"`);

    // Super Admin is never blocked by status. Other accounts only blocked if explicitly inactive.
    const isSuperAdmin = normalizeRole(user.role) === 'Super Admin';
    if (!isSuperAdmin && (userStatus === 'inactive' || userStatus === 'blocked' || userStatus === 'disabled')) {
      console.warn(`[AUTH LOGIN] Blocked inactive user: ${email}`);
      res.status(403).json({ success: false, error: 'This user account is inactive.' });
      return;
    }

    if (password) {
      const match = await bcrypt.compare(password, user.password_hash || '');
      console.log(`[AUTH LOGIN] Password comparison for ${email}: ${match ? 'SUCCESS' : 'FAILED'}`);
      if (!match) {
        res.status(401).json({ success: false, error: 'Invalid credentials.' });
        return;
      }
      const { token, user: serializedUser } = createAuthToken(user);
      res.json({ success: true, token, user: serializedUser, authenticationMethod: 'password', mustChangePassword: serializedUser.mustChangePassword });
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
    const { token, user: otpUser } = createAuthToken(rows[0]);
    res.json({ success: true, token, user: otpUser, authenticationMethod: 'otp', mustChangePassword: otpUser.mustChangePassword });
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
    const [rows] = await pool.query<any[]>(
      'SELECT id, name, code, description, is_active, academic_year, day_number, created_at FROM modules ORDER BY day_number ASC, code ASC, name ASC'
    );
    const [resRows] = await pool.query<any[]>(
      'SELECT id, module_id, file_path, file_url, original_filename, created_at FROM module_resources'
    ).catch(() => [[]]);

    const resourcesByModule: Record<string, any[]> = {};
    if (Array.isArray(resRows)) {
      resRows.forEach((r: any) => {
        if (!resourcesByModule[r.module_id]) resourcesByModule[r.module_id] = [];
        const ext = path.extname(r.original_filename || '').toUpperCase().replace('.', '');
        const fileType = ext === 'PPT' || ext === 'PPTX' ? 'PPT' : ext === 'PDF' ? 'PDF' : ext;
        resourcesByModule[r.module_id].push({
          id: r.id,
          moduleId: r.module_id,
          fileName: r.original_filename || 'resource.pptx',
          originalFileName: r.original_filename || 'resource.pptx',
          fileType,
          mimeType: ext === 'PPTX' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : ext === 'PPT' ? 'application/vnd.ms-powerpoint' : 'application/octet-stream',
          fileSize: 0,
          fileSizeFormatted: '',
          fileUrl: r.file_url || `/api/modules/${r.module_id}/resources/${r.id}/download`,
          isPrimaryPPT: ext === 'PPT' || ext === 'PPTX',
          storageProvider: 'local',
          uploadedAt: r.created_at || new Date().toISOString(),
        });
      });
    }

    res.json({
      success: true,
      modules: rows.map((row) => ({
        id: row.id,
        moduleNumber: row.code || row.id,
        moduleName: row.name,
        topic: row.name,
        academicYear: row.academic_year || '2026-2027',
        dayNumber: row.day_number || 1,
        dayLabel: `Day ${row.day_number || 1}`,
        description: row.description || '',
        status: row.is_active ? 'Active' : 'Archived',
        version: 1,
        resources: resourcesByModule[row.id] || [],
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
    const [rows] = await pool.query<any[]>('SELECT day_number, academic_year, session_name, session_date FROM academic_setup ORDER BY day_number ASC');
    res.json({ success: true, setup: rows.map((row: any) => ({
      day_number: row.day_number,
      academic_year: row.academic_year,
      session_name: row.session_name,
      session_date: row.session_date ? new Date(row.session_date).toISOString().slice(0, 10) : null,
    })) });
  } catch (error) {
    console.error('Failed to load academic setup:', error);
    res.status(503).json({ success: false, error: 'Unable to load academic setup.' });
  }
});

app.put('/api/academic-setup', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can edit academic setup.' });
    return;
  }

  const academicYear = String(req.body.academicYear || '').trim();
  const days = Array.isArray(req.body.days) ? req.body.days : [];
  if (!/^\d{4}-\d{4}$/.test(academicYear) ||
      days.length < 1 || days.length > 8 ||
      days.some((day: any) => !Number.isInteger(Number(day.dayNumber)) || Number(day.dayNumber) < 1 || Number(day.dayNumber) > 8)) {
    res.status(400).json({ success: false, error: 'Academic year or session days are invalid.' });
    return;
  }

  try {
    await ensureAcademicSetupTable();
    await pool.query('START TRANSACTION');
    // First, clear any previously stored day numbers that are no longer in the
    // submitted set (e.g. the Super Admin removed a day from the UI).
    const submittedDayNumbers = days.map((day: any) => Number(day.dayNumber));
    await pool.query(
      'DELETE FROM academic_setup WHERE day_number NOT IN (?)',
      [submittedDayNumbers],
    );

    for (const day of days) {
      // Accept dates in YYYY-MM-DD (HTML <input type="date">) or DD-MM-YY.
      const rawDate = day.sessionDate ? String(day.sessionDate).trim() : '';
      let isoDate: string | null = null;
      if (rawDate) {
        const ddmmyy = rawDate.match(/^(\d{2})-(\d{2})-(\d{2})$/);
        const ymd    = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (ddmmyy) {
          isoDate = `20${ddmmyy[3]}-${ddmmyy[2]}-${ddmmyy[1]}`;
        } else if (ymd) {
          isoDate = `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
        } else {
          await pool.query('ROLLBACK');
          res.status(400).json({ success: false, error: `Day ${day.dayNumber}: session date must be in DD-MM-YY format.` });
          return;
        }
      }
      await pool.query(
        'INSERT INTO academic_setup (day_number, academic_year, session_name, session_date) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE academic_year = VALUES(academic_year), session_name = VALUES(session_name), session_date = VALUES(session_date)',
        [Number(day.dayNumber), academicYear, String(day.sessionName || '').trim() || null, isoDate],
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
    let sql = 'SELECT * FROM session_photos WHERE 1=1';
    const params: any[] = [];

    if (req.user.role === 'Cluster Admin') {
      sql += ' AND cluster_id = ?';
      params.push(req.user.clusterId);
    } else if (cluster !== 'all') {
      sql += ' AND cluster_id = ?';
      params.push(cluster);
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

app.post('/api/session-photos/upload', requireAuth, photoUploadMiddleware.array('photos', 20), async (req: AuthenticatedRequest & { files?: Express.Multer.File[] }, res: Response) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      res.status(400).json({ success: false, error: 'No photos were selected to upload.' });
      return;
    }

    const clusterId = req.user.role === 'Cluster Admin' ? req.user.clusterId : String(req.body.clusterId || 'dharmapuri').toLowerCase();
    const sessionId = String(req.body.sessionId || `session-${Date.now()}`);
    const dayNumber = Number(req.body.dayNumber || 1);
    const uploadedBy = String(req.body.uploadedBy || req.user.name || 'Cluster Admin');
    const uploadedRole = String(req.body.uploadedRole || req.user.role || 'Cluster Admin');
    const sessionTitle = String(req.body.sessionTitle || `Session Day ${dayNumber}`);
    const uploaderName = uploadedBy || req.user.name || 'Cluster Admin';

    const photoType = String(req.body.photoType || 'session').toLowerCase();
    const rawCaption = String(req.body.caption || '').trim();
    // Prefix caption with category tag if not already prefixed so category is preserved across storage layers
    const finalCaption = rawCaption ? `[${photoType.toUpperCase()}] ${rawCaption}` : `[${photoType.toUpperCase()}] Day ${dayNumber} photo`;

    const savedPhotos: any[] = [];
    for (const file of files) {
      const rowId = randomUUID();
      const filePath = path.join(PHOTO_STORAGE_DIR, file.filename);
      const fileUrl = `/api/session-photos/file/${rowId}`;
      const originalName = file.originalname || 'photo.jpg';

      await pool.query(
        'INSERT INTO session_photos (id, cluster_id, session_id, day_number, file_path, file_url, original_filename, mime_type, file_size, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
        [rowId, clusterId, sessionId, dayNumber, filePath, fileUrl, originalName, file.mimetype, file.size, uploaderName],
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
        uploaded_at: new Date().toISOString(),
        caption: finalCaption,
        photo_type: photoType,
      }, req.user.name));
    }

    res.json({ success: true, message: `Uploaded ${savedPhotos.length} photo(s).`, photos: savedPhotos, sessionTitle });
  } catch (error) {
    console.error('Failed to upload session photos:', error);
    res.status(500).json({ success: false, error: 'Unable to upload session photos.' });
  }
});

app.get('/api/session-photos/file/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM session_photos WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Photo was not found.' });
      return;
    }

    const row = rows[0];
    const filePath = String(row.file_path || '');
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'The stored photo file is missing.' });
      return;
    }

    res.download(filePath, String(row.original_filename || 'photo.png'));
  } catch (error) {
    console.error('Failed to serve photo file:', error);
    res.status(500).json({ success: false, error: 'Unable to retrieve the photo.' });
  }
});

app.get('/api/session-photos/:id/download', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM session_photos WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Photo was not found.' });
      return;
    }

    const row = rows[0];
    const filePath = String(row.file_path || '');
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'The stored photo file is missing.' });
      return;
    }

    res.download(filePath, String(row.original_filename || 'photo.png'));
  } catch (error) {
    console.error('Failed to download photo:', error);
    res.status(500).json({ success: false, error: 'Unable to download the photo.' });
  }
});

app.get('/api/session-photos/download-zip', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const cluster = String(req.query.cluster || req.query.clusterId || 'all').toLowerCase();
    const dayNumber = req.query.dayNumber ? Number(req.query.dayNumber) : null;
    const type = String(req.query.type || 'filtered');

    let sql = 'SELECT * FROM session_photos WHERE 1=1';
    const params: any[] = [];

    if (req.user.role === 'Cluster Admin') {
      sql += ' AND cluster_id = ?';
      params.push(req.user.clusterId);
    } else if (cluster !== 'all') {
      sql += ' AND cluster_id = ?';
      params.push(cluster);
    }

    if (dayNumber && Number.isFinite(dayNumber)) {
      sql += ' AND day_number = ?';
      params.push(dayNumber);
    }

    sql += ' ORDER BY uploaded_at DESC';
    const [rows] = await pool.query<any[]>(sql, params);
    const files = rows.filter((row) => row.file_path && fs.existsSync(row.file_path));

    if (!files.length) {
      res.status(404).json({ success: false, error: 'No photos available to download.' });
      return;
    }

    const zipName = type === 'day' && dayNumber ? `TQI_Day_${dayNumber}_Photos.zip` : cluster === 'all' ? 'TQI_All_Cluster_Photos.zip' : `TQI_${cluster}_Photos.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => next(err));
    archive.pipe(res);

    files.forEach((row) => {
      const safeName = String(row.original_filename || `photo-${row.id}.png`);
      archive.file(row.file_path, { name: safeName });
    });

    await archive.finalize();
  } catch (error) {
    console.error('Failed to create ZIP archive:', error);
    res.status(500).json({ success: false, error: 'Unable to create the ZIP archive.' });
  }
});

app.delete('/api/session-photos/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM session_photos WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Photo was not found.' });
      return;
    }

    const row = rows[0];
    if (row.file_path && fs.existsSync(row.file_path)) {
      fs.unlinkSync(row.file_path);
    }

    await pool.query('DELETE FROM session_photos WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Photo deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete session photo:', error);
    res.status(500).json({ success: false, error: 'Unable to delete the photo.' });
  }
});

app.get('/api/approvals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let sql = 'SELECT * FROM approvals WHERE 1=1';
    const params: any[] = [];
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
      status: row.status,
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
    const actionName = action === 'approve' ? 'APPROVE' : action === 'reject' ? 'REJECT' : 'REQUEST_RESUBMISSION';
    const recordId = approval.record_id || approval.id;
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, 'Super Admin', approval.cluster_id || null, actionName, approval.module || 'Submission', recordId, remarks || `Status changed to ${status}`],
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
    let sql = "SELECT c.*, u.name AS admin_name, u.email AS admin_email, u.phone AS admin_phone FROM clusters c LEFT JOIN users u ON u.id = c.admin_id WHERE c.status = 'Active'";
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
  const district = String(req.body.district || req.body.clusterDistrict || 'Tamil Nadu').trim();
  const collegeDistrict = String(req.body.collegeDistrict || district).trim();
  const spocName = String(req.body.spocName || req.body.adminName || '').trim();
  const spocMobile = String(req.body.spocMobile || req.body.adminPhone || '').trim();
  const adminEmail = String(req.body.adminEmail || req.body.spocEmail || req.body.email || '').trim().toLowerCase();
  const adminName = String(req.body.adminName || spocName).trim();
  const name = String(req.body.name || `${collegeName} (${district})`).trim();
  const cleanIdPart = `${district}-${collegeName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const clusterId = String(req.body.id || cleanIdPart || `cluster-${Date.now()}`);
  const code = String(req.body.code || `TQI-${district.slice(0, 3).toUpperCase()}`).trim();
  const temporaryPassword = String(req.body.temporaryPassword || 'TQI@Admin2026').trim();

  if (!collegeName || !district || !spocName || !spocMobile || !adminEmail) {
    res.status(400).json({ success: false, error: 'College name, district, SPOC name, SPOC mobile, and login email are required.' });
    return;
  }

  // Validate 10-digit SPOC mobile
  const digitsOnly = spocMobile.replace(/\D/g, '');
  let finalMobile = digitsOnly;
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    finalMobile = digitsOnly.slice(2);
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    finalMobile = digitsOnly.slice(1);
  }

  if (finalMobile.length !== 10) {
    res.status(400).json({ success: false, error: 'SPOC mobile number must be exactly 10 digits.' });
    return;
  }

  // Validate email format
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(adminEmail)) {
    res.status(400).json({ success: false, error: 'Please enter a valid SPOC email address.' });
    return;
  }

  const normalizedPhone = `+91 ${finalMobile}`;
  const adminId = String(req.body.adminId || `usr-${randomUUID()}`);
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);
  try {
    await pool.query('START TRANSACTION');
    // Chicken-and-egg between clusters and users: each FK-references the other.
    //   clusters.admin_id   -> users.id   (fk_clusters_admin)
    //   users.cluster_id    -> clusters.id (fk_users_cluster)
    // Insert cluster first with admin_id = NULL, then user, then link the two.
    await pool.query(
      `INSERT INTO clusters (id, name, district, college_district, state, code, college_name, spoc_name, spoc_mobile, admin_id, status) VALUES (?, ?, ?, ?, 'Tamil Nadu', ?, ?, ?, ?, NULL, 'Active')`,
      [clusterId, name, district, collegeDistrict, code, collegeName, spocName, normalizedPhone],
    ).catch(async () => {
      // Fallback in case college_district column doesn't exist yet
      return pool.query(
        `INSERT INTO clusters (id, name, district, state, code, college_name, spoc_name, spoc_mobile, admin_id, status) VALUES (?, ?, ?, 'Tamil Nadu', ?, ?, ?, ?, NULL, 'Active')`,
        [clusterId, name, district, code, collegeName, spocName, normalizedPhone],
      );
    });
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, cluster_id, phone, must_change_password, status) VALUES (?, ?, ?, ?, 'Cluster Admin', ?, ?, TRUE, 'Active')`,
      [adminId, adminName, adminEmail, passwordHash, clusterId, normalizedPhone],
    );
    await pool.query(
      `UPDATE clusters SET admin_id = ? WHERE id = ?`,
      [adminId, clusterId],
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

    // Asynchronously dispatch welcome / onboarding email with temporary password
    sendOnboardingCredentialsEmail({
      recipient: adminEmail,
      name: adminName,
      temporaryPassword,
      role: 'Cluster Admin',
      clusterName: name,
      projectRoot: PROJECT_ROOT,
    }).catch((err) => console.error('[ONBOARDING EMAIL ERROR]:', err));

    res.status(201).json({
      success: true,
      temporaryPassword,
      cluster: mapCluster({ id: clusterId, name, district, college_district: collegeDistrict, state: 'Tamil Nadu', code, college_name: collegeName, spoc_name: spocName, spoc_mobile: normalizedPhone, admin_id: adminId, admin_name: adminName, admin_email: adminEmail, admin_phone: normalizedPhone, status: 'Active' }),
      user: serializeUser({ id: adminId, name: adminName, email: adminEmail, role: 'Cluster Admin', cluster_id: clusterId, phone: normalizedPhone, status: 'Active', must_change_password: true }),
    });
  } catch (error: any) {
    await pool.query('ROLLBACK').catch(() => undefined);
    console.error('[CREATE_CLUSTER ERROR]', error?.code, error?.message);
    const code = error?.code;
    let status = 503;
    let message = 'Unable to create cluster.';
    if (code === 'ER_DUP_ENTRY') {
      status = 409;
      message = 'A cluster with this ID or an admin with this email already exists in the system.';
    } else if (code === 'ER_NO_REFERENCED_ROW' || code === 'ER_NO_REFERENCED_ROW_2') {
      status = 400;
      message = 'Referenced cluster or admin is invalid. Please refresh and try again.';
    } else if (code === 'ER_BAD_NULL_ERROR') {
      status = 400;
      message = 'A required field is missing. Please check the form and try again.';
    }
    res.status(status).json({ success: false, error: message });
  }
});

app.get('/api/panchayats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    const user = req.user;
    let sql = 'SELECT p.id, p.name, p.cluster_id, c.name AS cluster_name, COUNT(v.id) AS villages_count FROM panchayats p LEFT JOIN villages v ON v.panchayat_id = p.id LEFT JOIN clusters c ON c.id = p.cluster_id';
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
    sql += ' GROUP BY p.id, p.name, p.cluster_id, c.name ORDER BY p.name ASC';

    const [rows] = await pool.query<any[]>(sql, params);
    
    // Eager-load villages for these panchayats
    const panchayatIds = rows.map(r => r.id);
    let villagesByPanchayat: Record<string, any[]> = {};
    if (panchayatIds.length > 0) {
      const [vRows] = await pool.query<any[]>(
        'SELECT v.id, v.name, v.panchayat_id, COUNT(s.id) AS student_count FROM villages v LEFT JOIN students s ON s.village_id = v.id WHERE v.panchayat_id IN (?) GROUP BY v.id, v.name, v.panchayat_id ORDER BY v.name ASC',
        [panchayatIds]
      );
      vRows.forEach((v) => {
        if (!villagesByPanchayat[v.panchayat_id]) villagesByPanchayat[v.panchayat_id] = [];
        villagesByPanchayat[v.panchayat_id].push({
          id: v.id,
          name: v.name,
          studentCount: Number(v.student_count || 0),
        });
      });
    }

    res.json({ success: true, panchayats: rows.map((row) => {
      const vList = villagesByPanchayat[row.id] || [];
      return {
        id: row.id,
        name: row.name,
        cluster: row.cluster_name || row.cluster_id,
        clusterId: row.cluster_id,
        villagesCount: vList.length || Number(row.villages_count || 0),
        activeStudents: vList.reduce((sum, v) => sum + v.studentCount, 0),
        volunteersCount: 0,
        status: 'On Track',
        villages: vList,
      };
    }) });
  } catch (error) {
    console.error('Failed to load panchayats:', error);
    res.status(503).json({ success: false, error: 'Unable to load data. Please try again.' });
  }
});

app.post('/api/panchayats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let clusterId = req.user.role === 'Cluster Admin' ? req.user.clusterId : String(req.body.clusterId || req.body.cluster || '');
    if (!clusterId || clusterId === 'all') {
      const [clusterRows] = await pool.query<any[]>('SELECT id FROM clusters ORDER BY created_at ASC LIMIT 1');
      clusterId = clusterRows[0]?.id || 'dharmapuri-ksr';
    }
    const panchayatId = String(req.body.id || req.body.name || `panchayat-${Date.now()}`).trim().toLowerCase().replace(/\s+/g, '-');
    const name = String(req.body.name || 'New Panchayat').trim();

    await pool.query(
      'INSERT INTO panchayats (id, name, cluster_id, status) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), cluster_id = VALUES(cluster_id), status = VALUES(status)',
      [panchayatId, name, clusterId, 'Active']
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
    let clusterId = req.user.role === 'Cluster Admin' ? req.user.clusterId : String(req.body.clusterId || '');
    if (!clusterId || clusterId === 'all') {
      const [clusterRows] = await pool.query<any[]>('SELECT id FROM clusters ORDER BY created_at ASC LIMIT 1');
      clusterId = clusterRows[0]?.id || 'dharmapuri-ksr';
    }
    const id = String(req.body.id || `student-${Date.now()}`).trim();
    const name = String(req.body.name || 'New Student').trim();
    const rawPanchayatId = req.body.panchayatId ? String(req.body.panchayatId).trim() : null;
    const panchayatId = rawPanchayatId && rawPanchayatId !== 'all' ? rawPanchayatId : null;
    const rawVillageId = req.body.villageId ? String(req.body.villageId).trim() : null;
    const villageId = rawVillageId && rawVillageId !== 'all' ? rawVillageId : null;

    await pool.query(
      `INSERT INTO students (id, code, name, gender, dob, standard, cluster_id, panchayat_id, village_id, parent_name, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE code = VALUES(code), name = VALUES(name), gender = VALUES(gender), dob = VALUES(dob), standard = VALUES(standard), cluster_id = VALUES(cluster_id), panchayat_id = VALUES(panchayat_id), village_id = VALUES(village_id), parent_name = VALUES(parent_name), phone = VALUES(phone), status = VALUES(status)`,
      [id, String(req.body.code || id), name, String(req.body.gender || 'female'), String(req.body.dob || '2014-01-01'), String(req.body.standard || '6th Standard'), clusterId, panchayatId, villageId, String(req.body.parentName || 'Parent'), String(req.body.phone || ''), String(req.body.status || 'Active')]
    );

    res.json({ success: true, student: { id, code: String(req.body.code || id), name, gender: req.body.gender || 'female', dob: req.body.dob || '2014-01-01', standard: req.body.standard || '6th Standard', clusterId, panchayatId: panchayatId || '', panchayatName: req.body.panchayatName || panchayatId || '', villageId: villageId || '', villageName: req.body.villageName || villageId || '', parentName: req.body.parentName || 'Parent', phone: req.body.phone || '', status: req.body.status || 'active' } });
  } catch (error) {
    console.error('Failed to create student:', error);
    res.status(500).json({ success: false, error: 'Unable to save student.' });
  }
});

app.get('/api/volunteers', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    let sql = `SELECT v.id, v.name, v.email, v.phone, v.department, v.cluster_id, v.panchayat_id, p.name AS panchayat_name, v.role, v.status FROM volunteers v LEFT JOIN panchayats p ON p.id = v.panchayat_id WHERE 1=1`;
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
    let clusterId = req.user.role === 'Cluster Admin' ? req.user.clusterId : String(req.body.clusterId || '');
    if (!clusterId || clusterId === 'all') {
      const [clusterRows] = await pool.query<any[]>('SELECT id FROM clusters ORDER BY created_at ASC LIMIT 1');
      clusterId = clusterRows[0]?.id || 'dharmapuri-ksr';
    }
    const id = String(req.body.id || `volunteer-${Date.now()}`).trim();
    const rawPanchayatId = req.body.panchayatId ? String(req.body.panchayatId).trim() : null;
    const panchayatId = rawPanchayatId && rawPanchayatId !== 'all' ? rawPanchayatId : null;

    await pool.query(
      'INSERT INTO volunteers (id, name, email, phone, cluster_id, panchayat_id, department, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), phone = VALUES(phone), cluster_id = VALUES(cluster_id), panchayat_id = VALUES(panchayat_id), department = VALUES(department), role = VALUES(role), status = VALUES(status)',
      [id, String(req.body.name || 'Volunteer').trim(), String(req.body.email || ''), String(req.body.phone || ''), clusterId, panchayatId, String(req.body.department || 'Community Program'), String(req.body.role || 'Mentor'), String(req.body.status || 'Active')]
    );
    res.json({ success: true, volunteer: { id, name: req.body.name || 'Volunteer', email: req.body.email || '', phone: req.body.phone || '', clusterId, panchayatId: panchayatId || '', department: req.body.department || 'Community Program', role: req.body.role || 'Mentor', status: req.body.status || 'Active' } });
  } catch (error) {
    console.error('Failed to save volunteer:', error);
    res.status(500).json({ success: false, error: 'Unable to save volunteer.' });
  }
});

app.get('/api/sessions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await ensureAcademicSetupTable();
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    // v2 sessions table dropped day_number; the per-day session is identified
    // by id = 'academic-session-<cluster_id>-<day_number>' (set by PUT /api/sessions/:id).
    let sql = `
      SELECT
        CONCAT('academic-session-', c.id, '-', a.day_number) AS id,
        CONCAT('DAY-', a.day_number) AS code,
        a.academic_year,
        a.day_number,
        a.session_name,
        c.id AS cluster_id,
        c.name AS cluster_name,
        s.date,
        s.time,
        s.panchayat_id,
        s.village_id,
        s.volunteer_id,
        COALESCE(s.session_status, 'Draft') AS session_status,
        NULL AS module_id
      FROM academic_setup a
      CROSS JOIN clusters c
      LEFT JOIN sessions s
        ON s.id = CONCAT('academic-session-', c.id, '-', a.day_number)
      WHERE a.session_name IS NOT NULL AND TRIM(a.session_name) <> ''`;
    const params: any[] = [];

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

    sql += ' ORDER BY c.name ASC, a.day_number ASC';
    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, sessions: rows.map(mapSession) });
  } catch (error) {
    console.error('Failed to load sessions:', error);
    res.status(503).json({ success: false, error: 'Unable to load data. Please try again.' });
  }
});

app.post('/api/sessions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let clusterId = req.user.role === 'Cluster Admin' ? req.user.clusterId : String(req.body.clusterId || '');
    if (!clusterId || clusterId === 'all') {
      const [clusterRows] = await pool.query<any[]>('SELECT id FROM clusters ORDER BY created_at ASC LIMIT 1');
      clusterId = clusterRows[0]?.id || 'dharmapuri-ksr';
    }
    const id = String(req.body.id || `session-${Date.now()}`).trim();
    const date = String(req.body.date || new Date().toISOString().split('T')[0]);
    const rawPanchayatId = req.body.panchayatId ? String(req.body.panchayatId).trim() : null;
    const panchayatId = rawPanchayatId && rawPanchayatId !== 'all' ? rawPanchayatId : null;
    const rawVillageId = req.body.villageId ? String(req.body.villageId).trim() : null;
    const villageId = rawVillageId && rawVillageId !== 'all' ? rawVillageId : null;
    const rawVolunteerId = req.body.volunteerId ? String(req.body.volunteerId).trim() : null;
    const volunteerId = rawVolunteerId && rawVolunteerId !== 'all' ? rawVolunteerId : null;

    await pool.query(
      'INSERT INTO sessions (id, code, name, module_id, cluster_id, panchayat_id, village_id, volunteer_id, date, time, session_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE code = VALUES(code), name = VALUES(name), module_id = VALUES(module_id), cluster_id = VALUES(cluster_id), panchayat_id = VALUES(panchayat_id), village_id = VALUES(village_id), volunteer_id = VALUES(volunteer_id), date = VALUES(date), time = VALUES(time), session_status = VALUES(session_status)',
      [id, String(req.body.code || id), String(req.body.name || 'Session').trim(), String(req.body.moduleId || 'module-english'), clusterId, panchayatId, villageId, volunteerId, date, String(req.body.time || '09:00'), String(req.body.status || 'Draft')]
    );

    res.json({ success: true, session: { id, code: String(req.body.code || id), name: req.body.name || 'Session', clusterId, panchayatId: panchayatId || '', villageId: villageId || '', date, time: req.body.time || '09:00', status: req.body.status || 'Draft' } });
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

  const dayNumber = Number(req.body.dayNumber);
  const academicYear = String(req.body.academicYear || '').trim();
  const sessionName = String(req.body.sessionName || '').trim();
  const date = req.body.date ? String(req.body.date).trim() : null;
  const requestedStatus = String(req.body.status || '').trim();
  const status = requestedStatus === 'Completed'
    ? 'Completed'
    : date
      ? 'Scheduled'
      : 'Draft';

  if (!academicYear || !Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 8 || !sessionName) {
    res.status(400).json({ success: false, error: 'Academic year, programme day, and session name are required.' });
    return;
  }
  if (status === 'Completed' && !date) {
    res.status(400).json({ success: false, error: 'A session date is required before completion.' });
    return;
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ success: false, error: 'Session date is invalid.' });
    return;
  }

  try {
    const id = `academic-session-${req.user.clusterId}-${dayNumber}`;
    // v2 sessions: only snake_case columns; title/academic_year/day_number/
    // session_name_snapshot/status were dropped. The session name lives in
    // academic_setup.session_name (joined on the read path).
    await pool.query(
      `INSERT INTO sessions (id, name, cluster_id, panchayat_id, village_id, volunteer_id, date, session_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), cluster_id = VALUES(cluster_id), panchayat_id = VALUES(panchayat_id), village_id = VALUES(village_id), volunteer_id = VALUES(volunteer_id), date = VALUES(date), session_status = VALUES(session_status)`,
      [
        id,
        sessionName,
        req.user.clusterId,
        req.body.panchayatId ? String(req.body.panchayatId) : null,
        req.body.villageId ? String(req.body.villageId) : null,
        req.body.volunteerId ? String(req.body.volunteerId) : null,
        date,
        status,
      ],
    );
    res.json({ success: true, status, date });
  } catch (error) {
    console.error('Failed to update session schedule:', error);
    res.status(503).json({ success: false, error: 'Unable to save session schedule.' });
  }
});

app.get('/api/attendance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    let sql = 'SELECT * FROM attendance_sessions WHERE 1=1';
    const params: any[] = [];

    if (req.user.role === 'Cluster Admin') {
      sql += ' AND cluster_id = ?';
      params.push(req.user.clusterId);
    } else if (cluster !== 'all') {
      sql += ' AND cluster_id = ?';
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
      absentCount: Math.max(0, Number(row.total_count || 0) - Number(row.present_count || 0)),
      records: [],
      volunteerAttendance: [],
    })) });
  } catch (error) {
    console.error('Failed to load attendance:', error);
    res.status(503).json({ success: false, error: 'Unable to load data. Please try again.' });
  }
});

app.post('/api/attendance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== 'Cluster Admin') {
      res.status(403).json({ success: false, error: 'Only Cluster Admin can submit attendance.' });
      return;
    }
    const clusterId = req.user.clusterId;
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
    const requestedStatus = String(req.body.status || 'Draft');
    const status = requestedStatus === 'Submitted' || requestedStatus === 'SUBMITTED' ? 'Submitted' : 'Draft';

    await pool.query('START TRANSACTION');

    await pool.query(
      'INSERT INTO attendance_sessions (id, session_id, cluster_id, panchayat_id, village_id, day_number, status, present_count, total_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE session_id = VALUES(session_id), cluster_id = VALUES(cluster_id), panchayat_id = VALUES(panchayat_id), village_id = VALUES(village_id), day_number = VALUES(day_number), status = VALUES(status), present_count = VALUES(present_count), total_count = VALUES(total_count)',
      [id, String(req.body.sessionId || id), clusterId, String(req.body.panchayatId || ''), String(req.body.villageId || ''), Number(req.body.dayNumber || 1), status, presentCount, totalCount]
    );

    if (Array.isArray(req.body.records)) {
      await pool.query('DELETE FROM student_attendance WHERE attendance_session_id = ?', [id]);
      for (const record of req.body.records) {
        await pool.query(
          'INSERT INTO student_attendance (id, attendance_session_id, student_id, present, task_status) VALUES (?, ?, ?, ?, ?)',
          [randomUUID(), id, record.studentId, Boolean(record.present), String(record.taskStatus || 'Completed')]
        );
      }
    }

    if (Array.isArray(req.body.volunteerAttendance)) {
      await pool.query('DELETE FROM volunteer_attendance WHERE attendance_session_id = ?', [id]);
      for (const record of req.body.volunteerAttendance) {
        await pool.query(
          'INSERT INTO volunteer_attendance (id, attendance_session_id, volunteer_id, present) VALUES (?, ?, ?, ?)',
          [randomUUID(), id, record.volunteerId, Boolean(record.present)]
        );
      }
    }

    if (status === 'Submitted') {
      // v2 approvals: only snake_case columns; type/reference/requestedBy/
      // sessionId/clusterId were dropped. module is set to 'Attendance' for
      // this audit trail.
      await pool.query(
        `INSERT INTO approvals (id, module, status, requested_by, session_id, cluster_id, date)
         SELECT ?, ?, ?, ?, ?, ?, CURDATE()
         WHERE NOT EXISTS (SELECT 1 FROM approvals WHERE session_id = ? AND status IN ('Open', 'Pending'))`,
        [randomUUID(), 'Attendance', 'Pending', req.user.id, sessionId, clusterId, sessionId],
      );
    }

    await pool.query('COMMIT');

    res.json({ success: true, attendanceSession: { id, sessionId: req.body.sessionId || id, clusterId, panchayatId: req.body.panchayatId || '', villageId: req.body.villageId || '', dayNumber: Number(req.body.dayNumber || 1), status: status === 'Submitted' ? 'Submitted' : 'Draft', presentCount, totalCount } });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    console.error('Failed to save attendance:', error);
    res.status(500).json({ success: false, error: 'Unable to save attendance.' });
  }
});

app.get('/api/lesson-plans', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    let sql = 'SELECT * FROM lesson_plans WHERE 1=1';
    const params: any[] = [];

    if (req.user.role === 'Cluster Admin') {
      sql += ' AND cluster_id = ?';
      params.push(req.user.clusterId);
    } else if (cluster !== 'all') {
      sql += ' AND cluster_id = ?';
      params.push(cluster);
    }

    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query<any[]>(sql, params);
    
    const lessonPlans = rows.map((row) => {
      let extraMeta: any = {};
      try {
        if (row.remarks && row.remarks.startsWith('{')) {
          extraMeta = JSON.parse(row.remarks);
        }
      } catch {
        extraMeta = {};
      }

      let parsedActivities: any = null;
      try {
        if (row.activities && (row.activities.startsWith('[') || row.activities.startsWith('{'))) {
          parsedActivities = JSON.parse(row.activities);
        }
      } catch {
        parsedActivities = null;
      }

      return {
        id: row.id,
        sessionId: row.session_id,
        moduleId: row.module_id,
        clusterId: row.cluster_id,
        cluster: row.cluster_id ? row.cluster_id.charAt(0).toUpperCase() + row.cluster_id.slice(1) : 'Dharmapuri',
        panchayatId: row.panchayat_id,
        panchayatName: extraMeta.panchayatName || '',
        villageName: extraMeta.villageName || '',
        villagesList: extraMeta.villagesList || (extraMeta.villageName ? [extraMeta.villageName] : []),
        teamCollegeName: extraMeta.teamCollegeName || 'K.S.Rangasamy College of Technology',
        summitNumbers: extraMeta.summitNumbers || 'I, III',
        dayNumber: row.day_number || extraMeta.dayNumber || 7,
        grades: row.target_standard || extraMeta.grades || 'IX, XI',
        targetStandard: row.target_standard || extraMeta.grades || 'IX, XI',
        date: extraMeta.date || (row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : ''),
        academicYear: extraMeta.academicYear || '2025 – 2026',
        title: row.title,
        topic: row.topic || row.title,
        objective: row.objective || '',
        overview: extraMeta.overview || row.objective || '',
        gradeSegments: extraMeta.gradeSegments || [],
        activitiesDetailed: extraMeta.activitiesDetailed || (Array.isArray(parsedActivities) ? parsedActivities : []),
        expectedOutcome: row.learning_outcomes || extraMeta.expectedOutcome || '',
        learningOutcomes: extraMeta.learningOutcomes || (row.learning_outcomes ? [row.learning_outcomes] : []),
        assignedVolunteers: extraMeta.assignedVolunteers || [],
        volunteerName: extraMeta.volunteerName || (extraMeta.assignedVolunteers?.[0] || ''),
        teachingMethod: row.teaching_method || '',
        assessmentTask: row.assessment_task || '',
        materials: row.materials || '',
        duration: row.duration || '90 Mins',
        status: row.status || 'Draft',
        createdBy: row.created_by,
        correctionReason: extraMeta.correctionReason,
        correctionRequestedBy: extraMeta.correctionRequestedBy,
        correctionDate: extraMeta.correctionDate
      };
    });

    res.json({ success: true, lessonPlans });
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

    const extraMeta = {
      teamCollegeName: req.body.teamCollegeName || 'K.S.Rangasamy College of Technology',
      summitNumbers: req.body.summitNumbers || 'I, III',
      dayNumber: req.body.dayNumber || 7,
      grades: req.body.grades || req.body.targetStandard || 'IX, XI',
      date: req.body.date || new Date().toISOString().split('T')[0],
      academicYear: req.body.academicYear || '2025 – 2026',
      panchayatName: req.body.panchayatName || '',
      villageName: req.body.villageName || '',
      villagesList: req.body.villagesList || [],
      assignedVolunteers: req.body.assignedVolunteers || [],
      volunteerName: req.body.volunteerName || (req.body.assignedVolunteers?.[0] || ''),
      overview: req.body.overview || req.body.objective || '',
      gradeSegments: req.body.gradeSegments || [],
      activitiesDetailed: req.body.activitiesDetailed || [],
      expectedOutcome: req.body.expectedOutcome || req.body.learningOutcomes || '',
      correctionReason: req.body.correctionReason,
      correctionRequestedBy: req.body.correctionRequestedBy,
      correctionDate: req.body.correctionDate
    };

    const statusVal = ['Draft', 'Submitted', 'Approved', 'Rejected'].includes(req.body.status) 
      ? req.body.status 
      : (req.body.status === 'Correction Requested' ? 'Rejected' : 'Draft');

    let finalModuleId: string | null = req.body.moduleId ? String(req.body.moduleId) : null;
    if (finalModuleId) {
      const [modCheck] = await pool.query<any[]>('SELECT id FROM modules WHERE id = ? LIMIT 1', [finalModuleId]);
      if (!modCheck.length) {
        finalModuleId = null;
      }
    }

    await pool.query(
      `INSERT INTO lesson_plans (id, session_id, module_id, cluster_id, panchayat_id, title, topic, objective, activities, materials, duration, remarks, teaching_method, assessment_task, target_standard, learning_outcomes, day_number, volunteer_id, status, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE session_id = VALUES(session_id), module_id = VALUES(module_id), cluster_id = VALUES(cluster_id), panchayat_id = VALUES(panchayat_id), title = VALUES(title), topic = VALUES(topic), objective = VALUES(objective), activities = VALUES(activities), materials = VALUES(materials), duration = VALUES(duration), remarks = VALUES(remarks), teaching_method = VALUES(teaching_method), assessment_task = VALUES(assessment_task), target_standard = VALUES(target_standard), learning_outcomes = VALUES(learning_outcomes), day_number = VALUES(day_number), volunteer_id = VALUES(volunteer_id), status = VALUES(status), created_by = VALUES(created_by)`,
      [
        id, String(req.body.sessionId || ''), finalModuleId, clusterId, String(req.body.panchayatId || ''), String(req.body.title || req.body.topic || 'Lesson Plan').trim(),
        req.body.topic ? String(req.body.topic) : null,
        req.body.objective || req.body.overview ? String(req.body.objective || req.body.overview) : null,
        req.body.activitiesDetailed ? JSON.stringify(req.body.activitiesDetailed) : (req.body.activities ? String(req.body.activities) : null),
        req.body.materials ? (typeof req.body.materials === 'string' ? req.body.materials : JSON.stringify(req.body.materials)) : null,
        req.body.duration ? String(req.body.duration) : null,
        JSON.stringify(extraMeta),
        req.body.teachingMethod ? String(req.body.teachingMethod) : null,
        req.body.assessmentTask ? String(req.body.assessmentTask) : null,
        req.body.grades || req.body.targetStandard ? String(req.body.grades || req.body.targetStandard) : null,
        req.body.expectedOutcome || req.body.learningOutcomes ? (typeof req.body.expectedOutcome === 'string' ? req.body.expectedOutcome : JSON.stringify(req.body.expectedOutcome || req.body.learningOutcomes)) : null,
        req.body.dayNumber ? Number(req.body.dayNumber) : 7,
        req.body.volunteerId ? String(req.body.volunteerId) : null,
        statusVal,
        String(req.user.id)
      ]
    );

    res.json({ success: true, lessonPlan: { id, title: req.body.title || req.body.topic || 'Lesson Plan', clusterId, status: req.body.status || 'Draft', ...extraMeta } });
  } catch (error) {
    console.error('Failed to save lesson plan:', error);
    res.status(500).json({ success: false, error: 'Unable to save lesson plan.' });
  }
});

app.get('/api/finance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    let sql = 'SELECT * FROM finance_entries WHERE 1=1';
    const params: any[] = [];

    if (req.user.role === 'Cluster Admin') {
      sql += ' AND cluster_id = ?';
      params.push(req.user.clusterId);
    } else if (cluster !== 'all') {
      sql += ' AND cluster_id = ?';
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
    let clusterId = req.user.role === 'Cluster Admin' ? req.user.clusterId : String(req.body.clusterId || '');
    if (!clusterId || clusterId === 'all') {
      const [clusterRows] = await pool.query<any[]>('SELECT id FROM clusters ORDER BY created_at ASC LIMIT 1');
      clusterId = clusterRows[0]?.id || 'dharmapuri-ksr';
    }
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

    await pool.query(
      'INSERT INTO finance_entries (id, cluster_id, date, description, category, amount, created_by, status, bill_reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE cluster_id = VALUES(cluster_id), date = VALUES(date), description = VALUES(description), category = VALUES(category), amount = VALUES(amount), created_by = VALUES(created_by), status = VALUES(status), bill_reference = VALUES(bill_reference)',
      [id, clusterId, date, String(req.body.description || 'Finance Entry').trim(), String(req.body.category || 'General'), amount, String(req.user.id), String(req.body.status || 'Draft'), String(req.body.billReference || '')]
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
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can access user management.' });
    return;
  }
  try {
    const params: any[] = [];
    let sql = "SELECT * FROM users WHERE status = 'Active'";
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
  const role = req.body.role === 'Super Admin' ? 'Super Admin' : 'Cluster Admin';
  const clusterId = role === 'Cluster Admin' ? (String(req.body.clusterId || '').trim() || null) : null;
  const temporaryPassword = String(req.body.temporaryPassword || `TQI@Admin${randomInt(1000, 9999)}`).trim();

  if (!name || !email) {
    res.status(400).json({ success: false, error: 'Name and email are required.' });
    return;
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    return;
  }

  let formattedPhone = phone;
  if (phone) {
    const digitsOnly = phone.replace(/\D/g, '');
    let finalDigits = digitsOnly;
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
      finalDigits = digitsOnly.slice(2);
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
      finalDigits = digitsOnly.slice(1);
    }
    if (finalDigits.length !== 10) {
      res.status(400).json({ success: false, error: 'Phone number must be exactly 10 digits.' });
      return;
    }
    formattedPhone = `+91 ${finalDigits}`;
  }

  if (role === 'Cluster Admin' && !clusterId) {
    res.status(400).json({ success: false, error: 'Please select a cluster for the Cluster Admin role.' });
    return;
  }

  const userId = String(req.body.id || `usr-${randomUUID()}`);
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  try {
    await pool.query('START TRANSACTION');
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, cluster_id, phone, must_change_password, status) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, 'Active')`,
      [userId, name, email, passwordHash, role, clusterId, formattedPhone],
    );

    if (clusterId && role === 'Cluster Admin') {
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
        `Created ${role === 'Super Admin' ? 'Super Admin' : 'Cluster Admin'} user ${name} (${email})`,
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

    const [createdRows] = await pool.query<any[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);

    res.status(201).json({
      success: true,
      temporaryPassword,
      user: serializeUser(createdRows[0] || { id: userId, name, email, role, cluster_id: clusterId, phone: formattedPhone, status: 'Active', must_change_password: true }),
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
  const role = req.body.role === 'Super Admin' ? 'Super Admin' : 'Cluster Admin';
  const clusterId = role === 'Cluster Admin' ? String(req.body.clusterId || '').trim() || null : null;
  if (!name || !email) { res.status(400).json({ success: false, error: 'Name and email are required.' }); return; }
  
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    return;
  }

  let formattedPhone = phone;
  if (phone) {
    const digitsOnly = phone.replace(/\D/g, '');
    let finalDigits = digitsOnly;
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
      finalDigits = digitsOnly.slice(2);
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
      finalDigits = digitsOnly.slice(1);
    }
    if (finalDigits.length !== 10) {
      res.status(400).json({ success: false, error: 'Phone number must be exactly 10 digits.' });
      return;
    }
    formattedPhone = `+91 ${finalDigits}`;
  }

  try {
    await pool.query('UPDATE users SET name = ?, email = ?, phone = ?, role = ?, cluster_id = ? WHERE id = ?', [name, email, formattedPhone, role, clusterId, req.params.id]);
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
    await pool.query('START TRANSACTION');
    await pool.query('UPDATE clusters SET admin_id = NULL WHERE admin_id = ?', [req.params.id]);
    await pool.query('DELETE FROM notifications WHERE user_id = ?', [req.params.id]);
    await pool.query('UPDATE audit_logs SET user_id = NULL WHERE user_id = ?', [req.params.id]);
    const [result] = await pool.query<any>('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) {
      await pool.query('ROLLBACK');
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }
    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    await pool.query('ROLLBACK').catch(() => undefined);
    // If foreign key constraint blocks deletion due to historical records, fallback to Inactive status
    if (error?.code === 'ER_ROW_IS_REFERENCED_2' || error?.code === 'ER_ROW_IS_REFERENCED') {
      try {
        await pool.query("UPDATE users SET status = 'Inactive' WHERE id = ?", [req.params.id]);
        res.json({ success: true, message: 'User marked inactive due to linked records.' });
        return;
      } catch (err) {
        // pass
      }
    }
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
  const { name, college_name, spoc_name, spoc_mobile, district, state } = req.body;
  try {
    const [result] = await pool.query<any>(
      'UPDATE clusters SET name = ?, college_name = ?, spoc_name = ?, spoc_mobile = ?, district = ?, state = ? WHERE id = ?',
      [name, college_name, spoc_name, spoc_mobile, district, state, req.params.id]
    );
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Cluster not found.' }); return; }
    await pool.query('INSERT INTO audit_logs (id, user_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), req.user.id, 'UPDATE_CLUSTER', 'CLUSTERS', req.params.id, JSON.stringify(req.body)]);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to update cluster.' });
  }
});

// 2. DELETE /api/clusters/:id
app.delete('/api/clusters/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') { res.status(403).json({ success: false, error: 'Only Super Admin can delete clusters.' }); return; }
  try {
    await pool.query('START TRANSACTION');

    // 1. Break bidirectional FK link between clusters and users
    await pool.query('UPDATE clusters SET admin_id = NULL WHERE id = ?', [req.params.id]);

    // 2. Remove notifications and unbind audit logs for users belonging to this cluster
    await pool.query('DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE cluster_id = ?)', [req.params.id]);
    await pool.query('UPDATE audit_logs SET user_id = NULL WHERE user_id IN (SELECT id FROM users WHERE cluster_id = ?)', [req.params.id]);

    // 3. Delete cluster users (e.g. Cluster Admin)
    await pool.query('DELETE FROM users WHERE cluster_id = ?', [req.params.id]);

    // 4. Delete cluster from clusters table
    const [result] = await pool.query<any>('DELETE FROM clusters WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) {
      await pool.query('ROLLBACK');
      res.status(404).json({ success: false, error: 'Cluster not found.' });
      return;
    }

    // 5. Record audit log
    await pool.query('INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)', [
      crypto.randomUUID(),
      req.user.id,
      req.user.name,
      req.user.role,
      'DELETE_CLUSTER',
      'CLUSTERS',
      req.params.id,
      `Permanently deleted cluster ${req.params.id} and associated cluster admin accounts.`
    ]);

    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    await pool.query('ROLLBACK').catch(() => undefined);
    console.error('Failed to delete cluster:', error);
    // If foreign key constraint blocks hard deletion due to operational records (sessions, attendance, etc.)
    if (error?.code === 'ER_ROW_IS_REFERENCED_2' || error?.code === 'ER_ROW_IS_REFERENCED') {
      try {
        await pool.query("UPDATE clusters SET status = 'Inactive' WHERE id = ?", [req.params.id]);
        await pool.query("UPDATE users SET status = 'Inactive' WHERE cluster_id = ?", [req.params.id]);
        res.json({ success: true, message: 'Cluster deactivated due to linked historical sessions/students.' });
        return;
      } catch (innerErr) {
        // pass
      }
    }
    res.status(503).json({ success: false, error: 'Failed to delete cluster.' });
  }
});

// 3. GET /api/villages
app.get('/api/villages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const targetClusterId = req.user.role !== 'Super Admin' ? req.user.clusterId : (req.query.cluster || null);
  const targetPanchayatId = req.query.panchayat || null;
  
  let sql = `
    SELECT v.*, p.name as panchayat_name 
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
  }
  
  try {
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to fetch villages.' });
  }
});

// 4. POST /api/villages
app.post('/api/villages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id, name, panchayat_id, cluster_id } = req.body;
  if (!name || !panchayat_id || !cluster_id) {
    res.status(400).json({ success: false, error: 'Missing required fields.' });
    return;
  }
  try {
    const finalId = id || crypto.randomUUID();
    const [result] = await pool.query<any>(
      `INSERT INTO villages (id, name, panchayat_id, cluster_id) 
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), panchayat_id = VALUES(panchayat_id), cluster_id = VALUES(cluster_id)`,
      [finalId, name, panchayat_id, cluster_id]
    );
    res.json({ success: true, data: { id: finalId } });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to upsert village.' });
  }
});

// 5. DELETE /api/villages/:id
app.delete('/api/villages/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [result] = await pool.query<any>("DELETE FROM villages WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Village not found.' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to delete village.' });
  }
});

// 6. DELETE /api/panchayats/:id
app.delete('/api/panchayats/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await pool.query("DELETE FROM villages WHERE panchayat_id = ?", [req.params.id]);
    const [result] = await pool.query<any>("DELETE FROM panchayats WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Panchayat not found.' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to delete panchayat.' });
  }
});

// 7. PUT /api/students/:id
app.put('/api/students/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { name, gender, dob, standard, panchayat_id, panchayatId, village_id, villageId, parent_name, parentName, phone, status } = req.body;
  const pId = panchayat_id !== undefined ? panchayat_id : panchayatId;
  const vId = village_id !== undefined ? village_id : villageId;
  const parName = parent_name !== undefined ? parent_name : parentName;

  try {
    const [result] = await pool.query<any>(
      `UPDATE students SET 
        name = COALESCE(?, name), 
        gender = COALESCE(?, gender), 
        dob = COALESCE(?, dob), 
        standard = COALESCE(?, standard), 
        panchayat_id = COALESCE(?, panchayat_id), 
        village_id = COALESCE(?, village_id), 
        parent_name = COALESCE(?, parent_name), 
        phone = COALESCE(?, phone), 
        status = COALESCE(?, status) 
       WHERE id = ?`,
      [name ?? null, gender ?? null, dob ?? null, standard ?? null, pId ?? null, vId ?? null, parName ?? null, phone ?? null, status ?? null, req.params.id]
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
    const [result] = await pool.query<any>("UPDATE students SET status = 'Inactive' WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Student not found.' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to delete student.' });
  }
});

// 9. POST /api/students/bulk
app.post('/api/students/bulk', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { students, clusterId } = req.body;
  if (!Array.isArray(students) || !clusterId) {
    res.status(400).json({ success: false, error: 'Invalid payload.' });
    return;
  }
  let count = 0;
  try {
    for (const student of students) {
      const studentId = student.id || crypto.randomUUID();
      await pool.query(
        'INSERT INTO students (id, cluster_id, name, gender, dob, standard, panchayat_id, village_id, parent_name, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), standard = VALUES(standard), panchayat_id = VALUES(panchayat_id), village_id = VALUES(village_id)',
        [studentId, clusterId, student.name, student.gender || 'male', student.dob || '2014-01-01', student.standard || '6th Standard', student.panchayatId || student.panchayat_id || null, student.villageId || student.village_id || null, student.parentName || student.parent_name || 'Parent', student.phone || '', 'Active']
      );
      count++;
    }
    res.json({ success: true, count });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to bulk import students.' });
  }
});

// 10. PUT /api/volunteers/:id
app.put('/api/volunteers/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, phone, department, role, panchayat_id, panchayatId, village_id, villageId, status } = req.body;
  const pId = panchayat_id !== undefined ? panchayat_id : panchayatId;
  const vId = village_id !== undefined ? village_id : villageId;

  try {
    const [result] = await pool.query<any>(
      `UPDATE volunteers SET 
        name = COALESCE(?, name), 
        email = COALESCE(?, email), 
        phone = COALESCE(?, phone), 
        department = COALESCE(?, department), 
        role = COALESCE(?, role), 
        panchayat_id = COALESCE(?, panchayat_id), 
        village_id = COALESCE(?, village_id), 
        status = COALESCE(?, status) 
       WHERE id = ?`,
      [name ?? null, email ?? null, phone ?? null, department ?? null, role ?? null, pId ?? null, vId ?? null, status ?? null, req.params.id]
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
        'INSERT INTO volunteers (id, cluster_id, name, email, phone, department, role, panchayat_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), clusterId, vol.name, vol.email, vol.phone, vol.department, vol.role, vol.panchayatId || null, 'Active']
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
    // v2: the legacy 'session_attendance' table never existed. The real
    // attendance tables (attendance_sessions / student_attendance /
    // volunteer_attendance) cascade-delete automatically via the FKs declared
    // in 206_attendance.sql. We just need to delete the session row; the
    // children follow.
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
  try {
    const { sessionId, originalDate, requestedDate, reason } = req.body;
    const clusterId = req.user.clusterId;
    const id = `dcr-${randomUUID()}`;

    await pool.query(
      'INSERT INTO date_change_requests (id, session_id, cluster_id, original_date, requested_date, reason, status, requested_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, sessionId, clusterId, originalDate, requestedDate, reason, 'Pending', req.user.id]
    );

    await pool.query(
      'INSERT INTO notifications (id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [randomUUID(), 'Date Change Request', `New date change request for session ${sessionId} from cluster ${clusterId}.`, 'date_change']
    );

    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, clusterId, 'CREATE_DATE_CHANGE_REQUEST', 'DATE_CHANGES', id, `Requested date change for session ${sessionId}`]
    );

    res.json({ success: true, request: { id, sessionId, clusterId, originalDate, requestedDate, reason, status: 'Pending' } });
  } catch (error) {
    console.error('Failed to submit date change request:', error);
    res.status(500).json({ success: false, error: 'Unable to submit request.' });
  }
});

app.get('/api/date-change-requests', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let sql = 'SELECT * FROM date_change_requests WHERE 1=1';
    const params: any[] = [];

    if (req.user.role === 'Cluster Admin') {
      sql += ' AND cluster_id = ?';
      params.push(req.user.clusterId);
    }

    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, data: rows, dateChangeRequests: rows });
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
  const status = action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : null;

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

    if (status === 'Approved') {
      await pool.query('UPDATE sessions SET date = ? WHERE id = ?', [request.requested_date, request.session_id]);
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
    res.json({ success: true, status });
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
  try {
    const { sessionId, clusterId, dayNumber } = req.body;
    const cId = clusterId || req.user.clusterId;
    const recordId = `sub-${sessionId}`;

    const [attRows] = await pool.query<any[]>("SELECT id FROM attendance_sessions WHERE session_id = ? AND day_number = ? AND status != 'Draft'", [sessionId, dayNumber]);
    const attendanceComplete = attRows.length > 0;

    const [lpRows] = await pool.query<any[]>('SELECT id FROM lesson_plans WHERE session_id = ?', [sessionId]);
    const lessonPlanComplete = lpRows.length > 0;

    const [photoRows] = await pool.query<any[]>('SELECT id FROM session_photos WHERE cluster_id = ? AND day_number = ?', [cId, dayNumber]);
    const photosComplete = photoRows.length > 0;

    const [repRows] = await pool.query<any[]>('SELECT id FROM session_reports WHERE session_id = ?', [sessionId]);
    const reportComplete = repRows.length > 0;

    const [finRows] = await pool.query<any[]>('SELECT id FROM finance_entries WHERE cluster_id = ?', [cId]);
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
      [recordId, sessionId, cId, dayNumber, attendanceComplete, lessonPlanComplete, photosComplete, reportComplete, financeComplete, 'Submitted', req.user.id]
    );

    // v2 sessions: the column is session_status, not status.
    await pool.query("UPDATE sessions SET session_status = 'Submitted' WHERE id = ?", [sessionId]);

    await pool.query(
      'INSERT INTO notifications (id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [randomUUID(), 'Session Submitted', `Session ${sessionId} has been submitted for review.`, 'submission']
    );

    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, cId, 'SUBMIT_SESSION', 'SUBMISSIONS', recordId, `Submitted session ${sessionId}`]
    );

    await pool.query('COMMIT');
    res.json({ success: true, data: { id: recordId, status: 'Submitted' } });
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
  const status = action === 'approve' ? 'Approved' : action === 'resubmission' ? 'Resubmission Required' : null;

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

    if (status === 'Approved') {
      await pool.query('UPDATE session_submissions SET status = ?, reviewed_at = NOW(), review_remarks = ? WHERE id = ?', [status, remarks, req.params.id]);
      // v2 sessions: column is session_status, not status.
      await pool.query("UPDATE sessions SET session_status = 'Completed' WHERE id = ?", [submission.session_id]);
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
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM session_submissions WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Submission not found.' });
      return;
    }
    const submission = rows[0];

    const [attRows] = await pool.query<any[]>("SELECT id FROM attendance_sessions WHERE session_id = ? AND day_number = ? AND status != 'Draft'", [submission.session_id, submission.day_number]);
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
      "UPDATE session_submissions SET status = 'Resubmitted', resubmitted_at = NOW(), attendance_complete=?, lesson_plan_complete=?, photos_complete=?, report_complete=?, finance_complete=? WHERE id = ?",
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
    res.json({ success: true, status: 'Resubmitted' });
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
    await pool.query('UPDATE modules SET is_active = 0 WHERE id = ?', [req.params.id]);
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
      'INSERT INTO module_resources (id, module_id, file_path, file_url, original_filename) VALUES (?, ?, ?, ?, ?)',
      [resourceId, req.params.id, filePath, fileUrl, req.file.originalname]
    );

    const ext = path.extname(req.file.originalname || '').toUpperCase().replace('.', '');
    const fileType = ext === 'PPT' || ext === 'PPTX' ? 'PPT' : ext === 'PDF' ? 'PDF' : ext;

    const resourceObj = {
      id: resourceId,
      moduleId: req.params.id,
      fileName: req.file.originalname,
      originalFileName: req.file.originalname,
      fileType,
      mimeType: req.file.mimetype,
      fileSize: req.file.size || 0,
      fileSizeFormatted: `${((req.file.size || 0) / (1024 * 1024)).toFixed(1)} MB`,
      fileUrl,
      isPrimaryPPT: ext === 'PPT' || ext === 'PPTX',
      storageProvider: 'local',
      uploadedAt: new Date().toISOString(),
    };

    res.json({ success: true, resource: resourceObj });
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

const normalizeDateValue = (value: unknown, fallback: string): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return fallback;
};

// --- 5. Academic Years ---
app.get('/api/academic-years', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM academic_years ORDER BY start_date DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Failed to fetch academic years:', error);
    res.status(503).json({ success: false, error: 'Unable to load data.' });
  }
});

app.post('/api/academic-years', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, startDate, endDate, isActive } = req.body;
    const normalizedName = String(name || '').trim().replace(/[–—]/g, '-');
    const id = `ay-${randomUUID()}`;
    const safeStartDate = normalizeDateValue(startDate, '2026-05-31');
    const safeEndDate = normalizeDateValue(endDate, '2027-05-30');

    if (!normalizedName) {
      res.status(400).json({ success: false, error: 'Academic year name is required.' });
      return;
    }

    const [existingRows] = await pool.query<any[]>('SELECT id FROM academic_years WHERE name = ? LIMIT 1', [normalizedName]);
    if (existingRows.length > 0) {
      res.status(409).json({ success: false, error: 'An academic year with this name already exists.' });
      return;
    }

    await pool.query('START TRANSACTION');
    if (isActive) {
      await pool.query('UPDATE academic_years SET is_active = 0');
    }

    await pool.query(
      'INSERT INTO academic_years (id, name, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?)',
      [id, normalizedName, safeStartDate, safeEndDate, Boolean(isActive)]
    );

    await pool.query('COMMIT');
    res.json({ success: true, data: { id } });
  } catch (error: any) {
    await pool.query('ROLLBACK').catch(() => undefined);
    console.error('Failed to create academic year:', error);
    if (error?.code === 'ER_DUP_ENTRY' || String(error?.message || '').includes('Duplicate entry')) {
      res.status(409).json({ success: false, error: 'An academic year with this name already exists.' });
      return;
    }
    res.status(500).json({ success: false, error: 'Unable to create academic year.' });
  }
});

app.put('/api/academic-years/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, startDate, endDate, isActive } = req.body;
    const safeStartDate = normalizeDateValue(startDate, '2026-05-31');
    const safeEndDate = normalizeDateValue(endDate, '2027-05-30');

    await pool.query('START TRANSACTION');
    if (isActive) {
      await pool.query('UPDATE academic_years SET is_active = 0');
    }

    await pool.query(
      'UPDATE academic_years SET name = ?, start_date = ?, end_date = ?, is_active = ? WHERE id = ?',
      [name, safeStartDate, safeEndDate, Boolean(isActive), req.params.id]
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
    // Post-migration verifier + Super Admin bootstrap.
    // MUST run after runSqlFiles so schema_migrations and users exist.
    await initDatabaseSchema();

    const dbStatus = await getDatabaseStatus();
    if (dbStatus === 'disconnected') {
      console.warn('[DB WARNING] MySQL connection test reported disconnected. Please check database service.');
    } else {
      console.log('[DB] MySQL connection active.');
    }

    app.listen(PORT, '0.0.0.0', async () => {
      // Self-heal the academic_setup table at boot so a previous failed migration
      // (or stale schema_migrations row) never breaks the /api/academic-setup endpoints.
      await ensureAcademicSetupTable().catch(() => undefined);
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

