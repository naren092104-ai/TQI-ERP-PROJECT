import React, { useState, useMemo } from 'react';
import { TabType, LessonPlan, Panchayat, Volunteer, Session } from '../types';

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
    <div className="space-y-5 max-w-7xl mx-auto pb-12 font-sans">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
            <button
              onClick={() => onNavigate('dashboard')}
              className="hover:text-[#0B3D91] transition-colors cursor-pointer"
            >
              Dashboard
            </button>
            <span className="text-slate-400">/</span>
            <span className="text-[#0B3D91] font-semibold">Lesson Plan</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Lesson Plan</h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Manage, review and track lesson plans across your cluster.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => handlePrintPDF()}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-slate-500">picture_as_pdf</span>
            Export PDF
          </button>
          <button
            onClick={handleOpenNewModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0B3D91] hover:bg-[#082a66] text-white text-xs font-semibold rounded-md shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Lesson Plan
          </button>
        </div>
      </div>

      {/* Summary Cards (Compact, data-driven) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-md p-3 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Plans
            </div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{totalCount}</div>
          </div>
          <span className="w-8 h-8 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">menu_book</span>
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-md p-3 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Approved
            </div>
            <div className="text-xl font-bold text-emerald-700 mt-0.5">{approvedCount}</div>
          </div>
          <span className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">verified</span>
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-md p-3 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Submitted / Review
            </div>
            <div className="text-xl font-bold text-blue-700 mt-0.5">{submittedCount}</div>
          </div>
          <span className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">rate_review</span>
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-md p-3 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Needs Correction
            </div>
            <div className="text-xl font-bold text-amber-700 mt-0.5">{correctionCount}</div>
          </div>
          <span className="w-8 h-8 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">feedback</span>
          </span>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-white border border-slate-200 rounded-md p-3.5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search bar */}
          <div className="relative sm:col-span-2 lg:col-span-2">
            <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by topic, module, volunteer or village..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:border-[#0B3D91] transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>

          {/* Panchayat filter */}
          <div>
            <select
              value={selectedPanchayat}
              onChange={(e) => {
                setSelectedPanchayat(e.target.value);
                setSelectedVillage('all');
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:border-[#0B3D91]"
            >
              <option value="all">All Panchayats</option>
              {panchayats.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Village filter */}
          <div>
            <select
              value={selectedVillage}
              onChange={(e) => setSelectedVillage(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:border-[#0B3D91]"
            >
              <option value="all">All Villages</option>
              {currentFilterVillages.map((v) => (
                <option key={v.id} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:border-[#0B3D91]"
            >
              <option value="all">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Submitted">Submitted</option>
              <option value="Correction Requested">Correction Requested</option>
              <option value="Resubmitted">Resubmitted</option>
              <option value="Draft">Draft</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* LESSON PLAN TABLE */}
      <div className="bg-white border border-slate-200 rounded-md shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3.5">Date &amp; Module</th>
                <th className="py-2.5 px-3.5">Topic &amp; Learning Objective</th>
                <th className="py-2.5 px-3.5">Panchayat &amp; Village</th>
                <th className="py-2.5 px-3.5">Volunteer</th>
                <th className="py-2.5 px-3.5">Status</th>
                <th className="py-2.5 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[32px] text-slate-300">
                        menu_book
                      </span>
                      <p className="font-semibold text-sm text-slate-700">No lesson plans found</p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        Try adjusting your filters or create a new lesson plan.
                      </p>
                      <button
                        onClick={handleClearFilters}
                        className="mt-1 px-3 py-1 text-xs font-semibold text-[#0B3D91] bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
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
                      className={`hover:bg-slate-50/80 transition-colors group ${
                        isCorrectionReq ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* Date & Module */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{plan.date || '28 Aug 2026'}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span className="font-mono text-slate-600 bg-slate-100 px-1 py-0.2 rounded text-[10px]">
                            {plan.moduleId || 'M-103'}
                          </span>
                          <span>•</span>
                          <span>{getPlanModule(plan)}</span>
                        </div>
                      </td>

                      {/* Topic & Objective */}
                      <td className="py-3 px-3.5 max-w-xs">
                        <div className="font-semibold text-slate-900 group-hover:text-[#0B3D91] transition-colors">
                          {getPlanTopic(plan)}
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {plan.objective || plan.description || 'Core curriculum learning objective'}
                        </div>
                      </td>

                      {/* Panchayat & Village */}
                      <td className="py-3 px-3.5">
                        <div className="font-medium text-slate-800">{plan.panchayatName || 'Vedakkattamaduvu'}</div>
                        <div className="text-[11px] text-slate-500">{plan.villageName || 'Ammapettai'}</div>
                      </td>

                      {/* Volunteer */}
                      <td className="py-3 px-3.5">
                        <div className="font-medium text-slate-900 flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-[#0B3D91]/10 text-[#0B3D91] text-[10px] font-bold flex items-center justify-center">
                            {(plan.volunteerName || 'B').charAt(0)}
                          </div>
                          <span>{plan.volunteerName || 'Bala'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {renderStatusBadge(plan.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            onClick={() => setActivePlanDetail(plan)}
                            className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:text-[#0B3D91] hover:bg-slate-50 rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                          >
                            View Plan
                          </button>

                          {/* Quick Admin Actions */}
                          {plan.status === 'Submitted' || plan.status === 'Resubmitted' ? (
                            <button
                              onClick={() => handleApprovePlan(plan.id)}
                              className="px-2 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded text-xs font-semibold transition-colors cursor-pointer"
                              title="Approve Lesson Plan"
                            >
                              Approve
                            </button>
                          ) : null}

                          <button
                            onClick={() => handleOpenEditModal(plan)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40  overflow-y-auto">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40  overflow-y-auto">
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
              {/* Row 1: Topic & Module */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lesson Topic / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.topic}
                    onChange={(e) => {
                      setFormData({ ...formData, topic: e.target.value });
                      if (formErrors.topic) setFormErrors({ ...formErrors, topic: '' });
                    }}
                    placeholder="e.g. Basic Conversation & Dialogue Drills"
                    className={`w-full px-3 py-2 border rounded-md text-xs focus:outline-none focus:border-[#0B3D91] ${
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
                  <select
                    value={formData.moduleName}
                    onChange={(e) => {
                      const mod = e.target.value;
                      let modId = 'M-103';
                      if (mod === 'Basic Math') modId = 'M-301';
                      if (mod === 'Life Skills') modId = 'M-102';
                      if (mod === 'Digital Literacy') modId = 'D-004';
                      if (mod === 'Science') modId = 'S-201';
                      if (mod === 'Financial Literacy') modId = 'F-101';
                      setFormData({ ...formData, moduleName: mod, moduleId: modId });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                  >
                    <option value="Spoken English">Spoken English (M-103)</option>
                    <option value="Basic Math">Basic Math (M-301)</option>
                    <option value="Life Skills">Life Skills (M-102)</option>
                    <option value="Digital Literacy">Digital Literacy (D-004)</option>
                    <option value="Science">Science (S-201)</option>
                    <option value="Financial Literacy">Financial Literacy (F-101)</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Standard & Duration & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Standard / Grade
                  </label>
                  <select
                    value={formData.targetStandard}
                    onChange={(e) => setFormData({ ...formData, targetStandard: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                  >
                    <option value="4th - 5th Standard">4th - 5th Standard</option>
                    <option value="6th - 8th Standard">6th - 8th Standard</option>
                    <option value="9th - 10th Standard">9th - 10th Standard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="90 Mins"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Session Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                  />
                </div>
              </div>

              {/* Row 3: Hierarchy Location & Volunteer */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-slate-50/70 p-3 rounded-md border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Panchayat <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.panchayatId}
                    onChange={(e) => {
                      const found = panchayats.find((p) => p.id === e.target.value);
                      if (found) {
                        setFormData({
                          ...formData,
                          panchayatId: found.id,
                          panchayatName: found.name,
                          villageName: found.villages[0]?.name || 'Main Center',
                        });
                      }
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                  >
                    {panchayats.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Village Center <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.villageName}
                    onChange={(e) => {
                      setFormData({ ...formData, villageName: e.target.value });
                      if (formErrors.villageName) setFormErrors({ ...formErrors, villageName: '' });
                    }}
                    className={`w-full px-2.5 py-1.5 bg-white border rounded-md text-xs focus:outline-none focus:border-[#0B3D91] ${
                      formErrors.villageName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}
                  >
                    <option value="">Select Village Center</option>
                    {modalVillages.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Volunteer Lead
                  </label>
                  <select
                    value={formData.volunteerId}
                    onChange={(e) => {
                      const found = volunteers.find((v) => v.id === e.target.value);
                      if (found) {
                        setFormData({ ...formData, volunteerId: found.id, volunteerName: found.name });
                      }
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                  >
                    {volunteers.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
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
                  onChange={(e) => {
                    setFormData({ ...formData, objective: e.target.value });
                    if (formErrors.objective) setFormErrors({ ...formErrors, objective: '' });
                  }}
                  placeholder="State the core outcome students will achieve by the end of 90 minutes..."
                  className={`w-full px-3 py-2 border rounded-md text-xs focus:outline-none focus:border-[#0B3D91] ${
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
                  onChange={(e) => setFormData({ ...formData, activitiesListText: e.target.value })}
                  placeholder="Warm-up &amp; Icebreaker (15 mins)&#10;Concept Demonstration (25 mins)&#10;Group Activity &amp; Practice (30 mins)&#10;Exit Assessment &amp; Quiz (20 mins)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91] font-mono text-[11px]"
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
                    onChange={(e) => setFormData({ ...formData, materialsText: e.target.value })}
                    placeholder="Flashcards, 30 Printed Worksheets, Markers, Reward stickers"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Exit Assessment Task
                  </label>
                  <textarea
                    rows={2}
                    value={formData.assessmentTask}
                    onChange={(e) => setFormData({ ...formData, assessmentTask: e.target.value })}
                    placeholder="5-question visual fraction puzzle worksheet evaluated in pairs."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                  />
                </div>
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
            </div>
          </div>
        </div>
      )}

      {/* REQUEST CORRECTION MODAL */}
      {isCorrectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 ">
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


