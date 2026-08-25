import React, { useState, useMemo, useEffect } from 'react';
import { BillScannerModal, BillAttachment } from './BillScannerModal';
import { FinanceEntry, FinanceDraft } from '../types';

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
  initialDraft?: FinanceDraft | null;
  onSubmitFinance: (entries: Omit<FinanceEntry, 'id'>[], isDraft: boolean) => void;
  onSaveDraftPackage?: (draft: FinanceDraft) => void;
}

export const NewFinanceModal: React.FC<NewFinanceModalProps> = ({
  isOpen,
  onClose,
  clusterName = 'Dharmapuri',
  collegeName = 'K.S.Rangasamy college of Technology',
  spocName = 'Narendhar',
  financerName = 'TQI Finance Team',
  initialDraft = null,
  onSubmitFinance,
  onSaveDraftPackage,
}) => {
  // Modal state
  const [sessionDay, setSessionDay] = useState<string>(initialDraft?.sessionDay || 'Day 1');
  const [sessionDate, setSessionDate] = useState<string>(initialDraft?.sessionDate || '2026-08-20');
  const [activeTab, setActiveTab] = useState<'Travel' | 'Food' | 'Stationery' | 'Other' | 'Preview'>('Travel');

  // Scanner target state
  const [scannerTarget, setScannerTarget] = useState<{
    type: 'travel' | 'food' | 'stationery' | 'other';
    id?: string;
    foodKey?: keyof FoodState;
    label: string;
    expectedAmount: number;
  } | null>(null);

  // 1. Travel State - Defaults to clean empty fields for new expenses
  const [routes, setRoutes] = useState<RouteItem[]>(
    initialDraft?.routes || [
      {
        id: 'route-1',
        from: '',
        to: '',
        volunteers: 0,
        perPerson: 0,
        remarks: '',
        bill: null,
      },
    ]
  );

  // 2. Food State - Defaults to 0 for new expenses
  const [food, setFood] = useState<FoodState>(
    initialDraft?.food || {
      breakfast: { amount: 0, remarks: '', bill: null },
      lunch: { amount: 0, remarks: '', bill: null },
      dinner: { amount: 0, remarks: '', bill: null },
      refreshments: { amount: 0, remarks: '', bill: null },
    }
  );

  // 3. Stationery State - Defaults to 0 for new expenses
  const [stationery, setStationery] = useState<{
    amount: number;
    remarks: string;
    bill: BillAttachment | null;
  }>(
    initialDraft?.stationery || {
      amount: 0,
      remarks: '',
      bill: null,
    }
  );

  // 4. Other State - Defaults to 0 for new expenses
  const [otherItems, setOtherItems] = useState<OtherItem[]>(
    initialDraft?.otherItems || [
      {
        id: 'other-1',
        description: '',
        amount: 0,
        remarks: '',
        bill: null,
      },
    ]
  );

  // Update whenever initialDraft prop changes
  useEffect(() => {
    if (initialDraft) {
      if (initialDraft.sessionDay) setSessionDay(initialDraft.sessionDay);
      if (initialDraft.sessionDate) setSessionDate(initialDraft.sessionDate);
      if (initialDraft.routes) setRoutes(initialDraft.routes);
      if (initialDraft.food) setFood(initialDraft.food);
      if (initialDraft.stationery) setStationery(initialDraft.stationery);
      if (initialDraft.otherItems) setOtherItems(initialDraft.otherItems);
    } else {
      // Clear all fields when creating a new expense session
      setSessionDay('Day 1');
      setRoutes([
        {
          id: 'route-1',
          from: '',
          to: '',
          volunteers: 0,
          perPerson: 0,
          remarks: '',
          bill: null,
        },
      ]);
      setFood({
        breakfast: { amount: 0, remarks: '', bill: null },
        lunch: { amount: 0, remarks: '', bill: null },
        dinner: { amount: 0, remarks: '', bill: null },
        refreshments: { amount: 0, remarks: '', bill: null },
      });
      setStationery({
        amount: 0,
        remarks: '',
        bill: null,
      });
      setOtherItems([
        {
          id: 'other-1',
          description: '',
          amount: 0,
          remarks: '',
          bill: null,
        },
      ]);
    }
  }, [initialDraft, isOpen]);

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
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
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
            // Auto-write origin and destination if detected from ticket
            if (bill.origin && (!r.from || r.from === '')) {
              updated.from = bill.origin;
            }
            if (bill.destination && (!r.to || r.to === '')) {
              updated.to = bill.destination;
            }
            // Auto-fill volunteers and perPerson
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
  const handleSubmit = (isDraft: boolean) => {
    const entries: Omit<FinanceEntry, 'id'>[] = [];
    const draftId = initialDraft?.id || `draft-${sessionDay.toLowerCase().replace(/\s+/g, '')}-${Date.now()}`;

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
          status: isDraft ? 'Draft' : 'Approved',
          billUrl: r.bill?.url,
          remarks: r.remarks || `${r.volunteers} Volunteers travel reimbursement`,
          count: r.volunteers,
          countAmount: `${r.volunteers}×${r.perPerson}`,
          sessionDay: sessionDay,
          draftId: isDraft ? draftId : undefined,
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
        status: isDraft ? 'Draft' : 'Approved',
        billUrl: food.breakfast.bill?.url,
        remarks: food.breakfast.remarks || 'Volunteer breakfast',
        sessionDay: sessionDay,
        draftId: isDraft ? draftId : undefined,
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
        status: isDraft ? 'Draft' : 'Approved',
        billUrl: food.lunch.bill?.url,
        remarks: food.lunch.remarks || 'Volunteer lunch meals',
        sessionDay: sessionDay,
        draftId: isDraft ? draftId : undefined,
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
        status: isDraft ? 'Draft' : 'Approved',
        billUrl: food.dinner.bill?.url,
        remarks: food.dinner.remarks || 'Volunteer dinner',
        sessionDay: sessionDay,
        draftId: isDraft ? draftId : undefined,
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
        status: isDraft ? 'Draft' : 'Approved',
        billUrl: food.refreshments.bill?.url,
        remarks: food.refreshments.remarks || 'Snacks and tea',
        sessionDay: sessionDay,
        draftId: isDraft ? draftId : undefined,
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
        status: isDraft ? 'Draft' : 'Approved',
        billUrl: stationery.bill?.url,
        remarks: stationery.remarks || 'Classroom student stationery kits',
        sessionDay: sessionDay,
        draftId: isDraft ? draftId : undefined,
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
          status: isDraft ? 'Draft' : 'Approved',
          billUrl: item.bill?.url,
          remarks: item.remarks || item.description,
          sessionDay: sessionDay,
          draftId: isDraft ? draftId : undefined,
        });
      }
    });

    if (entries.length === 0) {
      alert('Please fill at least one expense entry before saving.');
      return;
    }

    if (onSaveDraftPackage) {
      const draftPackage: FinanceDraft = {
        id: draftId,
        title: `${sessionDay} - Travel & Expenses Sheet`,
        sessionDay,
        sessionDate,
        clusterName,
        collegeName,
        spocName,
        financerName,
        status: isDraft ? 'Draft' : 'Approved',
        lastSaved: 'Just now',
        totalAmount: grandTotal,
        routes,
        food,
        stationery,
        otherItems,
      };
      onSaveDraftPackage(draftPackage);
    }

    onSubmitFinance(entries, isDraft);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-[#001947]/50  z-[100] flex items-center justify-center p-2 sm:p-4 animate-[fadeIn_0.15s_ease-out]">
        <div className="bg-white rounded-md shadow-sm w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col border border-[#c4c6d3]/80">
          {/* Top Modal Header */}
          <div className="px-6 py-4 border-b border-[#c4c6d3] bg-white flex items-center justify-between">
            <h2 className="text-[17px] font-bold text-[#1a1b21]">New Finance Entry —</h2>
            <button
              onClick={onClose}
              className="text-[#747783] hover:text-[#1a1b21] hover:bg-[#f4f3fb] p-1.5 rounded-full transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Top Metadata Bar (Cluster, College, SPOC, Financer) */}
          <div className="px-6 py-3 bg-[#faf8ff] border-b border-[#c4c6d3]/70 grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
            <div>
              <span className="text-[10px] font-bold text-[#747783] uppercase tracking-wider block">
                CLUSTER
              </span>
              <span className="font-bold text-[#002869]">{clusterName}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#747783] uppercase tracking-wider block">
                COLLEGE
              </span>
              <span className="font-bold text-[#1a1b21] truncate block" title={collegeName}>
                {collegeName}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#747783] uppercase tracking-wider block">
                SPOC
              </span>
              <span className="font-bold text-[#1a1b21]">{spocName}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#747783] uppercase tracking-wider block">
                FINANCER
              </span>
              <span className="font-bold text-[#1a1b21]">{financerName}</span>
            </div>
          </div>

          {/* Session Day & Date Selector Row */}
          <div className="px-6 py-3.5 bg-white border-b border-[#c4c6d3]/60 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-bold text-[#434652] mb-1">
                Session Day *
              </label>
              <select
                value={sessionDay}
                onChange={(e) => setSessionDay(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] font-medium text-[#1a1b21] focus:outline-none focus:border-[#002869] cursor-pointer"
              >
                <option value="Day 1">Day 1</option>
                <option value="Day 2">Day 2</option>
                <option value="Day 3">Day 3</option>
                <option value="Day 4">Day 4</option>
                <option value="Day 5">Day 5</option>
                <option value="Day 6">Day 6</option>
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-bold text-[#434652] mb-1">
                Date *
              </label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] font-medium text-[#1a1b21] focus:outline-none focus:border-[#002869]"
              />
            </div>
          </div>

          {/* Navigation Category Tabs */}
          <div className="flex border-b border-[#c4c6d3] bg-white px-6 overflow-x-auto">
            {(['Travel', 'Food', 'Stationery', 'Other', 'Preview'] as const).map((tab) => {
              const isActive = activeTab === tab;
              let tabTotal = 0;
              if (tab === 'Travel') tabTotal = travelTotal;
              if (tab === 'Food') tabTotal = foodTotal;
              if (tab === 'Stationery') tabTotal = stationeryTotal;
              if (tab === 'Other') tabTotal = otherTotal;

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 px-3.5 sm:px-5 text-[13px] font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? 'border-[#002869] text-[#002869]'
                      : 'border-transparent text-[#747783] hover:text-[#1a1b21]'
                  }`}
                >
                  {tab === 'Preview' && (
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                  )}
                  <span>{tab === 'Preview' ? 'Format Preview (TQI Sheet)' : tab}</span>
                  {tabTotal > 0 && tab !== 'Preview' && (
                    <span className="text-[11px] font-mono font-semibold bg-[#dae2ff] text-[#001947] px-1.5 py-0.5 rounded">
                      ₹{tabTotal}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Modal Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
            {/* 1. TRAVEL TAB */}
            {activeTab === 'Travel' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-[#002869]">directions_car</span>
                    <h3 className="text-[15px] font-bold text-[#002869]">Travel</h3>
                  </div>
                  <button
                    onClick={handleAddRoute}
                    className="flex items-center gap-1 px-3 py-1.5 border border-[#c4c6d3] hover:border-[#002869] text-[#002869] text-[12px] font-bold rounded-md hover:bg-[#f4f3fb] transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Add Route
                  </button>
                </div>

                <div className="space-y-4">
                  {routes.map((route, idx) => {
                    const rowTotal = (route.volunteers || 0) * (route.perPerson || 0);
                    const billAttached = route.bill;
                    const amountMismatch =
                      billAttached?.detectedAmount !== undefined &&
                      billAttached.detectedAmount > 0 &&
                      billAttached.detectedAmount !== rowTotal;

                    return (
                      <div
                        key={route.id}
                        className="p-4 sm:p-5 border border-[#c4c6d3]/80 rounded-md bg-white shadow-xs space-y-3"
                      >
                        {/* Route Grid: From, To, Volunteers, Per Person, Total */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
                          <div>
                            <label className="block text-[11px] font-bold text-[#434652] mb-1">
                              From
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. KSR"
                              value={route.from}
                              onChange={(e) => handleUpdateRoute(route.id, 'from', e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-[#434652] mb-1">
                              To
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Salem"
                              value={route.to}
                              onChange={(e) => handleUpdateRoute(route.id, 'to', e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-[#434652] mb-1">
                              Volunteers
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={route.volunteers}
                              onChange={(e) =>
                                handleUpdateRoute(
                                  route.id,
                                  'volunteers',
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-[#434652] mb-1">
                              Per Person (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={route.perPerson}
                              onChange={(e) =>
                                handleUpdateRoute(
                                  route.id,
                                  'perPerson',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869]"
                            />
                          </div>

                          <div className="col-span-2 sm:col-span-1">
                            <label className="block text-[11px] font-bold text-[#434652] mb-1">
                              Total
                            </label>
                            <div className="px-3 py-2 bg-[#f4f3fb] border border-[#c4c6d3]/60 rounded-md text-[14px] font-mono font-bold text-[#002869]">
                              ₹{rowTotal}
                            </div>
                          </div>
                        </div>

                        {/* Remarks Row */}
                        <div>
                          <label className="block text-[11px] font-bold text-[#434652] mb-1">
                            Remarks
                          </label>
                          <input
                            type="text"
                            placeholder="Optional"
                            value={route.remarks}
                            onChange={(e) => handleUpdateRoute(route.id, 'remarks', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869]"
                          />
                        </div>

                        {/* Bill Attachment Details & Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Upload Bill Button */}
                            <label className="flex items-center gap-1.5 px-3 py-1.5 border border-[#c4c6d3] hover:border-[#002869] text-[#002869] rounded-md text-[12px] font-bold hover:bg-[#f4f3fb] transition-colors cursor-pointer">
                              <span className="material-symbols-outlined text-[16px]">upload</span>
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

                            {/* Scan Bill Button (Orange Highlight) */}
                            <button
                              onClick={() =>
                                setScannerTarget({
                                  type: 'travel',
                                  id: route.id,
                                  label: `Travel: ${route.from || 'Route'} → ${route.to || 'Destination'}`,
                                  expectedAmount: rowTotal,
                                })
                              }
                              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#fb7800] text-white rounded-md text-[12px] font-bold hover:bg-[#fb7800]/90 transition-all shadow-xs cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                              <span>Scan Bill</span>
                            </button>

                            {/* Attached Bill Status Badge */}
                            {billAttached && (
                              <div className="flex items-center gap-2 px-2.5 py-1 bg-[#e6f4ea] border border-[#137333]/30 rounded-md text-[11px] font-bold text-[#137333]">
                                <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                                <span className="truncate max-w-[140px]">{billAttached.fileName}</span>
                                {billAttached.detectedAmount !== undefined && (
                                  <span className="font-mono">(₹{billAttached.detectedAmount})</span>
                                )}
                                <button
                                  onClick={() => handleUpdateRoute(route.id, 'bill', null)}
                                  className="text-[#ba1a1a] hover:bg-[#ffdad6] p-0.5 rounded"
                                  title="Remove Bill"
                                >
                                  <span className="material-symbols-outlined text-[14px]">close</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Remove Route */}
                          <button
                            onClick={() => handleRemoveRoute(route.id)}
                            className="flex items-center gap-1 text-[#ba1a1a] hover:text-[#93000a] text-[12px] font-bold hover:underline cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                            Remove
                          </button>
                        </div>

                        {/* Amount Matching Warning if difference */}
                        {amountMismatch && (
                          <div className="p-2.5 bg-[#fff7f2] border border-[#ffdbc8] rounded-md text-[11px] text-[#592600] flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[15px] text-[#fb7800]">warning</span>
                              Bill photo shows ₹{billAttached.detectedAmount}, but route total is ₹{rowTotal}.
                            </span>
                            <button
                              onClick={() => {
                                handleUpdateRoute(route.id, 'volunteers', 1);
                                handleUpdateRoute(route.id, 'perPerson', billAttached.detectedAmount || 0);
                              }}
                              className="text-[10px] font-bold bg-[#fb7800] text-white px-2 py-0.5 rounded cursor-pointer"
                            >
                              Sync to Bill (₹{billAttached.detectedAmount})
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. FOOD TAB */}
            {activeTab === 'Food' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#002869]">restaurant</span>
                  <h3 className="text-[15px] font-bold text-[#002869]">Food</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['breakfast', 'lunch', 'dinner', 'refreshments'] as const).map((mealKey) => {
                    const mealItem = food[mealKey];
                    const mealTitles: Record<keyof FoodState, string> = {
                      breakfast: 'Breakfast',
                      lunch: 'Lunch',
                      dinner: 'Dinner',
                      refreshments: 'Refreshments',
                    };
                    const title = mealTitles[mealKey];

                    return (
                      <div
                        key={mealKey}
                        className="p-4 border border-[#c4c6d3]/80 rounded-md bg-white shadow-xs space-y-3"
                      >
                        <h4 className="text-[14px] font-bold text-[#1a1b21]">{title}</h4>

                        <div>
                          <label className="block text-[11px] font-bold text-[#434652] mb-1">
                            Amount (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={mealItem.amount}
                            onChange={(e) =>
                              setFood((prev) => ({
                                ...prev,
                                [mealKey]: {
                                  ...prev[mealKey],
                                  amount: parseFloat(e.target.value) || 0,
                                },
                              }))
                            }
                            className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] font-bold text-[#002869] focus:outline-none focus:border-[#002869]"
                          />
                        </div>

                        {/* Bill Actions */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <label className="flex items-center gap-1.5 px-3 py-1.5 border border-[#c4c6d3] hover:border-[#002869] text-[#002869] rounded-md text-[12px] font-bold hover:bg-[#f4f3fb] transition-colors cursor-pointer">
                            <span className="material-symbols-outlined text-[16px]">upload</span>
                            <span>Upload Bill</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={(e) =>
                                handleDirectFileUpload(
                                  e,
                                  'food',
                                  undefined,
                                  mealKey,
                                  mealItem.amount
                                )
                              }
                            />
                          </label>

                          <button
                            onClick={() =>
                              setScannerTarget({
                                type: 'food',
                                foodKey: mealKey,
                                label: `Food: ${title}`,
                                expectedAmount: mealItem.amount,
                              })
                            }
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#fb7800] text-white rounded-md text-[12px] font-bold hover:bg-[#fb7800]/90 transition-all shadow-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                            <span>Scan Bill</span>
                          </button>

                          {mealItem.bill && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#e6f4ea] border border-[#137333]/30 rounded-md text-[11px] font-bold text-[#137333]">
                              <span className="material-symbols-outlined text-[16px]">verified</span>
                              <span className="truncate max-w-[100px]">{mealItem.bill.fileName}</span>
                              <button
                                onClick={() =>
                                  setFood((prev) => ({
                                    ...prev,
                                    [mealKey]: { ...prev[mealKey], bill: null },
                                  }))
                                }
                                className="text-[#ba1a1a] hover:bg-[#ffdad6] p-0.5 rounded"
                              >
                                <span className="material-symbols-outlined text-[12px]">close</span>
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
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#002869]">edit_note</span>
                  <h3 className="text-[15px] font-bold text-[#002869]">Stationery</h3>
                </div>

                <div className="p-5 border border-[#c4c6d3]/80 rounded-md bg-white shadow-xs space-y-4 max-w-lg">
                  <div>
                    <label className="block text-[11px] font-bold text-[#434652] mb-1">
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={stationery.amount}
                      onChange={(e) =>
                        setStationery((prev) => ({
                          ...prev,
                          amount: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[14px] font-bold text-[#002869] focus:outline-none focus:border-[#002869]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#434652] mb-1">
                      Remarks / Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Chart papers, pens, notebooks"
                      value={stationery.remarks}
                      onChange={(e) =>
                        setStationery((prev) => ({
                          ...prev,
                          remarks: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 border border-[#c4c6d3] hover:border-[#002869] text-[#002869] rounded-md text-[12px] font-bold hover:bg-[#f4f3fb] transition-colors cursor-pointer">
                      <span className="material-symbols-outlined text-[16px]">upload</span>
                      <span>Upload Bill</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) =>
                          handleDirectFileUpload(
                            e,
                            'stationery',
                            undefined,
                            undefined,
                            stationery.amount
                          )
                        }
                      />
                    </label>

                    <button
                      onClick={() =>
                        setScannerTarget({
                          type: 'stationery',
                          label: 'Stationery Items',
                          expectedAmount: stationery.amount,
                        })
                      }
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#fb7800] text-white rounded-md text-[12px] font-bold hover:bg-[#fb7800]/90 transition-all shadow-xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                      <span>Scan Bill</span>
                    </button>

                    {stationery.bill && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#e6f4ea] border border-[#137333]/30 rounded-md text-[11px] font-bold text-[#137333]">
                        <span className="material-symbols-outlined text-[16px]">verified</span>
                        <span className="truncate max-w-[120px]">{stationery.bill.fileName}</span>
                        <button
                          onClick={() => setStationery((prev) => ({ ...prev, bill: null }))}
                          className="text-[#ba1a1a] hover:bg-[#ffdad6] p-0.5 rounded"
                        >
                          <span className="material-symbols-outlined text-[12px]">close</span>
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
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-[#002869]">category</span>
                    <h3 className="text-[15px] font-bold text-[#002869]">Other</h3>
                  </div>
                  <button
                    onClick={handleAddOther}
                    className="flex items-center gap-1 px-3 py-1.5 border border-[#c4c6d3] hover:border-[#002869] text-[#002869] text-[12px] font-bold rounded-md hover:bg-[#f4f3fb] transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Add Other
                  </button>
                </div>

                <div className="space-y-4">
                  {otherItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 border border-[#c4c6d3]/80 rounded-md bg-white shadow-xs space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-[#434652] mb-1">
                            Description
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Banner, Stage setup, Audio rental"
                            value={item.description}
                            onChange={(e) =>
                              handleUpdateOther(item.id, 'description', e.target.value)
                            }
                            className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-[#434652] mb-1">
                            Amount (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.amount}
                            onChange={(e) =>
                              handleUpdateOther(
                                item.id,
                                'amount',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] font-bold text-[#002869] focus:outline-none focus:border-[#002869]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#434652] mb-1">
                          Remarks
                        </label>
                        <input
                          type="text"
                          placeholder="Optional"
                          value={item.remarks}
                          onChange={(e) => handleUpdateOther(item.id, 'remarks', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869]"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="flex items-center gap-1.5 px-3 py-1.5 border border-[#c4c6d3] hover:border-[#002869] text-[#002869] rounded-md text-[12px] font-bold hover:bg-[#f4f3fb] transition-colors cursor-pointer">
                            <span className="material-symbols-outlined text-[16px]">upload</span>
                            <span>Upload Bill</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={(e) =>
                                handleDirectFileUpload(
                                  e,
                                  'other',
                                  item.id,
                                  undefined,
                                  item.amount
                                )
                              }
                            />
                          </label>

                          <button
                            onClick={() =>
                              setScannerTarget({
                                type: 'other',
                                id: item.id,
                                label: `Other: ${item.description || 'Item'}`,
                                expectedAmount: item.amount,
                              })
                            }
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#fb7800] text-white rounded-md text-[12px] font-bold hover:bg-[#fb7800]/90 transition-all shadow-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                            <span>Scan Bill</span>
                          </button>

                          {item.bill && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#e6f4ea] border border-[#137333]/30 rounded-md text-[11px] font-bold text-[#137333]">
                              <span className="material-symbols-outlined text-[16px]">verified</span>
                              <span className="truncate max-w-[120px]">{item.bill.fileName}</span>
                              <button
                                onClick={() => handleUpdateOther(item.id, 'bill', null)}
                                className="text-[#ba1a1a] hover:bg-[#ffdad6] p-0.5 rounded"
                              >
                                <span className="material-symbols-outlined text-[12px]">close</span>
                              </button>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleRemoveOther(item.id)}
                          className="flex items-center gap-1 text-[#ba1a1a] hover:text-[#93000a] text-[12px] font-bold hover:underline cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. PREVIEW TAB (Live TQI Statement Preview) */}
            {activeTab === 'Preview' && (
              <div className="space-y-4">
                <div className="bg-[#faf8ff] p-3 rounded-md border border-[#c4c6d3] flex items-center justify-between text-[12px]">
                  <span className="font-bold text-[#002869] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    Live TQI Statement Preview — {sessionDay}
                  </span>
                  <span className="text-[11px] font-bold text-[#592600] bg-[#ffdbc8] px-2 py-0.5 rounded">
                    Draft Preview
                  </span>
                </div>

                {/* Formatted Mini Sheet */}
                <div className="border border-[#c4c6d3] rounded-md overflow-hidden bg-white text-[12px]">
                  {/* Meta Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-[#c4c6d3] bg-[#faf8ff] border-b border-[#c4c6d3]">
                    <div className="p-2">
                      <span className="text-[9px] font-bold text-[#747783] uppercase block">COLLEGE</span>
                      <span className="font-bold text-[#000000] truncate block">{collegeName}</span>
                    </div>
                    <div className="p-2">
                      <span className="text-[9px] font-bold text-[#747783] uppercase block">CLUSTER</span>
                      <span className="font-bold text-[#000000]">{clusterName}</span>
                    </div>
                    <div className="p-2">
                      <span className="text-[9px] font-bold text-[#747783] uppercase block">SESSION / DAY</span>
                      <span className="font-bold text-[#000000]">{sessionDay}</span>
                    </div>
                    <div className="p-2">
                      <span className="text-[9px] font-bold text-[#747783] uppercase block">DATE</span>
                      <span className="font-bold text-[#000000]">{sessionDate}</span>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11.5px] border-collapse">
                      <thead className="bg-[#faf8ff] border-b border-[#c4c6d3] font-bold text-[#000000]">
                        <tr>
                          <th className="p-2 border-r border-[#c4c6d3] w-10">S.No</th>
                          <th className="p-2 border-r border-[#c4c6d3] w-20">Category</th>
                          <th className="p-2 border-r border-[#c4c6d3]">Description</th>
                          <th className="p-2 border-r border-[#c4c6d3] text-center w-16">Count</th>
                          <th className="p-2 border-r border-[#c4c6d3] text-center w-20">Count×Amt</th>
                          <th className="p-2 border-r border-[#c4c6d3] text-right w-20">Total</th>
                          <th className="p-2 text-center w-16">Bill</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#c4c6d3]">
                        {/* Routes */}
                        {routes.map((r, idx) => {
                          const total = (r.volunteers || 0) * (r.perPerson || 0);
                          return (
                            <tr key={r.id} className="hover:bg-[#faf8ff]">
                              <td className="p-2 border-r border-[#c4c6d3] font-mono">{idx + 1}</td>
                              <td className="p-2 border-r border-[#c4c6d3] font-semibold text-[#002869]">Travel</td>
                              <td className="p-2 border-r border-[#c4c6d3]">
                                {r.from || 'Origin'} → {r.to || 'Destination'}
                              </td>
                              <td className="p-2 border-r border-[#c4c6d3] text-center font-mono">{r.volunteers || '—'}</td>
                              <td className="p-2 border-r border-[#c4c6d3] text-center font-mono">
                                {r.volunteers && r.perPerson ? `${r.volunteers}×${r.perPerson}` : '—'}
                              </td>
                              <td className="p-2 border-r border-[#c4c6d3] text-right font-mono font-medium">
                                ₹{total.toLocaleString()}
                              </td>
                              <td className="p-2 text-center">
                                {r.bill ? (
                                  <span className="text-[#137333] font-bold text-[10px]">Attached</span>
                                ) : (
                                  <span className="text-[#747783]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Food items */}
                        {food.breakfast.amount > 0 && (
                          <tr className="hover:bg-[#faf8ff]">
                            <td className="p-2 border-r border-[#c4c6d3] font-mono">{routes.length + 1}</td>
                            <td className="p-2 border-r border-[#c4c6d3] font-semibold text-[#592600]">Food</td>
                            <td className="p-2 border-r border-[#c4c6d3]">Breakfast {food.breakfast.remarks ? `(${food.breakfast.remarks})` : ''}</td>
                            <td className="p-2 border-r border-[#c4c6d3] text-center font-mono">—</td>
                            <td className="p-2 border-r border-[#c4c6d3] text-center font-mono">—</td>
                            <td className="p-2 border-r border-[#c4c6d3] text-right font-mono font-medium">
                              ₹{food.breakfast.amount.toLocaleString()}
                            </td>
                            <td className="p-2 text-center">
                              {food.breakfast.bill ? <span className="text-[#137333] font-bold text-[10px]">Attached</span> : '—'}
                            </td>
                          </tr>
                        )}

                        {food.lunch.amount > 0 && (
                          <tr className="hover:bg-[#faf8ff]">
                            <td className="p-2 border-r border-[#c4c6d3] font-mono">{routes.length + 2}</td>
                            <td className="p-2 border-r border-[#c4c6d3] font-semibold text-[#592600]">Food</td>
                            <td className="p-2 border-r border-[#c4c6d3]">Lunch {food.lunch.remarks ? `(${food.lunch.remarks})` : ''}</td>
                            <td className="p-2 border-r border-[#c4c6d3] text-center font-mono">—</td>
                            <td className="p-2 border-r border-[#c4c6d3] text-center font-mono">—</td>
                            <td className="p-2 border-r border-[#c4c6d3] text-right font-mono font-medium">
                              ₹{food.lunch.amount.toLocaleString()}
                            </td>
                            <td className="p-2 text-center">
                              {food.lunch.bill ? <span className="text-[#137333] font-bold text-[10px]">Attached</span> : '—'}
                            </td>
                          </tr>
                        )}

                        {food.dinner.amount > 0 && (
                          <tr className="hover:bg-[#faf8ff]">
                            <td className="p-2 border-r border-[#c4c6d3] font-mono">{routes.length + 3}</td>
                            <td className="p-2 border-r border-[#c4c6d3] font-semibold text-[#592600]">Food</td>
                            <td className="p-2 border-r border-[#c4c6d3]">Dinner</td>
                            <td className="p-2 border-r border-[#c4c6d3] text-center font-mono">—</td>
                            <td className="p-2 border-r border-[#c4c6d3] text-center font-mono">—</td>
                            <td className="p-2 border-r border-[#c4c6d3] text-right font-mono font-medium">
                              ₹{food.dinner.amount.toLocaleString()}
                            </td>
                            <td className="p-2 text-center">
                              {food.dinner.bill ? <span className="text-[#137333] font-bold text-[10px]">Attached</span> : '—'}
                            </td>
                          </tr>
                        )}

                        {food.refreshments.amount > 0 && (
                          <tr className="hover:bg-[#faf8ff]">
                            <td className="p-2 border-r border-[#c4c6d3] font-mono">{routes.length + 4}</td>
                            <td className="p-2 border-r border-[#c4c6d3] font-semibold text-[#592600]">Food</td>
                            <td className="p-2 border-r border-[#c4c6d3]">Refreshments & Tea</td>
                            <td className="p-2 border-r border-[#c4c6d3] text-center font-mono">—</td>
                            <td className="p-2 border-r border-[#c4c6d3] text-center font-mono">—</td>
                            <td className="p-2 border-r border-[#c4c6d3] text-right font-mono font-medium">
                              ₹{food.refreshments.amount.toLocaleString()}
                            </td>
                            <td className="p-2 text-center">
                              {food.refreshments.bill ? <span className="text-[#137333] font-bold text-[10px]">Attached</span> : '—'}
                            </td>
                          </tr>
                        )}

                        {/* Stationery */}
                        {stationery.amount > 0 && (
                          <tr className="hover:bg-[#faf8ff]">
                            <td className="p-2 border-r border-[#c4c6d3] font-mono">
                              {routes.length + 5}
                            </td>
                            <td className="p-2 border-r border-[#c4c6d3] font-semibold text-[#002869]">Stationery</td>
                            <td className="p-2 border-r border-[#c4c6d3]">Materials & Notebooks</td>
                            <td className="p-2 border-r border-[#c4c6d3] text-center font-mono">—</td>
                            <td className="p-2 border-r border-[#c4c6d3] text-center font-mono">—</td>
                            <td className="p-2 border-r border-[#c4c6d3] text-right font-mono font-medium">
                              ₹{stationery.amount.toLocaleString()}
                            </td>
                            <td className="p-2 text-center">
                              {stationery.bill ? <span className="text-[#137333] font-bold text-[10px]">Attached</span> : '—'}
                            </td>
                          </tr>
                        )}

                        {/* Grand Total Strip */}
                        <tr className="bg-[#dae2ff] font-extrabold text-[#001947]">
                          <td colSpan={5} className="p-2 border-r border-[#c4c6d3] text-right text-[12px]">
                            Grand Total ({sessionDay})
                          </td>
                          <td className="p-2 border-r border-[#c4c6d3] text-right font-mono text-[13px]">
                            ₹{grandTotal.toLocaleString()}
                          </td>
                          <td className="p-2 bg-[#dae2ff]"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Grand Total Strip & Footer Action Buttons */}
          <div className="px-6 py-3.5 bg-[#f4f3fb] border-t border-[#c4c6d3] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[15px] font-bold text-[#002869]">
              Grand Total :{' '}
              <span className="font-mono text-[18px] text-[#002869]">₹{grandTotal.toLocaleString()}</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-[#c4c6d3] bg-white text-[#434652] hover:bg-[#faf8ff] rounded-md text-[13px] font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSubmit(true)}
                className="px-4 py-2 border border-[#002869] text-[#002869] bg-white hover:bg-[#f4f3fb] rounded-md text-[13px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                Save Draft
              </button>
              <button
                onClick={() => handleSubmit(false)}
                className="px-5 py-2 bg-[#002869] text-white hover:bg-[#002869]/90 rounded-md text-[13px] font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                Submit Finance
              </button>
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


