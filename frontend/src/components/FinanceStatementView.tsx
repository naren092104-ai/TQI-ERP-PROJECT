import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { TabType, FinanceEntry, FinanceDraft, RouteDraftItem, FoodDraftItem, Session, UserRole } from '../types';
import { TqiLogo } from './TqiLogo';
import { NewFinanceModal } from './NewFinanceModal';
import { exportFinanceStatementAsPdf } from '../utils/pdf/exportStatement';
import { checkImageClarity, extractRouteAndDetailsFromText } from '../utils/billParser';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
\
interface StatementItem {
  id: string;
  sNo: number;
  category: 'Travel' | 'Food' | 'Stationery' | 'Other' | 'Materials' | 'Admin';
  description: string;
  count: string;
  countAmount: string;
  total: number;
  billUrl: string | null;
  billFileName?: string;
  billDetectedAmount?: number;
  remarks: string;
  rawType?: 'route' | 'food' | 'stationery' | 'other' | 'entry';
  rawId?: string;
  foodKey?: 'breakfast' | 'lunch' | 'dinner' | 'refreshments';
}

interface FinanceStatementViewProps {
  academicYear?: string;
  onBack: () => void;
  onNavigate: (tab: TabType, targetId?: string) => void;
  entries?: FinanceEntry[];
  drafts?: FinanceDraft[];
  sessions?: Session[];
  clusterId?: string;
  activeDraftId?: string;
  canManageDrafts?: boolean;
  userRole?: UserRole;
  clusterName?: string;
  collegeName?: string;
  spocName?: string;
  financerName?: string;
  sessionDay?: string;
  date?: string;
  onSaveDraft?: (draft: FinanceDraft) => void | Promise<void>;
  onDeleteDraft?: (draftId: string) => void;
  onSubmitDraft?: (draftId: string, missingBillReason?: string) => void | Promise<void>;
  onApproveReport?: (draftId?: string) => void | Promise<void>;
  onRejectReport?: (draftId?: string, reason?: string) => void | Promise<void>;
  onAddFinanceEntry?: (entry: Omit<FinanceEntry, 'id'>) => void | Promise<void>;
  onUpdateFinanceEntry?: (id: string, updated: Partial<FinanceEntry>) => void | Promise<void>;
  onDeleteFinanceEntry?: (id: string) => void | Promise<void>;
  onRequestFinanceEdit?: (entryId: string, reason: string) => void | Promise<void>;
}

export const FinanceStatementView: React.FC<FinanceStatementViewProps> = ({
  academicYear = '',
  onBack,
  onNavigate,
  entries = [],
  drafts = [],
  sessions = [],
  clusterId = '',
  activeDraftId,
  canManageDrafts = true,
  userRole = 'Cluster Admin',
  clusterName = 'Cluster',
  collegeName = 'Partner Institution',
  spocName = '',
  financerName = 'TQI Finance Team',
  sessionDay = 'Day 1',
  date = '',
  onSaveDraft,
  onDeleteDraft,
  onSubmitDraft,
  onApproveReport,
  onRejectReport,
  onAddFinanceEntry,
  onUpdateFinanceEntry,
  onDeleteFinanceEntry,
  onRequestFinanceEdit,
}) => {
  const defaultStatementViewKey =
    activeDraftId ||
    (drafts.length > 0 ? drafts[0].id : canManageDrafts ? `Day ${sessions[0]?.dayNumber || 1}` : 'all-approved');

  const [selectedViewKey, setSelectedViewKey] = useState<string>(defaultStatementViewKey);

  // Bill Lightbox Modal state
  const [activeBillViewer, setActiveBillViewer] = useState<{
    url: string;
    title: string;
    category: string;
    amount?: number;
    fileName?: string;
    itemId?: string;
  } | null>(null);

  const [billZoom, setBillZoom] = useState<number>(1);
  const [billRotate, setBillRotate] = useState<number>(0);

  // Edit Expense Row Modal state
  const [editingItem, setEditingItem] = useState<StatementItem | null>(null);

  // Add Expense Row Modal state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showDraftEditor, setShowDraftEditor] = useState(false);
  const [isCreatingAdditionalDraft, setIsCreatingAdditionalDraft] = useState(false);
  const [editRequestReason, setEditRequestReason] = useState('');
  const [isEditRequestOpen, setIsEditRequestOpen] = useState(false);
  const [isSubmittingEditRequest, setIsSubmittingEditRequest] = useState(false);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [missingBillReason, setMissingBillReason] = useState('');
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [approvedCheck, setApprovedCheck] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [newExpenseForm, setNewExpenseForm] = useState<{
    category: 'Travel' | 'Food' | 'Stationery' | 'Other';
    description: string;
    count: string;
    perPerson: string;
    totalAmount: string;
    remarks: string;
    billUrl: string | null;
    billFileName: string;
    billDetectedAmount?: number;
  }>({
    category: 'Travel',
    description: '',
    count: '',
    perPerson: '',
    totalAmount: '',
    remarks: '',
    billUrl: null,
    billFileName: '',
    billDetectedAmount: undefined,
  });

  // Edit Metadata Modal state
  const [showEditMetaModal, setShowEditMetaModal] = useState<boolean>(false);
  const [metaForm, setMetaForm] = useState<{
    collegeName: string;
    clusterName: string;
    sessionName: string;
    sessionDay: string;
    date: string;
    spocName: string;
    financerName: string;
  }>({
    collegeName,
    clusterName,
    sessionName: 'Day 2 - Travel & Refreshments Sheet',
    sessionDay,
    date,
    spocName,
    financerName,
  });

  // Full Statement / All Bills Modal state
  const [showFullStatementModal, setShowFullStatementModal] = useState<boolean>(false);
  const [showFullStatementPreview, setShowFullStatementPreview] = useState<boolean>(false);
  const [showAllBillsModal, setShowAllBillsModal] = useState<boolean>(false);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState<number>(0);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Find if current view is a draft
  const currentDraft = useMemo(() => {
    return drafts.find((d) => d.id === selectedViewKey) || null;
  }, [drafts, selectedViewKey]);

  const scheduledSession = useMemo(() => {
    const dayNumber = Number((currentDraft?.sessionDay || selectedViewKey).match(/\d+/)?.[0] || 0);
    if (!dayNumber) return undefined;
    return sessions.find((session) => Number(session.dayNumber) === dayNumber && (!clusterId || session.clusterId === clusterId));
  }, [sessions, clusterId, currentDraft, selectedViewKey]);

  const selectedEntries = useMemo(() => {
    if (selectedViewKey === 'all-approved') {
      return entries.filter((entry) => entry.status === 'Approved');
    }
    if (currentDraft || entries.some((entry) => entry.draftId === selectedViewKey)) {
      const selectedDraftId = currentDraft?.id || selectedViewKey;
      return entries.filter((entry) => entry.draftId === selectedDraftId);
    }

    const selectedDayNumber = Number((currentDraft?.sessionDay || selectedViewKey).match(/\d+/)?.[0] || 0);
    const matchingSession = scheduledSession || sessions.find((session) =>
      selectedDayNumber > 0 && Number(session.dayNumber) === selectedDayNumber && (!clusterId || session.clusterId === clusterId)
    );

    const matchingDayEntries = entries.filter((entry) => {
      const matchesDraft = Boolean(entry.draftId && (
        entry.draftId === currentDraft?.id || entry.draftId === selectedViewKey
      ));
      const entryDayNumber = Number((entry.sessionDay || '').match(/\d+/)?.[0] || 0);
      const matchesDay = selectedDayNumber > 0 && entryDayNumber === selectedDayNumber;
      const matchesSession = Boolean(matchingSession && entry.sessionId === matchingSession.id);
      const matchesDate = Boolean(matchingSession?.date && entry.date?.slice(0, 10) === matchingSession.date.slice(0, 10));
      const matchesSelectedKey = entry.sessionDay === selectedViewKey;
      return matchesDraft || matchesDay || matchesSession || matchesDate || matchesSelectedKey;
    });
    // A day card is a navigation fallback, not a request to combine separate
    // report drafts for that day. Select one report ID deterministically.
    const reportIds = Array.from(new Set(matchingDayEntries.map((entry) => entry.draftId).filter(Boolean))) as string[];
    if (reportIds.length > 1) {
      const newestReportId = reportIds.sort((left, right) => {
        const leftTime = Number(left.match(/(\d{10,})$/)?.[1] || 0);
        const rightTime = Number(right.match(/(\d{10,})$/)?.[1] || 0);
        return rightTime - leftTime || right.localeCompare(left);
      })[0];
      return matchingDayEntries.filter((entry) => entry.draftId === newestReportId);
    }
    return matchingDayEntries;
  }, [entries, selectedViewKey, currentDraft, scheduledSession, sessions, clusterId]);

  const selectedDraftId = currentDraft?.id || (entries.some((entry) => entry.draftId === selectedViewKey) ? selectedViewKey : null) || selectedEntries.find((entry) => entry.draftId)?.draftId || null;
  const selectedSheetStatus: string = currentDraft?.status || (selectedEntries.some((entry) => entry.status === 'Pending')
    ? 'Pending'
    : selectedEntries.length > 0 && selectedEntries.every((entry) => entry.status === 'Approved')
      ? 'Approved'
      : selectedEntries.some((entry) => entry.status === 'Correction')
        ? 'Correction Requested'
        : selectedEntries.some((entry) => entry.status === 'Draft')
          ? 'Draft'
          : '');
  const editRequestStatus = currentDraft?.editRequestStatus || 'NONE';
  const editPermissionGranted = Boolean(currentDraft?.editPermission) || editRequestStatus === 'APPROVED';
  const reportHistory = currentDraft?.history || [];
  const latestRejectionIndex = reportHistory.reduce((latest, item, index) => item.event === 'Finance report rejected' ? index : latest, -1);
  const latestSubmissionIndex = reportHistory.reduce((latest, item, index) => /report (?:re)?submitted/i.test(item.event) ? index : latest, -1);
  const hasUnresolvedCorrection = latestRejectionIndex >= 0 && latestRejectionIndex > latestSubmissionIndex;
  const correctionFeedback = [...reportHistory].reverse()
    .find((item) => item.event === 'Finance report rejected' && item.details.trim())?.details;
  const rejectedReportNeedsCorrection = currentDraft?.reportStatus === 'REJECTED';
  const canEditSelectedSheet = canManageDrafts && selectedViewKey !== 'all-approved' &&
    (selectedSheetStatus === 'Draft' || rejectedReportNeedsCorrection || editPermissionGranted);
  const canAddEntryToSelectedSheet = canManageDrafts && selectedViewKey !== 'all-approved' &&
    ((selectedSheetStatus === 'Draft' && !hasUnresolvedCorrection) || selectedSheetStatus === '');
  const canRequestEditSelectedSheet = canManageDrafts && selectedViewKey !== 'all-approved' &&
    ['Approved', 'Pending'].includes(selectedSheetStatus) && selectedEntries.length > 0 && Boolean(onRequestFinanceEdit) && !editPermissionGranted && editRequestStatus !== 'PENDING';
  const isSuperAdmin = userRole === 'Super Admin';

  // Derive statement metadata
  const statementMeta = useMemo(() => {
    if (currentDraft) {
      return {
        collegeName: collegeName || currentDraft.collegeName,
        clusterName: currentDraft.clusterName || clusterName,
        sessionName: scheduledSession?.name || scheduledSession?.title || currentDraft.title,
        sessionDay: scheduledSession ? `Day ${scheduledSession.dayNumber}` : currentDraft.sessionDay || sessionDay,
        date: scheduledSession?.date?.slice(0, 10) || currentDraft.sessionDate || date,
        spocName: spocName || currentDraft.spocName,
        financerName: financerName || currentDraft.financerName,
        isDraft: currentDraft.status === 'Draft',
        status: currentDraft.status === 'Pending' ? 'Submitted' : currentDraft.status || 'Draft',
      };
    }

    if (selectedViewKey === 'all-approved') {
      return {
        collegeName,
        clusterName,
        sessionName: 'Combined Finance Statement',
        sessionDay: 'All Sessions',
        date: date,
        spocName,
        financerName,
        isDraft: false,
        status: selectedEntries.length > 0 ? 'Approved' : 'Not Submitted',
      };
    }

    return {
      collegeName,
      clusterName,
      sessionName: scheduledSession?.name || scheduledSession?.title || `${selectedViewKey} Finance Statement`,
      sessionDay: scheduledSession ? `Day ${scheduledSession.dayNumber}` : selectedViewKey,
      date: scheduledSession?.date?.slice(0, 10) || selectedEntries.find((entry) => entry.date)?.date || date,
      spocName,
      financerName,
      isDraft: selectedEntries.length > 0 && selectedEntries.every((entry) => entry.status === 'Draft'),
      status: selectedEntries.length === 0
        ? 'Not Submitted'
        : selectedEntries.some((entry) => entry.status === 'Correction')
          ? 'Correction Requested'
          : selectedEntries.some((entry) => entry.status === 'Pending')
            ? 'Submitted'
            : selectedEntries.every((entry) => entry.status === 'Approved')
              ? 'Approved'
              : 'Draft',
    };
  }, [currentDraft, selectedViewKey, collegeName, clusterName, sessionDay, date, spocName, financerName, scheduledSession, selectedEntries]);

  // Synchronize metadata modal form whenever current view changes
  React.useEffect(() => {
    setMetaForm({
      collegeName: statementMeta.collegeName,
      clusterName: statementMeta.clusterName,
      sessionName: statementMeta.sessionName,
      sessionDay: statementMeta.sessionDay,
      date: statementMeta.date,
      spocName: statementMeta.spocName,
      financerName: statementMeta.financerName,
    });
  }, [statementMeta, selectedViewKey]);

  // Compute table line items dynamically
  const tableItems: StatementItem[] = useMemo(() => {
    // Finance entry rows are the persisted source of truth. Do not render
    // unsaved expense arrays from report metadata as if they had been saved.
    if (selectedEntries.length > 0 || currentDraft) {
      return selectedEntries.map((entry, index) => ({
        id: entry.id,
        sNo: index + 1,
        category: entry.category as StatementItem['category'],
        description: entry.description,
        count: entry.count ? String(entry.count) : '—',
        countAmount: entry.countAmount || '—',
        total: Number(entry.amount || 0),
        billUrl: entry.billUrl || null,
        billFileName: entry.billReference || '',
        remarks: entry.remarks || '—',
        rawType: 'entry',
        rawId: entry.id,
      }));
    }

    // 1. If viewing a structured Draft
    if (currentDraft) {
      const items: StatementItem[] = [];
      let sNo = 1;

      // Travel routes
      if (currentDraft.routes) {
        currentDraft.routes.forEach((r, idx) => {
          const total = (r.volunteers || 0) * (r.perPerson || 0);
          if (total <= 0 && !r.from?.trim() && !r.to?.trim()) return;
          items.push({
            id: r.id || `route-${idx}`,
            sNo: sNo++,
            category: 'Travel',
            description: `${r.from || 'Origin'} → ${r.to || 'Destination'}`,
            count: r.volunteers ? String(r.volunteers) : '—',
            countAmount: r.volunteers && r.perPerson ? `${r.volunteers}×${r.perPerson}` : '—',
            total: total,
            billUrl: r.bill?.url || null,
            billFileName: r.bill?.fileName || '',
            remarks: r.remarks || '—',
            rawType: 'route',
            rawId: r.id,
          });
        });
      }

      // Food items
      if (currentDraft.food) {
        if (currentDraft.food.breakfast && (currentDraft.food.breakfast.amount > 0 || currentDraft.food.breakfast.remarks)) {
          items.push({
            id: 'food-breakfast',
            sNo: sNo++,
            category: 'Food',
            description: 'Breakfast',
            count: '—',
            countAmount: '—',
            total: currentDraft.food.breakfast.amount || 0,
            billUrl: currentDraft.food.breakfast.bill?.url || null,
            billFileName: currentDraft.food.breakfast.bill?.fileName || '',
            remarks: currentDraft.food.breakfast.remarks || '—',
            rawType: 'food',
            foodKey: 'breakfast',
          });
        }

        if (currentDraft.food.lunch && (currentDraft.food.lunch.amount > 0 || currentDraft.food.lunch.remarks)) {
          items.push({
            id: 'food-lunch',
            sNo: sNo++,
            category: 'Food',
            description: 'Lunch',
            count: '—',
            countAmount: '—',
            total: currentDraft.food.lunch.amount || 0,
            billUrl: currentDraft.food.lunch.bill?.url || null,
            billFileName: currentDraft.food.lunch.bill?.fileName || '',
            remarks: currentDraft.food.lunch.remarks || '—',
            rawType: 'food',
            foodKey: 'lunch',
          });
        }

        if (currentDraft.food.dinner && (currentDraft.food.dinner.amount > 0 || currentDraft.food.dinner.remarks)) {
          items.push({
            id: 'food-dinner',
            sNo: sNo++,
            category: 'Food',
            description: 'Dinner',
            count: '—',
            countAmount: '—',
            total: currentDraft.food.dinner.amount || 0,
            billUrl: currentDraft.food.dinner.bill?.url || null,
            billFileName: currentDraft.food.dinner.bill?.fileName || '',
            remarks: currentDraft.food.dinner.remarks || '—',
            rawType: 'food',
            foodKey: 'dinner',
          });
        }

        if (currentDraft.food.refreshments && (currentDraft.food.refreshments.amount > 0 || currentDraft.food.refreshments.remarks)) {
          items.push({
            id: 'food-refreshments',
            sNo: sNo++,
            category: 'Food',
            description: 'Refreshments & Tea',
            count: '—',
            countAmount: '—',
            total: currentDraft.food.refreshments.amount || 0,
            billUrl: currentDraft.food.refreshments.bill?.url || null,
            billFileName: currentDraft.food.refreshments.bill?.fileName || '',
            remarks: currentDraft.food.refreshments.remarks || '—',
            rawType: 'food',
            foodKey: 'refreshments',
          });
        }
      }

      // Stationery
      if (currentDraft.stationery && (currentDraft.stationery.amount > 0 || currentDraft.stationery.remarks)) {
        items.push({
          id: 'stationery-main',
          sNo: sNo++,
          category: 'Stationery',
          description: 'Materials & Notebooks',
          count: '—',
          countAmount: '—',
          total: currentDraft.stationery.amount || 0,
          billUrl: currentDraft.stationery.bill?.url || null,
          billFileName: currentDraft.stationery.bill?.fileName || '',
          remarks: currentDraft.stationery.remarks || '—',
          rawType: 'stationery',
        });
      }

      // Other items
      if (currentDraft.otherItems) {
        currentDraft.otherItems.forEach((ot, idx) => {
          if (ot.amount > 0 || ot.description || ot.remarks) {
            items.push({
              id: ot.id || `other-${idx}`,
              sNo: sNo++,
              category: 'Other',
              description: ot.description || 'Expense',
              count: '—',
              countAmount: '—',
              total: ot.amount || 0,
              billUrl: ot.bill?.url || null,
              billFileName: ot.bill?.fileName || '',
              remarks: ot.remarks || '—',
              rawType: 'other',
              rawId: ot.id,
            });
          }
        });
      }

      return items;
    }

    // 2. Otherwise use entries list
    const sourceEntries = selectedEntries;

    if (sourceEntries.length === 0) {
      return [];
    }

    return sourceEntries.map((e, idx) => ({
      id: e.id,
      sNo: idx + 1,
      category: e.category as any,
      description: e.description,
      count: e.count ? String(e.count) : '—',
      countAmount: e.countAmount || '—',
      total: e.amount,
      billUrl: e.billUrl || null,
      billFileName: e.billReference || '',
      remarks: e.remarks || '—',
      rawType: 'entry',
      rawId: e.id,
    }));
  }, [currentDraft, selectedViewKey, selectedEntries]);

  // Subtotals
  const travelTotal = useMemo(() => {
    return tableItems
      .filter((i) => i.category === 'Travel')
      .reduce((sum, i) => sum + i.total, 0);
  }, [tableItems]);

  const foodTotal = useMemo(() => {
    return tableItems
      .filter((i) => i.category === 'Food')
      .reduce((sum, i) => sum + i.total, 0);
  }, [tableItems]);

  const stationeryTotal = useMemo(() => {
    return tableItems
      .filter((i) => i.category === 'Stationery' || i.category === 'Materials')
      .reduce((sum, i) => sum + i.total, 0);
  }, [tableItems]);

  const otherTotal = useMemo(() => {
    return tableItems
      .filter((i) => i.category === 'Other' || i.category === 'Admin')
      .reduce((sum, i) => sum + i.total, 0);
  }, [tableItems]);

  const grandTotal = travelTotal + foodTotal + stationeryTotal + otherTotal;

  // Extract all attached bills for gallery
  const allAttachedBills = useMemo(() => {
    return tableItems
      .filter((item) => item.billUrl)
      .map((item) => ({
        id: item.id || `bill-${item.sNo}`,
        url: item.billUrl!,
        title: `${item.category}: ${item.description}`,
        category: item.category,
        amount: item.total,
        remarks: item.remarks,
        fileName: item.billFileName || `${item.category}_Receipt.jpg`,
      }));
  }, [tableItems]);

  const shouldDisplayDetailedStatement =
    showFullStatementPreview ||
    !!currentDraft ||
    (statementMeta.status === 'Approved' && tableItems.length > 0) ||
    (selectedViewKey === 'all-approved' && tableItems.length > 0) ||
    (selectedViewKey !== 'all-approved' && (tableItems.length > 0 || canManageDrafts));

  // SUBMIT STATEMENT FOR APPROVAL (Volunteer / SPOC action only - No direct approve button)
  const handleSubmitStatement = async () => {
    const draftEntries = entries.filter((entry) => entry.draftId === selectedDraftId);
    const draftId = selectedDraftId;

    if (draftId && onSubmitDraft) {
      if (!draftEntries.length) {
        alert('Add at least one expense entry before submitting this report.');
        return;
      }
      const incomplete = draftEntries.find((entry) => !entry.description.trim() || !Number.isFinite(Number(entry.amount)) || entry.amount <= 0);
      if (incomplete) {
        alert(`Complete the description and enter a valid amount greater than zero for "${incomplete.description || 'this expense'}".`);
        return;
      }
      const missingBillEntries = draftEntries.filter((entry) => !entry.billUrl && !entry.billReference);
      const mismatchedBillEntries = draftEntries.filter((entry) => {
        const detectedAmount = Number(entry.billDetectedAmount ?? 0);
        return Boolean(entry.billUrl) && detectedAmount > 0 && Math.abs(Number(entry.amount) - detectedAmount) > 0.01;
      });
      if (mismatchedBillEntries.length > 0) {
        const entry = mismatchedBillEntries[0];
        alert(`"${entry.description}" does not match the uploaded bill amount. Upload a valid bill or correct the entry amount before submitting.`);
        return;
      }
      const plannedDate = currentDraft?.sessionDate || scheduledSession?.date?.slice(0, 10) || draftEntries.find((entry) => entry.date)?.date;
      if (!plannedDate) {
        alert('Please edit this draft and select a planned date before submitting.');
        return;
      }
      const reasonForMissingBill = missingBillEntries.length > 0 ? missingBillReason.trim() : undefined;
      if (missingBillEntries.length > 0 && !reasonForMissingBill) {
        alert('A valid reason is required for every missing bill before this report can be submitted for review.');
        return;
      }
      try {
        await onSubmitDraft(draftId, reasonForMissingBill);
        setIsSubmitConfirmOpen(false);
        setMissingBillReason('');
        showToast(`Finance Statement for "${statementMeta.sessionDay}" submitted for review!`);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Unable to submit this finance statement.');
      }
    } else {
      alert('Save this day as a draft before submitting it for approval.');
    }
  };

  const requestSubmitConfirmation = () => {
    if (!selectedDraftId || selectedEntries.length === 0) {
      alert('Add at least one expense entry before submitting this report.');
      return;
    }
    const invalidEntry = selectedEntries.find((entry) => !entry.description.trim() || !Number.isFinite(Number(entry.amount)) || entry.amount <= 0);
    if (invalidEntry) {
      alert(`Complete the description and enter a valid amount greater than zero for "${invalidEntry.description || 'this expense'}".`);
      return;
    }
    const missingBillEntries = selectedEntries.filter((entry) => !entry.billUrl && !entry.billReference);
    const mismatchedBillEntries = selectedEntries.filter((entry) => {
      const detectedAmount = Number(entry.billDetectedAmount ?? 0);
      return Boolean(entry.billUrl) && detectedAmount > 0 && Math.abs(Number(entry.amount) - detectedAmount) > 0.01;
    });
    if (mismatchedBillEntries.length > 0) {
      const badEntry = mismatchedBillEntries[0];
      alert(`"${badEntry.description}" does not match the uploaded bill amount. Upload a valid bill or correct the entry amount before submitting.`);
      return;
    }
    if (!statementMeta.date) {
      alert('Please select a planned date before submitting this finance report.');
      return;
    }
    if (missingBillEntries.length > 0) {
      setMissingBillReason('');
    }
    setIsSubmitConfirmOpen(true);
  };

  const handleSubmitEditRequest = async () => {
    const entry = selectedEntries.find((item) => item.status === 'Approved') || selectedEntries[0];
    if (!entry || !onRequestFinanceEdit) return;
    if (!editRequestReason.trim()) {
      alert('Please provide a reason for requesting an edit.');
      return;
    }
    setIsSubmittingEditRequest(true);
    try {
      await onRequestFinanceEdit(entry.id, editRequestReason.trim());
      setIsEditRequestOpen(false);
      setEditRequestReason('');
      showToast('Finance edit request submitted for review.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to request a finance edit.');
    } finally {
      setIsSubmittingEditRequest(false);
    }
  };

  // SAVE EDITED EXPENSE ROW
  const handleSaveEditedRow = async () => {
    if (!editingItem) return;

    if (editingItem.rawType === 'entry' && editingItem.rawId && onUpdateFinanceEntry) {
      await onUpdateFinanceEntry(editingItem.rawId, {
        description: editingItem.description,
        category: editingItem.category as FinanceEntry['category'],
        amount: editingItem.total,
        remarks: editingItem.remarks,
        billUrl: editingItem.billUrl || undefined,
        billReference: editingItem.billFileName || undefined,
        billDetectedAmount: editingItem.billDetectedAmount ?? (editingItem.billUrl ? editingItem.total : undefined),
        count: parseInt(editingItem.count) || undefined,
        countAmount: editingItem.countAmount || undefined,
      });
      showToast(`Updated "${editingItem.description}"`);
    } else if (currentDraft && onSaveDraft) {
      const updatedDraft: FinanceDraft = { ...currentDraft };

      if (editingItem.rawType === 'route' && editingItem.rawId) {
        const vols = parseInt(editingItem.count) || 0;
        let perP = 0;
        if (editingItem.countAmount.includes('×')) {
          perP = parseFloat(editingItem.countAmount.split('×')[1]) || 0;
        } else if (vols > 0) {
          perP = editingItem.total / vols;
        }

        const parts = editingItem.description.split('→');
        const from = parts[0]?.trim() || 'Origin';
        const to = parts[1]?.trim() || 'Destination';

        updatedDraft.routes = updatedDraft.routes.map((r) =>
          r.id === editingItem.rawId
            ? {
                ...r,
                from,
                to,
                volunteers: vols,
                perPerson: perP,
                remarks: editingItem.remarks,
                bill: editingItem.billUrl
                  ? {
                      url: editingItem.billUrl,
                      fileName: editingItem.billFileName || 'Travel_Bill.jpg',
                      detectedAmount: editingItem.total,
                    }
                  : null,
              }
            : r
        );
      } else if (editingItem.rawType === 'food' && editingItem.foodKey) {
        updatedDraft.food = {
          ...updatedDraft.food,
          [editingItem.foodKey]: {
            amount: editingItem.total,
            remarks: editingItem.remarks,
            bill: editingItem.billUrl
              ? {
                  url: editingItem.billUrl,
                  fileName: editingItem.billFileName || 'Food_Bill.jpg',
                  detectedAmount: editingItem.total,
                }
              : null,
          },
        };
      } else if (editingItem.rawType === 'stationery') {
        updatedDraft.stationery = {
          amount: editingItem.total,
          remarks: editingItem.remarks,
          bill: editingItem.billUrl
            ? {
                url: editingItem.billUrl,
                fileName: editingItem.billFileName || 'Stationery_Bill.jpg',
                detectedAmount: editingItem.total,
              }
            : null,
        };
      } else if (editingItem.rawType === 'other' && editingItem.rawId) {
        updatedDraft.otherItems = updatedDraft.otherItems.map((ot) =>
          ot.id === editingItem.rawId
            ? {
                ...ot,
                description: editingItem.description,
                amount: editingItem.total,
                remarks: editingItem.remarks,
                bill: editingItem.billUrl
                  ? {
                      url: editingItem.billUrl,
                      fileName: editingItem.billFileName || 'Other_Bill.jpg',
                      detectedAmount: editingItem.total,
                    }
                  : null,
              }
            : ot
        );
      }

      // Re-sum
      const newTravel = updatedDraft.routes.reduce((s, r) => s + (r.volunteers || 0) * (r.perPerson || 0), 0);
      const newFood =
        (updatedDraft.food.breakfast?.amount || 0) +
        (updatedDraft.food.lunch?.amount || 0) +
        (updatedDraft.food.dinner?.amount || 0) +
        (updatedDraft.food.refreshments?.amount || 0);
      const newStationery = updatedDraft.stationery?.amount || 0;
      const newOther = updatedDraft.otherItems.reduce((s, o) => s + (o.amount || 0), 0);
      updatedDraft.totalAmount = newTravel + newFood + newStationery + newOther;

      await onSaveDraft(updatedDraft);
      showToast(`Updated "${editingItem.description}"`);
    }

    setEditingItem(null);
  };

  // ADD NEW EXPENSE ROW TO STATEMENT
  const handleAddNewExpenseRow = async () => {
    if (!newExpenseForm.description && !newExpenseForm.totalAmount) {
      alert('Please fill in description or amount');
      return;
    }

    const totalAmt = parseFloat(newExpenseForm.totalAmount) || 0;
    const vols = parseInt(newExpenseForm.count) || 0;
    const perP = parseFloat(newExpenseForm.perPerson) || 0;
    const finalAmount = totalAmt > 0 ? totalAmt : vols * perP;
    const newEntryDraftId = currentDraft?.id || selectedDraftId ||
      (selectedViewKey !== 'all-approved' ? `draft-day-${Date.now()}` : undefined);
    const newFinanceEntry: Omit<FinanceEntry, 'id'> = {
      date: statementMeta.date,
      description: newExpenseForm.description || 'Expense Entry',
      category: newExpenseForm.category,
      amount: finalAmount,
      panchayatId: 'dharmapuri-main',
      panchayatName: statementMeta.clusterName,
      villageName: 'Cluster Center',
      status: 'Draft',
      billUrl: newExpenseForm.billUrl || undefined,
      billDetectedAmount: newExpenseForm.billDetectedAmount ?? (newExpenseForm.billUrl ? finalAmount : undefined),
      remarks: newExpenseForm.remarks,
      count: vols || undefined,
      countAmount: vols && perP ? `${vols}×${perP}` : undefined,
      sessionDay: statementMeta.sessionDay,
      sessionId: scheduledSession?.id,
      clusterId: clusterId || undefined,
      clusterName,
      draftId: newEntryDraftId,
    };

    if (currentDraft && onSaveDraft) {
      const updatedDraft: FinanceDraft = { ...currentDraft };

      if (newExpenseForm.category === 'Travel') {
        const parts = newExpenseForm.description.split('→');
        const from = parts[0]?.trim() || 'Origin';
        const to = parts[1]?.trim() || 'Destination';

        const newRoute: RouteDraftItem = {
          id: `route-${Date.now()}`,
          from,
          to,
          volunteers: vols || 1,
          perPerson: perP || finalAmount,
          remarks: newExpenseForm.remarks,
          bill: newExpenseForm.billUrl
            ? {
                url: newExpenseForm.billUrl,
                fileName: newExpenseForm.billFileName || 'Travel_Bill.jpg',
                detectedAmount: finalAmount,
                isVerified: true,
              }
            : null,
        };
        updatedDraft.routes = [...updatedDraft.routes, newRoute];
      } else if (newExpenseForm.category === 'Food') {
        // add to refreshments or custom
        updatedDraft.food = {
          ...updatedDraft.food,
          refreshments: {
            amount: (updatedDraft.food.refreshments?.amount || 0) + finalAmount,
            remarks: newExpenseForm.remarks || newExpenseForm.description,
            bill: newExpenseForm.billUrl
              ? {
                  url: newExpenseForm.billUrl,
                  fileName: newExpenseForm.billFileName || 'Food_Bill.jpg',
                  detectedAmount: finalAmount,
                  isVerified: true,
                }
              : updatedDraft.food.refreshments?.bill || null,
          },
        };
      } else if (newExpenseForm.category === 'Stationery') {
        updatedDraft.stationery = {
          amount: (updatedDraft.stationery?.amount || 0) + finalAmount,
          remarks: newExpenseForm.remarks || newExpenseForm.description,
          bill: newExpenseForm.billUrl
            ? {
                url: newExpenseForm.billUrl,
                fileName: newExpenseForm.billFileName || 'Stationery_Bill.jpg',
                detectedAmount: finalAmount,
                isVerified: true,
              }
            : updatedDraft.stationery?.bill || null,
        };
      } else {
        const newOther = {
          id: `other-${Date.now()}`,
          description: newExpenseForm.description || 'Miscellaneous Expense',
          amount: finalAmount,
          remarks: newExpenseForm.remarks,
          bill: newExpenseForm.billUrl
            ? {
                url: newExpenseForm.billUrl,
                fileName: newExpenseForm.billFileName || 'Other_Slip.jpg',
                detectedAmount: finalAmount,
                isVerified: true,
              }
            : null,
        };
        updatedDraft.otherItems = [...updatedDraft.otherItems, newOther];
      }

      // Re-sum
      const newTravel = updatedDraft.routes.reduce((s, r) => s + (r.volunteers || 0) * (r.perPerson || 0), 0);
      const newFood =
        (updatedDraft.food.breakfast?.amount || 0) +
        (updatedDraft.food.lunch?.amount || 0) +
        (updatedDraft.food.dinner?.amount || 0) +
        (updatedDraft.food.refreshments?.amount || 0);
      const newStationery = updatedDraft.stationery?.amount || 0;
      const newOther = updatedDraft.otherItems.reduce((s, o) => s + (o.amount || 0), 0);
      updatedDraft.totalAmount = newTravel + newFood + newStationery + newOther;

      await onSaveDraft(updatedDraft);
      await onAddFinanceEntry?.(newFinanceEntry);
      showToast(`Added "${newExpenseForm.description}" to statement`);
    } else if (onAddFinanceEntry) {
      await onAddFinanceEntry(newFinanceEntry);
      if (newEntryDraftId) setSelectedViewKey(newEntryDraftId);
      showToast(`Added expense row`);
    }

    setShowAddModal(false);
    setNewExpenseForm({
      category: 'Travel',
      description: '',
      count: '',
      perPerson: '',
      totalAmount: '',
      remarks: '',
      billUrl: null,
      billFileName: '',
    });
  };

  // SAVE METADATA CHANGES
  const handleSaveMetadata = async () => {
    if (currentDraft && onSaveDraft) {
      const updatedDraft: FinanceDraft = {
        ...currentDraft,
        title: metaForm.sessionName,
        collegeName: metaForm.collegeName,
        clusterName: metaForm.clusterName,
        sessionDay: metaForm.sessionDay,
        sessionDate: metaForm.date,
        spocName: metaForm.spocName,
        financerName: metaForm.financerName,
      };
      await onSaveDraft(updatedDraft);
      showToast('Statement details updated');
    } else {
      showToast('Metadata updated for preview');
    }
    setShowEditMetaModal(false);
  };

  // EXCEL (.XLSX) EXPORT USING XLSX LIBRARY
  // Layout: 8 columns (A..H). Title / banner / section header rows are
  // merged across all 8 columns so the document reads as a real report
  // rather than eight parallel columns of stranded text. Totals are
  // aligned to the right of the Total (INR) column with the label
  // sitting flush against the value.
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [];
    const merges: XLSX.Range[] = [];
    // Track which row index holds which banner so we can merge them.
    const pushMergedBanner = (text: string) => {
      const r = wsData.length;
      wsData.push([text, '', '', '', '', '', '', '']);
      merges.push({ s: { r, c: 0 }, e: { r, c: 7 } });
    };

    // ── Title block (each row merged A:H) ─────────────────────────
    pushMergedBanner('TALENT QUEST FOR INDIA');
    pushMergedBanner('Academic Year 2026 – 2027');
    pushMergedBanner('OFFICIAL FINANCE STATEMENT');
    wsData.push([]); // spacer

    // ── Meta grid: three label/value pairs per row (A:B, D:E, G:H) ──
    wsData.push([
      'COLLEGE', statementMeta.collegeName, '',
      'SESSION', statementMeta.sessionName,
    ]);
    wsData.push([
      'DATE', statementMeta.date, '',
      'SPOC', statementMeta.spocName, '',
      'FINANCER', statementMeta.financerName,
    ]);
    wsData.push([
      'DAY', statementMeta.sessionDay, '',
      'STATUS', statementMeta.status, '',
      '', '',
    ]);
    wsData.push([]); // spacer

    // ── Section banner + table header row ────────────────────────
    pushMergedBanner('EXPENSE DETAILS');
    wsData.push([
      'S.No',
      'Category',
      'Description',
      'Count',
      'Count × Amount',
      'Total (INR)',
      'Bills Attached',
      'Remarks',
    ]);

    // ── Data rows ────────────────────────────────────────────────
    tableItems.forEach((item) => {
      wsData.push([
        item.sNo,
        item.category,
        item.description,
        item.count,
        item.countAmount,
        item.total,
        item.billUrl ? 'Yes (Receipt Attached)' : 'None',
        item.remarks,
      ]);
    });

    // ── Totals — label in col E, value in col F (right of Total col)
    wsData.push([]); // spacer
    if (travelTotal > 0) {
      wsData.push(['', '', '', '', 'Travel Subtotal', travelTotal, '', '']);
    }
    if (foodTotal > 0) {
      wsData.push(['', '', '', '', 'Food Subtotal', foodTotal, '', '']);
    }
    if (stationeryTotal > 0) {
      wsData.push(['', '', '', '', 'Stationery Subtotal', stationeryTotal, '', '']);
    }
    if (otherTotal > 0) {
      wsData.push(['', '', '', '', 'Other Subtotal', otherTotal, '', '']);
    }
    // Grand Total — full-width banner merged across all 8 cols
    pushMergedBanner(`GRAND TOTAL (INR): ${grandTotal.toLocaleString('en-IN')}`);

    // ── Sign-off row — two labeled pairs (A:B, E:F) ───────────────
    wsData.push([]);
    wsData.push([
      'Coordinator / SPOC', statementMeta.spocName, '', '',
      'Finance Officer', statementMeta.financerName, '', '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Apply merges
    ws['!merges'] = merges;

    // Column widths tuned to keep the layout balanced
    ws['!cols'] = [
      { wch: 8 },   // A — S.No / labels
      { wch: 22 },  // B — Category / values
      { wch: 35 },  // C — Description
      { wch: 10 },  // D — Count
      { wch: 16 },  // E — Count × Amount / totals label
      { wch: 16 },  // F — Total (INR) / totals value
      { wch: 20 },  // G — Bills Attached
      { wch: 32 },  // H — Remarks
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Finance Statement');
    const cleanSession = statementMeta.sessionDay.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `TQI_Finance_Statement_${cleanSession}.xlsx`);
    showToast('Excel (.xlsx) downloaded successfully!');
  };

  // WORD (.DOC) EXPORT USING MIME HTML/WORD FORMAT
  const handleExportWord = () => {
    const cleanSession = statementMeta.sessionDay.replace(/[^a-zA-Z0-9]/g, '_');

    const tableRowsHtml = tableItems
      .map(
        (item) => `
      <tr style="border-bottom: 1px solid #c4c6d3;">
        <td style="padding: 8px; text-align: center; border: 1px solid #dddddd;">${item.sNo}</td>
        <td style="padding: 8px; font-weight: bold; border: 1px solid #dddddd;">${item.category}</td>
        <td style="padding: 8px; border: 1px solid #dddddd;">${item.description}</td>
        <td style="padding: 8px; text-align: center; border: 1px solid #dddddd;">${item.count}</td>
        <td style="padding: 8px; text-align: center; border: 1px solid #dddddd;">${item.countAmount}</td>
        <td style="padding: 8px; text-align: right; font-weight: bold; border: 1px solid #dddddd;">Rs. ${item.total.toLocaleString()}</td>
        <td style="padding: 8px; text-align: center; border: 1px solid #dddddd;">${item.billUrl ? 'Attached' : 'None'}</td>
        <td style="padding: 8px; color: #555555; border: 1px solid #dddddd;">${item.remarks}</td>
      </tr>
    `
      )
      .join('');

    const wordContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>TQI Finance Statement</title>
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; margin: 40px; color: #1a1b21; }
          .header-title { font-size: 22px; font-weight: bold; text-align: center; color: #002869; margin-bottom: 4px; }
          .header-sub { font-size: 14px; text-align: center; color: #555555; margin-bottom: 24px; font-weight: bold; }
          .meta-container { width: 100%; margin-bottom: 24px; font-size: 13px; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .meta-table td { padding: 6px 10px; border: none; }
          .meta-label { font-size: 11px; font-weight: bold; color: #666666; text-transform: uppercase; }
          .meta-val { font-size: 13px; font-weight: bold; color: #000000; }
          .data-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
          .data-table th { background-color: #f0f4ff; color: #002869; padding: 10px 8px; font-weight: bold; border: 1px solid #cccccc; }
          .subtotal-row { background-color: #faf8ff; font-weight: bold; }
          .grand-total-row { background-color: #dae2ff; font-weight: bold; font-size: 14px; color: #001947; }
          .signatures { margin-top: 50px; width: 100%; }
        </style>
      </head>
      <body>
        <div class="header-title">Talent Quest for India</div>
        <div style="font-size: 15px; text-align: center; color: #434652; font-weight: bold; margin-bottom: 2px;">Academic year ${academicYear}</div>
        <div style="font-size: 15px; text-align: center; color: #002869; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;">Finance report</div>
        <div class="header-sub">${statementMeta.sessionName} · ${statementMeta.sessionDay}</div>

        <table class="meta-table">
          <tr>
            <td width="50%">
              <div class="meta-label">COLLEGE</div>
              <div class="meta-val">${statementMeta.collegeName}</div>
            </td>
            <td width="50%">
              <div class="meta-label">DATE</div>
              <div class="meta-val">${statementMeta.date}</div>
            </td>
          </tr>
          <tr>
            <td>
              <div class="meta-label">SPOC</div>
              <div class="meta-val">${statementMeta.spocName}</div>
            </td>
            <td>
              <div class="meta-label">FINANCER</div>
              <div class="meta-val">${statementMeta.financerName}</div>
            </td>
          </tr>
          <tr>
            <td>
              <div class="meta-label">SESSION</div>
              <div class="meta-val">${statementMeta.sessionName} (${statementMeta.sessionDay})</div>
            </td>
            <td>
              <div class="meta-label">STATUS</div>
              <div class="meta-val">${statementMeta.status}</div>
            </td>
          </tr>
        </table>

        <h3 style="font-size: 14px; text-transform: uppercase; color: #002869; margin-top: 20px; border-bottom: 2px solid #002869; padding-bottom: 4px;">Expense Details</h3>

        <table class="data-table">
          <thead>
            <tr>
              <th width="5%">S.No</th>
              <th width="12%">Category</th>
              <th width="30%">Description</th>
              <th width="8%">Count</th>
              <th width="12%">Count×Amount</th>
              <th width="12%">Total</th>
              <th width="8%">Bills</th>
              <th width="13%">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
            ${
              travelTotal > 0
                ? `<tr class="subtotal-row"><td colspan="5" style="text-align: right; padding: 8px; border: 1px solid #dddddd;">Travel Total:</td><td style="text-align: right; padding: 8px; border: 1px solid #dddddd; color: #002869;">Rs. ${travelTotal.toLocaleString()}</td><td colspan="2" style="border: 1px solid #dddddd;"></td></tr>`
                : ''
            }
            ${
              foodTotal > 0
                ? `<tr class="subtotal-row"><td colspan="5" style="text-align: right; padding: 8px; border: 1px solid #dddddd;">Food Total:</td><td style="text-align: right; padding: 8px; border: 1px solid #dddddd; color: #002869;">Rs. ${foodTotal.toLocaleString()}</td><td colspan="2" style="border: 1px solid #dddddd;"></td></tr>`
                : ''
            }
            ${
              stationeryTotal > 0
                ? `<tr class="subtotal-row"><td colspan="5" style="text-align: right; padding: 8px; border: 1px solid #dddddd;">Stationery Total:</td><td style="text-align: right; padding: 8px; border: 1px solid #dddddd; color: #002869;">Rs. ${stationeryTotal.toLocaleString()}</td><td colspan="2" style="border: 1px solid #dddddd;"></td></tr>`
                : ''
            }
            ${
              otherTotal > 0
                ? `<tr class="subtotal-row"><td colspan="5" style="text-align: right; padding: 8px; border: 1px solid #dddddd;">Other Expenses Total:</td><td style="text-align: right; padding: 8px; border: 1px solid #dddddd; color: #002869;">Rs. ${otherTotal.toLocaleString()}</td><td colspan="2" style="border: 1px solid #dddddd;"></td></tr>`
                : ''
            }
            <tr class="grand-total-row">
              <td colspan="5" style="text-align: right; padding: 10px; border: 1px solid #002869; font-size: 14px;">GRAND TOTAL:</td>
              <td style="text-align: right; padding: 10px; border: 1px solid #002869; font-size: 14px;">Rs. ${grandTotal.toLocaleString()}</td>
              <td colspan="2" style="border: 1px solid #002869;"></td>
            </tr>
          </tbody>
        </table>

        <table class="signatures" style="margin-top: 60px;">
          <tr>
            <td width="50%" style="text-align: center;">
              <div style="border-top: 1px solid #000000; width: 200px; margin: 0 auto; padding-top: 5px; font-weight: bold;">Coordinator</div>
              <div style="font-size: 11px; color: #555555;">SPOC: ${statementMeta.spocName}</div>
            </td>
            <td width="50%" style="text-align: center;">
              <div style="border-top: 1px solid #000000; width: 200px; margin: 0 auto; padding-top: 5px; font-weight: bold;">Cluster Admin</div>
              <div style="font-size: 11px; color: #555555;">${statementMeta.financerName}</div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', wordContent], {
      type: 'application/msword;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TQI_Finance_Statement_${cleanSession}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Word (.doc) document downloaded successfully!');
  };

  // State for PDF Generation
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Client-Side PDF Generation Handler
  // Uses `@react-pdf/renderer` to produce a real .pdf file that the
  // browser downloads directly. One click → one PDF file.
  const handleExportPDF = async () => {
    setIsGeneratingPdf(true);
    showToast('Preparing official TQI PDF Statement...');
    try {
      await exportFinanceStatementAsPdf({
        clusterName: '',
        collegeName: statementMeta.collegeName,
        sessionName: statementMeta.sessionName,
        sessionDay: statementMeta.sessionDay,
        date: statementMeta.date,
        status: statementMeta.status,
        spocName: statementMeta.spocName,
        spocRole: 'Coordinator (SPOC)',
        financerName: statementMeta.financerName,
        items: tableItems,
        travelTotal,
        foodTotal,
        stationeryTotal,
        otherTotal,
        grandTotal,
      });
      showToast('TQI Finance Statement PDF downloaded successfully.');
    } catch (err) {
      console.error('PDF export error:', err);
      showToast(
        err instanceof Error
          ? `PDF export failed: ${err.message}`
          : 'PDF export failed.',
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Direct file upload reader for bill attachment with Clarity Check & Route Auto-Detection
  const handleUploadBillFile = async (e: React.ChangeEvent<HTMLInputElement>, isForNew: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        if (reader.result) {
          const dataUrl = reader.result as string;
          const clarity = await checkImageClarity(dataUrl);
          if (!clarity.isClear && clarity.score < 25) {
            showToast('⚠️ Notice: Bill photo may be blurry or low quality.');
          }

          const extracted = extractRouteAndDetailsFromText('', file.name);

          if (isForNew) {
            setNewExpenseForm((prev) => ({
              ...prev,
              billUrl: dataUrl,
              billFileName: file.name,
              billDetectedAmount: extracted.amount ?? prev.billDetectedAmount,
              category: extracted.category || prev.category,
              description: extracted.origin && extracted.destination 
                ? `Travel: ${extracted.origin} → ${extracted.destination}`
                : prev.description,
              totalAmount: extracted.amount ? String(extracted.amount) : prev.totalAmount,
              remarks: extracted.remarks || prev.remarks,
            }));
          } else if (editingItem) {
            setEditingItem((prev) =>
              prev
                ? {
                    ...prev,
                    billUrl: dataUrl,
                    billFileName: file.name,
                    billDetectedAmount: extracted.amount ?? prev.billDetectedAmount,
                    description: extracted.origin && extracted.destination 
                      ? `Travel: ${extracted.origin} → ${extracted.destination}`
                      : prev.description,
                    total: extracted.amount || prev.total,
                  }
                : null
            );
          }
          showToast(`Attached & verified: ${file.name}`);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const submitApproval = async () => {
    if (!onApproveReport) return;
    const draftId = currentDraft?.id || selectedDraftId || undefined;
    await onApproveReport(draftId);
    setIsApprovalOpen(false);
    setApprovedCheck(false);
  };

  const submitRejection = async () => {
    if (!onRejectReport || !rejectReason.trim()) return;
    const draftId = currentDraft?.id || selectedDraftId || undefined;
    await onRejectReport(draftId, rejectReason.trim());
    setIsRejectOpen(false);
    setRejectReason('');
  };

  return (
    <div className="w-full space-y-6 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[160] bg-[#001947] text-white px-4 py-2.5 rounded-md shadow-sm flex items-center gap-2 text-[13px] font-semibold border border-[#dae2ff]/40 animate-[slideUp_0.2s_ease-out]">
          <span className="material-symbols-outlined text-[18px] text-[#80d491]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP CONTROL BAR (Print Hidden) */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-md border border-[#c4c6d3]/70 dark:border-gray-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[13px] font-bold text-[#002869] dark:text-blue-300 hover:bg-[#dae2ff]/40 dark:hover:bg-blue-950/60 cursor-pointer bg-[#f4f3fb] dark:bg-gray-800 px-3.5 py-2 rounded-md border border-[#c4c6d3]/60 dark:border-gray-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Finance
          </button>

        </div>

        {/* Action Buttons: Draft entry/edit/submit actions live on the selected statement */}
        <div className="flex flex-wrap items-center gap-2">
          {canManageDrafts && selectedViewKey !== 'all-approved' && canAddEntryToSelectedSheet && (
            <>
              <button
                type="button"
                onClick={() => {
                  if (canEditSelectedSheet && (currentDraft || (selectedDraftId && selectedEntries.length > 0))) {
                    setIsCreatingAdditionalDraft(false);
                    setNewExpenseForm({ category: 'Travel', description: '', count: '', perPerson: '', totalAmount: '', remarks: '', billUrl: null, billFileName: '' });
                    setShowAddModal(true);
                  } else {
                    setIsCreatingAdditionalDraft(!canEditSelectedSheet);
                    setShowDraftEditor(true);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#002869] hover:bg-[#001f52] text-white rounded-md text-[12px] font-bold shadow-xs transition-all cursor-pointer"
                title={canEditSelectedSheet ? 'Add an expense to this day' : 'Start a new draft without changing this submitted sheet'}
              >
                <span className="material-symbols-outlined text-[17px]">add</span>
                Add Expense
              </button>
              {currentDraft && canEditSelectedSheet && (
                <button
                  type="button"
                  onClick={() => setShowDraftEditor(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#f4f3fb] text-[#002869] border border-[#c4c6d3] rounded-md text-[12px] font-bold shadow-xs transition-all cursor-pointer"
                  title="Edit this finance draft"
                >
                  <span className="material-symbols-outlined text-[17px]">edit</span>
                  {editPermissionGranted ? 'Edit Report' : 'Edit'}
                </button>
              )}
              {selectedSheetStatus === 'Draft' && currentDraft && (
                <button
                  type="button"
                  onClick={() => void onSaveDraft?.(currentDraft)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#f4f3fb] text-[#002869] border border-[#c4c6d3] rounded-md text-[12px] font-bold shadow-xs transition-all cursor-pointer"
                >
                  Save Draft
                </button>
              )}
              {['Draft', 'Correction Requested', 'Rejected'].includes(selectedSheetStatus) && selectedDraftId && (
                <button
                  type="button"
                  onClick={requestSubmitConfirmation}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#137333] hover:bg-[#0f5c29] text-white rounded-md text-[12px] font-bold shadow-xs transition-all cursor-pointer"
                  title="Submit this statement for approval"
                >
                  <span className="material-symbols-outlined text-[17px]">send</span>
                  {selectedSheetStatus === 'Draft' && !hasUnresolvedCorrection ? 'Submit for Approval' : 'Resubmit for Approval'}
                </button>
              )}
              {editPermissionGranted && ['Pending', 'Approved'].includes(selectedSheetStatus) && selectedDraftId && (
                <>
                  <button type="button" onClick={() => currentDraft && void onSaveDraft?.(currentDraft)} className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-[#002869] border border-[#c4c6d3] rounded-md text-[12px] font-bold cursor-pointer">Save Changes</button>
                  <button type="button" onClick={requestSubmitConfirmation} className="flex items-center gap-1.5 px-3.5 py-2 bg-[#137333] text-white rounded-md text-[12px] font-bold cursor-pointer">Resubmit for Approval</button>
                </>
              )}
            </>
          )}

          {canManageDrafts && editRequestStatus === 'PENDING' && (
            <button type="button" disabled className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[12px] font-bold opacity-80 cursor-not-allowed">Edit Request Pending</button>
          )}
          {canManageDrafts && editPermissionGranted && (
            <span className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[12px] font-bold">Edit Permission Granted</span>
          )}
          {canRequestEditSelectedSheet && (
            <button
              type="button"
              onClick={() => setIsEditRequestOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-[12px] font-bold transition-all cursor-pointer"
              title="Request permission to edit this submitted finance statement"
            >
              <span className="material-symbols-outlined text-[17px]">lock_open</span>
              Request Edit
            </button>
          )}

          {isSuperAdmin && (selectedSheetStatus === 'Pending' || statementMeta.status === 'Pending') && (
            <>
              <button
                type="button"
                onClick={() => setIsApprovalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#137333] hover:bg-[#0f5c29] text-white rounded-md text-[12px] font-bold shadow-xs transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">check_circle</span>
                Approve Report
              </button>
              <button
                type="button"
                onClick={() => setIsRejectOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-md text-[12px] font-bold transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">close</span>
                Reject Report
              </button>
            </>
          )}

          {/* View Statement Modal Trigger */}
          <button
            onClick={() => {
              setShowFullStatementPreview(true);
              setShowFullStatementModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#002869] hover:bg-[#001f52] dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-md text-[12px] font-bold shadow-xs transition-all cursor-pointer"
            title="Open clean preview statement with all attached bills"
          >
            <span className="material-symbols-outlined text-[17px]">visibility</span>
            View Statement
          </button>

          {/* View All Bills Gallery */}
          {allAttachedBills.length > 0 && (
            <button
              onClick={() => {
                setActiveGalleryIndex(0);
                setShowAllBillsModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#faf8ff] dark:bg-gray-800 border border-[#002869]/30 dark:border-blue-500/30 text-[#002869] dark:text-blue-300 rounded-md text-[12px] font-bold hover:bg-[#dae2ff] dark:hover:bg-gray-700 transition-all cursor-pointer"
              title="View all attached bill receipts in a gallery"
            >
              <span className="material-symbols-outlined text-[17px]">photo_library</span>
              All Bills ({allAttachedBills.length})
            </button>
          )}

          {/* Export Options: Excel, Word, PDF */}
          <div className="flex items-center gap-1 bg-[#f4f3fb] dark:bg-gray-800 p-1 rounded-md border border-[#c4c6d3] dark:border-gray-700">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1 px-2.5 py-1 text-[#137333] dark:text-emerald-400 hover:bg-white dark:hover:bg-gray-700 rounded text-[11.5px] font-bold transition-all cursor-pointer"
              title="Download Excel Sheet (.xlsx)"
            >
              <span className="material-symbols-outlined text-[16px]">table_view</span>
              Excel
            </button>

            <button
              onClick={handleExportWord}
              className="flex items-center gap-1 px-2.5 py-1 text-[#002869] dark:text-blue-300 hover:bg-white dark:hover:bg-gray-700 rounded text-[11.5px] font-bold transition-all cursor-pointer"
              title="Download Microsoft Word Document (.doc)"
            >
              <span className="material-symbols-outlined text-[16px]">description</span>
              Word
            </button>

            <button
              onClick={handleExportPDF}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1 px-2.5 py-1 text-[#592600] dark:text-amber-400 hover:bg-white dark:hover:bg-gray-700 rounded text-[11.5px] font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Export as Official TQI PDF Statement"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isGeneratingPdf ? 'hourglass_top' : 'picture_as_pdf'}
              </span>
              {isGeneratingPdf ? 'Generating...' : 'PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* DRAFT NOTIFICATION BANNER */}
      {statementMeta.isDraft && (
        <div className="bg-[#fff7f2] dark:bg-amber-950/30 border border-[#ffdbc8] dark:border-amber-800/60 rounded-md p-3.5 flex items-center justify-between gap-3 text-[13px] print:hidden shadow-xs">
          <div className="flex items-center gap-2.5 text-[#592600] dark:text-amber-200">
            <div className="w-8 h-8 rounded-md bg-[#ffdbc8] dark:bg-amber-900/60 text-[#592600] dark:text-amber-200 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">description</span>
            </div>
            <div>
              <div className="font-bold flex items-center gap-2">
                <span>Official TQI Finance Sheet</span>
                <span className="bg-[#ffdbc8] dark:bg-amber-900/60 text-[#592600] dark:text-amber-200 text-[10.5px] px-2 py-0.2 rounded font-extrabold">
                  Status: {statementMeta.status}
                </span>
              </div>
              <p className="text-[11.5px] text-[#762900] dark:text-amber-300 mt-0.5">
                Cluster audit statement preview. Click receipt buttons below to inspect verified bills.
              </p>
            </div>
          </div>
        </div>
      )}
      {currentDraft?.editRequestStatus === 'PENDING' && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 print:hidden">
          <strong>Edit Request Pending</strong> — Super Admin approval is required before this report can be changed.
          {currentDraft.editRequestedAt && <span className="ml-1">Requested {new Date(currentDraft.editRequestedAt).toLocaleString()}</span>}
        </div>
      )}
      {currentDraft?.editPermission && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 print:hidden"><strong>Edit Permission Granted</strong> — make the approved corrections and resubmit this report.</div>
      )}
      {currentDraft?.editRequestStatus === 'REJECTED' && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900 print:hidden"><strong>Edit Request Rejected.</strong> {currentDraft.editRejectionReason}</div>
      )}
      {hasUnresolvedCorrection && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900 print:hidden">
          <strong>Correction required.</strong>{' '}
          {correctionFeedback || 'Review the comments below, edit the existing expense rows, then resubmit this report.'}
          <span className="ml-1">Edit the existing expense rows and resubmit when corrected.</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OFFICIAL TQI FINANCE SHEET DOCUMENT (PRINTABLE & UNBOXED HEADER) */}
      {/* ========================================================================= */}
      <div id="printable-tqi-statement-doc" className="bg-white dark:bg-gray-900 rounded-md border border-[#c4c6d3]/80 dark:border-gray-800 shadow-sm p-6 sm:p-12 space-y-8 print:p-0 print:border-none print:shadow-none print:bg-white print:text-black">
        
        {/* 1. TQI OFFICIAL LOGO & TITLE HEADER */}
        <div className="flex flex-col items-center justify-center text-center space-y-2.5 pb-4 border-b border-[#dae2ff] dark:border-gray-800">
          {/* Authentic TQI Circular Trust Logo */}
          <div className="flex items-center justify-center">
            <TqiLogo size={92} className="mx-auto" />
          </div>

          <div className="space-y-1 pt-1">
            <h1 className="text-[22px] sm:text-[26px] font-extrabold text-[#000000] dark:text-white tracking-tight">
              Talent Quest for India
            </h1>
            <div className="text-[14px] sm:text-[15px] font-bold text-[#434652] dark:text-gray-300">
              Academic year {academicYear}
            </div>
            <div className="text-[14px] sm:text-[15px] font-extrabold text-[#002869] dark:text-blue-400 uppercase tracking-wider">
              Finance report
            </div>
            <div className="text-[13.5px] sm:text-[14.5px] font-bold text-[#592600] dark:text-amber-400">
              {statementMeta.sessionName} · {statementMeta.sessionDay}
            </div>
          </div>
        </div>

        {/* 2. UNBOXED CLEAN METADATA SECTION */}
        <div className="bg-[#faf8ff] dark:bg-gray-800/60 rounded-md p-5 sm:p-6 border border-[#dae2ff]/80 dark:border-gray-700 text-[13px]">
          <div className="flex items-center justify-between mb-3 border-b border-[#dae2ff] dark:border-gray-700 pb-2">
            <span className="text-[11px] font-extrabold text-[#002869] dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">info</span>
              Session Details
            </span>
            <div className="flex items-center gap-2">
              {canEditSelectedSheet && currentDraft && <button type="button" onClick={() => setShowEditMetaModal(true)} className="rounded-md border border-[#c4c6d3] bg-white px-2.5 py-1 text-[10px] font-bold text-[#002869] hover:bg-[#dae2ff] dark:bg-gray-900 dark:text-blue-300">Edit Report Details</button>}
              <span
                className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                  statementMeta.status === 'Approved'
                    ? 'bg-[#e6f4ea] dark:bg-emerald-950/60 text-[#137333] dark:text-emerald-400'
                    : statementMeta.status === 'Rejected' || statementMeta.status === 'Correction Requested'
                      ? 'bg-[#fde8e8] dark:bg-red-950/60 text-[#b42318] dark:text-red-300'
                      : 'bg-[#ffdbc8] dark:bg-amber-950/60 text-[#592600] dark:text-amber-300'
                }`}
              >
                Status: {isSuperAdmin && (statementMeta.status === 'Pending' || statementMeta.status === 'Submitted') ? 'Pending Approval' : statementMeta.status}
              </span>
            </div>
          </div>

          {/* Clean 2-Column Unboxed Key-Value Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-8">
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-[11.5px] font-bold text-[#747783] dark:text-gray-400 uppercase tracking-wide w-24 shrink-0">
                  COLLEGE:
                </span>
                <span className="font-bold text-[#000000] dark:text-gray-100 text-[13.5px]">
                  {statementMeta.collegeName}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-[11.5px] font-bold text-[#747783] dark:text-gray-400 uppercase tracking-wide w-24 shrink-0">
                  SESSION:
                </span>
                <span className="font-semibold text-[#000000] dark:text-gray-100 text-[13px]">
                  {statementMeta.sessionName}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-[11.5px] font-bold text-[#747783] dark:text-gray-400 uppercase tracking-wide w-24 shrink-0">
                  DATE:
                </span>
                <span className="font-semibold text-[#000000] dark:text-gray-100 text-[13px]">
                  {statementMeta.date}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-[11.5px] font-bold text-[#747783] dark:text-gray-400 uppercase tracking-wide w-24 shrink-0">
                  SPOC:
                </span>
                <span className="font-semibold text-[#000000] dark:text-gray-100 text-[13px]">
                  {statementMeta.spocName}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-[11.5px] font-bold text-[#747783] dark:text-gray-400 uppercase tracking-wide w-24 shrink-0">
                  FINANCER:
                </span>
                <span className="font-semibold text-[#000000] dark:text-gray-100 text-[13px]">
                  {statementMeta.financerName}
                </span>
              </div>
            </div>
          </div>
        </div>

        {shouldDisplayDetailedStatement ? (
          <>
            {/* 3. EXPENSE DETAILS SECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[14px] font-bold text-[#000000] dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Expense Details</span>
                  <span className="text-[11px] font-semibold text-[#747783] dark:text-gray-400 lowercase font-normal">
                    ({tableItems.length} items logged)
                  </span>
                </h2>

              </div>

              {/* Main Expense Table (Mobile Cards View) */}
              <div className="block md:hidden space-y-3 print:hidden">
                {tableItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-[#c4c6d3] dark:border-gray-700 bg-[#faf8ff]/50 dark:bg-gray-800/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono text-[#747783] dark:text-gray-400">#{item.sNo}</span>
                        <span className="inline-block px-2 py-0.5 rounded text-[10.5px] font-bold bg-[#dae2ff] dark:bg-blue-950/70 text-[#002869] dark:text-blue-300">
                          {item.category}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#002869] dark:text-blue-300">
                        ₹{item.total.toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-[#1a1b21] dark:text-gray-100">
                        {item.description}
                      </p>
                      {item.count && item.countAmount && (
                        <p className="text-[11px] text-[#555555] dark:text-gray-400 mt-0.5 font-mono">
                          Formula: {item.count} × {item.countAmount}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-[#c4c6d3]/60 dark:border-gray-700 text-[11px]">
                      <span className="text-[#555555] dark:text-gray-400 truncate max-w-[170px]">
                        {item.remarks || 'Expense item'}
                      </span>

                      {item.billUrl ? (
                        <button
                          type="button"
                          onClick={() => {
                            setBillZoom(1);
                            setBillRotate(0);
                            setActiveBillViewer({
                              url: item.billUrl,
                              title: item.category + ': ' + item.description,
                              category: item.category,
                              amount: item.total,
                              fileName: item.billFileName || (item.category + '_Bill.jpg'),
                              itemId: item.id,
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#e6f4ea] dark:bg-emerald-950/60 text-[#137333] dark:text-emerald-400 border border-[#137333]/30 dark:border-emerald-700/50 rounded text-[11px] font-bold cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                          <span>View Bill</span>
                        </button>
                      ) : (
                        <span className="text-[#747783] dark:text-gray-500 text-[10.5px]">No receipt</span>
                      )}
                    </div>
                    {canEditSelectedSheet && (
                      <div className="flex justify-end gap-2 border-t border-[#c4c6d3]/60 pt-2">
                        <button type="button" onClick={() => setEditingItem(item)} className="rounded-md border border-[#c4c6d3] px-2.5 py-1 text-[11px] font-semibold text-[#002869]">Edit</button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Mobile Category Totals Summary */}
                <div className="p-3.5 rounded-xl border border-[#dae2ff] dark:border-gray-700 bg-[#faf8ff] dark:bg-gray-800/80 space-y-1.5 text-xs">
                  <div className="text-[11px] font-bold text-[#002869] dark:text-blue-300 uppercase tracking-wider mb-2">Category Subtotals</div>
                  {travelTotal > 0 && (
                    <div className="flex justify-between text-[#434652] dark:text-gray-300">
                      <span>Travel Total:</span>
                      <span className="font-mono font-bold text-[#002869] dark:text-blue-300">₹{travelTotal.toLocaleString()}</span>
                    </div>
                  )}
                  {foodTotal > 0 && (
                    <div className="flex justify-between text-[#434652] dark:text-gray-300">
                      <span>Food Total:</span>
                      <span className="font-mono font-bold text-[#002869] dark:text-blue-300">₹{foodTotal.toLocaleString()}</span>
                    </div>
                  )}
                  {stationeryTotal > 0 && (
                    <div className="flex justify-between text-[#434652] dark:text-gray-300">
                      <span>Stationery Total:</span>
                      <span className="font-mono font-bold text-[#002869] dark:text-blue-300">₹{stationeryTotal.toLocaleString()}</span>
                    </div>
                  )}
                  {otherTotal > 0 && (
                    <div className="flex justify-between text-[#434652] dark:text-gray-300">
                      <span>Other Total:</span>
                      <span className="font-mono font-bold text-[#002869] dark:text-blue-300">₹{otherTotal.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-[#dae2ff] dark:border-gray-700 font-bold text-sm text-[#001947] dark:text-white">
                    <span>Grand Total:</span>
                    <span className="font-mono text-base text-[#002869] dark:text-blue-400">₹{grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Main Expense Table (Desktop View) */}
              <div className="hidden md:block border border-[#c4c6d3] dark:border-gray-700 overflow-x-auto rounded-md print:block">
                <table className="w-full text-left text-[12px] border-collapse min-w-[700px]">
                  <thead className="bg-[#faf8ff] dark:bg-gray-800 border-b border-[#c4c6d3] dark:border-gray-700 font-bold text-[#000000] dark:text-gray-100">
                    <tr>
                      <th className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 w-12 text-center">S.No</th>
                      <th className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 w-24">Category</th>
                      <th className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700">Description</th>
                      <th className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-center w-16">Count</th>
                      <th className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-center w-24">Count×Amount</th>
                      <th className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-right w-24">Total</th>
                      <th className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-center w-24">Bills</th>
                      <th className="p-2.5">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#c4c6d3] dark:divide-gray-700">
                    {tableItems.map((item) => (
                      <tr key={item.id} className="hover:bg-[#faf8ff]/80 dark:hover:bg-gray-800/40 transition-colors group text-[#1a1b21] dark:text-gray-200">
                        <td className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 font-mono text-center text-gray-500 dark:text-gray-400">{item.sNo}</td>
                        <td className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700">
                          <span className="font-semibold text-[#002869] dark:text-blue-300">{item.category}</span>
                        </td>
                        <td className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 font-medium text-[#1a1b21] dark:text-gray-100">
                          {item.description}
                        </td>
                        <td className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-center font-mono">{item.count}</td>
                        <td className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-center font-mono">{item.countAmount}</td>
                        <td className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-right font-mono font-bold text-[#002869] dark:text-blue-300">
                          ₹{item.total.toLocaleString()}
                        </td>
                        
                        {/* BILLS COLUMN: Clickable Viewer & Thumbnail */}
                        <td className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-center">
                          {item.billUrl ? (
                            <button
                              onClick={() => {
                                setBillZoom(1);
                                setBillRotate(0);
                                setActiveBillViewer({
                                  url: item.billUrl!,
                                  title: `${item.category}: ${item.description}`,
                                  category: item.category,
                                  amount: item.total,
                                  fileName: item.billFileName || `${item.category}_Bill.jpg`,
                                  itemId: item.id,
                                });
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#e6f4ea] hover:bg-[#ceead6] dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-[#137333] dark:text-emerald-400 border border-[#137333]/30 dark:border-emerald-700/50 rounded-md text-[11.5px] font-bold transition-all cursor-pointer shadow-2xs"
                              title="Click to view full receipt / bill"
                            >
                              <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                              <span>View</span>
                            </button>
                          ) : (
                            <span className="text-[#747783] dark:text-gray-500 text-[11px] font-medium">—</span>
                          )}
                        </td>

                        <td className="p-2.5 text-[#555555] dark:text-gray-400 text-[11.5px]">
                          <div className="flex items-center justify-between gap-2">
                            <span>{item.remarks}</span>
                            {canEditSelectedSheet && <span className="flex shrink-0 items-center gap-1 print:hidden">
                              <button type="button" onClick={() => setEditingItem(item)} className="rounded px-2 py-1 text-[10px] font-bold text-[#002869] hover:bg-[#dae2ff]" aria-label={`Edit ${item.description}`}>Edit</button>
                            </span>}
                          </div>
                        </td>
                      </tr>
                    ))}

                {/* Subtotals */}
                {travelTotal > 0 && (
                  <tr className="bg-[#faf8ff] dark:bg-gray-800/70 font-medium text-[12px]">
                    <td colSpan={5} className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-right font-bold text-[#434652] dark:text-gray-300">
                      Travel Total
                    </td>
                    <td className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-right font-mono font-bold text-[#002869] dark:text-blue-300">
                      ₹{travelTotal.toLocaleString()}
                    </td>
                    <td colSpan={2} className="p-2.5 bg-[#faf8ff] dark:bg-gray-800/70"></td>
                  </tr>
                )}

                {foodTotal > 0 && (
                  <tr className="bg-[#faf8ff] dark:bg-gray-800/70 font-medium text-[12px]">
                    <td colSpan={5} className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-right font-bold text-[#434652] dark:text-gray-300">
                      Food Total
                    </td>
                    <td className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-right font-mono font-bold text-[#002869] dark:text-blue-300">
                      ₹{foodTotal.toLocaleString()}
                    </td>
                    <td colSpan={2} className="p-2.5 bg-[#faf8ff] dark:bg-gray-800/70"></td>
                  </tr>
                )}

                {stationeryTotal > 0 && (
                  <tr className="bg-[#faf8ff] dark:bg-gray-800/70 font-medium text-[12px]">
                    <td colSpan={5} className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-right font-bold text-[#434652] dark:text-gray-300">
                      Stationery / Materials Total
                    </td>
                    <td className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-right font-mono font-bold text-[#002869] dark:text-blue-300">
                      ₹{stationeryTotal.toLocaleString()}
                    </td>
                    <td colSpan={2} className="p-2.5 bg-[#faf8ff] dark:bg-gray-800/70"></td>
                  </tr>
                )}

                {otherTotal > 0 && (
                  <tr className="bg-[#faf8ff] dark:bg-gray-800/70 font-medium text-[12px]">
                    <td colSpan={5} className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-right font-bold text-[#434652] dark:text-gray-300">
                      Other Expenses Total
                    </td>
                    <td className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-right font-mono font-bold text-[#002869] dark:text-blue-300">
                      ₹{otherTotal.toLocaleString()}
                    </td>
                    <td colSpan={2} className="p-2.5 bg-[#faf8ff] dark:bg-gray-800/70"></td>
                  </tr>
                )}

                {/* Grand Total Strip */}
                <tr className="bg-[#dae2ff] dark:bg-blue-950/60 font-extrabold text-[#001947] dark:text-blue-200">
                  <td colSpan={5} className="p-3 border-r border-[#c4c6d3] dark:border-gray-700 text-right text-[13.5px] tracking-wide">
                    Grand Total
                  </td>
                  <td className="p-3 border-r border-[#c4c6d3] dark:border-gray-700 text-right font-mono text-[15px] font-bold text-[#001947] dark:text-blue-300">
                    ₹{grandTotal.toLocaleString()}
                  </td>
                  <td colSpan={2} className="p-3 bg-[#dae2ff] dark:bg-blue-950/60"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
          </>
        ) : canManageDrafts && selectedViewKey !== 'all-approved' ? (
          <div className="rounded-2xl border border-dashed border-[#c4c6d3] bg-[#faf8ff] dark:bg-gray-800/60 p-8 text-center shadow-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#dae2ff] text-[#002869] dark:bg-blue-950/60 dark:text-blue-300">
              <span className="material-symbols-outlined text-[24px]">draft</span>
            </div>
            <h3 className="mt-4 text-base font-bold text-[#001947] dark:text-white">No expense entry yet</h3>
            <p className="mt-2 text-sm text-[#555555] dark:text-gray-300">
              Start by adding the first expense entry for this session.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsCreatingAdditionalDraft(true);
                setNewExpenseForm({ category: 'Travel', description: '', count: '', perPerson: '', totalAmount: '', remarks: '', billUrl: null, billFileName: '' });
                setShowDraftEditor(true);
              }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#002869] text-white text-xs font-bold hover:bg-[#001f52] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add First Entry
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#c4c6d3] bg-[#faf8ff] dark:bg-gray-800/60 p-8 text-center shadow-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#dae2ff] text-[#002869] dark:bg-blue-950/60 dark:text-blue-300">
              <span className="material-symbols-outlined text-[24px]">draft</span>
            </div>
            <h3 className="mt-4 text-base font-bold text-[#001947] dark:text-white">No submission yet</h3>
            <p className="mt-2 text-sm text-[#555555] dark:text-gray-300">
              This session does not have a submitted finance statement yet.
            </p>
          </div>
        )}

        {Boolean(currentDraft?.history?.length) && (
          <section className="space-y-3 border-t border-[#dae2ff] pt-5 print:hidden">
            <h3 className="text-sm font-bold text-[#002869]">Finance Report History</h3>
            <ol className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
              {currentDraft.history?.map((item, index) => (
                <li key={`${item.event}-${index}`} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                  <span><strong>{item.event}</strong>{item.userName ? ` by ${item.userName}` : ''}{item.details ? ` — ${item.details}` : ''}</span>
                  <time>{new Date(item.createdAt).toLocaleString()}</time>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* 4. FOOTER SIGN-OFF SECTION */}
        <div className="pt-8 sm:pt-14 grid grid-cols-2 gap-12 text-center text-[12px]">
          <div>
            <div className="border-t border-[#000000] dark:border-gray-600 pt-2 font-bold text-[#000000] dark:text-gray-100">
              Coordinator
            </div>
            <div className="text-[11px] text-[#747783] dark:text-gray-400 mt-0.5">SPOC: {statementMeta.spocName}</div>
          </div>

          <div>
            <div className="border-t border-[#000000] dark:border-gray-600 pt-2 font-bold text-[#000000] dark:text-gray-100">
              Cluster Admin
            </div>
            <div className="text-[11px] text-[#747783] dark:text-gray-400 mt-0.5">{statementMeta.financerName}</div>
          </div>
        </div>

        {/* Audit Document Footer Note */}
        <div className="text-center pt-2 text-[11px] text-[#747783] dark:text-gray-400 border-t border-[#dae2ff]/60 dark:border-gray-800">
          Talent Quest for India — Official Finance Statement &amp; Audit Document
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BILL LIGHTBOX & VIEWER MODAL */}
      {/* ========================================================================= */}
      {isSubmitConfirmOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-900/70 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">{editPermissionGranted ? 'Resubmit Finance Report?' : 'Submit Finance Report?'}</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{editPermissionGranted ? 'Your requested changes will be submitted again for Super Admin review.' : 'This finance report will be submitted for Super Admin approval and locked for editing.'}</p>
            </div>
            <div className="space-y-1 rounded-xl bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              <div><span className="font-semibold">Total Expenses:</span> ₹{grandTotal.toLocaleString()}</div>
              <div><span className="font-semibold">Expense Entries:</span> {tableItems.length}</div>
              <div><span className="font-semibold">Bills:</span> {allAttachedBills.length}</div>
            </div>
            {selectedEntries.some((entry) => !entry.billUrl && !entry.billReference) && (
              <label className="block text-xs text-gray-700 dark:text-gray-200">
                <span className="mb-1 block font-semibold text-gray-800 dark:text-gray-100">Reason for missing bill(s)</span>
                <textarea
                  value={missingBillReason}
                  onChange={(event) => setMissingBillReason(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  placeholder="Explain why this expense is being submitted without a bill and why Super Admin approval is needed."
                />
              </label>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsSubmitConfirmOpen(false)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">Cancel</button>
              <button type="button" onClick={() => void handleSubmitStatement()} disabled={selectedEntries.some((entry) => !entry.billUrl && !entry.billReference) && !missingBillReason.trim()} className="rounded-lg bg-[#137333] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{editPermissionGranted ? 'Resubmit' : 'Submit for Approval'}</button>
            </div>
          </div>
        </div>
      )}

      {isApprovalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-900/70 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Approve Finance Report?</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">This action will mark the report as approved for the cluster.</p>
            </div>
            <div className="space-y-1 rounded-xl bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              <div><span className="font-semibold">College:</span> {statementMeta.collegeName}</div>
              <div><span className="font-semibold">Session:</span> {statementMeta.sessionName}</div>
              <div><span className="font-semibold">Date:</span> {statementMeta.date}</div>
              <div><span className="font-semibold">Financer:</span> {statementMeta.financerName}</div>
              <div><span className="font-semibold">Total Amount:</span> ₹{grandTotal.toLocaleString()}</div>
              <div><span className="font-semibold">Number of Expenses:</span> {tableItems.length}</div>
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={approvedCheck}
                onChange={(event) => setApprovedCheck(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span>I have reviewed all expenses and supporting bills.</span>
            </label>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsApprovalOpen(false)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">Cancel</button>
              <button type="button" disabled={!approvedCheck || !onApproveReport} onClick={submitApproval} className="rounded-lg bg-[#137333] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Confirm Approval</button>
            </div>
          </div>
        </div>
      )}

      {isRejectOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-900/70 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-red-200 bg-white p-5 shadow-xl dark:border-red-900 dark:bg-gray-900">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Reject Finance Report</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Please provide a reason for the rejection.</p>
            </div>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={4}
              placeholder="Reason for rejection..."
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:border-red-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsRejectOpen(false)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">Cancel</button>
              <button type="button" disabled={!rejectReason.trim() || !onRejectReport} onClick={submitRejection} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Reject Report</button>
            </div>
          </div>
        </div>
      )}

      {isEditRequestOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-900/70 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Request Finance Edit</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Explain why this approved finance entry needs to be unlocked.</p>
            </div>
            <textarea
              value={editRequestReason}
              onChange={(event) => setEditRequestReason(event.target.value)}
              rows={4}
              placeholder="Reason for requesting an edit..."
              className="w-full resize-y rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-800 outline-none focus:border-amber-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditRequestOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmitEditRequest()}
                disabled={isSubmittingEditRequest}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {isSubmittingEditRequest ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showDraftEditor && (
        <NewFinanceModal
          key={isCreatingAdditionalDraft ? 'new-additional-draft' : activeDraftId || 'new-finance-draft'}
          isOpen={showDraftEditor}
          onClose={() => {
            setShowDraftEditor(false);
            setIsCreatingAdditionalDraft(false);
          }}
          clusterName={!isCreatingAdditionalDraft ? currentDraft?.clusterName || clusterName : clusterName}
          collegeName={!isCreatingAdditionalDraft ? currentDraft?.collegeName || collegeName : collegeName}
          spocName={!isCreatingAdditionalDraft ? currentDraft?.spocName || spocName : spocName}
          financerName={!isCreatingAdditionalDraft ? currentDraft?.financerName || financerName : financerName}
          sessions={sessions}
          clusterId={!isCreatingAdditionalDraft ? currentDraft?.clusterId || clusterId : clusterId}
          defaultSessionDay={currentDraft?.sessionDay || statementMeta.sessionDay}
          initialDraft={isCreatingAdditionalDraft ? undefined : currentDraft || undefined}
          onSubmitFinance={async (newEntries, isDraft) => {
            if (!onAddFinanceEntry) throw new Error('Finance entry saving is unavailable. Return to Finance and try again.');
            const draftId = isCreatingAdditionalDraft ? undefined : currentDraft?.id || selectedDraftId;
            const existingDraftEntries = draftId
              ? entries.filter((entry) => entry.draftId === draftId)
              : [];
            const unmatchedExisting = [...existingDraftEntries];

            for (const [index, entry] of newEntries.entries()) {
              const matchingExistingIndex = unmatchedExisting.findIndex((existing) =>
                existing.category === entry.category && existing.description === entry.description
              );
              const matchingExisting = matchingExistingIndex >= 0
                ? unmatchedExisting.splice(matchingExistingIndex, 1)[0]
                : unmatchedExisting.length && existingDraftEntries.length > 0
                  ? unmatchedExisting.shift()
                  : undefined;
              const scopedEntry = {
                ...entry,
                clusterId: entry.clusterId || clusterId,
                clusterName: entry.clusterName || clusterName,
              };

              if (matchingExisting && onUpdateFinanceEntry) {
                await onUpdateFinanceEntry(matchingExisting.id, scopedEntry);
              } else if (!existingDraftEntries.length || index >= existingDraftEntries.length) {
                await onAddFinanceEntry(scopedEntry);
              }
            }
            if (onDeleteFinanceEntry) {
              for (const unmatched of unmatchedExisting) await onDeleteFinanceEntry(unmatched.id);
            }
            if (!isDraft) {
              const reportId = newEntries.find((entry) => entry.draftId)?.draftId || currentDraft?.id || selectedDraftId;
              if (!reportId || !onSubmitDraft) throw new Error('Finance report was saved, but submission is unavailable.');
              await onSubmitDraft(reportId);
            }
            setShowDraftEditor(false);
            setIsCreatingAdditionalDraft(false);
            showToast(isDraft ? 'Finance draft saved successfully.' : 'Finance report submitted for approval and locked.');
          }}
          onSaveDraftPackage={async (updatedDraft) => {
            await onSaveDraft?.(updatedDraft);
            setSelectedViewKey(updatedDraft.id);
          }}
        />
      )}
      {activeBillViewer && (
        <div
          onClick={() => setActiveBillViewer(null)}
          className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-6 cursor-pointer animate-[fadeIn_0.15s_ease-out]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-md max-w-2xl w-full overflow-hidden shadow-sm flex flex-col max-h-[90vh] cursor-default border border-[#c4c6d3]"
          >
            {/* Modal Header */}
            <div className="p-4 bg-[#f4f3fb] border-b border-[#c4c6d3] flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-[#002869] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#137333]">receipt</span>
                  <span>{activeBillViewer.title}</span>
                </h3>
                <p className="text-[11.5px] text-[#434652]">
                  {activeBillViewer.fileName || 'Attached Receipt File'} • Amount: <strong className="text-[#002869]">₹{activeBillViewer.amount || 0}</strong>
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Rotate */}
                <button
                  onClick={() => setBillRotate((r) => (r + 90) % 360)}
                  className="p-1.5 text-[#434652] hover:bg-[#e8e7ef] rounded-md cursor-pointer transition-colors"
                  title="Rotate Image"
                >
                  <span className="material-symbols-outlined text-[18px]">rotate_right</span>
                </button>
                {/* Zoom In */}
                <button
                  onClick={() => setBillZoom((z) => Math.min(z + 0.25, 2.5))}
                  className="p-1.5 text-[#434652] hover:bg-[#e8e7ef] rounded-md cursor-pointer transition-colors"
                  title="Zoom In"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                </button>
                {/* Zoom Out */}
                <button
                  onClick={() => setBillZoom((z) => Math.max(z - 0.25, 0.5))}
                  className="p-1.5 text-[#434652] hover:bg-[#e8e7ef] rounded-md cursor-pointer transition-colors"
                  title="Zoom Out"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                </button>
                {/* Close */}
                <button
                  onClick={() => setActiveBillViewer(null)}
                  className="p-1.5 text-[#434652] hover:bg-[#e8e7ef] rounded-full cursor-pointer ml-1"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* Receipt Image Display Canvas */}
            <div className="p-4 bg-[#1a1b21] flex-1 overflow-auto flex items-center justify-center min-h-[340px] max-h-[60vh]">
              <div
                style={{
                  transform: `scale(${billZoom}) rotate(${billRotate}deg)`,
                  transition: 'transform 0.2s ease-out',
                }}
                className="max-w-full"
              >
                <img
                  src={activeBillViewer.url}
                  alt="Bill Receipt"
                  className="max-h-[50vh] object-contain rounded-md shadow-sm mx-auto"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Fallback generated styled receipt voucher if link fails
                    (e.target as HTMLElement).style.display = 'none';
                    const parent = (e.target as HTMLElement).parentElement;
                    if (parent && !parent.querySelector('.voucher-fallback')) {
                      const fallbackDiv = document.createElement('div');
                      fallbackDiv.className = 'voucher-fallback bg-white text-[#1a1b21] p-6 rounded-md shadow-sm border border-[#c4c6d3] w-80 text-center font-mono space-y-2';
                      fallbackDiv.innerHTML = `
                        <div style="font-size: 16px; font-weight: bold; color: #002869;">TALENT QUEST FOR INDIA</div>
                        <div style="font-size: 11px; color: #666;">OFFICIAL EXPENSE VOUCHER</div>
                        <hr style="border: 0.5px dashed #aaa; margin: 8px 0;" />
                        <div style="font-size: 12px; text-align: left;"><strong>Item:</strong> ${activeBillViewer.title}</div>
                        <div style="font-size: 12px; text-align: left;"><strong>Amount:</strong> ₹${activeBillViewer.amount || 0}</div>
                        <div style="font-size: 12px; text-align: left;"><strong>Date:</strong> ${statementMeta.date}</div>
                        <div style="font-size: 12px; text-align: left;"><strong>Status:</strong> Verified Receipt Attached</div>
                        <hr style="border: 0.5px dashed #aaa; margin: 8px 0;" />
                        <div style="font-size: 10px; color: #2e7d32; font-weight: bold;">[DIGITALLY VERIFIED IN CLUSTER REGISTRY]</div>
                      `;
                      parent.appendChild(fallbackDiv);
                    }
                  }}
                />
              </div>
            </div>

            {/* Modal Bottom Action Bar */}
            <div className="p-4 bg-white border-t border-[#c4c6d3] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <a
                  href={activeBillViewer.url}
                  download={activeBillViewer.fileName || 'TQI_Receipt.jpg'}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-[#f4f3fb] border border-[#c4c6d3] text-[#002869] rounded-md text-[12px] font-bold hover:bg-[#dae2ff] flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Download Receipt
                </a>

                <a
                  href={activeBillViewer.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-[#002869] text-[12px] font-bold hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  Open in New Tab
                </a>
              </div>

              <button
                onClick={() => setActiveBillViewer(null)}
                className="px-4 py-1.5 bg-[#002869] text-white font-bold text-[12px] rounded-md hover:bg-[#002869]/90 cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT EXPENSE ROW MODAL */}
      {/* ========================================================================= */}
      {editingItem && (
        <div className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white rounded-md max-w-lg w-full overflow-hidden shadow-sm border border-[#c4c6d3] space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-[#c4c6d3] pb-3">
              <h3 className="text-[16px] font-bold text-[#002869] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">edit</span>
                <span>Edit Expense Line Item</span>
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 text-[#747783] hover:text-[#1a1b21] rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3.5 text-[13px]">
              <div>
                <label className="block text-[11px] font-bold text-[#434652] mb-1">Category</label>
                <Select
                  value={editingItem.category}
                  onValueChange={(val) =>
                    setEditingItem({
                      ...editingItem,
                      category: val as any,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-10 text-xs font-semibold text-[#002869] border-[#c4c6d3]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Travel">Travel</SelectItem>
                    <SelectItem value="Food">Food</SelectItem>
                    <SelectItem value="Stationery">Stationery</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#434652] mb-1">Description / Route</label>
                <input
                  type="text"
                  value={editingItem.description}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md outline-none focus:border-[#002869]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#434652] mb-1">Count (Volunteers / Items)</label>
                  <input
                    type="text"
                    value={editingItem.count}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        count: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md outline-none focus:border-[#002869]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#434652] mb-1">Total Amount (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    value={editingItem.total}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        total: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md font-bold text-[#002869] outline-none focus:border-[#002869]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#434652] mb-1">Remarks</label>
                <input
                  type="text"
                  value={editingItem.remarks}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      remarks: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md outline-none focus:border-[#002869]"
                />
              </div>

              {/* Bill Attachment Field */}
              <div>
                <label className="block text-[11px] font-bold text-[#434652] mb-1">Receipt / Bill Attachment</label>
                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 bg-[#f4f3fb] border border-[#c4c6d3] rounded-md text-[12px] font-bold text-[#002869] hover:bg-[#dae2ff] flex items-center gap-1 cursor-pointer">
                    <span className="material-symbols-outlined text-[16px]">upload_file</span>
                    <span>{editingItem.billUrl ? 'Change Bill Photo' : 'Upload Bill Photo'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => handleUploadBillFile(e, false)}
                    />
                  </label>

                  {editingItem.billUrl && (
                    <button
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          billUrl: null,
                          billFileName: '',
                        })
                      }
                      className="text-[#ba1a1a] hover:bg-[#ffdad6] px-2 py-1 rounded text-[11px] font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">delete</span>
                      Remove Bill
                    </button>
                  )}
                </div>
                {editingItem.billFileName && (
                  <span className="text-[11px] text-[#137333] font-semibold mt-1 block">
                    ✓ Attached: {editingItem.billFileName}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#c4c6d3]">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 bg-white border border-[#c4c6d3] rounded-md text-[12.5px] font-bold text-[#434652] hover:bg-[#f4f3fb] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedRow}
                className="px-5 py-2 bg-[#002869] text-white rounded-md text-[12.5px] font-bold hover:bg-[#002869]/90 cursor-pointer shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD EXPENSE ROW MODAL */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white rounded-md max-w-lg w-full overflow-hidden shadow-sm border border-[#c4c6d3] space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-[#c4c6d3] pb-3">
              <h3 className="text-[16px] font-bold text-[#002869] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Add Expense Line Item</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-[#747783] hover:text-[#1a1b21] rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3.5 text-[13px]">
              <div>
                <label className="block text-[11px] font-bold text-[#434652] mb-1">Category *</label>
                <Select
                  value={newExpenseForm.category}
                  onValueChange={(val) =>
                    setNewExpenseForm({
                      ...newExpenseForm,
                      category: val as any,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-10 text-xs font-semibold text-[#002869] border-[#c4c6d3]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Travel">Travel</SelectItem>
                    <SelectItem value="Food">Food</SelectItem>
                    <SelectItem value="Stationery">Stationery</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#434652] mb-1">
                  {newExpenseForm.category === 'Travel' ? 'Route (e.g. KSR College → Salem)' : 'Description *'}
                </label>
                <input
                  type="text"
                  placeholder={
                    newExpenseForm.category === 'Travel'
                      ? 'Origin → Destination'
                      : newExpenseForm.category === 'Food'
                      ? 'Breakfast / Lunch / Tea allowance'
                      : 'Activity materials / Banner / Misc'
                  }
                  value={newExpenseForm.description}
                  onChange={(e) =>
                    setNewExpenseForm({
                      ...newExpenseForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md outline-none focus:border-[#002869]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#434652] mb-1">Count</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 20"
                    value={newExpenseForm.count}
                    onChange={(e) =>
                      setNewExpenseForm({
                        ...newExpenseForm,
                        count: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#434652] mb-1">Per Person (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 10"
                    value={newExpenseForm.perPerson}
                    onChange={(e) =>
                      setNewExpenseForm({
                        ...newExpenseForm,
                        perPerson: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#434652] mb-1">Total (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 200"
                    value={newExpenseForm.totalAmount}
                    onChange={(e) =>
                      setNewExpenseForm({
                        ...newExpenseForm,
                        totalAmount: e.target.value,
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
                  placeholder="Optional details or vendor notes"
                  value={newExpenseForm.remarks}
                  onChange={(e) =>
                    setNewExpenseForm({
                      ...newExpenseForm,
                      remarks: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md outline-none"
                />
              </div>

              {/* Bill Attachment */}
              <div>
                <label className="block text-[11px] font-bold text-[#434652] mb-1">Receipt / Bill Attachment</label>
                <label className="px-3 py-1.5 bg-[#f4f3fb] border border-[#c4c6d3] rounded-md text-[12px] font-bold text-[#002869] hover:bg-[#dae2ff] flex items-center gap-1 cursor-pointer w-fit">
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  <span>Upload Receipt File</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => handleUploadBillFile(e, true)}
                  />
                </label>
                {newExpenseForm.billFileName && (
                  <span className="text-[11px] text-[#137333] font-semibold mt-1 block">
                    ✓ Attached: {newExpenseForm.billFileName}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#c4c6d3]">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-white border border-[#c4c6d3] rounded-md text-[12.5px] font-bold text-[#434652] hover:bg-[#f4f3fb] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAddNewExpenseRow()}
                className="px-5 py-2 bg-[#fb7800] text-white rounded-md text-[12.5px] font-bold hover:bg-[#fb7800]/90 cursor-pointer shadow-xs"
              >
                Add Line Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT METADATA MODAL */}
      {/* ========================================================================= */}
      {showEditMetaModal && (
        <div className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white rounded-md max-w-md w-full overflow-hidden shadow-sm border border-[#c4c6d3] space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-[#c4c6d3] pb-3">
              <h3 className="text-[16px] font-bold text-[#002869] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                <span>Edit Statement Details</span>
              </h3>
              <button
                onClick={() => setShowEditMetaModal(false)}
                className="p-1 text-[#747783] hover:text-[#1a1b21] rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div>
                <label className="block text-[11px] font-bold text-[#434652] mb-1">College Name</label>
                <input
                  type="text"
                  value={metaForm.collegeName}
                  onChange={(e) => setMetaForm({ ...metaForm, collegeName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#434652] mb-1">Cluster Name</label>
                <input
                  type="text"
                  value={metaForm.clusterName}
                  onChange={(e) => setMetaForm({ ...metaForm, clusterName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#434652] mb-1">Session Title</label>
                <input
                  type="text"
                  value={metaForm.sessionName}
                  onChange={(e) => setMetaForm({ ...metaForm, sessionName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#434652] mb-1">Session Day</label>
                  <input
                    type="text"
                    value={metaForm.sessionDay}
                    onChange={(e) => setMetaForm({ ...metaForm, sessionDay: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#434652] mb-1">Date</label>
                  <input
                    type="text"
                    value={metaForm.date}
                    onChange={(e) => setMetaForm({ ...metaForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#434652] mb-1">SPOC Name</label>
                  <input
                    type="text"
                    value={metaForm.spocName}
                    onChange={(e) => setMetaForm({ ...metaForm, spocName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#434652] mb-1">Financer Name</label>
                  <input
                    type="text"
                    value={metaForm.financerName}
                    onChange={(e) => setMetaForm({ ...metaForm, financerName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#c4c6d3]">
              <button
                onClick={() => setShowEditMetaModal(false)}
                className="px-4 py-2 bg-white border border-[#c4c6d3] rounded-md text-[12.5px] font-bold text-[#434652] hover:bg-[#f4f3fb] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMetadata}
                className="px-5 py-2 bg-[#002869] text-white rounded-md text-[12.5px] font-bold hover:bg-[#002869]/90 cursor-pointer shadow-xs"
              >
                Save Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ALL BILLS GALLERY MODAL */}
      {/* ========================================================================= */}
      {showAllBillsModal && allAttachedBills.length > 0 && (
        <div
          onClick={() => setShowAllBillsModal(false)}
          className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 cursor-pointer animate-[fadeIn_0.15s_ease-out]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-md max-w-3xl w-full overflow-hidden shadow-sm flex flex-col max-h-[92vh] cursor-default border border-[#c4c6d3]"
          >
            <div className="p-4 bg-[#f4f3fb] border-b border-[#c4c6d3] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-[#002869] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#137333]">photo_library</span>
                  <span>Attached Bills Gallery ({activeGalleryIndex + 1} of {allAttachedBills.length})</span>
                </h3>
                <p className="text-[12px] text-[#434652]">
                  {allAttachedBills[activeGalleryIndex].title} • ₹{allAttachedBills[activeGalleryIndex].amount}
                </p>
              </div>
              <button
                onClick={() => setShowAllBillsModal(false)}
                className="p-1 text-[#434652] hover:bg-[#e8e7ef] rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Gallery Image Display */}
            <div className="p-4 bg-[#1a1b21] flex-1 flex items-center justify-center min-h-[380px] max-h-[60vh] relative">
              <img
                src={allAttachedBills[activeGalleryIndex].url}
                alt="Bill"
                className="max-h-[52vh] object-contain rounded-md shadow-sm"
                referrerPolicy="no-referrer"
              />

              {/* Prev / Next buttons */}
              {allAttachedBills.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setActiveGalleryIndex((prev) =>
                        prev === 0 ? allAttachedBills.length - 1 : prev - 1
                      )
                    }
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[24px]">chevron_left</span>
                  </button>

                  <button
                    onClick={() =>
                      setActiveGalleryIndex((prev) =>
                        prev === allAttachedBills.length - 1 ? 0 : prev + 1
                      )
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[24px]">chevron_right</span>
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Strip */}
            <div className="p-3 bg-[#faf8ff] border-t border-[#c4c6d3] flex items-center gap-2 overflow-x-auto">
              {allAttachedBills.map((bill, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveGalleryIndex(idx)}
                  className={`relative shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 cursor-pointer transition-all ${
                    activeGalleryIndex === idx
                      ? 'border-[#002869] scale-105 shadow-sm'
                      : 'border-[#c4c6d3] opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={bill.url} alt="Thumb" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] px-1 font-mono">
                    #{idx + 1}
                  </span>
                </button>
              ))}
            </div>

            <div className="p-4 bg-white border-t border-[#c4c6d3] flex justify-between items-center">
              <a
                href={allAttachedBills[activeGalleryIndex].url}
                download={allAttachedBills[activeGalleryIndex].fileName}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 bg-[#f4f3fb] border border-[#c4c6d3] text-[#002869] rounded-md text-[12px] font-bold hover:bg-[#dae2ff] flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Download This Bill
              </a>

              <button
                onClick={() => setShowAllBillsModal(false)}
                className="px-5 py-1.5 bg-[#002869] text-white rounded-md text-[12px] font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW STATEMENT MODAL (POPUP VIEW STATEMENT) */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* VIEW STATEMENT MODAL (POPUP VIEW STATEMENT) */}
      {/* ========================================================================= */}
      {showFullStatementModal && (
        <div
          onClick={() => setShowFullStatementModal(false)}
          className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-6 cursor-pointer animate-[fadeIn_0.15s_ease-out]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md max-w-4xl w-full overflow-hidden shadow-sm flex flex-col max-h-[92vh] cursor-default border border-[#c4c6d3] dark:border-gray-800"
          >
            <div className="p-4 bg-[#002869] dark:bg-blue-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                <h3 className="text-[16px] font-bold">Official TQI Finance Statement Preview</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-[11.5px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">table_view</span>
                  Excel
                </button>
                <button
                  onClick={handleExportWord}
                  className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-[11.5px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">description</span>
                  Word
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={isGeneratingPdf}
                  className="px-2.5 py-1 bg-[#fb7800] text-white rounded text-[11.5px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Download TQI Statement PDF"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {isGeneratingPdf ? 'hourglass_top' : 'picture_as_pdf'}
                  </span>
                  {isGeneratingPdf ? 'Generating...' : 'PDF'}
                </button>
                <button
                  onClick={() => setShowFullStatementModal(false)}
                  className="p-1 text-white/80 hover:text-white rounded-full cursor-pointer ml-1"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Header */}
              <div className="text-center space-y-1.5 pb-2 border-b border-[#dae2ff] dark:border-gray-800">
                <div className="flex items-center justify-center">
                  <TqiLogo size={75} className="mx-auto" />
                </div>
                <h2 className="text-[20px] font-extrabold text-[#000000] dark:text-white pt-1">
                  Talent Quest for India
                </h2>
                <div className="text-[13px] font-bold text-[#434652] dark:text-gray-300">
                  Academic year {academicYear}
                </div>
                <div className="text-[13px] font-extrabold text-[#002869] dark:text-blue-400 uppercase tracking-wider">
                  Finance report
                </div>
                <div className="text-[12.5px] font-bold text-[#592600] dark:text-amber-400">
                  {statementMeta.sessionName} · {statementMeta.sessionDay}
                </div>
              </div>

              {/* Unboxed Metadata in Modal */}
              <div className="bg-[#faf8ff] dark:bg-gray-800/60 p-4 rounded-md border border-[#c4c6d3]/60 dark:border-gray-700 text-[12.5px] grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[#747783] dark:text-gray-400 font-bold uppercase text-[10.5px] block">COLLEGE</span>
                  <span className="font-bold text-[#000000] dark:text-gray-100">{statementMeta.collegeName}</span>
                </div>
                <div>
                  <span className="text-[#747783] dark:text-gray-400 font-bold uppercase text-[10.5px] block">DATE</span>
                  <span className="font-semibold text-[#000000] dark:text-gray-100">{statementMeta.date}</span>
                </div>
                <div>
                  <span className="text-[#747783] dark:text-gray-400 font-bold uppercase text-[10.5px] block">SESSION</span>
                  <span className="font-bold text-[#002869] dark:text-blue-300">{statementMeta.sessionName} · {statementMeta.sessionDay}</span>
                </div>
                <div>
                  <span className="text-[#747783] dark:text-gray-400 font-bold uppercase text-[10.5px] block">SPOC</span>
                  <span className="font-semibold text-[#000000] dark:text-gray-100">{statementMeta.spocName}</span>
                </div>
                <div>
                  <span className="text-[#747783] dark:text-gray-400 font-bold uppercase text-[10.5px] block">FINANCE OFFICER</span>
                  <span className="font-semibold text-[#000000] dark:text-gray-100">{statementMeta.financerName}</span>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-left text-[12px] border-collapse border border-[#c4c6d3] dark:border-gray-700">
                <thead className="bg-[#faf8ff] dark:bg-gray-800 font-bold text-[#000000] dark:text-gray-100 border-b border-[#c4c6d3] dark:border-gray-700">
                  <tr>
                    <th className="p-2 border-r border-[#c4c6d3] dark:border-gray-700 w-10 text-center">S.No</th>
                    <th className="p-2 border-r border-[#c4c6d3] dark:border-gray-700 w-20">Category</th>
                    <th className="p-2 border-r border-[#c4c6d3] dark:border-gray-700">Description</th>
                    <th className="p-2 border-r border-[#c4c6d3] dark:border-gray-700 text-center w-14">Count</th>
                    <th className="p-2 border-r border-[#c4c6d3] dark:border-gray-700 text-center w-20">Count×Amt</th>
                    <th className="p-2 border-r border-[#c4c6d3] dark:border-gray-700 text-right w-20">Total</th>
                    <th className="p-2 border-r border-[#c4c6d3] dark:border-gray-700 text-center w-16">Bills</th>
                    <th className="p-2">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c4c6d3] dark:divide-gray-700">
                  {tableItems.map((item) => (
                    <tr key={item.id} className="text-[#1a1b21] dark:text-gray-200">
                      <td className="p-2 border-r border-[#c4c6d3] dark:border-gray-700 text-center text-gray-500 dark:text-gray-400">{item.sNo}</td>
                      <td className="p-2 border-r border-[#c4c6d3] dark:border-gray-700 font-bold text-[#002869] dark:text-blue-300">{item.category}</td>
                      <td className="p-2 border-r border-[#c4c6d3] dark:border-gray-700">{item.description}</td>
                      <td className="p-2 border-r border-[#c4c6d3] dark:border-gray-700 text-center">{item.count}</td>
                      <td className="p-2 border-r border-[#c4c6d3] dark:border-gray-700 text-center">{item.countAmount}</td>
                      <td className="p-2 border-r border-[#c4c6d3] dark:border-gray-700 text-right font-bold text-[#002869] dark:text-blue-300">
                        ₹{item.total.toLocaleString()}
                      </td>
                      <td className="p-2 border-r border-[#c4c6d3] dark:border-gray-700 text-center">
                        {item.billUrl ? <span className="text-[#137333] dark:text-emerald-400 font-bold text-[11px]">Attached</span> : '—'}
                      </td>
                      <td className="p-2 text-[#747783] dark:text-gray-400">{item.remarks}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#dae2ff] dark:bg-blue-950/70 font-extrabold text-[#001947] dark:text-blue-200">
                    <td colSpan={5} className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-right text-[13px]">
                      Grand Total
                    </td>
                    <td className="p-2.5 border-r border-[#c4c6d3] dark:border-gray-700 text-right font-mono text-[14px]">
                      ₹{grandTotal.toLocaleString()}
                    </td>
                    <td colSpan={2} className="p-2.5 bg-[#dae2ff] dark:bg-blue-950/70"></td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-[12px]">
                <div>
                  <div className="border-t border-[#000000] dark:border-gray-600 pt-1.5 font-bold text-[#000000] dark:text-gray-100">Coordinator</div>
                  <div className="text-[11px] text-[#747783] dark:text-gray-400">{statementMeta.spocName}</div>
                </div>
                <div>
                  <div className="border-t border-[#000000] dark:border-gray-600 pt-1.5 font-bold text-[#000000] dark:text-gray-100">Cluster Admin</div>
                  <div className="text-[11px] text-[#747783] dark:text-gray-400">{statementMeta.financerName}</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#faf8ff] dark:bg-gray-800 border-t border-[#c4c6d3] dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowFullStatementModal(false)}
                className="px-5 py-2 bg-[#002869] dark:bg-blue-600 hover:bg-[#002869]/90 text-white rounded-md text-[12.5px] font-bold cursor-pointer"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


