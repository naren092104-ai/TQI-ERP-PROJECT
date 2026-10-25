import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import mysql, { Pool, PoolOptions } from 'mysql2/promise';

// Quietly load environment variables from the nearest .env file
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(process.cwd(), '..', '.env'),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true, quiet: true });
  }
}

const DB_NAME = process.env.DB_NAME || 'TQI_ERP';
const DB_SSL = process.env.DB_SSL === 'true';
const DB_SSL_CA = process.env.DB_SSL_CA?.replace(/\\n/g, '\n');
const DB_CREATE_IF_MISSING = process.env.DB_CREATE_IF_MISSING !== 'false';
const baseConfig: PoolOptions = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: '+00:00',
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  ...(DB_SSL
    ? { ssl: { rejectUnauthorized: true, ...(DB_SSL_CA ? { ca: DB_SSL_CA } : {}) } }
    : {}),
};

import { initDatabaseSchema } from './init.js';

export let pool: Pool;

/**
 * Connect to MySQL, create the database if missing, set up the pool.
 * Does NOT run schema migrations or the post-migration bootstrap — those
 * run later in startServer, after runSqlFiles has applied the schema.
 */
export async function initializeDatabase(): Promise<void> {
  if (pool) {
    return;
  }

  if (DB_CREATE_IF_MISSING) {
    const adminPool = mysql.createPool(baseConfig);
    try {
      await adminPool.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    } catch (err: any) {
      const errorDetails = err?.message || err?.sqlMessage || err?.code || String(err);
      throw new Error(`Failed to initialize database '${DB_NAME}' on MySQL (${baseConfig.user}@${baseConfig.host}:${baseConfig.port}): ${errorDetails}`);
    } finally {
      await adminPool.end();
    }
  }

  pool = mysql.createPool({
    ...baseConfig,
    database: DB_NAME,
  });
}

export { initDatabaseSchema };

export async function testDatabaseConnection(): Promise<void> {
  if (!pool) {
    await initializeDatabase();
  }
  await pool.query('SELECT 1 as ok');
}

export async function getDatabaseStatus(): Promise<'connected' | 'disconnected'> {
  try {
    await testDatabaseConnection();
    return 'connected';
  } catch (error: any) {
    console.error('[DB] MySQL connection test failed:', error.message);
    return 'disconnected';
  }
}
