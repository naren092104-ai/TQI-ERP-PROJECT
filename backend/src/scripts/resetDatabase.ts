import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { pool, initializeDatabase } from '../db/connection.js';

async function resetAndSeed() {
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
    console.log('[RESET] Connecting to database...');
    await initializeDatabase();

    console.log('[RESET] Disabling foreign key checks...');
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');

    // v2 table set (finance_drafts and correction_requests were dropped;
    // finance_bills / finance_transactions never existed).
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
        console.log(`[RESET] Truncated table: ${table}`);
      } catch (err: any) {
        // If table doesn't exist yet, it's fine
        console.log(`[RESET] Notice on ${table}: ${err.message}`);
      }
    }

    console.log('[RESET] Re-enabling foreign key checks...');
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');

    // Create default super admin with a random password.
    const rawPassword = process.env.ADMIN_DEFAULT_PASSWORD?.trim()
      || randomBytes(12).toString('base64').replace(/[+/=]/g, '').slice(0, 16);
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    console.log('[RESET] Seeding default Super Admin user...');
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, cluster_id, phone, must_change_password, status)
       VALUES ('usr-super-admin', 'Super Admin', 'admin@tqi.org', ?, 'Super Admin', NULL, '+91 90000 00000', TRUE, 'Active')`,
      [passwordHash],
    );

    // Seed standard reference modules
    console.log('[RESET] Seeding standard modules...');
    await pool.query(
      `INSERT INTO modules (id, name, code, description, is_active) VALUES
       ('module-english', 'Spoken English', 'ENG-01', 'English communication & vocabulary', TRUE),
       ('module-maths', 'Mathematics Basics', 'MATH-02', 'Foundational arithmetic & problem solving', TRUE),
       ('module-life-skills', 'Life Skills & Confidence', 'LIFE-03', 'Critical thinking, ethics & leadership', TRUE)
       ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = TRUE`,
    );

    console.log('\n======================================================');
    console.log('✅ DATABASE RESET COMPLETED SUCCESSFULLY');
    console.log('------------------------------------------------------');
    console.log('👤 Super Admin Account:');
    console.log('   Email    : admin@tqi.org');
    console.log(process.env.NODE_ENV === 'production'
      ? '   Password : supplied through ADMIN_DEFAULT_PASSWORD (not printed)'
      : `   Password : ${rawPassword}`);
    console.log('   Role     : Super Admin');
    console.log('======================================================\n');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to reset database:', error);
    process.exit(1);
  }
}

resetAndSeed();
