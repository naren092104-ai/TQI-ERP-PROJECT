import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Search,
  Users,
  GraduationCap,
  School,
  MapPin,
  CheckCircle2,
  Filter,
  RotateCcw,
  FileSpreadsheet,
  FileText,
  Eye,
  Plus,
  Upload,
} from './ui/icons';
import { Cluster, Panchayat, Student } from '../types';
import Badge from './ui/badge';
import { EmptyState } from './ui/EmptyState';
import { VillageAttendancePdfViewer } from './VillageAttendancePdfViewer';

export type StudentDirectoryRoute =
  | { level: 'clusters' }
  | { level: 'panchayats'; clusterId: string }
  | { level: 'students'; clusterId: string; panchayatId: string }
  | { level: 'village'; clusterId: string; panchayatId: string; villageId: string };

interface Props {
  route: StudentDirectoryRoute;
  clusters: Cluster[];
  panchayats: Panchayat[];
  students: Student[];
  academicYear?: string;
  userRole?: string;
  onNavigate: (route: StudentDirectoryRoute) => void;
  onManageStudents: (mode: 'add' | 'bulk', panchayatId?: string, villageId?: string) => void;
}

const normalGender = (gender?: string) =>
  gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : gender || 'Other';
const activeStudent = (student: Student) => student.status === 'active';
const standardKey = (standard?: string) => standard?.match(/\d+/)?.[0] || standard || '';

export const StudentDirectoryView: React.FC<Props> = ({
  route,
  clusters,
  panchayats,
  students,
  academicYear = '',
  userRole,
  onNavigate,
  onManageStudents,
}) => {
  const [search, setSearch] = useState('');
  const [clusterSearch, setClusterSearch] = useState('');
  const [panchayatSearch, setPanchayatSearch] = useState('');
  const [villageSearch, setVillageSearch] = useState('');
  const [standard, setStandard] = useState('all');
  const [gender, setGender] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Attendance PDF Viewer state
  const [pdfVillage, setPdfVillage] = useState<{
    id: string;
    name: string;
    panchayatName?: string;
    clusterName?: string;
    standard?: string;
  } | null>(null);

  const cluster = route.level === 'clusters' ? undefined : clusters.find((item) => item.id === route.clusterId);
  const panchayat = route.level === 'students' || route.level === 'village' ? panchayats.find((item) => item.id === route.panchayatId) : undefined;
  const clusterPanchayats = cluster ? panchayats.filter((item) => item.clusterId === cluster.id) : [];
  const villages = panchayat?.villages || [];
  const selectedVillage = route.level === 'village' ? villages.find((item) => item.id === route.villageId) : undefined;

  // Filtered students for Level 4 (Village)
  const scopedVillageStudents = useMemo(() => {
    if (route.level !== 'village') return [];
    return students.filter(
      (s) =>
        s.clusterId === route.clusterId &&
        s.panchayatId === route.panchayatId &&
        (s.villageId === route.villageId || s.villageName === selectedVillage?.name)
    );
  }, [students, route, selectedVillage]);

  const filteredVillageStudents = useMemo(() => {
    return scopedVillageStudents.filter((student) => {
      const query = search.trim().toLowerCase();
      return (
        (!query ||
          student.name.toLowerCase().includes(query) ||
          (student.code && student.code.toLowerCase().includes(query)) ||
          (student.phone && student.phone.includes(query))) &&
        (standard === 'all' || standardKey(student.standard) === standard) &&
        (gender === 'all' || student.gender === gender) &&
        (statusFilter === 'all' || (student.status || 'active') === statusFilter)
      );
    });
  }, [scopedVillageStudents, search, standard, gender, statusFilter]);

  const stats = (items: Student[]) => ({
    total: items.length,
    boys: items.filter((student) => student.gender === 'male').length,
    girls: items.filter((student) => student.gender === 'female').length,
    active: items.filter(activeStudent).length,
  });

  const resetFilters = () => {
    setSearch('');
    setStandard('all');
    setGender('all');
    setStatusFilter('all');
  };

  const downloadVillageExcel = () => {
    const rows: (string | number)[][] = [
      ['Talent Quest for India (TQI)'],
      ['Student Directory — Village Roster'],
      [],
      ['Academic Year', academicYear || '2025-2026'],
      ['Cluster', cluster?.name || ''],
      ['Panchayat', panchayat?.name || ''],
      ['Village', selectedVillage?.name || ''],
      ['Generated Date', new Date().toLocaleDateString('en-GB')],
      [],
      ['S.No', 'Student Name', 'Standard', 'Gender', 'Contact Number'],
    ];

    filteredVillageStudents.forEach((student, index) => {
      rows.push([
        index + 1,
        student.name,
        `Standard ${standardKey(student.standard)}`,
        normalGender(student.gender),
        student.phone || 'N/A',
      ]);
    });

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Students');
    XLSX.writeFile(book, `TQI_Students_${selectedVillage?.name || 'Village'}_${panchayat?.name || 'Panchayat'}.xlsx`);
  };

  const downloadVillagePdf = async () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const generatedDate = new Date().toLocaleDateString('en-GB');
    let logoData = '';
    try {
      const response = await fetch('/logo.png');
      const blob = await response.blob();
      logoData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch { /* text branding remains available */ }
    if (logoData) pdf.addImage(logoData, 'PNG', 16, 10, 20, 20);
    pdf.setTextColor(23, 23, 184);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('TALENT QUEST FOR INDIA (TQI)', 43, 18);
    pdf.setTextColor(35, 35, 35);
    pdf.setFontSize(12);
    pdf.text('STUDENT HOLISTIC DEVELOPMENT PROGRAM', 43, 26);

    const cardY = 49;
    const cardHeight = 18;
    pdf.setDrawColor(135, 175, 220);
    pdf.setFillColor(232, 243, 255);
    pdf.roundedRect(10, cardY, 92, cardHeight, 2, 2, 'FD');
    pdf.setDrawColor(130, 205, 175);
    pdf.setFillColor(233, 250, 242);
    pdf.roundedRect(108, cardY, 92, cardHeight, 2, 2, 'FD');
    pdf.setTextColor(35, 55, 90);
    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Cluster', 24, cardY + 7); pdf.text('Panchayat', 24, cardY + 14);
    pdf.text('Village', 122, cardY + 7); pdf.text('Generated Date', 122, cardY + 14);
    pdf.setFont('helvetica', 'normal');
    pdf.text(':', 51, cardY + 7); pdf.text(':', 51, cardY + 14); pdf.text(':', 158, cardY + 7); pdf.text(':', 158, cardY + 14);
    pdf.text(cluster?.name || '', 57, cardY + 7); pdf.text(panchayat?.name || '', 57, cardY + 14);
    pdf.text(selectedVillage?.name || '', 164, cardY + 7); pdf.text(generatedDate, 164, cardY + 14);
    pdf.setFillColor(245, 247, 255);
    pdf.setDrawColor(175, 185, 225);
    pdf.roundedRect(55, 70, 100, 9, 2, 2, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(35, 55, 90);
    pdf.text(`Academic Year: ${academicYear || '2025-2026'}`, 105, 76, { align: 'center' });

    const columns = [
      { label: 'S.No', width: 14 }, { label: 'Student Name', width: 62 }, { label: 'Standard', width: 24 },
      { label: 'Gender', width: 24 }, { label: 'Contact Number', width: 52 },
    ];
    const tableX = 10;
    const rowHeight = 7;
    const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
    const drawTableHeader = (top: number) => {
      let x = tableX;
      pdf.setFillColor(23, 92, 155); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
      pdf.rect(tableX, top, tableWidth, rowHeight, 'F');
      columns.forEach((column) => { pdf.rect(x, top, column.width, rowHeight); pdf.text(column.label, x + column.width / 2, top + 4.5, { align: 'center' }); x += column.width; });
      pdf.setTextColor(35, 35, 35); pdf.setFont('helvetica', 'normal');
      return top + rowHeight;
    };
    let y = drawTableHeader(84);
    filteredVillageStudents.forEach((student, index) => {
      if (y + rowHeight > 280) { pdf.addPage(); y = drawTableHeader(16); }
      const values = [String(index + 1), student.name || '', `Standard ${standardKey(student.standard)}`, normalGender(student.gender), student.phone || ''];
      let x = tableX;
      values.forEach((value, valueIndex) => { const column = columns[valueIndex]; pdf.setFillColor(index % 2 === 0 ? 252 : 245, index % 2 === 0 ? 252 : 245, 252); pdf.setDrawColor(170, 175, 185); pdf.rect(x, y, column.width, rowHeight, 'FD'); pdf.text(value, x + (valueIndex === 0 ? column.width / 2 : 2), y + 4.5, { align: valueIndex === 0 ? 'center' : 'left', maxWidth: column.width - 4 }); x += column.width; });
      y += rowHeight;
    });
    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) { pdf.setPage(page); pdf.setFontSize(8); pdf.setTextColor(100, 100, 100); pdf.text(`Page ${page} of ${pageCount}`, 200, 288, { align: 'right' }); }
    pdf.save(`TQI_Student_Directory_${selectedVillage?.name || 'Village'}.pdf`);
  };

  // Breadcrumbs helper with clickable links
  type BreadcrumbEntry = string | { label: string; onClick?: () => void };

  const renderBreadcrumbs = (items: BreadcrumbEntry[], onBack?: () => void) => (
    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2 flex-wrap">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-medium transition-all shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="h-3 w-3" />
          <span>Back</span>
        </button>
      )}
      {onBack && <span className="text-slate-300 dark:text-slate-600">/</span>}
      {items.map((entry, index) => {
        const isLast = index === items.length - 1;
        const label = typeof entry === 'string' ? entry : entry.label;
        const onClick = typeof entry === 'string' ? undefined : entry.onClick;

        return (
          <React.Fragment key={`${label}-${index}`}>
            {onClick && !isLast ? (
              <button
                type="button"
                onClick={onClick}
                className="hover:text-[#1717B8] dark:hover:text-indigo-400 hover:underline transition-colors cursor-pointer"
              >
                {label}
              </button>
            ) : (
              <span className={isLast ? 'font-semibold text-slate-900 dark:text-white' : ''}>
                {label}
              </span>
            )}
            {!isLast && <span className="text-slate-300 dark:text-slate-600">/</span>}
          </React.Fragment>
        );
      })}
    </div>
  );

  // Summary Metrics Component
  const renderSummary = (summary: { total: number; boys: number; girls: number; active: number }) => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#1717B8] dark:text-blue-400 flex items-center justify-center shrink-0">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{summary.total}</div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Students</div>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div>
          <div className="text-2xl font-bold text-teal-700 dark:text-teal-400">{summary.boys}</div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Boys (Male)</div>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{summary.girls}</div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Girls (Female)</div>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.active}</div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Students</div>
        </div>
      </div>
    </div>
  );

  // =========================================================================
  // LEVEL 1: CLUSTERS (SUPER ADMIN)
  // =========================================================================
  if (route.level === 'clusters') {
    const totalAllStudents = stats(students);
    const filteredClusters = clusters.filter((c) => {
      if (!clusterSearch.trim()) return true;
      return (
        c.name.toLowerCase().includes(clusterSearch.toLowerCase().trim()) ||
        (c.collegeName && c.collegeName.toLowerCase().includes(clusterSearch.toLowerCase().trim())) ||
        (c.district && c.district.toLowerCase().includes(clusterSearch.toLowerCase().trim()))
      );
    });

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#1717B8]/10 dark:bg-[#1717B8]/20 flex items-center justify-center text-[#1717B8] dark:text-indigo-400 shrink-0">
              <School className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Students Directory
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1717B8]/10 text-[#1717B8] dark:bg-indigo-950/40 dark:text-indigo-300">
                  {clusters.length} Clusters
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Organized hierarchy: Cluster → Panchayat → Village → Students
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search clusters or colleges..."
              value={clusterSearch}
              onChange={(e) => setClusterSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1717B8] transition-all"
            />
          </div>
        </div>

        {/* Global Summary KPI */}
        {renderSummary(totalAllStudents)}

        {/* Clusters Grid */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredClusters.map((item) => {
            const records = students.filter((student) => student.clusterId === item.id);
            const summary = stats(records);
            const panchayatsInCluster = panchayats.filter((p) => p.clusterId === item.id);

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-[#1717B8] dark:group-hover:text-indigo-400 transition-colors">
                      {item.name}
                    </h2>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {panchayatsInCluster.length} Panchayats
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {item.collegeName || 'College not assigned'}
                  </p>

                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" />
                    <span>
                      {item.district}, {item.state || 'Tamil Nadu'}
                    </span>
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Students</span>
                      <strong className="text-slate-900 dark:text-white font-bold">{summary.total}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Active</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{summary.active}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Boys</span>
                      <span className="text-teal-700 dark:text-teal-400 font-semibold">{summary.boys}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Girls</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{summary.girls}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate({ level: 'panchayats', clusterId: item.id })}
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs font-semibold shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span>View Panchayats</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================================
  // LEVEL 2: PANCHAYATS (SELECT PANCHAYAT)
  // =========================================================================
  if (route.level === 'panchayats') {
    const summary = stats(students.filter((student) => student.clusterId === route.clusterId));
    const filteredClusterPanchayats = clusterPanchayats.filter((p) => {
      if (!panchayatSearch.trim()) return true;
      return p.name.toLowerCase().includes(panchayatSearch.toLowerCase().trim());
    });

    const isClusterAdmin = userRole === 'Cluster Admin';

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          {renderBreadcrumbs(
            isClusterAdmin
              ? [cluster?.name || 'Cluster', 'Panchayats']
              : [
                  { label: 'Students Directory', onClick: () => onNavigate({ level: 'clusters' }) },
                  { label: cluster?.name || 'Cluster' },
                ],
            isClusterAdmin ? undefined : () => onNavigate({ level: 'clusters' })
          )}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#1717B8]/10 dark:bg-[#1717B8]/20 flex items-center justify-center text-[#1717B8] dark:text-indigo-400 shrink-0">
                <School className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {cluster?.name || 'Cluster'} — Panchayats
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>{cluster?.collegeName || 'Cluster College'}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    {cluster?.district || ''}, {cluster?.state || 'Tamil Nadu'}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onManageStudents('bulk')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 transition-all shadow-2xs"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>Bulk Import</span>
              </button>
              <button
                type="button"
                onClick={() => onManageStudents('add')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs font-semibold cursor-pointer shadow-2xs transition-all active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Student</span>
              </button>
            </div>
          </div>
        </div>

        {/* KPI Metrics */}
        {renderSummary(summary)}

        {/* Panchayats Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Panchayats Directory</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1717B8]/10 text-[#1717B8]">
                  {filteredClusterPanchayats.length} Panchayats
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select a panchayat to view its villages and student rosters
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search panchayat..."
                value={panchayatSearch}
                onChange={(e) => setPanchayatSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1717B8] transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-semibold w-16">S.No</th>
                  <th className="py-3.5 px-4 font-semibold">Panchayat Name</th>
                  <th className="py-3.5 px-4 font-semibold">Villages Count</th>
                  <th className="py-3.5 px-4 font-semibold">Total Students</th>
                  <th className="py-3.5 px-4 font-semibold">Boys (Male)</th>
                  <th className="py-3.5 px-4 font-semibold">Girls (Female)</th>
                  <th className="py-3.5 px-4 font-semibold">Active</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredClusterPanchayats.map((item, index) => {
                  const records = students.filter(
                    (student) => student.panchayatId === item.id && student.clusterId === route.clusterId
                  );
                  const itemStats = stats(records);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-400">{index + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#1717B8] dark:group-hover:text-indigo-400 transition-colors">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {item.villages?.length || 0} Villages Configured
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 font-medium">
                        {item.villages?.length || 0}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1717B8]/10 text-[#1717B8] dark:bg-indigo-950/40 dark:text-indigo-300">
                          {itemStats.total} Students
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-teal-700 dark:text-teal-400">
                        {itemStats.boys}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        {itemStats.girls}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {itemStats.active}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate({
                              level: 'students',
                              clusterId: route.clusterId,
                              panchayatId: item.id,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
                        >
                          <span>View Villages</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredClusterPanchayats.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                      No panchayats found for this cluster.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // LEVEL 3: VILLAGES (VILLAGE-WISE LIST FOR A PANCHAYAT)
  // Each Village MUST have:
  // 1. [ View Students ] -> opens Level 4
  // 2. [ View Attendance PDF ] -> opens official Village Attendance PDF
  // =========================================================================
  if (route.level === 'students') {
    const panchayatStudents = students.filter(
      (student) => student.clusterId === route.clusterId && student.panchayatId === route.panchayatId
    );
    const panchayatSummary = stats(panchayatStudents);

    const filteredVillages = villages.filter((v) => {
      if (!villageSearch.trim()) return true;
      return v.name.toLowerCase().includes(villageSearch.toLowerCase().trim());
    });

    const isClusterAdmin = userRole === 'Cluster Admin';

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          {renderBreadcrumbs(
            isClusterAdmin
              ? [
                  { label: cluster?.name || 'Cluster', onClick: () => onNavigate({ level: 'panchayats', clusterId: route.clusterId }) },
                  { label: panchayat?.name || 'Panchayat' },
                ]
              : [
                  { label: 'Students Directory', onClick: () => onNavigate({ level: 'clusters' }) },
                  { label: cluster?.name || 'Cluster', onClick: () => onNavigate({ level: 'panchayats', clusterId: route.clusterId }) },
                  { label: panchayat?.name || 'Panchayat' },
                ],
            () => onNavigate({ level: 'panchayats', clusterId: route.clusterId })
          )}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#1717B8]/10 dark:bg-[#1717B8]/20 flex items-center justify-center text-[#1717B8] dark:text-indigo-400 shrink-0">
                <School className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {panchayat?.name || 'Panchayat'} — Villages
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>Cluster: {cluster?.name || ''}</span>
                  <span>•</span>
                  <span>District: {cluster?.district || ''}, {cluster?.state || 'Tamil Nadu'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onManageStudents('bulk', route.panchayatId)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 transition-all shadow-2xs"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>Bulk Import</span>
              </button>
              <button
                type="button"
                onClick={() => onManageStudents('add', route.panchayatId)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs font-semibold cursor-pointer shadow-2xs transition-all active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Student</span>
              </button>
            </div>
          </div>
        </div>

        {/* KPI Metrics */}
        {renderSummary(panchayatSummary)}

        {/* Villages List Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Village-wise Directory
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1717B8]/10 text-[#1717B8]">
                  {filteredVillages.length} Villages
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select a village to view its student roster and physical attendance sheet
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search village name..."
                value={villageSearch}
                onChange={(e) => setVillageSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1717B8] transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-semibold w-16">S.No</th>
                  <th className="py-3.5 px-4 font-semibold">Village Name</th>
                  <th className="py-3.5 px-4 font-semibold">Total Students</th>
                  <th className="py-3.5 px-4 font-semibold">Boys (Male)</th>
                  <th className="py-3.5 px-4 font-semibold">Girls (Female)</th>
                  <th className="py-3.5 px-4 font-semibold">Active</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredVillages.map((vItem, index) => {
                  const villageRecords = panchayatStudents.filter(
                    (s) => s.villageId === vItem.id || s.villageName === vItem.name
                  );
                  const vStats = stats(villageRecords);

                  return (
                    <tr
                      key={vItem.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-400">{index + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#1717B8]/10 text-[#1717B8] flex items-center justify-center shrink-0">
                            <MapPin className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#1717B8] dark:group-hover:text-indigo-400 transition-colors">
                              {vItem.name}
                            </span>
                            <div className="text-[10px] text-slate-400">
                              Panchayat: {panchayat?.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1717B8]/10 text-[#1717B8] dark:bg-indigo-950/40 dark:text-indigo-300">
                          {vStats.total} Students
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-teal-700 dark:text-teal-400">
                        {vStats.boys}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        {vStats.girls}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {vStats.active}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end">
                          {/* Only View Students at village directory level */}
                          <button
                            type="button"
                            onClick={() =>
                              onNavigate({
                                level: 'village',
                                clusterId: route.clusterId,
                                panchayatId: route.panchayatId,
                                villageId: vItem.id,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
                          >
                            <Users className="h-3.5 w-3.5" />
                            <span>View Students</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredVillages.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                      No villages configured under {panchayat?.name || 'this Panchayat'}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal for PDF Preview */}
        {pdfVillage && (
          <VillageAttendancePdfViewer
            isOpen={Boolean(pdfVillage)}
            onClose={() => setPdfVillage(null)}
            villageId={pdfVillage.id}
            villageName={pdfVillage.name}
            panchayatName={pdfVillage.panchayatName || panchayat?.name}
            clusterName={pdfVillage.clusterName || cluster?.name}
            academicYear={academicYear}
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // LEVEL 4: VILLAGE STUDENTS (VILLAGE LEVEL ROSTER)
  // =========================================================================
  const isClusterAdmin = userRole === 'Cluster Admin';
  const villageSummary = stats(filteredVillageStudents);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        {renderBreadcrumbs(
          isClusterAdmin
            ? [
                { label: cluster?.name || 'Cluster', onClick: () => onNavigate({ level: 'panchayats', clusterId: route.clusterId }) },
                {
                  label: panchayat?.name || 'Panchayat',
                  onClick: () =>
                    onNavigate({
                      level: 'students',
                      clusterId: route.clusterId,
                      panchayatId: route.panchayatId,
                    }),
                },
                { label: selectedVillage?.name || 'Village' },
              ]
            : [
                { label: 'Students Directory', onClick: () => onNavigate({ level: 'clusters' }) },
                { label: cluster?.name || 'Cluster', onClick: () => onNavigate({ level: 'panchayats', clusterId: route.clusterId }) },
                {
                  label: panchayat?.name || 'Panchayat',
                  onClick: () =>
                    onNavigate({
                      level: 'students',
                      clusterId: route.clusterId,
                      panchayatId: route.panchayatId,
                    }),
                },
                { label: selectedVillage?.name || 'Village' },
              ],
          () =>
            onNavigate({
              level: 'students',
              clusterId: route.clusterId,
              panchayatId: route.panchayatId,
            })
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#1717B8]/10 dark:bg-[#1717B8]/20 flex items-center justify-center text-[#1717B8] dark:text-indigo-400 shrink-0">
              <School className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {selectedVillage?.name || 'Village'} — Student Roster
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1717B8]/10 text-[#1717B8]">
                  {filteredVillageStudents.length} Students
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Panchayat: {panchayat?.name || ''} · Cluster: {cluster?.name || ''} · District: {cluster?.district || ''},{' '}
                {cluster?.state || 'Tamil Nadu'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Physical Attendance Sheet Button */}
            <button
              type="button"
              onClick={() =>
                setPdfVillage({
                  id: selectedVillage?.id || route.villageId,
                  name: selectedVillage?.name || 'Village',
                  panchayatName: panchayat?.name,
                  clusterName: cluster?.name,
                  standard,
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1F4E79] hover:bg-[#163a5c] text-white text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Physical Attendance Sheet</span>
            </button>

            {/* Excel Export Button */}
            <button
              type="button"
              onClick={downloadVillageExcel}
              disabled={!filteredVillageStudents.length}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Excel Export</span>
            </button>

            <button
              type="button"
              onClick={downloadVillagePdf}
              disabled={!filteredVillageStudents.length}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-blue-600" />
              <span>Student Roster PDF</span>
            </button>

            {/* Manage Student Buttons */}
            <button
              type="button"
              onClick={() => onManageStudents('bulk', route.panchayatId, route.villageId)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-indigo-600" />
              <span>Bulk Import</span>
            </button>

            <button
              type="button"
              onClick={() => onManageStudents('add', route.panchayatId, route.villageId)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Student</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metrics */}
      {renderSummary(villageSummary)}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search student name, code, or phone..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1717B8]"
          />
        </div>

        <select
          value={standard}
          onChange={(event) => setStandard(event.target.value)}
          className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1717B8]"
        >
          <option value="all">All Standards</option>
          {['8', '9', '10', '11', '12'].map((item) => (
            <option key={item} value={item}>
              Standard {item}
            </option>
          ))}
        </select>

        <select
          value={gender}
          onChange={(event) => setGender(event.target.value)}
          className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1717B8]"
        >
          <option value="all">All Genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1717B8]"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {(search || standard !== 'all' || gender !== 'all' || statusFilter !== 'all') && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Village Students Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Student Roster
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1717B8]/10 text-[#1717B8]">
              {filteredVillageStudents.length} Students
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 font-semibold w-16">S.No</th>
                <th className="py-3.5 px-4 font-semibold">Student Name</th>
                <th className="py-3.5 px-4 font-semibold">Student ID</th>
                <th className="py-3.5 px-4 font-semibold">Standard</th>
                <th className="py-3.5 px-4 font-semibold">Gender</th>
                <th className="py-3.5 px-4 font-semibold">Contact Number</th>
                <th className="py-3.5 px-4 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredVillageStudents.map((student, index) => (
                <tr
                  key={student.id}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 text-xs transition-colors"
                >
                  <td className="py-3 px-4 font-mono text-slate-400">{index + 1}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                    {student.name}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                    {student.code || student.id}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#1717B8]/10 text-[#1717B8] dark:bg-indigo-950/40 dark:text-indigo-300">
                      Standard {standardKey(student.standard)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                        student.gender === 'male'
                          ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
                          : student.gender === 'female'
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {normalGender(student.gender)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono">
                    {student.phone || '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        student.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {student.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}

              {filteredVillageStudents.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                    No students found matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for PDF Preview */}
      {pdfVillage && (
        <VillageAttendancePdfViewer
          isOpen={Boolean(pdfVillage)}
          onClose={() => setPdfVillage(null)}
          villageId={pdfVillage.id}
          villageName={pdfVillage.name}
          panchayatName={pdfVillage.panchayatName || panchayat?.name}
          clusterName={pdfVillage.clusterName || cluster?.name}
          academicYear={academicYear}
          standard={pdfVillage.standard}
        />
      )}
    </div>
  );
};

export default StudentDirectoryView;
