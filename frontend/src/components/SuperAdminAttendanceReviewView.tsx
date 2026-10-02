import React, { useMemo, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { AttendanceSession, AttendanceRecord, VolunteerAttendanceRecord, Cluster, Panchayat, Session } from '../types';
import { ArrowLeft, Calendar, CheckCircle2, ChevronRight, Download, RotateCcw, Users, X } from './ui/icons';
import { exportSuperAdminAttendanceExcel, triggerFileDownload } from '../utils/exportUtils';
import { AttendanceRosterPdf, type AttendanceDownloadRow } from '../utils/pdf/AttendanceRosterPdf';

interface SuperAdminAttendanceReviewViewProps {
  attendanceSessions: AttendanceSession[];
  clusters: Cluster[];
  panchayats: Panchayat[];
  sessions: Session[];
  subject: 'students' | 'volunteers';
  academicYear?: string;
  onReviewAttendance: (attendanceId: string, action: 'approve' | 'request-resubmission' | 'approve-edit' | 'deny-edit', remarks: string) => Promise<void>;
}

const statusLabel = (status?: string) => {
  if (status === 'Submitted' || status === 'Pending Review') return 'Pending Review';
  if (status === 'Edit Requested') return 'Edit Approval Pending';
  if (status === 'Resubmission') return 'Resubmission Required';
  if (status === 'Edit Approved') return 'Edit Approved';
  if (status === 'Approved') return 'Approved';
  if (status === 'Rejected') return 'Rejected';
  return 'Not Submitted';
};

const statusClass = (status?: string) => {
  const label = statusLabel(status);
  if (label === 'Approved') return 'bg-emerald-50 text-emerald-700';
  if (label === 'Pending Review') return 'bg-amber-50 text-amber-700';
  if (label === 'Resubmission Required' || label === 'Rejected') return 'bg-rose-50 text-rose-700';
  if (label === 'Edit Approval Pending') return 'bg-violet-50 text-violet-700';
  if (label === 'Edit Approved') return 'bg-blue-50 text-blue-700';
  return 'bg-slate-100 text-slate-500';
};

export const SuperAdminAttendanceReviewView: React.FC<SuperAdminAttendanceReviewViewProps> = ({
  attendanceSessions,
  clusters,
  panchayats,
  sessions,
  subject,
  academicYear = '',
  onReviewAttendance,
}) => {
  const [clusterId, setClusterId] = useState('');
  const [dayNumber, setDayNumber] = useState<number | null>(null);
  const [panchayatId, setPanchayatId] = useState('');
  const [villageId, setVillageId] = useState('');
  const [reviewTarget, setReviewTarget] = useState<AttendanceSession | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'request-resubmission' | 'approve-edit' | 'deny-edit'>('approve');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const isVolunteer = subject === 'volunteers';

  const matchingAttendance = useMemo(
    () => attendanceSessions.filter((item) => (item.attendanceType || 'students') === subject),
    [attendanceSessions, subject],
  );
  const clusterDays = useMemo(() => {
    const configured = sessions
      .filter((item) => item.clusterId === clusterId && Number(item.dayNumber) > 0)
      .reduce<Array<{ dayNumber: number; title: string; date: string }>>((days, item) => {
        const number = Number(item.dayNumber);
        if (!days.some((day) => day.dayNumber === number)) {
          days.push({ dayNumber: number, title: item.name || item.title || `Day ${number}`, date: item.date || '' });
        }
        return days;
      }, [])
      .sort((a, b) => a.dayNumber - b.dayNumber);
    const submittedDays = matchingAttendance
      .filter((item) => item.clusterId === clusterId && Number(item.dayNumber) > 0)
      .map((item) => Number(item.dayNumber));
    const allDays = [...new Set([...configured.map((day) => day.dayNumber), ...submittedDays])].sort((a, b) => a - b);
    return allDays.map((number) => {
      const plan = configured.find((day) => day.dayNumber === number);
      const entries = matchingAttendance.filter((item) => item.clusterId === clusterId && Number(item.dayNumber) === number);
      return {
        dayNumber: number,
        title: plan?.title || entries[0]?.sessionName || `Day ${number}`,
        date: plan?.date || entries.find((item) => item.date)?.date || '',
        entries,
      };
    });
  }, [clusterId, matchingAttendance, sessions]);

  const activeCluster = clusters.find((item) => item.id === clusterId);
  const activeDay = clusterDays.find((item) => item.dayNumber === dayNumber);
  const clusterPanchayats = useMemo(
    () => panchayats.filter((item) => item.clusterId === clusterId).sort((a, b) => a.name.localeCompare(b.name)),
    [clusterId, panchayats],
  );
  const activePanchayat = clusterPanchayats.find((item) => item.id === panchayatId);
  const activeVillage = activePanchayat?.villages?.find((item) => item.id === villageId || item.name === villageId);
  const villages = activePanchayat?.villages || [];

  const rowsForLocation = (pId: string, vId?: string) => matchingAttendance.filter((item) =>
    item.clusterId === clusterId && Number(item.dayNumber) === dayNumber && item.panchayatId === pId &&
    (vId === undefined || item.villageId === vId || item.villageName === vId),
  );
  const locationStatus = (entries: AttendanceSession[]) => {
    if (entries.some((item) => item.status === 'Submitted' || item.status === 'Pending Review')) return 'Submitted';
    if (entries.some((item) => item.status === 'Edit Requested')) return 'Edit Requested';
    if (entries.some((item) => item.status === 'Resubmission')) return 'Resubmission';
    if (entries.some((item) => item.status === 'Approved')) return 'Approved';
    return entries[0]?.status;
  };
  const goBack = () => {
    if (villageId) setVillageId('');
    else if (panchayatId) setPanchayatId('');
    else if (dayNumber !== null) setDayNumber(null);
    else if (clusterId) setClusterId('');
  };

  const submitReview = async () => {
    if (!reviewTarget || (['request-resubmission', 'deny-edit'].includes(reviewAction) && !remarks.trim())) return;
    setSaving(true);
    setReviewError('');
    try {
      await onReviewAttendance(reviewTarget.id, reviewAction, remarks.trim());
      setReviewTarget(null);
      setRemarks('');
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'Unable to save the review.');
    } finally {
      setSaving(false);
    }
  };

  const reviewCard = (entries: AttendanceSession[]) => {
    const pending = entries.find((entry) => entry.status === 'Submitted' || entry.status === 'Pending Review');
    const editRequest = entries.find((entry) => entry.status === 'Edit Requested');
    const correction = entries.find((entry) => entry.status === 'Resubmission');
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(locationStatus(entries))}`}>
          {statusLabel(locationStatus(entries))}
        </span>
        {pending && <button type="button" onClick={(event) => { event.stopPropagation(); setReviewTarget(pending); setReviewAction('approve'); setRemarks(''); }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Approve</button>}
        {pending && <button type="button" onClick={(event) => { event.stopPropagation(); setReviewTarget(pending); setReviewAction('request-resubmission'); setRemarks(''); }} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"><RotateCcw className="h-3.5 w-3.5" /> Request Resubmission</button>}
        {editRequest && <button type="button" onClick={(event) => { event.stopPropagation(); setReviewTarget(editRequest); setReviewAction('approve-edit'); setRemarks(''); }} className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-800">Grant Edit Access</button>}
        {editRequest && <button type="button" onClick={(event) => { event.stopPropagation(); setReviewTarget(editRequest); setReviewAction('deny-edit'); setRemarks(''); }} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50">Deny Edit Request</button>}
        {editRequest?.editReason && <p className="basis-full text-xs text-violet-700">Edit request: {editRequest.editReason}</p>}
        {correction?.reviewRemarks && <p className="basis-full text-xs text-rose-700">Resubmission reason: {correction.reviewRemarks}</p>}
      </div>
    );
  };

  const selectedAttendance = isVolunteer
    ? activeDay?.entries || []
    : villageId ? rowsForLocation(panchayatId, villageId) : [];
  const roster = selectedAttendance[0];
  const studentRecords = (roster?.records || []) as AttendanceRecord[];
  const volunteerRecords = (roster?.volunteerAttendance || []) as VolunteerAttendanceRecord[];
  const presentCount = isVolunteer
    ? volunteerRecords.filter((record) => record.status === 'Present').length
    : studentRecords.filter((record) => record.status === 'Present').length;
  const absentCount = isVolunteer
    ? volunteerRecords.filter((record) => record.status === 'Absent').length
    : studentRecords.filter((record) => record.status === 'Absent').length;

  const selectedScopeAttendance = matchingAttendance.filter((entry) =>
    (!clusterId || entry.clusterId === clusterId) &&
    (dayNumber === null || Number(entry.dayNumber) === dayNumber) &&
    (!panchayatId || entry.panchayatId === panchayatId) &&
    (!villageId || entry.villageId === villageId || entry.villageName === villageId)
  );
  const scopeDates = [...new Set(selectedScopeAttendance.map((entry) => entry.date).filter(Boolean))];
  const scopeDateLabel = scopeDates.length === 1 ? scopeDates[0] : scopeDates.length > 1 ? 'Multiple Dates' : '—';
  const selectedScopeLabel = isVolunteer
    ? [activeCluster?.name || (!clusterId ? 'All Clusters' : 'Cluster'), dayNumber === null ? 'All Days' : `Day ${dayNumber}`, scopeDateLabel].join('_')
    : [activeCluster?.name || (!clusterId ? 'All Clusters' : 'Cluster'), dayNumber === null ? 'All Days' : `Day ${dayNumber}`, activePanchayat?.name || (!panchayatId ? 'All Panchayats' : ''), activeVillage?.name || (!villageId ? 'All Villages' : ''), scopeDateLabel].filter(Boolean).join('_');
  const selectedScopeRowMap = new Map<string, { row: AttendanceDownloadRow; locationPriority: number; statusPriority: number }>();
  selectedScopeAttendance.forEach((entry) => {
    const entryCluster = clusters.find((cluster) => cluster.id === entry.clusterId)?.name || entry.clusterName || entry.clusterId;
    const entryPanchayat = panchayats.find((item) => item.id === entry.panchayatId)?.name || entry.panchayatName || 'All Panchayats';
    const base = { cluster: entryCluster, panchayat: entryPanchayat, village: entry.villageName || 'All Villages' };
    const locationPriority = entry.villageId || (entry.villageName && entry.villageName !== 'All Villages') ? 3 : entry.panchayatId ? 2 : 1;
    const statusPriority = entry.status === 'Approved' ? 3 : ['Submitted', 'Pending Review', 'Resubmission'].includes(entry.status) ? 2 : 1;
    if (isVolunteer) {
      ((entry.volunteerAttendance || []) as VolunteerAttendanceRecord[]).forEach((record) => {
        const key = `${entry.clusterId}:${entry.dayNumber}:${record.volunteerId || record.volunteerName.trim().toLowerCase()}`;
        const candidate = {
          row: { ...base, name: record.volunteerName, role: record.role || 'Volunteer', attendance: record.status, day: `Day ${entry.dayNumber}`, date: entry.date || '—' },
          locationPriority,
          statusPriority,
        };
        const current = selectedScopeRowMap.get(key);
        if (!current || candidate.locationPriority > current.locationPriority || (candidate.locationPriority === current.locationPriority && candidate.statusPriority > current.statusPriority)) {
          selectedScopeRowMap.set(key, candidate);
        }
      });
      return;
    }
    ((entry.records || []) as AttendanceRecord[]).forEach((record) => {
      const identity = record.studentId || record.studentName.trim().toLowerCase();
      const key = `${entry.clusterId}:${entry.dayNumber}:${identity}`;
      const candidate = {
        row: { ...base, name: record.studentName, standard: record.standard || '—', attendance: record.status, taskStatus: record.taskStatus || '—', day: `Day ${entry.dayNumber}`, date: entry.date || '—' },
        locationPriority,
        statusPriority,
      };
      const current = selectedScopeRowMap.get(key);
      if (!current || candidate.locationPriority > current.locationPriority || (candidate.locationPriority === current.locationPriority && candidate.statusPriority > current.statusPriority)) {
        selectedScopeRowMap.set(key, candidate);
      }
    });
  });
  const selectedScopeRows: AttendanceDownloadRow[] = [...selectedScopeRowMap.values()].map(({ row }) => row);

  const handleExportAttendanceExcel = () => {
    exportSuperAdminAttendanceExcel(selectedScopeRows.map((row) => ({
      name: row.name,
      cluster: row.cluster || '—',
      panchayat: row.panchayat || '—',
      village: row.village,
      standard: row.standard,
      role: row.role,
      attendance: row.attendance,
      taskStatus: row.taskStatus,
      day: row.day,
      date: row.date,
    })), {
      subject,
      academicYear: academicYear || '—',
      scope: selectedScopeLabel.replace(/_/g, ' · '),
    });
  };

  const handleDownloadAttendancePdf = async () => {
    if (!selectedScopeRows.length) return;
    setIsExportingPdf(true);
    try {
      let logoDataUrl: string | undefined;
      try {
        const logoResponse = await fetch('/logo.png');
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob();
          logoDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(logoBlob);
          });
        }
      } catch {
        // The organization name remains in the document without an embedded logo.
      }
      const pdfContext = {
        kind: subject,
        academicYear: academicYear || '—',
        cluster: activeCluster?.name || (clusterId ? 'Cluster' : 'All Clusters'),
        panchayat: activePanchayat?.name || (panchayatId ? 'Panchayat' : 'All Panchayats'),
        village: activeVillage?.name || (villageId ? 'Village' : 'All Villages'),
        day: dayNumber === null ? 'All Days' : `Day ${dayNumber}`,
        date: scopeDateLabel,
        standard: isVolunteer ? undefined : 'All Standards',
        logoDataUrl,
      } as const;
      const pdfDocument = React.createElement(AttendanceRosterPdf, { rows: selectedScopeRows, context: pdfContext }) as unknown as Parameters<typeof pdf>[0];
      const blob = await pdf(pdfDocument).toBlob();
      const safeScope = selectedScopeLabel.replace(/[^a-zA-Z0-9_-]+/g, '_');
      triggerFileDownload(blob, `TQI_${isVolunteer ? 'Volunteer' : 'Student'}_Attendance_${safeScope}.pdf`);
    } catch (error) {
      console.error('Unable to generate Super Admin attendance PDF:', error);
      alert('Unable to generate attendance PDF. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold text-primary">Super Admin · {isVolunteer ? 'Volunteer' : 'Student'} Attendance Review</div>
          <h1 className="mt-1 text-2xl font-bold text-foreground">{isVolunteer ? 'Volunteer Attendance Review' : 'Student Attendance Review'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{isVolunteer ? 'Review volunteer submissions by cluster and academic day.' : 'Review student submissions by cluster, academic day, panchayat, and village.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <button type="button" onClick={handleExportAttendanceExcel} disabled={!selectedScopeRows.length} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-40"><Download className="h-4 w-4" />Excel · {selectedScopeLabel.replace(/_/g, ' · ')}</button>
          <button type="button" onClick={() => void handleDownloadAttendancePdf()} disabled={!selectedScopeRows.length || isExportingPdf} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"><Download className="h-4 w-4" />{isExportingPdf ? 'Preparing PDF…' : 'PDF · Current View'}</button>
          {clusterId && <button type="button" onClick={goBack} className="inline-flex items-center gap-1.5 self-start rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"><ArrowLeft className="h-4 w-4" /> Back</button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <button type="button" onClick={() => { setClusterId(''); setDayNumber(null); setPanchayatId(''); setVillageId(''); }} className="hover:text-primary">Clusters</button>
        {activeCluster && <><ChevronRight className="h-3 w-3" /><button type="button" onClick={() => { setDayNumber(null); setPanchayatId(''); setVillageId(''); }} className="hover:text-primary">{activeCluster.name}</button></>}
        {activeDay && <><ChevronRight className="h-3 w-3" /><button type="button" onClick={() => { setPanchayatId(''); setVillageId(''); }} className="hover:text-primary">Day {activeDay.dayNumber}</button></>}
        {!isVolunteer && activePanchayat && <><ChevronRight className="h-3 w-3" /><button type="button" onClick={() => setVillageId('')} className="hover:text-primary">{activePanchayat.name}</button></>}
        {!isVolunteer && activeVillage && <><ChevronRight className="h-3 w-3" /><span className="font-semibold text-foreground">{activeVillage.name}</span></>}
      </div>

      {!clusterId && <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {clusters.map((cluster) => {
          const entries = matchingAttendance.filter((item) => item.clusterId === cluster.id);
          const pending = entries.filter((item) => item.status === 'Submitted' || item.status === 'Pending Review' || item.status === 'Edit Requested').length;
          return <button key={cluster.id} type="button" onClick={() => setClusterId(cluster.id)} className="rounded-2xl border border-border bg-card p-5 text-left shadow-xs transition hover:border-primary/50 hover:shadow-md">
            <div className="flex items-start justify-between"><div><h2 className="font-bold text-foreground">{cluster.name}</h2><p className="mt-1 text-xs text-muted-foreground">{cluster.district || 'Cluster'}</p></div><Users className="h-5 w-5 text-primary" /></div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs"><span>{new Set(entries.map((item) => item.dayNumber)).size} days · {entries.length} submissions</span><span className={pending ? 'font-semibold text-amber-700' : 'text-muted-foreground'}>{pending} pending</span></div>
            <div className="mt-3 text-xs font-semibold text-primary">View attendance <ChevronRight className="inline h-3 w-3" /></div>
          </button>;
        })}
        {!clusters.length && <p className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No clusters are available for this academic year.</p>}
      </section>}

      {clusterId && dayNumber === null && <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {clusterDays.map((day) => {
          const pending = day.entries.filter((item) => item.status === 'Submitted' || item.status === 'Pending Review' || item.status === 'Edit Requested').length;
          return <button key={day.dayNumber} type="button" onClick={() => setDayNumber(day.dayNumber)} className="rounded-2xl border border-border bg-card p-5 text-left shadow-xs transition hover:border-primary/50 hover:shadow-md">
            <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"><Calendar className="h-3.5 w-3.5" /> Day {day.dayNumber}</span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass(locationStatus(day.entries))}`}>{pending ? `${pending} Pending` : statusLabel(locationStatus(day.entries))}</span></div>
            <h2 className="mt-3 font-bold text-foreground">{day.title}</h2><p className="mt-1 text-xs text-muted-foreground">{day.date || 'Date not set in Academic Setup'}</p>
            <p className="mt-4 border-t border-border pt-3 text-xs font-semibold text-primary">{isVolunteer ? 'View volunteer attendance' : 'View panchayats'} <ChevronRight className="inline h-3 w-3" /></p>
          </button>;
        })}
        {!clusterDays.length && <p className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No programme days are configured in Academic Setup for this cluster.</p>}
      </section>}

      {clusterId && dayNumber !== null && !panchayatId && !isVolunteer && <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Day {dayNumber} · Panchayats in {activeCluster?.name}</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {clusterPanchayats.map((panchayat, index) => {
            const entries = rowsForLocation(panchayat.id);
            const submitted = entries.length;
            const villagesSubmitted = new Set(entries.map((item) => item.villageId || item.villageName)).size;
            const allVillagesEntry = entries.find((item) => !item.villageId && item.villageName === 'All Villages');
            return <div key={panchayat.id} className="flex w-full items-center justify-between gap-4 border-b border-border p-4 last:border-0 hover:bg-muted/30">
              <button type="button" onClick={() => setPanchayatId(panchayat.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span><span><strong className="block text-sm text-foreground">{panchayat.name}</strong><span className="text-xs text-muted-foreground">{panchayat.villages?.length || 0} villages · {villagesSubmitted} submitted</span></span></button>
              <span className="flex items-center gap-3">{allVillagesEntry ? reviewCard([allVillagesEntry]) : <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(locationStatus(entries))}`}>{statusLabel(locationStatus(entries))}</span>}<button type="button" onClick={() => setPanchayatId(panchayat.id)} aria-label={`Open ${panchayat.name}`} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><ChevronRight className="h-4 w-4 shrink-0" /></button></span>
            </div>;
          })}
          {!clusterPanchayats.length && <p className="p-8 text-center text-sm text-muted-foreground">No panchayats are configured for this cluster.</p>}
        </div>
      </section>}

      {clusterId && dayNumber !== null && isVolunteer && <section className="space-y-3">
        <div><h2 className="text-lg font-bold text-foreground">Day {dayNumber} · Volunteer attendance</h2><p className="text-xs text-muted-foreground">{activeCluster?.name} · no panchayat or village filtering for volunteer records</p></div>
        {selectedAttendance.map((entry) => {
          const records = (entry.volunteerAttendance || []) as VolunteerAttendanceRecord[];
          return <div key={entry.id} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <div><h3 className="font-bold text-foreground">{entry.sessionName || `Day ${dayNumber} Attendance`}</h3><p className="mt-1 text-xs text-muted-foreground">{entry.presentCount || 0} present / {entry.totalCount || records.length} volunteers</p></div>
              {reviewCard([entry])}
            </div>
            <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-muted/50 text-muted-foreground"><tr><th className="p-3">S.No</th><th className="p-3">Volunteer Name</th><th className="p-3">Role</th><th className="p-3">Attendance</th></tr></thead><tbody className="divide-y divide-border">
              {records.map((record, index) => <tr key={record.volunteerId}><td className="p-3 tabular-nums text-muted-foreground">{index + 1}</td><td className="p-3 font-semibold text-foreground">{record.volunteerName}</td><td className="p-3">{record.role || 'Volunteer'}</td><td className={`p-3 font-semibold ${record.status === 'Present' ? 'text-emerald-700' : 'text-rose-700'}`}>{record.status}</td></tr>)}
              {!records.length && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No volunteer attendance rows were submitted.</td></tr>}
            </tbody></table></div>
          </div>;
        })}
        {!selectedAttendance.length && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No volunteer attendance has been submitted for this day.</div>}
      </section>}

      {panchayatId && !villageId && <section className="space-y-3">
        <div><h2 className="text-lg font-bold text-foreground">Villages · {activePanchayat?.name}</h2><p className="text-xs text-muted-foreground">Day {dayNumber} · {activeDay?.title}</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {villages.map((village) => {
            const entries = rowsForLocation(panchayatId, village.id || village.name);
            return <div key={village.id || village.name} className="rounded-2xl border border-border bg-card p-4 text-left shadow-xs hover:border-primary/50">
              <button type="button" onClick={() => setVillageId(village.id || village.name)} className="w-full text-left">
                <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-foreground">{village.name}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass(locationStatus(entries))}`}>{statusLabel(locationStatus(entries))}</span></div>
                <div className="mt-3 text-xs text-muted-foreground">{entries[0] ? `${entries[0].presentCount || 0} present / ${entries[0].totalCount || 0} total` : 'No attendance submission yet'}</div>
                <div className="mt-3 text-xs font-semibold text-primary">View {isVolunteer ? 'volunteer' : 'student'} attendance <ChevronRight className="inline h-3 w-3" /></div>
              </button>
              {entries.length > 0 && <div className="mt-3 border-t border-border pt-3">{reviewCard(entries)}</div>}
            </div>;
          })}
          {!villages.length && <p className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No villages are configured for this panchayat.</p>}
        </div>
      </section>}

      {villageId && <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Total {isVolunteer ? 'Volunteers' : 'Students'}</p><p className="mt-1 text-xl font-bold">{roster?.totalCount || (isVolunteer ? volunteerRecords.length : studentRecords.length)}</p></div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs text-emerald-700">Present</p><p className="mt-1 text-xl font-bold text-emerald-800">{roster?.presentCount ?? presentCount}</p></div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4"><p className="text-xs text-rose-700">Absent</p><p className="mt-1 text-xl font-bold text-rose-800">{roster?.absentCount ?? absentCount}</p></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <div><h2 className="font-bold text-foreground">{activeVillage?.name || roster?.villageName || 'Village'} · Day {dayNumber}</h2><p className="text-xs text-muted-foreground">{activePanchayat?.name} · {activeCluster?.name} · {activeDay?.title}</p></div>
          {reviewCard(selectedAttendance)}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-xs"><thead className="bg-muted/50 text-muted-foreground"><tr><th className="p-3">S.No</th><th className="p-3">Name</th><th className="p-3">{isVolunteer ? 'Role' : 'Standard'}</th><th className="p-3">Attendance</th>{!isVolunteer && <th className="p-3">Task</th>}</tr></thead><tbody className="divide-y divide-border">
            {isVolunteer ? volunteerRecords.map((record, index) => <tr key={record.volunteerId}><td className="p-3 tabular-nums text-muted-foreground">{index + 1}</td><td className="p-3 font-semibold text-foreground">{record.volunteerName}</td><td className="p-3">{record.role || 'Volunteer'}</td><td className="p-3"><span className={record.status === 'Present' ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>{record.status}</span></td></tr>) : studentRecords.map((record, index) => <tr key={record.studentId}><td className="p-3 tabular-nums text-muted-foreground">{index + 1}</td><td className="p-3 font-semibold text-foreground">{record.studentName}</td><td className="p-3">{record.standard || '—'}</td><td className="p-3"><span className={record.status === 'Present' ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>{record.status}</span></td><td className="p-3">{record.taskStatus || '—'}</td></tr>)}
            {!studentRecords.length && !volunteerRecords.length && <tr><td colSpan={isVolunteer ? 4 : 5} className="p-10 text-center text-muted-foreground">No attendance details have been submitted for this day.</td></tr>}
          </tbody></table>
        </div>
      </section>}

      {reviewTarget && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between"><div><h3 className="text-lg font-bold text-slate-900">{reviewAction === 'approve' ? 'Approve Attendance' : reviewAction === 'request-resubmission' ? 'Request Resubmission' : reviewAction === 'approve-edit' ? 'Grant Edit Permission' : 'Deny Edit Request'}</h3><p className="mt-1 text-xs text-slate-500">{reviewTarget.panchayatName} · {reviewTarget.villageName} · Day {reviewTarget.dayNumber}</p></div><button type="button" onClick={() => setReviewTarget(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
          {['request-resubmission', 'deny-edit'].includes(reviewAction) && <label className="mt-4 block text-xs font-semibold text-slate-700">{reviewAction === 'deny-edit' ? 'Reason for denying edit permission' : 'Reason for resubmission'}<textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={4} required className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-primary" placeholder={reviewAction === 'deny-edit' ? 'Explain why the request is denied' : 'Explain what the cluster admin needs to correct'} /></label>}
          {reviewAction === 'approve' && <p className="mt-4 text-sm text-slate-600">Confirm that this attendance submission is complete and correct.</p>}
          {reviewAction === 'approve-edit' && <p className="mt-4 text-sm text-slate-600">The Cluster Admin will be allowed to edit and resubmit this locked attendance.</p>}
          {reviewError && <p role="alert" className="mt-3 text-xs font-medium text-rose-700">{reviewError}</p>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setReviewTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700">Cancel</button><button type="button" onClick={() => void submitReview()} disabled={saving || (['request-resubmission', 'deny-edit'].includes(reviewAction) && !remarks.trim())} className={`rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${reviewAction === 'approve' || reviewAction === 'approve-edit' ? 'bg-emerald-600' : 'bg-rose-600'}`}>{saving ? 'Saving…' : reviewAction === 'approve' ? 'Approve Attendance' : reviewAction === 'request-resubmission' ? 'Send Resubmission Request' : reviewAction === 'approve-edit' ? 'Grant Edit Access' : 'Deny Edit Request'}</button></div>
        </div>
      </div>}
    </div>
  );
};
