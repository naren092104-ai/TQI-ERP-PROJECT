import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: './.env' });
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'TQI_ERP',
});
try {
  const [rows] = await pool.query(
    `SELECT id, draft_id, cluster_id, category, description, amount, date, status, created_at
     FROM finance_entries
     WHERE draft_id IN (?, ?, ?)
     ORDER BY draft_id, created_at, id`,
    ['draft-day1-1791302610673', 'draft-day1-1791302618312', 'draft-day1-1791302903408'],
  );
  console.log(JSON.stringify(rows.map((row) => ({ ...row, amount: Number(row.amount) })), null, 2));
} finally {
  await pool.end();
}
