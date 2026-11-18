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
    dotenv.config({ path: envPath, override: false, quiet: true });
  }
}

const DB_NAME = process.env.DB_NAME || 'TQI_ERP';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_SSL = process.env.DB_SSL === 'true';
const DB_SSL_CA = process.env.DB_SSL_CA?.replace(/\\n/g, '\n').trim();
const DB_CREATE_IF_MISSING = process.env.DB_CREATE_IF_MISSING !== undefined
  ? process.env.DB_CREATE_IF_MISSING === 'true'
  : process.env.NODE_ENV !== 'production';
const DB_CONNECTION_LIMIT = Number(process.env.DB_CONNECTION_LIMIT || (process.env.VERCEL ? 5 : 10));
const DB_CONNECT_TIMEOUT_MS = Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000);
const baseConfig: PoolOptions = {
  host: DB_HOST,
  port: DB_PORT,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: DB_CONNECTION_LIMIT,
  queueLimit: 0,
  connectTimeout: DB_CONNECT_TIMEOUT_MS,
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
 * Connect to MySQL and set up the pool. Database creation is opt-in for
 * development only; production requires an existing remote database and
 * verified TLS. Production schema migrations/DDL are never run automatically.
 */
export async function initializeDatabase(): Promise<void> {
  if (pool) {
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    const host = DB_HOST.trim();
    if (!process.env.DB_HOST?.trim() || /(^|\.)localhost$/i.test(host) || /^127\./.test(host) || host === '::1') {
      throw new Error('Production requires DB_HOST to be a remote database hostname; localhost is only allowed in development.');
    }
    if (!process.env.DB_NAME?.trim()) {
      throw new Error('Production requires an explicit DB_NAME.');
    }
    if (!process.env.DB_PORT || !Number.isInteger(DB_PORT) || DB_PORT < 1 || DB_PORT > 65535) {
      throw new Error('Production requires a valid DB_PORT.');
    }
    if (!process.env.DB_USER?.trim() || !process.env.DB_PASSWORD) {
      throw new Error('Production requires DB_USER and DB_PASSWORD for the database connection.');
    }
    if (!DB_SSL) {
      throw new Error('Production database connections require DB_SSL=true.');
    }
    if (!DB_SSL_CA || !DB_SSL_CA.includes('-----BEGIN CERTIFICATE-----')) {
      throw new Error('Production database connections require a PEM CA certificate in DB_SSL_CA.');
    }
    if (DB_CREATE_IF_MISSING) {
      throw new Error('DB_CREATE_IF_MISSING must be false in production; provision the database before deployment.');
    }
  }

  if (!Number.isInteger(DB_CONNECTION_LIMIT) || DB_CONNECTION_LIMIT < 1 || DB_CONNECTION_LIMIT > 50) {
    throw new Error('DB_CONNECTION_LIMIT must be an integer between 1 and 50.');
  }
  if (!Number.isInteger(DB_CONNECT_TIMEOUT_MS) || DB_CONNECT_TIMEOUT_MS < 1000 || DB_CONNECT_TIMEOUT_MS > 60000) {
    throw new Error('DB_CONNECT_TIMEOUT_MS must be an integer between 1000 and 60000.');
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
