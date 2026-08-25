import React, { useState, useMemo } from 'react';
import { TabType, FinanceEntry, Panchayat, FinanceDraft } from '../types';
import { NewFinanceModal } from './NewFinanceModal';

interface FinanceViewProps {
  financeEntries: FinanceEntry[];
  panchayats: Panchayat[];
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

  // Filtered entries for table
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
    // Also update associated entries
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-[200] bg-[#001947] text-white px-4 py-2.5 rounded-md shadow-sm border border-[#dae2ff] flex items-center gap-2 text-[13px] animate-[fadeIn_0.2s_ease-out]">
          <span className="material-symbols-outlined text-[#80d491] text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[12px] text-[#434652] mb-1 font-medium">
            Dharmapuri &gt; <span className="text-[#002869] font-bold">Finance</span>
          </div>
          <h1 className="text-[26px] font-bold text-[#002869] tracking-tight">Finance &amp; Expenses</h1>
          <p className="text-[13px] text-[#434652]">
            Track cluster budgets, expense entries, bills, formatted drafts, and TQI statements.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => onNavigate('finance-statement')}
            className="bg-white border-2 border-[#002869] text-[#002869] px-4 py-2 rounded-md text-[13px] font-bold flex items-center gap-1.5 hover:bg-[#f4f3fb] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            View TQI Statement
          </button>
          <button
            onClick={() => {
              setEditingDraft(null);
              setShowModal(true);
            }}
            className="bg-[#fb7800] text-[#592600] px-4 py-2 rounded-md text-[13px] font-bold flex items-center gap-1.5 hover:bg-[#fb7800]/90 transition-all shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Expense Entry
          </button>
        </div>
      </div>

      {/* Financial Summary Bento Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#c4c6d3]/60 rounded-md p-4 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-[#434652] uppercase tracking-wider">
              Total Advance
            </span>
            <div className="w-8 h-8 rounded-full bg-[#dae2ff] text-[#001947] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">account_balance</span>
            </div>
          </div>
          <div className="text-[24px] font-bold text-[#002869]">₹{totalAdvance.toLocaleString()}</div>
          <p className="text-[11px] text-[#434652] mt-0.5">Disbursed by Head Office</p>
        </div>

        <div className="bg-white border border-[#c4c6d3]/60 rounded-md p-4 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-[#434652] uppercase tracking-wider">
              Expenses Approved
            </span>
            <div className="w-8 h-8 rounded-full bg-[#e6f4ea] text-[#137333] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </div>
          </div>
          <div className="text-[24px] font-bold text-[#137333]">
            ₹{totalExpenses.toLocaleString()}
          </div>
          <p className="text-[11px] text-[#434652] mt-0.5">Verified with receipts</p>
        </div>

        <div className="bg-white border border-[#c4c6d3]/60 rounded-md p-4 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-[#434652] uppercase tracking-wider">
              Remaining Balance
            </span>
            <div className="w-8 h-8 rounded-full bg-[#dae2ff] text-[#002869] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">savings</span>
            </div>
          </div>
          <div className="text-[24px] font-bold text-[#002869]">₹{balance.toLocaleString()}</div>
          <p className="text-[11px] text-[#434652] mt-0.5">Available in cluster account</p>
        </div>

        <div className="bg-white border border-[#c4c6d3]/60 rounded-md p-4 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-[#434652] uppercase tracking-wider">
              Saved Drafts
            </span>
            <div className="w-8 h-8 rounded-full bg-[#ffdbc8] text-[#592600] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">draft</span>
            </div>
          </div>
          <div className="text-[24px] font-bold text-[#592600]">
            ₹{totalDraftsAmount.toLocaleString()}
          </div>
          <p className="text-[11px] text-[#434652] mt-0.5">{drafts.length} formatted draft sessions</p>
        </div>
      </div>

      {/* Main Content Tabs (All Expenses vs Formatted Draft Sheets) */}
      <div className="flex items-center justify-between border-b border-[#c4c6d3] bg-white px-2 rounded-t-xl">
        <div className="flex overflow-x-auto gap-1">
          <button
            onClick={() => setActiveTabFilter('all')}
            className={`py-3 px-4 text-[13px] font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTabFilter === 'all'
                ? 'border-[#002869] text-[#002869]'
                : 'border-transparent text-[#747783] hover:text-[#1a1b21]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">list_alt</span>
            <span>All Expenses ({financeEntries.length})</span>
          </button>

          <button
            onClick={() => setActiveTabFilter('drafts')}
            className={`py-3 px-4 text-[13px] font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTabFilter === 'drafts'
                ? 'border-[#002869] text-[#002869]'
                : 'border-transparent text-[#747783] hover:text-[#1a1b21]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">edit_document</span>
            <span>Saved Draft Sheets ({drafts.length})</span>
            {drafts.length > 0 && (
              <span className="bg-[#ffdbc8] text-[#592600] text-[10px] px-1.5 py-0.5 rounded font-extrabold">
                {drafts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTabFilter('approved')}
            className={`py-3 px-4 text-[13px] font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTabFilter === 'approved'
                ? 'border-[#002869] text-[#002869]'
                : 'border-transparent text-[#747783] hover:text-[#1a1b21]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">check_circle</span>
            <span>Approved ({financeEntries.filter((e) => e.status === 'Approved').length})</span>
          </button>

          <button
            onClick={() => setActiveTabFilter('pending')}
            className={`py-3 px-4 text-[13px] font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTabFilter === 'pending'
                ? 'border-[#002869] text-[#002869]'
                : 'border-transparent text-[#747783] hover:text-[#1a1b21]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">pending_actions</span>
            <span>Pending ({financeEntries.filter((e) => e.status === 'Pending' || e.status === 'Correction').length})</span>
          </button>
        </div>

        <button
          onClick={() => onNavigate('finance-statement')}
          className="text-[#002869] hover:underline text-[12px] font-bold flex items-center gap-1 hidden sm:flex cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">visibility</span>
          Full Statement Format
        </button>
      </div>

      {/* 1. DEDICATED DRAFTS SECTION (When 'drafts' tab is active or on all tab) */}
      {activeTabFilter === 'drafts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold text-[#002869] flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">draft</span>
              Saved Draft Sheets (Ready for TQI Formatting &amp; Submission)
            </h2>
            <button
              onClick={() => {
                setEditingDraft(null);
                setShowModal(true);
              }}
              className="bg-[#002869] text-white px-3 py-1.5 rounded-md text-[12px] font-bold flex items-center gap-1 hover:bg-[#002869]/90 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Create New Draft Session
            </button>
          </div>

          {drafts.length === 0 ? (
            <div className="bg-white border border-[#c4c6d3]/60 rounded-md p-8 text-center space-y-3">
              <span className="material-symbols-outlined text-[40px] text-[#747783]">draft</span>
              <p className="text-[14px] font-bold text-[#1a1b21]">No saved drafts currently</p>
              <p className="text-[12px] text-[#434652] max-w-md mx-auto">
                When you create expenses and click &quot;Save Draft&quot;, the formatted session sheet will appear here ready to review, format, or submit.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="bg-[#002869] text-white px-4 py-2 rounded-md text-[13px] font-bold cursor-pointer"
              >
                Create First Draft
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="bg-white border-2 border-[#dae2ff] rounded-md p-5 shadow-xs hover:border-[#002869] transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-[#ffdbc8] text-[#592600] px-2 py-0.5 rounded text-[11px] font-extrabold">
                            {draft.sessionDay} Draft
                          </span>
                          <span className="text-[11px] text-[#747783]">{draft.sessionDate}</span>
                        </div>
                        <h3 className="text-[16px] font-bold text-[#1a1b21]">{draft.title}</h3>
                        <p className="text-[12px] text-[#434652]">
                          Cluster: <span className="font-semibold text-[#002869]">{draft.clusterName}</span> • College: {draft.collegeName}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[18px] font-bold text-[#002869] font-mono block">
                          ₹{draft.totalAmount.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#747783] font-semibold">Total Amount</span>
                      </div>
                    </div>

                    {/* Breakdown Pills */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-[#c4c6d3]/40 text-[11px]">
                      {draft.routes && draft.routes.length > 0 && (
                        <span className="bg-[#faf8ff] border border-[#c4c6d3] px-2 py-1 rounded text-[#434652]">
                          🚗 {draft.routes.length} Travel Routes
                        </span>
                      )}
                      {draft.food && (
                        <span className="bg-[#faf8ff] border border-[#c4c6d3] px-2 py-1 rounded text-[#434652]">
                          🍱 Food Logged
                        </span>
                      )}
                      {draft.stationery && draft.stationery.amount > 0 && (
                        <span className="bg-[#faf8ff] border border-[#c4c6d3] px-2 py-1 rounded text-[#434652]">
                          📝 Stationery (₹{draft.stationery.amount})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 mt-4 border-t border-[#c4c6d3]/60 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onNavigate('finance-statement', draft.id)}
                      className="bg-[#002869] text-white px-3.5 py-1.5 rounded-md text-[12px] font-bold flex items-center gap-1.5 hover:bg-[#002869]/90 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                      View Statement Format
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleEditDraft(draft)}
                        className="p-1.5 border border-[#c4c6d3] text-[#002869] hover:bg-[#f4f3fb] rounded-md text-[12px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Edit / Add Expenses"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        Edit
                      </button>
                      <button
                        onClick={() => handleSubmitDraftPackage(draft.id)}
                        className="p-1.5 bg-[#e6f4ea] text-[#137333] hover:bg-[#137333] hover:text-white rounded-md text-[12px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Submit for Approval"
                      >
                        <span className="material-symbols-outlined text-[16px]">send</span>
                        Submit
                      </button>
                      <button
                        onClick={() => handleDeleteDraftPackage(draft.id)}
                        className="p-1.5 text-[#ba1a1a] hover:bg-[#ffdad6]/50 rounded-md cursor-pointer"
                        title="Delete Draft"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. EXPENSES TABLE (For All, Approved, Pending, or Drafts) */}
      <div className="space-y-4">
        {/* Filters & Search */}
        <div className="bg-white p-3.5 rounded-md border border-[#c4c6d3]/60 shadow-xs flex flex-col md:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#747783] text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search expenses by description, route, or remarks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-[#f4f3fb] border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869] h-[36px]"
            />
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#f4f3fb] border border-[#c4c6d3] rounded-md px-3 py-1.5 text-[12px] font-medium focus:border-[#002869] h-[36px] outline-none"
            >
              <option value="">All Categories</option>
              <option value="Travel">Travel</option>
              <option value="Food">Food</option>
              <option value="Materials">Materials / Stationery</option>
              <option value="Admin">Admin</option>
              <option value="Other">Other</option>
            </select>

            <select
              value={selectedPanchayat}
              onChange={(e) => setSelectedPanchayat(e.target.value)}
              className="bg-[#f4f3fb] border border-[#c4c6d3] rounded-md px-3 py-1.5 text-[12px] font-medium focus:border-[#002869] h-[36px] outline-none"
            >
              <option value="">All Panchayats</option>
              {panchayats.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white rounded-md border border-[#c4c6d3]/60 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-[#f4f3fb] text-[11px] font-bold text-[#434652] uppercase tracking-wider border-b border-[#c4c6d3]">
                <tr>
                  <th className="p-3 pl-6">Date / Session</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Description &amp; Route</th>
                  <th className="p-3">Panchayat &amp; Location</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Bill / Attachment</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-[12.5px] divide-y divide-[#c4c6d3]/40">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-[#747783]">
                      No expense entries matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#faf8ff] transition-colors">
                      <td className="p-3 pl-6">
                        <span className="font-semibold text-[#1a1b21] block">{entry.date}</span>
                        {entry.sessionDay && (
                          <span className="text-[10px] text-[#002869] font-bold bg-[#dae2ff] px-1.5 py-0.2 rounded">
                            {entry.sessionDay}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="bg-[#f4f3fb] text-[#002869] px-2 py-0.5 rounded text-[11px] font-bold border border-[#c4c6d3]/40">
                          {entry.category}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-[#1a1b21]">
                        <span className="font-bold block">{entry.description}</span>
                        {entry.remarks && (
                          <span className="text-[11px] text-[#747783] block">{entry.remarks}</span>
                        )}
                      </td>
                      <td className="p-3 text-[#434652]">
                        {entry.panchayatName}
                        <span className="block text-[11px] text-[#747783]">{entry.villageName}</span>
                      </td>
                      <td className="p-3 font-bold text-[#002869] font-mono">
                        ₹{entry.amount.toLocaleString()}
                      </td>
                      <td className="p-3">
                        {entry.billUrl ? (
                          <button
                            onClick={() => setViewingReceipt(entry)}
                            className="text-[#002869] text-[11.5px] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px] text-[#137333]">receipt</span>
                            View Bill
                          </button>
                        ) : (
                          <span className="text-[#ba1a1a] text-[11px] font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">attach_file_off</span>
                            Missing
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-extrabold ${
                            entry.status === 'Approved'
                              ? 'bg-[#e6f4ea] text-[#137333]'
                              : entry.status === 'Draft'
                              ? 'bg-[#ffdbc8] text-[#592600]'
                              : 'bg-[#ffdad6] text-[#ba1a1a]'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="p-3 pr-6 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <button
                            onClick={() =>
                              onNavigate('finance-statement', entry.draftId || entry.sessionDay || 'all-approved')
                            }
                            className="p-1 text-[#002869] hover:bg-[#dae2ff] rounded cursor-pointer"
                            title="View Statement Sheet"
                          >
                            <span className="material-symbols-outlined text-[17px]">visibility</span>
                          </button>
                          <button
                            onClick={() => setEditingEntry(entry)}
                            className="p-1 text-[#002869] hover:bg-[#dae2ff] rounded cursor-pointer"
                            title="Edit Entry"
                          >
                            <span className="material-symbols-outlined text-[17px]">edit</span>
                          </button>
                          {entry.status !== 'Approved' && (
                            <button
                              onClick={() => {
                                onUpdateFinanceEntry(entry.id, { status: 'Pending' });
                                showToast('Entry submitted for review!');
                              }}
                              className="p-1 text-[#137333] hover:bg-[#e6f4ea] rounded cursor-pointer"
                              title="Submit for Review"
                            >
                              <span className="material-symbols-outlined text-[17px]">send</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`Delete finance entry "${entry.description}"?`)) {
                                onDeleteFinanceEntry(entry.id);
                                showToast('Finance entry deleted');
                              }
                            }}
                            className="p-1 text-[#ba1a1a] hover:bg-[#ffdad6]/40 rounded cursor-pointer"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-[17px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bill / Receipt Lightbox Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-black/80  z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-sm max-w-lg w-full overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <div className="p-4 bg-[#f4f3fb] border-b border-[#c4c6d3] flex justify-between items-center">
              <div>
                <h3 className="text-[15px] font-bold text-[#002869]">{viewingReceipt.description}</h3>
                <p className="text-[12px] text-[#434652]">
                  {viewingReceipt.category} • ₹{viewingReceipt.amount}
                </p>
              </div>
              <button
                onClick={() => setViewingReceipt(null)}
                className="p-1 text-[#434652] hover:bg-[#e8e7ef] rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-4 bg-[#1a1b21] flex justify-center">
              <img
                src={viewingReceipt.billUrl}
                alt="Receipt"
                className="max-h-[60vh] object-contain rounded"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="p-4 bg-white border-t border-[#c4c6d3] flex justify-between items-center">
              <span className="text-[12px] text-[#434652]">
                {viewingReceipt.remarks || 'Receipt document attached'}
              </span>
              <button
                onClick={() => setViewingReceipt(null)}
                className="px-4 py-1.5 bg-[#002869] text-white font-bold text-[12px] rounded-md cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Single Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black/60  z-[120] flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white rounded-md max-w-md w-full overflow-hidden shadow-sm border border-[#c4c6d3] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#c4c6d3] pb-3">
              <h3 className="text-[16px] font-bold text-[#002869] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">edit</span>
                <span>Edit Finance Entry</span>
              </h3>
              <button
                onClick={() => setEditingEntry(null)}
                className="p-1 text-[#747783] hover:text-[#1a1b21] rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div>
                <label className="block text-[11px] font-bold text-[#434652] mb-1">Description / Route</label>
                <input
                  type="text"
                  value={editingEntry.description}
                  onChange={(e) => setEditingEntry({ ...editingEntry, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#434652] mb-1">Category</label>
                  <select
                    value={editingEntry.category}
                    onChange={(e) =>
                      setEditingEntry({ ...editingEntry, category: e.target.value as any })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md font-semibold outline-none"
                  >
                    <option value="Travel">Travel</option>
                    <option value="Food">Food</option>
                    <option value="Materials">Materials</option>
                    <option value="Admin">Admin</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#434652] mb-1">Amount (₹)</label>
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
                    className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md font-bold text-[#002869] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#434652] mb-1">Remarks</label>
                <input
                  type="text"
                  value={editingEntry.remarks || ''}
                  onChange={(e) => setEditingEntry({ ...editingEntry, remarks: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#c4c6d3]">
              <button
                onClick={() => setEditingEntry(null)}
                className="px-4 py-2 bg-white border border-[#c4c6d3] rounded-md text-[12.5px] font-bold text-[#434652] hover:bg-[#f4f3fb] cursor-pointer"
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
                  });
                  setEditingEntry(null);
                  showToast('Finance entry updated');
                }}
                className="px-5 py-2 bg-[#002869] text-white rounded-md text-[12.5px] font-bold hover:bg-[#002869]/90 cursor-pointer shadow-xs"
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


