import bcrypt from 'bcryptjs';
import { pool, initializeDatabase } from '../db/connection.js';

async function resetAndSeed() {
  try {
    console.log('[RESET] Connecting to database...');
    await initializeDatabase();

    console.log('[RESET] Disabling foreign key checks...');
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');

    const tables = [
      'audit_logs',
      'auth_otps',
      'student_attendance',
      'volunteer_attendance',
      'attendance_sessions',
      'correction_requests',
      'approvals',
      'finance_bills',
      'finance_transactions',
      'finance_drafts',
      'finance_entries',
      'notifications',
      'session_photos',
      'session_reports',
      'date_change_requests',
      'session_submissions',
      'lesson_plans',
      'sessions',
      'students',
      'volunteers',
      'villages',
      'panchayats',
      'clusters',
      'users',
      'academic_setup',
      'academic_years',
      'module_resources',
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

    // Create default super admin: username "admin" / email "admin@tqi.org" with password "admin123"
    const passwordHash = await bcrypt.hash('admin123', 10);

    console.log('[RESET] Seeding default Super Admin user (name: Admin, email: admin@tqi.org / admin, password: admin123)...');
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, cluster_id, phone, must_change_password, status) VALUES
       ('usr-super-admin', 'Admin', 'admin@tqi.org', ?, 'SUPER_ADMIN', NULL, '+91 90000 00000', FALSE, 'ACTIVE'),
       ('usr-admin-alias', 'Admin', 'admin', ?, 'SUPER_ADMIN', NULL, '+91 90000 00000', FALSE, 'ACTIVE')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = VALUES(name), role = VALUES(role), must_change_password = FALSE, status = 'ACTIVE'`,
      [passwordHash, passwordHash],
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
    console.log('   Identifier / Email : admin  OR  admin@tqi.org');
    console.log('   Password           : admin123');
    console.log('   Role               : Super Admin');
    console.log('======================================================\n');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to reset database:', error);
    process.exit(1);
  }
}

resetAndSeed();
