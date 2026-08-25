import React, { useState, useMemo } from 'react';
import { TabType, FinanceEntry, Panchayat, FinanceDraft, Session } from '../types';
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
  Send,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Table, TableHeader, TableBody, TableRow, TableCell } from './ui/table';

interface FinanceViewProps {
  financeEntries: FinanceEntry[];
  panchayats: Panchayat[];
  sessions?: Session[];
  drafts?: FinanceDraft[];
  onNavigate: (tab: TabType, targetId?: string) => void;
  onAddFinanceEntry: (entry: Omit<FinanceEntry, 'id'>) => void;
  onUpdateFinanceEntry: (id: string, updated: Partial<FinanceEntry>) => void;
  onDeleteFinanceEntry: (id: string) => void;
  onSaveDraft?: (draft: FinanceDraft) => void;
  onDeleteDraft?: (draftId: string) => void;
  onSubmitDraft?: (draftId: string) => void;
  isOpenNewModal?: boolean;
  onCloseNewModal?: () => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  financeEntries,
  panchayats,
  sessions,
  drafts = [],
  onNavigate,
  onAddFinanceEntry,
  onUpdateFinanceEntry,
  onDeleteFinanceEntry,
  onSaveDraft,
  onDeleteDraft,
  onSubmitDraft,
  isOpenNewModal = false,
  onCloseNewModal,
}) => {
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'drafts' | 'approved' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPanchayat, setSelectedPanchayat] = useState('');
  const [showModal, setShowModal] = useState(isOpenNewModal);
  const [editingDraft, setEditingDraft] = useState<FinanceDraft | null>(null);
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<FinanceEntry | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const handleSubmitDraftPackage = (draftId: string) => {
    if (onSubmitDraft) {
      onSubmitDraft(draftId);
    }
    financeEntries.forEach((e) => {
      if (e.draftId === draftId) {
        onUpdateFinanceEntry(e.id, { status: 'Approved' });
      }
    });
    showToast('Draft submitted for approval successfully!');
  };

  const handleDeleteDraftPackage = (draftId: string) => {
    if (confirm('Are you sure you want to delete this formatted draft session?')) {
      if (onDeleteDraft) {
        onDeleteDraft(draftId);
      }
      financeEntries.forEach((e) => {
        if (e.draftId === draftId) {
          onDeleteFinanceEntry(e.id);
        }
      });
      showToast('Draft removed.');
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Approved') return <Badge color="success" size="sm">Approved</Badge>;
    if (status === 'Draft') return <Badge color="warning" size="sm">Draft</Badge>;
    return <Badge color="error" size="sm">{status}</Badge>;
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

      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Finance &amp; Expenses
            </h1>
            <Badge color="primary" size="sm">
              Dharmapuri Cluster
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Track cluster budgets, expense entries, bills, formatted drafts, and TQI statements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onNavigate('finance-statement')}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-gray-500" />
            <span>TQI Statement</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingDraft(null);
              setShowModal(true);
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Expense Entry</span>
          </button>
        </div>
      </div>

      {/* 2. Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Advance</div>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold font-mono text-gray-900 dark:text-white">₹{totalAdvance.toLocaleString()}</div>
          <p className="mt-0.5 text-[11px] text-gray-400 truncate">Disbursed by State HQ</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-success-500">Expenses Approved</div>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold font-mono text-success-600 dark:text-success-400">₹{totalExpenses.toLocaleString()}</div>
          <p className="mt-0.5 text-[11px] text-success-500/80 truncate">Verified with receipts</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">Remaining Balance</div>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold font-mono text-brand-500">₹{balance.toLocaleString()}</div>
          <p className="mt-0.5 text-[11px] text-brand-500/80 truncate">Cluster available fund</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-warning-500">Saved Drafts</div>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold font-mono text-warning-600 dark:text-warning-400">₹{totalDraftsAmount.toLocaleString()}</div>
          <p className="mt-0.5 text-[11px] text-warning-500/80 truncate">{drafts.length} formatted drafts</p>
        </div>
      </div>

      {/* 3. Filter Tabs & View Statement Link */}
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

        <button
          type="button"
          onClick={() => onNavigate('finance-statement')}
          className="text-xs font-bold text-brand-500 hover:text-brand-600 transition flex items-center gap-1 cursor-pointer self-end sm:self-auto"
        >
          <span>Statement Format</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* DEDICATED DRAFTS SECTION (When 'drafts' tab is active) */}
      {activeTabFilter === 'drafts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Saved Draft Sheets (Ready for TQI Formatting &amp; Submission)
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditingDraft(null);
                setShowModal(true);
              }}
              className="rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition cursor-pointer"
            >
              + New Draft Session
            </button>
          </div>

          {drafts.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-xs rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
              No saved drafts currently.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {drafts.map((draft) => (
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
                      onClick={() => onNavigate('finance-statement', draft.id)}
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

      {/* 4. Search & Filter Bar */}
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
              value={selectedCategory || "all"}
              onValueChange={(val) => setSelectedCategory(val === "all" ? "" : val)}
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
              value={selectedPanchayat || "all"}
              onValueChange={(val) => setSelectedPanchayat(val === "all" ? "" : val)}
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

      {/* 5A. MOBILE EXPENSE CARDS (Visible on mobile screens < 768px) */}
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

                  <button
                    type="button"
                    onClick={() => setEditingEntry(entry)}
                    className="p-1 text-gray-500 hover:text-brand-500 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
                    title="Edit"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>

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
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 5B. DESKTOP EXPENSES TABLE (Visible on >= 768px) */}
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
                          onNavigate('finance-statement', entry.draftId || entry.sessionDay || 'all-approved')
                        }
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-white/5 dark:hover:text-brand-400 transition cursor-pointer"
                        title="View Statement Sheet"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingEntry(entry)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-white/5 dark:hover:text-brand-400 transition cursor-pointer"
                        title="Edit Entry"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      {entry.status !== 'Approved' && (
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateFinanceEntry(entry.id, { status: 'Pending' });
                            showToast('Entry submitted for review!');
                          }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-success-50 hover:text-success-600 dark:hover:bg-success-500/10 dark:hover:text-success-400 transition cursor-pointer"
                          title="Submit for Review"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}
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
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
              <button
                onClick={() => setViewingReceipt(null)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 bg-gray-950 flex justify-center">
              <img
                src={viewingReceipt.billUrl}
                alt="Receipt"
                className="max-h-[60vh] object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                {viewingReceipt.remarks || 'Receipt document attached'}
              </span>
              <button
                onClick={() => setViewingReceipt(null)}
                className="px-4 py-2 bg-brand-500 text-white font-semibold text-xs rounded-xl shadow-theme-xs hover:bg-brand-600 transition cursor-pointer"
              >
                Done
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
          isOpen={showModal}
          initialDraft={editingDraft}
          onClose={() => {
            setShowModal(false);
            setEditingDraft(null);
            if (onCloseNewModal) onCloseNewModal();
          }}
          clusterName="Dharmapuri"
          collegeName="K.S.Rangasamy college of Technology"
          spocName="Narendhar"
          financerName="TQI Finance Team"
          onSaveDraftPackage={(draftPkg) => {
            if (onSaveDraft) {
              onSaveDraft(draftPkg);
            }
            showToast(`Draft sheet "${draftPkg.sessionDay}" saved in TQI format!`);
          }}
          onSubmitFinance={(entries, isDraft) => {
            entries.forEach((entry) => onAddFinanceEntry(entry));
            showToast(isDraft ? 'Draft entries saved!' : 'Finance entries submitted for approval!');
          }}
        />
      )}
    </div>
  );
};
