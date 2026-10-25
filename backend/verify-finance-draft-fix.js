import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: './.env' });
const pool = mysql.createPool({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'TQI_ERP' });
try {
  const [rows] = await pool.query(
    `SELECT e.draft_id, COUNT(*) AS entries, r.report_status,
            JSON_UNQUOTE(JSON_EXTRACT(r.report_data, '$.sessionDay')) AS session_day,
            JSON_UNQUOTE(JSON_EXTRACT(r.report_data, '$.sessionDate')) AS session_date
     FROM finance_entries e LEFT JOIN finance_reports r ON r.id = e.draft_id AND r.academic_year_id = e.academic_year_id
     WHERE e.draft_id = ? GROUP BY e.draft_id, r.report_status, r.report_data`,
    ['draft-day1-1791302903408'],
  );
  const [duplicates] = await pool.query(
    `SELECT COUNT(*) AS duplicate_groups FROM (
       SELECT category, description, amount, date FROM finance_entries
       WHERE cluster_id = ? AND status = 'Draft'
       GROUP BY category, description, amount, date HAVING COUNT(*) > 1
     ) grouped_entries`,
    ['namakkal-ksrangasamy-dbe974a7-1330c1ff'],
  );
  console.log(JSON.stringify({ retainedDraft: rows[0] || null, remainingDuplicateGroups: Number(duplicates[0]?.duplicate_groups || 0) }, null, 2));
} finally { await pool.end(); }
