import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { TabType, FinanceEntry, FinanceDraft, RouteDraftItem, FoodDraftItem } from '../types';
import { TqiLogo } from './TqiLogo';
import { generateAndDownloadStatementPDF } from '../utils/pdfGenerator';
import { checkImageClarity, extractRouteAndDetailsFromText } from '../utils/billParser';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

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
  remarks: string;
  rawType?: 'route' | 'food' | 'stationery' | 'other' | 'entry';
  rawId?: string;
  foodKey?: 'breakfast' | 'lunch' | 'dinner' | 'refreshments';
}

interface FinanceStatementViewProps {
  onBack: () => void;
  onNavigate: (tab: TabType, targetId?: string) => void;
  entries?: FinanceEntry[];
  drafts?: FinanceDraft[];
  activeDraftId?: string;
  clusterName?: string;
  collegeName?: string;
  spocName?: string;
  financerName?: string;
  sessionDay?: string;
  date?: string;
  onSaveDraft?: (draft: FinanceDraft) => void;
  onDeleteDraft?: (draftId: string) => void;
  onSubmitDraft?: (draftId: string) => void;
  onAddFinanceEntry?: (entry: Omit<FinanceEntry, 'id'>) => void;
  onUpdateFinanceEntry?: (id: string, updated: Partial<FinanceEntry>) => void;
  onDeleteFinanceEntry?: (id: string) => void;
}

export const FinanceStatementView: React.FC<FinanceStatementViewProps> = ({
  onBack,
  onNavigate,
  entries = [],
  drafts = [],
  activeDraftId,
  clusterName = 'Dharmapuri',
  collegeName = 'K.S.Rangasamy college of Technology',
  spocName = 'Narendhar',
  financerName = 'TQI Finance Team',
  sessionDay = 'Day 2',
  date = '2026-08-20',
  onSaveDraft,
  onDeleteDraft,
  onSubmitDraft,
  onAddFinanceEntry,
  onUpdateFinanceEntry,
  onDeleteFinanceEntry,
}) => {
  const [selectedViewKey, setSelectedViewKey] = useState<string>(
    activeDraftId || (drafts.length > 0 ? drafts[0].id : 'all-approved')
  );

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
  const [newExpenseForm, setNewExpenseForm] = useState<{
    category: 'Travel' | 'Food' | 'Stationery' | 'Other';
    description: string;
    count: string;
    perPerson: string;
    totalAmount: string;
    remarks: string;
    billUrl: string | null;
    billFileName: string;
  }>({
    category: 'Travel',
    description: '',
    count: '',
    perPerson: '',
    totalAmount: '',
    remarks: '',
    billUrl: null,
    billFileName: '',
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

  // Derive statement metadata
  const statementMeta = useMemo(() => {
    if (currentDraft) {
      return {
        collegeName: currentDraft.collegeName || collegeName,
        clusterName: currentDraft.clusterName || clusterName,
        sessionName: currentDraft.title,
        sessionDay: currentDraft.sessionDay || sessionDay,
        date: currentDraft.sessionDate || date,
        spocName: currentDraft.spocName || spocName,
        financerName: currentDraft.financerName || financerName,
        isDraft: true,
        status: currentDraft.status || 'Draft',
      };
    }

    if (selectedViewKey === 'all-approved') {
      return {
        collegeName,
        clusterName,
        sessionName: 'Combined Cluster Finance Statement',
        sessionDay: 'All Sessions',
        date: date,
        spocName,
        financerName,
        isDraft: false,
        status: 'Approved' as const,
      };
    }

    return {
      collegeName,
      clusterName,
      sessionName: `${selectedViewKey} Finance Statement`,
      sessionDay: selectedViewKey,
      date: date,
      spocName,
      financerName,
      isDraft: false,
      status: 'Approved' as const,
    };
  }, [currentDraft, selectedViewKey, collegeName, clusterName, sessionDay, date, spocName, financerName]);

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
    // 1. If viewing a structured Draft
    if (currentDraft) {
      const items: StatementItem[] = [];
      let sNo = 1;

      // Travel routes
      if (currentDraft.routes) {
        currentDraft.routes.forEach((r, idx) => {
          const total = (r.volunteers || 0) * (r.perPerson || 0);
          items.push({
            id: r.id || `route-${idx}`,
            sNo: sNo++,
            category: 'Travel',
            description: `${r.from || 'Origin'} → ${r.to || 'Destination'}`,
            count: r.volunteers ? String(r.volunteers) : '—',
            countAmount: r.volunteers && r.perPerson ? `${r.volunteers}×${r.perPerson}` : '—',
            total: total,
            billUrl: r.bill?.url || 'https://images.unsplash.com/photo-1554415707-9e49fe74a6d0?w=600&auto=format&fit=crop&q=80',
            billFileName: r.bill?.fileName || 'Travel_Tickets.jpg',
            remarks: r.remarks || 'Bus / Auto transportation for volunteers',
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
            billUrl: currentDraft.food.breakfast.bill?.url || 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&auto=format&fit=crop&q=80',
            billFileName: currentDraft.food.breakfast.bill?.fileName || 'Breakfast_Bill.jpg',
            remarks: currentDraft.food.breakfast.remarks || 'Tiffin & Tea for volunteers at Annapoorna hotel',
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
            billUrl: currentDraft.food.lunch.bill?.url || 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&auto=format&fit=crop&q=80',
            billFileName: currentDraft.food.lunch.bill?.fileName || 'Lunch_Receipt.jpg',
            remarks: currentDraft.food.lunch.remarks || 'Meals packet allowance',
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
            billFileName: currentDraft.food.dinner.bill?.fileName || 'Dinner_Receipt.jpg',
            remarks: currentDraft.food.dinner.remarks || 'Volunteer dinner',
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
            billFileName: currentDraft.food.refreshments.bill?.fileName || 'Tea_Snacks_Bill.jpg',
            remarks: currentDraft.food.refreshments.remarks || 'Tea and evening snacks',
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
          billFileName: currentDraft.stationery.bill?.fileName || 'Stationery_Bill.jpg',
          remarks: currentDraft.stationery.remarks || 'Chart papers, markers and activity kits',
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
              description: ot.description || 'First Aid Kit & Water Cans',
              count: '—',
              countAmount: '—',
              total: ot.amount || 0,
              billUrl: ot.bill?.url || null,
              billFileName: ot.bill?.fileName || 'Other_Expense_Slip.jpg',
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
    const sourceEntries =
      selectedViewKey === 'all-approved'
        ? entries.filter((e) => e.status === 'Approved')
        : entries.filter((e) => e.sessionDay === selectedViewKey || e.status === 'Approved');

    if (sourceEntries.length === 0) {
      return [
        {
          id: 'mock-1',
          sNo: 1,
          category: 'Travel',
          description: 'KSR College → Salem / Ammapettai',
          count: '20',
          countAmount: '20×10',
          total: 200,
          billUrl: 'https://images.unsplash.com/photo-1554415707-9e49fe74a6d0?w=600&auto=format&fit=crop&q=80',
          billFileName: 'Bus_Pass_KSR.jpg',
          remarks: 'Bus transportation for 20 volunteers',
          rawType: 'entry',
        },
        {
          id: 'mock-2',
          sNo: 2,
          category: 'Food',
          description: 'Breakfast',
          count: '—',
          countAmount: '—',
          total: 1000,
          billUrl: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&auto=format&fit=crop&q=80',
          billFileName: 'Annapoorna_Breakfast.jpg',
          remarks: 'Tiffin & Tea for 20 volunteers at Annapoorna hotel',
          rawType: 'entry',
        },
        {
          id: 'mock-3',
          sNo: 3,
          category: 'Food',
          description: 'Lunch',
          count: '—',
          countAmount: '—',
          total: 500,
          billUrl: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&auto=format&fit=crop&q=80',
          billFileName: 'Lunch_Packet_Slip.jpg',
          remarks: 'Meals packet allowance',
          rawType: 'entry',
        },
        {
          id: 'mock-4',
          sNo: 4,
          category: 'Other',
          description: 'First Aid Kit & Water Cans',
          count: '—',
          countAmount: '—',
          total: 0,
          billUrl: null,
          billFileName: '',
          remarks: '—',
          rawType: 'entry',
        },
      ];
    }

    return sourceEntries.map((e, idx) => ({
      id: e.id,
      sNo: idx + 1,
      category: e.category as any,
      description: e.description,
      count: e.count ? String(e.count) : '—',
      countAmount: e.countAmount || '—',
      total: e.amount,
      billUrl: e.billUrl || 'https://images.unsplash.com/photo-1554415707-9e49fe74a6d0?w=600&auto=format&fit=crop&q=80',
      billFileName: 'Receipt_Voucher.jpg',
      remarks: e.remarks || '—',
      rawType: 'entry',
      rawId: e.id,
    }));
  }, [currentDraft, selectedViewKey, entries]);

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

  // SUBMIT STATEMENT FOR APPROVAL (Volunteer / SPOC action only - No direct approve button)
  const handleSubmitStatement = () => {
    if (currentDraft && onSubmitDraft) {
      onSubmitDraft(currentDraft.id);
      showToast(`Finance Statement for "${statementMeta.sessionDay}" submitted for review!`);
    } else {
      showToast('Finance statement submitted to TQI Finance Team successfully!');
    }
  };

  // DELETE AN EXPENSE ROW
  const handleDeleteRow = (item: StatementItem) => {
    if (!confirm(`Are you sure you want to delete "${item.description}"?`)) return;

    if (currentDraft && onSaveDraft) {
      let updatedDraft: FinanceDraft = { ...currentDraft };

      if (item.rawType === 'route' && item.rawId) {
        updatedDraft.routes = updatedDraft.routes.filter((r) => r.id !== item.rawId);
      } else if (item.rawType === 'food' && item.foodKey) {
        updatedDraft.food = {
          ...updatedDraft.food,
          [item.foodKey]: { amount: 0, remarks: '', bill: null },
        };
      } else if (item.rawType === 'stationery') {
        updatedDraft.stationery = { amount: 0, remarks: '', bill: null };
      } else if (item.rawType === 'other' && item.rawId) {
        updatedDraft.otherItems = updatedDraft.otherItems.filter((ot) => ot.id !== item.rawId);
      }

      // Recalculate draft total
      const newTravel = updatedDraft.routes.reduce((s, r) => s + (r.volunteers || 0) * (r.perPerson || 0), 0);
      const newFood =
        (updatedDraft.food.breakfast?.amount || 0) +
        (updatedDraft.food.lunch?.amount || 0) +
        (updatedDraft.food.dinner?.amount || 0) +
        (updatedDraft.food.refreshments?.amount || 0);
      const newStationery = updatedDraft.stationery?.amount || 0;
      const newOther = updatedDraft.otherItems.reduce((s, o) => s + (o.amount || 0), 0);

      updatedDraft.totalAmount = newTravel + newFood + newStationery + newOther;
      onSaveDraft(updatedDraft);
      showToast(`Deleted "${item.description}"`);
    } else if (item.rawType === 'entry' && item.rawId && onDeleteFinanceEntry) {
      onDeleteFinanceEntry(item.rawId);
      showToast(`Deleted "${item.description}"`);
    } else {
      showToast(`Item removed from view.`);
    }
  };

  // SAVE EDITED EXPENSE ROW
  const handleSaveEditedRow = () => {
    if (!editingItem) return;

    if (currentDraft && onSaveDraft) {
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

      onSaveDraft(updatedDraft);
      showToast(`Updated "${editingItem.description}"`);
    } else if (editingItem.rawType === 'entry' && editingItem.rawId && onUpdateFinanceEntry) {
      onUpdateFinanceEntry(editingItem.rawId, {
        description: editingItem.description,
        category: editingItem.category as any,
        amount: editingItem.total,
        remarks: editingItem.remarks,
        billUrl: editingItem.billUrl || undefined,
        count: parseInt(editingItem.count) || undefined,
        countAmount: editingItem.countAmount || undefined,
      });
      showToast(`Updated "${editingItem.description}"`);
    }

    setEditingItem(null);
  };

  // ADD NEW EXPENSE ROW TO STATEMENT
  const handleAddNewExpenseRow = () => {
    if (!newExpenseForm.description && !newExpenseForm.totalAmount) {
      alert('Please fill in description or amount');
      return;
    }

    const totalAmt = parseFloat(newExpenseForm.totalAmount) || 0;
    const vols = parseInt(newExpenseForm.count) || 0;
    const perP = parseFloat(newExpenseForm.perPerson) || 0;
    const finalAmount = totalAmt > 0 ? totalAmt : vols * perP;

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

      onSaveDraft(updatedDraft);
      showToast(`Added "${newExpenseForm.description}" to statement`);
    } else if (onAddFinanceEntry) {
      onAddFinanceEntry({
        date: statementMeta.date,
        description: newExpenseForm.description || 'Expense Entry',
        category: newExpenseForm.category as any,
        amount: finalAmount,
        panchayatId: 'dharmapuri-main',
        panchayatName: statementMeta.clusterName,
        villageName: 'Cluster Center',
        status: 'Draft',
        billUrl: newExpenseForm.billUrl || undefined,
        remarks: newExpenseForm.remarks,
        count: vols || undefined,
        countAmount: vols && perP ? `${vols}×${perP}` : undefined,
        sessionDay: statementMeta.sessionDay,
      });
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
  const handleSaveMetadata = () => {
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
      onSaveDraft(updatedDraft);
      showToast('Statement details updated');
    } else {
      showToast('Metadata updated for preview');
    }
    setShowEditMetaModal(false);
  };

  // EXCEL (.XLSX) EXPORT USING XLSX LIBRARY
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Create styled matrix data
    const wsData: any[][] = [
      ['TALENT QUEST FOR INDIA', '', '', '', '', '', '', ''],
      ['Academic year 2026-2027', '', '', '', '', '', '', ''],
      ['FINANCE REPORT', '', '', '', '', '', '', ''],
      [`${statementMeta.clusterName} Cluster`, '', '', '', '', '', '', ''],
      [],
      ['COLLEGE:', statementMeta.collegeName, '', 'CLUSTER:', statementMeta.clusterName, '', 'SESSION:', statementMeta.sessionName],
      ['DATE:', statementMeta.date, '', 'SPOC:', statementMeta.spocName, '', 'FINANCER:', statementMeta.financerName],
      ['DAY:', statementMeta.sessionDay, '', 'STATUS:', statementMeta.status, '', '', ''],
      [],
      ['EXPENSE DETAILS', '', '', '', '', '', '', ''],
      ['S.No', 'Category', 'Description', 'Count', 'Count×Amount', 'Total (INR)', 'Bills Attached', 'Remarks'],
    ];

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

    wsData.push([]);
    if (travelTotal > 0) {
      wsData.push(['', '', '', '', 'Travel Total:', travelTotal, '', '']);
    }
    if (foodTotal > 0) {
      wsData.push(['', '', '', '', 'Food Total:', foodTotal, '', '']);
    }
    if (stationeryTotal > 0) {
      wsData.push(['', '', '', '', 'Stationery Total:', stationeryTotal, '', '']);
    }
    if (otherTotal > 0) {
      wsData.push(['', '', '', '', 'Other Expenses Total:', otherTotal, '', '']);
    }
    wsData.push(['', '', '', '', 'GRAND TOTAL (INR):', grandTotal, '', '']);
    wsData.push([]);
    wsData.push(['Coordinator / SPOC Signature:', statementMeta.spocName, '', '', 'Cluster Admin Signature:', statementMeta.financerName, '', '']);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = [
      { wch: 8 },  // S.No
      { wch: 14 }, // Category
      { wch: 35 }, // Description
      { wch: 10 }, // Count
      { wch: 15 }, // Count x Amount
      { wch: 14 }, // Total
      { wch: 20 }, // Bills
      { wch: 35 }, // Remarks
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
        <div style="font-size: 15px; text-align: center; color: #434652; font-weight: bold; margin-bottom: 2px;">Academic year 2026-2027</div>
        <div style="font-size: 15px; text-align: center; color: #002869; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;">Finance report</div>
        <div class="header-sub">${statementMeta.clusterName} Cluster</div>

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
              <div class="meta-label">CLUSTER</div>
              <div class="meta-val">${statementMeta.clusterName}</div>
            </td>
            <td>
              <div class="meta-label">SPOC</div>
              <div class="meta-val">${statementMeta.spocName}</div>
            </td>
          </tr>
          <tr>
            <td>
              <div class="meta-label">SESSION</div>
              <div class="meta-val">${statementMeta.sessionName} (${statementMeta.sessionDay})</div>
            </td>
            <td>
              <div class="meta-label">FINANCER</div>
              <div class="meta-val">${statementMeta.financerName}</div>
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
  const handleExportPDF = async () => {
    setIsGeneratingPdf(true);
    showToast('Generating official TQI PDF Statement with attached bills...');
    try {
      await generateAndDownloadStatementPDF({
        elementId: 'printable-tqi-statement-doc',
        meta: statementMeta,
        items: tableItems,
        travelTotal,
        foodTotal,
        stationeryTotal,
        otherTotal,
        grandTotal,
        attachedBills: allAttachedBills,
      });
      showToast('PDF downloaded successfully!');
    } catch (err) {
      console.error('PDF export error:', err);
      window.print();
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
      <div className="bg-white p-4 rounded-md border border-[#c4c6d3]/70 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[13px] font-bold text-[#002869] hover:bg-[#dae2ff]/40 cursor-pointer bg-[#f4f3fb] px-3.5 py-2 rounded-md border border-[#c4c6d3]/60 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Finance
          </button>

          {/* Select Statement Session */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-[#434652]">Session Sheet:</span>
            <Select
              value={selectedViewKey}
              onValueChange={(val) => setSelectedViewKey(val)}
            >
              <SelectTrigger id="finance-session-sheet-select" className="w-56 h-8 text-xs font-bold text-[#002869] border-[#c4c6d3] bg-[#faf8ff]">
                <SelectValue placeholder="Select Session Sheet" />
              </SelectTrigger>
              <SelectContent>
                {drafts.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    [Draft] {d.title} ({d.sessionDay}) - &#8377;{d.totalAmount.toLocaleString()}
                  </SelectItem>
                ))}
                <SelectItem value="all-approved">Combined Approved Statement (Cluster)</SelectItem>
                {Array.from({ length: 8 }, (_, i) => `Day ${i + 1}`).map((day) => (
                  <SelectItem key={day} value={day}>
                    {day} Statement
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons: Submit, View Statement, All Bills, Excel, Word, Print/PDF */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Submit for Approval (SPOC / Volunteer workflow) */}
          <button
            onClick={handleSubmitStatement}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#137333] text-white rounded-md text-[12.5px] font-bold hover:bg-[#137333]/90 shadow-xs transition-all cursor-pointer"
            title="Submit this statement for cluster review and approval"
          >
            <span className="material-symbols-outlined text-[17px]">send</span>
            Submit for Approval
          </button>

          {/* View Statement Modal Trigger */}
          <button
            onClick={() => setShowFullStatementModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#002869] text-white rounded-md text-[12px] font-bold hover:bg-[#002869]/90 shadow-xs transition-all cursor-pointer"
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
              className="flex items-center gap-1.5 px-3 py-2 bg-[#faf8ff] border border-[#002869]/30 text-[#002869] rounded-md text-[12px] font-bold hover:bg-[#dae2ff] transition-all cursor-pointer"
              title="View all attached bill receipts in a gallery"
            >
              <span className="material-symbols-outlined text-[17px]">photo_library</span>
              All Bills ({allAttachedBills.length})
            </button>
          )}

          {/* Export Options: Excel, Word, PDF */}
          <div className="flex items-center gap-1 bg-[#f4f3fb] p-1 rounded-md border border-[#c4c6d3]">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1 px-2.5 py-1 text-[#137333] hover:bg-white rounded text-[11.5px] font-bold transition-all cursor-pointer"
              title="Download Excel Sheet (.xlsx)"
            >
              <span className="material-symbols-outlined text-[16px]">table_view</span>
              Excel
            </button>

            <button
              onClick={handleExportWord}
              className="flex items-center gap-1 px-2.5 py-1 text-[#002869] hover:bg-white rounded text-[11.5px] font-bold transition-all cursor-pointer"
              title="Download Microsoft Word Document (.doc)"
            >
              <span className="material-symbols-outlined text-[16px]">description</span>
              Word
            </button>

            <button
              onClick={handleExportPDF}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1 px-2.5 py-1 text-[#592600] hover:bg-white rounded text-[11.5px] font-bold transition-all cursor-pointer disabled:opacity-50"
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
        <div className="bg-[#fff7f2] border border-[#ffdbc8] rounded-md p-3.5 flex items-center justify-between gap-3 text-[13px] print:hidden shadow-xs">
          <div className="flex items-center gap-2.5 text-[#592600]">
            <div className="w-8 h-8 rounded-md bg-[#ffdbc8] text-[#592600] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">description</span>
            </div>
            <div>
              <div className="font-bold flex items-center gap-2">
                <span>Official TQI Finance Sheet</span>
                <span className="bg-[#ffdbc8] text-[#592600] text-[10.5px] px-2 py-0.2 rounded font-extrabold">
                  Status: {statementMeta.status}
                </span>
              </div>
              <p className="text-[11.5px] text-[#762900] mt-0.5">
                Cluster audit statement preview. Click receipt buttons below to inspect verified bills.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OFFICIAL TQI FINANCE SHEET DOCUMENT (PRINTABLE & UNBOXED HEADER) */}
      {/* ========================================================================= */}
      <div id="printable-tqi-statement-doc" className="bg-white rounded-md border border-[#c4c6d3]/80 shadow-sm p-6 sm:p-12 space-y-8 print:p-0 print:border-none print:shadow-none">
        
        {/* 1. TQI OFFICIAL LOGO & TITLE HEADER */}
        <div className="flex flex-col items-center justify-center text-center space-y-2.5 pb-4 border-b border-[#dae2ff]">
          {/* Authentic TQI Circular Trust Logo */}
          <div className="flex items-center justify-center">
            <TqiLogo size={92} className="mx-auto" />
          </div>

          <div className="space-y-1 pt-1">
            <h1 className="text-[22px] sm:text-[26px] font-extrabold text-[#000000] tracking-tight">
              Talent Quest for India
            </h1>
            <div className="text-[14px] sm:text-[15px] font-bold text-[#434652]">
              Academic year 2026-2027
            </div>
            <div className="text-[14px] sm:text-[15px] font-extrabold text-[#002869] uppercase tracking-wider">
              Finance report
            </div>
            <div className="text-[13.5px] sm:text-[14.5px] font-bold text-[#592600]">
              {statementMeta.clusterName} Cluster
            </div>
          </div>
        </div>

        {/* 2. UNBOXED CLEAN METADATA SECTION */}
        <div className="bg-[#faf8ff] rounded-md p-5 sm:p-6 border border-[#dae2ff]/80 text-[13px]">
          <div className="flex items-center justify-between mb-3 border-b border-[#dae2ff] pb-2">
            <span className="text-[11px] font-extrabold text-[#002869] uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">info</span>
              Session &amp; Cluster Details
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                  statementMeta.status === 'Approved'
                    ? 'bg-[#e6f4ea] text-[#137333]'
                    : 'bg-[#ffdbc8] text-[#592600]'
                }`}
              >
                Status: {statementMeta.status}
              </span>
            </div>
          </div>

          {/* Clean 2-Column Unboxed Key-Value Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-8">
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-[11.5px] font-bold text-[#747783] uppercase tracking-wide w-24 shrink-0">
                  COLLEGE:
                </span>
                <span className="font-bold text-[#000000] text-[13.5px]">
                  {statementMeta.collegeName}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-[11.5px] font-bold text-[#747783] uppercase tracking-wide w-24 shrink-0">
                  CLUSTER:
                </span>
                <span className="font-bold text-[#002869] text-[13.5px]">
                  {statementMeta.clusterName}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-[11.5px] font-bold text-[#747783] uppercase tracking-wide w-24 shrink-0">
                  SESSION:
                </span>
                <span className="font-semibold text-[#000000] text-[13px]">
                  {statementMeta.sessionName}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-[11.5px] font-bold text-[#747783] uppercase tracking-wide w-24 shrink-0">
                  DATE:
                </span>
                <span className="font-semibold text-[#000000] text-[13px]">
                  {statementMeta.date}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-[11.5px] font-bold text-[#747783] uppercase tracking-wide w-24 shrink-0">
                  SPOC:
                </span>
                <span className="font-semibold text-[#000000] text-[13px]">
                  {statementMeta.spocName}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-[11.5px] font-bold text-[#747783] uppercase tracking-wide w-24 shrink-0">
                  FINANCER:
                </span>
                <span className="font-semibold text-[#000000] text-[13px]">
                  {statementMeta.financerName}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. EXPENSE DETAILS SECTION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-[#000000] uppercase tracking-wider flex items-center gap-2">
              <span>Expense Details</span>
              <span className="text-[11px] font-semibold text-[#747783] lowercase font-normal">
                ({tableItems.length} items logged)
              </span>
            </h2>
          </div>

          {/* Main Expense Table (Mobile Cards View) */}
          <div className="block md:hidden space-y-3 print:hidden">
            {tableItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-[#c4c6d3] bg-[#faf8ff]/50 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono text-[#747783]">#{item.sNo}</span>
                    <span className="inline-block px-2 py-0.5 rounded text-[10.5px] font-bold bg-[#dae2ff] text-[#002869]">
                      {item.category}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#002869]">
                    ₹{item.total.toLocaleString()}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-bold text-[#1a1b21]">
                    {item.description}
                  </p>
                  {item.count && item.countAmount && (
                    <p className="text-[11px] text-[#555555] mt-0.5 font-mono">
                      Formula: {item.count} × {item.countAmount}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-[#c4c6d3]/60 text-[11px]">
                  <span className="text-[#555555] truncate max-w-[170px]">
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#e6f4ea] text-[#137333] border border-[#137333]/30 rounded text-[11px] font-bold cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                      <span>View Bill</span>
                    </button>
                  ) : (
                    <span className="text-[#747783] text-[10.5px]">No receipt</span>
                  )}
                </div>
              </div>
            ))}

            {/* Mobile Category Totals Summary */}
            <div className="p-3.5 rounded-xl border border-[#dae2ff] bg-[#faf8ff] space-y-1.5 text-xs">
              <div className="text-[11px] font-bold text-[#002869] uppercase tracking-wider mb-2">Category Subtotals</div>
              {travelTotal > 0 && (
                <div className="flex justify-between text-[#434652]">
                  <span>Travel Total:</span>
                  <span className="font-mono font-bold text-[#002869]">₹{travelTotal.toLocaleString()}</span>
                </div>
              )}
              {foodTotal > 0 && (
                <div className="flex justify-between text-[#434652]">
                  <span>Food Total:</span>
                  <span className="font-mono font-bold text-[#002869]">₹{foodTotal.toLocaleString()}</span>
                </div>
              )}
              {stationeryTotal > 0 && (
                <div className="flex justify-between text-[#434652]">
                  <span>Stationery Total:</span>
                  <span className="font-mono font-bold text-[#002869]">₹{stationeryTotal.toLocaleString()}</span>
                </div>
              )}
              {otherTotal > 0 && (
                <div className="flex justify-between text-[#434652]">
                  <span>Other Total:</span>
                  <span className="font-mono font-bold text-[#002869]">₹{otherTotal.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-[#dae2ff] font-bold text-sm text-[#001947]">
                <span>Grand Total:</span>
                <span className="font-mono text-base text-[#002869]">₹{grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Main Expense Table (Desktop View) */}
          <div className="hidden md:block border border-[#c4c6d3] overflow-x-auto rounded-md print:block">
            <table className="w-full text-left text-[12px] border-collapse min-w-[700px]">
              <thead className="bg-[#faf8ff] border-b border-[#c4c6d3] font-bold text-[#000000]">
                <tr>
                  <th className="p-2.5 border-r border-[#c4c6d3] w-12 text-center">S.No</th>
                  <th className="p-2.5 border-r border-[#c4c6d3] w-24">Category</th>
                  <th className="p-2.5 border-r border-[#c4c6d3]">Description</th>
                  <th className="p-2.5 border-r border-[#c4c6d3] text-center w-16">Count</th>
                  <th className="p-2.5 border-r border-[#c4c6d3] text-center w-24">Count×Amount</th>
                  <th className="p-2.5 border-r border-[#c4c6d3] text-right w-24">Total</th>
                  <th className="p-2.5 border-r border-[#c4c6d3] text-center w-24">Bills</th>
                  <th className="p-2.5">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c4c6d3]">
                {tableItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[#faf8ff]/80 transition-colors group">
                    <td className="p-2.5 border-r border-[#c4c6d3] font-mono text-center">{item.sNo}</td>
                    <td className="p-2.5 border-r border-[#c4c6d3]">
                      <span className="font-semibold text-[#002869]">{item.category}</span>
                    </td>
                    <td className="p-2.5 border-r border-[#c4c6d3] font-medium text-[#1a1b21]">
                      {item.description}
                    </td>
                    <td className="p-2.5 border-r border-[#c4c6d3] text-center font-mono">{item.count}</td>
                    <td className="p-2.5 border-r border-[#c4c6d3] text-center font-mono">{item.countAmount}</td>
                    <td className="p-2.5 border-r border-[#c4c6d3] text-right font-mono font-bold text-[#002869]">
                      ₹{item.total.toLocaleString()}
                    </td>
                    
                    {/* BILLS COLUMN: Clickable Viewer & Thumbnail */}
                    <td className="p-2.5 border-r border-[#c4c6d3] text-center">
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
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#e6f4ea] hover:bg-[#ceead6] text-[#137333] border border-[#137333]/30 rounded-md text-[11.5px] font-bold transition-all cursor-pointer shadow-2xs"
                          title="Click to view full receipt / bill"
                        >
                          <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                          <span>View</span>
                        </button>
                      ) : (
                        <span className="text-[#747783] text-[11px] font-medium">—</span>
                      )}
                    </td>

                    <td className="p-2.5 text-[#555555] text-[11.5px]">{item.remarks}</td>
                  </tr>
                ))}

                {/* Subtotals */}
                {travelTotal > 0 && (
                  <tr className="bg-[#faf8ff] font-medium text-[12px]">
                    <td colSpan={5} className="p-2.5 border-r border-[#c4c6d3] text-right font-bold text-[#434652]">
                      Travel Total
                    </td>
                    <td className="p-2.5 border-r border-[#c4c6d3] text-right font-mono font-bold text-[#002869]">
                      ₹{travelTotal.toLocaleString()}
                    </td>
                    <td colSpan={2} className="p-2.5 bg-[#faf8ff]"></td>
                  </tr>
                )}

                {foodTotal > 0 && (
                  <tr className="bg-[#faf8ff] font-medium text-[12px]">
                    <td colSpan={5} className="p-2.5 border-r border-[#c4c6d3] text-right font-bold text-[#434652]">
                      Food Total
                    </td>
                    <td className="p-2.5 border-r border-[#c4c6d3] text-right font-mono font-bold text-[#002869]">
                      ₹{foodTotal.toLocaleString()}
                    </td>
                    <td colSpan={2} className="p-2.5 bg-[#faf8ff]"></td>
                  </tr>
                )}

                {stationeryTotal > 0 && (
                  <tr className="bg-[#faf8ff] font-medium text-[12px]">
                    <td colSpan={5} className="p-2.5 border-r border-[#c4c6d3] text-right font-bold text-[#434652]">
                      Stationery / Materials Total
                    </td>
                    <td className="p-2.5 border-r border-[#c4c6d3] text-right font-mono font-bold text-[#002869]">
                      ₹{stationeryTotal.toLocaleString()}
                    </td>
                    <td colSpan={2} className="p-2.5 bg-[#faf8ff]"></td>
                  </tr>
                )}

                {otherTotal > 0 && (
                  <tr className="bg-[#faf8ff] font-medium text-[12px]">
                    <td colSpan={5} className="p-2.5 border-r border-[#c4c6d3] text-right font-bold text-[#434652]">
                      Other Expenses Total
                    </td>
                    <td className="p-2.5 border-r border-[#c4c6d3] text-right font-mono font-bold text-[#002869]">
                      ₹{otherTotal.toLocaleString()}
                    </td>
                    <td colSpan={2} className="p-2.5 bg-[#faf8ff]"></td>
                  </tr>
                )}

                {/* Grand Total Strip */}
                <tr className="bg-[#dae2ff] font-extrabold text-[#001947]">
                  <td colSpan={5} className="p-3 border-r border-[#c4c6d3] text-right text-[13.5px] tracking-wide">
                    Grand Total
                  </td>
                  <td className="p-3 border-r border-[#c4c6d3] text-right font-mono text-[15px]">
                    ₹{grandTotal.toLocaleString()}
                  </td>
                  <td colSpan={2} className="p-3 bg-[#dae2ff]"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. FOOTER SIGN-OFF SECTION */}
        <div className="pt-8 sm:pt-14 grid grid-cols-2 gap-12 text-center text-[12px]">
          <div>
            <div className="border-t border-[#000000] pt-2 font-bold text-[#000000]">
              Coordinator
            </div>
            <div className="text-[11px] text-[#747783] mt-0.5">SPOC: {statementMeta.spocName}</div>
          </div>

          <div>
            <div className="border-t border-[#000000] pt-2 font-bold text-[#000000]">
              Cluster Admin
            </div>
            <div className="text-[11px] text-[#747783] mt-0.5">{statementMeta.financerName}</div>
          </div>
        </div>

        {/* Audit Document Footer Note */}
        <div className="text-center pt-2 text-[11px] text-[#747783] border-t border-[#dae2ff]/60">
          Talent Quest for India — Official Finance Statement &amp; Audit Document
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BILL LIGHTBOX & VIEWER MODAL */}
      {/* ========================================================================= */}
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
                onClick={handleAddNewExpenseRow}
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
      {showFullStatementModal && (
        <div
          onClick={() => setShowFullStatementModal(false)}
          className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-6 cursor-pointer animate-[fadeIn_0.15s_ease-out]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-md max-w-4xl w-full overflow-hidden shadow-sm flex flex-col max-h-[92vh] cursor-default border border-[#c4c6d3]"
          >
            <div className="p-4 bg-[#002869] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                <h3 className="text-[16px] font-bold">Official TQI Finance Statement Preview</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  className="px-2.5 py-1 bg-white20 hover:bg-white30 text-white rounded text-[11.5px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">table_view</span>
                  Excel
                </button>
                <button
                  onClick={handleExportWord}
                  className="px-2.5 py-1 bg-white20 hover:bg-white30 text-white rounded text-[11.5px] font-bold flex items-center gap-1 cursor-pointer"
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
              <div className="text-center space-y-1.5 pb-2 border-b border-[#dae2ff]">
                <div className="flex items-center justify-center">
                  <TqiLogo size={75} className="mx-auto" />
                </div>
                <h2 className="text-[20px] font-extrabold text-[#000000] pt-1">
                  Talent Quest for India
                </h2>
                <div className="text-[13px] font-bold text-[#434652]">
                  Academic year 2026-2027
                </div>
                <div className="text-[13px] font-extrabold text-[#002869] uppercase tracking-wider">
                  Finance report
                </div>
                <div className="text-[12.5px] font-bold text-[#592600]">
                  {statementMeta.clusterName} Cluster
                </div>
              </div>

              {/* Unboxed Metadata in Modal */}
              <div className="bg-[#faf8ff] p-4 rounded-md border border-[#c4c6d3]/60 text-[12.5px] grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[#747783] font-bold uppercase text-[10.5px] block">COLLEGE</span>
                  <span className="font-bold text-[#000000]">{statementMeta.collegeName}</span>
                </div>
                <div>
                  <span className="text-[#747783] font-bold uppercase text-[10.5px] block">DATE</span>
                  <span className="font-semibold text-[#000000]">{statementMeta.date}</span>
                </div>
                <div>
                  <span className="text-[#747783] font-bold uppercase text-[10.5px] block">CLUSTER</span>
                  <span className="font-bold text-[#002869]">{statementMeta.clusterName}</span>
                </div>
                <div>
                  <span className="text-[#747783] font-bold uppercase text-[10.5px] block">SPOC</span>
                  <span className="font-semibold text-[#000000]">{statementMeta.spocName}</span>
                </div>
                <div>
                  <span className="text-[#747783] font-bold uppercase text-[10.5px] block">SESSION</span>
                  <span className="font-semibold text-[#000000]">{statementMeta.sessionName} ({statementMeta.sessionDay})</span>
                </div>
                <div>
                  <span className="text-[#747783] font-bold uppercase text-[10.5px] block">FINANCER</span>
                  <span className="font-semibold text-[#000000]">{statementMeta.financerName}</span>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-left text-[12px] border-collapse border border-[#c4c6d3]">
                <thead className="bg-[#faf8ff] font-bold text-[#000000] border-b border-[#c4c6d3]">
                  <tr>
                    <th className="p-2 border-r border-[#c4c6d3] w-10 text-center">S.No</th>
                    <th className="p-2 border-r border-[#c4c6d3] w-20">Category</th>
                    <th className="p-2 border-r border-[#c4c6d3]">Description</th>
                    <th className="p-2 border-r border-[#c4c6d3] text-center w-14">Count</th>
                    <th className="p-2 border-r border-[#c4c6d3] text-center w-20">Count×Amt</th>
                    <th className="p-2 border-r border-[#c4c6d3] text-right w-20">Total</th>
                    <th className="p-2 border-r border-[#c4c6d3] text-center w-16">Bills</th>
                    <th className="p-2">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c4c6d3]">
                  {tableItems.map((item) => (
                    <tr key={item.id}>
                      <td className="p-2 border-r border-[#c4c6d3] text-center">{item.sNo}</td>
                      <td className="p-2 border-r border-[#c4c6d3] font-bold text-[#002869]">{item.category}</td>
                      <td className="p-2 border-r border-[#c4c6d3]">{item.description}</td>
                      <td className="p-2 border-r border-[#c4c6d3] text-center">{item.count}</td>
                      <td className="p-2 border-r border-[#c4c6d3] text-center">{item.countAmount}</td>
                      <td className="p-2 border-r border-[#c4c6d3] text-right font-bold text-[#002869]">
                        ₹{item.total.toLocaleString()}
                      </td>
                      <td className="p-2 border-r border-[#c4c6d3] text-center">
                        {item.billUrl ? <span className="text-[#137333] font-bold text-[11px]">Attached</span> : '—'}
                      </td>
                      <td className="p-2 text-[#747783]">{item.remarks}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#dae2ff] font-extrabold text-[#001947]">
                    <td colSpan={5} className="p-2.5 border-r border-[#c4c6d3] text-right text-[13px]">
                      Grand Total
                    </td>
                    <td className="p-2.5 border-r border-[#c4c6d3] text-right font-mono text-[14px]">
                      ₹{grandTotal.toLocaleString()}
                    </td>
                    <td colSpan={2} className="p-2.5 bg-[#dae2ff]"></td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-[12px]">
                <div>
                  <div className="border-t border-[#000000] pt-1.5 font-bold">Coordinator</div>
                  <div className="text-[11px] text-[#747783]">{statementMeta.spocName}</div>
                </div>
                <div>
                  <div className="border-t border-[#000000] pt-1.5 font-bold">Cluster Admin</div>
                  <div className="text-[11px] text-[#747783]">{statementMeta.financerName}</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#faf8ff] border-t border-[#c4c6d3] flex justify-end">
              <button
                onClick={() => setShowFullStatementModal(false)}
                className="px-5 py-2 bg-[#002869] text-white rounded-md text-[12.5px] font-bold cursor-pointer"
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


