import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Cluster, LessonPlan, Panchayat, Session, TabType, UserRole, Volunteer } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AlertTriangle, ArrowLeft, BookOpen, CheckCircle2, Clock, Download, Eye, FileText, Plus, Search, Trash2, Users, X } from './ui/icons';
import { exportLessonPlanPdf } from '../utils/exportUtils';

interface LessonPlanViewProps {
  lessonPlans: LessonPlan[];
  clusters?: Cluster[];
  sessions: Session[];
  panchayats: Panchayat[];
  volunteers: Volunteer[];
  currentUserRole?: UserRole;
  currentCluster?: string;
  currentClusterId?: string;
  currentAcademicYear?: string;
  selectedLessonPlanId?: string;
  onNavigate: (tab: TabType, targetId?: string) => void;
  onAddLessonPlan: (plan: Omit<LessonPlan, 'id'>) => Promise<void> | void;
  onUpdateLessonPlan: (id: string, updated: Partial<LessonPlan>) => Promise<void> | void;
  onDeleteLessonPlan?: (id: string) => Promise<void> | void;
  onReviewLessonPlan?: (id: string, action: 'approve' | 'correction', reason?: string) => Promise<void>;
  onRequestLessonPlanAction?: (id: string, type: 'edit' | 'delete', reason: string) => Promise<void>;
}

type ViewMode = 'list' | 'create' | 'edit' | 'detail';
type PlanActivity = { activityNumber: number; title: string; description: string; duration: number };
type LessonPlanForm = {
  panchayatIds: string[];
  villageIds: string[];
  summitNumbers: string[];
  grades: string[];
  volunteerIds: string[];
  dayNumber: number;
  overview: string;
  lessonPlanContent: string;
  activities: PlanActivity[];
  expectedOutcomes: string[];
  status?: string;
};

const emptyForm = (dayNumber = 1): LessonPlanForm => ({
  panchayatIds: [], villageIds: [], summitNumbers: [], grades: [], volunteerIds: [], dayNumber, overview: '', lessonPlanContent: '',
  activities: [{ activityNumber: 1, title: '', description: '', duration: 0 }],
  expectedOutcomes: [''], status: 'Draft',
});

const visibleToSuperAdmin = (plan: LessonPlan) => [
  'Submitted', 'Resubmitted', 'Approved', 'Corrections Required', 'Correction Requested',
  'Edit Request Pending', 'Delete Request Pending',
].includes(String(plan.status || ''));

export const LessonPlanView: React.FC<LessonPlanViewProps> = ({
  lessonPlans = [], clusters = [], sessions = [], panchayats = [], volunteers = [],
  currentUserRole = 'Cluster Admin', currentCluster = '', currentClusterId = '',
  currentAcademicYear = '', selectedLessonPlanId, onNavigate,
  onAddLessonPlan, onUpdateLessonPlan, onDeleteLessonPlan,
  onReviewLessonPlan, onRequestLessonPlanAction,
}) => {
  const isSuperAdmin = currentUserRole === 'Super Admin';
  const [viewMode, setViewMode] = useState<ViewMode>(selectedLessonPlanId ? 'detail' : 'list');
  const [activePlanId, setActivePlanId] = useState(selectedLessonPlanId || '');
  const [form, setForm] = useState<LessonPlanForm>(() => emptyForm());
  const [editingPlanId, setEditingPlanId] = useState('');
  const [search, setSearch] = useState('');
  const [clusterFilter, setClusterFilter] = useState('all');
  const [villageFilter, setVillageFilter] = useState('all');
  const [dayFilter, setDayFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [requestType, setRequestType] = useState<'edit' | 'delete' | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const availablePlans = useMemo(
    () => (isSuperAdmin ? lessonPlans.filter(visibleToSuperAdmin) : lessonPlans),
    [isSuperAdmin, lessonPlans],
  );
  const activePlan = availablePlans.find((plan) => plan.id === activePlanId) || null;
  const activeCluster = clusters.find((cluster) => cluster.id === currentClusterId);
  const getClusterDisplayName = (plan: LessonPlan) =>
    clusters.find((cluster) => cluster.id === plan.clusterId)?.name || plan.cluster || currentCluster || '—';
  const schedule = sessions.find((session) => Number(session.dayNumber) === Number(form.dayNumber));
  const plannedDate = schedule?.date ? String(schedule.date).slice(0, 10) : '';

  useEffect(() => {
    if (!selectedLessonPlanId) return;
    const matching = lessonPlans.find((plan) => plan.id === selectedLessonPlanId || plan.sessionId === selectedLessonPlanId);
    if (matching && (!isSuperAdmin || visibleToSuperAdmin(matching))) {
      setActivePlanId(matching.id);
      setViewMode('detail');
    }
  }, [selectedLessonPlanId, lessonPlans, isSuperAdmin]);

  const villageOptions = useMemo(() => panchayats.flatMap((panchayat) =>
    panchayat.villages.map((village) => ({
      id: village.id,
      name: village.name,
      panchayatId: panchayat.id,
      panchayatName: panchayat.name,
      clusterId: panchayat.clusterId || '',
    })),
  ), [panchayats]);
  const clusterPanchayats = panchayats.filter((panchayat) => !currentClusterId || panchayat.clusterId === currentClusterId);
  const clusterVillages = villageOptions.filter((village) => !currentClusterId || village.clusterId === currentClusterId);
  const selectableVillages = clusterVillages.filter((village) => form.panchayatIds.includes(village.panchayatId));
  const selectableVolunteers = volunteers.filter((volunteer) =>
    (!currentClusterId || volunteer.clusterId === currentClusterId) && volunteer.status !== 'Inactive',
  );

  const filteredPlans = useMemo(() => availablePlans.filter((plan) => {
    const planClusterId = plan.clusterId || '';
    const planVillages = plan.villagesList?.length ? plan.villagesList : (plan.villageName ? [plan.villageName] : []);
    const term = search.trim().toLowerCase();
    const searchMatches = !term || [plan.topic, plan.title, plan.cluster, plan.teamCollegeName, ...planVillages, plan.overview]
      .some((value) => String(value || '').toLowerCase().includes(term));
    const clusterMatches = clusterFilter === 'all' || planClusterId === clusterFilter || plan.cluster === clusters.find((cluster) => cluster.id === clusterFilter)?.name;
    const villageMatches = villageFilter === 'all' || planVillages.includes(villageFilter);
    const dayMatches = dayFilter === 'all' || Number(plan.dayNumber || 1) === Number(dayFilter);
    const statusMatches = statusFilter === 'all' || String(plan.status || 'Draft') === statusFilter;
    return searchMatches && clusterMatches && villageMatches && dayMatches && statusMatches;
  }), [availablePlans, search, clusterFilter, villageFilter, dayFilter, statusFilter, clusters]);

  const statusCounts = useMemo(() => ({
    total: availablePlans.length,
    draft: availablePlans.filter((plan) => plan.status === 'Draft').length,
    submitted: availablePlans.filter((plan) => plan.status === 'Submitted' || plan.status === 'Resubmitted').length,
    approved: availablePlans.filter((plan) => plan.status === 'Approved').length,
    corrections: availablePlans.filter((plan) => plan.status === 'Corrections Required' || plan.status === 'Correction Requested').length,
  }), [availablePlans]);

  const resetFilters = () => {
    setSearch(''); setClusterFilter('all'); setVillageFilter('all'); setDayFilter('all'); setStatusFilter('all');
  };

  const backToList = () => {
    setActivePlanId('');
    setViewMode('list');
    onNavigate('lesson-plan');
  };

  const openCreate = (dayNumber = 1) => {
    setError(''); setEditingPlanId(''); setForm(emptyForm(dayNumber)); setViewMode('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEdit = (plan: LessonPlan) => {
    const villageIds = plan.villageIds?.length
      ? plan.villageIds
      : plan.villageId
        ? [plan.villageId]
        : villageOptions.filter((village) => (plan.villagesList || [plan.villageName || '']).includes(village.name)).map((village) => village.id);
    const panchayatIds = plan.panchayatIds?.length
      ? plan.panchayatIds
      : plan.panchayatId
        ? [plan.panchayatId]
        : [...new Set(villageOptions.filter((village) => villageIds.includes(village.id)).map((village) => village.panchayatId))];
    setError(''); setEditingPlanId(plan.id);
    setForm({
      panchayatIds,
      villageIds,
      summitNumbers: plan.summitNumbersList?.length ? [...plan.summitNumbersList] : (plan.summitNumbers || '').split(',').map((value) => value.trim()).filter(Boolean),
      grades: plan.gradesList?.length ? [...plan.gradesList] : (plan.grades || plan.targetStandard || '').split(',').map((value) => value.trim()).filter(Boolean),
      volunteerIds: plan.volunteerIds?.length
        ? [...plan.volunteerIds]
        : selectableVolunteers.filter((volunteer) => (plan.assignedVolunteers || []).includes(volunteer.name)).map((volunteer) => volunteer.id),
      dayNumber: Number(plan.dayNumber || 1),
      overview: plan.overview || plan.objective || '',
      lessonPlanContent: plan.gradeSegments?.map((segment) => segment.description).filter(Boolean).join('\n\n') || '',
      activities: plan.activitiesDetailed?.length
        ? plan.activitiesDetailed.map((activity) => ({ ...activity, duration: Number(activity.duration || 0) }))
        : [{ activityNumber: 1, title: '', description: '', duration: 0 }],
      expectedOutcomes: plan.expectedOutcomes?.length ? [...plan.expectedOutcomes] : (plan.expectedOutcome ? plan.expectedOutcome.split('\n').filter(Boolean) : ['']),
      status: plan.status || 'Draft',
    });
    setViewMode('edit'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toPayload = (status: 'Draft' | 'Submitted'): Omit<LessonPlan, 'id'> => {
    const selectedVillages = villageOptions.filter((item) => form.villageIds.includes(item.id));
    const selectedPanchayats = clusterPanchayats.filter((item) => form.panchayatIds.includes(item.id));
    const villageNames = selectedVillages.map((village) => village.name);
    const panchayatNames = selectedPanchayats.map((panchayat) => panchayat.name);
    const teamName = activeCluster?.collegeName || activeCluster?.name || currentCluster;
    const gradeSegments = form.lessonPlanContent.trim()
      ? [{ grade: 'Summit', title: 'Lesson Plan Content', description: form.lessonPlanContent.trim() }]
      : [];
    const activitiesDetailed = form.activities
      .filter((activity) => activity.title.trim() || activity.description.trim())
      .map((activity, index) => ({ ...activity, activityNumber: index + 1 }));
    const outcomes = form.expectedOutcomes.map((outcome) => outcome.trim()).filter(Boolean);
    const selectedVolunteers = selectableVolunteers.filter((volunteer) => form.volunteerIds.includes(volunteer.id));
    const volunteerRoster = selectedVolunteers.map((volunteer) => ({
      name: volunteer.name,
      role: volunteer.role || 'Volunteer',
      phone: volunteer.phone || '',
      year: volunteer.year || '',
    }));
    return {
      sessionName: schedule?.name || `Day ${form.dayNumber}`,
      title: `Day ${form.dayNumber} Lesson Plan`,
      topic: `Day ${form.dayNumber} Lesson Plan`,
      academicYear: currentAcademicYear,
      cluster: activeCluster?.name || currentCluster,
      clusterId: currentClusterId || activeCluster?.id || '',
      teamCollegeName: teamName,
      panchayatId: selectedPanchayats[0]?.id || '',
      panchayatIds: form.panchayatIds,
      panchayatName: panchayatNames.join(', '),
      panchayatNames,
      villageId: selectedVillages[0]?.id || '',
      villageIds: form.villageIds,
      villageName: villageNames.join(', '),
      villagesList: villageNames,
      summitNumbers: form.summitNumbers.join(', '),
      summitNumbersList: form.summitNumbers,
      dayNumber: form.dayNumber,
      grades: form.grades.join(', '),
      gradesList: form.grades,
      targetStandard: form.grades.join(', '),
      date: plannedDate,
      overview: form.overview.trim(),
      objective: form.overview.trim(),
      gradeSegments,
      activitiesDetailed,
      expectedOutcomes: outcomes,
      expectedOutcome: outcomes.join('\n'),
      volunteerRoster,
      volunteerIds: form.volunteerIds,
      assignedVolunteers: volunteerRoster.map((volunteer) => volunteer.name),
      volunteersCount: volunteerRoster.length,
      status,
    } as Omit<LessonPlan, 'id'>;
  };

  const savePlan = async (status: 'Draft' | 'Submitted') => {
    setError('');
    if (!form.panchayatIds.length || !form.villageIds.length || !form.summitNumbers.length || !form.overview.trim()) {
      setError('Select at least one panchayat, village, and summit number, and complete the overview before saving.');
      return;
    }
    if (!plannedDate) {
      setError(`No planned date is configured for Day ${form.dayNumber}. Set the date in the academic schedule before saving.`);
      return;
    }
    setBusy(true);
    try {
      const payload = toPayload(status);
      if (editingPlanId) await onUpdateLessonPlan(editingPlanId, payload);
      else await onAddLessonPlan(payload);
      setEditingPlanId('');
      backToList();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save lesson plan.');
    } finally { setBusy(false); }
  };

  const openSubmitConfirmation = () => {
    setError('');
    if (!form.panchayatIds.length || !form.villageIds.length || !form.summitNumbers.length || !form.overview.trim()) {
      setError('Select at least one panchayat, village, and summit number, and complete the overview before submitting.');
      return;
    }
    if (!plannedDate) {
      setError(`No planned date is configured for Day ${form.dayNumber}. Set the date in the academic schedule before submitting.`);
      return;
    }
    setSubmitConfirmOpen(true);
  };

  const confirmSubmit = async () => {
    setSubmitConfirmOpen(false);
    await savePlan('Submitted');
  };

  const runReview = async (action: 'approve' | 'correction', reason?: string) => {
    if (!activePlan || !onReviewLessonPlan) return;
    setBusy(true); setError('');
    try {
      await onReviewLessonPlan(activePlan.id, action, reason);
      if (action === 'correction') setCorrectionOpen(false);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Unable to review lesson plan.');
    } finally { setBusy(false); }
  };

  const submitRequest = async () => {
    if (!activePlan || !requestType || !requestReason.trim() || !onRequestLessonPlanAction) return;
    setBusy(true); setError('');
    try {
      await onRequestLessonPlanAction(activePlan.id, requestType, requestReason.trim());
      setRequestType(null); setRequestReason('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send request.');
    } finally { setBusy(false); }
  };

  const deleteDraft = async () => {
    if (!activePlan || !onDeleteLessonPlan) return;
    setBusy(true); setError('');
    try {
      await onDeleteLessonPlan(activePlan.id);
      setDeleteConfirmOpen(false);
      backToList();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete draft.');
    } finally { setBusy(false); }
  };

  const statusStyle = (status?: string) => {
    switch (status) {
      case 'Approved': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'Submitted': case 'Resubmitted': return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'Corrections Required': case 'Correction Requested': case 'Rejected': return 'border-red-200 bg-red-50 text-red-700';
      case 'Edit Request Pending': case 'Delete Request Pending': return 'border-orange-200 bg-orange-50 text-orange-700';
      default: return 'border-amber-200 bg-amber-50 text-amber-800';
    }
  };

  const StatusBadge = ({ status }: { status?: string }) => (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusStyle(status)}`}>
      {status === 'Correction Requested' ? 'Corrections Required' : status || 'Draft'}
    </span>
  );

  if (viewMode === 'detail' && activePlan) {
    const canEdit = !isSuperAdmin && (activePlan.status === 'Draft' || activePlan.status === 'Corrections Required' || activePlan.status === 'Correction Requested');
    const canRequestChange = !isSuperAdmin && (activePlan.status === 'Submitted' || activePlan.status === 'Approved');
    const canReview = isSuperAdmin && (activePlan.status === 'Submitted' || activePlan.status === 'Resubmitted');
    const villages = activePlan.villagesList?.join(', ') || activePlan.villageName || '—';
    const outcomes = activePlan.expectedOutcomes?.length ? activePlan.expectedOutcomes : (activePlan.expectedOutcome || '').split('\n').filter(Boolean);
    const roster: NonNullable<LessonPlan['volunteerRoster']> = activePlan.volunteerRoster?.length
      ? activePlan.volunteerRoster
      : (activePlan.assignedVolunteers || []).map((name) => ({ name, role: '', phone: '', year: '' }));
    return (
      <main className="mx-auto w-full max-w-6xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={backToList} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#123C75]"><ArrowLeft className="h-4 w-4" /> Back to Lesson Plans</button>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={activePlan.status} />
            <button type="button" onClick={() => exportLessonPlanPdf({ ...activePlan, cluster: getClusterDisplayName(activePlan) })} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" /> Export PDF</button>
            {canEdit && <button type="button" onClick={() => openEdit(activePlan)} className="rounded-xl bg-[#123C75] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#0D2F5D]">Edit</button>}
            {canRequestChange && <>
              <button type="button" onClick={() => { setRequestType('edit'); setRequestReason(''); }} className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-700">Request Edit</button>
              <button type="button" onClick={() => { setRequestType('delete'); setRequestReason(''); }} className="rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2 text-sm font-semibold text-orange-700">Request Delete</button>
            </>}
            {activePlan.status === 'Draft' && !isSuperAdmin && <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button>}
          </div>
        </div>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <article className="space-y-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-9">
          <header className="border-b-2 border-[#123C75] pb-5 text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-[#F0F6FF]"><img src="/logo.png" alt="TQI" className="max-h-12 max-w-12 object-contain" /></div>
            <h1 className="text-lg font-extrabold tracking-wide text-slate-900">TALENT QUEST FOR INDIA</h1>
            <p className="text-sm font-medium text-slate-600">Student Holistic Development Program</p>
            <p className="mt-3 text-base font-bold uppercase tracking-wide text-[#123C75]">Lesson Plan for the Summit</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">Academic Year: {activePlan.academicYear || currentAcademicYear || '—'}</p>
          </header>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Cluster', getClusterDisplayName(activePlan)], ['Team', activePlan.teamCollegeName || activePlan.collegeName || '—'], ['Panchayat', activePlan.panchayatNames?.join(', ') || activePlan.panchayatName || '—'], ['Village Name', villages],
              ['No. of Summit', activePlan.summitNumbers || '—'], ['Session / Day', `Day ${activePlan.dayNumber || 1}`],
              ['Planned Date', activePlan.date || '—'], ['Submitted By', activePlan.submittedBy || activePlan.createdBy || '—'], ['Submitted Date', activePlan.submittedAt ? new Date(activePlan.submittedAt).toLocaleDateString() : activePlan.lastUpdated || '—'],
            ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-[#F8FAFD] p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-sm font-semibold text-slate-800">{value}</div></div>)}
          </section>

          <DocumentSection title="Overview"><p className="whitespace-pre-line text-sm leading-7 text-slate-700">{activePlan.overview || activePlan.objective || '—'}</p></DocumentSection>
          <DocumentSection title="Lesson Plan Content">{activePlan.gradeSegments?.length ? activePlan.gradeSegments.map((segment, index) => <div key={`${segment.grade}-${index}`} className="mb-3 last:mb-0"><div className="font-semibold text-slate-800">{segment.title || 'Summit content'}</div><p className="whitespace-pre-line text-sm leading-7 text-slate-700">{segment.description}</p></div>) : <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{activePlan.description || '—'}</p>}</DocumentSection>
          <DocumentSection title="Detailed View / Activities"><div className="overflow-x-auto"><table className="w-full min-w-[560px] border-collapse text-left text-sm"><thead className="bg-[#EFF5FC] text-xs uppercase text-slate-600"><tr><th className="border border-slate-200 p-2.5">S.No</th><th className="border border-slate-200 p-2.5">Activity / Task</th><th className="border border-slate-200 p-2.5">Description</th><th className="border border-slate-200 p-2.5">Time (mins)</th></tr></thead><tbody>{(activePlan.activitiesDetailed || []).map((activity, index) => <tr key={`${activity.activityNumber}-${index}`} className="break-inside-avoid"><td className="border border-slate-200 p-2.5">{index + 1}</td><td className="border border-slate-200 p-2.5 font-semibold">{activity.title || '—'}</td><td className="whitespace-pre-line border border-slate-200 p-2.5">{activity.description || '—'}</td><td className="border border-slate-200 p-2.5">{activity.duration || '—'}</td></tr>)}</tbody></table></div></DocumentSection>
          <DocumentSection title="Expected Outcome"><ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">{outcomes.length ? outcomes.map((outcome, index) => <li key={index}>{outcome}</li>) : <li>—</li>}</ul></DocumentSection>
          <DocumentSection title="Volunteers Involved"><div className="overflow-x-auto"><table className="w-full min-w-[420px] border-collapse text-left text-sm"><thead className="bg-[#EFF5FC] text-xs uppercase text-slate-600"><tr><th className="w-16 border border-slate-200 p-2.5">S.No</th><th className="border border-slate-200 p-2.5">Volunteer Name</th><th className="w-36 border border-slate-200 p-2.5">Contact</th><th className="w-24 border border-slate-200 p-2.5">Year</th></tr></thead><tbody>{roster.map((volunteer, index) => <tr key={`${volunteer.name}-${index}`} className="break-inside-avoid"><td className="border border-slate-200 p-2.5">{index + 1}</td><td className="border border-slate-200 p-2.5 font-medium">{volunteer.name}</td><td className="border border-slate-200 p-2.5">{volunteer.phone || '—'}</td><td className="border border-slate-200 p-2.5">{volunteer.year || '—'}</td></tr>)}</tbody></table></div></DocumentSection>
          {activePlan.correctionReason && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Correction / edit feedback</strong><p className="mt-1 whitespace-pre-line">{activePlan.correctionReason}</p></div>}
          {(activePlan.editRequestReason || activePlan.deleteRequestReason) && <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800"><strong>Request reason</strong><p className="mt-1 whitespace-pre-line">{activePlan.editRequestReason || activePlan.deleteRequestReason}</p></div>}
          {canReview && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-5"><button type="button" disabled={busy} onClick={() => setCorrectionOpen(true)} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50">Send for Resubmission</button><button type="button" disabled={busy} onClick={() => void runReview('approve')} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Approve</button></div>}
        </article>

        {correctionOpen && <Modal title="Send Lesson Plan for Correction" onClose={() => setCorrectionOpen(false)}><label className="block text-sm font-semibold text-slate-700">Correction / Feedback <span className="text-red-600">*</span></label><textarea rows={5} value={correctionText} onChange={(event) => setCorrectionText(event.target.value)} placeholder="Please correct the village name and update the expected outcomes." className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none" /><ModalActions onCancel={() => setCorrectionOpen(false)} confirmLabel="Send for Resubmission" disabled={!correctionText.trim() || busy} onConfirm={() => { void runReview('correction', correctionText.trim()); setCorrectionText(''); }} /></Modal>}
        {requestType && <Modal title={requestType === 'edit' ? 'Request Edit Access' : 'Request Lesson Plan Deletion'} onClose={() => setRequestType(null)}><label className="block text-sm font-semibold text-slate-700">Reason for {requestType === 'edit' ? 'edit' : 'deletion'} <span className="text-red-600">*</span></label><textarea rows={4} value={requestReason} onChange={(event) => setRequestReason(event.target.value)} placeholder={requestType === 'edit' ? 'Correction required in village name.' : 'Explain why this submitted lesson plan should be deleted.'} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none" /><ModalActions onCancel={() => setRequestType(null)} confirmLabel="Send Request" disabled={!requestReason.trim() || busy} onConfirm={() => void submitRequest()} /></Modal>}
        {deleteConfirmOpen && <Modal title="Delete Draft Lesson Plan?" onClose={() => setDeleteConfirmOpen(false)}><p className="text-sm leading-6 text-slate-600">This draft will be permanently deleted. Submitted and approved plans must go through Super Admin approval.</p><ModalActions onCancel={() => setDeleteConfirmOpen(false)} confirmLabel="Delete Draft" destructive disabled={busy} onConfirm={() => void deleteDraft()} /></Modal>}
      </main>
    );
  }

  if (viewMode === 'create' || viewMode === 'edit') {
    const teamName = activeCluster?.collegeName || activeCluster?.name || currentCluster || '—';
    return (
      <main className="mx-auto w-full max-w-5xl space-y-5 pb-8">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><button type="button" onClick={backToList} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><ArrowLeft className="h-5 w-5" /></button><div><h1 className="text-xl font-bold text-slate-900">{viewMode === 'edit' ? 'Edit Lesson Plan' : 'Create Lesson Plan'}</h1><p className="mt-1 text-sm text-slate-500">Official TQI Summit lesson-plan structure · {currentAcademicYear || 'Academic year'}</p></div></div></div>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-7"><div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F0F6FF]"><img src="/logo.png" alt="TQI" className="max-h-10 max-w-10 object-contain" /></div><h2 className="text-sm font-extrabold tracking-wide text-slate-900">TALENT QUEST FOR INDIA</h2><p className="text-xs text-slate-500">Student Holistic Development Program</p><p className="mt-2 text-sm font-bold uppercase tracking-wide text-[#123C75]">Lesson Plan for the Summit</p><p className="mt-1 text-xs text-slate-500">Academic Year: {currentAcademicYear || '—'}</p></div>
        <SectionCard title="Basic Information" description="Cluster, team, session date, and academic year are filled from your account and schedule.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ReadOnlyField label="Cluster" value={activeCluster?.name || currentCluster || '—'} />
            <ReadOnlyField label="Team" value={teamName} />
            <ReadOnlyField label="Session / Day" value={`Day ${form.dayNumber} · ${schedule?.name || 'Summit session'}`} />
            <ReadOnlyField label="Planned Date" value={plannedDate || 'No date scheduled'} />
            <ReadOnlyField label="Academic Year" value={currentAcademicYear || '—'} />
            <MultiSelectField
              label="Panchayat"
              placeholder="Select panchayat(s)"
              options={clusterPanchayats.map((panchayat) => ({ value: panchayat.id, label: panchayat.name }))}
              selected={form.panchayatIds}
              onChange={(selected) => setForm((current) => ({
                ...current,
                panchayatIds: selected,
                villageIds: current.villageIds.filter((villageId) => clusterVillages.some((village) => village.id === villageId && selected.includes(village.panchayatId))),
              }))}
            />
            <MultiSelectField
              label="Village Name"
              placeholder={form.panchayatIds.length ? 'Select village(s)' : 'Select panchayat first'}
              options={selectableVillages.map((village) => ({ value: village.id, label: `${village.name} · ${village.panchayatName}` }))}
              selected={form.villageIds}
              disabled={!form.panchayatIds.length}
              onChange={(selected) => setForm((current) => ({ ...current, villageIds: selected }))}
            />
            <MultiSelectField
              label="No. of Summit"
              placeholder="Select summit number(s)"
              options={['I', 'II', 'III', 'IV'].map((value) => ({ value, label: `Summit ${value}` }))}
              selected={form.summitNumbers}
              onChange={(selected) => setForm((current) => ({ ...current, summitNumbers: selected }))}
            />
            <MultiSelectField
              label="Grade"
              placeholder="Select grade(s)"
              options={['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map((value) => ({ value, label: value }))}
              selected={form.grades}
              onChange={(selected) => setForm((current) => ({ ...current, grades: selected }))}
            />
          </div>
        </SectionCard>
        <SectionCard title="Overview" description="Write a concise overview of the summit lesson and its holistic development focus."><textarea rows={5} value={form.overview} onChange={(event) => setForm((current) => ({ ...current, overview: event.target.value }))} placeholder="Enter the lesson plan overview…" className="w-full rounded-xl border border-slate-200 p-3 text-sm leading-6 outline-none focus:border-blue-500" /></SectionCard>
        <SectionCard title="Lesson Plan Content" description="Describe the learning sequence and facilitation for this summit day."><textarea rows={5} value={form.lessonPlanContent} onChange={(event) => setForm((current) => ({ ...current, lessonPlanContent: event.target.value }))} placeholder="Describe the lesson content, learning sequence, and facilitation…" className="w-full rounded-xl border border-slate-200 p-3 text-sm leading-6 outline-none focus:border-blue-500" /></SectionCard>
        <SectionCard title="Detailed View / Activities" description="Add session activities, their instructions, and allocated time."><div className="space-y-3">{form.activities.map((activity, index) => <div key={index} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-[70px_1fr_130px_40px]"><div className="text-xs font-semibold text-slate-500">Activity {index + 1}</div><div className="space-y-2"><input value={activity.title} onChange={(event) => setForm((current) => ({ ...current, activities: current.activities.map((row, rowIndex) => rowIndex === index ? { ...row, title: event.target.value } : row) }))} placeholder="Activity / task" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" /><textarea rows={2} value={activity.description} onChange={(event) => setForm((current) => ({ ...current, activities: current.activities.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row) }))} placeholder="Description" className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm" /></div><label className="text-xs font-semibold text-slate-600">Time (mins)<input type="number" min="0" value={activity.duration || ''} onChange={(event) => setForm((current) => ({ ...current, activities: current.activities.map((row, rowIndex) => rowIndex === index ? { ...row, duration: Number(event.target.value) } : row) }))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" /></label><button type="button" disabled={form.activities.length === 1} onClick={() => setForm((current) => ({ ...current, activities: current.activities.filter((_, rowIndex) => rowIndex !== index) }))} className="self-center rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" aria-label="Remove activity"><X className="h-4 w-4" /></button></div>)}</div><button type="button" onClick={() => setForm((current) => ({ ...current, activities: [...current.activities, { activityNumber: current.activities.length + 1, title: '', description: '', duration: 0 }] }))} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Plus className="h-4 w-4" /> Add activity</button></SectionCard>
        <SectionCard title="Expected Outcome" description="Add measurable learning or development outcomes."><div className="space-y-2">{form.expectedOutcomes.map((outcome, index) => <div key={index} className="flex gap-2"><span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-[#2D6BAF]" /><input value={outcome} onChange={(event) => setForm((current) => ({ ...current, expectedOutcomes: current.expectedOutcomes.map((value, rowIndex) => rowIndex === index ? event.target.value : value) }))} placeholder="Add an expected outcome" className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm" /><button type="button" disabled={form.expectedOutcomes.length === 1} onClick={() => setForm((current) => ({ ...current, expectedOutcomes: current.expectedOutcomes.filter((_, rowIndex) => rowIndex !== index) }))} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" aria-label="Remove outcome"><X className="h-4 w-4" /></button></div>)}</div><button type="button" onClick={() => setForm((current) => ({ ...current, expectedOutcomes: [...current.expectedOutcomes, ''] }))} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Plus className="h-4 w-4" /> Add outcome</button></SectionCard>
        <SectionCard title="Volunteers Involved" description="Select volunteers assigned to your cluster; their roles are included automatically.">
          <MultiSelectField
            label="Select Volunteers"
            placeholder="Choose volunteer(s)"
            options={selectableVolunteers.map((volunteer) => ({ value: volunteer.id, label: `${volunteer.name} · ${volunteer.role || 'Volunteer'}` }))}
            selected={form.volunteerIds}
            onChange={(selected) => setForm((current) => ({ ...current, volunteerIds: selected }))}
          />
          {!selectableVolunteers.length && <p className="text-xs text-slate-500">No active volunteers are assigned to this cluster.</p>}
        </SectionCard>
        <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-200 pt-4 sm:flex-row"><button type="button" onClick={backToList} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button><button type="button" disabled={busy} onClick={() => void savePlan('Draft')} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">Save Draft</button><button type="button" disabled={busy} onClick={openSubmitConfirmation} className="rounded-xl bg-[#123C75] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{['Corrections Required', 'Correction Requested'].includes(String(form.status || '')) ? 'Resubmit for Approval' : 'Submit Lesson Plan'}</button></div>
        {submitConfirmOpen && <Modal title="Confirm Lesson Plan Submission" onClose={() => setSubmitConfirmOpen(false)}><p className="text-sm leading-6 text-slate-600">Are you sure you want to submit this lesson plan?</p><p className="mt-2 text-sm leading-6 text-slate-600">Once submitted, direct editing and deletion will be disabled.</p><ModalActions onCancel={() => setSubmitConfirmOpen(false)} confirmLabel={['Corrections Required', 'Correction Requested'].includes(String(form.status || '')) ? 'Resubmit' : 'Submit'} disabled={busy} onConfirm={() => void confirmSubmit()} /></Modal>}
      </main>
    );
  }

  const planVillages = [...new Set(availablePlans.flatMap((plan) => plan.villagesList?.length ? plan.villagesList : [plan.villageName || '']).filter(Boolean))].sort();
  const shownClusters = clusters.filter((cluster) => cluster.status !== 'Inactive');
  const summary = [
    { label: 'Total Plans', value: statusCounts.total, icon: <BookOpen className="h-5 w-5" />, tone: 'border-slate-200 bg-white text-slate-800' },
    { label: 'Draft', value: statusCounts.draft, icon: <FileText className="h-5 w-5" />, tone: 'border-amber-200 bg-amber-50/60 text-amber-800' },
    { label: 'Submitted', value: statusCounts.submitted, icon: <Clock className="h-5 w-5" />, tone: 'border-blue-200 bg-blue-50/60 text-blue-800' },
    { label: 'Approved', value: statusCounts.approved, icon: <CheckCircle2 className="h-5 w-5" />, tone: 'border-emerald-200 bg-emerald-50/60 text-emerald-800' },
    { label: 'Corrections Required', value: statusCounts.corrections, icon: <AlertTriangle className="h-5 w-5" />, tone: 'border-red-200 bg-red-50/60 text-red-800' },
  ];
  const dayNumbers = isSuperAdmin
    ? [...new Set(filteredPlans.map((plan) => Number(plan.dayNumber || 1)))].sort((first, second) => first - second)
    : dayFilter === 'all'
      ? Array.from({ length: 8 }, (_, index) => index + 1)
      : [Number(dayFilter)];

  return (
    <main className="w-full space-y-6">
      <header className="rounded-3xl border border-[#DDE9F8] bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Summit Lesson Plans</h1><span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{currentAcademicYear || 'Academic year'}</span></div><p className="mt-2 text-sm text-slate-600">Create and manage lesson plans for the 8-day summit.</p></header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{summary.map((card) => <div key={card.label} className={`rounded-2xl border p-4 shadow-sm ${card.tone}`}><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</span><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80">{card.icon}</span></div><div className="mt-3 text-3xl font-bold tracking-tight">{card.value}</div></div>)}</section>
      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><div className="relative xl:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search lesson plans" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-400" /></div>
          <FilterSelect label="Cluster" value={clusterFilter} onChange={setClusterFilter} options={[['all', 'All Clusters'], ...shownClusters.map((cluster) => [cluster.id, cluster.name] as [string, string])]} />
          <FilterSelect label="Village" value={villageFilter} onChange={setVillageFilter} options={[['all', 'All Villages'], ...planVillages.map((village) => [village, village] as [string, string])]} />
          <FilterSelect label="Day" value={dayFilter} onChange={setDayFilter} options={[[ 'all', 'All Days'], ...Array.from({ length: 8 }, (_, index) => [String(index + 1), `Day ${index + 1}`] as [string, string])]} />
          <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={[[ 'all', 'All Statuses'], ['Draft', 'Draft'], ['Submitted', 'Submitted'], ['Corrections Required', 'Corrections Required'], ['Approved', 'Approved'], ['Edit Request Pending', 'Edit Request Pending'], ['Delete Request Pending', 'Delete Request Pending']]} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3"><p className="text-xs text-slate-500">Showing {filteredPlans.length} of {availablePlans.length} lesson plans</p><button type="button" onClick={resetFilters} className="text-xs font-semibold text-[#123C75] hover:underline">Reset filters</button></div>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dayNumbers.map((dayNumber) => {
          const plan = filteredPlans.find((candidate) => Number(candidate.dayNumber || 1) === dayNumber);
          const daySchedule = sessions.find((session) => Number(session.dayNumber) === dayNumber);
          const dayDate = plan?.date || (daySchedule?.date ? String(daySchedule.date).slice(0, 10) : 'Date not set');
          const villageNames = plan?.villagesList?.join(', ') || plan?.villageName || '';
          const panchayatNames = plan?.panchayatNames?.join(', ') || plan?.panchayatName || '';
          const location = [panchayatNames, villageNames].filter(Boolean).join(' · ');
          const isCorrection = plan?.status === 'Corrections Required' || plan?.status === 'Correction Requested';
          const statusTone = !plan
            ? 'border-slate-200 bg-slate-50 text-slate-600'
            : plan.status === 'Approved'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : isCorrection
                ? 'border-red-200 bg-red-50 text-red-700'
                : plan.status === 'Submitted' || plan.status === 'Resubmitted'
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : plan.status === 'Edit Request Pending' || plan.status === 'Delete Request Pending'
                    ? 'border-orange-200 bg-orange-50 text-orange-700'
                    : 'border-amber-200 bg-amber-50 text-amber-800';
          return (
            <article key={dayNumber} className="flex min-h-[245px] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EFF5FC] text-[#123C75]"><Clock className="h-5 w-5" /></span>
                  <div><h2 className="text-lg font-bold text-slate-900">Day {dayNumber}</h2><p className="mt-0.5 text-xs text-slate-500">{dayDate}</p></div>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusTone}`}>{plan ? (isCorrection ? 'Corrections Required' : plan.status || 'Draft') : 'Not Created'}</span>
              </div>
              {plan ? (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
                    <PlanMeta label="Cluster" value={getClusterDisplayName(plan)} />
                    <PlanMeta label="Village" value={location || '—'} />
                    <PlanMeta label="No. of Summit" value={plan.summitNumbers || '—'} />
                    <PlanMeta label="Submitted by" value={plan.submittedBy || plan.createdByName || '—'} />
                  </div>
                  <p className="mt-3 line-clamp-2 flex-1 text-xs leading-5 text-slate-600">{plan.overview || plan.objective || 'No overview provided.'}</p>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button type="button" onClick={() => { setActivePlanId(plan.id); setViewMode('detail'); }} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-[#123C75] hover:bg-blue-50"><Eye className="h-3.5 w-3.5" /> View</button>
                    <button type="button" onClick={() => exportLessonPlanPdf({ ...plan, cluster: getClusterDisplayName(plan) })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Download className="h-3.5 w-3.5" /> Export PDF</button>
                    {!isSuperAdmin && (plan.status === 'Draft' || isCorrection) && <button type="button" onClick={() => openEdit(plan)} className="rounded-lg bg-[#123C75] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0D2F5D]">{isCorrection ? 'Resubmit' : 'Edit'}</button>}
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-start justify-center py-5">
                  <p className="text-sm font-semibold text-slate-700">No lesson plan for this day yet</p>
                  <p className="mt-1 text-xs text-slate-500">Create a plan when this summit day is ready.</p>
                  {!isSuperAdmin && <button type="button" onClick={() => openCreate(dayNumber)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#123C75] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0D2F5D]"><Plus className="h-3.5 w-3.5" /> Create Lesson Plan</button>}
                </div>
              )}
            </article>
          );
        })}
        {isSuperAdmin && dayNumbers.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#123C75] shadow-sm"><BookOpen className="h-6 w-6" /></div><h2 className="mt-3 text-base font-bold text-slate-800">No submitted lesson plans</h2><p className="mt-1 text-sm text-slate-500">Plans submitted by Cluster Admins will appear here for review.</p></div>}
      </section>
      {submitConfirmOpen && <Modal title="Confirm Lesson Plan Submission" onClose={() => setSubmitConfirmOpen(false)}><p className="text-sm leading-6 text-slate-600">Are you sure you want to submit this lesson plan?</p><p className="mt-2 text-sm leading-6 text-slate-600">Once submitted, direct editing and deletion will be disabled.</p><ModalActions onCancel={() => setSubmitConfirmOpen(false)} confirmLabel={['Corrections Required', 'Correction Requested'].includes(String(form.status || '')) ? 'Resubmit' : 'Submit'} disabled={busy} onConfirm={() => void confirmSubmit()} /></Modal>}
    </main>
  );
};

const DocumentSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <section className="space-y-3"><h2 className="border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wide text-[#123C75]">{title}</h2>{children}</section>;
const SectionCard: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><header className="border-b border-slate-100 pb-3"><h2 className="text-base font-bold text-slate-900">{title}</h2>{description && <p className="mt-1 text-xs text-slate-500">{description}</p>}</header>{children}</section>;
const ReadOnlyField: React.FC<{ label: string; value: string }> = ({ label, value }) => <div><div className="mb-1.5 text-xs font-semibold text-slate-700">{label}</div><div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">{value}</div></div>;
const PlanMeta: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div><div className="truncate pt-0.5 font-medium text-slate-700" title={value}>{value}</div></div>;
const FilterSelect: React.FC<{ label: string; value: string; onChange: (value: string) => void; options: [string, string][] }> = ({ label, value, onChange, options }) => <div><label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</label><Select value={value} onValueChange={onChange}><SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs"><SelectValue /></SelectTrigger><SelectContent>{options.map(([optionValue, labelText]) => <SelectItem key={`${label}-${optionValue}`} value={optionValue}>{labelText}</SelectItem>)}</SelectContent></Select></div>;
const MultiSelectField: React.FC<{
  label: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}> = ({ label, placeholder, options, selected, onChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
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

  return (
    <div ref={fieldRef} className="relative min-w-0">
      <label className="mb-1.5 block text-xs font-semibold text-slate-700">{label} <span className="text-red-600">*</span></label>
      <div
        aria-expanded={isOpen}
        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm shadow-sm outline-none transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 ${disabled ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'cursor-pointer'}`}
      >
        <button type="button" disabled={disabled} onClick={() => setIsOpen((open) => !open)} className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-left">
          {selectedLabels.length ? selectedLabels.map((selectedLabel, index) => {
            return <span key={`${selectedLabel}-${index}`} className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[11px] font-medium text-[#123C75]"><span className="truncate">{selectedLabel}</span><span className="text-blue-400">✓</span></span>;
          }) : <span className="text-slate-500">{placeholder}</span>}
        </button>
        <button type="button" disabled={disabled} aria-label={`Toggle ${label} options`} onClick={() => setIsOpen((open) => !open)} className="shrink-0 px-1 text-slate-400 disabled:cursor-not-allowed">{isOpen ? '⌃' : '⌄'}</button>
      </div>
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          {selected.length > 0 && <div className="mb-1 border-b border-slate-100 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Selected · {selected.length}</div>}
          {sortedOptions.length ? sortedOptions.map((option) => (
            <label key={option.value} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-blue-50 ${selected.includes(option.value) ? 'font-semibold text-[#123C75]' : 'text-slate-700'}`}>
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={(event) => {
                  onChange(event.target.checked
                    ? [...selected, option.value]
                    : selected.filter((value) => value !== option.value));
                }}
                className="h-4 w-4 rounded border-slate-300 accent-[#123C75]"
              />
              <span>{option.label}</span>
            </label>
          )) : <p className="px-3 py-2 text-xs text-slate-500">No options available.</p>}
        </div>
      )}
    </div>
  );
};
const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl"><header className="flex items-center justify-between gap-3"><h2 className="text-base font-bold text-slate-900">{title}</h2><button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X className="h-5 w-5" /></button></header>{children}</section></div>;
const ModalActions: React.FC<{ onCancel: () => void; onConfirm: () => void; confirmLabel: string; disabled?: boolean; destructive?: boolean }> = ({ onCancel, onConfirm, confirmLabel, disabled, destructive }) => <div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600">Cancel</button><button type="button" disabled={disabled} onClick={onConfirm} className={`rounded-xl px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50 ${destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-[#123C75] hover:bg-[#0D2F5D]'}`}>{confirmLabel}</button></div>;
