import bcrypt from 'bcryptjs';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  JWT_SECRET: string;
  BACKEND_API_URL?: string;
  EMAIL_WEBHOOK_URL?: string;
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

const supabaseRows = async (env: Env, table: string, filters: Record<string, string>) => {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', '*');
  Object.entries(filters).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { headers: supabaseHeaders(env) });
  if (!response.ok) throw new Error(`Supabase read failed for ${table} (${response.status}).`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error(`Supabase returned an invalid ${table} response.`);
  return rows as any[];
};

const authenticatedUser = async (request: Request, env: Env) => {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  try {
    const payload = await verifyJwt(token, env.JWT_SECRET);
    return payload?.id ? payload : null;
  } catch {
    return null;
  }
};

const resolveWorkerAcademicYear = async (request: Request, env: Env) => {
  const requested = String(new URL(request.url).searchParams.get('academicYearId') || request.headers.get('x-academic-year-id') || '').trim();
  const years = await supabaseRows(env, 'academic_years', {
    select: 'id,name,status,is_active,archived_at,start_date',
    order: 'is_active.desc,start_date.desc',
    limit: '1000',
  });
  return requested ? years.find((year) => year.id === requested || year.name === requested) || null : years[0] || null;
};

const resolveWorkerClusterId = async (env: Env, user: any, academicYearId: string, requestedClusterId?: string) => {
  if (user.role !== 'Cluster Admin') return requestedClusterId && requestedClusterId !== 'all' ? requestedClusterId : null;
  const clusters = await supabaseRows(env, 'clusters', {
    select: 'id,source_cluster_id',
    academic_year_id: `eq.${academicYearId}`,
    or: `(id.eq.${user.cluster_id},source_cluster_id.eq.${user.cluster_id})`,
    limit: '10',
  });
  return clusters.find((cluster) => cluster.id === user.cluster_id)?.id || clusters[0]?.id || user.cluster_id;
};

const isoDate = (value: unknown) => {
  if (!value) return '';
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '';
};

const photoType = (caption: unknown, explicitType: unknown) => {
  const type = String(explicitType || '').toLowerCase();
  if (['session', 'homework', 'feedback'].includes(type)) return type;
  const text = String(caption || '').toLowerCase();
  if (text.startsWith('[homework]') || text.includes('#homework')) return 'homework';
  if (text.startsWith('[feedback]') || text.includes('#feedback')) return 'feedback';
  return 'session';
};

const sendClusterCredentialsEmail = async (
  request: Request,
  env: Env,
  details: { to: string; spocName: string; clusterName: string; collegeName: string; temporaryPassword: string },
) => {
  const webhookUrl = env.EMAIL_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: details.to,
        subject: 'TQI ERP – Cluster Registration Successful',
        ...details,
      }),
    });
    return response.ok;
  }

  const backendApiUrl = (env.BACKEND_API_URL || '').replace(/\/+$/, '');
  if (!backendApiUrl) return false;
  const response = await fetch(`${backendApiUrl}/internal/cluster-credentials-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: request.headers.get('Authorization') || '',
    },
    body: JSON.stringify({ ...details, role: 'Cluster Admin' }),
  });
  const result = await response.json().catch(() => null) as any;
  return response.ok && result?.success === true && result?.emailSent === true;
};

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

    if (
      request.method === 'POST' &&
      (url.pathname === '/api/auth/forgot-password' || url.pathname === '/api/auth/reset-password')
    ) {
      const backendApiUrl = (env.BACKEND_API_URL || 'https://tqi.autorevives.com/api').replace(/\/+$/, '');
      const route = url.pathname.endsWith('/forgot-password') ? 'forgot-password' : 'reset-password';
      try {
        const upstream = await fetch(`${backendApiUrl}/auth/${route}`, {
          method: 'POST',
          headers: { 'Content-Type': request.headers.get('Content-Type') || 'application/json' },
          body: await request.text(),
        });
        return new Response(await upstream.text(), {
          status: upstream.status,
          headers: {
            ...headers,
            'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
            'Cache-Control': 'no-store',
          },
        });
      } catch (error) {
        console.error(`Password ${route} upstream request failed:`, error);
        return json({ success: false, error: 'Unable to reach the password reset service. Please try again.' }, 503, headers);
      }
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

    if (request.method === 'GET' && url.pathname === '/api/program-days') {
      const user = await authenticatedUser(request, env);
      if (!user) return json({ success: false, error: 'Authentication required.' }, 401, headers);
      try {
        const year = await resolveWorkerAcademicYear(request, env);
        if (!year) return json({ success: false, error: 'No academic year is available.' }, 404, headers);
        const rows = await supabaseRows(env, 'academic_setup', {
          select: 'day_number,session_name',
          academic_year_id: `eq.${year.id}`,
          order: 'day_number.asc',
          limit: '1000',
        });
        const programDays = rows
          .filter((row) => String(row.session_name || '').trim())
          .map((row) => ({ id: `day-${row.day_number}`, day_number: Number(row.day_number), day_name: String(row.session_name) }));
        return json({ success: true, programDays }, 200, headers);
      } catch (error) {
        console.error('Failed to load programme days:', error);
        return json({ success: false, error: 'Unable to load programme days.' }, 503, headers);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/session-photos') {
      const user = await authenticatedUser(request, env);
      if (!user) return json({ success: false, error: 'Authentication required.' }, 401, headers);
      try {
        const year = await resolveWorkerAcademicYear(request, env);
        if (!year) return json({ success: false, error: 'No academic year is available.' }, 404, headers);
        const requestedCluster = String(url.searchParams.get('cluster') || url.searchParams.get('clusterId') || 'all');
        const clusterId = await resolveWorkerClusterId(env, user, year.id, requestedCluster.toLowerCase());
        const filters: Record<string, string> = {
          // Older deployments can be missing newer optional metadata columns; select * keeps the gallery readable.
          select: '*',
          academic_year_id: `eq.${year.id}`,
          order: 'day_number.asc,uploaded_at.desc',
          limit: '1000',
        };
        if (clusterId) filters.cluster_id = `eq.${clusterId}`;
        const photoRows = await supabaseRows(env, 'session_photos', filters);
        const clusterIds = [...new Set(photoRows.map((row) => String(row.cluster_id || '')).filter(Boolean))];
        const userIds = [...new Set(photoRows.map((row) => String(row.uploaded_by || '')).filter(Boolean))];
        const [clusterRows, userRows, deleteRows] = await Promise.all([
          clusterIds.length ? supabaseRows(env, 'clusters', { select: 'id,name', id: `in.(${clusterIds.join(',')})`, limit: '1000' }).catch((error) => { console.warn('Unable to resolve photo cluster names:', error); return []; }) : Promise.resolve([]),
          userIds.length ? supabaseRows(env, 'users', { select: 'id,name', id: `in.(${userIds.join(',')})`, limit: '1000' }).catch((error) => { console.warn('Unable to resolve photo uploader names:', error); return []; }) : Promise.resolve([]),
          supabaseRows(env, 'session_photo_delete_requests', {
            select: 'id,photo_id,status,reason',
            academic_year_id: `eq.${year.id}`,
            status: 'eq.PENDING',
            limit: '1000',
          }).catch((error) => { console.warn('Unable to load photo deletion request badges:', error); return []; }),
        ]);
        const clusterNames = new Map(clusterRows.map((row) => [String(row.id), String(row.name || row.id)]));
        const userNames = new Map(userRows.map((row) => [String(row.id), String(row.name || '')]));
        const pendingDeletes = new Map(deleteRows.map((row) => [String(row.photo_id), row]));
        const photos = photoRows.map((row) => {
          const caption = String(row.caption || row.original_filename || `Day ${row.day_number || 1} photo`);
          const pending = pendingDeletes.get(String(row.id));
          return {
            id: row.id,
            clusterId: row.cluster_id,
            clusterName: clusterNames.get(String(row.cluster_id)) || row.cluster_id || 'Dharmapuri',
            sessionId: row.session_id || row.id,
            sessionTitle: row.original_filename || `Day ${row.day_number || 1} Photos`,
            dayNumber: Number(row.day_number || 1),
            date: isoDate(row.visit_date) || isoDate(row.uploaded_at),
            panchayatId: row.panchayat_id || '',
            panchayatName: row.panchayat_name || '',
            villageId: row.village_id || '',
            villageName: row.village_name || '',
            filePath: row.file_path,
            fileUrl: row.file_url || `/api/session-photos/file/${row.id}`,
            originalFilename: row.original_filename || 'photo.jpg',
            mimeType: row.mime_type || 'image/jpeg',
            fileSize: Number(row.file_size || 0),
            uploadedBy: userNames.get(String(row.uploaded_by)) || user.name || row.uploaded_by || 'Cluster Admin',
            uploadedRole: 'Cluster Admin',
            uploadedAt: row.uploaded_at,
            status: 'active',
            caption,
            photoType: photoType(caption, row.photo_type),
            deleteRequestStatus: pending?.status || null,
            deleteRequestId: pending?.id || null,
            deleteRequestReason: pending?.reason || null,
          };
        });
        return json({ success: true, photos }, 200, { ...headers, 'Cache-Control': 'no-store' });
      } catch (error) {
        console.error('Failed to load session photos:', error);
        return json({ success: false, error: 'Unable to load session photos. Please try again.' }, 503, headers);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/session-photos/day-statuses') {
      const user = await authenticatedUser(request, env);
      if (!user) return json({ success: false, error: 'Authentication required.' }, 401, headers);
      try {
        const year = await resolveWorkerAcademicYear(request, env);
        if (!year) return json({ success: false, error: 'No academic year is available.' }, 404, headers);
        const requestedCluster = String(url.searchParams.get('clusterId') || 'all');
        const clusterId = await resolveWorkerClusterId(env, user, year.id, requestedCluster);
        const photoFilters: Record<string, string> = {
          select: 'day_number,cluster_id',
          academic_year_id: `eq.${year.id}`,
          limit: '1000',
        };
        const submissionFilters: Record<string, string> = {
          select: 'cluster_id,day_number,status',
          academic_year_id: `eq.${year.id}`,
          limit: '1000',
        };
        if (clusterId) {
          photoFilters.cluster_id = `eq.${clusterId}`;
          submissionFilters.cluster_id = `eq.${clusterId}`;
        }
        const [setupRows, photoRows, submissionRows, clusterRows] = await Promise.all([
          supabaseRows(env, 'academic_setup', { select: 'day_number,session_name', academic_year_id: `eq.${year.id}`, order: 'day_number.asc', limit: '1000' }),
          supabaseRows(env, 'session_photos', photoFilters),
          supabaseRows(env, 'session_photo_submissions', submissionFilters),
          supabaseRows(env, 'clusters', { select: 'id,name', academic_year_id: `eq.${year.id}`, limit: '1000' }),
        ]);
        const configuredDays = setupRows.filter((row) => String(row.session_name || '').trim());
        const counts: Record<number, number> = {};
        const photoCountsByClusterDay = new Map<string, number>();
        photoRows.forEach((row) => {
          const day = Number(row.day_number);
          counts[day] = (counts[day] || 0) + 1;
          const key = `${row.cluster_id}:${day}`;
          photoCountsByClusterDay.set(key, (photoCountsByClusterDay.get(key) || 0) + 1);
        });
        const statusByDay = new Map<number, string>();
        submissionRows.forEach((row) => {
          const day = Number(row.day_number);
          if (!statusByDay.has(day)) statusByDay.set(day, String(row.status || 'DRAFT'));
        });
        const clustersById = new Map(clusterRows.map((row) => [String(row.id), String(row.name || row.id)]));
        const summaries = new Map<string, any>();
        submissionRows.forEach((row) => {
          const cluster = String(row.cluster_id);
          const dayNumber = Number(row.day_number);
          const summary = summaries.get(cluster) || {
            clusterId: cluster,
            clusterName: clustersById.get(cluster) || cluster,
            totalPhotos: 0,
            submittedDaysCount: 0,
            days: [],
          };
          const photoCount = photoCountsByClusterDay.get(`${cluster}:${dayNumber}`) || 0;
          summary.totalPhotos += photoCount;
          if (['Submitted', 'Approved'].includes(String(row.status))) summary.submittedDaysCount += 1;
          summary.days.push({ dayNumber, status: String(row.status || 'DRAFT').toUpperCase(), photoCount });
          summaries.set(cluster, summary);
        });
        return json({
          success: true,
          counts,
          statuses: configuredDays.map((row) => ({ day_number: Number(row.day_number), status: statusByDay.get(Number(row.day_number)) || 'DRAFT' })),
          clusterSummaries: [...summaries.values()],
        }, 200, headers);
      } catch (error) {
        console.error('Failed to load session photo day statuses:', error);
        return json({ success: false, error: 'Unable to load session photo day statuses.' }, 503, headers);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/session-photos/delete-requests') {
      const user = await authenticatedUser(request, env);
      if (!user) return json({ success: false, error: 'Authentication required.' }, 401, headers);
      try {
        const year = await resolveWorkerAcademicYear(request, env);
        if (!year) return json({ success: false, error: 'No academic year is available.' }, 404, headers);
        const requestedCluster = String(url.searchParams.get('clusterId') || 'all');
        const clusterId = await resolveWorkerClusterId(env, user, year.id, requestedCluster);
        const requestFilters: Record<string, string> = {
          select: 'id,photo_id,academic_year_id,cluster_id,requested_by,reason,status,reviewed_by,reviewed_at,created_at',
          academic_year_id: `eq.${year.id}`,
          order: 'created_at.desc',
          limit: '1000',
        };
        if (clusterId) requestFilters.cluster_id = `eq.${clusterId}`;
        const requestRows = await supabaseRows(env, 'session_photo_delete_requests', requestFilters);
        const photoIds = [...new Set(requestRows.map((row) => String(row.photo_id || '')).filter(Boolean))];
        const clusterIds = [...new Set(requestRows.map((row) => String(row.cluster_id || '')).filter(Boolean))];
        const userIds = [...new Set(requestRows.flatMap((row) => [String(row.requested_by || ''), String(row.reviewed_by || '')]).filter(Boolean))];
        const [photoRows, clusterRows, userRows] = await Promise.all([
          photoIds.length ? supabaseRows(env, 'session_photos', { select: 'id,day_number,original_filename,file_url,caption', id: `in.(${photoIds.join(',')})`, limit: '1000' }) : Promise.resolve([]),
          clusterIds.length ? supabaseRows(env, 'clusters', { select: 'id,name', id: `in.(${clusterIds.join(',')})`, limit: '1000' }) : Promise.resolve([]),
          userIds.length ? supabaseRows(env, 'users', { select: 'id,name', id: `in.(${userIds.join(',')})`, limit: '1000' }) : Promise.resolve([]),
        ]);
        const photosById = new Map(photoRows.map((row) => [String(row.id), row]));
        const clustersById = new Map(clusterRows.map((row) => [String(row.id), String(row.name || row.id)]));
        const usersById = new Map(userRows.map((row) => [String(row.id), String(row.name || '')]));
        const requests = requestRows.filter((row) => photosById.has(String(row.photo_id))).map((row) => {
          const photo = photosById.get(String(row.photo_id));
          const dayNumber = Number(photo?.day_number || 1);
          return {
            id: row.id,
            photoId: row.photo_id,
            clusterId: row.cluster_id,
            clusterName: clustersById.get(String(row.cluster_id)) || row.cluster_id,
            academicYearId: row.academic_year_id,
            dayNumber,
            dayName: `Day ${dayNumber}`,
            sessionName: photo?.caption || `Day ${dayNumber}`,
            fileName: photo?.original_filename || 'photo.jpg',
            fileUrl: photo?.file_url || `/api/session-photos/file/${row.photo_id}`,
            requestedBy: usersById.get(String(row.requested_by)) || row.requested_by || '',
            reason: row.reason,
            requestedDate: row.created_at,
            status: row.status,
            reviewedBy: usersById.get(String(row.reviewed_by)) || '',
            reviewedAt: row.reviewed_at,
          };
        });
        return json({ success: true, requests }, 200, headers);
      } catch (error) {
        console.error('Failed to load photo deletion requests:', error);
        return json({ success: false, error: 'Unable to load photo deletion requests.' }, 503, headers);
      }
    }

    const match = url.pathname.match(/^\/api\/supabase\/([a-z_]+)(?:\/([^/]+))?$/);
    if (match) {
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
      const user = await authenticatedUser(request, env);
      if (!user) return json({ success: false, error: 'Authentication required.' }, 401, headers);
      if (user.role !== 'Super Admin') return json({ success: false, error: 'Only Super Admin can manage clusters.' }, 403, headers);

      const body = await request.json() as any;
      const name = String(body.name || '').trim();
      const district = String(body.district || name).trim();
      const collegeName = String(body.collegeName || '').trim();
      const spocName = String(body.spocName || body.adminName || '').trim();
      const spocMobile = String(body.spocMobile || body.adminPhone || '').replace(/\D/g, '').slice(-10);
      const adminEmail = String(body.adminEmail || '').trim().toLowerCase();
      if (!name || !district || !collegeName || !spocName || !/^\d{10}$/.test(spocMobile) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
        return json({ success: false, error: 'Cluster name, district, college, SPOC name, valid 10-digit phone, and valid email are required.' }, 400, headers);
      }

      const clusterId = `cluster-${crypto.randomUUID()}`;
      const adminId = `usr-${crypto.randomUUID()}`;
      const temporaryPassword = crypto.randomUUID().replace(/-/g, '').slice(0, 16) + 'Aa1!';
      const passwordHash = await bcrypt.hash(temporaryPassword, 12);

      const clusterResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/clusters`, {
        method: 'POST', headers: { ...supabaseHeaders(env), Prefer: 'return=representation' },
        body: JSON.stringify({ id: clusterId, name, district, state: 'Tamil Nadu', college_name: collegeName, spoc_name: spocName, spoc_mobile: `+91 ${spocMobile}`, status: 'Active', academic_year_id: body.academicYearId || null }),
      });
      const clusterData = await clusterResponse.json();
      if (!clusterResponse.ok) {
        console.error('Unable to create cluster in Supabase:', { status: clusterResponse.status, code: (clusterData as any)?.code || 'unknown' });
        return json({ success: false, error: 'Unable to create cluster in Supabase.' }, 400, headers);
      }

      const userResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/users`, {
        method: 'POST', headers: { ...supabaseHeaders(env), Prefer: 'return=representation' },
        body: JSON.stringify({ id: adminId, name: spocName, email: adminEmail, password_hash: passwordHash, role: 'Cluster Admin', cluster_id: clusterId, phone: `+91 ${spocMobile}`, must_change_password: true, status: 'Active', password_created_at: new Date().toISOString() }),
      });
      if (!userResponse.ok) return json({ success: false, error: 'Cluster was created but the SPOC account could not be created.' }, 503, headers);

      await fetch(`${env.SUPABASE_URL}/rest/v1/clusters?id=eq.${encodeURIComponent(clusterId)}`, {
        method: 'PATCH', headers: supabaseHeaders(env), body: JSON.stringify({ admin_id: adminId }),
      });

      let emailSent = false;
      try {
        emailSent = await sendClusterCredentialsEmail(request, env, {
          to: adminEmail,
          spocName,
          clusterName: name,
          collegeName,
          temporaryPassword,
        });
      } catch (error) {
        console.error('Unable to deliver cluster credentials email:', error);
      }

      return json({ success: true, emailSent, temporaryPassword, loginEmail: adminEmail, clusterName: name, cluster: Array.isArray(clusterData) ? clusterData[0] : clusterData }, 201, headers);
    }

    const resendClusterCredentials = url.pathname.match(/^\/api\/clusters\/([^/]+)\/resend-credentials$/);
    if (resendClusterCredentials && request.method === 'POST') {
      const user = await authenticatedUser(request, env);
      if (!user) return json({ success: false, error: 'Authentication required.' }, 401, headers);
      if (user.role !== 'Super Admin') return json({ success: false, error: 'Only Super Admin can resend cluster credentials.' }, 403, headers);

      try {
        const academicYearId = String(url.searchParams.get('academicYearId') || '').trim();
        const clusterFilters: Record<string, string> = {
          select: 'id,name,district,college_name,admin_id,academic_year_id',
          id: `eq.${resendClusterCredentials[1]}`,
          limit: '1',
        };
        if (academicYearId) clusterFilters.academic_year_id = `eq.${academicYearId}`;
        const clusters = await supabaseRows(env, 'clusters', clusterFilters);
        const cluster = clusters[0];
        if (!cluster) return json({ success: false, error: 'Cluster not found in the selected academic year.' }, 404, headers);

        const userFilters: Record<string, string> = { select: 'id,name,email,status', limit: '1' };
        if (cluster.admin_id) userFilters.id = `eq.${cluster.admin_id}`;
        else userFilters.cluster_id = `eq.${cluster.id}`;
        const clusterUsers = await supabaseRows(env, 'users', userFilters);
        const clusterAdmin = clusterUsers[0];
        if (!clusterAdmin?.email) return json({ success: false, error: 'Cluster Admin account was not found.' }, 404, headers);

        const temporaryPassword = `${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}Aa1!`;
        const passwordHash = await bcrypt.hash(temporaryPassword, 12);
        const userUpdate = await fetch(`${env.SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(clusterAdmin.id)}`, {
          method: 'PATCH',
          headers: { ...supabaseHeaders(env), Prefer: 'return=minimal' },
          body: JSON.stringify({
            password_hash: passwordHash,
            must_change_password: true,
            password_reset_at: new Date().toISOString(),
            password_created_at: new Date().toISOString(),
            status: 'Active',
            updated_at: new Date().toISOString(),
          }),
        });
        if (!userUpdate.ok) {
          console.error('Unable to reset cluster admin password in Supabase:', { status: userUpdate.status });
          return json({ success: false, error: 'Unable to reset cluster admin credentials.' }, 503, headers);
        }

        let emailSent = false;
        try {
          emailSent = await sendClusterCredentialsEmail(request, env, {
            to: String(clusterAdmin.email),
            spocName: String(clusterAdmin.name || 'Cluster Admin'),
            clusterName: String(cluster.name || cluster.id),
            collegeName: String(cluster.college_name || ''),
            temporaryPassword,
          });
        } catch (error) {
          console.error('Unable to resend cluster credentials email:', error);
        }
        return json({ success: true, emailSent, temporaryPassword, loginEmail: clusterAdmin.email, clusterName: cluster.name || cluster.id }, 200, headers);
      } catch (error) {
        console.error('Failed to reset cluster credentials:', error);
        return json({ success: false, error: 'Unable to reset cluster credentials.' }, 503, headers);
      }
    }

    const clusterUpdate = url.pathname.match(/^\/api\/clusters\/([^/]+)$/);
    if (clusterUpdate && request.method === 'PUT') {
      const user = await authenticatedUser(request, env);
      if (!user) return json({ success: false, error: 'Authentication required.' }, 401, headers);
      if (user.role !== 'Super Admin') return json({ success: false, error: 'Only Super Admin can update clusters.' }, 403, headers);

      const body = await request.json() as any;
      const name = String(body.name || '').trim();
      const district = String(body.district || name).trim();
      const collegeName = String(body.collegeName || '').trim();
      const spocName = String(body.spocName || body.adminName || '').trim();
      const spocMobile = String(body.spocMobile || body.adminPhone || '').replace(/\D/g, '').slice(-10);
      const adminEmail = String(body.adminEmail || '').trim().toLowerCase();
      const academicYearId = String(body.academicYearId || url.searchParams.get('academicYearId') || '').trim();
      if (!name || !district || !collegeName || !spocName || !/^\d{10}$/.test(spocMobile) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
        return json({ success: false, error: 'Cluster name, district, college, SPOC name, valid 10-digit phone, and valid email are required.' }, 400, headers);
      }

      const clusterFilter = `id=eq.${encodeURIComponent(clusterUpdate[1])}${academicYearId ? `&academic_year_id=eq.${encodeURIComponent(academicYearId)}` : ''}`;
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/clusters?${clusterFilter}`, {
        method: 'PATCH',
        headers: { ...supabaseHeaders(env), Prefer: 'return=representation' },
        body: JSON.stringify({ name, district, college_name: collegeName, spoc_name: spocName, spoc_mobile: `+91 ${spocMobile}`, state: 'Tamil Nadu', updated_at: new Date().toISOString() }),
      });
      const rows = await response.json();
      if (!response.ok) {
        console.error('Unable to update cluster in Supabase:', { status: response.status, code: (rows as any)?.code || 'unknown' });
        return json({ success: false, error: 'Unable to update cluster in Supabase.' }, 400, headers);
      }
      const cluster = Array.isArray(rows) ? rows[0] : rows;
      if (cluster?.admin_id) {
        await fetch(`${env.SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(cluster.admin_id)}`, {
          method: 'PATCH',
          headers: supabaseHeaders(env),
          body: JSON.stringify({ name: spocName, email: adminEmail, phone: `+91 ${spocMobile}`, updated_at: new Date().toISOString() }),
        });
      }
      return json({ success: true, data: cluster }, 200, headers);
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
