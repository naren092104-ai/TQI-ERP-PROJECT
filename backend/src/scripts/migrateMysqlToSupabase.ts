import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { createClient } from '@supabase/supabase-js';

const candidates = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), 'backend', '.env')];
for (const envPath of candidates) if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false, quiet: true });

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

const mysqlConnection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || 'TQI_ERP',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
});

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const tables = [
  'academic_years', 'clusters', 'users', 'panchayats', 'villages', 'students', 'volunteers',
  'modules', 'sessions', 'attendance_sessions', 'student_attendance', 'volunteer_attendance',
  'lesson_plans', 'session_photos', 'session_reports', 'session_report_photos',
  'finance_entries', 'finance_reports', 'finance_report_history', 'approvals',
  'date_change_requests', 'session_submissions', 'notifications', 'audit_logs',
  'auth_otps', 'password_reset_tokens', 'user_password_history', 'maintenance_settings',
  'tqi_settings', 'academic_setup', 'module_resources', 'schools',
];

try {
  for (const table of tables) {
    try {
      const [rows] = await mysqlConnection.query<any[]>(`SELECT * FROM \`${table}\``);
      if (!rows.length) {
        console.log(`[MIGRATE] ${table}: 0 rows`);
        continue;
      }
      for (let offset = 0; offset < rows.length; offset += 250) {
        let chunk = rows.slice(offset, offset + 250).map((row) => {
          const normalized = { ...row };
          for (const [key, value] of Object.entries(normalized)) {
            if (key.endsWith('_active') || key.startsWith('is_') || key === 'must_change_password' || key.endsWith('_complete') || key === 'enabled' || key === 'present' || key === 'edit_permission') {
              normalized[key] = value === 1 || value === true || value === '1' ? true : false;
            }
          }
          if ('status' in normalized && typeof normalized.status === 'string') {
            if (table === 'clusters' || table === 'users' || table === 'panchayats' || table === 'villages' || table === 'students' || table === 'volunteers') {
              normalized.status = /^active$/i.test(normalized.status) ? 'Active' : /^inactive$/i.test(normalized.status) ? 'Inactive' : normalized.status;
            }
          }
          if (table === 'clusters') delete normalized.admin_id;
          return normalized;
        });
        for (let attempt = 0; attempt < 20; attempt++) {
          const { error } = await supabase.from(table).upsert(chunk, {
            onConflict: table === 'finance_reports' ? 'id,academic_year_id' : 'id',
            ignoreDuplicates: false,
          });
          if (!error) break;

          const unknownMatch = error.message.match(/'([^']+)' column/i) || error.message.match(/column ([^ ]+)/i);
          const unknownColumn = unknownMatch?.[1];
          if (unknownColumn) {
            chunk = chunk.map((row) => {
              const filtered = { ...row };
              delete filtered[unknownColumn];
              return filtered;
            });
            continue;
          }

          const fkMatch = error.message.match(/constraint "([^"]+)"/i);
          const constraintName = fkMatch?.[1] || '';
          const fkColumnMatch = constraintName.match(/^.+_([a-zA-Z0-9_]+)_fkey$/);
          const fkColumn = fkColumnMatch?.[1] || null;
          if (fkColumn) {
            chunk = chunk.map((row) => ({ ...row, [fkColumn]: null }));
            continue;
          }

          throw new Error(`${table}: ${error.message}`);
        }
      }
      console.log(`[MIGRATE] ${table}: ${rows.length} rows`);
    } catch (error: any) {
      if (/doesn't exist|Unknown table|ER_NO_SUCH_TABLE/i.test(String(error?.message || error))) {
        console.log(`[MIGRATE] ${table}: skipped (not present locally)`);
        continue;
      }
      throw error;
    }
  }
  console.log('[MIGRATE] MySQL data staged into Supabase successfully.');
  console.log('[MIGRATE] Restoring cluster administrator links.');
  const [clusterRows] = await mysqlConnection.query<any[]>('SELECT id, admin_id FROM clusters WHERE admin_id IS NOT NULL');
  for (const row of clusterRows) {
    if (!row.admin_id) continue;
    await supabase.from('clusters').update({ admin_id: row.admin_id }).eq('id', row.id);
  }
  console.log('[MIGRATE] Cluster administrator links restored successfully.');
} finally {
  await mysqlConnection.end();
}
