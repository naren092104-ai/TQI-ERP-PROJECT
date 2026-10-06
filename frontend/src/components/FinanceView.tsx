import React, { useState, useMemo, useEffect } from 'react';
import { TabType, FinanceEntry, Panchayat, FinanceDraft, Session, UserRole, Cluster } from '../types';
import { NewFinanceModal } from './NewFinanceModal';
import Badge from './ui/badge';
import {
  Car,
  Utensils,
  FileText,
  Receipt,
  Sparkles,
  Plus,
  Search,
  CheckCircle2,
  X,
  Edit3,
  Trash2,
  Eye,
  ArrowRight,
  Calendar,
  AlertTriangle,
} from './ui/icons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Table, TableHeader, TableBody, TableRow, TableCell } from './ui/table';
import { apiUrl } from '../utils/api';

interface FinanceClusterOption {
  id: string;
  name: string;
  district?: string;
}

interface FinanceViewProps {
  financeEntries: FinanceEntry[];
  panchayats: Panchayat[];
  clusters?: Cluster[];
  authToken?: string;
  selectedAcademicYearId?: string;
  sessions?: Session[];
  drafts?: FinanceDraft[];
  userRole?: UserRole;
  onNavigate: (tab: TabType, targetId?: string) => void;
  onAddFinanceEntry: (entry: Omit<FinanceEntry, 'id'>) => void | Promise<void>;
  onUpdateFinanceEntry: (id: string, updated: Partial<FinanceEntry>) => void;
  onDeleteFinanceEntry: (id: string) => void;
  onSaveDraft?: (draft: FinanceDraft) => void | Promise<void>;
  onDeleteDraft?: (draftId: string) => void | Promise<void>;
  onSubmitDraft?: (draftId: string, missingBillReason?: string) => void | Promise<void>;
  onRequestFinanceEdit?: (entryId: string, reason: string) => void | Promise<void>;
  isOpenNewModal?: boolean;
  onCloseNewModal?: () => void;
  clusterName?: string;
  clusterId?: string;
  initialSelectedClusterId?: string;
  collegeName?: string;
  spocName?: string;
  financerName?: string;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  financeEntries: allFinanceEntries,
  panchayats: allPanchayats,
  clusters = [],
  authToken = '',
  selectedAcademicYearId = '',
  sessions: allSessions = [],
  drafts: allDrafts = [],
  userRole = 'Cluster Admin',
  onNavigate,
  onAddFinanceEntry,
  onUpdateFinanceEntry,
  onDeleteFinanceEntry,
  onSaveDraft,
  onDeleteDraft,
  onSubmitDraft,
  onRequestFinanceEdit,
  isOpenNewModal = false,
  onCloseNewModal,
  clusterName = 'Cluster',
  clusterId = '',
  initialSelectedClusterId,
  collegeName = 'Partner College / Institution',
  spocName = '',
  financerName = 'TQI Finance Team',
}) => {
  // Main view toggle: 'days' (card-based 8-day layout) vs 'entries' (detailed list/table)
  const [viewMode, setViewMode] = useState<'days' | 'entries'>('days');
  const [loadedClusters, setLoadedClusters] = useState<Cluster[]>([]);
  const [selectedFinanceClusterId, setSelectedFinanceClusterId] = useState<string | null>(
    initialSelectedClusterId || (clusterId !== 'all' ? clusterId : null)
  );
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'drafts' | 'approved' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPanchayat, setSelectedPanchayat] = useState('');
  const [showModal, setShowModal] = useState(isOpenNewModal);
  const [financeModalKey, setFinanceModalKey] = useState(0);
  const [selectedFinanceDay, setSelectedFinanceDay] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<FinanceDraft | null>(null);
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<FinanceEntry | null>(null);
  const [receiptZoom, setReceiptZoom] = useState<number>(1);
  const [receiptRotate, setReceiptRotate] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const isSuperAdmin = userRole === 'Super Admin';
  const canManageFinanceEntries = !isSuperAdmin;
  useEffect(() => {
    if (!isSuperAdmin || !authToken) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ includeArchived: 'true' });
    if (selectedAcademicYearId) params.set('academicYearId', selectedAcademicYearId);
    const loadClusters = async () => {
      const requestClusters = async (query: URLSearchParams) => {
        const response = await fetch(apiUrl(`/api/clusters?${query.toString()}`), {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'x-user-role': userRole,
            'x-user-cluster-id': clusterId,
          },
          signal: controller.signal,
        });
        return response.ok ? response.json() : null;
      };

      try {
        let data = await requestClusters(params);
        if (!Array.isArray(data?.clusters) || data.clusters.length === 0) {
          const allYearsParams = new URLSearchParams({ includeArchived: 'true', allYears: 'true' });
          data = await requestClusters(allYearsParams);
        }
        if (!controller.signal.aborted && Array.isArray(data?.clusters)) setLoadedClusters(data.clusters);
      } catch {
        // Keep the finance overview usable from cluster IDs in loaded operational data.
      }
    };
    void loadClusters();

    return () => controller.abort();
  }, [isSuperAdmin, authToken, selectedAcademicYearId, userRole, clusterId]);

  const financeClusters = useMemo<FinanceClusterOption[]>(() => {
    const clusterMap = new Map<string, FinanceClusterOption>();
    [...clusters, ...loadedClusters].forEach((cluster) => {
      if (cluster?.id) clusterMap.set(cluster.id, { id: cluster.id, name: cluster.name || cluster.id, district: cluster.district });
    });
    const addFallbackCluster = (id?: string, name?: string) => {
      if (!id || id === 'all' || clusterMap.has(id)) return;
      clusterMap.set(id, { id, name: name || id });
    };
    allPanchayats.forEach((item) => addFallbackCluster(item.clusterId, item.cluster));
    allFinanceEntries.forEach((item) => addFallbackCluster(item.clusterId, item.clusterName));
    allDrafts.forEach((item) => addFallbackCluster(item.clusterId, item.clusterName));
    allSessions.forEach((item) => addFallbackCluster(item.clusterId, item.clusterName));
    return Array.from(clusterMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [clusters, loadedClusters, allPanchayats, allFinanceEntries, allDrafts, allSessions]);

  const selectedFinanceCluster = financeClusters.find((cluster) => cluster.id === selectedFinanceClusterId);
  const isClusterOverview = isSuperAdmin && clusterId === 'all' && !selectedFinanceCluster;
  const financeClusterId = selectedFinanceCluster?.id || clusterId;
  const financeClusterName = selectedFinanceCluster?.name || clusterName;
  const financeEntries = useMemo(() => selectedFinanceCluster
    ? allFinanceEntries.filter((entry) => entry.clusterId === selectedFinanceCluster.id || entry.clusterName === selectedFinanceCluster.name)
    : allFinanceEntries, [allFinanceEntries, selectedFinanceCluster]);
  const drafts = useMemo(() => selectedFinanceCluster
    ? allDrafts.filter((draft) => draft.clusterId === selectedFinanceCluster.id || draft.clusterName === selectedFinanceCluster.name)
    : allDrafts, [allDrafts, selectedFinanceCluster]);
  const draftEntries = drafts.filter((draft) => draft.status === 'Draft');
  const financeEntryPermissions = (entry: FinanceEntry) => {
    const report = drafts.find((draft) => draft.id === entry.draftId);
    return {
      canEdit: entry.status === 'Draft' || entry.status === 'Correction' || Boolean(report?.editPermission),
      canRequestEdit: ['Pending', 'Approved', 'Correction'].includes(entry.status) && report?.editRequestStatus !== 'PENDING' && !report?.editPermission,
      requestPending: report?.editRequestStatus === 'PENDING',
    };
  };
  const sessions = useMemo(() => selectedFinanceCluster
    ? allSessions.filter((session) => session.clusterId === selectedFinanceCluster.id || session.clusterName === selectedFinanceCluster.name)
    : allSessions, [allSessions, selectedFinanceCluster]);
  const panchayats = useMemo(() => selectedFinanceCluster
    ? allPanchayats.filter((panchayat) => panchayat.clusterId === selectedFinanceCluster.id)
    : allPanchayats, [allPanchayats, selectedFinanceCluster]);

  const navigateToFinanceStatement = (targetId?: string) => {
    const clusterScope = selectedFinanceCluster?.id || (clusterId !== 'all' ? clusterId : '');
    const scopedTarget = clusterScope ? `finance:${clusterScope}:${targetId || 'all-approved'}` : targetId;
    onNavigate('finance-statement', scopedTarget);
  };

  const openClusterStatement = (targetId: string) => navigateToFinanceStatement(targetId);

  // Edit Request Modal State for submitted / approved entries
  const [editRequestEntry, setEditRequestEntry] = useState<FinanceEntry | null>(null);
  const [editRequestReason, setEditRequestReason] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const totalAdvance = 45000;

  const totalExpenses = useMemo(() => {
    return financeEntries
      .filter((e) => e.status === 'Approved')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [financeEntries]);

  const totalPending = useMemo(() => {
    return financeEntries
      .filter((e) => e.status === 'Pending' || e.status === 'Correction')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [financeEntries]);

  const totalDraftsAmount = useMemo(() => {
    const fromEntries = financeEntries
      .filter((e) => e.status === 'Draft')
      .reduce((sum, e) => sum + e.amount, 0);
    const fromDrafts = drafts.reduce((sum, d) => sum + d.totalAmount, 0);
    return Math.max(fromEntries, fromDrafts);
  }, [financeEntries, drafts]);

  const balance = totalAdvance - totalExpenses;

  const clusterSummaries = useMemo(() => financeClusters
    .map((cluster) => {
      const clusterEntries = allFinanceEntries.filter((entry) =>
        entry.clusterId === cluster.id || entry.clusterName === cluster.name
      );
      const clusterDrafts = allDrafts.filter((draft) =>
        draft.clusterId === cluster.id || draft.clusterName === cluster.name
      );
      const submittedDayNumbers = new Set<number>();
      clusterEntries.filter((entry) => entry.status !== 'Draft').forEach((entry) => {
        const dayNumber = Number((entry.sessionDay || '').match(/\d+/)?.[0] || 0);
        if (dayNumber > 0) submittedDayNumbers.add(dayNumber);
      });
      clusterDrafts.filter((draft) => draft.status !== 'Draft').forEach((draft) => {
        const dayNumber = Number((draft.sessionDay || '').match(/\d+/)?.[0] || 0);
        if (dayNumber > 0) submittedDayNumbers.add(dayNumber);
      });
      return {
        ...cluster,
        submittedDays: submittedDayNumbers.size,
        submittedAmount: clusterEntries
          .filter((entry) => entry.status !== 'Draft')
          .reduce((sum, entry) => sum + (entry.amount || 0), 0),
      };
    }), [financeClusters, allFinanceEntries, allDrafts]);

  // Day-wise grouping (Day 1 through Day 8) with auto-mapped session dates
  const dayCards = useMemo(() => {
    const dayNumbers = [1, 2, 3, 4, 5, 6, 7, 8];

    return dayNumbers.map((dayNum) => {
      // Find matching scheduled session
      const matchedSession = sessions.find(
        (s) => s.dayNumber === dayNum || s.day?.toLowerCase().includes(`day ${dayNum}`) || s.day?.includes(String(dayNum))
      );

      // Filter entries belonging to this day
      const dayEntries = financeEntries.filter((e) => {
        if (e.sessionId && matchedSession && e.sessionId === matchedSession.id) return true;
        const entryDayNumber = Number((e.sessionDay || '').match(/\d+/)?.[0] || 0);
        if (entryDayNumber === dayNum) return true;
        if (matchedSession?.date && e.date === matchedSession.date) return true;
        return false;
      });
      const draftIds = new Set(dayEntries.map((entry) => entry.draftId).filter(Boolean));
      const dayDraft = drafts.find((draft) => draftIds.has(draft.id))
        || drafts.find((draft) => {
          const draftDay = Number(draft.sessionDay.match(/\d+/)?.[0] || 0);
          return draftDay === dayNum
            && (!financeClusterId || financeClusterId === 'all' || draft.clusterId === financeClusterId);
        })
        || null;

      const entryTotal = dayEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
      const dayTotal = entryTotal || dayDraft?.totalAmount || 0;
      const billsCount = dayEntries.filter((e) => Boolean(e.billUrl)).length;

      // Determine day status
      let status: 'Approved' | 'Pending' | 'Draft' | 'Empty' = 'Empty';
      const hasAnySubmission = Boolean(dayDraft) || dayEntries.length > 0;

      if (hasAnySubmission) {
        if (dayDraft?.status === 'Approved' || dayEntries.every((e) => e.status === 'Approved')) {
          status = 'Approved';
        } else if (dayDraft?.status === 'Draft' || dayEntries.some((e) => e.status === 'Draft')) {
          status = 'Draft';
        } else if (
          dayDraft?.status === 'Pending' ||
          dayDraft?.status === 'Correction Requested' ||
          dayEntries.some((e) => e.status === 'Pending' || e.status === 'Correction')
        ) {
          status = 'Pending';
        } else {
          status = 'Pending';
        }
      }

      return {
        dayNumber: dayNum,
        dayLabel: `Day ${String(dayNum).padStart(2, '0')}`,
        sessionName: dayDraft?.title || matchedSession?.name || `Day ${dayNum} Holistic Session`,
        date: dayDraft?.sessionDate || matchedSession?.date?.slice(0, 10) || 'Scheduled Date TBD',
        entries: dayEntries,
        draft: dayDraft,
        draftId: dayDraft?.id || draftIds.values().next().value || null,
        dayTotal,
        billsCount,
        status,
      };
    });
  }, [sessions, financeEntries, drafts, financeClusterId]);

  // Filtered entries for table and mobile cards
  const filteredEntries = useMemo(() => {
    return financeEntries.filter((e) => {
      const matchSearch =
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.remarks && e.remarks.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCategory = !selectedCategory || e.category === selectedCategory;
      const matchPanchayat =
        !selectedPanchayat ||
        e.panchayatId === selectedPanchayat ||
        e.panchayatName.toLowerCase().includes(selectedPanchayat.toLowerCase());

      let matchStatus = true;
      if (activeTabFilter === 'drafts') {
        matchStatus = e.status === 'Draft';
      } else if (activeTabFilter === 'approved') {
        matchStatus = e.status === 'Approved';
      } else if (activeTabFilter === 'pending') {
        matchStatus = e.status === 'Pending' || e.status === 'Correction';
      }

      return matchSearch && matchCategory && matchPanchayat && matchStatus;
    });
  }, [financeEntries, searchTerm, selectedCategory, selectedPanchayat, activeTabFilter]);

  const handleEditDraft = (draft: FinanceDraft) => {
    setEditingDraft(draft);
    setShowModal(true);
  };

  const handleSubmitDraftPackage = async (draftId: string, missingBillReason?: string) => {
    const draft = drafts.find((item) => item.id === draftId);
    const draftEntries = financeEntries.filter((entry) => entry.draftId === draftId);
    const plannedDate = draft?.sessionDate || draftEntries.find((entry) => entry.date)?.date;
    if (!plannedDate) {
      alert('Please edit this draft and select a planned date before submitting.');
      return;
    }
    const missingBills = draftEntries.filter((entry) => !entry.billUrl && !entry.billReference);
    if (missingBills.length > 0 && !missingBillReason) {
      const reason = window.prompt(
        `Bills are required for this submission. Please explain why the missing bill(s) are being submitted for review: ${missingBills.slice(0, 2).map((entry) => entry.description || 'Expense').join(', ')}${missingBills.length > 2 ? ' and more' : ''}`,
        'Missing bills for this report; awaiting approval.'
      );
      if (!reason || !reason.trim()) {
        alert('A reason is required for missing bills before this report can be submitted.');
        return;
      }
      missingBillReason = reason.trim();
    }
    if (onSubmitDraft) {
      await onSubmitDraft(draftId, missingBillReason);
    } else {
      financeEntries.forEach((entry) => {
        if (entry.draftId === draftId) onUpdateFinanceEntry(entry.id, { status: 'Pending' });
      });
    }
    showToast('Draft submitted for approval successfully!');
  };

  const handleDeleteDraftPackage = async (draftId: string) => {
    if (confirm('Are you sure you want to delete this formatted draft session?')) {
      if (onDeleteDraft) {
        try {
          await onDeleteDraft(draftId);
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Unable to delete this finance draft.');
          return;
        }
      } else {
        for (const entry of financeEntries.filter((item) => item.draftId === draftId)) await onDeleteFinanceEntry(entry.id);
      }
      showToast('Draft removed.');
    }
  };

  const handleRaiseEditRequest = async () => {
    if (!editRequestEntry) return;
    if (!editRequestReason.trim()) {
      alert('Please provide a reason or justification for requesting an edit.');
      return;
    }

    try {
      if (onRequestFinanceEdit) {
        await onRequestFinanceEdit(editRequestEntry.id, editRequestReason.trim());
      } else {
        onUpdateFinanceEntry(editRequestEntry.id, {
          status: 'Pending',
          remarks: `${editRequestEntry.remarks || ''} [Edit Request: ${editRequestReason.trim()}]`.trim(),
        });
      }
      showToast('Edit request submitted to Admin for unlock/review.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit the edit request.';
      alert(message);
      return;
    }

    setEditRequestEntry(null);
    setEditRequestReason('');
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Approved') return <Badge color="success" size="sm">Approved</Badge>;
    if (status === 'Draft') return <Badge color="warning" size="sm">Draft</Badge>;
    if (status === 'Correction') return <Badge color="error" size="sm">Correction</Badge>;
    return <Badge color="primary" size="sm">{status}</Badge>;
  };

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-[200] rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-semibold text-white shadow-theme-lg dark:bg-white dark:text-gray-900 flex items-center gap-2 animate-in fade-in-0 slide-in-from-bottom-5">
          <CheckCircle2 className="h-4 w-4 text-success-500 shrink-0" />
          <span>{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage(null)} className="ml-1 text-gray-400 hover:text-white dark:hover:text-gray-900">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* 1. Page Header with Excel & PDF Export options */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Finance &amp; Expenses
            </h1>
            <Badge color="primary" size="sm">
              {isClusterOverview ? 'All Clusters' : financeClusterName}
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Day-wise expense scheduling, group splitting ({collegeName}), verified bill scanner, and statement export.
          </p>
        </div>

        {!isClusterOverview && <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Day Cards view */}
          <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setViewMode('days')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'days'
                  ? 'bg-white text-gray-900 dark:bg-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Day Cards
            </button>
          </div>

          {canManageFinanceEntries && (
            <button
              type="button"
              onClick={() => {
                const defaultDay = `Day ${sessions[0]?.dayNumber || 1}`;
                const editableDraft = drafts.find((draft) => draft.status === 'Draft' && draft.sessionDay === defaultDay);
                setFinanceModalKey((prev) => prev + 1);
                setEditingDraft(editableDraft || null);
                setSelectedFinanceDay(defaultDay);
                setShowModal(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add / Scan Bill</span>
            </button>
          )}
        </div>}
      </div>

      {/* 2. Metric Cards */}
      {!isClusterOverview && <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Advance</div>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold font-mono text-gray-900 dark:text-white">₹{totalAdvance.toLocaleString()}</div>
          <p className="mt-0.5 text-[11px] text-gray-400 truncate">Disbursed by State HQ</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-success-500">Expenses Approved</div>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold font-mono text-success-600 dark:text-success-400">₹{totalExpenses.toLocaleString()}</div>
          <p className="mt-0.5 text-[11px] text-success-500/80 truncate">Verified with bills</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">Remaining Balance</div>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold font-mono text-brand-500">₹{balance.toLocaleString()}</div>
          <p className="mt-0.5 text-[11px] text-brand-500/80 truncate">Cluster available fund</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-warning-500">Saved Drafts</div>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold font-mono text-warning-600 dark:text-warning-400">₹{totalDraftsAmount.toLocaleString()}</div>
          <p className="mt-0.5 text-[11px] text-warning-500/80 truncate">{draftEntries.length} formatted drafts</p>
        </div>
      </div>}

      {/* 3. VIEW MODE A: DAY-WISE CARD LAYOUT (Day 1 - Day 8) */}
      {isClusterOverview ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Finance by Cluster</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Select a cluster to view its eight session days and submission status.</p>
          </div>
          {clusterSummaries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
              No clusters are available to display.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {clusterSummaries.map((cluster) => (
                <button
                  key={cluster.id}
                  type="button"
                  onClick={() => {
                    setSelectedFinanceClusterId(cluster.id);
                    setViewMode('days');
                  }}
                  className="group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-theme-xs transition hover:border-brand-500/50 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.02]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">{cluster.name}</h3>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{cluster.district || 'District not set'}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-brand-500 transition-transform group-hover:translate-x-1" />
                  </div>
                  <div className="mt-4 flex items-end justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Submitted days</div>
                      <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{cluster.submittedDays}<span className="text-xs font-medium text-gray-400"> / 8</span></div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Submitted expenses</div>
                      <div className="mt-1 text-sm font-bold font-mono text-brand-600 dark:text-brand-400">₹{cluster.submittedAmount.toLocaleString()}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : viewMode === 'days' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {isSuperAdmin && clusterId === 'all' && selectedFinanceCluster && (
                  <button type="button" onClick={() => setSelectedFinanceClusterId(null)} className="mr-1 rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">All Clusters</button>
                )}
                <span>Day-Wise Expense &amp; Group Split Cards</span>
                <span className="text-xs font-normal text-gray-500">
                  ({collegeName} &bull; {financeClusterName})
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Scheduled session days are auto-mapped. Group expenditures are calculated and split per person.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {dayCards.map((day) => (
              <div
                key={day.dayNumber}
                role="button"
                tabIndex={0}
                onClick={() => openClusterStatement(day.draft?.id || day.draftId || `Day ${day.dayNumber}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openClusterStatement(day.draft?.id || day.draftId || `Day ${day.dayNumber}`);
                  }
                }}
                className="group relative rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs transition-all hover:border-brand-500/50 hover:shadow-theme-md focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-800 dark:bg-white/[0.02] flex flex-col justify-between cursor-pointer"
              >
                <div>
                  {/* Top Bar: Day Badge + Status + Auto Date */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500/10 px-2.5 py-1 text-xs font-bold text-brand-600 dark:text-brand-400">
                      {day.dayLabel}
                    </span>
                    {day.status === 'Approved' && <Badge color="success" size="sm">Approved</Badge>}
                    {day.status === 'Pending' && <Badge color="primary" size="sm">Submitted</Badge>}
                    {day.status === 'Draft' && (
                      <Badge color="warning" size="sm">Draft</Badge>
                    )}
                    {day.status === 'Empty' && (
                      <span className="text-[10px] text-gray-400 font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                        Not Submitted
                      </span>
                    )}
                  </div>

                  {/* Date Auto-mapped */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-brand-500" />
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{day.date}</span>
                  </div>

                  <h3 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1 mb-2">
                    {day.sessionName}
                  </h3>

                  {/* Expenditure Metric */}
                  <div className="p-3 bg-gray-50 dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-gray-800/80 mb-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Day Total:</span>
                      <span className="text-base font-bold font-mono text-gray-900 dark:text-white">
                        ₹{day.dayTotal.toLocaleString()}
                      </span>
                    </div>

                  </div>

                  {/* Bills count & Entries count pills */}
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 mb-4">
                    <span className="inline-flex items-center gap-1">
                      <Receipt className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{day.billsCount} Bills Scanned</span>
                    </span>
                    <span>&bull;</span>
                    <span>{day.entries.length} Line Items</span>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. VIEW MODE B: DETAILED ENTRIES & DRAFTS */}
      {!isClusterOverview && viewMode === 'entries' && (
        <div className="space-y-4">
          {/* Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => setActiveTabFilter('all')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  activeTabFilter === 'all'
                    ? 'bg-brand-500 text-white shadow-theme-xs'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                All Expenses ({financeEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTabFilter('drafts')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  activeTabFilter === 'drafts'
                    ? 'bg-brand-500 text-white shadow-theme-xs'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                Draft Sheets ({drafts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTabFilter('approved')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  activeTabFilter === 'approved'
                    ? 'bg-brand-500 text-white shadow-theme-xs'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                Approved ({financeEntries.filter((e) => e.status === 'Approved').length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTabFilter('pending')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  activeTabFilter === 'pending'
                    ? 'bg-brand-500 text-white shadow-theme-xs'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                Pending ({financeEntries.filter((e) => e.status === 'Pending' || e.status === 'Correction').length})
              </button>
            </div>
          </div>

          {/* Dedicated Drafts Section */}
          {activeTabFilter === 'drafts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Saved Draft Sheets (Ready for TQI Formatting &amp; Submission)
                </h3>
                {canManageFinanceEntries && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDraft(null);
                      setSelectedFinanceDay(null);
                      setShowModal(true);
                    }}
                    className="rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition cursor-pointer"
                  >
                    + New Draft Session
                  </button>
                )}
              </div>

              {draftEntries.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-xs rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
                  No saved drafts currently.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {draftEntries.map((draft) => (
                    <div
                      key={draft.id}
                      className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02] flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge color="warning" size="sm">
                                {draft.sessionDay} Draft
                              </Badge>
                              <span className="text-[11px] text-gray-400 font-mono">{draft.sessionDate}</span>
                            </div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">{draft.title}</h4>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Cluster: <span className="font-semibold text-gray-700 dark:text-gray-300">{draft.clusterName}</span> &middot; {draft.collegeName}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono text-base font-bold text-brand-500 block">
                              ₹{draft.totalAmount.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-gray-400">Total Amount</span>
                          </div>
                        </div>

                        {/* Breakdown Pills */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
                          {draft.routes && draft.routes.length > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50/50 px-2 py-1 dark:border-gray-800 dark:bg-white/[0.02] font-medium">
                              <Car className="w-3.5 h-3.5 text-brand-500" />
                              <span>{draft.routes.length} Travel Routes</span>
                            </span>
                          )}
                          {draft.food && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50/50 px-2 py-1 dark:border-gray-800 dark:bg-white/[0.02] font-medium">
                              <Utensils className="w-3.5 h-3.5 text-warning-500" />
                              <span>Food Logged</span>
                            </span>
                          )}
                          {draft.stationery && draft.stationery.amount > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50/50 px-2 py-1 dark:border-gray-800 dark:bg-white/[0.02] font-medium">
                              <FileText className="w-3.5 h-3.5 text-success-500" />
                              <span>Stationery (₹{draft.stationery.amount})</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions Bar */}
                      <div className="pt-3.5 mt-3.5 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => navigateToFinanceStatement(draft.id)}
                          className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-100 dark:border-brand-900/40 dark:bg-brand-500/10 dark:text-brand-400 transition cursor-pointer"
                        >
                          Statement Sheet
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditDraft(draft)}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 transition cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSubmitDraftPackage(draft.id)}
                            className="rounded-xl bg-success-500 px-3 py-1.5 text-xs font-semibold text-white shadow-theme-xs hover:bg-success-600 transition cursor-pointer"
                          >
                            Submit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDraftPackage(draft.id)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10 dark:hover:text-error-400 transition cursor-pointer"
                            title="Delete Draft"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search expenses by description, route, or remarks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2 text-xs text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
              <div className="w-full sm:w-40">
                <Select
                  value={selectedCategory || 'all'}
                  onValueChange={(val) => setSelectedCategory(val === 'all' ? '' : val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Travel">Travel</SelectItem>
                    <SelectItem value="Food">Food</SelectItem>
                    <SelectItem value="Materials">Materials / Stationery</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-40">
                <Select
                  value={selectedPanchayat || 'all'}
                  onValueChange={(val) => setSelectedPanchayat(val === 'all' ? '' : val)}
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
            </div>
          </div>

          {/* Mobile Expense Cards */}
          <div className="block md:hidden space-y-3">
            {filteredEntries.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-xs rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
                No expense entries matching current criteria.
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02] space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[11px] font-bold font-mono text-gray-500 dark:text-gray-400">{entry.date}</span>
                        {entry.sessionDay && (
                          <span className="text-[10px] font-semibold bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
                            {entry.sessionDay}
                          </span>
                        )}
                        <Badge color="light" size="sm">{entry.category}</Badge>
                      </div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white leading-snug">{entry.description}</h4>
                      {entry.remarks && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{entry.remarks}</p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-sm font-bold text-brand-500 block">
                        ₹{entry.amount.toLocaleString()}
                      </span>
                      {getStatusBadge(entry.status)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px]">
                    <div className="text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{entry.panchayatName}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {entry.billUrl ? (
                        <button
                          type="button"
                          onClick={() => setViewingReceipt(entry)}
                          className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          <span>Bill</span>
                        </button>
                      ) : (
                        <span className="text-[10.5px] text-error-500 font-semibold px-1.5 py-0.5 bg-error-50 dark:bg-error-500/10 rounded">
                          No Bill
                        </span>
                      )}

                      {canManageFinanceEntries && financeEntryPermissions(entry).requestPending && <span className="rounded bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">Edit Request Pending</span>}
                      {canManageFinanceEntries && financeEntryPermissions(entry).canRequestEdit && (
                        <button type="button" onClick={() => { setEditRequestEntry(entry); setEditRequestReason(''); }} className="p-1 text-amber-500 hover:text-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10 cursor-pointer" title="Request permission to edit the submitted report"><AlertTriangle className="h-4 w-4" /></button>
                      )}
                      {canManageFinanceEntries && financeEntryPermissions(entry).canEdit && (
                        <button type="button" onClick={() => setEditingEntry(entry)} className="p-1 text-gray-500 hover:text-brand-500 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer" title="Edit"><Edit3 className="h-4 w-4" /></button>
                      )}

                      {canManageFinanceEntries && financeEntryPermissions(entry).canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete expense "${entry.description}"?`)) {
                              onDeleteFinanceEntry(entry.id);
                              showToast('Finance entry deleted');
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-error-600 rounded-lg hover:bg-error-50 dark:hover:bg-error-500/10 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader>Date / Session</TableCell>
                  <TableCell isHeader>Category</TableCell>
                  <TableCell isHeader className="w-[300px]">Description &amp; Route</TableCell>
                  <TableCell isHeader>Panchayat</TableCell>
                  <TableCell isHeader>Amount</TableCell>
                  <TableCell isHeader>Bill Attachment</TableCell>
                  <TableCell isHeader>Status</TableCell>
                  <TableCell isHeader className="text-right">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-gray-400">
                      No expense entries matching current criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors">
                      <TableCell className="whitespace-nowrap">
                        <span className="font-bold text-gray-900 dark:text-white block text-xs">{entry.date}</span>
                        {entry.sessionDay && (
                          <span className="text-[10px] text-gray-400">
                            {entry.sessionDay}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge color="light" size="sm">
                          {entry.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-gray-900 dark:text-white block text-xs">{entry.description}</span>
                        {entry.remarks && (
                          <span className="text-[11px] text-gray-400 block">{entry.remarks}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300 text-xs">
                        <span className="font-semibold">{entry.panchayatName}</span>
                        <span className="block text-[11px] text-gray-400">{entry.villageName}</span>
                      </TableCell>
                      <TableCell className="font-bold font-mono text-gray-900 dark:text-white text-xs whitespace-nowrap">
                        ₹{entry.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {entry.billUrl ? (
                          <button
                            type="button"
                            onClick={() => setViewingReceipt(entry)}
                            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            View Bill
                          </button>
                        ) : (
                          <span className="text-xs text-error-500 font-semibold flex items-center gap-1">
                            Missing
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(entry.status)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex justify-end items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              navigateToFinanceStatement(entry.draftId || entry.sessionDay || 'all-approved')
                            }
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-white/5 dark:hover:text-brand-400 transition cursor-pointer"
                            title="View Statement Sheet"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {canManageFinanceEntries && financeEntryPermissions(entry).requestPending && <span className="rounded bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">Edit Request Pending</span>}
                          {canManageFinanceEntries && financeEntryPermissions(entry).canRequestEdit && (
                            <button type="button" onClick={() => { setEditRequestEntry(entry); setEditRequestReason(''); }} className="rounded-lg p-1.5 text-amber-500 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 transition cursor-pointer" title="Request permission to edit the submitted report"><AlertTriangle className="h-4 w-4" /></button>
                          )}
                          {canManageFinanceEntries && financeEntryPermissions(entry).canEdit && (
                            <button type="button" onClick={() => setEditingEntry(entry)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-white/5 dark:hover:text-brand-400 transition cursor-pointer" title="Edit Entry"><Edit3 className="h-4 w-4" /></button>
                          )}


                          {canManageFinanceEntries && financeEntryPermissions(entry).canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete finance entry "${entry.description}"?`)) {
                                  onDeleteFinanceEntry(entry.id);
                                  showToast('Finance entry deleted');
                                }
                              }}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10 dark:hover:text-error-400 transition cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Bill / Receipt Lightbox Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-4 animate-in fade-in-0">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-theme-xl max-w-lg w-full overflow-hidden border border-gray-200 dark:border-gray-800 animate-in zoom-in-95">
            <div className="p-4 bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">{viewingReceipt.description}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {viewingReceipt.category} • ₹{viewingReceipt.amount}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setReceiptRotate((r) => (r + 90) % 360)}
                  className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition"
                  title="Rotate Image 90°"
                >
                  <span className="material-symbols-outlined text-[18px]">rotate_right</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptZoom((z) => Math.min(z + 0.25, 2.5))}
                  className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition"
                  title="Zoom In"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptZoom((z) => Math.max(z - 0.25, 0.5))}
                  className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition"
                  title="Zoom Out"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewingReceipt(null);
                    setReceiptZoom(1);
                    setReceiptRotate(0);
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg cursor-pointer ml-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-4 bg-gray-950 flex justify-center overflow-hidden min-h-[300px] items-center">
              <div
                style={{
                  transform: `scale(${receiptZoom}) rotate(${receiptRotate}deg)`,
                  transition: 'transform 0.2s ease-out',
                }}
              >
                <img
                  src={viewingReceipt.billUrl}
                  alt="Receipt"
                  className="max-h-[55vh] object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                {viewingReceipt.remarks || 'Receipt document attached'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setViewingReceipt(null);
                  setReceiptZoom(1);
                  setReceiptRotate(0);
                }}
                className="px-4 py-2 bg-brand-500 text-white font-semibold text-xs rounded-xl shadow-theme-xs hover:bg-brand-600 transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Request Modal (For Approved or Locked Bills) */}
      {editRequestEntry && (
        <div className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-4 animate-in fade-in-0">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full overflow-hidden shadow-theme-xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Raise Edit / Re-upload Request</span>
              </h3>
              <button
                onClick={() => setEditRequestEntry(null)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
              This entry is currently <span className="font-bold">Approved</span>. State Admin policy requires an edit request with a justification reason to revise bill amounts or re-upload scanned receipts.
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Item Description
                </label>
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200 font-semibold">
                  {editRequestEntry.description} (₹{editRequestEntry.amount})
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Reason for Revision / Re-upload <span className="text-error-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={editRequestReason}
                  onChange={(e) => setEditRequestReason(e.target.value)}
                  placeholder="E.g. Clearer scanner image replacement, corrected count calculation or fare amount..."
                  className="w-full p-2.5 bg-transparent border border-gray-300 rounded-xl text-xs text-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setEditRequestEntry(null)}
                className="px-4 py-2 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-semibold dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRaiseEditRequest}
                className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 transition cursor-pointer shadow-theme-xs"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Single Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-4 animate-in fade-in-0">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full overflow-hidden shadow-theme-xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Edit3 className="h-4 w-4 text-brand-500" />
                <span>Edit Finance Entry</span>
              </h3>
              <button
                onClick={() => setEditingEntry(null)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {sessions?.find(s => s.id === editingEntry.sessionId)?.status === 'Submitted' || sessions?.find(s => s.id === editingEntry.sessionId)?.status === 'Approved' ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle2 className="w-5 h-5 text-success-500" />
                <span>This finance entry belongs to a submitted session and cannot be edited.</span>
              </div>
            ) : null}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Description / Route</label>
                <input
                  type="text"
                  value={editingEntry.description}
                  onChange={(e) => setEditingEntry({ ...editingEntry, description: e.target.value })}
                  disabled={sessions?.find(s => s.id === editingEntry.sessionId)?.status === 'Submitted' || sessions?.find(s => s.id === editingEntry.sessionId)?.status === 'Approved'}
                  className="w-full h-9 px-3 bg-transparent border border-gray-300 rounded-xl text-xs text-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Session / Day</label>
                  <Select
                    value={editingEntry.sessionId || "none"}
                    onValueChange={(val: any) => setEditingEntry({ ...editingEntry, sessionId: val === "none" ? undefined : val })}
                    disabled={sessions?.find(s => s.id === editingEntry.sessionId)?.status === 'Submitted' || sessions?.find(s => s.id === editingEntry.sessionId)?.status === 'Approved'}
                  >
                    <SelectTrigger className="h-9 text-xs disabled:opacity-50">
                      <SelectValue placeholder="Select Session" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Session</SelectItem>
                      {sessions?.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          Day {s.dayNumber} ({s.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Category</label>
                  <Select
                    value={editingEntry.category}
                    onValueChange={(val: any) => setEditingEntry({ ...editingEntry, category: val })}
                    disabled={sessions?.find(s => s.id === editingEntry.sessionId)?.status === 'Submitted' || sessions?.find(s => s.id === editingEntry.sessionId)?.status === 'Approved'}
                  >
                    <SelectTrigger className="h-9 text-xs disabled:opacity-50">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Travel">Travel</SelectItem>
                      <SelectItem value="Food">Food</SelectItem>
                      <SelectItem value="Materials">Materials</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingEntry.amount}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                    disabled={sessions?.find(s => s.id === editingEntry.sessionId)?.status === 'Submitted' || sessions?.find(s => s.id === editingEntry.sessionId)?.status === 'Approved'}
                    className="w-full h-9 px-3 bg-transparent border border-gray-300 rounded-xl text-xs font-bold text-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Remarks</label>
                  <input
                    type="text"
                    value={editingEntry.remarks || ''}
                    onChange={(e) => setEditingEntry({ ...editingEntry, remarks: e.target.value })}
                    disabled={sessions?.find(s => s.id === editingEntry.sessionId)?.status === 'Submitted' || sessions?.find(s => s.id === editingEntry.sessionId)?.status === 'Approved'}
                    className="w-full h-9 px-3 bg-transparent border border-gray-300 rounded-xl text-xs text-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setEditingEntry(null)}
                className="px-4 py-2 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-semibold dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 transition cursor-pointer shadow-theme-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onUpdateFinanceEntry(editingEntry.id, {
                    description: editingEntry.description,
                    category: editingEntry.category,
                    amount: editingEntry.amount,
                    remarks: editingEntry.remarks,
                    sessionId: editingEntry.sessionId,
                  });
                  setEditingEntry(null);
                  showToast('Finance entry updated');
                }}
                disabled={sessions?.find(s => s.id === editingEntry.sessionId)?.status === 'Submitted' || sessions?.find(s => s.id === editingEntry.sessionId)?.status === 'Approved'}
                className="px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600 transition cursor-pointer shadow-theme-xs disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New / Edit Finance Entry Modal */}
      {showModal && (
        <NewFinanceModal
          key={financeModalKey}
          isOpen={showModal}
          defaultSessionDay={selectedFinanceDay || undefined}
          initialDraft={editingDraft}
          onClose={() => {
            setFinanceModalKey((prev) => prev + 1);
            setShowModal(false);
            setSelectedFinanceDay(null);
            setEditingDraft(null);
            if (onCloseNewModal) onCloseNewModal();
          }}
          clusterName={financeClusterName}
          collegeName={collegeName}
          sessions={sessions}
          clusterId={financeClusterId}
          spocName={spocName}
          financerName={financerName}
          onSaveDraftPackage={async (draftPkg) => {
            if (onSaveDraft) {
              await onSaveDraft(draftPkg);
            }
            showToast(`Draft sheet "${draftPkg.sessionDay}" saved in TQI format!`);
          }}
          onSubmitFinance={async (entries, isDraft) => {
            await Promise.all(entries.map((entry) => onAddFinanceEntry(entry)));
            if (!isDraft) {
              const draftId = entries.find((entry) => entry.draftId)?.draftId;
              if (!draftId || !onSubmitDraft) throw new Error('Finance report was saved, but submission is unavailable.');
              await onSubmitDraft(draftId);
            }
            showToast(isDraft ? 'Draft entries saved!' : 'Finance report submitted for approval.');
          }}
        />
      )}
    </div>
  );
};
