import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';

dotenv.config({ path: './.env' });
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'TQI_ERP',
});
const reportId = 'draft-day1-1791302903408';
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  const [entryRows] = await connection.query(
    'SELECT * FROM finance_entries WHERE draft_id = ? ORDER BY created_at ASC FOR UPDATE',
    [reportId],
  );
  if (entryRows.length !== 4 || entryRows.some((row) => row.status !== 'Draft')) throw new Error('Retained draft did not match the expected four editable rows.');
  const [existing] = await connection.query('SELECT id FROM finance_reports WHERE id = ? LIMIT 1', [reportId]);
  if (existing.length) throw new Error('Finance report metadata already exists; refusing to overwrite it.');
  const clusterId = entryRows[0].cluster_id;
  const academicYearId = entryRows[0].academic_year_id;
  if (entryRows.some((row) => row.cluster_id !== clusterId || row.academic_year_id !== academicYearId)) throw new Error('Draft rows cross cluster/year boundaries.');
  const [clusterRows] = await connection.query('SELECT name, college_name, spoc_name, admin_id FROM clusters WHERE id = ? LIMIT 1', [clusterId]);
  const cluster = clusterRows[0] || {};
  const travel = entryRows.find((row) => row.category === 'Travel');
  const breakfast = entryRows.find((row) => row.description.toLowerCase().includes('breakfast'));
  const refreshments = entryRows.find((row) => row.description.toLowerCase().includes('refreshments'));
  const stationery = entryRows.find((row) => row.category === 'Materials' || row.category === 'Stationery');
  const date = entryRows[0].date instanceof Date
    ? `${entryRows[0].date.getFullYear()}-${String(entryRows[0].date.getMonth() + 1).padStart(2, '0')}-${String(entryRows[0].date.getDate()).padStart(2, '0')}`
    : String(entryRows[0].date).slice(0, 10);
  const report = {
    id: reportId,
    title: 'Parents Meet - Day 1 Finance Report',
    sessionDay: 'Day 1',
    sessionDate: date,
    clusterId,
    clusterName: cluster.name || clusterId,
    collegeName: cluster.college_name || '',
    spocName: cluster.spoc_name || '',
    financerName: 'TQI Finance Team',
    status: 'Draft',
    lastSaved: new Date().toISOString(),
    totalAmount: entryRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    routes: travel ? [{ id: travel.id, from: 'ksr', to: 'salem', volunteers: 10, perPerson: 31, remarks: travel.remarks || '', bill: null }] : [],
    food: {
      breakfast: { amount: Number(breakfast?.amount || 0), remarks: breakfast?.remarks || '', bill: breakfast?.bill_url ? { url: breakfast.bill_url, fileName: breakfast.bill_reference || '', isVerified: true } : null },
      lunch: { amount: 0, remarks: '', bill: null },
      dinner: { amount: 0, remarks: '', bill: null },
      refreshments: { amount: Number(refreshments?.amount || 0), remarks: refreshments?.remarks || '', bill: refreshments?.bill_url ? { url: refreshments.bill_url, fileName: refreshments.bill_reference || '', isVerified: true } : null },
    },
    stationery: { amount: Number(stationery?.amount || 0), remarks: stationery?.remarks || '', bill: stationery?.bill_url ? { url: stationery.bill_url, fileName: stationery.bill_reference || '', isVerified: true } : null },
    otherItems: [],
  };
  await connection.query(
    `INSERT INTO finance_reports (id, cluster_id, academic_year_id, session_id, report_status, report_data, created_by, updated_by)
     VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?)`,
    [reportId, clusterId, academicYearId, entryRows[0].session_id || null, JSON.stringify(report), entryRows[0].created_by || cluster.admin_id || null, entryRows[0].created_by || cluster.admin_id || null],
  );
  await connection.query(
    'INSERT INTO finance_report_history (id, report_id, academic_year_id, event, details, user_id, user_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [randomUUID(), reportId, academicYearId, 'Draft restored', 'Recovered existing editable finance rows as one draft report after duplicate cleanup.', entryRows[0].created_by || null, 'Finance data recovery'],
  );
  await connection.commit();
  console.log(JSON.stringify({ restoredDraftId: reportId, entries: entryRows.length, total: report.totalAmount, status: 'DRAFT' }, null, 2));
} catch (error) {
  await connection.rollback();
  console.error('Draft metadata restoration aborted:', error);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}
