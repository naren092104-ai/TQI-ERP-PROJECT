import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { pool, initializeDatabase } from '../db/connection.js';

async function runCleanReset() {
  try {
    if (process.env.NODE_ENV === 'production') {
      const password = process.env.ADMIN_DEFAULT_PASSWORD?.trim() || '';
      if (process.env.ALLOW_DESTRUCTIVE_DB_RESET !== 'true') {
        throw new Error('Production database reset is blocked. Set ALLOW_DESTRUCTIVE_DB_RESET=true only for an intentional maintenance operation.');
      }
      if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        throw new Error('Production reset requires a strong ADMIN_DEFAULT_PASSWORD before any database changes.');
      }
    }
    console.log('[CLEAN-RESET] Connecting to database...');
    await initializeDatabase();

    // 1. Run migrations to ensure all latest tables exist
    console.log('[CLEAN-RESET] Ensuring all migrations are applied...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const projectRoot = fs.existsSync(path.join(process.cwd(), 'frontend'))
      ? process.cwd()
      : path.resolve(process.cwd(), '..');
    const migrationDir = path.join(projectRoot, 'database', 'migrations');
    if (fs.existsSync(migrationDir)) {
      const files = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql')).sort();
      for (const file of files) {
        const filePath = path.join(migrationDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
        for (const stmt of statements) {
          try {
            await pool.query(stmt);
          } catch (e: any) {
            // ignore benign duplicate errors
          }
        }
        await pool.query('INSERT IGNORE INTO schema_migrations (version) VALUES (?)', [file]);
      }
      console.log(`[CLEAN-RESET] Applied ${files.length} migrations.`);
    }

    // 2. Truncate operational tables child-first
    console.log('[CLEAN-RESET] Disabling foreign keys and truncating all operational tables...');
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');

    const tables = [
      'audit_logs',
      'user_password_history',
      'auth_otps',
      'volunteer_attendance',
      'student_attendance',
      'attendance_sessions',
      'approvals',
      'notifications',
      'session_photos',
      'session_reports',
      'date_change_requests',
      'session_submissions',
      'lesson_plans',
      'module_resources',
      'sessions',
      'finance_report_history',
      'finance_reports',
      'finance_entries',
      'students',
      'volunteers',
      'villages',
      'panchayats',
      'users',
      'clusters',
      'academic_setup',
      'academic_years',
      'modules',
    ];

    for (const table of tables) {
      try {
        await pool.query(`TRUNCATE TABLE \`${table}\``);
        console.log(`[CLEAN-RESET] Truncated: ${table}`);
      } catch (err: any) {
        console.log(`[CLEAN-RESET] Notice on ${table}: ${err.message}`);
      }
    }

    await pool.query('SET FOREIGN_KEY_CHECKS = 1');

    // 3. Seed default Super Admin (password: admin123, must_change_password: FALSE)
    const rawPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    console.log('[CLEAN-RESET] Seeding Super Admin...');
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, cluster_id, phone, must_change_password, status)
       VALUES ('usr-super-admin', 'Super Admin', 'admin@tqi.org', ?, 'Super Admin', NULL, '+91 90000 00000', FALSE, 'Active')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), must_change_password = FALSE, status = 'Active'`,
      [passwordHash],
    );

    // 4. Seed Active Academic Year
    console.log('[CLEAN-RESET] Seeding active academic year...');
    await pool.query(
      `INSERT INTO academic_years (id, name, start_date, end_date, is_active, status)
       VALUES ('ay-2025-2026', '2025-2026', '2025-06-01', '2026-05-31', 1, 'ACTIVE')
       ON DUPLICATE KEY UPDATE is_active = 1, status = 'ACTIVE'`,
    );

    // 5. Seed 8 Academic Setup Days
    console.log('[CLEAN-RESET] Seeding 8 academic setup days...');
    const academicDays: [number, string][] = [
      [1, 'Parents Meet'],
      [2, 'Know Your Locality'],
      [3, 'Books to Bytes'],
      [4, 'Sports'],
      [5, 'Science'],
      [6, 'Art Education'],
      [7, 'Constitution'],
      [8, 'Tinkering Session'],
    ];
    for (const [dayNum, sessionName] of academicDays) {
      await pool.query(
        `INSERT INTO academic_setup (academic_year_id, day_number, academic_year, session_name)
         VALUES ('ay-2025-2026', ?, '2025-2026', ?)
         ON DUPLICATE KEY UPDATE session_name = VALUES(session_name)`,
        [dayNum, sessionName],
      );
    }

    // 6. Seed Foundation Modules
    console.log('[CLEAN-RESET] Seeding foundation modules...');
    await pool.query(
      `INSERT INTO modules (id, name, code, description, is_active, academic_year, day_number)
       VALUES
         ('module-english', 'Spoken English', 'ENG-01', 'English communication & vocabulary', TRUE, '2025-2026', 1),
         ('module-maths', 'Mathematics Basics', 'MATH-02', 'Foundational arithmetic & problem solving', TRUE, '2025-2026', 2),
         ('module-life-skills', 'Life Skills & Confidence', 'LIFE-03', 'Critical thinking, ethics & leadership', TRUE, '2025-2026', 3)
       ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = TRUE`,
    );

    // 7. Seed System Settings & Maintenance
    await pool.query(
      `INSERT INTO maintenance_settings (id, enabled, title, message)
       VALUES ('website_maintenance', 0, 'Website Under Maintenance', 'Maintenance')
       ON DUPLICATE KEY UPDATE enabled = 0`,
    ).catch(() => undefined);

    await pool.query(
      `INSERT INTO tqi_settings (setting_key, setting_value)
       VALUES ('finance_officer_name', 'TQI Finance Team')
       ON DUPLICATE KEY UPDATE setting_value = 'TQI Finance Team'`,
    ).catch(() => undefined);

    console.log('\n======================================================');
    console.log('✅ CLEAN DATABASE RESET COMPLETED');
    console.log('------------------------------------------------------');
    console.log('All tables wiped and baseline entities seeded.');
    console.log(`Email    : admin@tqi.org`);
    console.log(process.env.NODE_ENV === 'production'
      ? 'Password : supplied through ADMIN_DEFAULT_PASSWORD (not printed)'
      : `Password : ${rawPassword}`);
    console.log('======================================================\n');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Clean reset failed:', error);
    process.exit(1);
  }
}

runCleanReset();
