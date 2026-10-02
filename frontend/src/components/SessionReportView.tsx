import React, { useState, useMemo, useEffect } from 'react';
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
  Lock,
  Upload,
} from './ui/icons';
import type { AcademicYear, SessionReport, SessionReportActivity, SessionReportPhoto, Session, UserRole } from '../types';
import { apiUrl } from '../utils/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Badge } from './ui/badge';
import { EmptyState } from './ui/EmptyState';

interface SessionReportContext {
  session: { id: string; name: string; dayNumber: number | null; date: string | null; status: string };
  academicYear: { id: string; name: string; status: string };
  cluster: { id: string; name: string };
  collegeName: string;
  panchayat: { id: string; name: string } | null;
  village: { id: string; name: string } | null;
  villages: Array<{ id: string; name: string }>;
  summitNumbers: string[];
  grades: string[];
  volunteers: Array<{ id: string; name: string }>;
  activities: SessionReportActivity[];
  attendance: { available: boolean; presentCount: number; totalCount: number };
}

interface SessionReportViewProps {
  sessionReports: SessionReport[];
  sessions: Session[];
  clusters: { id: string; name: string }[];
  currentUserRole: UserRole;
  currentUserClusterId: string;
  authToken: string;
  academicYears: AcademicYear[];
  selectedAcademicYearId: string;
  onSaveReport: (report: Partial<SessionReport>) => Promise<SessionReport>;
  onReportPhotosUpdate: (reportId: string, photos: SessionReportPhoto[]) => void;
  onDeleteReport: (reportId: string) => Promise<void>;
}

const parseActivities = (value?: string): SessionReportActivity[] => {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => ({
        topic: String(item?.topic || ''),
        details: String(item?.details || item?.summary || ''),
        lessonPlanId: item?.lessonPlanId ? String(item.lessonPlanId) : undefined,
        moduleId: item?.moduleId ? String(item.moduleId) : undefined,
      }));
    }
  } catch {
    // Older reports stored a plain-text activity summary.
  }
  return [{ topic: '', details: value }];
};

const ProtectedReportPhoto: React.FC<{ photo: SessionReportPhoto; authToken: string }> = ({ photo, authToken }) => {
  const [src, setSrc] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    void fetch(apiUrl(photo.fileUrl), {
      signal: controller.signal,
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    }).then(async (response) => {
      if (!response.ok) return;
      objectUrl = URL.createObjectURL(await response.blob());
      if (!controller.signal.aborted) setSrc(objectUrl);
    }).catch(() => undefined);
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.fileUrl, authToken]);
  return src ? <img src={src} alt={photo.originalFilename} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-slate-400">Loading photo…</div>;
};

export const SessionReportView: React.FC<SessionReportViewProps> = ({
  sessionReports,
  sessions,
  clusters,
  currentUserRole,
  currentUserClusterId,
  authToken,
  academicYears,
  selectedAcademicYearId,
  onSaveReport,
  onReportPhotosUpdate,
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
  const [reportError, setReportError] = useState('');
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [sessionContext, setSessionContext] = useState<SessionReportContext | null>(null);
  const [viewContext, setViewContext] = useState<SessionReportContext | null>(null);
  const [viewContextLoading, setViewContextLoading] = useState(false);
  const [reportActivities, setReportActivities] = useState<SessionReportActivity[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [localPhotoUrls, setLocalPhotoUrls] = useState<string[]>([]);

  // Form State
  const [formData, setFormData] = useState<Partial<SessionReport>>({
    sessionId: '',
    sessionSummary: '',
    studentCount: null,
    attendanceSummary: '',
    activities: '',
    outcome: '',
    issues: '',
    remarks: '',
  });

  const clusterSessions = useMemo(() => {
    return sessions.filter((session) =>
      Boolean(session.hasSavedSchedule) &&
      (currentUserClusterId === 'all' || session.clusterId === currentUserClusterId) &&
      (!selectedAcademicYearId || !session.academicYearId || session.academicYearId === selectedAcademicYearId)
    );
  }, [sessions, currentUserClusterId, selectedAcademicYearId]);

  useEffect(() => {
    const urls = photoFiles.map((file) => URL.createObjectURL(file));
    setLocalPhotoUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photoFiles]);

  useEffect(() => {
    if (!showFormModal || !formData.sessionId || !selectedAcademicYearId) {
      setSessionContext(null);
      setIsContextLoading(false);
      return;
    }
    const controller = new AbortController();
    const loadContext = async () => {
      setIsContextLoading(true);
      setReportError('');
      try {
        const response = await fetch(apiUrl(`/api/session-reports/context?sessionId=${encodeURIComponent(formData.sessionId || '')}`), {
          signal: controller.signal,
          cache: 'no-store',
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success || !data?.context) {
          throw new Error(data?.error || 'Unable to load this saved session context.');
        }
        if (data.context.academicYear?.id !== selectedAcademicYearId) {
          throw new Error('The saved session belongs to a different academic year. Refresh the page and try again.');
        }
        setSessionContext(data.context as SessionReportContext);
        if (!formData.id) {
          setReportActivities(data.context.activities?.length ? data.context.activities : [{ topic: '', details: '' }]);
        }
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          setSessionContext(null);
          setReportError(error?.message || 'Unable to load session context.');
        }
      } finally {
        if (!controller.signal.aborted) setIsContextLoading(false);
      }
    };
    void loadContext();
    return () => controller.abort();
  }, [authToken, formData.id, formData.sessionId, selectedAcademicYearId, showFormModal]);

  useEffect(() => {
    if (!showViewModal || !selectedReport?.sessionId || !selectedAcademicYearId) {
      setViewContext(null);
      setViewContextLoading(false);
      return;
    }
    const controller = new AbortController();
    const loadViewContext = async () => {
      setViewContextLoading(true);
      try {
        const response = await fetch(apiUrl(`/api/session-reports/context?sessionId=${encodeURIComponent(selectedReport.sessionId)}`), {
          signal: controller.signal,
          cache: 'no-store',
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        const data = await response.json().catch(() => null);
        if (response.ok && data?.success && data.context) setViewContext(data.context as SessionReportContext);
      } catch {
        // The report content can still be inspected if its session context was removed.
      } finally {
        if (!controller.signal.aborted) setViewContextLoading(false);
      }
    };
    void loadViewContext();
    return () => controller.abort();
  }, [authToken, selectedAcademicYearId, selectedReport?.sessionId, showViewModal]);

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
    setReportError('');
    setSessionContext(null);
    setPhotoFiles([]);
    if (report) {
      setFormData(report);
      setReportActivities(parseActivities(report.activities));
    } else {
      const initialSessionId = clusterSessions.length === 1 ? clusterSessions[0].id : '';
      setFormData({
        sessionId: initialSessionId,
        sessionSummary: '',
        studentCount: null,
        attendanceSummary: '',
        activities: '',
        outcome: '',
        issues: '',
        remarks: '',
      });
      setReportActivities([{ topic: '', details: '' }]);
    }
    setShowFormModal(true);
  };

  const handleSave = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (!formData.sessionId || !sessionContext) {
      setReportError('Select a saved session and wait for its ERP context to load.');
      return;
    }
    setIsSubmitting(true);
    setReportError('');
    try {
      const savedReportResult = await onSaveReport({
        ...formData,
        sessionId: sessionContext.session.id,
        academicYearId: sessionContext.academicYear.id,
        clusterId: sessionContext.cluster.id,
        dayNumber: sessionContext.session.dayNumber || undefined,
        studentCount: sessionContext.attendance.available ? sessionContext.attendance.presentCount : null,
        attendanceSummary: sessionContext.attendance.available
          ? `Present ${sessionContext.attendance.presentCount} of ${sessionContext.attendance.totalCount}`
          : '',
        activities: JSON.stringify(reportActivities),
        status,
      });
      const savedReport = { ...savedReportResult, photos: savedReportResult.photos?.length ? savedReportResult.photos : (formData.photos || []) };
      setFormData(savedReport);
      if (photoFiles.length) {
        const uploadData = new FormData();
        photoFiles.forEach((file) => uploadData.append('photos', file));
        const response = await fetch(apiUrl(`/api/session-reports/${encodeURIComponent(savedReport.id)}/photos`), {
          method: 'POST',
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          body: uploadData,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success || !Array.isArray(data.photos)) {
          throw new Error(data?.error || 'Report saved, but the selected photos could not be uploaded. Reopen the draft and retry.');
        }
        const photos = [...(savedReport.photos || []), ...data.photos] as SessionReportPhoto[];
        setFormData((current) => ({ ...current, photos }));
        onReportPhotosUpdate(savedReport.id, photos);
        setPhotoFiles([]);
      }
      setShowFormModal(false);
    } catch (error) {
      console.error('Failed to save session report:', error);
      setReportError(error instanceof Error ? error.message : 'Unable to save the report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeExistingPhoto = async (photo: SessionReportPhoto) => {
    if (!formData.id) return;
    setReportError('');
    try {
      const response = await fetch(apiUrl(`/api/session-report-photos/${encodeURIComponent(photo.id)}`), {
        method: 'DELETE',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to remove photo.');
      const photos = (formData.photos || []).filter((item) => item.id !== photo.id);
      setFormData((current) => ({ ...current, photos }));
      onReportPhotosUpdate(formData.id, photos);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Unable to remove photo.');
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
                          title={session?.name || 'Session'}
                        >
                          {session?.name || 'Session'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#1717B8]/10 text-[#1717B8] dark:bg-indigo-950/40 dark:text-indigo-300">
                            Day {report.dayNumber || session?.dayNumber || 1}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {report.clusterName || 'Cluster not available'}
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
                      <span>{report.studentCount == null ? 'Attendance not recorded' : `${report.studentCount} Students`}</span>
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
                          {session?.name || 'Session'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {report.clusterName || 'Cluster not available'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#1717B8]/10 text-[#1717B8] dark:bg-indigo-950/40 dark:text-indigo-300">
                          Day {report.dayNumber || session?.dayNumber || 1}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {report.studentCount ?? '—'}
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

            <div className="p-6 overflow-y-auto space-y-6">
              <section className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Auto-fetched session information</h4>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Master data is read-only and loaded from the selected academic year.</p>
                </div>
                {!formData.id && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">Saved Session Plan entry *</label>
                    <Select
                      value={formData.sessionId || ''}
                      onValueChange={(value) => {
                        setReportError('');
                        setSessionContext(null);
                        setReportActivities([{ topic: '', details: '' }]);
                        setFormData((current) => ({ ...current, sessionId: value }));
                      }}
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 text-xs dark:border-slate-700">
                        <SelectValue placeholder="Select a saved session" />
                      </SelectTrigger>
                      <SelectContent>
                        {clusterSessions.map((session) => (
                          <SelectItem key={session.id} value={session.id}>
                            {session.clusterName ? `${session.clusterName} · ` : ''}Day {session.dayNumber || '—'} · {session.name || 'Session'}{session.date ? ` · ${session.date}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {clusterSessions.length === 0 && <p className="mt-2 text-xs text-amber-800">No saved session schedules are available in this academic year and cluster. Schedule the session first.</p>}
                  </div>
                )}
                {isContextLoading ? (
                  <div className="rounded-xl bg-white/80 p-4 text-xs text-slate-600 dark:bg-slate-900/70">Loading linked academic, location, lesson-plan and attendance data…</div>
                ) : sessionContext ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ['Academic Year', `${sessionContext.academicYear.name}${sessionContext.academicYear.status ? ` (${sessionContext.academicYear.status})` : ''}`],
                      ['Cluster', sessionContext.cluster.name],
                      ['Team / College', sessionContext.collegeName || 'Not configured for this cluster'],
                      ['Panchayat', sessionContext.panchayat?.name || 'Not assigned to this session'],
                      ['Villages mapped to Panchayat', sessionContext.villages.length ? sessionContext.villages.map((village) => village.name).join(', ') : 'No villages mapped'],
                      ['Summit Number', sessionContext.summitNumbers.length ? sessionContext.summitNumbers.join(', ') : 'Not configured in ERP'],
                      ['Session / Day', sessionContext.session.dayNumber ? `Day ${sessionContext.session.dayNumber} · ${sessionContext.session.name}` : 'Not linked to a session-plan day'],
                      ['Session Date', sessionContext.session.date || 'No scheduled date'],
                      ['Grade', sessionContext.grades.length ? sessionContext.grades.join(', ') : 'No grade configured for this session'],
                      ['Volunteers', sessionContext.volunteers.length ? sessionContext.volunteers.map((volunteer) => volunteer.name).join(', ') : 'No volunteer assignment found'],
                      ['Attending Students', sessionContext.attendance.available ? `${sessionContext.attendance.presentCount} present of ${sessionContext.attendance.totalCount}` : 'Attendance not recorded'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-blue-100 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500"><Lock className="h-3 w-3" />{label}</span>
                        <span className="mt-1 block break-words text-xs font-semibold text-slate-900 dark:text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                ) : <div className="rounded-xl bg-white/80 p-3 text-xs text-slate-500 dark:bg-slate-900/70">Choose a saved session to load its ERP context.</div>}
              </section>

              <section className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Report content</h4>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Write observations from the session. Do not re-enter the linked master data above.</p>
                </div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  AN OVERVIEW *
                  <textarea value={formData.sessionSummary || ''} onChange={(event) => setFormData((current) => ({ ...current, sessionSummary: event.target.value }))} rows={4} required className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#1717B8] dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Write an overview of the session, student engagement and major learning activities…" />
                </label>

                <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <div><h5 className="text-xs font-bold text-slate-800 dark:text-white">DETAILED SUMMARY</h5><p className="mt-1 text-[11px] text-slate-500">Existing lesson-plan topics are shown when available.</p></div>
                    <button type="button" onClick={() => setReportActivities((items) => [...items, { topic: '', details: '' }])} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-[#1717B8] dark:border-slate-700"><Plus className="h-3.5 w-3.5" />Add Activity</button>
                  </div>
                  {reportActivities.map((activity, index) => (
                    <div key={`${activity.lessonPlanId || 'activity'}-${index}`} className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Activity {index + 1} · Topic
                        <input value={activity.topic} readOnly={Boolean(activity.lessonPlanId)} onChange={(event) => setReportActivities((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, topic: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs read-only:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:read-only:bg-slate-800" placeholder="Enter activity/topic" />
                      </label>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Detailed Summary
                        <textarea value={activity.details} onChange={(event) => setReportActivities((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, details: event.target.value } : item))} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" placeholder="Describe what was actually conducted…" />
                      </label>
                      {reportActivities.length > 1 && <button type="button" onClick={() => setReportActivities((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="text-[11px] font-semibold text-rose-600">Remove activity</button>}
                    </div>
                  ))}
                </div>

                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">OUTCOME
                  <textarea value={formData.outcome || ''} onChange={(event) => setFormData((current) => ({ ...current, outcome: event.target.value }))} rows={3} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-800" placeholder="Enter the learning outcomes actually observed…" />
                </label>
                <label className="block text-xs font-semibold text-amber-700 dark:text-amber-400"><span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" />ISSUES / CHALLENGES</span>
                  <textarea value={formData.issues || ''} onChange={(event) => setFormData((current) => ({ ...current, issues: event.target.value }))} rows={2} className="mt-1.5 w-full rounded-xl border border-amber-200 bg-amber-50/40 px-3.5 py-2.5 text-xs dark:border-amber-900/60 dark:bg-amber-950/20" placeholder="Optional: record issues not already captured in ERP…" />
                </label>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">GENERAL REMARKS (OPTIONAL)
                  <textarea value={formData.remarks || ''} onChange={(event) => setFormData((current) => ({ ...current, remarks: event.target.value }))} rows={2} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-800" placeholder="Additional remarks, if required…" />
                </label>

                <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2"><div><h5 className="text-xs font-bold text-slate-800 dark:text-white">SESSION PHOTOS</h5><p className="mt-1 text-[11px] text-slate-500">Photos are stored against this report.</p></div><label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#1717B8] px-3 py-2 text-xs font-semibold text-white"><Upload className="h-3.5 w-3.5" />Upload Photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => { setPhotoFiles((items) => [...items, ...Array.from(event.target.files || [])]); event.target.value = ''; }} /></label></div>
                  {(formData.photos?.length || photoFiles.length) ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {(formData.photos || []).map((photo) => <div key={photo.id} className="relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"><div className="aspect-square"><ProtectedReportPhoto photo={photo} authToken={authToken} /></div><button type="button" onClick={() => void removeExistingPhoto(photo)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-rose-600 shadow" title="Remove photo"><X className="h-3.5 w-3.5" /></button><p className="truncate px-2 py-1 text-[10px] text-slate-500">{photo.originalFilename}</p></div>)}
                    {photoFiles.map((file, index) => <div key={`${file.name}-${index}`} className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"><div className="aspect-square"><img src={localPhotoUrls[index]} alt={file.name} className="h-full w-full object-cover" /></div><div className="flex items-center justify-between gap-1 px-2 py-1"><span className="truncate text-[10px] text-slate-500">{file.name}</span><button type="button" onClick={() => setPhotoFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="text-rose-600" title="Remove selected photo"><X className="h-3 w-3" /></button></div></div>)}
                  </div> : <p className="text-xs text-slate-500">No photos selected.</p>}
                </div>
              </section>
              {reportError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{reportError}</p>}
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
                disabled={isSubmitting || isContextLoading || !formData.sessionId || !sessionContext}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave('SUBMITTED')}
                disabled={isSubmitting || isContextLoading || !formData.sessionId || !sessionContext || !formData.sessionSummary?.trim()}
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
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/50 sm:grid-cols-3">
                {[
                  ['Academic Year', viewContext?.academicYear.name || academicYears.find((year) => year.id === selectedAcademicYearId)?.name || 'Not available'],
                  ['Cluster', viewContext?.cluster.name || selectedReport.clusterName || 'Not available'],
                  ['Team / College', viewContext?.collegeName || 'Not configured in ERP'],
                  ['Panchayat', viewContext?.panchayat?.name || 'Not assigned'],
                  ['Villages', viewContext?.villages.map((village) => village.name).join(', ') || 'No villages mapped'],
                  ['Summit Number', viewContext?.summitNumbers.join(', ') || 'Not configured in ERP'],
                  ['Session / Day', viewContext?.session.dayNumber ? `Day ${viewContext.session.dayNumber} · ${viewContext.session.name}` : 'Not linked to a session-plan day'],
                  ['Date', viewContext?.session.date || 'No scheduled date'],
                  ['Grade', viewContext?.grades.join(', ') || 'Not configured for this session'],
                  ['Volunteers', viewContext?.volunteers.map((volunteer) => volunteer.name).join(', ') || 'No assignment found'],
                  ['Attending Students', selectedReport.studentCount == null ? 'Attendance not recorded' : `${selectedReport.studentCount} present`],
                ].map(([label, value]) => <div key={label}><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span><span className="mt-0.5 block break-words font-semibold text-slate-900 dark:text-white">{viewContextLoading ? 'Loading…' : value}</span></div>)}
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
                    {parseActivities(selectedReport.activities).map((activity, index) => (
                      <div key={`${activity.lessonPlanId || 'activity'}-${index}`} className="mb-3 last:mb-0">
                        {activity.topic && <strong className="mb-1 block">{activity.topic}</strong>}
                        <span>{activity.details || 'No detailed activity notes.'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedReport.outcome && <div><h4 className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">Outcome</h4><div className="whitespace-pre-wrap rounded-xl border border-slate-200/70 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200">{selectedReport.outcome}</div></div>}

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

              {Boolean(selectedReport.photos?.length) && <div><h4 className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">Session Photos</h4><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{selectedReport.photos?.map((photo) => <div key={photo.id} className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"><div className="aspect-square"><ProtectedReportPhoto photo={photo} authToken={authToken} /></div><p className="truncate px-2 py-1 text-[10px] text-slate-500">{photo.originalFilename}</p></div>)}</div></div>}
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
