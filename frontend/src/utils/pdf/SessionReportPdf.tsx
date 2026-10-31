import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';

export interface SessionReportPdfData {
  academicYear: string;
  cluster: string;
  team: string;
  villages: string[];
  summitNumber: string;
  day: string;
  grade: string;
  date: string;
  overview: string;
  detailedSummary: Array<{ topic: string; details: string }>;
  challenges: string;
  observations: string;
  remarks: string;
  outcome: string;
  volunteers: Array<{ name: string; phone: string; year: string }>;
  photos: Array<{ name: string; dataUrl: string }>;
}

const styles = StyleSheet.create({
  page: { paddingTop: 38, paddingBottom: 38, paddingHorizontal: 42, fontFamily: 'Helvetica', fontSize: 10, color: '#172b4d' },
  cover: { alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#cbdced', paddingBottom: 16, marginBottom: 16 },
  logo: { width: 54, height: 54, objectFit: 'contain', marginBottom: 5 },
  org: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: '#173c70' },
  program: { marginTop: 4, fontSize: 10, color: '#54708f' },
  year: { marginTop: 5, fontSize: 9, color: '#54708f' },
  title: { marginTop: 15, fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#173c70', letterSpacing: 0.6 },
  section: { marginTop: 14 },
  heading: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#173c70', marginBottom: 7 },
  infoTable: { borderWidth: 1, borderColor: '#d7e2ee', borderRadius: 4 },
  infoRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5edf5', minHeight: 25 },
  infoLabel: { width: '31%', padding: 6, backgroundColor: '#eef5fb', fontFamily: 'Helvetica-Bold', color: '#415b78' },
  infoValue: { flex: 1, padding: 6, color: '#223b59' },
  paragraph: { fontSize: 10, lineHeight: 1.55, color: '#263d57', whiteSpace: 'pre-wrap' },
  activity: { borderLeftWidth: 2, borderLeftColor: '#6f9cca', paddingLeft: 9, marginBottom: 8 },
  activityTitle: { fontFamily: 'Helvetica-Bold', marginBottom: 3, color: '#244c77' },
  volunteerTable: { borderWidth: 1, borderColor: '#d7e2ee' },
  volunteerHeader: { flexDirection: 'row', backgroundColor: '#eef5fb', padding: 7, fontFamily: 'Helvetica-Bold' },
  volunteerRow: { flexDirection: 'row', padding: 7, borderTopWidth: 1, borderTopColor: '#e5edf5' },
  number: { width: 42 },
  volunteerName: { flex: 1.5 },
  volunteerContact: { flex: 1 },
  volunteerYear: { width: 65 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCell: { width: '31%', marginBottom: 10, borderWidth: 1, borderColor: '#d7e2ee', padding: 5 },
  photo: { width: '100%', height: 125, objectFit: 'contain' },
  photoName: { marginTop: 4, color: '#637b94', fontSize: 8 },
  pageNumber: { position: 'absolute', bottom: 17, right: 42, fontSize: 8, color: '#71839a' },
});

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.heading}>{children}</Text>
);

const SessionReportDocument: React.FC<{ data: SessionReportPdfData; logo?: string }> = ({ data, logo }) => {
  const information: Array<[string, string]> = [
    ['Cluster', data.cluster], ['Team', data.team], ['Village(s)', data.villages.join(', ')],
    ['No. of Summit', data.summitNumber], ['Session / Day', data.day], ['Grade', data.grade], ['Date', data.date],
  ];
  return (
    <Document title={`Session Report - ${data.day}`} author="Talent Quest for India">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.cover}>
          {logo ? <Image src={logo} style={styles.logo} /> : null}
          <Text style={styles.org}>Talent Quest for India</Text>
          <Text style={styles.program}>Student Holistic Development Program</Text>
          <Text style={styles.year}>Academic Year {data.academicYear}</Text>
          <Text style={styles.title}>REPORT FOR THE SUMMIT</Text>
        </View>
        <View style={styles.section}>
          <SectionHeading>1. BASIC INFORMATION</SectionHeading>
          <View style={styles.infoTable}>
            {information.map(([label, value], index) => (
              <View key={label} style={[styles.infoRow, index === information.length - 1 ? { borderBottomWidth: 0 } : {}]} wrap={false}>
                <Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value || '—'}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <SectionHeading>2. AN OVERVIEW</SectionHeading>
          <Text style={styles.paragraph}>{data.overview || 'No overview provided.'}</Text>
        </View>
        <View style={styles.section}>
          <SectionHeading>3. DETAILED SUMMARY</SectionHeading>
          {data.detailedSummary.length ? data.detailedSummary.map((item, index) => (
            <View key={`${item.topic}-${index}`} style={styles.activity}>
              {item.topic ? <Text style={styles.activityTitle}>{item.topic}</Text> : null}
              <Text style={styles.paragraph}>{item.details || '—'}</Text>
            </View>
          )) : <Text style={styles.paragraph}>No detailed summary provided.</Text>}
        </View>
        <View style={styles.section}>
          <SectionHeading>4. OUTCOME</SectionHeading>
          <Text style={styles.paragraph}>{data.outcome || 'No outcomes provided.'}</Text>
        </View>
        {data.challenges ? <View style={styles.section}><SectionHeading>5. CHALLENGES</SectionHeading><Text style={styles.paragraph}>{data.challenges}</Text></View> : null}
        {data.observations ? <View style={styles.section}><SectionHeading>6. OBSERVATIONS</SectionHeading><Text style={styles.paragraph}>{data.observations}</Text></View> : null}
        {data.remarks ? <View style={styles.section}><SectionHeading>ADDITIONAL REMARKS</SectionHeading><Text style={styles.paragraph}>{data.remarks}</Text></View> : null}
        <View style={styles.section}>
          <SectionHeading>7. VOLUNTEERS WHO TOOK THE SESSION</SectionHeading>
          <View style={styles.volunteerTable}>
            <View style={styles.volunteerHeader} wrap={false}><Text style={styles.number}>S.No</Text><Text style={styles.volunteerName}>Volunteer Name</Text><Text style={styles.volunteerContact}>Contact Number</Text><Text style={styles.volunteerYear}>Year</Text></View>
            {(data.volunteers.length ? data.volunteers : [{ name: '—', phone: '', year: '' }]).map((volunteer, index) => (
              <View key={`${volunteer.name}-${index}`} style={styles.volunteerRow} wrap={false}><Text style={styles.number}>{index + 1}</Text><Text style={styles.volunteerName}>{volunteer.name}</Text><Text style={styles.volunteerContact}>{volunteer.phone || '—'}</Text><Text style={styles.volunteerYear}>{volunteer.year || '—'}</Text></View>
            ))}
          </View>
        </View>
        {data.photos.length > 0 && (
          <View style={styles.section}>
            <SectionHeading>8. SESSION PHOTOS</SectionHeading>
            <View style={styles.photoGrid}>
              {data.photos.map((photo, index) => (
                <View key={`${photo.name}-${index}`} style={styles.photoCell} wrap={false}>
                  <Image src={photo.dataUrl} style={styles.photo} />
                  <Text style={styles.photoName}>{photo.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        <Text style={styles.pageNumber} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
};

async function toDataUrl(response: Response): Promise<string> {
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image for PDF export.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export async function exportSessionReportPdf(
  data: SessionReportPdfData,
  authToken: string,
): Promise<void> {
  const [logo, photos] = await Promise.all([
    fetch('/logo.png').then((response) => response.ok ? toDataUrl(response) : '').catch(() => ''),
    Promise.all(data.photos.map(async (photo) => {
      const response = await fetch(photo.dataUrl, { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} });
      if (!response.ok) throw new Error(`Could not load session photo: ${photo.name}`);
      return { ...photo, dataUrl: await toDataUrl(response) };
    })),
  ]);
  const blob = await pdf(<SessionReportDocument data={{ ...data, photos }} logo={logo || undefined} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `TQI_Session_Report_Day_${data.day.replace(/[^\w-]/g, '_')}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
