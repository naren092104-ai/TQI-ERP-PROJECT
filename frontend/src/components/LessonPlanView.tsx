import React, { useState, useMemo } from 'react';
import { TabType, LessonPlan, Panchayat, Volunteer, Session } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { ActionButton } from './ui/action-button';
import { Plus, Search, BookOpen, CheckCircle2, Clock, AlertTriangle, FileText, X } from './ui/icons';

interface LessonPlanViewProps {
  lessonPlans: LessonPlan[];
  sessions: Session[];
  panchayats: Panchayat[];
  volunteers: Volunteer[];
  selectedLessonPlanId?: string;
  onNavigate: (tab: TabType, targetId?: string) => void;
  onAddLessonPlan: (plan: Omit<LessonPlan, 'id'>) => void;
  onUpdateLessonPlan: (id: string, updated: Partial<LessonPlan>) => void;
  onDeleteLessonPlan?: (id: string) => void;
}

export const LessonPlanView: React.FC<LessonPlanViewProps> = ({
  lessonPlans = [],
  sessions = [],
  panchayats = [],
  volunteers = [],
  selectedLessonPlanId,
  onNavigate,
  onAddLessonPlan,
  onUpdateLessonPlan,
  onDeleteLessonPlan,
}) => {
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPanchayat, setSelectedPanchayat] = useState('all');
  const [selectedVillage, setSelectedVillage] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedVolunteer, setSelectedVolunteer] = useState('all');

  // Modals & Active View States
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activePlanDetail, setActivePlanDetail] = useState<LessonPlan | null>(() => {
    if (selectedLessonPlanId) {
      const found = lessonPlans.find((lp) => lp.id === selectedLessonPlanId || lp.sessionId === selectedLessonPlanId);
      return found || lessonPlans[0] || null;
    }
    return null;
  });
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionReasonInput, setCorrectionReasonInput] = useState('');

  // Form State for Create / Edit
  const [formData, setFormData] = useState({
    id: '',
    topic: '',
    moduleName: 'Spoken English',
    moduleId: 'M-103',
    targetStandard: '6th - 8th Standard',
    duration: '90 Mins',
    panchayatId: panchayats[0]?.id || 'vedakkattamaduvu',
    panchayatName: panchayats[0]?.name || 'Vedakkattamaduvu',
    villageName: panchayats[0]?.villages[0]?.name || 'Ammapettai',
    volunteerId: volunteers[0]?.id || 'vol-1',
    volunteerName: volunteers[0]?.name || 'Bala',
    date: new Date().toISOString().split('T')[0],
    dayOfSession: 'Saturday',
    objective: '',
    learningOutcomesText: '',
    introduction: '',
    activity: '',
    activitiesListText: '',
    teachingMethod: '',
    materialsText: '',
    assessmentTask: '',
    notes: '',
    status: 'Draft' as LessonPlan['status'],
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Dynamic list of villages based on selected panchayat in filter
  const currentFilterVillages = useMemo(() => {
    if (selectedPanchayat === 'all') {
      const allVillages: { id: string; name: string }[] = [];
      panchayats.forEach((p) => {
        p.villages?.forEach((v) => {
          if (!allVillages.some((existing) => existing.name === v.name)) {
            allVillages.push({ id: v.id, name: v.name });
          }
        });
      });
      return allVillages;
    }
    const found = panchayats.find((p) => p.id === selectedPanchayat);
    return found?.villages || [];
  }, [selectedPanchayat, panchayats]);

  // Dynamic list of villages for modal
  const modalVillages = useMemo(() => {
    const found = panchayats.find((p) => p.id === formData.panchayatId);
    return found?.villages || [];
  }, [formData.panchayatId, panchayats]);

  // Extract helper topic
  const getPlanTopic = (lp: LessonPlan): string => {
    return lp.topic || lp.title || lp.sessionName || 'Untitled Lesson Plan';
  };

  const getPlanModule = (lp: LessonPlan): string => {
    return lp.moduleName || lp.moduleId || 'General Curriculum';
  };

  // Filtered Lesson Plans
  const filteredPlans = useMemo(() => {
    return lessonPlans.filter((lp) => {
      const topic = getPlanTopic(lp).toLowerCase();
      const mod = getPlanModule(lp).toLowerCase();
      const vill = (lp.villageName || '').toLowerCase();
      const vol = (lp.volunteerName || '').toLowerCase();
      const pan = (lp.panchayatName || '').toLowerCase();
      const search = searchTerm.toLowerCase().trim();

      const matchSearch =
        !search ||
        topic.includes(search) ||
        mod.includes(search) ||
        vill.includes(search) ||
        vol.includes(search) ||
        pan.includes(search) ||
        (lp.objective || '').toLowerCase().includes(search);

      const matchPanchayat =
        selectedPanchayat === 'all' || lp.panchayatId === selectedPanchayat;

      const matchVillage =
        selectedVillage === 'all' ||
        (lp.villageName || '').toLowerCase() === selectedVillage.toLowerCase();

      const matchStatus =
        selectedStatus === 'all' ||
        (lp.status || '').toLowerCase() === selectedStatus.toLowerCase();

      const matchVolunteer =
        selectedVolunteer === 'all' ||
        lp.volunteerId === selectedVolunteer ||
        (lp.volunteerName || '').toLowerCase() === selectedVolunteer.toLowerCase();

      return matchSearch && matchPanchayat && matchVillage && matchStatus && matchVolunteer;
    });
  }, [lessonPlans, searchTerm, selectedPanchayat, selectedVillage, selectedStatus, selectedVolunteer]);

  // Counts
  const totalCount = lessonPlans.length;
  const approvedCount = lessonPlans.filter(
    (lp) => lp.status === 'Approved' || lp.status === 'Completed' || lp.status === 'Active'
  ).length;
  const submittedCount = lessonPlans.filter(
    (lp) => lp.status === 'Submitted' || lp.status === 'Resubmitted' || lp.status === 'Upcoming'
  ).length;
  const correctionCount = lessonPlans.filter(
    (lp) => lp.status === 'Correction Requested'
  ).length;

  // Clear filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedPanchayat('all');
    setSelectedVillage('all');
    setSelectedStatus('all');
    setSelectedVolunteer('all');
  };

  // Open Create Form
  const handleOpenNewModal = () => {
    setIsEditMode(false);
    setFormErrors({});
    const defaultP = panchayats[0];
    setFormData({
      id: '',
      topic: '',
      moduleName: 'Spoken English',
      moduleId: 'M-103',
      targetStandard: '6th - 8th Standard',
      duration: '90 Mins',
      panchayatId: defaultP?.id || 'vedakkattamaduvu',
      panchayatName: defaultP?.name || 'Vedakkattamaduvu',
      villageName: defaultP?.villages[0]?.name || 'Ammapettai',
      volunteerId: volunteers[0]?.id || 'vol-1',
      volunteerName: volunteers[0]?.name || 'Bala',
      date: new Date().toISOString().split('T')[0],
      dayOfSession: 'Saturday',
      objective: '',
      learningOutcomesText: '1. Recognize core vocabulary words in real dialogue\n2. Form 3-5 full sentences independently\n3. Participate in group roleplay challenge',
      introduction: '10-minute warm-up game and review of previous module concepts.',
      activity: 'Interactive group worksheets and structured role-play drills in pairs.',
      activitiesListText: 'Warm-up & Icebreaker (15 mins)\nConcept Demonstration on Whiteboard (25 mins)\nGroup Activity & Worksheets (30 mins)\nExit Slip & Vocabulary Quiz (20 mins)',
      teachingMethod: 'Visual demonstration, peer group problem solving, interactive worksheets.',
      materialsText: 'Flashcards, Worksheets (30 copies), Whiteboard markers, Student reward stickers',
      assessmentTask: 'Exit slip quiz with 3 short conceptual questions evaluated in peer pairs.',
      notes: 'Keep extra craft kits in center bag.',
      status: 'Draft',
    });
    setIsNewModalOpen(true);
  };

  // Open Edit Form
  const handleOpenEditModal = (plan: LessonPlan) => {
    setIsEditMode(true);
    setFormErrors({});
    setFormData({
      id: plan.id,
      topic: plan.topic || plan.title || plan.sessionName || '',
      moduleName: plan.moduleName || 'Spoken English',
      moduleId: plan.moduleId || 'M-103',
      targetStandard: plan.targetStandard || '6th - 8th Standard',
      duration: plan.duration || '90 Mins',
      panchayatId: plan.panchayatId || (panchayats[0]?.id || ''),
      panchayatName: plan.panchayatName || (panchayats[0]?.name || ''),
      villageName: plan.villageName || '',
      volunteerId: plan.volunteerId || (volunteers[0]?.id || ''),
      volunteerName: plan.volunteerName || 'Bala',
      date: plan.date || new Date().toISOString().split('T')[0],
      dayOfSession: plan.dayOfSession || 'Saturday',
      objective: plan.objective || '',
      learningOutcomesText: plan.learningOutcomes?.join('\n') || '',
      introduction: plan.introduction || '',
      activity: plan.activity || '',
      activitiesListText: plan.activitiesList?.join('\n') || '',
      teachingMethod: plan.teachingMethod || '',
      materialsText: Array.isArray(plan.materials)
        ? plan.materials.join(', ')
        : (plan.materialsList?.join('\n') || (plan.materials as string) || ''),
      assessmentTask: plan.assessmentTask || '',
      notes: plan.notes || '',
      status: plan.status || 'Draft',
    });
    setIsNewModalOpen(true);
  };

  // Form Submit
  const handleFormSubmit = (targetStatus: LessonPlan['status']) => {
    const errors: Record<string, string> = {};
    if (!formData.topic.trim()) errors.topic = 'Topic / Title is required.';
    if (!formData.objective.trim()) errors.objective = 'Objective is required.';
    if (!formData.villageName.trim()) errors.villageName = 'Please select a village center.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const learningOutcomes = formData.learningOutcomesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const activitiesList = formData.activitiesListText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const materialsList = formData.materialsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: Partial<LessonPlan> = {
      topic: formData.topic.trim(),
      title: formData.topic.trim(),
      moduleName: formData.moduleName,
      moduleId: formData.moduleId,
      targetStandard: formData.targetStandard,
      duration: formData.duration,
      panchayatId: formData.panchayatId,
      panchayatName: formData.panchayatName,
      villageName: formData.villageName,
      volunteerId: formData.volunteerId,
      volunteerName: formData.volunteerName,
      date: formData.date,
      dayOfSession: formData.dayOfSession,
      objective: formData.objective.trim(),
      learningOutcomes: learningOutcomes.length > 0 ? learningOutcomes : [formData.objective.trim()],
      introduction: formData.introduction,
      activity: formData.activity,
      activitiesList: activitiesList.length > 0 ? activitiesList : [formData.activity],
      teachingMethod: formData.teachingMethod,
      materials: formData.materialsText,
      materialsList: materialsList,
      assessmentTask: formData.assessmentTask,
      notes: formData.notes,
      status: targetStatus,
      lastUpdated: `${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    };

    if (isEditMode && formData.id) {
      onUpdateLessonPlan(formData.id, payload);
      if (activePlanDetail?.id === formData.id) {
        setActivePlanDetail((prev) => (prev ? { ...prev, ...payload } : null));
      }
    } else {
      const newPlan: Omit<LessonPlan, 'id'> = {
        ...payload,
        sessionName: formData.topic.trim(),
        volunteersCount: 3,
        cluster: 'Dharmapuri',
        spoc: formData.volunteerName,
        financer: 'Cluster Fund',
      };
      onAddLessonPlan(newPlan);
    }

    setIsNewModalOpen(false);
  };

  // Status Action: Approve
  const handleApprovePlan = (planId: string) => {
    onUpdateLessonPlan(planId, {
      status: 'Approved',
      correctionReason: undefined,
      correctionRequestedBy: undefined,
      lastUpdated: 'Just now by Cluster Admin',
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
      correctionRequestedBy: 'Cluster Admin',
      correctionDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      lastUpdated: 'Correction requested',
    });

    setActivePlanDetail((prev) =>
      prev
        ? {
            ...prev,
            status: 'Correction Requested',
            correctionReason: correctionReasonInput.trim(),
            correctionRequestedBy: 'Cluster Admin',
            correctionDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          }
        : null
    );

    setIsCorrectionModalOpen(false);
    setCorrectionReasonInput('');
  };

  // Export PDF or Print Preview
  const handlePrintPDF = (plan?: LessonPlan) => {
    const target = plan || activePlanDetail || filteredPlans[0];
    if (!target) {
      alert('No lesson plan available to export.');
      return;
    }
    window.print();
  };

  // Status Badge Helper
  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'Approved':
      case 'Active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            Approved
          </span>
        );
      case 'Submitted':
      case 'Resubmitted':
      case 'Upcoming':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            {status === 'Resubmitted' ? 'Resubmitted' : 'Submitted'}
          </span>
        );
      case 'Correction Requested':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
            Correction Requested
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
            Completed
          </span>
        );
      case 'Draft':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Draft
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Cardless Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Lesson Plans
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage, review, and track curriculum lesson plans and learning activities across clusters.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handlePrintPDF()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 transition"
          >
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={handleOpenNewModal}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition"
          >
            <span>New Lesson Plan</span>
          </button>
        </div>
      </div>

      {/* 2. Compact Metric Cards (counts & status only) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Plans</div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{totalCount}</div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="text-xs font-semibold uppercase tracking-wider text-success-500">Approved</div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{approvedCount}</div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand-500">Submitted / Review</div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{submittedCount}</div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="text-xs font-semibold uppercase tracking-wider text-warning-500">Needs Correction</div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{correctionCount}</div>
        </div>
      </div>

      {/* 3. Cardless Search & Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Search bar */}
        <div className="relative sm:col-span-2 lg:col-span-2">
          <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by topic, module, volunteer or village..."
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-8 py-2 text-xs text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

          {/* Panchayat filter */}
          <div>
            <Select
              value={selectedPanchayat || "all"}
              onValueChange={(val) => {
                setSelectedPanchayat(val);
                setSelectedVillage('all');
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Panchayats" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Panchayats</SelectItem>
                {panchayats.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Village filter */}
          <div>
            <Select
              value={selectedVillage || "all"}
              onValueChange={(val) => setSelectedVillage(val)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Villages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Villages</SelectItem>
                {currentFilterVillages.map((v) => (
                  <SelectItem key={v.id} value={v.name}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status filter */}
          <div>
            <Select
              value={selectedStatus || "all"}
              onValueChange={(val) => setSelectedStatus(val)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Submitted">Submitted</SelectItem>
                <SelectItem value="Correction Requested">Correction Requested</SelectItem>
                <SelectItem value="Resubmitted">Resubmitted</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

      {/* LESSON PLAN TABLE */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-theme-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tqi-table-compact w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Date &amp; Module</th>
                <th className="py-3 px-4">Topic &amp; Learning Objective</th>
                <th className="py-3 px-4">Panchayat &amp; Village</th>
                <th className="py-3 px-4">Volunteer</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
              {filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[36px] text-gray-300 dark:text-gray-600">
                        menu_book
                      </span>
                      <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">No lesson plans found</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                        Try adjusting your filters or create a new lesson plan.
                      </p>
                      <button
                        onClick={handleClearFilters}
                        className="mt-2 px-3.5 py-1.5 text-xs font-semibold text-brand-500 bg-brand-50 dark:bg-brand-950/40 dark:text-brand-400 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900/40 transition"
                      >
                        Reset Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPlans.map((plan) => {
                  const isCorrectionReq = plan.status === 'Correction Requested';

                  return (
                    <tr
                      key={plan.id}
                      className={`hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors group ${
                        isCorrectionReq ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      {/* Date & Module */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-gray-900 dark:text-white">{plan.date || '28 Aug 2026'}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                          <span className="font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[10px]">
                            {plan.moduleId || 'M-103'}
                          </span>
                          <span>•</span>
                          <span>{getPlanModule(plan)}</span>
                        </div>
                      </td>

                      {/* Topic & Objective */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors">
                          {getPlanTopic(plan)}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                          {plan.objective || plan.description || 'Core curriculum learning objective'}
                        </div>
                      </td>

                      {/* Panchayat & Village */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-gray-800 dark:text-gray-200">{plan.panchayatName || 'Vedakkattamaduvu'}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">{plan.villageName || 'Ammapettai'}</div>
                      </td>

                      {/* Volunteer */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-brand-500/10 text-brand-500 dark:bg-brand-500/20 dark:text-brand-400 text-[10px] font-bold flex items-center justify-center">
                            {(plan.volunteerName || 'B').charAt(0)}
                          </div>
                          <span>{plan.volunteerName || 'Bala'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadge(plan.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActivePlanDetail(plan)}
                            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:text-brand-500 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl text-xs font-semibold shadow-theme-xs transition cursor-pointer"
                          >
                            View Plan
                          </button>

                          {/* Quick Admin Actions */}
                          {plan.status === 'Submitted' || plan.status === 'Resubmitted' ? (
                            <button
                              onClick={() => handleApprovePlan(plan.id)}
                              className="px-2.5 py-1.5 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded-xl text-xs font-semibold transition cursor-pointer"
                              title="Approve Lesson Plan"
                            >
                              Approve
                            </button>
                          ) : null}

                          <button
                            onClick={() => handleOpenEditModal(plan)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition cursor-pointer"
                            title="Edit Lesson Plan"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FULL LESSON PLAN DETAIL MODAL / DRAWER */}
      {activePlanDetail && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-gray-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-md border border-slate-200 shadow-sm max-w-3xl w-full max-h-[92vh] flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 rounded-t-xl flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-mono font-bold bg-[#0B3D91]/10 text-[#0B3D91] px-2 py-0.5 rounded">
                    {activePlanDetail.moduleId || 'M-103'}
                  </span>
                  {renderStatusBadge(activePlanDetail.status)}
                  <span className="text-xs text-slate-500 font-medium">
                    Duration: {activePlanDetail.duration || '90 Mins'}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  {getPlanTopic(activePlanDetail)}
                </h2>
                <p className="text-xs text-slate-500">
                  {getPlanModule(activePlanDetail)} • Standard: {activePlanDetail.targetStandard || '6th - 8th Standard'} • {activePlanDetail.panchayatName} ({activePlanDetail.villageName})
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePrintPDF(activePlanDetail)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                  title="Print / Save PDF"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setActivePlanDetail(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-200 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* Body Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Correction Requested Banner if applicable */}
              {activePlanDetail.status === 'Correction Requested' && activePlanDetail.correctionReason && (
                <div className="bg-amber-50 border border-amber-300 rounded-md p-3.5 space-y-1.5 text-amber-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                      <span className="material-symbols-outlined text-[16px] text-amber-700">warning</span>
                      Correction Requested by {activePlanDetail.correctionRequestedBy || 'Cluster Admin'} ({activePlanDetail.correctionDate || 'Recent'})
                    </div>
                    <button
                      onClick={() => {
                        const p = activePlanDetail;
                        setActivePlanDetail(null);
                        handleOpenEditModal(p);
                      }}
                      className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded text-[11px] shadow-2xs"
                    >
                      Edit &amp; Resubmit Plan
                    </button>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed font-medium pl-5">
                    &quot;{activePlanDetail.correctionReason}&quot;
                  </p>
                </div>
              )}

              {/* Objective & Expected Learning Outcomes */}
              <div className="bg-white border border-slate-200 rounded-md p-4 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Primary Objective
                  </h4>
                  <p className="text-slate-800 font-medium text-xs mt-1">
                    {activePlanDetail.objective || activePlanDetail.description || 'Students will understand key foundational concepts through hands-on exercises.'}
                  </p>
                </div>

                {activePlanDetail.learningOutcomes && activePlanDetail.learningOutcomes.length > 0 && (
                  <div className="border-t border-slate-100 pt-2.5">
                    <h5 className="text-[11px] font-bold text-slate-600 mb-1.5">
                      Expected Learning Outcomes:
                    </h5>
                    <ul className="space-y-1 pl-4 list-disc text-slate-700">
                      {activePlanDetail.learningOutcomes.map((item, idx) => (
                        <li key={idx} className="leading-normal">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* 90-Minute Structured Session Timeline */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Session Activity &amp; Time Breakdown (90 Mins)
                  </h4>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Method: {activePlanDetail.teachingMethod || 'Interactive Peer Practice'}
                  </span>
                </div>

                {activePlanDetail.activitiesList && activePlanDetail.activitiesList.length > 0 ? (
                  <div className="space-y-2">
                    {activePlanDetail.activitiesList.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-white border border-slate-200 rounded-md text-slate-700 flex items-start gap-2.5"
                      >
                        <span className="w-5 h-5 rounded-full bg-[#0B3D91]/10 text-[#0B3D91] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-white border border-slate-200 rounded-md text-slate-700">
                    {activePlanDetail.activity || 'Structured group worksheets, interactive drills, and presentation.'}
                  </div>
                )}
              </div>

              {/* Materials Checklist & Assessment Task */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Materials */}
                <div className="border border-slate-200 rounded-md p-3.5 bg-white space-y-2">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#0B3D91]">
                      inventory_2
                    </span>
                    Materials &amp; Teaching Aids
                  </h4>
                  <div className="text-slate-600 space-y-1">
                    {activePlanDetail.materialsList && activePlanDetail.materialsList.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-0.5">
                        {activePlanDetail.materialsList.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{Array.isArray(activePlanDetail.materials) ? activePlanDetail.materials.join(', ') : (activePlanDetail.materials || 'Standard classroom stationery kit and worksheets.')}</p>
                    )}
                  </div>
                </div>

                {/* Assessment Task */}
                <div className="border border-slate-200 rounded-md p-3.5 bg-white space-y-2">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">
                      fact_check
                    </span>
                    Evaluation &amp; Exit Assessment
                  </h4>
                  <p className="text-slate-600 leading-relaxed">
                    {activePlanDetail.assessmentTask || 'Exit slip quiz with 3 short conceptual questions evaluated in peer pairs.'}
                  </p>
                </div>
              </div>

              {/* Notes / Remarks */}
              {activePlanDetail.notes && (
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-1">
                  <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">
                    Volunteer Guidance &amp; Center Logistics
                  </span>
                  <p className="text-slate-700">{activePlanDetail.notes}</p>
                </div>
              )}
            </div>

            {/* Detail Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 rounded-b-xl">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActivePlanDetail(null)}
                  className="px-4 py-1.5 border border-slate-300 text-slate-700 hover:bg-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
                >
                  Close Preview
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const p = activePlanDetail;
                    setActivePlanDetail(null);
                    handleOpenEditModal(p);
                  }}
                  className="px-3.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                >
                  Edit Plan
                </button>

                {activePlanDetail.status !== 'Approved' && (
                  <button
                    onClick={() => {
                      setCorrectionReasonInput('');
                      setIsCorrectionModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
                  >
                    Request Correction
                  </button>
                )}

                {activePlanDetail.status !== 'Approved' && (
                  <button
                    onClick={() => handleApprovePlan(activePlanDetail.id)}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
                  >
                    Approve Plan
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT LESSON PLAN MODAL */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-gray-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-md border border-slate-200 shadow-sm max-w-2xl w-full max-h-[92vh] flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 rounded-t-xl">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {isEditMode ? 'Edit Lesson Plan' : 'Create New Lesson Plan'}
                </h2>
                <p className="text-xs text-slate-500">
                  Prepare curriculum, activities, and resources for upcoming sessions.
                </p>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Form */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {isEditMode && ['Submitted', 'Approved', 'Completed'].includes(activePlanDetail?.status || '') && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle2 className="w-5 h-5 text-success-500" />
                  <span>This lesson plan has been {activePlanDetail?.status.toLowerCase()} and cannot be edited.</span>
                </div>
              )}
              {isEditMode && activePlanDetail?.status === 'Correction Requested' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-sm text-amber-800">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span>Correction Requested: {activePlanDetail.correctionReason}</span>
                </div>
              )}

              {/* Row 1: Topic & Module */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lesson Topic / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.topic}
                    disabled={isEditMode && ['Submitted', 'Approved', 'Completed'].includes(activePlanDetail?.status || '')}
                    onChange={(e) => {
                      setFormData({ ...formData, topic: e.target.value });
                      if (formErrors.topic) setFormErrors({ ...formErrors, topic: '' });
                    }}
                    placeholder="e.g. Basic Conversation & Dialogue Drills"
                    className={`w-full px-3 py-2 border rounded-md text-xs focus:outline-none focus:border-[#0B3D91] disabled:opacity-50 ${
                      formErrors.topic ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.topic && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.topic}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Curriculum Module
                  </label>
                  <Select
                    value={formData.moduleName}
                    disabled={isEditMode && ['Submitted', 'Approved', 'Completed'].includes(activePlanDetail?.status || '')}
                    onValueChange={(mod) => {
                      let modId = 'M-103';
                      if (mod === 'Basic Math') modId = 'M-301';
                      if (mod === 'Life Skills') modId = 'M-102';
                      if (mod === 'Digital Literacy') modId = 'D-004';
                      if (mod === 'Science') modId = 'S-201';
                      if (mod === 'Financial Literacy') modId = 'F-101';
                      setFormData({ ...formData, moduleName: mod, moduleId: modId });
                    }}
                  >
                    <SelectTrigger className="w-full h-9 text-xs border-slate-300">
                      <SelectValue placeholder="Select Module" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Spoken English">Spoken English (M-103)</SelectItem>
                      <SelectItem value="Basic Math">Basic Math (M-301)</SelectItem>
                      <SelectItem value="Life Skills">Life Skills (M-102)</SelectItem>
                      <SelectItem value="Digital Literacy">Digital Literacy (D-004)</SelectItem>
                      <SelectItem value="Science">Science (S-201)</SelectItem>
                      <SelectItem value="Financial Literacy">Financial Literacy (F-101)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Standard & Duration & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Standard / Grade
                  </label>
                  <Select
                    value={formData.targetStandard}
                    disabled={isEditMode && ['Submitted', 'Approved', 'Completed'].includes(activePlanDetail?.status || '')}
                    onValueChange={(val) => setFormData({ ...formData, targetStandard: val })}
                  >
                    <SelectTrigger className="w-full h-9 text-xs border-slate-300">
                      <SelectValue placeholder="Target Standard" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4th - 5th Standard">4th - 5th Standard</SelectItem>
                      <SelectItem value="6th - 8th Standard">6th - 8th Standard</SelectItem>
                      <SelectItem value="9th - 10th Standard">9th - 10th Standard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={formData.duration}
                    disabled={isEditMode && ['Submitted', 'Approved', 'Completed'].includes(activePlanDetail?.status || '')}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="90 Mins"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91] disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Session Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    disabled={isEditMode && ['Submitted', 'Approved', 'Completed'].includes(activePlanDetail?.status || '')}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91] disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Row 3: Hierarchy Location & Volunteer */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-slate-50/70 p-3 rounded-md border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Panchayat <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    value={formData.panchayatId}
                    disabled={isEditMode && ['Submitted', 'Approved', 'Completed'].includes(activePlanDetail?.status || '')}
                    onValueChange={(val) => {
                      const found = panchayats.find((p) => p.id === val);
                      if (found) {
                        setFormData({
                          ...formData,
                          panchayatId: found.id,
                          panchayatName: found.name,
                          villageName: found.villages[0]?.name || 'Main Center',
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full h-8 text-xs border-slate-300">
                      <SelectValue placeholder="Select Panchayat" />
                    </SelectTrigger>
                    <SelectContent>
                      {panchayats.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Village Center <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    value={formData.villageName}
                    disabled={isEditMode && ['Submitted', 'Approved', 'Completed'].includes(activePlanDetail?.status || '')}
                    onValueChange={(val) => {
                      setFormData({ ...formData, villageName: val });
                      if (formErrors.villageName) setFormErrors({ ...formErrors, villageName: '' });
                    }}
                  >
                    <SelectTrigger className={`w-full h-8 text-xs ${
                      formErrors.villageName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}>
                      <SelectValue placeholder="Select Village Center" />
                    </SelectTrigger>
                    <SelectContent>
                      {modalVillages.map((v) => (
                        <SelectItem key={v.id} value={v.name}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Volunteer Lead
                  </label>
                  <Select
                    value={formData.volunteerId}
                    disabled={isEditMode && ['Submitted', 'Approved', 'Completed'].includes(activePlanDetail?.status || '')}
                    onValueChange={(val) => {
                      const found = volunteers.find((v) => v.id === val);
                      if (found) {
                        setFormData({ ...formData, volunteerId: found.id, volunteerName: found.name });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full h-8 text-xs border-slate-300">
                      <SelectValue placeholder="Select Volunteer" />
                    </SelectTrigger>
                    <SelectContent>
                      {volunteers.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 4: Primary Objective */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Learning Objective <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={formData.objective}
                  disabled={isEditMode && ['Submitted', 'Approved', 'Completed'].includes(activePlanDetail?.status || '')}
                  onChange={(e) => {
                    setFormData({ ...formData, objective: e.target.value });
                    if (formErrors.objective) setFormErrors({ ...formErrors, objective: '' });
                  }}
                  placeholder="State the core outcome students will achieve by the end of 90 minutes..."
                  className={`w-full px-3 py-2 border rounded-md text-xs focus:outline-none focus:border-[#0B3D91] disabled:opacity-50 ${
                    formErrors.objective ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                  }`}
                />
                {formErrors.objective && (
                  <p className="text-[11px] text-rose-600 mt-1">{formErrors.objective}</p>
                )}
              </div>

              {/* Row 5: Time Breakdown & Activities */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Activities &amp; Time Breakdown (one per line)
                </label>
                <textarea
                  rows={3}
                  value={formData.activitiesListText}
                  disabled={isEditMode && ['Submitted', 'Approved', 'Completed'].includes(activePlanDetail?.status || '')}
                  onChange={(e) => setFormData({ ...formData, activitiesListText: e.target.value })}
                  placeholder="Warm-up &amp; Icebreaker (15 mins)&#10;Concept Demonstration (25 mins)&#10;Group Activity &amp; Practice (30 mins)&#10;Exit Assessment &amp; Quiz (20 mins)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91] font-mono text-[11px] disabled:opacity-50"
                />
              </div>

              {/* Row 6: Materials Required & Assessment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Materials &amp; Kits Required
                  </label>
                  <textarea
                    rows={2}
                    value={formData.materialsText}
                    disabled={isEditMode && ['Submitted', 'Approved', 'Completed'].includes(activePlanDetail?.status || '')}
                    onChange={(e) => setFormData({ ...formData, materialsText: e.target.value })}
                    placeholder="Flashcards, 30 Printed Worksheets, Markers, Reward stickers"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91] disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Exit Assessment Task
                  </label>
                  <textarea
                    rows={2}
                    value={formData.assessmentTask}
                    disabled={isEditMode && ['Submitted', 'Approved', 'Completed'].includes(activePlanDetail?.status || '')}
                    onChange={(e) => setFormData({ ...formData, assessmentTask: e.target.value })}
                    placeholder="5-question visual fraction puzzle worksheet evaluated in pairs."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91] disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Row 7: Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  disabled={isEditMode && ['Submitted', 'Approved', 'Completed'].includes(activePlanDetail?.status || '')}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Volunteer Guidance & Center Logistics..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91] disabled:opacity-50"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between rounded-b-xl">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {!(isEditMode && ['Submitted', 'Approved', 'Completed'].includes(activePlanDetail?.status || '')) && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleFormSubmit('Draft')}
                    className="px-3.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormSubmit('Submitted')}
                    className="px-4 py-1.5 bg-[#0B3D91] hover:bg-[#082a66] text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
                  >
                    {isEditMode ? 'Save & Submit Plan' : 'Submit for Review'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REQUEST CORRECTION MODAL */}
      {isCorrectionModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-md border border-slate-200 shadow-sm max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">feedback</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Request Lesson Plan Correction</h3>
                <p className="text-xs text-slate-500">Provide actionable feedback to the volunteer.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Feedback &amp; Required Revisions <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={correctionReasonInput}
                onChange={(e) => setCorrectionReasonInput(e.target.value)}
                placeholder="e.g. Please add specific safety instructions for outdoor nature collection and include time breakdown for the second 30-minute block..."
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsCorrectionModalOpen(false)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                disabled={!correctionReasonInput.trim()}
                onClick={handleSubmitCorrection}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-xs"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


