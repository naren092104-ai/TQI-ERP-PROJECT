import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';

export interface StudentAttendanceRow {
  no: number;
  name: string;
  gender?: string;
  standard?: string;
  panchayatName: string;
  contactNumber: string;
  status?: string;
  attendance: {
    D1?: string;
    D2?: string;
    D3?: string;
    D4?: string;
    D5?: string;
    D6?: string;
    D7?: string;
    D8?: string;
    [key: string]: string | undefined;
  };
}

export interface VillageAttendanceReportData {
  cluster: {
    id: string;
    name: string;
    collegeName?: string;
  };
  panchayat: {
    id: string;
    name: string;
  };
  village: {
    id: string;
    name: string;
  };
  academicYear?: string;
  logoUrl?: string;
  standard?: string;
  sessionDates: Record<number, string>;
  students: StudentAttendanceRow[];
  totalStudentsCount: number;
}

export interface VillageAttendancePdfProps {
  data: VillageAttendanceReportData;
}

export const formatShortAcademicYear = (yr?: string): string => {
  const currentDate = new Date();
  const startYear = currentDate.getMonth() >= 5 ? currentDate.getFullYear() : currentDate.getFullYear() - 1;
  const academicYear = yr || `${startYear}-${startYear + 1}`;
  const cleaned = academicYear.replace(/\s+/g, '');
  const parts = cleaned.split(/[-/]/);
  if (parts.length === 2) {
    const y1 = parts[0].slice(-2);
    const y2 = parts[1].slice(-2);
    if (y1 && y2) return `${y1}-${y2}`;
  }
  return academicYear;
};

const MAX_ROWS_PER_PAGE = 18;
// Fixed number column; the name and eight attendance columns share the page width dynamically.
const COL = {
  no: 32.0,
  panchayat: 130.0,
};
const TABLE_WIDTH = 805;

const BORDER_COLOR = '#000000';
const BORDER_WIDTH = 0.6;

const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 18,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  headerArea: {
    marginBottom: 8,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  logo: {
    width: 44,
    height: 44,
    objectFit: 'contain',
  },
  logoPlaceholder: {
    width: 44,
    height: 44,
  },
  headerTitles: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTitle: {
    fontFamily: 'Helvetica',
    fontSize: 14,
    textAlign: 'center',
    color: '#000000',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  titleDivider: {
    width: '86%',
    alignSelf: 'center',
    borderBottomWidth: 0.6,
    borderBottomColor: '#8A8A8A',
    marginTop: 2,
    marginBottom: 8,
  },
  clusterStdRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    gap: 30,
  },
  clusterItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  clusterLabel: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#000000',
  },
  clusterLine: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#000000',
    paddingLeft: 4,
  },
  stdItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  stdLabel: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#000000',
  },
  stdLine: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#000000',
    paddingLeft: 4,
  },
  villageRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  villageLine: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingLeft: 4,
  },
  table: {
    borderTopWidth: BORDER_WIDTH,
    borderLeftWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
  },
  // Table Row 1: SESSION DATE and DD/MM
  row1: {
    flexDirection: 'row',
    height: 19,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
  },
  cellSessionDate: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
  },
  cellSessionDateDay: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
  },
  textHeaderDark: {
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    color: '#000000',
    textAlign: 'center',
  },
  // Table Row 2: Deep Blue Table Header
  row2Blue: {
    flexDirection: 'row',
    height: 22,
    backgroundColor: '#1F4E79',
    borderBottomWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
  },
  cellBlue: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
  },
  textBlueHeader: {
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 1.15,
  },
  // Data Row
  dataRow: {
    flexDirection: 'row',
    height: 19.5,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
  },
  cellCenter: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    paddingHorizontal: 1,
  },
  cellLeft: {
    height: '100%',
    justifyContent: 'center',
    borderRightWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    paddingLeft: 6,
    paddingRight: 4,
  },
  cellText: {
    fontSize: 8,
    color: '#000000',
  },
  footerRow: {
    flexDirection: 'row',
    height: 19.5,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
  },
  footerLabel: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    paddingHorizontal: 3,
  },
  textBottomLabel: {
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    color: '#000000',
    textAlign: 'center',
  },
});

export const VillageAttendancePdf: React.FC<VillageAttendancePdfProps> = ({ data }) => {
  const {
    cluster,
    village,
    standard,
    academicYear,
    logoUrl,
    sessionDates = {},
    students = [],
  } = data;

  const logoSrc = logoUrl || (typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : '/logo.png');
  const shortYear = formatShortAcademicYear(academicYear);

  // Auto-detect standard if not explicitly set or set to 'all'
  const extractedStandards = Array.from(
    new Set(
      students
        .map((s) => (s.standard || '').trim())
        .filter(Boolean)
    )
  ).sort();

  const autoStd =
    standard && standard.toLowerCase() !== 'all'
      ? standard.toUpperCase()
      : (extractedStandards.length > 0 ? extractedStandards.join(', ') : '');

  const nameColumnWidth = Math.min(220, Math.max(120, ...students.map((student) => String(student.name || '').length * 4.4 + 16)));
  const dayWidth = (TABLE_WIDTH - COL.no - nameColumnWidth - COL.panchayat) / 8;
  const dayWidths = Array.from({ length: 8 }, () => dayWidth);

  // Split any-sized roster into pages of at most 18 student rows.
  const totalChunks = Math.max(1, Math.ceil(students.length / MAX_ROWS_PER_PAGE));
  const pagesData: StudentAttendanceRow[][] = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunk = students.slice(
      i * MAX_ROWS_PER_PAGE,
      (i + 1) * MAX_ROWS_PER_PAGE
    );
    pagesData.push(chunk);
  }

  const clusterName = (cluster?.name || '').toUpperCase();

  return (
    <Document title={`STUDENT HOLISTIC DEVELOPMENT PROGRAMME ${shortYear}`}>
      {pagesData.map((chunk, pageIndex) => {
        const isLastPage = pageIndex === pagesData.length - 1;
        return (
          <Page key={pageIndex} size="A4" orientation="landscape" style={styles.page}>
            {/* Header: Exact replica with logo, dynamic short year, and auto standard */}
            <View style={styles.headerArea}>
              <View style={styles.headerRow}>
                <Image src={logoSrc} style={styles.logo} />
                <View style={styles.headerTitles}>
                  <Text style={styles.mainTitle}>
                    STUDENT HOLISTIC DEVELOPMENT PROGRAMME {shortYear}
                  </Text>
                  <View style={styles.titleDivider} />
                  <View style={styles.clusterStdRow}>
                    <View style={styles.clusterItem}>
                      <Text style={styles.clusterLabel}>CLUSTER NAME: </Text>
                      <Text style={styles.clusterLine}>
                        {clusterName || '____________________________________'}
                      </Text>
                    </View>
                    <View style={styles.stdItem}>
                      <Text style={styles.stdLabel}>STD: </Text>
                      <Text style={styles.stdLine}>
                        {autoStd || '____________'}
                      </Text>
                    </View>
                    <View style={styles.villageRow}>
                      <Text style={styles.stdLabel}>VILLAGE: </Text>
                      <Text style={styles.villageLine}>{village?.name || ''}</Text>
                    </View>
                  </View>
                </View>
                {/* Right spacer keeps title centered */}
                <View style={styles.logoPlaceholder} />
              </View>
            </View>

            {/* Official Table Grid */}
            <View style={styles.table}>
              {/* Row 1: session dates for each of the eight attendance days */}
              <View style={styles.row1}>
                <View style={[styles.cellSessionDate, { width: COL.no + nameColumnWidth + COL.panchayat }]}>
                  <Text style={styles.textHeaderDark}>SESSION DATE</Text>
                </View>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((d, dIdx) => (
                  <View key={d} style={[styles.cellSessionDateDay, { width: dayWidths[dIdx] }]}>
                    <Text style={styles.textHeaderDark}>
                      {sessionDates[d] || ''}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Row 2: Deep Blue Table Header */}
              <View style={styles.row2Blue}>
                <View style={[styles.cellBlue, { width: COL.no }]}>
                  <Text style={styles.textBlueHeader}>No</Text>
                </View>
                <View style={[styles.cellBlue, { width: nameColumnWidth }]}>
                  <Text style={styles.textBlueHeader}>Name</Text>
                </View>
                <View style={[styles.cellBlue, { width: COL.panchayat }]}>
                  <Text style={styles.textBlueHeader}>Panchayat</Text>
                </View>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((d, dIdx) => (
                  <View key={d} style={[styles.cellBlue, { width: dayWidths[dIdx] }]}>
                    <Text style={styles.textBlueHeader}>D - {d}</Text>
                  </View>
                ))}
              </View>

              {/* Data Rows: student name only; no student ID/code is printed */}
              {chunk.map((student, rIdx) => {
                const seq = pageIndex * MAX_ROWS_PER_PAGE + rIdx + 1;
                const att = student.attendance || {};

                return (
                  <View key={`${student.no}-${rIdx}`} style={styles.dataRow}>
                    <View style={[styles.cellCenter, { width: COL.no }]}>
                      <Text style={styles.cellText}>{seq}</Text>
                    </View>
                    <View style={[styles.cellLeft, { width: nameColumnWidth }]}>
                      <Text style={styles.cellText}>{student.name || ''}</Text>
                    </View>
                    <View style={[styles.cellLeft, { width: COL.panchayat }]}>
                      <Text style={styles.cellText}>{student.panchayatName || ''}</Text>
                    </View>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((d, dIdx) => {
                      const val = att[`D${d}`] || '';
                      return (
                        <View key={d} style={[styles.cellCenter, { width: dayWidths[dIdx] }]}>
                          <Text style={styles.cellText}>{val}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}

              {isLastPage && (
                <>
                  <View style={styles.footerRow}>
                    <View style={[styles.footerLabel, { width: COL.no + nameColumnWidth + COL.panchayat }]}>
                      <Text style={styles.textBottomLabel}>Total Students Count</Text>
                    </View>
                    {dayWidths.map((width, dayIndex) => <View key={`count-${dayIndex}`} style={[styles.cellCenter, { width }]} />)}
                  </View>
                  {['TQI Volunteer sign', 'Village PRP Sign'].map((label) => (
                    <View key={label} style={styles.footerRow}>
                      <View style={[styles.footerLabel, { width: COL.no + nameColumnWidth + COL.panchayat }]}>
                        <Text style={styles.textBottomLabel}>{label}</Text>
                      </View>
                      {dayWidths.map((width, dayIndex) => <View key={`${label}-${dayIndex}`} style={[styles.cellCenter, { width }]} />)}
                    </View>
                  ))}
                </>
              )}

            </View>
          </Page>
        );
      })}
    </Document>
  );
};

export default VillageAttendancePdf;
