import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BillScannerModal, BillAttachment } from './BillScannerModal';
import { FinanceEntry, FinanceDraft, Session } from '../types';
import {
  X,
  Save,
  Send,
  Plus,
  Trash2,
  Upload,
  Camera,
  Car,
  Utensils,
  BookOpen,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  ReceiptIndianRupee,
  Calendar,
  Building2,
} from './ui/icons';
import { ActionButton } from './ui/action-button';

interface RouteItem {
  id: string;
  from: string;
  to: string;
  volunteers: number;
  perPerson: number;
  remarks: string;
  bill: BillAttachment | null;
}

interface FoodState {
  breakfast: { amount: number; remarks: string; bill: BillAttachment | null };
  lunch: { amount: number; remarks: string; bill: BillAttachment | null };
  dinner: { amount: number; remarks: string; bill: BillAttachment | null };
  refreshments: { amount: number; remarks: string; bill: BillAttachment | null };
}

interface OtherItem {
  id: string;
  description: string;
  amount: number;
  remarks: string;
  bill: BillAttachment | null;
}

interface NewFinanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusterName?: string;
  collegeName?: string;
  spocName?: string;
  financerName?: string;
  sessions?: Session[];
  clusterId?: string;
  defaultSessionDay?: string;
  initialDraft?: FinanceDraft | null;
  draftOnly?: boolean;
  onSubmitFinance: (entries: Omit<FinanceEntry, 'id'>[], isDraft: boolean) => void | Promise<void>;
  onSaveDraftPackage?: (draft: FinanceDraft) => void | Promise<void>;
}

export const NewFinanceModal: React.FC<NewFinanceModalProps> = ({
  isOpen,
  onClose,
  clusterName = 'Cluster',
  collegeName = 'Partner Institution',
  spocName = 'Coordinator / SPOC',
  financerName = 'TQI Finance Team',
  sessions = [],
  clusterId = '',
  defaultSessionDay,
  initialDraft = null,
  draftOnly = false,
  onSubmitFinance,
  onSaveDraftPackage,
}) => {
  const fallbackDefaultDay = `Day ${sessions.find((session) => !clusterId || session.clusterId === clusterId)?.dayNumber || 1}`;
  const initialDay = defaultSessionDay || initialDraft?.sessionDay || fallbackDefaultDay;

  const createEmptyRoute = (): RouteItem => ({
    id: 'route-1',
    from: '',
    to: '',
    volunteers: 0,
    perPerson: 0,
    remarks: '',
    bill: null,
  });

  const createEmptyFood = (): FoodState => ({
    breakfast: { amount: 0, remarks: '', bill: null },
    lunch: { amount: 0, remarks: '', bill: null },
    dinner: { amount: 0, remarks: '', bill: null },
    refreshments: { amount: 0, remarks: '', bill: null },
  });

  const createEmptyOtherItem = (): OtherItem => ({
    id: 'other-1',
    description: '',
    amount: 0,
    remarks: '',
    bill: null,
  });

  const createBlankFinanceForm = (draft?: FinanceDraft | null, overrideDay?: string) => ({
    sessionDay: draft?.sessionDay || overrideDay || initialDay,
    plannedDate: draft?.sessionDate || '',
    travel: { routes: draft?.routes || [createEmptyRoute()] },
    food: draft?.food || createEmptyFood(),
    stationery: draft?.stationery || { amount: 0, remarks: '', bill: null },
    other: { items: draft?.otherItems || [createEmptyOtherItem()] },
  });

  const [financeForm, setFinanceForm] = useState(() => createBlankFinanceForm(initialDraft, defaultSessionDay));
  const [activeTab, setActiveTab] = useState<'Travel' | 'Food' | 'Stationery' | 'Other' | 'Preview'>('Travel');
  const [isSaving, setIsSaving] = useState(false);
  const draftIdRef = useRef<string | null>(initialDraft?.id || null);

  const sessionDay = financeForm.sessionDay;
  const sessionDate = financeForm.plannedDate;
  const routes = financeForm.travel.routes;
  const food = financeForm.food;
  const stationery = financeForm.stationery;
  const otherItems = financeForm.other.items;

  const setSessionDay = (value: string) => setFinanceForm((prev) => ({ ...prev, sessionDay: value }));
  const setSessionDate = (value: string) => setFinanceForm((prev) => ({ ...prev, plannedDate: value }));
  const setRoutes = (updater: React.SetStateAction<RouteItem[]>) => {
    setFinanceForm((prev) => ({
      ...prev,
      travel: {
        ...prev.travel,
        routes: typeof updater === 'function'
          ? (updater as (prevRoutes: RouteItem[]) => RouteItem[])(prev.travel.routes)
          : updater,
      },
    }));
  };
  const setFood = (updater: React.SetStateAction<FoodState>) => {
    setFinanceForm((prev) => ({
      ...prev,
      food: typeof updater === 'function'
        ? (updater as (prevFood: FoodState) => FoodState)(prev.food)
        : updater,
    }));
  };
  const setStationery = (updater: React.SetStateAction<{ amount: number; remarks: string; bill: BillAttachment | null }>) => {
    setFinanceForm((prev) => ({
      ...prev,
      stationery: typeof updater === 'function'
        ? (updater as (prevStationery: { amount: number; remarks: string; bill: BillAttachment | null }) => { amount: number; remarks: string; bill: BillAttachment | null })(prev.stationery)
        : updater,
    }));
  };
  const setOtherItems = (updater: React.SetStateAction<OtherItem[]>) => {
    setFinanceForm((prev) => ({
      ...prev,
      other: {
        ...prev.other,
        items: typeof updater === 'function'
          ? (updater as (prevItems: OtherItem[]) => OtherItem[])(prev.other.items)
          : updater,
      },
    }));
  };

  // Scanner target state
  const [scannerTarget, setScannerTarget] = useState<{
    type: 'travel' | 'food' | 'stationery' | 'other';
    id?: string;
    foodKey?: keyof FoodState;
    label: string;
    expectedAmount: number;
  } | null>(null);

  const availableSessions = useMemo(() => sessions
    .filter((session) => !clusterId || session.clusterId === clusterId)
    .filter((session) => Number(session.dayNumber) > 0)
    .sort((a, b) => Number(a.dayNumber) - Number(b.dayNumber)), [sessions, clusterId]);
  const selectedDayNumber = Number(sessionDay.match(/\d+/)?.[0] || 1);
  const plannedSession = availableSessions.find((session) => Number(session.dayNumber) === selectedDayNumber);
  const sessionOptions = [...new Set(availableSessions.map((session) => `Day ${session.dayNumber}`))];
  if (!sessionOptions.length) sessionOptions.push(...Array.from({ length: 8 }, (_, index) => `Day ${index + 1}`));
  const plannedSessionName = plannedSession?.name || plannedSession?.title || initialDraft?.title || `${sessionDay} Session`;

  const resetEmptyForm = (nextDay?: string) => {
    setFinanceForm(createBlankFinanceForm(null, nextDay || defaultSessionDay || `Day ${availableSessions[0]?.dayNumber || 1}`));
    setActiveTab('Travel');
  };

  // Initialize only when the modal opens or the selected draft/day changes.
  // `availableSessions` can get a new array when parent data refreshes; using it
  // as a dependency here would reset all fields while the user is typing.
  useEffect(() => {
    if (initialDraft) {
      draftIdRef.current = initialDraft.id;
      setFinanceForm(createBlankFinanceForm(initialDraft, defaultSessionDay));
      setActiveTab('Travel');
    } else if (isOpen) {
      if (!draftIdRef.current) draftIdRef.current = `draft-${initialDay.toLowerCase().replace(/\s+/g, '')}-${Date.now()}`;
      resetEmptyForm(defaultSessionDay || `Day ${availableSessions[0]?.dayNumber || 1}`);
    } else {
      draftIdRef.current = null;
    }
    // The form should not be reset when session data is refreshed in the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraft?.id, isOpen, defaultSessionDay]);

  useEffect(() => {
    setSessionDate(plannedSession?.date?.slice(0, 10) || (initialDraft?.sessionDay === sessionDay ? initialDraft.sessionDate : ''));
  }, [plannedSession?.id, plannedSession?.date, initialDraft, sessionDay]);

  // Calculations
  const travelTotal = useMemo(() => {
    return routes.reduce((sum, r) => sum + (r.volunteers || 0) * (r.perPerson || 0), 0);
  }, [routes]);

  const foodTotal = useMemo(() => {
    return (
      (food.breakfast.amount || 0) +
      (food.lunch.amount || 0) +
      (food.dinner.amount || 0) +
      (food.refreshments.amount || 0)
    );
  }, [food]);

  const stationeryTotal = useMemo(() => {
    return stationery.amount || 0;
  }, [stationery]);

  const otherTotal = useMemo(() => {
    return otherItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [otherItems]);

  const grandTotal = travelTotal + foodTotal + stationeryTotal + otherTotal;

  // Travel Route Actions
  const handleAddRoute = () => {
    const newRoute: RouteItem = {
      id: `route-${Date.now()}`,
      from: '',
      to: '',
      volunteers: 0,
      perPerson: 0,
      remarks: '',
      bill: null,
    };
    setRoutes((prev) => [...prev, newRoute]);
  };

  const handleUpdateRoute = (id: string, field: keyof RouteItem, value: any) => {
    setRoutes((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;

        const nextRoute = { ...r, [field]: value };
        const volunteers = field === 'volunteers' ? Number(value) || 0 : Number(r.volunteers) || 0;
        const perPerson = field === 'perPerson' ? Number(value) || 0 : Number(r.perPerson) || 0;
        const billAmount = r.bill?.detectedAmount || 0;

        if (volunteers > 0 && billAmount > 0 && (!perPerson || perPerson === 0)) {
          nextRoute.perPerson = Math.round(billAmount / volunteers);
        }

        if (field === 'volunteers' && Number(value) > 0 && Number(r.perPerson) > 0 && (Number(value) || 0) !== Number(r.volunteers)) {
          nextRoute.perPerson = Number(r.perPerson);
        }

        return nextRoute;
      })
    );
  };

  const handleRemoveRoute = (id: string) => {
    if (routes.length <= 1) {
      setRoutes([
        {
          id: `route-${Date.now()}`,
          from: '',
          to: '',
          volunteers: 0,
          perPerson: 0,
          remarks: '',
          bill: null,
        },
      ]);
      return;
    }
    setRoutes((prev) => prev.filter((r) => r.id !== id));
  };

  // Other Item Actions
  const handleAddOther = () => {
    const newItem: OtherItem = {
      id: `other-${Date.now()}`,
      description: '',
      amount: 0,
      remarks: '',
      bill: null,
    };
    setOtherItems((prev) => [...prev, newItem]);
  };

  const handleUpdateOther = (id: string, field: keyof OtherItem, value: any) => {
    setOtherItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveOther = (id: string) => {
    if (otherItems.length <= 1) {
      setOtherItems([
        {
          id: `other-${Date.now()}`,
          description: '',
          amount: 0,
          remarks: '',
          bill: null,
        },
      ]);
      return;
    }
    setOtherItems((prev) => prev.filter((item) => item.id !== id));
  };

  // File Upload Direct Handler
  const handleDirectFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'travel' | 'food' | 'stationery' | 'other',
    id?: string,
    foodKey?: keyof FoodState,
    currentAmount?: number
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          const attachment: BillAttachment = {
            url: reader.result as string,
            fileName: file.name,
            detectedAmount: currentAmount || 0,
            isVerified: true,
          };
          attachBillToTarget(type, attachment, id, foodKey);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Attach bill logic with Smart Route & Amount Auto-Writer
  const attachBillToTarget = (
    type: 'travel' | 'food' | 'stationery' | 'other',
    bill: BillAttachment,
    id?: string,
    foodKey?: keyof FoodState
  ) => {
    if (type === 'travel' && id) {
      setRoutes((prev) =>
        prev.map((r) => {
          if (r.id === id) {
            let updated = { ...r, bill };
            if (bill.origin && (!r.from || r.from === '')) {
              updated.from = bill.origin;
            }
            if (bill.destination && (!r.to || r.to === '')) {
              updated.to = bill.destination;
            }
            if (bill.detectedAmount && bill.detectedAmount > 0) {
              if (updated.volunteers > 0) {
                updated.perPerson = Math.round(bill.detectedAmount / updated.volunteers);
              } else {
                updated.volunteers = 1;
                updated.perPerson = bill.detectedAmount;
              }
            }
            if (!updated.remarks && (bill.origin || bill.destination)) {
              updated.remarks = `Ticket Route: ${bill.origin || 'Origin'} to ${bill.destination || 'Destination'}`;
            }
            return updated;
          }
          return r;
        })
      );
    } else if (type === 'food' && foodKey) {
      setFood((prev) => ({
        ...prev,
        [foodKey]: {
          ...prev[foodKey],
          bill,
          amount: prev[foodKey].amount === 0 && bill.detectedAmount ? bill.detectedAmount : prev[foodKey].amount,
        },
      }));
    } else if (type === 'stationery') {
      setStationery((prev) => ({
        ...prev,
        bill,
        amount: prev.amount === 0 && bill.detectedAmount ? bill.detectedAmount : prev.amount,
      }));
    } else if (type === 'other' && id) {
      setOtherItems((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            return {
              ...item,
              bill,
              amount: item.amount === 0 && bill.detectedAmount ? bill.detectedAmount : item.amount,
            };
          }
          return item;
        })
      );
    }
  };

  // Submit Logic
  const handleSubmit = async (isDraft: boolean) => {
    if (!sessionDate) {
      alert('Please select a planned date before saving or submitting finance.');
      return;
    }

    const entries: Omit<FinanceEntry, 'id'>[] = [];
    const draftId = initialDraft?.id || draftIdRef.current || `draft-${sessionDay.toLowerCase().replace(/\s+/g, '')}-${Date.now()}`;
    draftIdRef.current = draftId;

    // 1. Travel Entries
    routes.forEach((r) => {
      const amt = (r.volunteers || 0) * (r.perPerson || 0);
      if (amt > 0 || r.from || r.to) {
        entries.push({
          date: sessionDate,
          description: `Travel: ${r.from || 'Origin'} → ${r.to || 'Destination'} (${r.volunteers} vols × ₹${r.perPerson})`,
          category: 'Travel',
          amount: amt,
          panchayatId: 'dharmapuri-main',
          panchayatName: clusterName,
          villageName: r.to || 'Cluster Center',
          status: isDraft ? 'Draft' : 'Pending',
          billUrl: r.bill?.url,
          remarks: r.remarks || `${r.volunteers} Volunteers travel reimbursement`,
          count: r.volunteers,
          countAmount: `${r.volunteers}×${r.perPerson}`,
          sessionDay: sessionDay,
          draftId,
        });
      }
    });

    // 2. Food Entries
    if (food.breakfast.amount > 0) {
      entries.push({
        date: sessionDate,
        description: `Food: Breakfast (${sessionDay})`,
        category: 'Food',
        amount: food.breakfast.amount,
        panchayatId: 'dharmapuri-main',
        panchayatName: clusterName,
        villageName: 'Cluster Center',
        status: isDraft ? 'Draft' : 'Pending',
        billUrl: food.breakfast.bill?.url,
        remarks: food.breakfast.remarks || 'Volunteer breakfast',
        sessionDay: sessionDay,
        draftId,
      });
    }
    if (food.lunch.amount > 0) {
      entries.push({
        date: sessionDate,
        description: `Food: Lunch (${sessionDay})`,
        category: 'Food',
        amount: food.lunch.amount,
        panchayatId: 'dharmapuri-main',
        panchayatName: clusterName,
        villageName: 'Cluster Center',
        status: isDraft ? 'Draft' : 'Pending',
        billUrl: food.lunch.bill?.url,
        remarks: food.lunch.remarks || 'Volunteer lunch meals',
        sessionDay: sessionDay,
        draftId,
      });
    }
    if (food.dinner.amount > 0) {
      entries.push({
        date: sessionDate,
        description: `Food: Dinner (${sessionDay})`,
        category: 'Food',
        amount: food.dinner.amount,
        panchayatId: 'dharmapuri-main',
        panchayatName: clusterName,
        villageName: 'Cluster Center',
        status: isDraft ? 'Draft' : 'Pending',
        billUrl: food.dinner.bill?.url,
        remarks: food.dinner.remarks || 'Volunteer dinner',
        sessionDay: sessionDay,
        draftId,
      });
    }
    if (food.refreshments.amount > 0) {
      entries.push({
        date: sessionDate,
        description: `Food: Refreshments & Tea (${sessionDay})`,
        category: 'Food',
        amount: food.refreshments.amount,
        panchayatId: 'dharmapuri-main',
        panchayatName: clusterName,
        villageName: 'Cluster Center',
        status: isDraft ? 'Draft' : 'Pending',
        billUrl: food.refreshments.bill?.url,
        remarks: food.refreshments.remarks || 'Snacks and tea',
        sessionDay: sessionDay,
        draftId,
      });
    }

    // 3. Stationery
    if (stationery.amount > 0) {
      entries.push({
        date: sessionDate,
        description: `Stationery: Materials & Notebooks (${sessionDay})`,
        category: 'Materials',
        amount: stationery.amount,
        panchayatId: 'dharmapuri-main',
        panchayatName: clusterName,
        villageName: 'Cluster Center',
          status: isDraft ? 'Draft' : 'Pending',
        billUrl: stationery.bill?.url,
        remarks: stationery.remarks || 'Classroom student stationery kits',
        sessionDay: sessionDay,
        draftId,
      });
    }

    // 4. Other Items
    otherItems.forEach((item) => {
      if (item.amount > 0 || item.description) {
        entries.push({
          date: sessionDate,
          description: `Other: ${item.description || 'Miscellaneous Expense'}`,
          category: 'Other',
          amount: item.amount || 0,
          panchayatId: 'dharmapuri-main',
          panchayatName: clusterName,
          villageName: 'Cluster Center',
          status: isDraft ? 'Draft' : 'Pending',
          billUrl: item.bill?.url,
          remarks: item.remarks || item.description,
          sessionDay: sessionDay,
          draftId,
        });
      }
    });

    if (entries.length === 0) {
      alert('Please fill at least one expense entry before saving.');
      return;
    }
    if (entries.some((entry) => !entry.description.trim() || !Number.isFinite(Number(entry.amount)) || entry.amount <= 0)) {
      alert('Every expense must have a description and a valid amount greater than zero.');
      return;
    }
    if (!isDraft) {
      const billCount = entries.filter((entry) => Boolean(entry.billUrl)).length;
      const confirmed = window.confirm(
        `Submit Finance Report for Super Admin approval?\n\nTotal Expenses: ₹${grandTotal.toLocaleString()}\nExpense Entries: ${entries.length}\nBills: ${billCount}\n\nOnce submitted, the report will be locked for editing.`,
      );
      if (!confirmed) return;
    }

    const financeEntries = entries.map((entry) => ({
      ...entry,
      sessionId: plannedSession?.id,
      clusterId: clusterId || plannedSession?.clusterId,
      clusterName,
    }));

    const draftPackage: FinanceDraft = {
        id: draftId,
        title: plannedSessionName,
        sessionDay,
        sessionDate,
        clusterId: clusterId || plannedSession?.clusterId,
        clusterName,
        collegeName: collegeName || '—',
        spocName: spocName || '—',
        financerName: financerName || 'TQI Finance Team',
        status: isDraft ? 'Draft' : 'Pending',
        lastSaved: 'Just now',
        totalAmount: grandTotal,
        routes,
        food,
        stationery,
        otherItems,
      };

    if (isSaving) return;
    setIsSaving(true);
    try {
      // Persist the report package first. If this fails, do not leave orphaned
      // expense rows behind; retries keep this same draft ID.
      await onSaveDraftPackage?.(draftPackage);
      await onSubmitFinance(financeEntries, isDraft);
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to save finance. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="tqi-modal-mobile-full fixed inset-0 z-[99999] flex items-center justify-center p-0 sm:p-4 md:p-6 bg-gray-900/75 backdrop-blur-sm animate-in fade-in-0 duration-200">
        <div className="tqi-modal-panel relative w-full h-full sm:h-auto sm:max-h-[94vh] sm:max-w-4xl flex flex-col rounded-none sm:rounded-2xl border-0 sm:border border-gray-200 bg-white shadow-theme-xl dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
          {/* Top Modal Header */}
          <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400 shrink-0">
                <ReceiptIndianRupee className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                  New Finance Entry
                </h2>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {collegeName} &middot; {sessionDay}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Session Day & Date Selector Row */}
          <div className="px-4 sm:px-6 py-3 bg-gray-50/70 dark:bg-white/[0.02] border-b border-gray-100 dark:border-gray-800 grid grid-cols-2 md:grid-cols-3 gap-3 shrink-0">
            <div className="col-span-2 md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-2 rounded-xl border border-gray-200 bg-white/80 p-3 dark:border-gray-800 dark:bg-gray-900/60">
              <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500">College</span><span className="mt-1 block truncate text-xs font-semibold text-gray-900 dark:text-white" title={collegeName}>{collegeName || 'College not configured'}</span></div>
              <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Session Name</span><span className="mt-1 block truncate text-xs font-semibold text-gray-900 dark:text-white" title={plannedSessionName}>{plannedSessionName}</span></div>
              <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500">SPOC Name</span><span className="mt-1 block truncate text-xs font-semibold text-gray-900 dark:text-white">{spocName || 'Not assigned'}</span></div>
              <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Finance Officer</span><span className="mt-1 block truncate text-xs font-semibold text-gray-900 dark:text-white">{financerName}</span></div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Session Day *
              </label>
              <div className="flex w-full h-10 sm:h-9 items-center rounded-xl border border-gray-200 bg-gray-100 px-3 text-xs font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                {sessionDay}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Planned Date *
              </label>
              <input
                type="date"
                value={sessionDate}
                required
                onChange={(event) => setSessionDate(event.target.value)}
                className="w-full h-10 sm:h-9 px-3 bg-white dark:bg-gray-800 border border-gray-300 rounded-xl text-xs font-medium text-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Category Tabs Pill Bar (Mobile Horizontal Swipe) */}
          <div className="flex border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 sm:px-6 overflow-x-auto no-scrollbar gap-1.5 py-2.5 shrink-0">
            {(
              [
                { id: 'Travel', label: 'Travel', icon: Car, total: travelTotal },
                { id: 'Food', label: 'Food', icon: Utensils, total: foodTotal },
                { id: 'Stationery', label: 'Stationery', icon: BookOpen, total: stationeryTotal },
                { id: 'Other', label: 'Other', icon: Sparkles, total: otherTotal },
                { id: 'Preview', label: 'Preview Sheet', icon: FileSpreadsheet, total: 0 },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              const TabIcon = tab.icon;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? 'bg-brand-500 text-white shadow-theme-xs'
                      : 'bg-gray-100/70 text-gray-700 hover:bg-gray-100 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10'
                  }`}
                >
                  <TabIcon className="h-4 w-4 shrink-0" />
                  <span>{tab.label}</span>
                  {tab.total > 0 && tab.id !== 'Preview' && (
                    <span
                      className={`text-[10.5px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
                        isActive ? 'bg-white/20 text-white' : 'bg-brand-500 text-white'
                      }`}
                    >
                      ₹{tab.total.toLocaleString()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Modal Tab Content Area with Smooth Scroll */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gray-50/50 dark:bg-gray-950/30 custom-scrollbar">
            {/* 1. TRAVEL TAB */}
            {activeTab === 'Travel' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Volunteer Travel Routes</h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Add all bus, train, or fuel trips taken for this session.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRoute}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 text-xs font-semibold rounded-xl border border-brand-200 dark:border-brand-500/20 transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Route</span>
                  </button>
                </div>

                <div className="space-y-3.5">
                  {routes.map((route, idx) => {
                    const rowTotal = (route.volunteers || 0) * (route.perPerson || 0);

                    return (
                      <div
                        key={route.id}
                        className="p-4 sm:p-5 border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900 shadow-theme-xs space-y-3"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                            Route #{idx + 1}
                          </span>
                          <span className="text-xs font-mono font-bold text-brand-500 bg-brand-50 dark:bg-brand-500/10 px-2 py-0.5 rounded-lg">
                            Total: ₹{rowTotal.toLocaleString()}
                          </span>
                        </div>

                        {/* Origin & Destination (2-col or stacked on small mobile) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                              From (Origin) *
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. KSR College"
                              value={route.from}
                              onChange={(e) => handleUpdateRoute(route.id, 'from', e.target.value)}
                              className="w-full h-10 sm:h-9 px-3 bg-transparent border border-gray-300 rounded-xl text-xs text-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:border-brand-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                              To (Destination) *
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Dharmapuri Village"
                              value={route.to}
                              onChange={(e) => handleUpdateRoute(route.id, 'to', e.target.value)}
                              className="w-full h-10 sm:h-9 px-3 bg-transparent border border-gray-300 rounded-xl text-xs text-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:border-brand-500"
                            />
                          </div>
                        </div>

                        {/* Volunteers & Per Person Cost */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                              Volunteers Count
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={route.volunteers || ''}
                              placeholder="0"
                              onChange={(e) =>
                                handleUpdateRoute(
                                  route.id,
                                  'volunteers',
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="w-full h-10 sm:h-9 px-3 bg-transparent border border-gray-300 rounded-xl text-xs text-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:border-brand-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                              Cost Per Person (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={route.perPerson || ''}
                              placeholder="0"
                              onChange={(e) =>
                                handleUpdateRoute(
                                  route.id,
                                  'perPerson',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full h-10 sm:h-9 px-3 bg-transparent border border-gray-300 rounded-xl text-xs text-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:border-brand-500"
                            />
                          </div>
                        </div>

                        {/* Remarks */}
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                            Remarks / Ticket Details
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Bus fare ticket #1284"
                            value={route.remarks}
                            onChange={(e) => handleUpdateRoute(route.id, 'remarks', e.target.value)}
                            className="w-full h-10 sm:h-9 px-3 bg-transparent border border-gray-300 rounded-xl text-xs text-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:border-brand-500"
                          />
                        </div>

                        {/* Bill Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                            <label className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold transition cursor-pointer">
                              <Upload className="h-3.5 w-3.5" />
                              <span>Upload Bill</span>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) =>
                                  handleDirectFileUpload(e, 'travel', route.id, undefined, rowTotal)
                                }
                              />
                            </label>

                            <button
                              type="button"
                              onClick={() =>
                                setScannerTarget({
                                  type: 'travel',
                                  id: route.id,
                                  label: `Travel: ${route.from || 'Route'} to ${route.to || 'Destination'}`,
                                  expectedAmount: rowTotal,
                                })
                              }
                              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600 transition shadow-theme-xs cursor-pointer"
                            >
                              <Camera className="h-3.5 w-3.5" />
                              <span>Scan OCR Bill</span>
                            </button>
                          </div>

                          <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                            {route.bill && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span className="truncate max-w-[120px]">{route.bill.fileName}</span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateRoute(route.id, 'bill', null)}
                                  className="text-error-500 hover:bg-error-50 p-0.5 rounded ml-1 cursor-pointer"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            )}

                            {routes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveRoute(route.id)}
                                className="flex items-center gap-1 text-xs font-semibold text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-500/10 px-2.5 py-1.5 rounded-xl transition cursor-pointer ml-auto"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Remove</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. FOOD TAB */}
            {activeTab === 'Food' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Volunteer & Team Meals</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Record food and refreshments provided during session execution.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      { key: 'breakfast', title: 'Breakfast' },
                      { key: 'lunch', title: 'Lunch' },
                      { key: 'dinner', title: 'Dinner' },
                      { key: 'refreshments', title: 'Refreshments & Tea' },
                    ] as const
                  ).map(({ key, title }) => {
                    const mealItem = food[key];

                    return (
                      <div
                        key={key}
                        className="p-4 border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900 shadow-theme-xs space-y-3"
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 dark:border-gray-800">
                          <h4 className="text-xs font-bold text-gray-900 dark:text-white">{title}</h4>
                          <span className="text-xs font-mono font-bold text-brand-500">
                            ₹{(mealItem.amount || 0).toLocaleString()}
                          </span>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                            Amount (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={mealItem.amount || ''}
                            placeholder="0"
                            onChange={(e) =>
                              setFood((prev) => ({
                                ...prev,
                                [key]: {
                                  ...prev[key],
                                  amount: parseFloat(e.target.value) || 0,
                                },
                              }))
                            }
                            className="w-full h-10 sm:h-9 px-3 bg-transparent border border-gray-300 rounded-xl text-xs text-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:border-brand-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                            Remarks / Details
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 15 meal packets"
                            value={mealItem.remarks}
                            onChange={(e) =>
                              setFood((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], remarks: e.target.value },
                              }))
                            }
                            className="w-full h-10 sm:h-9 px-3 bg-transparent border border-gray-300 rounded-xl text-xs text-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:border-brand-500"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                          <label className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold cursor-pointer">
                            <Upload className="h-3.5 w-3.5" />
                            <span>Upload</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={(e) =>
                                handleDirectFileUpload(e, 'food', undefined, key, mealItem.amount)
                              }
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() =>
                              setScannerTarget({
                                type: 'food',
                                foodKey: key,
                                label: `Food: ${title}`,
                                expectedAmount: mealItem.amount,
                              })
                            }
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600 transition shadow-theme-xs cursor-pointer"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            <span>Scan Bill</span>
                          </button>

                          {mealItem.bill && (
                            <div className="w-full flex items-center justify-between px-2 py-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                              <div className="flex items-center gap-1 truncate">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{mealItem.bill.fileName}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setFood((prev) => ({
                                    ...prev,
                                    [key]: { ...prev[key], bill: null },
                                  }))
                                }
                                className="text-error-500 hover:bg-error-50 p-0.5 rounded cursor-pointer shrink-0 ml-1"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. STATIONERY TAB */}
            {activeTab === 'Stationery' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Classroom Stationery</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Materials, pens, chart papers, activity worksheets, student notebooks.</p>
                </div>

                <div className="p-4 sm:p-5 border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900 shadow-theme-xs space-y-3.5 max-w-xl">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={stationery.amount || ''}
                      placeholder="0"
                      onChange={(e) =>
                        setStationery((prev) => ({
                          ...prev,
                          amount: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full h-10 sm:h-9 px-3 bg-transparent border border-gray-300 rounded-xl text-sm font-bold text-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                      Remarks / Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Chart papers, sketch pens, student activity sheets"
                      value={stationery.remarks}
                      onChange={(e) =>
                        setStationery((prev) => ({
                          ...prev,
                          remarks: e.target.value,
                        }))
                      }
                      className="w-full h-10 sm:h-9 px-3 bg-transparent border border-gray-300 rounded-xl text-xs text-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                    <label className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold cursor-pointer">
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload Bill</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) =>
                          handleDirectFileUpload(e, 'stationery', undefined, undefined, stationery.amount)
                        }
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setScannerTarget({
                          type: 'stationery',
                          label: 'Stationery Items',
                          expectedAmount: stationery.amount,
                        })
                      }
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600 transition shadow-theme-xs cursor-pointer"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>Scan Bill</span>
                    </button>

                    {stationery.bill && (
                      <div className="w-full flex items-center justify-between px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <div className="flex items-center gap-1.5 truncate">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{stationery.bill.fileName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setStationery((prev) => ({ ...prev, bill: null }))}
                          className="text-error-500 hover:bg-error-50 p-0.5 rounded cursor-pointer shrink-0 ml-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 4. OTHER TAB */}
            {activeTab === 'Other' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Other Expenses</h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Banners, mic/sound rental, stage setups, or incidentals.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddOther}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 text-xs font-semibold rounded-xl border border-brand-200 dark:border-brand-500/20 transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Expense</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {otherItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900 shadow-theme-xs space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                            Description *
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Flex Banner for Event"
                            value={item.description}
                            onChange={(e) =>
                              handleUpdateOther(item.id, 'description', e.target.value)
                            }
                            className="w-full h-10 sm:h-9 px-3 bg-transparent border border-gray-300 rounded-xl text-xs text-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:border-brand-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                            Amount (₹) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.amount || ''}
                            placeholder="0"
                            onChange={(e) =>
                              handleUpdateOther(
                                item.id,
                                'amount',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full h-10 sm:h-9 px-3 bg-transparent border border-gray-300 rounded-xl text-xs font-bold text-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:border-brand-500"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                          <label className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold cursor-pointer">
                            <Upload className="h-3.5 w-3.5" />
                            <span>Upload Bill</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={(e) =>
                                handleDirectFileUpload(e, 'other', item.id, undefined, item.amount)
                              }
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() =>
                              setScannerTarget({
                                type: 'other',
                                id: item.id,
                                label: `Other: ${item.description || 'Expense'}`,
                                expectedAmount: item.amount,
                              })
                            }
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600 transition shadow-theme-xs cursor-pointer"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            <span>Scan Bill</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                          {item.bill && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span className="truncate max-w-[120px]">{item.bill.fileName}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateOther(item.id, 'bill', null)}
                                className="text-error-500 hover:bg-error-50 p-0.5 rounded cursor-pointer ml-1"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}

                          {otherItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOther(item.id)}
                              className="flex items-center gap-1 text-xs font-semibold text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-500/10 px-2.5 py-1.5 rounded-xl transition cursor-pointer ml-auto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. FORMAT PREVIEW TAB */}
            {activeTab === 'Preview' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">TQI Finance Voucher Summary</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Preview generated expense sheet before official submission.</p>
                </div>

                {/* MOBILE PREVIEW SUMMARY CARDS (Visible on mobile screens < 768px) */}
                <div className="block md:hidden space-y-3">
                  {/* Session Overview Banner */}
                  <div className="p-4 rounded-2xl bg-brand-50/70 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 block">
                        {sessionDay} &middot; {sessionDate}
                      </span>
                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                        {clusterName}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Total Voucher</span>
                      <span className="font-mono text-base font-bold text-brand-600 dark:text-brand-400">
                        ₹{grandTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Travel Item Cards */}
                  {routes.map((r, idx) => {
                    const total = (r.volunteers || 0) * (r.perPerson || 0);
                    return (
                      <div key={r.id} className="p-3.5 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-theme-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono text-gray-400">#{idx + 1}</span>
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                              Travel
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">
                            ₹{total.toLocaleString()}
                          </span>
                        </div>

                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white">
                            {r.from || 'Origin'} → {r.to || 'Destination'}
                          </p>
                          {r.volunteers && r.perPerson ? (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                              Formula: {r.volunteers} vols × ₹{r.perPerson}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 dark:border-gray-800 text-[11px]">
                          <span className="text-gray-500 dark:text-gray-400 truncate max-w-[170px]">{r.remarks || 'Volunteer travel'}</span>
                          {r.bill ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                              <CheckCircle2 className="h-3 w-3" /> Attached
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[10.5px]">No bill</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Food Item Cards */}
                  {food.breakfast.amount > 0 && (
                    <div className="p-3.5 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-theme-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono text-gray-400">#{routes.length + 1}</span>
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                            Food
                          </span>
                        </div>
                        <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">
                          ₹{food.breakfast.amount.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">
                        Breakfast {food.breakfast.remarks ? `(${food.breakfast.remarks})` : ''}
                      </p>
                      <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 dark:border-gray-800 text-[11px]">
                        <span className="text-gray-500 dark:text-gray-400">Breakfast meals</span>
                        {food.breakfast.bill ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                            <CheckCircle2 className="h-3 w-3" /> Attached
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[10.5px]">No bill</span>
                        )}
                      </div>
                    </div>
                  )}

                  {food.lunch.amount > 0 && (
                    <div className="p-3.5 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-theme-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono text-gray-400">#{routes.length + 2}</span>
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                            Food
                          </span>
                        </div>
                        <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">
                          ₹{food.lunch.amount.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">
                        Lunch {food.lunch.remarks ? `(${food.lunch.remarks})` : ''}
                      </p>
                      <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 dark:border-gray-800 text-[11px]">
                        <span className="text-gray-500 dark:text-gray-400">Lunch meals</span>
                        {food.lunch.bill ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                            <CheckCircle2 className="h-3 w-3" /> Attached
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[10.5px]">No bill</span>
                        )}
                      </div>
                    </div>
                  )}

                  {food.dinner.amount > 0 && (
                    <div className="p-3.5 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-theme-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono text-gray-400">#{routes.length + 3}</span>
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                            Food
                          </span>
                        </div>
                        <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">
                          ₹{food.dinner.amount.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">
                        Dinner {food.dinner.remarks ? `(${food.dinner.remarks})` : ''}
                      </p>
                      <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 dark:border-gray-800 text-[11px]">
                        <span className="text-gray-500 dark:text-gray-400">Dinner meals</span>
                        {food.dinner.bill ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                            <CheckCircle2 className="h-3 w-3" /> Attached
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[10.5px]">No bill</span>
                        )}
                      </div>
                    </div>
                  )}

                  {food.refreshments.amount > 0 && (
                    <div className="p-3.5 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-theme-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono text-gray-400">#{routes.length + 4}</span>
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                            Food
                          </span>
                        </div>
                        <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">
                          ₹{food.refreshments.amount.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">
                        Refreshments & Tea {food.refreshments.remarks ? `(${food.refreshments.remarks})` : ''}
                      </p>
                      <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 dark:border-gray-800 text-[11px]">
                        <span className="text-gray-500 dark:text-gray-400">Snacks & Tea</span>
                        {food.refreshments.bill ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                            <CheckCircle2 className="h-3 w-3" /> Attached
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[10.5px]">No bill</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Stationery Item Card */}
                  {stationery.amount > 0 && (
                    <div className="p-3.5 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-theme-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono text-gray-400">#{routes.length + 5}</span>
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
                            Stationery
                          </span>
                        </div>
                        <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">
                          ₹{stationery.amount.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">
                        {stationery.remarks || 'Classroom Materials & Notebooks'}
                      </p>
                      <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 dark:border-gray-800 text-[11px]">
                        <span className="text-gray-500 dark:text-gray-400">Student kits</span>
                        {stationery.bill ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                            <CheckCircle2 className="h-3 w-3" /> Attached
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[10.5px]">No bill</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Other Item Cards */}
                  {otherItems.map((item, oIdx) => {
                    if (!item.amount && !item.description) return null;
                    return (
                      <div key={item.id} className="p-3.5 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-theme-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono text-gray-400">#{routes.length + 6 + oIdx}</span>
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400">
                              Other
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">
                            ₹{item.amount.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">
                          {item.description || 'Miscellaneous'}
                        </p>
                        <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 dark:border-gray-800 text-[11px]">
                          <span className="text-gray-500 dark:text-gray-400 truncate max-w-[170px]">{item.remarks || 'Other expense'}</span>
                          {item.bill ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                              <CheckCircle2 className="h-3 w-3" /> Attached
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[10.5px]">No bill</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP PREVIEW TABLE (Visible on desktop >= 768px) */}
                <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-theme-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-600 dark:text-gray-300">
                        <tr>
                          <th className="p-3 w-12 text-center">#</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Description</th>
                          <th className="p-3 text-center">Count</th>
                          <th className="p-3 text-center">Formula</th>
                          <th className="p-3 text-right">Total</th>
                          <th className="p-3 text-center">Bill</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {/* Travel Routes */}
                        {routes.map((r, idx) => {
                          const total = (r.volunteers || 0) * (r.perPerson || 0);
                          return (
                            <tr key={r.id} className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02]">
                              <td className="p-3 text-center text-gray-400 font-mono">{idx + 1}</td>
                              <td className="p-3 font-semibold text-brand-500">Travel</td>
                              <td className="p-3 text-gray-800 dark:text-gray-200">
                                {r.from || 'Origin'} → {r.to || 'Destination'}
                              </td>
                              <td className="p-3 text-center font-mono text-gray-600 dark:text-gray-400">{r.volunteers || '—'}</td>
                              <td className="p-3 text-center font-mono text-gray-600 dark:text-gray-400">
                                {r.volunteers && r.perPerson ? `${r.volunteers}×₹${r.perPerson}` : '—'}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                                ₹{total.toLocaleString()}
                              </td>
                              <td className="p-3 text-center">
                                {r.bill ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Attached
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Food */}
                        {food.breakfast.amount > 0 && (
                          <tr className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02]">
                            <td className="p-3 text-center text-gray-400 font-mono">{routes.length + 1}</td>
                            <td className="p-3 font-semibold text-warning-600">Food</td>
                            <td className="p-3 text-gray-800 dark:text-gray-200">Breakfast {food.breakfast.remarks ? `(${food.breakfast.remarks})` : ''}</td>
                            <td className="p-3 text-center text-gray-400 font-mono">—</td>
                            <td className="p-3 text-center text-gray-400 font-mono">—</td>
                            <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                              ₹{food.breakfast.amount.toLocaleString()}
                            </td>
                            <td className="p-3 text-center">
                              {food.breakfast.bill ? <span className="text-emerald-600 font-semibold text-[11px]">Attached</span> : '—'}
                            </td>
                          </tr>
                        )}
                        {food.lunch.amount > 0 && (
                          <tr className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02]">
                            <td className="p-3 text-center text-gray-400 font-mono">{routes.length + 2}</td>
                            <td className="p-3 font-semibold text-warning-600">Food</td>
                            <td className="p-3 text-gray-800 dark:text-gray-200">Lunch {food.lunch.remarks ? `(${food.lunch.remarks})` : ''}</td>
                            <td className="p-3 text-center text-gray-400 font-mono">—</td>
                            <td className="p-3 text-center text-gray-400 font-mono">—</td>
                            <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                              ₹{food.lunch.amount.toLocaleString()}
                            </td>
                            <td className="p-3 text-center">
                              {food.lunch.bill ? <span className="text-emerald-600 font-semibold text-[11px]">Attached</span> : '—'}
                            </td>
                          </tr>
                        )}
                        {food.dinner.amount > 0 && (
                          <tr className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02]">
                            <td className="p-3 text-center text-gray-400 font-mono">{routes.length + 3}</td>
                            <td className="p-3 font-semibold text-warning-600">Food</td>
                            <td className="p-3 text-gray-800 dark:text-gray-200">Dinner</td>
                            <td className="p-3 text-center text-gray-400 font-mono">—</td>
                            <td className="p-3 text-center text-gray-400 font-mono">—</td>
                            <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                              ₹{food.dinner.amount.toLocaleString()}
                            </td>
                            <td className="p-3 text-center">
                              {food.dinner.bill ? <span className="text-emerald-600 font-semibold text-[11px]">Attached</span> : '—'}
                            </td>
                          </tr>
                        )}
                        {food.refreshments.amount > 0 && (
                          <tr className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02]">
                            <td className="p-3 text-center text-gray-400 font-mono">{routes.length + 4}</td>
                            <td className="p-3 font-semibold text-warning-600">Food</td>
                            <td className="p-3 text-gray-800 dark:text-gray-200">Refreshments & Tea</td>
                            <td className="p-3 text-center text-gray-400 font-mono">—</td>
                            <td className="p-3 text-center text-gray-400 font-mono">—</td>
                            <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                              ₹{food.refreshments.amount.toLocaleString()}
                            </td>
                            <td className="p-3 text-center">
                              {food.refreshments.bill ? <span className="text-emerald-600 font-semibold text-[11px]">Attached</span> : '—'}
                            </td>
                          </tr>
                        )}

                        {/* Stationery */}
                        {stationery.amount > 0 && (
                          <tr className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02]">
                            <td className="p-3 text-center text-gray-400 font-mono">{routes.length + 5}</td>
                            <td className="p-3 font-semibold text-brand-500">Stationery</td>
                            <td className="p-3 text-gray-800 dark:text-gray-200">{stationery.remarks || 'Classroom Materials'}</td>
                            <td className="p-3 text-center text-gray-400 font-mono">—</td>
                            <td className="p-3 text-center text-gray-400 font-mono">—</td>
                            <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                              ₹{stationery.amount.toLocaleString()}
                            </td>
                            <td className="p-3 text-center">
                              {stationery.bill ? <span className="text-emerald-600 font-semibold text-[11px]">Attached</span> : '—'}
                            </td>
                          </tr>
                        )}

                        {/* Grand Total Strip */}
                        <tr className="bg-brand-50/70 dark:bg-brand-500/10 font-bold text-gray-900 dark:text-white">
                          <td colSpan={5} className="p-3 text-right text-xs">
                            Grand Total ({sessionDay})
                          </td>
                          <td className="p-3 text-right font-mono text-sm text-brand-600 dark:text-brand-400">
                            ₹{grandTotal.toLocaleString()}
                          </td>
                          <td className="p-3"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Grand Total Strip & Mobile Sticky Bottom Actions */}
          <div className="px-4 sm:px-6 py-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white w-full sm:w-auto justify-between sm:justify-start">
              <span className="text-xs text-gray-500 dark:text-gray-400">Grand Total:</span>
              <span className="font-mono text-base sm:text-lg font-bold text-brand-500 bg-brand-50 dark:bg-brand-500/15 px-2.5 py-1 rounded-xl">
                ₹{grandTotal.toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSubmit(true)}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-brand-500/40 text-brand-600 bg-brand-50/50 hover:bg-brand-50 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20 transition-colors cursor-pointer shadow-theme-xs"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSaving ? 'Saving…' : 'Save Draft'}</span>
              </button>
              {!draftOnly && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSubmit(false)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-brand-600 transition shadow-theme-xs cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isSaving ? 'Submitting…' : 'Submit for Approval'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bill Camera Scanner Modal */}
      {scannerTarget && (
        <BillScannerModal
          isOpen={true}
          onClose={() => setScannerTarget(null)}
          expectedAmount={scannerTarget.expectedAmount}
          categoryLabel={scannerTarget.label}
          onAttachBill={(bill) => {
            attachBillToTarget(
              scannerTarget.type,
              bill,
              scannerTarget.id,
              scannerTarget.foodKey
            );
          }}
        />
      )}
    </>
  );
};
