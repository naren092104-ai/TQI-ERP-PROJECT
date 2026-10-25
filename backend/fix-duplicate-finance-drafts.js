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
  connectionLimit: 2,
});

const keepDraftId = 'draft-day1-1791302903408';
const duplicateDraftIds = ['draft-day1-1791302610673', 'draft-day1-1791302618312'];
const expectedClusterId = 'namakkal-ksrangasamy-dbe974a7-1330c1ff';
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  const ids = [keepDraftId, ...duplicateDraftIds];
  const [rows] = await connection.query(
    'SELECT id, draft_id, cluster_id, academic_year_id, category, description, amount, date, status, bill_url, remarks FROM finance_entries WHERE draft_id IN (?) ORDER BY draft_id, category, description',
    [ids],
  );
  if (rows.length !== 12 || rows.some((row) => row.cluster_id !== expectedClusterId || row.status !== 'Draft' || row.bill_url || row.remarks)) {
    throw new Error('The observed duplicate draft set has changed. No rows were modified.');
  }
  const [reportRows] = await connection.query('SELECT id FROM finance_reports WHERE id IN (?)', [ids]);
  const [approvalRows] = await connection.query("SELECT id FROM approvals WHERE module IN ('Finance','Finance Edit Request') AND record_id IN (?) AND status IN ('Pending','Open')", [ids]);
  if (reportRows.length || approvalRows.length) throw new Error('A draft has report metadata or an approval; refusing duplicate cleanup.');

  const signatures = new Map();
  for (const row of rows) {
    const group = signatures.get(row.draft_id) || [];
    group.push([row.category, row.description, Number(row.amount), String(row.date).slice(0, 10)].join('|'));
    signatures.set(row.draft_id, group);
  }
  const expectedSignature = JSON.stringify(signatures.get(keepDraftId)?.sort());
  if (!expectedSignature || duplicateDraftIds.some((draftId) => JSON.stringify(signatures.get(draftId)?.sort()) !== expectedSignature)) {
    throw new Error('Draft expense sets are not identical. No rows were modified.');
  }

  const [deleteResult] = await connection.query('DELETE FROM finance_entries WHERE draft_id IN (?) AND status = \'Draft\' AND cluster_id = ?', [duplicateDraftIds, expectedClusterId]);
  if (Number(deleteResult.affectedRows) !== 8) throw new Error(`Expected to remove 8 repeated entries, removed ${deleteResult.affectedRows}.`);
  await connection.query(
    'INSERT INTO audit_logs (id, user_name, role, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [randomUUID(), 'System data correction', 'System', 'DEDUPLICATE_FINANCE_DRAFTS', 'Finance', keepDraftId, JSON.stringify({ removedDraftIds: duplicateDraftIds, retainedDraftId: keepDraftId, removedEntries: 8, keptEntries: 4, reason: 'Repeated identical unsaved Draft entry sets from finance retry behavior.' })],
  );
  await connection.commit();
  console.log(JSON.stringify({ removedDuplicateDrafts: duplicateDraftIds, removedEntries: Number(deleteResult.affectedRows), retainedDraftId: keepDraftId, retainedEntries: 4 }, null, 2));
} catch (error) {
  await connection.rollback();
  console.error('Duplicate draft cleanup aborted; no changes committed:', error);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}
