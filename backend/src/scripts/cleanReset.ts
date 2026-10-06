import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { pool, initializeDatabase } from '../db/connection.js';

async function runCleanReset() {
  try {
    console.log('[CLEAN-RESET] Connecting to database...');
    await initializeDatabase();

    // 1. Run migrations to ensure all latest tables exist
    console.log('[CLEAN-RESET] Ensuring all migrations are applied...');
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
      }
      console.log(`[CLEAN-RESET] Applied ${files.length} migrations.`);
    }

    // 2. Truncate ALL v2 tables.
    //    Order: child-first to avoid any FK violation edge cases.
    //    (FKs in v2 use sensible cascades, but TRUNCATE doesn't fire them —
    //    so we drop children first to be safe.)
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

    // 3. Seed ONLY the default Super Admin (random password).
    const rawPassword = randomBytes(12).toString('base64').replace(/[+/=]/g, '').slice(0, 16);
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    console.log('[CLEAN-RESET] Seeding ONLY Super Admin...');
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, cluster_id, phone, must_change_password, status)
       VALUES ('usr-super-admin', 'Super Admin', 'admin@tqi.org', ?, 'Super Admin', NULL, '+91 90000 00000', TRUE, 'Active')`,
      [passwordHash],
    );

    console.log('\n======================================================');
    console.log('✅ CLEAN DATABASE RESET COMPLETED');
    console.log('------------------------------------------------------');
    console.log('All tables wiped. Only Super Admin preserved.');
    console.log(`Email    : admin@tqi.org`);
    console.log(`Password : ${rawPassword}`);
    console.log('======================================================\n');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Clean reset failed:', error);
    process.exit(1);
  }
}

runCleanReset();
