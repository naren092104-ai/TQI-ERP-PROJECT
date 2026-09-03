/**
 * TQI Finance Statement — PDF Export
 * ─────────────────────────────────────────────────────────────────
 * Uses `@react-pdf/renderer` to produce a real `.pdf` file that the
 * browser downloads directly. No popup, no print dialog, no double
 * print. One click → one PDF file.
 */
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import {
  FinanceStatementPdf,
  type PDFStatementData,
  type PDFStatementItem,
  type PDFAttachedBill,
} from './FinanceStatementPdf';

export interface ExportStatementInput {
  clusterName: string;
  collegeName: string;
  sessionName: string;
  sessionDay: string;
  date: string;
  status: string;
  spocName: string;
  spocRole?: string;
  financerName: string;
  items: Array<{
    sNo: number;
    category: string;
    description: string;
    count?: string | number;
    countAmount?: string;
    total: number;
    billUrl?: string | null;
    billFileName?: string;
    remarks?: string;
  }>;
  travelTotal: number;
  foodTotal: number;
  stationeryTotal: number;
  otherTotal: number;
  grandTotal: number;
  attachedBills?: Array<{
    id?: string;
    title?: string;
    category?: string;
    amount?: number;
    url?: string;
    fileName?: string;
  }>;
  logoSrc?: string;
  generatedAt?: string;
  auditRef?: string;
  academicYear?: string;
}

const DEFAULT_LOGO_SRC = '/logo.png';

/**
 * Build a real PDF blob from the statement data and trigger a download.
 */
export async function exportFinanceStatementAsPdf(
  input: ExportStatementInput,
): Promise<void> {
  const data = mapToPdfData(input);
  // FinanceStatementPdf renders a <Document> as its root. Cast for the
  // `pdf()` helper's strict type — the runtime contract is correct.
  const documentElement = React.createElement(FinanceStatementPdf, {
    data,
  }) as unknown as Parameters<typeof pdf>[0];
  const blob = await pdf(documentElement).toBlob();

  const safeCluster = (data.cluster || 'Cluster').replace(
    /[^a-zA-Z0-9]+/g,
    '_',
  );
  const safeDate = (data.date || '').replace(/[^0-9]+/g, '').slice(0, 8);
  const filename = `TQI_Finance_Statement_${safeCluster}_${
    safeDate || 'Report'
  }.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so Safari has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ─────────────────────────────────────────────────────────────────
// Mapper — view data shape → PDF data shape
// ─────────────────────────────────────────────────────────────────

function mapToPdfData(input: ExportStatementInput): PDFStatementData {
  const items: PDFStatementItem[] = (input.items || []).map((it) => ({
    sNo: it.sNo,
    category: normalizeCategory(it.category),
    description: it.description || '—',
    calculation: buildCalculation(it.count, it.countAmount),
    total: Number(it.total) || 0,
    remarks: it.remarks || '—',
    fileName: it.billFileName || undefined,
    hasBill: Boolean(it.billUrl),
    billUrl: it.billUrl,
  }));

  const attachedBills: PDFAttachedBill[] = (input.attachedBills || [])
    .filter((b) => b.url)
    .map((b, idx) => ({
      id: b.id || `bill-${idx}`,
      title: b.title || 'Untitled receipt',
      category: b.category || 'Receipt',
      amount: Number(b.amount) || 0,
      url: b.url!,
      fileName: b.fileName || 'Receipt.jpg',
    }));

  const generatedAt =
    input.generatedAt ||
    new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const auditRef =
    input.auditRef ||
    `TQI-${(input.clusterName || 'CLUSTER')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 8)}-${(input.date || '')
      .replace(/[^0-9]+/g, '')
      .slice(0, 8)}`;

  return {
    cluster: input.clusterName || 'Cluster',
    college: input.collegeName || 'College',
    session: input.sessionName || 'Finance Statement',
    sessionDay: input.sessionDay || '—',
    date: input.date || '—',
    status: input.status || 'Draft',
    spoc: input.spocName || '—',
    spocRole: input.spocRole,
    financer: input.financerName || '—',
    auditRef,
    academicYear: input.academicYear || 'Academic Year 2026 – 2027',
    items,
    totals: {
      travel: Number(input.travelTotal) || 0,
      food: Number(input.foodTotal) || 0,
      stationery: Number(input.stationeryTotal) || 0,
      other: Number(input.otherTotal) || 0,
      grand: Number(input.grandTotal) || 0,
    },
    generatedAt,
    logoSrc: input.logoSrc || DEFAULT_LOGO_SRC,
    attachedBills,
  };
}

function normalizeCategory(
  raw: string,
): 'Travel' | 'Food' | 'Stationery' | 'Other' {
  const c = (raw || '').toLowerCase();
  if (c === 'travel') return 'Travel';
  if (c === 'food') return 'Food';
  if (c === 'stationery' || c === 'materials') return 'Stationery';
  return 'Other';
}

function buildCalculation(
  count: string | number | undefined,
  countAmount: string | undefined,
): string {
  if (count && countAmount && String(count) !== '—') {
    return `${count} × ${String(countAmount).replace(/^×\s*/, '')}`;
  }
  if (countAmount && String(countAmount) !== '—') {
    return String(countAmount);
  }
  return '—';
}
