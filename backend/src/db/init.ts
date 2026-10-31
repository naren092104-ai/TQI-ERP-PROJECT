import bcrypt from 'bcryptjs';
import { pool } from './connection.js';

export interface InitDatabaseResult {
  userCount: number;
  bootstrapped: boolean;
  adminEmail?: string;
}

/**
 * Post-migration verifier and Super Admin bootstrap.
 *
 * The migration runner at backend/src/server.ts (runSqlFiles) is the single
 * source of truth for schema. After it has applied every .sql file under
 * database/migrations/, this function is called to:
 *   1. Verify schema_migrations is populated.
 *   2. If users is empty, insert ONE Super Admin with a bcrypt-hashed
 *      password and print the account email (never the password) to the console.
 */
export async function initDatabaseSchema(): Promise<InitDatabaseResult> {
  // 1. Confirm schema_migrations has rows.
  const [migrationRows] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM schema_migrations');
  const appliedCount = Number(migrationRows[0]?.n ?? 0);
  if (appliedCount === 0) {
    throw new Error('No migrations recorded in schema_migrations. The migration runner should have run before this.');
  }

  // 2. Seed a Super Admin if the users table is empty.
  const [userRows] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM users');
  const userCount = Number(userRows[0]?.n ?? 0);

  if (userCount > 0) {
    return { userCount, bootstrapped: false };
  }

  const rawPassword = process.env.ADMIN_DEFAULT_PASSWORD?.trim();
  if (process.env.NODE_ENV === 'production' && !rawPassword) {
    throw new Error('Set ADMIN_DEFAULT_PASSWORD before bootstrapping the first production administrator.');
  }
  const initialPassword = rawPassword || 'admin123';
  if (
    process.env.NODE_ENV === 'production' &&
    (initialPassword.length < 12 || !/[A-Z]/.test(initialPassword) || !/[a-z]/.test(initialPassword) || !/\d/.test(initialPassword) || !/[^A-Za-z0-9]/.test(initialPassword))
  ) {
    throw new Error('ADMIN_DEFAULT_PASSWORD must be at least 12 characters with upper/lowercase letters, a number, and a symbol.');
  }
  const passwordHash = await bcrypt.hash(initialPassword, 10);

  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, cluster_id, phone, must_change_password, status)
     VALUES ('usr-super-admin', 'Super Admin', 'admin@tqi.org', ?, 'Super Admin', NULL, '+91 90000 00000', FALSE, 'Active')`,
    [passwordHash],
  );

  console.log('\n======================================================');
  console.log('[BOOTSTRAP] Super Admin account created.');
  console.log('------------------------------------------------------');
  console.log('   Email    : admin@tqi.org');
  console.log('   Password : configured securely; not printed to logs');
  console.log('   Role     : Super Admin');
  console.log('======================================================\n');

  return { userCount: 1, bootstrapped: true, adminEmail: 'admin@tqi.org' };
}
