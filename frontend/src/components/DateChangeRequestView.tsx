import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  AlertCircle,
  Search,
  Eye,
  Filter,
  ArrowRight,
  Sparkles,
  RotateCcw,
  Check,
  X,
} from './ui/icons';
import type { DateChangeRequest, Session, UserRole } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Badge } from './ui/badge';
import { EmptyState } from './ui/EmptyState';

interface DateChangeRequestViewProps {
  dateChangeRequests: DateChangeRequest[];
  sessions: Session[];
  currentUserRole: UserRole;
  currentUserId: string;
  currentUserClusterId: string;
  onSubmitRequest: (sessionId: string, originalDate: string, requestedDate: string, reason: string) => Promise<void>;
  onReviewRequest: (requestId: string, action: 'approve' | 'reject', remarks: string) => Promise<void>;
}

export const DateChangeRequestView: React.FC<DateChangeRequestViewProps> = ({
  dateChangeRequests,
  sessions,
  currentUserRole,
  currentUserId,
  currentUserClusterId,
  onSubmitRequest,
  onReviewRequest,
}) => {
  const dateOnly = (value: string) => {
    if (!value) return '—';
    const match = value.match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : value.split('T')[0].split(' ')[0];
  };

  const [activeTab, setActiveTab] = useState<'All' | 'PENDING' | 'APPROVED' | 'REJECTED'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClusterFilter, setSelectedClusterFilter] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DateChangeRequest | null>(null);

  // New Request Form State
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [reason, setReason] = useState('');

  // Review Form State
  const [reviewRemarks, setReviewRemarks] = useState('');

  const isSuperAdmin = currentUserRole === 'Super Admin';

  // Distinct cluster names for filter dropdown
  const clusterOptions = useMemo(() => {
    const set = new Set<string>();
    dateChangeRequests.forEach((req) => {
      if (req.clusterName) set.add(req.clusterName);
    });
    return Array.from(set).sort();
  }, [dateChangeRequests]);

  // Scoped list
  const visibleRequests = useMemo(() => {
    let filtered = dateChangeRequests;
    if (!isSuperAdmin) {
      filtered = filtered.filter((req) => req.clusterId === currentUserClusterId);
    } else if (selectedClusterFilter !== 'all') {
      filtered = filtered.filter((req) => req.clusterName === selectedClusterFilter);
    }

    if (activeTab !== 'All') {
      filtered = filtered.filter((req) => req.status === activeTab);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((req) => {
        const session = sessions.find((s) => s.id === req.sessionId);
        return (
          session?.name.toLowerCase().includes(q) ||
          req.clusterName?.toLowerCase().includes(q) ||
          req.reason.toLowerCase().includes(q) ||
          req.requestedDate.toLowerCase().includes(q) ||
          req.originalDate.toLowerCase().includes(q)
        );
      });
    }
    return filtered;
  }, [dateChangeRequests, currentUserClusterId, isSuperAdmin, selectedClusterFilter, activeTab, searchQuery, sessions]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const base = isSuperAdmin ? dateChangeRequests : dateChangeRequests.filter((r) => r.clusterId === currentUserClusterId);
    const total = base.length;
    const pending = base.filter((r) => r.status === 'PENDING').length;
    const approved = base.filter((r) => r.status === 'APPROVED').length;
    const rejected = base.filter((r) => r.status === 'REJECTED').length;
    return { total, pending, approved, rejected };
  }, [dateChangeRequests, isSuperAdmin, currentUserClusterId]);

  const clusterSessions = useMemo(() => {
    return sessions.filter((s) => s.clusterId === currentUserClusterId);
  }, [sessions, currentUserClusterId]);

  const handleNewRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const session = clusterSessions.find((s) => s.id === selectedSessionId);
    if (!session || !requestedDate || !reason.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmitRequest(selectedSessionId, session.date, requestedDate, reason.trim());
      setShowNewModal(false);
      setSelectedSessionId('');
      setRequestedDate('');
      setReason('');
    } catch (error) {
      console.error('Failed to submit date change request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewSubmit = async (action: 'approve' | 'reject') => {
    if (!selectedRequest) return;
    setIsSubmitting(true);
    try {
      await onReviewRequest(selectedRequest.id, action, reviewRemarks.trim());
      setShowReviewModal(false);
      setSelectedRequest(null);
      setReviewRemarks('');
    } catch (error) {
      console.error(`Failed to ${action} date change request:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending Review
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60">
            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Rejected
          </span>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#1717B8]/10 dark:bg-[#1717B8]/20 flex items-center justify-center text-[#1717B8] dark:text-indigo-400 shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Date Change Requests
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1717B8]/10 text-[#1717B8] dark:bg-indigo-950/40 dark:text-indigo-300">
                {visibleRequests.length}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Review and authorize academic schedule modifications across clusters
            </p>
          </div>
        </div>

        {!isSuperAdmin && (
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs sm:text-sm font-semibold shadow-sm hover:shadow transition-all active:scale-[0.98] cursor-pointer"
          >
            <Calendar className="h-4 w-4" />
            <span>New Request</span>
          </button>
        )}
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#1717B8] dark:text-blue-400 flex items-center justify-center shrink-0">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.total}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Requests</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{metrics.pending}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending Review</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{metrics.approved}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Approved Changes</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <XCircle className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{metrics.rejected}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Rejected</div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl overflow-x-auto">
            {(['All', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab === 'All'
                  ? `All (${metrics.total})`
                  : tab === 'PENDING'
                  ? `Pending (${metrics.pending})`
                  : tab === 'APPROVED'
                  ? `Approved (${metrics.approved})`
                  : `Rejected (${metrics.rejected})`}
              </button>
            ))}
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin && clusterOptions.length > 0 && (
              <div className="w-44">
                <Select value={selectedClusterFilter} onValueChange={setSelectedClusterFilter}>
                  <SelectTrigger className="w-full h-9 text-xs rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium">
                    <SelectValue placeholder="All Clusters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clusters</SelectItem>
                    {clusterOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search session, cluster, reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1717B8] focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* Request List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                {isSuperAdmin && <th className="py-3.5 px-4 font-semibold">Cluster</th>}
                <th className="py-3.5 px-4 font-semibold">Session & Cycle</th>
                <th className="py-3.5 px-4 font-semibold">Schedule Modification</th>
                <th className="py-3.5 px-4 font-semibold">Reason</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleRequests.map((req) => {
                const session = sessions.find((s) => s.id === req.sessionId);
                const dayNumber = req.dayNumber || session?.dayNumber;

                return (
                  <tr
                    key={req.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group"
                  >
                    {isSuperAdmin && (
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                          {req.clusterName || 'Unknown Cluster'}
                        </span>
                      </td>
                    )}
                    <td className="py-3.5 px-4">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        {session?.name || 'Academic Session'}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#1717B8]/10 text-[#1717B8] dark:bg-indigo-950/40 dark:text-indigo-300">
                          Day {dayNumber || 1}
                        </span>
                        {session?.panchayatId && (
                          <span className="text-[11px] text-slate-400">
                            {session.panchayatId}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-2 text-xs">
                        <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[11px] line-through">
                          {dateOnly(req.originalDate)}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-[#1717B8] dark:text-indigo-300 font-mono font-bold text-[11px] border border-indigo-200/60 dark:border-indigo-800/40">
                          {dateOnly(req.requestedDate)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs">
                      <p className="line-clamp-2" title={req.reason}>
                        {req.reason}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(req.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {isSuperAdmin && req.status === 'PENDING' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRequest(req);
                            setShowReviewModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Review</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRequest(req);
                            setShowReviewModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all active:scale-95 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-400" />
                          <span>Details</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {visibleRequests.length === 0 && (
                <tr>
                  <td colSpan={isSuperAdmin ? 6 : 5} className="p-8">
                    <EmptyState
                      icon={Calendar}
                      title="No date change requests found"
                      description={
                        searchQuery
                          ? 'No requests match your search criteria. Try a different keyword or filter.'
                          : 'There are currently no date change requests for the selected filter.'
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Request Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1717B8]/10 text-[#1717B8] flex items-center justify-center">
                  <Calendar className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Request Session Date Change
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleNewRequestSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Academic Session <span className="text-rose-500">*</span>
                </label>
                <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                  <SelectTrigger className="w-full h-10 text-xs rounded-xl border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Select session to reschedule" />
                  </SelectTrigger>
                  <SelectContent>
                    {clusterSessions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} (Scheduled: {s.date})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSessionId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Original Scheduled Date
                  </label>
                  <input
                    type="text"
                    disabled
                    value={clusterSessions.find((s) => s.id === selectedSessionId)?.date || ''}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Requested New Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1717B8]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Reason for Rescheduling <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Provide detailed justification for this date change request..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1717B8]"
                  required
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedSessionId || !requestedDate || !reason.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review / Details Modal */}
      {showReviewModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1717B8]/10 text-[#1717B8] flex items-center justify-center">
                  <Calendar className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {isSuperAdmin && selectedRequest.status === 'PENDING'
                    ? 'Review Date Change Request'
                    : 'Date Change Details'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedRequest(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Top Details Grid */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Cluster
                  </span>
                  <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedRequest.clusterName || 'Tamil Nadu Cluster'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Current Status
                  </span>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Original Date
                  </span>
                  <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                    {dateOnly(selectedRequest.originalDate)}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Requested Date
                  </span>
                  <span className="block text-xs font-bold text-[#1717B8] dark:text-indigo-400 font-mono mt-0.5">
                    {dateOnly(selectedRequest.requestedDate)}
                  </span>
                </div>
              </div>

              {/* Reason Card */}
              <div>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Reason for Request
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800 leading-relaxed">
                  {selectedRequest.reason}
                </p>
              </div>

              {/* Historical Remarks if already decided */}
              {selectedRequest.status !== 'PENDING' && selectedRequest.reviewRemarks && (
                <div>
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Review Decision Remarks
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800 leading-relaxed">
                    {selectedRequest.reviewRemarks}
                  </p>
                </div>
              )}

              {/* Super Admin Decision Input */}
              {isSuperAdmin && selectedRequest.status === 'PENDING' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Administrative Remarks (Optional)
                  </label>
                  <textarea
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    rows={2}
                    placeholder="Add approval notes or rejection reason for cluster records..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1717B8]"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                {isSuperAdmin && selectedRequest.status === 'PENDING' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleReviewSubmit('reject')}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-400 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReviewSubmit('approve')}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Authorize Date Change</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowReviewModal(false);
                      setSelectedRequest(null);
                    }}
                    className="px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateChangeRequestView;
