import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface VolunteerDirectoryRow {
  name: string;
  department: string;
  year: string;
  college: string;
  contact: string;
  email: string;
}

export interface VolunteerDirectoryPdfData {
  academicYear: string;
  logoDataUrl?: string;
  volunteers: VolunteerDirectoryRow[];
}

const PAGE_WIDTH = 595.28;
const PAGE_PADDING = 24;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_PADDING * 2;
const COLUMN_WIDTHS = [28, 82, 102, 34, 100, 74, CONTENT_WIDTH - 28 - 82 - 102 - 34 - 100 - 74];
const BORDER = '#1F2937';

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: PAGE_PADDING,
    fontFamily: 'Helvetica',
    color: '#172033',
    fontSize: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 68,
    borderBottomWidth: 1,
    borderBottomColor: '#64748B',
    marginBottom: 18,
    paddingBottom: 10,
  },
  logo: { width: 48, height: 48, objectFit: 'contain', position: 'absolute', left: 0, top: 0 },
  branding: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 54 },
  organization: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#153B78', textAlign: 'center' },
  reportTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 6, textAlign: 'center' },
  academicYear: { fontSize: 9, color: '#475569', marginTop: 4, textAlign: 'center' },
  table: { width: '100%', borderTopWidth: 1, borderLeftWidth: 1, borderColor: BORDER },
  tableRow: { flexDirection: 'row', minHeight: 26, borderBottomWidth: 1, borderColor: BORDER },
  headerRow: { flexDirection: 'row', minHeight: 30, backgroundColor: '#1F4E79', borderBottomWidth: 1, borderColor: BORDER },
  cell: { justifyContent: 'center', borderRightWidth: 1, borderColor: BORDER, paddingVertical: 5, paddingHorizontal: 4 },
  headerCell: { justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderColor: BORDER, paddingVertical: 5, paddingHorizontal: 3 },
  headerText: { color: '#FFFFFF', fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  cellText: { fontSize: 7.5, lineHeight: 1.2 },
  serialText: { fontSize: 7.5, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 12, left: PAGE_PADDING, right: PAGE_PADDING, textAlign: 'right', fontSize: 8, color: '#64748B' },
});

const columns = ['S.No', 'Volunteer Name', 'Department', 'Year', 'College', 'Contact', 'Email'];

export const VolunteerDirectoryPdf: React.FC<{ data: VolunteerDirectoryPdfData }> = ({ data }) => (
  <Document title={`Volunteers Details — ${data.academicYear}`}>
    <Page size="A4" orientation="portrait" style={styles.page} wrap>
      <View style={styles.header}>
        {data.logoDataUrl ? <Image src={data.logoDataUrl} style={styles.logo} /> : null}
        <View style={styles.branding}>
          <Text style={styles.organization}>TALENT QUEST FOR INDIA</Text>
          <Text style={styles.reportTitle}>Volunteers Details</Text>
          <Text style={styles.academicYear}>Academic Year: {data.academicYear}</Text>
        </View>
      </View>
      <View style={styles.table}>
        <View style={styles.headerRow} fixed>
          {columns.map((column, index) => (
            <View key={column} style={[styles.headerCell, { width: COLUMN_WIDTHS[index] }]}>
              <Text style={styles.headerText}>{column}</Text>
            </View>
          ))}
        </View>
        {data.volunteers.map((volunteer, rowIndex) => {
          const cells = [String(rowIndex + 1), volunteer.name, volunteer.department, volunteer.year, volunteer.college, volunteer.contact, volunteer.email];
          return (
            <View key={`${volunteer.email}-${rowIndex}`} style={styles.tableRow} wrap={false}>
              {cells.map((value, index) => (
                <View key={`${index}-${value}`} style={[styles.cell, { width: COLUMN_WIDTHS[index] }]}>
                  <Text style={index === 0 ? styles.serialText : styles.cellText}>{value || '—'}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </View>
      <Text
        style={styles.footer}
        fixed
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </Page>
  </Document>
);
