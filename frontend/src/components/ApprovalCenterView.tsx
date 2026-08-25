import React, { useState, useMemo } from 'react';
import { ApprovalItem, TabType, Cluster } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Search, CheckCircle2, AlertCircle, XCircle, Clock, Eye, Check, RefreshCw } from 'lucide-react';
import { ActionButton } from './ui/action-button';
import { Badge } from './ui/badge';

interface ApprovalCenterViewProps {
  approvals: ApprovalItem[];
  clusters: Cluster[];
  userRole: 'Super Admin' | 'Cluster Admin';
  onApprove: (id: string, module: string, recordId: string) => void;
  onRequestCorrection: (id: string, module: string, recordId: string, reason: string) => void;
  onReject: (id: string, module: string, recordId: string, reason: string) => void;
  onNavigate: (tab: TabType, targetId?: string) => void;
}

export const ApprovalCenterView: React.FC<ApprovalCenterViewProps> = ({
  approvals = [],
  clusters = [],
  userRole,
  onApprove,
  onRequestCorrection,
  onReject,
  onNavigate,
}) => {
  const [selectedModuleTab, setSelectedModuleTab] = useState<string>('all');
  const [selectedClusterFilter, setSelectedClusterFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('Pending');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Active Review Item Modal
  const [reviewItem, setReviewItem] = useState<ApprovalItem | null>(null);
  const [correctionReasonInput, setCorrectionReasonInput] = useState<string>('');
  const [showCorrectionForm, setShowCorrectionForm] = useState<boolean>(false);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    const pendingOnly = approvals.filter((a) => a.status === 'Pending');
    return {
      all: pendingOnly.length,
      attendance: pendingOnly.filter((a) => a.module === 'Attendance').length,
      lessonPlan: pendingOnly.filter((a) => a.module === 'Lesson Plan').length,
      finance: pendingOnly.filter((a) => a.module === 'Finance').length,
      sessions: pendingOnly.filter((a) => a.module === 'Sessions').length,
      corrections: pendingOnly.filter((a) => a.module === 'Correction Request').length,
    };
  }, [approvals]);

  // Filtered approvals
  const filteredApprovals = useMemo(() => {
    return approvals.filter((item) => {
      // Module tab filter
      if (selectedModuleTab === 'attendance' && item.module !== 'Attendance') return false;
      if (selectedModuleTab === 'lessonPlan' && item.module !== 'Lesson Plan') return false;
      if (selectedModuleTab === 'finance' && item.module !== 'Finance') return false;
      if (selectedModuleTab === 'sessions' && item.module !== 'Sessions') return false;
      if (selectedModuleTab === 'corrections' && item.module !== 'Correction Request') return false;

      // Status filter
      if (selectedStatusFilter !== 'all' && item.status !== selectedStatusFilter) return false;

      // Cluster filter
      if (selectedClusterFilter !== 'all') {
        const cLower = selectedClusterFilter.toLowerCase();
        if (
          item.clusterId.toLowerCase() !== cLower &&
          !item.clusterName.toLowerCase().includes(cLower)
        ) {
          return false;
        }
      }

      // Search term
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          item.recordTitle.toLowerCase().includes(q) ||
          item.clusterName.toLowerCase().includes(q) ||
          item.submittedBy.toLowerCase().includes(q) ||
          item.module.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [approvals, selectedModuleTab, selectedStatusFilter, selectedClusterFilter, searchTerm]);

  const handleOpenReview = (item: ApprovalItem) => {
    setReviewItem(item);
    setCorrectionReasonInput('');
    setShowCorrectionForm(false);
    setIsRejecting(false);
  };

  const handleApproveConfirm = () => {
    if (!reviewItem) return;
    onApprove(reviewItem.id, reviewItem.module, reviewItem.recordId);
    setReviewItem(null);
  };

  const handleSubmitCorrection = () => {
    if (!reviewItem) return;
    if (!correctionReasonInput.trim()) {
      alert('Please enter a specific reason for requesting correction or resubmission.');
      return;
    }
    if (isRejecting) {
      onReject(reviewItem.id, reviewItem.module, reviewItem.recordId, correctionReasonInput.trim());
    } else {
      onRequestCorrection(reviewItem.id, reviewItem.module, reviewItem.recordId, correctionReasonInput.trim());
    }
    setReviewItem(null);
  };

  const getModuleBadgeColor = (module: string) => {
    switch (module) {
      case 'Attendance':
        return 'bg-blue-50 text-[#002869] border-blue-200';
      case 'Lesson Plan':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'Finance':
        return 'bg-amber-50 text-amber-900 border-amber-200';
      case 'Correction Request':
        return 'bg-orange-50 text-orange-900 border-orange-200';
      default:
        return 'bg-slate-50 text-slate-800 border-slate-200';
    }
  };

  const getModuleIcon = (module: string) => {
    switch (module) {
      case 'Attendance':
        return 'how_to_reg';
      case 'Lesson Plan':
        return 'menu_book';
      case 'Finance':
        return 'payments';
      case 'Correction Request':
        return 'edit_note';
      default:
        return 'verified';
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Approval Center
            </h1>
            {tabCounts.all > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                {tabCounts.all} pending
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review and action attendance, lesson plans, finance claims and correction requests.
          </p>
        </div>
        <div className="flex items-center gap-6 text-xs">
          {[
            { label: 'Attendance', val: tabCounts.attendance },
            { label: 'Lesson plans', val: tabCounts.lessonPlan },
            { label: 'Finance claims', val: tabCounts.finance },
          ].map((s) => (
            <div key={s.label} className="space-y-0.5">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground">{s.label}</div>
              <div className="text-lg font-bold text-foreground">{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex items-center gap-6 border-b border-border/40 text-xs font-medium overflow-x-auto">
        {[
          { id: 'all', label: 'All Items', count: tabCounts.all },
          { id: 'attendance', label: 'Attendance', count: tabCounts.attendance },
          { id: 'lessonPlan', label: 'Lesson Plans', count: tabCounts.lessonPlan },
          { id: 'finance', label: 'Finance Claims', count: tabCounts.finance },
          { id: 'corrections', label: 'Correction Requests', count: tabCounts.corrections },
        ].map((tab) => {
          const isActive = selectedModuleTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedModuleTab(tab.id)}
              className={`relative pb-3 transition-colors whitespace-nowrap ${
                isActive 
                  ? 'text-foreground font-semibold' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`text-[10px] ${isActive ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                    ({tab.count})
                  </span>
                )}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
              )}
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar - Cardless */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Cluster Filter */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-xs">Cluster:</span>
            <div className="w-56">
              <Select
                value={selectedClusterFilter || "all"}
                onValueChange={(val) => setSelectedClusterFilter(val)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Clusters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clusters (Tamil Nadu)</SelectItem>
                  {clusters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-xs">Status:</span>
            <div className="w-44">
              <Select
                value={selectedStatusFilter || "all"}
                onValueChange={(val) => setSelectedStatusFilter(val)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending Review</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Correction Requested">Correction Requested</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Search Box */}
        <div className="relative min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search submissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-xs text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* Approvals Table - Seamless & Borderless */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground font-semibold">
              <th className="py-2.5 px-3">Module</th>
              <th className="py-2.5 px-3">Cluster</th>
              <th className="py-2.5 px-3">Item & Description</th>
              <th className="py-2.5 px-3">Submitted By</th>
              <th className="py-2.5 px-3">Date & Time</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
              {filteredApprovals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <span className="material-symbols-outlined text-[36px] text-slate-300 block mb-1">
                      check_circle
                    </span>
                    <p className="font-semibold text-slate-600">No approval requests found</p>
                    <p className="text-[11px] text-slate-400">All submissions in this category are up to date.</p>
                  </td>
                </tr>
              ) : (
                filteredApprovals.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${getModuleBadgeColor(
                          item.module
                        )}`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {getModuleIcon(item.module)}
                        </span>
                        {item.module}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#002869]"></span>
                        {item.clusterName}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#002869] max-w-[280px]">
                      <div className="truncate" title={item.recordTitle}>
                        {item.recordTitle}
                      </div>
                      {item.details && (
                        <div className="text-[10px] text-slate-500 font-normal truncate mt-0.5">
                          {item.module === 'Attendance' && `${item.details.presentCount || 0} Present / ${item.details.totalCount || 0} Students (${item.details.villageName || ''})`}
                          {item.module === 'Lesson Plan' && `${item.details.duration || '90 Mins'} • ${item.details.targetStandard || '6th-8th Std'}`}
                          {item.module === 'Finance' && `Rs. ${item.details.totalAmount || 0} • SPOC: ${item.details.spocName || 'Admin'}`}
                          {item.module === 'Correction Request' && `Reason: ${item.details.reason || ''}`}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                      {item.submittedBy}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                      {item.submittedAt}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                          item.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'Pending'
                            ? 'bg-amber-100 text-amber-900 animate-pulse'
                            : item.status === 'Correction Requested'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenReview(item)}
                          className="bg-[#002869] hover:bg-[#001f52] text-white px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          Review
                        </button>
                        {item.status === 'Pending' && (
                          <button
                            onClick={() => onApprove(item.id, item.module, item.recordId)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                            title="Quick Approve"
                          >
                            <span className="material-symbols-outlined text-[14px]">check</span>
                            Approve
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

      {/* DETAILED REVIEW & APPROVAL MODAL */}
      {reviewItem && (
        <div className="fixed inset-0 z-[99999] bg-gray-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#c4c6d3] rounded-md w-full max-w-2xl shadow-sm overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-[#002869] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px]">
                  {getModuleIcon(reviewItem.module)}
                </span>
                <div>
                  <h3 className="text-base font-bold">Review Submission: {reviewItem.module}</h3>
                  <p className="text-[11px] text-slate-200">
                    {reviewItem.clusterName} • Submitted by {reviewItem.submittedBy}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReviewItem(null)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white10 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Record Title
                    </span>
                    <p className="text-sm font-bold text-[#002869]">{reviewItem.recordTitle}</p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      reviewItem.status === 'Approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {reviewItem.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-slate-600">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Cluster</span>
                    <span className="font-semibold text-slate-800">{reviewItem.clusterName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Submission Date</span>
                    <span className="font-semibold text-slate-800">{reviewItem.submittedAt}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Module ID</span>
                    <span className="font-semibold text-slate-800">{reviewItem.recordId}</span>
                  </div>
                </div>
              </div>

              {/* Module-Specific Data Rendering */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Submission Breakdown
                </h4>
                {reviewItem.details && (
                  <div className="bg-[#f8fafc] border border-slate-200 rounded-md p-3 space-y-1.5">
                    {Object.entries(reviewItem.details).map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                        <span className="text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                        <span className="font-semibold text-slate-800">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Correction Reason Form */}
              {showCorrectionForm && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-md p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                    <span className="material-symbols-outlined text-[18px]">
                      {isRejecting ? 'block' : 'edit_note'}
                    </span>
                    <span>{isRejecting ? 'Rejection Reason (Mandatory)' : 'Correction Feedback (Mandatory)'}</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Provide precise instructions so the Cluster Admin knows exactly what needs to be revised before resubmitting.
                  </p>
                  <textarea
                    value={correctionReasonInput}
                    onChange={(e) => setCorrectionReasonInput(e.target.value)}
                    placeholder="e.g. Please update student attendance for row 4 and attach the clear fuel bill receipt..."
                    rows={3}
                    className="w-full bg-white border border-amber-300 rounded-md p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#002869]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowCorrectionForm(false)}
                      className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitCorrection}
                      className={`px-4 py-1.5 rounded-md text-white text-xs font-bold transition-colors cursor-pointer shadow-xs ${
                        isRejecting ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      {isRejecting ? 'Confirm Rejection' : 'Submit Correction Request'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => {
                  const targetTab =
                    reviewItem.module === 'Attendance'
                      ? 'attendance'
                      : reviewItem.module === 'Lesson Plan'
                      ? 'lesson-plan'
                      : reviewItem.module === 'Finance'
                      ? 'finance-statement'
                      : 'sessions';
                  onNavigate(targetTab, reviewItem.recordId);
                  setReviewItem(null);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-[#002869] hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                Open in Full Module
              </button>

              <div className="flex items-center gap-2">
                {!showCorrectionForm && (
                  <>
                    <button
                      onClick={() => {
                        setIsRejecting(false);
                        setShowCorrectionForm(true);
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit_note</span>
                      Request Correction
                    </button>
                    <button
                      onClick={handleApproveConfirm}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      Approve Record
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


