import React, { useState, useMemo } from 'react';
import {
  FileText,
  Users,
  ClipboardList,
  AlertTriangle,
  MessageSquare,
  Save,
  Send,
  Eye,
  Search,
  Filter,
  Calendar,
  X,
  Plus,
  Edit3 as Edit,
  Trash2,
  CheckCircle2,
  Clock,
  GridFour,
  Table,
  ChevronRight,
  School,
} from './ui/icons';
import type { SessionReport, Session, UserRole } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Badge } from './ui/badge';
import { EmptyState } from './ui/EmptyState';

interface SessionReportViewProps {
  sessionReports: SessionReport[];
  sessions: Session[];
  clusters: { id: string; name: string }[];
  currentUserRole: UserRole;
  currentUserClusterId: string;
  onSaveReport: (report: Partial<SessionReport>) => Promise<void>;
  onDeleteReport: (reportId: string) => Promise<void>;
}

export const SessionReportView: React.FC<SessionReportViewProps> = ({
  sessionReports,
  sessions,
  clusters,
  currentUserRole,
  currentUserClusterId,
  onSaveReport,
  onDeleteReport,
}) => {
  const isSuperAdmin = currentUserRole === 'Super Admin';
  const [activeTab, setActiveTab] = useState<'All' | 'DRAFT' | 'SUBMITTED' | 'APPROVED'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClusterFilter, setSelectedClusterFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showFormModal, setShowFormModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SessionReport | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<SessionReport>>({
    sessionId: '',
    sessionSummary: '',
    studentCount: 0,
    attendanceSummary: '',
    activities: '',
    issues: '',
    remarks: '',
  });

  const clusterSessions = useMemo(() => {
    return isSuperAdmin ? sessions : sessions.filter((s) => s.clusterId === currentUserClusterId);
  }, [sessions, isSuperAdmin, currentUserClusterId]);

  // Scoped list
  const visibleReports = useMemo(() => {
    let filtered = sessionReports;
    if (!isSuperAdmin) {
      filtered = filtered.filter((r) => r.clusterId === currentUserClusterId);
    } else if (selectedClusterFilter !== 'all') {
      filtered = filtered.filter((r) => r.clusterName === selectedClusterFilter);
    }

    if (activeTab !== 'All') {
      filtered = filtered.filter((r) => r.status === activeTab);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((r) => {
        const session = sessions.find((s) => s.id === r.sessionId);
        return (
          session?.name.toLowerCase().includes(q) ||
          r.clusterName?.toLowerCase().includes(q) ||
          r.sessionSummary?.toLowerCase().includes(q) ||
          r.activities?.toLowerCase().includes(q) ||
          r.issues?.toLowerCase().includes(q)
        );
      });
    }
    return filtered;
  }, [sessionReports, currentUserClusterId, isSuperAdmin, selectedClusterFilter, activeTab, searchQuery, sessions]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const base = isSuperAdmin ? sessionReports : sessionReports.filter((r) => r.clusterId === currentUserClusterId);
    const total = base.length;
    const submitted = base.filter((r) => r.status === 'SUBMITTED').length;
    const approved = base.filter((r) => r.status === 'APPROVED').length;
    const draft = base.filter((r) => r.status === 'DRAFT').length;
    return { total, submitted, approved, draft };
  }, [sessionReports, isSuperAdmin, currentUserClusterId]);

  const handleOpenForm = (report?: SessionReport) => {
    if (report) {
      setFormData(report);
    } else {
      setFormData({
        sessionId: '',
        sessionSummary: '',
        studentCount: 0,
        attendanceSummary: '',
        activities: '',
        issues: '',
        remarks: '',
      });
    }
    setShowFormModal(true);
  };

  const handleSave = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (!formData.sessionId) return;
    setIsSubmitting(true);
    try {
      await onSaveReport({ ...formData, status });
      setShowFormModal(false);
    } catch (error) {
      console.error('Failed to save session report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Draft
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#1717B8] dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1717B8] animate-pulse" />
            Submitted
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Approved
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
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Session Reports
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1717B8]/10 text-[#1717B8] dark:bg-indigo-950/40 dark:text-indigo-300">
                {visibleReports.length}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Qualitative session outcomes, activities, student counts, and pedagogical challenges
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleOpenForm()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs sm:text-sm font-semibold shadow-sm hover:shadow transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Session Report</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#1717B8] dark:text-blue-400 flex items-center justify-center shrink-0">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.total}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Reports</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-[#1717B8] dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Send className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1717B8] dark:text-indigo-400">{metrics.submitted}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Submitted for Review</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{metrics.approved}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Approved Reports</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">{metrics.draft}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Drafts in Progress</div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl overflow-x-auto">
            {(['All', 'SUBMITTED', 'APPROVED', 'DRAFT'] as const).map((tab) => (
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
                  : tab === 'SUBMITTED'
                  ? `Submitted (${metrics.submitted})`
                  : tab === 'APPROVED'
                  ? `Approved (${metrics.approved})`
                  : `Drafts (${metrics.draft})`}
              </button>
            ))}
          </div>

          {/* Search, Cluster Filter, and Layout Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin && clusters.length > 0 && (
              <div className="w-44">
                <Select value={selectedClusterFilter} onValueChange={setSelectedClusterFilter}>
                  <SelectTrigger className="w-full h-9 text-xs rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium">
                    <SelectValue placeholder="All Clusters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clusters</SelectItem>
                    {clusters.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
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
                placeholder="Search session, cluster, activity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1717B8] focus:border-transparent transition-all"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Grid View"
              >
                <GridFour className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Table View"
              >
                <Table className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Body: Grid or Table */}
        {visibleReports.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={FileText}
              title="No session reports found"
              description={
                searchQuery
                  ? 'No reports match your search query. Try broadening your keywords.'
                  : 'There are currently no session reports recorded in this filter view.'
              }
            />
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 p-5 sm:p-6 bg-slate-50/50 dark:bg-slate-950/20">
            {visibleReports.map((report) => {
              const session = sessions.find((s) => s.id === report.sessionId);
              const hasIssues = Boolean(report.issues && report.issues.trim().length > 0);

              return (
                <div
                  key={report.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3
                          className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1 group-hover:text-[#1717B8] dark:group-hover:text-indigo-400 transition-colors"
                          title={session?.name || 'Academic Session'}
                        >
                          {session?.name || 'Academic Session'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#1717B8]/10 text-[#1717B8] dark:bg-indigo-950/40 dark:text-indigo-300">
                            Day {report.dayNumber || session?.dayNumber || 1}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {report.clusterName || 'Tamil Nadu Cluster'}
                          </span>
                        </div>
                      </div>
                      {getStatusBadge(report.status)}
                    </div>

                    {/* Summary */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 mb-4 leading-relaxed">
                      {report.sessionSummary || <span className="text-slate-400 italic">No summary provided</span>}
                    </p>

                    {/* Issues Alert Box if present */}
                    {hasIssues && (
                      <div className="mb-4 flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-[11px] leading-tight">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <span className="line-clamp-2">{report.issues}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer Stats & Actions */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#1717B8] flex items-center justify-center">
                        <Users className="h-3 w-3" />
                      </div>
                      <span>{report.studentCount} Students</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReport(report);
                          setShowViewModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all active:scale-95 cursor-pointer"
                        title="View Report Details"
                      >
                        <Eye className="h-3 w-3 text-slate-400" />
                        <span>View</span>
                      </button>
                      {!isSuperAdmin && report.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => handleOpenForm(report)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                        >
                          <Edit className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-semibold">Session & Cluster</th>
                  <th className="py-3.5 px-4 font-semibold">Cycle Day</th>
                  <th className="py-3.5 px-4 font-semibold">Students</th>
                  <th className="py-3.5 px-4 font-semibold">Summary Overview</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleReports.map((report) => {
                  const session = sessions.find((s) => s.id === report.sessionId);

                  return (
                    <tr
                      key={report.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          {session?.name || 'Academic Session'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {report.clusterName || 'Tamil Nadu Cluster'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#1717B8]/10 text-[#1717B8] dark:bg-indigo-950/40 dark:text-indigo-300">
                          Day {report.dayNumber || session?.dayNumber || 1}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {report.studentCount}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-sm">
                        <p className="line-clamp-1">{report.sessionSummary || '-'}</p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(report.status)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReport(report);
                              setShowViewModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all cursor-pointer"
                          >
                            <Eye className="h-3 w-3 text-slate-400" />
                            <span>Details</span>
                          </button>
                          {!isSuperAdmin && report.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => handleOpenForm(report)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs font-semibold transition-all cursor-pointer"
                            >
                              <Edit className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal (Create / Edit) */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl my-8 overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1717B8]/10 text-[#1717B8] flex items-center justify-center">
                  <FileText className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {formData.id ? 'Edit Session Report' : 'New Session Report'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Session <span className="text-rose-500">*</span>
                </label>
                <Select
                  value={formData.sessionId}
                  onValueChange={(val) => setFormData({ ...formData, sessionId: val })}
                  disabled={Boolean(formData.id)}
                >
                  <SelectTrigger className="w-full h-10 text-xs rounded-xl border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Select a session" />
                  </SelectTrigger>
                  <SelectContent>
                    {clusterSessions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} (Day {s.dayNumber}) - {s.date}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  General Session Summary <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={formData.sessionSummary}
                  onChange={(e) => setFormData({ ...formData, sessionSummary: e.target.value })}
                  rows={3}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1717B8]"
                  placeholder="Summarize teaching progress, student engagement, and topic delivery..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Attending Students Count <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.studentCount || ''}
                    onChange={(e) => setFormData({ ...formData, studentCount: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1717B8]"
                    placeholder="e.g. 42"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Attendance Notes
                  </label>
                  <input
                    type="text"
                    value={formData.attendanceSummary || ''}
                    onChange={(e) => setFormData({ ...formData, attendanceSummary: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1717B8]"
                    placeholder="e.g. 100% attendance in Grade 10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Activities Conducted
                </label>
                <textarea
                  value={formData.activities || ''}
                  onChange={(e) => setFormData({ ...formData, activities: e.target.value })}
                  rows={2}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1717B8]"
                  placeholder="Detail activities, interactive exercises, experiments conducted..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Issues / Challenges Encountered</span>
                </label>
                <textarea
                  value={formData.issues || ''}
                  onChange={(e) => setFormData({ ...formData, issues: e.target.value })}
                  rows={2}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 text-slate-900 dark:text-white placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Record power outages, classroom logistics, or subject difficulty..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  General Remarks
                </label>
                <textarea
                  value={formData.remarks || ''}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  rows={2}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1717B8]"
                  placeholder="Additional supervisor observations or feedback..."
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave('DRAFT')}
                disabled={isSubmitting || !formData.sessionId}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave('SUBMITTED')}
                disabled={isSubmitting || !formData.sessionId || !formData.sessionSummary}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Submit Report</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal (Inspection) */}
      {showViewModal && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl my-8 overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1717B8]/10 text-[#1717B8] flex items-center justify-center">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Session Report Details
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {getStatusBadge(selectedReport.status)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Header Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Session Name
                  </span>
                  <span className="block font-semibold text-slate-900 dark:text-white mt-0.5">
                    {sessions.find((s) => s.id === selectedReport.sessionId)?.name || 'Session'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Cluster
                  </span>
                  <span className="block font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedReport.clusterName || 'Tamil Nadu Cluster'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Attending Students
                  </span>
                  <span className="block font-bold text-[#1717B8] dark:text-indigo-400 mt-0.5">
                    {selectedReport.studentCount} Students
                  </span>
                </div>
              </div>

              {/* Summary */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-[#1717B8]" />
                  <span>Session Summary</span>
                </h4>
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {selectedReport.sessionSummary || 'No summary recorded.'}
                </div>
              </div>

              {/* Attendance Notes */}
              {selectedReport.attendanceSummary && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
                    <span>Attendance Observations</span>
                  </h4>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                    {selectedReport.attendanceSummary}
                  </div>
                </div>
              )}

              {/* Activities */}
              {selectedReport.activities && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Activities Carried Out</span>
                  </h4>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {selectedReport.activities}
                  </div>
                </div>
              )}

              {/* Issues */}
              {selectedReport.issues && (
                <div>
                  <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    <span>Issues & Challenges</span>
                  </h4>
                  <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200/70 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-300 leading-relaxed whitespace-pre-wrap">
                    {selectedReport.issues}
                  </div>
                </div>
              )}

              {/* Remarks */}
              {selectedReport.remarks && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
                    <span>General Remarks</span>
                  </h4>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {selectedReport.remarks}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionReportView;
