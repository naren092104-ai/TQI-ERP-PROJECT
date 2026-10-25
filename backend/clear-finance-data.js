import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();
dotenv.config({ path: './.env' });
dotenv.config({ path: '../.env' });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'TQI_ERP',
  waitForConnections: true,
  connectionLimit: 5,
  charset: 'utf8mb4',
});

try {
  const [approvalResult] = await pool.query('DELETE FROM approvals WHERE module = ? OR module = ?', ['Finance', 'finance']);
  const [entryResult] = await pool.query('TRUNCATE TABLE finance_entries');
  const [entryRows] = await pool.query('SELECT COUNT(*) AS financeEntries FROM finance_entries');
  const [approvalRows] = await pool.query('SELECT COUNT(*) AS financeApprovals FROM approvals WHERE module = ? OR module = ?', ['Finance', 'finance']);

  console.log(JSON.stringify({
    approvalsDeleted: Number(approvalResult?.affectedRows || 0),
    entriesTruncated: Number(entryResult?.affectedRows || 0),
    financeEntriesRemaining: Number(entryRows?.[0]?.financeEntries || 0),
    financeApprovalsRemaining: Number(approvalRows?.[0]?.financeApprovals || 0),
  }, null, 2));
} catch (error) {
  console.error('Finance data cleanup failed:', error);
  process.exit(1);
} finally {
  await pool.end();
}
