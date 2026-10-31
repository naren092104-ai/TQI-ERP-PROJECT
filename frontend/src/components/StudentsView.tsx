import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { pdf } from '@react-pdf/renderer';
import { Student, Panchayat, Village, UserRole, Cluster } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { EmptyState } from './ui/EmptyState';
import { VillageAttendancePdf, VillageAttendanceReportData } from '../utils/pdf/VillageAttendancePdf';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  GraduationCap,
  Users,
  MapPin,
  Home,
  Plus,
  Search,
  Upload,
  Download,
  Trash2,
  Edit3,
  Eye,
  X,
  CaretLeft,
  CaretRight,
  CheckCircle2,
  AlertCircle,
  Phone,
  Calendar,
  ArrowLeft,
  ChevronRight,
  Building2,
  Sparkles,
  Pencil,
} from './ui/icons';

interface StudentsViewProps {
  authToken?: string;
  students: Student[];
  panchayats: Panchayat[];
  clusters: Cluster[];
  academicYear?: string;
  initialFilters?: { panchayatId?: string; villageId?: string };
  userRole?: UserRole;
  onAddStudent: (newStudent: Omit<Student, 'id' | 'code' | 'avatarLetter' | 'avatarBg'>) => Promise<void> | void;
  onBulkImportStudents?: (students: any[], clusterId: string) => Promise<void> | void;
  onEditStudent?: (id: string, updated: Partial<Student>) => Promise<void> | void;
  onUpdateStudent?: (id: string, updated: Partial<Student>) => void;
  onDeleteStudent: (id: string) => void;
  onAddPanchayat?: (newPanchayat: {
    name: string;
    cluster: string;
    status: 'On Track' | 'Correction Required' | 'Action Needed';
    initialVillages: string[];
  }) => void;
  onUpdatePanchayat?: (panchayatId: string, name: string) => void;
  onDeletePanchayat?: (panchayatId: string) => void;
  onAddVillage?: (panchayatId: string, villageName: string) => void;
  onUpdateVillage?: (panchayatId: string, villageId: string, name: string) => void;
  onDeleteVillage?: (panchayatId: string, villageId: string) => void;
  openOnMount?: 'add' | 'import';
}

interface ParsedStudentRow {
  name: string;
  standard: string;
  villageName: string;
  villageId: string;
  isValid: boolean;
  validationError?: string;
}

const standardKey = (value?: string) => String(value || '').match(/\d+/)?.[0] || String(value || '').trim();
const STANDARDS = ['9', '10', '11', '12'];

export const StudentsView: React.FC<StudentsViewProps> = ({
  students,
  panchayats,
  clusters,
  academicYear = '',
  initialFilters,
  userRole = 'Super Admin',
  onAddStudent,
  onBulkImportStudents,
  onEditStudent,
  onUpdateStudent,
  onDeleteStudent,
  onAddPanchayat,
  onUpdatePanchayat,
  onDeletePanchayat,
  onAddVillage,
  onUpdateVillage,
  onDeleteVillage,
  openOnMount,
}) => {
  const isSuperAdmin = userRole === 'Super Admin';

  // Navigation Drill-Down State: 'clusters' -> 'panchayats' -> 'villages' -> 'students'
  const [drillLevel, setDrillLevel] = useState<'clusters' | 'panchayats' | 'villages' | 'students'>(isSuperAdmin ? 'clusters' : 'panchayats');
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [selectedPanchayatId, setSelectedPanchayatId] = useState<string | null>(null);
  const [selectedVillageId, setSelectedVillageId] = useState<string | null>(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedStd, setSelectedStd] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<'all' | 'female' | 'male'>('all');
  const [studentPage, setStudentPage] = useState(1);
  const [attendancePdfStandard, setAttendancePdfStandard] = useState<string | null>(null);

  // Inline forms (No popups)
  const [activeFormMode, setActiveFormMode] = useState<'none' | 'add-student' | 'edit-student' | 'import' | 'add-panchayat' | 'add-village'>('none');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [entityToDelete, setEntityToDelete] = useState<{ type: 'panchayat' | 'village'; id: string; name: string } | null>(null);
  const [editingEntity, setEditingEntity] = useState<{ type: 'panchayat' | 'village'; id: string; name: string } | null>(null);

  // Form inputs
  const [studentForm, setStudentForm] = useState({
    name: '',
    gender: 'male' as 'male' | 'female' | 'other',
    dob: '2010-06-15',
    standard: '9',
    parentName: '',
    phone: '',
    status: 'active' as 'active' | 'inactive',
  });

  const [newPanchayatName, setNewPanchayatName] = useState('');
  const [newVillageName, setNewVillageName] = useState('');
  const [isSavingVillage, setIsSavingVillage] = useState(false);
  const [villageSaveError, setVillageSaveError] = useState('');
  const [renameEntityName, setRenameEntityName] = useState('');

  // Bulk Import state
  const [importRows, setImportRows] = useState<ParsedStudentRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [isParsingFile, setIsParsingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const clusterGroups = useMemo(() => {
    return clusters
      .filter((cluster) => cluster.status !== 'Inactive')
      .map((cluster) => {
        const clusterPanchayats = panchayats.filter((panchayat) => panchayat.clusterId === cluster.id);
        const clusterPanchayatIds = new Set(clusterPanchayats.map((panchayat) => panchayat.id));
        return {
          id: cluster.id,
          name: cluster.name,
          panchayats: clusterPanchayats,
          villageCount: clusterPanchayats.reduce((sum, panchayat) => sum + (panchayat.villages?.length ?? 0), 0),
          studentCount: students.filter((student) => student.clusterId === cluster.id || clusterPanchayatIds.has(student.panchayatId)).length,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clusters, panchayats, students]);

  const currentCluster = useMemo(() => {
    if (!selectedClusterId) return null;
    return clusterGroups.find((cluster) => cluster.id === selectedClusterId) || null;
  }, [clusterGroups, selectedClusterId]);

  // Resolve current hierarchy objects cleanly by unique ID to avoid similar name collisions
  const currentPanchayat = useMemo(() => {
    if (!selectedPanchayatId) return null;
    return panchayats.find((p) => p.id === selectedPanchayatId) || null;
  }, [panchayats, selectedPanchayatId]);

  const currentVillage = useMemo(() => {
    if (!currentPanchayat || !selectedVillageId) return null;
    return currentPanchayat.villages.find((v) => v.id === selectedVillageId || v.name === selectedVillageId) || null;
  }, [currentPanchayat, selectedVillageId]);

  // Handle initialFilters from outside (e.g. navigation query)
  useEffect(() => {
    if (initialFilters?.panchayatId) {
      setSelectedPanchayatId(initialFilters.panchayatId);
      if (initialFilters.villageId) {
        setSelectedVillageId(initialFilters.villageId);
          setDrillLevel('students');
      } else {
        setDrillLevel('villages');
      }
    }
  }, [initialFilters]);

  // Handle openOnMount
  useEffect(() => {
    if (openOnMount === 'add' && selectedPanchayatId && selectedVillageId) {
      setActiveFormMode('add-student');
    } else if (openOnMount === 'import' && selectedPanchayatId && selectedVillageId) {
      setActiveFormMode('import');
    }
  }, [openOnMount, selectedPanchayatId, selectedVillageId]);

  // Filtered Students when in 'students' view
  const currentStudents = useMemo(() => {
    if (!currentPanchayat || !currentVillage) return [];
    return students.filter((s) => {
      const matchPanchayat = s.panchayatId === currentPanchayat.id;
      const matchVillage = s.villageId === currentVillage.id || s.villageName === currentVillage.name;
      if (!matchPanchayat || !matchVillage) return false;

      if (selectedStd !== 'all' && standardKey(s.standard) !== selectedStd) return false;
      if (selectedGender !== 'all' && s.gender !== selectedGender) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = s.name.toLowerCase().includes(q);
        const matchCode = (s.code || '').toLowerCase().includes(q);
        const matchPhone = (s.phone || '').includes(q);
        if (!matchName && !matchCode && !matchPhone) return false;
      }

      return true;
    });
  }, [students, currentPanchayat, currentVillage, selectedStd, selectedGender, search]);

  const studentPageSize = 25;
  const studentPageCount = Math.max(1, Math.ceil(currentStudents.length / studentPageSize));
  const paginatedStudents = currentStudents.slice((studentPage - 1) * studentPageSize, studentPage * studentPageSize);

  useEffect(() => {
    setStudentPage(1);
  }, [selectedStd, selectedGender, search, selectedVillageId]);

  useEffect(() => {
    if (studentPage > studentPageCount) setStudentPage(studentPageCount);
  }, [studentPage, studentPageCount]);

  const downloadAttendancePdf = async (grade: string) => {
    if (!currentPanchayat || !currentVillage) return;
    setAttendancePdfStandard(grade);
    try {
      const gradeStudents = students
        .filter((student) =>
          student.panchayatId === currentPanchayat.id &&
          (student.villageId === currentVillage.id || student.villageName === currentVillage.name) &&
          standardKey(student.standard) === grade
        )
        .sort((left, right) => left.name.localeCompare(right.name));
      const clusterId = currentPanchayat.clusterId || selectedClusterId || '';
      const selectedCluster = clusters.find((cluster) => cluster.id === clusterId);
      const reportData: VillageAttendanceReportData = {
        cluster: { id: clusterId, name: selectedCluster?.name || currentPanchayat.cluster || '' },
        panchayat: { id: currentPanchayat.id, name: currentPanchayat.name },
        village: { id: currentVillage.id, name: currentVillage.name },
        academicYear,
        standard: `Standard ${grade}`,
        sessionDates: {},
        students: gradeStudents.map((student, index) => ({
          no: index + 1,
          name: student.name,
          standard: `Standard ${grade}`,
          panchayatName: currentPanchayat.name,
          contactNumber: '',
          attendance: {},
        })),
        totalStudentsCount: gradeStudents.length,
      };
      const pdfDocument = React.createElement(VillageAttendancePdf, { data: reportData }) as unknown as Parameters<typeof pdf>[0];
      const blob = await pdf(pdfDocument).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `TQI_Attendance_${currentVillage.name}_Std_${grade}_${academicYear || 'Academic_Year'}`.replace(/[^a-zA-Z0-9_-]+/g, '_') + '.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast(`Standard ${grade} attendance PDF downloaded.`);
    } catch (error) {
      console.error('Unable to generate attendance PDF:', error);
      showToast('Unable to generate attendance PDF. Please try again.');
    } finally {
      setAttendancePdfStandard(null);
    }
  };

  const standardOptions = useMemo(() => {
    if (!currentPanchayat || !currentVillage) return [];
    const grouped = new Map<string, number>();
    students.forEach((student) => {
      if (student.panchayatId !== currentPanchayat.id || !(student.villageId === currentVillage.id || student.villageName === currentVillage.name)) return;
      if (selectedGender !== 'all' && student.gender !== selectedGender) return;
      const query = search.trim().toLowerCase();
      if (query && !student.name.toLowerCase().includes(query) && !(student.code || '').toLowerCase().includes(query) && !(student.phone || '').includes(query)) return;
      const key = standardKey(student.standard);
      if (key) grouped.set(key, (grouped.get(key) || 0) + 1);
    });
    return [...grouped.entries()].sort((left, right) => Number(left[0]) - Number(right[0]) || left[0].localeCompare(right[0]));
  }, [students, currentPanchayat, currentVillage, selectedGender, search]);

  // Handlers for Navigation
  const handleSelectCluster = (clusterId: string) => {
    setSelectedClusterId(clusterId);
    setSelectedPanchayatId(null);
    setSelectedVillageId(null);
    setDrillLevel('panchayats');
    setActiveFormMode('none');
    setSearch('');
  };

  const handleSelectPanchayat = (p: Panchayat) => {
    setSelectedClusterId(p.clusterId || clusterGroups.find((cluster) => cluster.name === p.cluster)?.id || selectedClusterId || null);
    setSelectedPanchayatId(p.id);
    setSelectedVillageId(null);
    setDrillLevel('villages');
    setActiveFormMode('none');
    setSearch('');
  };

  const handleSelectVillage = (v: Village) => {
    setSelectedVillageId(v.id || v.name);
    setSelectedStd('all');
    setDrillLevel('students');
    setActiveFormMode('none');
    setSearch('');
  };

  const handleBackToPanchayats = () => {
    setSelectedPanchayatId(null);
    setSelectedVillageId(null);
    setDrillLevel(isSuperAdmin ? (selectedClusterId ? 'panchayats' : 'clusters') : 'panchayats');
    setActiveFormMode('none');
    setSearch('');
  };

  const handleBackToVillages = () => {
    setSelectedVillageId(null);
    setSelectedStd('all');
    setDrillLevel('villages');
    setActiveFormMode('none');
    setSearch('');
  };

  const handleBackToClusters = () => {
    setSelectedClusterId(null);
    setSelectedPanchayatId(null);
    setSelectedVillageId(null);
    setDrillLevel('clusters');
    setActiveFormMode('none');
    setSearch('');
  };

  // Student Add / Edit Submission
  const handleOpenAddStudent = () => {
    setEditingStudent(null);
    setStudentForm({
      name: '',
      gender: 'male',
      dob: '2010-06-15',
      standard: '9',
      parentName: '',
      phone: '',
      status: 'active',
    });
    setActiveFormMode('add-student');
  };

  const handleOpenEditStudent = (st: Student) => {
    setEditingStudent(st);
    setStudentForm({
      name: st.name,
      gender: st.gender,
      dob: st.dob || '2010-06-15',
      standard: STANDARDS.includes(st.standard) ? st.standard : '9',
      parentName: st.parentName || '',
      phone: st.phone || '',
      status: st.status || 'active',
    });
    setActiveFormMode('edit-student');
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim()) {
      alert('Please enter student name.');
      return;
    }
    if (!STANDARDS.includes(studentForm.standard)) {
      alert('Student standard must be between 9 and 12.');
      return;
    }
    if (!currentPanchayat || !currentVillage) {
      alert('Active Panchayat and Village context is required.');
      return;
    }

    if (editingStudent) {
      const payload: Partial<Student> = {
        name: studentForm.name.trim(),
        gender: studentForm.gender,
        dob: studentForm.dob,
        standard: studentForm.standard,
        parentName: studentForm.parentName.trim(),
        phone: studentForm.phone.trim(),
        status: studentForm.status,
        schoolName: '',
      };

      if (onEditStudent) {
        await onEditStudent(editingStudent.id, payload);
      } else if (onUpdateStudent) {
        onUpdateStudent(editingStudent.id, payload);
      }
      showToast(`Updated profile for ${studentForm.name}`);
    } else {
      await onAddStudent({
        name: studentForm.name.trim(),
        gender: studentForm.gender,
        dob: studentForm.dob,
        standard: studentForm.standard,
        parentName: studentForm.parentName.trim(),
        phone: studentForm.phone.trim(), // Optional contact
        status: studentForm.status,
        panchayatId: currentPanchayat.id,
        panchayatName: currentPanchayat.name,
        villageId: currentVillage.id,
        villageName: currentVillage.name,
        schoolName: '',
      });
      showToast(`Registered student ${studentForm.name}`);
    }

    setActiveFormMode('none');
    setEditingStudent(null);
  };

  // Panchayat & Village creation
  const handleCreatePanchayat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPanchayatName.trim()) return;
    if (onAddPanchayat) {
      onAddPanchayat({
        name: newPanchayatName.trim(),
        cluster: 'Dharmapuri',
        status: 'On Track',
        initialVillages: ['Main Village'],
      });
      showToast(`Created Panchayat "${newPanchayatName.trim()}"`);
    }
    setNewPanchayatName('');
    setActiveFormMode('none');
  };

  const handleCreateVillage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVillageName.trim() || !currentPanchayat || isSavingVillage) return;
    setVillageSaveError('');
    setIsSavingVillage(true);
    try {
      if (!onAddVillage) throw new Error('Village creation is not available right now.');
      await onAddVillage(currentPanchayat.id, newVillageName.trim());
      showToast(`Added Village "${newVillageName.trim()}" to ${currentPanchayat.name}`);
      setNewVillageName('');
      setActiveFormMode('none');
    } catch (error: any) {
      setVillageSaveError(error?.message || 'Unable to save village. Please try again.');
    } finally {
      setIsSavingVillage(false);
    }
  };

  // Rename Entity
  const handleSaveRename = () => {
    if (!editingEntity || !renameEntityName.trim()) return;
    if (editingEntity.type === 'panchayat' && onUpdatePanchayat) {
      onUpdatePanchayat(editingEntity.id, renameEntityName.trim());
      showToast(`Renamed Panchayat to "${renameEntityName.trim()}"`);
    } else if (editingEntity.type === 'village' && onUpdateVillage && currentPanchayat) {
      onUpdateVillage(currentPanchayat.id, editingEntity.id, renameEntityName.trim());
      showToast(`Renamed Village to "${renameEntityName.trim()}"`);
    }
    setEditingEntity(null);
    setRenameEntityName('');
  };

  // Delete Entity
  const handleConfirmDeleteEntity = () => {
    if (!entityToDelete) return;
    if (entityToDelete.type === 'panchayat' && onDeletePanchayat) {
      onDeletePanchayat(entityToDelete.id);
      showToast(`Deleted Panchayat ${entityToDelete.name}`);
      if (selectedPanchayatId === entityToDelete.id) {
        handleBackToPanchayats();
      }
    } else if (entityToDelete.type === 'village' && onDeleteVillage && currentPanchayat) {
      onDeleteVillage(currentPanchayat.id, entityToDelete.id);
      showToast(`Deleted Village ${entityToDelete.name}`);
      if (selectedVillageId === entityToDelete.id) {
        handleBackToVillages();
      }
    }
    setEntityToDelete(null);
  };

  // Excel Sample and File Upload
  const handleDownloadSample = () => {
    const sample = [
      { Name: 'Kavya S.', Standard: '9', Village: currentVillage?.name || '' },
      { Name: 'Gokul Nathan', Standard: '10', Village: currentVillage?.name || '' },
      { Name: 'Deepika R.', Standard: '11', Village: currentVillage?.name || '' },
      { Name: 'Vignesh M.', Standard: '12', Village: currentVillage?.name || '' },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students_Template');
    XLSX.writeFile(wb, 'TQI_Students_Import_Template.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Spreadsheet must be 10 MB or smaller.');
      e.target.value = '';
      return;
    }
    setImportFileName(file.name);
    setIsParsingFile(true);
    setImportRows([]);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', sheetRows: 10001 });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (rawJson.length > 10000) {
          throw new Error('Spreadsheet can contain at most 10,000 student rows.');
        }

        if (!rawJson || rawJson.length === 0) {
          alert('Uploaded spreadsheet contains no data rows.');
          setIsParsingFile(false);
          return;
        }

        const parsed: ParsedStudentRow[] = rawJson.map((row) => {
          const keys = Object.keys(row);
          const findVal = (terms: string[]) => {
            const matchedKey = keys.find((k) =>
              terms.some((t) => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(t))
            );
            return matchedKey ? String(row[matchedKey]).trim() : '';
          };
          const name = findVal(['name', 'studentname', 'fullname']);
          const rawStd = findVal(['standard', 'std', 'class', 'grade']);
          const match = rawStd.match(/\d+/);
          const standard = match && STANDARDS.includes(match[0]) ? match[0] : '';
          const rawVillage = findVal(['village']);
          const normalizedVillage = rawVillage.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
          const village = currentPanchayat?.villages.find((item) =>
            item.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en') === normalizedVillage
          );
          const errors = [
            !name && 'Missing student name',
            !standard && 'Standard must be between 9 and 12',
            !rawVillage && 'Missing village',
            rawVillage && !village && 'Village is not in the selected Panchayat',
          ].filter(Boolean);

          return {
            name,
            standard,
            villageName: village?.name || rawVillage,
            villageId: village?.id || village?.name || '',
            isValid: errors.length === 0,
            validationError: errors.join('; '),
          };
        });

        setImportRows(parsed);
      } catch (err) {
        alert('Failed to parse file. Please upload a valid .xlsx or .csv template.');
      } finally {
        setIsParsingFile(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmBulkImport = async () => {
    if (!currentPanchayat || !currentVillage) {
      alert('Panchayat and Village must be selected.');
      return;
    }

    const validRows = importRows.filter((r) => r.isValid && r.name.trim().length > 0);
    if (validRows.length === 0) {
      alert('No valid student records found to import.');
      return;
    }

    const formatted = validRows.map((r) => ({
      name: r.name,
      gender: 'male' as const,
      dob: '2014-01-01',
      standard: r.standard,
      panchayatId: currentPanchayat.id,
      panchayatName: currentPanchayat.name,
      villageId: r.villageId,
      villageName: r.villageName,
      schoolName: '',
      parentName: '',
      phone: '',
      status: 'active' as const,
    }));

    if (onBulkImportStudents) {
      await onBulkImportStudents(formatted, currentPanchayat.clusterId || currentPanchayat.id);
    } else {
      formatted.forEach((st) => onAddStudent(st));
    }

    showToast(`Successfully imported ${formatted.length} students to ${currentPanchayat.name}`);
    setActiveFormMode('none');
    setImportRows([]);
    setImportFileName('');
  };

  // Helper count aggregates
  const getPanchayatStudentCount = (p: Panchayat) => {
    return students.filter((s) => s.panchayatId === p.id).length;
  };

  const getVillageStudentCount = (panchayatId: string, village: Village) => {
    return students.filter(
      (s) => s.panchayatId === panchayatId && (s.villageId === village.id || s.villageName === village.name)
    ).length;
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 shadow-lg animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header & Breadcrumbs matching reference UI */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {isSuperAdmin && (
              <button
                onClick={handleBackToClusters}
                className={`hover:text-primary transition-colors ${drillLevel === 'clusters' ? 'text-primary font-bold' : ''}`}
              >
                Clusters
              </button>
            )}
            {!isSuperAdmin && (
              <button
                onClick={handleBackToPanchayats}
                className={`hover:text-primary transition-colors ${drillLevel === 'panchayats' ? 'text-primary font-bold' : ''}`}
              >
                Panchayats
              </button>
            )}
            {isSuperAdmin && selectedClusterId && currentCluster && (
              <>
                <ChevronRight className="h-3 w-3" />
                <button
                  onClick={handleBackToPanchayats}
                  className={`hover:text-primary transition-colors ${drillLevel === 'panchayats' ? 'text-primary font-bold' : ''}`}
                >
                  {currentCluster.name}
                </button>
              </>
            )}
            {currentPanchayat && (
              <>
                <ChevronRight className="h-3 w-3" />
                <button
                  onClick={handleBackToVillages}
                  className={`hover:text-primary transition-colors ${drillLevel === 'villages' ? 'text-primary font-bold' : ''}`}
                >
                  {currentPanchayat.name}
                </button>
              </>
            )}
            {currentVillage && (
              <>
                <ChevronRight className="h-3 w-3" />
                <button
                  onClick={handleBackToVillages}
                  className={`hover:text-primary transition-colors ${drillLevel === 'students' ? 'text-primary font-bold' : ''}`}
                >
                  {currentVillage.name}
                </button>
              </>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {drillLevel === 'clusters' && 'Students Roster: Clusters'}
            {drillLevel === 'panchayats' && (isSuperAdmin ? `${currentCluster?.name || 'Cluster'} — Panchayats` : 'Students Roster: Panchayats')}
            {drillLevel === 'villages' && `${currentPanchayat?.name} — Villages`}
            {drillLevel === 'students' && `${currentVillage?.name} — Students`}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {drillLevel === 'clusters' && `${clusterGroups.length} total clusters listed in system`}
            {drillLevel === 'panchayats' && (isSuperAdmin ? `${currentCluster?.panchayats.length || 0} panchayats in this cluster` : `${panchayats.length} total Panchayats listed in system`) }
            {drillLevel === 'villages' && `${currentPanchayat?.villages.length || 0} villages under this panchayat`}
            {drillLevel === 'students' && `${currentStudents.length} students enrolled in this village`}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {(drillLevel === 'panchayats' || drillLevel === 'clusters') && isSuperAdmin && (
            <Button
              onClick={() => setActiveFormMode(activeFormMode === 'add-panchayat' ? 'none' : 'add-panchayat')}
              className="gap-1.5 rounded-xl bg-primary text-primary-foreground shadow-sm hover:opacity-95"
            >
              <Plus className="h-4 w-4" />
              <span>Add Panchayat</span>
            </Button>
          )}

          {drillLevel === 'villages' && (
            <Button
              onClick={() => {
                if (activeFormMode === 'add-village') {
                  setActiveFormMode('none');
                } else {
                  setVillageSaveError('');
                  setNewVillageName('');
                  setActiveFormMode('add-village');
                }
              }}
              className="gap-1.5 rounded-xl bg-primary text-primary-foreground shadow-sm hover:opacity-95"
            >
              <Plus className="h-4 w-4" />
              <span>Add Village</span>
            </Button>
          )}

          {drillLevel === 'students' && (
            <>
              <Button
                variant="outline"
                onClick={() => setActiveFormMode(activeFormMode === 'import' ? 'none' : 'import')}
                className="gap-1.5 rounded-xl"
              >
                <Upload className="h-4 w-4 text-primary" />
                <span>Bulk Import (Excel)</span>
              </Button>
              <Button
                onClick={handleOpenAddStudent}
                className="gap-1.5 rounded-xl bg-primary text-primary-foreground shadow-sm hover:opacity-95"
              >
                <Plus className="h-4 w-4" />
                <span>+ Register Student</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 2. Navigation Back Button (Matches reference image "← Back to Years") */}
      {drillLevel !== 'panchayats' && drillLevel !== 'clusters' && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (drillLevel === 'students') handleBackToVillages();
              else if (drillLevel === 'villages') handleBackToPanchayats();
            }}
            className="gap-1.5 rounded-xl text-xs font-semibold shadow-2xs hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>
              {drillLevel === 'students' && 'Back to Villages'}
              {drillLevel === 'villages' && 'Back to Panchayats'}
            </span>
          </Button>

          {/* Quick Context Chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {currentPanchayat && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                <MapPin className="h-3 w-3" />
                {currentPanchayat.name}
              </span>
            )}
            {currentVillage && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground">
                <Home className="h-3 w-3 text-muted-foreground" />
                {currentVillage.name}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. Inline Card Panels (NO POPUP - CLEAN MINIMALIST CARD FORM) */}
      {activeFormMode === 'add-panchayat' && (
        <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-sm animate-in fade-in-0 duration-200">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Create New Panchayat</h2>
              <p className="text-xs text-muted-foreground">Register a new Panchayat node to start adding villages and students.</p>
            </div>
            <button
              onClick={() => setActiveFormMode('none')}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleCreatePanchayat} className="mt-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Enter Panchayat Name (e.g. Karimangalam, Morappur)"
                value={newPanchayatName}
                onChange={(e) => setNewPanchayatName(e.target.value)}
                className="h-10 text-xs rounded-xl"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setActiveFormMode('none')} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl">
                Save Panchayat
              </Button>
            </div>
          </form>
        </div>
      )}

      {activeFormMode === 'add-village' && currentPanchayat && (
        <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-sm animate-in fade-in-0 duration-200">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Add Village to {currentPanchayat.name}</h2>
              <p className="text-xs text-muted-foreground">Add a village hub under this Panchayat.</p>
            </div>
            <button
              disabled={isSavingVillage}
              onClick={() => setActiveFormMode('none')}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleCreateVillage} className="mt-4 flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1">
              {villageSaveError && <p role="alert" className="mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{villageSaveError}</p>}
              <Input
                placeholder="Enter Village Name (e.g. Thimmarayanahalli)"
                value={newVillageName}
                onChange={(e) => { setNewVillageName(e.target.value); setVillageSaveError(''); }}
                className="h-10 text-xs rounded-xl"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" disabled={isSavingVillage} onClick={() => { setActiveFormMode('none'); setVillageSaveError(''); }} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingVillage || !newVillageName.trim()} className="rounded-xl">
                {isSavingVillage ? 'Saving…' : 'Save Village'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Inline Student Add / Edit Card Form */}
      {(activeFormMode === 'add-student' || activeFormMode === 'edit-student') && currentPanchayat && currentVillage && (
        <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-sm animate-in fade-in-0 duration-200">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-bold text-foreground">
                {editingStudent ? `Edit Details: ${editingStudent.name}` : 'Register New Student'}
              </h2>
              <p className="text-xs text-muted-foreground">
                Locked to Panchayat: <span className="font-semibold text-foreground">{currentPanchayat.name}</span> | Village:{' '}
                <span className="font-semibold text-foreground">{currentVillage.name}</span>
              </p>
            </div>
            <button
              onClick={() => {
                setActiveFormMode('none');
                setEditingStudent(null);
              }}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSaveStudent} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Student Name <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="e.g. Kavya S."
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Standard <span className="text-destructive">* (Grades 9–12)</span>
                </label>
                <Select
                  value={studentForm.standard}
                  onValueChange={(val) => setStudentForm({ ...studentForm, standard: val })}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue placeholder="Select Standard" />
                  </SelectTrigger>
                  <SelectContent>
                    {STANDARDS.map((std) => (
                      <SelectItem key={std} value={std}>
                        Standard {std} (Std {std})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Gender
                </label>
                <Select
                  value={studentForm.gender}
                  onValueChange={(val) => setStudentForm({ ...studentForm, gender: val as any })}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Girl / Female</SelectItem>
                    <SelectItem value="male">Boy / Male</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Contact Mobile Number <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <Input
                  type="tel"
                  placeholder="e.g. 98421 12345 (Optional)"
                  value={studentForm.phone}
                  onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Parent / Guardian Name <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <Input
                  placeholder="Father / Mother Name"
                  value={studentForm.parentName}
                  onChange={(e) => setStudentForm({ ...studentForm, parentName: e.target.value })}
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setActiveFormMode('none');
                  setEditingStudent(null);
                }}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl">
                {editingStudent ? 'Save Changes' : 'Register Student'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Inline Bulk Import Card Panel (NO POPUP) */}
      {activeFormMode === 'import' && currentPanchayat && currentVillage && (
        <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-sm animate-in fade-in-0 duration-200">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Bulk Import Students (Excel / CSV)</h2>
              <p className="text-xs text-muted-foreground">
                Importing into <span className="font-semibold text-foreground">{currentPanchayat.name}</span> &gt;{' '}
                <span className="font-semibold text-foreground">{currentVillage.name}</span>
                . The sheet needs only Name, Standard (9-12), and Village; village names must belong to this Panchayat.
              </p>
            </div>
            <button
              onClick={() => setActiveFormMode('none')}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Upload className="h-8 w-8 text-primary" />
              <p className="mt-2 text-xs font-semibold text-foreground">
                {importFileName ? (
                  <span className="text-primary font-bold">{importFileName}</span>
                ) : (
                  'Choose an Excel spreadsheet (.xlsx, .csv) to import'
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Required columns: Name, Standard (9-12), Village.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsingFile}
                  className="rounded-xl"
                >
                  {isParsingFile ? 'Reading spreadsheet...' : 'Select File'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadSample}
                  className="rounded-xl text-primary font-medium"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Download Sample Template
                </Button>
              </div>
            </div>

            {/* Parsed Preview */}
            {importRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Total Read: <span className="font-bold text-foreground">{importRows.length}</span> rows | Valid:{' '}
                    <span className="font-bold text-emerald-600">{importRows.filter((r) => r.isValid).length}</span>
                  </div>
                  <Button onClick={handleConfirmBulkImport} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                    Confirm & Add {importRows.filter((r) => r.isValid).length} Students
                  </Button>
                </div>

                <div className="max-h-60 overflow-y-auto rounded-xl border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
                      <tr>
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5">Std</th>
                        <th className="p-2.5">Village</th>
                        <th className="p-2.5">Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {importRows.slice(0, 50).map((r, i) => (
                        <tr key={i} className={r.isValid ? '' : 'bg-destructive/10'}>
                          <td className="p-2.5 font-medium text-foreground">{r.name || '—'}</td>
                          <td className="p-2.5">Std {r.standard}</td>
                          <td className="p-2.5 text-muted-foreground">{r.villageName || '—'}</td>
                          <td className="p-2.5">
                            {r.isValid ? (
                              <span className="text-emerald-600 font-medium">Ready</span>
                            ) : (
                              <span className="text-destructive">{r.validationError}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isSuperAdmin && drillLevel === 'clusters' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search clusters..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-9 text-xs rounded-xl bg-card"
              />
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Click any cluster to view panchayats and villages
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {clusterGroups
              .filter((cluster) => !search || cluster.name.toLowerCase().includes(search.toLowerCase()))
              .map((cluster) => (
                <div
                  key={cluster.id}
                  onClick={() => handleSelectCluster(cluster.id)}
                  className="group relative flex min-h-[140px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center shadow-xs transition-all hover:border-primary/60 hover:shadow-md cursor-pointer"
                >
                  <h3 className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                    {cluster.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground font-medium">
                    {cluster.panchayats.length} panchayats • {cluster.villageCount} villages • {cluster.studentCount} students
                  </p>
                  <div className="mt-2 text-[11px] font-semibold text-primary/80 group-hover:text-primary flex items-center gap-0.5">
                    <span>View Panchayats</span>
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 4. LEVEL 1: PANCHAYATS CARDS (Minimalist, Rounded Cards matching Reference Image) */}
      {!isSuperAdmin && drillLevel === 'panchayats' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search panchayats..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-9 text-xs rounded-xl bg-card"
              />
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Click any Panchayat card to view villages
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {/* All Summary Card */}
            <div className="group flex min-h-[140px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center shadow-xs transition-all hover:border-primary/50 hover:shadow-md">
              <h3 className="text-xl font-bold tracking-tight text-primary">All Panchayats</h3>
              <p className="mt-1 text-xs text-muted-foreground font-medium">
                {panchayats.reduce((acc, p) => acc + (p.villagesCount || p.villages.length), 0)} villages • {students.length} students
              </p>
            </div>

            {panchayats
              .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
              .map((p) => {
                const sCount = getPanchayatStudentCount(p);
                const vCount = p.villagesCount || p.villages.length;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPanchayat(p)}
                    className="group relative flex min-h-[140px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center shadow-xs transition-all hover:border-primary/60 hover:shadow-md cursor-pointer"
                  >
                    {/* Super Admin Quick Actions on Top Right */}
                    {isSuperAdmin && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <button
                          onClick={() => {
                            setEditingEntity({ type: 'panchayat', id: p.id, name: p.name });
                            setRenameEntityName(p.name);
                          }}
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Rename Panchayat"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setEntityToDelete({ type: 'panchayat', id: p.id, name: p.name })}
                          className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                          title="Delete Panchayat"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <h3 className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                      {p.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground font-medium">
                      {vCount} {vCount === 1 ? 'village' : 'villages'} • {sCount} {sCount === 1 ? 'student' : 'students'}
                    </p>
                    <div className="mt-2 text-[11px] font-semibold text-primary/80 group-hover:text-primary flex items-center gap-0.5">
                      <span>View Villages</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {isSuperAdmin && drillLevel === 'panchayats' && selectedClusterId && currentCluster && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={`Search panchayats in ${currentCluster.name}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-9 text-xs rounded-xl bg-card"
              />
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Click any Panchayat card to view villages
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {currentCluster.panchayats
              .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
              .map((p) => {
                const sCount = getPanchayatStudentCount(p);
                const vCount = p.villagesCount || p.villages.length;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPanchayat(p)}
                    className="group relative flex min-h-[140px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center shadow-xs transition-all hover:border-primary/60 hover:shadow-md cursor-pointer"
                  >
                    <h3 className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                      {p.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground font-medium">
                      {vCount} {vCount === 1 ? 'village' : 'villages'} • {sCount} {sCount === 1 ? 'student' : 'students'}
                    </p>
                    <div className="mt-2 text-[11px] font-semibold text-primary/80 group-hover:text-primary flex items-center gap-0.5">
                      <span>View Villages</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 5. LEVEL 2: VILLAGES CARDS (Under Selected Panchayat) */}
      {drillLevel === 'villages' && currentPanchayat && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={`Search villages in ${currentPanchayat.name}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-9 text-xs rounded-xl bg-card"
              />
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Click a Village card to view schools & students
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {/* All Summary Card for this Panchayat */}
            <div className="group flex min-h-[140px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center shadow-xs">
              <h3 className="text-xl font-bold tracking-tight text-primary">All Villages</h3>
              <p className="mt-1 text-xs text-muted-foreground font-medium">
                {currentPanchayat.villages.length} villages • {getPanchayatStudentCount(currentPanchayat)} students
              </p>
            </div>

            {currentPanchayat.villages
              .filter((v) => !search || v.name.toLowerCase().includes(search.toLowerCase()))
              .map((v) => {
                const sCount = getVillageStudentCount(currentPanchayat.id, v);
                return (
                  <div
                    key={v.id || v.name}
                    onClick={() => handleSelectVillage(v)}
                    className="group relative flex min-h-[140px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center shadow-xs transition-all hover:border-primary/60 hover:shadow-md cursor-pointer"
                  >
                    {/* Super Admin Quick Actions */}
                    {isSuperAdmin && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <button
                          onClick={() => {
                            setEditingEntity({ type: 'village', id: v.id || v.name, name: v.name });
                            setRenameEntityName(v.name);
                          }}
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Rename Village"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setEntityToDelete({ type: 'village', id: v.id || v.name, name: v.name })}
                          className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                          title="Delete Village"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <h3 className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                      {v.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground font-medium">
                      {sCount} {sCount === 1 ? 'student enrolled' : 'students enrolled'}
                    </p>
                    <div className="mt-2 text-[11px] font-semibold text-primary/80 group-hover:text-primary flex items-center gap-0.5">
                      <span>View Students</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* LEVEL 3: STUDENTS CARDS (directly under the selected village) */}
      {drillLevel === 'students' && currentPanchayat && currentVillage && (
        <div className="space-y-4">
          {/* Minimalist Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student by name, code or phone..."
                className="h-9 pl-9 text-xs rounded-xl"
              />
            </div>

            {selectedStd !== 'all' && <Button variant="outline" size="sm" onClick={() => setSelectedStd('all')} className="h-9 rounded-xl text-xs">← All standards</Button>}

            <div className="w-32">
              <Select value={selectedGender} onValueChange={(v) => setSelectedGender(v as any)}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="All Genders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="female">Girls</SelectItem>
                  <SelectItem value="male">Boys</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(search || selectedStd !== 'all' || selectedGender !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSelectedStd('all');
                  setSelectedGender('all');
                }}
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                Reset
              </Button>
            )}
          </div>

          {selectedStd === 'all' ? (
            standardOptions.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <EmptyState
                icon={Users}
                title="No students found in this village"
                description="No student records match these filters. Register a student or use bulk import."
                actionLabel="+ Register Student"
                onAction={handleOpenAddStudent}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {standardOptions.map(([grade, count]) => (
                <div key={grade} className="rounded-2xl border border-border bg-card p-5 text-left shadow-xs transition hover:border-primary/50 hover:shadow-md">
                  <button type="button" onClick={() => setSelectedStd(grade)} className="w-full text-left">
                    <div className="flex items-center justify-between"><span className="inline-flex rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">Standard {grade}</span><GraduationCap className="h-5 w-5 text-primary" /></div>
                    <p className="mt-4 text-2xl font-bold text-foreground">{count}</p><p className="text-xs text-muted-foreground">students</p>
                    <p className="mt-3 text-xs font-semibold text-primary">View student list →</p>
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={count === 0 || attendancePdfStandard === grade}
                    onClick={() => void downloadAttendancePdf(grade)}
                    className="mt-3 w-full gap-1.5 rounded-xl text-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {attendancePdfStandard === grade ? 'Preparing PDF…' : 'Download Attendance'}
                  </Button>
                </div>
              ))}
            </div>
          )) : currentStudents.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center"><EmptyState icon={Users} title={`No students in Standard ${selectedStd}`} description="No students match the selected standard and filters." actionLabel="Back to standards" onAction={() => setSelectedStd('all')} /></div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground"><tr><th className="w-14 px-4 py-3">S.No</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Standard</th><th className="px-4 py-3">Gender</th><th className="px-4 py-3">Mobile Number</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {paginatedStudents.map((student, index) => <tr key={student.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{(studentPage - 1) * studentPageSize + index + 1}</td><td className="px-4 py-3 font-semibold text-foreground">{student.name}</td><td className="px-4 py-3">Standard {standardKey(student.standard)}</td><td className="px-4 py-3 capitalize">{student.gender}</td><td className="px-4 py-3">{student.phone || '—'}</td><td className="px-4 py-3"><Badge variant={student.status === 'active' ? 'success' : 'secondary'} size="sm">{student.status === 'active' ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => setViewingStudent(student)} title="View details"><Eye className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" onClick={() => handleOpenEditStudent(student)} title="Edit student"><Edit3 className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" onClick={() => setStudentToDelete(student)} title="Delete student"><Trash2 className="h-3.5 w-3.5" /></Button></div></td>
                  </tr>)}
                </tbody>
              </table>
              {currentStudents.length > studentPageSize && (
                <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Showing {(studentPage - 1) * studentPageSize + 1}–{Math.min(studentPage * studentPageSize, currentStudents.length)} of {currentStudents.length} students</span>
                  <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={studentPage <= 1} onClick={() => setStudentPage((page) => Math.max(1, page - 1))} className="gap-1"><CaretLeft className="h-3.5 w-3.5" />Previous</Button>
                    <span className="min-w-20 text-center font-semibold">Page {studentPage} of {studentPageCount}</span>
                    <Button type="button" variant="outline" size="sm" disabled={studentPage >= studentPageCount} onClick={() => setStudentPage((page) => Math.min(studentPageCount, page + 1))} className="gap-1">Next<CaretRight className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* View Student Profile In-Card Modal */}
      {viewingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in-0 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Student Profile Details</h3>
              <button
                onClick={() => setViewingStudent(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
                  {viewingStudent.avatarLetter || viewingStudent.name?.charAt(0) || 'S'}
                </div>
                <div>
                  <h4 className="text-base font-bold text-foreground">{viewingStudent.name}</h4>
                  <p className="font-mono text-xs text-muted-foreground">{viewingStudent.code || 'ID not assigned'}</p>
                </div>
                <Badge
                  variant={viewingStudent.status === 'active' ? 'success' : 'secondary'}
                  className="ml-auto"
                >
                  {viewingStudent.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Standard:</span>
                  <span className="font-bold text-foreground">Std {viewingStudent.standard}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gender:</span>
                  <span className="capitalize text-foreground font-medium">{viewingStudent.gender}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date of Birth:</span>
                  <span className="text-foreground">{viewingStudent.dob || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Panchayat:</span>
                  <span className="font-semibold text-foreground">{viewingStudent.panchayatName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Village:</span>
                  <span className="font-semibold text-foreground">{viewingStudent.villageName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contact Phone:</span>
                  <span className="font-mono text-foreground">{viewingStudent.phone || 'Not provided (Optional)'}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    handleOpenEditStudent(viewingStudent);
                    setViewingStudent(null);
                  }}
                  className="rounded-xl"
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1" />
                  Edit Profile
                </Button>
                <Button onClick={() => setViewingStudent(null)} className="rounded-xl">
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Student Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-base font-bold text-foreground">Delete Student</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Are you sure you want to remove <span className="font-semibold text-foreground">{studentToDelete.name}</span> from the roster? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStudentToDelete(null)} className="rounded-xl">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onDeleteStudent(studentToDelete.id);
                  showToast(`Removed student ${studentToDelete.name}`);
                  setStudentToDelete(null);
                }}
                className="rounded-xl"
              >
                Delete Student
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Entity Modal */}
      {editingEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-base font-bold text-foreground">
              Rename {editingEntity.type === 'panchayat' ? 'Panchayat' : 'Village'}
            </h3>
            <div className="mt-3">
              <Input
                value={renameEntityName}
                onChange={(e) => setRenameEntityName(e.target.value)}
                className="h-10 text-xs rounded-xl"
                autoFocus
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingEntity(null)} className="rounded-xl">
                Cancel
              </Button>
              <Button onClick={handleSaveRename} className="rounded-xl">
                Save Name
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Entity Confirmation Modal */}
      {entityToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-base font-bold text-foreground">
              Delete {entityToDelete.type === 'panchayat' ? 'Panchayat' : 'Village'}
            </h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Are you sure you want to delete <span className="font-semibold text-foreground">{entityToDelete.name}</span>?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEntityToDelete(null)} className="rounded-xl">
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmDeleteEntity} className="rounded-xl">
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
