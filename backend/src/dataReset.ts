import type { PoolConnection } from 'mysql2/promise';

export interface ResetImpact {
  records: number;
  expenses: number;
  bills: number;
  relatedRecords: number;
  files: number;
}

export interface ResetExecution extends ResetImpact {
  affectedRows: number;
  filePaths: string[];
  message: string;
}

export const RESET_OPTIONS = [
  { id: 'finance', label: 'Finance', scopes: [
    { id: 'finance-drafts', label: 'Only Draft Finance Reports' },
    { id: 'finance-submitted', label: 'Submitted / Pending Finance Reports' },
    { id: 'finance-rejected', label: 'Rejected Finance Reports' },
    { id: 'finance-expenses', label: 'Finance Expenses (all reports)' },
    { id: 'finance-bills', label: 'Finance Bills (remove attachments only)' },
    { id: 'finance-reports-all', label: 'Finance Reports' },
    { id: 'finance-all', label: 'All Finance Data' },
  ] },
  { id: 'finance-reports', label: 'Finance Reports', scopes: [
    { id: 'finance-all', label: 'All Finance Reports and attached expenses' },
  ] },
  { id: 'finance-expenses', label: 'Finance Expenses', scopes: [
    { id: 'finance-expenses', label: 'All Finance Expense Line Items' },
  ] },
  { id: 'finance-bills', label: 'Finance Bills', scopes: [
    { id: 'finance-bills', label: 'Remove finance bill attachments only' },
  ] },
  { id: 'students', label: 'Students', scopes: [
    { id: 'student-attendance', label: 'Student Attendance' },
    { id: 'student-records', label: 'Student Records' },
    { id: 'students-all', label: 'All Student Data' },
  ] },
  { id: 'volunteers', label: 'Volunteers', scopes: [
    { id: 'volunteer-attendance', label: 'Volunteer Attendance' },
    { id: 'volunteer-records', label: 'Volunteer Records' },
    { id: 'volunteers-all', label: 'All Volunteer Data' },
  ] },
  { id: 'sessions', label: 'Session Scheduling', scopes: [
    { id: 'sessions-scheduled', label: 'Scheduled Sessions' },
    { id: 'sessions-draft', label: 'Draft Sessions' },
    { id: 'sessions-completed', label: 'Completed Sessions' },
    { id: 'session-reports', label: 'Session Reports' },
    { id: 'session-photos', label: 'Session Photos' },
    { id: 'sessions-all', label: 'All Session Data' },
  ] },
  { id: 'session-reports', label: 'Session Reports', scopes: [
    { id: 'session-reports', label: 'All Session Reports' },
  ] },
  { id: 'session-photos', label: 'Session Photos', scopes: [
    { id: 'session-photos', label: 'All Session Photos' },
  ] },
  { id: 'student-attendance', label: 'Student Attendance', scopes: [
    { id: 'student-attendance', label: 'All Student Attendance' },
  ] },
  { id: 'volunteer-attendance', label: 'Volunteer Attendance', scopes: [
    { id: 'volunteer-attendance', label: 'All Volunteer Attendance' },
  ] },
  { id: 'geography', label: 'Panchayats & Villages', scopes: [
    { id: 'unused-villages', label: 'Unused Villages (no linked records)' },
    { id: 'unused-panchayats', label: 'Unused Panchayats (no villages or linked records)' },
  ] },
  { id: 'clusters', label: 'Clusters', scopes: [
    { id: 'inactive-empty-clusters', label: 'Inactive clusters with no linked records or admin account' },
  ] },
  { id: 'lesson-plans', label: 'Lesson Plans', scopes: [
    { id: 'lesson-plans', label: 'All Lesson Plans' },
  ] },
  { id: 'module-library', label: 'Module Library / PPTs', scopes: [
    { id: 'module-resources', label: 'Uploaded Module Resources only' },
  ] },
  { id: 'notifications', label: 'Notifications', scopes: [
    { id: 'notifications', label: 'Application Notifications' },
  ] },
] as const;

const STATUS_SCOPE: Record<string, string[] | null> = {
  'finance-drafts': ['DRAFT'],
  'finance-submitted': ['SUBMITTED', 'PENDING_APPROVAL'],
  'finance-rejected': ['REJECTED'],
  'finance-reports-all': null,
  'finance-all': null,
};

const rows = async (connection: PoolConnection, sql: string, params: unknown[] = []): Promise<any[]> => {
  const [result] = await connection.query(sql, params);
  return result as any[];
};

const scalar = async (connection: PoolConnection, sql: string, params: unknown[] = []): Promise<number> => {
  const result = await rows(connection, sql, params);
  return Number(result[0]?.count || 0);
};

const emptyImpact = (): ResetImpact => ({ records: 0, expenses: 0, bills: 0, relatedRecords: 0, files: 0 });

const unusedClusterWhere = `status = 'Inactive' AND admin_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.cluster_id = clusters.id)
  AND NOT EXISTS (SELECT 1 FROM panchayats p WHERE p.cluster_id = clusters.id)
  AND NOT EXISTS (SELECT 1 FROM villages v WHERE v.cluster_id = clusters.id)
  AND NOT EXISTS (SELECT 1 FROM students s WHERE s.cluster_id = clusters.id)
  AND NOT EXISTS (SELECT 1 FROM volunteers v WHERE v.cluster_id = clusters.id)
  AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.cluster_id = clusters.id)
  AND NOT EXISTS (SELECT 1 FROM attendance_sessions a WHERE a.cluster_id = clusters.id)
  AND NOT EXISTS (SELECT 1 FROM lesson_plans l WHERE l.cluster_id = clusters.id)
  AND NOT EXISTS (SELECT 1 FROM session_photos p WHERE p.cluster_id = clusters.id)
  AND NOT EXISTS (SELECT 1 FROM session_reports r WHERE r.cluster_id = clusters.id)
  AND NOT EXISTS (SELECT 1 FROM approvals a WHERE a.cluster_id = clusters.id)
  AND NOT EXISTS (SELECT 1 FROM date_change_requests d WHERE d.cluster_id = clusters.id)
  AND NOT EXISTS (SELECT 1 FROM session_submissions s WHERE s.cluster_id = clusters.id)
  AND NOT EXISTS (SELECT 1 FROM finance_entries f WHERE f.cluster_id = clusters.id)
  AND NOT EXISTS (SELECT 1 FROM finance_reports f WHERE f.cluster_id = clusters.id)
  AND NOT EXISTS (SELECT 1 FROM session_photo_submissions p WHERE p.cluster_id = clusters.id)
  AND NOT EXISTS (SELECT 1 FROM session_photo_delete_requests p WHERE p.cluster_id = clusters.id)
  AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.cluster_id = clusters.id)`;

const countBillUrls = (value: any): number => {
  if (!value || typeof value !== 'object') return 0;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countBillUrls(item), 0);
  let count = 0;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'bill' && child && typeof child === 'object' && (child as any).url) count += 1;
    else count += countBillUrls(child);
  }
  return count;
};

const clearBillUrls = (value: any): any => {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(clearBillUrls);
  const next: Record<string, any> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'bill' && child && typeof child === 'object') next[key] = { ...(child as any), url: null, fileName: '' };
    else next[key] = clearBillUrls(child);
  }
  return next;
};

const blankExpenseData = (value: any): any => {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return [];
  const next = { ...value };
  next.routes = [];
  next.otherItems = [];
  next.food = { breakfast: { amount: 0, remarks: '', bill: null }, lunch: { amount: 0, remarks: '', bill: null }, dinner: { amount: 0, remarks: '', bill: null }, refreshments: { amount: 0, remarks: '', bill: null } };
  next.stationery = { amount: 0, remarks: '', bill: null };
  next.totalAmount = 0;
  return next;
};

const financeSnapshot = async (connection: PoolConnection, scope: string) => {
  const statuses = STATUS_SCOPE[scope];
  const reportRows = scope === 'finance-expenses' || scope === 'finance-bills'
    ? await rows(connection, 'SELECT id, report_data FROM finance_reports')
    : statuses
      ? await rows(connection, `SELECT id, report_data FROM finance_reports WHERE report_status IN (${statuses.map(() => '?').join(',')})`, statuses)
      : await rows(connection, 'SELECT id, report_data FROM finance_reports');
  const reportIds = reportRows.map((report) => String(report.id));
  const selectedEntries = scope === 'finance-expenses' || scope === 'finance-bills' || scope === 'finance-all'
    ? await rows(connection, 'SELECT id, draft_id, status, bill_url FROM finance_entries')
    : scope === 'finance-reports-all'
      ? reportIds.length ? await rows(connection, 'SELECT id, draft_id, status, bill_url FROM finance_entries WHERE draft_id IN (?)', [reportIds]) : []
    : statuses
      ? await rows(connection,
        `SELECT id, draft_id, status, bill_url FROM finance_entries WHERE (draft_id IN (?) OR (draft_id IS NULL AND status IN (${statuses.map(() => '?').join(',')})))`,
        [reportIds.length ? reportIds : ['__no_report__'], statuses.map((status) => status === 'DRAFT' ? 'Draft' : status === 'REJECTED' ? 'Rejected' : 'Submitted')])
      : await rows(connection, 'SELECT id, draft_id, status, bill_url FROM finance_entries');
  const distinctSelectedEntries = Array.from(new Map(selectedEntries.map((entry) => [String(entry.id), entry])).values());
  const reportBills = reportRows.reduce((sum, report) => {
    try { return sum + countBillUrls(typeof report.report_data === 'string' ? JSON.parse(report.report_data) : report.report_data); } catch { return sum; }
  }, 0);
  const bills = Math.max(distinctSelectedEntries.filter((entry) => entry.bill_url).length, reportBills);
  return {
    reportRows,
    reportIds,
    entries: distinctSelectedEntries,
    impact: {
      records: scope === 'finance-expenses' || scope === 'finance-bills' ? distinctSelectedEntries.length : reportRows.length,
      expenses: distinctSelectedEntries.length,
      bills,
      relatedRecords: 0,
      files: 0,
    } as ResetImpact,
  };
};

const targetSessionRows = async (connection: PoolConnection, scope: string) => {
  if (scope === 'sessions-all') return rows(connection, 'SELECT id FROM sessions');
  const status = scope === 'sessions-scheduled' ? 'Scheduled' : scope === 'sessions-draft' ? 'Draft' : 'Completed';
  return rows(connection, 'SELECT id FROM sessions WHERE session_status = ?', [status]);
};

export async function previewReset(connection: PoolConnection, moduleId: string, scope: string): Promise<ResetImpact> {
  if (!RESET_OPTIONS.some((module) => module.id === moduleId && module.scopes.some((item) => item.id === scope))) {
    throw new Error('Select a valid module and reset scope.');
  }
  const impact = emptyImpact();
  if (scope.startsWith('finance-')) return (await financeSnapshot(connection, scope)).impact;

  if (scope === 'student-attendance') {
    impact.records = await scalar(connection, 'SELECT COUNT(*) AS count FROM student_attendance');
    impact.expenses = impact.records;
    impact.relatedRecords = await scalar(connection, 'SELECT COUNT(*) AS count FROM session_submissions WHERE attendance_complete = 1');
  } else if (scope === 'student-records' || scope === 'students-all') {
    impact.records = await scalar(connection, 'SELECT COUNT(*) AS count FROM students');
    impact.relatedRecords = await scalar(connection, 'SELECT COUNT(*) AS count FROM student_attendance')
      + await scalar(connection, 'SELECT COUNT(*) AS count FROM session_submissions WHERE attendance_complete = 1');
  }
  if (scope === 'volunteer-attendance') {
    impact.records = await scalar(connection, 'SELECT COUNT(*) AS count FROM volunteer_attendance');
    impact.expenses = impact.records;
    impact.relatedRecords = await scalar(connection, 'SELECT COUNT(*) AS count FROM session_submissions WHERE attendance_complete = 1');
  } else if (scope === 'volunteer-records' || scope === 'volunteers-all') {
    impact.records = await scalar(connection, 'SELECT COUNT(*) AS count FROM volunteers');
    impact.relatedRecords = await scalar(connection, 'SELECT COUNT(*) AS count FROM volunteer_attendance')
      + await scalar(connection, 'SELECT COUNT(*) AS count FROM sessions WHERE volunteer_id IS NOT NULL')
      + await scalar(connection, 'SELECT COUNT(*) AS count FROM session_submissions WHERE attendance_complete = 1');
  }
  if (scope.startsWith('sessions-')) {
    const sessions = await targetSessionRows(connection, scope);
    const ids = sessions.map((session) => String(session.id));
    impact.records = ids.length;
    if (ids.length) {
      impact.expenses = await scalar(connection, 'SELECT COUNT(*) AS count FROM session_reports WHERE session_id IN (?)', [ids]);
      impact.bills = await scalar(connection, 'SELECT COUNT(*) AS count FROM session_photos WHERE session_id IN (?)', [ids]);
      impact.relatedRecords = await scalar(connection, 'SELECT COUNT(*) AS count FROM attendance_sessions WHERE session_id IN (?)', [ids])
        + await scalar(connection, 'SELECT COUNT(*) AS count FROM session_submissions WHERE session_id IN (?)', [ids])
        + await scalar(connection, 'SELECT COUNT(*) AS count FROM lesson_plans WHERE session_id IN (?)', [ids])
        + await scalar(connection, 'SELECT COUNT(DISTINCT photosub.id) AS count FROM session_photo_submissions photosub JOIN sessions s ON s.cluster_id = photosub.cluster_id AND s.academic_year_id = photosub.academic_year_id AND s.day_number = photosub.day_number WHERE s.id IN (?)', [ids]);
      impact.files = impact.bills;
    }
  } else if (scope === 'session-reports') {
    impact.records = await scalar(connection, 'SELECT COUNT(*) AS count FROM session_reports');
    impact.relatedRecords = await scalar(connection, 'SELECT COUNT(*) AS count FROM session_submissions WHERE report_complete = 1');
  } else if (scope === 'session-photos') {
    impact.records = await scalar(connection, 'SELECT COUNT(*) AS count FROM session_photos');
    impact.relatedRecords = await scalar(connection, 'SELECT COUNT(*) AS count FROM session_photo_submissions')
      + await scalar(connection, 'SELECT COUNT(*) AS count FROM session_submissions WHERE photos_complete = 1');
    impact.files = impact.records;
  }
  if (scope === 'unused-villages') {
    impact.records = await scalar(connection,
      `SELECT COUNT(*) AS count FROM villages v
       WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.village_id = v.id)
         AND NOT EXISTS (SELECT 1 FROM volunteers x WHERE x.village_id = v.id)
         AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.village_id = v.id)
         AND NOT EXISTS (SELECT 1 FROM attendance_sessions a WHERE a.village_id = v.id)
         AND NOT EXISTS (SELECT 1 FROM session_photos p WHERE p.village_id = v.id)`);
  }
  if (scope === 'unused-panchayats') {
    const count = await scalar(connection,
      `SELECT COUNT(*) AS count FROM panchayats p
       WHERE NOT EXISTS (SELECT 1 FROM villages v WHERE v.panchayat_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM students s WHERE s.panchayat_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM volunteers x WHERE x.panchayat_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.panchayat_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM attendance_sessions a WHERE a.panchayat_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM session_photos f WHERE f.panchayat_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM lesson_plans l WHERE l.panchayat_id = p.id)`);
    impact.records += count;
  }
  if (scope === 'lesson-plans') impact.records = await scalar(connection, 'SELECT COUNT(*) AS count FROM lesson_plans');
  if (scope === 'module-resources') {
    impact.records = await scalar(connection, 'SELECT COUNT(*) AS count FROM module_resources');
    impact.files = impact.records;
  }
  if (scope === 'notifications') impact.records = await scalar(connection, 'SELECT COUNT(*) AS count FROM notifications');
  if (scope === 'inactive-empty-clusters') impact.records = await scalar(connection, `SELECT COUNT(*) AS count FROM clusters WHERE ${unusedClusterWhere}`);
  return impact;
}

export async function executeReset(connection: PoolConnection, moduleId: string, scope: string): Promise<ResetExecution> {
  const impact = await previewReset(connection, moduleId, scope);
  let affectedRows = 0;
  const filePaths: string[] = [];
  const deleteRows = async (_table: string, sql: string, params: unknown[] = []) => {
    const [result] = await connection.query(sql, params) as any;
    affectedRows += Number(result?.affectedRows || 0);
  };

  if (scope.startsWith('finance-')) {
    const snapshot = await financeSnapshot(connection, scope);
    const ids = snapshot.reportIds;
    if (scope === 'finance-bills') {
      await connection.query("UPDATE finance_entries SET bill_url = NULL, bill_reference = NULL WHERE bill_url IS NOT NULL OR bill_reference IS NOT NULL");
      for (const report of snapshot.reportRows) {
        let data: any;
        try { data = typeof report.report_data === 'string' ? JSON.parse(report.report_data) : report.report_data; } catch { continue; }
        await connection.query('UPDATE finance_reports SET report_data = ? WHERE id = ?', [JSON.stringify(clearBillUrls(data)), report.id]);
      }
      affectedRows = impact.bills;
    } else if (scope === 'finance-expenses') {
      await deleteRows('finance_entries', 'DELETE FROM finance_entries');
      for (const report of snapshot.reportRows) {
        let data: any;
        try { data = typeof report.report_data === 'string' ? JSON.parse(report.report_data) : report.report_data; } catch { data = {}; }
        await connection.query("UPDATE finance_reports SET report_data = ?, report_status = 'DRAFT', edit_request_status = 'NONE', edit_request_reason = NULL, edit_permission = 0, last_submitted_at = NULL, last_submitted_by = NULL WHERE id = ?", [JSON.stringify(blankExpenseData(data)), report.id]);
      }
      await deleteRows('approvals', "DELETE FROM approvals WHERE module IN ('Finance','Finance Edit Request')");
    } else {
      if (snapshot.entries.length) await deleteRows('finance_entries', `DELETE FROM finance_entries WHERE id IN (?)`, [snapshot.entries.map((entry) => entry.id)]);
      const approvalRecordIds = Array.from(new Set([
        ...ids,
        ...snapshot.entries.map((entry) => String(entry.id)),
        ...snapshot.entries.map((entry) => String(entry.draft_id || '')).filter(Boolean),
      ]));
      if (ids.length) {
        await deleteRows('finance_report_history', 'DELETE FROM finance_report_history WHERE report_id IN (?)', [ids]);
        await deleteRows('finance_reports', 'DELETE FROM finance_reports WHERE id IN (?)', [ids]);
      }
      if (approvalRecordIds.length) await deleteRows('approvals', "DELETE FROM approvals WHERE module IN ('Finance','Finance Edit Request') AND record_id IN (?)", [approvalRecordIds]);
    }
  } else if (scope === 'student-attendance') {
    await deleteRows('student_attendance', 'DELETE FROM student_attendance');
    await connection.query('UPDATE attendance_sessions SET present_count = 0, total_count = 0, task_completed_count = 0, not_marked_count = 0');
    await connection.query('UPDATE session_submissions SET attendance_complete = 0');
  } else if (scope === 'student-records' || scope === 'students-all') {
    await deleteRows('students', 'DELETE FROM students');
    await connection.query('UPDATE attendance_sessions SET present_count = 0, total_count = 0, task_completed_count = 0, not_marked_count = 0');
    await connection.query('UPDATE session_submissions SET attendance_complete = 0');
  } else if (scope === 'volunteer-attendance') {
    await deleteRows('volunteer_attendance', 'DELETE FROM volunteer_attendance');
    await connection.query('UPDATE session_submissions SET attendance_complete = 0');
  } else if (scope === 'volunteer-records' || scope === 'volunteers-all') {
    await connection.query('UPDATE sessions SET volunteer_id = NULL WHERE volunteer_id IS NOT NULL');
    await deleteRows('volunteers', 'DELETE FROM volunteers');
    await connection.query('UPDATE session_submissions SET attendance_complete = 0');
  } else if (scope.startsWith('sessions-')) {
    const sessions = await targetSessionRows(connection, scope);
    const ids = sessions.map((session) => String(session.id));
    if (ids.length) {
      const photoRows = await rows(connection, 'SELECT file_path FROM session_photos WHERE session_id IN (?)', [ids]);
      filePaths.push(...photoRows.map((row) => String(row.file_path || '')).filter(Boolean));
      await deleteRows('session_photos', 'DELETE FROM session_photos WHERE session_id IN (?)', [ids]);
      await deleteRows('session_photo_submissions', 'DELETE photosub FROM session_photo_submissions photosub JOIN sessions s ON s.cluster_id = photosub.cluster_id AND s.academic_year_id = photosub.academic_year_id AND s.day_number = photosub.day_number WHERE s.id IN (?)', [ids]);
      await deleteRows('lesson_plans', 'DELETE FROM lesson_plans WHERE session_id IN (?)', [ids]);
      await deleteRows('sessions', 'DELETE FROM sessions WHERE id IN (?)', [ids]);
    }
  } else if (scope === 'session-reports') {
    await deleteRows('session_reports', 'DELETE FROM session_reports');
    await connection.query('UPDATE session_submissions SET report_complete = 0');
  } else if (scope === 'session-photos') {
    const photos = await rows(connection, 'SELECT id, file_path FROM session_photos');
    filePaths.push(...photos.map((row) => String(row.file_path || '')).filter(Boolean));
    await deleteRows('session_photos', 'DELETE FROM session_photos');
    await deleteRows('session_photo_submissions', 'DELETE FROM session_photo_submissions');
    await connection.query('UPDATE session_submissions SET photos_complete = 0');
  } else if (scope === 'unused-villages') {
    await deleteRows('villages',
      `DELETE v FROM villages v
       WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.village_id = v.id)
         AND NOT EXISTS (SELECT 1 FROM volunteers x WHERE x.village_id = v.id)
         AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.village_id = v.id)
         AND NOT EXISTS (SELECT 1 FROM attendance_sessions a WHERE a.village_id = v.id)
         AND NOT EXISTS (SELECT 1 FROM session_photos p WHERE p.village_id = v.id)`);
  }
  if (scope === 'unused-panchayats') {
    await deleteRows('panchayats',
      `DELETE p FROM panchayats p
       WHERE NOT EXISTS (SELECT 1 FROM villages v WHERE v.panchayat_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM students s WHERE s.panchayat_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM volunteers x WHERE x.panchayat_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.panchayat_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM attendance_sessions a WHERE a.panchayat_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM session_photos f WHERE f.panchayat_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM lesson_plans l WHERE l.panchayat_id = p.id)`);
  }
  if (scope === 'lesson-plans') await deleteRows('lesson_plans', 'DELETE FROM lesson_plans');
  if (scope === 'module-resources') {
    const resources = await rows(connection, 'SELECT file_path FROM module_resources');
    filePaths.push(...resources.map((row) => String(row.file_path || '')).filter(Boolean));
    await deleteRows('module_resources', 'DELETE FROM module_resources');
  }
  if (scope === 'notifications') await deleteRows('notifications', 'DELETE FROM notifications');
  if (scope === 'inactive-empty-clusters') await deleteRows('clusters', `DELETE FROM clusters WHERE ${unusedClusterWhere}`);

  return { ...impact, affectedRows, filePaths, message: `${scope} reset completed.` };
}
