import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  if (!client) client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

const allowedTables = new Set([
  'academic_years', 'clusters', 'users', 'panchayats', 'villages', 'students', 'volunteers',
  'modules', 'sessions', 'attendance_sessions', 'student_attendance', 'volunteer_attendance',
  'lesson_plans', 'session_photos', 'session_reports', 'session_report_photos', 'finance_entries',
  'finance_reports', 'finance_report_history', 'approvals', 'date_change_requests',
  'session_submissions', 'notifications', 'audit_logs', 'maintenance_settings', 'tqi_settings',
  'academic_setup', 'module_resources', 'schools', 'auth_otps', 'password_reset_tokens',
  'user_password_history', 'session_photo_submissions', 'session_photo_delete_requests',
]);

export function isAllowedSupabaseTable(table: string): boolean {
  return allowedTables.has(table);
}
