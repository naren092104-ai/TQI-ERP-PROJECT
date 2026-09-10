import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { pool } from './connection.js';

/**
 * Thin post-migration verifier and Super Admin bootstrap.
 *
 * The migration runner at backend/src/server.ts (runSqlFiles) is the single
 * source of truth for schema. After it has applied every .sql file under
 * database/migrations/, this function is called to:
 *   1. Verify schema_migrations is populated.
 *   2. If users is empty, insert ONE Super Admin with a random bcrypt-hashed
 *      password and print the credentials to the console.
 *
 * No inline DDL, no COLUMN_PATCHES, no demo data, no alias row.
 */
export async function initDatabaseSchema(): Promise<void> {
  console.log('[DB] Verifying database schema...');

  // 1. Confirm schema_migrations has rows.
  const [migrationRows] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM schema_migrations');
  const appliedCount = Number(migrationRows[0]?.n ?? 0);
  if (appliedCount === 0) {
    throw new Error('No migrations recorded in schema_migrations. The migration runner should have run before this.');
  }
  console.log(`[DB] ${appliedCount} migration(s) recorded.`);

  // 2. Seed a Super Admin if the users table is empty.
  const [userRows] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM users');
  const userCount = Number(userRows[0]?.n ?? 0);

  if (userCount > 0) {
    console.log(`[DB] ${userCount} user(s) present. Skipping Super Admin bootstrap.`);
    return;
  }

  // 16-char URL-safe random password.
  const rawPassword = randomBytes(12).toString('base64').replace(/[+/=]/g, '').slice(0, 16);
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, cluster_id, phone, must_change_password, status)
     VALUES ('usr-super-admin', 'Super Admin', 'admin@tqi.org', ?, 'Super Admin', NULL, '+91 90000 00000', TRUE, 'Active')`,
    [passwordHash],
  );

  console.log('');
  console.log('======================================================');
  console.log('[BOOTSTRAP] Super Admin created.');
  console.log('------------------------------------------------------');
  console.log('   Email    : admin@tqi.org');
  console.log(`   Password : ${rawPassword}`);
  console.log('   Role     : Super Admin');
  console.log('------------------------------------------------------');
  console.log('   Change the password on first login (mustChangePassword = true).');
  console.log('======================================================');
  console.log('');
}
