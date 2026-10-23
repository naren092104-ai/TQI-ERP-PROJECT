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
  currentClusterId?: string;
  dateChangeRequests?: DateChangeRequest[];
  onNavigate: (tab: TabType, targetId?: string, secondaryParam?: string) => void;
  onAddSession: (newSession: Omit<Session, 'id'>) => Promise<void> | void;
  onUpdateSession: (id: string, updated: Partial<Session>) => Promise<void> | void;
  onDeleteSession?: (id: string) => Promise<void> | void;
  onRequestDateChange?: (sessionId: string, originalDate: string, newDate: string, reason: string) => Promise<void>;
  onReviewDateChange?: (requestId: string, action: 'approve' | 'reject', remarks: string) => Promise<void>;
  onApproveSessionDate?: (session: Session, date: string) => Promise<void>;
  canManageSchedule?: boolean;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions = [],
  clusters = [],
  panchayats = [],
  volunteers = [],
  userRole = 'Super Admin',
  currentClusterId,
  dateChangeRequests = [],
  onNavigate,
  onAddSession,
  onUpdateSession,
  onDeleteSession,
  onRequestDateChange,
  onReviewDateChange,
  onApproveSessionDate,
}) => {
  const isSuperAdmin = userRole === 'Super Admin';
  const isClusterAdmin = userRole === 'Cluster Admin';
  const canManageSchedules = isSuperAdmin;

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClusterId, setSelectedClusterId] = useState<string>(isSuperAdmin ? 'all' : currentClusterId || 'all');
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
  const [sessionProposalDates, setSessionProposalDates] = useState<Record<string, string>>({});
  const [approvingSessionId, setApprovingSessionId] = useState<string | null>(null);
  const [newDateValue, setNewDateValue] = useState('');
  const [dateChangeReason, setDateChangeReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Scheduling Type: 'single' vs 'date-range' for multi-day academic cycles.
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
    if (isSuperAdmin) {
      setShowClusterCards(true);
      setSelectedClusterId('all');
      return;
    }

    setShowClusterCards(false);
    setSelectedClusterId(currentClusterId || 'all');
  }, [isSuperAdmin, currentClusterId]);

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
  const configuredDayCount = Math.max(8, ...sessions.map((session) => Number(session.dayNumber || 0)));
  const cycleDayOptions = Array.from(
    new Set([7, 8, ...Array.from({ length: configuredDayCount - 8 }, (_, index) => index + 9)]),
  );

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    clusterId: clusters[0]?.id || '',
    dayNumber: 1,
    date: new Date().toISOString().split('T')[0],
    module: 'Spoken English & Communication',
    panchayatId: panchayats[0]?.id || '',
    villageName: panchayats[0]?.villages[0]?.name || '',
    description: '',
  });
  const [selectedPanchayatIds, setSelectedPanchayatIds] = useState<string[]>([]);
  const [selectedVillageTargets, setSelectedVillageTargets] = useState<Array<{ panchayatId: string; villageId: string; villageName: string }>>([]);
  const [targetLocationReason, setTargetLocationReason] = useState('');

  const formPanchayats = useMemo(
    () => panchayats.filter((panchayat) => !formData.clusterId || panchayat.clusterId === formData.clusterId),
    [panchayats, formData.clusterId],
  );

  const formVillages = useMemo(() => {
    return selectedPanchayatIds.flatMap((panchayatId) => {
      const panchayat = panchayats.find((item) => item.id === panchayatId);
      return (panchayat?.villages || []).map((village) => ({
        panchayatId,
        panchayatName: panchayat?.name || '',
        villageId: village.id || village.name,
        villageName: village.name,
      }));
    });
  }, [panchayats, selectedPanchayatIds]);

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
      const volunteersCount = volunteers.filter((volunteer) =>
        (!volunteer.clusterId || volunteer.clusterId === cluster.id) &&
        String(volunteer.status || 'Active').toLowerCase() === 'active'
      ).length;
      const pendingReschedule = dateChangeRequests.filter(
        (r) => r.clusterId === cluster.id && r.status === 'PENDING'
      ).length;

      return {
        ...cluster,
        sessionsCount: clusterSessions.length,
        completed,
        upcoming,
        volunteersCount,
        fromDate,
        toDate,
        pendingReschedule,
      };
    });
  }, [clusters, sessions, dateChangeRequests, volunteers]);

  const handleOpenAdd = () => {
    if (!canManageSchedules) return;
    setEditingSession(null);
    const initialClusterId = isSuperAdmin ? (clusters[0]?.id || '') : (currentClusterId || clusters[0]?.id || '');
    const initialPanchayats = panchayats.filter((panchayat) => panchayat.clusterId === initialClusterId);
    const initialTargets = initialPanchayats.flatMap((panchayat) => (panchayat.villages || []).map((village) => ({
      panchayatId: panchayat.id,
      villageId: village.id || village.name,
      villageName: village.name,
    })));
    setFormData({
      name: '',
      clusterId: initialClusterId,
      dayNumber: 1,
      date: new Date().toISOString().split('T')[0],
      module: 'Spoken English & Communication',
      panchayatId: initialPanchayats[0]?.id || '',
      villageName: initialTargets[0]?.villageName || '',
      description: '',
    });
    setSelectedPanchayatIds(initialPanchayats.map((panchayat) => panchayat.id));
    setSelectedVillageTargets(initialTargets);
    setTargetLocationReason('');
    setScheduleType('date-range');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (session: Session) => {
    setEditingSession(session);
    setScheduleType('single');
    const targets = session.targetLocations?.length
      ? session.targetLocations.map((target) => ({ panchayatId: target.panchayatId, villageId: target.villageId || target.villageName, villageName: target.villageName }))
      : (() => {
        const panchayat = panchayats.find((item) => item.id === session.panchayatId);
        const village = panchayat?.villages.find((item) => item.id === session.villageId || item.name === session.villageName);
        return session.panchayatId && session.villageName ? [{ panchayatId: session.panchayatId, villageId: village?.id || session.villageName, villageName: session.villageName }] : [];
      })();
    setSelectedPanchayatIds([...new Set(targets.map((target) => target.panchayatId))]);
    setSelectedVillageTargets(targets);
    setTargetLocationReason(session.targetLocationReason || '');
    setFormData({
      name: session.name || session.title || '',
      clusterId: session.clusterId || clusters[0]?.id || '',
      dayNumber: session.dayNumber || 1,
      date: session.date || new Date().toISOString().split('T')[0],
      module: session.module || 'Spoken English & Communication',
      panchayatId: session.panchayatId || (panchayats[0]?.id || ''),
      villageName: session.villageName || '',
      description: session.description || '',
    });
    setIsModalOpen(true);
  };

  const handleApproveSessionDate = async (session: Session, date: string) => {
    if (!date) return;
    setApprovingSessionId(session.id);
    try {
      if (onApproveSessionDate) await onApproveSessionDate(session, date);
      else await onUpdateSession(session.id, { date, dateFixed: true, status: 'Scheduled' });
      showToast('Session date approved. Cluster Admin will now see it as Confirmed.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to approve session date.');
    } finally {
      setApprovingSessionId(null);
    }
  };

  const handleProposeSessionDate = async (session: Session, panchayatId: string, villageId: string) => {
    const date = sessionProposalDates[session.id] ?? session.date ?? '';
    if (!date || !panchayatId || !villageId) return;
    try {
      const panchayat = panchayats.find((item) => item.id === panchayatId);
      const village = panchayat?.villages.find((item) => item.id === villageId || item.name === villageId);
      if (!panchayat || !village) throw new Error('Select a valid Panchayat and Village.');
      const currentTargets = session.targetLocations?.length
        ? session.targetLocations
        : session.panchayatId && session.villageId
          ? [{ panchayatId: session.panchayatId, panchayatName: session.panchayatName, villageId: session.villageId, villageName: session.villageName }]
          : [];
      const selectedTarget = {
        panchayatId,
        panchayatName: panchayat.name,
        villageId: village.id || village.name,
        villageName: village.name,
      };
      const targets = currentTargets.length
        ? [selectedTarget, ...currentTargets.slice(1)]
        : [selectedTarget];
      await onUpdateSession(session.id, {
        date,
        dateFixed: false,
        status: 'Scheduled',
        panchayatId: selectedTarget.panchayatId,
        panchayatName: selectedTarget.panchayatName,
        villageId: selectedTarget.villageId,
        villageName: selectedTarget.villageName,
        targetLocations: targets,
      });
      setSessionProposalDates((previous) => ({ ...previous, [session.id]: date }));
      showToast('Proposed date saved and sent to Super Admin for approval.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save proposed session date.');
    }
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

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clusterId) {
      showToast('Select a cluster before scheduling sessions.');
      return;
    }
    if (!selectedVillageTargets.length) {
      showToast('Select at least one village for this session.');
      return;
    }
    if (formPanchayats.length > selectedPanchayatIds.length && !targetLocationReason.trim()) {
      showToast('Add a reason when scheduling only selected panchayats.');
      return;
    }
    const p = panchayats.find((item) => item.id === formData.panchayatId) || panchayats[0];
    const c = clusters.find((item) => item.id === formData.clusterId) || clusters[0];
    const targetLocations = selectedVillageTargets.map((target) => ({
      ...target,
      panchayatName: panchayats.find((item) => item.id === target.panchayatId)?.name || '',
    }));
    const primaryTarget = targetLocations[0];

    setIsSavingSchedule(true);
    try {
    if (editingSession) {
      const payload: Partial<Session> = {
        name: formData.name.trim() || `Day ${formData.dayNumber} Session`,
        title: formData.name.trim() || `Day ${formData.dayNumber} Session`,
        clusterId: formData.clusterId,
        clusterName: c?.name || editingSession.clusterName || 'Cluster',
        dayNumber: formData.dayNumber,
        day: `Day ${formData.dayNumber}`,
        date: formData.date,
        dateFixed: isSuperAdmin ? Boolean(formData.date) : Boolean(editingSession.dateFixed),
        status: formData.date ? 'Scheduled' : 'Draft',
        module: formData.module,
        panchayatId: primaryTarget.panchayatId,
        panchayatName: primaryTarget.panchayatName || p?.name || editingSession.panchayatName || 'Panchayat',
        villageId: primaryTarget.villageId,
        villageName: primaryTarget.villageName,
        targetLocations,
        targetLocationReason: targetLocationReason.trim(),
        description: formData.description,
      };
      await onUpdateSession(editingSession.id, payload);
      showToast(`Updated session: ${formData.name}`);
    } else if (scheduleType === 'date-range') {
      // Create multi-day academic cycle from From Date to To Date
      const generatedDates = generateDates(rangeFromDate, rangeToDate, totalCycleDays);
      for (const [idx, dateStr] of generatedDates.entries()) {
        const dayNum = idx + 1;
        const modName = moduleOptions[(dayNum - 1) % moduleOptions.length];
        const payload: Omit<Session, 'id'> = {
          name: formData.name.trim() ? `${formData.name.trim()} - Day ${dayNum}` : `Day ${dayNum} Academic Session`,
          title: formData.name.trim() ? `${formData.name.trim()} - Day ${dayNum}` : `Day ${dayNum} Academic Session`,
          code: `SES-${Math.floor(100 + Math.random() * 900)}`,
          clusterId: formData.clusterId,
          clusterName: c?.name || 'Cluster',
          dayNumber: dayNum,
          day: `Day ${dayNum}`,
          date: dateStr,
          module: modName,
          panchayatId: primaryTarget.panchayatId,
          panchayatName: primaryTarget.panchayatName || 'Panchayat',
          villageId: primaryTarget.villageId,
          villageName: primaryTarget.villageName,
          targetLocations,
          targetLocationReason: targetLocationReason.trim(),
          volunteerId: '',
          volunteerName: 'Unassigned',
          status: 'Scheduled',
          description: `Scheduled academic term session from ${rangeFromDate} to ${rangeToDate}`,
        };
        const existing = sessions.find((session) => session.clusterId === formData.clusterId && Number(session.dayNumber) === dayNum);
        if (existing) await onUpdateSession(existing.id, payload);
        else await onAddSession(payload);
      }
      showToast(`Successfully scheduled ${totalCycleDays}-Day academic session cycle (${rangeFromDate} to ${rangeToDate})!`);
    } else {
      const payload: Omit<Session, 'id'> = {
        name: formData.name.trim() || `Day ${formData.dayNumber} Session`,
        title: formData.name.trim() || `Day ${formData.dayNumber} Session`,
        code: `SES-${Math.floor(100 + Math.random() * 900)}`,
        clusterId: formData.clusterId,
        clusterName: c?.name || 'Cluster',
        dayNumber: formData.dayNumber,
        day: `Day ${formData.dayNumber}`,
        date: formData.date,
        module: formData.module,
        panchayatId: primaryTarget.panchayatId,
        panchayatName: primaryTarget.panchayatName || 'Panchayat',
        villageId: primaryTarget.villageId,
        villageName: primaryTarget.villageName,
        targetLocations,
        targetLocationReason: targetLocationReason.trim(),
        volunteerId: '',
        volunteerName: 'Unassigned',
        status: 'Scheduled',
        description: formData.description,
      };
      const existing = sessions.find((session) => session.clusterId === formData.clusterId && Number(session.dayNumber) === formData.dayNumber);
      if (existing) await onUpdateSession(existing.id, payload);
      else await onAddSession(payload);
      showToast(`Scheduled new session: ${formData.name}`);
    }

    setIsModalOpen(false);
    setEditingSession(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save session schedule.');
    } finally {
      setIsSavingSchedule(false);
    }
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
      showToast(`Reschedule request ${action === 'approve' ? 'Approved' : 'Rejected'}!`);
      setReviewingRequest(null);
      setReviewRemarks('');
    } catch (err: any) {
      showToast(err?.message || 'Failed to review request.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-card px-4 py-3 text-xs font-semibold text-emerald-500 shadow-xl animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {showClusterCards ? (
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
            {canManageSchedules && (
              <Button
                onClick={handleOpenAdd}
                className="gap-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
              >
                <Plus className="h-4 w-4" />
                <span>Schedule Session Cycle (From - To)</span>
              </Button>
            )}
          </div>
        </div>

        {/* Cluster Schedule Cards Grid */}
        {clusterScheduleSummaries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-3 text-base font-semibold text-foreground">No cluster schedules found</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              No clusters are available to schedule sessions for this academic year. Onboard a cluster or add sessions to get started.
            </p>
          </div>
        ) : (
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
                <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
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
                  <div className="rounded-xl bg-muted/40 p-2">
                    <strong className="block text-base text-primary">{cluster.volunteersCount}</strong>
                    <span className="text-[11px] text-muted-foreground">Volunteers</span>
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
        )}
      </div>
      ) : (
        <>

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

          {canManageSchedules && (
            <Button
              size="sm"
              onClick={handleOpenAdd}
              className="gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Schedule Session Cycle (From - To)</span>
            </Button>
          )}
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

          {paginatedSessions.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card py-12">
              <EmptyState
                icon={Calendar}
                title="No sessions scheduled"
                description="Schedule teaching sessions using From Date to To Date to populate the academic cycle."
                actionLabel={canManageSchedules ? '+ Schedule Session Cycle' : undefined}
                onAction={canManageSchedules ? handleOpenAdd : undefined}
              />
            </div>
          ) : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {paginatedSessions.map((session, idx) => {
              const sNo = (currentPage - 1) * pageSize + idx + 1;
              const dayNum = session.dayNumber || parseInt(session.day?.replace(/\D/g, '') || '1', 10);
              const displayStatus = session.dateFixed ? 'Scheduled' : session.status;
              const sessionVolunteersCount = volunteers.filter((volunteer) =>
                (!volunteer.clusterId || volunteer.clusterId === session.clusterId) &&
                String(volunteer.status || 'Active').toLowerCase() === 'active'
              ).length;
              const proposalPanchayats = panchayats.filter((panchayat) => panchayat.clusterId === session.clusterId);
              const proposalPanchayatId = session.targetLocations?.[0]?.panchayatId
                || session.panchayatId
                || proposalPanchayats[0]?.id
                || '';
              const proposalPanchayat = proposalPanchayats.find((panchayat) => panchayat.id === proposalPanchayatId);
              const proposalVillageId = session.targetLocations?.[0]?.villageId
                || session.villageId
                || proposalPanchayat?.villages[0]?.id
                || proposalPanchayat?.villages[0]?.name
                || '';
              const proposalVillage = proposalPanchayat?.villages.find((village) => village.id === proposalVillageId || village.name === proposalVillageId);
              const proposalPanchayatName = session.panchayatName || proposalPanchayat?.name || 'Panchayat';
              const proposalVillageName = session.villageName || session.targetLocations?.[0]?.villageName || proposalVillage?.name || 'Village';
              return <article key={session.id} className="rounded-2xl border border-border bg-card p-5 shadow-xs transition hover:border-primary/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-3"><span className="inline-flex items-center gap-2"><span className="text-xs font-mono text-muted-foreground">#{sNo}</span><Badge variant="default" size="sm">Day {dayNum}</Badge></span><Badge variant={displayStatus === 'Completed' ? 'success' : displayStatus === 'In Progress' ? 'info' : displayStatus === 'Needs Attention' || displayStatus === 'Action Req.' ? 'warning' : 'secondary'} size="sm">{displayStatus}</Badge></div>
                <h2 className="mt-4 text-base font-bold text-foreground">{session.name || session.title || 'Academic Session'}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{session.module || 'Spoken English & Communication'}</p>
                <div className="mt-4 space-y-2 border-t border-border pt-3 text-xs">
                  <div className="flex items-center gap-2 font-medium text-foreground"><Calendar className="h-3.5 w-3.5 text-primary" />{session.date || 'Date not set'} {session.dateFixed ? <Badge variant="success" size="sm">Confirmed</Badge> : session.date ? <Badge variant="warning" size="sm">Pending approval</Badge> : null}</div>
                  {isClusterAdmin && !session.dateFixed && <>
                    <Input aria-label={`Propose date for Day ${dayNum}`} type="date" value={sessionProposalDates[session.id] ?? session.date ?? ''} onChange={(event) => setSessionProposalDates((previous) => ({ ...previous, [session.id]: event.target.value }))} className="h-9 rounded-xl text-xs" />
                  </>}
                  <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{proposalPanchayatName} · {proposalVillageName}</p>
                  <p className="flex items-center gap-2 text-muted-foreground"><Users className="h-3.5 w-3.5" />{sessionVolunteersCount} active volunteers</p>
                  <p className="text-[11px] text-muted-foreground">{session.clusterName || clusters.find((cluster) => cluster.id === session.clusterId)?.name || 'Cluster'}</p>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-end gap-1 border-t border-border pt-3"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingSession(session)} title="View details"><Eye className="h-3.5 w-3.5" /></Button>{isClusterAdmin && !session.dateFixed && <Button variant="ghost" size="sm" disabled={!(sessionProposalDates[session.id] ?? session.date) || !proposalPanchayatId || !proposalVillageId} onClick={() => void handleProposeSessionDate(session, proposalPanchayatId, proposalVillageId)} className="h-8 gap-1 text-xs font-semibold text-primary disabled:opacity-40"><CalendarCheck className="h-3.5 w-3.5" />Save Date</Button>}{isSuperAdmin && !session.dateFixed && <Button variant="ghost" size="sm" disabled={!session.date || approvingSessionId === session.id} onClick={() => void handleApproveSessionDate(session, session.date)} className="h-8 gap-1 text-xs font-semibold text-emerald-700 disabled:opacity-40" title="Approve session date"><CheckCircle2 className="h-3.5 w-3.5" />{approvingSessionId === session.id ? 'Approving…' : 'Approve'}</Button>}{isClusterAdmin && session.dateFixed && <Button variant="ghost" size="sm" onClick={() => handleOpenDateChange(session)} className="h-8 gap-1 text-xs font-semibold text-amber-600"><CalendarCheck className="h-3.5 w-3.5" />Reschedule</Button>}{isSuperAdmin && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setSessionToDelete(session)} title="Delete session"><Trash2 className="h-3.5 w-3.5" /></Button>}</div>
              </article>;
            })}
          </div>}

          {/* Card Pagination */}
          {filteredSessions.length > 0 && (
              <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row text-xs">
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
        </>
      )}
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

              {isSuperAdmin ? <fieldset className="space-y-2"><legend className="mb-1 text-xs font-semibold text-foreground">Target Cluster *</legend><div className="grid gap-2 sm:grid-cols-2">{clusters.map((cluster) => <label key={cluster.id} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition ${formData.clusterId === cluster.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}><input type="checkbox" checked={formData.clusterId === cluster.id} onChange={(event) => { const nextClusterId = event.target.checked ? cluster.id : ''; setFormData((current) => ({ ...current, clusterId: nextClusterId, panchayatId: '', villageName: '' })); setSelectedPanchayatIds([]); setSelectedVillageTargets([]); }} className="mt-0.5 accent-primary" /><span><span className="block font-semibold text-foreground">{cluster.name}</span><span className="text-[11px] text-muted-foreground">{cluster.collegeName || 'Partner College'}</span></span></label>)}</div></fieldset> : <div className="rounded-xl border border-primary/20 bg-primary/5 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Target Cluster</p><p className="mt-1 font-semibold text-foreground">{clusters.find((cluster) => cluster.id === formData.clusterId)?.name || 'Your cluster'}</p></div>}

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
                        {cycleDayOptions.map((dayCount) => (
                          <SelectItem key={dayCount} value={String(dayCount)}>
                            {dayCount === 7 || dayCount === 8
                              ? `${dayCount} Days Cycle (Day 1 - Day ${dayCount})`
                              : `${dayCount} Days Custom Cycle`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      {editingSession && isSuperAdmin && !editingSession.dateFixed ? 'Session Date to Approve *' : 'Session Date *'}
                    </label>
                    <Input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                  <div><label className="mb-1 block text-xs font-semibold text-foreground">Cycle Day</label><div className="flex h-9 items-center rounded-xl border border-border bg-muted/40 px-3 text-xs font-semibold text-foreground">Day {formData.dayNumber} · fixed by Academic Setup</div></div>
                </div>
              )}

              <fieldset className="space-y-2"><legend className="mb-1 text-xs font-semibold text-foreground">Target Panchayats * <span className="font-normal text-muted-foreground">(select all or specific panchayats)</span></legend><label className="flex cursor-pointer items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"><input type="checkbox" checked={formPanchayats.length > 0 && selectedPanchayatIds.length === formPanchayats.length} onChange={(event) => { const nextIds = event.target.checked ? formPanchayats.map((panchayat) => panchayat.id) : []; const nextTargets = event.target.checked ? formPanchayats.flatMap((panchayat) => (panchayat.villages || []).map((village) => ({ panchayatId: panchayat.id, villageId: village.id || village.name, villageName: village.name }))) : []; setSelectedPanchayatIds(nextIds); setSelectedVillageTargets(nextTargets); setFormData((current) => ({ ...current, panchayatId: nextIds[0] || '', villageName: nextTargets[0]?.villageName || '' })); }} className="accent-primary" /><span className="text-xs font-semibold text-primary">Select all panchayats ({formPanchayats.length})</span></label><div className="grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2">{formPanchayats.map((panchayat) => <label key={panchayat.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition ${selectedPanchayatIds.includes(panchayat.id) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}><input type="checkbox" checked={selectedPanchayatIds.includes(panchayat.id)} onChange={(event) => { const nextIds = event.target.checked ? [...selectedPanchayatIds, panchayat.id] : selectedPanchayatIds.filter((id) => id !== panchayat.id); const nextTargets = event.target.checked ? [...selectedVillageTargets, ...(panchayat.villages || []).map((village) => ({ panchayatId: panchayat.id, villageId: village.id || village.name, villageName: village.name }))] : selectedVillageTargets.filter((target) => target.panchayatId !== panchayat.id); setSelectedPanchayatIds(nextIds); setSelectedVillageTargets(nextTargets); setFormData((current) => ({ ...current, panchayatId: nextIds[0] || '', villageName: nextTargets[0]?.villageName || '' })); }} className="accent-primary" /><span className="text-xs font-medium text-foreground">{panchayat.name}</span></label>)}</div>{!formPanchayats.length && <p className="text-xs text-muted-foreground">Select a cluster to view its panchayats.</p>}</fieldset>

              <fieldset className="space-y-2"><legend className="mb-1 text-xs font-semibold text-foreground">Target Villages * <span className="font-normal text-muted-foreground">(choose the villages to schedule)</span></legend><label className="flex cursor-pointer items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"><input type="checkbox" checked={formVillages.length > 0 && selectedVillageTargets.length === formVillages.length} onChange={(event) => { const nextTargets = event.target.checked ? formVillages.map(({ panchayatId, villageId, villageName }) => ({ panchayatId, villageId, villageName })) : []; setSelectedVillageTargets(nextTargets); setFormData((current) => ({ ...current, panchayatId: nextTargets[0]?.panchayatId || '', villageName: nextTargets[0]?.villageName || '' })); }} className="accent-primary" /><span className="text-xs font-semibold text-primary">Select all villages ({formVillages.length})</span></label><div className="grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">{formVillages.map((village) => { const checked = selectedVillageTargets.some((target) => target.panchayatId === village.panchayatId && target.villageId === village.villageId); return <label key={`${village.panchayatId}-${village.villageId}`} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition ${checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}><input type="checkbox" checked={checked} onChange={(event) => { const nextTargets = event.target.checked ? [...selectedVillageTargets, { panchayatId: village.panchayatId, villageId: village.villageId, villageName: village.villageName }] : selectedVillageTargets.filter((target) => !(target.panchayatId === village.panchayatId && target.villageId === village.villageId)); setSelectedVillageTargets(nextTargets); setFormData((current) => ({ ...current, panchayatId: nextTargets[0]?.panchayatId || '', villageName: nextTargets[0]?.villageName || '' })); }} className="accent-primary" /><span className="text-xs"><span className="block font-medium text-foreground">{village.villageName}</span><span className="text-[10px] text-muted-foreground">{village.panchayatName}</span></span></label>; })}</div>{selectedPanchayatIds.length > 0 && selectedPanchayatIds.length < formPanchayats.length && <label className="block space-y-1.5 text-xs font-semibold text-foreground">Reason for scheduling only selected panchayats *<textarea required value={targetLocationReason} onChange={(event) => setTargetLocationReason(event.target.value)} rows={2} placeholder="Explain why the remaining panchayats are not included" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-normal" /></label>}{!selectedVillageTargets.length && <p className="text-xs text-muted-foreground">Select at least one village.</p>}</fieldset>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">
                  {editingSession
                    ? isSuperAdmin && !editingSession.dateFixed ? 'Approve & Confirm Date' : 'Save Changes'
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
