import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Student, Panchayat, Village } from '../types';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { ActionButton } from './ui/action-button';

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

type ViewMode = 'split' | 'all' | 'boys' | 'girls';

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
  // Navigation Level: 'panchayats' (level 1) | 'villages' (level 2) | 'roster' (level 3)
  const [selectedPanchayatId, setSelectedPanchayatId] = useState<string | null>(null);
  const [selectedVillageName, setSelectedVillageName] = useState<string | null>(null);

  // Search & Filters
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedStd, setSelectedStd] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('split');

  // Modals & Drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleConfirmDeleteStudent = () => {
    if (!studentToDelete) return;
    const sName = studentToDelete.name;
    onDeleteStudent(studentToDelete.id);
    if (viewingStudent?.id === studentToDelete.id) {
      setViewingStudent(null);
    }
    showToast(`Student ${sName} deleted successfully`);
    setStudentToDelete(null);
  };

  // Excel Bulk Import States
  const [importRows, setImportRows] = useState<ParsedStudentRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [importPanchayatId, setImportPanchayatId] = useState<string>('');
  const [importVillageName, setImportVillageName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize when initialFilters change from other screens (e.g. Dashboard)
  useEffect(() => {
    if (initialFilters?.panchayatId) {
      setSelectedPanchayatId(initialFilters.panchayatId);
      if (initialFilters.villageId) {
        const pan = panchayats.find((p) => p.id === initialFilters.panchayatId);
        const vill = pan?.villages.find((v) => v.id === initialFilters.villageId || v.name === initialFilters.villageId);
        if (vill) {
          setSelectedVillageName(vill.name);
        }
      }
    }
  }, [initialFilters, panchayats]);

  // Active Panchayat & Village objects
  const activePanchayat = useMemo(() => {
    return panchayats.find((p) => p.id === selectedPanchayatId) || null;
  }, [panchayats, selectedPanchayatId]);

  const activeVillage = useMemo(() => {
    if (!activePanchayat || !selectedVillageName) return null;
    return (
      activePanchayat.villages.find(
        (v) => v.name.toLowerCase() === selectedVillageName.toLowerCase() || v.id === selectedVillageName
      ) || null
    );
  }, [activePanchayat, selectedVillageName]);

  // Form State for Add / Edit Student
  // Standard options strictly 9 to 12 as requested: 9, 10, 11, 12
  const [formData, setFormData] = useState({
    name: '',
    gender: 'female' as 'male' | 'female',
    dob: '2009-06-15',
    standard: '9', // 9 to 12
    parentName: '',
    phone: '',
    status: 'active' as 'active' | 'inactive',
    panchayatId: '',
    villageName: '',
  });

  // Students filtering within the selected village or overall
  const villageStudents = useMemo(() => {
    if (!activePanchayat || !selectedVillageName) return [];
    return students.filter(
      (s) =>
        (s.panchayatId === activePanchayat.id || s.panchayatName.toLowerCase() === activePanchayat.name.toLowerCase()) &&
        (s.villageName.toLowerCase() === selectedVillageName.toLowerCase() || s.villageId === activeVillage?.id)
    );
  }, [students, activePanchayat, selectedVillageName, activeVillage]);

  const filteredRosterStudents = useMemo(() => {
    return villageStudents.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
        s.code.toLowerCase().includes(globalSearch.toLowerCase()) ||
        s.parentName.toLowerCase().includes(globalSearch.toLowerCase()) ||
        s.phone.includes(globalSearch);

      const matchStd = !selectedStd || s.standard === selectedStd;
      return matchSearch && matchStd;
    });
  }, [villageStudents, globalSearch, selectedStd]);

  // Gender breakdown
  const boyStudents = useMemo(() => filteredRosterStudents.filter((s) => s.gender === 'male'), [filteredRosterStudents]);
  const girlStudents = useMemo(() => filteredRosterStudents.filter((s) => s.gender === 'female'), [filteredRosterStudents]);

  // Overall Cluster Student Summary
  const clusterTotalStudents = students.length;
  const clusterBoys = students.filter((s) => s.gender === 'male').length;
  const clusterGirls = students.filter((s) => s.gender === 'female').length;

  // Handlers for hierarchical card navigation
  const handleSelectPanchayat = (panchayatId: string) => {
    setSelectedPanchayatId(panchayatId);
    setSelectedVillageName(null);
    setGlobalSearch('');
    setSelectedStd('');
  };

  const handleSelectVillage = (villageName: string) => {
    setSelectedVillageName(villageName);
    setGlobalSearch('');
    setSelectedStd('');
    setViewMode('split');
  };

  const handleBackToPanchayats = () => {
    setSelectedPanchayatId(null);
    setSelectedVillageName(null);
    setGlobalSearch('');
    setSelectedStd('');
  };

  const handleBackToVillages = () => {
    setSelectedVillageName(null);
    setGlobalSearch('');
    setSelectedStd('');
  };

  // Open Add Student Modal
  const handleOpenAddModal = () => {
    setEditingStudent(null);
    setFormData({
      name: '',
      gender: 'female',
      dob: '2009-06-15',
      standard: '9',
      parentName: '',
      phone: '',
      status: 'active',
      panchayatId: activePanchayat?.id || '',
      villageName: selectedVillageName || '',
    });
    setShowAddModal(true);
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      gender: student.gender === 'male' ? 'male' : 'female',
      dob: student.dob || '2009-06-15',
      standard: ['9', '10', '11', '12'].includes(student.standard) ? student.standard : '9',
      parentName: student.parentName || '',
      phone: student.phone || '+91 ',
      status: student.status || 'active',
      panchayatId: student.panchayatId || activePanchayat?.id || '',
      villageName: student.villageName || selectedVillageName || '',
    });
    setShowAddModal(true);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter student name');
      return;
    }

    if (!formData.panchayatId || !formData.villageName) {
      alert('Please select a Target Panchayat and Village.');
      return;
    }

    const targetPanchayat = panchayats.find(p => p.id === formData.panchayatId);
    if (!targetPanchayat) return;

    const currentVillageId = targetPanchayat.villages.find(v => v.name === formData.villageName)?.id || formData.villageName.toLowerCase().replace(/\s+/g, '-');

    if (editingStudent) {
      if (onEditStudent) {
        onEditStudent(editingStudent.id, {
          name: formData.name.trim(),
          gender: formData.gender,
          dob: formData.dob,
          standard: formData.standard,
          parentName: formData.parentName.trim(),
          phone: formData.phone.trim(),
          status: formData.status,
        });
      } else if (onUpdateStudent) {
        onUpdateStudent(editingStudent.id, {
          name: formData.name.trim(),
          gender: formData.gender,
          dob: formData.dob,
          standard: formData.standard,
          parentName: formData.parentName.trim(),
          phone: formData.phone.trim(),
          status: formData.status,
        });
      }
      showToast(`Updated student ${formData.name.trim()}`);
      setEditingStudent(null);
    } else {
      onAddStudent({
        name: formData.name.trim(),
        gender: formData.gender,
        dob: formData.dob,
        standard: formData.standard,
        panchayatId: activePanchayat.id,
        panchayatName: activePanchayat.name,
        villageId: currentVillageId,
        villageName: selectedVillageName,
        parentName: formData.parentName.trim(),
        phone: formData.phone.trim(),
        status: formData.status,
      });
      showToast(`Added student ${formData.name.trim()} successfully`);
    }

    setShowAddModal(false);
  };

  // ==========================================
  // EXCEL IMPORT & BULK UPLOAD HANDLERS
  // ==========================================

  const handleDownloadSampleExcel = () => {
    const sampleData = [
      {
        'Student Name': 'Kavya S.',
        'Gender': 'Female',
        'Standard': '9',
        'Date of Birth': '2010-04-15',
        'Parent Name': 'Srinivasan K.',
        'Contact Phone': '+91 94432 11223',
        'Status': 'Active',
      },
      {
        'Student Name': 'Gokul Nathan',
        'Gender': 'Male',
        'Standard': '10',
        'Date of Birth': '2009-08-20',
        'Parent Name': 'Nathan P.',
        'Contact Phone': '+91 98421 99887',
        'Status': 'Active',
      },
      {
        'Student Name': 'Deepika R.',
        'Gender': 'Female',
        'Standard': '11',
        'Date of Birth': '2008-01-10',
        'Parent Name': 'Ramesh T.',
        'Contact Phone': '+91 97890 44556',
        'Status': 'Active',
      },
      {
        'Student Name': 'Vignesh M.',
        'Gender': 'Male',
        'Standard': '12',
        'Date of Birth': '2007-11-28',
        'Parent Name': 'Murugesan V.',
        'Contact Phone': '+91 98402 77889',
        'Status': 'Active',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students_Template');
    XLSX.writeFile(wb, `Student_Import_Template_${selectedVillageName || 'Village'}.xlsx`);
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
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rawJson.length === 0) {
          alert('The uploaded sheet is empty. Please check the file.');
          setIsParsingFile(false);
          return;
        }

        const parsed: ParsedStudentRow[] = rawJson.map((row) => {
          // Normalize column names
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
          const numMatch = rawStd.match(/\d+/);
          if (numMatch) {
            const num = numMatch[0];
            if (['9', '10', '11', '12'].includes(num)) {
              standard = num;
            } else {
              standard = '9'; // default fallback to 9
            }
          }

          const dob = findVal(['dob', 'birth', 'dateofbirth']) || '2009-06-15';
          const parentName = findVal(['parent', 'guardian', 'father', 'mother']) || '';
          const phone = findVal(['phone', 'mobile', 'contact']) || '+91 ';
          const rawStatus = findVal(['status']).toLowerCase();
          const status: 'active' | 'inactive' = rawStatus.includes('inact') ? 'inactive' : 'active';

          let isValid = true;
          let validationError = '';
          if (!name) {
            isValid = false;
            validationError = 'Student name is missing';
          }

          return {
            name,
            gender,
            standard,
            dob,
            parentName,
            phone,
            status,
            isValid,
            validationError,
          };
        });

        setImportRows(parsed);
      } catch (err) {
        console.error('Error reading excel file:', err);
        alert('Could not read Excel file. Please ensure it is a valid .xlsx or .csv file.');
      } finally {
        setIsParsingFile(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmBulkImport = () => {
    if (!importPanchayatId || !importVillageName) {
      alert('Please select a Panchayat and Village before importing.');
      return;
    }
    const tgtPanchayat = panchayats.find(p => p.id === importPanchayatId);
    if (!tgtPanchayat) return;

    const validRows = importRows.filter((r) => r.isValid && r.name.trim().length > 0);
    if (validRows.length === 0) {
      alert('No valid student records found to import.');
      return;
    }

    const currentVillageId = activeVillage?.id || selectedVillageName.toLowerCase().replace(/\s+/g, '-');

    const formattedStudents = validRows.map((r) => ({
      name: r.name,
      gender: r.gender,
      dob: r.dob,
      standard: r.standard,
      panchayatId: activePanchayat.id,
      panchayatName: activePanchayat.name,
      villageId: currentVillageId,
      villageName: selectedVillageName,
      parentName: r.parentName,
      phone: r.phone,
      status: r.status,
    }));

    if (onBulkImportStudents) {
      onBulkImportStudents(formattedStudents, tgtPanchayat.clusterId || tgtPanchayat.cluster || '');
    } else {
      formattedStudents.forEach((st) => onAddStudent(st));
    }

    setImportSuccessMessage(
      `Successfully imported ${formattedStudents.length} students into ${selectedVillageName}, ${activePanchayat.name}!`
    );
    setShowImportModal(false);
    setImportRows([]);
    setImportFileName('');

    setTimeout(() => {
      setImportSuccessMessage(null);
    }, 6000);
  };

  // ==========================================
  // RENDER: LEVEL 1 (PANCHAYATS CARDS)
  // ==========================================
  if (!selectedPanchayatId) {
    return (
      <div className="w-full space-y-6">
        {/* 1. Cardless Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                Students by Panchayat
              </h1>
              <Badge color="primary" size="sm">
                {clusterTotalStudents} Total
              </Badge>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Select any Panchayat below to explore its villages and manage student rosters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setImportPanchayatId('');
                setImportVillageName('');
                setShowImportModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5 transition"
            >
              <span>Bulk Import (Excel)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                handleOpenAddModal();
                setFormData((prev) => ({ ...prev, panchayatId: '', villageName: '' }));
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition"
            >
              <span>Add Student</span>
            </button>
          </div>
        </div>

        {/* 2. Compact Metric Cards (counts & status only) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Enrolled</div>
            <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{clusterTotalStudents}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-500 dark:text-brand-400">👦 Boys</div>
            <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{clusterBoys}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="text-xs font-semibold uppercase tracking-wider text-orange-500 dark:text-orange-400">👧 Girls</div>
            <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{clusterGirls}</div>
          </div>
        </div>

        {/* 3. Cardless Search Bar */}
        <div className="relative w-full max-w-sm">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[18px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Search panchayats or cluster..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>

        {importSuccessMessage && (
          <div className="rounded-xl border border-success-200 bg-success-50 p-4 text-xs font-medium text-success-600 dark:border-success-900/40 dark:bg-success-500/10 dark:text-success-400 flex items-center justify-between">
            <span>{importSuccessMessage}</span>
            <button
              type="button"
              onClick={() => setImportSuccessMessage(null)}
              className="text-success-600 hover:text-success-800 dark:text-success-400"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* 4. Cardless Grid List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {panchayats
            .filter((p) => p.name.toLowerCase().includes(globalSearch.toLowerCase()))
            .map((panchayat) => {
              const panStudents = students.filter(
                (s) => s.panchayatId === panchayat.id || s.panchayatName.toLowerCase() === panchayat.name.toLowerCase()
              );
              const boysCount = panStudents.filter((s) => s.gender === 'male').length;
              const girlsCount = panStudents.filter((s) => s.gender === 'female').length;

              return (
                <div
                  key={panchayat.id}
                  onClick={() => handleSelectPanchayat(panchayat.id)}
                  className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs transition-all hover:border-brand-300 dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-brand-800 flex flex-col justify-between cursor-pointer"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-semibold uppercase text-gray-400 block">
                          {panchayat.cluster} Cluster
                        </span>
                        <h2 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-brand-500 transition-colors mt-0.5">
                          {panchayat.name}
                        </h2>
                      </div>
                      <Badge
                        color={
                          panchayat.status === 'On Track'
                            ? 'success'
                            : panchayat.status === 'Correction Required'
                              ? 'warning'
                              : 'error'
                        }
                        size="sm"
                      >
                        {panchayat.status}
                      </Badge>
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      <span>{panchayat.villages.length || panchayat.villagesCount} Villages &middot; {panStudents.length} Students</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50/80 p-2.5 text-xs dark:bg-white/[0.02]">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">👦</span>
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase font-semibold">Boys</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white">{boysCount}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">👧</span>
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase font-semibold">Girls</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white">{girlsCount}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {panchayat.villages.map((v) => (
                        <span
                          key={v.id}
                          className="rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        >
                          {v.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-brand-500 group-hover:translate-x-0.5 transition-transform">
                    <span>View Villages</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: LEVEL 2 (VILLAGES IN PANCHAYAT)
  // ==========================================
  if (activePanchayat && !selectedVillageName) {
    const panchayatStudents = students.filter(
      (s) => s.panchayatId === activePanchayat.id || s.panchayatName.toLowerCase() === activePanchayat.name.toLowerCase()
    );

    return (
      <div className="w-full space-y-6">
        {/* 1. Cardless Page Header with Breadcrumbs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
              <button
                type="button"
                onClick={handleBackToPanchayats}
                className="hover:text-brand-500 font-semibold"
              >
                Panchayats
              </button>
              <span>/</span>
              <span className="font-semibold text-gray-800 dark:text-white">{activePanchayat.name}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2.5">
              <span>{activePanchayat.name}</span>
              <Badge color="primary" size="sm">
                {activePanchayat.villages.length} Villages
              </Badge>
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Select a village card to view its student roster (Standards 9 to 12).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => { setImportPanchayatId(activePanchayat?.id || ''); setImportVillageName(''); setShowImportModal(true); }}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5 transition"
            >
              <span>Bulk Import</span>
            </button>
            <button
              type="button"
              onClick={() => { handleOpenAddModal(); setFormData(prev => ({ ...prev, panchayatId: activePanchayat?.id || '', villageName: '' })); }}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition"
            >
              <span>Add Student</span>
            </button>
            <button
              type="button"
              onClick={handleBackToPanchayats}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 transition"
            >
              <span>Back</span>
            </button>
          </div>
        </div>

        {/* 2. Villages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activePanchayat.villages.map((village) => {
            const vStudents = panchayatStudents.filter(
              (s) => s.villageName.toLowerCase() === village.name.toLowerCase() || s.villageId === village.id
            );
            const vBoys = vStudents.filter((s) => s.gender === 'male').length;
            const vGirls = vStudents.filter((s) => s.gender === 'female').length;

            const std9 = vStudents.filter((s) => s.standard === '9').length;
            const std10 = vStudents.filter((s) => s.standard === '10').length;
            const std11 = vStudents.filter((s) => s.standard === '11').length;
            const std12 = vStudents.filter((s) => s.standard === '12').length;

            return (
              <div
                key={village.id}
                onClick={() => handleSelectVillage(village.name)}
                className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs transition-all hover:border-brand-300 dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-brand-800 flex flex-col justify-between cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-semibold uppercase text-gray-400 block">Village</span>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-brand-500 transition-colors mt-0.5">
                        {village.name}
                      </h3>
                    </div>
                    <Badge color="primary" size="sm">
                      {vStudents.length} Students
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50/80 p-2.5 text-xs dark:bg-white/[0.02]">
                    <div className="flex items-center gap-1.5">
                      <span>👦</span>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-semibold">Boys</div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">{vBoys}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span>👧</span>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-semibold">Girls</div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">{vGirls}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold uppercase text-gray-400 mb-1.5">Standard Distribution</div>
                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      <div className="rounded-lg border border-gray-200 p-1 dark:border-gray-700">
                        <div className="text-[9px] text-gray-400 font-bold">9th</div>
                        <div className="text-xs font-bold text-brand-500">{std9}</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 p-1 dark:border-gray-700">
                        <div className="text-[9px] text-gray-400 font-bold">10th</div>
                        <div className="text-xs font-bold text-brand-500">{std10}</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 p-1 dark:border-gray-700">
                        <div className="text-[9px] text-gray-400 font-bold">11th</div>
                        <div className="text-xs font-bold text-brand-500">{std11}</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 p-1 dark:border-gray-700">
                        <div className="text-[9px] text-gray-400 font-bold">12th</div>
                        <div className="text-xs font-bold text-brand-500">{std12}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-brand-500 group-hover:translate-x-0.5 transition-transform">
                  <span>Open Student Roster</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: LEVEL 3 (STUDENTS ROSTER IN VILLAGE)
  // ==========================================
  return (
    <div className="w-full space-y-6">
      {/* 1. Cardless Page Header with Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
            <button
              type="button"
              onClick={handleBackToPanchayats}
              className="hover:text-brand-500 font-semibold"
            >
              Panchayats
            </button>
            <span>/</span>
            <button
              type="button"
              onClick={handleBackToVillages}
              className="hover:text-brand-500 font-semibold"
            >
              {activePanchayat?.name}
            </button>
            <span>/</span>
            <span className="font-semibold text-gray-800 dark:text-white">{selectedVillageName}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {selectedVillageName} Roster
            </h1>
            <Badge color="primary" size="sm">
              {filteredRosterStudents.length} Students
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {activePanchayat?.name} Panchayat &middot; Standards 9 to 12
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => { setImportPanchayatId(activePanchayat?.id || ''); setImportVillageName(selectedVillageName || ''); setShowImportModal(true); }}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 transition"
          >
            <span>Import Excel</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition"
          >
            <span>Add Student</span>
          </button>
          <button
            type="button"
            onClick={handleBackToVillages}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 transition"
          >
            <span>Villages</span>
          </button>
        </div>
      </div>

      {/* 2. Cardless Filter and View Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[18px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Search student by name or code..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            {['', '9', '10', '11', '12'].map((std) => (
              <button
                key={std}
                type="button"
                onClick={() => setSelectedStd(std)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  selectedStd === std
                    ? 'bg-brand-500 text-white shadow-theme-xs'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                }`}
              >
                {std === '' ? 'All (9-12)' : `Std ${std}`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 border-l border-gray-200 pl-2 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                viewMode === 'split'
                  ? 'bg-brand-500 text-white shadow-theme-xs'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
              }`}
            >
              Split
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                viewMode === 'all'
                  ? 'bg-brand-500 text-white shadow-theme-xs'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Roster Views */}
      {viewMode === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Boys Column */}
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02] flex flex-col">
            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">👦</span>
                <span className="font-bold text-gray-900 dark:text-white text-sm">Boys Roster</span>
              </div>
              <Badge color="primary" size="sm">
                {boyStudents.length} Boys
              </Badge>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800/60 p-2 flex-1 overflow-y-auto max-h-[560px]">
              {boyStudents.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  No boys enrolled in this selection.
                </div>
              ) : (
                boyStudents.map((student) => (
                  <div
                    key={student.id}
                    onClick={() => setViewingStudent(student)}
                    className="p-3 hover:bg-gray-50/80 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer group dark:hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center font-bold text-xs flex-shrink-0 dark:bg-brand-500/10 dark:text-brand-400">
                        {student.avatarLetter}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-brand-500">
                            {student.name}
                          </h4>
                          <Badge color="light" size="sm">
                            Std {student.standard}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Parent: {student.parentName || 'N/A'} &middot; {student.phone}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleEditStudent(student)}
                        className="p-1 text-gray-400 hover:text-brand-500 rounded"
                        title="Edit Student"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudentToDelete(student)}
                        className="p-1 text-gray-400 hover:text-error-500 rounded"
                        title="Delete Student"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Girls Column */}
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02] flex flex-col">
            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">👧</span>
                <span className="font-bold text-gray-900 dark:text-white text-sm">Girls Roster</span>
              </div>
              <Badge color="warning" size="sm">
                {girlStudents.length} Girls
              </Badge>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800/60 p-2 flex-1 overflow-y-auto max-h-[560px]">
              {girlStudents.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  No girls enrolled in this selection.
                </div>
              ) : (
                girlStudents.map((student) => (
                  <div
                    key={student.id}
                    onClick={() => setViewingStudent(student)}
                    className="p-3 hover:bg-gray-50/80 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer group dark:hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center font-bold text-xs flex-shrink-0 dark:bg-orange-500/10 dark:text-orange-400">
                        {student.avatarLetter}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-orange-500">
                            {student.name}
                          </h4>
                          <Badge color="light" size="sm">
                            Std {student.standard}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Parent: {student.parentName || 'N/A'} &middot; {student.phone}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleEditStudent(student)}
                        className="p-1 text-gray-400 hover:text-brand-500 rounded"
                        title="Edit Student"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudentToDelete(student)}
                        className="p-1 text-gray-400 hover:text-error-500 rounded"
                        title="Delete Student"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. TABLE VIEW */}
      {(viewMode === 'all' || viewMode === 'boys' || viewMode === 'girls') && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <table className="w-full text-left border-collapse">
            <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
              <tr>
                <th className="px-5 py-3.5">Code</th>
                <th className="px-5 py-3.5">Student Name</th>
                <th className="px-5 py-3.5">Gender</th>
                <th className="px-5 py-3.5">Standard</th>
                <th className="px-5 py-3.5">Parent / Guardian</th>
                <th className="px-5 py-3.5">Phone</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
              {(viewMode === 'boys' ? boyStudents : viewMode === 'girls' ? girlStudents : filteredRosterStudents).length ===
              0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-gray-400">
                    No students found matching the selected filters.
                  </td>
                </tr>
              ) : (
                (viewMode === 'boys' ? boyStudents : viewMode === 'girls' ? girlStudents : filteredRosterStudents).map(
                  (student) => (
                    <tr
                      key={student.id}
                      onClick={() => setViewingStudent(student)}
                      className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5 font-mono text-gray-400">{student.code}</td>
                      <td className="px-5 py-3.5 font-bold text-gray-900 dark:text-white">{student.name}</td>
                      <td className="px-5 py-3.5">
                        <Badge color={student.gender === 'male' ? 'primary' : 'warning'} size="sm">
                          {student.gender === 'male' ? '👦 Boy' : '👧 Girl'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-gray-700 dark:text-gray-300 font-medium">
                        {student.standard}th Standard
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{student.parentName || '—'}</td>
                      <td className="px-5 py-3.5 font-mono text-gray-500 dark:text-gray-400">{student.phone}</td>
                      <td className="px-5 py-3.5">
                        <Badge color={student.status === 'active' ? 'success' : 'light'} size="sm">
                          {student.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleEditStudent(student)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-white/5 dark:hover:text-brand-400 transition"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudentToDelete(student)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10 dark:hover:text-error-400 transition"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ==========================================
          ADD / EDIT STUDENT MODAL
          - Standard 9 to 12
          - Panchayat & Village removed (automatic)
         ========================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-[99999] flex justify-end">
          <div
            className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm transition-opacity"
            onClick={() => setShowAddModal(false)}
          />

          <div className="relative w-full max-w-md bg-white shadow-sm flex flex-col h-full z-10 animate-[fadeIn_0.2s_ease-out]">
            <div className="px-6 py-4 border-b border-[#c4c6d3] flex items-center justify-between bg-[#f4f3fb]">
              <h2 className="text-[17px] font-bold text-[#002869] flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">person_add</span>
                {editingStudent ? 'Edit Student' : 'Add New Student'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-[#434652] hover:bg-[#e8e7ef] rounded-full transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Target Location */}
                <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-gray-800 rounded-xl p-3.5 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Target Panchayat *</label>
                    <Select
                      value={formData.panchayatId || (panchayats[0]?.id ?? undefined)}
                      onValueChange={(val) => setFormData({ ...formData, panchayatId: val, villageName: '' })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Panchayat" />
                      </SelectTrigger>
                      <SelectContent>
                        {panchayats.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Target Village *</label>
                    <Select
                      value={formData.villageName || (panchayats.find(p => p.id === formData.panchayatId)?.villages[0]?.name ?? undefined)}
                      onValueChange={(val) => setFormData({ ...formData, villageName: val })}
                      disabled={!formData.panchayatId}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Village" />
                      </SelectTrigger>
                      <SelectContent>
                        {panchayats.find(p => p.id === formData.panchayatId)?.villages.map(v => (
                          <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                <label className="block text-[12px] font-bold text-[#002869] mb-1">Student Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter student name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869] h-[38px]"
                />
              </div>

              {/* Gender Selection */}
              <div>
                <label className="block text-[12px] font-bold text-[#002869] mb-1">Gender *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: 'male' })}
                    className={`py-2 px-3 rounded-md border text-[13px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      formData.gender === 'male'
                        ? 'bg-[#dae2ff] border-[#002869] text-[#001947]'
                        : 'border-[#c4c6d3] bg-white text-[#434652] hover:bg-[#f4f3fb]'
                    }`}
                  >
                    <span>ðŸ‘¦</span>
                    <span>Boy / Male</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: 'female' })}
                    className={`py-2 px-3 rounded-md border text-[13px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      formData.gender === 'female'
                        ? 'bg-[#ffdbc8] border-[#fb7800] text-[#592600]'
                        : 'border-[#c4c6d3] bg-white text-[#434652] hover:bg-[#f4f3fb]'
                    }`}
                  >
                    <span>ðŸ‘§</span>
                    <span>Girl / Female</span>
                  </button>
                </div>
              </div>

              {/* Standard strictly 9 to 12 as requested */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-bold text-[#002869] mb-1">Standard (Class) *</label>
                  <Select
                    value={formData.standard}
                    onValueChange={(val) => setFormData({ ...formData, standard: val })}
                  >
                    <SelectTrigger className="w-full h-[38px] text-[13px] border-[#c4c6d3] font-bold text-[#002869]">
                      <SelectValue placeholder="Standard" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9">9th Standard</SelectItem>
                      <SelectItem value="10">10th Standard</SelectItem>
                      <SelectItem value="11">11th Standard</SelectItem>
                      <SelectItem value="12">12th Standard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#002869] mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869] h-[38px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#002869] mb-1">Parent / Guardian Name</label>
                <input
                  type="text"
                  placeholder="Enter parent or guardian name"
                  value={formData.parentName}
                  onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869] h-[38px]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#002869] mb-1">Contact Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869] h-[38px]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#002869] mb-1">Enrollment Status</label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData({ ...formData, status: val as 'active' | 'inactive' })}
                >
                  <SelectTrigger className="w-full h-[38px] text-[13px] border-[#c4c6d3]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 border-t border-[#c4c6d3] bg-[#faf8ff] flex justify-end gap-3 -mx-6 -mb-6 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-[#747783] text-[#434652] font-bold text-[13px] rounded-md hover:bg-[#f4f3fb] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#002869] text-white font-bold text-[13px] rounded-md hover:bg-[#0b3d91] transition-colors shadow-xs cursor-pointer"
                >
                  {editingStudent ? 'Update Student' : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          EXCEL BULK IMPORT MODAL
         ========================================== */}
      {showImportModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-gray-900/75 backdrop-blur-sm">
          <div className="bg-white rounded-md shadow-sm w-full max-w-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out] flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#c4c6d3] flex justify-between items-center bg-[#f4f3fb]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-[#002869] text-white flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[18px]">table_view</span>
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-[#002869]">Bulk Import Students via Excel</h3>
                  <p className="text-[11px] text-[#434652]">
                    Upload and automatically enroll students into a village.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportRows([]);
                  setImportFileName('');
                }}
                className="p-1.5 text-[#434652] hover:bg-[#e8e7ef] rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5 flex-1 overflow-y-auto">
              {/* Target Location */}
              <div className="grid grid-cols-2 gap-3 bg-[#f4f3fb] border border-[#c4c6d3]/60 rounded-md p-3.5">
                <div>
                  <label className="block text-[12px] font-bold text-[#002869] mb-1">Target Panchayat *</label>
                  <Select
                    value={importPanchayatId}
                    onValueChange={(val) => {
                      setImportPanchayatId(val);
                      setImportVillageName('');
                    }}
                  >
                    <SelectTrigger className="w-full h-[38px] text-[13px] border-[#c4c6d3] bg-white">
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
                  <label className="block text-[12px] font-bold text-[#002869] mb-1">Target Village *</label>
                  <Select
                    value={importVillageName}
                    onValueChange={(val) => setImportVillageName(val)}
                    disabled={!importPanchayatId}
                  >
                    <SelectTrigger className="w-full h-[38px] text-[13px] border-[#c4c6d3] bg-white disabled:opacity-50">
                      <SelectValue placeholder="Select Village" />
                    </SelectTrigger>
                    <SelectContent>
                      {(panchayats.find((p) => p.id === importPanchayatId)?.villages || []).map((v) => (
                        <SelectItem key={v.id} value={v.name}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Step 1: Download Sample & Upload Area */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-[#f4f3fb] border border-[#c4c6d3]/60 rounded-md">
                <div>
                  <div className="text-[13px] font-bold text-[#002869]">Need the Excel Format?</div>
                  <div className="text-[11px] text-[#434652]">
                    Download the pre-formatted Excel template with 9th-12th standards.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#002869] text-[#002869] rounded-md text-[12px] font-bold hover:bg-[#dae2ff]/30 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Download Template (.xlsx)
                </button>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#002869]/40 hover:border-[#002869] rounded-md p-6 text-center cursor-pointer bg-[#faf8ff] hover:bg-[#f4f3fb] transition-all group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-[#dae2ff] text-[#002869] flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
                </div>
                <div className="text-[14px] font-bold text-[#002869]">
                  {importFileName ? importFileName : 'Click to select Excel / CSV file'}
                </div>
                <p className="text-[12px] text-[#747783] mt-1">Supports .xlsx, .xls, and .csv formats</p>
              </div>

              {/* Parsing Indicator */}
              {isParsingFile && (
                <div className="p-4 text-center text-[#002869] font-bold text-[13px] flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                  Parsing Excel data and validating standards 9 to 12...
                </div>
              )}

              {/* Live Preview Table */}
              {importRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <div className="font-bold text-[#002869] flex items-center gap-2">
                      <span>Parsed {importRows.length} Student Rows:</span>
                      <span className="bg-[#e6f4ea] text-[#137333] px-2 py-0.5 rounded font-bold">
                        {importRows.filter((r) => r.isValid).length} Valid
                      </span>
                    </div>
                  </div>

                  <div className="border border-[#c4c6d3] rounded-md overflow-hidden max-h-[220px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[12px]">
                      <thead className="bg-[#f4f3fb] text-[#434652] uppercase text-[10px] font-bold sticky top-0 border-b border-[#c4c6d3]">
                        <tr>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Gender</th>
                          <th className="px-3 py-2">Standard</th>
                          <th className="px-3 py-2">Parent</th>
                          <th className="px-3 py-2">Phone</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#c4c6d3]/40 bg-white">
                        {importRows.map((r, idx) => (
                          <tr key={idx} className={r.isValid ? '' : 'bg-[#ffdad6]/20'}>
                            <td className="px-3 py-1.5 font-bold text-[#002869]">{r.name || 'â€”'}</td>
                            <td className="px-3 py-1.5 capitalize">{r.gender}</td>
                            <td className="px-3 py-1.5 font-bold">{r.standard}th Std</td>
                            <td className="px-3 py-1.5 text-[#434652]">{r.parentName || 'â€”'}</td>
                            <td className="px-3 py-1.5 text-[#434652]">{r.phone}</td>
                            <td className="px-3 py-1.5">
                              {r.isValid ? (
                                <span className="text-[#137333] font-bold">Ready</span>
                              ) : (
                                <span className="text-[#ba1a1a] font-bold">{r.validationError}</span>
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

            <div className="p-4 border-t border-[#c4c6d3] bg-[#faf8ff] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportRows([]);
                  setImportFileName('');
                }}
                className="px-4 py-2 text-[13px] font-bold text-[#434652] border border-[#747783] rounded-md hover:bg-[#f4f3fb] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importRows.length === 0 || importRows.filter((r) => r.isValid).length === 0}
                onClick={handleConfirmBulkImport}
                className={`px-5 py-2 text-[13px] font-bold rounded-md transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer ${
                  importRows.length > 0 && importRows.filter((r) => r.isValid).length > 0
                    ? 'bg-[#002869] text-white hover:bg-[#0b3d91]'
                    : 'bg-[#c4c6d3] text-white cursor-not-allowed'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
                Confirm &amp; Import {importRows.filter((r) => r.isValid).length} Students
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          VIEW STUDENT DETAILS MODAL
         ========================================== */}
      {viewingStudent && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-gray-900/75 backdrop-blur-sm">
          <div className="bg-white rounded-md shadow-sm w-full max-w-md overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <div className="px-6 py-4 border-b border-[#c4c6d3] flex justify-between items-center bg-[#f4f3fb]">
              <h3 className="text-[17px] font-bold text-[#002869] flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">badge</span>
                Student Profile
              </h3>
              <button
                onClick={() => setViewingStudent(null)}
                className="p-1 rounded-full text-[#434652] hover:bg-[#e8e7ef] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-[20px] ${
                    viewingStudent.gender === 'male' ? 'bg-[#002869] text-white' : 'bg-[#fb7800] text-white'
                  }`}
                >
                  {viewingStudent.avatarLetter}
                </div>
                <div>
                  <h4 className="text-[18px] font-bold text-[#002869]">{viewingStudent.name}</h4>
                  <p className="text-[12px] text-[#747783]">{viewingStudent.code}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                        viewingStudent.gender === 'male'
                          ? 'bg-[#dae2ff] text-[#001947]'
                          : 'bg-[#ffdbc8] text-[#592600]'
                      }`}
                    >
                      {viewingStudent.gender === 'male' ? 'ðŸ‘¦ Male / Boy' : 'ðŸ‘§ Female / Girl'}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                        viewingStudent.status === 'active'
                          ? 'bg-[#e6f4ea] text-[#137333]'
                          : 'bg-[#ffdad6] text-[#ba1a1a]'
                      }`}
                    >
                      {viewingStudent.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-[13px] border-t border-[#c4c6d3]/40">
                <div>
                  <span className="text-[#747783] text-[11px] font-semibold uppercase block">Standard</span>
                  <span className="font-bold text-[#002869]">{viewingStudent.standard}th Standard</span>
                </div>
                <div>
                  <span className="text-[#747783] text-[11px] font-semibold uppercase block">Gender</span>
                  <span className="capitalize font-bold">{viewingStudent.gender}</span>
                </div>
                <div>
                  <span className="text-[#747783] text-[11px] font-semibold uppercase block">Panchayat</span>
                  <span className="font-bold">{viewingStudent.panchayatName}</span>
                </div>
                <div>
                  <span className="text-[#747783] text-[11px] font-semibold uppercase block">Village</span>
                  <span className="font-bold">{viewingStudent.villageName}</span>
                </div>
                <div>
                  <span className="text-[#747783] text-[11px] font-semibold uppercase block">Parent / Guardian</span>
                  <span className="font-bold">{viewingStudent.parentName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#747783] text-[11px] font-semibold uppercase block">Contact Phone</span>
                  <span className="font-bold">{viewingStudent.phone || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#c4c6d3] bg-[#faf8ff] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const toDelete = viewingStudent;
                  setViewingStudent(null);
                  setStudentToDelete(toDelete);
                }}
                className="px-3.5 py-2 bg-[#ffdad6] text-[#ba1a1a] rounded-md text-[12.5px] font-bold hover:bg-[#ffdad6]/80 flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Delete Student
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingStudent(null)}
                  className="px-3.5 py-2 bg-white border border-[#c4c6d3] text-[#434652] rounded-md text-[12.5px] font-bold hover:bg-[#f4f3fb] cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = viewingStudent;
                    setViewingStudent(null);
                    handleEditStudent(toEdit);
                  }}
                  className="px-4 py-2 bg-[#002869] text-white rounded-md text-[12.5px] font-bold cursor-pointer hover:bg-[#0b3d91] flex items-center gap-1.5 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Edit Student
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          IN-APP DELETE CONFIRMATION MODAL
         ========================================== */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white rounded-md max-w-sm w-full overflow-hidden shadow-sm border border-[#c4c6d3] p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[26px]">delete_forever</span>
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-[#ba1a1a]">Delete Student?</h3>
              <p className="text-[13px] text-[#434652] mt-1.5 leading-relaxed">
                Are you sure you want to delete <strong className="text-[#1a1b21]">{studentToDelete.name}</strong> ({studentToDelete.standard}th Std) from {studentToDelete.villageName}?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="flex-1 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] font-bold text-[#434652] hover:bg-[#f4f3fb] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStudent}
                className="flex-1 py-2 bg-[#ba1a1a] text-white rounded-md text-[13px] font-bold hover:bg-[#93000a] transition-colors shadow-xs cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[200] bg-[#002869] text-white px-4 py-3 rounded-md shadow-sm flex items-center gap-2 text-[13px] font-bold animate-[slideUp_0.2s_ease-out] border border-white/20">
          <span className="material-symbols-outlined text-[18px] text-[#80bdff]">check_circle</span>
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-white/70 hover:text-white cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}
    </div>
  );
};


