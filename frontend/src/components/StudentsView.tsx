import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Student, Panchayat, Village, UserRole } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { EmptyState } from './ui/EmptyState';
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
  School,
  ArrowLeft,
  ChevronRight,
  Building2,
  Sparkles,
  Pencil,
} from './ui/icons';

interface StudentsViewProps {
  students: Student[];
  panchayats: Panchayat[];
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
  gender: 'male' | 'female';
  standard: string;
  dob: string;
  parentName: string;
  phone: string;
  status: 'active' | 'inactive';
  schoolName?: string;
  isValid: boolean;
  validationError?: string;
}

const STANDARDS = ['5', '6', '7', '8', '9', '10', '11', '12'];

export const StudentsView: React.FC<StudentsViewProps> = ({
  students,
  panchayats,
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

  // Navigation Drill-Down State: 'panchayats' -> 'villages' -> 'schools' -> 'students'
  const [drillLevel, setDrillLevel] = useState<'panchayats' | 'villages' | 'schools' | 'students'>('panchayats');
  const [selectedPanchayatId, setSelectedPanchayatId] = useState<string | null>(null);
  const [selectedVillageId, setSelectedVillageId] = useState<string | null>(null);
  const [selectedSchoolName, setSelectedSchoolName] = useState<string | null>(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedStd, setSelectedStd] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<'all' | 'female' | 'male'>('all');

  // Inline forms (No popups)
  const [activeFormMode, setActiveFormMode] = useState<'none' | 'add-student' | 'edit-student' | 'import' | 'add-panchayat' | 'add-village' | 'add-school'>('none');
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
    standard: '5',
    parentName: '',
    phone: '',
    status: 'active' as 'active' | 'inactive',
    schoolName: '',
  });

  const [newPanchayatName, setNewPanchayatName] = useState('');
  const [newVillageName, setNewVillageName] = useState('');
  const [newSchoolName, setNewSchoolName] = useState('');
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
        setDrillLevel('schools');
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

  // Derive all distinct schools within current village based on existing students
  const villageSchools = useMemo(() => {
    if (!currentPanchayat || !currentVillage) return [];
    const villageStudents = students.filter(
      (s) =>
        s.panchayatId === currentPanchayat.id &&
        (s.villageId === currentVillage.id || s.villageName === currentVillage.name)
    );

    const schoolMap = new Map<string, { name: string; studentCount: number }>();
    villageStudents.forEach((st) => {
      const sch = st.schoolName?.trim();
      if (!sch) return;
      const existing = schoolMap.get(sch);
      if (existing) {
        existing.studentCount += 1;
      } else {
        schoolMap.set(sch, { name: sch, studentCount: 1 });
      }
    });

    return Array.from(schoolMap.values());
  }, [students, currentPanchayat, currentVillage]);

  // Filtered Students when in 'students' view
  const currentStudents = useMemo(() => {
    if (!currentPanchayat || !currentVillage) return [];
    return students.filter((s) => {
      const matchPanchayat = s.panchayatId === currentPanchayat.id;
      const matchVillage = s.villageId === currentVillage.id || s.villageName === currentVillage.name;
      if (!matchPanchayat || !matchVillage) return false;

      if (selectedSchoolName && selectedSchoolName !== 'all') {
        const studentSchool = s.schoolName?.trim() || '';
        if (studentSchool.toLowerCase() !== selectedSchoolName.toLowerCase()) return false;
      }

      if (selectedStd !== 'all' && s.standard !== selectedStd) return false;
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
  }, [students, currentPanchayat, currentVillage, selectedSchoolName, selectedStd, selectedGender, search]);

  // Handlers for Navigation
  const handleSelectPanchayat = (p: Panchayat) => {
    setSelectedPanchayatId(p.id);
    setSelectedVillageId(null);
    setSelectedSchoolName(null);
    setDrillLevel('villages');
    setActiveFormMode('none');
    setSearch('');
  };

  const handleSelectVillage = (v: Village) => {
    setSelectedVillageId(v.id || v.name);
    setSelectedSchoolName(null);
    setDrillLevel('schools');
    setActiveFormMode('none');
    setSearch('');
  };

  const handleSelectSchool = (schoolName: string) => {
    setSelectedSchoolName(schoolName);
    setDrillLevel('students');
    setActiveFormMode('none');
    setSearch('');
  };

  const handleBackToPanchayats = () => {
    setSelectedPanchayatId(null);
    setSelectedVillageId(null);
    setSelectedSchoolName(null);
    setDrillLevel('panchayats');
    setActiveFormMode('none');
    setSearch('');
  };

  const handleBackToVillages = () => {
    setSelectedVillageId(null);
    setSelectedSchoolName(null);
    setDrillLevel('villages');
    setActiveFormMode('none');
    setSearch('');
  };

  const handleBackToSchools = () => {
    setSelectedSchoolName(null);
    setDrillLevel('schools');
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
      standard: '5',
      parentName: '',
      phone: '',
      status: 'active',
      schoolName: selectedSchoolName && selectedSchoolName !== 'all' ? selectedSchoolName : (villageSchools[0]?.name || ''),
    });
    setActiveFormMode('add-student');
  };

  const handleOpenEditStudent = (st: Student) => {
    setEditingStudent(st);
    setStudentForm({
      name: st.name,
      gender: st.gender,
      dob: st.dob || '2010-06-15',
      standard: STANDARDS.includes(st.standard) ? st.standard : '5',
      parentName: st.parentName || '',
      phone: st.phone || '',
      status: st.status || 'active',
      schoolName: st.schoolName || (selectedSchoolName && selectedSchoolName !== 'all' ? selectedSchoolName : ''),
    });
    setActiveFormMode('edit-student');
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim()) {
      alert('Please enter student name.');
      return;
    }
    if (!currentPanchayat || !currentVillage) {
      alert('Active Panchayat and Village context is required.');
      return;
    }

    const targetSchool = studentForm.schoolName.trim() || (selectedSchoolName && selectedSchoolName !== 'all' ? selectedSchoolName : '');

    if (editingStudent) {
      const payload: Partial<Student> = {
        name: studentForm.name.trim(),
        gender: studentForm.gender,
        dob: studentForm.dob,
        standard: studentForm.standard,
        parentName: studentForm.parentName.trim(),
        phone: studentForm.phone.trim(),
        status: studentForm.status,
        schoolName: targetSchool,
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
        schoolName: targetSchool,
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

  const handleCreateVillage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVillageName.trim() || !currentPanchayat) return;
    if (onAddVillage) {
      onAddVillage(currentPanchayat.id, newVillageName.trim());
      showToast(`Added Village "${newVillageName.trim()}" to ${currentPanchayat.name}`);
    }
    setNewVillageName('');
    setActiveFormMode('none');
  };

  const handleCreateSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim()) return;
    setSelectedSchoolName(newSchoolName.trim());
    setDrillLevel('students');
    setNewSchoolName('');
    setActiveFormMode('none');
    showToast(`Created School "${newSchoolName.trim()}". You can now add students.`);
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
      {
        'Student Name': 'Kavya S.',
        'Standard': '5',
        'Gender': 'Female',
        'Date of Birth': '2014-04-15',
        'Contact Phone (Optional)': '9443211223',
        'School (Optional)': selectedSchoolName && selectedSchoolName !== 'all' ? selectedSchoolName : '',
      },
      {
        'Student Name': 'Gokul Nathan',
        'Standard': '8',
        'Gender': 'Male',
        'Date of Birth': '2011-08-20',
        'Contact Phone (Optional)': '',
        'School (Optional)': selectedSchoolName && selectedSchoolName !== 'all' ? selectedSchoolName : '',
      },
      {
        'Student Name': 'Deepika R.',
        'Standard': '10',
        'Gender': 'Female',
        'Date of Birth': '2009-01-10',
        'Contact Phone (Optional)': '9789044556',
        'School (Optional)': selectedSchoolName && selectedSchoolName !== 'all' ? selectedSchoolName : '',
      },
      {
        'Student Name': 'Vignesh M.',
        'Standard': '12',
        'Gender': 'Male',
        'Date of Birth': '2007-11-28',
        'Contact Phone (Optional)': '',
        'School (Optional)': selectedSchoolName && selectedSchoolName !== 'all' ? selectedSchoolName : '',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students_Template');
    XLSX.writeFile(wb, 'TQI_Students_Card_Import_Template.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setIsParsingFile(true);
    setImportRows([]);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

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
          const name = findVal(['name', 'studentname', 'fullname']) || '';
          const rawGender = findVal(['gender', 'sex']).toLowerCase();
          const gender: 'male' | 'female' =
            rawGender.startsWith('m') || rawGender.includes('boy') ? 'male' : 'female';

          const rawStd = findVal(['standard', 'std', 'class', 'grade']);
          let standard = '5';
          const match = rawStd.match(/\d+/);
          if (match && STANDARDS.includes(match[0])) {
            standard = match[0];
          }

          const dob = findVal(['dob', 'birth', 'dateofbirth']) || '2010-06-15';
          const parentName = findVal(['parent', 'father', 'mother', 'guardian']) || '';
          const phone = findVal(['phone', 'mobile', 'contact']) || ''; // Optional
          const rawSchool = findVal(['school', 'center', 'institution']);
          const schoolName = rawSchool || (selectedSchoolName && selectedSchoolName !== 'all' ? selectedSchoolName : '');
          const status = 'active' as const;

          let isValid = true;
          let validationError = '';
          if (!name) {
            isValid = false;
            validationError = 'Missing student name';
          }

          return { name, gender, standard, dob, parentName, phone, status, schoolName, isValid, validationError };
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
      gender: r.gender,
      dob: r.dob,
      standard: r.standard,
      panchayatId: currentPanchayat.id,
      panchayatName: currentPanchayat.name,
      villageId: currentVillage.id,
      villageName: currentVillage.name,
      schoolName: r.schoolName || (selectedSchoolName && selectedSchoolName !== 'all' ? selectedSchoolName : ''),
      parentName: r.parentName,
      phone: r.phone,
      status: r.status,
    }));

    if (onBulkImportStudents) {
      await onBulkImportStudents(formatted, currentPanchayat.clusterId || currentPanchayat.id);
    } else {
      formatted.forEach((st) => onAddStudent(st));
    }

    showToast(`Successfully imported ${formatted.length} students to ${currentVillage.name}`);
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
            <button
              onClick={handleBackToPanchayats}
              className={`hover:text-primary transition-colors ${drillLevel === 'panchayats' ? 'text-primary font-bold' : ''}`}
            >
              Panchayats
            </button>
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
                  onClick={handleBackToSchools}
                  className={`hover:text-primary transition-colors ${drillLevel === 'schools' ? 'text-primary font-bold' : ''}`}
                >
                  {currentVillage.name}
                </button>
              </>
            )}
            {selectedSchoolName && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground font-bold">{selectedSchoolName}</span>
              </>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {drillLevel === 'panchayats' && 'Students Roster: Panchayats'}
            {drillLevel === 'villages' && `${currentPanchayat?.name} — Villages`}
            {drillLevel === 'schools' && `${currentVillage?.name} — Schools & Learning Centers`}
            {drillLevel === 'students' && `${selectedSchoolName} — Enrolled Students`}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {drillLevel === 'panchayats' && `${panchayats.length} total Panchayats listed in system`}
            {drillLevel === 'villages' && `${currentPanchayat?.villages.length || 0} villages under this panchayat`}
            {drillLevel === 'schools' && `${villageSchools.length} learning locations in this village`}
            {drillLevel === 'students' && `${currentStudents.length} active students enrolled in this school`}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {drillLevel === 'panchayats' && isSuperAdmin && (
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
              onClick={() => setActiveFormMode(activeFormMode === 'add-village' ? 'none' : 'add-village')}
              className="gap-1.5 rounded-xl bg-primary text-primary-foreground shadow-sm hover:opacity-95"
            >
              <Plus className="h-4 w-4" />
              <span>Add Village</span>
            </Button>
          )}

          {drillLevel === 'schools' && (
            <Button
              onClick={() => setActiveFormMode(activeFormMode === 'add-school' ? 'none' : 'add-school')}
              className="gap-1.5 rounded-xl bg-primary text-primary-foreground shadow-sm hover:opacity-95"
            >
              <Plus className="h-4 w-4" />
              <span>Add School / Hub</span>
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
      {drillLevel !== 'panchayats' && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (drillLevel === 'students') handleBackToSchools();
              else if (drillLevel === 'schools') handleBackToVillages();
              else if (drillLevel === 'villages') handleBackToPanchayats();
            }}
            className="gap-1.5 rounded-xl text-xs font-semibold shadow-2xs hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>
              {drillLevel === 'students' && 'Back to Schools'}
              {drillLevel === 'schools' && 'Back to Villages'}
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
            {selectedSchoolName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground">
                <School className="h-3 w-3 text-muted-foreground" />
                {selectedSchoolName}
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
              onClick={() => setActiveFormMode('none')}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleCreateVillage} className="mt-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Enter Village Name (e.g. Thimmarayanahalli)"
                value={newVillageName}
                onChange={(e) => setNewVillageName(e.target.value)}
                className="h-10 text-xs rounded-xl"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setActiveFormMode('none')} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl">
                Save Village
              </Button>
            </div>
          </form>
        </div>
      )}

      {activeFormMode === 'add-school' && currentVillage && (
        <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-sm animate-in fade-in-0 duration-200">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Add School / Learning Center in {currentVillage.name}</h2>
              <p className="text-xs text-muted-foreground">Register an institution or learning point under this village.</p>
            </div>
            <button
              onClick={() => setActiveFormMode('none')}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleCreateSchool} className="mt-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Enter School Name (e.g. Govt Higher Secondary School, Model School)"
                value={newSchoolName}
                onChange={(e) => setNewSchoolName(e.target.value)}
                className="h-10 text-xs rounded-xl"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setActiveFormMode('none')} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl">
                Create & Proceed
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
                  Standard <span className="text-destructive">* (Starts from 5th)</span>
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
                  School / Learning Center
                </label>
                <Input
                  placeholder="School Name"
                  value={studentForm.schoolName}
                  onChange={(e) => setStudentForm({ ...studentForm, schoolName: e.target.value })}
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
                {selectedSchoolName ? ` &gt; ${selectedSchoolName}` : ''}. Mobile number is optional; Name & Standard (5-12) are required.
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
                Standard starting from 5th. Mobile number is optional.
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
                        <th className="p-2.5">Gender</th>
                        <th className="p-2.5">Phone (Optional)</th>
                        <th className="p-2.5">School</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {importRows.slice(0, 50).map((r, i) => (
                        <tr key={i} className={r.isValid ? '' : 'bg-destructive/10'}>
                          <td className="p-2.5 font-medium text-foreground">{r.name || '—'}</td>
                          <td className="p-2.5">Std {r.standard}</td>
                          <td className="p-2.5 capitalize">{r.gender}</td>
                          <td className="p-2.5 font-mono text-[11px] text-muted-foreground">{r.phone || '—'}</td>
                          <td className="p-2.5 text-muted-foreground">{r.schoolName || '—'}</td>
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

      {/* 4. LEVEL 1: PANCHAYATS CARDS (Minimalist, Rounded Cards matching Reference Image) */}
      {drillLevel === 'panchayats' && (
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
                      <span>View Schools</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 6. LEVEL 3: SCHOOLS / LEARNING CENTERS CARDS (Under Selected Village) */}
      {drillLevel === 'schools' && currentPanchayat && currentVillage && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={`Search schools in ${currentVillage.name}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-9 text-xs rounded-xl bg-card"
              />
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Click a School to manage student roster & import
            </div>
          </div>

          {villageSchools.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <School className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-3 text-base font-semibold text-foreground">No schools registered in this village</h2>
              <p className="mt-1 text-sm text-muted-foreground">No school will be shown until one is actually registered.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" onClick={() => handleSelectSchool('all')}>
                  View all students
                </Button>
                <Button type="button" onClick={() => setActiveFormMode('add-school')}>
                  <Plus className="mr-1 h-4 w-4" /> Add School / Hub
                </Button>
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {/* All Schools in Village Summary */}
            <div
              onClick={() => handleSelectSchool('all')}
              className="group flex min-h-[140px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center shadow-xs transition-all hover:border-primary/60 hover:shadow-md cursor-pointer"
            >
              <h3 className="text-xl font-bold tracking-tight text-primary">All Schools</h3>
              <p className="mt-1 text-xs text-muted-foreground font-medium">
                {getVillageStudentCount(currentPanchayat.id, currentVillage)} total students in {currentVillage.name}
              </p>
              <div className="mt-2 text-[11px] font-semibold text-primary/80 group-hover:text-primary flex items-center gap-0.5">
                <span>View All Students</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>

            {villageSchools
              .filter((sch) => !search || sch.name.toLowerCase().includes(search.toLowerCase()))
              .map((sch) => (
                <div
                  key={sch.name}
                  onClick={() => handleSelectSchool(sch.name)}
                  className="group flex min-h-[140px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center shadow-xs transition-all hover:border-primary/60 hover:shadow-md cursor-pointer"
                >
                  <h3 className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                    {sch.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground font-medium">
                    {sch.studentCount} {sch.studentCount === 1 ? 'student enrolled' : 'students enrolled'}
                  </p>
                  <div className="mt-2 text-[11px] font-semibold text-primary/80 group-hover:text-primary flex items-center gap-0.5">
                    <span>Manage Roster</span>
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              ))}
          </div>
          )}
        </div>
      )}

      {/* 7. LEVEL 4: STUDENTS CARDS (Card-Based Format replacing flat table) */}
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

            <div className="w-36">
              <Select value={selectedStd} onValueChange={setSelectedStd}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="All Standards" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Standards (5-12)</SelectItem>
                  {STANDARDS.map((s) => (
                    <SelectItem key={s} value={s}>
                      Standard {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

          {/* Student Cards Grid (NO FLAT TABLE) */}
          {currentStudents.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <EmptyState
                icon={Users}
                title="No students found in this school"
                description="No student records match your criteria. Register a new student or use bulk import."
                actionLabel="+ Register Student"
                onAction={handleOpenAddStudent}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {currentStudents.map((st) => (
                <div
                  key={st.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/50 hover:shadow-md"
                >
                  <div>
                    {/* Top Row: Standard Badge & Status */}
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                        Std {st.standard}
                      </span>
                      <Badge variant={st.status === 'active' ? 'success' : 'secondary'} size="sm">
                        {st.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    {/* Student Avatar & Name */}
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                        {st.avatarLetter || st.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <h4
                          onClick={() => setViewingStudent(st)}
                          className="truncate text-base font-bold text-foreground hover:text-primary cursor-pointer transition-colors"
                        >
                          {st.name}
                        </h4>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{st.code || 'ID: —'}</p>
                      </div>
                    </div>

                    {/* Info Lines */}
                    <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Gender:</span>
                        <span className="capitalize font-medium text-foreground">{st.gender}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Contact:</span>
                        <span className="font-mono font-medium text-foreground">
                          {st.phone ? st.phone : <span className="italic text-muted-foreground">Not provided</span>}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>School:</span>
                        <span className="truncate max-w-[140px] font-medium text-foreground" title={st.schoolName || 'Govt High School'}>
                          {st.schoolName || 'Govt High School'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewingStudent(st)}
                      className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Details</span>
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditStudent(st)}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Edit Student"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setStudentToDelete(st)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        title="Delete Student"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
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
                  <span className="text-muted-foreground">School / Hub:</span>
                  <span className="font-semibold text-foreground">{viewingStudent.schoolName || 'Govt High School'}</span>
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
