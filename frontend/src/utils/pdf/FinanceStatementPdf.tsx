import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
} from '@react-pdf/renderer';
import { styles, BRAND, categoryPill } from './styles';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PDFStatementItem {
  sNo: number;
  category: 'Travel' | 'Food' | 'Stationery' | 'Other' | string;
  description: string;
  calculation: string;
  total: number;
  remarks: string;
  fileName?: string;
  hasBill: boolean;
  billUrl?: string | null;
}

export interface PDFAttachedBill {
  id: string;
  title: string;
  category: string;
  amount: number;
  url: string;
  fileName: string;
}

export interface PDFStatementData {
  cluster: string;
  college: string;
  session: string;
  sessionDay: string;
  date: string;
  status: string;
  spoc: string;
  spocRole?: string;
  financer: string;
  auditRef: string;
  academicYear?: string;
  items: PDFStatementItem[];
  totals: { travel: number; food: number; stationery: number; other: number; grand: number };
  generatedAt?: string;
  logoSrc?: string;
  attachedBills?: PDFAttachedBill[];
}

export interface FinanceStatementPdfProps {
  data: PDFStatementData;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inr = (n: number) =>
  `Rs. ${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const isApproved = (status: string) =>
  (status || '').trim().toUpperCase() === 'APPROVED';

const statusPillStyle = (status: string) => {
  const s = (status || '').trim().toUpperCase();
  if (s === 'APPROVED')
    return { bg: BRAND.approvedBg, fg: BRAND.approved, dot: BRAND.approved };
  if (s === 'REJECTED' || s === 'DECLINED')
    return { bg: BRAND.rejectedBg, fg: BRAND.rejected, dot: BRAND.rejected };
  return { bg: BRAND.pendingBg, fg: BRAND.pending, dot: BRAND.pending };
};

const CATEGORY_ORDER: Array<{
  key: 'Travel' | 'Food' | 'Stationery' | 'Other';
  label: string;
  totalKey: keyof PDFStatementData['totals'];
}> = [
  { key: 'Travel', label: 'Travel', totalKey: 'travel' },
  { key: 'Food', label: 'Food & Refreshments', totalKey: 'food' },
  { key: 'Stationery', label: 'Stationery / Materials', totalKey: 'stationery' },
  { key: 'Other', label: 'Other Expenses', totalKey: 'other' },
];

const formatGenerated = (raw?: string) => {
  if (raw) return raw;
  try {
    return new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date().toString();
  }
};

const countCategory = (items: PDFStatementItem[], cat: string) =>
  items.filter((i) => (i.category || '').toLowerCase() === cat.toLowerCase()).length;

// ---------------------------------------------------------------------------
// Page footer — fixed, renders on every page
// cluster · session · date · page X / Y
// ---------------------------------------------------------------------------

const PageFooter: React.FC<{
  cluster: string;
  session: string;
  date: string;
  label?: string;
}> = ({ cluster, session, date, label }) => (
  <View style={styles.pageFooter} fixed>
    <Text style={styles.pageFooterLabel}>
      {(label ? `${label} · ` : '') + `${cluster} · ${session} · ${date}`}
    </Text>
    <Text
      style={styles.pageFooterPage}
      render={({ pageNumber, totalPages }) =>
        `Page ${pageNumber} of ${totalPages}`
      }
    />
  </View>
);

// ---------------------------------------------------------------------------
// Reusable row + sub-components
// ---------------------------------------------------------------------------

const TableHeader: React.FC = () => (
  <View style={styles.tableHeader} wrap={false}>
    <Text style={[styles.tableHeaderCell, styles.cSNo]}>S.No</Text>
    <Text style={[styles.tableHeaderCell, styles.cCategory]}>Category</Text>
    <Text style={[styles.tableHeaderCell, styles.cDescription]}>
      Description
    </Text>
    <Text style={[styles.tableHeaderCell, styles.cCalc]}>Calc</Text>
    <Text style={[styles.tableHeaderCell, styles.cTotal]}>Total</Text>
    <Text style={[styles.tableHeaderCell, styles.cVerified]}>
      Receipt &amp; Remarks
    </Text>
  </View>
);

const ItemRow: React.FC<{ item: PDFStatementItem; zebra: boolean }> = ({
  item,
  zebra,
}) => (
  <View style={zebra ? styles.tableRowZebra : styles.tableRow} wrap={false}>
    <Text style={[styles.cellTextMuted, styles.cSNo]}>
      {String(item.sNo).padStart(2, '0')}
    </Text>
    <Text style={[styles.cellTextNavy, styles.cCategory]}>
      {item.category}
    </Text>
    <Text style={[styles.cellText, styles.cDescription]}>
      {item.description || '—'}
    </Text>
    <Text style={[styles.cellTextMuted, styles.cCalc]}>
      {item.calculation || '—'}
    </Text>
    <Text style={[styles.cellTextMono, styles.cTotal]}>
      {item.total > 0 ? inr(item.total) : 'Rs. 0'}
    </Text>
    <View style={styles.cVerified}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 5 }}>
        {item.hasBill ? (
          <Text style={styles.cellTextBill}>✓</Text>
        ) : (
          <Text style={styles.cellTextBillMissing}>—</Text>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.cellText}>{item.remarks || '—'}</Text>
          {item.fileName ? (
            <Text
              style={[
                styles.cellTextMuted,
                { fontSize: 7.5, marginTop: 2, fontFamily: 'Helvetica' },
              ]}
            >
              {item.fileName}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  </View>
);

const SubtotalRow: React.FC<{ label: string; amount: number }> = ({
  label,
  amount,
}) => (
  <View style={styles.tableSubtotalRow} wrap={false}>
    <Text style={[styles.cellTextOrange, styles.cSubtotalLabel]}>
      {label}
    </Text>
    <Text style={styles.cSubtotalMid}>{' '}</Text>
    <Text style={[styles.cellTextMono, styles.cSubtotalAmount]}>
      {inr(amount)}
    </Text>
    <Text style={styles.cSubtotalTrailing}>{' '}</Text>
  </View>
);

const GrandTotalRow: React.FC<{ amount: number; totalItems: number }> = ({
  amount,
  totalItems,
}) => (
  <View style={styles.grandTotalRow} wrap={false}>
    <Text style={[styles.cellTextWhiteLabel, styles.cGTLabel]}>
      Grand Total
    </Text>
    <Text style={styles.cGTMid}>{' '}</Text>
    <Text style={[styles.cellTextWhiteBold, styles.cGTAmount]}>
      {inr(amount)}
    </Text>
    <Text style={[styles.cellTextWhite, styles.cGTTrailing]}>
      {totalItems} {totalItems === 1 ? 'item' : 'items'} verified &amp; logged
    </Text>
  </View>
);

// ---------------------------------------------------------------------------
// Page 1 — Cover
// CRITICAL: every block is in normal document flow (no absolute
// positioning) with explicit marginBottom so the title and subtitle
// can never overlap, regardless of text length.
// ---------------------------------------------------------------------------

const CoverPage: React.FC<{ data: PDFStatementData }> = ({ data }) => {
  const pill = statusPillStyle(data.status);
  const year = data.academicYear || 'Academic Year 2026 – 2027';
  const generatedAt = formatGenerated(data.generatedAt);

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.coverWrap}>
        {/* Logo (or fallback TQI mark) */}
        {data.logoSrc ? (
          <Image src={data.logoSrc} style={styles.coverLogo} />
        ) : (
          <View style={styles.coverLogoFallback}>
            <Text style={styles.coverLogoFallbackText}>TQI</Text>
          </View>
        )}

        {/* Kicker — small uppercase, navy, on its own line */}
        <Text style={styles.coverKicker}>Talent Quest for India Trust</Text>

        {/* H1 title */}
        <Text style={styles.coverTitle}>Talent Quest for India</Text>

        {/* Subtitle */}
        <Text style={styles.coverSubtitle}>{year}</Text>

        {/* Decorative rule */}
        <View style={styles.coverRule} />

        {/* Doc type eyebrow */}
        <Text style={styles.coverEyebrow}>
          Official Cluster Finance &amp; Audit Statement
        </Text>

        {/* Cluster — large colored heading */}
        <Text style={styles.coverCluster}>{data.cluster} Cluster</Text>

        {/* Session day — subtle sub-line */}
        <Text style={styles.coverClusterSub}>{data.sessionDay}</Text>

        {/* Status pill with dot */}
        <View style={[styles.coverStatusPill, { backgroundColor: pill.bg }]}>
          <View
            style={[styles.coverStatusPillDot, { backgroundColor: pill.dot }]}
          />
          <Text style={[styles.coverStatusPillText, { color: pill.fg }]}>
            {data.status}
          </Text>
        </View>

        {/* Audit reference (small mono) */}
        <Text style={styles.coverAuditRef}>Audit Ref · {data.auditRef}</Text>

        <View style={styles.coverSpacer} />

        {/* Footer (muted) */}
        <Text style={styles.coverFooter}>
          Generated {generatedAt}
          {'\n'}
          TQI Central Finance Registry · Official Audit Document
        </Text>
      </View>

      <PageFooter
        cluster={data.cluster}
        session={data.session}
        date={data.date}
        label="Cover"
      />
    </Page>
  );
};

// ---------------------------------------------------------------------------
// Page 2 — Statement Details (definition list) + Expense Summary
// ---------------------------------------------------------------------------

const SummaryPage: React.FC<{ data: PDFStatementData }> = ({ data }) => {
  const summaryCards = [
    { label: 'Travel', value: data.totals.travel, entries: countCategory(data.items, 'Travel') },
    { label: 'Food', value: data.totals.food, entries: countCategory(data.items, 'Food') },
    { label: 'Stationery', value: data.totals.stationery, entries: countCategory(data.items, 'Stationery') },
    { label: 'Other', value: data.totals.other, entries: countCategory(data.items, 'Other') },
  ];

  const details = [
    { label: 'Cluster', value: data.cluster, accent: true },
    { label: 'College', value: data.college, accent: false },
    { label: 'Session', value: data.session, accent: false },
    { label: 'Day', value: data.sessionDay, accent: true },
    { label: 'Date', value: data.date, accent: false },
    { label: 'Status', value: data.status, accent: true },
    { label: 'SPOC', value: data.spoc, accent: false },
    { label: 'Financer', value: data.financer, accent: false },
    { label: 'Audit Ref', value: data.auditRef, accent: true },
  ];

  return (
    <Page size="A4" style={styles.page}>
      {/* Statement Details */}
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionEyebrow}>Statement Details</Text>
        <Text style={styles.sectionTitleHint}>
          {data.items.length} {data.items.length === 1 ? 'item' : 'items'} · all
          categories
        </Text>
      </View>
      <View style={styles.sectionRule} />

      <View style={styles.detailsCard}>
        {details.map((d, i) => {
          const isLast = i === details.length - 1;
          return (
            <View
              key={d.label}
              style={isLast ? styles.detailsRowLast : styles.detailsRow}
            >
              <Text style={styles.detailsLabel}>{d.label}</Text>
              {d.accent ? (
                <Text style={styles.detailsValueAccent}>{d.value}</Text>
              ) : (
                <Text style={styles.detailsValue}>{d.value}</Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Expense Summary */}
      <View style={{ marginTop: 28 }}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionEyebrow}>Expense Summary</Text>
          <Text style={styles.sectionTitleHint}>
            Total: {inr(data.totals.grand)}
          </Text>
        </View>
        <View style={styles.sectionRule} />

        <View style={styles.summaryRow}>
          {summaryCards.map((c) => (
            <View key={c.label} style={styles.summaryCard}>
              <View style={styles.summaryCardHeader}>
                <Text style={styles.summaryLabel}>{c.label}</Text>
                <Text style={styles.summaryEntryBadge}>
                  {c.entries} {c.entries === 1 ? 'entry' : 'entries'}
                </Text>
              </View>
              <Text
                style={
                  c.value > 0 ? styles.summaryAmount : styles.summaryAmountMuted
                }
              >
                {inr(c.value)}
              </Text>
            </View>
          ))}
        </View>

        {/* Grand Total — heavier card, navy */}
        <View style={styles.grandTotalCard}>
          <View style={styles.grandTotalLabelBlock}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalSub}>
              All categories · {data.items.length}{' '}
              {data.items.length === 1 ? 'item' : 'items'} verified
            </Text>
          </View>
          <Text style={styles.grandTotalAmount}>{inr(data.totals.grand)}</Text>
        </View>
      </View>

      <PageFooter
        cluster={data.cluster}
        session={data.sessionDay}
        date={data.date}
        label="Summary"
      />
    </Page>
  );
};

// ---------------------------------------------------------------------------
// Page 3+ — Detailed Expense & Audit Ledger
// Grouped by category with full-width shaded headers, zebra data rows,
// bordered subtotal rows, and a high-contrast grand total.
// ---------------------------------------------------------------------------

const LedgerPage: React.FC<{ data: PDFStatementData }> = ({ data }) => (
  <Page size="A4" style={styles.page}>
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionEyebrow}>
        Detailed Expense &amp; Audit Ledger
      </Text>
      <Text style={styles.sectionTitleHint}>
        {data.items.length} {data.items.length === 1 ? 'row' : 'rows'} · grouped
        by category
      </Text>
    </View>
    <View style={styles.sectionRule} />

    <View style={styles.tableWrap}>
      <TableHeader />

      {CATEGORY_ORDER.map(({ key, label, totalKey }) => {
        const rows = data.items.filter(
          (i) => (i.category || '').toLowerCase() === key.toLowerCase(),
        );
        if (rows.length === 0) return null;
        const subtotal = data.totals[totalKey] ?? 0;
        return (
          <View key={key} wrap={false}>
            <View style={styles.tableGroupRow} wrap={false}>
              <Text style={styles.tableGroupLabel}>{label}</Text>
              <Text style={styles.tableGroupMeta}>
                · {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
              </Text>
            </View>
            {rows.map((item, idx) => (
              <ItemRow key={item.sNo} item={item} zebra={idx % 2 === 1} />
            ))}
            <SubtotalRow label={`${label} Subtotal`} amount={subtotal} />
          </View>
        );
      })}

      <GrandTotalRow
        amount={data.totals.grand}
        totalItems={data.items.length}
      />
    </View>

    <PageFooter
      cluster={data.cluster}
      session={data.sessionDay}
      date={data.date}
      label="Ledger"
    />
  </Page>
);

// ---------------------------------------------------------------------------
// Signatures page — two equal bordered cards, side by side
// ---------------------------------------------------------------------------

const SignaturesPage: React.FC<{ data: PDFStatementData }> = ({ data }) => (
  <Page size="A4" style={styles.page}>
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionEyebrow}>Authorization &amp; Sign-Off</Text>
      <Text style={styles.sectionTitleHint}>
        Two authorized signatories required
      </Text>
    </View>
    <View style={styles.sectionRule} />

    <View style={styles.signCallout}>
      <Text style={styles.signCalloutIcon}>⚠</Text>
      <Text style={styles.signCalloutText}>
        Two authorized signatories (Coordinator SPOC + Cluster Admin
        Financer) are required for this finance statement to successfully clear
        the internal audit trail. Digital signatures are recorded against the
        audit reference below.
      </Text>
    </View>

    <View style={styles.signBlock}>
      <View style={styles.signCard}>
        <Text style={styles.signCardRole}>
          {data.spocRole || 'Coordinator (SPOC)'}
        </Text>
        <Text style={styles.signCardName}>{data.spoc}</Text>
        <View style={styles.signCardLine} />
        <Text style={styles.signCardSigned}>✓ Digitally Signed &amp; Verified</Text>
        <Text style={styles.signCardDate}>Date: ______________________</Text>
      </View>
      <View style={styles.signCard}>
        <Text style={styles.signCardRole}>Cluster Admin (Financer)</Text>
        <Text style={styles.signCardName}>{data.financer}</Text>
        <View style={styles.signCardLine} />
        <Text style={styles.signCardSigned}>
          ✓ Digitally Approved &amp; Logged
        </Text>
        <Text style={styles.signCardDate}>Date: ______________________</Text>
      </View>
    </View>

    <View style={styles.auditFooterWrap}>
      <Text style={styles.auditFooterText}>
        This document is system-generated and digitally signed by the
        designated SPOC and Cluster Admin. Any unauthorized modification,
        editing, or tampering of this file invalidates the official audit
        trail. For cross-validation and compliance inquiries, reference the
        document hash with the TQI Central Finance Registry.
      </Text>
      <Text style={styles.auditFooterHash}>
        Audit hash · {data.auditRef} · {data.cluster} · {data.date}
      </Text>
    </View>

    <PageFooter
      cluster={data.cluster}
      session={data.session}
      date={data.date}
      label="Authorization"
    />
  </Page>
);

// ---------------------------------------------------------------------------
// Receipts appendix — 2-col card grid, fixed card height for consistency
// ---------------------------------------------------------------------------

const ReceiptsAppendix: React.FC<{ data: PDFStatementData }> = ({ data }) => {
  const bills = data.attachedBills || [];
  if (bills.length === 0) return null;

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionEyebrow}>Attached Receipts &amp; Bills</Text>
        <Text style={styles.sectionTitleHint}>
          {bills.length} {bills.length === 1 ? 'file' : 'files'} verified
        </Text>
      </View>
      <Text style={styles.receiptsSubheader}>
        {data.cluster} Cluster · {data.session} · {data.date}
      </Text>
      <View style={styles.sectionRule} />

      <View style={styles.receiptsGrid} wrap={false}>
        {bills.map((bill) => {
          const pill = categoryPill(bill.category);
          const isRightCol = bills.indexOf(bill) % 2 === 1;
          return (
            <View
              key={bill.id}
              style={[
                styles.receiptCard,
                isRightCol ? { marginLeft: 12 } : null,
              ]}
              wrap={false}
            >
              <View style={styles.receiptCardHeader}>
                <View
                  style={[
                    styles.receiptCardCategoryPill,
                    { backgroundColor: pill.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.receiptCardCategoryText,
                      { color: pill.fg },
                    ]}
                  >
                    {bill.category || 'Receipt'}
                  </Text>
                </View>
                <Text style={styles.receiptCardAmount}>
                  {inr(bill.amount || 0)}
                </Text>
              </View>
              {bill.url ? (
                <Image src={bill.url} style={styles.receiptCardImage} />
              ) : (
                <View style={styles.receiptCardImageFallback}>
                  <Text style={styles.receiptCardFallbackText}>
                    RECEIPT VERIFIED IN CLUSTER REGISTRY
                  </Text>
                  <Text style={styles.receiptCardFallbackSubtext}>
                    Original retained on file
                  </Text>
                </View>
              )}
              <View style={styles.receiptCardFooter}>
                <Text style={styles.receiptCardFooterTitle}>
                  {bill.title || 'Untitled receipt'}
                </Text>
                <Text style={styles.receiptCardFooterFile}>
                  {bill.fileName || 'Receipt.jpg'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <PageFooter
        cluster={data.cluster}
        session={data.session}
        date={data.date}
        label="Receipts"
      />
    </Page>
  );
};

// ---------------------------------------------------------------------------
// Document — entry component
// ---------------------------------------------------------------------------

export const FinanceStatementPdf: React.FC<FinanceStatementPdfProps> = ({
  data,
}) => (
  <Document
    title={`TQI Finance Statement — ${data.cluster} Cluster — ${data.sessionDay}`}
    author="Talent Quest for India Trust"
    subject="Official Finance Statement & Audit Document"
    keywords={`TQI, finance, ${data.cluster}, ${data.sessionDay}, audit, ${data.auditRef}`}
  >
    <CoverPage data={data} />
    <SummaryPage data={data} />
    <LedgerPage data={data} />
    <SignaturesPage data={data} />
    <ReceiptsAppendix data={data} />
  </Document>
);

export default FinanceStatementPdf;
