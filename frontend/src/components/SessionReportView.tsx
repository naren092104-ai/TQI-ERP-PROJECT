import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock, Download, Edit3 as Edit, Eye, FileText, Plus, Search, Send, Trash2, Upload, X } from './ui/icons';
import type { AcademicYear, LessonPlan, Panchayat, SessionReport, SessionReportActivity, SessionReportPhoto, Session, UserRole, Volunteer } from '../types';
import { apiUrl } from '../utils/api';
import { exportSessionReportPdf } from '../utils/pdf/SessionReportPdf';

interface SessionReportContext {
  session: { id: string; name: string; dayNumber: number | null; date: string | null; status: string };
  academicYear: { id: string; name: string; status: string };
  cluster: { id: string; name: string };
  collegeName: string;
  panchayat: { id: string; name: string } | null;
  village: { id: string; name: string } | null;
  villages: Array<{ id: string; name: string }>;
  summitNumbers: string[];
  grades: string[];
  volunteers: Array<{ id: string; name: string; phone: string; year: string }>;
  reportDefaults?: {
    villageIds: string[];
    grade: string;
    summitNumbers: string[];
    volunteerNames: string[];
    overview: string;
    activities: SessionReportActivity[];
    outcome: string;
  };
  activities: SessionReportActivity[];
  attendance: { available: boolean; presentCount: number; totalCount: number };
}

interface SessionReportViewProps {
  sessionReports: SessionReport[];
  lessonPlans: LessonPlan[];
  panchayats: Panchayat[];
  volunteers: Volunteer[];
  sessions: Session[];
  clusters: { id: string; name: string; district?: string }[];
  currentUserRole: UserRole;
  currentUserClusterId: string;
  authToken: string;
  academicYears: AcademicYear[];
  selectedAcademicYearId: string;
  onSaveReport: (report: Partial<SessionReport>) => Promise<SessionReport>;
  onReportPhotosUpdate: (reportId: string, photos: SessionReportPhoto[]) => void;
  onDeleteReport: (reportId: string) => Promise<void>;
  onWorkflowUpdate: (reportId: string, status: string, fields?: Partial<SessionReport>) => void;
}

type WorkflowAction = 'approve' | 'send_correction' | 'request_edit' | 'request_delete' | 'allow_edit' | 'deny_edit' | 'approve_delete' | 'deny_delete';
type WorkflowDialog = { action: WorkflowAction; report: SessionReport } | null;

const statusText: Record<string, string> = {
  DRAFT: 'Draft', SUBMITTED: 'Submitted', APPROVED: 'Approved', CORRECTIONS_REQUIRED: 'Corrections Required',
  EDIT_REQUEST_PENDING: 'Edit Request Pending', DELETE_REQUEST_PENDING: 'Delete Request Pending',
};
const statusColors: Record<string, string> = {
  DRAFT: 'bg-amber-50 text-amber-800 border-amber-200',
  SUBMITTED: 'bg-blue-50 text-blue-800 border-blue-200',
  APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  CORRECTIONS_REQUIRED: 'bg-rose-50 text-rose-800 border-rose-200',
  EDIT_REQUEST_PENDING: 'bg-orange-50 text-orange-800 border-orange-200',
  DELETE_REQUEST_PENDING: 'bg-orange-50 text-orange-800 border-orange-200',
};
const parseActivities = (value?: string): SessionReportActivity[] => {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((item: any) => ({ topic: String(item?.topic || ''), details: String(item?.details || '') }));
  } catch { /* legacy plain text */ }
  return [{ topic: 'Session activities', details: value }];
};

const ProtectedReportPhoto: React.FC<{ photo: SessionReportPhoto; authToken: string; className?: string }> = ({ photo, authToken, className }) => {
  const [src, setSrc] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    void fetch(apiUrl(photo.fileUrl), { signal: controller.signal, headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} })
      .then(async (response) => { if (!response.ok) return; objectUrl = URL.createObjectURL(await response.blob()); if (!controller.signal.aborted) setSrc(objectUrl); })
      .catch(() => undefined);
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photo.fileUrl, authToken]);
  return src ? <img src={src} alt={photo.originalFilename} className={className || 'h-full w-full object-cover'} /> : <div className="flex h-full items-center justify-center text-xs text-slate-400">Loading photo…</div>;
};

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>{children}</label>
);
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const MultiSelectField: React.FC<{
  label: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (selected: string[]) => void;
}> = ({ label, placeholder, options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const fieldRef = React.useRef<HTMLDivElement>(null);
  const selectedLabels = options.filter((option) => selected.includes(option.value)).map((option) => option.label);
  const sortedOptions = [...options].sort((first, second) => Number(selected.includes(second.value)) - Number(selected.includes(first.value)));

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !fieldRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [isOpen]);

  return <div ref={fieldRef} className="relative min-w-0">
    <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
    <div className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)} className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-left">
        {selectedLabels.length ? selectedLabels.map((selectedLabel, index) => <span key={`${selectedLabel}-${index}`} className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-900"><span className="truncate">{selectedLabel}</span><span className="text-blue-500">✓</span></span>) : <span className="text-slate-500">{placeholder}</span>}
      </button>
      <button type="button" aria-label={`Toggle ${label} options`} aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)} className="shrink-0 px-1 text-slate-400">{isOpen ? '⌃' : '⌄'}</button>
    </div>
    {isOpen && <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
      {selected.length > 0 && <div className="mb-1 border-b border-slate-100 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Selected · {selected.length}</div>}
      {sortedOptions.length ? sortedOptions.map((option) => <label key={option.value} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-blue-50 ${selected.includes(option.value) ? 'font-semibold text-blue-900' : 'text-slate-700'}`}>
        <input type="checkbox" checked={selected.includes(option.value)} onChange={(event) => onChange(event.target.checked ? [...selected, option.value] : selected.filter((value) => value !== option.value))} className="h-4 w-4 rounded border-slate-300 accent-blue-700" />
        <span>{option.label}</span>
      </label>) : <p className="px-3 py-2 text-xs text-slate-500">No options available.</p>}
    </div>}
  </div>;
};

export const SessionReportView: React.FC<SessionReportViewProps> = ({
  sessionReports, lessonPlans = [], panchayats = [], volunteers = [], sessions, clusters, currentUserRole, currentUserClusterId, authToken,
  academicYears, selectedAcademicYearId, onSaveReport, onReportPhotosUpdate, onDeleteReport, onWorkflowUpdate,
}) => {
  const isSuperAdmin = currentUserRole === 'Super Admin';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [clusterFilter, setClusterFilter] = useState('ALL');
  const [villageFilter, setVillageFilter] = useState('ALL');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [dayFilter, setDayFilter] = useState('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [viewReport, setViewReport] = useState<SessionReport | null>(null);
  const [formReport, setFormReport] = useState<Partial<SessionReport>>({});
  const [formContext, setFormContext] = useState<SessionReportContext | null>(null);
  const [viewContext, setViewContext] = useState<SessionReportContext | null>(null);
  const [activities, setActivities] = useState<SessionReportActivity[]>([{ topic: '', details: '' }]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [selectedVolunteers, setSelectedVolunteers] = useState<string[]>([]);
  const [selectedVillages, setSelectedVillages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [workflowDialog, setWorkflowDialog] = useState<WorkflowDialog>(null);
  const [workflowReason, setWorkflowReason] = useState('');
  const [workflowError, setWorkflowError] = useState('');
  const [pdfBusyId, setPdfBusyId] = useState('');

  useEffect(() => {
    const urls = photoFiles.map((file) => URL.createObjectURL(file));
    setPhotoUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photoFiles]);

  const availableSessions = useMemo(() => sessions.filter((session) => Boolean(session.hasSavedSchedule)
    && (currentUserClusterId === 'all' || session.clusterId === currentUserClusterId)
    && (!selectedAcademicYearId || !session.academicYearId || session.academicYearId === selectedAcademicYearId)),
  [sessions, currentUserClusterId, selectedAcademicYearId]);
  const scheduledSessionsByDay = useMemo(() => {
    const grouped = new Map<number, Session[]>();
    availableSessions.forEach((session) => {
      const dayNumber = Number(session.dayNumber);
      if (!Number.isInteger(dayNumber) || dayNumber < 1) return;
      grouped.set(dayNumber, [...(grouped.get(dayNumber) || []), session]);
    });
    return grouped;
  }, [availableSessions]);
  const reportDayNumbers = useMemo(() => Array.from(
    { length: Math.max(8, ...scheduledSessionsByDay.keys()) },
    (_, index) => index + 1,
  ), [scheduledSessionsByDay]);

  useEffect(() => {
    let active = true;
    if (!viewReport) { setViewContext(null); return; }
    void loadContext(viewReport.sessionId).then((context) => { if (active) setViewContext(context); }).catch(() => { if (active) setViewContext(null); });
    return () => { active = false; };
  }, [viewReport?.sessionId, authToken, selectedAcademicYearId]);

  const loadContext = async (sessionId: string) => {
    const response = await fetch(apiUrl(`/api/session-reports/context?sessionId=${encodeURIComponent(sessionId)}`), {
      cache: 'no-store', headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success || !payload.context) throw new Error(payload?.error || 'Unable to load session configuration.');
    if (payload.context.academicYear.id !== selectedAcademicYearId) throw new Error('This session does not match the selected academic year.');
    return payload.context as SessionReportContext;
  };

  const openForm = async (report?: SessionReport, sessionId?: string) => {
    if (isSuperAdmin) return;
    setError(''); setFormContext(null); setPhotoFiles([]); setSelectedVillages(report?.villageIds || []);
    setSelectedVolunteers(report?.volunteerNames || []);
    setActivities(report ? parseActivities(report.activities) : [{ topic: '', details: '' }]);
    const nextForm: Partial<SessionReport> = report ? { ...report } : {
      sessionId: sessionId || (availableSessions.length === 1 ? availableSessions[0].id : ''), sessionSummary: '', outcome: '', issues: '', remarks: '',
      summitNumber: '', grade: '', villageIds: [], volunteerNames: [],
    };
    setFormReport(nextForm); setFormOpen(true);
    if (nextForm.sessionId) {
      try {
        const context = await loadContext(nextForm.sessionId);
        const sameDayPlans = lessonPlans.filter((plan) => Number(plan.dayNumber) === Number(context.session.dayNumber)
          && (!plan.clusterId || plan.clusterId === context.cluster.id));
        const matchingPlan = sameDayPlans.find((plan) => plan.sessionId === context.session.id && plan.status === 'Approved')
          || sameDayPlans.find((plan) => plan.sessionId === context.session.id)
          || sameDayPlans.find((plan) => plan.status === 'Approved')
          || sameDayPlans.find((plan) => plan.academicYear?.replace(/[–—]/g, '-').replace(/\s/g, '') === context.academicYear.name.replace(/[–—]/g, '-').replace(/\s/g, ''))
          || sameDayPlans[0];
        const planVillageNames = matchingPlan?.villagesList?.length
          ? matchingPlan.villagesList
          : String(matchingPlan?.villageName || '').split(',').map((name) => name.trim()).filter(Boolean);
        const plannedVillageIds = matchingPlan?.villageIds?.length
          ? matchingPlan.villageIds
          : planVillageNames.map((name) => context.villages.find((village) => village.name.trim().toLowerCase() === name.toLowerCase())?.id).filter((id): id is string => Boolean(id));
        const defaultVillageIds = plannedVillageIds.length ? plannedVillageIds : context.reportDefaults?.villageIds || [];
        const plannedGradeValues = (matchingPlan?.gradesList?.length
          ? matchingPlan.gradesList
          : String(context.reportDefaults?.grade || matchingPlan?.grades || matchingPlan?.targetStandard || '').split(','))
          .map((grade) => String(grade).trim())
          .filter((grade) => ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].includes(grade));
        const plannedGrade = plannedGradeValues.join(', ');
        const planVolunteerNames = [...new Set([
          ...(matchingPlan?.volunteerRoster?.map((volunteer) => volunteer.name).filter(Boolean) || []),
          ...(matchingPlan?.assignedVolunteers?.filter(Boolean) || []),
          ...(matchingPlan?.volunteerIds || [])
            .map((volunteerId) => volunteers.find((volunteer) => volunteer.id === volunteerId)?.name)
            .filter((name): name is string => Boolean(name)),
        ])];
        const plannedVolunteerNames = [...new Set([
          ...planVolunteerNames,
          ...(context.reportDefaults?.volunteerNames || []),
        ])];
        const plannedSummitValues = (matchingPlan?.summitNumbersList?.length
          ? matchingPlan.summitNumbersList
          : String(context.reportDefaults?.summitNumbers?.join(', ') || matchingPlan?.summitNumbers || '').split(','))
          .map((summit) => String(summit).trim().replace(/^Summit\s+/i, ''))
          .filter((summit) => ['I', 'II', 'III', 'IV'].includes(summit));
        const plannedSummitNumber = plannedSummitValues.join(', ');
        const additionalVillages = defaultVillageIds.map((id, index) => ({
          id,
          name: context.villages.find((village) => village.id === id)?.name || planVillageNames[index] || 'Village',
        }));
        const clusterVillages = panchayats
          .filter((panchayat) => !panchayat.clusterId || panchayat.clusterId === context.cluster.id)
          .flatMap((panchayat) => panchayat.villages.map((village) => ({ id: village.id, name: village.name })));
        const allVillageOptions = [...new Map([...context.villages, ...clusterVillages, ...additionalVillages].map((village) => [village.id, village])).values()];
        const planDefaultVillageIds = defaultVillageIds.length ? defaultVillageIds : planVillageNames
          .map((name) => allVillageOptions.find((village) => village.name.trim().toLowerCase() === name.toLowerCase())?.id)
          .filter((id): id is string => Boolean(id));
        const additionalVolunteers = plannedVolunteerNames.map((name, index) => ({
          id: matchingPlan?.volunteerIds?.[index] || `lesson-plan-volunteer-${index}`,
          name,
          phone: matchingPlan?.volunteerRoster?.find((volunteer) => volunteer.name === name)?.phone || '',
          year: matchingPlan?.volunteerRoster?.find((volunteer) => volunteer.name === name)?.year || '',
        }));
        const directoryVolunteers = volunteers
          .filter((volunteer) => volunteer.status !== 'Inactive' && (!volunteer.clusterId || volunteer.clusterId === context.cluster.id))
          .map((volunteer) => ({ id: volunteer.id, name: volunteer.name, phone: volunteer.phone || '', year: volunteer.year || '' }));
        setFormContext({
          ...context,
          villages: allVillageOptions,
          volunteers: [...new Map([...context.volunteers, ...directoryVolunteers, ...additionalVolunteers].map((volunteer) => [volunteer.name.trim().toLowerCase(), volunteer])).values()],
        });
        if (!report) {
          setSelectedVillages(planDefaultVillageIds);
          setSelectedVolunteers(plannedVolunteerNames);
          setFormReport((current) => ({
            ...current,
            summitNumber: current.summitNumber || plannedSummitNumber,
            grade: current.grade || plannedGrade,
            sessionSummary: current.sessionSummary || context.reportDefaults?.overview || matchingPlan?.overview || matchingPlan?.objective || '',
            outcome: current.outcome || context.reportDefaults?.outcome || matchingPlan?.expectedOutcomes?.join('\n') || matchingPlan?.expectedOutcome || '',
          }));
          const defaultActivities = context.reportDefaults?.activities?.length
            ? context.reportDefaults.activities
            : matchingPlan?.activitiesDetailed?.map((activity, index) => ({
              topic: activity.title || `Activity ${index + 1}`,
              details: activity.description || '',
            })) || [];
          if (defaultActivities.length) setActivities(defaultActivities);
        }
      }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load session.'); }
    }
  };

  const saveReport = async (status: 'DRAFT' | 'SUBMITTED'): Promise<string | null> => {
    if (!formReport.sessionId || !formContext) {
      const message = 'Select a scheduled session and wait for its configuration to load.';
      setError(message);
      return message;
    }
    if (status === 'SUBMITTED' && !formReport.sessionSummary?.trim()) {
      const message = 'Please complete the overview before submitting.';
      setError(message);
      return message;
    }
    setSaving(true); setError('');
    try {
      const reportPayload = { ...formReport, sessionId: formContext.session.id, academicYearId: formContext.academicYear.id,
        clusterId: formContext.cluster.id, dayNumber: formContext.session.dayNumber || undefined,
        villageIds: selectedVillages, volunteerNames: selectedVolunteers,
        activities: JSON.stringify(activities) };
      const correcting = formReport.status === 'CORRECTIONS_REQUIRED' && Boolean(formReport.id);
      let saved = correcting
        ? formReport as SessionReport
        : await onSaveReport({ ...reportPayload, status: 'DRAFT' });
      let photos = saved.photos || formReport.photos || [];
      if (photoFiles.length) {
        const body = new FormData();
        photoFiles.forEach((file) => body.append('photos', file));
        const response = await fetch(apiUrl(`/api/session-reports/${encodeURIComponent(saved.id)}/photos`), {
          method: 'POST', headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}, body,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) throw new Error(payload?.error || 'The report saved, but its photos could not be uploaded.');
        photos = [...photos, ...(payload.photos || [])];
        onReportPhotosUpdate(saved.id, photos);
        setFormReport((previous) => ({ ...previous, photos }));
        setPhotoFiles([]);
      }
      if (status === 'SUBMITTED') saved = await onSaveReport({ ...reportPayload, id: saved.id, status: 'SUBMITTED' });
      setFormOpen(false);
      return null;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to save Session Report.';
      setError(message);
      return message;
    }
    finally { setSaving(false); }
  };

  const doWorkflow = async (action: WorkflowAction, report: SessionReport, reason = '') => {
    const response = await fetch(apiUrl(`/api/session-reports/${encodeURIComponent(report.id)}/workflow`), {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ action, reason }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to update Session Report.');
    if (payload.deleted) onWorkflowUpdate(report.id, 'DELETED');
    else onWorkflowUpdate(report.id, payload.status, action === 'send_correction'
      ? { correctionReason: reason }
      : action === 'request_edit' ? { editRequestReason: reason }
        : action === 'request_delete' ? { deleteRequestReason: reason }
          : action === 'allow_edit' ? { correctionReason: `Edit access approved: ${report.editRequestReason || ''}` } : {});
    setWorkflowDialog(null); setWorkflowReason(''); setWorkflowError('');
  };

  const deleteDraft = async (report: SessionReport) => {
    if (!window.confirm('Delete this draft Session Report? This action cannot be undone.')) return;
    try { await onDeleteReport(report.id); } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Unable to delete draft.'); }
  };

  const submitDraft = async (report: SessionReport) => {
    await openForm(report);
    setWorkflowDialog({ action: 'approve', report });
    setWorkflowReason('');
    setWorkflowError('');
  };

  const exportPdf = async (report: SessionReport) => {
    setPdfBusyId(report.id);
    try {
      const context = await loadContext(report.sessionId);
      await exportSessionReportPdf({
        academicYear: context.academicYear.name, cluster: context.cluster.name, team: context.collegeName,
        villages: (report.villageNames?.length ? report.villageNames : context.villages.filter((item) => report.villageIds?.includes(item.id)).map((item) => item.name)),
        summitNumber: report.summitNumber || '', day: `Day ${report.dayNumber || context.session.dayNumber || ''}`,
        grade: report.grade || '', date: context.session.date || '', overview: report.sessionSummary || '',
        detailedSummary: parseActivities(report.activities),
        challenges: report.issues || '', observations: report.observations || '', remarks: report.remarks || '',
        outcome: report.outcome || '', volunteers: (report.volunteerNames || []).map((name) => {
          const volunteer = context.volunteers.find((item) => item.name === name);
          return { name, phone: volunteer?.phone || '', year: volunteer?.year || '' };
        }),
        photos: (report.photos || []).map((photo) => ({ name: photo.originalFilename, dataUrl: apiUrl(photo.fileUrl) })),
      }, authToken);
    } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Unable to export report PDF.'); }
    finally { setPdfBusyId(''); }
  };

  const baseReports = useMemo(() => {
    let list = isSuperAdmin ? sessionReports.filter((report) => report.status !== 'DRAFT') : sessionReports.filter((report) => report.clusterId === currentUserClusterId);
    if (isSuperAdmin && clusterFilter !== 'ALL') list = list.filter((report) => report.clusterId === clusterFilter);
    if (statusFilter !== 'ALL') list = list.filter((report) => report.status === statusFilter);
    if (villageFilter !== 'ALL') list = list.filter((report) => (report.villageNames || []).includes(villageFilter));
    if (gradeFilter !== 'ALL') list = list.filter((report) => report.grade === gradeFilter);
    if (dayFilter !== 'ALL') list = list.filter((report) => String(report.dayNumber || '') === dayFilter);
    const query = search.trim().toLowerCase();
    if (query) list = list.filter((report) => [report.sessionSummary, report.clusterName, report.grade, report.villageNames?.join(' '), report.summitNumber, report.submittedByName]
      .some((value) => String(value || '').toLowerCase().includes(query)));
    return list;
  }, [sessionReports, isSuperAdmin, currentUserClusterId, clusterFilter, statusFilter, villageFilter, gradeFilter, dayFilter, search]);

  const visibleReports = useMemo(() => [...baseReports].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()), [baseReports]);
  const ownReports = isSuperAdmin ? sessionReports.filter((report) => report.status !== 'DRAFT') : sessionReports.filter((report) => report.clusterId === currentUserClusterId);
  const metrics = {
    total: ownReports.length,
    draft: ownReports.filter((report) => report.status === 'DRAFT').length,
    submitted: ownReports.filter((report) => report.status === 'SUBMITTED').length,
    approved: ownReports.filter((report) => report.status === 'APPROVED').length,
    corrections: ownReports.filter((report) => report.status === 'CORRECTIONS_REQUIRED').length,
  };
  const villages = Array.from(new Set(sessionReports.flatMap((report) => report.villageNames || []))).sort();
  const grades = Array.from(new Set(sessionReports.map((report) => report.grade).filter((value): value is string => Boolean(value)))).sort();

  const statusBadge = (status: string) => <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusColors[status] || 'border-slate-200 bg-slate-50 text-slate-700'}`}>{statusText[status] || status}</span>;
  const reportSession = (report: SessionReport) => sessions.find((session) => session.id === report.sessionId);
  const viewButton = (report: SessionReport) => <button onClick={() => setViewReport(report)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Eye size={14} className="mr-1 inline" />View</button>;
  const pdfButton = (report: SessionReport) => <button onClick={() => void exportPdf(report)} disabled={pdfBusyId === report.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Download size={14} className="mr-1 inline" />{pdfBusyId === report.id ? 'Preparing…' : 'Export PDF'}</button>;

  return (
    <div className="space-y-6 pb-6">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-800"><FileText size={21} /></span>
          <div><h1 className="text-xl font-bold text-slate-900">Session Reports</h1><p className="mt-1 text-sm text-slate-500">{isSuperAdmin ? 'Review submitted reports and respond to requests.' : 'Capture session outcomes, observations and evidence.'}</p></div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ['Total Reports', metrics.total, 'bg-blue-50 text-blue-800'], ['Draft', metrics.draft, 'bg-amber-50 text-amber-800'],
          ['Submitted', metrics.submitted, 'bg-sky-50 text-sky-800'], ['Approved', metrics.approved, 'bg-emerald-50 text-emerald-800'],
          ['Corrections Required', metrics.corrections, 'bg-rose-50 text-rose-800'],
        ].map(([label, count, color]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500">{label}</p><p className={`mt-2 inline-flex min-w-9 justify-center rounded-lg px-2 py-1 text-xl font-bold ${color}`}>{count}</p></div>)}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reports" className={`${inputClass} pl-9`} /></label>
          {isSuperAdmin && <select value={clusterFilter} onChange={(event) => setClusterFilter(event.target.value)} className={inputClass}><option value="ALL">All clusters</option>{clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.name}</option>)}</select>}
          <select value={villageFilter} onChange={(event) => setVillageFilter(event.target.value)} className={inputClass}><option value="ALL">All villages</option>{villages.map((village) => <option key={village} value={village}>{village}</option>)}</select>
          <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} className={inputClass}><option value="ALL">All grades</option>{grades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select>
          <select value={dayFilter} onChange={(event) => setDayFilter(event.target.value)} className={inputClass}><option value="ALL">All days</option>{Array.from({ length: 8 }, (_, index) => <option key={index + 1} value={String(index + 1)}>Day {index + 1}</option>)}</select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}>
            <option value="ALL">All statuses</option>{['DRAFT', 'SUBMITTED', 'CORRECTIONS_REQUIRED', 'APPROVED', 'EDIT_REQUEST_PENDING', 'DELETE_REQUEST_PENDING'].map((status) => <option key={status} value={status}>{statusText[status]}</option>)}
          </select>
        </div>
      </section>

      {!isSuperAdmin && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4"><h2 className="text-sm font-bold text-slate-900">Create a report by day</h2><p className="mt-1 text-xs text-slate-500">Choose a scheduled day to start its Session Report.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {reportDayNumbers.map((dayNumber) => {
            const daySessions = scheduledSessionsByDay.get(dayNumber) || [];
            const dayReports = sessionReports.filter((report) => daySessions.some((session) => session.id === report.sessionId));
            const dayStatus = daySessions.length > 1 ? `${daySessions.length} Sessions` : dayReports[0] ? statusText[dayReports[0].status] || dayReports[0].status : daySessions.length ? 'Not Created' : 'Not Scheduled';
            const badgeClass = dayReports[0] ? statusColors[dayReports[0].status] || 'border-slate-200 bg-slate-50 text-slate-700' : daySessions.length ? 'border-blue-100 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-500';
            return <article key={dayNumber} className="flex min-h-[210px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-800"><Calendar size={16} /></span><div><h3 className="text-sm font-bold text-slate-900">Day {dayNumber}</h3><p className="mt-0.5 text-[11px] text-slate-500">{daySessions[0]?.date?.slice(0, 10) || 'Date not set'}</p></div></div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${badgeClass}`}>{dayStatus}</span>
              </div>
              {daySessions.length ? <div className="mt-4 flex-1 space-y-3">{daySessions.map((session) => {
                const report = sessionReports.find((item) => item.sessionId === session.id);
                const canEdit = report && ['DRAFT', 'CORRECTIONS_REQUIRED'].includes(report.status);
                return <div key={session.id} className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">{session.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{report ? (report.sessionSummary || 'A report has been started for this day.') : 'No Session Report for this day yet.'}</p>
                  <button type="button" onClick={() => report ? (canEdit ? void openForm(report) : setViewReport(report)) : void openForm(undefined, session.id)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-900">
                    {report ? <><Eye size={14} />{canEdit ? 'Continue Report' : 'View Report'}</> : <><Plus size={14} />Create Session Report</>}
                  </button>
                </div>;
              })}</div> : <div className="mt-5 flex-1"><p className="text-sm font-semibold text-slate-700">No scheduled session for this day yet</p><p className="mt-1 text-xs text-slate-500">Schedule the session first to create its report.</p></div>}
            </article>;
          })}
        </div>
      </section>}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {visibleReports.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center"><FileText className="mx-auto text-slate-300" size={32} /><h2 className="mt-3 text-sm font-semibold text-slate-700">No reports found</h2><p className="mt-1 text-xs text-slate-500">{isSuperAdmin ? 'Submitted reports will appear here as soon as Cluster Admins submit them.' : 'Create a report for a scheduled session to get started.'}</p></div> : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {visibleReports.map((report) => {
              const session = reportSession(report); const isDraft = report.status === 'DRAFT';
              return <article key={report.id} className="flex min-h-[250px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-800"><FileText size={18} /></span><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{session?.name || `Session Day ${report.dayNumber || ''}`}</p><p className="mt-0.5 text-xs text-slate-500">{report.clusterName || 'Cluster'} · Day {report.dayNumber || session?.dayNumber || '—'}</p></div></div>
                  {statusBadge(report.status)}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-y border-slate-100 py-3 text-xs">
                  <div><span className="text-slate-400">Planned date</span><p className="mt-0.5 font-medium text-slate-700">{session?.date || '—'}</p></div>
                  <div><span className="text-slate-400">Village</span><p className="mt-0.5 truncate font-medium text-slate-700">{report.villageNames?.join(', ') || session?.villageName || '—'}</p></div>
                  <div><span className="text-slate-400">Summit · Grade</span><p className="mt-0.5 font-medium text-slate-700">{report.summitNumber || '—'} · {report.grade || '—'}</p></div>
                  <div><span className="text-slate-400">Submitted by</span><p className="mt-0.5 truncate font-medium text-slate-700">{report.submittedByName || report.createdByName || '—'}</p></div>
                  <div><span className="text-slate-400">Submitted date</span><p className="mt-0.5 font-medium text-slate-700">{report.submittedAt ? new Date(report.submittedAt).toLocaleDateString() : '—'}</p></div>
                  <div className="col-span-2"><span className="text-slate-400">Last updated</span><p className="mt-0.5 font-medium text-slate-700">{report.updatedAt ? new Date(report.updatedAt).toLocaleString() : '—'}</p></div>
                </div>
                <p className="mt-3 line-clamp-3 flex-1 text-xs leading-relaxed text-slate-600">{report.sessionSummary || 'No overview has been added yet.'}</p>
                {report.status === 'CORRECTIONS_REQUIRED' && report.correctionReason && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800"><b>Correction requested:</b> {report.correctionReason}</p>}
                {report.status === 'EDIT_REQUEST_PENDING' && report.editRequestReason && <p className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-2.5 text-xs text-orange-800"><b>Edit request:</b> {report.editRequestReason}</p>}
                {report.status === 'DELETE_REQUEST_PENDING' && report.deleteRequestReason && <p className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-2.5 text-xs text-orange-800"><b>Delete request:</b> {report.deleteRequestReason}</p>}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  {viewButton(report)}
                  {pdfButton(report)}
                  {!isSuperAdmin && isDraft && <>
                    <button onClick={() => void openForm(report)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800"><Edit size={14} className="mr-1 inline" />Edit</button>
                    <button onClick={() => void deleteDraft(report)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700"><Trash2 size={14} className="mr-1 inline" />Delete</button>
                    <button onClick={() => void submitDraft(report)} className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white"><Send size={14} className="mr-1 inline" />Submit</button>
                  </>}
                  {!isSuperAdmin && report.status === 'CORRECTIONS_REQUIRED' && <>
                    <button onClick={() => void openForm(report)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800"><Edit size={14} className="mr-1 inline" />Edit</button>
                    <button onClick={() => { setWorkflowDialog({ action: 'send_correction', report }); setWorkflowReason(''); setWorkflowError(''); }} className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white"><Send size={14} className="mr-1 inline" />Resubmit</button>
                  </>}
                  {!isSuperAdmin && ['SUBMITTED', 'APPROVED'].includes(report.status) && <>
                    <button onClick={() => { setWorkflowDialog({ action: 'request_edit', report }); setWorkflowReason(''); setWorkflowError(''); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">Request Edit</button>
                    <button onClick={() => { setWorkflowDialog({ action: 'request_delete', report }); setWorkflowReason(''); setWorkflowError(''); }} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700">Request Delete</button>
                  </>}
                  {isSuperAdmin && report.status === 'SUBMITTED' && <>
                    <button onClick={() => { setWorkflowDialog({ action: 'approve', report }); setWorkflowReason(''); setWorkflowError(''); }} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white"><CheckCircle2 size={14} className="mr-1 inline" />Approve</button>
                    <button onClick={() => { setWorkflowDialog({ action: 'send_correction', report }); setWorkflowReason(''); setWorkflowError(''); }} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">Send for Correction</button>
                  </>}
                  {isSuperAdmin && report.status === 'EDIT_REQUEST_PENDING' && <>
                    <button onClick={() => void doWorkflow('allow_edit', report).catch((reason) => window.alert(reason instanceof Error ? reason.message : 'Unable to allow edit.'))} className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white">Allow Edit</button>
                    <button onClick={() => void doWorkflow('deny_edit', report).catch((reason) => window.alert(reason instanceof Error ? reason.message : 'Unable to decline request.'))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">Decline</button>
                  </>}
                  {isSuperAdmin && report.status === 'DELETE_REQUEST_PENDING' && <>
                    <button onClick={() => { setWorkflowDialog({ action: 'approve_delete', report }); setWorkflowReason(''); setWorkflowError(''); }} className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white">Approve Delete</button>
                    <button onClick={() => void doWorkflow('deny_delete', report).catch((reason) => window.alert(reason instanceof Error ? reason.message : 'Unable to decline request.'))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">Decline</button>
                  </>}
                </div>
              </article>;
            })}
          </div>
        )}
      </section>

      {formOpen && !isSuperAdmin && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-2 sm:p-5">
        <div className="mx-auto my-2 max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:my-5">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Student Holistic Development Program</p><h2 className="mt-1 text-lg font-bold text-slate-900">{formReport.id ? 'Session Report' : 'Create Session Report'}</h2></div>
            <button onClick={() => setFormOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19} /></button>
          </div>
          <div className="space-y-7 p-5 sm:p-7">
            {formReport.status === 'CORRECTIONS_REQUIRED' && formReport.correctionReason && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><b>Correction requested by Super Admin:</b><p className="mt-1 whitespace-pre-wrap">{formReport.correctionReason}</p></div>}
            <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5">
              <div className="mb-4"><h3 className="text-sm font-bold text-slate-900">1. BASIC INFORMATION</h3><p className="mt-1 text-xs text-slate-500">Schedule and academic details are loaded from the system. Select only the report-specific fields.</p></div>
              {formReport.id && <p className="mb-4 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800">{formContext?.session.name || reportSession(formReport as SessionReport)?.name || `Day ${formReport.dayNumber}`}</p>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Cluster', formContext?.cluster.name || '—'], ['Team', formContext?.collegeName || '—'], ['Academic Year', formContext?.academicYear.name || '—'],
                  ['Session / Day', formContext ? `Day ${formContext.session.dayNumber} · ${formContext.session.name}` : '—'], ['Date', formContext?.session.date || '—'],
                ].map(([label, value]) => <div key={label} className="rounded-lg border border-blue-100 bg-white p-3"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span><p className="mt-1 text-sm font-semibold text-slate-800">{value}</p></div>)}
                <MultiSelectField label="Village(s) — select all that apply" placeholder="Select village(s)" options={(formContext?.villages || []).map((village) => ({ value: village.id, label: village.name }))} selected={selectedVillages} onChange={setSelectedVillages} />
                <MultiSelectField label="No. of Summit" placeholder="Select summit(s)" options={['I', 'II', 'III', 'IV'].map((value) => ({ value, label: `Summit ${value}` }))} selected={(formReport.summitNumber || '').split(',').map((value) => value.trim()).filter((value) => ['I', 'II', 'III', 'IV'].includes(value))} onChange={(selected) => setFormReport((current) => ({ ...current, summitNumber: selected.join(', ') }))} />
                <MultiSelectField label="Grade" placeholder="Select grade(s)" options={['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map((value) => ({ value, label: value }))} selected={(formReport.grade || '').split(',').map((value) => value.trim()).filter((value) => ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].includes(value))} onChange={(selected) => setFormReport((current) => ({ ...current, grade: selected.join(', ') }))} />
              </div>
              {formContext?.villages.length === 0 && <p className="mt-3 text-xs text-amber-800">No villages are mapped to this session. Please configure the session location before creating its report.</p>}
            </section>

            <section className="space-y-5">
              <Field label="2. AN OVERVIEW"><textarea rows={5} value={formReport.sessionSummary || ''} onChange={(event) => setFormReport((current) => ({ ...current, sessionSummary: event.target.value }))} className={`${inputClass} resize-y`} placeholder="Describe what happened, where the session was conducted, its main focus, student participation and major observations…" /></Field>
              <div className="rounded-xl border border-slate-200 p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-bold text-slate-900">3. DETAILED SUMMARY</h3><p className="mt-1 text-xs text-slate-500">Add grade-wise activities, participation, discussions, challenges and observations.</p></div><button onClick={() => setActivities((items) => [...items, { topic: '', details: '' }])} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-800"><Plus size={14} />Add section</button></div>
                <div className="space-y-3">{activities.map((activity, index) => <div key={index} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_2fr_auto]">
                  <Field label={`Heading ${index + 1}`}><input value={activity.topic} onChange={(event) => setActivities((items) => items.map((item, i) => i === index ? { ...item, topic: event.target.value } : item))} className={inputClass} placeholder="Grade / activity / discussion" /></Field>
                  <Field label="Activity description and observations"><textarea rows={3} value={activity.details} onChange={(event) => setActivities((items) => items.map((item, i) => i === index ? { ...item, details: event.target.value } : item))} className={inputClass} placeholder="Use headings and bullet points as needed…" /></Field>
                  <button disabled={activities.length === 1} onClick={() => setActivities((items) => items.filter((_, i) => i !== index))} className="self-end rounded-lg px-2 py-2 text-xs font-semibold text-rose-700 disabled:opacity-30">Remove</button>
                </div>)}</div>
              </div>
              <Field label="Challenges"><textarea rows={3} value={formReport.issues || ''} onChange={(event) => setFormReport((current) => ({ ...current, issues: event.target.value }))} className={inputClass} placeholder="Describe challenges faced during the session…" /></Field>
              <Field label="Observations"><textarea rows={3} value={formReport.observations || ''} onChange={(event) => setFormReport((current) => ({ ...current, observations: event.target.value }))} className={inputClass} placeholder="Record student participation, behavior, learning, and other observations…" /></Field>
              <Field label="Additional remarks (optional)"><textarea rows={2} value={formReport.remarks || ''} onChange={(event) => setFormReport((current) => ({ ...current, remarks: event.target.value }))} className={inputClass} placeholder="Additional remarks…" /></Field>
              <Field label="4. OUTCOME"><textarea rows={4} value={formReport.outcome || ''} onChange={(event) => setFormReport((current) => ({ ...current, outcome: event.target.value }))} className={inputClass} placeholder="Record observed outcomes, learning, creativity, teamwork, communication or other results…" /></Field>
              <section className="rounded-xl border border-slate-200 p-4 sm:p-5">
                <div className="mb-3"><h3 className="text-sm font-bold text-slate-900">5. VOLUNTEERS WHO TOOK THE SESSION</h3><p className="mt-1 text-xs text-slate-500">Selected Lesson Plan volunteers with their contact details.</p></div>
                {formContext?.volunteers.length ? <div className="mb-3"><MultiSelectField label="Select volunteers" placeholder="Select volunteers who took this session" options={formContext.volunteers.map((volunteer) => ({ value: volunteer.name, label: volunteer.name }))} selected={selectedVolunteers} onChange={(selected) => { setSelectedVolunteers(selected); setFormReport((current) => ({ ...current, volunteerNames: selected })); }} /></div> : <p className="mb-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">No active volunteers are available for this cluster.</p>}
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <div className="grid min-w-[560px] grid-cols-[55px_1.4fr_1fr_100px] bg-blue-50 px-3 py-2 text-[11px] font-bold uppercase text-slate-600"><span>S.No</span><span>Volunteer Name</span><span>Contact Number</span><span>Year</span></div>
                  {(selectedVolunteers.length ? selectedVolunteers : formReport.volunteerNames || []).map((name, index) => {
                    const volunteer = formContext?.volunteers.find((item) => item.name === name);
                    return <div key={`${name}-${index}`} className="grid min-w-[560px] grid-cols-[55px_1.4fr_1fr_100px] border-t border-slate-100 px-3 py-2 text-sm text-slate-700"><span>{index + 1}</span><span>{name}</span><span>{volunteer?.phone || '—'}</span><span>{volunteer?.year || '—'}</span></div>;
                  })}
                  {!selectedVolunteers.length && <p className="p-3 text-xs text-slate-500">Select assigned volunteers in Basic Information to show them here.</p>}
                </div>
              </section>
              <section className="rounded-xl border border-slate-200 p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">6. SESSION PHOTOS</h3><p className="mt-1 text-xs text-slate-500">Upload up to 6 JPG, JPEG, or PNG photos. These will be included in the exported PDF.</p></div><label className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold text-white ${photoFiles.length + (formReport.photos?.length || 0) >= 6 ? 'cursor-not-allowed bg-slate-400' : 'cursor-pointer bg-blue-700 hover:bg-blue-800'}`}><Upload size={15} />Add Photos<input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" multiple disabled={photoFiles.length + (formReport.photos?.length || 0) >= 6} className="hidden" onChange={(event) => { const accepted = Array.from(event.target.files || []).filter((file) => ['image/jpeg', 'image/png'].includes(file.type)); const slots = Math.max(0, 6 - (formReport.photos?.length || 0) - photoFiles.length); setPhotoFiles((items) => [...items, ...accepted.slice(0, slots)]); if (accepted.length > slots) setError('Only 6 session photos can be attached to a report.'); event.target.value = ''; }} /></label></div>
                {(formReport.photos?.length || photoFiles.length) ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{(formReport.photos || []).map((photo) => <div key={photo.id} className="overflow-hidden rounded-lg border border-slate-200"><div className="aspect-square"><ProtectedReportPhoto photo={photo} authToken={authToken} /></div><p className="truncate px-2 py-1 text-[10px] text-slate-500">{photo.originalFilename}</p></div>)}{photoFiles.map((file, index) => <div key={`${file.name}-${index}`} className="overflow-hidden rounded-lg border border-slate-200"><div className="aspect-square"><img src={photoUrls[index]} alt={file.name} className="h-full w-full object-cover" /></div><div className="flex items-center justify-between gap-2 px-2 py-1"><span className="truncate text-[10px] text-slate-500">{file.name}</span><button type="button" onClick={() => setPhotoFiles((items) => items.filter((_, fileIndex) => fileIndex !== index))} className="text-rose-700">Remove</button></div></div>)}</div> : <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">No photos attached yet.</p>}
              </section>
              {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
            </section>
          </div>
          <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white p-4 sm:px-7">
            <button onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
            <button disabled={saving || !formContext || formReport.status === 'CORRECTIONS_REQUIRED'} onClick={() => void saveReport('DRAFT')} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">Save Draft</button>
            <button disabled={saving || !formContext} onClick={() => { setWorkflowDialog({ action: 'approve', report: formReport as SessionReport }); setWorkflowReason(''); setWorkflowError(''); }} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{formReport.status === 'CORRECTIONS_REQUIRED' ? 'Resubmit Session Report' : 'Submit Session Report'}</button>
          </div>
        </div>
      </div>}

      {viewReport && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-2 sm:p-5"><article className="mx-auto my-2 max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl sm:my-5">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Talent Quest for India · Student Holistic Development Program</p><h2 className="mt-1 text-lg font-bold text-slate-900">Session Report · Day {viewReport.dayNumber || '—'}</h2></div><button onClick={() => setViewReport(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19} /></button></header>
        <div className="space-y-6 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3"><div>{statusBadge(viewReport.status)}<p className="mt-2 text-xs text-slate-500">Last updated {viewReport.updatedAt ? new Date(viewReport.updatedAt).toLocaleString() : '—'} · Submitted by {viewReport.submittedByName || viewReport.createdByName || '—'}</p></div>{pdfButton(viewReport)}</div>
          {viewReport.correctionReason && viewReport.status === 'CORRECTIONS_REQUIRED' && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><b>Correction requested by Super Admin</b><p className="mt-1 whitespace-pre-wrap">{viewReport.correctionReason}</p></div>}
          <section><h3 className="mb-3 text-sm font-bold text-blue-900">1. BASIC INFORMATION</h3><div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">{[
            ['Cluster', viewContext?.cluster.name || viewReport.clusterName], ['Team', viewContext?.collegeName || '—'], ['Academic Year', viewContext?.academicYear.name || academicYears.find((year) => year.id === viewReport.academicYearId)?.name || '—'],
            ['Village(s)', viewReport.villageNames?.join(', ') || viewContext?.villages.filter((village) => viewReport.villageIds?.includes(village.id)).map((village) => village.name).join(', ') || '—'], ['No. of Summit', viewReport.summitNumber || '—'], ['Session / Day', `Day ${viewReport.dayNumber || '—'}`], ['Grade', viewReport.grade || '—'], ['Date', viewContext?.session.date || reportSession(viewReport)?.date || '—'],
          ].map(([label, value]) => <div key={label}><p className="text-[10px] font-semibold uppercase text-slate-400">{label}</p><p className="mt-1 text-sm font-medium text-slate-800">{value}</p></div>)}</div></section>
          <section><h3 className="mb-2 text-sm font-bold text-blue-900">2. AN OVERVIEW</h3><p className="whitespace-pre-wrap rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">{viewReport.sessionSummary || 'No overview provided.'}</p></section>
          <section><h3 className="mb-2 text-sm font-bold text-blue-900">3. DETAILED SUMMARY</h3><div className="space-y-3">{parseActivities(viewReport.activities).map((activity, index) => <div key={index} className="rounded-xl border border-slate-200 p-4"><h4 className="text-sm font-semibold text-slate-800">{activity.topic || `Activity ${index + 1}`}</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{activity.details}</p></div>)}</div></section>
          <section><h3 className="mb-2 text-sm font-bold text-blue-900">4. OUTCOME</h3><p className="whitespace-pre-wrap rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">{viewReport.outcome || 'No outcomes provided.'}</p></section>
          {viewReport.issues && <section><h3 className="mb-2 text-sm font-bold text-blue-900">Challenges</h3><p className="whitespace-pre-wrap rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">{viewReport.issues}</p></section>}
          {viewReport.observations && <section><h3 className="mb-2 text-sm font-bold text-blue-900">Observations</h3><p className="whitespace-pre-wrap rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">{viewReport.observations}</p></section>}
          {viewReport.remarks && <section><h3 className="mb-2 text-sm font-bold text-blue-900">Additional remarks</h3><p className="whitespace-pre-wrap rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">{viewReport.remarks}</p></section>}
          <section><h3 className="mb-2 text-sm font-bold text-blue-900">5. VOLUNTEERS WHO TOOK THE SESSION</h3><div className="overflow-x-auto rounded-xl border border-slate-200"><div className="grid min-w-[560px] grid-cols-[55px_1.4fr_1fr_100px] bg-blue-50 px-4 py-2 text-xs font-bold text-slate-600"><span>S.No</span><span>Volunteer Name</span><span>Contact Number</span><span>Year</span></div>{(viewReport.volunteerNames || []).map((name, index) => { const volunteer = viewContext?.volunteers.find((item) => item.name === name); return <div key={`${name}-${index}`} className="grid min-w-[560px] grid-cols-[55px_1.4fr_1fr_100px] border-t border-slate-100 px-4 py-2 text-sm"><span>{index + 1}</span><span>{name}</span><span>{volunteer?.phone || '—'}</span><span>{volunteer?.year || '—'}</span></div>; })}</div></section>
          <section><h3 className="mb-3 text-sm font-bold text-blue-900">6. SESSION PHOTOS</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{(viewReport.photos || []).map((photo) => <div key={photo.id} className="overflow-hidden rounded-lg border border-slate-200"><div className="aspect-square"><ProtectedReportPhoto photo={photo} authToken={authToken} /></div><p className="truncate px-2 py-1 text-xs text-slate-500">{photo.originalFilename}</p></div>)}</div>{!viewReport.photos?.length && <p className="text-sm text-slate-500">No photos attached.</p>}</section>
        </div>
      </article></div>}

      {workflowDialog && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h2 className="text-lg font-bold text-slate-900">{workflowDialog.action === 'approve' ? (workflowDialog.report.id ? 'Confirm submission' : 'Submit Session Report') : workflowDialog.action === 'send_correction' ? (isSuperAdmin ? 'Correction Required' : 'Confirm resubmission') : workflowDialog.action === 'request_edit' ? 'Request Edit Access' : workflowDialog.action === 'request_delete' ? 'Request Delete' : 'Approve Delete Request'}</h2>
        <p className="mt-2 text-sm text-slate-600">{workflowDialog.action === 'approve' && isSuperAdmin ? 'Approve this session report?' : workflowDialog.action === 'approve' ? 'Are you sure you want to submit this session report? After submission, direct editing and deletion will be disabled.' : workflowDialog.action === 'request_edit' ? 'Provide a reason for requesting edit access.' : workflowDialog.action === 'request_delete' ? 'Provide a reason for requesting deletion. The report will remain available until approved.' : workflowDialog.action === 'send_correction' && isSuperAdmin ? 'Provide the correction or feedback required before resubmission.' : workflowDialog.action === 'approve_delete' ? 'Approve deletion? This will permanently delete the report and its attached photos.' : 'Confirm this report action.'}</p>
        {['request_edit', 'request_delete', 'send_correction'].includes(workflowDialog.action) && isSuperAdmin === (workflowDialog.action === 'send_correction') && <textarea value={workflowReason} onChange={(event) => setWorkflowReason(event.target.value)} rows={4} className={`${inputClass} mt-4`} placeholder={workflowDialog.action === 'send_correction' ? 'Correction / Feedback' : 'Reason'} />}
        {workflowError && <p className="mt-3 text-sm text-rose-700">{workflowError}</p>}
        <div className="mt-5 flex justify-end gap-2"><button onClick={() => { setWorkflowDialog(null); setWorkflowError(''); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button><button onClick={async () => {
          try {
            if (workflowDialog.action === 'approve' && !isSuperAdmin) { const saveError = await saveReport('SUBMITTED'); if (saveError) setWorkflowError(saveError); else setWorkflowDialog(null); }
            else if (workflowDialog.action === 'send_correction' && !isSuperAdmin) { const saveError = await saveReport('SUBMITTED'); if (saveError) setWorkflowError(saveError); else setWorkflowDialog(null); }
            else await doWorkflow(workflowDialog.action, workflowDialog.report, workflowReason);
          } catch (reason) { setWorkflowError(reason instanceof Error ? reason.message : 'Unable to complete the action.'); }
        }} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">{workflowDialog.action === 'approve' ? (isSuperAdmin ? 'Approve' : 'Submit') : workflowDialog.action === 'send_correction' && !isSuperAdmin ? 'Resubmit' : 'Confirm'}</button></div>
      </div></div>}
    </div>
  );
};

export default SessionReportView;
