import React, { useState, useMemo } from 'react';
import { TabType, LessonPlan, Panchayat, Volunteer, Session, UserRole } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Plus, Search, BookOpen, AlertTriangle, X, Download, Trash2, Edit3, Eye, CheckCircle2, ArrowLeft } from './ui/icons';
import { exportLessonPlanExcel, exportAllLessonPlansExcel, exportLessonPlanPdf } from '../utils/exportUtils';

interface LessonPlanViewProps {
  lessonPlans: LessonPlan[];
  sessions: Session[];
  panchayats: Panchayat[];
  volunteers: Volunteer[];
  currentUserRole?: UserRole;
  currentCluster?: string;
  currentAcademicYear?: string;
  selectedLessonPlanId?: string;
  onNavigate: (tab: TabType, targetId?: string) => void;
  onAddLessonPlan: (plan: Omit<LessonPlan, 'id'>) => void;
  onUpdateLessonPlan: (id: string, updated: Partial<LessonPlan>) => void;
  onDeleteLessonPlan?: (id: string) => void;
  onRefreshLessonPlans?: () => Promise<void>;
}

type ViewMode = 'list' | 'create' | 'edit' | 'detail';

export const LessonPlanView: React.FC<LessonPlanViewProps> = ({
  lessonPlans = [],
  sessions = [],
  panchayats = [],
  volunteers = [],
  currentUserRole = 'Cluster Admin',
  currentCluster = 'Dharmapuri',
  currentAcademicYear = '2025 – 2026',
  selectedLessonPlanId,
  onNavigate,
  onAddLessonPlan,
  onUpdateLessonPlan,
  onDeleteLessonPlan,
  onRefreshLessonPlans,
}) => {
  // Navigation / View Modes: 'list', 'create', 'edit', 'detail'
  const [viewMode, setViewMode] = useState<ViewMode>(() => selectedLessonPlanId ? 'detail' : 'list');
  const [activePlanDetail, setActivePlanDetail] = useState<LessonPlan | null>(() => {
    if (selectedLessonPlanId) {
      return lessonPlans.find((lp) => lp.id === selectedLessonPlanId || lp.sessionId === selectedLessonPlanId) || null;
    }
    return null;
  });

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Correction Modal
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionReasonInput, setCorrectionReasonInput] = useState('');

  // Clean form state without prefilled placeholder texts
  const emptyFormState = {
    id: '',
    program: 'TALENT QUEST FOR INDIA • STUDENT HOLISTIC DEVELOPMENT PROGRAM',
    academicYear: currentAcademicYear,
    cluster: currentCluster,
    teamCollegeName: '',
    panchayatId: '',
    panchayatName: '',
    villagesText: '',
    summitNumbers: '',
    dayNumber: 1,
    grades: '',
    plannedDate: new Date().toISOString().split('T')[0],
    topic: '',
    overview: '',
    grade9Title: '',
    grade9Description: '',
    grade11Title: '',
    grade11Description: '',
    activity1Title: '',
    activity1Description: '',
    activity2Title: '',
    activity2Description: '',
    expectedOutcome: '',
    volunteersText: '',
    status: 'Draft' as LessonPlan['status'],
  };

  const [formData, setFormData] = useState(emptyFormState);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Filtered Lesson Plans
  const filteredPlans = useMemo(() => {
    return lessonPlans.filter((lp) => {
      const topic = (lp.topic || lp.title || '').toLowerCase();
      const cluster = (lp.cluster || lp.clusterId || '').toLowerCase();
      const college = (lp.teamCollegeName || lp.collegeName || '').toLowerCase();
      const vill = (lp.villagesList?.join(', ') || lp.villageName || '').toLowerCase();
      const search = searchTerm.toLowerCase().trim();

      const matchSearch =
        !search ||
        topic.includes(search) ||
        cluster.includes(search) ||
        college.includes(search) ||
        vill.includes(search) ||
        (lp.overview || lp.objective || '').toLowerCase().includes(search);

      const matchDay = selectedDayFilter === 'all' || (lp.dayNumber || 1) === selectedDayFilter;
      const matchStatus = selectedStatus === 'all' || (lp.status || '').toLowerCase() === selectedStatus.toLowerCase();

      return matchSearch && matchDay && matchStatus;
    });
  }, [lessonPlans, searchTerm, selectedDayFilter, selectedStatus]);

  // Counts
  const totalCount = lessonPlans.length;
  const approvedCount = lessonPlans.filter((lp) => lp.status === 'Approved').length;
  const submittedCount = lessonPlans.filter((lp) => lp.status === 'Submitted' || lp.status === 'Resubmitted').length;
  const correctionCount = lessonPlans.filter((lp) => lp.status === 'Correction Requested' || (lp.status as string) === 'Rejected').length;

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedDayFilter('all');
    setSelectedStatus('all');
  };

  // Open Full-Page Create View
  const handleOpenCreateView = () => {
    setFormErrors({});
    setFormData({
      ...emptyFormState,
      dayNumber: selectedDayFilter !== 'all' ? selectedDayFilter : 1,
      cluster: currentCluster,
      academicYear: currentAcademicYear,
    });
    setViewMode('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open Full-Page Edit View
  const handleOpenEditView = (plan: LessonPlan) => {
    setFormErrors({});
    const act1 = plan.activitiesDetailed?.[0];
    const act2 = plan.activitiesDetailed?.[1];
    const gr9 = plan.gradeSegments?.find(g => g.grade.includes('9')) || plan.gradeSegments?.[0];
    const gr11 = plan.gradeSegments?.find(g => g.grade.includes('11')) || plan.gradeSegments?.[1];

    setFormData({
      id: plan.id,
      program: 'TALENT QUEST FOR INDIA • STUDENT HOLISTIC DEVELOPMENT PROGRAM',
      academicYear: plan.academicYear || currentAcademicYear,
      cluster: plan.cluster || currentCluster,
      teamCollegeName: plan.teamCollegeName || plan.collegeName || '',
      panchayatId: plan.panchayatId || '',
      panchayatName: plan.panchayatName || '',
      villagesText: plan.villagesList?.join(', ') || plan.villageName || '',
      summitNumbers: plan.summitNumbers || '',
      dayNumber: plan.dayNumber || 1,
      grades: plan.grades || plan.targetStandard || '',
      plannedDate: plan.date || new Date().toISOString().split('T')[0],
      topic: plan.topic || plan.title || '',
      overview: plan.overview || plan.objective || '',
      grade9Title: gr9?.title || '',
      grade9Description: gr9?.description || '',
      grade11Title: gr11?.title || '',
      grade11Description: gr11?.description || '',
      activity1Title: act1?.title || '',
      activity1Description: act1?.description || '',
      activity2Title: act2?.title || '',
      activity2Description: act2?.description || '',
      expectedOutcome: plan.expectedOutcome || (plan.learningOutcomes?.join('\n') || ''),
      volunteersText: plan.assignedVolunteers?.join(', ') || plan.volunteerName || '',
      status: plan.status || 'Draft',
    });
    setViewMode('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open Full-Page Document Detail View
  const handleOpenDetailView = (plan: LessonPlan) => {
    setActivePlanDetail(plan);
    setViewMode('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Form Submit
  const handleFormSubmit = (targetStatus: LessonPlan['status']) => {
    const errors: Record<string, string> = {};
    if (!formData.topic.trim()) errors.topic = 'Please enter the session topic or theme.';
    if (!formData.teamCollegeName.trim()) errors.teamCollegeName = 'Please enter the team or college name.';
    if (!formData.villagesText.trim()) errors.villagesText = 'Please enter covered village names.';
    if (!formData.overview.trim()) errors.overview = 'Please enter the session overview.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const villagesList = formData.villagesText.split(',').map(s => s.trim()).filter(Boolean);
    const assignedVolunteers = formData.volunteersText.split(',').map(s => s.trim()).filter(Boolean);

    const gradeSegments = [
      { grade: 'Grade IX', title: formData.grade9Title.trim(), description: formData.grade9Description.trim() },
      { grade: 'Grade XI', title: formData.grade11Title.trim(), description: formData.grade11Description.trim() }
    ].filter(g => g.title || g.description);

    const activitiesDetailed = [
      { activityNumber: 1, title: formData.activity1Title.trim(), description: formData.activity1Description.trim() },
      { activityNumber: 2, title: formData.activity2Title.trim(), description: formData.activity2Description.trim() }
    ].filter(a => a.title || a.description);

    const payload: Partial<LessonPlan> = {
      title: formData.topic.trim(),
      topic: formData.topic.trim(),
      academicYear: formData.academicYear,
      cluster: formData.cluster,
      teamCollegeName: formData.teamCollegeName.trim(),
      panchayatId: formData.panchayatId,
      panchayatName: formData.panchayatName,
      villagesList: villagesList,
      villageName: villagesList[0] || '',
      summitNumbers: formData.summitNumbers.trim(),
      dayNumber: formData.dayNumber,
      grades: formData.grades.trim(),
      targetStandard: formData.grades.trim(),
      date: formData.plannedDate,
      overview: formData.overview.trim(),
      objective: formData.overview.trim(),
      gradeSegments: gradeSegments,
      activitiesDetailed: activitiesDetailed,
      expectedOutcome: formData.expectedOutcome.trim(),
      assignedVolunteers: assignedVolunteers,
      volunteerName: assignedVolunteers[0] || '',
      status: targetStatus,
      lastUpdated: `${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    };

    if (viewMode === 'edit' && formData.id) {
      onUpdateLessonPlan(formData.id, payload);
      if (activePlanDetail?.id === formData.id) {
        setActivePlanDetail((prev) => (prev ? { ...prev, ...payload } : null));
      }
    } else {
      const newPlan: Omit<LessonPlan, 'id'> = {
        ...payload,
        sessionName: formData.topic.trim(),
        volunteersCount: assignedVolunteers.length,
      };
      onAddLessonPlan(newPlan);
    }

    setViewMode('list');
  };

  // Status Action: Approve
  const handleApprovePlan = (planId: string) => {
    onUpdateLessonPlan(planId, {
      status: 'Approved',
      correctionReason: undefined,
      correctionRequestedBy: undefined,
      lastUpdated: 'Approved by Super Admin',
    });
    if (activePlanDetail?.id === planId) {
      setActivePlanDetail((prev) => (prev ? { ...prev, status: 'Approved', correctionReason: undefined } : null));
    }
  };

  // Status Action: Submit Correction Request
  const handleSubmitCorrection = () => {
    if (!activePlanDetail || !correctionReasonInput.trim()) return;

    onUpdateLessonPlan(activePlanDetail.id, {
      status: 'Correction Requested',
      correctionReason: correctionReasonInput.trim(),
      correctionRequestedBy: currentUserRole === 'Super Admin' ? 'Super Admin' : 'Cluster Admin',
      correctionDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      lastUpdated: 'Correction requested',
    });

    setActivePlanDetail((prev) =>
      prev
        ? {
            ...prev,
            status: 'Correction Requested',
            correctionReason: correctionReasonInput.trim(),
            correctionRequestedBy: currentUserRole === 'Super Admin' ? 'Super Admin' : 'Cluster Admin',
            correctionDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          }
        : null
    );

    setIsCorrectionModalOpen(false);
    setCorrectionReasonInput('');
  };

  // Export PDF / Print
  const handlePrintPDF = () => {
    window.print();
  };

  // Status Badge Helper
  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Approved
          </span>
        );
      case 'Submitted':
      case 'Resubmitted':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Submitted
          </span>
        );
      case 'Correction Requested':
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Correction Requested
          </span>
        );
      case 'Draft':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
            Draft
          </span>
        );
    }
  };

  // ==========================================
  // VIEW 1: FULL DOCUMENT DETAIL VIEW (No popup)
  // ==========================================
  if (viewMode === 'detail' && activePlanDetail) {
    return (
      <div className="w-full max-w-5xl mx-auto space-y-6 pb-12">
        {/* Top Navigation Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>Back to All Lesson Plans</span>
          </button>

          <div className="flex items-center gap-2.5 flex-wrap">
            {renderStatusBadge(activePlanDetail.status)}
            <button
              type="button"
              onClick={() => exportLessonPlanExcel(activePlanDetail)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 text-sm font-semibold rounded-xl shadow-theme-xs transition"
              title="Export this Lesson Plan to Excel (.xlsx)"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={() => exportLessonPlanPdf(activePlanDetail)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 text-sm font-semibold rounded-xl shadow-theme-xs transition"
            >
              <Download className="w-4 h-4 text-brand-500" />
              <span>PDF Document</span>
            </button>
            {(currentUserRole === 'Super Admin' || activePlanDetail.status === 'Draft' || activePlanDetail.status === 'Correction Requested') && (
              <button
                type="button"
                onClick={() => handleOpenEditView(activePlanDetail)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl shadow-theme-xs transition"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Document</span>
              </button>
            )}
          </div>
        </div>

        {/* Official Printable Document Layout */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 sm:p-12 space-y-8 print:p-0 print:border-none print:shadow-none">
          {/* Official Letterhead */}
          <div className="text-center pb-6 border-b-2 border-gray-900 dark:border-gray-100 space-y-1.5">
            <h1 className="text-lg sm:text-2xl font-black tracking-wide uppercase text-gray-900 dark:text-white">
              TALENT QUEST FOR INDIA • STUDENT HOLISTIC DEVELOPMENT PROGRAM
            </h1>
            <div className="text-sm font-bold tracking-widest text-gray-600 dark:text-gray-400 uppercase">
              ACADEMIC YEAR : {activePlanDetail.academicYear || currentAcademicYear}
            </div>
            <div className="text-base sm:text-lg font-extrabold text-brand-600 dark:text-brand-400 uppercase tracking-wide pt-1">
              LESSON PLAN FOR THE SUMMIT
            </div>
          </div>

          {/* Key Metadata Table */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 bg-gray-50/80 dark:bg-white/[0.02] rounded-2xl border border-gray-200 dark:border-gray-800 text-sm">
            <div className="space-y-1">
              <span className="font-bold text-gray-900 dark:text-white">Cluster: </span>
              <span className="text-gray-700 dark:text-gray-300 font-medium">{activePlanDetail.cluster || currentCluster}</span>
            </div>
            <div className="space-y-1">
              <span className="font-bold text-gray-900 dark:text-white">Team: </span>
              <span className="text-gray-700 dark:text-gray-300 font-medium">{activePlanDetail.teamCollegeName || activePlanDetail.collegeName || 'Not Specified'}</span>
            </div>
            <div className="sm:col-span-2 space-y-1">
              <span className="font-bold text-gray-900 dark:text-white">Villages Name: </span>
              <span className="text-gray-700 dark:text-gray-300 font-medium">
                {activePlanDetail.villagesList?.join(', ') || activePlanDetail.villageName || 'Not Specified'}
              </span>
            </div>
            <div className="space-y-1">
              <span className="font-bold text-gray-900 dark:text-white">No. of the Summit: </span>
              <span className="text-gray-700 dark:text-gray-300 font-medium">{activePlanDetail.summitNumbers || '—'}</span>
            </div>
            <div className="space-y-1">
              <span className="font-bold text-gray-900 dark:text-white">No. of Session/Day: </span>
              <span className="text-gray-700 dark:text-gray-300 font-medium">Day {String(activePlanDetail.dayNumber || 1).padStart(2, '0')}</span>
            </div>
            <div className="space-y-1">
              <span className="font-bold text-gray-900 dark:text-white">Grade: </span>
              <span className="text-gray-700 dark:text-gray-300 font-medium">{activePlanDetail.grades || activePlanDetail.targetStandard || '—'}</span>
            </div>
            <div className="space-y-1">
              <span className="font-bold text-gray-900 dark:text-white">Planned Date: </span>
              <span className="text-gray-700 dark:text-gray-300 font-medium">{activePlanDetail.date || '—'}</span>
            </div>
          </div>

          {/* Section 1: Overview */}
          <div className="space-y-3">
            <h3 className="text-base font-extrabold uppercase tracking-wide text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-1.5">
              An Overview:
            </h3>
            <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed text-justify whitespace-pre-line">
              {activePlanDetail.overview || activePlanDetail.objective || 'No overview provided.'}
            </p>
          </div>

          {/* Section 2: Grade Modules */}
          {activePlanDetail.gradeSegments && activePlanDetail.gradeSegments.length > 0 && (
            <div className="space-y-6">
              {activePlanDetail.gradeSegments.map((segment, idx) => (
                <div key={idx} className="space-y-2">
                  <h3 className="text-base font-extrabold uppercase tracking-wide text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-1.5">
                    {segment.grade}: {segment.title}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed text-justify whitespace-pre-line">
                    {segment.description}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Section 3: Detailed Activities */}
          {activePlanDetail.activitiesDetailed && activePlanDetail.activitiesDetailed.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-base font-extrabold uppercase tracking-wide text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-1.5">
                Detailed View:
              </h3>
              <div className="space-y-5">
                {activePlanDetail.activitiesDetailed.map((act, idx) => (
                  <div key={idx} className="p-5 rounded-2xl bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200 dark:border-gray-800 space-y-2">
                    <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center font-bold">
                        {act.activityNumber || idx + 1}
                      </span>
                      <span>Event/Task/Activity – {act.activityNumber || idx + 1}: {act.title}</span>
                    </h4>
                    <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed text-justify whitespace-pre-line pl-8">
                      {act.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Expected Outcome */}
          <div className="space-y-3">
            <h3 className="text-base font-extrabold uppercase tracking-wide text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-1.5">
              Expected Outcome:
            </h3>
            <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed text-justify whitespace-pre-line">
              {activePlanDetail.expectedOutcome || 'No specific expected outcome recorded.'}
            </p>
          </div>

          {/* Section 5: Volunteers List */}
          <div className="space-y-3">
            <h3 className="text-base font-extrabold uppercase tracking-wide text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-1.5">
              Volunteers Name who going take session:
            </h3>
            {activePlanDetail.assignedVolunteers && activePlanDetail.assignedVolunteers.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
                {activePlanDetail.assignedVolunteers.map((vol, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-gray-800 text-sm font-semibold text-gray-800 dark:text-gray-200">
                    <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                    <span className="truncate">{vol}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No volunteers listed.</p>
            )}
          </div>

          {/* Review Feedback Alert if Correction Requested */}
          {activePlanDetail.correctionReason && (
            <div className="p-5 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20 rounded-2xl space-y-1.5">
              <div className="font-bold text-amber-900 dark:text-amber-300 text-sm flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span>Correction Feedback from {activePlanDetail.correctionRequestedBy || 'Reviewer'}:</span>
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-400 pl-7">&quot;{activePlanDetail.correctionReason}&quot;</p>
            </div>
          )}

          {/* Super Admin Decision Footer inside Detail View */}
          {currentUserRole === 'Super Admin' && (activePlanDetail.status === 'Submitted' || activePlanDetail.status === 'Resubmitted') && (
            <div className="pt-6 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCorrectionModalOpen(true)}
                className="px-5 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300 text-sm font-semibold transition"
              >
                Request Correction
              </button>
              <button
                type="button"
                onClick={() => handleApprovePlan(activePlanDetail.id)}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-theme-xs transition"
              >
                Approve Lesson Plan
              </button>
            </div>
          )}
        </div>

        {/* Correction Feedback Modal */}
        {isCorrectionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 border border-gray-200 dark:border-gray-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Request Plan Revision</h3>
                  <p className="text-xs text-gray-500">Provide actionable feedback to the cluster admin.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Required Changes / Feedback
                </label>
                <textarea
                  rows={4}
                  value={correctionReasonInput}
                  onChange={(e) => setCorrectionReasonInput(e.target.value)}
                  placeholder="Enter revision points clearly..."
                  className="w-full p-3 text-sm rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCorrectionModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!correctionReasonInput.trim()}
                  onClick={handleSubmitCorrection}
                  className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl disabled:opacity-50"
                >
                  Send Feedback
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: FULL-PAGE CREATE / EDIT FORM (No popup)
  // ==========================================
  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <div className="w-full max-w-5xl mx-auto space-y-6 pb-16">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition"
              title="Cancel and return"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {viewMode === 'edit' ? 'Edit Summit Lesson Plan' : 'Create New Summit Lesson Plan'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Official TQI Student Holistic Development Program summit template. Fill out all sections below.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleFormSubmit('Draft')}
              className="px-4 py-2 text-sm font-semibold text-gray-800 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:text-white rounded-xl transition"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleFormSubmit('Submitted')}
              className="px-5 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl shadow-theme-xs transition"
            >
              Submit Plan
            </button>
          </div>
        </div>

        {/* The Full-Page Form Cards */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFormSubmit('Submitted');
          }}
          className="space-y-6"
        >
          {/* Card 1: Logistics & Session Scheduling */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm dark:border-gray-800 dark:bg-white/[0.02] space-y-5">
            <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">1. Session Logistics &amp; Metadata</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Day number, summit ID, grades, dates, and village centers covered.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Day Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Day Number (1 – 8) <span className="text-red-500">*</span>
                </label>
                <Select
                  value={String(formData.dayNumber)}
                  onValueChange={(val) => setFormData({ ...formData, dayNumber: Number(val) })}
                >
                  <SelectTrigger className="w-full h-11 text-sm rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                    <SelectValue placeholder="Select Day" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        Day {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Summit Numbers */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  No. of the Summit
                </label>
                <input
                  type="text"
                  value={formData.summitNumbers}
                  onChange={(e) => setFormData({ ...formData, summitNumbers: e.target.value })}
                  placeholder="e.g. I, III"
                  className="w-full h-11 px-3.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              {/* Grades */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Target Grades
                </label>
                <input
                  type="text"
                  value={formData.grades}
                  onChange={(e) => setFormData({ ...formData, grades: e.target.value })}
                  placeholder="e.g. IX, XI"
                  className="w-full h-11 px-3.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              {/* Planned Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Planned Session Date
                </label>
                <input
                  type="date"
                  value={formData.plannedDate}
                  onChange={(e) => setFormData({ ...formData, plannedDate: e.target.value })}
                  className="w-full h-11 px-3.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              {/* College / Team Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Team / College Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.teamCollegeName}
                  onChange={(e) => setFormData({ ...formData, teamCollegeName: e.target.value })}
                  placeholder="e.g. Engineering College / Partner Institution"
                  className="w-full h-11 px-3.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-brand-500 focus:outline-none"
                />
                {formErrors.teamCollegeName && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.teamCollegeName}</p>
                )}
              </div>

              {/* Cluster */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Cluster Name
                </label>
                <input
                  type="text"
                  value={formData.cluster}
                  onChange={(e) => setFormData({ ...formData, cluster: e.target.value })}
                  placeholder="e.g. Cluster Name"
                  className="w-full h-11 px-3.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Villages Covered */}
            <div className="pt-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Villages Name (Comma Separated) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.villagesText}
                onChange={(e) => setFormData({ ...formData, villagesText: e.target.value })}
                placeholder="e.g. Ammapettai, Bairanaickanpatti, Velanur, Sittling"
                className="w-full h-11 px-3.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-brand-500 focus:outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Specify all villages that are coming together for this summit session.</p>
              {formErrors.villagesText && (
                <p className="text-xs text-red-500 mt-1">{formErrors.villagesText}</p>
              )}
            </div>
          </div>

          {/* Card 2: Theme & An Overview */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm dark:border-gray-800 dark:bg-white/[0.02] space-y-5">
            <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">2. Topic &amp; Comprehensive Overview</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Main topic headline and integrated pedagogical overview of the day&apos;s holistic development goals.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Session Topic / Modules Headline <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                placeholder="e.g. Grammar is Fun & Basics of Constitution / Art of Influencing, RTE and RTI"
                className="w-full h-11 px-3.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-brand-500 focus:outline-none"
              />
              {formErrors.topic && (
                <p className="text-xs text-red-500 mt-1">{formErrors.topic}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                An Overview <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={5}
                required
                value={formData.overview}
                onChange={(e) => setFormData({ ...formData, overview: e.target.value })}
                placeholder="Describe the session focus, interactive exercises, critical thinking, values, life skills, and civic awareness..."
                className="w-full p-4 text-sm rounded-2xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white leading-relaxed focus:border-brand-500 focus:outline-none"
              />
              {formErrors.overview && (
                <p className="text-xs text-red-500 mt-1">{formErrors.overview}</p>
              )}
            </div>
          </div>

          {/* Card 3: Grade-Specific Curriculum Segments */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm dark:border-gray-800 dark:bg-white/[0.02] space-y-6">
            <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">3. Grade-Wise Curriculum Modules</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Detail the pedagogical activities and learning areas for each participating grade level.</p>
            </div>

            {/* Grade 9 Module */}
            <div className="p-5 rounded-2xl bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200 dark:border-gray-800 space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold text-xs rounded-lg">
                  Grade IX Segment
                </span>
                <span className="text-xs text-gray-500">e.g. English Grammar &amp; Fundamental Rights</span>
              </div>
              <input
                type="text"
                value={formData.grade9Title}
                onChange={(e) => setFormData({ ...formData, grade9Title: e.target.value })}
                placeholder="Grade 9 Module Title (e.g. Grammar is Fun and Basics of Constitution)"
                className="w-full h-10 px-3 text-sm font-semibold rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-brand-500 focus:outline-none"
              />
              <textarea
                rows={3}
                value={formData.grade9Description}
                onChange={(e) => setFormData({ ...formData, grade9Description: e.target.value })}
                placeholder="Describe Grade 9 objectives, language proficiency concepts, exercises, and discussions..."
                className="w-full p-3 text-sm rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white leading-relaxed focus:border-brand-500 focus:outline-none"
              />
            </div>

            {/* Grade 11 Module */}
            <div className="p-5 rounded-2xl bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200 dark:border-gray-800 space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-lg">
                  Grade XI Segment
                </span>
                <span className="text-xs text-gray-500">e.g. Leadership, Public Speaking &amp; RTI/RTE</span>
              </div>
              <input
                type="text"
                value={formData.grade11Title}
                onChange={(e) => setFormData({ ...formData, grade11Title: e.target.value })}
                placeholder="Grade 11 Module Title (e.g. Art of Influencing, RTE AND RTI)"
                className="w-full h-10 px-3 text-sm font-semibold rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-brand-500 focus:outline-none"
              />
              <textarea
                rows={3}
                value={formData.grade11Description}
                onChange={(e) => setFormData({ ...formData, grade11Description: e.target.value })}
                placeholder="Describe Grade 11 objectives, leadership activities, public speaking drills, and citizen rights..."
                className="w-full p-3 text-sm rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white leading-relaxed focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Card 4: Detailed Classroom Activities */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm dark:border-gray-800 dark:bg-white/[0.02] space-y-6">
            <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">4. Detailed Activity Tasks</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Step-by-step participatory tasks, role plays, games, and group instructions.</p>
            </div>

            {/* Activity 1 */}
            <div className="p-5 rounded-2xl bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200 dark:border-gray-800 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center font-bold">1</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">Event / Task / Activity 1</span>
              </div>
              <input
                type="text"
                value={formData.activity1Title}
                onChange={(e) => setFormData({ ...formData, activity1Title: e.target.value })}
                placeholder="Activity Title (e.g. Be the School Leader)"
                className="w-full h-10 px-3 text-sm font-semibold rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-brand-500 focus:outline-none"
              />
              <textarea
                rows={3}
                value={formData.activity1Description}
                onChange={(e) => setFormData({ ...formData, activity1Description: e.target.value })}
                placeholder="Activity instructions, small group division, brainstorm guidelines, and speech presentation rules..."
                className="w-full p-3 text-sm rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white leading-relaxed focus:border-brand-500 focus:outline-none"
              />
            </div>

            {/* Activity 2 */}
            <div className="p-5 rounded-2xl bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200 dark:border-gray-800 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center font-bold">2</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">Event / Task / Activity 2</span>
              </div>
              <input
                type="text"
                value={formData.activity2Title}
                onChange={(e) => setFormData({ ...formData, activity2Title: e.target.value })}
                placeholder="Activity Title (e.g. Rights & Duties Matching Game)"
                className="w-full h-10 px-3 text-sm font-semibold rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-brand-500 focus:outline-none"
              />
              <textarea
                rows={3}
                value={formData.activity2Description}
                onChange={(e) => setFormData({ ...formData, activity2Description: e.target.value })}
                placeholder="Activity instructions, card sets (rights vs duties), reasoning, and discussion details..."
                className="w-full p-3 text-sm rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white leading-relaxed focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Card 5: Expected Outcomes & Volunteers Roster */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm dark:border-gray-800 dark:bg-white/[0.02] space-y-5">
            <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">5. Expected Outcomes &amp; Volunteers Assignment</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Measurable impact on student capabilities and the list of student volunteers conducting the session.</p>
            </div>

            {/* Expected Outcome */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Expected Outcome
              </label>
              <textarea
                rows={4}
                value={formData.expectedOutcome}
                onChange={(e) => setFormData({ ...formData, expectedOutcome: e.target.value })}
                placeholder="Detail skills developed: memory, organization, communication, teamwork, digital literacy, and responsible citizenship..."
                className="w-full p-3.5 text-sm rounded-2xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white leading-relaxed focus:border-brand-500 focus:outline-none"
              />
            </div>

            {/* Volunteers Names */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Volunteers Name who going take session (Comma Separated)
              </label>
              <textarea
                rows={2}
                value={formData.volunteersText}
                onChange={(e) => setFormData({ ...formData, volunteersText: e.target.value })}
                placeholder="e.g. Mathan, Narendhar D, Manusha N, Deepak, Siva Sri, Bala Sankaran, Jeeva..."
                className="w-full p-3 text-sm rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white leading-relaxed focus:border-brand-500 focus:outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Separate names with commas. These names appear on the official document roster.</p>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 rounded-xl transition"
            >
              Cancel &amp; Discard
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => handleFormSubmit('Draft')}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 rounded-xl transition"
              >
                Save as Draft
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-7 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl shadow-theme-xs transition"
              >
                Submit Lesson Plan
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: LESSON PLANS DASHBOARD / LIST VIEW
  // ==========================================
  return (
    <div className="w-full space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2.5">
            <span>Summit Lesson Plans</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 border border-brand-200 dark:border-brand-500/20">
              {currentAcademicYear}
            </span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Official TQI Holistic Development summit lesson plans created by Cluster Admins and reviewed by Super Admins.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => exportAllLessonPlansExcel(lessonPlans, currentCluster)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 transition"
            title="Export all lesson plans to Excel"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreateView}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Create Lesson Plan</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Plans</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totalCount}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Approved</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{approvedCount}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Under Review</div>
          <div className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{submittedCount}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Corrections</div>
          <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{correctionCount}</div>
        </div>
      </div>

      {/* Day Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        {/* Scrollable Day Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 md:pb-0 scrollbar-none shrink-0">
          <button
            type="button"
            onClick={() => setSelectedDayFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              selectedDayFilter === 'all'
                ? 'bg-brand-500 text-white shadow-theme-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            All Days
          </button>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((dayNum) => (
            <button
              key={dayNum}
              type="button"
              onClick={() => setSelectedDayFilter(dayNum)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                selectedDayFilter === dayNum
                  ? 'bg-brand-500 text-white shadow-theme-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              Day {dayNum}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by topic, college, villages, or outcomes..."
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2 text-xs sm:text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
          />
        </div>

        {/* Status filter */}
        <div className="w-full sm:w-44 shrink-0">
          <Select value={selectedStatus} onValueChange={(val) => setSelectedStatus(val)}>
            <SelectTrigger className="w-full text-xs h-9 rounded-xl border border-gray-200 dark:border-gray-800 dark:bg-gray-900 dark:text-white">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Submitted">Submitted</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Correction Requested">Correction Requested</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lesson Plans Responsive Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredPlans.map((plan) => {
          const isCorrectionReq = plan.status === 'Correction Requested' || (plan.status as string) === 'Rejected';
          const villages = plan.villagesList && plan.villagesList.length > 0 
            ? plan.villagesList 
            : (plan.villageName ? [plan.villageName] : []);

          return (
            <div
              key={plan.id}
              className={`flex flex-col rounded-2xl border bg-white p-5 shadow-theme-xs transition hover:border-brand-500/50 dark:bg-white/[0.02] ${
                isCorrectionReq
                  ? 'border-amber-300 dark:border-amber-500/30'
                  : 'border-gray-200 dark:border-gray-800'
              }`}
            >
              {/* Card Top: Badges & Status */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 border border-brand-100 dark:border-brand-500/20">
                    Day {plan.dayNumber || 1}
                  </span>
                  {plan.summitNumbers && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      Summit {plan.summitNumbers}
                    </span>
                  )}
                  {plan.grades && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
                      Grades {plan.grades}
                    </span>
                  )}
                </div>
                <div>{renderStatusBadge(plan.status)}</div>
              </div>

              {/* Title & Topic */}
              <div className="space-y-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-white line-clamp-2">
                  {plan.topic || plan.title || 'Summit Lesson Plan'}
                </h3>
                {plan.teamCollegeName && (
                  <p className="text-xs font-medium text-brand-600 dark:text-brand-400 flex items-center gap-1">
                    <span>🏛 {plan.teamCollegeName}</span>
                  </p>
                )}
              </div>

              {/* Villages List Tags */}
              {villages.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                    Villages Covered ({villages.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {villages.map((v, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 text-[11px] rounded bg-gray-50 border border-gray-200 text-gray-600 dark:bg-gray-800/60 dark:border-gray-700 dark:text-gray-300"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Overview snippet */}
              <p className="mt-3 text-xs text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed flex-1">
                {plan.overview || plan.objective || 'Session focuses on student holistic development, communication, leadership, and civics awareness.'}
              </p>

              {/* Volunteers Roster snippet */}
              {plan.assignedVolunteers && plan.assignedVolunteers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span className="truncate">
                    👥 {plan.assignedVolunteers.slice(0, 3).join(', ')}
                    {plan.assignedVolunteers.length > 3 ? ` +${plan.assignedVolunteers.length - 3} more` : ''}
                  </span>
                  <span className="shrink-0 font-medium">{plan.date || 'Planned'}</span>
                </div>
              )}

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenDetailView(plan)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-gray-500" />
                  <span>View Document</span>
                </button>

                <div className="flex items-center gap-1">
                  {/* Super Admin Quick Review Button */}
                  {currentUserRole === 'Super Admin' && (plan.status === 'Submitted' || plan.status === 'Resubmitted') && (
                    <button
                      type="button"
                      onClick={() => handleApprovePlan(plan.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-theme-xs transition"
                    >
                      Approve
                    </button>
                  )}

                  {/* Edit button */}
                  {(currentUserRole === 'Super Admin' || plan.status === 'Draft' || plan.status === 'Correction Requested' || (plan.status as string) === 'Rejected') && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditView(plan)}
                      className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition dark:hover:bg-gray-800"
                      title="Edit Lesson Plan"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}

                  {onDeleteLessonPlan && (currentUserRole === 'Super Admin' || plan.status === 'Draft') && (
                    <button
                      type="button"
                      onClick={() => onDeleteLessonPlan(plan.id)}
                      className="p-1.5 text-gray-400 hover:text-error-500 hover:bg-error-50 rounded-lg transition dark:hover:bg-gray-800"
                      title="Delete Lesson Plan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredPlans.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-gray-500 border border-dashed border-gray-200 rounded-2xl dark:border-gray-800">
            <BookOpen className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="font-semibold text-gray-700 dark:text-gray-300">No lesson plans found</p>
            <p className="text-xs text-gray-400 mt-1">Try resetting your search or day filters, or create a new lesson plan.</p>
            <button
              onClick={handleClearFilters}
              className="mt-3 px-3 py-1.5 text-xs font-semibold text-brand-500 bg-brand-50 dark:bg-brand-500/10 rounded-xl hover:bg-brand-100 transition"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
