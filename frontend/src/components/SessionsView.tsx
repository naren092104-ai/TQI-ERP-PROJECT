import React, { useState, useMemo, useEffect } from 'react';
import { TabType, Session, Panchayat, Volunteer, Cluster } from '../types';
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
} from './ui/icons';

interface SessionsViewProps {
  sessions: Session[];
  clusters?: Cluster[];
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
  clusters = [],
  panchayats = [],
  volunteers = [],
  onNavigate,
  onAddSession,
  onUpdateSession,
  onDeleteSession,
  onRequestDateChange,
  userRole = 'Super Admin',
}) => {
  const isClusterAdmin = userRole === 'Cluster Admin';

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClusterId, setSelectedClusterId] = useState<string>('all');
  const [showClusterCards, setShowClusterCards] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPanchayatId, setSelectedPanchayatId] = useState<string>('all');
  const [filterDate, setFilterDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [viewingSession, setViewingSession] = useState<Session | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [dateChangeSession, setDateChangeSession] = useState<Session | null>(null);
  const [newDateValue, setNewDateValue] = useState('');
  const [dateChangeReason, setDateChangeReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

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
    const dateChangesPending = sessions.filter(
      (s) => s.status === 'Needs Attention' || s.status === 'Action Req.' || s.status === 'Pending Review'
    ).length;
    return { total, completed, upcoming, dateChangesPending };
  }, [sessions]);

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

  const visibleClusters = useMemo(
    () => isClusterAdmin ? clusters.filter((cluster) => sessions.some((session) => session.clusterId === cluster.id) || cluster.id === clusters[0]?.id) : clusters,
    [clusters, sessions, isClusterAdmin]
  );

  if (showClusterCards) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sessions Schedule &amp; Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose a cluster to view and manage its sessions.</p>
        </div>
        {visibleClusters.length === 0 ? (
          <EmptyState icon={Building2} title="No clusters available" description="Clusters will appear here when they are configured." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleClusters.map((cluster) => {
              const clusterSessions = sessions.filter((session) => session.clusterId === cluster.id);
              const completed = clusterSessions.filter((session) => session.status === 'Completed').length;
              const upcoming = clusterSessions.filter((session) => session.status === 'Scheduled' || session.status === 'In Progress').length;
              return (
                <button
                  key={cluster.id}
                  type="button"
                  onClick={() => { setSelectedClusterId(cluster.id); setShowClusterCards(false); setCurrentPage(1); }}
                  className="text-left rounded-lg border border-border bg-card p-5 shadow-xs transition hover:border-primary/50 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-foreground">{cluster.name}</h2>
                      <p className="mt-1 text-sm font-medium text-foreground">{cluster.collegeName || 'College not assigned'}</p>
                      <p className="text-xs text-muted-foreground">{cluster.district}, {cluster.state || 'Tamil Nadu'}</p>
                    </div>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-md bg-muted/40 p-2"><strong className="block text-base text-foreground">{clusterSessions.length}</strong><span className="text-muted-foreground">Sessions</span></div>
                    <div className="rounded-md bg-muted/40 p-2"><strong className="block text-base text-foreground">{completed}</strong><span className="text-muted-foreground">Completed</span></div>
                    <div className="rounded-md bg-muted/40 p-2"><strong className="block text-base text-foreground">{upcoming}</strong><span className="text-muted-foreground">Upcoming</span></div>
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-1 text-sm font-semibold text-primary">View Sessions <span aria-hidden="true">→</span></div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const handleOpenAdd = () => {
    setEditingSession(null);
    const p = panchayats[0];
    setFormData({
      name: `Day 1 Spoken English Session`,
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
    setIsModalOpen(true);
  };

  const handleOpenEdit = (session: Session) => {
    setEditingSession(session);
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

  const handleSaveSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a session name.');
      return;
    }

    const p = panchayats.find((item) => item.id === formData.panchayatId);
    const v = volunteers.find((item) => item.id === formData.volunteerId);
    const c = clusters.find((item) => item.id === formData.clusterId);

    if (editingSession) {
      const payload: Partial<Session> = {
        name: formData.name.trim(),
        title: formData.name.trim(),
        clusterId: formData.clusterId,
        clusterName: c?.name || editingSession.clusterName || 'Cluster',
        dayNumber: formData.dayNumber,
        day: `Day ${formData.dayNumber}`,
        date: formData.date,
        module: formData.module,
        panchayatId: formData.panchayatId,
        panchayatName: p?.name || editingSession.panchayatName || 'Panchayat',
        villageName: formData.villageName,
        volunteerId: formData.volunteerId,
        volunteerName: v?.name || editingSession.volunteerName || 'Unassigned',
        status: formData.status,
        description: formData.description,
      };
      onUpdateSession(editingSession.id, payload);
      showToast(`Updated session: ${formData.name}`);
    } else {
      onAddSession({
        name: formData.name.trim(),
        title: formData.name.trim(),
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

    showToast(`Reschedule request submitted for ${dateChangeSession.name}`);
    setDateChangeSession(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button type="button" onClick={() => { setShowClusterCards(true); setSelectedClusterId('all'); }} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to clusters
          </button>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Sessions Schedule &amp; Management
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Monitor and coordinate teaching sessions across all clusters, village learning hubs, and volunteers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('date-change-requests')}
            className="gap-1.5 text-xs font-semibold"
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            <span>Date Change Requests ({stats.dateChangesPending})</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Schedule Session</span>
          </Button>
        </div>
      </div>

      {/* 2. KPI Summary Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Sessions</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{stats.total}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Completed</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{stats.completed}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Upcoming</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">{stats.upcoming}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Reschedule Requests</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">{stats.dateChangesPending}</p>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-card p-3 shadow-xs">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by session title, module, village, volunteer..."
            className="h-9 pl-8 text-xs"
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
            <SelectTrigger className="h-9 text-xs">
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
            <SelectTrigger className="h-9 text-xs">
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

        {/* Status Filter */}
        <div className="w-36">
          <Select
            value={selectedStatus}
            onValueChange={(val) => {
              setSelectedStatus(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Scheduled">Scheduled</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Needs Attention">Needs Attention</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
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
            className="h-9 text-xs"
            title="Filter by session date"
          />
        </div>

        {(searchTerm ||
          selectedClusterId !== 'all' ||
          selectedDay !== 'all' ||
          selectedStatus !== 'all' ||
          selectedPanchayatId !== 'all' ||
          filterDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm('');
              setSelectedClusterId('all');
              setSelectedDay('all');
              setSelectedStatus('all');
              setSelectedPanchayatId('all');
              setFilterDate('');
              setCurrentPage(1);
            }}
            className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Reset
          </Button>
        )}
      </div>

      {/* 4. Enterprise Session Table */}
      <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
              <tr>
                <th className="w-14 px-4 py-3 text-center">S.No</th>
                <th className="px-4 py-3">Cluster</th>
                <th className="px-4 py-3 text-center">Cycle Day</th>
                <th className="px-4 py-3">Session Date</th>
                <th className="px-4 py-3">Module &amp; Curriculum</th>
                <th className="px-4 py-3">Panchayat &amp; Village</th>
                <th className="px-4 py-3">Volunteer Mentor</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedSessions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12">
                    <EmptyState
                      icon={Calendar}
                      title="No sessions scheduled"
                      description={
                        searchTerm || selectedClusterId !== 'all'
                          ? 'Try adjusting your filters or search terms.'
                          : 'Schedule your first teaching session to begin academic operations.'
                      }
                      actionLabel="+ Schedule Session"
                      onAction={handleOpenAdd}
                    />
                  </td>
                </tr>
              ) : (
                paginatedSessions.map((session, idx) => {
                  const sNo = (currentPage - 1) * pageSize + idx + 1;
                  const dayNum = session.dayNumber || parseInt(session.day?.replace(/\D/g, '') || '1', 10);
                  const isCompleted = session.status === 'Completed';

                  return (
                    <tr
                      key={session.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                        {sNo}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-foreground">
                          {session.clusterName || 'Main Cluster'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="default" size="sm">
                          Day {dayNum}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          <span>{session.date || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">
                          {session.name || session.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {session.module || 'Spoken English'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{session.panchayatName || '—'}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{session.villageName || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {(session.volunteerName || 'U').charAt(0)}
                          </div>
                          <span className="text-foreground font-medium">
                            {session.volunteerName || 'Unassigned'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={
                            session.status === 'Completed'
                              ? 'success'
                              : session.status === 'In Progress'
                              ? 'info'
                              : session.status === 'Needs Attention' || session.status === 'Action Req.'
                              ? 'warning'
                              : session.status === 'Cancelled'
                              ? 'destructive'
                              : 'secondary'
                          }
                          size="sm"
                        >
                          {session.status}
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                            onClick={() => handleOpenDateChange(session)}
                            title="Request Date Reschedule"
                          >
                            <CalendarCheck className="h-3.5 w-3.5" />
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

        {/* Table Pagination Footer */}
        {filteredSessions.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row text-xs">
            <div className="text-muted-foreground">
              Showing{' '}
              <span className="font-semibold text-foreground">
                {(currentPage - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-foreground">
                {Math.min(currentPage * pageSize, filteredSessions.length)}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-foreground">
                {filteredSessions.length}
              </span>{' '}
              sessions
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <CaretLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2 text-xs font-medium text-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <CaretRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Add / Edit Session Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {editingSession ? 'Edit Scheduled Session' : 'Schedule Academic Session'}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Set cycle day, session date, curriculum module, and assigned village learning hub.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="mt-4 space-y-4 text-xs">
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Session Title *
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. Day 1 Spoken English & Self Introductions"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Cluster *
                    </label>
                    <Select
                      value={formData.clusterId}
                      onValueChange={(val) => setFormData({ ...formData, clusterId: val })}
                      disabled={isClusterAdmin}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Cluster" />
                      </SelectTrigger>
                      <SelectContent>
                        {clusters.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Cycle Day *
                    </label>
                    <Select
                      value={String(formData.dayNumber)}
                      onValueChange={(val) => setFormData({ ...formData, dayNumber: parseInt(val, 10) || 1 })}
                    >
                      <SelectTrigger className="h-9 text-xs">
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
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Session Date (Date only) *
                    </label>
                    <Input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Curriculum Module *
                    </label>
                    <Select
                      value={formData.module}
                      onValueChange={(val) => setFormData({ ...formData, module: val })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Module" />
                      </SelectTrigger>
                      <SelectContent>
                        {moduleOptions.map((mod) => (
                          <SelectItem key={mod} value={mod}>
                            {mod}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Target Panchayat *
                    </label>
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
                      <SelectTrigger className="h-9 text-xs">
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
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Target Village *
                    </label>
                    <Select
                      value={formData.villageName}
                      onValueChange={(val) => setFormData({ ...formData, villageName: val })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Village" />
                      </SelectTrigger>
                      <SelectContent>
                        {formVillages.map((v) => (
                          <SelectItem key={v.id || v.name} value={v.name}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Assigned Volunteer Mentor
                    </label>
                    <Select
                      value={formData.volunteerId}
                      onValueChange={(val) => setFormData({ ...formData, volunteerId: val })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Volunteer" />
                      </SelectTrigger>
                      <SelectContent>
                        {volunteers.map((vol) => (
                          <SelectItem key={vol.id} value={vol.id}>
                            {vol.name} ({vol.department?.slice(0, 15)}...)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Status
                    </label>
                    <Select
                      value={formData.status}
                      onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Scheduled">Scheduled</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Needs Attention">Needs Attention</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingSession ? 'Update Session' : 'Schedule Session'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Date Change Request Modal */}
      {dateChangeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Request Date Reschedule</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Propose a new date for {dateChangeSession.name || `Day ${dateChangeSession.dayNumber}`}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDateChangeSession(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitDateChange} className="mt-4 space-y-4 text-xs">
              <div>
                <span className="text-muted-foreground block mb-1">Current Date:</span>
                <span className="font-mono font-bold text-foreground text-sm">{dateChangeSession.date || 'Not set'}</span>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  New Requested Date *
                </label>
                <Input
                  type="date"
                  required
                  value={newDateValue}
                  onChange={(e) => setNewDateValue(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Reason for Reschedule *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Village school hall unavailable due to local panchayat elections..."
                  value={dateChangeReason}
                  onChange={(e) => setDateChangeReason(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setDateChangeSession(null)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Submit Reschedule Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. View Session Details Modal */}
      {viewingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">{viewingSession.name || viewingSession.title}</h3>
                <p className="text-xs text-muted-foreground">Session ID: {viewingSession.code || viewingSession.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingSession(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/20 p-3">
                <div>
                  <span className="text-muted-foreground block">Cycle Day:</span>
                  <span className="font-semibold text-foreground">Day {viewingSession.dayNumber || 1}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Session Date:</span>
                  <span className="font-mono font-semibold text-foreground">{viewingSession.date || '—'}</span>
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
                  <Badge variant="default" size="sm">
                    {viewingSession.status}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setViewingSession(null);
                      onNavigate('attendance');
                    }}
                  >
                    Attendance Roster →
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setViewingSession(null);
                      onNavigate('session-photos');
                    }}
                  >
                    Session Photos →
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const toEdit = viewingSession;
                      setViewingSession(null);
                      handleOpenEdit(toEdit);
                    }}
                  >
                    Edit Session
                  </Button>
                  <Button size="sm" onClick={() => setViewingSession(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Delete Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Delete Scheduled Session?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to remove <strong className="text-foreground">{sessionToDelete.name || sessionToDelete.title}</strong>? This will detach any associated session logs.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSessionToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
              >
                Delete Session
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-md bg-foreground px-4 py-3 text-xs font-semibold text-background shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-muted-foreground hover:text-background"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
