import * as XLSX from 'xlsx';
import { LessonPlan, FinanceEntry, Session, Student, Volunteer } from '../types';

/**
 * Universal Export Utilities for TQI-ERP
 * Supporting Excel (.xlsx) workbooks and direct Printable PDF triggers for:
 * 1. Lesson Plans
 * 2. Finance Entries & Day Statement Data
 * 3. Attendance (7-Day Matrix & Students)
 * 4. Super Admin Complete Cluster Consolidation
 */

// Helper to trigger file download
export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ─────────────────────────────────────────────────────────────────
// 1. LESSON PLAN EXPORTS
// ─────────────────────────────────────────────────────────────────

export function exportLessonPlanExcel(plan: LessonPlan) {
  const wb = XLSX.utils.book_new();

  // Overview & Metadata Sheet
  const metadataRows: any[][] = [
    ['TQI STUDENT HOLISTIC DEVELOPMENT PROGRAM - LESSON PLAN'],
    ['Academic Year', plan.academicYear || '2025 – 2026'],
    ['Cluster', plan.cluster || 'Dharmapuri'],
    ['College / Team', plan.teamCollegeName || plan.collegeName || '—'],
    ['Villages Covered', plan.villagesList?.join(', ') || plan.villageName || '—'],
    ['Summit / Day', `Summit ${plan.summitNumbers || '—'} / Day ${plan.dayNumber || '01'}`],
    ['Planned Date', plan.date || '—'],
    ['Status', plan.status || 'Draft'],
    [],
    ['SESSION TOPIC & OVERVIEW'],
    ['Topic', plan.topic || plan.title || '—'],
    ['Overview / Objective', plan.overview || plan.objective || '—'],
    ['Expected Outcome', plan.expectedOutcome || '—'],
    [],
    ['LESSON PLAN CONTENT'],
    ['Content Title', 'Description']
  ];

  if (plan.gradeSegments && plan.gradeSegments.length > 0) {
    plan.gradeSegments.forEach((seg) => {
      metadataRows.push([seg.title || 'Summit content', seg.description]);
    });
  } else {
    metadataRows.push(['Summit content', plan.title || plan.overview || '—']);
  }

  metadataRows.push([]);
  metadataRows.push(['SESSION ACTIVITIES']);
  metadataRows.push(['Activity #', 'Activity Title', 'Description & Delivery']);

  if (plan.activitiesDetailed && plan.activitiesDetailed.length > 0) {
    plan.activitiesDetailed.forEach((act) => {
      metadataRows.push([`Activity ${act.activityNumber}`, act.title, act.description]);
    });
  } else {
    metadataRows.push(['Activity 1', 'Standard Module Execution', plan.overview || '—']);
  }

  metadataRows.push([]);
  metadataRows.push(['ASSIGNED VOLUNTEERS']);
  metadataRows.push(['S.No', 'Volunteer Name']);
  if (plan.assignedVolunteers && plan.assignedVolunteers.length > 0) {
    plan.assignedVolunteers.forEach((v, idx) => {
      metadataRows.push([idx + 1, v]);
    });
  } else {
    metadataRows.push([1, plan.volunteerName || 'Unassigned']);
  }

  const ws = XLSX.utils.aoa_to_sheet(metadataRows);
  XLSX.utils.book_append_sheet(wb, ws, `LessonPlan_Day${plan.dayNumber || 1}`);

  const safeTopic = (plan.topic || 'LessonPlan').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
  XLSX.writeFile(wb, `TQI_LessonPlan_Day${plan.dayNumber || 1}_${safeTopic}.xlsx`);
}

export function exportAllLessonPlansExcel(plans: LessonPlan[], clusterName = 'Dharmapuri') {
  const wb = XLSX.utils.book_new();

  const dataRows = plans.map((p, idx) => ({
    'S.No': idx + 1,
    'Day': `Day ${p.dayNumber || 1}`,
    'Date': p.date || '—',
    'Cluster': p.cluster || clusterName,
    'College / Team': p.teamCollegeName || p.collegeName || '—',
    'Topic': p.topic || p.title || '—',
    'Villages': p.villagesList?.join(', ') || p.villageName || '—',
    'Volunteers': p.assignedVolunteers?.join(', ') || p.volunteerName || '—',
    'Status': p.status || 'Draft',
    'Last Updated': p.lastUpdated || '—'
  }));

  const ws = XLSX.utils.json_to_sheet(dataRows);
  XLSX.utils.book_append_sheet(wb, ws, 'All_Lesson_Plans');
  XLSX.writeFile(wb, `TQI_LessonPlans_${clusterName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
}

export function exportLessonPlanPdf(plan: LessonPlan) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.alert('Allow pop-ups to open the print-ready lesson plan PDF.');
    return;
  }
  const escapeHtml = (value: unknown) => String(value ?? '—')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const lines = (value: unknown) => escapeHtml(value).replace(/\r?\n/g, '<br/>');
  const activities = plan.activitiesDetailed || [];
  const gradeSegments = plan.gradeSegments || [];
  const outcomes = plan.expectedOutcomes?.length
    ? plan.expectedOutcomes
    : String(plan.expectedOutcome || '').split('\n').map((item) => item.trim()).filter(Boolean);
  const volunteers: NonNullable<LessonPlan['volunteerRoster']> = plan.volunteerRoster?.length
    ? plan.volunteerRoster
    : (plan.assignedVolunteers || []).map((name) => ({ name, role: '', phone: '', year: '' }));
  const activityRows = activities.map((activity, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(activity.title)}</strong></td>
      <td>${lines(activity.description)}</td>
      <td>${escapeHtml(activity.duration || '—')}</td>
    </tr>`).join('');
  const volunteerRows = volunteers.map((volunteer, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(volunteer.name)}</td>
      <td>${escapeHtml(volunteer.phone || '—')}</td>
      <td>${escapeHtml(volunteer.year || '—')}</td>
    </tr>`).join('');
  const gradeContent = gradeSegments.length
    ? gradeSegments.map((segment) => `<div class="grade-block"><h3>${escapeHtml(segment.title || 'Summit content')}</h3><p>${lines(segment.description)}</p></div>`).join('')
    : `<p>${lines(plan.description || '—')}</p>`;
  const outcomeItems = outcomes.length ? outcomes.map((outcome) => `<li>${escapeHtml(outcome)}</li>`).join('') : '<li>—</li>';
  const planVillages = plan.villagesList?.length ? plan.villagesList : (plan.villageName ? [plan.villageName] : []);
  const village = planVillages.join(', ') || '—';
  const panchayat = plan.panchayatNames?.join(', ') || plan.panchayatName || '—';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>TQI Lesson Plan - Day ${escapeHtml(plan.dayNumber || 1)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #17233b; font-size: 11pt; line-height: 1.5; }
          .document { max-width: 900px; margin: 0 auto; }
          .header { display: flex; align-items: center; gap: 18px; border-bottom: 2px solid #173f78; padding: 0 0 18px; margin-bottom: 20px; }
          .logo { display: block; flex: 0 0 88px; width: 88px; height: 88px; object-fit: contain; margin: 0; }
          .header-copy { flex: 1; text-align: center; padding-right: 88px; }
          .title { font-size: 17pt; font-weight: 800; letter-spacing: .3px; }
          .program { color: #52627a; font-size: 10pt; font-weight: 600; margin-top: 2px; }
          .subtitle { color: #173f78; font-size: 12pt; font-weight: 800; letter-spacing: .6px; margin-top: 10px; }
          .academic-year { color: #52627a; font-size: 9pt; font-weight: 700; margin-top: 4px; }
          .meta, .data-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .meta { margin: 0 0 22px; }
          .meta td, .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 8px 9px; vertical-align: top; overflow-wrap: anywhere; }
          .meta .label { width: 18%; background: #f2f6fb; color: #334155; font-size: 9pt; font-weight: 700; }
          .meta .value { width: 32%; font-size: 10pt; }
          .section { margin: 20px 0 0; break-inside: auto; }
          .section-title { color: #173f78; font-size: 11pt; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin: 0 0 9px; break-after: avoid; }
          .content { color: #334155; font-size: 10pt; white-space: normal; }
          .grade-block { margin: 0 0 12px; break-inside: avoid; }
          .grade-block h3 { margin: 0 0 4px; font-size: 10pt; }
          .grade-block p, .content p { margin: 0; white-space: pre-wrap; }
          .outcomes { margin: 0; padding-left: 20px; }
          .data-table { font-size: 9.5pt; }
          .data-table thead { display: table-header-group; }
          .data-table th { background: #edf3fa; color: #334155; text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .3px; }
          .data-table tr { break-inside: avoid; }
          @page { size: A4; margin: 16mm 15mm; }
          @media screen { body { background: #eef2f7; padding: 24px; } .document { background: white; padding: 32px 38px; box-shadow: 0 8px 30px #0f172a1a; } }
          @media print { .document { max-width: none; } }
        </style>
      </head>
      <body>
        <main class="document">
          <header class="header">
            <img class="logo" src="${window.location.origin}/logo.png" alt="Talent Quest for India logo" />
            <div class="header-copy">
              <div class="title">TALENT QUEST FOR INDIA</div>
              <div class="program">Student Holistic Development Program</div>
              <div class="subtitle">LESSON PLAN FOR THE SUMMIT</div>
              <div class="academic-year">Academic Year: ${escapeHtml(plan.academicYear || '—')}</div>
            </div>
          </header>
          <table class="meta"><tbody>
            <tr><td class="label">Cluster</td><td class="value">${escapeHtml(plan.cluster)}</td><td class="label">Team</td><td class="value">${escapeHtml(plan.teamCollegeName || plan.collegeName)}</td></tr>
            <tr><td class="label">Panchayat</td><td class="value">${escapeHtml(panchayat)}</td><td class="label">Village Name</td><td class="value">${escapeHtml(village)}</td></tr>
            <tr><td class="label">No. of Summit</td><td class="value">${escapeHtml(plan.summitNumbers)}</td><td class="label">Session / Day</td><td class="value">Day ${escapeHtml(plan.dayNumber || 1)}</td></tr>
            <tr><td class="label">Planned Date</td><td class="value" colspan="3">${escapeHtml(plan.date)}</td></tr>
          </tbody></table>
          <section class="section"><h2 class="section-title">Overview</h2><div class="content"><p>${lines(plan.overview || plan.objective)}</p></div></section>
          <section class="section"><h2 class="section-title">Lesson Plan Content</h2><div class="content">${gradeContent}</div></section>
          <section class="section"><h2 class="section-title">Detailed View / Activities</h2><table class="data-table"><thead><tr><th style="width:8%">S.No</th><th style="width:22%">Activity / Task</th><th>Description</th><th style="width:14%">Time (mins)</th></tr></thead><tbody>${activityRows || '<tr><td colspan="4">No activities provided.</td></tr>'}</tbody></table></section>
          <section class="section"><h2 class="section-title">Expected Outcome</h2><ul class="outcomes">${outcomeItems}</ul></section>
          <section class="section"><h2 class="section-title">Volunteers Involved</h2><table class="data-table"><thead><tr><th style="width:10%">S.No</th><th>Volunteer Name</th><th style="width:25%">Contact</th><th style="width:18%">Year</th></tr></thead><tbody>${volunteerRows || '<tr><td colspan="4">No volunteers listed.</td></tr>'}</tbody></table></section>
        </main>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// ─────────────────────────────────────────────────────────────────
// 2. FINANCE EXPORTS (Excel & PDF)
// ─────────────────────────────────────────────────────────────────

export function exportFinanceExcel(
  entries: FinanceEntry[],
  clusterName = 'Cluster',
  collegeName = 'Partner Institution'
) {
  const wb = XLSX.utils.book_new();

  // Summary header
  const summaryRows: any[][] = [
    ['TQI FINANCIAL EXPENDITURE STATEMENT'],
    ['Cluster', clusterName],
    ['College / Institution', collegeName],
    ['Export Date', new Date().toLocaleDateString('en-IN')],
    ['Total Expense Entries', entries.length],
    ['Total Expenditure (₹)', entries.reduce((s, e) => s + (e.amount || 0), 0)],
    []
  ];

  const detailRows = entries.map((e, idx) => ({
    'S.No': idx + 1,
    'Date': e.date || '—',
    'Session / Day': e.sessionDay || '—',
    'Category': e.category || '—',
    'Description': e.description || '—',
    'Remarks / Route': e.remarks || '—',
    'Panchayat': e.panchayatName || '—',
    'Amount (₹)': e.amount || 0,
    'Status': e.status || 'Pending',
    'Has Bill Attached': e.billUrl ? 'Yes' : 'No'
  }));

  const ws = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.sheet_add_json(ws, detailRows, { origin: 'A8' });
  XLSX.utils.book_append_sheet(wb, ws, 'Finance_Statement');
  XLSX.writeFile(wb, `TQI_Finance_Expenses_${clusterName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
}

export function exportFinanceDayPdf(
  dayNumber: number,
  date: string,
  entries: FinanceEntry[],
  clusterName = 'Cluster',
  collegeName = 'Partner Institution'
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const total = entries.reduce((s, e) => s + (e.amount || 0), 0);
  const volunteerCount = 24;
  const perPerson = Math.round(total / volunteerCount);

  const tableRowsHtml = entries
    .map(
      (e, idx) => `<tr>
      <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${idx + 1}</td>
      <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: 600;">${e.category}</td>
      <td style="padding: 8px; border: 1px solid #e2e8f0;">${e.description}</td>
      <td style="padding: 8px; border: 1px solid #e2e8f0;">${e.remarks || '—'}</td>
      <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">₹${(e.amount || 0).toLocaleString()}</td>
      <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${e.billUrl ? 'Attached' : 'No Bill'}</td>
    </tr>`
    )
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>TQI Finance Day ${dayNumber} Statement</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #0f172a; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; }
          .title { font-size: 18px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; }
          .sub { font-size: 12px; font-weight: 700; color: #64748b; margin-top: 4px; }
          .meta-box { display: flex; justify-content: space-between; background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 10px; }
          th { background: #1e293b; color: white; padding: 8px; text-align: left; }
          .total-row { background: #f1f5f9; font-weight: bold; }
          .split-box { margin-top: 20px; padding: 12px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; font-size: 13px; color: #065f46; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">TALENT QUEST FOR INDIA &bull; FINANCIAL EXPENDITURE STATEMENT</div>
          <div class="sub">DAY ${dayNumber} STATEMENT &bull; ${collegeName.toUpperCase()}</div>
        </div>

        <div class="meta-box">
          <div><strong>Cluster:</strong> ${clusterName}</div>
          <div><strong>Session Day:</strong> Day ${dayNumber}</div>
          <div><strong>Date:</strong> ${date || '—'}</div>
          <div><strong>Total:</strong> ₹${total.toLocaleString()}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th style="width: 100px;">Category</th>
              <th>Description / Route</th>
              <th>Calculation / Remarks</th>
              <th style="width: 90px; text-align: right;">Amount</th>
              <th style="width: 80px; text-align: center;">Bill</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
            <tr class="total-row">
              <td colspan="4" style="padding: 10px; text-align: right; border: 1px solid #cbd5e1;">Grand Total:</td>
              <td style="padding: 10px; text-align: right; border: 1px solid #cbd5e1;">₹${total.toLocaleString()}</td>
              <td style="border: 1px solid #cbd5e1;"></td>
            </tr>
          </tbody>
        </table>

        <div class="split-box">
          Group Expense Split Summary: ₹${total.toLocaleString()} total expenditure &divide; ${volunteerCount} Volunteers = <strong>₹${perPerson.toLocaleString()} per person</strong>.
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// ─────────────────────────────────────────────────────────────────
// 3. ATTENDANCE EXPORTS (Excel & PDF)
// ─────────────────────────────────────────────────────────────────

export function exportAttendanceMatrixExcel(
  scheduledDays: Array<{ dayNumber: number; date: string; dayLabel?: string }>,
  matrixRows: Array<{
    studentName: string;
    code?: string;
    standard: string;
    schoolName: string;
    dayStatuses: Array<{ dayNumber: number; status: string }>;
  }>,
  clusterName = 'Dharmapuri'
) {
  const wb = XLSX.utils.book_new();

  const formattedRows = matrixRows.map((r, idx) => {
    const rowObj: Record<string, any> = {
      'S.No': idx + 1,
      'Student Code': r.code || `STU-${idx + 1}`,
      'Student Name': r.studentName,
      'Standard': r.standard,
      'School / Learning Hub': r.schoolName
    };

    scheduledDays.slice(0, 7).forEach((day, dIdx) => {
      const st = r.dayStatuses[dIdx]?.status || 'P';
      rowObj[`Day ${day.dayNumber} (${day.date || '—'})`] = st === 'P' ? 'Present' : 'Absent';
    });

    const presentCount = r.dayStatuses.filter((d) => d.status === 'P').length;
    rowObj['Total Present Days'] = presentCount;
    rowObj['Attendance %'] = `${Math.round((presentCount / Math.max(1, scheduledDays.slice(0, 7).length)) * 100)}%`;

    return rowObj;
  });

  const ws = XLSX.utils.json_to_sheet(formattedRows);
  XLSX.utils.book_append_sheet(wb, ws, '7Day_Attendance_Matrix');
  XLSX.writeFile(wb, `TQI_Attendance_7Day_${clusterName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
}

export interface AttendanceRosterExportRow {
  name: string;
  standard: string;
  village: string;
  attendance: string;
  taskStatus?: string;
}

export function exportAttendanceRosterExcel(
  rows: AttendanceRosterExportRow[],
  context: { cluster: string; panchayat: string; village: string; day: string; date: string; standard: string },
) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['TQI STUDENT ATTENDANCE'],
    ['Cluster', context.cluster, 'Panchayat', context.panchayat],
    ['Village', context.village, 'Day', context.day, 'Date', context.date],
    ['Standard', context.standard],
    [],
    ['S.No', 'Student Name', 'Standard', 'Village', 'Attendance', 'Task Completion'],
    ...rows.map((row, index) => [index + 1, row.name, row.standard, row.village, row.attendance, row.taskStatus || '—']),
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance');
  const safeName = `${context.day}_${context.village}_${context.standard}`.replace(/[^a-zA-Z0-9_-]+/g, '_');
  XLSX.writeFile(workbook, `TQI_Attendance_${safeName}.xlsx`);
}

export interface VolunteerAttendanceExportRow {
  name: string;
  role: string;
  attendance: string;
}

export function exportVolunteerAttendanceRosterExcel(
  rows: VolunteerAttendanceExportRow[],
  context: { cluster: string; panchayat: string; village: string; day: string; date: string; academicYear: string },
) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['TALENT QUEST FOR INDIA — VOLUNTEER ATTENDANCE'],
    ['Academic Year', context.academicYear],
    ['Cluster', context.cluster, 'Day', context.day, 'Date', context.date],
    [],
    ['S.No', 'Volunteer Name', 'Role', 'Attendance'],
    ...rows.map((row, index) => [index + 1, row.name, row.role, row.attendance]),
  ]);
  sheet['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, sheet, 'Volunteer Attendance');
  const safeName = `${context.day}_${context.cluster}`.replace(/[^a-zA-Z0-9_-]+/g, '_');
  XLSX.writeFile(workbook, `TQI_Volunteer_Attendance_${safeName}.xlsx`);
}

export interface SuperAdminAttendanceExportRow {
  name: string;
  cluster: string;
  panchayat: string;
  village: string;
  day: string;
  date: string;
  standard?: string;
  role?: string;
  attendance: string;
  taskStatus?: string;
}

export function exportSuperAdminAttendanceExcel(
  rows: SuperAdminAttendanceExportRow[],
  context: { subject: 'students' | 'volunteers'; academicYear: string; scope: string },
) {
  const workbook = XLSX.utils.book_new();
  const isStudents = context.subject === 'students';
  const detailRows = rows.map((row, index) => isStudents
    ? [index + 1, row.name, row.standard || '—', row.cluster, row.panchayat, row.village, row.day, row.date, row.attendance, row.taskStatus || '—']
    : [index + 1, row.name, row.role || 'Volunteer', row.cluster, row.day, row.date, row.attendance]);
  const headers = isStudents
    ? ['S.No', 'Student Name', 'Standard', 'Cluster', 'Panchayat', 'Village', 'Day', 'Date', 'Attendance', 'Task Completion']
    : ['S.No', 'Volunteer Name', 'Role', 'Cluster', 'Day', 'Date', 'Attendance'];
  const sheet = XLSX.utils.aoa_to_sheet([
    [`TALENT QUEST FOR INDIA — ${isStudents ? 'STUDENT' : 'VOLUNTEER'} ATTENDANCE`],
    ['Academic Year', context.academicYear],
    ['Export Scope', context.scope],
    [],
    headers,
    ...detailRows,
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance Details');
  const safeScope = context.scope.replace(/[^a-zA-Z0-9_-]+/g, '_');
  XLSX.writeFile(workbook, `TQI_${isStudents ? 'Student' : 'Volunteer'}_Attendance_${safeScope}.xlsx`);
}

export function exportAttendanceRosterPdf(
  rows: AttendanceRosterExportRow[],
  context: { cluster: string; panchayat: string; village: string; day: string; date: string; standard: string },
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] || character);
  const rowsHtml = rows.map((row, index) => `<tr><td>${index + 1}</td><td>${escape(row.name)}</td><td>${escape(row.standard)}</td><td>${escape(row.village)}</td><td>${escape(row.attendance)}</td><td>${escape(row.taskStatus || '—')}</td></tr>`).join('');
  printWindow.document.write(`<!doctype html><html><head><title>TQI Attendance ${escape(context.day)}</title><style>body{font-family:Arial,sans-serif;color:#172033;margin:32px}h1{text-align:center;color:#153b78;font-size:20px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:20px 0;padding:14px;background:#f3f6fb;border-radius:8px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#153b78;color:#fff;text-align:left}th,td{border:1px solid #ccd5e2;padding:8px}tbody tr:nth-child(even){background:#f7f9fc}@media print{body{margin:12mm}}</style></head><body><h1>Talent Quest for India · Student Attendance</h1><div class="meta"><span><b>Cluster:</b> ${escape(context.cluster)}</span><span><b>Panchayat:</b> ${escape(context.panchayat)}</span><span><b>Village:</b> ${escape(context.village)}</span><span><b>Standard:</b> ${escape(context.standard)}</span><span><b>Day:</b> ${escape(context.day)}</span><span><b>Date:</b> ${escape(context.date)}</span></div><table><thead><tr><th>S.No</th><th>Student Name</th><th>Standard</th><th>Village</th><th>Attendance</th><th>Task Completion</th></tr></thead><tbody>${rowsHtml}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
  printWindow.document.close();
}

export function exportAttendanceMatrixPdf(
  scheduledDays: Array<{ dayNumber: number; date: string; dayLabel?: string }>,
  matrixRows: Array<{
    studentName: string;
    standard: string;
    schoolName: string;
    dayStatuses: Array<{ dayNumber: number; status: string }>;
  }>,
  clusterName = 'Dharmapuri'
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const thDaysHtml = scheduledDays
    .slice(0, 7)
    .map((d) => `<th style="text-align: center; padding: 6px 4px; border: 1px solid #cbd5e1; font-size: 11px;">Day ${d.dayNumber}<br/><span style="font-weight: normal; font-size: 10px;">${d.date || ''}</span></th>`)
    .join('');

  const rowsHtml = matrixRows
    .map((r, idx) => {
      const presentCount = r.dayStatuses.filter((d) => d.status === 'P').length;
      const totalDays = scheduledDays.slice(0, 7).length;
      const pct = `${Math.round((presentCount / Math.max(1, totalDays)) * 100)}%`;

      const dayCellsHtml = r.dayStatuses
        .slice(0, 7)
        .map(
          (d) => `<td style="text-align: center; padding: 6px 4px; border: 1px solid #e2e8f0; font-weight: bold; color: ${d.status === 'P' ? '#059669' : '#e11d48'};">
            ${d.status}
          </td>`
        )
        .join('');

      return `<tr>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 600;">${r.studentName}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">${r.standard}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${r.schoolName}</td>
        ${dayCellsHtml}
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold;">${presentCount}/${totalDays}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #2563eb;">${pct}</td>
      </tr>`;
    })
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>TQI 7-Day Attendance Matrix - ${clusterName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 30px; color: #0f172a; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 16px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; }
          .sub { font-size: 11px; font-weight: 600; color: #64748b; margin-top: 3px; }
          table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
          th { background: #0f172a; color: white; padding: 6px 8px; text-align: left; }
          @media print { @page { size: landscape; margin: 15mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">TALENT QUEST FOR INDIA &bull; 7-DAY ATTENDANCE DETAILED MATRIX</div>
          <div class="sub">CLUSTER: ${clusterName.toUpperCase()} &bull; GENERATED ON: ${new Date().toLocaleDateString('en-IN')}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 25px; text-align: center;">#</th>
              <th>Student Name</th>
              <th style="width: 40px; text-align: center;">Std</th>
              <th>School / Hub</th>
              ${thDaysHtml}
              <th style="width: 60px; text-align: center;">P / Total</th>
              <th style="width: 50px; text-align: center;">%</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// ─────────────────────────────────────────────────────────────────
// 4. SUPER ADMIN CONSOLIDATED EXPORT (ALL CLUSTERS OR SELECTIVE)
// ─────────────────────────────────────────────────────────────────

export interface ClusterConsolidationData {
  clusterName: string;
  sessions: Session[];
  financeEntries: FinanceEntry[];
  lessonPlans: LessonPlan[];
  students: Student[];
  volunteers: Volunteer[];
}

export function exportSuperAdminConsolidatedExcel(
  clusterDataList: ClusterConsolidationData[],
  selectedCluster = 'all'
) {
  const wb = XLSX.utils.book_new();

  const isAll = selectedCluster === 'all';
  const targetData = isAll
    ? clusterDataList
    : clusterDataList.filter((c) => c.clusterName.toLowerCase() === selectedCluster.toLowerCase());

  // Sheet 1: Master Summary
  const summaryRows: any[][] = [
    ['TQI ERP — SUPER ADMIN COMPLETE CLUSTER AUDIT REPORT'],
    ['Scope', isAll ? 'All Clusters' : selectedCluster],
    ['Generated At', new Date().toLocaleString('en-IN')],
    [],
    ['Cluster Name', 'Sessions Scheduled', 'Lesson Plans', 'Finance Total (₹)', 'Enrolled Students', 'Mentors / Volunteers']
  ];

  targetData.forEach((c) => {
    const finTotal = c.financeEntries.reduce((s, e) => s + (e.amount || 0), 0);
    summaryRows.push([
      c.clusterName,
      c.sessions.length,
      c.lessonPlans.length,
      finTotal,
      c.students.length,
      c.volunteers.length
    ]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Cluster_Overview');

  // Sheet 2: Consolidated Finance
  const allFinRows: any[] = [];
  targetData.forEach((c) => {
    c.financeEntries.forEach((e, idx) => {
      allFinRows.push({
        'Cluster': c.clusterName,
        'S.No': idx + 1,
        'Date': e.date || '—',
        'Session / Day': e.sessionDay || '—',
        'Category': e.category || '—',
        'Description': e.description || '—',
        'Remarks': e.remarks || '—',
        'Amount (₹)': e.amount || 0,
        'Status': e.status || 'Pending',
        'Has Bill': e.billUrl ? 'Yes' : 'No'
      });
    });
  });
  if (allFinRows.length > 0) {
    const wsFin = XLSX.utils.json_to_sheet(allFinRows);
    XLSX.utils.book_append_sheet(wb, wsFin, 'All_Finance');
  }

  // Sheet 3: Consolidated Lesson Plans
  const allPlanRows: any[] = [];
  targetData.forEach((c) => {
    c.lessonPlans.forEach((p, idx) => {
      allPlanRows.push({
        'Cluster': c.clusterName,
        'Day': `Day ${p.dayNumber || 1}`,
        'Topic': p.topic || p.title || '—',
        'Team / College': p.teamCollegeName || p.collegeName || '—',
        'Grades': p.grades || p.targetStandard || '—',
        'Status': p.status || 'Draft',
        'Assigned Volunteers': p.assignedVolunteers?.join(', ') || p.volunteerName || '—'
      });
    });
  });
  if (allPlanRows.length > 0) {
    const wsPlans = XLSX.utils.json_to_sheet(allPlanRows);
    XLSX.utils.book_append_sheet(wb, wsPlans, 'All_Lesson_Plans');
  }

  // Sheet 4: Consolidated Students & Volunteers
  const studentRows: any[] = [];
  targetData.forEach((c) => {
    c.students.forEach((s) => {
      studentRows.push({
        'Cluster': c.clusterName,
        'Code': s.code,
        'Name': s.name,
        'Standard': s.standard,
        'Village': s.villageName,
        'School': s.schoolName || 'Govt High School'
      });
    });
  });
  if (studentRows.length > 0) {
    const wsStudents = XLSX.utils.json_to_sheet(studentRows);
    XLSX.utils.book_append_sheet(wb, wsStudents, 'All_Students');
  }

  const filename = isAll
    ? `TQI_Master_Consolidated_All_Clusters.xlsx`
    : `TQI_Cluster_Master_${selectedCluster.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;

  XLSX.writeFile(wb, filename);
}

export function exportSuperAdminConsolidatedPdf(
  clusterDataList: ClusterConsolidationData[],
  selectedCluster = 'all'
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const isAll = selectedCluster === 'all';
  const targetData = isAll
    ? clusterDataList
    : clusterDataList.filter((c) => c.clusterName.toLowerCase() === selectedCluster.toLowerCase());

  const summaryRowsHtml = targetData
    .map((c) => {
      const finTotal = c.financeEntries.reduce((s, e) => s + (e.amount || 0), 0);
      return `<tr>
      <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${c.clusterName}</td>
      <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${c.sessions.length}</td>
      <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${c.lessonPlans.length}</td>
      <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">₹${finTotal.toLocaleString()}</td>
      <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${c.students.length}</td>
      <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${c.volunteers.length}</td>
    </tr>`;
    })
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>TQI Master Consolidated Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #0f172a; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
          .title { font-size: 18px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; }
          .sub { font-size: 12px; font-weight: 700; color: #64748b; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 16px; }
          th { background: #1e293b; color: white; padding: 10px 8px; text-align: left; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">TALENT QUEST FOR INDIA &bull; SUPER ADMIN COMPLETE AUDIT REPORT</div>
          <div class="sub">SCOPE: ${isAll ? 'ALL ACTIVE CLUSTERS' : selectedCluster.toUpperCase()} &bull; GENERATED: ${new Date().toLocaleString('en-IN')}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Cluster Name</th>
              <th style="text-align: center;">Sessions Conducted</th>
              <th style="text-align: center;">Lesson Plans</th>
              <th style="text-align: right;">Total Spent (₹)</th>
              <th style="text-align: center;">Students Enrolled</th>
              <th style="text-align: center;">Mentors Active</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRowsHtml}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
