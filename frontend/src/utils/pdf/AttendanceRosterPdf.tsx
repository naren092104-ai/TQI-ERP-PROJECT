import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface AttendanceDownloadRow {
  name: string;
  cluster?: string;
  panchayat?: string;
  standard?: string;
  role?: string;
  village: string;
  attendance: string;
  taskStatus?: string;
  day?: string;
  date?: string;
}

export interface AttendanceDownloadContext {
  kind: 'students' | 'volunteers';
  academicYear: string;
  cluster: string;
  panchayat: string;
  village: string;
  day: string;
  date: string;
  standard?: string;
  logoDataUrl?: string;
}

const styles = StyleSheet.create({
  page: { paddingTop: 24, paddingBottom: 34, paddingHorizontal: 28, fontFamily: 'Helvetica', color: '#172033', fontSize: 9 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 66, borderBottomWidth: 1, borderBottomColor: '#64748B', marginBottom: 14, paddingBottom: 10 },
  logo: { width: 46, height: 46, objectFit: 'contain', position: 'absolute', left: 0, top: 0 },
  brand: { alignItems: 'center', paddingHorizontal: 52 },
  organization: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#153B78', textAlign: 'center' },
  title: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 5, textAlign: 'center' },
  year: { fontSize: 9, color: '#475569', marginTop: 3, textAlign: 'center' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  metaItem: { width: '33.333%', minHeight: 25, justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 4, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#334155' },
  metaText: { fontSize: 8 },
  table: { borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#111827' },
  headerRow: { flexDirection: 'row', minHeight: 28, backgroundColor: '#1F4E79', borderBottomWidth: 1, borderColor: '#111827' },
  row: { flexDirection: 'row', minHeight: 27, borderBottomWidth: 1, borderColor: '#111827' },
  headerCell: { justifyContent: 'center', alignItems: 'center', padding: 4, borderRightWidth: 1, borderColor: '#111827' },
  cell: { justifyContent: 'center', padding: 5, borderRightWidth: 1, borderColor: '#111827' },
  headerText: { color: '#FFFFFF', fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  cellText: { fontSize: 8, lineHeight: 1.2 },
  centered: { textAlign: 'center' },
  footer: { position: 'absolute', bottom: 12, left: 28, right: 28, textAlign: 'right', fontSize: 8, color: '#64748B' },
});

export const AttendanceRosterPdf: React.FC<{ rows: AttendanceDownloadRow[]; context: AttendanceDownloadContext }> = ({ rows, context }) => {
  const isOverallVolunteerReport = context.kind === 'volunteers' && context.cluster === 'All Clusters';
  const isMultiDayReport = context.day === 'All Days';
  const fixedColumns = context.kind === 'students'
    ? isMultiDayReport
      ? [
          { title: 'S.No', width: 24 }, { title: 'Student Name', width: 76 }, { title: 'Std', width: 36 },
          { title: 'Cluster', width: 56 }, { title: 'Panchayat', width: 56 }, { title: 'Village', width: 56 },
          { title: 'Day', width: 34 }, { title: 'Date', width: 48 }, { title: 'Attendance', width: 62 }, { title: 'Task', width: 91 },
        ]
      : [
        { title: 'S.No', width: 25 },
        { title: 'Student Name', width: 91 },
        { title: 'Standard', width: 40 },
        { title: 'Cluster', width: 68 },
        { title: 'Panchayat', width: 68 },
        { title: 'Village', width: 68 },
        { title: 'Attendance', width: 70 },
        { title: 'Task Completion', width: 109 },
      ]
    : [];
  const measuredWidth = (heading: string, values: string[], minWidth: number, maxWidth: number) =>
    Math.min(maxWidth, Math.max(minWidth, ...[heading, ...values].map((value) => value.length * 4.2 + 12)));
  const volunteerColumns = context.kind === 'volunteers' ? [
    { title: 'S.No', width: 32 },
    { title: 'Volunteer Name', width: measuredWidth('Volunteer Name', rows.map((row) => row.name), 78, 155) },
    { title: 'Role', width: measuredWidth('Role', rows.map((row) => row.role || 'Volunteer'), 48, 100) },
    ...(isOverallVolunteerReport ? [{ title: 'Cluster', width: measuredWidth('Cluster', rows.map((row) => row.cluster || context.cluster), 65, 140) }] : []),
    ...(isMultiDayReport ? [
      { title: 'Day', width: measuredWidth('Day', rows.map((row) => row.day || 'All Days'), 38, 62) },
      { title: 'Date', width: measuredWidth('Date', rows.map((row) => row.date || '—'), 52, 82) },
    ] : []),
    { title: 'Attendance', width: measuredWidth('Attendance', rows.map((row) => row.attendance), 72, 96) },
  ] : [];
  const rawColumns = context.kind === 'students' ? fixedColumns : volunteerColumns;
  const rawTableWidth = rawColumns.reduce((sum, column) => sum + column.width, 0);
  const maxTableWidth = 539;
  const scale = rawTableWidth > maxTableWidth ? maxTableWidth / rawTableWidth : 1;
  const columns = rawColumns.map((column) => ({ ...column, width: column.width * scale }));
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const documentTitle = context.kind === 'students' ? 'Student Attendance Details' : 'Volunteer Attendance Details';
  const metaItems = context.kind === 'volunteers'
    ? [['Cluster', context.cluster], ['Day', context.day], ['Date', context.date]]
    : [
        ['Cluster', context.cluster],
        ['Panchayat', context.panchayat],
        ['Village', context.village],
        ['Day', context.day],
        ['Date', context.date],
        ['Standard', context.standard || 'All'],
      ];

  return (
    <Document title={`${documentTitle} — ${context.academicYear}`}>
      <Page size="A4" orientation="portrait" style={styles.page} wrap>
        <View style={styles.header} fixed>
          {context.logoDataUrl ? <Image src={context.logoDataUrl} style={styles.logo} /> : null}
          <View style={styles.brand}>
            <Text style={styles.organization}>TALENT QUEST FOR INDIA</Text>
            <Text style={styles.title}>{documentTitle}</Text>
            <Text style={styles.year}>Academic Year: {context.academicYear}</Text>
          </View>
        </View>
        <View style={styles.meta}>
          {metaItems.map(([label, value]) => (
            <View key={label} style={styles.metaItem}>
              <Text style={styles.metaText}>{label}: {value || '—'}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.table, { width: tableWidth, alignSelf: 'flex-start' }]}>
          <View style={styles.headerRow} fixed>
            {columns.map((column) => (
              <View key={column.title} style={[styles.headerCell, { width: column.width }]}>
                <Text style={styles.headerText}>{column.title}</Text>
              </View>
            ))}
          </View>
          {rows.map((row, index) => {
            const values = context.kind === 'students'
              ? [
                  String(index + 1), row.name, row.standard || '—', row.cluster || context.cluster,
                  row.panchayat || context.panchayat, row.village,
                  ...(isMultiDayReport ? [row.day || '—', row.date || '—'] : []),
                  row.attendance, row.taskStatus || '—',
                ]
              : [
                  String(index + 1), row.name, row.role || 'Volunteer',
                  ...(isOverallVolunteerReport ? [row.cluster || context.cluster] : []),
                  ...(isMultiDayReport ? [row.day || '—', row.date || '—'] : []),
                  row.attendance,
                ];
            return (
              <View key={`${row.name}-${index}`} style={styles.row} wrap={false}>
                {values.map((value, cellIndex) => (
                  <View key={`${cellIndex}-${value}`} style={[styles.cell, { width: columns[cellIndex].width }]}>
                    <Text style={[styles.cellText, cellIndex === 0 ? styles.centered : {}]}>{value || '—'}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
};
