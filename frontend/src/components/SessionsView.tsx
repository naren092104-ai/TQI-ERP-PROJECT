import React, { useEffect, useState, useMemo } from 'react';
import { TabType, Session, Panchayat, Volunteer } from '../types';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { ActionButton } from './ui/action-button';
import { Search, X, Calendar, Lock, Trash2 } from './ui/icons';

interface SessionsViewProps {
  sessions: Session[];
  panchayats: Panchayat[];
  volunteers: Volunteer[];
  onNavigate: (tab: TabType, targetId?: string, secondaryParam?: string) => void;
  onAddSession: (newSession: Omit<Session, 'id'>) => void;
  onUpdateSession: (id: string, updated: Partial<Session>) => void;
  onDeleteSession?: (id: string) => Promise<void> | void;
  onRequestDateChange?: (sessionId: string, originalDate: string, newDate: string, reason: string) => Promise<void>;
  canManageSchedule?: boolean;
  userRole?: string;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions = [],
  panchayats = [],
  volunteers = [],
  onNavigate,
  onAddSession,
  onUpdateSession,
  onDeleteSession,
  onRequestDateChange,
  canManageSchedule = false,
  userRole = 'Super Admin',
}) => {
  const isClusterAdmin = userRole === 'Cluster Admin';
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
  const [dateChangeSession, setDateChangeSession] = useState<Session | null>(null);
  const [dateChangeReason, setDateChangeReason] = useState('');
  const [dateChangeNewDate, setDateChangeNewDate] = useState('');
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
    <div className="w-full space-y-6">
      {/* 1. Cardless Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Learning Sessions
            </h1>
            <Badge color="primary" size="sm">
              {filteredSessions.length} Total
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Plan, coordinate, and track village learning modules and attendance across clusters.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 transition"
          >
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleOpenNewModal}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition"
          >
            <span>Add Session</span>
          </button>
        </div>
      </div>

      {/* 2. Compact Metric Cards (counts & status only) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Upcoming</div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{upcomingCount}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand-500">Scheduled</div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{scheduledCount}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="text-xs font-semibold uppercase tracking-wider text-success-500">Completed</div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{completedCount}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="text-xs font-semibold uppercase tracking-wider text-error-500">Needs Attention</div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{needsAttentionCount}</div>
        </div>
      </div>

      {/* NEXT SESSION Spotlight Section */}
      {nextSession && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-500 bg-brand-50 dark:bg-brand-500/10 px-2 py-0.5 rounded-lg">
                  Next Session
                </span>
                {renderStatusBadge(nextSession.status)}
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {getSessionTitle(nextSession)}
                {nextSession.code && (
                  <span className="ml-2 font-mono text-xs font-normal text-gray-400">
                    ({nextSession.code})
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                <span>{nextSession.date} &middot; {nextSession.time}</span>
                <span>Panchayat: <strong className="text-gray-800 dark:text-gray-200">{nextSession.panchayatName}</strong></span>
                <span>Village: <strong className="text-gray-800 dark:text-gray-200">{nextSession.villageName}</strong></span>
                <span>Volunteer: <strong className="text-brand-500">{getSessionVolunteer(nextSession)}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveSessionDetail(nextSession)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 transition"
              >
                View
              </button>
              <button
                type="button"
                onClick={() => onNavigate('lesson-plan', nextSession.lessonPlanId || nextSession.id)}
                className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-100 dark:border-brand-900/40 dark:bg-brand-500/10 dark:text-brand-400 transition"
              >
                Lesson Plan
              </button>
              <button
                type="button"
                onClick={() => onNavigate('attendance', nextSession.id)}
                className="rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition"
              >
                Attendance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Cardless Search + Filter Row */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search session, module, village or volunteer..."
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
              <SelectTrigger className="h-9 text-xs">
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
              <SelectTrigger className="h-9 text-xs">
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

          {/* Status Filter + More Filters Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select
                value={selectedStatus || "all"}
                onValueChange={(val) => setSelectedStatus(val)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Needs Attention">Needs Attention</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <button
              type="button"
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition shadow-theme-xs flex items-center gap-1 shrink-0 ${
                showMoreFilters || selectedModule !== 'all' || selectedVolunteer !== 'all' || filterDate
                  ? 'border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">tune</span>
              <span>Filter</span>
            </button>
          </div>
        </div>

        {/* Secondary Expandable Filters */}
        {showMoreFilters && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-center">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                Module
              </label>
              <Select
                value={selectedModule}
                onValueChange={(val) => setSelectedModule(val)}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="All Modules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  <SelectItem value="Spoken English">Spoken English</SelectItem>
                  <SelectItem value="Basic Math">Basic Math</SelectItem>
                  <SelectItem value="Life Skills">Life Skills</SelectItem>
                  <SelectItem value="Digital Literacy">Digital Literacy</SelectItem>
                  <SelectItem value="Science">Science</SelectItem>
                  <SelectItem value="Financial Literacy">Financial Literacy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                Volunteer
              </label>
              <Select
                value={selectedVolunteer}
                onValueChange={(val) => setSelectedVolunteer(val)}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="All Volunteers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Volunteers</SelectItem>
                  {volunteers.map((v) => (
                    <SelectItem key={v.id} value={v.name}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                Date
              </label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 shadow-theme-xs focus:border-brand-500 focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div className="flex items-end justify-end pt-5">
              <button
                type="button"
                onClick={handleClearFilters}
                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 transition"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Cardless TailAdmin Session Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="tqi-table-compact w-full text-left border-collapse">
            <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
              <tr>
                <th className="px-5 py-3.5">Date &amp; Time</th>
                <th className="px-5 py-3.5">Session Topic &amp; Module</th>
                <th className="px-5 py-3.5">Panchayat &amp; Village</th>
                <th className="px-5 py-3.5">Volunteer</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    No sessions match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr
                    key={session.id}
                    className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors group"
                  >
                    {/* Date & Time */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="font-bold text-gray-900 dark:text-white">{session.date}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {session.time}
                      </div>
                    </td>

                    {/* Topic & Module */}
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-gray-900 dark:text-white group-hover:text-brand-500 transition-colors">
                        {getSessionTitle(session)}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        <span className="font-mono text-gray-500 dark:text-gray-300">
                          {session.code || session.moduleId || 'M-103'}
                        </span>
                        <span> &middot; {getSessionModule(session)}</span>
                      </div>
                    </td>

                    {/* Panchayat & Village */}
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-800 dark:text-gray-200">{session.panchayatName}</div>
                      <div className="text-[11px] text-gray-400">{session.villageName}</div>
                    </td>

                    {/* Volunteer */}
                    <td className="px-5 py-3.5">
                      {session.volunteerName && session.volunteerName !== 'Unassigned' ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-brand-50 text-brand-500 text-[10px] font-bold flex items-center justify-center dark:bg-brand-500/10 dark:text-brand-400">
                            {session.volunteerName.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">{session.volunteerName}</span>
                        </div>
                      ) : (
                        <Badge color="light" size="sm">
                          Unassigned
                        </Badge>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <Badge
                        color={
                          session.status === 'Completed'
                            ? 'success'
                            : session.status === 'In Progress'
                            ? 'warning'
                            : session.status === 'Needs Attention'
                            ? 'error'
                            : 'primary'
                        }
                        size="sm"
                      >
                        {session.status}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setActiveSessionDetail(session)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-white/5 dark:hover:text-brand-400 transition cursor-pointer"
                          title="View Session"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('lesson-plan', session.lessonPlanId || session.id)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-white/5 dark:hover:text-brand-400 transition cursor-pointer"
                          title="Lesson Plan"
                        >
                          <span className="material-symbols-outlined text-[16px]">menu_book</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('attendance', session.id)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-white/5 dark:hover:text-brand-400 transition cursor-pointer"
                          title="Attendance"
                        >
                          <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                        </button>

                        {isClusterAdmin && onRequestDateChange && (
                          <button
                            type="button"
                            onClick={() => {
                              setDateChangeSession(session);
                              setDateChangeNewDate(session.date || '');
                              setDateChangeReason('');
                            }}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-white/5 dark:hover:text-brand-400 transition cursor-pointer"
                            title="Request Date Change"
                          >
                            <Calendar className="h-4 w-4" />
                          </button>
                        )}

                        {['Submitted', 'Pending Review', 'Approved', 'Completed'].includes(session.status) ? (
                          <button
                            type="button"
                            disabled
                            className="rounded-lg p-1.5 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                            title="Session submitted - editing disabled"
                          >
                            <Lock className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(session)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-white/5 dark:hover:text-brand-400 transition cursor-pointer"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                        )}

                        {onDeleteSession && (
                          <button
                            type="button"
                            onClick={() => setSessionToDelete(session)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10 dark:hover:text-error-400 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT SESSION MODAL (Clean Drawer / Modal) */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-gray-900/70 backdrop-blur-sm overflow-y-auto">
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
                  <Select
                    value={formData.module}
                    onValueChange={(mod) => {
                      let modId = 'M-103';
                      if (mod === 'Basic Math') modId = 'M-301';
                      if (mod === 'Life Skills') modId = 'M-102';
                      if (mod === 'Digital Literacy') modId = 'D-004';
                      if (mod === 'Science') modId = 'S-201';
                      if (mod === 'Financial Literacy') modId = 'F-101';
                      setFormData({ ...formData, module: mod, moduleId: modId });
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
                  <Select
                    value={formData.day}
                    onValueChange={(val) => setFormData({ ...formData, day: val })}
                  >
                    <SelectTrigger className="w-full h-9 text-xs border-slate-300">
                      <SelectValue placeholder="Select Day" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Saturday">Saturday</SelectItem>
                      <SelectItem value="Sunday">Sunday</SelectItem>
                      <SelectItem value="Monday">Monday</SelectItem>
                      <SelectItem value="Tuesday">Tuesday</SelectItem>
                      <SelectItem value="Wednesday">Wednesday</SelectItem>
                      <SelectItem value="Thursday">Thursday</SelectItem>
                      <SelectItem value="Friday">Friday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Time Slot
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10:00 AM - 12:30 PM"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                  />
                </div>
              </div>

              {/* Row 3: Panchayat & Village */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Panchayat Cluster Hub <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    value={formData.panchayatId}
                    onValueChange={(val) => handlePanchayatSelectChange(val)}
                  >
                    <SelectTrigger className="w-full h-9 text-xs border-slate-300">
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
                    Village / Learning Center <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    value={formData.villageName}
                    onValueChange={(val) => {
                      setFormData({ ...formData, villageName: val });
                      if (formErrors.villageName) setFormErrors({ ...formErrors, villageName: '' });
                    }}
                  >
                    <SelectTrigger className={`w-full h-9 text-xs ${
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
                  <Select
                    value={formData.volunteerId || (formData.volunteerName === 'Unassigned' ? 'unassigned' : '')}
                    onValueChange={(val) => {
                      handleVolunteerSelectChange(val);
                      if (formErrors.volunteer) setFormErrors({ ...formErrors, volunteer: '' });
                    }}
                  >
                    <SelectTrigger className={`w-full h-9 text-xs ${
                      formErrors.volunteer ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}>
                      <SelectValue placeholder="Select Volunteer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">-- Unassigned (Needs Attention) --</SelectItem>
                      {volunteers.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name} ({v.department?.split(' ')[0] || 'Mentor'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.volunteer && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.volunteer}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Session Type
                  </label>
                  <Select
                    value={formData.sessionType}
                    onValueChange={(val) =>
                      setFormData({
                        ...formData,
                        sessionType: val as 'Academic' | 'Life Skills' | 'Assessment' | 'Orientation',
                      })
                    }
                  >
                    <SelectTrigger className="w-full h-9 text-xs border-slate-300">
                      <SelectValue placeholder="Session Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Academic">Academic Core</SelectItem>
                      <SelectItem value="Life Skills">Life Skills &amp; Habits</SelectItem>
                      <SelectItem value="Assessment">Assessment &amp; Review</SelectItem>
                      <SelectItem value="Orientation">Orientation &amp; Games</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Status
                  </label>
                  <Select
                    value={formData.status}
                    onValueChange={(val) =>
                      setFormData({ ...formData, status: val as Session['status'] })
                    }
                  >
                    <SelectTrigger className="w-full h-9 text-xs border-slate-300">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Needs Attention">Needs Attention</SelectItem>
                      <SelectItem value="Draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-gray-900/70 backdrop-blur-sm overflow-y-auto">
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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm">
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

      {/* REQUEST DATE CHANGE MODAL */}
      {dateChangeSession && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-md border border-slate-200 shadow-sm max-w-md w-full p-5 space-y-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Request Date Change</h3>
              <p className="text-xs text-slate-600 mt-1">
                Submit a date change request for &quot;{getSessionTitle(dateChangeSession)}&quot;.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Current Date</label>
                <input
                  type="text"
                  readOnly
                  value={dateChangeSession.date}
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-md text-xs text-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Date</label>
                <input
                  type="date"
                  value={dateChangeNewDate}
                  onChange={(e) => setDateChangeNewDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for change</label>
                <textarea
                  rows={3}
                  value={dateChangeReason}
                  onChange={(e) => setDateChangeReason(e.target.value)}
                  placeholder="Explain why the date needs to be changed..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-[#0B3D91]"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDateChangeSession(null)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (onRequestDateChange && dateChangeNewDate && dateChangeReason) {
                    await onRequestDateChange(
                      dateChangeSession.id,
                      dateChangeSession.date || '',
                      dateChangeNewDate,
                      dateChangeReason
                    );
                    setDateChangeSession(null);
                  } else {
                    alert('Please provide a new date and a reason.');
                  }
                }}
                className="px-4 py-1.5 bg-[#0B3D91] hover:bg-[#082a66] text-white text-xs font-semibold rounded-md shadow-xs cursor-pointer"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


