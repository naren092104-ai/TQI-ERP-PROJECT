import bcrypt from 'bcryptjs';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  JWT_SECRET: string;
  CORS_ORIGINS?: string;
}

const corsHeaders = (origin: string, env: Env) => {
  const allowed = (env.CORS_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean);
  const ok = !origin || allowed.includes(origin) || origin.endsWith('.pages.dev');
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,x-auth-token,x-user-role,x-user-cluster-id,Cache-Control,Pragma',
  };
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', ...headers },
});

const supabaseHeaders = (env: Env) => ({
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
});

const allowedTables = new Set([
  'academic_years','clusters','users','panchayats','villages','students','volunteers','modules','sessions',
  'attendance_sessions','student_attendance','volunteer_attendance','lesson_plans','session_photos','session_reports',
  'session_report_photos','finance_entries','finance_reports','finance_report_history','approvals','date_change_requests',
  'session_submissions','notifications','audit_logs','auth_otps','password_reset_tokens','user_password_history',
  'maintenance_settings','tqi_settings','academic_setup','module_resources','schools','session_photo_submissions','session_photo_delete_requests'
]);

const primaryKeys: Record<string, string> = {
  academic_years: 'id', clusters: 'id', users: 'id', panchayats: 'id', villages: 'id',
  students: 'id', volunteers: 'id', modules: 'id', sessions: 'id', attendance_sessions: 'id',
  student_attendance: 'id', volunteer_attendance: 'id', lesson_plans: 'id', session_photos: 'id',
  session_reports: 'id', session_report_photos: 'id', finance_entries: 'id', finance_reports: 'id',
  approvals: 'id', date_change_requests: 'id', session_submissions: 'id', notifications: 'id',
  audit_logs: 'id', maintenance_settings: 'id', tqi_settings: 'setting_key', academic_setup: 'academic_year_id',
  module_resources: 'id', schools: 'id', auth_otps: 'id', password_reset_tokens: 'token_hash',
  user_password_history: 'id', session_photo_submissions: 'id', session_photo_delete_requests: 'id',
};

const encoder = new TextEncoder();
const base64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const signJwt = async (payload: object, secret: string) => {
  const header = base64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64Url(encoder.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`));
  return `${header}.${body}.${base64Url(new Uint8Array(signature))}`;
};

const verifyJwt = async (token: string, secret: string) => {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('HMAC', key, fromBase64Url(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`));
  if (!valid) return null;
  const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[1]))) as any;
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    if (url.pathname === '/api/health') {
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/academic_years?select=id&limit=1`, {
        headers: supabaseHeaders(env),
      });
      return json({ success: response.ok, database: response.ok ? 'connected' : 'disconnected', timestamp: new Date().toISOString() }, response.ok ? 200 : 503, headers);
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST' && String(await request.clone().json().then((b: any) => b.password || '').catch(() => ''))) {
      const body = await request.json() as any;
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!email || !password) return json({ success: false, error: 'Email and password are required.' }, 400, headers);
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=*`, { headers: supabaseHeaders(env) });
      const users = await response.json() as any[];
      const user = users[0];
      if (!user || !(await bcrypt.compare(password, user.password_hash || ''))) {
        return json({ success: false, error: 'Invalid email or password.' }, 401, headers);
      }
      if (String(user.status || '').toLowerCase() === 'inactive') {
        return json({ success: false, error: 'This user account is inactive.' }, 403, headers);
      }
      const payload = { id: user.id, email: user.email, role: user.role, cluster_id: user.cluster_id, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 };
      const token = await signJwt(payload, env.JWT_SECRET);
      const serialized = { id: user.id, name: user.name, email: user.email, role: user.role, clusterId: user.cluster_id || 'all', clusterName: user.cluster_name || null, phone: user.phone || '', mustChangePassword: Boolean(user.must_change_password), status: user.status };
      return json({ success: true, token, user: serialized, authenticationMethod: 'password', mustChangePassword: serialized.mustChangePassword }, 200, headers);
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST' && String(await request.clone().json().then((b: any) => b.otp || '').catch(() => ''))) {
      const body = await request.json() as any;
      const email = String(body.email || '').trim().toLowerCase();
      const otp = String(body.otp || '').trim();
      const userResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=*`, { headers: supabaseHeaders(env) });
      const users = await userResponse.json() as any[];
      const otpResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/auth_otps?email=eq.${encodeURIComponent(email)}&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&order=created_at.desc&limit=1`, { headers: supabaseHeaders(env) });
      const otpRows = await otpResponse.json() as any[];
      const user = users[0];
      if (!user || !otpRows[0] || !(await bcrypt.compare(otp, otpRows[0].otp_hash))) {
        return json({ success: false, error: 'Invalid or expired verification code.' }, 401, headers);
      }
      await fetch(`${env.SUPABASE_URL}/rest/v1/auth_otps?id=eq.${otpRows[0].id}`, {
        method: 'PATCH', headers: supabaseHeaders(env), body: JSON.stringify({ used_at: new Date().toISOString() }),
      });
      const payload = { id: user.id, email: user.email, role: user.role, cluster_id: user.cluster_id, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 };
      const token = await signJwt(payload, env.JWT_SECRET);
      const serialized = { id: user.id, name: user.name, email: user.email, role: user.role, clusterId: user.cluster_id || 'all', clusterName: null, phone: user.phone || '', mustChangePassword: Boolean(user.must_change_password), status: user.status };
      return json({ success: true, token, user: serialized, authenticationMethod: 'otp', mustChangePassword: serialized.mustChangePassword }, 200, headers);
    }

    if (url.pathname === '/api/auth/me' && request.method === 'GET') {
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const payload = await verifyJwt(token, env.JWT_SECRET);
      if (!payload?.id) return json({ success: false, error: 'Authentication required.' }, 401, headers);
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(payload.id)}&select=*`, { headers: supabaseHeaders(env) });
      const users = await response.json() as any[];
      const user = users[0];
      if (!user) return json({ success: false, error: 'Invalid session.' }, 401, headers);
      const serialized = { id: user.id, name: user.name, email: user.email, role: user.role, clusterId: user.cluster_id || 'all', clusterName: null, phone: user.phone || '', mustChangePassword: Boolean(user.must_change_password), status: user.status };
      return json({ success: true, user: serialized, activeRole: user.role, clusterId: serialized.clusterId }, 200, headers);
    }

    if (url.pathname === '/api/auth/change-password' && request.method === 'POST') {
      const authorization = request.headers.get('Authorization') || '';
      const token = authorization.replace(/^Bearer\s+/i, '');
      const payload = await verifyJwt(token, env.JWT_SECRET);
      if (!payload?.id) return json({ success: false, error: 'Authentication required.' }, 401, headers);
      const body = await request.json() as any;
      const newPassword = String(body.newPassword || body.password || '');
      if (newPassword.length < 8) return json({ success: false, error: 'Password must be at least 8 characters.' }, 400, headers);
      const hash = await bcrypt.hash(newPassword, 12);
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(payload.id)}`, {
        method: 'PATCH',
        headers: { ...supabaseHeaders(env), Prefer: 'return=representation' },
        body: JSON.stringify({ password_hash: hash, must_change_password: false, password_changed_at: new Date().toISOString(), password_created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      });
      const data = await response.json();
      return json({ success: response.ok, data }, response.ok ? 200 : 400, headers);
    }

    if (url.pathname === '/api/auth/request-otp' && request.method === 'POST') {
      const body = await request.json() as any;
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return json({ success: false, error: 'Email is required.' }, 400, headers);

      const generic = {
        success: true,
        otpRequired: true,
        message: 'If an active account exists for that email, a verification code will be sent.',
      };

      const userResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,name,email,role,status`, {
        headers: supabaseHeaders(env),
      });
      const users = await userResponse.json() as any[];
      if (!users.length) return json(generic, 200, headers);

      const otp = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
      const otpHash = await bcrypt.hash(otp, 12);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const otpResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/auth_otps`, {
        method: 'POST',
        headers: { ...supabaseHeaders(env), Prefer: 'return=minimal' },
        body: JSON.stringify({ email, otp_hash: otpHash, expires_at: expiresAt, attempts: 0 }),
      });
      if (!otpResponse.ok) return json({ success: false, error: 'Unable to create verification code.' }, 503, headers);

      return json(generic, 200, headers);
    }

    const dashboardReads: Record<string, { table: string; responseKey: string }> = {
      '/api/academic-years': { table: 'academic_years', responseKey: 'academicYears' },
      '/api/academic-setup': { table: 'academic_setup', responseKey: 'academicSetup' },
      '/api/clusters': { table: 'clusters', responseKey: 'clusters' },
      '/api/users': { table: 'users', responseKey: 'users' },
      '/api/panchayats': { table: 'panchayats', responseKey: 'panchayats' },
      '/api/villages': { table: 'villages', responseKey: 'villages' },
      '/api/students': { table: 'students', responseKey: 'students' },
      '/api/volunteers': { table: 'volunteers', responseKey: 'volunteers' },
      '/api/modules': { table: 'modules', responseKey: 'modules' },
      '/api/sessions': { table: 'sessions', responseKey: 'sessions' },
      '/api/attendance': { table: 'attendance_sessions', responseKey: 'attendanceSessions' },
      '/api/lesson-plans': { table: 'lesson_plans', responseKey: 'lessonPlans' },
      '/api/finance': { table: 'finance_entries', responseKey: 'financeEntries' },
      '/api/finance/reports': { table: 'finance_reports', responseKey: 'reports' },
      '/api/approvals': { table: 'approvals', responseKey: 'approvals' },
      '/api/date-change-requests': { table: 'date_change_requests', responseKey: 'dateChangeRequests' },
      '/api/session-reports': { table: 'session_reports', responseKey: 'sessionReports' },
      '/api/session-submissions': { table: 'session_submissions', responseKey: 'sessionSubmissions' },
      '/api/notifications': { table: 'notifications', responseKey: 'notifications' },
      '/api/audit-logs': { table: 'audit_logs', responseKey: 'auditLogs' },
      '/api/settings/finance': { table: 'tqi_settings', responseKey: 'settings' },
      '/api/system/maintenance': { table: 'maintenance_settings', responseKey: 'maintenance' },
    };

    if (request.method === 'GET' && dashboardReads[url.pathname]) {
      const route = dashboardReads[url.pathname];
      let query = `${env.SUPABASE_URL}/rest/v1/${route.table}?select=*&limit=1000`;
      const academicYearId = url.searchParams.get('academicYearId');
      const clusterId = url.searchParams.get('clusterId');
      const yearScopedTables = new Set(['academic_setup','panchayats','villages','students','volunteers','modules','sessions','attendance_sessions','lesson_plans','finance_entries','finance_reports','approvals','date_change_requests','session_reports','session_submissions','session_photos','schools']);
      if (academicYearId && yearScopedTables.has(route.table)) query += `&academic_year_id=eq.${encodeURIComponent(academicYearId)}`;
      if (clusterId && clusterId !== 'all') query += `&cluster_id=eq.${encodeURIComponent(clusterId)}`;
      const response = await fetch(query, { headers: supabaseHeaders(env) });
      const data = await response.json();
      if (!response.ok) return json({ success: false, error: 'Unable to read data.' }, 400, headers);
      return json({ success: true, [route.responseKey]: data, data }, 200, headers);
    }

    if (url.pathname === '/api/academic-years' && request.method === 'POST') {
      const body = await request.json() as any;
      const name = String(body.name || '').trim();
      if (!name) return json({ success: false, error: 'Academic year name is required.' }, 400, headers);
      const payload = {
        id: `academic-year-${crypto.randomUUID()}`,
        name,
        start_date: body.startDate || null,
        end_date: body.endDate || null,
        is_active: body.isActive === true,
        status: body.isActive === true ? 'ACTIVE' : 'DRAFT',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (payload.is_active) {
        await fetch(`${env.SUPABASE_URL}/rest/v1/academic_years?is_active=eq.true`, { method: 'PATCH', headers: supabaseHeaders(env), body: JSON.stringify({ is_active: false, status: 'DRAFT' }) });
      }
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/academic_years`, { method: 'POST', headers: { ...supabaseHeaders(env), Prefer: 'return=representation' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) return json({ success: false, error: 'Unable to create academic year.' }, 400, headers);
      return json({ success: true, data: Array.isArray(data) ? data[0] : data }, 201, headers);
    }

    const academicYearUpdateBeforeGuard = url.pathname.match(/^\/api\/academic-years\/([^/]+)$/);
    if (academicYearUpdateBeforeGuard && request.method === 'PUT') {
      const body = await request.json() as any;
      const id = academicYearUpdateBeforeGuard[1];
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) updates.name = String(body.name).trim();
      if (body.startDate !== undefined) updates.start_date = body.startDate || null;
      if (body.endDate !== undefined) updates.end_date = body.endDate || null;
      if (body.isActive !== undefined) { updates.is_active = body.isActive === true; updates.status = body.isActive === true ? 'ACTIVE' : 'DRAFT'; }
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/academic_years?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { ...supabaseHeaders(env), Prefer: 'return=representation' }, body: JSON.stringify(updates) });
      const data = await response.json();
      return json({ success: response.ok, data }, response.ok ? 200 : 400, headers);
    }

    const academicYearDelete = url.pathname.match(/^\/api\/academic-years\/([^/]+)$/);
    if (academicYearDelete && request.method === 'DELETE') {
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const payload = await verifyJwt(token, env.JWT_SECRET);
      if (!payload?.id) return json({ success: false, error: 'Authentication required.' }, 401, headers);
      if (payload.role !== 'Super Admin') return json({ success: false, error: 'Only Super Admin can delete academic years.' }, 403, headers);

      const id = academicYearDelete[1];
      if (!/^academic-year-[a-zA-Z0-9-]+$/.test(id)) return json({ success: false, error: 'Invalid academic year ID.' }, 400, headers);

      const yearResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/academic_years?id=eq.${encodeURIComponent(id)}&select=*`, { headers: supabaseHeaders(env) });
      const years = await yearResponse.json() as any[];
      if (!years.length) return json({ success: false, error: 'Academic year not found.' }, 404, headers);
      const year = years[0];
      if (Boolean(year.is_active) || String(year.status || '').toUpperCase() === 'ACTIVE') {
        return json({ success: false, error: 'The active academic year cannot be deleted. Activate another year first.' }, 409, headers);
      }

      const dependentTables = ['clusters','panchayats','villages','students','volunteers','schools','modules','sessions','attendance_sessions','lesson_plans','session_photos','session_reports','finance_entries','approvals','date_change_requests','session_submissions','academic_setup'];
      const dependencies: string[] = [];
      for (const table of dependentTables) {
        const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?select=id&academic_year_id=eq.${encodeURIComponent(id)}&limit=1`, { headers: supabaseHeaders(env) });
        if (response.ok) {
          const rows = await response.json();
          if (Array.isArray(rows) && rows.length) dependencies.push(table);
        }
      }
      if (dependencies.length) {
        return json({ success: false, error: `Academic year has dependent records in: ${dependencies.join(', ')}. Archive or remove its data before deletion.`, dependencies }, 409, headers);
      }

      await fetch(`${env.SUPABASE_URL}/rest/v1/academic_setup?academic_year_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: supabaseHeaders(env) });
      const deleteResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/academic_years?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { ...supabaseHeaders(env), Prefer: 'return=representation' } });
      if (!deleteResponse.ok) return json({ success: false, error: 'Unable to delete academic year.' }, 400, headers);
      return json({ success: true, data: { id, name: year.name } }, 200, headers);
    }

    const match = url.pathname.match(/^\/api\/supabase\/([a-z_]+)(?:\/([^/]+))?$/);
    if (!match) return json({ success: false, error: 'API endpoint not found.' }, 404, headers);

    const [, table, id] = match;
    if (!allowedTables.has(table)) return json({ success: false, error: 'Invalid table.' }, 400, headers);

    const supabaseUrl = `${env.SUPABASE_URL}/rest/v1/${table}`;

    if (request.method === 'GET') {
      const limit = Math.min(Number(url.searchParams.get('limit') || 100), 1000);
      const response = await fetch(`${supabaseUrl}?select=*&limit=${limit}`, { headers: supabaseHeaders(env) });
      const data = await response.json();
      return json({ success: response.ok, data }, response.ok ? 200 : 400, headers);
    }

    if (request.method === 'POST') {
      const body = await request.text();
      const response = await fetch(supabaseUrl, {
        method: 'POST',
        headers: { ...supabaseHeaders(env), Prefer: 'return=representation' },
        body,
      });
      const data = await response.json();
      return json({ success: response.ok, data }, response.ok ? 201 : 400, headers);
    }

    if (request.method === 'PUT' || request.method === 'PATCH') {
      if (!id) return json({ success: false, error: 'Record id is required.' }, 400, headers);
      const body = await request.text();
      const response = await fetch(`${supabaseUrl}?${primaryKeys[table]}=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { ...supabaseHeaders(env), Prefer: 'return=representation' },
        body,
      });
      const data = await response.json();
      return json({ success: response.ok, data }, response.ok ? 200 : 400, headers);
    }

    if (request.method === 'DELETE') {
      if (!id) return json({ success: false, error: 'Record id is required.' }, 400, headers);
      const primaryKey = primaryKeys[table] || 'id';
      const response = await fetch(`${supabaseUrl}?${primaryKey}=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { ...supabaseHeaders(env), Prefer: 'return=representation' },
      });
      const data = await response.json().catch(() => []);
      return json({ success: response.ok, data }, response.ok ? 200 : 400, headers);
    }

    const readRoutes: Record<string, { table: string; key?: string }> = {
      '/api/academic-years': { table: 'academic_years' },
      '/api/academic-setup': { table: 'academic_setup' },
      '/api/clusters': { table: 'clusters' },
      '/api/users': { table: 'users' },
      '/api/panchayats': { table: 'panchayats' },
      '/api/villages': { table: 'villages' },
      '/api/students': { table: 'students' },
      '/api/volunteers': { table: 'volunteers' },
      '/api/modules': { table: 'modules' },
      '/api/sessions': { table: 'sessions' },
      '/api/attendance': { table: 'attendance_sessions' },
      '/api/lesson-plans': { table: 'lesson_plans' },
      '/api/finance': { table: 'finance_entries' },
      '/api/finance/reports': { table: 'finance_reports' },
      '/api/approvals': { table: 'approvals' },
      '/api/date-change-requests': { table: 'date_change_requests' },
      '/api/session-reports': { table: 'session_reports' },
      '/api/session-submissions': { table: 'session_submissions' },
      '/api/notifications': { table: 'notifications' },
      '/api/audit-logs': { table: 'audit_logs' },
      '/api/settings/finance': { table: 'tqi_settings' },
      '/api/system/maintenance': { table: 'maintenance_settings' },
    };

    if (request.method === 'GET' && readRoutes[url.pathname]) {
      const table = readRoutes[url.pathname].table;
      const limit = Math.min(Number(url.searchParams.get('limit') || 1000), 1000);
      let supabaseQuery = `${env.SUPABASE_URL}/rest/v1/${table}?select=*&limit=${limit}`;
      const academicYearId = url.searchParams.get('academicYearId');
      const clusterId = url.searchParams.get('clusterId');
      if (academicYearId) supabaseQuery += `&academic_year_id=eq.${encodeURIComponent(academicYearId)}`;
      if (clusterId && clusterId !== 'all') supabaseQuery += `&cluster_id=eq.${encodeURIComponent(clusterId)}`;
      const response = await fetch(supabaseQuery, { headers: supabaseHeaders(env) });
      const data = await response.json();
      if (!response.ok) return json({ success: false, error: 'Unable to read data.' }, 400, headers);

      const payload: Record<string, unknown> = { success: true, data };
      if (url.pathname === '/api/users') payload.users = data;
      if (url.pathname === '/api/clusters') payload.clusters = data;
      if (url.pathname === '/api/panchayats') payload.panchayats = data;
      if (url.pathname === '/api/villages') payload.villages = data;
      if (url.pathname === '/api/students') payload.students = data;
      if (url.pathname === '/api/volunteers') payload.volunteers = data;
      if (url.pathname === '/api/modules') payload.modules = data;
      if (url.pathname === '/api/sessions') payload.sessions = data;
      if (url.pathname === '/api/attendance') payload.attendanceSessions = data;
      if (url.pathname === '/api/lesson-plans') payload.lessonPlans = data;
      if (url.pathname === '/api/finance') payload.financeEntries = data;
      if (url.pathname === '/api/finance/reports') payload.reports = data;
      if (url.pathname === '/api/approvals') payload.approvals = data;
      if (url.pathname === '/api/date-change-requests') payload.dateChangeRequests = data;
      if (url.pathname === '/api/session-reports') payload.sessionReports = data;
      if (url.pathname === '/api/session-submissions') payload.sessionSubmissions = data;
      if (url.pathname === '/api/notifications') payload.notifications = data;
      if (url.pathname === '/api/audit-logs') payload.auditLogs = data;
      if (url.pathname === '/api/academic-years') payload.academicYears = data;
      if (url.pathname === '/api/academic-setup') payload.academicSetup = data;
      if (url.pathname === '/api/settings/finance') payload.settings = data;
      if (url.pathname === '/api/system/maintenance') payload.maintenance = data;
      return json(payload, 200, headers);
    }

    if (url.pathname === '/api/academic-years' && request.method === 'POST') {
      const body = await request.json() as any;
      const name = String(body.name || '').trim();
      if (!name) return json({ success: false, error: 'Academic year name is required.' }, 400, headers);
      const payload = {
        id: `academic-year-${crypto.randomUUID()}`,
        name,
        start_date: body.startDate || null,
        end_date: body.endDate || null,
        is_active: body.isActive === true,
        status: body.isActive === true ? 'ACTIVE' : 'DRAFT',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (payload.is_active) {
        await fetch(`${env.SUPABASE_URL}/rest/v1/academic_years?is_active=eq.true`, { method: 'PATCH', headers: supabaseHeaders(env), body: JSON.stringify({ is_active: false, status: 'DRAFT' }) });
      }
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/academic_years`, { method: 'POST', headers: { ...supabaseHeaders(env), Prefer: 'return=representation' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) return json({ success: false, error: 'Unable to create academic year.' }, 400, headers);
      return json({ success: true, data: Array.isArray(data) ? data[0] : data }, 201, headers);
    }

    const academicYearUpdate = url.pathname.match(/^\/api\/academic-years\/([^/]+)$/);
    if (academicYearUpdate && request.method === 'PUT') {
      const body = await request.json() as any;
      const id = academicYearUpdate[1];
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) updates.name = String(body.name).trim();
      if (body.startDate !== undefined) updates.start_date = body.startDate || null;
      if (body.endDate !== undefined) updates.end_date = body.endDate || null;
      if (body.isActive !== undefined) {
        updates.is_active = body.isActive === true;
        updates.status = body.isActive === true ? 'ACTIVE' : 'DRAFT';
        if (updates.is_active) {
          await fetch(`${env.SUPABASE_URL}/rest/v1/academic_years?id=neq.${encodeURIComponent(id)}&is_active=eq.true`, {
            method: 'PATCH', headers: supabaseHeaders(env), body: JSON.stringify({ is_active: false, status: 'DRAFT', updated_at: new Date().toISOString() }),
          });
        }
      }
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/academic_years?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { ...supabaseHeaders(env), Prefer: 'return=representation' }, body: JSON.stringify(updates),
      });
      const data = await response.json();
      return json({ success: response.ok, data }, response.ok ? 200 : 400, headers);
    }

    if (url.pathname === '/api/clusters' && request.method === 'POST') {
      const body = await request.json() as any;
      const name = String(body.name || '').trim();
      const collegeName = String(body.collegeName || '').trim();
      const collegeId = String(body.collegeId || '').trim();
      const collegeDistrict = String(body.collegeDistrict || '').trim();
      const subDistrict = String(body.subDistrict || '').trim();
      const spocName = String(body.spocName || body.adminName || '').trim();
      const spocMobile = String(body.spocMobile || body.adminPhone || '').replace(/\D/g, '').slice(-10);
      const adminEmail = String(body.adminEmail || '').trim().toLowerCase();
      if (!name || !collegeName || !collegeDistrict || !spocName || !/^\d{10}$/.test(spocMobile) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
        return json({ success: false, error: 'Cluster name, college, district, SPOC name, valid 10-digit phone, and valid email are required.' }, 400, headers);
      }

      const clusterId = `cluster-${crypto.randomUUID()}`;
      const adminId = `usr-${crypto.randomUUID()}`;
      const temporaryPassword = crypto.randomUUID().replace(/-/g, '').slice(0, 16) + 'Aa1!';
      const passwordHash = await bcrypt.hash(temporaryPassword, 12);

      const clusterResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/clusters`, {
        method: 'POST', headers: { ...supabaseHeaders(env), Prefer: 'return=representation' },
        body: JSON.stringify({ id: clusterId, name, district: collegeDistrict, college_district: collegeDistrict, subdistrict: subDistrict, state: 'Tamil Nadu', college_name: collegeName, college_id: collegeId || null, spoc_name: spocName, spoc_mobile: `+91 ${spocMobile}`, status: 'Active', academic_year_id: body.academicYearId || null }),
      });
      const clusterData = await clusterResponse.json();
      if (!clusterResponse.ok) return json({ success: false, error: 'Unable to create cluster in Supabase.' }, 400, headers);

      const userResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/users`, {
        method: 'POST', headers: { ...supabaseHeaders(env), Prefer: 'return=representation' },
        body: JSON.stringify({ id: adminId, name: spocName, email: adminEmail, password_hash: passwordHash, role: 'Cluster Admin', cluster_id: clusterId, phone: `+91 ${spocMobile}`, must_change_password: true, status: 'Active', password_created_at: new Date().toISOString() }),
      });
      if (!userResponse.ok) return json({ success: false, error: 'Cluster was created but the SPOC account could not be created.' }, 503, headers);

      await fetch(`${env.SUPABASE_URL}/rest/v1/clusters?id=eq.${encodeURIComponent(clusterId)}`, {
        method: 'PATCH', headers: supabaseHeaders(env), body: JSON.stringify({ admin_id: adminId }),
      });

      let emailSent = false;
      const emailWebhook = (env as any).EMAIL_WEBHOOK_URL?.trim();
      if (emailWebhook) {
        try {
          const emailResponse = await fetch(emailWebhook, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: adminEmail, subject: 'TQI ERP – Cluster Registration Successful', spocName, clusterName: name, collegeName, district: collegeDistrict, subDistrict }),
          });
          emailSent = emailResponse.ok;
        } catch {
          emailSent = false;
        }
      }

      return json({ success: true, emailSent, temporaryPassword, loginEmail: adminEmail, clusterName: name, cluster: Array.isArray(clusterData) ? clusterData[0] : clusterData }, 201, headers);
    }

    if (url.pathname === '/api/admin/backups' && request.method === 'GET') {
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const payload = await verifyJwt(token, env.JWT_SECRET);
      if (!payload?.id) return json({ success: false, error: 'Authentication required.' }, 401, headers);
      if (payload.role !== 'Super Admin') return json({ success: false, error: 'Super Admin access required.' }, 403, headers);
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/operational_backups?select=*&order=created_at.desc&limit=200`, { headers: supabaseHeaders(env) });
      const data = await response.json();
      return json({ success: response.ok, backups: response.ok ? data : [] }, response.ok ? 200 : 400, headers);
    }

    if (url.pathname === '/api/admin/backups' && request.method === 'POST') {
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const payload = await verifyJwt(token, env.JWT_SECRET);
      if (!payload?.id) return json({ success: false, error: 'Authentication required.' }, 401, headers);
      if (payload.role !== 'Super Admin') return json({ success: false, error: 'Super Admin access required.' }, 403, headers);
      const id = `tqi-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}`;
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/operational_backups`, {
        method: 'POST', headers: { ...supabaseHeaders(env), Prefer: 'return=representation' },
        body: JSON.stringify({ id, kind: 'manual', created_by: payload.email, status: 'READY' }),
      });
      const data = await response.json();
      if (!response.ok) return json({ success: false, error: 'Unable to create backup record.' }, 400, headers);
      return json({ success: true, backup: Array.isArray(data) ? data[0] : data }, 201, headers);
    }

    if (url.pathname === '/api/admin/data-reset/history' && request.method === 'GET') {
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const payload = await verifyJwt(token, env.JWT_SECRET);
      if (!payload?.id) return json({ success: false, error: 'Authentication required.' }, 401, headers);
      if (payload.role !== 'Super Admin') return json({ success: false, error: 'Super Admin access required.' }, 403, headers);
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/audit_logs?action=eq.RESET_DATA&select=*&order=created_at.desc&limit=200`, { headers: supabaseHeaders(env) });
      const data = await response.json();
      if (!response.ok) return json({ success: false, error: 'Unable to load reset history.' }, 400, headers);
      const history = (data as any[]).map((row) => {
        let details: any = {};
        try { details = JSON.parse(row.details || '{}'); } catch { details = {}; }
        return { id: row.id, resetId: row.record_id, adminId: row.user_id, adminName: row.user_name || 'Super Admin', createdAt: row.created_at, ...details };
      });
      return json({ success: true, history }, 200, headers);
    }

    if (url.pathname === '/api/admin/supabase-backup' && request.method === 'POST') {
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const payload = await verifyJwt(token, env.JWT_SECRET);
      if (!payload?.id) return json({ success: false, error: 'Authentication required.' }, 401, headers);
      if (payload.role !== 'Super Admin') return json({ success: false, error: 'Super Admin access required.' }, 403, headers);

      const id = `tqi-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}`;
      const snapshotTables = ['academic_years','clusters','users','panchayats','villages','students','volunteers','modules','sessions','attendance_sessions','lesson_plans','session_photos','session_reports','finance_entries','finance_reports','approvals','notifications','audit_logs'];
      const snapshot: Record<string, unknown[]> = {};
      const counts: Record<string, number> = {};
      for (const table of snapshotTables) {
        const tableResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?select=*`, { headers: supabaseHeaders(env) });
        const rows = await tableResponse.json();
        snapshot[table] = Array.isArray(rows) ? rows : [];
        counts[table] = snapshot[table].length;
      }
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/operational_backups`, {
        method: 'POST', headers: { ...supabaseHeaders(env), Prefer: 'return=representation' },
        body: JSON.stringify({ id, kind: 'manual', created_by: payload.email, counts, snapshot, status: 'READY' }),
      });
      const data = await response.json();
      if (!response.ok) return json({ success: false, error: 'Unable to create snapshot backup record.' }, 400, headers);

      return json({ success: true, snapshotId: id, snapshot: snapshotTables }, 201, headers);
    }

    return json({ success: false, error: 'Method not allowed.' }, 405, headers);
  },
};
