import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Student, Panchayat } from '../types';
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
} from './ui/icons';

interface StudentsViewProps {
  students: Student[];
  panchayats: Panchayat[];
  initialFilters?: { panchayatId?: string; villageId?: string };
  onAddStudent: (newStudent: Omit<Student, 'id' | 'code' | 'avatarLetter' | 'avatarBg'>) => void;
  onBulkImportStudents?: (students: any[], clusterId: string) => Promise<void> | void;
  onEditStudent?: (id: string, updated: Partial<Student>) => Promise<void> | void;
  onUpdateStudent?: (id: string, updated: Partial<Student>) => void;
  onDeleteStudent: (id: string) => void;
}

interface ParsedStudentRow {
  name: string;
  gender: 'male' | 'female';
  standard: string;
  dob: string;
  parentName: string;
  phone: string;
  status: 'active' | 'inactive';
  isValid: boolean;
  validationError?: string;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  students,
  panchayats,
  initialFilters,
  onAddStudent,
  onBulkImportStudents,
  onEditStudent,
  onUpdateStudent,
  onDeleteStudent,
}) => {
  const [search, setSearch] = useState('');
  const [selectedPanchayatId, setSelectedPanchayatId] = useState<string>('all');
  const [selectedVillageName, setSelectedVillageName] = useState<string>('all');
  const [selectedStd, setSelectedStd] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<'all' | 'female' | 'male'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [importRows, setImportRows] = useState<ParsedStudentRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [importPanchayatId, setImportPanchayatId] = useState<string>('');
  const [importVillageName, setImportVillageName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialFilters?.panchayatId) {
      setSelectedPanchayatId(initialFilters.panchayatId);
      if (initialFilters.villageId) {
        const pan = panchayats.find((p) => p.id === initialFilters.panchayatId);
        const vill = pan?.villages.find(
          (v) => v.id === initialFilters.villageId || v.name === initialFilters.villageId
        );
        if (vill) {
          setSelectedVillageName(vill.name);
        }
      }
    }
  }, [initialFilters, panchayats]);

  const [formData, setFormData] = useState({
    name: '',
    gender: 'female' as 'male' | 'female',
    dob: '2009-06-15',
    standard: '9',
    parentName: '',
    phone: '',
    status: 'active' as 'active' | 'inactive',
    panchayatId: '',
    villageName: '',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const currentPanchayatVillages = useMemo(() => {
    if (selectedPanchayatId === 'all') return [];
    const p = panchayats.find((item) => item.id === selectedPanchayatId);
    return p?.villages || [];
  }, [panchayats, selectedPanchayatId]);

  const formVillages = useMemo(() => {
    if (!formData.panchayatId) return [];
    const p = panchayats.find((item) => item.id === formData.panchayatId);
    return p?.villages || [];
  }, [panchayats, formData.panchayatId]);

  const importVillages = useMemo(() => {
    if (!importPanchayatId) return [];
    const p = panchayats.find((item) => item.id === importPanchayatId);
    return p?.villages || [];
  }, [panchayats, importPanchayatId]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        (s.name || '').toLowerCase().includes(q) ||
        (s.code || '').toLowerCase().includes(q) ||
        (s.parentName || '').toLowerCase().includes(q) ||
        (s.phone || '').includes(q) ||
        (s.villageName || '').toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (selectedPanchayatId !== 'all') {
        const pan = panchayats.find((p) => p.id === selectedPanchayatId);
        const matchesPan =
          s.panchayatId === selectedPanchayatId ||
          (pan && (s.panchayatName || '').toLowerCase() === pan.name.toLowerCase());
        if (!matchesPan) return false;
      }

      if (selectedVillageName !== 'all') {
        const matchesVillage = (s.villageName || '').toLowerCase() === selectedVillageName.toLowerCase();
        if (!matchesVillage) return false;
      }

      if (selectedStd !== 'all' && s.standard !== selectedStd) return false;
      if (selectedGender !== 'all' && s.gender !== selectedGender) return false;
      if (selectedStatus !== 'all' && s.status !== selectedStatus) return false;

      return true;
    });
  }, [
    students,
    search,
    selectedPanchayatId,
    selectedVillageName,
    selectedStd,
    selectedGender,
    selectedStatus,
    panchayats,
  ]);

  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const stats = useMemo(() => {
    const total = students.length;
    const girls = students.filter((s) => s.gender === 'female').length;
    const boys = students.filter((s) => s.gender === 'male').length;
    const std9 = students.filter((s) => s.standard === '9').length;
    const std10 = students.filter((s) => s.standard === '10').length;
    const std11 = students.filter((s) => s.standard === '11').length;
    const std12 = students.filter((s) => s.standard === '12').length;
    const active = students.filter((s) => s.status === 'active').length;
    return { total, girls, boys, std9, std10, std11, std12, active };
  }, [students]);

  const handleOpenAdd = () => {
    setEditingStudent(null);
    setFormData({
      name: '',
      gender: 'female',
      dob: '2009-06-15',
      standard: '9',
      parentName: '',
      phone: '',
      status: 'active',
      panchayatId: panchayats[0]?.id || '',
      villageName: panchayats[0]?.villages[0]?.name || '',
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      gender: student.gender === 'male' ? 'male' : 'female',
      dob: student.dob || '2009-06-15',
      standard: ['9', '10', '11', '12'].includes(student.standard) ? student.standard : '9',
      parentName: student.parentName || '',
      phone: student.phone || '',
      status: student.status || 'active',
      panchayatId: student.panchayatId || panchayats[0]?.id || '',
      villageName: student.villageName || '',
    });
    setShowAddModal(true);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter student name.');
      return;
    }
    if (!formData.panchayatId || !formData.villageName) {
      alert('Please select both a Panchayat and a Village.');
      return;
    }

    const targetPan = panchayats.find((p) => p.id === formData.panchayatId);
    if (!targetPan) return;

    const villageId =
      targetPan.villages.find((v) => v.name === formData.villageName)?.id ||
      formData.villageName.toLowerCase().replace(/\s+/g, '-');

    if (editingStudent) {
      const payload: Partial<Student> = {
        name: formData.name.trim(),
        gender: formData.gender,
        dob: formData.dob,
        standard: formData.standard,
        parentName: formData.parentName.trim(),
        phone: formData.phone.trim(),
        status: formData.status,
        panchayatId: targetPan.id,
        panchayatName: targetPan.name,
        villageId,
        villageName: formData.villageName,
      };
      if (onEditStudent) {
        onEditStudent(editingStudent.id, payload);
      } else if (onUpdateStudent) {
        onUpdateStudent(editingStudent.id, payload);
      }
      showToast(`Updated student ${formData.name.trim()}`);
    } else {
      onAddStudent({
        name: formData.name.trim(),
        gender: formData.gender,
        dob: formData.dob,
        standard: formData.standard,
        panchayatId: targetPan.id,
        panchayatName: targetPan.name,
        villageId,
        villageName: formData.villageName,
        parentName: formData.parentName.trim(),
        phone: formData.phone.trim(),
        status: formData.status,
      });
      showToast(`Added student ${formData.name.trim()} successfully`);
    }

    setShowAddModal(false);
    setEditingStudent(null);
  };

  const handleConfirmDelete = () => {
    if (!studentToDelete) return;
    const name = studentToDelete.name;
    onDeleteStudent(studentToDelete.id);
    if (viewingStudent?.id === studentToDelete.id) {
      setViewingStudent(null);
    }
    showToast(`Deleted student ${name}`);
    setStudentToDelete(null);
  };

  const handleDownloadSample = () => {
    const sample = [
      {
        'Student Name': 'Kavya S.',
        'Gender': 'Female',
        'Standard': '9',
        'Date of Birth': '2010-04-15',
        'Parent Name': 'Srinivasan K.',
        'Contact Phone': '9443211223',
        'Status': 'Active',
      },
      {
        'Student Name': 'Gokul Nathan',
        'Gender': 'Male',
        'Standard': '10',
        'Date of Birth': '2009-08-20',
        'Parent Name': 'Nathan P.',
        'Contact Phone': '9842199887',
        'Status': 'Active',
      },
      {
        'Student Name': 'Deepika R.',
        'Gender': 'Female',
        'Standard': '11',
        'Date of Birth': '2008-01-10',
        'Parent Name': 'Ramesh T.',
        'Contact Phone': '9789044556',
        'Status': 'Active',
      },
      {
        'Student Name': 'Vignesh M.',
        'Gender': 'Male',
        'Standard': '12',
        'Date of Birth': '2007-11-28',
        'Parent Name': 'Murugesan V.',
        'Contact Phone': '9840277889',
        'Status': 'Active',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students_Template');
    XLSX.writeFile(wb, 'TQI_Students_Import_Template.xlsx');
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
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rawJson.length === 0) {
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
          let standard = '9';
          const match = rawStd.match(/\d+/);
          if (match && ['9', '10', '11', '12'].includes(match[0])) {
            standard = match[0];
          }

          const dob = findVal(['dob', 'birth', 'dateofbirth']) || '2009-06-15';
          const parentName = findVal(['parent', 'guardian', 'father', 'mother']) || '';
          const phone = findVal(['phone', 'mobile', 'contact']) || '';
          const rawStatus = findVal(['status']).toLowerCase();
          const status: 'active' | 'inactive' = rawStatus.includes('inact') ? 'inactive' : 'active';

          let isValid = true;
          let validationError = '';
          if (!name) {
            isValid = false;
            validationError = 'Missing student name';
          }

          return { name, gender, standard, dob, parentName, phone, status, isValid, validationError };
        });

        setImportRows(parsed);
      } catch (err) {
        alert('Failed to parse Excel file. Please use a valid .xlsx or .csv template.');
      } finally {
        setIsParsingFile(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmBulkImport = async () => {
    if (!importPanchayatId || !importVillageName) {
      alert('Please select the Target Panchayat and Village for this roster.');
      return;
    }
    const targetPan = panchayats.find((p) => p.id === importPanchayatId);
    if (!targetPan) return;

    const validRows = importRows.filter((r) => r.isValid && r.name.trim().length > 0);
    if (validRows.length === 0) {
      alert('No valid student records found to import.');
      return;
    }

    const villageId =
      targetPan.villages.find((v) => v.name === importVillageName)?.id ||
      importVillageName.toLowerCase().replace(/\s+/g, '-');

    const formatted = validRows.map((r) => ({
      name: r.name,
      gender: r.gender,
      dob: r.dob,
      standard: r.standard,
      panchayatId: targetPan.id,
      panchayatName: targetPan.name,
      villageId,
      villageName: importVillageName,
      parentName: r.parentName,
      phone: r.phone,
      status: r.status,
    }));

    if (onBulkImportStudents) {
      await onBulkImportStudents(formatted, targetPan.clusterId || targetPan.id);
    } else {
formatted.forEach((st) => onAddStudent(st));
    }

    showToast(`Successfully imported ${formatted.length} students to ${importVillageName}`);
    setShowImportModal(false);
    setImportRows([]);
    setImportFileName('');
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Students Directory
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage student enrollments, attendance rosters, and demographics across panchayats and villages.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadSample}
            className="gap-1.5 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Sample Template</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportModal(true)}
            className="gap-1.5 text-xs font-semibold"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Bulk Import (Excel)</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Register Student</span>
          </Button>
        </div>
      </div>

      {/* 2. KPI Stat Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Enrolled</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{stats.total}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5 text-pink-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Girls</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{stats.girls}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Boys</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{stats.boys}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <School className="h-3.5 w-3.5 text-purple-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Std 9 & 10</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{stats.std9 + stats.std10}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <School className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Std 11 & 12</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{stats.std11 + stats.std12}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{stats.active}</p>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-card p-3 shadow-xs">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by student name, code, parent, or village..."
            className="h-9 pl-8 text-xs"
          />
        </div>

        <div className="w-36">
          <Select
            value={selectedStd}
            onValueChange={(val) => {
              setSelectedStd(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Standards" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Standards</SelectItem>
              <SelectItem value="9">Standard 9</SelectItem>
              <SelectItem value="10">Standard 10</SelectItem>
              <SelectItem value="11">Standard 11</SelectItem>
              <SelectItem value="12">Standard 12</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-44">
          <Select
            value={selectedPanchayatId}
            onValueChange={(val) => {
              setSelectedPanchayatId(val);
              setSelectedVillageName('all');
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Panchayats" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Panchayats</SelectItem>
              {panchayats.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-44">
          <Select
            value={selectedVillageName}
            onValueChange={(val) => {
              setSelectedVillageName(val);
              setCurrentPage(1);
            }}
            disabled={selectedPanchayatId === 'all'}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Villages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Villages</SelectItem>
              {currentPanchayatVillages.map((v) => (
                <SelectItem key={v.id || v.name} value={v.name}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-32">
          <Select
            value={selectedGender}
            onValueChange={(val) => {
              setSelectedGender(val as any);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Genders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genders</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-32">
          <Select
            value={selectedStatus}
            onValueChange={(val) => {
              setSelectedStatus(val as any);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(search ||
          selectedPanchayatId !== 'all' ||
          selectedVillageName !== 'all' ||
          selectedStd !== 'all' ||
          selectedGender !== 'all' ||
          selectedStatus !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setSelectedPanchayatId('all');
              setSelectedVillageName('all');
              setSelectedStd('all');
              setSelectedGender('all');
              setSelectedStatus('all');
              setCurrentPage(1);
            }}
            className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Reset Filters
          </Button>
        )}
      </div>

      {/* 4. Enterprise Student Table */}
      <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
              <tr>
                <th className="w-14 px-4 py-3 text-center">S.No</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Std</th>
                <th className="px-4 py-3">Gender</th>
                <th className="px-4 py-3">Panchayat & Village</th>
                <th className="px-4 py-3">Parent / Contact</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <EmptyState
                      icon={Users}
                      title="No students found"
                      description={
                        search || selectedPanchayatId !== 'all'
                          ? 'Try adjusting your search criteria or clear current filters.'
                          : 'No students have been enrolled yet. Register a new student or import roster.'
                      }
                      actionLabel="+ Register Student"
                      onAction={handleOpenAdd}
                    />
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((st, idx) => {
                  const sNo = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={st.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                        {sNo}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {st.avatarLetter || st.name?.charAt(0) || 'S'}
                          </div>
                          <div>
                            <div
                              className="font-semibold text-foreground hover:text-primary cursor-pointer"
                              onClick={() => setViewingStudent(st)}
                            >
                              {st.name}
                            </div>
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {st.code || 'ID: —'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded border border-border bg-muted/40 px-2 py-0.5 font-semibold text-foreground">
                          Std {st.standard}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">
                        {st.gender}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{st.panchayatName || '—'}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{st.villageName || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-foreground">{st.parentName || '—'}</div>
                        <div className="font-mono text-[11px] text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span>{st.phone || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={st.status === 'active' ? 'success' : 'secondary'}
                          size="sm"
                        >
                          {st.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setViewingStudent(st)}
                            title="View Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenEdit(st)}
                            title="Edit Student"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => setStudentToDelete(st)}
                            title="Delete Student"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        {filteredStudents.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row text-xs">
            <div className="text-muted-foreground">
              Showing{' '}
              <span className="font-semibold text-foreground">
                {(currentPage - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-foreground">
                {Math.min(currentPage * pageSize, filteredStudents.length)}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-foreground">
                {filteredStudents.length}
              </span>{' '}
              students
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <CaretLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2 text-xs font-medium text-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <CaretRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Add / Edit Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {editingStudent ? 'Edit Student Details' : 'Register New Student'}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {editingStudent
                    ? 'Update demographic, academic standard, and parent records.'
                    : 'Add a student to the academic roster for village learning centers.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="mt-4 space-y-4 text-xs">
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Student Full Name *
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. Kavya S."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Gender *
                    </label>
                    <Select
                      value={formData.gender}
                      onValueChange={(val: any) => setFormData({ ...formData, gender: val })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Academic Standard *
                    </label>
                    <Select
                      value={formData.standard}
                      onValueChange={(val: any) => setFormData({ ...formData, standard: val })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Standard" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="9">Standard 9</SelectItem>
                        <SelectItem value="10">Standard 10</SelectItem>
                        <SelectItem value="11">Standard 11</SelectItem>
                        <SelectItem value="12">Standard 12</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Target Panchayat *
                    </label>
                    <Select
                      value={formData.panchayatId}
                      onValueChange={(val) => {
                        const targetPan = panchayats.find((p) => p.id === val);
                        setFormData({
                          ...formData,
                          panchayatId: val,
                          villageName: targetPan?.villages[0]?.name || '',
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Panchayat" />
                      </SelectTrigger>
                      <SelectContent>
                        {panchayats.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Target Village *
                    </label>
                    <Select
                      value={formData.villageName}
                      onValueChange={(val) => setFormData({ ...formData, villageName: val })}
                      disabled={!formData.panchayatId}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Village" />
                      </SelectTrigger>
                      <SelectContent>
                        {formVillages.map((v) => (
                          <SelectItem key={v.id || v.name} value={v.name}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Parent / Guardian Name
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. Srinivasan K."
                      value={formData.parentName}
                      onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Contact Phone
                    </label>
                    <Input
                      type="tel"
                      placeholder="e.g. 94432 11223"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Date of Birth
                    </label>
                    <Input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Enrollment Status
                    </label>
                    <Select
                      value={formData.status}
                      onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingStudent ? 'Save Changes' : 'Register Student'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. View Student Profile Modal */}
      {viewingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Student Profile</h3>
              <button
                type="button"
                onClick={() => setViewingStudent(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
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

              <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Standard:</span>
                  <span className="font-semibold text-foreground">Std {viewingStudent.standard}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gender:</span>
                  <span className="capitalize text-foreground">{viewingStudent.gender}</span>
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
                  <span className="text-muted-foreground">Village Learning Hub:</span>
                  <span className="font-semibold text-foreground">{viewingStudent.villageName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parent / Guardian:</span>
                  <span className="text-foreground">{viewingStudent.parentName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone Contact:</span>
                  <span className="font-mono text-foreground">{viewingStudent.phone || '—'}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    handleOpenEdit(viewingStudent);
                    setViewingStudent(null);
                  }}
                  className="gap-1.5"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit Profile</span>
                </Button>
                <Button onClick={() => setViewingStudent(null)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Excel Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Bulk Import Students (Excel)</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Upload an Excel spreadsheet (.xlsx or .csv) to batch import students into a learning center.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Target Panchayat *
                  </label>
                  <Select
                    value={importPanchayatId}
                    onValueChange={(val) => {
                      const p = panchayats.find((item) => item.id === val);
                      setImportPanchayatId(val);
                      setImportVillageName(p?.villages[0]?.name || '');
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select Panchayat" />
                    </SelectTrigger>
                    <SelectContent>
                      {panchayats.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Target Village *
                  </label>
                  <Select
                    value={importVillageName}
                    onValueChange={(val) => setImportVillageName(val)}
                    disabled={!importPanchayatId}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select Village" />
                    </SelectTrigger>
                    <SelectContent>
                      {importVillages.map((v) => (
                        <SelectItem key={v.id || v.name} value={v.name}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Upload Box */}
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-xs font-medium text-foreground">
                  {importFileName ? (
                    <span className="font-semibold text-primary">{importFileName}</span>
                  ) : (
                    'Click to choose an Excel or CSV file'
                  )}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Supported formats: .xlsx, .xls, .csv
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isParsingFile}
                  >
                    {isParsingFile ? 'Parsing...' : 'Select File'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadSample}
                    className="text-primary"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download Template
                  </Button>
                </div>
              </div>

              {/* Parsed Preview */}
              {importRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      Parsed Preview ({importRows.length} rows)
                    </span>
                    <Badge variant="success">
                      {importRows.filter((r) => r.isValid).length} Valid
                    </Badge>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                    <table className="w-full text-left text-[11px]">
                      <thead className="sticky top-0 bg-muted/80 font-medium text-muted-foreground">
                        <tr>
                          <th className="px-3 py-1.5">Name</th>
                          <th className="px-3 py-1.5">Gender</th>
                          <th className="px-3 py-1.5">Std</th>
                          <th className="px-3 py-1.5">Parent</th>
                          <th className="px-3 py-1.5">Phone</th>
                          <th className="px-3 py-1.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {importRows.slice(0, 10).map((r, i) => (
                          <tr key={i} className={r.isValid ? '' : 'bg-destructive/10'}>
                            <td className="px-3 py-1.5 font-medium text-foreground">{r.name || '—'}</td>
                            <td className="px-3 py-1.5 capitalize">{r.gender}</td>
                            <td className="px-3 py-1.5">Std {r.standard}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{r.parentName || '—'}</td>
                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.phone || '—'}</td>
                            <td className="px-3 py-1.5">
                              {r.isValid ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Valid</span>
                              ) : (
                                <span className="text-destructive font-semibold">{r.validationError}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportRows([]);
                    setImportFileName('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmBulkImport}
                  disabled={importRows.filter((r) => r.isValid).length === 0 || !importPanchayatId || !importVillageName}
                >
                  Import {importRows.filter((r) => r.isValid).length} Students
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Delete Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Delete Student Record?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to remove <strong className="text-foreground">{studentToDelete.name}</strong> ({studentToDelete.code || `Std ${studentToDelete.standard}`}) from {studentToDelete.villageName}? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStudentToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
              >
                Delete Student
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-md bg-foreground px-4 py-3 text-xs font-semibold text-background shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-muted-foreground hover:text-background"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};


