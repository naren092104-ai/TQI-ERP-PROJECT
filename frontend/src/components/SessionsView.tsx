import React, { useState, useMemo, useEffect } from 'react';
import { TabType, Session, Panchayat, Volunteer, Cluster, DateChangeRequest } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { EmptyState } from './ui/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Calendar,
  ArrowLeft,
  Search,
  Plus,
  Edit3,
  Trash2,
  Eye,
  X,
  CaretLeft,
  CaretRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  MapPin,
  Users,
  Building2,
  CalendarCheck,
  Sparkles,
  Check,
  ChevronRight,
} from './ui/icons';

interface SessionsViewProps {
  sessions: Session[];
  clusters?: Cluster[];
  panchayats: Panchayat[];
  volunteers: Volunteer[];
  userRole?: string;
  dateChangeRequests?: DateChangeRequest[];
  onNavigate: (tab: TabType, targetId?: string, secondaryParam?: string) => void;
  onAddSession: (newSession: Omit<Session, 'id'>) => void;
  onUpdateSession: (id: string, updated: Partial<Session>) => void;
  onDeleteSession?: (id: string) => Promise<void> | void;
  onRequestDateChange?: (sessionId: string, originalDate: string, newDate: string, reason: string) => Promise<void>;
  onReviewDateChange?: (requestId: string, action: 'approve' | 'reject', remarks: string) => Promise<void>;
  onFixSessionDate?: (sessionId: string, date: string) => Promise<void>;
  canManageSchedule?: boolean;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions = [],
  clusters = [],
  panchayats = [],
  volunteers = [],
  userRole = 'Super Admin',
  dateChangeRequests = [],
  onNavigate,
  onAddSession,
  onUpdateSession,
  onDeleteSession,
  onRequestDateChange,
  onReviewDateChange,
  onFixSessionDate,
}) => {
  const isSuperAdmin = userRole === 'Super Admin';
  const isClusterAdmin = userRole === 'Cluster Admin';

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClusterId, setSelectedClusterId] = useState<string>('all');
  const [showClusterCards, setShowClusterCards] = useState(isSuperAdmin);
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPanchayatId, setSelectedPanchayatId] = useState<string>('all');
  const [filterDate, setFilterDate] = useState('');

  // Review Reschedule Requests Tab for Super Admin
  const [activeViewTab, setActiveViewTab] = useState<'sessions' | 'reschedule-requests'>('sessions');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [viewingSession, setViewingSession] = useState<Session | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [dateChangeSession, setDateChangeSession] = useState<Session | null>(null);
  const [reviewingRequest, setReviewingRequest] = useState<DateChangeRequest | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [dateFixSession, setDateFixSession] = useState<Session | null>(null);
  const [dateFixValue, setDateFixValue] = useState('');
  const [newDateValue, setNewDateValue] = useState('');
  const [dateChangeReason, setDateChangeReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Scheduling Type: 'single' vs 'date-range' (From Date to To Date for multi-day 7 or 8 days cycle)
  const [scheduleType, setScheduleType] = useState<'single' | 'date-range'>('date-range');
  const [rangeFromDate, setRangeFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [rangeToDate, setRangeToDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [totalCycleDays, setTotalCycleDays] = useState<number>(8); // 8 days or custom

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    setShowClusterCards(isSuperAdmin);
    setSelectedClusterId('all');
  }, [isSuperAdmin]);

  const moduleOptions = [
    'Spoken English & Communication',
    'STEM & Robotics Foundations',
    'Digital Literacy & Computers',
    'Leadership & Problem Solving',
    'Art, Drama & Creative Expression',
    'Mathematics Olympiad & Logic',
    'Environmental Science & Ecology',
    'Career Guidance & Mentorship',
  ];

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    clusterId: clusters[0]?.id || '',
    dayNumber: 1,
    date: new Date().toISOString().split('T')[0],
    module: 'Spoken English & Communication',
    panchayatId: panchayats[0]?.id || '',
    villageName: panchayats[0]?.villages[0]?.name || '',
    volunteerId: volunteers[0]?.id || '',
    status: 'Scheduled' as Session['status'],
    description: '',
  });

  const formVillages = useMemo(() => {
    if (!formData.panchayatId) return [];
    const p = panchayats.find((item) => item.id === formData.panchayatId);
    return p?.villages || [];
  }, [panchayats, formData.panchayatId]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = sessions.length;
    const completed = sessions.filter((s) => s.status === 'Completed').length;
    const upcoming = sessions.filter((s) => s.status === 'Scheduled' || s.status === 'In Progress').length;
    const pendingRequests = dateChangeRequests.filter((r) => r.status === 'PENDING').length;
    return { total, completed, upcoming, pendingRequests };
  }, [sessions, dateChangeRequests]);

  // Pending Reschedule Requests
  const pendingRescheduleRequests = useMemo(() => {
    return dateChangeRequests.filter((r) => r.status === 'PENDING');
  }, [dateChangeRequests]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        (s.name || '').toLowerCase().includes(q) ||
        (s.title || '').toLowerCase().includes(q) ||
        (s.module || '').toLowerCase().includes(q) ||
        (s.panchayatName || '').toLowerCase().includes(q) ||
        (s.villageName || '').toLowerCase().includes(q) ||
        (s.volunteerName || '').toLowerCase().includes(q) ||
        (s.clusterName || '').toLowerCase().includes(q) ||
        (s.code || '').toLowerCase().includes(q);

      if (!matchSearch) return false;
      if (selectedClusterId !== 'all' && s.clusterId !== selectedClusterId) return false;
      if (selectedDay !== 'all') {
        const dayNum = parseInt(selectedDay, 10);
        if (s.dayNumber !== dayNum && s.day !== `Day ${dayNum}`) return false;
      }
      if (selectedStatus !== 'all' && s.status !== selectedStatus) return false;
      if (selectedPanchayatId !== 'all' && s.panchayatId !== selectedPanchayatId) return false;
      if (filterDate && s.date !== filterDate) return false;

      return true;
    });
  }, [sessions, searchTerm, selectedClusterId, selectedDay, selectedStatus, selectedPanchayatId, filterDate]);

  const totalPages = Math.ceil(filteredSessions.length / pageSize) || 1;
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSessions.slice(start, start + pageSize);
  }, [filteredSessions, currentPage, pageSize]);

  // Compute cluster schedule date ranges
  const clusterScheduleSummaries = useMemo(() => {
    return clusters.map((cluster) => {
      const clusterSessions = sessions.filter((session) => session.clusterId === cluster.id);
      const sortedDates = clusterSessions
        .map((s) => s.date)
        .filter(Boolean)
        .sort();

      const fromDate = sortedDates[0] || 'Not scheduled';
      const toDate = sortedDates[sortedDates.length - 1] || 'Not scheduled';
      const completed = clusterSessions.filter((session) => session.status === 'Completed').length;
      const upcoming = clusterSessions.filter((session) => session.status === 'Scheduled' || session.status === 'In Progress').length;
      const pendingReschedule = dateChangeRequests.filter(
        (r) => r.clusterId === cluster.id && r.status === 'PENDING'
      ).length;

      return {
        ...cluster,
        sessionsCount: clusterSessions.length,
        completed,
        upcoming,
        fromDate,
        toDate,
        pendingReschedule,
      };
    });
  }, [clusters, sessions, dateChangeRequests]);

  const handleOpenAdd = () => {
    setEditingSession(null);
    const p = panchayats[0];
    setFormData({
      name: '',
      clusterId: clusters[0]?.id || '',
      dayNumber: 1,
      date: new Date().toISOString().split('T')[0],
      module: 'Spoken English & Communication',
      panchayatId: p?.id || '',
      villageName: p?.villages[0]?.name || '',
      volunteerId: volunteers[0]?.id || '',
      status: 'Scheduled',
      description: '',
    });
    setScheduleType('date-range');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (session: Session) => {
    setEditingSession(session);
    setScheduleType('single');
    setFormData({
      name: session.name || session.title || '',
      clusterId: session.clusterId || clusters[0]?.id || '',
      dayNumber: session.dayNumber || 1,
      date: session.date || new Date().toISOString().split('T')[0],
      module: session.module || 'Spoken English & Communication',
      panchayatId: session.panchayatId || (panchayats[0]?.id || ''),
      villageName: session.villageName || '',
      volunteerId: session.volunteerId || '',
      status: session.status || 'Scheduled',
      description: session.description || '',
    });
    setIsModalOpen(true);
  };

  // Helper to generate dates between From and To dates
  const generateDates = (start: string, end: string, count: number) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const result: string[] = [];

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      // Fallback: consecutive days from today
      for (let i = 0; i < count; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        result.push(d.toISOString().split('T')[0]);
      }
      return result;
    }

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const step = diffDays > count ? Math.floor(diffDays / count) : 1;

    for (let i = 0; i < count; i++) {
      const cur = new Date(startDate);
      cur.setDate(startDate.getDate() + i * step);
      if (cur > endDate) {
        result.push(endDate.toISOString().split('T')[0]);
      } else {
        result.push(cur.toISOString().split('T')[0]);
      }
    }
    return result;
  };

  const handleSaveSession = (e: React.FormEvent) => {
    e.preventDefault();
    const p = panchayats.find((item) => item.id === formData.panchayatId) || panchayats[0];
    const v = volunteers.find((item) => item.id === formData.volunteerId) || volunteers[0];
    const c = clusters.find((item) => item.id === formData.clusterId) || clusters[0];

    if (editingSession) {
      const payload: Partial<Session> = {
        name: formData.name.trim() || `Day ${formData.dayNumber} Session`,
        title: formData.name.trim() || `Day ${formData.dayNumber} Session`,
        clusterId: formData.clusterId,
        clusterName: c?.name || editingSession.clusterName || 'Cluster',
        dayNumber: formData.dayNumber,
        day: `Day ${formData.dayNumber}`,
        date: formData.date,
        module: formData.module,
        panchayatId: formData.panchayatId,
        panchayatName: p?.name || editingSession.panchayatName || 'Panchayat',
        villageName: formData.villageName || p?.villages[0]?.name || '',
        volunteerId: formData.volunteerId,
        volunteerName: v?.name || editingSession.volunteerName || 'Unassigned',
        status: formData.status,
        description: formData.description,
      };
      onUpdateSession(editingSession.id, payload);
      showToast(`Updated session: ${formData.name}`);
    } else if (scheduleType === 'date-range') {
      // Create multi-day academic cycle from From Date to To Date
      const generatedDates = generateDates(rangeFromDate, rangeToDate, totalCycleDays);
      generatedDates.forEach((dateStr, idx) => {
        const dayNum = idx + 1;
        const modName = moduleOptions[(dayNum - 1) % moduleOptions.length];
        onAddSession({
          name: formData.name.trim() ? `${formData.name.trim()} - Day ${dayNum}` : `Day ${dayNum} Academic Session`,
          title: formData.name.trim() ? `${formData.name.trim()} - Day ${dayNum}` : `Day ${dayNum} Academic Session`,
          code: `SES-${Math.floor(100 + Math.random() * 900)}`,
          clusterId: formData.clusterId,
          clusterName: c?.name || 'Cluster',
          dayNumber: dayNum,
          day: `Day ${dayNum}`,
          date: dateStr,
          module: modName,
          panchayatId: formData.panchayatId,
          panchayatName: p?.name || 'Panchayat',
          villageName: formData.villageName || p?.villages[0]?.name || 'Main Hub',
          volunteerId: formData.volunteerId,
          volunteerName: v?.name || 'Assigned Mentor',
          status: 'Scheduled',
          description: `Scheduled academic term session from ${rangeFromDate} to ${rangeToDate}`,
        });
      });
      showToast(`Successfully scheduled ${totalCycleDays}-Day academic session cycle (${rangeFromDate} to ${rangeToDate})!`);
    } else {
      onAddSession({
        name: formData.name.trim() || `Day ${formData.dayNumber} Session`,
        title: formData.name.trim() || `Day ${formData.dayNumber} Session`,
        code: `SES-${Math.floor(100 + Math.random() * 900)}`,
        clusterId: formData.clusterId,
        clusterName: c?.name || 'Cluster',
        dayNumber: formData.dayNumber,
        day: `Day ${formData.dayNumber}`,
        date: formData.date,
        module: formData.module,
        panchayatId: formData.panchayatId,
        panchayatName: p?.name || 'Panchayat',
        villageName: formData.villageName,
        volunteerId: formData.volunteerId,
        volunteerName: v?.name || 'Unassigned',
        status: formData.status,
        description: formData.description,
      });
      showToast(`Scheduled new session: ${formData.name}`);
    }

    setIsModalOpen(false);
    setEditingSession(null);
  };

  const handleConfirmDelete = () => {
    if (!sessionToDelete) return;
    if (onDeleteSession) {
      onDeleteSession(sessionToDelete.id);
    }
    showToast(`Session deleted successfully`);
    setSessionToDelete(null);
    if (viewingSession?.id === sessionToDelete.id) {
      setViewingSession(null);
    }
  };

  const handleOpenDateChange = (session: Session) => {
    setDateChangeSession(session);
    setNewDateValue(session.date || '');
    setDateChangeReason('');
  };

  const handleSubmitDateChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateChangeSession) return;
    if (!newDateValue) {
      alert('Please select the new requested date.');
      return;
    }
    if (!dateChangeReason.trim()) {
      alert('Please specify the reason for this date reschedule.');
      return;
    }

    try {
      if (onRequestDateChange) {
        await onRequestDateChange(
          dateChangeSession.id,
          dateChangeSession.date,
          newDateValue,
          dateChangeReason
        );
      } else {
        onUpdateSession(dateChangeSession.id, {
          date: newDateValue,
          status: 'Action Req.',
        });
      }

      showToast(`Reschedule request with reason submitted for Super Admin review!`);
      setDateChangeSession(null);
    } catch (error: any) {
      showToast(error?.message || 'Unable to submit date change request.');
    }
  };

  // Super Admin Review Action
  const handleReviewAction = async (action: 'approve' | 'reject') => {
    if (!reviewingRequest) return;
    try {
      if (onReviewDateChange) {
        await onReviewDateChange(reviewingRequest.id, action, reviewRemarks);
      }
      // Also update session date directly if approved
      if (action === 'approve') {
        onUpdateSession(reviewingRequest.sessionId, {
          date: reviewingRequest.requestedDate,
          dateFixed: true,
          status: 'Scheduled',
        });
      }
      showToast(`Reschedule request ${action === 'approve' ? 'Approved' : 'Rejected'}!`);
      setReviewingRequest(null);
      setReviewRemarks('');
    } catch (err: any) {
      showToast(err?.message || 'Failed to review request.');
    }
  };

  // 1. Super Admin Cluster Schedule Board Overview
  if (showClusterCards) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Cluster Sessions Schedule Overview</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Super Admin view: Monitor which clusters are conducting sessions on which scheduled dates (From Date to To Date).
            </p>
          </div>

          <div className="flex items-center gap-2">
            {pendingRescheduleRequests.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setShowClusterCards(false);
                  setActiveViewTab('reschedule-requests');
                }}
                className="gap-1.5 rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-xs font-semibold"
              >
                <AlertCircle className="h-4 w-4" />
                <span>{pendingRescheduleRequests.length} Reschedule Requests Pending</span>
              </Button>
            )}
            <Button
              onClick={handleOpenAdd}
              className="gap-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
            >
              <Plus className="h-4 w-4" />
              <span>Schedule Session Cycle (From - To)</span>
            </Button>
          </div>
        </div>

        {/* Cluster Schedule Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clusterScheduleSummaries.map((cluster) => (
            <div
              key={cluster.id}
              onClick={() => {
                setSelectedClusterId(cluster.id);
                setShowClusterCards(false);
                setActiveViewTab('sessions');
                setCurrentPage(1);
              }}
              className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs transition-all hover:border-primary/60 hover:shadow-md cursor-pointer"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                      {cluster.name}
                    </h2>
                    <p className="text-xs font-medium text-foreground/80">{cluster.collegeName || 'College Partner'}</p>
                    <p className="text-[11px] text-muted-foreground">{cluster.district}, Tamil Nadu</p>
                  </div>
                  <Badge variant="success" size="sm">Active</Badge>
                </div>

                {/* Prominent Date Range Banner */}
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center gap-1.5 text-primary text-xs font-semibold">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Scheduled Session Window:</span>
                  </div>
                  <div className="mt-1 font-mono text-xs font-bold text-foreground">
                    {cluster.fromDate} <span className="text-muted-foreground font-normal">to</span> {cluster.toDate}
                  </div>
                </div>

                {/* Progress Stats */}
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-muted/40 p-2">
                    <strong className="block text-base text-foreground">{cluster.sessionsCount}</strong>
                    <span className="text-[11px] text-muted-foreground">Sessions</span>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-2">
                    <strong className="block text-base text-emerald-500">{cluster.completed}</strong>
                    <span className="text-[11px] text-muted-foreground">Completed</span>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-2">
                    <strong className="block text-base text-primary">{cluster.upcoming}</strong>
                    <span className="text-[11px] text-muted-foreground">Upcoming</span>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-5 flex items-center justify-between border-t border-border pt-3 text-xs">
                {cluster.pendingReschedule > 0 ? (
                  <span className="font-semibold text-amber-500 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {cluster.pendingReschedule} Reschedule Req.
                  </span>
                ) : (
                  <span className="text-muted-foreground">Schedule on track</span>
                )}
                <span className="font-semibold text-primary flex items-center gap-0.5 group-hover:underline">
                  Manage Sessions <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Main Sessions & Reschedule Review Workspace
  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-card px-4 py-3 text-xs font-semibold text-emerald-500 shadow-xl animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClusterCards(true)}
                className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Clusters</span>
              </Button>
            )}
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Sessions Schedule &amp; Management
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedClusterId !== 'all'
              ? `Managing sessions for ${clusters.find((c) => c.id === selectedClusterId)?.name || 'Cluster'}`
              : 'Monitor and coordinate teaching sessions across all clusters, dates, and volunteer mentors.'}
          </p>
        </div>

        {/* Tab Switcher & Schedule Action */}
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border">
              <button
                type="button"
                onClick={() => setActiveViewTab('sessions')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeViewTab === 'sessions'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sessions Schedule ({filteredSessions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveViewTab('reschedule-requests')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeViewTab === 'reschedule-requests'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Reschedule Requests</span>
                {pendingRescheduleRequests.length > 0 && (
                  <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white px-1">
                    {pendingRescheduleRequests.length}
                  </span>
                )}
              </button>
            </div>
          )}

          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Schedule Session Cycle (From - To)</span>
          </Button>
        </div>
      </div>

      {/* VIEW 1: RESCHEDULE REQUESTS APPROVAL TAB (FOR ADMINS) */}
      {activeViewTab === 'reschedule-requests' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
            <h2 className="text-base font-bold text-foreground">Review Reschedule Requests</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Volunteers or cluster admins who cannot conduct sessions on the planned date submit reschedule requests with reasons. Approve or reject them below.
            </p>

            {pendingRescheduleRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No pending reschedule requests at this time. All session schedules are confirmed!
              </div>
            ) : (
              <div className="mt-4 divide-y divide-border rounded-xl border border-border overflow-hidden">
                {pendingRescheduleRequests.map((req) => {
                  const matchedSession = sessions.find((s) => s.id === req.sessionId);
                  return (
                    <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card hover:bg-muted/20 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-sm">
                            {matchedSession?.name || `Day ${req.dayNumber || 1} Session`}
                          </span>
                          <Badge variant="warning" size="sm">Reschedule Requested</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                          <span>Cluster: <strong className="text-foreground">{req.clusterName || 'Main Cluster'}</strong></span>
                          <span>•</span>
                          <span>Original Date: <strong className="text-foreground font-mono">{req.originalDate}</strong></span>
                          <span>•</span>
                          <span className="text-primary font-bold">Requested Date: <strong className="font-mono">{req.requestedDate}</strong></span>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-foreground mt-2">
                          <span className="font-semibold text-muted-foreground">Reason Given: </span>
                          <span>"{req.reason}"</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReviewingRequest(req);
                            setReviewRemarks('');
                          }}
                          className="rounded-xl text-xs font-semibold"
                        >
                          Review &amp; Decide
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: SESSIONS SCHEDULE TABLE TAB */}
      {activeViewTab === 'sessions' && (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Total Sessions</span>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{stats.total}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Completed</span>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{stats.completed}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Upcoming</span>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{stats.upcoming}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Reschedule Req.</span>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{stats.pendingRequests}</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-xs">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by session title, module, village, volunteer..."
                className="h-9 pl-8 text-xs rounded-xl"
              />
            </div>

            {/* Cluster Filter */}
            <div className="w-44">
              <Select
                value={selectedClusterId}
                onValueChange={(val) => {
                  setSelectedClusterId(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="All Clusters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clusters</SelectItem>
                  {clusters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Day Filter */}
            <div className="w-32">
              <Select
                value={selectedDay}
                onValueChange={(val) => {
                  setSelectedDay(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="All Days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Days</SelectItem>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      Day {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Filter */}
            <div className="w-36">
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 text-xs rounded-xl"
                title="Filter by session date"
              />
            </div>

            {(searchTerm || selectedClusterId !== 'all' || selectedDay !== 'all' || filterDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedClusterId('all');
                  setSelectedDay('all');
                  setFilterDate('');
                  setCurrentPage(1);
                }}
                className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Reset
              </Button>
            )}
          </div>

          {/* Sessions Table */}
          <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="w-14 px-4 py-3 text-center">S.No</th>
                    <th className="px-4 py-3 text-center">Cycle Day</th>
                    <th className="px-4 py-3">Scheduled Session Date</th>
                    <th className="px-4 py-3">Module &amp; Curriculum</th>
                    <th className="px-4 py-3">Location &amp; Volunteer</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedSessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12">
                        <EmptyState
                          icon={Calendar}
                          title="No sessions scheduled"
                          description="Schedule teaching sessions using From Date to To Date to populate the academic cycle."
                          actionLabel="+ Schedule Session Cycle"
                          onAction={handleOpenAdd}
                        />
                      </td>
                    </tr>
                  ) : (
                    paginatedSessions.map((session, idx) => {
                      const sNo = (currentPage - 1) * pageSize + idx + 1;
                      const dayNum = session.dayNumber || parseInt(session.day?.replace(/\D/g, '') || '1', 10);
                      const displayStatus = session.dateFixed ? 'Scheduled' : session.status;

                      return (
                        <tr key={session.id} className="transition-colors hover:bg-muted/30">
                          <td className="px-4 py-3 text-center font-mono text-muted-foreground">{sNo}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="default" size="sm">Day {dayNum}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-primary" />
                              <span>{session.date || 'Not Fixed'}</span>
                              {session.dateFixed && <Badge variant="success" size="sm">✓ Confirmed</Badge>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">{session.name || session.title || 'Academic Session'}</div>
                            <div className="text-[11px] text-muted-foreground">{session.module || 'Spoken English & Communication'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-foreground font-medium">{session.panchayatName || 'Panchayat'}</div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              <span>{session.volunteerName || 'Volunteer'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              variant={
                                displayStatus === 'Completed'
                                  ? 'success'
                                  : displayStatus === 'In Progress'
                                  ? 'info'
                                  : displayStatus === 'Needs Attention' || displayStatus === 'Action Req.'
                                  ? 'warning'
                                  : 'secondary'
                              }
                              size="sm"
                            >
                              {displayStatus}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => setViewingSession(session)}
                                title="View Details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => handleOpenEdit(session)}
                                title="Edit Session"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>

                              {/* Reschedule Option: Can't go -> provide reason */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDateChange(session)}
                                className="h-7 text-xs font-semibold text-amber-500 hover:bg-amber-500/10 gap-1"
                                title="Reschedule Session Date"
                              >
                                <CalendarCheck className="h-3.5 w-3.5" />
                                <span>Reschedule</span>
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={() => setSessionToDelete(session)}
                                title="Delete Session"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Pagination */}
            {filteredSessions.length > 0 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row text-xs">
                <div className="text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-semibold text-foreground">{Math.min(currentPage * pageSize, filteredSessions.length)}</span> of{' '}
                  <span className="font-semibold text-foreground">{filteredSessions.length}</span> sessions
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <CaretLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="px-2 font-medium">Page {currentPage} of {totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <CaretRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* CREATE / SCHEDULE SESSION MODAL (Supports From Date to To Date Multi-Day Cycle) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {editingSession ? 'Edit Scheduled Session' : 'Schedule Academic Sessions'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {scheduleType === 'date-range'
                    ? 'Schedule a full multi-day teaching cycle using From Date & To Date.'
                    : 'Configure session details.'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="mt-4 space-y-4 text-xs">
              {/* Scheduling Mode Switcher (Only when adding new) */}
              {!editingSession && (
                <div className="flex rounded-xl bg-muted/50 p-1 border border-border">
                  <button
                    type="button"
                    onClick={() => setScheduleType('date-range')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                      scheduleType === 'date-range'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Date Range Cycle (From - To)
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('single')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                      scheduleType === 'single'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Single Session Date
                  </button>
                </div>
              )}

              {/* Cluster Selector */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Target Cluster *</label>
                <Select
                  value={formData.clusterId}
                  onValueChange={(val) => setFormData({ ...formData, clusterId: val })}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Select Cluster" />
                  </SelectTrigger>
                  <SelectContent>
                    {clusters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.collegeName || 'Partner College'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* DATE RANGE INPUTS (From Date to To Date) */}
              {scheduleType === 'date-range' && !editingSession ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Academic Cycle Date Window</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-foreground">From Date *</label>
                      <Input
                        type="date"
                        required
                        value={rangeFromDate}
                        onChange={(e) => setRangeFromDate(e.target.value)}
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-foreground">To Date *</label>
                      <Input
                        type="date"
                        required
                        value={rangeToDate}
                        onChange={(e) => setRangeToDate(e.target.value)}
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-foreground">Total Cycle Days *</label>
                    <Select
                      value={String(totalCycleDays)}
                      onValueChange={(val) => setTotalCycleDays(parseInt(val, 10) || 8)}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 Days Cycle (Day 1 - Day 7)</SelectItem>
                        <SelectItem value="8">8 Days Cycle (Day 1 - Day 8)</SelectItem>
                        <SelectItem value="10">10 Days Custom Cycle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">Session Date *</label>
                    <Input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">Cycle Day *</label>
                    <Select
                      value={String(formData.dayNumber)}
                      onValueChange={(val) => setFormData({ ...formData, dayNumber: parseInt(val, 10) || 1 })}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((d) => (
                          <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Panchayat & Village */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">Target Panchayat *</label>
                  <Select
                    value={formData.panchayatId}
                    onValueChange={(val) => {
                      const targetPan = panchayats.find((p) => p.id === val);
                      setFormData({
                        ...formData,
                        panchayatId: val,
                        villageName: targetPan?.villages[0]?.name || '',
                      });
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Select Panchayat" />
                    </SelectTrigger>
                    <SelectContent>
                      {panchayats.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">Target Village *</label>
                  <Select
                    value={formData.villageName}
                    onValueChange={(val) => setFormData({ ...formData, villageName: val })}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Select Village" />
                    </SelectTrigger>
                    <SelectContent>
                      {formVillages.map((v) => (
                        <SelectItem key={v.id || v.name} value={v.name}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Volunteer & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">Assigned Mentor</label>
                  <Select
                    value={formData.volunteerId}
                    onValueChange={(val) => setFormData({ ...formData, volunteerId: val })}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Select Volunteer" />
                    </SelectTrigger>
                    <SelectContent>
                      {volunteers.map((vol) => (
                        <SelectItem key={vol.id} value={vol.id}>{vol.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">Status</label>
                  <Select
                    value={formData.status}
                    onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Needs Attention">Needs Attention</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">
                  {editingSession
                    ? 'Save Changes'
                    : scheduleType === 'date-range'
                    ? `Schedule ${totalCycleDays} Days Cycle`
                    : 'Schedule Session'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESCHEDULE SESSION MODAL (With Mandatory Reason Input) */}
      {dateChangeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Reschedule Session Date</h3>
                <p className="text-xs text-muted-foreground">
                  Cannot attend on this date? Submit a reschedule request with reason for Super Admin approval.
                </p>
              </div>
              <button
                onClick={() => setDateChangeSession(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitDateChange} className="mt-4 space-y-4 text-xs">
              <div className="rounded-xl bg-muted/40 p-3">
                <div className="text-muted-foreground">Session:</div>
                <div className="font-bold text-foreground text-sm">{dateChangeSession.name || dateChangeSession.title}</div>
                <div className="mt-1 text-muted-foreground">
                  Current Date: <span className="font-mono font-bold text-foreground">{dateChangeSession.date}</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  New Proposed Date <span className="text-destructive">*</span>
                </label>
                <Input
                  type="date"
                  required
                  value={newDateValue}
                  onChange={(e) => setNewDateValue(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Reason for Rescheduling <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why session cannot be conducted on scheduled date (e.g., local holiday, village hall unavailable, university exams)..."
                  value={dateChangeReason}
                  onChange={(e) => setDateChangeReason(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setDateChangeSession(null)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                  Submit Reschedule Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPER ADMIN REVIEW & APPROVAL MODAL */}
      {reviewingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Review Reschedule Request</h3>
              <button
                onClick={() => setReviewingRequest(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5">
                <div>Cluster: <strong className="text-foreground">{reviewingRequest.clusterName || 'Main Cluster'}</strong></div>
                <div>Original Date: <strong className="font-mono text-foreground">{reviewingRequest.originalDate}</strong></div>
                <div>Proposed Date: <strong className="font-mono text-primary">{reviewingRequest.requestedDate}</strong></div>
                <div className="mt-2 pt-2 border-t border-border">
                  <span className="font-semibold text-muted-foreground">Reason Given:</span>
                  <p className="mt-1 italic text-foreground font-medium">"{reviewingRequest.reason}"</p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Admin Review Remarks (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Approved. Village head informed."
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReviewingRequest(null)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleReviewAction('reject')}
                  className="rounded-xl"
                >
                  Reject Request
                </Button>
                <Button
                  type="button"
                  onClick={() => handleReviewAction('approve')}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  Approve Reschedule
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <h3 className="text-base font-bold text-foreground">Delete Scheduled Session?</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Are you sure you want to remove <strong className="text-foreground">{sessionToDelete.name || sessionToDelete.title}</strong>?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSessionToDelete(null)} className="rounded-xl">
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleConfirmDelete} className="rounded-xl">
                Delete Session
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Session Details Modal */}
      {viewingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">{viewingSession.name || 'Academic Session'}</h3>
                <p className="text-xs text-muted-foreground font-mono">{viewingSession.code || viewingSession.id}</p>
              </div>
              <button
                onClick={() => setViewingSession(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
                <div>
                  <span className="text-muted-foreground block">Cycle Day:</span>
                  <span className="font-bold text-foreground">Day {viewingSession.dayNumber || 1}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Session Date:</span>
                  <span className="font-mono font-bold text-foreground">{viewingSession.date || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Cluster:</span>
                  <span className="font-semibold text-foreground">{viewingSession.clusterName || 'Main Cluster'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Module:</span>
                  <span className="font-semibold text-foreground">{viewingSession.module || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Panchayat:</span>
                  <span className="font-semibold text-foreground">{viewingSession.panchayatName || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Village Center:</span>
                  <span className="font-semibold text-foreground">{viewingSession.villageName || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Assigned Volunteer:</span>
                  <span className="font-semibold text-foreground">{viewingSession.volunteerName || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Status:</span>
                  <Badge variant="default" size="sm">{viewingSession.status}</Badge>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setViewingSession(null);
                    onNavigate('attendance');
                  }}
                  className="rounded-xl"
                >
                  Go to Attendance →
                </Button>
                <Button size="sm" onClick={() => setViewingSession(null)} className="rounded-xl">
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
