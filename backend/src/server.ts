import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createHash, randomInt, randomUUID } from 'crypto';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import cors from 'cors';
import { sendLoginOtp, sendOnboardingCredentialsEmail, sendWorkflowEmail } from './authMailer.js';
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
const DEFAULT_ACADEMIC_SESSION_NAMES = [
  'Parents Meet',
  'Know Your Locality',
  'Books to Bytes',
  'Sports',
  'Science',
  'Art Education',
  'Constitution',
  'Tinkering Session',
] as const;

const academicSessionId = (clusterId: string, academicYearId: string, dayNumber: number) => {
  const key = createHash('sha256').update(`${clusterId}:${academicYearId}`).digest('hex').slice(0, 32);
  return `academic-session-${key}-${dayNumber}`;
};

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
  activePanchayats: Number(row.active_panchayats || 0),
  villagesCount: Number(row.villages_count || 0),
  totalStudents: Number(row.total_students || 0),
  totalVolunteers: Number(row.total_volunteers || 0),
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
  schoolName: row.school_name || '',
  academicYearId: row.academic_year_id,
  status: row.status || 'active',
  avatarLetter: (row.name || 'S').charAt(0).toUpperCase(),
  avatarBg: '#0B3D91',
});

const mapVolunteer = (row: any) => ({
  id: row.id,
  name: row.name,
  gender: row.gender || undefined,
  email: row.email || '',
  phone: row.phone || '',
  college: row.college_name || '',
  department: row.department || 'Community Program',
  year: row.study_year || '',
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

const parseSessionTargets = (value: any) => {
  if (!value) return { locations: [], reason: '' };
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) return { locations: parsed, reason: '' };
    return {
      locations: Array.isArray(parsed?.locations) ? parsed.locations : [],
      reason: String(parsed?.reason || ''),
    };
  } catch {
    return { locations: [], reason: '' };
  }
};

const mapSession = (row: any) => {
  const targetData = parseSessionTargets(row.target_locations_json);
  return ({
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
  targetLocations: targetData.locations,
  targetLocationReason: targetData.reason,
  volunteerId: row.volunteer_id,
  volunteerName: row.volunteer_name || 'Volunteer',
  status: row.session_status || 'Draft',
  dateFixed: Boolean(row.session_date_fixed),
  sessionType: 'Academic',
  description: row.description || '',
  lessonPlanId: row.lesson_plan_id || '',
  hasSavedSchedule: Boolean(row.saved_session_id),
  attendanceCount: 0,
  totalStudents: 0,
});
};

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
    clusterName: row.cluster_name || row.cluster_id || 'Dharmapuri',
    sessionId: row.session_id || row.id,
    sessionTitle: row.original_filename || `Day ${row.day_number || 1} Photos`,
    dayNumber: Number(row.day_number || 1),
    date: row.visit_date ? new Date(row.visit_date).toISOString().slice(0, 10) : row.uploaded_at ? new Date(row.uploaded_at).toISOString().slice(0, 10) : '',
    panchayatId: row.panchayat_id || '',
    panchayatName: row.panchayat_name || '',
    villageId: row.village_id || '',
    villageName: row.village_name || '',
    filePath: row.file_path,
    fileUrl: row.file_url || `/api/session-photos/file/${row.id}`,
    originalFilename: row.original_filename || 'photo.jpg',
    mimeType: row.mime_type || 'image/jpeg',
    fileSize: Number(row.file_size || 0),
    uploadedBy: row.uploaded_by_name || userName || row.uploaded_by || 'Cluster Admin',
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

app.get('/api/modules', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    await ensureAcademicSetupTable();
    const [academicDayRows] = await pool.query<any[]>(
      `SELECT day_number, session_name
       FROM academic_setup
       WHERE academic_year_id = ? AND session_name IS NOT NULL AND TRIM(session_name) <> ''
       ORDER BY day_number ASC`,
      [year.id],
    );
    const academicDays = academicDayRows.map((row) => ({
      dayNumber: Number(row.day_number),
      sessionName: String(row.session_name),
    }));
    const configuredDayNumbers = academicDays.map((day) => day.dayNumber);
    if (!configuredDayNumbers.length) {
      res.json({ success: true, academicDays, modules: [] });
      return;
    }
    const moduleVisibilityClause = req.user.role === 'Super Admin'
      ? ''
      : ' AND EXISTS (SELECT 1 FROM module_resources mr WHERE mr.module_id = modules.id)';
    const [rows] = await pool.query<any[]>(
      `SELECT id, name, code, description, is_active, academic_year, academic_year_id, day_number, created_at
       FROM modules
       WHERE academic_year_id = ? AND (day_number IN (?) OR day_number IS NULL)${moduleVisibilityClause}
       ORDER BY day_number ASC, code ASC, name ASC`,
      [year.id, configuredDayNumbers],
    );
    const moduleIds = rows.map((row) => row.id);
    let resRows: any[] = [];
    if (moduleIds.length) {
      const [resourceRows] = await pool.query<any[]>(
        'SELECT id, module_id, file_path, file_url, original_filename, created_at FROM module_resources WHERE module_id IN (?)',
        [moduleIds],
      ).catch(() => [[]]);
      resRows = resourceRows;
    }

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
      academicDays,
      modules: rows.map((row) => ({
        id: row.id,
        moduleNumber: row.code || row.id,
        moduleName: row.name,
        topic: row.name,
        academicYear: row.academic_year || year.name,
        academicYearId: row.academic_year_id,
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

  const year = await resolveAcademicYear(req);
  if (!year) {
    res.status(404).json({ success: false, error: 'No academic year is available.' });
    return;
  }
  if (isArchivedAcademicYear(year)) {
    res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
    return;
  }
  const academicYear = String(req.body.academicYear || year.name).trim();
  const dayNumber = req.body.dayNumber === null || req.body.dayNumber === undefined || req.body.dayNumber === ''
    ? null
    : Number(req.body.dayNumber);

  if (academicYear !== year.name || !/^\d{4}-\d{4}$/.test(academicYear) || (dayNumber !== null && (!Number.isInteger(dayNumber) || dayNumber < 1))) {
    res.status(400).json({ success: false, error: 'Academic year or programme day is invalid.' });
    return;
  }

  try {
    const [result] = await pool.query<any>(
      'UPDATE modules SET academic_year = ?, academic_year_id = ?, day_number = ? WHERE id = ? AND academic_year_id = ?',
      [academicYear, year.id, dayNumber, req.params.id, year.id],
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

const resolveAcademicYear = async (req: Request) => {
  const requested = String(
    req.query.academicYearId || req.body?.academicYearId || req.get('x-academic-year-id') || '',
  ).trim();
  const [rows] = requested
    ? await pool.query<any[]>('SELECT id, name, status, is_active, archived_at FROM academic_years WHERE id = ? OR name = ? LIMIT 1', [requested, requested])
    : await pool.query<any[]>('SELECT id, name, status, is_active, archived_at FROM academic_years ORDER BY is_active DESC, start_date DESC LIMIT 1');
  return rows[0] || null;
};

const isArchivedAcademicYear = (year: any) =>
  String(year?.status || '').toUpperCase() === 'ARCHIVED' || Boolean(year?.archived_at);

const isAllowedStudentStandard = (value: unknown) => {
  const grade = String(value ?? '').match(/\d+/)?.[0];
  return ['9', '10', '11', '12'].includes(grade || '');
};

const resolveClusterForAcademicYear = async (req: AuthenticatedRequest, academicYearId: string, requestedClusterId?: string) => {
  if (req.user.role !== 'Cluster Admin') return requestedClusterId && requestedClusterId !== 'all' ? requestedClusterId : null;
  const [rows] = await pool.query<any[]>(
    `SELECT id FROM clusters
     WHERE academic_year_id = ? AND (id = ? OR source_cluster_id = ?)
     ORDER BY (id = ?) DESC LIMIT 1`,
    [academicYearId, req.user.clusterId, req.user.clusterId, req.user.clusterId],
  );
  return rows[0]?.id || req.user.clusterId;
};

app.get('/api/academic-setup', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await ensureAcademicSetupTable();
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const [rows] = await pool.query<any[]>(
      'SELECT day_number, academic_year, academic_year_id, session_name, session_date FROM academic_setup WHERE academic_year_id = ? ORDER BY day_number ASC',
      [year.id],
    );
    res.json({ success: true, setup: rows.map((row: any) => ({
      day_number: row.day_number,
      academic_year: row.academic_year,
      academic_year_id: row.academic_year_id,
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

  const requestedAcademicYear = String(req.body.academicYear || '').trim();
  const days = Array.isArray(req.body.days) ? req.body.days : [];
  const dayNumbers = days.map((day: any) => Number(day.dayNumber));
    if ((requestedAcademicYear && !/^\d{4}-\d{4}$/.test(requestedAcademicYear)) ||
      !days.length ||
      new Set(dayNumbers).size !== days.length ||
      dayNumbers.some((dayNumber: number) => !Number.isInteger(dayNumber) || dayNumber < 1) ||
      days.some((day: any) => !String(day.sessionName || '').trim())) {
    res.status(400).json({ success: false, error: 'Academic year or session days are invalid.' });
    return;
  }

  let connection: any;
  try {
    await ensureAcademicSetupTable();
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'Academic year not found.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const academicYear = year.name;
    connection = await pool.getConnection();
    await connection.beginTransaction();

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
          await connection.rollback();
          res.status(400).json({ success: false, error: `Day ${day.dayNumber}: session date must be in DD-MM-YY format.` });
          return;
        }
      }
      await connection.query(
        'INSERT INTO academic_setup (academic_year_id, day_number, academic_year, session_name, session_date) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE academic_year = VALUES(academic_year), session_name = VALUES(session_name), session_date = VALUES(session_date)',
        [year.id, Number(day.dayNumber), academicYear, String(day.sessionName || '').trim() || null, isoDate],
      );
    }
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection?.rollback().catch(() => undefined);
    console.error('Failed to save academic setup:', error);
    res.status(503).json({ success: false, error: 'Unable to save academic setup.' });
  } finally {
    connection?.release();
  }
});

app.get('/api/program-days', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await ensureAcademicSetupTable();
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const [rows] = await pool.query<any[]>(
      `SELECT day_number, session_name FROM academic_setup
       WHERE academic_year_id = ? AND session_name IS NOT NULL AND TRIM(session_name) <> ''
       ORDER BY day_number ASC`,
      [year.id],
    );
    res.json({ success: true, programDays: rows.map((row) => ({
      id: `day-${row.day_number}`,
      day_number: Number(row.day_number),
      day_name: String(row.session_name),
    })) });
  } catch (error) {
    console.error('Failed to load programme days:', error);
    res.status(503).json({ success: false, error: 'Unable to load programme days.' });
  }
});

app.get('/api/session-photos/day-statuses', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const requestedClusterId = String(req.query.clusterId || 'all');
    const params: any[] = [year.id];
    let clusterFilter = '';
    if (req.user.role === 'Cluster Admin') {
      clusterFilter = ' AND cluster_id = ?';
      params.push(await resolveClusterForAcademicYear(req, year.id));
    } else if (requestedClusterId !== 'all') {
      clusterFilter = ' AND cluster_id = ?';
      params.push(requestedClusterId);
    }
    const [countRows] = await pool.query<any[]>(
      `SELECT day_number, COUNT(*) AS photo_count FROM session_photos
       WHERE academic_year_id = ?${clusterFilter} GROUP BY day_number`,
      params,
    );
    const counts = Object.fromEntries(countRows.map((row) => [Number(row.day_number), Number(row.photo_count || 0)]));
    await ensureAcademicSetupTable();
    const [setupRows] = await pool.query<any[]>(
      `SELECT setup.day_number, setup.session_name, submission.status
       FROM academic_setup setup
       LEFT JOIN session_photo_submissions submission
         ON submission.academic_year_id = setup.academic_year_id
         AND submission.day_number = setup.day_number${clusterFilter ? ' AND submission.cluster_id = ?' : ''}
       WHERE setup.academic_year_id = ? AND setup.session_name IS NOT NULL AND TRIM(setup.session_name) <> ''
       ORDER BY setup.day_number ASC`,
      clusterFilter ? [params[1], year.id] : [year.id],
    );
    const summaryParams: any[] = [year.id];
    let summaryFilter = '';
    if (req.user.role === 'Cluster Admin') {
      summaryFilter = ' AND submissions.cluster_id = ?';
      summaryParams.push(await resolveClusterForAcademicYear(req, year.id));
    } else if (requestedClusterId !== 'all') {
      summaryFilter = ' AND submissions.cluster_id = ?';
      summaryParams.push(requestedClusterId);
    }
    const [summaryRows] = await pool.query<any[]>(
      `SELECT submissions.cluster_id, clusters.name AS cluster_name, submissions.day_number, submissions.status,
              COUNT(photos.id) AS photo_count
       FROM session_photo_submissions submissions
       LEFT JOIN session_photos photos ON photos.academic_year_id = submissions.academic_year_id
         AND photos.cluster_id = submissions.cluster_id AND photos.day_number = submissions.day_number
       LEFT JOIN clusters ON clusters.id = submissions.cluster_id
       WHERE submissions.academic_year_id = ?${summaryFilter}
       GROUP BY submissions.cluster_id, clusters.name, submissions.day_number, submissions.status`,
      summaryParams,
    );
    const summaryByCluster = new Map<string, any>();
    summaryRows.forEach((row) => {
      const clusterId = String(row.cluster_id);
      const summary = summaryByCluster.get(clusterId) || {
        clusterId,
        clusterName: row.cluster_name || clusterId,
        totalPhotos: 0,
        submittedDaysCount: 0,
        days: [],
      };
      const photoCount = Number(row.photo_count || 0);
      summary.totalPhotos += photoCount;
      if (['Submitted', 'Approved'].includes(String(row.status))) summary.submittedDaysCount += 1;
      summary.days.push({ dayNumber: Number(row.day_number), status: String(row.status).toUpperCase(), photoCount });
      summaryByCluster.set(clusterId, summary);
    });
    res.json({
      success: true,
      counts,
      statuses: setupRows.map((row) => ({ day_number: Number(row.day_number), status: row.status || 'DRAFT' })),
      clusterSummaries: [...summaryByCluster.values()],
    });
  } catch (error) {
    console.error('Failed to load session photo day statuses:', error);
    res.status(503).json({ success: false, error: 'Unable to load session photo day statuses.' });
  }
});

app.post('/api/session-photos/submit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Cluster Admin') {
    res.status(403).json({ success: false, error: 'Only Cluster Admin can submit photo collections.' });
    return;
  }
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const clusterId = await resolveClusterForAcademicYear(req, year.id);
    const dayNumber = Number(req.body.dayNumber);
    if (!Number.isInteger(dayNumber) || dayNumber < 1) {
      res.status(400).json({ success: false, error: 'Select a valid programme day.' });
      return;
    }
    const [photoRows] = await pool.query<any[]>('SELECT COUNT(*) AS photo_count FROM session_photos WHERE academic_year_id = ? AND cluster_id = ? AND day_number = ?', [year.id, clusterId, dayNumber]);
    const photoCount = Number(photoRows[0]?.photo_count || 0);
    if (!photoCount) {
      res.status(409).json({ success: false, error: 'Upload at least one photo before submitting this day.' });
      return;
    }
    const id = `photo-sub-${createHash('sha256').update(`${year.id}:${clusterId}:${dayNumber}`).digest('hex').slice(0, 32)}`;
    await pool.query(
      `INSERT INTO session_photo_submissions (id, academic_year_id, cluster_id, day_number, status, submitted_by, submitted_at, reviewed_by, reviewed_at, review_remarks)
       VALUES (?, ?, ?, ?, 'Submitted', ?, NOW(), NULL, NULL, NULL)
       ON DUPLICATE KEY UPDATE status = 'Submitted', submitted_by = VALUES(submitted_by), submitted_at = NOW(), reviewed_by = NULL, reviewed_at = NULL, review_remarks = NULL`,
      [id, year.id, clusterId, dayNumber, req.user.id],
    );
    const [admins] = await pool.query<any[]>("SELECT id FROM users WHERE LOWER(role) IN ('super admin','super_admin') AND status = 'Active'");
    for (const admin of admins) {
      await pool.query('INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())', [randomUUID(), admin.id, 'Photos submitted for review', `Cluster ${clusterId} submitted ${photoCount} photos for Day ${dayNumber}.`, 'approval']);
    }
    res.json({ success: true, status: 'Submitted', photoCount });
  } catch (error) {
    console.error('Failed to submit session photos:', error);
    res.status(503).json({ success: false, error: 'Unable to submit this photo collection.' });
  }
});

app.post('/api/session-photos/submissions/approve', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can review photo submissions.' });
    return;
  }
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const clusterId = String(req.body.clusterId || '').trim();
    const dayNumber = Number(req.body.dayNumber);
    if (!clusterId || !Number.isInteger(dayNumber) || dayNumber < 1) {
      res.status(400).json({ success: false, error: 'Select a valid cluster and programme day.' });
      return;
    }
    const [result] = await pool.query<any>(
      `UPDATE session_photo_submissions SET status = 'Approved', reviewed_by = ?, reviewed_at = NOW(), review_remarks = ?
       WHERE academic_year_id = ? AND cluster_id = ? AND day_number = ? AND status = 'Submitted'`,
      [req.user.id, String(req.body.remarks || '').trim() || null, year.id, clusterId, dayNumber],
    );
    if (!result.affectedRows) {
      res.status(404).json({ success: false, error: 'Pending photo submission was not found.' });
      return;
    }
    res.json({ success: true, status: 'Approved' });
  } catch (error) {
    console.error('Failed to approve photo submission:', error);
    res.status(503).json({ success: false, error: 'Unable to approve photo submission.' });
  }
});

app.post('/api/session-photos/submissions/approve-edits', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can authorize photo changes.' });
    return;
  }
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const clusterId = String(req.body.clusterId || '').trim();
    const dayNumber = Number(req.body.dayNumber);
    if (!clusterId || !Number.isInteger(dayNumber) || dayNumber < 1) {
      res.status(400).json({ success: false, error: 'Select a valid cluster and programme day.' });
      return;
    }
    const [result] = await pool.query<any>(
      `UPDATE session_photo_submissions SET status = 'Edit Approved', reviewed_by = ?, reviewed_at = NOW(), review_remarks = ?
       WHERE academic_year_id = ? AND cluster_id = ? AND day_number = ? AND status = 'Changes Requested'`,
      [req.user.id, String(req.body.remarks || '').trim() || null, year.id, clusterId, dayNumber],
    );
    if (!result.affectedRows) {
      res.status(404).json({ success: false, error: 'Pending photo change request was not found.' });
      return;
    }
    res.json({ success: true, status: 'Edit Approved' });
  } catch (error) {
    console.error('Failed to authorize photo changes:', error);
    res.status(503).json({ success: false, error: 'Unable to authorize photo changes.' });
  }
});

app.post('/api/session-photos/request-change', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Cluster Admin') {
    res.status(403).json({ success: false, error: 'Only Cluster Admin can request photo changes.' });
    return;
  }
  const reason = String(req.body.reason || '').trim();
  const dayNumber = Number(req.body.dayNumber);
  if (!reason || !Number.isInteger(dayNumber) || dayNumber < 1) {
    res.status(400).json({ success: false, error: 'A valid day and reason are required.' });
    return;
  }
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const clusterId = await resolveClusterForAcademicYear(req, year.id);
    const [result] = await pool.query<any>(
      `UPDATE session_photo_submissions SET status = 'Changes Requested', review_remarks = ?
       WHERE academic_year_id = ? AND cluster_id = ? AND day_number = ? AND status IN ('Submitted','Approved')`,
      [reason, year.id, clusterId, dayNumber],
    );
    if (!result.affectedRows) {
      res.status(409).json({ success: false, error: 'This day has no submitted collection to request changes for.' });
      return;
    }
    res.json({ success: true, status: 'Changes Requested' });
  } catch (error) {
    console.error('Failed to request photo changes:', error);
    res.status(503).json({ success: false, error: 'Unable to request photo changes.' });
  }
});

app.post('/api/session-photos/request-delete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Cluster Admin') {
    res.status(403).json({ success: false, error: 'Only Cluster Admin can request photo deletion.' });
    return;
  }
  const reason = String(req.body.reason || '').trim();
  if (!reason) {
    res.status(400).json({ success: false, error: 'A deletion reason is required.' });
    return;
  }
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const clusterId = await resolveClusterForAcademicYear(req, year.id);
    const [rows] = await pool.query<any[]>('SELECT day_number FROM session_photos WHERE id = ? AND academic_year_id = ? AND cluster_id = ? LIMIT 1', [req.body.photoId, year.id, clusterId]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Photo not found in your cluster.' });
      return;
    }
    const [lockedRows] = await pool.query<any[]>('SELECT status FROM session_photo_submissions WHERE academic_year_id = ? AND cluster_id = ? AND day_number = ? LIMIT 1', [year.id, clusterId, Number(rows[0].day_number)]);
    if (!lockedRows[0] || !['Submitted', 'Approved', 'Changes Requested'].includes(String(lockedRows[0].status))) {
      res.status(409).json({ success: false, error: 'Draft photos can be deleted directly; submit a deletion request only for a locked day.' });
      return;
    }
    const [existing] = await pool.query<any[]>('SELECT id FROM session_photo_delete_requests WHERE photo_id = ? AND status = \'PENDING\' LIMIT 1', [req.body.photoId]);
    if (existing.length) {
      res.status(409).json({ success: false, error: 'A deletion request is already pending for this photo.' });
      return;
    }
    const id = `photo-del-${randomUUID()}`;
    await pool.query('INSERT INTO session_photo_delete_requests (id, photo_id, academic_year_id, cluster_id, requested_by, reason) VALUES (?, ?, ?, ?, ?, ?)', [id, req.body.photoId, year.id, clusterId, req.user.id, reason]);
    res.json({ success: true, requestId: id });
  } catch (error) {
    console.error('Failed to request photo deletion:', error);
    res.status(503).json({ success: false, error: 'Unable to submit the deletion request.' });
  }
});

app.post('/api/session-photos/delete-requests/:id/:action', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin' || !['approve', 'reject'].includes(String(req.params.action))) {
    res.status(403).json({ success: false, error: 'Only Super Admin can review photo deletion requests.' });
    return;
  }
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const [rows] = await pool.query<any[]>('SELECT * FROM session_photo_delete_requests WHERE id = ? AND academic_year_id = ? AND status = \'PENDING\' LIMIT 1', [req.params.id, year.id]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Pending deletion request not found.' });
      return;
    }
    const request = rows[0];
    if (req.params.action === 'approve') {
      const [photoRows] = await pool.query<any[]>('SELECT file_path FROM session_photos WHERE id = ? AND academic_year_id = ? LIMIT 1', [request.photo_id, year.id]);
      if (photoRows[0]?.file_path && fs.existsSync(photoRows[0].file_path)) fs.unlinkSync(photoRows[0].file_path);
      await pool.query('DELETE FROM session_photos WHERE id = ? AND academic_year_id = ?', [request.photo_id, year.id]);
      res.json({ success: true, status: 'APPROVED' });
      return;
    }
    await pool.query('UPDATE session_photo_delete_requests SET status = \'REJECTED\', reviewed_by = ?, reviewed_at = NOW(), review_remarks = ? WHERE id = ?', [req.user.id, String(req.body.remarks || '').trim() || null, request.id]);
    res.json({ success: true, status: 'REJECTED' });
  } catch (error) {
    console.error('Failed to review photo deletion request:', error);
    res.status(503).json({ success: false, error: 'Unable to review photo deletion request.' });
  }
});

app.get('/api/session-photos/delete-requests', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    let sql = `SELECT requests.*, photos.day_number, photos.original_filename, photos.file_url,
        photos.caption, clusters.name AS cluster_name, requester.name AS requester_name,
        reviewer.name AS reviewer_name
      FROM session_photo_delete_requests requests
      JOIN session_photos photos ON photos.id = requests.photo_id
      LEFT JOIN clusters ON clusters.id = requests.cluster_id
      LEFT JOIN users requester ON requester.id = requests.requested_by
      LEFT JOIN users reviewer ON reviewer.id = requests.reviewed_by
      WHERE requests.academic_year_id = ?`;
    const params: any[] = [year.id];
    if (req.user.role === 'Cluster Admin') {
      sql += ' AND requests.cluster_id = ?';
      params.push(await resolveClusterForAcademicYear(req, year.id));
    } else if (req.query.clusterId && req.query.clusterId !== 'all') {
      sql += ' AND requests.cluster_id = ?';
      params.push(String(req.query.clusterId));
    }
    sql += ' ORDER BY requests.created_at DESC';
    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, requests: rows.map((row) => ({
      id: row.id, photoId: row.photo_id, clusterId: row.cluster_id,
      clusterName: row.cluster_name || row.cluster_id, academicYearId: row.academic_year_id,
      dayNumber: Number(row.day_number), dayName: `Day ${row.day_number}`,
      sessionName: row.caption || `Day ${row.day_number}`, fileName: row.original_filename,
      fileUrl: row.file_url || `/api/session-photos/file/${row.photo_id}`,
      requestedBy: row.requester_name || row.requested_by || '', reason: row.reason,
      requestedDate: row.created_at, status: row.status,
      reviewedBy: row.reviewer_name || '', reviewedAt: row.reviewed_at,
    })) });
  } catch (error) {
    console.error('Failed to load photo deletion requests:', error);
    res.status(503).json({ success: false, error: 'Unable to load photo deletion requests.' });
  }
});

app.get('/api/session-photos', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const cluster = String(req.query.cluster || req.query.clusterId || 'all').toLowerCase();
    let sql = 'SELECT photos.*, clusters.name AS cluster_name, uploader.name AS uploaded_by_name, requests.status AS delete_request_status, requests.id AS delete_request_id, requests.reason AS delete_request_reason FROM session_photos photos LEFT JOIN clusters ON clusters.id = photos.cluster_id LEFT JOIN users uploader ON uploader.id = photos.uploaded_by LEFT JOIN session_photo_delete_requests requests ON requests.photo_id = photos.id AND requests.status = \'PENDING\' WHERE photos.academic_year_id = ?';
    const params: any[] = [year.id];

    if (req.user.role === 'Cluster Admin') {
      const clusterId = await resolveClusterForAcademicYear(req, year.id);
      sql += ' AND photos.cluster_id = ?';
      params.push(clusterId);
    } else if (cluster !== 'all') {
      sql += ' AND photos.cluster_id = ?';
      params.push(cluster);
    }

    sql += ' ORDER BY photos.day_number ASC, photos.uploaded_at DESC';
    const [rows] = await pool.query<any[]>(sql, params);
    const photos = rows.map((row) => ({ ...mapSessionPhotoRow(row, req.user?.name), deleteRequestStatus: row.delete_request_status || null, deleteRequestId: row.delete_request_id || null, deleteRequestReason: row.delete_request_reason || null }));
    res.json({ success: true, photos });
  } catch (error) {
    console.error('Failed to load session photos:', error);
    res.status(503).json({ success: false, error: 'Unable to load session photos. Please try again.' });
  }
});

app.post('/api/session-photos/upload', requireAuth, photoUploadMiddleware.array('photos', 20), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const files = (req.files || []) as Express.Multer.File[];
    if (!files.length) {
      res.status(400).json({ success: false, error: 'No photos were selected to upload.' });
      return;
    }
    if (req.user.role !== 'Cluster Admin') {
      res.status(403).json({ success: false, error: 'Only Cluster Admin can upload session photos.' });
      return;
    }
    const clusterId = String(await resolveClusterForAcademicYear(req, year.id, req.body.clusterId || '') || 'dharmapuri');
    const dayNumber = Number(req.body.dayNumber || 1);
    if (!Number.isInteger(dayNumber) || dayNumber < 1) {
      res.status(400).json({ success: false, error: 'Select a valid programme day.' });
      return;
    }
    const [dayRows] = await pool.query<any[]>('SELECT day_number FROM academic_setup WHERE academic_year_id = ? AND day_number = ? AND session_name IS NOT NULL AND TRIM(session_name) <> \'\' LIMIT 1', [year.id, dayNumber]);
    if (!dayRows.length) {
      res.status(400).json({ success: false, error: 'This programme day is not configured.' });
      return;
    }
    const assignedCluster = await resolveClusterForAcademicYear(req, year.id, clusterId);
    const [daySessionRows] = await pool.query<any[]>(
      'SELECT id FROM sessions WHERE academic_year_id = ? AND cluster_id = ? AND day_number = ? ORDER BY updated_at DESC LIMIT 1',
      [year.id, assignedCluster, dayNumber],
    );
    const sessionId = daySessionRows[0]?.id ? String(daySessionRows[0].id) : null;
    const [submissionRows] = await pool.query<any[]>('SELECT status FROM session_photo_submissions WHERE academic_year_id = ? AND cluster_id = ? AND day_number = ? LIMIT 1', [year.id, assignedCluster, dayNumber]);
    if (submissionRows[0] && ['Submitted', 'Approved', 'Changes Requested'].includes(String(submissionRows[0].status))) {
      res.status(409).json({ success: false, error: 'This day has been submitted and is locked. Request approval to edit it.' });
      return;
    }
    const [existingCountRows] = await pool.query<any[]>('SELECT COUNT(*) AS photo_count FROM session_photos WHERE academic_year_id = ? AND cluster_id = ? AND day_number = ?', [year.id, assignedCluster, dayNumber]);
    if (Number(existingCountRows[0]?.photo_count || 0) + files.length > 50) {
      res.status(409).json({ success: false, error: 'A maximum of 50 photos is allowed for each programme day.' });
      return;
    }
    const uploadedBy = String(req.body.uploadedBy || req.user.name || 'Cluster Admin');
    const uploadedRole = String(req.body.uploadedRole || req.user.role || 'Cluster Admin');
    const sessionTitle = String(req.body.sessionTitle || `Session Day ${dayNumber}`);
    const uploaderName = uploadedBy || req.user.name || 'Cluster Admin';
    const [clusterNameRows] = await pool.query<any[]>('SELECT name FROM clusters WHERE id = ? AND academic_year_id = ? LIMIT 1', [assignedCluster, year.id]);
    const clusterName = String(clusterNameRows[0]?.name || assignedCluster);

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
        'INSERT INTO session_photos (id, cluster_id, session_id, academic_year_id, day_number, file_path, file_url, original_filename, mime_type, file_size, uploaded_by, uploaded_at, caption, photo_type, panchayat_id, panchayat_name, village_id, village_name, visit_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)',
        [rowId, assignedCluster, sessionId, year.id, dayNumber, filePath, fileUrl, originalName, file.mimetype, file.size, req.user.id, finalCaption, photoType, req.body.panchayatId || null, req.body.panchayatName || null, req.body.villageId || null, req.body.villageName || null, req.body.date || null],
      );

      savedPhotos.push(mapSessionPhotoRow({
        id: rowId,
        cluster_id: assignedCluster,
        cluster_name: clusterName,
        session_id: sessionId,
        day_number: dayNumber,
        file_path: filePath,
        file_url: fileUrl,
        original_filename: originalName,
        mime_type: file.mimetype,
        file_size: file.size,
        uploaded_by: uploaderName,
        uploaded_by_name: uploaderName,
        uploaded_at: new Date().toISOString(),
        caption: finalCaption,
        photo_type: photoType,
        panchayat_id: req.body.panchayatId || null,
        panchayat_name: req.body.panchayatName || null,
        village_id: req.body.villageId || null,
        village_name: req.body.villageName || null,
        visit_date: req.body.date || null,
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
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const [rows] = await pool.query<any[]>('SELECT * FROM session_photos WHERE id = ? AND academic_year_id = ? LIMIT 1', [req.params.id, year.id]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Photo was not found.' });
      return;
    }

    const row = rows[0];
    const filePath = String(row.file_path || '');
    if (req.user.role === 'Cluster Admin' && String(row.cluster_id) !== String(await resolveClusterForAcademicYear(req, year.id))) {
      res.status(403).json({ success: false, error: 'This photo is outside your cluster.' });
      return;
    }
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'The stored photo file is missing.' });
      return;
    }

    res.setHeader('Content-Type', String(row.mime_type || 'image/jpeg'));
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Failed to serve photo file:', error);
    res.status(500).json({ success: false, error: 'Unable to retrieve the photo.' });
  }
});

app.get('/api/session-photos/:id/download', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const [rows] = await pool.query<any[]>('SELECT * FROM session_photos WHERE id = ? AND academic_year_id = ? LIMIT 1', [req.params.id, year.id]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Photo was not found.' });
      return;
    }

    const row = rows[0];
    const filePath = String(row.file_path || '');
    if (req.user.role === 'Cluster Admin' && String(row.cluster_id) !== String(await resolveClusterForAcademicYear(req, year.id))) {
      res.status(403).json({ success: false, error: 'This photo is outside your cluster.' });
      return;
    }
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
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const cluster = String(req.query.cluster || req.query.clusterId || 'all').toLowerCase();
    const dayNumber = req.query.dayNumber ? Number(req.query.dayNumber) : null;
    const type = String(req.query.type || 'filtered');

    let sql = 'SELECT * FROM session_photos WHERE academic_year_id = ?';
    const params: any[] = [year.id];

    if (req.user.role === 'Cluster Admin') {
      const clusterId = await resolveClusterForAcademicYear(req, year.id);
      sql += ' AND cluster_id = ?';
      params.push(clusterId);
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
    archive.on('error', (err: Error) => next(err));
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
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const [rows] = await pool.query<any[]>('SELECT * FROM session_photos WHERE id = ? AND academic_year_id = ? LIMIT 1', [req.params.id, year.id]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Photo was not found.' });
      return;
    }

    const row = rows[0];
    if (req.user.role === 'Cluster Admin') {
      const clusterId = await resolveClusterForAcademicYear(req, year.id);
      if (String(row.cluster_id) !== String(clusterId)) {
        res.status(403).json({ success: false, error: 'This photo is outside your cluster.' });
        return;
      }
      const [submissionRows] = await pool.query<any[]>('SELECT status FROM session_photo_submissions WHERE academic_year_id = ? AND cluster_id = ? AND day_number = ? LIMIT 1', [year.id, clusterId, Number(row.day_number)]);
      if (submissionRows[0] && ['Submitted', 'Approved', 'Changes Requested'].includes(String(submissionRows[0].status))) {
        res.status(403).json({ success: false, error: 'Submitted photos are locked. Request Super Admin approval to delete them.' });
        return;
      }
    }
    if (req.user.role !== 'Cluster Admin' && req.user.role !== 'Super Admin') {
      res.status(403).json({ success: false, error: 'Only administrators can delete session photos.' });
      return;
    }
    if (row.file_path && fs.existsSync(row.file_path)) {
      fs.unlinkSync(row.file_path);
    }

    await pool.query('DELETE FROM session_photos WHERE id = ? AND academic_year_id = ?', [req.params.id, year.id]);
    res.json({ success: true, message: 'Photo deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete session photo:', error);
    res.status(500).json({ success: false, error: 'Unable to delete the photo.' });
  }
});

app.get('/api/approvals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    let sql = `SELECT approvals.*,
      clusters.name AS cluster_name_display,
      requester.name AS requester_name,
      attendance.attendance_type,
      attendance.day_number AS attendance_day_number,
      attendance.panchayat_id AS attendance_panchayat_id,
      attendance.village_id AS attendance_village_id,
      attendance.present_count,
      attendance.total_count,
      panchayats.name AS attendance_panchayat_name,
      villages.name AS attendance_village_name
      FROM approvals
      LEFT JOIN clusters ON clusters.id = approvals.cluster_id
      LEFT JOIN users requester ON requester.id = approvals.requested_by
      LEFT JOIN attendance_sessions attendance ON attendance.id = approvals.record_id AND attendance.academic_year_id = approvals.academic_year_id
      LEFT JOIN panchayats ON panchayats.id = attendance.panchayat_id
      LEFT JOIN villages ON villages.id = attendance.village_id
      WHERE approvals.academic_year_id = ?`;
    const params: any[] = [year.id];
    if (req.user.role === 'Cluster Admin') {
      const clusterId = await resolveClusterForAcademicYear(req, year.id);
      sql += ' AND approvals.cluster_id = ?';
      params.push(clusterId);
    } else if (req.query.clusterId && req.query.clusterId !== 'all') {
      sql += ' AND approvals.cluster_id = ?';
      params.push(String(req.query.clusterId));
    }
    sql += ' ORDER BY approvals.created_at DESC, approvals.id DESC';
    const [rows] = await pool.query<any[]>(sql, params);
    const attendanceIds = rows.filter((row) => row.module === 'Attendance' && row.record_id).map((row) => String(row.record_id));
    const attendanceRecords = new Map<string, any[]>();
    const volunteerRecords = new Map<string, any[]>();
    if (attendanceIds.length) {
      const [studentRows] = await pool.query<any[]>(
        `SELECT sa.attendance_session_id, sa.student_id, sa.present, sa.task_status,
                students.name, students.code, students.standard
         FROM student_attendance sa JOIN students ON students.id = sa.student_id
         WHERE sa.attendance_session_id IN (?) ORDER BY students.name ASC`,
        [attendanceIds],
      );
      studentRows.forEach((record) => {
        const id = String(record.attendance_session_id);
        const records = attendanceRecords.get(id) || [];
        records.push({
          studentId: String(record.student_id),
          studentName: String(record.name || ''),
          code: String(record.code || ''),
          standard: String(record.standard || ''),
          status: record.present === null ? 'Not Marked' : Boolean(record.present) ? 'Present' : 'Absent',
          taskStatus: String(record.task_status || 'Not Marked'),
        });
        attendanceRecords.set(id, records);
      });
      const [volunteerRows] = await pool.query<any[]>(
        `SELECT va.attendance_session_id, va.volunteer_id, va.present, volunteers.name, volunteers.role
         FROM volunteer_attendance va JOIN volunteers ON volunteers.id = va.volunteer_id
         WHERE va.attendance_session_id IN (?) ORDER BY volunteers.name ASC`,
        [attendanceIds],
      );
      volunteerRows.forEach((record) => {
        const id = String(record.attendance_session_id);
        const records = volunteerRecords.get(id) || [];
        records.push({ volunteerId: String(record.volunteer_id), volunteerName: String(record.name || ''), role: String(record.role || 'Mentor'), status: Boolean(record.present) ? 'Present' : 'Absent' });
        volunteerRecords.set(id, records);
      });
    }
    res.json({ success: true, approvals: rows.map((row) => {
      const isAttendance = row.module === 'Attendance';
      const attendanceId = String(row.record_id || '');
      const dayNumber = Number(row.attendance_day_number || 0);
      const panchayatName = String(row.attendance_panchayat_name || 'Panchayat');
      const villageName = String(row.attendance_village_name || (row.attendance_village_id ? 'Village' : 'All Villages'));
      return ({
      id: row.id,
      module: row.module || 'Sessions',
      recordId: isAttendance ? attendanceId : row.record_id || row.id,
      recordTitle: isAttendance ? `${panchayatName} · ${villageName} · Day ${dayNumber} Attendance` : row.record_id || 'Approval request',
      submittedBy: row.requester_name || row.requested_by || '',
      submittedAt: row.created_at,
      status: row.status,
      clusterId: row.cluster_id || 'all',
      clusterName: row.cluster_name_display || row.cluster_id || 'All Clusters',
      details: isAttendance ? {
        attendanceType: row.attendance_type || 'students',
        dayNumber,
        panchayatName,
        villageName,
        presentCount: Number(row.present_count || 0),
        totalCount: Number(row.total_count || 0),
        records: attendanceRecords.get(attendanceId) || [],
        volunteerAttendance: volunteerRecords.get(attendanceId) || [],
      } : '',
      correctionReason: undefined,
    });
    }) });
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

    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const [approvalRows] = await pool.query<any[]>('SELECT * FROM approvals WHERE id = ? AND academic_year_id = ? LIMIT 1', [req.params.id, year.id]);
    if (!approvalRows.length) {
      res.status(404).json({ success: false, error: 'Approval request not found.' });
      return;
    }
    const approval = approvalRows[0];
    if (['Approved', 'Rejected', 'DELETED'].includes(String(approval.status))) {
      res.status(409).json({ success: false, error: 'This submission has already reached a final status.' });
      return;
    }

    await pool.query('UPDATE approvals SET status = ?, updated_at = NOW() WHERE id = ? AND academic_year_id = ?', [status, req.params.id, year.id]);
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

let tamilNaduCollegesCache: any[] | null = null;

app.get('/api/colleges', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    if (!tamilNaduCollegesCache) {
      const directoryPath = path.join(PROJECT_ROOT, 'frontend', 'src', 'data', 'tamilNaduColleges.json');
      const sourceRows = JSON.parse(fs.readFileSync(directoryPath, 'utf8')) as any[];
      // The local source JSON is pre-cleaned in place. Preserve its canonical
      // spellings, stable IDs, districts, affiliations, and original casing.
      tamilNaduCollegesCache = sourceRows;
    }
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.json({ success: true, colleges: tamilNaduCollegesCache });
  } catch (error: any) {
    console.error('[COLLEGE DIRECTORY ERROR]', error?.message || error);
    res.status(503).json({ success: false, error: 'Unable to load the Tamil Nadu college directory.' });
  }
});

app.get('/api/clusters', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const includeArchived = String(req.query.includeArchived || '').toLowerCase() === 'true';
    // Keep this core query independent of optional operational count columns.
    // Counts are joined into the UI from the already year-scoped people/location APIs.
    let sql = `SELECT c.*, u.name AS admin_name, u.email AS admin_email, u.phone AS admin_phone
      FROM clusters c LEFT JOIN users u ON u.id = c.admin_id WHERE ${includeArchived ? '1=1' : "c.status = 'Active'"}`;
    const params: any[] = [year.id];
    sql += ' AND c.academic_year_id = ?';
    if (req.user.role === 'Cluster Admin') {
      const clusterId = await resolveClusterForAcademicYear(req, year.id);
      sql += ' AND c.id = ?';
      params.push(clusterId);
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

  const year = await resolveAcademicYear(req);
  if (!year) {
    res.status(404).json({ success: false, error: 'No academic year is available.' });
    return;
  }
  if (isArchivedAcademicYear(year)) {
    res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
    return;
  }

  const collegeName = String(req.body.collegeName || '').trim();
  const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
  const district = name;
  const collegeDistrict = String(req.body.collegeDistrict || '').trim();
  const spocName = String(req.body.spocName || req.body.adminName || '').trim();
  const spocMobile = String(req.body.spocMobile || req.body.adminPhone || '').trim();
  const adminEmail = String(req.body.adminEmail || req.body.spocEmail || req.body.email || '').trim().toLowerCase();
  const adminName = String(req.body.adminName || spocName).trim();
  const cleanIdPart = `${district}-${collegeName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // Keep IDs inside clusters.id VARCHAR(64), even for long official college names.
  const clusterId = `${(cleanIdPart || 'cluster').slice(0, 20)}-${randomUUID().slice(0, 8)}-${String(year.id).slice(-8)}`;
  const code = String(req.body.code || `TQI-${district.slice(0, 3).toUpperCase()}`).trim();
  const temporaryPassword = String(req.body.temporaryPassword || `TQI@Admin${randomInt(1000, 10000)}!`).trim();

  if (!collegeName || !district || !collegeDistrict || !spocName || !spocMobile || !adminEmail) {
    res.status(400).json({ success: false, error: 'Cluster name/district, college, college location, SPOC name, mobile, and Gmail are required.' });
    return;
  }

  // Cluster creation accepts exactly ten digits; do not silently normalize country codes or separators.
  if (!/^\d{10}$/.test(spocMobile)) {
    res.status(400).json({ success: false, error: 'SPOC mobile number must be exactly 10 digits.' });
    return;
  }

  // Cluster admin accounts must use a syntactically valid Gmail address.
  const gmailRegex = /^[a-z0-9]+(?:\.[a-z0-9]+)*(?:\+[a-z0-9]+(?:\.[a-z0-9]+)*)?@gmail\.com$/i;
  if (!gmailRegex.test(adminEmail)) {
    res.status(400).json({ success: false, error: 'Please enter a valid Gmail address ending in @gmail.com.' });
    return;
  }

  const [emailRows] = await pool.query<any[]>('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1', [adminEmail]);
  if (emailRows.length) {
    res.status(409).json({ success: false, error: 'This Gmail address is already registered to a TQI user. Enter a different Gmail address.' });
    return;
  }

  const normalizedPhone = `+91 ${spocMobile}`;
  const adminId = String(req.body.adminId || `usr-${randomUUID()}`);
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);
  let connection: any;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    // Chicken-and-egg between clusters and users: each FK-references the other.
    //   clusters.admin_id   -> users.id   (fk_clusters_admin)
    //   users.cluster_id    -> clusters.id (fk_users_cluster)
    // Insert cluster first with admin_id = NULL, then user, then link the two.
    await connection.query(
      `INSERT INTO clusters (id, name, district, college_district, state, code, college_name, spoc_name, spoc_mobile, admin_id, status, academic_year_id) VALUES (?, ?, ?, ?, 'Tamil Nadu', ?, ?, ?, ?, NULL, 'Active', ?)`,
      [clusterId, name, district, collegeDistrict, code, collegeName, spocName, normalizedPhone, year.id],
    ).catch(async () => {
      // Fallback in case college_district column doesn't exist yet
      return connection.query(
        `INSERT INTO clusters (id, name, district, state, code, college_name, spoc_name, spoc_mobile, admin_id, status, academic_year_id) VALUES (?, ?, ?, 'Tamil Nadu', ?, ?, ?, ?, NULL, 'Active', ?)`,
        [clusterId, name, district, code, collegeName, spocName, normalizedPhone, year.id],
      );
    });
    await connection.query(
      `INSERT INTO users (id, name, email, password_hash, role, cluster_id, phone, must_change_password, status) VALUES (?, ?, ?, ?, 'Cluster Admin', ?, ?, TRUE, 'Active')`,
      [adminId, adminName, adminEmail, passwordHash, clusterId, normalizedPhone],
    );
    await connection.query(
      `UPDATE clusters SET admin_id = ? WHERE id = ?`,
      [adminId, clusterId],
    );

    // Audit log
    await connection.query(
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

    await connection.commit();
    connection.release();
    connection = null;

    // Deliver the temporary password only after the account transaction commits.
    const emailSent = await sendOnboardingCredentialsEmail({
      recipient: adminEmail,
      name: adminName,
      temporaryPassword,
      role: 'Cluster Admin',
      clusterName: name,
      projectRoot: PROJECT_ROOT,
    });

    res.status(201).json({
      success: true,
      emailSent,
      loginEmail: adminEmail,
      temporaryPassword,
      cluster: mapCluster({ id: clusterId, name, district, college_district: collegeDistrict, state: 'Tamil Nadu', code, college_name: collegeName, spoc_name: spocName, spoc_mobile: normalizedPhone, admin_id: adminId, admin_name: adminName, admin_email: adminEmail, admin_phone: normalizedPhone, status: 'Active' }),
      user: serializeUser({ id: adminId, name: adminName, email: adminEmail, role: 'Cluster Admin', cluster_id: clusterId, phone: normalizedPhone, status: 'Active', must_change_password: true }),
    });
  } catch (error: any) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
      connection.release();
    }
    console.error('[CREATE_CLUSTER ERROR]', error?.code, error?.message);
    const code = error?.code;
    let status = 503;
    let message = 'Unable to create cluster.';
    if (code === 'ER_DUP_ENTRY') {
      status = 409;
      const duplicateKey = String(error?.sqlMessage || error?.message || '').toLowerCase();
      message = duplicateKey.includes('email')
        ? 'This SPOC email already has an account. Use a different email address or edit the existing cluster.'
        : 'A cluster with this name already exists for the selected academic year.';
    } else if (code === 'ER_NO_REFERENCED_ROW' || code === 'ER_NO_REFERENCED_ROW_2') {
      status = 400;
      message = 'Referenced cluster or admin is invalid. Please refresh and try again.';
    } else if (code === 'ER_BAD_NULL_ERROR') {
      status = 400;
      message = 'A required field is missing. Please check the form and try again.';
    } else if (code === 'ER_DATA_TOO_LONG') {
      status = 400;
      message = 'One of the entered values is too long. Please shorten the cluster or college name.';
    }
    res.status(status).json({ success: false, error: message });
  }
});

app.post('/api/clusters/:id/resend-credentials', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can resend cluster credentials.' });
    return;
  }
  const year = await resolveAcademicYear(req);
  if (!year) {
    res.status(404).json({ success: false, error: 'No academic year is available.' });
    return;
  }
  if (isArchivedAcademicYear(year)) {
    res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
    return;
  }

  let connection: any;
  let admin: any;
  const temporaryPassword = `TQI@Admin${randomInt(1000, 10000)}!`;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT c.id, c.name AS cluster_name, u.id AS user_id, u.name AS admin_name, u.email AS admin_email
       FROM clusters c
      INNER JOIN users u ON (u.id = c.admin_id OR u.cluster_id = c.id)
       WHERE c.id = ? AND c.academic_year_id = ?
       LIMIT 1 FOR UPDATE`,
      [req.params.id, year.id],
    );
    if (!rows.length) {
      await connection.rollback();
      res.status(404).json({ success: false, error: 'Cluster admin account was not found in the selected academic year.' });
      return;
    }
    admin = rows[0];
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    await connection.query(
      "UPDATE users SET password_hash = ?, must_change_password = TRUE, status = 'Active' WHERE id = ?",
      [passwordHash, admin.user_id],
    );
    await connection.commit();
  } catch (error) {
    await connection?.rollback().catch(() => undefined);
    console.error('Failed to reset cluster credentials:', error);
    res.status(503).json({ success: false, error: 'Unable to reset cluster credentials.' });
    return;
  } finally {
    connection?.release();
  }

  const emailSent = await sendOnboardingCredentialsEmail({
    recipient: admin.admin_email,
    name: admin.admin_name,
    temporaryPassword,
    role: 'Cluster Admin',
    clusterName: admin.cluster_name,
    projectRoot: PROJECT_ROOT,
  });
  res.json({
    success: true,
    emailSent,
    loginEmail: admin.admin_email,
    temporaryPassword,
    clusterName: admin.cluster_name,
  });
});

app.get('/api/panchayats/directory', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }

    const requestedClusterId = String(req.query.clusterId || '').trim();
    const clusterId = await resolveClusterForAcademicYear(req, year.id, requestedClusterId);
    if (!clusterId || clusterId === 'all') {
      res.status(400).json({ success: false, error: 'Select a cluster before loading its district directory.' });
      return;
    }

    const [clusterRows] = await pool.query<any[]>(
      'SELECT id, name, district FROM clusters WHERE id = ? AND academic_year_id = ? LIMIT 1',
      [clusterId, year.id],
    );
    if (!clusterRows.length) {
      res.status(404).json({ success: false, error: 'The selected cluster was not found in this academic year.' });
      return;
    }

    const district = String(clusterRows[0].district || clusterRows[0].name || '').trim()
      .replace(/\s+(district|cluster)$/i, '');
    const requestedDistrictSlug = district.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const districtSlugAliases: Record<string, string> = {
      kancheepuram: 'kanchipuram',
      kanyakumari: 'kanniyakumari',
      thoothukudi: 'tuticorin',
    };
    const districtSlug = districtSlugAliases[requestedDistrictSlug] || requestedDistrictSlug;
    if (!districtSlug) {
      res.status(422).json({ success: false, error: 'This cluster does not have a valid district name configured.' });
      return;
    }

    const sourceUrl = `https://digitalpanchayat.org/india/tamil-nadu/${districtSlug}`;
    const names = new Map<string, string>();
    const nicDistrictSlugs: Record<string, string> = {
      'the-nilgiris': 'nilgiris',
      kanyakumari: 'kanniyakumari',
      thoothukudi: 'thoothukudi',
      tuticorin: 'thoothukudi',
    };
    const officialSourceUrl = `https://${nicDistrictSlugs[requestedDistrictSlug] || districtSlug}.nic.in/village-panchayats/`;
    let officialNames = new Map<string, string>();

    try {
      const officialResponse = await fetch(officialSourceUrl, {
        headers: { Accept: 'text/html', 'User-Agent': 'TQI-ERP district panchayat directory sync' },
        signal: AbortSignal.timeout(10000),
      });
      if (officialResponse.ok) {
        const officialHtml = await officialResponse.text();
        const postStart = officialHtml.search(/<div\b[^>]*id=["']post-\d+["'][^>]*>/i);
        const mainEnd = postStart >= 0 ? officialHtml.indexOf('</main>', postStart) : -1;
        const content = postStart >= 0
          ? officialHtml.slice(postStart, mainEnd > postStart ? mainEnd : undefined)
          : '';
        const decodeText = (value: string) => value
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;|&#160;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&#39;|&apos;/gi, "'")
          .replace(/&quot;/gi, '"')
          .replace(/&#(\d+);/g, (_entity, code: string) => String.fromCodePoint(Number(code)))
          .replace(/&([a-z]+);/gi, (_entity, name: string) => ({ amp: '&', nbsp: ' ', quot: '"', apos: "'" }[name.toLowerCase()] || ' '))
          .replace(/\s+/g, ' ')
          .trim();

        const addOfficialName = (rawName: string) => {
          const name = rawName
            .replace(/^\s*\d{1,4}[.)]?\s+/, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (!name || name.length > 120 || /\b(block|village panchayat|sl\.?no|serial number)\b/i.test(name)) return;
          officialNames.set(name.toLocaleLowerCase('en'), name);
        };

        let itemMatch: RegExpExecArray | null;
        const listItemPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
        while ((itemMatch = listItemPattern.exec(content)) !== null) addOfficialName(decodeText(itemMatch[1]));

        if (!officialNames.size) {
          const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
          let rowMatch: RegExpExecArray | null;
          while ((rowMatch = rowPattern.exec(content)) !== null) {
            const cells = [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)];
            if (cells.length < 2) continue;
            const label = decodeText(cells[1][1]);
            if (!/\bblock\b/i.test(label)) addOfficialName(label);
          }
        }
      }
    } catch (officialError) {
      console.warn(`Official district panchayat page unavailable for ${district}:`, officialError);
    }

    if (officialNames.size) {
      res.json({
        success: true,
        district,
        source: 'Government of Tamil Nadu district portal',
        sourceUrl: officialSourceUrl,
        panchayats: [...officialNames.values()].sort((left, right) => left.localeCompare(right)),
      });
      return;
    }

    let resolvedSourceUrl = sourceUrl;
    let firstPageResponse = await fetch(resolvedSourceUrl, {
      headers: { Accept: 'text/html', 'User-Agent': 'TQI-ERP district panchayat directory sync' },
      signal: AbortSignal.timeout(15000),
    });
    if (firstPageResponse.status === 404) {
      const stateResponse = await fetch('https://digitalpanchayat.org/india/tamil-nadu', {
        headers: { Accept: 'text/html', 'User-Agent': 'TQI-ERP district panchayat directory sync' },
        signal: AbortSignal.timeout(15000),
      });
      if (stateResponse.ok) {
        const stateHtml = await stateResponse.text();
        const candidatePattern = /<a\b[^>]*href=["']\/india\/tamil-nadu\/([^"'?#/]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        const candidates = new Map<string, string>();
        let candidateMatch: RegExpExecArray | null;
        while ((candidateMatch = candidatePattern.exec(stateHtml)) !== null) {
          const slug = candidateMatch[1].toLowerCase();
          const label = candidateMatch[2]
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;|&#160;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/\s+/g, ' ')
            .replace(/\s+\d[\d,]*\s+villages?\s*$/i, '')
            .trim();
          if (label && !['tamil nadu', 'india'].includes(label.toLowerCase())) candidates.set(slug, label);
        }

        const normalizeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
        const requestedNames = new Set([requestedDistrictSlug, districtSlug, normalizeName(district)]);
        const exactCandidate = [...candidates].find(([slug, label]) =>
          requestedNames.has(slug) || requestedNames.has(normalizeName(label)),
        );

        if (exactCandidate) {
          resolvedSourceUrl = `https://digitalpanchayat.org/india/tamil-nadu/${exactCandidate[0]}`;
        } else {
          const editDistance = (left: string, right: string): number => {
            const row = Array.from({ length: right.length + 1 }, (_, index) => index);
            for (let i = 1; i <= left.length; i += 1) {
              let previous = row[0];
              row[0] = i;
              for (let j = 1; j <= right.length; j += 1) {
                const old = row[j];
                row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
                previous = old;
              }
            }
            return row[right.length];
          };
          const target = normalizeName(district);
          const ranked = [...candidates].map(([slug, label]) => ({ slug, distance: editDistance(target, normalizeName(label)) }))
            .sort((left, right) => left.distance - right.distance);
          if (ranked[0]?.distance <= 2 && ranked[0].distance < (ranked[1]?.distance ?? Number.POSITIVE_INFINITY)) {
            resolvedSourceUrl = `https://digitalpanchayat.org/india/tamil-nadu/${ranked[0].slug}`;
          }
        }
      }

      if (resolvedSourceUrl !== sourceUrl) {
        firstPageResponse = await fetch(resolvedSourceUrl, {
          headers: { Accept: 'text/html', 'User-Agent': 'TQI-ERP district panchayat directory sync' },
          signal: AbortSignal.timeout(15000),
        });
      }
    }
    if (!firstPageResponse.ok) {
      throw new Error(`District directory returned HTTP ${firstPageResponse.status}.`);
    }
    const firstPageHtml = await firstPageResponse.text();
    const paginationPageNumbers = [...firstPageHtml.matchAll(/[?&]gp=(\d+)/g)].map((match) => Number(match[1]));
    const reportedTotalMatch = firstPageHtml.match(/Showing\s+\d+\s*[–-]\s*\d+\s+of\s+([\d,]+)/i);
    const reportedTotal = reportedTotalMatch ? Number(reportedTotalMatch[1].replace(/,/g, '')) : 0;
    const pageCount = Math.max(1, ...paginationPageNumbers, Math.ceil(reportedTotal / 50));
    if (pageCount > 300) {
      throw new Error(`District directory reported an invalid page count (${pageCount}).`);
    }

    for (let page = 1; page <= pageCount; page += 1) {
      let html = firstPageHtml;
      if (page > 1) {
        const directoryResponse = await fetch(`${resolvedSourceUrl}?gp=${page}`, {
          headers: { Accept: 'text/html', 'User-Agent': 'TQI-ERP district panchayat directory sync' },
          signal: AbortSignal.timeout(15000),
        });
        if (!directoryResponse.ok) {
          throw new Error(`District directory page ${page} returned HTTP ${directoryResponse.status}.`);
        }
        html = await directoryResponse.text();
      }
      const escapedDistrictPath = new RegExp(
        `<a\\b[^>]*href=["']\\/india\\/tamil-nadu\\/${districtSlug}\\/[^"']+-gram-panchayat["'][^>]*>([\\s\\S]*?)<\\/a>`,
        'gi',
      );
      const pageNames = new Map<string, string>();
      let match: RegExpExecArray | null;
      while ((match = escapedDistrictPath.exec(html)) !== null) {
        const label = match[1]
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;|&#160;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&#39;|&apos;/gi, "'")
          .replace(/&quot;/gi, '"')
          .replace(/&#(\d+);/g, (_entity, code: string) => String.fromCodePoint(Number(code)))
          .replace(/\s+/g, ' ')
          .replace(/\s*\d+\s+villages?\s*$/i, '')
          .trim();
        if (label) pageNames.set(label.toLocaleLowerCase('en'), label);
      }

      if (!pageNames.size) {
        throw new Error(`District directory page ${page} contained no Panchayat names; refusing to return an incomplete list.`);
      }
      pageNames.forEach((name, key) => names.set(key, names.get(key) || name));
    }

    if (!names.size) {
      res.status(502).json({ success: false, error: `No Gram Panchayat list was found for ${district}.` });
      return;
    }

    // Keep the first official display spelling while deduplicating case-insensitively.
    res.json({
      success: true,
      district,
      source: 'LGD via Digital Panchayat',
      sourceUrl: resolvedSourceUrl,
      panchayats: [...names.values()].sort((left, right) => left.localeCompare(right)),
    });
  } catch (error: any) {
    console.error('Failed to fetch district panchayat directory:', error);
    res.status(502).json({ success: false, error: error?.name === 'TimeoutError' ? 'District directory request timed out.' : error?.message || 'Unable to fetch the district panchayat directory.' });
  }
});

app.get('/api/panchayats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    const user = req.user;
    let sql = 'SELECT p.id, p.name, p.cluster_id, p.academic_year_id, c.name AS cluster_name, COUNT(v.id) AS villages_count FROM panchayats p LEFT JOIN villages v ON v.panchayat_id = p.id AND v.academic_year_id = p.academic_year_id LEFT JOIN clusters c ON c.id = p.cluster_id AND c.academic_year_id = p.academic_year_id';
    const params: any[] = [year.id];
    const where: string[] = ['p.academic_year_id = ?'];

    if (user.role === 'Cluster Admin') {
      const clusterId = await resolveClusterForAcademicYear(req, year.id);
      where.push('p.cluster_id = ?');
      params.push(clusterId);
    } else if (cluster !== 'all') {
      where.push('p.cluster_id = ?');
      params.push(cluster);
    }

    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' GROUP BY p.id, p.name, p.cluster_id, p.academic_year_id, c.name ORDER BY p.name ASC';

    const [rows] = await pool.query<any[]>(sql, params);
    
    // Eager-load villages for these panchayats
    const panchayatIds = rows.map(r => r.id);
    let villagesByPanchayat: Record<string, any[]> = {};
    if (panchayatIds.length > 0) {
      const [vRows] = await pool.query<any[]>(
        'SELECT v.id, v.name, v.panchayat_id, COUNT(s.id) AS student_count FROM villages v LEFT JOIN students s ON s.village_id = v.id AND s.academic_year_id = v.academic_year_id WHERE v.panchayat_id IN (?) AND v.academic_year_id = ? GROUP BY v.id, v.name, v.panchayat_id ORDER BY v.name ASC',
        [panchayatIds, year.id]
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
        academicYearId: row.academic_year_id,
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
  let connection: any;
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
    if (!name) {
      res.status(400).json({ success: false, error: 'Panchayat name is required.' });
      return;
    }
    const requestedClusterId = String(req.body.clusterId || '').trim();
    if (!requestedClusterId || requestedClusterId === 'all') {
      res.status(400).json({ success: false, error: 'Select a cluster before creating a panchayat.' });
      return;
    }
    const clusterId = await resolveClusterForAcademicYear(req, year.id, requestedClusterId);
    if (!clusterId || clusterId === 'all') {
      res.status(400).json({ success: false, error: 'Select a valid cluster for this academic year.' });
      return;
    }

    const panchayatId = `pan-${randomUUID()}`;
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [clusterRows] = await connection.query(
      'SELECT id, name, district FROM clusters WHERE id = ? AND academic_year_id = ? LIMIT 1 FOR UPDATE',
      [clusterId, year.id],
    );
    if (!clusterRows.length) {
      await connection.rollback();
      res.status(404).json({ success: false, error: 'The selected cluster was not found in this academic year.' });
      return;
    }
    const [existingRows] = await connection.query(
      'SELECT id FROM panchayats WHERE academic_year_id = ? AND cluster_id = ? AND LOWER(TRIM(name)) = LOWER(?) LIMIT 1 FOR UPDATE',
      [year.id, clusterId, name],
    );
    if (existingRows.length) {
      await connection.rollback();
      res.status(409).json({ success: false, error: 'This Panchayat already exists in this Cluster for the selected Academic Year.' });
      return;
    }

    await connection.query(
      'INSERT INTO panchayats (id, name, cluster_id, status, academic_year_id) VALUES (?, ?, ?, ?, ?)',
      [panchayatId, name, clusterId, 'Active', year.id],
    );
    await connection.commit();

    res.status(201).json({ success: true, panchayat: {
      id: panchayatId,
      name,
      academicYearId: year.id,
      clusterId,
      cluster: clusterRows[0].name,
      district: clusterRows[0].district,
      villagesCount: 0,
      activeStudents: 0,
      volunteersCount: 0,
      status: 'On Track',
      villages: [],
    } });
  } catch (error: any) {
    await connection?.rollback().catch(() => undefined);
    console.error('Failed to create panchayat:', error);
    if (error?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ success: false, error: 'This Panchayat already exists in this Cluster for the selected Academic Year.' });
      return;
    }
    res.status(500).json({ success: false, error: 'Unable to save panchayat.' });
  } finally {
    connection?.release();
  }
});

app.post('/api/panchayats/import', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  let connection: any;
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }

    const requestedClusterId = String(req.body?.clusterId || '').trim();
    const rawNames = Array.isArray(req.body?.names) ? (req.body.names as unknown[]) : [];
    if (!requestedClusterId || requestedClusterId === 'all') {
      res.status(400).json({ success: false, error: 'Select a cluster before importing panchayats.' });
      return;
    }

    const clusterId = await resolveClusterForAcademicYear(req, year.id, requestedClusterId);
    if (!clusterId || clusterId === 'all') {
      res.status(400).json({ success: false, error: 'Select a valid cluster for this academic year.' });
      return;
    }

    const names = Array.from(
      new Set(
        rawNames
          .map((name: unknown) => String(name || '').trim().replace(/\s+/g, ' '))
          .filter((name: string) => name.length > 1),
      ),
    );

    if (!names.length) {
      res.status(400).json({ success: false, error: 'No panchayat names were provided for import.' });
      return;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [clusterRows] = await connection.query(
      'SELECT id, name, district FROM clusters WHERE id = ? AND academic_year_id = ? LIMIT 1 FOR UPDATE',
      [clusterId, year.id],
    );
    if (!clusterRows.length) {
      await connection.rollback();
      res.status(404).json({ success: false, error: 'The selected cluster was not found in this academic year.' });
      return;
    }

    const [existingRows] = await connection.query(
      'SELECT id, name FROM panchayats WHERE academic_year_id = ? AND cluster_id = ? FOR UPDATE',
      [year.id, clusterId],
    );
    const existingNames = new Set(existingRows.map((row: any) => String(row.name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en')));
    const panchayats = names
      .filter((name) => !existingNames.has(name.toLocaleLowerCase('en')))
      .map((name) => ({
        id: `pan-${randomUUID()}`,
        name,
        clusterId,
        cluster: clusterRows[0].name,
        district: clusterRows[0].district,
        academicYearId: year.id,
        villagesCount: 0,
        activeStudents: 0,
        volunteersCount: 0,
        status: 'On Track',
        villages: [],
      }));

    if (panchayats.length) {
      await connection.query(
        'INSERT INTO panchayats (id, name, cluster_id, status, academic_year_id) VALUES ?',
        [panchayats.map((panchayat: any) => [panchayat.id, panchayat.name, clusterId, 'Active', year.id])],
      );
    }

    const importedNames = new Set(panchayats.map((panchayat: any) => panchayat.name.toLocaleLowerCase('en')));
    const skipped = names.filter((name) => !importedNames.has(name.toLocaleLowerCase('en')));

    await connection.commit();
    res.status(201).json({ success: true, created: panchayats.length, skipped, panchayats });
  } catch (error: any) {
    await connection?.rollback().catch(() => undefined);
    console.error('Failed to bulk import panchayats:', error);
    res.status(500).json({ success: false, error: 'Unable to import panchayats.' });
  } finally {
    connection?.release();
  }
});

app.get('/api/schools', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const params: any[] = [year.id];
    let sql = 'SELECT sc.*, c.name AS cluster_name, p.name AS panchayat_name, v.name AS village_name FROM schools sc LEFT JOIN clusters c ON c.id = sc.cluster_id LEFT JOIN panchayats p ON p.id = sc.panchayat_id LEFT JOIN villages v ON v.id = sc.village_id WHERE sc.academic_year_id = ?';
    if (req.user.role === 'Cluster Admin') {
      const clusterId = await resolveClusterForAcademicYear(req, year.id);
      sql += ' AND sc.cluster_id = ?';
      params.push(clusterId);
    }
    if (req.query.panchayatId) {
      sql += ' AND sc.panchayat_id = ?';
      params.push(String(req.query.panchayatId));
    }
    if (req.query.villageId) {
      sql += ' AND sc.village_id = ?';
      params.push(String(req.query.villageId));
    }
    sql += ' ORDER BY sc.name ASC';
    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ success: true, schools: rows });
  } catch (error) {
    console.error('Failed to load schools:', error);
    res.status(503).json({ success: false, error: 'Unable to load schools.' });
  }
});

app.post('/api/schools', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const name = String(req.body.name || '').trim();
    const villageId = String(req.body.villageId || '').trim();
    if (!name || !villageId) {
      res.status(400).json({ success: false, error: 'School name and village are required.' });
      return;
    }
    const [villageRows] = await pool.query<any[]>(
      'SELECT id, panchayat_id, cluster_id FROM villages WHERE id = ? AND academic_year_id = ? LIMIT 1',
      [villageId, year.id],
    );
    if (!villageRows.length) {
      res.status(404).json({ success: false, error: 'Village not found in the selected academic year.' });
      return;
    }
    const village = villageRows[0];
    const id = `school-${randomUUID()}`;
    await pool.query(
      'INSERT INTO schools (id, name, academic_year_id, cluster_id, panchayat_id, village_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = \'ACTIVE\'',
      [id, name, year.id, village.cluster_id, village.panchayat_id, village.id],
    );
    const [schoolRows] = await pool.query<any[]>('SELECT * FROM schools WHERE academic_year_id = ? AND village_id = ? AND name = ? LIMIT 1', [year.id, villageId, name]);
    res.status(201).json({ success: true, school: schoolRows[0] });
  } catch (error: any) {
    console.error('Failed to create school:', error);
    res.status(error?.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ success: false, error: error?.code === 'ER_DUP_ENTRY' ? 'This school already exists in the village.' : 'Unable to create school.' });
  }
});

app.get('/api/students', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    const panchayatId = req.query.panchayatId ? String(req.query.panchayatId) : null;
    const villageId = req.query.villageId ? String(req.query.villageId) : null;

    let sql = `SELECT s.id, s.name, s.code, s.gender, s.dob, s.standard, s.cluster_id, s.panchayat_id, s.village_id, s.parent_name, s.phone, s.status, s.school_name, s.academic_year_id, p.name AS panchayat_name, v.name AS village_name FROM students s LEFT JOIN panchayats p ON p.id = s.panchayat_id AND p.academic_year_id = s.academic_year_id LEFT JOIN villages v ON v.id = s.village_id AND v.academic_year_id = s.academic_year_id WHERE s.academic_year_id = ?`;
    const params: any[] = [year.id];

    if (req.user.role === 'Cluster Admin') {
      const clusterId = await resolveClusterForAcademicYear(req, year.id);
      sql += ' AND s.cluster_id = ?';
      params.push(clusterId);
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
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const id = String(req.body.id || `student-${Date.now()}`).trim();
    const name = String(req.body.name || 'New Student').trim();
    if (!isAllowedStudentStandard(req.body.standard)) {
      res.status(400).json({ success: false, error: 'Student standard must be between 9 and 12.' });
      return;
    }
    const rawPanchayatId = req.body.panchayatId ? String(req.body.panchayatId).trim() : null;
    const panchayatId = rawPanchayatId && rawPanchayatId !== 'all' ? rawPanchayatId : null;
    const rawVillageId = req.body.villageId ? String(req.body.villageId).trim() : null;
    const villageId = rawVillageId && rawVillageId !== 'all' ? rawVillageId : null;
    if (!panchayatId || !villageId) {
      res.status(400).json({ success: false, error: 'Select a valid panchayat and village before saving a student.' });
      return;
    }
    const [locationRows] = await pool.query<any[]>(
      `SELECT p.cluster_id, p.name AS panchayat_name, v.name AS village_name
       FROM panchayats p JOIN villages v
         ON v.panchayat_id = p.id AND v.academic_year_id = p.academic_year_id
       WHERE p.id = ? AND v.id = ? AND p.academic_year_id = ?`,
      [panchayatId, villageId, year.id],
    );
    if (!locationRows.length) {
      res.status(400).json({ success: false, error: 'The selected village does not belong to this panchayat and academic year.' });
      return;
    }
    const clusterId = String(locationRows[0].cluster_id);
    const requestedClusterId = String(req.body.clusterId || '').trim();
    const allowedClusterId = await resolveClusterForAcademicYear(req, year.id, requestedClusterId);
    if (req.user.role === 'Cluster Admin' && allowedClusterId !== clusterId) {
      res.status(403).json({ success: false, error: 'The selected panchayat is outside your assigned cluster.' });
      return;
    }
    if (requestedClusterId && requestedClusterId !== 'all' && allowedClusterId !== clusterId) {
      res.status(400).json({ success: false, error: 'The selected cluster does not match the panchayat.' });
      return;
    }

    await pool.query(
      `INSERT INTO students (id, code, name, gender, dob, standard, cluster_id, panchayat_id, village_id, parent_name, phone, status, school_name, academic_year_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE code = VALUES(code), name = VALUES(name), gender = VALUES(gender), dob = VALUES(dob), standard = VALUES(standard), cluster_id = VALUES(cluster_id), panchayat_id = VALUES(panchayat_id), village_id = VALUES(village_id), parent_name = VALUES(parent_name), phone = VALUES(phone), status = VALUES(status), school_name = VALUES(school_name), academic_year_id = VALUES(academic_year_id)`,
      [id, String(req.body.code || id), name, String(req.body.gender || 'female'), String(req.body.dob || '2014-01-01'), String(req.body.standard || '6th Standard'), clusterId, panchayatId, villageId, String(req.body.parentName || 'Parent'), String(req.body.phone || ''), String(req.body.status || 'Active'), String(req.body.schoolName || ''), year.id]
    );

    res.json({ success: true, student: { id, code: String(req.body.code || id), name, gender: req.body.gender || 'female', dob: req.body.dob || '2014-01-01', standard: req.body.standard || '6th Standard', clusterId, panchayatId: panchayatId || '', panchayatName: req.body.panchayatName || panchayatId || '', villageId: villageId || '', villageName: req.body.villageName || villageId || '', parentName: req.body.parentName || 'Parent', phone: req.body.phone || '', status: req.body.status || 'active' } });
  } catch (error) {
    console.error('Failed to create student:', error);
    res.status(500).json({ success: false, error: 'Unable to save student.' });
  }
});

app.get('/api/volunteers', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    let sql = `SELECT v.id, v.name, v.gender, v.email, v.phone, v.department, v.study_year, v.cluster_id, v.panchayat_id, v.village_id, v.academic_year_id, p.name AS panchayat_name, v.role, v.status, COALESCE(v.college_name, c.college_name) AS college_name FROM volunteers v LEFT JOIN panchayats p ON p.id = v.panchayat_id LEFT JOIN clusters c ON c.id = v.cluster_id AND c.academic_year_id = v.academic_year_id WHERE v.academic_year_id = ?`;
    const params: any[] = [year.id];

    if (req.user.role === 'Cluster Admin') {
      const clusterId = await resolveClusterForAcademicYear(req, year.id);
      sql += ' AND v.cluster_id = ?';
      params.push(clusterId);
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
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    let clusterId = await resolveClusterForAcademicYear(req, year.id, String(req.body.clusterId || ''));
    if (!clusterId || clusterId === 'all') {
      const [clusterRows] = await pool.query<any[]>('SELECT id FROM clusters ORDER BY created_at ASC LIMIT 1');
      clusterId = clusterRows[0]?.id || 'dharmapuri-ksr';
    }
    const id = String(req.body.id || `volunteer-${Date.now()}`).trim();
    const rawPanchayatId = req.body.panchayatId ? String(req.body.panchayatId).trim() : null;
    const panchayatId = rawPanchayatId && rawPanchayatId !== 'all' ? rawPanchayatId : null;

    await pool.query(
      'INSERT INTO volunteers (id, name, gender, email, phone, college_name, study_year, cluster_id, panchayat_id, village_id, department, role, status, academic_year_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), gender = VALUES(gender), email = VALUES(email), phone = VALUES(phone), college_name = VALUES(college_name), study_year = VALUES(study_year), cluster_id = VALUES(cluster_id), panchayat_id = VALUES(panchayat_id), village_id = VALUES(village_id), department = VALUES(department), role = VALUES(role), status = VALUES(status), academic_year_id = VALUES(academic_year_id)',
      [id, String(req.body.name || 'Volunteer').trim(), ['male', 'female', 'other'].includes(String(req.body.gender || '').toLowerCase()) ? String(req.body.gender).toLowerCase() : null, String(req.body.email || ''), String(req.body.phone || ''), String(req.body.college || '').trim() || null, String(req.body.year || '').trim() || null, clusterId, panchayatId, req.body.villageId || null, String(req.body.department || 'Community Program'), String(req.body.role || 'Mentor'), String(req.body.status || 'Active'), year.id]
    );
    res.json({ success: true, volunteer: { id, name: req.body.name || 'Volunteer', gender: req.body.gender || '', email: req.body.email || '', phone: req.body.phone || '', college: req.body.college || '', clusterId, panchayatId: panchayatId || '', department: req.body.department || 'Community Program', role: req.body.role || 'Mentor', status: req.body.status || 'Active' } });
  } catch (error) {
    console.error('Failed to save volunteer:', error);
    res.status(500).json({ success: false, error: 'Unable to save volunteer.' });
  }
});

app.get('/api/sessions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await ensureAcademicSetupTable();
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    // Unsaved academic setup days use a deterministic id within VARCHAR(64).
    let sql = `
      SELECT
        COALESCE(s.id, CONCAT('academic-session-', LEFT(SHA2(CONCAT(c.id, ':', a.academic_year_id), 256), 32), '-', a.day_number)) AS id,
        CONCAT('DAY-', a.day_number) AS code,
        a.academic_year,
        a.day_number,
        a.session_name,
        c.id AS cluster_id,
        c.name AS cluster_name,
        COALESCE(s.date, a.session_date) AS date,
        s.time,
        s.panchayat_id,
        p.name AS panchayat_name,
        s.target_locations_json,
        s.session_date_fixed,
        s.village_id,
        v.name AS village_name,
        s.volunteer_id,
        assigned_volunteer.name AS volunteer_name,
        COALESCE(s.session_status, 'Draft') AS session_status,
        NULL AS module_id,
        s.id AS saved_session_id
      FROM academic_setup a
      JOIN clusters c ON c.academic_year_id = a.academic_year_id
      LEFT JOIN sessions s
        ON s.academic_year_id = a.academic_year_id
        AND s.cluster_id = c.id
        AND (s.day_number = a.day_number OR
          s.id = CONCAT('academic-session-', LEFT(SHA2(CONCAT(c.id, ':', a.academic_year_id), 256), 32), '-', a.day_number)
          OR s.id = CONCAT('academic-session-', c.id, '-', a.academic_year_id, '-', a.day_number)
          OR s.id = CONCAT('academic-session-', c.id, '-', a.day_number)
        )
      LEFT JOIN panchayats p ON p.id = s.panchayat_id AND p.academic_year_id = a.academic_year_id
      LEFT JOIN villages v ON v.id = s.village_id AND v.panchayat_id = s.panchayat_id AND v.academic_year_id = a.academic_year_id
      LEFT JOIN volunteers assigned_volunteer ON assigned_volunteer.id = s.volunteer_id AND assigned_volunteer.academic_year_id = a.academic_year_id
      WHERE a.academic_year_id = ? AND c.academic_year_id = ?
        AND a.session_name IS NOT NULL AND TRIM(a.session_name) <> ''`;
    const params: any[] = [year.id, year.id];

    if (req.user.role === 'Cluster Admin') {
      const clusterId = await resolveClusterForAcademicYear(req, year.id);
      sql += ' AND c.id = ?';
      params.push(clusterId);
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
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    let clusterId = await resolveClusterForAcademicYear(req, year.id, String(req.body.clusterId || ''));
    if (!clusterId || clusterId === 'all') {
      const [clusterRows] = await pool.query<any[]>('SELECT id FROM clusters WHERE academic_year_id = ? ORDER BY created_at ASC LIMIT 1', [year.id]);
      clusterId = clusterRows[0]?.id || 'dharmapuri-ksr';
    }
    const dayNumber = Number(req.body.dayNumber || 1);
    const id = String(req.body.id || academicSessionId(clusterId, year.id, dayNumber)).trim();
    const date = String(req.body.date || new Date().toISOString().split('T')[0]);
    if (req.user.role === 'Cluster Admin') {
      const [existingSessions] = await pool.query<any[]>(
        'SELECT date, session_date_fixed FROM sessions WHERE id = ? AND cluster_id = ? AND academic_year_id = ? LIMIT 1',
        [id, clusterId, year.id],
      );
      const existingDate = existingSessions[0]?.date ? new Date(existingSessions[0].date).toISOString().slice(0, 10) : null;
      if (Boolean(existingSessions[0]?.session_date_fixed) && existingDate !== date) {
        res.status(403).json({ success: false, error: 'This date is confirmed. Request a date change for Super Admin approval.' });
        return;
      }
    }
    const rawPanchayatId = req.body.panchayatId ? String(req.body.panchayatId).trim() : null;
    const panchayatId = rawPanchayatId && rawPanchayatId !== 'all' ? rawPanchayatId : null;
    const rawVillageId = req.body.villageId ? String(req.body.villageId).trim() : null;
    const villageId = rawVillageId && rawVillageId !== 'all' ? rawVillageId : null;
    const rawVolunteerId = req.body.volunteerId ? String(req.body.volunteerId).trim() : null;
    const volunteerId = rawVolunteerId && rawVolunteerId !== 'all' ? rawVolunteerId : null;

    const targets = Array.isArray(req.body.targetLocations) ? req.body.targetLocations : null;
    const targetsJson = targets ? JSON.stringify({ locations: targets, reason: String(req.body.targetLocationReason || '').trim() }) : null;
    const primaryTarget = targets?.[0];
    await pool.query(
      'INSERT INTO sessions (id, code, name, module_id, cluster_id, panchayat_id, target_locations_json, village_id, volunteer_id, academic_year, academic_year_id, day_number, date, time, session_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE code = VALUES(code), name = VALUES(name), module_id = VALUES(module_id), cluster_id = VALUES(cluster_id), panchayat_id = VALUES(panchayat_id), target_locations_json = COALESCE(VALUES(target_locations_json), target_locations_json), village_id = VALUES(village_id), volunteer_id = VALUES(volunteer_id), academic_year = VALUES(academic_year), academic_year_id = VALUES(academic_year_id), day_number = VALUES(day_number), date = VALUES(date), time = VALUES(time), session_status = VALUES(session_status)',
      [id, String(req.body.code || id), String(req.body.name || 'Session').trim(), String(req.body.moduleId || 'module-english'), clusterId, primaryTarget?.panchayatId || panchayatId, targetsJson, primaryTarget?.villageId || villageId, volunteerId, year.name, year.id, dayNumber, date, String(req.body.time || '09:00'), String(req.body.status || 'Scheduled')]
    );

    res.json({ success: true, session: { id, code: String(req.body.code || id), name: req.body.name || 'Session', clusterId, panchayatId: panchayatId || '', villageId: villageId || '', date, time: req.body.time || '09:00', status: req.body.status || 'Draft' } });
  } catch (error) {
    console.error('Failed to save session:', error);
    res.status(500).json({ success: false, error: 'Unable to save session.' });
  }
});

app.put('/api/sessions/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Cluster Admin' && req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only administrators can update session schedules.' });
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

  if (!academicYear || !Number.isInteger(dayNumber) || dayNumber < 1 || !sessionName) {
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

  const requestedTargets = Array.isArray(req.body.targetLocations) ? req.body.targetLocations : null;
  let targetLocationsJson: string | null = null;
  let primaryPanchayatId: string | null = req.body.panchayatId ? String(req.body.panchayatId) : null;
  let primaryVillageId: string | null = req.body.villageId ? String(req.body.villageId) : null;

  try {
    const year = await resolveAcademicYear(req);
    if (!year || year.name !== academicYear) {
      res.status(400).json({ success: false, error: 'The selected academic year does not match the schedule.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const requestedClusterId = String(req.body.clusterId || '').trim();
    const clusterId = await resolveClusterForAcademicYear(req, year.id, requestedClusterId);
    if (!clusterId) {
      res.status(400).json({ success: false, error: 'A valid target cluster is required.' });
      return;
    }
    if (req.user.role === 'Cluster Admin' && requestedClusterId && requestedClusterId !== clusterId) {
      res.status(403).json({ success: false, error: 'The selected session is outside your cluster.' });
      return;
    }
    if (req.user.role === 'Cluster Admin') {
      if (Boolean(req.body.dateFixed)) {
        res.status(403).json({ success: false, error: 'Only Super Admin can confirm a session date.' });
        return;
      }
      const [currentSchedule] = await pool.query<any[]>(
        'SELECT date, session_date_fixed FROM sessions WHERE id = ? AND academic_year_id = ? AND cluster_id = ? LIMIT 1',
        [req.params.id, year.id, clusterId],
      );
      const currentDate = currentSchedule[0]?.date ? new Date(currentSchedule[0].date).toISOString().slice(0, 10) : null;
      if (Boolean(currentSchedule[0]?.session_date_fixed) && (currentDate || null) !== (date || null)) {
        res.status(403).json({ success: false, error: 'This date is confirmed. Request a date change for Super Admin approval.' });
        return;
      }
    }
    if (requestedTargets) {
      if (!requestedTargets.length) {
        res.status(400).json({ success: false, error: 'Choose at least one panchayat and village target.' });
        return;
      }
      const verifiedTargets: Array<{ panchayatId: string; panchayatName: string; villageId: string; villageName: string }> = [];
      for (const target of requestedTargets) {
        const targetPanchayatId = String(target.panchayatId || '').trim();
        const targetVillageId = String(target.villageId || '').trim();
        if (!targetPanchayatId || !targetVillageId) {
          res.status(400).json({ success: false, error: 'Each scheduled target must include one panchayat and village.' });
          return;
        }
        const [locationRows] = await pool.query<any[]>(
          `SELECT p.id AS panchayat_id, p.name AS panchayat_name, v.id AS village_id, v.name AS village_name
           FROM panchayats p JOIN villages v ON v.panchayat_id = p.id AND v.academic_year_id = p.academic_year_id
           WHERE p.id = ? AND v.id = ? AND p.cluster_id = ? AND p.academic_year_id = ? LIMIT 1`,
          [targetPanchayatId, targetVillageId, clusterId, year.id],
        );
        if (!locationRows.length) {
          res.status(400).json({ success: false, error: 'A selected village does not belong to its panchayat and cluster.' });
          return;
        }
        verifiedTargets.push({
          panchayatId: String(locationRows[0].panchayat_id),
          panchayatName: String(locationRows[0].panchayat_name),
          villageId: String(locationRows[0].village_id),
          villageName: String(locationRows[0].village_name),
        });
      }
      primaryPanchayatId = verifiedTargets[0].panchayatId;
      primaryVillageId = verifiedTargets[0].villageId;
      targetLocationsJson = JSON.stringify({ locations: verifiedTargets, reason: String(req.body.targetLocationReason || '').trim() });
    }
    const id = academicSessionId(clusterId, year.id, dayNumber);
    // v2 sessions: only snake_case columns; title/academic_year/day_number/
    // session_name_snapshot/status were dropped. The session name lives in
    // academic_setup.session_name (joined on the read path).
    await pool.query(
      `INSERT INTO sessions (id, name, cluster_id, panchayat_id, target_locations_json, village_id, volunteer_id, academic_year, academic_year_id, day_number, date, session_date_fixed, session_date_fixed_at, session_date_fixed_by, session_status)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, IF(?, NOW(), NULL), IF(?, ?, NULL), ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), cluster_id = VALUES(cluster_id), panchayat_id = VALUES(panchayat_id), target_locations_json = COALESCE(VALUES(target_locations_json), target_locations_json), village_id = VALUES(village_id), volunteer_id = NULL, academic_year = VALUES(academic_year), academic_year_id = VALUES(academic_year_id), day_number = VALUES(day_number), date = VALUES(date), session_date_fixed = IF(VALUES(session_date_fixed), 1, session_date_fixed), session_date_fixed_at = IF(VALUES(session_date_fixed), COALESCE(session_date_fixed_at, NOW()), session_date_fixed_at), session_date_fixed_by = IF(VALUES(session_date_fixed), VALUES(session_date_fixed_by), session_date_fixed_by), session_status = VALUES(session_status)`,
      [
        id,
        sessionName,
        clusterId,
        primaryPanchayatId,
        targetLocationsJson,
        primaryVillageId,
        year.name,
        year.id,
        dayNumber,
        date,
        Boolean(req.body.dateFixed),
        Boolean(req.body.dateFixed),
        Boolean(req.body.dateFixed),
        req.body.dateFixed ? (req.user.name || req.user.id) : null,
        status,
      ],
    );
    res.json({ success: true, status, date });
  } catch (error) {
    console.error('Failed to update session schedule:', error);
    res.status(503).json({ success: false, error: 'Unable to save session schedule.' });
  }
});

app.put('/api/sessions/:id/approve-date', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can approve and confirm a session date.' });
    return;
  }
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const clusterId = await resolveClusterForAcademicYear(req, year.id, String(req.body.clusterId || ''));
    const dayNumber = Number(req.body.dayNumber);
    const date = String(req.body.date || '').trim();
    if (!clusterId || !Number.isInteger(dayNumber) || dayNumber < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ success: false, error: 'Select a valid cluster, academic day, and session date.' });
      return;
    }
    const [setupRows] = await pool.query<any[]>(
      'SELECT session_name FROM academic_setup WHERE academic_year_id = ? AND day_number = ? LIMIT 1',
      [year.id, dayNumber],
    );
    if (!setupRows.length || !String(setupRows[0].session_name || '').trim()) {
      res.status(409).json({ success: false, error: 'Configure this day in Academic Setup before approving its date.' });
      return;
    }
    const [existingRows] = await pool.query<any[]>(
      'SELECT id FROM sessions WHERE cluster_id = ? AND academic_year_id = ? AND day_number = ? ORDER BY updated_at DESC LIMIT 1',
      [clusterId, year.id, dayNumber],
    );
    const id = String(existingRows[0]?.id || academicSessionId(clusterId, year.id, dayNumber));
    const sessionName = String(setupRows[0].session_name).trim();
    await pool.query(
      `INSERT INTO sessions (id, code, name, cluster_id, academic_year, academic_year_id, day_number, date, session_date_fixed, session_date_fixed_at, session_date_fixed_by, session_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), ?, 'Scheduled')
       ON DUPLICATE KEY UPDATE name = VALUES(name), cluster_id = VALUES(cluster_id), academic_year = VALUES(academic_year), academic_year_id = VALUES(academic_year_id), day_number = VALUES(day_number), date = VALUES(date), session_date_fixed = 1, session_date_fixed_at = NOW(), session_date_fixed_by = VALUES(session_date_fixed_by), session_status = 'Scheduled'`,
      [id, `DAY-${dayNumber}`, sessionName, clusterId, year.name, year.id, dayNumber, date, req.user.name || req.user.id],
    );
    const [clusterRows] = await pool.query<any[]>(
      'SELECT source_cluster_id FROM clusters WHERE id = ? LIMIT 1',
      [clusterId],
    );
    const recipientClusterIds = [...new Set([clusterId, clusterRows[0]?.source_cluster_id].filter(Boolean))];
    const [clusterAdmins] = await pool.query<any[]>(
      `SELECT id, name, email FROM users WHERE LOWER(role) IN ('cluster admin', 'cluster_admin') AND cluster_id IN (?) AND status = 'Active'`,
      [recipientClusterIds],
    );
    for (const admin of clusterAdmins) {
      await pool.query(
        'INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())',
        [randomUUID(), admin.id, 'Session date approved', `Super Admin confirmed Day ${dayNumber} (${sessionName}) for ${date}.`, 'session'],
      );
      if (admin.email) {
        await sendWorkflowEmail({
          recipient: admin.email,
          recipientName: admin.name || 'Cluster Admin',
          projectRoot: PROJECT_ROOT,
          title: 'Session Date Approved',
          summary: `The Super Admin approved and confirmed Day ${dayNumber} (${sessionName}).`,
          details: [{ label: 'Date', value: date }, { label: 'Academic year', value: year.name }],
          actionLabel: 'Open TQI ERP',
          actionUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
        });
      }
    }
    res.json({ success: true, session: { id, clusterId, dayNumber, name: sessionName, date, dateFixed: true, status: 'Scheduled' } });
  } catch (error) {
    console.error('Failed to approve session date:', error);
    res.status(503).json({ success: false, error: 'Unable to approve session date.' });
  }
});

app.get('/api/attendance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    let sql = `SELECT attendance.*,
        clusters.name AS cluster_name,
        panchayats.name AS panchayat_name,
        villages.name AS village_name,
        setup.session_name,
        COALESCE(setup.session_date, scheduled.date) AS session_date
      FROM attendance_sessions attendance
      LEFT JOIN clusters ON clusters.id = attendance.cluster_id AND clusters.academic_year_id = attendance.academic_year_id
      LEFT JOIN panchayats ON panchayats.id = attendance.panchayat_id AND panchayats.academic_year_id = attendance.academic_year_id
      LEFT JOIN villages ON villages.id = attendance.village_id AND villages.academic_year_id = attendance.academic_year_id
      LEFT JOIN academic_setup setup ON setup.academic_year_id = attendance.academic_year_id AND setup.day_number = attendance.day_number
      LEFT JOIN sessions scheduled ON scheduled.id = attendance.session_id AND scheduled.academic_year_id = attendance.academic_year_id
      WHERE attendance.academic_year_id = ?`;
    const params: any[] = [year.id];

    if (req.user.role === 'Cluster Admin') {
      const clusterId = await resolveClusterForAcademicYear(req, year.id);
      sql += ' AND attendance.cluster_id = ?';
      params.push(clusterId);
    } else if (cluster !== 'all') {
      sql += ' AND attendance.cluster_id = ?';
      params.push(cluster);
    }

    sql += ' ORDER BY attendance.day_number ASC, clusters.name ASC, panchayats.name ASC, villages.name ASC';
    const [rows] = await pool.query<any[]>(sql, params);
    const attendanceIds = rows.map((row) => String(row.id));
    const studentsByAttendance = new Map<string, any[]>();
    const volunteersByAttendance = new Map<string, any[]>();
    if (attendanceIds.length) {
      const placeholders = attendanceIds.map(() => '?').join(',');
      const [studentRows] = await pool.query<any[]>(
        `SELECT sa.attendance_session_id, sa.student_id, sa.present, sa.task_status,
                st.name, st.code, st.standard, villages.name AS village_name
         FROM student_attendance sa
         JOIN students st ON st.id = sa.student_id
         LEFT JOIN villages ON villages.id = st.village_id
         WHERE sa.attendance_session_id IN (${placeholders})
         ORDER BY st.name ASC`,
        attendanceIds,
      );
      studentRows.forEach((record) => {
        const key = String(record.attendance_session_id);
        const list = studentsByAttendance.get(key) || [];
        list.push({
          studentId: String(record.student_id),
          studentName: String(record.name || ''),
          code: String(record.code || ''),
          standard: String(record.standard || ''),
          villageName: String(record.village_name || ''),
          status: record.present === null ? 'Not Marked' : Boolean(record.present) ? 'Present' : 'Absent',
          taskStatus: record.task_status || 'Not Marked',
        });
        studentsByAttendance.set(key, list);
      });

      const [volunteerRows] = await pool.query<any[]>(
        `SELECT va.attendance_session_id, va.volunteer_id, va.present, v.name, v.role
         FROM volunteer_attendance va
         JOIN volunteers v ON v.id = va.volunteer_id
         WHERE va.attendance_session_id IN (${placeholders})
         ORDER BY v.name ASC`,
        attendanceIds,
      );
      volunteerRows.forEach((record) => {
        const key = String(record.attendance_session_id);
        const list = volunteersByAttendance.get(key) || [];
        list.push({
          volunteerId: String(record.volunteer_id),
          volunteerName: String(record.name || ''),
          role: String(record.role || 'Mentor'),
          status: Boolean(record.present) ? 'Present' : 'Absent',
        });
        volunteersByAttendance.set(key, list);
      });
    }
    res.json({ success: true, attendanceSessions: rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      clusterId: row.cluster_id,
      clusterName: row.cluster_name || row.cluster_id,
      attendanceType: row.attendance_type || 'students',
      panchayatId: row.panchayat_id || '',
      panchayatName: row.panchayat_name || row.panchayat_id || '',
      villageId: row.village_id || '',
      villageName: row.village_id ? (row.village_name || row.village_id) : 'All Villages',
      dayNumber: Number(row.day_number || 1),
      day: `Day ${Number(row.day_number || 1)}`,
      sessionName: row.session_name || `Day ${Number(row.day_number || 1)}`,
      date: row.session_date ? new Date(row.session_date).toISOString().slice(0, 10) : '',
      status: row.status || 'Draft',
      reviewRemarks: row.review_remarks || '',
      reviewedBy: row.reviewed_by || '',
      reviewedAt: row.reviewed_at || undefined,
      editReason: row.edit_reason || '',
      editRequestedBy: row.edit_requested_by || '',
      editRequestedAt: row.edit_requested_at || undefined,
      totalCount: Number(row.total_count || 0),
      presentCount: Number(row.present_count || 0),
      absentCount: Math.max(0, Number(row.total_count || 0) - Number(row.present_count || 0)),
      records: studentsByAttendance.get(String(row.id)) || [],
      volunteerAttendance: volunteersByAttendance.get(String(row.id)) || [],
    })) });
  } catch (error) {
    console.error('Failed to load attendance:', error);
    res.status(503).json({ success: false, error: 'Unable to load data. Please try again.' });
  }
});

app.post('/api/attendance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  let connection: any;
  try {
    if (req.user.role !== 'Cluster Admin') {
      res.status(403).json({ success: false, error: 'Only Cluster Admin can submit attendance.' });
      return;
    }
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const clusterId = await resolveClusterForAcademicYear(req, year.id);
    const dayNumber = Number(req.body.dayNumber || 1);
    const requestedSessionId = String(req.body.sessionId || '').trim();
    let sessionId = '';
    if (requestedSessionId && requestedSessionId.length <= 64) {
      const [requestedSessions] = await pool.query<any[]>(
        'SELECT id FROM sessions WHERE id = ? AND cluster_id = ? AND academic_year_id = ? LIMIT 1',
        [requestedSessionId, clusterId, year.id],
      );
      if (requestedSessions.length) sessionId = String(requestedSessions[0].id);
    }
    if (!sessionId) {
      const [matchingSessions] = await pool.query<any[]>(
        'SELECT id FROM sessions WHERE cluster_id = ? AND academic_year_id = ? AND day_number = ? ORDER BY updated_at DESC LIMIT 1',
        [clusterId, year.id, dayNumber],
      );
      sessionId = String(matchingSessions[0]?.id || academicSessionId(clusterId, year.id, dayNumber));
    }
    const id = String(req.body.id || `attendance-${Date.now()}`).trim();
    const [existingAttendance] = await pool.query<any[]>(
      'SELECT status, cluster_id FROM attendance_sessions WHERE id = ? AND academic_year_id = ? LIMIT 1',
      [id, year.id],
    );
    if (existingAttendance.length) {
      if (String(existingAttendance[0].cluster_id) !== String(clusterId)) {
        res.status(403).json({ success: false, error: 'This attendance submission is outside your cluster.' });
        return;
      }
      if (!['Draft', 'Resubmission', 'Edit Approved'].includes(String(existingAttendance[0].status))) {
        res.status(409).json({ success: false, error: 'Submitted attendance is locked. Request and receive edit approval before changing it.' });
        return;
      }
    }
    // Phase 4: Check if session is editable
    const attendanceEditGranted = existingAttendance[0]?.status === 'Edit Approved' || existingAttendance[0]?.status === 'Resubmission';
    if (sessionId && !attendanceEditGranted) {
      const editCheck = await isSessionEditable(sessionId);
      if (!editCheck.editable) {
        res.status(403).json({ success: false, error: editCheck.reason });
        return;
      }
      // Auto-transition session to 'In Progress' on first data entry
      await autoTransitionToInProgress(sessionId);
    }
    const totalCount = Number(req.body.totalCount || 0);
    const presentCount = Number(req.body.presentCount || 0);
    const requestedStatus = String(req.body.status || 'Draft');
    const status = requestedStatus === 'Submitted' || requestedStatus === 'SUBMITTED' ? 'Submitted' : 'Draft';

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [sessionRows] = await connection.query(
      'SELECT id FROM sessions WHERE id = ? AND academic_year_id = ? LIMIT 1',
      [sessionId, year.id],
    );
    if (!sessionRows.length) {
      const [setupRows] = await connection.query(
        'SELECT session_name FROM academic_setup WHERE academic_year_id = ? AND day_number = ? LIMIT 1',
        [year.id, Number(req.body.dayNumber || 1)],
      );
      if (!setupRows.length) {
        await connection.rollback();
        res.status(409).json({ success: false, error: 'This attendance day is not configured in Academic Setup.' });
        return;
      }
      await connection.query(
        `INSERT INTO sessions (id, code, name, cluster_id, academic_year, academic_year_id, day_number, panchayat_id, village_id, date, session_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'In Progress')`,
        [sessionId, `DAY-${Number(req.body.dayNumber || 1)}`, String(req.body.sessionName || setupRows[0].session_name || `Day ${req.body.dayNumber}`), clusterId, year.name, year.id, Number(req.body.dayNumber || 1), req.body.panchayatId && req.body.panchayatId !== 'all' ? String(req.body.panchayatId) : null, req.body.villageId && req.body.villageId !== 'all' ? String(req.body.villageId) : null, req.body.date || null],
      );
    }

    await connection.query(
      'INSERT INTO attendance_sessions (id, session_id, cluster_id, panchayat_id, village_id, day_number, academic_year_id, attendance_type, status, present_count, total_count, review_remarks, reviewed_by, reviewed_at, edit_reason, edit_requested_by, edit_requested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL) ON DUPLICATE KEY UPDATE session_id = VALUES(session_id), cluster_id = VALUES(cluster_id), panchayat_id = VALUES(panchayat_id), village_id = VALUES(village_id), day_number = VALUES(day_number), academic_year_id = VALUES(academic_year_id), attendance_type = VALUES(attendance_type), status = VALUES(status), present_count = VALUES(present_count), total_count = VALUES(total_count), review_remarks = NULL, reviewed_by = NULL, reviewed_at = NULL, edit_reason = NULL, edit_requested_by = NULL, edit_requested_at = NULL',
      [id, String(req.body.sessionId || id), clusterId, req.body.panchayatId && req.body.panchayatId !== 'all' ? String(req.body.panchayatId) : null, req.body.villageId && req.body.villageId !== 'all' ? String(req.body.villageId) : null, Number(req.body.dayNumber || 1), year.id, req.body.attendanceType === 'volunteers' ? 'volunteers' : 'students', status, presentCount, totalCount]
    );

    if (Array.isArray(req.body.records)) {
      await connection.query('DELETE FROM student_attendance WHERE attendance_session_id = ?', [id]);
      for (const record of req.body.records) {
        await connection.query(
          'INSERT INTO student_attendance (id, attendance_session_id, student_id, present, task_status) VALUES (?, ?, ?, ?, ?)',
          [randomUUID(), id, record.studentId, record.status === 'Present' || record.present === true, String(record.taskStatus || 'Completed')]
        );
      }
    }

    if (Array.isArray(req.body.volunteerAttendance)) {
      await connection.query('DELETE FROM volunteer_attendance WHERE attendance_session_id = ?', [id]);
      for (const record of req.body.volunteerAttendance) {
        await connection.query(
          'INSERT INTO volunteer_attendance (id, attendance_session_id, volunteer_id, present) VALUES (?, ?, ?, ?)',
          [randomUUID(), id, record.volunteerId, record.status === 'Present' || record.present === true]
        );
      }
    }

    if (status === 'Submitted') {
      // v2 approvals: only snake_case columns; type/reference/requestedBy/
      // sessionId/clusterId were dropped. module is set to 'Attendance' for
      // this audit trail.
      await connection.query(
        `INSERT INTO approvals (id, module, status, requested_by, session_id, record_id, cluster_id, academic_year_id, date)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, CURDATE()
         WHERE NOT EXISTS (SELECT 1 FROM approvals WHERE record_id = ? AND academic_year_id = ? AND status IN ('Open', 'Pending'))`,
        [randomUUID(), 'Attendance', 'Pending', req.user.id, sessionId, id, clusterId, year.id, id, year.id],
      );

      const [adminRows] = await connection.query(
        "SELECT id FROM users WHERE LOWER(role) = 'super admin' AND status = 'Active'",
      );
      const panchayatName = String(req.body.panchayatName || 'Panchayat');
      const villageName = String(req.body.villageName || 'All Villages');
      const dayLabel = `Day ${Number(req.body.dayNumber || 1)}`;
      for (const admin of adminRows) {
        await connection.query(
          'INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())',
          [randomUUID(), admin.id, 'Attendance submitted for review', `${req.user.name || 'Cluster Admin'} submitted ${dayLabel} attendance for ${panchayatName} · ${villageName}.`, 'approval'],
        );
      }
    }

    await connection.commit();

    res.json({ success: true, attendanceSession: { id, sessionId: req.body.sessionId || id, clusterId, panchayatId: req.body.panchayatId || '', villageId: req.body.villageId || '', dayNumber: Number(req.body.dayNumber || 1), status: status === 'Submitted' ? 'Submitted' : 'Draft', presentCount, totalCount } });
  } catch (error) {
    await connection?.rollback().catch(() => undefined);
    console.error('Failed to save attendance:', error);
    res.status(500).json({ success: false, error: 'Unable to save attendance. Check that the selected Academic Setup day, cluster, and roster records exist.' });
  } finally {
    connection?.release();
  }
});

app.put('/api/attendance/:id/request-edit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Cluster Admin') {
    res.status(403).json({ success: false, error: 'Only Cluster Admin can request attendance edit approval.' });
    return;
  }
  const reason = String(req.body.reason || '').trim();
  if (!reason) {
    res.status(400).json({ success: false, error: 'Explain why this attendance submission needs to be edited.' });
    return;
  }
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const clusterId = await resolveClusterForAcademicYear(req, year.id);
    const [result] = await pool.query<any>(
      `UPDATE attendance_sessions
       SET status = 'Edit Requested', edit_reason = ?, edit_requested_by = ?, edit_requested_at = NOW(), review_remarks = NULL
       WHERE id = ? AND academic_year_id = ? AND cluster_id = ? AND status IN ('Submitted', 'Approved')`,
      [reason, req.user.name || req.user.id, req.params.id, year.id, clusterId],
    );
    if (!result.affectedRows) {
      res.status(409).json({ success: false, error: 'Attendance is not in a state that can accept an edit request.' });
      return;
    }
    res.json({ success: true, status: 'Edit Requested', editReason: reason });
  } catch (error) {
    console.error('Failed to request attendance edit approval:', error);
    res.status(503).json({ success: false, error: 'Unable to request attendance edit approval.' });
  }
});

app.put('/api/attendance/:id/review', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can review attendance.' });
    return;
  }
  const action = String(req.body.action || '');
  const remarks = String(req.body.remarks || '').trim();
  if (!['approve', 'request-resubmission', 'approve-edit', 'deny-edit'].includes(action) || (['request-resubmission', 'deny-edit'].includes(action) && !remarks)) {
    res.status(400).json({ success: false, error: 'A valid review action and resubmission reason are required.' });
    return;
  }
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const status = action === 'approve'
      ? 'Approved'
      : action === 'request-resubmission'
        ? 'Resubmission'
        : action === 'approve-edit'
          ? 'Edit Approved'
          : 'Approved';
    const [attendanceRows] = await pool.query<any[]>(
      'SELECT cluster_id, panchayat_id, village_id, day_number FROM attendance_sessions WHERE id = ? AND academic_year_id = ? LIMIT 1',
      [req.params.id, year.id],
    );
    const allowedStatuses = ['approve-edit', 'deny-edit'].includes(action)
      ? "'Edit Requested'"
      : "'Submitted', 'Resubmission'";
    const [result] = await pool.query<any>(
      `UPDATE attendance_sessions SET status = ?, review_remarks = ?, reviewed_by = ?, reviewed_at = NOW(), edit_reason = IF(? IN ('approve-edit', 'deny-edit'), edit_reason, ?) WHERE id = ? AND academic_year_id = ? AND status IN (${allowedStatuses})`,
      [status, remarks || null, req.user.name || req.user.id, action, action === 'request-resubmission' ? remarks : null, req.params.id, year.id],
    );
    if (!result.affectedRows) {
      res.status(404).json({ success: false, error: 'Pending attendance submission not found.' });
      return;
    }
    if (['approve', 'request-resubmission'].includes(action)) {
      const approvalStatus = action === 'approve' ? 'Approved' : 'Correction Requested';
      await pool.query(
        `UPDATE approvals SET status = ?, remarks = ?
         WHERE module = 'Attendance' AND record_id = ? AND academic_year_id = ? AND status IN ('Pending', 'Open')`,
        [approvalStatus, remarks || null, req.params.id, year.id],
      );
      const attendance = attendanceRows[0];
      if (attendance?.cluster_id) {
        const [clusterRows] = await pool.query<any[]>(
          'SELECT source_cluster_id FROM clusters WHERE id = ? LIMIT 1',
          [attendance.cluster_id],
        );
        const recipientClusterIds = [...new Set([attendance.cluster_id, clusterRows[0]?.source_cluster_id].filter(Boolean))];
        const [clusterAdmins] = await pool.query<any[]>(
          `SELECT id, name, email FROM users
           WHERE LOWER(role) IN ('cluster admin', 'cluster_admin') AND cluster_id IN (?) AND status = 'Active'`,
          [recipientClusterIds],
        );
        const [locationRows] = await pool.query<any[]>(
          `SELECT p.name AS panchayat_name, v.name AS village_name
           FROM panchayats p LEFT JOIN villages v ON v.id = ?
           WHERE p.id = ? LIMIT 1`,
          [attendance.village_id, attendance.panchayat_id],
        );
        const panchayatName = locationRows[0]?.panchayat_name || 'Panchayat';
        const villageName = locationRows[0]?.village_name || 'All Villages';
        const title = action === 'approve' ? 'Attendance approved' : 'Attendance needs resubmission';
        const message = action === 'approve'
          ? `Super Admin approved Day ${attendance.day_number} attendance for ${panchayatName} · ${villageName}.`
          : `Super Admin requested changes to Day ${attendance.day_number} attendance for ${panchayatName} · ${villageName}${remarks ? `: ${remarks}` : '.'}`;
        for (const admin of clusterAdmins) {
          await pool.query(
            'INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())',
            [randomUUID(), admin.id, title, message, 'approval'],
          );
          if (admin.email) {
            await sendWorkflowEmail({
              recipient: admin.email,
              recipientName: admin.name || 'Cluster Admin',
              projectRoot: PROJECT_ROOT,
              title: action === 'approve' ? 'Attendance Approved' : 'Attendance Resubmission Required',
              summary: message,
              details: [{ label: 'Day', value: String(attendance.day_number) }, { label: 'Status', value: status }],
              actionLabel: 'Open TQI ERP',
              actionUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
            });
          }
        }
      }
    }
    res.json({ success: true, status, reviewRemarks: remarks || null });
  } catch (error) {
    console.error('Failed to review attendance:', error);
    res.status(503).json({ success: false, error: 'Unable to review attendance.' });
  }
});

app.get('/api/lesson-plans', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    let sql = 'SELECT * FROM lesson_plans WHERE academic_year_id = ?';
    const params: any[] = [year.id];

    if (req.user.role === 'Cluster Admin') {
      const clusterId = await resolveClusterForAcademicYear(req, year.id);
      sql += ' AND cluster_id = ?';
      params.push(clusterId);
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
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const clusterId = await resolveClusterForAcademicYear(req, year.id, String(req.body.clusterId || '')) || 'dharmapuri';
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
      academicYear: year.name,
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
      `INSERT INTO lesson_plans (id, session_id, module_id, cluster_id, panchayat_id, title, topic, objective, activities, materials, duration, remarks, teaching_method, assessment_task, target_standard, learning_outcomes, day_number, volunteer_id, academic_year_id, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE session_id = VALUES(session_id), module_id = VALUES(module_id), cluster_id = VALUES(cluster_id), panchayat_id = VALUES(panchayat_id), title = VALUES(title), topic = VALUES(topic), objective = VALUES(objective), activities = VALUES(activities), materials = VALUES(materials), duration = VALUES(duration), remarks = VALUES(remarks), teaching_method = VALUES(teaching_method), assessment_task = VALUES(assessment_task), target_standard = VALUES(target_standard), learning_outcomes = VALUES(learning_outcomes), day_number = VALUES(day_number), volunteer_id = VALUES(volunteer_id), academic_year_id = VALUES(academic_year_id), status = VALUES(status), created_by = VALUES(created_by)`,
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
        year.id,
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
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const cluster = String(req.query.cluster || req.query.clusterId || 'all');
    let sql = 'SELECT * FROM finance_entries WHERE academic_year_id = ?';
    const params: any[] = [year.id];

    if (req.user.role === 'Cluster Admin') {
      const clusterId = await resolveClusterForAcademicYear(req, year.id);
      sql += ' AND cluster_id = ?';
      params.push(clusterId);
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
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    let clusterId = await resolveClusterForAcademicYear(req, year.id, String(req.body.clusterId || ''));
    if (!clusterId || clusterId === 'all') {
      const [clusterRows] = await pool.query<any[]>('SELECT id FROM clusters WHERE academic_year_id = ? ORDER BY created_at ASC LIMIT 1', [year.id]);
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
      'INSERT INTO finance_entries (id, cluster_id, session_id, academic_year_id, date, description, category, amount, created_by, status, bill_reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE cluster_id = VALUES(cluster_id), session_id = VALUES(session_id), academic_year_id = VALUES(academic_year_id), date = VALUES(date), description = VALUES(description), category = VALUES(category), amount = VALUES(amount), created_by = VALUES(created_by), status = VALUES(status), bill_reference = VALUES(bill_reference)',
      [id, clusterId, req.body.sessionId || null, year.id, date, String(req.body.description || 'Finance Entry').trim(), String(req.body.category || 'General'), amount, String(req.user.id), String(req.body.status || 'Draft'), String(req.body.billReference || '')]
    );

    res.json({ success: true, financeEntry: { id, clusterId, date, description: req.body.description || 'Finance Entry', category: req.body.category || 'General', amount, status: req.body.status || 'Draft', billReference: req.body.billReference || '' } });
  } catch (error) {
    console.error('Failed to save finance entry:', error);
    res.status(500).json({ success: false, error: 'Unable to save finance entry.' });
  }
});

app.put('/api/notifications/read-all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [result] = await pool.query<any>(
      'UPDATE notifications SET is_read = 1 WHERE is_read = 0 AND (user_id IS NULL OR user_id = ?)',
      [req.user.id],
    );
    res.json({ success: true, updatedCount: Number(result.affectedRows || 0) });
  } catch (error) {
    console.error('Failed to mark notifications as read:', error);
    res.status(503).json({ success: false, error: 'Unable to mark notifications as read.' });
  }
});

app.put('/api/notifications/:id/read', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [result] = await pool.query<any>(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id IS NULL OR user_id = ?)',
      [req.params.id, req.user.id],
    );
    if (!result.affectedRows) {
      res.status(404).json({ success: false, error: 'Notification not found.' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    res.status(503).json({ success: false, error: 'Unable to mark notification as read.' });
  }
});

app.get('/api/notifications', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>(
      'SELECT * FROM notifications WHERE user_id IS NULL OR user_id = ? ORDER BY created_at DESC LIMIT 200',
      [req.user.id],
    );
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
  const year = await resolveAcademicYear(req);
  if (!year) { res.status(404).json({ success: false, error: 'No academic year is available.' }); return; }
  if (isArchivedAcademicYear(year)) { res.status(409).json({ success: false, error: 'Archived academic years are read-only.' }); return; }
  const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
  const collegeName = String(req.body.collegeName ?? req.body.college_name ?? '').trim();
  const collegeDistrict = String(req.body.collegeDistrict ?? req.body.college_district ?? '').trim();
  const spocName = String(req.body.spocName ?? req.body.spoc_name ?? '').trim();
  const spocMobile = String(req.body.spocMobile ?? req.body.spoc_mobile ?? '').trim();
  if (!name || !collegeName || !collegeDistrict) {
    res.status(400).json({ success: false, error: 'Cluster name/district, college, and college location are required.' });
    return;
  }
  const adminEmail = String(req.body.adminEmail || '').trim().toLowerCase();
  const adminName = String(req.body.adminName || spocName).trim();
  if (!adminEmail || !adminName || !spocMobile) {
    res.status(400).json({ success: false, error: 'SPOC name, mobile, and email are required.' });
    return;
  }
  if (!/^\d{10}$/.test(spocMobile.replace(/\D/g, '').slice(-10))) {
    res.status(400).json({ success: false, error: 'SPOC mobile number must contain exactly 10 digits.' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    res.status(400).json({ success: false, error: 'Enter a valid SPOC email address.' });
    return;
  }
  let connection: any;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [clusterRows] = await connection.query(
      'SELECT id, admin_id FROM clusters WHERE id = ? AND academic_year_id = ? LIMIT 1 FOR UPDATE',
      [req.params.id, year.id],
    );
    if (!clusterRows.length) {
      await connection.rollback();
      res.status(404).json({ success: false, error: 'Cluster not found.' });
      return;
    }
    const adminId = clusterRows[0].admin_id ? String(clusterRows[0].admin_id) : '';
    if (adminId) {
      const [duplicateEmails] = await connection.query(
        'SELECT id FROM users WHERE LOWER(email) = ? AND id <> ? LIMIT 1',
        [adminEmail, adminId],
      );
      if (duplicateEmails.length) {
        await connection.rollback();
        res.status(409).json({ success: false, error: 'This email address is already registered to another user.' });
        return;
      }
    }
    const normalizedPhone = `+91 ${spocMobile.replace(/\D/g, '').slice(-10)}`;
    await connection.query(
      'UPDATE clusters SET name = ?, college_name = ?, spoc_name = ?, spoc_mobile = ?, district = ?, college_district = ?, state = ? WHERE id = ? AND academic_year_id = ?',
      [name, collegeName, adminName, normalizedPhone, name, collegeDistrict, 'Tamil Nadu', req.params.id, year.id],
    );
    if (adminId) {
      await connection.query(
        'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?',
        [adminName, adminEmail, normalizedPhone, adminId],
      );
    }
    await connection.query('INSERT INTO audit_logs (id, user_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), req.user.id, 'UPDATE_CLUSTER', 'CLUSTERS', req.params.id, JSON.stringify(req.body)]);
    await connection.commit();
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    await connection?.rollback().catch(() => undefined);
    res.status(503).json({ success: false, error: 'Failed to update cluster.' });
  } finally {
    connection?.release();
  }
});

// 2. DELETE /api/clusters/:id
app.delete('/api/clusters/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') { res.status(403).json({ success: false, error: 'Only Super Admin can delete clusters.' }); return; }
  const year = await resolveAcademicYear(req);
  if (!year) { res.status(404).json({ success: false, error: 'No academic year is available.' }); return; }
  if (isArchivedAcademicYear(year)) { res.status(409).json({ success: false, error: 'Archived academic years are read-only.' }); return; }
  let connection: any;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [clusterRows] = await connection.query('SELECT id, name FROM clusters WHERE id = ? AND academic_year_id = ? LIMIT 1 FOR UPDATE', [req.params.id, year.id]);
    if (!clusterRows.length) {
      await connection.rollback();
      res.status(404).json({ success: false, error: 'Cluster not found in the selected academic year.' });
      return;
    }

    // 1. Break bidirectional FK link between clusters and users
    await connection.query('UPDATE clusters SET admin_id = NULL WHERE id = ?', [req.params.id]);

    // 2. Remove notifications and unbind audit logs for users belonging to this cluster
    await connection.query('DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE cluster_id = ?)', [req.params.id]);
    await connection.query('UPDATE audit_logs SET user_id = NULL WHERE user_id IN (SELECT id FROM users WHERE cluster_id = ?)', [req.params.id]);

    // 3. Delete cluster users (e.g. Cluster Admin)
    await connection.query('DELETE FROM users WHERE cluster_id = ?', [req.params.id]);

    // 4. Delete cluster from clusters table
    const [result] = await connection.query('DELETE FROM clusters WHERE id = ? AND academic_year_id = ?', [req.params.id, year.id]);
    if (!result.affectedRows) {
      await connection.rollback();
      res.status(404).json({ success: false, error: 'Cluster not found.' });
      return;
    }

    // 5. Record audit log
    await connection.query('INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)', [
      crypto.randomUUID(),
      req.user.id,
      req.user.name,
      req.user.role,
      'DELETE_CLUSTER',
      'CLUSTERS',
      req.params.id,
      `Permanently deleted cluster ${req.params.id} and associated cluster admin accounts.`
    ]);

    await connection.commit();
    res.json({ success: true });
  } catch (error: any) {
    await connection?.rollback().catch(() => undefined);
    console.error('Failed to delete cluster:', error);
    // If foreign key constraint blocks hard deletion due to operational records (sessions, attendance, etc.)
    if (error?.code === 'ER_ROW_IS_REFERENCED_2' || error?.code === 'ER_ROW_IS_REFERENCED') {
      try {
        const [result] = await pool.query<any>("UPDATE clusters SET status = 'Inactive' WHERE id = ? AND academic_year_id = ?", [req.params.id, year.id]);
        await pool.query("UPDATE users SET status = 'Inactive' WHERE cluster_id = ?", [req.params.id]);
        if (!result.affectedRows) {
          res.status(404).json({ success: false, error: 'Cluster not found in the selected academic year.' });
          return;
        }
        res.json({ success: true, deactivated: true, message: 'Cluster deactivated because it has linked historical records.' });
        return;
      } catch (innerErr) {
        // pass
      }
    }
    res.status(503).json({ success: false, error: 'Failed to delete cluster.' });
  } finally {
    connection?.release();
  }
});

// 3. GET /api/villages
app.get('/api/villages/directory', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }

    const panchayatId = String(req.query.panchayatId || '').trim();
    if (!panchayatId) {
      res.status(400).json({ success: false, error: 'Select a panchayat first.' });
      return;
    }

    const [rows] = await pool.query<any[]>(
      `SELECT p.id, p.name, p.cluster_id, c.district, c.name AS cluster_name
       FROM panchayats p
       JOIN clusters c ON c.id = p.cluster_id
       WHERE p.id = ? AND p.academic_year_id = ? LIMIT 1`,
      [panchayatId, year.id],
    );
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Panchayat not found in the selected academic year.' });
      return;
    }

    const panchayat = rows[0];
    if (req.user.role === 'Cluster Admin') {
      const allowedClusterId = await resolveClusterForAcademicYear(req, year.id);
      if (panchayat.cluster_id !== allowedClusterId) {
        res.status(403).json({ success: false, error: 'This panchayat is outside your assigned cluster.' });
        return;
      }
    }

    const district = String(panchayat.district || '').trim();
    const districtSlug = district.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const panchayatSlug = String(panchayat.name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!districtSlug || !panchayatSlug) {
      res.status(422).json({ success: false, error: 'The panchayat district/name is not configured correctly.' });
      return;
    }

    let sourceUrl = `https://digitalpanchayat.org/india/tamil-nadu/${districtSlug}/${panchayatSlug}-gram-panchayat`;
    let directoryResponse = await fetch(sourceUrl, {
      headers: { Accept: 'text/html', 'User-Agent': 'TQI-ERP panchayat village directory lookup' },
      signal: AbortSignal.timeout(15000),
    });

    if (directoryResponse.status === 404) {
      const normalizeSlug = (value: string) => value.normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const targetName = normalizeSlug(panchayat.name);
      const searchTerms = [...new Set([panchayat.name, panchayatSlug, panchayatSlug.replace(/i$/, '')])];
      let canonicalPath: string | null = null;

      for (const term of searchTerms) {
        const searchResponse = await fetch(`https://digitalpanchayat.org/api/search?q=${encodeURIComponent(term)}`, {
          headers: { Accept: 'application/json', 'User-Agent': 'TQI-ERP panchayat village directory lookup' },
          signal: AbortSignal.timeout(10000),
        });
        if (!searchResponse.ok) continue;
        const searchData = await searchResponse.json().catch(() => null);
        const candidates = Array.isArray(searchData?.results) ? searchData.results : [];
        const candidate = candidates.find((result: any) => {
          if (result?.entityType !== 'gram_panchayat' || result?.districtSlug !== districtSlug) return false;
          const candidateName = normalizeSlug(String(result.name || ''));
          return candidateName === targetName || candidateName.replace(/i$/, '') === targetName.replace(/i$/, '');
        });
        if (candidate?.url) {
          canonicalPath = String(candidate.url);
          break;
        }
        if (candidate?.slug) {
          canonicalPath = `/india/tamil-nadu/${districtSlug}/${String(candidate.slug)}`;
          break;
        }
      }

      if (canonicalPath) {
        sourceUrl = new URL(canonicalPath, 'https://digitalpanchayat.org').toString();
        directoryResponse = await fetch(sourceUrl, {
          headers: { Accept: 'text/html', 'User-Agent': 'TQI-ERP panchayat village directory lookup' },
          signal: AbortSignal.timeout(15000),
        });
      }
    }

    if (!directoryResponse.ok) {
      res.status(directoryResponse.status === 404 ? 404 : 502).json({
        success: false,
        error: directoryResponse.status === 404
          ? `No online village mapping was found for ${panchayat.name} in ${district}.`
          : 'The village directory source is temporarily unavailable.',
      });
      return;
    }

    const html = await directoryResponse.text();
    const villages = new Map<string, string>();
    const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(html)) !== null) {
      let url: URL;
      try { url = new URL(match[1], sourceUrl); } catch { continue; }
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length !== 4 || pathParts[0] !== 'india' || pathParts[1] !== 'tamil-nadu' || pathParts[2] !== districtSlug) continue;
      if (pathParts[3].endsWith('-gram-panchayat')) continue;

      const villageName = match[2]
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/&#(\d+);/g, (_entity, code: string) => String.fromCodePoint(Number(code)))
        .replace(/\s+/g, ' ')
        .replace(/\s+Village$/i, '')
        .trim();
      if (villageName) villages.set(villageName.toLocaleLowerCase('en'), villageName);
    }

    if (!villages.size) {
      res.status(502).json({ success: false, error: `No village names were listed for ${panchayat.name}.` });
      return;
    }

    res.json({
      success: true,
      panchayatId,
      panchayatName: panchayat.name,
      district,
      source: 'LGD via Digital Panchayat',
      sourceUrl,
      villages: [...villages.values()].sort((left, right) => left.localeCompare(right)),
    });
  } catch (error: any) {
    console.error('Failed to fetch panchayat village directory:', error);
    res.status(502).json({ success: false, error: error?.name === 'TimeoutError' ? 'Village directory request timed out.' : 'Unable to load this panchayat village list.' });
  }
});

app.get('/api/villages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const year = await resolveAcademicYear(req);
  if (!year) {
    res.status(404).json({ success: false, error: 'No academic year is available.' });
    return;
  }
  const targetClusterId = req.user.role !== 'Super Admin'
    ? await resolveClusterForAcademicYear(req, year.id)
    : (req.query.cluster || null);
  const targetPanchayatId = req.query.panchayat || null;
  
  let sql = `
    SELECT v.*, p.name as panchayat_name 
    FROM villages v
    LEFT JOIN panchayats p ON v.panchayat_id = p.id AND p.academic_year_id = v.academic_year_id
    WHERE v.academic_year_id = ?
  `;
  const params: any[] = [year.id];
  
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
  const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ');
  const panchayatId = String(req.body?.panchayat_id || '').trim();
  const requestedClusterId = String(req.body?.cluster_id || '').trim();
  if (!name || !panchayatId || !requestedClusterId) {
    res.status(400).json({ success: false, error: 'Missing required fields.' });
    return;
  }
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const [panchayatRows] = await pool.query<any[]>(
      'SELECT id, cluster_id FROM panchayats WHERE id = ? AND academic_year_id = ? LIMIT 1',
      [panchayatId, year.id],
    );
    if (!panchayatRows.length) {
      res.status(404).json({ success: false, error: 'Panchayat not found in the selected academic year.' });
      return;
    }
    const clusterId = String(panchayatRows[0].cluster_id);
    if (requestedClusterId !== clusterId) {
      res.status(400).json({ success: false, error: 'Village cluster must match its parent panchayat.' });
      return;
    }
    if (req.user.role === 'Cluster Admin') {
      const allowedClusterId = await resolveClusterForAcademicYear(req, year.id);
      if (clusterId !== allowedClusterId) {
        res.status(403).json({ success: false, error: 'This panchayat is outside your assigned cluster.' });
        return;
      }
    }

    const [existingRows] = await pool.query<any[]>(
      'SELECT id FROM villages WHERE panchayat_id = ? AND academic_year_id = ? AND LOWER(TRIM(name)) = LOWER(?) LIMIT 1',
      [panchayatId, year.id, name],
    );
    if (existingRows.length) {
      res.status(409).json({ success: false, error: 'This village is already added to this panchayat.' });
      return;
    }

    const finalId = `village-${crypto.randomUUID()}`;
    await pool.query(
      'INSERT INTO villages (id, name, panchayat_id, cluster_id, academic_year_id) VALUES (?, ?, ?, ?, ?)',
      [finalId, name, panchayatId, clusterId, year.id],
    );
    res.status(201).json({ success: true, data: { id: finalId, name, panchayatId, clusterId, academicYearId: year.id } });
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ success: false, error: 'This village is already added to this panchayat.' });
      return;
    }
    console.error('Failed to create village:', error);
    res.status(503).json({ success: false, error: 'Failed to upsert village.' });
  }
});

// 5. DELETE /api/villages/:id
app.delete('/api/villages/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  let connection: any;
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [villageRows] = await connection.query(
      'SELECT id, cluster_id, panchayat_id FROM villages WHERE id = ? AND academic_year_id = ? LIMIT 1 FOR UPDATE',
      [req.params.id, year.id],
    );
    if (!villageRows.length) {
      await connection.rollback();
      res.status(404).json({ success: false, error: 'Village not found in the selected academic year.' });
      return;
    }
    const village = villageRows[0];
    if (req.query.panchayatId && String(req.query.panchayatId) !== String(village.panchayat_id)) {
      await connection.rollback();
      res.status(400).json({ success: false, error: 'Village does not belong to the selected panchayat.' });
      return;
    }
    if (req.user.role === 'Cluster Admin') {
      const allowedClusterId = await resolveClusterForAcademicYear(req, year.id);
      if (String(village.cluster_id) !== String(allowedClusterId)) {
        await connection.rollback();
        res.status(403).json({ success: false, error: 'This village is outside your assigned cluster.' });
        return;
      }
    }

    const [dependencyRows] = await connection.query(
      `SELECT
        (SELECT COUNT(*) FROM students WHERE village_id = ? AND academic_year_id = ?) AS students,
        (SELECT COUNT(*) FROM volunteers WHERE village_id = ? AND academic_year_id = ?) AS volunteers,
        (SELECT COUNT(*) FROM sessions WHERE village_id = ? AND academic_year_id = ?) AS sessions,
        (SELECT COUNT(*) FROM schools WHERE village_id = ? AND academic_year_id = ?) AS schools,
        (SELECT COUNT(*) FROM attendance_sessions WHERE village_id = ? AND academic_year_id = ?) AS attendance`,
      [req.params.id, year.id, req.params.id, year.id, req.params.id, year.id, req.params.id, year.id, req.params.id, year.id],
    );
    const dependencies = Object.entries(dependencyRows[0] || {}).filter(([, count]) => Number(count) > 0).map(([name]) => name);
    if (dependencies.length) {
      await connection.rollback();
      res.status(409).json({ success: false, error: `Cannot delete this village because it has linked ${dependencies.join(', ')} records.` });
      return;
    }

    await connection.query('DELETE FROM villages WHERE id = ? AND academic_year_id = ?', [req.params.id, year.id]);
    await connection.commit();
    res.json({ success: true });
  } catch (error: any) {
    await connection?.rollback().catch(() => undefined);
    console.error('Failed to delete village:', error);
    res.status(503).json({ success: false, error: 'Failed to delete village.' });
  } finally {
    connection?.release();
  }
});

// 6. DELETE /api/panchayats/:id
app.delete('/api/panchayats/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  let connection: any;
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [panchayatRows] = await connection.query(
      'SELECT id, cluster_id FROM panchayats WHERE id = ? AND academic_year_id = ? LIMIT 1 FOR UPDATE',
      [req.params.id, year.id],
    );
    if (!panchayatRows.length) {
      await connection.rollback();
      res.status(404).json({ success: false, error: 'Panchayat not found in the selected academic year.' });
      return;
    }
    if (req.user.role === 'Cluster Admin') {
      const allowedClusterId = await resolveClusterForAcademicYear(req, year.id);
      if (String(panchayatRows[0].cluster_id) !== String(allowedClusterId)) {
        await connection.rollback();
        res.status(403).json({ success: false, error: 'This panchayat is outside your assigned cluster.' });
        return;
      }
    }

    const [dependencyRows] = await connection.query(
      `SELECT
        (SELECT COUNT(*) FROM students WHERE panchayat_id = ? AND academic_year_id = ?) AS students,
        (SELECT COUNT(*) FROM volunteers WHERE panchayat_id = ? AND academic_year_id = ?) AS volunteers,
        (SELECT COUNT(*) FROM sessions WHERE panchayat_id = ? AND academic_year_id = ?) AS sessions,
        (SELECT COUNT(*) FROM schools WHERE panchayat_id = ? AND academic_year_id = ?) AS schools,
        (SELECT COUNT(*) FROM lesson_plans WHERE panchayat_id = ? AND academic_year_id = ?) AS lesson_plans,
        (SELECT COUNT(*) FROM attendance_sessions WHERE panchayat_id = ? AND academic_year_id = ?) AS attendance`,
      [req.params.id, year.id, req.params.id, year.id, req.params.id, year.id, req.params.id, year.id, req.params.id, year.id, req.params.id, year.id],
    );
    const dependencies = Object.entries(dependencyRows[0] || {}).filter(([, count]) => Number(count) > 0).map(([name]) => name);
    if (dependencies.length) {
      await connection.rollback();
      res.status(409).json({ success: false, error: `Cannot delete this panchayat because it has linked ${dependencies.join(', ')} records.` });
      return;
    }

    const [villageDependencyRows] = await connection.query(
      `SELECT COUNT(*) AS count FROM villages v
       WHERE v.panchayat_id = ? AND v.academic_year_id = ? AND (
         EXISTS (SELECT 1 FROM students s WHERE s.village_id = v.id AND s.academic_year_id = v.academic_year_id) OR
         EXISTS (SELECT 1 FROM volunteers vol WHERE vol.village_id = v.id AND vol.academic_year_id = v.academic_year_id) OR
         EXISTS (SELECT 1 FROM sessions se WHERE se.village_id = v.id AND se.academic_year_id = v.academic_year_id) OR
         EXISTS (SELECT 1 FROM schools sc WHERE sc.village_id = v.id AND sc.academic_year_id = v.academic_year_id) OR
         EXISTS (SELECT 1 FROM attendance_sessions att WHERE att.village_id = v.id AND att.academic_year_id = v.academic_year_id)
       )`,
      [req.params.id, year.id],
    );
    if (Number(villageDependencyRows[0]?.count || 0) > 0) {
      await connection.rollback();
      res.status(409).json({ success: false, error: 'Cannot delete this panchayat because one or more villages have linked operational records.' });
      return;
    }

    await connection.query('DELETE FROM villages WHERE panchayat_id = ? AND academic_year_id = ?', [req.params.id, year.id]);
    await connection.query('DELETE FROM panchayats WHERE id = ? AND academic_year_id = ?', [req.params.id, year.id]);
    await connection.commit();
    res.json({ success: true });
  } catch (error: any) {
    await connection?.rollback().catch(() => undefined);
    console.error('Failed to delete panchayat:', error);
    res.status(503).json({ success: false, error: 'Failed to delete panchayat.' });
  } finally {
    connection?.release();
  }
});

// 7. PUT /api/students/:id
app.put('/api/students/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { name, gender, dob, standard, panchayat_id, panchayatId, village_id, villageId, parent_name, parentName, phone, status, schoolName } = req.body;
  const pId = panchayat_id !== undefined ? panchayat_id : panchayatId;
  const vId = village_id !== undefined ? village_id : villageId;
  const parName = parent_name !== undefined ? parent_name : parentName;

  try {
    if (standard !== undefined && !isAllowedStudentStandard(standard)) {
      res.status(400).json({ success: false, error: 'Student standard must be between 9 and 12.' });
      return;
    }
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
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
        status = COALESCE(?, status),
        school_name = COALESCE(?, school_name)
       WHERE id = ? AND academic_year_id = ?`,
      [name ?? null, gender ?? null, dob ?? null, standard ?? null, pId ?? null, vId ?? null, parName ?? null, phone ?? null, status ?? null, schoolName ?? null, req.params.id, year.id]
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
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const [result] = await pool.query<any>("UPDATE students SET status = 'Inactive' WHERE id = ? AND academic_year_id = ?", [req.params.id, year.id]);
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Student not found.' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to delete student.' });
  }
});

// 9. POST /api/students/bulk
app.post('/api/students/bulk', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { students, clusterId } = req.body;
  if (!Array.isArray(students) || students.length === 0) {
    res.status(400).json({ success: false, error: 'Invalid payload.' });
    return;
  }
  let connection: any;
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const requestedClusterId = String(clusterId || '').trim();
    const allowedClusterId = await resolveClusterForAcademicYear(req, year.id, requestedClusterId);
    const preparedStudents: Array<{ student: any; id: string; panchayatId: string; villageId: string; clusterId: string }> = [];
    for (const student of students) {
      if (!isAllowedStudentStandard(student.standard)) {
        res.status(400).json({ success: false, error: 'Every student standard must be between 9 and 12.' });
        return;
      }
      const panchayatId = String(student.panchayatId || student.panchayat_id || '').trim();
      const villageId = String(student.villageId || student.village_id || '').trim();
      if (!panchayatId || !villageId) {
        res.status(400).json({ success: false, error: 'Every imported student must have a panchayat and village.' });
        return;
      }
      const [locationRows] = await pool.query<any[]>(
        `SELECT p.cluster_id FROM panchayats p JOIN villages v
           ON v.panchayat_id = p.id AND v.academic_year_id = p.academic_year_id
         WHERE p.id = ? AND v.id = ? AND p.academic_year_id = ?`,
        [panchayatId, villageId, year.id],
      );
      if (!locationRows.length) {
        res.status(400).json({ success: false, error: 'An imported village does not belong to its selected panchayat and academic year.' });
        return;
      }
      const actualClusterId = String(locationRows[0].cluster_id);
      if (req.user.role === 'Cluster Admin' && allowedClusterId !== actualClusterId) {
        res.status(403).json({ success: false, error: 'An imported panchayat is outside your assigned cluster.' });
        return;
      }
      if (requestedClusterId && requestedClusterId !== 'all' && allowedClusterId !== actualClusterId) {
        res.status(400).json({ success: false, error: 'The import cluster does not match every selected panchayat.' });
        return;
      }
      preparedStudents.push({
        student,
        id: String(student.id || crypto.randomUUID()),
        panchayatId,
        villageId,
        clusterId: actualClusterId,
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    for (const { student, id: studentId, panchayatId, villageId, clusterId: actualClusterId } of preparedStudents) {
      await connection.query(
        'INSERT INTO students (id, cluster_id, name, gender, dob, standard, panchayat_id, village_id, parent_name, phone, status, school_name, academic_year_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE cluster_id = VALUES(cluster_id), name = VALUES(name), standard = VALUES(standard), panchayat_id = VALUES(panchayat_id), village_id = VALUES(village_id), school_name = VALUES(school_name), academic_year_id = VALUES(academic_year_id)',
        [studentId, actualClusterId, student.name, student.gender || 'male', student.dob || '2014-01-01', student.standard || '6th Standard', panchayatId, villageId, student.parentName || student.parent_name || 'Parent', student.phone || '', 'Active', student.schoolName || '', year.id]
      );
    }
    await connection.commit();
    res.json({ success: true, count: preparedStudents.length });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(503).json({ success: false, error: 'Failed to bulk import students.' });
  } finally {
    connection?.release();
  }
});

// 10. PUT /api/volunteers/:id
app.put('/api/volunteers/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { name, gender, email, phone, college, year: studyYear, department, role, panchayat_id, panchayatId, village_id, villageId, status } = req.body;
  const pId = panchayat_id !== undefined ? panchayat_id : panchayatId;
  const vId = village_id !== undefined ? village_id : villageId;

  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const [existingRows] = await pool.query<any[]>(
      'SELECT id FROM volunteers WHERE id = ? AND academic_year_id = ? LIMIT 1',
      [req.params.id, year.id],
    );
    if (!existingRows.length) { res.status(404).json({ success: false, error: 'Volunteer not found.' }); return; }
    await pool.query<any>(
      `UPDATE volunteers SET 
        name = COALESCE(?, name), 
        gender = COALESCE(?, gender),
        email = COALESCE(?, email), 
        phone = COALESCE(?, phone), 
        college_name = COALESCE(?, college_name),
        study_year = COALESCE(?, study_year),
        department = COALESCE(?, department), 
        role = COALESCE(?, role), 
        panchayat_id = COALESCE(?, panchayat_id), 
        village_id = COALESCE(?, village_id), 
        status = COALESCE(?, status) 
      WHERE id = ? AND academic_year_id = ?`,
          [name ?? null, gender ?? null, email ?? null, phone ?? null, college ?? null, studyYear ?? null, department ?? null, role ?? null, pId ?? null, vId ?? null, status ?? null, req.params.id, year.id]
    );
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to update volunteer.' });
  }
});

// 11. DELETE /api/volunteers/:id
app.delete('/api/volunteers/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const [result] = await pool.query<any>("UPDATE volunteers SET status = 'Inactive' WHERE id = ? AND academic_year_id = ?", [req.params.id, year.id]);
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Volunteer not found.' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to delete volunteer.' });
  }
});

// 12. POST /api/volunteers/bulk
app.post('/api/volunteers/bulk', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { volunteers, clusterId } = req.body;
  if (!Array.isArray(volunteers) || !volunteers.length || volunteers.length > 5000 || !clusterId) {
    res.status(400).json({ success: false, error: 'Upload a non-empty volunteer list (up to 5,000 rows) and select a cluster.' });
    return;
  }
  const invalidIndex = volunteers.findIndex((volunteer: any) =>
    !String(volunteer.name || '').trim() ||
    !String(volunteer.year || '').trim() ||
    !String(volunteer.department || '').trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(volunteer.email || '').trim()) ||
    !String(volunteer.phone || '').trim()
  );
  if (invalidIndex >= 0) {
    res.status(400).json({ success: false, error: `Volunteer row ${invalidIndex + 1} needs name, year, department, a valid email, and mobile number.` });
    return;
  }
  let connection: any;
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const targetClusterId = await resolveClusterForAcademicYear(req, year.id, clusterId);
    if (!targetClusterId || targetClusterId === 'all') {
      res.status(400).json({ success: false, error: 'Select a valid cluster for this academic year.' });
      return;
    }
    const [clusterRows] = await pool.query<any[]>(
      'SELECT id FROM clusters WHERE id = ? AND academic_year_id = ? LIMIT 1',
      [targetClusterId, year.id],
    );
    if (!clusterRows.length) {
      res.status(404).json({ success: false, error: 'Selected cluster was not found in this academic year.' });
      return;
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    for (const vol of volunteers) {
      await connection.query(
        'INSERT INTO volunteers (id, cluster_id, name, gender, email, phone, college_name, study_year, department, role, panchayat_id, village_id, status, academic_year_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [`volunteer-${crypto.randomUUID()}`, targetClusterId, String(vol.name).trim(), ['male', 'female', 'other'].includes(String(vol.gender || '').toLowerCase()) ? String(vol.gender).toLowerCase() : null, String(vol.email).trim(), String(vol.phone).trim(), vol.college || null, String(vol.year).trim(), String(vol.department).trim(), 'Mentor', null, null, 'Active', year.id]
      );
    }
    await connection.commit();
    res.json({ success: true, count: volunteers.length });
  } catch (error) {
    await connection?.rollback().catch(() => undefined);
    res.status(503).json({ success: false, error: 'Failed to upload volunteers.' });
  } finally {
    connection?.release();
  }
});

// 13. DELETE /api/sessions/:id
app.delete('/api/sessions/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    // v2: the legacy 'session_attendance' table never existed. The real
    // attendance tables (attendance_sessions / student_attendance /
    // volunteer_attendance) cascade-delete automatically via the FKs declared
    // in 206_attendance.sql. We just need to delete the session row; the
    // children follow.
    const [result] = await pool.query<any>("DELETE FROM sessions WHERE id = ? AND academic_year_id = ?", [req.params.id, year.id]);
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Session not found.' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to delete session.' });
  }
});

// 14. DELETE /api/lesson-plans/:id
app.delete('/api/lesson-plans/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const [result] = await pool.query<any>("DELETE FROM lesson_plans WHERE id = ? AND academic_year_id = ?", [req.params.id, year.id]);
    if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Lesson plan not found.' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: 'Failed to delete lesson plan.' });
  }
});

// --- 1. Date Change Requests ---
app.post('/api/date-change-requests', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Cluster Admin') {
    res.status(403).json({ success: false, error: 'Only Cluster Admins can submit a session reschedule request.' });
    return;
  }
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const { sessionId, originalDate, requestedDate, reason } = req.body;
    const clusterId = await resolveClusterForAcademicYear(req, year.id);
    const id = `dcr-${randomUUID()}`;

    await pool.query(
      'INSERT INTO date_change_requests (id, session_id, cluster_id, academic_year_id, original_date, requested_date, reason, status, requested_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, sessionId, clusterId, year.id, originalDate, requestedDate, reason, 'Pending', req.user.id]
    );

    await pool.query(
      'INSERT INTO notifications (id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [randomUUID(), 'Date Change Request', `New date change request for session ${sessionId} from cluster ${clusterId}.`, 'date_change']
    );

    await pool.query(
      'INSERT INTO audit_logs (id, user_id, user_name, role, cluster_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), req.user.id, req.user.name, req.user.role, clusterId, 'CREATE_DATE_CHANGE_REQUEST', 'DATE_CHANGES', id, `Requested date change for session ${sessionId}`]
    );

    const request = { id, sessionId, clusterId, originalDate, requestedDate, reason, status: 'PENDING', requestedBy: req.user.id, requestedByName: req.user.name || '', createdAt: new Date().toISOString() };
    res.json({ success: true, request, dateChangeRequest: request });
  } catch (error) {
    console.error('Failed to submit date change request:', error);
    res.status(500).json({ success: false, error: 'Unable to submit request.' });
  }
});

app.get('/api/date-change-requests', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    let sql = `SELECT requests.*, clusters.name AS cluster_name, users.name AS requested_by_name,
              sessions.day_number, sessions.name AS session_name
           FROM date_change_requests requests
           LEFT JOIN clusters ON clusters.id = requests.cluster_id
           LEFT JOIN users ON users.id = requests.requested_by
           LEFT JOIN sessions ON sessions.id = requests.session_id
           WHERE requests.academic_year_id = ?`;
    const params: any[] = [year.id];

    if (req.user.role === 'Cluster Admin') {
      const clusterId = await resolveClusterForAcademicYear(req, year.id);
      sql += ' AND requests.cluster_id = ?';
      params.push(clusterId);
    }

    sql += ' ORDER BY requests.created_at DESC';
    const [rows] = await pool.query<any[]>(sql, params);
    const dateChangeRequests = rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      clusterId: row.cluster_id,
      clusterName: row.cluster_name || row.cluster_id,
      dayNumber: Number(row.day_number || 0) || undefined,
      originalDate: row.original_date ? new Date(row.original_date).toISOString().slice(0, 10) : '',
      requestedDate: row.requested_date ? new Date(row.requested_date).toISOString().slice(0, 10) : '',
      reason: row.reason || '',
      status: String(row.status || 'PENDING').toUpperCase(),
      reviewedBy: row.reviewed_by || undefined,
      reviewRemarks: row.review_remarks || undefined,
      reviewedAt: row.reviewed_at || undefined,
      requestedBy: row.requested_by || '',
      requestedByName: row.requested_by_name || '',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      sessionName: row.session_name || '',
    }));
    res.json({ success: true, data: dateChangeRequests, dateChangeRequests });
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
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const [rows] = await pool.query<any[]>('SELECT * FROM date_change_requests WHERE id = ? AND academic_year_id = ?', [req.params.id, year.id]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Request not found.' });
      return;
    }
    const request = rows[0];

    await pool.query('START TRANSACTION');

    await pool.query(
      'UPDATE date_change_requests SET status = ?, reviewed_by = ?, review_remarks = ?, reviewed_at = NOW() WHERE id = ? AND academic_year_id = ?',
      [status, req.user.id, remarks, req.params.id, year.id]
    );

    if (status === 'Approved') {
      await pool.query(
        'UPDATE sessions SET date = ?, session_date_fixed = 1, session_date_fixed_at = NOW(), session_date_fixed_by = ? WHERE id = ? AND academic_year_id = ?',
        [request.requested_date, req.user.name || req.user.id, request.session_id, year.id],
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
    res.json({ success: true, status });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    console.error('Failed to update date change request:', error);
    res.status(503).json({ success: false, error: 'Unable to process request.' });
  }
});

// --- 2. Session Reports ---
const mapSessionReportPhoto = (row: any) => ({
  id: String(row.id),
  sessionReportId: String(row.session_report_id),
  originalFilename: String(row.original_filename || 'Session photo'),
  mimeType: String(row.mime_type || 'image/jpeg'),
  fileSize: Number(row.file_size || 0),
  fileUrl: `/api/session-report-photos/${encodeURIComponent(String(row.id))}/file`,
  createdAt: row.created_at,
});

const mapSessionReport = (row: any, photos: any[] = []) => ({
  id: String(row.id),
  sessionId: String(row.session_id),
  clusterId: String(row.cluster_id),
  clusterName: row.cluster_name || '',
  academicYearId: String(row.academic_year_id || ''),
  dayNumber: row.day_number == null ? undefined : Number(row.day_number),
  sessionSummary: String(row.session_summary || ''),
  studentCount: row.student_count == null ? null : Number(row.student_count),
  attendanceSummary: String(row.attendance_summary || ''),
  activities: String(row.activities || ''),
  outcome: String(row.outcome || ''),
  issues: String(row.issues || ''),
  remarks: String(row.remarks || ''),
  status: String(row.status || 'Draft').toUpperCase(),
  createdBy: row.created_by || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  photos: photos.map(mapSessionReportPhoto),
});

const getSessionReportContext = async (req: AuthenticatedRequest, sessionId: string, year: any) => {
  const [sessionRows] = await pool.query<any[]>(
    `SELECT s.id, s.academic_year_id, s.cluster_id, s.panchayat_id, s.village_id,
            s.volunteer_id, s.date, s.session_status, s.name AS stored_name,
            ay.name AS academic_year_name, ay.status AS academic_year_status,
            c.name AS cluster_name, c.college_name,
            p.name AS panchayat_name, v.name AS village_name,
            primary_volunteer.name AS primary_volunteer_name,
            setup.day_number, setup.session_name
     FROM sessions s
     JOIN academic_years ay ON ay.id = s.academic_year_id
     JOIN clusters c ON c.id = s.cluster_id AND c.academic_year_id = s.academic_year_id
     LEFT JOIN panchayats p ON p.id = s.panchayat_id
       AND p.academic_year_id = s.academic_year_id AND p.cluster_id = s.cluster_id
     LEFT JOIN villages v ON v.id = s.village_id
       AND v.academic_year_id = s.academic_year_id AND v.cluster_id = s.cluster_id
       AND v.panchayat_id = s.panchayat_id
     LEFT JOIN volunteers primary_volunteer ON primary_volunteer.id = s.volunteer_id
       AND primary_volunteer.academic_year_id = s.academic_year_id
       AND primary_volunteer.cluster_id = s.cluster_id
     LEFT JOIN academic_setup setup ON setup.academic_year_id = s.academic_year_id
       AND (s.id = CONCAT('academic-session-', LEFT(SHA2(CONCAT(s.cluster_id, ':', s.academic_year_id), 256), 32), '-', setup.day_number)
         OR s.id = CONCAT('academic-session-', s.cluster_id, '-', s.academic_year_id, '-', setup.day_number)
         OR s.id = CONCAT('academic-session-', s.cluster_id, '-', setup.day_number))
     WHERE s.id = ? AND s.academic_year_id = ?
     LIMIT 1`,
    [sessionId, year.id],
  );
  const row = sessionRows[0];
  if (!row) return { error: 'This saved session was not found in the selected academic year.', status: 404 };
  if (req.user.role === 'Cluster Admin') {
    const authorizedClusterId = await resolveClusterForAcademicYear(req, year.id);
    if (row.cluster_id !== authorizedClusterId) return { error: 'This session is outside your cluster.', status: 403 };
  }
  if (!row.day_number || !row.session_name) {
    return { error: 'This session is not linked to an Academic Year Session Plan day.', status: 409 };
  }

  const [attendanceRows] = await pool.query<any[]>(
    `SELECT COUNT(*) AS attendance_records,
            COALESCE(SUM(present_count), 0) AS present_count,
            COALESCE(SUM(total_count), 0) AS total_count
     FROM attendance_sessions
     WHERE session_id = ? AND academic_year_id = ? AND cluster_id = ?
       AND (? IS NULL OR panchayat_id = ?)
       AND (? IS NULL OR village_id = ?)`,
    [row.id, year.id, row.cluster_id, row.panchayat_id, row.panchayat_id, row.village_id, row.village_id],
  );
  const attendance = attendanceRows[0] || {};

  const [lessonPlans] = await pool.query<any[]>(
    `SELECT id, module_id, title, topic, target_standard, activities, remarks
     FROM lesson_plans
     WHERE session_id = ? AND academic_year_id = ? AND cluster_id = ?
     ORDER BY created_at ASC`,
    [row.id, year.id, row.cluster_id],
  );

  const volunteerIds = new Set<string>();
  if (row.volunteer_id && row.primary_volunteer_name) volunteerIds.add(String(row.volunteer_id));
  const [attendanceVolunteers] = await pool.query<any[]>(
    `SELECT DISTINCT va.volunteer_id
     FROM volunteer_attendance va
     JOIN attendance_sessions ats ON ats.id = va.attendance_session_id
     JOIN volunteers vol ON vol.id = va.volunteer_id
     WHERE ats.session_id = ? AND ats.academic_year_id = ? AND ats.cluster_id = ?
       AND vol.academic_year_id = ? AND vol.cluster_id = ?
       AND (? IS NULL OR ats.panchayat_id = ?)
       AND (? IS NULL OR ats.village_id = ?)`,
    [row.id, year.id, row.cluster_id, year.id, row.cluster_id,
      row.panchayat_id, row.panchayat_id, row.village_id, row.village_id],
  );
  attendanceVolunteers.forEach((volunteer: any) => volunteerIds.add(String(volunteer.volunteer_id)));
  const volunteers = volunteerIds.size
    ? (await pool.query<any[]>(
      `SELECT id, name FROM volunteers
       WHERE academic_year_id = ? AND cluster_id = ? AND id IN (${Array.from(volunteerIds).map(() => '?').join(',')})
       ORDER BY name ASC`,
      [year.id, row.cluster_id, ...volunteerIds],
    ))[0].map((volunteer: any) => ({ id: String(volunteer.id), name: String(volunteer.name) }))
    : [];

  const villages = row.panchayat_id
    ? (await pool.query<any[]>(
      `SELECT id, name FROM villages
       WHERE academic_year_id = ? AND cluster_id = ? AND panchayat_id = ?
       ORDER BY name ASC`,
      [year.id, row.cluster_id, row.panchayat_id],
    ))[0].map((village: any) => ({ id: String(village.id), name: String(village.name) }))
    : [];

  const grades = Array.from(new Set(lessonPlans
    .map((plan: any) => String(plan.target_standard || '').trim())
    .filter(Boolean)));
  const lessonPlanActivities = lessonPlans.map((plan: any) => {
    let metadata: any = {};
    try { metadata = plan.remarks ? JSON.parse(plan.remarks) : {}; } catch { metadata = {}; }
    return {
      lessonPlanId: String(plan.id),
      moduleId: plan.module_id ? String(plan.module_id) : undefined,
      topic: String(plan.topic || plan.title || '').trim(),
      details: '',
      summitNumber: String(metadata.summitNumber || metadata.summitNumbers || '').trim() || null,
    };
  });
  const summitNumbers = Array.from(new Set(lessonPlanActivities.map((activity: any) => activity.summitNumber).filter(Boolean)));

  return {
    session: {
      id: String(row.id),
      name: String(row.session_name || row.stored_name || ''),
      dayNumber: Number(row.day_number),
      date: row.date ? new Date(row.date).toISOString().slice(0, 10) : null,
      status: String(row.session_status || ''),
    },
    academicYear: {
      id: String(row.academic_year_id),
      name: String(row.academic_year_name),
      status: String(row.academic_year_status || ''),
    },
    cluster: { id: String(row.cluster_id), name: String(row.cluster_name || '') },
    collegeName: String(row.college_name || ''),
    panchayat: row.panchayat_id && row.panchayat_name
      ? { id: String(row.panchayat_id), name: String(row.panchayat_name) }
      : null,
    village: row.village_id && row.village_name
      ? { id: String(row.village_id), name: String(row.village_name) }
      : null,
    villages,
    summitNumbers,
    grades,
    volunteers,
    activities: lessonPlanActivities.map(({ summitNumber: _summitNumber, ...activity }: any) => activity),
    attendance: {
      available: Number(attendance.attendance_records || 0) > 0,
      presentCount: Number(attendance.present_count || 0),
      totalCount: Number(attendance.total_count || 0),
    },
  };
};

app.get('/api/session-reports/context', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const sessionId = String(req.query.sessionId || '').trim();
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Choose a saved session from the selected academic year.' });
      return;
    }
    const context: any = await getSessionReportContext(req, sessionId, year);
    if (context?.error) {
      res.status(context.status || 400).json({ success: false, error: context.error });
      return;
    }
    res.json({ success: true, context });
  } catch (error) {
    console.error('Failed to load session report context:', error);
    res.status(503).json({ success: false, error: 'Unable to load session report context.' });
  }
});

app.get('/api/session-reports', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    let sql = `SELECT r.*, c.name AS cluster_name
      FROM session_reports r
      JOIN clusters c ON c.id = r.cluster_id
      WHERE r.academic_year_id = ?`;
    const params: any[] = [year.id];
    if (req.user.role === 'Cluster Admin') {
      const clusterId = await resolveClusterForAcademicYear(req, year.id);
      sql += ' AND r.cluster_id = ?';
      params.push(clusterId);
    }
    sql += ' ORDER BY r.created_at DESC';
    const [rows] = await pool.query<any[]>(sql, params);
    const reportIds = rows.map((row: any) => String(row.id));
    const photosByReport = new Map<string, any[]>();
    if (reportIds.length) {
      const [photoRows] = await pool.query<any[]>(
        `SELECT * FROM session_report_photos
         WHERE academic_year_id = ? AND session_report_id IN (${reportIds.map(() => '?').join(',')})
         ORDER BY created_at ASC`,
        [year.id, ...reportIds],
      );
      photoRows.forEach((photo: any) => {
        const list = photosByReport.get(String(photo.session_report_id)) || [];
        list.push(photo);
        photosByReport.set(String(photo.session_report_id), list);
      });
    }
    const sessionReports = rows.map((row: any) => mapSessionReport(row, photosByReport.get(String(row.id)) || []));
    res.json({ success: true, data: sessionReports, sessionReports });
  } catch (error) {
    console.error('Failed to fetch session reports:', error);
    res.status(503).json({ success: false, error: 'Unable to load data.' });
  }
});

app.post('/api/session-reports', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  let connection: any;
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const sessionId = String(req.body.sessionId || '').trim();
    const context: any = await getSessionReportContext(req, sessionId, year);
    if (context?.error) {
      res.status(context.status || 400).json({ success: false, error: context.error });
      return;
    }
    const reportId = String(req.body.id || `report-${randomUUID()}`).trim();
    if (req.body.id) {
      const [existingRows] = await pool.query<any[]>(
        'SELECT id, cluster_id, status FROM session_reports WHERE id = ? AND academic_year_id = ? LIMIT 1',
        [reportId, year.id],
      );
      if (!existingRows.length) {
        res.status(404).json({ success: false, error: 'Session report was not found in the selected academic year.' });
        return;
      }
      if (req.user.role === 'Cluster Admin' && existingRows[0].cluster_id !== context.cluster.id) {
        res.status(403).json({ success: false, error: 'This report is outside your cluster.' });
        return;
      }
      if (String(existingRows[0].status).toUpperCase() === 'APPROVED') {
        res.status(409).json({ success: false, error: 'Approved reports cannot be edited.' });
        return;
      }
    }
    const status = String(req.body.status || 'DRAFT').toUpperCase() === 'SUBMITTED' ? 'Submitted' : 'Draft';
    const activityContent = typeof req.body.activities === 'string'
      ? req.body.activities
      : JSON.stringify(Array.isArray(req.body.activities) ? req.body.activities : []);
    const attendanceSummary = context.attendance.available
      ? `Present ${context.attendance.presentCount} of ${context.attendance.totalCount}`
      : null;

    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO session_reports
       (id, session_id, cluster_id, academic_year_id, day_number, session_summary,
        student_count, attendance_summary, activities, outcome, issues, remarks, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE session_id = VALUES(session_id), cluster_id = VALUES(cluster_id),
        day_number = VALUES(day_number), session_summary = VALUES(session_summary),
        student_count = VALUES(student_count), attendance_summary = VALUES(attendance_summary),
        activities = VALUES(activities), outcome = VALUES(outcome), issues = VALUES(issues),
        remarks = VALUES(remarks), status = VALUES(status)`,
      [
        reportId,
        context.session.id,
        context.cluster.id,
        year.id,
        context.session.dayNumber,
        String(req.body.sessionSummary || '').trim(),
        context.attendance.available ? context.attendance.presentCount : null,
        attendanceSummary,
        activityContent,
        String(req.body.outcome || '').trim() || null,
        String(req.body.issues || '').trim() || null,
        String(req.body.remarks || '').trim() || null,
        status,
        req.user.id,
      ],
    );
    await connection.commit();

    const [rows] = await pool.query<any[]>(
      `SELECT r.*, c.name AS cluster_name FROM session_reports r
       JOIN clusters c ON c.id = r.cluster_id WHERE r.id = ? AND r.academic_year_id = ? LIMIT 1`,
      [reportId, year.id],
    );
    res.json({ success: true, data: { id: reportId }, sessionReport: mapSessionReport(rows[0]) });
  } catch (error) {
    await connection?.rollback().catch(() => undefined);
    console.error('Failed to save session report:', error);
    res.status(503).json({ success: false, error: 'Unable to save report.' });
  } finally {
    connection?.release();
  }
});

app.post('/api/session-reports/:id/photos', requireAuth, photoUploadMiddleware.array('photos', 20), async (req: AuthenticatedRequest, res: Response) => {
  const filePaths = ((req.files || []) as Express.Multer.File[]).map((file) => file.path);
  let connection: any;
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const [reports] = await pool.query<any[]>(
      'SELECT id, cluster_id FROM session_reports WHERE id = ? AND academic_year_id = ? LIMIT 1',
      [req.params.id, year.id],
    );
    if (!reports.length) {
      res.status(404).json({ success: false, error: 'Report not found in the selected academic year.' });
      return;
    }
    const report = reports[0];
    if (req.user.role === 'Cluster Admin' && report.cluster_id !== await resolveClusterForAcademicYear(req, year.id)) {
      res.status(403).json({ success: false, error: 'This report is outside your cluster.' });
      return;
    }
    const files = (req.files || []) as Express.Multer.File[];
    if (!files.length) {
      res.status(400).json({ success: false, error: 'Choose at least one photo to upload.' });
      return;
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const photoRows = files.map((file) => ({
      id: `report-photo-${randomUUID()}`,
      session_report_id: String(req.params.id),
      academic_year_id: year.id,
      cluster_id: String(report.cluster_id),
      file_path: file.path,
      original_filename: path.basename(file.originalname).slice(0, 255),
      mime_type: file.mimetype,
      file_size: file.size,
      uploaded_by: req.user.id,
    }));
    for (const photo of photoRows) {
      await connection.query(
        `INSERT INTO session_report_photos
         (id, session_report_id, academic_year_id, cluster_id, file_path, original_filename, mime_type, file_size, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [photo.id, photo.session_report_id, photo.academic_year_id, photo.cluster_id, photo.file_path,
          photo.original_filename, photo.mime_type, photo.file_size, photo.uploaded_by],
      );
    }
    await connection.commit();
    res.status(201).json({ success: true, photos: photoRows.map(mapSessionReportPhoto) });
  } catch (error) {
    await connection?.rollback().catch(() => undefined);
    filePaths.forEach((filePath) => { try { fs.unlinkSync(filePath); } catch { /* best effort cleanup */ } });
    console.error('Failed to upload session report photos:', error);
    res.status(503).json({ success: false, error: 'Unable to upload session report photos.' });
  } finally {
    connection?.release();
  }
});

app.get('/api/session-report-photos/:id/file', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const [rows] = await pool.query<any[]>(
      'SELECT file_path, mime_type, cluster_id FROM session_report_photos WHERE id = ? AND academic_year_id = ? LIMIT 1',
      [req.params.id, year.id],
    );
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Photo not found in the selected academic year.' });
      return;
    }
    if (req.user.role === 'Cluster Admin' && rows[0].cluster_id !== await resolveClusterForAcademicYear(req, year.id)) {
      res.status(403).json({ success: false, error: 'This photo is outside your cluster.' });
      return;
    }
    if (!fs.existsSync(rows[0].file_path)) {
      res.status(404).json({ success: false, error: 'Photo file is missing from storage.' });
      return;
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.type(rows[0].mime_type || 'application/octet-stream');
    res.sendFile(path.resolve(rows[0].file_path));
  } catch (error) {
    console.error('Failed to read session report photo:', error);
    res.status(503).json({ success: false, error: 'Unable to load session report photo.' });
  }
});

app.delete('/api/session-report-photos/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const [rows] = await pool.query<any[]>(
      `SELECT photo.id, photo.file_path, photo.cluster_id
       FROM session_report_photos photo
       JOIN session_reports report ON report.id = photo.session_report_id
       WHERE photo.id = ? AND photo.academic_year_id = ? AND report.academic_year_id = ? LIMIT 1`,
      [req.params.id, year.id, year.id],
    );
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Photo not found in the selected academic year.' });
      return;
    }
    if (req.user.role === 'Cluster Admin' && rows[0].cluster_id !== await resolveClusterForAcademicYear(req, year.id)) {
      res.status(403).json({ success: false, error: 'This photo is outside your cluster.' });
      return;
    }
    await pool.query('DELETE FROM session_report_photos WHERE id = ? AND academic_year_id = ?', [req.params.id, year.id]);
    try { fs.unlinkSync(rows[0].file_path); } catch { /* database reference is already removed */ }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete session report photo:', error);
    res.status(503).json({ success: false, error: 'Unable to delete session report photo.' });
  }
});

app.delete('/api/session-reports/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    let sql = 'DELETE FROM session_reports WHERE id = ? AND academic_year_id = ?';
    const params: any[] = [req.params.id, year.id];
    if (req.user.role === 'Cluster Admin') {
      sql += ' AND cluster_id = ?';
      params.push(await resolveClusterForAcademicYear(req, year.id));
    }
    const [result] = await pool.query<any>(sql, params);
    if (!result.affectedRows) {
      res.status(404).json({ success: false, error: 'Session report not found in this academic year and cluster.' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete session report:', error);
    res.status(503).json({ success: false, error: 'Unable to delete report.' });
  }
});

// --- 3. Session Submissions ---
app.post('/api/session-submissions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const { sessionId, clusterId, dayNumber } = req.body;
    const cId = await resolveClusterForAcademicYear(req, year.id, clusterId || '');
    const recordId = `sub-${year.id}-${sessionId}`;

    const [attRows] = await pool.query<any[]>("SELECT id FROM attendance_sessions WHERE session_id = ? AND day_number = ? AND academic_year_id = ? AND status != 'Draft'", [sessionId, dayNumber, year.id]);
    const attendanceComplete = attRows.length > 0;

    const [lpRows] = await pool.query<any[]>('SELECT id FROM lesson_plans WHERE session_id = ? AND academic_year_id = ?', [sessionId, year.id]);
    const lessonPlanComplete = lpRows.length > 0;

    const [photoRows] = await pool.query<any[]>('SELECT id FROM session_photos WHERE cluster_id = ? AND day_number = ? AND academic_year_id = ?', [cId, dayNumber, year.id]);
    const photosComplete = photoRows.length > 0;

    const [repRows] = await pool.query<any[]>('SELECT id FROM session_reports WHERE session_id = ? AND academic_year_id = ?', [sessionId, year.id]);
    const reportComplete = repRows.length > 0;

    const [finRows] = await pool.query<any[]>('SELECT id FROM finance_entries WHERE cluster_id = ? AND academic_year_id = ?', [cId, year.id]);
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
      `INSERT INTO session_submissions (id, session_id, cluster_id, academic_year_id, day_number, attendance_complete, lesson_plan_complete, photos_complete, report_complete, finance_complete, status, submitted_at, submitted_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE academic_year_id=VALUES(academic_year_id), attendance_complete=VALUES(attendance_complete), lesson_plan_complete=VALUES(lesson_plan_complete), photos_complete=VALUES(photos_complete), report_complete=VALUES(report_complete), finance_complete=VALUES(finance_complete), status=VALUES(status), submitted_at=VALUES(submitted_at), submitted_by=VALUES(submitted_by)`,
      [recordId, sessionId, cId, year.id, dayNumber, attendanceComplete, lessonPlanComplete, photosComplete, reportComplete, financeComplete, 'Submitted', req.user.id]
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
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    let sql = 'SELECT * FROM session_submissions WHERE academic_year_id = ?';
    const params: any[] = [year.id];
    if (req.user.role === 'Cluster Admin') {
      const clusterId = await resolveClusterForAcademicYear(req, year.id);
      sql += ' AND cluster_id = ?';
      params.push(clusterId);
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
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can create modules.' });
    return;
  }
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const { moduleNumber, moduleName, topic, description, academicYear, dayNumber } = req.body;
    const id = `mod-${randomUUID()}`;

    await pool.query(
      'INSERT INTO modules (id, code, name, description, is_active, academic_year, academic_year_id, day_number) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
      [id, moduleNumber, moduleName || topic, description, year.name, year.id, dayNumber]
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
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can update modules.' });
    return;
  }
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    if (isArchivedAcademicYear(year)) {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const { moduleNumber, moduleName, topic, description, dayNumber } = req.body;
    await pool.query(
      'UPDATE modules SET code = ?, name = ?, description = ?, academic_year = ?, academic_year_id = ?, day_number = ? WHERE id = ? AND academic_year_id = ?',
      [moduleNumber, moduleName || topic, description, year.name, year.id, dayNumber, req.params.id, year.id]
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
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can archive modules.' });
    return;
  }
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
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can upload module resources.' });
    return;
  }
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

app.delete('/api/modules/:id/resources/:resourceId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can delete module resources.' });
    return;
  }
  try {
    const [rows] = await pool.query<any[]>(
      'SELECT file_path FROM module_resources WHERE id = ? AND module_id = ? LIMIT 1',
      [req.params.resourceId, req.params.id],
    );
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Module resource not found.' });
      return;
    }
    await pool.query('DELETE FROM module_resources WHERE id = ? AND module_id = ?', [req.params.resourceId, req.params.id]);
    await fs.promises.unlink(rows[0].file_path).catch(() => undefined);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete module resource:', error);
    res.status(500).json({ success: false, error: 'Unable to delete module resource.' });
  }
});

app.get('/api/modules/:id/resources/:resourceId/download', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = await resolveAcademicYear(req);
    if (!year) {
      res.status(404).json({ success: false, error: 'No academic year is available.' });
      return;
    }
    const [rows] = await pool.query<any[]>(
      'SELECT resources.file_path, resources.original_filename FROM module_resources resources JOIN modules ON modules.id = resources.module_id WHERE resources.id = ? AND resources.module_id = ? AND modules.academic_year_id = ? LIMIT 1',
      [req.params.resourceId, req.params.id, year.id],
    );
    if (!rows.length || !fs.existsSync(rows[0].file_path)) {
      res.status(404).json({ success: false, error: 'Resource not found.' });
      return;
    }
    const isInline = req.query.inline === '1';
    if (isInline) {
      const extension = path.extname(rows[0].original_filename).toLowerCase();
      const contentType = extension === '.pdf' ? 'application/pdf'
        : extension === '.pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : extension === '.ppt' ? 'application/vnd.ms-powerpoint'
            : 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(rows[0].original_filename)}`);
      res.sendFile(rows[0].file_path);
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

const copyAcademicYearMasterData = async (
  connection: any,
  sourceYearId: string,
  targetYearId: string,
  targetYearName: string,
  selections: Record<string, unknown>,
  copiedFilePaths: string[],
  scopedClusterIds?: Map<string, string>,
) => {
  const enabled = (key: string) => selections[key] === true;
  const clusterIds = scopedClusterIds || new Map<string, string>();
  const panchayatIds = new Map<string, string>();
  const villageIds = new Map<string, string>();
  const studentIds = new Map<string, string>();
  const volunteerIds = new Map<string, string>();
  const moduleIds = new Map<string, string>();
  const sessionIds = new Map<string, string>();

  if (enabled('clusters')) {
    const [rows] = await connection.query('SELECT * FROM clusters WHERE academic_year_id = ?', [sourceYearId]);
    for (const row of rows) {
      if (scopedClusterIds) {
        if (!clusterIds.has(row.id)) continue;
        continue;
      }
      const id = `cluster-${randomUUID()}`;
      clusterIds.set(row.id, id);
      await connection.query(
        `INSERT INTO clusters (id, name, district, college_district, state, code, college_name, spoc_name, spoc_mobile, admin_id, status, academic_year_id, source_cluster_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
        [id, row.name, row.district, row.college_district, row.state, row.code, row.college_name, row.spoc_name, row.spoc_mobile, row.status, targetYearId, row.source_cluster_id || row.id],
      );
    }
  }

  if (enabled('panchayatsVillages')) {
    const [rows] = await connection.query('SELECT * FROM panchayats WHERE academic_year_id = ?', [sourceYearId]);
    for (const row of rows) {
      const clusterId = clusterIds.get(row.cluster_id);
      if (!clusterId) continue;
      const id = `panchayat-${randomUUID()}`;
      panchayatIds.set(row.id, id);
      await connection.query(
        'INSERT INTO panchayats (id, name, cluster_id, status, academic_year_id) VALUES (?, ?, ?, ?, ?)',
        [id, row.name, clusterId, row.status, targetYearId],
      );
    }

    const [villageRows] = await connection.query('SELECT * FROM villages WHERE academic_year_id = ?', [sourceYearId]);
    for (const row of villageRows) {
      const clusterId = clusterIds.get(row.cluster_id);
      const panchayatId = panchayatIds.get(row.panchayat_id);
      if (!clusterId || !panchayatId) continue;
      const id = `village-${randomUUID()}`;
      villageIds.set(row.id, id);
      await connection.query(
        'INSERT INTO villages (id, name, panchayat_id, cluster_id, status, academic_year_id) VALUES (?, ?, ?, ?, ?, ?)',
        [id, row.name, panchayatId, clusterId, row.status, targetYearId],
      );
    }
  }

  if (enabled('students')) {
    const [rows] = await connection.query('SELECT * FROM students WHERE academic_year_id = ?', [sourceYearId]);
    for (const row of rows) {
      const clusterId = clusterIds.get(row.cluster_id);
      const panchayatId = panchayatIds.get(row.panchayat_id);
      const villageId = villageIds.get(row.village_id);
      if (!clusterId || !panchayatId || !villageId) continue;
      const id = `student-${randomUUID()}`;
      studentIds.set(row.id, id);
      await connection.query(
        `INSERT INTO students (id, code, name, gender, dob, standard, cluster_id, panchayat_id, village_id, parent_name, phone, status, school_name, academic_year_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, row.code, row.name, row.gender, row.dob, row.standard, clusterId, panchayatId, villageId, row.parent_name, row.phone, row.status, row.school_name, targetYearId],
      );
    }
  }

  if (enabled('volunteers')) {
    const [rows] = await connection.query('SELECT * FROM volunteers WHERE academic_year_id = ?', [sourceYearId]);
    for (const row of rows) {
      const clusterId = clusterIds.get(row.cluster_id);
      if (!clusterId) continue;
      const id = `volunteer-${randomUUID()}`;
      volunteerIds.set(row.id, id);
      await connection.query(
        `INSERT INTO volunteers (id, name, gender, email, phone, college_name, study_year, cluster_id, panchayat_id, village_id, department, stream, passing_out_year, role, status, academic_year_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, row.name, row.gender || null, row.email, row.phone, row.college_name || null, row.study_year || null, clusterId, panchayatIds.get(row.panchayat_id) || null, villageIds.get(row.village_id) || null, row.department, row.stream, row.passing_out_year, row.role, row.status, targetYearId],
      );
    }
  }

  if (enabled('schools')) {
    const [rows] = await connection.query('SELECT * FROM schools WHERE academic_year_id = ?', [sourceYearId]);
    for (const row of rows) {
      const clusterId = clusterIds.get(row.cluster_id);
      if (!clusterId) continue;
      await connection.query(
        'INSERT INTO schools (id, name, academic_year_id, cluster_id, panchayat_id, village_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [`school-${randomUUID()}`, row.name, targetYearId, clusterId, panchayatIds.get(row.panchayat_id) || null, villageIds.get(row.village_id) || null, row.status],
      );
    }
  }

  if (enabled('moduleLibrary')) {
    const [rows] = await connection.query('SELECT * FROM modules WHERE academic_year_id = ?', [sourceYearId]);
    for (const row of rows) {
      const id = `module-${randomUUID()}`;
      moduleIds.set(row.id, id);
      await connection.query(
        'INSERT INTO modules (id, code, name, description, academic_year, academic_year_id, day_number, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, row.code, row.name, row.description, targetYearName, targetYearId, row.day_number, row.is_active],
      );
      const [resources] = await connection.query('SELECT * FROM module_resources WHERE module_id = ?', [row.id]);
      for (const resource of resources) {
        await connection.query(
          'INSERT INTO module_resources (id, module_id, original_filename, file_path, file_url) VALUES (?, ?, ?, ?, ?)',
          [`resource-${randomUUID()}`, id, resource.original_filename, resource.file_path, resource.file_url],
        );
      }
    }
  }

  const needsSessions = enabled('lessonPlans') || enabled('attendanceHistory') || enabled('sessionReports') || enabled('sessionPhotos') || enabled('financeRecords');
  if (needsSessions) {
    const [rows] = await connection.query('SELECT * FROM sessions WHERE academic_year_id = ?', [sourceYearId]);
    for (const row of rows) {
      const clusterId = clusterIds.get(row.cluster_id);
      if (!clusterId) continue;
      const id = `session-${randomUUID()}`;
      sessionIds.set(row.id, id);
      await connection.query(
        `INSERT INTO sessions (id, code, name, module_id, cluster_id, panchayat_id, village_id, volunteer_id, academic_year, academic_year_id, day_number, session_date_fixed, session_date_fixed_at, session_date_fixed_by, date, time, session_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, row.code, row.name, moduleIds.get(row.module_id) || null, clusterId, panchayatIds.get(row.panchayat_id) || null, villageIds.get(row.village_id) || null, volunteerIds.get(row.volunteer_id) || null, targetYearName, targetYearId, row.day_number, row.session_date_fixed, row.session_date_fixed_at, row.session_date_fixed_by, row.date, row.time, row.session_status],
      );
    }
  }

  if (enabled('lessonPlans')) {
    const [rows] = await connection.query('SELECT * FROM lesson_plans WHERE academic_year_id = ?', [sourceYearId]);
    for (const row of rows) {
      const clusterId = clusterIds.get(row.cluster_id);
      if (!clusterId) continue;
      await connection.query(
        `INSERT INTO lesson_plans (id, session_id, module_id, cluster_id, panchayat_id, volunteer_id, title, topic, objective, activities, materials, duration, remarks, teaching_method, assessment_task, target_standard, learning_outcomes, day_number, academic_year_id, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [`lesson-${randomUUID()}`, sessionIds.get(row.session_id) || null, moduleIds.get(row.module_id) || null, clusterId, panchayatIds.get(row.panchayat_id) || null, volunteerIds.get(row.volunteer_id) || null, row.title, row.topic, row.objective, row.activities, row.materials, row.duration, row.remarks, row.teaching_method, row.assessment_task, row.target_standard, row.learning_outcomes, row.day_number, targetYearId, row.status, row.created_by],
      );
    }
  }

  if (enabled('attendanceHistory')) {
    const [rows] = await connection.query('SELECT * FROM attendance_sessions WHERE academic_year_id = ?', [sourceYearId]);
    for (const row of rows) {
      const clusterId = clusterIds.get(row.cluster_id);
      const sessionId = sessionIds.get(row.session_id);
      if (!clusterId || !sessionId) continue;
      const attendanceId = `attendance-${randomUUID()}`;
      await connection.query(
        `INSERT INTO attendance_sessions (id, session_id, cluster_id, panchayat_id, village_id, day_number, academic_year_id, status, present_count, total_count, task_completed_count, not_marked_count, edit_reason, reviewed_by, reviewed_at, review_remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [attendanceId, sessionId, clusterId, panchayatIds.get(row.panchayat_id) || null, villageIds.get(row.village_id) || null, row.day_number, targetYearId, row.status, row.present_count, row.total_count, row.task_completed_count, row.not_marked_count, row.edit_reason, row.reviewed_by, row.reviewed_at, row.review_remarks],
      );
      const [studentRows] = await connection.query('SELECT * FROM student_attendance WHERE attendance_session_id = ?', [row.id]);
      for (const record of studentRows) {
        const studentId = studentIds.get(record.student_id);
        if (!studentId) continue;
        await connection.query(
          'INSERT INTO student_attendance (id, attendance_session_id, student_id, present, task_status) VALUES (?, ?, ?, ?, ?)',
          [`student-attendance-${randomUUID()}`, attendanceId, studentId, record.present, record.task_status],
        );
      }
      const [volunteerRows] = await connection.query('SELECT * FROM volunteer_attendance WHERE attendance_session_id = ?', [row.id]);
      for (const record of volunteerRows) {
        const volunteerId = volunteerIds.get(record.volunteer_id);
        if (!volunteerId) continue;
        await connection.query(
          'INSERT INTO volunteer_attendance (id, attendance_session_id, volunteer_id, present) VALUES (?, ?, ?, ?)',
          [`volunteer-attendance-${randomUUID()}`, attendanceId, volunteerId, record.present],
        );
      }
    }
  }

  if (enabled('sessionReports')) {
    const [rows] = await connection.query('SELECT * FROM session_reports WHERE academic_year_id = ?', [sourceYearId]);
    for (const row of rows) {
      const clusterId = clusterIds.get(row.cluster_id);
      const sessionId = sessionIds.get(row.session_id);
      if (!clusterId || !sessionId) continue;
      await connection.query(
        'INSERT INTO session_reports (id, session_id, cluster_id, academic_year_id, day_number, session_summary, student_count, attendance_summary, activities, issues, remarks, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [`report-${randomUUID()}`, sessionId, clusterId, targetYearId, row.day_number, row.session_summary, row.student_count, row.attendance_summary, row.activities, row.issues, row.remarks, row.status, row.created_by],
      );
    }
  }

  if (enabled('financeRecords')) {
    const [rows] = await connection.query('SELECT * FROM finance_entries WHERE academic_year_id = ?', [sourceYearId]);
    for (const row of rows) {
      const clusterId = clusterIds.get(row.cluster_id);
      if (!clusterId) continue;
      await connection.query(
        'INSERT INTO finance_entries (id, cluster_id, session_id, academic_year_id, date, description, category, amount, created_by, status, bill_reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [`finance-${randomUUID()}`, clusterId, sessionIds.get(row.session_id) || null, targetYearId, row.date, row.description, row.category, row.amount, row.created_by, row.status, row.bill_reference],
      );
    }
  }

  if (enabled('sessionPhotos')) {
    const [rows] = await connection.query('SELECT * FROM session_photos WHERE academic_year_id = ?', [sourceYearId]);
    for (const row of rows) {
      const clusterId = clusterIds.get(row.cluster_id);
      if (!clusterId || !row.file_path || !fs.existsSync(row.file_path)) continue;
      const id = `photo-${randomUUID()}`;
      const copiedPath = path.join(path.dirname(row.file_path), `${id}-${path.basename(row.file_path)}`);
      fs.copyFileSync(row.file_path, copiedPath);
      copiedFilePaths.push(copiedPath);
      await connection.query(
        'INSERT INTO session_photos (id, cluster_id, session_id, academic_year_id, day_number, file_path, file_url, original_filename, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, clusterId, sessionIds.get(row.session_id) || null, targetYearId, row.day_number, copiedPath, null, row.original_filename, row.uploaded_by, row.uploaded_at],
      );
    }
  }
};

// --- 5. Academic Years ---
app.get('/api/academic-years', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>(`
      SELECT ay.*,
        (SELECT COUNT(*) FROM academic_setup s WHERE s.academic_year_id = ay.id) AS session_count,
        (SELECT COUNT(*) FROM clusters c WHERE c.academic_year_id = ay.id) AS cluster_count,
        ((SELECT COUNT(DISTINCT NULLIF(TRIM(st.school_name), '')) FROM students st WHERE st.academic_year_id = ay.id) +
         (SELECT COUNT(*) FROM schools sc WHERE sc.academic_year_id = ay.id AND NOT EXISTS (SELECT 1 FROM students st WHERE st.academic_year_id = ay.id AND LOWER(TRIM(st.school_name)) = LOWER(TRIM(sc.name))))) AS school_count,
        (SELECT COUNT(*) FROM students st WHERE st.academic_year_id = ay.id) AS student_count,
        (SELECT COUNT(*) FROM volunteers v WHERE v.academic_year_id = ay.id) AS volunteer_count
      FROM academic_years ay
      ORDER BY ay.start_date DESC, ay.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Failed to fetch academic years:', error);
    res.status(503).json({ success: false, error: 'Unable to load data.' });
  }
});

app.get('/api/academic-years/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>(`
      SELECT ay.*,
        (SELECT COUNT(*) FROM academic_setup s WHERE s.academic_year_id = ay.id) AS session_count,
        (SELECT COUNT(*) FROM clusters c WHERE c.academic_year_id = ay.id) AS cluster_count,
        ((SELECT COUNT(DISTINCT NULLIF(TRIM(st.school_name), '')) FROM students st WHERE st.academic_year_id = ay.id) +
         (SELECT COUNT(*) FROM schools sc WHERE sc.academic_year_id = ay.id AND NOT EXISTS (SELECT 1 FROM students st WHERE st.academic_year_id = ay.id AND LOWER(TRIM(st.school_name)) = LOWER(TRIM(sc.name))))) AS school_count,
        (SELECT COUNT(*) FROM students st WHERE st.academic_year_id = ay.id) AS student_count,
        (SELECT COUNT(*) FROM volunteers v WHERE v.academic_year_id = ay.id) AS volunteer_count
      FROM academic_years ay WHERE ay.id = ? LIMIT 1
    `, [req.params.id]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Academic year not found.' });
      return;
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Failed to fetch academic year:', error);
    res.status(503).json({ success: false, error: 'Unable to load academic year.' });
  }
});

app.post('/api/academic-years', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can create academic years.' });
    return;
  }
  let connection: any;
  const copiedPhotoFiles: string[] = [];
  try {
    const { name, startDate, endDate } = req.body;
    const normalizedName = String(name || '').trim().replace(/[–—]/g, '-');
    const id = `ay-${randomUUID()}`;
    const startYear = Number(normalizedName.split('-')[0]);
    const endYear = Number(normalizedName.split('-')[1]);
    const safeStartDate = normalizeDateValue(startDate, `${startYear}-05-31`);
    const safeEndDate = normalizeDateValue(endDate, `${endYear}-05-30`);
    const status = String(req.body.status || (req.body.isActive ? 'ACTIVE' : 'DRAFT')).toUpperCase();

    if (!/^\d{4}-\d{4}$/.test(normalizedName) || endYear <= startYear) {
      res.status(400).json({ success: false, error: 'Academic year must use the format YYYY-YYYY with a later end year.' });
      return;
    }
    if (!['ACTIVE', 'DRAFT'].includes(status)) {
      res.status(400).json({ success: false, error: 'New academic years can only be ACTIVE or DRAFT.' });
      return;
    }

    const [existingRows] = await pool.query<any[]>('SELECT id FROM academic_years WHERE name = ? LIMIT 1', [normalizedName]);
    if (existingRows.length > 0) {
      res.status(409).json({ success: false, error: `Academic Year ${normalizedName} already exists.` });
      return;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    if (status === 'ACTIVE') {
      await connection.query("UPDATE academic_years SET is_active = 0, status = 'DRAFT' WHERE is_active = 1");
    }

    await connection.query(
      'INSERT INTO academic_years (id, name, start_date, end_date, is_active, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, normalizedName, safeStartDate, safeEndDate, status === 'ACTIVE', status, req.user.id],
    );

    const copyMode = String(req.body.copyMode || 'fresh');
    const sourceYearId = String(req.body.copyFromYearId || '').trim();
    const copySelections = req.body.copySelections || {};
    if (copyMode === 'copy' && sourceYearId) {
      const needsCluster = Boolean(copySelections.panchayatsVillages || copySelections.schools || copySelections.students || copySelections.volunteers || copySelections.lessonPlans || copySelections.attendanceHistory || copySelections.sessionReports || copySelections.sessionPhotos || copySelections.financeRecords);
      const needsGeography = Boolean(copySelections.schools || copySelections.students || copySelections.volunteers || copySelections.lessonPlans || copySelections.attendanceHistory || copySelections.sessionReports || copySelections.sessionPhotos || copySelections.financeRecords);
      if ((needsCluster && !copySelections.clusters) || (needsGeography && !copySelections.panchayatsVillages)) {
        throw Object.assign(new Error('Include Clusters and Panchayats & Villages to copy dependent records.'), { statusCode: 400 });
      }
      if (copySelections.attendanceHistory && !copySelections.students) {
        throw Object.assign(new Error('Include Students when copying attendance history.'), { statusCode: 400 });
      }
      const [sources] = await connection.query('SELECT id, name FROM academic_years WHERE id = ? LIMIT 1', [sourceYearId]);
      if (!sources.length) {
        throw Object.assign(new Error('Source academic year not found.'), { statusCode: 400 });
      }
      if (Boolean(copySelections.sessionPlan ?? true)) {
        await connection.query(
          `INSERT INTO academic_setup (academic_year_id, day_number, academic_year, session_name, session_date)
           SELECT ?, day_number, ?, session_name, session_date FROM academic_setup WHERE academic_year_id = ?
           ON DUPLICATE KEY UPDATE session_name = VALUES(session_name), session_date = VALUES(session_date), academic_year = VALUES(academic_year)`,
          [id, normalizedName, sourceYearId],
        );
      }
      await copyAcademicYearMasterData(connection, sourceYearId, id, normalizedName, copySelections, copiedPhotoFiles);
    } else if (copyMode !== 'fresh') {
      throw Object.assign(new Error('A source academic year is required for copy mode.'), { statusCode: 400 });
    }

    const emptySetupRows = DEFAULT_ACADEMIC_SESSION_NAMES.map((sessionName, index) => [
      id,
      index + 1,
      normalizedName,
      sessionName,
      null,
    ]);
    await connection.query(
      'INSERT IGNORE INTO academic_setup (academic_year_id, day_number, academic_year, session_name, session_date) VALUES ?',
      [emptySetupRows],
    );

    await connection.commit();
    res.status(201).json({ success: true, data: { id, name: normalizedName, status } });
  } catch (error: any) {
    await connection?.rollback().catch(() => undefined);
    copiedPhotoFiles.forEach((filePath) => {
      try { fs.unlinkSync(filePath); } catch { /* best effort cleanup */ }
    });
    console.error('Failed to create academic year:', error);
    if (error?.code === 'ER_DUP_ENTRY' || String(error?.message || '').includes('Duplicate entry')) {
      res.status(409).json({ success: false, error: 'This academic year already exists.' });
      return;
    }
    res.status(error?.statusCode || 500).json({ success: false, error: error?.message || 'Unable to create academic year.' });
  } finally {
    connection?.release();
  }
});

app.put('/api/academic-years/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can update academic years.' });
    return;
  }
  let connection: any;
  try {
    const [currentRows] = await pool.query<any[]>('SELECT id, status FROM academic_years WHERE id = ? LIMIT 1', [req.params.id]);
    if (!currentRows.length) {
      res.status(404).json({ success: false, error: 'Academic year not found.' });
      return;
    }
    if (String(currentRows[0].status).toUpperCase() === 'ARCHIVED') {
      res.status(409).json({ success: false, error: 'Archived academic years are read-only.' });
      return;
    }
    const name = String(req.body.name || '').trim().replace(/[–—]/g, '-');
    const startYear = Number(name.split('-')[0]);
    const endYear = Number(name.split('-')[1]);
    if (!/^\d{4}-\d{4}$/.test(name) || endYear <= startYear) {
      res.status(400).json({ success: false, error: 'Academic year must use the format YYYY-YYYY.' });
      return;
    }
    const status = String(req.body.status || (req.body.isActive ? 'ACTIVE' : 'DRAFT')).toUpperCase();
    if (!['ACTIVE', 'DRAFT'].includes(status)) {
      res.status(400).json({ success: false, error: 'Use the archive action to archive a year.' });
      return;
    }
    const safeStartDate = normalizeDateValue(req.body.startDate, `${startYear}-05-31`);
    const safeEndDate = normalizeDateValue(req.body.endDate, `${endYear}-05-30`);

    connection = await pool.getConnection();
    await connection.beginTransaction();
    if (status === 'ACTIVE') {
      await connection.query("UPDATE academic_years SET is_active = 0, status = 'DRAFT' WHERE is_active = 1 AND id <> ?", [req.params.id]);
    }

    await connection.query(
      'UPDATE academic_years SET name = ?, start_date = ?, end_date = ?, is_active = ?, status = ? WHERE id = ?',
      [name, safeStartDate, safeEndDate, status === 'ACTIVE', status, req.params.id],
    );
    await connection.commit();
    res.json({ success: true });
  } catch (error: any) {
    await connection?.rollback().catch(() => undefined);
    console.error('Failed to update academic year:', error);
    res.status(error?.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ success: false, error: error?.code === 'ER_DUP_ENTRY' ? 'This academic year already exists.' : 'Unable to update academic year.' });
  } finally {
    connection?.release();
  }
});

app.post('/api/academic-years/:id/copy-data', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const isClusterAdmin = req.user.role === 'Cluster Admin';
  if (!isClusterAdmin && req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only an authorized admin can copy academic year data.' });
    return;
  }
  let connection: any;
  const copiedPhotoFiles: string[] = [];
  try {
    const targetYearId = String(req.params.id || '').trim();
    const sourceYearId = String(req.body.copyFromYearId || '').trim();
    const copySelections = { ...(req.body.copySelections || {}) } as Record<string, unknown>;
    const scopedClusterIds = new Map<string, string>();
    if (!sourceYearId || sourceYearId === targetYearId) {
      res.status(400).json({ success: false, error: 'Choose a different source academic year.' });
      return;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [years] = await connection.query(
      'SELECT id, name, start_date, status, is_active FROM academic_years WHERE id IN (?, ?) FOR UPDATE',
      [targetYearId, sourceYearId],
    );
    const targetYear = years.find((year: any) => year.id === targetYearId);
    const sourceYear = years.find((year: any) => year.id === sourceYearId);
    if (!targetYear || !sourceYear) {
      throw Object.assign(new Error('Source or target academic year was not found.'), { statusCode: 404 });
    }
    if (isClusterAdmin) {
      if (String(targetYear.status).toUpperCase() !== 'ACTIVE' || !Boolean(targetYear.is_active)) {
        throw Object.assign(new Error('Cluster Admin can copy data only into the active academic year.'), { statusCode: 409 });
      }
      if (!req.user.clusterId || req.user.clusterId === 'all') {
        throw Object.assign(new Error('Your account is not assigned to a cluster.'), { statusCode: 403 });
      }
      const sourceStartDate = new Date(sourceYear.start_date).getTime();
      const targetStartDate = new Date(targetYear.start_date).getTime();
      if (!Number.isFinite(sourceStartDate) || !Number.isFinite(targetStartDate) || sourceStartDate >= targetStartDate) {
        throw Object.assign(new Error('Choose an earlier academic year as the copy source.'), { statusCode: 400 });
      }

      const [targetClusters] = await connection.query(
        `SELECT id, source_cluster_id FROM clusters
         WHERE academic_year_id = ? AND (id = ? OR source_cluster_id = ?)
         ORDER BY (id = ?) DESC LIMIT 1 FOR UPDATE`,
        [targetYearId, req.user.clusterId, req.user.clusterId, req.user.clusterId],
      );
      if (!targetClusters.length) {
        throw Object.assign(new Error('Your cluster is not configured for the active academic year.'), { statusCode: 403 });
      }
      const targetCluster = targetClusters[0];
      const sourceClusterKey = String(targetCluster.source_cluster_id || targetCluster.id);
      const [sourceClusters] = await connection.query(
        `SELECT id FROM clusters
         WHERE academic_year_id = ? AND (id = ? OR source_cluster_id = ?)
         ORDER BY (id = ?) DESC LIMIT 1`,
        [sourceYearId, sourceClusterKey, sourceClusterKey, sourceClusterKey],
      );
      if (!sourceClusters.length) {
        throw Object.assign(new Error('The previous academic year has no matching cluster to copy.'), { statusCode: 404 });
      }
      scopedClusterIds.set(String(sourceClusters[0].id), String(targetCluster.id));

      const clusterScopedTables = [
        'panchayats', 'villages', 'students', 'volunteers', 'schools', 'sessions',
        'attendance_sessions', 'lesson_plans', 'session_photos', 'session_reports', 'finance_entries',
      ];
      for (const table of clusterScopedTables) {
        const [rows] = await connection.query(
          `SELECT COUNT(*) AS count FROM ${table} WHERE academic_year_id = ? AND cluster_id = ?`,
          [targetYearId, targetCluster.id],
        );
        if (Number(rows[0]?.count || 0) > 0) {
          throw Object.assign(new Error('Your cluster already has data in the active year. Copying is available only before cluster data is created.'), { statusCode: 409 });
        }
      }

      // Cluster Admins may copy only cluster-scoped records, not global year setup or module configuration.
      copySelections.sessionPlan = false;
      copySelections.moduleLibrary = false;
      copySelections.clusters = true;
    } else {
      if (String(targetYear.status).toUpperCase() !== 'DRAFT' || Boolean(targetYear.is_active)) {
        throw Object.assign(new Error('Data can only be copied into an inactive draft academic year.'), { statusCode: 409 });
      }

      const yearDataTables = [
        'clusters', 'panchayats', 'villages', 'students', 'volunteers', 'schools', 'modules', 'sessions',
        'attendance_sessions', 'lesson_plans', 'session_photos', 'session_reports', 'finance_entries',
        'approvals', 'date_change_requests', 'session_submissions',
      ];
      for (const table of yearDataTables) {
        const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM ${table} WHERE academic_year_id = ?`, [targetYearId]);
        if (Number(rows[0]?.count || 0) > 0) {
          throw Object.assign(new Error('This academic year already has data. Copying is only available for an empty year.'), { statusCode: 409 });
        }
      }
    }

    const needsCluster = Boolean(copySelections.panchayatsVillages || copySelections.schools || copySelections.students || copySelections.volunteers || copySelections.lessonPlans || copySelections.attendanceHistory || copySelections.sessionReports || copySelections.sessionPhotos || copySelections.financeRecords);
    const needsGeography = Boolean(copySelections.schools || copySelections.students || copySelections.volunteers || copySelections.lessonPlans || copySelections.attendanceHistory || copySelections.sessionReports || copySelections.sessionPhotos || copySelections.financeRecords);
    if ((needsCluster && !copySelections.clusters) || (needsGeography && !copySelections.panchayatsVillages)) {
      throw Object.assign(new Error('Include Clusters and Panchayats & Villages to copy dependent records.'), { statusCode: 400 });
    }
    if (copySelections.attendanceHistory && !copySelections.students) {
      throw Object.assign(new Error('Include Students when copying attendance history.'), { statusCode: 400 });
    }
    if (Boolean(copySelections.sessionPlan)) {
      await connection.query(
        `INSERT INTO academic_setup (academic_year_id, day_number, academic_year, session_name, session_date)
         SELECT ?, day_number, ?, session_name, session_date FROM academic_setup WHERE academic_year_id = ?
         ON DUPLICATE KEY UPDATE session_name = VALUES(session_name), session_date = VALUES(session_date), academic_year = VALUES(academic_year)`,
        [targetYearId, targetYear.name, sourceYearId],
      );
    }
    await copyAcademicYearMasterData(connection, sourceYearId, targetYearId, targetYear.name, copySelections, copiedPhotoFiles, isClusterAdmin ? scopedClusterIds : undefined);
    await connection.commit();
    res.json({ success: true });
  } catch (error: any) {
    await connection?.rollback().catch(() => undefined);
    copiedPhotoFiles.forEach((filePath) => {
      try { fs.unlinkSync(filePath); } catch { /* best effort cleanup */ }
    });
    console.error('Failed to copy academic year data:', error);
    res.status(error?.statusCode || 500).json({ success: false, error: error?.message || 'Unable to copy academic year data.' });
  } finally {
    connection?.release();
  }
});

app.post('/api/academic-years/:id/activate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can activate academic years.' });
    return;
  }
  try {
    const [rows] = await pool.query<any[]>('SELECT id, status FROM academic_years WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'Academic year not found.' });
      return;
    }
    if (String(rows[0].status).toUpperCase() === 'ARCHIVED') {
      res.status(409).json({ success: false, error: 'Archived academic years cannot be activated.' });
      return;
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query("UPDATE academic_years SET is_active = 0, status = 'DRAFT' WHERE is_active = 1");
      await connection.query("UPDATE academic_years SET is_active = 1, status = 'ACTIVE' WHERE id = ?", [req.params.id]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to activate academic year:', error);
    res.status(500).json({ success: false, error: 'Unable to activate academic year.' });
  }
});

app.delete('/api/academic-years/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Super Admin') {
    res.status(403).json({ success: false, error: 'Only Super Admin can delete academic years.' });
    return;
  }
  let connection: any;
  let photoPaths: string[] = [];
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [years] = await connection.query('SELECT id, name, is_active FROM academic_years WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!years.length) {
      await connection.rollback();
      res.status(404).json({ success: false, error: 'Academic year not found.' });
      return;
    }
    let replacementYearId: string | null = null;
    if (Boolean(years[0].is_active)) {
      const [replacementYears] = await connection.query(
        `SELECT id FROM academic_years
         WHERE id <> ? AND UPPER(COALESCE(status, 'DRAFT')) <> 'ARCHIVED'
         ORDER BY is_active DESC, start_date DESC, created_at DESC
         LIMIT 1 FOR UPDATE`,
        [req.params.id],
      );
      replacementYearId = replacementYears[0]?.id || null;
    }

    const yearId = req.params.id;
    const [photos] = await connection.query('SELECT file_path FROM session_photos WHERE academic_year_id = ?', [yearId]);
    photoPaths = photos.map((photo: any) => String(photo.file_path || '')).filter(Boolean);

    await connection.query('DELETE FROM attendance_sessions WHERE academic_year_id = ?', [yearId]);
    await connection.query('DELETE FROM lesson_plans WHERE academic_year_id = ?', [yearId]);
    await connection.query('DELETE FROM session_photos WHERE academic_year_id = ?', [yearId]);
    await connection.query('DELETE FROM session_reports WHERE academic_year_id = ?', [yearId]);
    await connection.query('DELETE FROM finance_entries WHERE academic_year_id = ?', [yearId]);
    await connection.query('DELETE FROM approvals WHERE academic_year_id = ?', [yearId]);
    await connection.query('DELETE FROM date_change_requests WHERE academic_year_id = ?', [yearId]);
    await connection.query('DELETE FROM session_submissions WHERE academic_year_id = ?', [yearId]);
    await connection.query('DELETE FROM sessions WHERE academic_year_id = ?', [yearId]);
    await connection.query('DELETE FROM schools WHERE academic_year_id = ?', [yearId]);
    await connection.query('DELETE FROM modules WHERE academic_year_id = ?', [yearId]);
    await connection.query('DELETE FROM students WHERE academic_year_id = ?', [yearId]);
    await connection.query('DELETE FROM volunteers WHERE academic_year_id = ?', [yearId]);
    await connection.query('DELETE FROM villages WHERE academic_year_id = ?', [yearId]);
    await connection.query('DELETE FROM panchayats WHERE academic_year_id = ?', [yearId]);
    await connection.query('UPDATE users SET cluster_id = NULL WHERE cluster_id IN (SELECT id FROM clusters WHERE academic_year_id = ?)', [yearId]);
    await connection.query('DELETE FROM clusters WHERE academic_year_id = ?', [yearId]);
    await connection.query('DELETE FROM academic_setup WHERE academic_year_id = ?', [yearId]);
    await connection.query('DELETE FROM academic_years WHERE id = ?', [yearId]);
    if (replacementYearId) {
      await connection.query("UPDATE academic_years SET is_active = 0, status = 'DRAFT' WHERE is_active = 1");
      await connection.query("UPDATE academic_years SET is_active = 1, status = 'ACTIVE' WHERE id = ?", [replacementYearId]);
    }
    await connection.commit();

    for (const filePath of photoPaths) {
      const [references] = await pool.query<any[]>('SELECT id FROM session_photos WHERE file_path = ? LIMIT 1', [filePath]);
      if (!references.length) {
        try { fs.unlinkSync(filePath); } catch { /* best effort cleanup */ }
      }
    }
    res.json({ success: true, data: { id: yearId, name: years[0].name } });
  } catch (error: any) {
    await connection?.rollback().catch(() => undefined);
    console.error('Failed to delete academic year:', error);
    res.status(500).json({ success: false, error: 'Unable to delete academic year and its associated data.' });
  } finally {
    connection?.release();
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

