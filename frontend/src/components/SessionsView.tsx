import React, { useEffect, useState, useMemo } from 'react';
import { TabType, Session, Panchayat, Volunteer } from '../types';

interface SessionsViewProps {
  sessions: Session[];
  panchayats: Panchayat[];
  volunteers: Volunteer[];
  onNavigate: (tab: TabType, targetId?: string, secondaryParam?: string) => void;
  onAddSession: (newSession: Omit<Session, 'id'>) => void;
  onUpdateSession: (id: string, updated: Partial<Session>) => void;
  onDeleteSession?: (id: string) => void;
  canManageSchedule?: boolean;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions = [],
  panchayats = [],
  volunteers = [],
  onNavigate,
  onAddSession,
  onUpdateSession,
  onDeleteSession,
  canManageSchedule = false,
}) => {
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPanchayat, setSelectedPanchayat] = useState('all');
  const [selectedVillage, setSelectedVillage] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedVolunteer, setSelectedVolunteer] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Modals / Drawers
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeSessionDetail, setActiveSessionDetail] = useState<Session | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [dateDrafts, setDateDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setDateDrafts((current) => {
      const next = { ...current };
      sessions.forEach((session) => {
        if (!(session.id in next)) next[session.id] = session.date || '';
      });
      return next;
    });
  }, [sessions]);

  // Form State for Create / Edit Session
  const [formData, setFormData] = useState({
    id: '',
    code: '',
    name: '',
    moduleId: 'M-103',
    module: 'Spoken English',
    day: 'Saturday',
    date: new Date().toISOString().split('T')[0],
    time: '10:00 AM',
    endTime: '11:30 AM',
    panchayatId: panchayats[0]?.id || 'vedakkattamaduvu',
    panchayatName: panchayats[0]?.name || 'Vedakkattamaduvu',
    villageName: panchayats[0]?.villages[0]?.name || 'Ammapettai',
    volunteerId: volunteers[0]?.id || 'vol-1',
    volunteerName: volunteers[0]?.name || 'Bala',
    sessionType: 'Academic' as 'Academic' | 'Life Skills' | 'Assessment' | 'Orientation',
    description: '',
    status: 'Scheduled' as Session['status'],
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

  // Dynamic list of villages based on selected panchayat in modal form
  const modalVillages = useMemo(() => {
    const found = panchayats.find((p) => p.id === formData.panchayatId);
    return found?.villages || [];
  }, [formData.panchayatId, panchayats]);

  // Helper text extractors
  const getSessionTitle = (s?: Session): string => {
    if (!s) return 'Untitled Session';
    return s.name || s.title || s.code || 'Untitled Session';
  };

  const getSessionModule = (s?: Session): string => {
    if (!s) return 'General';
    return s.module || s.moduleId || 'General Module';
  };

  const getSessionVolunteer = (s?: Session): string => {
    if (!s || !s.volunteerName || s.volunteerName === 'Unassigned') return 'Unassigned';
    return s.volunteerName;
  };

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const title = getSessionTitle(s).toLowerCase();
      const mod = getSessionModule(s).toLowerCase();
      const vill = (s.villageName || '').toLowerCase();
      const vol = (s.volunteerName || '').toLowerCase();
      const pan = (s.panchayatName || '').toLowerCase();
      const search = searchTerm.toLowerCase().trim();

      const matchSearch =
        !search ||
        title.includes(search) ||
        mod.includes(search) ||
        vill.includes(search) ||
        vol.includes(search) ||
        pan.includes(search) ||
        (s.code || '').toLowerCase().includes(search);

      const matchPanchayat =
        selectedPanchayat === 'all' || s.panchayatId === selectedPanchayat;

      const matchVillage =
        selectedVillage === 'all' ||
        (s.villageName || '').toLowerCase() === selectedVillage.toLowerCase();

      const matchStatus =
        selectedStatus === 'all' ||
        s.status.toLowerCase() === selectedStatus.toLowerCase() ||
        (selectedStatus === 'Needs Attention' && (s.status === 'Needs Attention' || s.status === 'Action Req.'));

      const matchModule =
        selectedModule === 'all' ||
        mod.includes(selectedModule.toLowerCase()) ||
        s.moduleId === selectedModule;

      const matchVolunteer =
        selectedVolunteer === 'all' ||
        s.volunteerId === selectedVolunteer ||
        (s.volunteerName || '').toLowerCase() === selectedVolunteer.toLowerCase();

      const matchDate = !filterDate || s.date === filterDate;

      return (
        matchSearch &&
        matchPanchayat &&
        matchVillage &&
        matchStatus &&
        matchModule &&
        matchVolunteer &&
        matchDate
      );
    });
  }, [
    sessions,
    searchTerm,
    selectedPanchayat,
    selectedVillage,
    selectedStatus,
    selectedModule,
    selectedVolunteer,
    filterDate,
  ]);

  // Quick Summary Counts
  const upcomingCount = sessions.filter(
    (s) => s.status === 'Scheduled' || s.status === 'In Progress'
  ).length;
  const scheduledCount = sessions.filter((s) => s.status === 'Scheduled').length;
  const completedCount = sessions.filter((s) => s.status === 'Completed').length;
  const needsAttentionCount = sessions.filter(
    (s) => s.status === 'Needs Attention' || s.status === 'Action Req.' || s.volunteerName === 'Unassigned'
  ).length;

  // Next Session spotlight item
  const nextSession = useMemo(() => {
    const scheduled = sessions.filter((s) => s.status === 'Scheduled');
    if (scheduled.length > 0) return scheduled[0];
    return sessions[0] || null;
  }, [sessions]);

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedPanchayat('all');
    setSelectedVillage('all');
    setSelectedStatus('all');
    setSelectedModule('all');
    setSelectedVolunteer('all');
    setFilterDate('');
  };

  // Open Create Modal
  const handleOpenNewModal = () => {
    setIsEditMode(false);
    setFormErrors({});
    const defaultP = panchayats[0];
    setFormData({
      id: '',
      code: `M-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      moduleId: 'M-103',
      module: 'Spoken English',
      day: 'Saturday',
      date: new Date().toISOString().split('T')[0],
      time: '10:00 AM',
      endTime: '11:30 AM',
      panchayatId: defaultP?.id || 'vedakkattamaduvu',
      panchayatName: defaultP?.name || 'Vedakkattamaduvu',
      villageName: defaultP?.villages[0]?.name || 'Ammapettai',
      volunteerId: volunteers[0]?.id || 'vol-1',
      volunteerName: volunteers[0]?.name || 'Bala',
      sessionType: 'Academic',
      description: '',
      status: 'Scheduled',
    });
    setIsNewModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (session: Session) => {
    setIsEditMode(true);
    setFormErrors({});
    setFormData({
      id: session.id,
      code: session.code || `M-103`,
      name: session.name || session.title || '',
      moduleId: session.moduleId || 'M-103',
      module: session.module || 'Spoken English',
      day: session.day || 'Saturday',
      date: session.date || '',
      time: session.time || '10:00 AM',
      endTime: session.endTime || '11:30 AM',
      panchayatId: session.panchayatId || (panchayats[0]?.id || ''),
      panchayatName: session.panchayatName || (panchayats[0]?.name || ''),
      villageName: session.villageName || '',
      volunteerId: session.volunteerId || '',
      volunteerName: session.volunteerName || 'Unassigned',
      sessionType: session.sessionType || 'Academic',
      description: session.description || '',
      status: session.status || 'Scheduled',
    });
    setIsNewModalOpen(true);
  };

  // Handle Form Change
  const handlePanchayatSelectChange = (pId: string) => {
    const found = panchayats.find((p) => p.id === pId);
    if (found) {
      setFormData((prev) => ({
        ...prev,
        panchayatId: found.id,
        panchayatName: found.name,
        villageName: found.villages[0]?.name || 'Main Center',
      }));
    }
  };

  const handleVolunteerSelectChange = (vId: string) => {
    if (vId === 'unassigned') {
      setFormData((prev) => ({
        ...prev,
        volunteerId: '',
        volunteerName: 'Unassigned',
      }));
      return;
    }
    const found = volunteers.find((v) => v.id === vId);
    if (found) {
      setFormData((prev) => ({
        ...prev,
        volunteerId: found.id,
        volunteerName: found.name,
      }));
    }
  };

  // Validate & Submit
  const handleFormSubmit = (asDraft = false) => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Session topic is required.';
    }
    if (!formData.villageName.trim()) {
      errors.villageName = 'Please select a village.';
    }
    if (!formData.volunteerName.trim() || formData.volunteerName === 'Unassigned') {
      if (!asDraft) {
        errors.volunteer = 'Please select a volunteer.';
      }
    }
    if (!formData.date.trim()) {
      errors.date = 'Please select a valid date.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const finalStatus: Session['status'] = asDraft
      ? 'Draft'
      : formData.status || 'Scheduled';

    if (isEditMode && formData.id) {
      onUpdateSession(formData.id, {
        name: formData.name.trim(),
        title: formData.name.trim(),
        code: formData.code,
        moduleId: formData.moduleId,
        module: formData.module,
        day: formData.day,
        date: formData.date,
        time: formData.time,
        endTime: formData.endTime,
        panchayatId: formData.panchayatId,
        panchayatName: formData.panchayatName,
        villageName: formData.villageName,
        volunteerId: formData.volunteerId,
        volunteerName: formData.volunteerName,
        sessionType: formData.sessionType,
        description: formData.description,
        status: finalStatus,
      });
      if (activeSessionDetail?.id === formData.id) {
        setActiveSessionDetail((prev) => (prev ? { ...prev, ...formData, status: finalStatus } : null));
      }
    } else {
      const newSession: Omit<Session, 'id'> = {
        code: formData.code || `M-${Math.floor(100 + Math.random() * 900)}`,
        name: formData.name.trim(),
        title: formData.name.trim(),
        moduleId: formData.moduleId,
        module: formData.module,
        day: formData.day,
        date: formData.date,
        time: formData.time,
        endTime: formData.endTime,
        panchayatId: formData.panchayatId,
        panchayatName: formData.panchayatName,
        villageName: formData.villageName,
        volunteerId: formData.volunteerId,
        volunteerName: formData.volunteerName,
        sessionType: formData.sessionType,
        description: formData.description || 'Weekly student holistic development learning session.',
        status: finalStatus,
        spoc: formData.volunteerName,
        financer: 'Cluster Fund',
      };
      onAddSession(newSession);
    }

    setIsNewModalOpen(false);
  };

  // CSV Export Function
  const handleExportCSV = () => {
    if (filteredSessions.length === 0) {
      alert('No session data available to export.');
      return;
    }
    const headers = [
      'Session Code',
      'Topic',
      'Module',
      'Date',
      'Time',
      'Day',
      'Panchayat',
      'Village',
      'Assigned Volunteer',
      'Status',
      'Session Type',
    ];

    const rows = filteredSessions.map((s) => [
      `"${s.code || ''}"`,
      `"${(s.name || s.title || '').replace(/"/g, '""')}"`,
      `"${(s.module || s.moduleId || '').replace(/"/g, '""')}"`,
      `"${s.date}"`,
      `"${s.time}"`,
      `"${s.day || ''}"`,
      `"${s.panchayatName}"`,
      `"${s.villageName}"`,
      `"${s.volunteerName}"`,
      `"${s.status}"`,
      `"${s.sessionType || 'Academic'}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `TQI_Sessions_Dharmapuri_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render Status Badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Scheduled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            Scheduled
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            In Progress
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            Completed
          </span>
        );
      case 'Needs Attention':
      case 'Action Req.':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
            Needs Attention
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Cancelled
          </span>
        );
      case 'Draft':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            Draft
          </span>
        );
    }
  };

  return (
    <div className="page-container space-y-5">
      {/* Page header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Sessions</h1>
          <p className="page-subtitle">Plan, manage and track learning sessions.</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button onClick={handleExportCSV} className="btn btn-secondary btn-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>file_download</span>
            Export
          </button>
          {canManageSchedule && (
            <span className="text-xs text-slate-500">Dates are managed by your cluster</span>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-item" style={{ cursor: 'default' }}>
          <div className="stat-label">Upcoming</div>
          <div className="stat-value">{upcomingCount}</div>
        </div>
        <div className="stat-item" style={{ cursor: 'default' }}>
          <div className="stat-label">Scheduled</div>
          <div className="stat-value">{scheduledCount}</div>
        </div>
        <div className="stat-item" style={{ cursor: 'default' }}>
          <div className="stat-label">Completed</div>
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>{completedCount}</div>
        </div>
        <div className="stat-item" style={{ cursor: 'default', background: needsAttentionCount > 0 ? 'var(--color-error-bg)' : undefined, borderColor: needsAttentionCount > 0 ? 'var(--color-error-border)' : undefined }}>
          <div className="stat-label" style={{ color: needsAttentionCount > 0 ? 'var(--color-error)' : undefined }}>Needs attention</div>
          <div className="stat-value" style={{ color: needsAttentionCount > 0 ? 'var(--color-error)' : undefined }}>{needsAttentionCount}</div>
        </div>
      </div>

      {/* NEXT SESSION Spotlight Section (Compact & Actionable) */}
      {nextSession && (
        <div className="card p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-md bg-[#0B3D91]/10 text-[#0B3D91] flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[22px]">event</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    Next Session
                  </span>
                  {renderStatusBadge(nextSession.status)}
                </div>
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {getSessionTitle(nextSession)}
                  {nextSession.code && (
                    <span className="ml-2 text-xs font-semibold text-slate-500 font-mono">
                      ({nextSession.code})
                    </span>
                  )}
                </h3>
                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600">
                  <span className="flex items-center gap-1 font-medium text-slate-800">
                    <span className="material-symbols-outlined text-[14px] text-slate-400">schedule</span>
                    {nextSession.date} · {nextSession.time}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-slate-400">Panchayat:</span>
                    <strong className="text-slate-700">{nextSession.panchayatName}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-slate-400">Village:</span>
                    <strong className="text-slate-700">{nextSession.villageName}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-slate-400">Volunteer:</span>
                    <strong className="text-[#0B3D91] font-semibold">{getSessionVolunteer(nextSession)}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
              <button
                onClick={() => setActiveSessionDetail(nextSession)}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
              >
                View Session
              </button>
              <button
                onClick={() => onNavigate('lesson-plan', nextSession.lessonPlanId || nextSession.id)}
                className="px-3 py-1.5 bg-white border border-slate-300 text-[#0B3D91] hover:bg-blue-50 text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
              >
                Lesson Plan
              </button>
              <button
                onClick={() => onNavigate('attendance', nextSession.id)}
                className="px-3 py-1.5 bg-[#FF7A00] hover:bg-[#e06c00] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
              >
                Attendance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEARCH + FILTER PANEL */}
      <div className="bg-white border border-slate-200 rounded-md p-3.5 shadow-xs space-y-3">
        {/* Primary Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search bar */}
          <div className="relative">
            <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search session, module, village or volunteer..."
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

          {/* Status Filter + More Filters Toggle */}
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:border-[#0B3D91]"
            >
              <option value="all">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Needs Attention">Needs Attention</option>
              <option value="Draft">Draft</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <button
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              className={`px-2.5 py-1.5 text-xs font-medium border rounded-md transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
                showMoreFilters || selectedModule !== 'all' || selectedVolunteer !== 'all' || filterDate
                  ? 'bg-blue-50 border-[#0B3D91] text-[#0B3D91]'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Secondary Expandable Filters */}
        {showMoreFilters && (
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 items-center">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">
                Module
              </label>
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0B3D91]"
              >
                <option value="all">All Modules</option>
                <option value="Spoken English">Spoken English</option>
                <option value="Basic Math">Basic Math</option>
                <option value="Life Skills">Life Skills</option>
                <option value="Digital Literacy">Digital Literacy</option>
                <option value="Science">Science</option>
                <option value="Financial Literacy">Financial Literacy</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">
                Volunteer
              </label>
              <select
                value={selectedVolunteer}
                onChange={(e) => setSelectedVolunteer(e.target.value)}
                className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0B3D91]"
              >
                <option value="all">All Volunteers</option>
                {volunteers.map((v) => (
                  <option key={v.id} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">
                Date
              </label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0B3D91]"
              />
            </div>

            <div className="flex items-end justify-end gap-2 pt-3">
              <button
                onClick={handleClearFilters}
                className="px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SESSION TABLE */}
      <div className="bg-white border border-slate-200 rounded-md shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3.5">Date &amp; Time</th>
                <th className="py-2.5 px-3.5">Session Topic &amp; Module</th>
                <th className="py-2.5 px-3.5">Panchayat &amp; Village</th>
                <th className="py-2.5 px-3.5">Assigned Volunteer</th>
                <th className="py-2.5 px-3.5">Status</th>
                <th className="py-2.5 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[32px] text-slate-300">
                        event_busy
                      </span>
                      <p className="font-semibold text-sm text-slate-700">No sessions found</p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        No sessions match your filter criteria. Try adjusting search or clearing filters.
                      </p>
                      <button
                        onClick={handleClearFilters}
                        className="mt-1 px-3 py-1 text-xs font-semibold text-[#0B3D91] bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => {
                  const isCompleted = session.status === 'Completed';

                  return (
                    <tr
                      key={session.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Date & Time */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#0B3D91] mb-1">{session.clusterName}</div>
                        <div className="font-bold text-slate-900">{session.date}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-[13px]">schedule</span>
                          {session.time}
                        </div>
                      </td>

                      {/* Topic & Module */}
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-slate-900 group-hover:text-[#0B3D91] transition-colors">
                          {getSessionTitle(session)}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-slate-600 bg-slate-100 px-1 py-0.2 rounded text-[10px]">
                            {session.code || session.moduleId || 'M-103'}
                          </span>
                          <span>•</span>
                          <span>{getSessionModule(session)}</span>
                        </div>
                      </td>

                      {/* Panchayat & Village */}
                      <td className="py-3 px-3.5">
                        <div className="font-medium text-slate-800">{session.panchayatName}</div>
                        <div className="text-[11px] text-slate-500">{session.villageName}</div>
                      </td>

                      {/* Volunteer */}
                      <td className="py-3 px-3.5">
                        {session.volunteerName && session.volunteerName !== 'Unassigned' ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#0B3D91]/10 text-[#0B3D91] text-[10px] font-bold flex items-center justify-center">
                              {session.volunteerName.charAt(0)}
                            </div>
                            <span className="font-medium text-slate-900">{session.volunteerName}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                            <span className="material-symbols-outlined text-[12px]">person_off</span>
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {renderStatusBadge(session.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          {canManageSchedule && (
                            <div className="inline-flex items-center gap-1 mr-1">
                              <input
                                type="date"
                                aria-label={`Date for ${getSessionTitle(session)}`}
                                value={dateDrafts[session.id] || ''}
                                onChange={(event) => setDateDrafts((current) => ({ ...current, [session.id]: event.target.value }))}
                                className="px-2 py-1 text-xs border border-slate-300 rounded-md"
                              />
                              <button
                                onClick={() => {
                                  const date = dateDrafts[session.id] || '';
                                  onUpdateSession(session.id, { date, status: date ? (session.status === 'Completed' ? 'Completed' : 'Scheduled') : 'Draft' });
                                }}
                                className="px-2 py-1 bg-[#0B3D91] text-white rounded-md text-xs font-semibold"
                              >
                                Save
                              </button>
                              {session.status !== 'Completed' && (
                                <button
                                  disabled={!dateDrafts[session.id]}
                                  onClick={() => onUpdateSession(session.id, { date: dateDrafts[session.id] || '', status: 'Completed' })}
                                  className="px-2 py-1 bg-emerald-600 disabled:bg-slate-300 text-white rounded-md text-xs font-semibold"
                                >
                                  Complete
                                </button>
                              )}
                            </div>
                          )}
                          {/* View */}
                          <button
                            onClick={() => setActiveSessionDetail(session)}
                            className="px-2 py-1 text-slate-600 hover:text-[#0B3D91] hover:bg-slate-100 rounded text-xs font-semibold transition-colors cursor-pointer"
                            title="View Session Details"
                          >
                            View
                          </button>

                          {/* Lesson Plan */}
                          <button
                            onClick={() => onNavigate('lesson-plan', session.lessonPlanId || session.id)}
                            className="px-2 py-1 text-blue-700 hover:bg-blue-50 rounded text-xs font-semibold transition-colors cursor-pointer"
                            title="Open Lesson Plan"
                          >
                            Plan
                          </button>

                          {/* Attendance */}
                          <button
                            onClick={() => onNavigate('attendance', session.id)}
                            className="px-2 py-1 text-[#FF7A00] hover:bg-orange-50 rounded text-xs font-semibold transition-colors cursor-pointer"
                            title="Mark or View Attendance"
                          >
                            Attendance
                          </button>

                          {/* Photos (for completed sessions) */}
                          {isCompleted && (
                            <button
                              onClick={() => onNavigate('session-photos', session.id)}
                              className="px-2 py-1 text-emerald-700 hover:bg-emerald-50 rounded text-xs font-semibold transition-colors cursor-pointer"
                              title="View Session Photos"
                            >
                              Photos
                            </button>
                          )}

                          {/* Edit (only if not completed / locked) */}
                          {!isCompleted && canManageSchedule && (
                            <button
                              onClick={() => handleOpenEditModal(session)}
                              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="Edit Session"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                          )}

                          {/* Delete (only if not completed) */}
                          {!isCompleted && canManageSchedule && onDeleteSession && (
                            <button
                              onClick={() => setSessionToDelete(session)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Delete Session"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          )}
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

      {/* CREATE / EDIT SESSION MODAL (Clean Drawer / Modal) */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40  overflow-y-auto">
          <div className="bg-white rounded-md border border-slate-200 shadow-sm max-w-2xl w-full max-h-[92vh] flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 rounded-t-xl">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {isEditMode ? 'Edit Session' : 'Create New Session'}
                </h2>
                <p className="text-xs text-slate-500">
                  Fill in the details to schedule learning activity in your cluster.
                </p>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body / Form */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Row 1: Topic & Module */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Session Topic <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                    }}
                    placeholder="e.g. Spoken English — Module 3"
                    className={`w-full px-3 py-2 border rounded-md text-xs focus:outline-none focus:border-[#0B3D91] ${
                      formErrors.name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.name && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Curriculum Module
                  </label>
                  <select
                    value={formData.module}
                    onChange={(e) => {
                      const mod = e.target.value;
                      let modId = 'M-103';
                      if (mod === 'Basic Math') modId = 'M-301';
                      if (mod === 'Life Skills') modId = 'M-102';
                      if (mod === 'Digital Literacy') modId = 'D-004';
                      if (mod === 'Science') modId = 'S-201';
                      if (mod === 'Financial Literacy') modId = 'F-101';
                      setFormData({ ...formData, module: mod, moduleId: modId });
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

              {/* Row 2: Date, Day & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => {
                      setFormData({ ...formData, date: e.target.value });
                      if (formErrors.date) setFormErrors({ ...formErrors, date: '' });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                  />
                  {formErrors.date && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.date}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Day of Week
                  </label>
                  <select
                    value={formData.day}
                    onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                  >
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Time Window
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      placeholder="10:00 AM"
                      className="w-1/2 px-2.5 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                    />
                    <span className="text-slate-400 font-bold">-</span>
                    <input
                      type="text"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      placeholder="11:30 AM"
                      className="w-1/2 px-2.5 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Hierarchy (Panchayat & Village) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50/70 p-3 rounded-md border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Panchayat <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.panchayatId}
                    onChange={(e) => handlePanchayatSelectChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
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
                    Village / Learning Center <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.villageName}
                    onChange={(e) => {
                      setFormData({ ...formData, villageName: e.target.value });
                      if (formErrors.villageName) setFormErrors({ ...formErrors, villageName: '' });
                    }}
                    className={`w-full px-3 py-2 bg-white border rounded-md text-xs focus:outline-none focus:border-[#0B3D91] ${
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
                  {formErrors.villageName && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.villageName}</p>
                  )}
                </div>
              </div>

              {/* Row 4: Volunteer & Type & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assigned Volunteer <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.volunteerId || (formData.volunteerName === 'Unassigned' ? 'unassigned' : '')}
                    onChange={(e) => {
                      handleVolunteerSelectChange(e.target.value);
                      if (formErrors.volunteer) setFormErrors({ ...formErrors, volunteer: '' });
                    }}
                    className={`w-full px-3 py-2 border rounded-md text-xs focus:outline-none focus:border-[#0B3D91] ${
                      formErrors.volunteer ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}
                  >
                    <option value="unassigned">-- Unassigned (Needs Attention) --</option>
                    {volunteers.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.department?.split(' ')[0] || 'Mentor'})
                      </option>
                    ))}
                  </select>
                  {formErrors.volunteer && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.volunteer}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Session Type
                  </label>
                  <select
                    value={formData.sessionType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sessionType: e.target.value as 'Academic' | 'Life Skills' | 'Assessment' | 'Orientation',
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                  >
                    <option value="Academic">Academic Core</option>
                    <option value="Life Skills">Life Skills &amp; Habits</option>
                    <option value="Assessment">Assessment &amp; Review</option>
                    <option value="Orientation">Orientation &amp; Games</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as Session['status'] })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Needs Attention">Needs Attention</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
              </div>

              {/* Row 5: Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Lesson Objective Note
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Outline key learning goals, expected activity or required kit..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                />
              </div>
            </div>

            {/* Modal Footer */}
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
                  onClick={() => handleFormSubmit(true)}
                  className="px-3.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleFormSubmit(false)}
                  className="px-4 py-1.5 bg-[#0B3D91] hover:bg-[#082a66] text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
                >
                  {isEditMode ? 'Update Session' : 'Create Session'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SESSION DETAIL MODAL / DRAWER */}
      {activeSessionDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40  overflow-y-auto">
          <div className="bg-white rounded-md border border-slate-200 shadow-sm max-w-3xl w-full max-h-[92vh] flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Detail Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 rounded-t-xl flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-mono font-bold bg-[#0B3D91]/10 text-[#0B3D91] px-2 py-0.5 rounded">
                    {activeSessionDetail.code || 'M-103'}
                  </span>
                  {renderStatusBadge(activeSessionDetail.status)}
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  {getSessionTitle(activeSessionDetail)}
                </h2>
                <p className="text-xs text-slate-500">
                  Module: {getSessionModule(activeSessionDetail)} • {activeSessionDetail.sessionType || 'Academic Session'}
                </p>
              </div>

              <button
                onClick={() => setActiveSessionDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Detail Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Field Operations Workflow Steps Indicator */}
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Session Delivery Workflow
                </div>
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 overflow-x-auto pb-1 gap-2">
                  <div className="flex items-center gap-1 shrink-0 text-emerald-700 font-bold">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                    <span>1. Created</span>
                  </div>
                  <span className="text-slate-300">→</span>
                  <div className="flex items-center gap-1 shrink-0 text-emerald-700 font-bold">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                    <span>2. Scheduled</span>
                  </div>
                  <span className="text-slate-300">→</span>
                  <div className={`flex items-center gap-1 shrink-0 ${activeSessionDetail.status === 'Completed' || activeSessionDetail.status === 'In Progress' ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                    <span className="material-symbols-outlined text-[16px]">
                      {activeSessionDetail.status === 'Completed' ? 'check_circle' : 'pending'}
                    </span>
                    <span>3. Conduct</span>
                  </div>
                  <span className="text-slate-300">→</span>
                  <div className={`flex items-center gap-1 shrink-0 ${activeSessionDetail.status === 'Completed' ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                    <span className="material-symbols-outlined text-[16px]">
                      {activeSessionDetail.status === 'Completed' ? 'check_circle' : 'fact_check'}
                    </span>
                    <span>4. Attendance</span>
                  </div>
                  <span className="text-slate-300">→</span>
                  <div className={`flex items-center gap-1 shrink-0 ${activeSessionDetail.status === 'Completed' ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                    <span className="material-symbols-outlined text-[16px]">
                      {activeSessionDetail.status === 'Completed' ? 'check_circle' : 'photo_camera'}
                    </span>
                    <span>5. Completed</span>
                  </div>
                </div>
              </div>

              {/* Core Information Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border border-slate-200 rounded-md p-3.5">
                <div>
                  <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                    Schedule Date
                  </span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                    {activeSessionDetail.date} ({activeSessionDetail.day || 'Sat'})
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                    Time Window
                  </span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                    {activeSessionDetail.time} - {activeSessionDetail.endTime || '11:30 AM'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                    Panchayat &amp; Village
                  </span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                    {activeSessionDetail.panchayatName}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    {activeSessionDetail.villageName}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                    Assigned Volunteer
                  </span>
                  <span className="font-bold text-[#0B3D91] text-xs mt-0.5 block">
                    {getSessionVolunteer(activeSessionDetail)}
                  </span>
                </div>
              </div>

              {/* Description */}
              {activeSessionDetail.description && (
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-1">
                  <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">
                    Session Description
                  </span>
                  <p className="text-slate-700 leading-relaxed">
                    {activeSessionDetail.description}
                  </p>
                </div>
              )}

              {/* Linked Modules: Lesson Plan + Attendance + Photos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Lesson Plan Card */}
                <div className="border border-slate-200 rounded-md p-3.5 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-[#0B3D91]">
                        menu_book
                      </span>
                      Lesson Plan
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      Linked
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Step-by-step 90-minute curriculum with worksheets and group drills.
                  </p>
                  <button
                    onClick={() => {
                      setActiveSessionDetail(null);
                      onNavigate('lesson-plan', activeSessionDetail.lessonPlanId || activeSessionDetail.id);
                    }}
                    className="w-full py-1.5 text-center text-xs font-semibold text-[#0B3D91] bg-blue-50 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                  >
                    Open Lesson Plan &gt;
                  </button>
                </div>

                {/* Attendance Card */}
                <div className="border border-slate-200 rounded-md p-3.5 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-[#FF7A00]">
                        how_to_reg
                      </span>
                      Attendance
                    </span>
                    <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      {activeSessionDetail.attendanceCount || 0}/{activeSessionDetail.totalStudents || 25} Students
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Mark student presence, task completion, and behavioral remarks.
                  </p>
                  <button
                    onClick={() => {
                      setActiveSessionDetail(null);
                      onNavigate('attendance', activeSessionDetail.id);
                    }}
                    className="w-full py-1.5 text-center text-xs font-semibold text-[#FF7A00] bg-orange-50 hover:bg-orange-100 rounded transition-colors cursor-pointer"
                  >
                    Mark Attendance &gt;
                  </button>
                </div>

                {/* Session Photos Card */}
                <div className="border border-slate-200 rounded-md p-3.5 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-emerald-600">
                        photo_library
                      </span>
                      Field Photos
                    </span>
                    <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      {activeSessionDetail.photos?.length || 1} Media
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Activity documentation and classroom verification media.
                  </p>
                  <button
                    onClick={() => {
                      setActiveSessionDetail(null);
                      onNavigate('session-photos', activeSessionDetail.id);
                    }}
                    className="w-full py-1.5 text-center text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors cursor-pointer"
                  >
                    Upload / View Photos &gt;
                  </button>
                </div>
              </div>
            </div>

            {/* Detail Footer Actions */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 rounded-b-xl">
              <button
                onClick={() => setActiveSessionDetail(null)}
                className="px-4 py-1.5 border border-slate-300 text-slate-700 hover:bg-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
              >
                Back to Sessions
              </button>

              <div className="flex items-center gap-2">
                {activeSessionDetail.status !== 'Completed' && (
                  <button
                    onClick={() => {
                      onUpdateSession(activeSessionDetail.id, { status: 'Completed' });
                      setActiveSessionDetail((prev) => (prev ? { ...prev, status: 'Completed' } : null));
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
                  >
                    Mark as Completed
                  </button>
                )}

                {activeSessionDetail.status !== 'Completed' && (
                  <button
                    onClick={() => {
                      const s = activeSessionDetail;
                      setActiveSessionDetail(null);
                      handleOpenEditModal(s);
                    }}
                    className="px-3.5 py-1.5 bg-[#0B3D91] hover:bg-[#082a66] text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
                  >
                    Edit Session
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 ">
          <div className="bg-white rounded-md border border-slate-200 shadow-sm max-w-md w-full p-5 space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">delete_forever</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Learning Session</h3>
              <p className="text-xs text-slate-600 mt-1">
                Are you sure you want to remove &quot;{getSessionTitle(sessionToDelete)}&quot; from the timetable? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSessionToDelete(null)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onDeleteSession) onDeleteSession(sessionToDelete.id);
                  setSessionToDelete(null);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


