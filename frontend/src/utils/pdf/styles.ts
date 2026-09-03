// Browser polyfill: `@react-pdf/renderer` references Node's `Buffer`
// at runtime. Attach the polyfilled Buffer to `globalThis` so the
// library can find it. Vite aliases `buffer` to the npm package and
// injects `globalThis.Buffer` via `define` in vite.config.ts.
import { Buffer } from 'buffer';
if (typeof (globalThis as { Buffer?: unknown }).Buffer === 'undefined') {
  (globalThis as { Buffer: typeof Buffer }).Buffer = Buffer;
}

import { Font, StyleSheet } from '@react-pdf/renderer';

/**
 * TQI Finance Statement — PDF design system & style sheet.
 *
 * Page: A4 portrait (595 × 842 pt). Side margin 32pt, content width 531pt.
 *
 * Design system (per the redesign brief):
 *   - Type: Helvetica (built-in PDF font — no network fetch, always works)
 *   - Scale: H1 28pt / H2 15pt semibold / Body 11pt / Table 10pt / Meta 8.5pt
 *   - Colors: Navy #1B3A5C primary, Teal #2A9D8F + Orange #E07A32 accents,
 *     Green #2E7D46 status, neutral grays for borders & zebra
 *   - Spacing: 8pt grid
 *   - Cards: 8pt border-radius, 1pt border, subtle shadow
 *
 * Column grid (sums to exactly 531pt — content width):
 *   S.No 26 | Category 60 | Description 155 | Calc 50 | Total 64 | Verified 176
 *   = 531pt
 */

// ─────────────────────────────────────────────────────────────────
// Font registration
// Helvetica and Helvetica-Bold are built-in PDF base 14 fonts that
// `@react-pdf/renderer` ships pre-registered — no Font.register call
// needed, no network fetch, no risk of an "Unknown font format" error.
// To restore Inter typography later, drop the OTF files into
// /public/fonts/ and uncomment the Font.register block below.
// ─────────────────────────────────────────────────────────────────
//
// Font.register({
//   family: 'Inter',
//   fonts: [
//     { src: '/fonts/Inter-Regular.otf', fontWeight: 400 },
//     { src: '/fonts/Inter-Medium.otf', fontWeight: 500 },
//     { src: '/fonts/Inter-SemiBold.otf', fontWeight: 600 },
//     { src: '/fonts/Inter-Bold.otf', fontWeight: 700 },
//   ],
// });

// Disable hyphenation so amounts/identifiers never break across lines.
Font.registerHyphenationCallback((word) => [word]);

// ─────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────

export const BRAND = {
  // Primary
  navy: '#1B3A5C',
  navyDeep: '#0F2741',
  // Accents
  teal: '#2A9D8F',
  orange: '#E07A32',
  // Status
  approved: '#2E7D46',
  approvedBg: '#E6F4EA',
  pending: '#B45309',
  pendingBg: '#FEF3C7',
  rejected: '#B91C1C',
  rejectedBg: '#FEE2E2',
  // Neutrals
  ink: '#1F2937',
  body: '#374151',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  zebra: '#F9FAFB',
  surface: '#FFFFFF',
  // Tints
  navyTint: '#EEF2F7',
  tealTint: '#E6F4F1',
  orangeTint: '#FBEFE4',
} as const;

export const PAGE = {
  width: 595,
  height: 842,
  marginX: 32,
  marginY: 36,
  contentWidth: 531,
  bottomReserve: 36,
} as const;

// Ledger column widths — single source of truth.
export const COL = {
  sNo: 26,
  category: 60,
  description: 155,
  calc: 50,
  total: 64,
  verified: 176,
} as const;

const _colSumCheck =
  COL.sNo + COL.category + COL.description + COL.calc + COL.total + COL.verified;
// eslint-disable-next-line no-console
if (_colSumCheck !== PAGE.contentWidth) {
  console.warn(
    `[pdf/styles] Ledger column widths sum to ${_colSumCheck} pt, expected ${PAGE.contentWidth} pt`,
  );
}

// ─────────────────────────────────────────────────────────────────
// StyleSheet
// ─────────────────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  // ──────── Page chrome ────────
  page: {
    paddingHorizontal: PAGE.marginX,
    paddingTop: PAGE.marginY,
    paddingBottom: PAGE.bottomReserve,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: BRAND.ink,
    backgroundColor: BRAND.surface,
    lineHeight: 1.4,
  },

  // ──────── Cover page ────────
  coverWrap: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 56,
  },
  coverLogo: {
    width: 84,
    height: 84,
    marginBottom: 28,
    objectFit: 'contain',
  },
  coverLogoFallback: {
    width: 84,
    height: 84,
    marginBottom: 28,
    borderRadius: 42,
    backgroundColor: BRAND.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverLogoFallbackText: {
    color: BRAND.surface,
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -0.5,
  },
  coverKicker: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.navy,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.ink,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  coverSubtitle: {
    fontSize: 11.5,
    fontFamily: 'Helvetica',
    color: BRAND.muted,
    textAlign: 'center',
    marginBottom: 36,
  },
  coverRule: {
    width: 56,
    height: 1.4,
    backgroundColor: BRAND.navy,
    marginBottom: 28,
  },
  coverEyebrow: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.navy,
    letterSpacing: 3.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  coverCluster: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.orange,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  coverClusterSub: {
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: BRAND.muted,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 24,
  },
  coverStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 999,
    marginBottom: 6,
    gap: 6,
  },
  coverStatusPillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  coverStatusPillText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  coverAuditRef: {
    fontSize: 8.5,
    color: BRAND.muted,
    fontFamily: 'Helvetica',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  coverSpacer: { flex: 1 },
  coverFooter: {
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    color: BRAND.muted,
    textAlign: 'center',
    letterSpacing: 0.4,
    lineHeight: 1.5,
  },

  // ──────── Section eyebrow ────────
  sectionEyebrow: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.navy,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  sectionTitleHint: {
    fontSize: 8.5,
    color: BRAND.muted,
    fontFamily: 'Helvetica',
  },
  sectionRule: {
    height: 1,
    backgroundColor: BRAND.border,
    marginBottom: 16,
  },

  // ──────── Statement details (definition list) ────────
  detailsCard: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    backgroundColor: BRAND.surface,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  detailsRowLast: {
    flexDirection: 'row',
    paddingVertical: 9,
    // no border on the last row
  },
  detailsLabel: {
    width: '32%',
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.navy,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    paddingTop: 1,
  },
  detailsValue: {
    width: '68%',
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: BRAND.ink,
  },
  detailsValueAccent: {
    width: '68%',
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.navy,
  },

  // ──────── Summary stat cards ────────
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: BRAND.surface,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.navy,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  summaryEntryBadge: {
    fontSize: 7.5,
    fontFamily: 'Helvetica',
    color: BRAND.muted,
    backgroundColor: BRAND.zebra,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 999,
  },
  summaryAmount: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.ink,
    letterSpacing: -0.2,
  },
  summaryAmountMuted: {
    fontSize: 15,
    fontFamily: 'Helvetica',
    color: BRAND.faint,
    letterSpacing: -0.2,
  },
  // Grand Total — separate, heavier card
  grandTotalCard: {
    backgroundColor: BRAND.navy,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  grandTotalLabelBlock: {
    flexDirection: 'column',
  },
  grandTotalLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.surface,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  grandTotalSub: {
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    color: '#B7C4D6',
    marginTop: 3,
  },
  grandTotalAmount: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.surface,
    letterSpacing: -0.3,
  },

  // ──────── Ledger table ────────
  tableWrap: {
    marginTop: 4,
  },
  // Group section header row (Travel / Food / ...)
  tableGroupRow: {
    flexDirection: 'row',
    backgroundColor: BRAND.navyTint,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BRAND.border,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  tableGroupLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.navy,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  tableGroupMeta: {
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    color: BRAND.muted,
    marginLeft: 8,
  },
  // Header row (column titles)
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND.navy,
    paddingVertical: 8,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.surface,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // Body row
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.6,
    borderBottomColor: BRAND.border,
    paddingVertical: 7,
  },
  tableRowZebra: {
    flexDirection: 'row',
    backgroundColor: BRAND.zebra,
    borderBottomWidth: 0.6,
    borderBottomColor: BRAND.border,
    paddingVertical: 7,
  },
  // Subtotal row
  tableSubtotalRow: {
    flexDirection: 'row',
    backgroundColor: BRAND.navyTint,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    paddingVertical: 8,
  },
  // Grand total row (navy)
  grandTotalRow: {
    flexDirection: 'row',
    backgroundColor: BRAND.navy,
    paddingVertical: 11,
  },

  // ──────── Cell text variants ────────
  cellText: { fontSize: 9.5, color: BRAND.ink, fontFamily: 'Helvetica' },
  cellTextMuted: { fontSize: 8.5, color: BRAND.muted, fontFamily: 'Helvetica' },
  cellTextNavy: { fontSize: 9.5, color: BRAND.navy, fontFamily: 'Helvetica-Bold' },
  cellTextOrange: { fontSize: 9.5, color: BRAND.orange, fontFamily: 'Helvetica-Bold' },
  cellTextMono: { fontSize: 10, color: BRAND.ink, fontFamily: 'Helvetica-Bold' },
  cellTextWhite: { fontSize: 9.5, color: BRAND.surface, fontFamily: 'Helvetica' },
  cellTextWhiteBold: { fontSize: 9.5, color: BRAND.surface, fontFamily: 'Helvetica-Bold' },
  cellTextWhiteLabel: {
    fontSize: 10,
    color: BRAND.surface,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  cellTextBill: {
    fontSize: 11,
    color: BRAND.approved,
    fontFamily: 'Helvetica-Bold',
  },
  cellTextBillMissing: {
    fontSize: 9,
    color: BRAND.faint,
    fontFamily: 'Helvetica',
  },

  // ──────── Cell alignment (width + textAlign + padding) ────────
  cSNo: { width: COL.sNo, textAlign: 'center', paddingHorizontal: 2 },
  cCategory: { width: COL.category, paddingHorizontal: 6 },
  cDescription: { width: COL.description, paddingHorizontal: 4 },
  cCalc: { width: COL.calc, textAlign: 'center', paddingHorizontal: 2 },
  cTotal: { width: COL.total, textAlign: 'right', paddingLeft: 4, paddingRight: 6 },
  cVerified: { width: COL.verified, paddingHorizontal: 4 },

  // Subtotal / grand-total spanning helpers
  cSubtotalLabel: {
    width: COL.sNo + COL.category + COL.description,
    textAlign: 'right',
    paddingLeft: 4,
    paddingRight: 8,
  },
  cSubtotalMid: { width: COL.calc },
  cSubtotalAmount: {
    width: COL.total,
    textAlign: 'right',
    paddingLeft: 4,
    paddingRight: 6,
  },
  cSubtotalTrailing: { width: COL.verified },
  cGTLabel: {
    width: COL.sNo + COL.category + COL.description,
    textAlign: 'right',
    paddingLeft: 4,
    paddingRight: 8,
  },
  cGTMid: { width: COL.calc },
  cGTAmount: {
    width: COL.total,
    textAlign: 'right',
    paddingLeft: 4,
    paddingRight: 6,
  },
  cGTTrailing: { width: COL.verified, paddingHorizontal: 4 },

  // ──────── Signatures page ────────
  signCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: BRAND.pendingBg,
    borderLeftWidth: 3,
    borderLeftColor: BRAND.pending,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 28,
    borderRadius: 4,
  },
  signCalloutIcon: {
    fontSize: 14,
    color: BRAND.pending,
    fontFamily: 'Helvetica-Bold',
    width: 18,
  },
  signCalloutText: {
    fontSize: 9.5,
    color: BRAND.pending,
    fontFamily: 'Helvetica',
    lineHeight: 1.55,
    flex: 1,
  },
  signBlock: {
    flexDirection: 'row',
    gap: 16,
  },
  signCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: BRAND.surface,
  },
  signCardRole: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.navy,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  signCardName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.ink,
    marginBottom: 16,
  },
  signCardLine: {
    height: 32,
    borderTopWidth: 1.2,
    borderTopColor: BRAND.ink,
    marginBottom: 4,
  },
  signCardSigned: {
    fontSize: 8.5,
    color: BRAND.approved,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
  },
  signCardDate: {
    fontSize: 9,
    color: BRAND.muted,
    fontFamily: 'Helvetica',
  },
  auditFooterWrap: {
    marginTop: 32,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
  },
  auditFooterText: {
    fontSize: 8,
    color: BRAND.muted,
    textAlign: 'center',
    lineHeight: 1.55,
    fontFamily: 'Helvetica',
  },
  auditFooterHash: {
    fontSize: 7.5,
    color: BRAND.navy,
    fontFamily: 'Helvetica',
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.6,
    backgroundColor: BRAND.navyTint,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },

  // ──────── Receipts appendix (2-col grid, fixed card height) ────────
  receiptsSubheader: {
    fontSize: 10,
    color: BRAND.body,
    fontFamily: 'Helvetica',
    marginTop: 4,
    marginBottom: 16,
  },
  receiptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  receiptCard: {
    width: (PAGE.contentWidth - 12) / 2,
    height: 220,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: BRAND.surface,
    overflow: 'hidden',
  },
  receiptCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  receiptCardCategoryPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  receiptCardCategoryText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  receiptCardAmount: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.ink,
  },
  receiptCardImage: {
    width: '100%',
    height: 124,
    backgroundColor: BRAND.zebra,
    objectFit: 'contain',
  },
  receiptCardImageFallback: {
    width: '100%',
    height: 124,
    backgroundColor: BRAND.zebra,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  receiptCardFallbackText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.approved,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  receiptCardFallbackSubtext: {
    fontSize: 7,
    color: BRAND.muted,
    marginTop: 3,
    textAlign: 'center',
    fontFamily: 'Helvetica',
  },
  receiptCardFooter: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  receiptCardFooterTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.ink,
    marginBottom: 3,
  },
  receiptCardFooterFile: {
    fontSize: 7.5,
    color: BRAND.muted,
    fontFamily: 'Helvetica',
  },

  // ──────── Page footer (fixed, every page) ────────
  pageFooter: {
    position: 'absolute',
    left: PAGE.marginX,
    right: PAGE.marginX,
    bottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 0.6,
    borderTopColor: BRAND.border,
  },
  pageFooterLabel: {
    fontSize: 8,
    color: BRAND.muted,
    fontFamily: 'Helvetica',
    letterSpacing: 0.4,
  },
  pageFooterPage: {
    fontSize: 8,
    color: BRAND.muted,
    fontFamily: 'Helvetica',
    letterSpacing: 0.4,
  },
});

// Category pill colors for receipts (small accent, not large fill)
export const categoryPill = (cat: string) => {
  const c = (cat || '').toLowerCase();
  if (c === 'travel') return { bg: '#E0F2FE', fg: '#0369A1' }; // sky
  if (c === 'food') return { bg: '#FEF3C7', fg: '#92400E' }; // amber
  if (c === 'stationery' || c === 'materials')
    return { bg: '#EDE9FE', fg: '#6D28D9' }; // violet
  if (c === 'approved') return { bg: BRAND.approvedBg, fg: BRAND.approved };
  return { bg: BRAND.zebra, fg: BRAND.muted };
};
