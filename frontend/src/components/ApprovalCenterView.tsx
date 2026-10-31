import React, { useState, useMemo } from 'react';
import { ApprovalItem, TabType, Cluster } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Search, CheckCircle2, AlertCircle, XCircle, Clock, Eye, Check, RefreshCw } from './ui/icons';
import { ActionButton } from './ui/action-button';
import { Badge } from './ui/badge';
import { DateChangeRequestView } from './DateChangeRequestView';

interface ApprovalCenterViewProps {
  approvals: ApprovalItem[];
  clusters: Cluster[];
  userRole: 'Super Admin' | 'Cluster Admin';
  onApprove: (id: string, module: string, recordId: string) => Promise<void> | void;
  onRequestCorrection: (id: string, module: string, recordId: string, reason: string) => void;
  onReject: (id: string, module: string, recordId: string, reason: string) => void;
  onNavigate: (tab: TabType, targetId?: string) => void;
  dateChangeRequests: import('../types').DateChangeRequest[];
  sessions: import('../types').Session[];
  currentUserId: string;
  currentUserClusterId: string;
  onSubmitDateChange: (sessionId: string, originalDate: string, requestedDate: string, reason: string) => Promise<void>;
  onReviewDateChange: (requestId: string, action: 'approve' | 'reject', remarks: string) => Promise<void>;
  onReviewFinanceEditRequest: (reportId: string, action: 'approve' | 'reject', reason?: string) => Promise<void>;
  onReviewLessonPlanRequest: (approvalId: string, action: 'approve' | 'reject') => Promise<void>;
}

export const ApprovalCenterView: React.FC<ApprovalCenterViewProps> = ({
  approvals = [],
  clusters = [],
  userRole,
  onApprove,
  onRequestCorrection,
  onReject,
  onNavigate,
  dateChangeRequests,
  sessions,
  currentUserId,
  currentUserClusterId,
  onSubmitDateChange,
  onReviewDateChange,
  onReviewFinanceEditRequest,
  onReviewLessonPlanRequest,
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
  const [isApproving, setIsApproving] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [financeEditReviewItem, setFinanceEditReviewItem] = useState<ApprovalItem | null>(null);
  const [financeEditRejectionReason, setFinanceEditRejectionReason] = useState('');
  const [isReviewingFinanceEdit, setIsReviewingFinanceEdit] = useState(false);
  const [lessonPlanRequestItem, setLessonPlanRequestItem] = useState<ApprovalItem | null>(null);
  const [isReviewingLessonPlanRequest, setIsReviewingLessonPlanRequest] = useState(false);

  const matchesApprovalCategory = (item: ApprovalItem, category: string) => {
    const module = item.module.toLowerCase();
    const type = String((item as ApprovalItem & { type?: string }).type || '').toLowerCase();
    const title = item.recordTitle.toLowerCase();
    const searchable = `${module} ${type} ${title}`;

    switch (category) {
      case 'dateChanges':
        return searchable.includes('date change') || searchable.includes('schedule change');
      case 'photos':
        return module === 'session photos' || searchable.includes('photo');
      case 'sessions':
        return module === 'sessions' || module === 'session' || searchable.includes('session');
      case 'attendance':
        return module === 'attendance' || searchable.includes('attendance');
      case 'lessonPlan':
        return module === 'lesson plan';
      case 'finance':
        return module === 'finance' || module === 'finance edit request';
      case 'financeEdit':
        return module === 'finance edit request';
      case 'corrections':
        return module === 'correction request';
      default:
        return true;
    }
  };

  // Counts for tabs
  const tabCounts = useMemo(() => {
    const pendingOnly = approvals.filter((a) => a.status === 'Pending');
    return {
      all: pendingOnly.length,
      dateChanges: pendingOnly.filter((a) => matchesApprovalCategory(a, 'dateChanges')).length,
      attendance: pendingOnly.filter((a) => a.module === 'Attendance').length,
      lessonPlan: pendingOnly.filter((a) => a.module === 'Lesson Plan').length,
      finance: pendingOnly.filter((a) => a.module === 'Finance').length,
      financeEdit: pendingOnly.filter((a) => a.module === 'Finance Edit Request').length,
      sessions: pendingOnly.filter((a) => a.module === 'Sessions').length,
      corrections: pendingOnly.filter((a) => a.module === 'Correction Request').length,
      photos: pendingOnly.filter((a) => matchesApprovalCategory(a, 'photos')).length,
    };
  }, [approvals]);

  // Filtered approvals
  const filteredApprovals = useMemo(() => {
    return approvals.filter((item) => {
      // Module tab filter
      if (selectedModuleTab !== 'all' && !matchesApprovalCategory(item, selectedModuleTab)) return false;

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

  const handleApproveConfirm = async () => {
    if (!reviewItem) return;
    setIsApproving(true);
    setApprovalError('');
    try {
      await onApprove(reviewItem.id, reviewItem.module, reviewItem.recordId);
      setReviewItem(null);
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : 'Unable to approve this submission.');
    } finally {
      setIsApproving(false);
    }
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
      case 'Finance Edit Request':
      case 'Lesson Plan Edit Request':
      case 'Lesson Plan Delete Request':
        return 'bg-orange-50 text-orange-900 border-orange-200';
      case 'Correction Request':
        return 'bg-orange-50 text-orange-900 border-orange-200';
      case 'Session Photos':
        return 'bg-pink-50 text-pink-900 border-pink-200';
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
      case 'Finance Edit Request':
        return 'edit_note';
      case 'Correction Request':
        return 'edit_note';
      case 'Session Photos':
        return 'photo_library';
      default:
        return 'verified';
    }
  };

  const resetFilters = () => {
    setSelectedClusterFilter('all');
    setSelectedStatusFilter('Pending');
    setSearchTerm('');
  };

  const summaryCards = [
    { label: 'Attendance', value: tabCounts.attendance, tone: 'bg-[#EAF4FF] border-[#D7E9FF] text-[#0C3A75]' },
    { label: 'Lesson Plans', value: tabCounts.lessonPlan, tone: 'bg-[#F3EEFF] border-[#E4D9FF] text-[#4C2D9D]' },
    { label: 'Finance Claims', value: tabCounts.finance, tone: 'bg-[#FFF5E8] border-[#FFE6C2] text-[#8A4B00]' },
    { label: 'Edit Requests', value: tabCounts.financeEdit, tone: 'bg-[#EAFBF3] border-[#CDEEDB] text-[#115B3E]' },
  ];

  const tabs = [
    { id: 'all', label: 'All', count: tabCounts.all },
    { id: 'dateChanges', label: 'Date Changes', count: tabCounts.dateChanges },
    { id: 'photos', label: 'Photos', count: tabCounts.photos },
    { id: 'sessions', label: 'Sessions', count: tabCounts.sessions },
    { id: 'attendance', label: 'Attendance', count: tabCounts.attendance },
    { id: 'lessonPlan', label: 'Lesson Plans', count: tabCounts.lessonPlan },
    { id: 'finance', label: 'Finance', count: tabCounts.finance },
    { id: 'financeEdit', label: 'Finance Edit Requests', count: tabCounts.financeEdit },
    { id: 'corrections', label: 'Corrections', count: tabCounts.corrections },
  ];

  return (
    <div className="w-full space-y-6 p-1 md:p-2">
      <div className="rounded-[28px] border border-[#E2ECFF] bg-gradient-to-r from-[#F8FBFF] via-[#F4F9FF] to-[#EEF7FF] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[#10234E] sm:text-3xl">Approval Center</h1>
              {tabCounts.all > 0 && (
                <span className="rounded-full border border-[#F5D58D] bg-[#FFF4CC] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8C5E00]">
                  {tabCounts.all} pending
                </span>
              )}
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-600">
              Review and action attendance, lesson plans, finance claims and correction requests.
            </p>
          </div>

          <div className="flex h-20 w-full max-w-[200px] items-center justify-center rounded-2xl border border-[#D9E9FF] bg-white/80 shadow-sm">
            <div className="relative h-12 w-12 rounded-2xl bg-[#EAF3FF]">
              <div className="absolute left-3 top-3 h-6 w-6 rounded-xl border-2 border-[#0C3A75] bg-white/90" />
              <div className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#1E7AE6] text-[10px] text-white">
                ✓
              </div>
              <div className="absolute bottom-2 right-3 h-2.5 w-2.5 rounded-full bg-[#7CC7FF]" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] ${card.tone}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{card.label}</div>
                <div className="mt-3 text-3xl font-bold tracking-tight text-[#10234E]">{card.value}</div>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-lg text-[#0F3D82] shadow-sm">
                <CheckCircle2 className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-3 text-sm font-medium text-slate-600">Pending review</div>
          </div>
        ))}
      </div>

      <div className="rounded-[24px] border border-[#E9EEF7] bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.03)] md:p-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 md:gap-3">
          {tabs.map((tab) => {
            const isActive = selectedModuleTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedModuleTab(tab.id)}
                className={`relative rounded-full px-3 py-2 text-xs font-semibold transition-all md:px-4 ${
                  isActive
                    ? 'bg-[#EAF3FF] text-[#0D3A7A] shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${isActive ? 'bg-white text-[#0D3A7A]' : 'bg-slate-200 text-slate-600'}`}>
                      {tab.count}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {selectedModuleTab === 'dateChanges' ? (
          <div className="pt-4">
            <DateChangeRequestView
              dateChangeRequests={dateChangeRequests}
              sessions={sessions}
              currentUserRole={userRole}
              currentUserId={currentUserId}
              currentUserClusterId={currentUserClusterId}
              onSubmitRequest={onSubmitDateChange}
              onReviewRequest={onReviewDateChange}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                <div className="w-full md:w-[230px]">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Cluster</label>
                  <Select
                    value={selectedClusterFilter || 'all'}
                    onValueChange={(val) => setSelectedClusterFilter(val)}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-700 shadow-sm">
                      <SelectValue placeholder="All Clusters (Tamil Nadu)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clusters (Tamil Nadu)</SelectItem>
                      {clusters.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full md:w-[200px]">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Status</label>
                  <Select
                    value={selectedStatusFilter || 'Pending'}
                    onValueChange={(val) => setSelectedStatusFilter(val)}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-700 shadow-sm">
                      <SelectValue placeholder="Pending Review" />
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

              <div className="flex w-full items-center gap-2 lg:max-w-[390px]">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search submissions"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#7FB3FF] focus:outline-none focus:ring-2 focus:ring-[#EAF3FF]"
                  />
                </div>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.03)]">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="bg-[#F6F9FF] text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Module</th>
                      <th className="px-4 py-3">Cluster</th>
                      <th className="px-4 py-3">Item & Description</th>
                      <th className="px-4 py-3">Submitted By</th>
                      <th className="px-4 py-3">Date & Time</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredApprovals.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16">
                          <div className="flex flex-col items-center justify-center text-center">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#0D3A7A] shadow-sm">
                              <Clock className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">No approval requests found</h3>
                            <p className="mt-2 max-w-md text-sm text-slate-500">All submissions in this category are up to date.</p>
                            <button
                              type="button"
                              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0D3A7A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0B315F]"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Check for new submissions
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredApprovals.map((item) => (
                        <tr key={item.id} className="transition hover:bg-slate-50">
                          <td className="px-4 py-4 align-top">
                            <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold ${getModuleBadgeColor(item.module)}`}>
                              <span className="material-symbols-outlined text-[14px]">{getModuleIcon(item.module)}</span>
                              {item.module}
                            </span>
                          </td>
                          <td className="px-4 py-4 align-top text-sm font-medium text-slate-700">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-[#0D3A7A]" />
                              {item.clusterName}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="max-w-[280px]">
                              <div className="truncate text-sm font-semibold text-[#10234E]" title={item.recordTitle}>{item.recordTitle}</div>
                              {item.details && (
                                <div className="mt-1 text-xs text-slate-500">
                                  {item.module === 'Attendance' && `${item.details.presentCount || 0} Present / ${item.details.totalCount || 0} Students (${item.details.villageName || ''})`}
                                  {item.module === 'Lesson Plan' && `${item.details.duration || '90 Mins'} • ${item.details.targetStandard || '6th-8th Std'}`}
                                  {(item.module === 'Finance' || item.module === 'Finance Edit Request') && `${item.details.collegeName || 'College not set'} • ${item.details.sessionName || 'Session not set'} • ₹${item.details.totalAmount || 0} • ${item.details.itemCount || 0} expenses`}
                                  {item.module === 'Correction Request' && `Reason: ${item.details.reason || ''}`}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-sm text-slate-600">{item.submittedBy}</td>
                          <td className="px-4 py-4 align-top text-xs text-slate-500">{item.submittedAt}</td>
                          <td className="px-4 py-4 align-top">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                              item.status === 'Approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.status === 'Pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : item.status === 'Correction Requested'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-red-100 text-red-800'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 align-top text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => item.module === 'Finance Edit Request'
                                  ? (setFinanceEditReviewItem(item), setFinanceEditRejectionReason(''))
                                  : item.module === 'Lesson Plan Edit Request' || item.module === 'Lesson Plan Delete Request'
                                    ? setLessonPlanRequestItem(item)
                                    : item.module === 'Lesson Plan'
                                      ? onNavigate('lesson-plan', item.recordId)
                                    : handleOpenReview(item)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D3A7A] px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#0B315F]"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Review
                              </button>
                              {item.status === 'Pending' && item.module !== 'Attendance' && item.module !== 'Finance Edit Request' && item.module !== 'Lesson Plan' && item.module !== 'Lesson Plan Edit Request' && item.module !== 'Lesson Plan Delete Request' && (
                                <button
                                  onClick={() => onApprove(item.id, item.module, item.recordId)}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                                  title="Quick Approve"
                                >
                                  <Check className="h-3.5 w-3.5" />
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
            </div>
          </>
        )}
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
                    {Object.entries(reviewItem.details).filter(([key]) => !['records', 'volunteerAttendance'].includes(key)).map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                        <span className="text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                        <span className="font-semibold text-slate-800">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {reviewItem.module === 'Attendance' && reviewItem.details?.attendanceType !== 'volunteers' && (
                  <div className="overflow-x-auto rounded-md border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600"><tr><th className="p-2.5">S.No</th><th className="p-2.5">Student</th><th className="p-2.5">Standard</th><th className="p-2.5">Attendance</th><th className="p-2.5">Task</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {(reviewItem.details?.records || []).map((record: any, index: number) => <tr key={record.studentId}><td className="p-2.5 tabular-nums text-slate-500">{index + 1}</td><td className="p-2.5 font-semibold text-slate-800">{record.studentName}</td><td className="p-2.5">{record.standard || record.code || '—'}</td><td className={`p-2.5 font-semibold ${record.status === 'Present' ? 'text-emerald-700' : 'text-rose-700'}`}>{record.status}</td><td className="p-2.5">{record.taskStatus || '—'}</td></tr>)}
                        {!(reviewItem.details?.records || []).length && <tr><td colSpan={5} className="p-5 text-center text-slate-500">No student attendance rows were included.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
                {reviewItem.module === 'Attendance' && reviewItem.details?.attendanceType === 'volunteers' && (
                  <div className="overflow-x-auto rounded-md border border-slate-200">
                    <table className="w-full text-left text-xs"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-2.5">Volunteer</th><th className="p-2.5">Role</th><th className="p-2.5">Attendance</th></tr></thead><tbody className="divide-y divide-slate-100">
                      {(reviewItem.details?.volunteerAttendance || []).map((record: any) => <tr key={record.volunteerId}><td className="p-2.5 font-semibold text-slate-800">{record.volunteerName}</td><td className="p-2.5">{record.role || 'Volunteer'}</td><td className="p-2.5">{record.status}</td></tr>)}
                      {!(reviewItem.details?.volunteerAttendance || []).length && <tr><td colSpan={3} className="p-5 text-center text-slate-500">No volunteer attendance rows were included.</td></tr>}
                    </tbody></table>
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
                      {isRejecting ? 'Confirm Rejection' : reviewItem.module === 'Lesson Plan' ? 'Send for Resubmission' : 'Submit Correction Request'}
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
                {approvalError && <p role="alert" className="mr-2 text-xs font-semibold text-rose-700">{approvalError}</p>}
                {!showCorrectionForm && (
                  <>
                    {reviewItem.module !== 'Lesson Plan' && <button
                      onClick={() => {
                        setIsRejecting(true);
                        setShowCorrectionForm(true);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">block</span>
                      Reject Record
                    </button>}
                    <button
                      onClick={() => {
                        setIsRejecting(false);
                        setShowCorrectionForm(true);
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit_note</span>
                      {reviewItem.module === 'Lesson Plan' ? 'Send for Resubmission' : 'Request Correction'}
                    </button>
                    <button
                      onClick={handleApproveConfirm}
                      disabled={isApproving}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      {isApproving ? 'Saving…' : 'Approve Record'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {financeEditReviewItem && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-900/70 p-4">
          <div className="w-full max-w-xl space-y-4 rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Review Finance Edit Request</h2>
                <p className="mt-1 text-xs text-gray-500">{financeEditReviewItem.recordTitle} · {financeEditReviewItem.clusterName}</p>
              </div>
              <button type="button" onClick={() => setFinanceEditReviewItem(null)} className="text-sm text-gray-500">Close</button>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-800">
              <div><span className="text-gray-500">Requested by</span><div className="font-semibold">{financeEditReviewItem.submittedBy}</div></div>
              <div><span className="text-gray-500">Requested at</span><div className="font-semibold">{new Date(financeEditReviewItem.submittedAt).toLocaleString()}</div></div>
              <div><span className="text-gray-500">College</span><div className="font-semibold">{financeEditReviewItem.details?.collegeName || '—'}</div></div>
              <div><span className="text-gray-500">Session</span><div className="font-semibold">{financeEditReviewItem.details?.sessionName || '—'}</div></div>
              <div><span className="text-gray-500">Current report status</span><div className="font-semibold">Submitted / Locked</div></div>
              <div><span className="text-gray-500">Total / entries / bills</span><div className="font-semibold">₹{Number(financeEditReviewItem.details?.totalAmount || 0).toLocaleString()} · {financeEditReviewItem.details?.itemCount || 0} · {financeEditReviewItem.details?.billCount || 0}</div></div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><strong>Reason for edit</strong><p className="mt-1 whitespace-pre-wrap">{financeEditReviewItem.details?.reason || 'No reason provided.'}</p></div>
            <textarea value={financeEditRejectionReason} onChange={(event) => setFinanceEditRejectionReason(event.target.value)} rows={3} placeholder="Reason required when rejecting…" className="w-full rounded-lg border border-gray-200 p-3 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            <div className="flex justify-end gap-2">
              <button type="button" disabled={isReviewingFinanceEdit || !financeEditRejectionReason.trim()} onClick={async () => {
                setIsReviewingFinanceEdit(true);
                try { await onReviewFinanceEditRequest(financeEditReviewItem.recordId, 'reject', financeEditRejectionReason.trim()); setFinanceEditReviewItem(null); }
                catch (error) { alert(error instanceof Error ? error.message : 'Unable to reject edit request.'); }
                finally { setIsReviewingFinanceEdit(false); }
              }} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Reject Edit Request</button>
              <button type="button" disabled={isReviewingFinanceEdit} onClick={async () => {
                setIsReviewingFinanceEdit(true);
                try { await onReviewFinanceEditRequest(financeEditReviewItem.recordId, 'approve'); setFinanceEditReviewItem(null); }
                catch (error) { alert(error instanceof Error ? error.message : 'Unable to approve edit request.'); }
                finally { setIsReviewingFinanceEdit(false); }
              }} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve Edit Request</button>
            </div>
          </div>
        </div>
      )}
      {lessonPlanRequestItem && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-900/70 p-4">
          <div className="w-full max-w-xl space-y-4 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {lessonPlanRequestItem.module === 'Lesson Plan Edit Request' ? 'Review Edit Access Request' : 'Review Delete Request'}
                </h2>
                <p className="mt-1 text-xs text-slate-500">{lessonPlanRequestItem.recordTitle} · {lessonPlanRequestItem.clusterName}</p>
              </div>
              <button type="button" onClick={() => setLessonPlanRequestItem(null)} className="text-sm text-slate-500">Close</button>
            </div>
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">
              <strong>Request reason</strong>
              <p className="mt-1 whitespace-pre-wrap">{lessonPlanRequestItem.details?.reason || 'No reason provided.'}</p>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              {lessonPlanRequestItem.module === 'Lesson Plan Edit Request'
                ? 'Approving gives the Cluster Admin permission to edit and resubmit this lesson plan.'
                : 'Approving permanently deletes the lesson plan. This action cannot be undone.'}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => {
                const lessonPlanId = lessonPlanRequestItem.recordId;
                setLessonPlanRequestItem(null);
                onNavigate('lesson-plan', lessonPlanId);
              }} className="mr-auto rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">View Full Lesson Plan</button>
              <button type="button" disabled={isReviewingLessonPlanRequest} onClick={async () => {
                setIsReviewingLessonPlanRequest(true);
                try { await onReviewLessonPlanRequest(lessonPlanRequestItem.id, 'reject'); setLessonPlanRequestItem(null); }
                catch (error) { alert(error instanceof Error ? error.message : 'Unable to reject request.'); }
                finally { setIsReviewingLessonPlanRequest(false); }
              }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Reject Request</button>
              <button type="button" disabled={isReviewingLessonPlanRequest} onClick={async () => {
                setIsReviewingLessonPlanRequest(true);
                try { await onReviewLessonPlanRequest(lessonPlanRequestItem.id, 'approve'); setLessonPlanRequestItem(null); }
                catch (error) { alert(error instanceof Error ? error.message : 'Unable to approve request.'); }
                finally { setIsReviewingLessonPlanRequest(false); }
              }} className="rounded-xl bg-[#0D3A7A] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


