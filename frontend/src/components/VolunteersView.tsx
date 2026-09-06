import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Volunteer, Panchayat } from '../types';
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
  Users,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  Building2,
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
  AlertCircle,
  Phone,
  Mail,
  Star,
} from './ui/icons';

interface VolunteersViewProps {
  volunteers: Volunteer[];
  panchayats?: Panchayat[];
  onAddVolunteer: (newVol: Omit<Volunteer, 'id' | 'avatarText' | 'recentSessions' | 'totalSessions' | 'attendanceRate'>) => void | Promise<void>;
  collegeName?: string;
  clusterName?: string;
  userRole?: string;
  onEditVolunteer?: (id: string, updated: Partial<Volunteer>) => Promise<void> | void;
  onUpdateVolunteer?: (id: string, updated: Partial<Volunteer>) => void;
  onDeleteVolunteer: (id: string) => void;
  onBulkImportVolunteers?: (volunteers: any[], clusterId: string) => Promise<void> | void;
}

interface ParsedVolunteerRow {
  name: string;
  email: string;
  phone: string;
  college: string;
  department: string;
  year: string;
  status: 'Active' | 'Inactive';
  isValid: boolean;
  validationError?: string;
}

export const VolunteersView: React.FC<VolunteersViewProps> = ({
  volunteers,
  panchayats = [],
  onAddVolunteer,
  collegeName = '',
  clusterName = '',
  userRole = 'Super Admin',
  onEditVolunteer,
  onUpdateVolunteer,
  onDeleteVolunteer,
  onBulkImportVolunteers,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'Active' | 'Inactive'>('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState<Volunteer | null>(null);
  const [viewingVolunteer, setViewingVolunteer] = useState<Volunteer | null>(null);
  const [volunteerToDelete, setVolunteerToDelete] = useState<Volunteer | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Bulk import state
  const [importRows, setImportRows] = useState<ParsedVolunteerRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [importCollegeName, setImportCollegeName] = useState(collegeName || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    college: collegeName,
    department: 'Computer Science and Engineering',
    year: '4th Year',
    status: 'Active' as 'Active' | 'Inactive',
    totalSessions: 0,
    attendanceRate: 100,
  });

  useEffect(() => {
    if (userRole === 'Cluster Admin' && collegeName) {
      setFormData((cur) => ({ ...cur, college: collegeName }));
      setImportCollegeName(collegeName);
    }
  }, [collegeName, userRole]);

  const departmentOptions = [
    'Computer Science and Engineering',
    'Electronics and Communication Engineering',
    'Mechanical Engineering',
    'Information Technology',
    'Electrical and Electronics Engineering',
    'Civil Engineering',
    'Biotechnology',
    'Artificial Intelligence & Data Science',
    'Arts & Science / Commerce',
  ];

  const yearOptions = [
    '1st Year',
    '2nd Year',
    '3rd Year',
    '4th Year',
    'Post Graduate',
    'Alumnus',
  ];

  const collegeOptions = useMemo(() => {
    const set = new Set<string>();
    volunteers.forEach((v) => {
      if (v.college) set.add(v.college);
    });
    if (collegeName) set.add(collegeName);
    return Array.from(set).sort();
  }, [volunteers, collegeName]);

  const stats = useMemo(() => {
    const total = volunteers.length;
    const active = volunteers.filter((v) => (v.status || 'Active') === 'Active').length;
    const inactive = total - active;
    const collegesCount = new Set(volunteers.map((v) => v.college).filter(Boolean)).size;
    const avgAttendance = total > 0
      ? Math.round(volunteers.reduce((acc, v) => acc + (v.attendanceRate || 100), 0) / total)
      : 100;
    const finalYear = volunteers.filter((v) => v.year && v.year.includes('4th')).length;
    return { total, active, inactive, collegesCount, avgAttendance, finalYear };
  }, [volunteers]);

  const filteredVolunteers = useMemo(() => {
    return volunteers.filter((v) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        v.name.toLowerCase().includes(q) ||
        v.email.toLowerCase().includes(q) ||
        v.phone.includes(q) ||
        (v.college && v.college.toLowerCase().includes(q)) ||
        (v.department && v.department.toLowerCase().includes(q));

      if (!matchSearch) return false;
      if (selectedCollege !== 'all' && v.college !== selectedCollege) return false;
      if (selectedDepartment !== 'all' && v.department !== selectedDepartment) return false;
      if (selectedYear !== 'all' && v.year !== selectedYear) return false;
      if (selectedStatus !== 'all' && (v.status || 'Active') !== selectedStatus) return false;

      return true;
    });
  }, [volunteers, searchTerm, selectedCollege, selectedDepartment, selectedYear, selectedStatus]);

  const totalPages = Math.ceil(filteredVolunteers.length / pageSize) || 1;
  const paginatedVolunteers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredVolunteers.slice(start, start + pageSize);
  }, [filteredVolunteers, currentPage, pageSize]);

  const handleOpenAdd = () => {
    setEditingVolunteer(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      college: collegeName || (collegeOptions[0] || ''),
      department: 'Computer Science and Engineering',
      year: '4th Year',
      status: 'Active',
      totalSessions: 0,
      attendanceRate: 100,
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (vol: Volunteer) => {
    setEditingVolunteer(vol);
    setFormData({
      name: vol.name,
      email: vol.email,
      phone: vol.phone,
      college: vol.college || collegeName || '',
      department: vol.department || 'Computer Science and Engineering',
      year: vol.year || '4th Year',
      status: vol.status || 'Active',
      totalSessions: vol.totalSessions || 0,
      attendanceRate: vol.attendanceRate || 100,
    });
    setShowAddModal(true);
  };

  const handleSaveVolunteer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter volunteer full name.');
      return;
    }

    if (editingVolunteer) {
      const payload: Partial<Volunteer> = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        college: formData.college.trim(),
        department: formData.department,
        year: formData.year,
        status: formData.status,
        totalSessions: formData.totalSessions,
        attendanceRate: formData.attendanceRate,
      };

      if (onEditVolunteer) {
        onEditVolunteer(editingVolunteer.id, payload);
      } else if (onUpdateVolunteer) {
        onUpdateVolunteer(editingVolunteer.id, payload);
      }

      if (viewingVolunteer?.id === editingVolunteer.id) {
        setViewingVolunteer({ ...viewingVolunteer, ...payload });
      }

      showToast(`Updated volunteer ${formData.name.trim()}`);
    } else {
      onAddVolunteer({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        college: formData.college.trim(),
        department: formData.department,
        year: formData.year,
        status: formData.status,
      });
      showToast(`Added volunteer ${formData.name.trim()} successfully`);
    }

    setShowAddModal(false);
    setEditingVolunteer(null);
  };

  const handleConfirmDelete = () => {
    if (!volunteerToDelete) return;
    const name = volunteerToDelete.name;
    onDeleteVolunteer(volunteerToDelete.id);
    if (viewingVolunteer?.id === volunteerToDelete.id) {
      setViewingVolunteer(null);
    }
    showToast(`Volunteer ${name} deleted`);
    setVolunteerToDelete(null);
  };

  const handleDownloadSample = () => {
    const sample = [
      {
        'Full Name': 'Praveen Kumar S.',
        'Email Address': 'praveen.k@gce.edu.in',
        'Mobile Phone': '9840123456',
        'College / Institution': collegeName || 'Government College of Engineering, Dharmapuri',
        'Department': 'Computer Science and Engineering',
        'Year of Study': '4th Year',
        'Status': 'Active',
      },
      {
        'Full Name': 'Ananya Venkatesh',
        'Email Address': 'ananya.v@gce.edu.in',
        'Mobile Phone': '9840234567',
        'College / Institution': collegeName || 'Government College of Engineering, Dharmapuri',
        'Department': 'Electronics and Communication Engineering',
        'Year of Study': '3rd Year',
        'Status': 'Active',
      },
      {
        'Full Name': 'Dinesh Karthik M.',
        'Email Address': 'dinesh.m@gce.edu.in',
        'Mobile Phone': '9840345678',
        'College / Institution': collegeName || 'Government College of Engineering, Dharmapuri',
        'Department': 'Information Technology',
        'Year of Study': '4th Year',
        'Status': 'Active',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Volunteers_Template');
    XLSX.writeFile(wb, 'TQI_Volunteers_Import_Template.xlsx');
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

        const parsed: ParsedVolunteerRow[] = rawJson.map((row) => {
          const keys = Object.keys(row);
          const findVal = (terms: string[]) => {
            const matchedKey = keys.find((k) =>
              terms.some((t) => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(t))
            );
            return matchedKey ? String(row[matchedKey]).trim() : '';
          };

          const name = findVal(['name', 'fullname', 'volunteer']) || '';
          const email = findVal(['email', 'mail']) || '';
          const phone = findVal(['phone', 'mobile', 'contact']) || '';
          const college = findVal(['college', 'institution', 'university']) || importCollegeName || collegeName || '';
          const department = findVal(['department', 'dept', 'branch']) || 'Computer Science and Engineering';
          const year = findVal(['year', 'yearofstudy', 'batch']) || '4th Year';
          const rawStatus = findVal(['status']).toLowerCase();
          const status: 'Active' | 'Inactive' = rawStatus.includes('inact') ? 'Inactive' : 'Active';

          let isValid = true;
          let validationError = '';
          if (!name) {
            isValid = false;
            validationError = 'Missing volunteer name';
          }

          return { name, email, phone, college, department, year, status, isValid, validationError };
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
    const validRows = importRows.filter((r) => r.isValid && r.name.trim().length > 0);
    if (validRows.length === 0) {
      alert('No valid volunteer records found to import.');
      return;
    }

    const clusterId = panchayats.length > 0 ? (panchayats[0].clusterId || panchayats[0].id || '') : '';

    if (onBulkImportVolunteers) {
      await onBulkImportVolunteers(validRows, clusterId);
    } else {
      for (const row of validRows) {
        onAddVolunteer({
          name: row.name,
          email: row.email,
          phone: row.phone,
          college: row.college || importCollegeName || collegeName,
          department: row.department,
          year: row.year,
          status: row.status,
        });
      }
    }

    showToast(`Successfully imported ${validRows.length} volunteers`);
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
            Volunteers & Mentors Directory
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage college student volunteers, track attendance performance, and import rosters across partner institutions.
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
            <span>Add Volunteer</span>
          </Button>
        </div>
      </div>

      {/* 2. KPI Summary Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Mentors</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{stats.total}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{stats.active}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Colleges</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{stats.collegesCount}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5 text-purple-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Avg Attendance</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{stats.avgAttendance}%</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Final Year</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{stats.finalYear}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Star className="h-3.5 w-3.5 text-pink-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">On Leave</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{stats.inactive}</p>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-card p-3 shadow-xs">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by volunteer name, email, phone, college, department..."
            className="h-9 pl-8 text-xs"
          />
        </div>

        <div className="w-48">
          <Select
            value={selectedCollege}
            onValueChange={(val) => {
              setSelectedCollege(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Colleges" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Colleges</SelectItem>
              {collegeOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-48">
          <Select
            value={selectedDepartment}
            onValueChange={(val) => {
              setSelectedDepartment(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departmentOptions.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-36">
          <Select
            value={selectedYear}
            onValueChange={(val) => {
              setSelectedYear(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-32">
          <Select
            value={selectedStatus}
            onValueChange={(val: any) => {
              setSelectedStatus(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(searchTerm ||
          selectedCollege !== 'all' ||
          selectedDepartment !== 'all' ||
          selectedYear !== 'all' ||
          selectedStatus !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm('');
              setSelectedCollege('all');
              setSelectedDepartment('all');
              setSelectedYear('all');
              setSelectedStatus('all');
              setCurrentPage(1);
            }}
            className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Reset Filters
          </Button>
        )}
      </div>

      {/* 4. Enterprise Volunteer Table */}
      <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
              <tr>
                <th className="w-14 px-4 py-3 text-center">S.No</th>
                <th className="px-4 py-3">Volunteer Name</th>
                <th className="px-4 py-3">College / Institution</th>
                <th className="px-4 py-3">Department & Year</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3 text-center">Attendance</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedVolunteers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <EmptyState
                      icon={Users}
                      title="No volunteers found"
                      description={
                        searchTerm || selectedDepartment !== 'all'
                          ? 'Try adjusting your search criteria or reset filters.'
                          : 'No volunteers registered yet. Add a new volunteer or import roster.'
                      }
                      actionLabel="+ Add Volunteer"
                      onAction={handleOpenAdd}
                    />
                  </td>
                </tr>
              ) : (
                paginatedVolunteers.map((vol, idx) => {
                  const sNo = (currentPage - 1) * pageSize + idx + 1;
                  const statusVal = vol.status || 'Active';
                  return (
                    <tr
                      key={vol.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                        {sNo}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {vol.avatarText || vol.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div
                              className="font-semibold text-foreground hover:text-primary cursor-pointer"
                              onClick={() => setViewingVolunteer(vol)}
                            >
                              {vol.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {vol.role || 'Mentor'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground max-w-[220px] truncate" title={vol.college}>
                          {vol.college || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-foreground">{vol.department}</div>
                        <div className="text-[11px] text-muted-foreground">{vol.year}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-[11px] text-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{vol.phone || '—'}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[160px]">{vol.email || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center rounded border border-border bg-muted/40 px-2 py-0.5 font-semibold text-foreground">
                          {vol.attendanceRate || 100}%
                        </span>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {vol.totalSessions || 0} sessions
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={statusVal === 'Active' ? 'success' : 'secondary'}
                          size="sm"
                        >
                          {statusVal}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setViewingVolunteer(vol)}
                            title="View Profile"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenEdit(vol)}
                            title="Edit Volunteer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => setVolunteerToDelete(vol)}
                            title="Delete Volunteer"
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
        {filteredVolunteers.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row text-xs">
            <div className="text-muted-foreground">
              Showing{' '}
              <span className="font-semibold text-foreground">
                {(currentPage - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-foreground">
                {Math.min(currentPage * pageSize, filteredVolunteers.length)}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-foreground">
                {filteredVolunteers.length}
              </span>{' '}
              volunteers
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

      {/* 5. Add / Edit Volunteer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {editingVolunteer ? 'Edit Volunteer Details' : 'Add New Volunteer Mentor'}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {editingVolunteer
                    ? 'Update academic affiliation, department, and contact information.'
                    : 'Register a college student volunteer mentor for field operations.'}
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

            <form onSubmit={handleSaveVolunteer} className="mt-4 space-y-4 text-xs">
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Full Name *
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. Praveen Kumar S."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Email Address
                    </label>
                    <Input
                      type="email"
                      placeholder="student@college.edu"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Mobile Phone Number
                    </label>
                    <Input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    College / Institution
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Government College of Engineering, Dharmapuri"
                    value={formData.college}
                    readOnly={userRole === 'Cluster Admin'}
                    onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                  />
                  {userRole === 'Cluster Admin' && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Locked to your assigned cluster college.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Department *
                    </label>
                    <Select
                      value={formData.department}
                      onValueChange={(val) => setFormData({ ...formData, department: val })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentOptions.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Year of Study *
                    </label>
                    <Select
                      value={formData.year}
                      onValueChange={(val) => setFormData({ ...formData, year: val })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((yr) => (
                          <SelectItem key={yr} value={yr}>
                            {yr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Active Status
                  </label>
                  <Select
                    value={formData.status}
                    onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive / On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingVolunteer ? 'Save Changes' : 'Add Volunteer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. View Volunteer Profile Modal */}
      {viewingVolunteer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Volunteer Profile</h3>
              <button
                type="button"
                onClick={() => setViewingVolunteer(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
                  {viewingVolunteer.avatarText || viewingVolunteer.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-base font-bold text-foreground">{viewingVolunteer.name}</h4>
                  <p className="text-xs text-muted-foreground">{viewingVolunteer.role || 'Student Mentor'}</p>
                </div>
                <Badge
                  variant={(viewingVolunteer.status || 'Active') === 'Active' ? 'success' : 'secondary'}
                  className="ml-auto"
                >
                  {viewingVolunteer.status || 'Active'}
                </Badge>
              </div>

              <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">College:</span>
                  <span className="font-semibold text-foreground text-right">{viewingVolunteer.college || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Department:</span>
                  <span className="text-foreground">{viewingVolunteer.department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Year of Study:</span>
                  <span className="text-foreground">{viewingVolunteer.year}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mobile Phone:</span>
                  <span className="font-mono text-foreground">{viewingVolunteer.phone || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email Address:</span>
                  <span className="text-foreground">{viewingVolunteer.email || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sessions Completed:</span>
                  <span className="font-semibold text-foreground">{viewingVolunteer.totalSessions || 0} sessions</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Attendance Rate:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{viewingVolunteer.attendanceRate || 100}%</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    handleOpenEdit(viewingVolunteer);
                    setViewingVolunteer(null);
                  }}
                  className="gap-1.5"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit Profile</span>
                </Button>
                <Button onClick={() => setViewingVolunteer(null)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Bulk Import Volunteers Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Bulk Import Volunteers (Excel)</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Upload an Excel spreadsheet (.xlsx or .csv) to batch enroll student volunteers for your partner colleges.
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
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Target College / Institution *
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Government College of Engineering, Dharmapuri"
                  value={importCollegeName}
                  onChange={(e) => setImportCollegeName(e.target.value)}
                  readOnly={userRole === 'Cluster Admin'}
                />
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
                          <th className="px-3 py-1.5">Department</th>
                          <th className="px-3 py-1.5">Year</th>
                          <th className="px-3 py-1.5">Mobile</th>
                          <th className="px-3 py-1.5">Email</th>
                          <th className="px-3 py-1.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {importRows.slice(0, 10).map((r, i) => (
                          <tr key={i} className={r.isValid ? '' : 'bg-destructive/10'}>
                            <td className="px-3 py-1.5 font-medium text-foreground">{r.name || '—'}</td>
                            <td className="px-3 py-1.5">{r.department}</td>
                            <td className="px-3 py-1.5">{r.year}</td>
                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.phone || '—'}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{r.email || '—'}</td>
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
                  disabled={importRows.filter((r) => r.isValid).length === 0}
                >
                  Import {importRows.filter((r) => r.isValid).length} Volunteers
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Delete Confirmation Modal */}
      {volunteerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Delete Volunteer?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to remove <strong className="text-foreground">{volunteerToDelete.name}</strong> from the volunteers roster? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVolunteerToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
              >
                Delete Volunteer
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
