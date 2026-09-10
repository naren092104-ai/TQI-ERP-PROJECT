import dotenv from 'dotenv';
import path from 'path';
import mysql, { Pool, PoolOptions } from 'mysql2/promise';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DB_NAME = process.env.DB_NAME || 'TQI_ERP';
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
};

import { initDatabaseSchema } from './init.js';

export let pool: Pool;

/**
 * Connect to MySQL, create the database if missing, set up the pool.
 * Does NOT run schema migrations or the post-migration bootstrap — those
 * run later in startServer, after runSqlFiles has applied the v2 schema.
 */
export async function initializeDatabase(): Promise<void> {
  if (pool) {
    return;
  }

  console.log(`[DB] Initializing MySQL connection (${baseConfig.user}@${baseConfig.host}:${baseConfig.port})...`);
  const adminPool = mysql.createPool(baseConfig);
  try {
    await adminPool.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    console.log(`[DB] Database '${DB_NAME}' verified/created.`);
  } catch (err: any) {
    console.error(`[DB ERROR] Failed to connect/create database '${DB_NAME}':`, err.message);
    throw err;
  } finally {
    await adminPool.end();
  }

  pool = mysql.createPool({
    ...baseConfig,
    database: DB_NAME,
  });
  console.log(`[DB] Connection pool created for '${DB_NAME}'.`);
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


