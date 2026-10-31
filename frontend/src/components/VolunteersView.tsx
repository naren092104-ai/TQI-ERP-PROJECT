import React, { useState, useMemo } from "react";
import { 
  Plus, 
  Search, 
  Users, 
  Award, 
  GraduationCap, 
  BookOpen, 
  Eye, 
  Edit3, 
  Trash2, 
  X, 
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import * as XLSX from 'xlsx';
import { pdf } from '@react-pdf/renderer';
import { VolunteerDirectoryPdf, VolunteerDirectoryPdfData } from '../utils/pdf/VolunteerDirectoryPdf';
import { Volunteer, Panchayat, Cluster, UserRole } from "../types";
import Badge from "./ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableCell } from "./ui/table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { ActionButton } from "./ui/action-button";
import { CollegeCombobox, CollegeOption } from "./ui/CollegeCombobox";

interface VolunteersViewProps {
  volunteers: Volunteer[];
  panchayats?: Panchayat[];
  clusters?: Cluster[];
  userRole?: UserRole;
  currentClusterId?: string;
  authToken?: string;
  academicYear?: string;
  onAddVolunteer: (newVol: Omit<Volunteer, "id" | "avatarText" | "recentSessions" | "totalSessions" | "attendanceRate">) => Promise<void> | void;
  onEditVolunteer?: (id: string, updated: Partial<Volunteer>) => Promise<void> | void;
  onUpdateVolunteer?: (id: string, updated: Partial<Volunteer>) => Promise<void> | void;
  onDeleteVolunteer: (id: string) => void;
  onBulkImportVolunteers?: (volunteers: Array<Pick<Volunteer, 'name' | 'year' | 'department' | 'email' | 'phone'>>, clusterId: string) => Promise<void> | void;
}

export const VolunteersView: React.FC<VolunteersViewProps> = ({
  volunteers,
  panchayats = [],
  clusters = [],
  userRole = "Cluster Admin",
  currentClusterId = "",
  authToken,
  academicYear = '',
  onAddVolunteer,
  onEditVolunteer,
  onUpdateVolunteer,
  onDeleteVolunteer,
  onBulkImportVolunteers,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState<Volunteer | null>(null);
  const [viewingModalVolunteer, setViewingModalVolunteer] = useState<Volunteer | null>(null);
  const [volunteerToDelete, setVolunteerToDelete] = useState<Volunteer | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSavingVolunteer, setIsSavingVolunteer] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkRows, setBulkRows] = useState<Array<Pick<Volunteer, 'name' | 'year' | 'department' | 'email' | 'phone'>>>([]);
  const [bulkError, setBulkError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const isSuperAdmin = userRole === "Super Admin";
  const [selectedClusterId, setSelectedClusterId] = useState(isSuperAdmin ? "" : currentClusterId);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const [formData, setFormData] = useState({
    name: "",
    gender: '' as '' | 'male' | 'female' | 'other',
    email: "",
    phone: "+91 ",
    college: "",
    department: "Computer Science and Engineering",
    year: "1st Year",
    totalSessions: 0,
    attendanceRate: 100,
  });
  const [selectedCollegeCategory, setSelectedCollegeCategory] = useState<'engineering' | 'arts' | 'medical' | 'all'>('all');

  const classifyCollege = (college: Partial<CollegeOption> | string): 'engineering' | 'arts' | 'medical' | 'all' => {
    const searchable = typeof college === 'string'
      ? college
      : `${college.name || ''} ${college.type || ''} ${college.collegeType || ''} ${college.university || ''}`;
    if (/medical|medicine|health science|nurs|dental|pharmacy|physiotherap|paramedical|siddha|ayurved|homeopath|mbbs|healthcare/i.test(searchable)) return 'medical';
    if (/engineer|technology|technical|polytechnic|architecture/i.test(searchable)) return 'engineering';
    if (/arts|science|humanities|commerce|liberal|college/i.test(searchable)) return 'arts';
    return 'all';
  };
  const defaultDepartmentFor = (category: 'engineering' | 'arts' | 'medical' | 'all') =>
    category === 'arts' ? 'Bachelor of Arts (B.A.)'
      : category === 'medical' ? 'Bachelor of Medicine and Bachelor of Surgery (MBBS)'
        : 'Computer Science and Engineering';

  const departmentGroups = [
    {
      category: 'Engineering & Technology (UG)',
      items: [
        'Aerospace Engineering',
        'Agricultural Engineering',
        'Artificial Intelligence & Data Science',
        'Artificial Intelligence & Machine Learning',
        'Automobile Engineering',
        'Biomedical Engineering',
        'Biotechnology (B.Tech)',
        'Ceramic Engineering',
        'Chemical Engineering',
        'Civil Engineering',
        'Computer Science and Engineering',
        'Computer Science and Business Systems',
        'Cyber Security',
        'Electrical and Electronics Engineering',
        'Electronics and Communication Engineering',
        'Electronics and Computer Engineering',
        'Electronics and Instrumentation Engineering',
        'Environmental Engineering',
        'Food Technology',
        'Industrial Engineering',
        'Information Science Engineering',
        'Information Technology (B.Tech)',
        'Instrumentation and Control Engineering',
        'Marine Engineering',
        'Materials Science and Engineering',
        'Mechanical Engineering',
        'Mechatronics Engineering',
        'Metallurgical Engineering',
        'Mining Engineering',
        'Nanotechnology',
        'Petroleum Engineering',
        'Plastic Engineering',
        'Production Engineering',
        'Robotics and Automation',
        'Structural Engineering',
        'Textile Engineering',
      ],
    },
    {
      category: 'Arts & Science (UG)',
      items: [
        'Bachelor of Arts (B.A.)',
        'Bachelor of Science (B.Sc.)',
        'Bachelor of Commerce (B.Com.)',
        'Bachelor of Business Administration (BBA)',
        'Bachelor of Computer Applications (BCA)',
        'Bachelor of Social Work (BSW)',
        'English Literature',
        'Tamil Literature',
        'History',
        'Political Science',
        'Economics',
        'Philosophy',
        'Sociology',
        'Psychology',
        'Public Administration',
        'Mathematics',
        'Physics',
        'Chemistry',
        'Botany',
        'Zoology',
        'Microbiology',
        'Biotechnology (B.Sc)',
        'Biochemistry',
        'Geology',
        'Geography',
        'Statistics',
        'Computer Science (B.Sc)',
        'Information Technology (B.Sc)',
        'Electronics (B.Sc)',
        'Visual Communication',
        'Journalism and Mass Communication',
        'Hotel Management and Catering Technology',
        'Tourism and Travel Management',
        'Fashion Technology',
        'Interior Design',
        'Fine Arts',
        'Music',
        'Dance',
        'Physical Education',
        'Library and Information Science',
      ],
    },
    {
      category: 'Medical & Health Sciences',
      items: [
        'Bachelor of Medicine and Bachelor of Surgery (MBBS)',
        'Bachelor of Dental Surgery (BDS)',
        'Bachelor of Nursing (B.Sc. Nursing)',
        'General Nursing and Midwifery (GNM)',
        'Bachelor of Pharmacy (B.Pharm.)',
        'Doctor of Pharmacy (Pharm.D.)',
        'Bachelor of Physiotherapy (BPT)',
        'Bachelor of Occupational Therapy (BOT)',
        'Bachelor of Ayurveda Medicine and Surgery (BAMS)',
        'Bachelor of Siddha Medicine and Surgery (BSMS)',
        'Bachelor of Homoeopathic Medicine and Surgery (BHMS)',
        'Medical Laboratory Technology',
        'Radiology and Imaging Technology',
        'Operation Theatre and Anaesthesia Technology',
      ],
    },
    {
      category: 'Commerce & Management',
      items: [
        'Master of Commerce (M.Com.)',
        'Master of Business Administration (MBA)',
        'Master of Computer Applications (MCA)',
        'Cost and Management Accounting',
        'Banking and Finance',
      ],
    },
    {
      category: 'Postgraduate (Engineering & Technology)',
      items: [
        'M.E. Computer Science and Engineering',
        'M.E. Communication Systems',
        'M.E. Power Electronics and Drives',
        'M.E. Structural Engineering',
        'M.E. Thermal Engineering',
        'M.E. Applied Electronics',
        'M.Tech. Information Technology',
        'M.Tech. Data Science',
        'M.Tech. Artificial Intelligence',
      ],
    },
    {
      category: 'Research & Doctoral',
      items: [
        'Ph.D. (Engineering)',
        'Ph.D. (Science)',
        'Ph.D. (Arts)',
        'Ph.D. (Commerce)',
        'Ph.D. (Management)',
      ],
    },
  ];

  const collegeDepartmentGroups = useMemo(() => {
    if (selectedCollegeCategory === 'engineering') return departmentGroups.filter((group) => /engineering|technology/i.test(group.category));
    if (selectedCollegeCategory === 'medical') return departmentGroups.filter((group) => group.category === 'Medical & Health Sciences');
    if (selectedCollegeCategory === 'arts') return departmentGroups.filter((group) => /arts & science|commerce & management/i.test(group.category));
    return departmentGroups;
  }, [departmentGroups, selectedCollegeCategory]);
  const availableFormDepartments = collegeDepartmentGroups.flatMap((group) => group.items);

  const getYearOptions = (department: string, collegeCategory = selectedCollegeCategory) => {
    const departmentGroup = departmentGroups.find((group) => group.items.includes(department));
    const groupName = departmentGroup?.category || '';
    if (/postgraduate|research|doctoral/i.test(groupName) || /^(Master of|M\.|Ph\.D\.)/i.test(department)) {
      return ['Post Graduate', 'Alumnus'];
    }

    const isEngineering = /engineering|technology/i.test(groupName) || collegeCategory === 'engineering';
    const isMedical = /medical|health/i.test(groupName) || collegeCategory === 'medical';
    const yearCount = isEngineering || isMedical ? 4 : 3;
    return [
      ...Array.from({ length: yearCount }, (_, index) => `${index + 1}${index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} Year`),
      'Post Graduate',
      'Alumnus',
    ];
  };
  const yearOptions = getYearOptions(formData.department);
  const defaultYearFor = (department: string, category = selectedCollegeCategory) => getYearOptions(department, category)[0] || '1st Year';

  const clusterForVolunteer = (volunteer: Volunteer) =>
    volunteer.clusterId || panchayats.find((panchayat) => panchayat.id === volunteer.panchayatId)?.clusterId || '';
  const selectedCluster = clusters.find((cluster) => cluster.id === selectedClusterId);
  const clusterCards = useMemo(() => clusters.map((cluster) => ({
    cluster,
    volunteers: volunteers.filter((volunteer) => clusterForVolunteer(volunteer) === cluster.id),
  })).sort((a, b) => a.cluster.name.localeCompare(b.cluster.name)), [clusters, volunteers, panchayats]);
  const isClusterOverview = isSuperAdmin && !selectedClusterId;

  React.useEffect(() => {
    if (!isSuperAdmin) setSelectedClusterId(currentClusterId);
  }, [currentClusterId, isSuperAdmin]);

  React.useEffect(() => {
    if (!selectedCluster?.collegeName || isSuperAdmin) return;
    const category = classifyCollege(selectedCluster.collegeName);
    const groups = category === 'engineering'
      ? departmentGroups.filter((group) => /engineering|technology/i.test(group.category))
      : category === 'medical'
        ? departmentGroups.filter((group) => group.category === 'Medical & Health Sciences')
        : category === 'arts'
          ? departmentGroups.filter((group) => /arts & science|commerce & management/i.test(group.category))
          : departmentGroups;
    const validDepartments = groups.flatMap((group) => group.items);
    setSelectedCollegeCategory(category);
    setFormData((current) => {
      const department = validDepartments.includes(current.department) ? current.department : defaultDepartmentFor(category);
      const nextYearOptions = getYearOptions(department, category);
      return {
        ...current,
        college: selectedCluster.collegeName,
        department,
        year: nextYearOptions.includes(current.year) ? current.year : nextYearOptions[0],
      };
    });
  }, [selectedCluster?.id, selectedCluster?.collegeName, isSuperAdmin]);

  const filteredVolunteers = useMemo(() => volunteers.filter((volunteer) => {
    const matchesCluster = !selectedClusterId || clusterForVolunteer(volunteer) === selectedClusterId;
    const query = searchTerm.toLowerCase();
    const matchSearch = volunteer.name.toLowerCase().includes(query) ||
      volunteer.email.toLowerCase().includes(query) ||
      volunteer.phone.includes(searchTerm) ||
      (volunteer.college || selectedCluster?.collegeName || '').toLowerCase().includes(query) ||
      (volunteer.department || '').toLowerCase().includes(query);
    const matchDept = !selectedDepartment || volunteer.department === selectedDepartment;
    const matchYear = !selectedYear || volunteer.year === selectedYear;
    return matchesCluster && matchSearch && matchDept && matchYear;
  }), [volunteers, searchTerm, selectedDepartment, selectedYear, selectedClusterId, panchayats, selectedCluster]);

  const handleSaveVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast("Please enter volunteer name");
      return;
    }
    if (!editingVolunteer && !formData.gender) {
      showToast('Please select volunteer gender.');
      return;
    }

    setIsSavingVolunteer(true);
    try {
      if (editingVolunteer) {
        const update: Partial<Volunteer> = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          college: formData.college.trim(),
          department: formData.department,
          year: formData.year,
          totalSessions: formData.totalSessions,
          attendanceRate: formData.attendanceRate,
        };
        if (formData.gender) update.gender = formData.gender;
        if (onEditVolunteer) await onEditVolunteer(editingVolunteer.id, update);
        else if (onUpdateVolunteer) await onUpdateVolunteer(editingVolunteer.id, update);
        else throw new Error('Volunteer editing is not available.');

        setViewingModalVolunteer((current) => current?.id === editingVolunteer.id ? { ...current, ...update } : current);
        showToast("Updated volunteer " + formData.name);
        setEditingVolunteer(null);
      } else {
        await onAddVolunteer({
          name: formData.name.trim(),
          gender: formData.gender || undefined,
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          college: formData.college.trim(),
          department: formData.department,
          year: formData.year,
          clusterId: selectedClusterId || currentClusterId,
        });
        showToast("Added volunteer " + formData.name);
      }

      setShowAddModal(false);
      const resetCollege = selectedCluster?.collegeName || '';
      const resetCollegeCategory = classifyCollege(resetCollege);
      setFormData({
        name: "",
        gender: '',
        email: "",
        phone: "+91 ",
        college: selectedCluster?.collegeName || "",
        department: defaultDepartmentFor(resetCollegeCategory),
        year: defaultYearFor(defaultDepartmentFor(resetCollegeCategory), resetCollegeCategory),
        totalSessions: 0,
        attendanceRate: 100,
      });
      setSelectedCollegeCategory(resetCollegeCategory);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save volunteer.');
    } finally {
      setIsSavingVolunteer(false);
    }
  };

  const downloadBulkTemplate = () => {
    const sheet = XLSX.utils.aoa_to_sheet([['Name', 'Year', 'Department', 'Mail ID', 'Mobile Number']]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Volunteers');
    XLSX.writeFile(workbook, 'volunteer-bulk-upload-template.xlsx');
  };

  const exportVolunteersExcel = () => {
    const rows = filteredVolunteers.map((volunteer, index) => ({
      'S.No': index + 1,
      'Volunteer Name': volunteer.name,
      Department: volunteer.department,
      Year: volunteer.year,
      College: volunteer.college || clusters.find((cluster) => cluster.id === clusterForVolunteer(volunteer))?.collegeName || '',
      Email: volunteer.email,
      Contact: volunteer.phone,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 38 }, { wch: 16 }, { wch: 42 }, { wch: 32 }, { wch: 20 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Volunteers');
    XLSX.writeFile(workbook, 'TQI_Volunteers.xlsx');
  };

  const exportVolunteersPdf = async () => {
    try {
      const yearLabel = academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
      let logoDataUrl: string | undefined;
      try {
        const response = await fetch('/logo.png');
        if (response.ok) {
          const blob = await response.blob();
          logoDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } catch {
        // The organization name remains in the report if the logo is unavailable.
      }

      const data: VolunteerDirectoryPdfData = {
        academicYear: yearLabel,
        logoDataUrl,
        volunteers: filteredVolunteers.map((volunteer) => ({
          name: volunteer.name,
          department: volunteer.department || '—',
          year: volunteer.year || '—',
          college: volunteer.college || clusters.find((cluster) => cluster.id === clusterForVolunteer(volunteer))?.collegeName || '—',
          contact: volunteer.phone || '—',
          email: volunteer.email || '—',
        })),
      };
      const pdfDocument = React.createElement(VolunteerDirectoryPdf, { data }) as unknown as Parameters<typeof pdf>[0];
      const blob = await pdf(pdfDocument).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeYear = yearLabel.replace(/[^a-zA-Z0-9_-]+/g, '_');
      link.href = url;
      link.download = `TQI_Volunteers_Details_${safeYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Unable to generate volunteer details PDF:', error);
      showToast('Unable to download the volunteer PDF. Please try again.');
    }
  };

  const parseBulkFile = async (file: File) => {
    setBulkError('');
    setBulkRows([]);
    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Spreadsheet must be 10 MB or smaller.');
      }
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', sheetRows: 10001 });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error('The uploaded workbook has no worksheet.');
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '', raw: false });
      if (!rawRows.length) throw new Error('The spreadsheet has no volunteer rows.');
      if (rawRows.length > 10000) throw new Error('Spreadsheet can contain at most 10,000 volunteer rows.');
      const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
      const rows = rawRows.map((raw, index) => {
        const cells = new Map(Object.entries(raw).map(([key, value]) => [normalizeHeader(key), String(value ?? '').trim()]));
        const get = (...headers: string[]) => headers.map(normalizeHeader).map((key) => cells.get(key) || '').find(Boolean) || '';
        const row = {
          name: get('Name', 'Full Name'),
          year: get('Year', 'Year of Study'),
          department: get('Department'),
          email: get('Mail ID', 'Email', 'Email Address'),
          phone: get('Mobile Number', 'Mobile', 'Phone Number', 'Phone'),
        };
        const missing = Object.entries(row).filter(([, value]) => !value).map(([key]) => key);
        if (missing.length) throw new Error(`Row ${index + 2}: missing ${missing.join(', ')}.`);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) throw new Error(`Row ${index + 2}: invalid email address.`);
        if (!/^[+\d][\d\s()-]{7,17}$/.test(row.phone)) throw new Error(`Row ${index + 2}: invalid mobile number.`);
        return row;
      });
      setBulkRows(rows);
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Unable to read the uploaded spreadsheet.');
    }
  };

  const importBulkRows = async () => {
    const clusterId = selectedClusterId || currentClusterId;
    if (!clusterId) {
      setBulkError('Select a cluster before uploading volunteers.');
      return;
    }
    if (!bulkRows.length || !onBulkImportVolunteers) {
      setBulkError('Volunteer bulk upload is unavailable or the spreadsheet has no valid rows.');
      return;
    }
    setIsImporting(true);
    setBulkError('');
    try {
      await onBulkImportVolunteers(bulkRows, clusterId);
      showToast(`${bulkRows.length} volunteers uploaded successfully.`);
      setShowBulkUpload(false);
      setBulkRows([]);
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Unable to upload volunteers.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleEditClick = (vol: Volunteer) => {
    const college = vol.college || clusters.find((cluster) => cluster.id === clusterForVolunteer(vol))?.collegeName || '';
    const collegeCategory = classifyCollege(college);
    setEditingVolunteer(vol);
    setFormData({
      name: vol.name,
      gender: vol.gender === 'male' || vol.gender === 'female' || vol.gender === 'other' ? vol.gender : '',
      email: vol.email,
      phone: vol.phone,
      college,
      department: vol.department || defaultDepartmentFor(collegeCategory),
      year: getYearOptions(vol.department || defaultDepartmentFor(collegeCategory), collegeCategory).includes(vol.year || '')
        ? vol.year
        : defaultYearFor(vol.department || defaultDepartmentFor(collegeCategory), collegeCategory),
      totalSessions: vol.totalSessions || 0,
      attendanceRate: vol.attendanceRate || 100,
    });
    setSelectedCollegeCategory(collegeCategory);
    setShowAddModal(true);
  };

  const handleConfirmDelete = () => {
    if (!volunteerToDelete) return;
    const volName = volunteerToDelete.name;
    onDeleteVolunteer(volunteerToDelete.id);

    if (viewingModalVolunteer?.id === volunteerToDelete.id) {
      setViewingModalVolunteer(null);
    }

    showToast("Volunteer " + volName + " deleted successfully");
    setVolunteerToDelete(null);
  };

  return (
    <div className="w-full space-y-6">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[99999] flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-xs font-semibold text-white shadow-theme-lg dark:bg-white dark:text-gray-900 animate-in fade-in-0 slide-in-from-bottom-5">
          <CheckCircle2 className="h-4 w-4 text-success-500 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-gray-400 hover:text-white dark:hover:text-gray-900 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {selectedCluster ? `${selectedCluster.name} — Volunteers` : isSuperAdmin ? 'Volunteers by Cluster' : 'Volunteers & Mentors Directory'}
            </h1>
            <Badge color="primary" size="sm">
              {isClusterOverview ? `${clusters.length} Clusters` : `${filteredVolunteers.length} Volunteers`}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Roster of college volunteers, department specializations, and attendance performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isSuperAdmin && selectedClusterId && (
            <ActionButton size="sm" variant="outline" onClick={() => setSelectedClusterId("")}>
              Back to Clusters
            </ActionButton>
          )}

          {!isClusterOverview && <>
            <ActionButton size="sm" variant="outline" icon={<FileSpreadsheet size={15} />} onClick={exportVolunteersExcel}>
              Excel
            </ActionButton>
            <ActionButton size="sm" variant="outline" icon={<Download size={15} />} onClick={exportVolunteersPdf}>
              PDF
            </ActionButton>
            {onBulkImportVolunteers && <ActionButton size="sm" variant="outline" icon={<Upload size={15} />} onClick={() => { setBulkRows([]); setBulkError(''); setShowBulkUpload(true); }}>
              Bulk Upload
            </ActionButton>}
            <ActionButton
              onClick={() => {
                setEditingVolunteer(null);
                setFormData({
                  name: "",
                  gender: '',
                  email: "",
                  phone: "+91 ",
                  college: selectedCluster?.collegeName || "",
                  department: defaultDepartmentFor(classifyCollege(selectedCluster?.collegeName || '')),
                  year: defaultYearFor(
                    defaultDepartmentFor(classifyCollege(selectedCluster?.collegeName || '')),
                    classifyCollege(selectedCluster?.collegeName || ''),
                  ),
                  totalSessions: 0,
                  attendanceRate: 100,
                });
                setSelectedCollegeCategory(classifyCollege(selectedCluster?.collegeName || ''));
                setShowAddModal(true);
              }}
              size="sm"
              variant="primary"
              icon={<Plus size={15} />}
            >
              Add Volunteer
            </ActionButton>
          </>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Mentors</span>
            <Users className="h-4 w-4 text-brand-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{filteredVolunteers.length}</div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Departments</span>
            <BookOpen className="h-4 w-4 text-success-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {new Set(filteredVolunteers.map(v => v.department)).size}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Avg Attendance</span>
            <Award className="h-4 w-4 text-theme-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {filteredVolunteers.length > 0
              ? Math.round(filteredVolunteers.reduce((acc, v) => acc + (v.attendanceRate || 100), 0) / filteredVolunteers.length) + "%"
              : "100%"}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Final Year</span>
            <GraduationCap className="h-4 w-4 text-warning-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {filteredVolunteers.filter((volunteer) => {
              const college = volunteer.college || clusters.find((cluster) => cluster.id === clusterForVolunteer(volunteer))?.collegeName || '';
              const finalUndergraduateYear = getYearOptions(volunteer.department, classifyCollege(college))
                .filter((year) => year.endsWith('Year'))
                .at(-1);
              return volunteer.year === finalUndergraduateYear || volunteer.year === 'Post Graduate';
            }).length}
          </div>
        </div>
      </div>

  {isClusterOverview && (
                <section aria-label="Volunteers by cluster" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {clusterCards.map(({ cluster, volunteers: clusterVolunteers }) => (
                    <button
                      key={cluster.id}
                      type="button"
                      onClick={() => {
                        setSelectedClusterId(cluster.id);
                        setSearchTerm("");
                        setSelectedDepartment("");
                        setSelectedYear("");
                      }}
                      className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-theme-xs transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-bold text-gray-900 dark:text-white">{cluster.name}</h2>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{cluster.collegeName || "College not configured"}</p>
                          <p className="mt-1 text-xs text-gray-400">{cluster.district || "District not set"}</p>
                        </div>
                        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                          {clusterVolunteers.length} Volunteers
                        </span>
                      </div>
                      <p className="mt-4 border-t border-gray-100 pt-3 text-xs font-semibold text-brand-500 dark:border-gray-800">
                        View volunteers →
                      </p>
                    </button>
                  ))}
                  {clusterCards.length === 0 && <p className="col-span-full rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">No clusters are configured for this academic year.</p>}
                </section>
              )}

              {!isClusterOverview && <>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, department, college..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-48">
            <Select
              value={selectedDepartment || "all"}
              onValueChange={(val) => setSelectedDepartment(val === "all" ? "" : val)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departmentGroups.map((group) => (
                  <SelectGroup key={group.category}>
                    <SelectLabel>{group.category}</SelectLabel>
                    {group.items.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-32">
            <Select
              value={selectedYear || "all"}
              onValueChange={(val) => setSelectedYear(val === "all" ? "" : val)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {yearOptions.map((yr) => (
                  <SelectItem key={yr} value={yr}>
                    {yr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto md:ml-1">
            {filteredVolunteers.length} of {selectedClusterId ? clusterCards.find((item) => item.cluster.id === selectedClusterId)?.volunteers.length || 0 : volunteers.length}
          </span>
        </div>
      </div>

      {filteredVolunteers.length === 0 ? (
        <div className="py-16 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-3 text-base font-semibold text-gray-800 dark:text-white">No volunteers found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm || selectedDepartment || selectedYear ? "Try clearing your filters." : "Add your first volunteer mentor to get started."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader className="w-16">S.No</TableCell>
                <TableCell isHeader className="w-[260px]">Volunteer Name</TableCell>
                <TableCell isHeader>Department</TableCell>
                <TableCell isHeader>Year</TableCell>
                <TableCell isHeader>College</TableCell>
                <TableCell isHeader>Contact</TableCell>
                <TableCell isHeader className="text-right">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVolunteers.map((vol, index) => (
                <TableRow
                  key={vol.id}
                  onClick={() => setViewingModalVolunteer(vol)}
                  className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <TableCell className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{index + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-500 dark:bg-brand-500/10 dark:text-brand-400 shrink-0">
                        {vol.avatarText || vol.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-white">{vol.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {vol.department}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge color="light" size="sm">
                      {vol.year}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-500 dark:text-gray-400 text-xs max-w-[200px] truncate">
                    {vol.college || clusters.find((cluster) => cluster.id === clusterForVolunteer(vol))?.collegeName || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-500 dark:text-gray-400">
                    {vol.phone}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setViewingModalVolunteer(vol)}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white transition cursor-pointer"
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditClick(vol)}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-500 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-brand-400 transition cursor-pointer"
                        title="Edit volunteer"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setVolunteerToDelete(vol)}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-error-50 hover:text-error-600 dark:text-gray-400 dark:hover:bg-error-500/10 dark:hover:text-error-400 transition cursor-pointer"
                        title="Delete volunteer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* View Volunteer Details Modal */}
        </>}

        {/* View Volunteer Details Modal */}
      {viewingModalVolunteer && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-gray-900/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900 animate-in fade-in-0 zoom-in-95 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Volunteer Profile</h3>
              <button
                type="button"
                onClick={() => setViewingModalVolunteer(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 rounded-xl bg-gray-50/80 p-4 dark:bg-white/[0.02]">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-lg font-bold text-white shadow-theme-xs">
                {viewingModalVolunteer.avatarText || viewingModalVolunteer.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="space-y-0.5">
                <h4 className="text-base font-bold text-gray-900 dark:text-white">{viewingModalVolunteer.name}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">{viewingModalVolunteer.email}</p>
                <p className="text-xs font-mono text-gray-600 dark:text-gray-300">{viewingModalVolunteer.phone}</p>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-gray-100 p-4 text-xs dark:border-gray-800">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] font-semibold uppercase text-gray-400 block mb-1">Department</span>
                  <span className="font-semibold text-gray-800 dark:text-white">{viewingModalVolunteer.department}</span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase text-gray-400 block mb-1">Year of Study</span>
                  <span className="font-semibold text-gray-800 dark:text-white">{viewingModalVolunteer.year}</span>
                </div>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase text-gray-400 block mb-1">Institution</span>
                <span className="font-medium text-gray-600 dark:text-gray-300">{viewingModalVolunteer.college}</span>
                              <span className="font-medium text-gray-600 dark:text-gray-300">
                                {viewingModalVolunteer.college || clusters.find((cluster) => cluster.id === clusterForVolunteer(viewingModalVolunteer))?.collegeName || "—"}
                              </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                <div className="text-[11px] uppercase font-semibold text-gray-400">Sessions Attended</div>
                <div className="text-2xl font-bold text-brand-500 mt-1">{viewingModalVolunteer.totalSessions || 0}</div>
              </div>
              <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                <div className="text-[11px] uppercase font-semibold text-gray-400">Attendance Rate</div>
                <div className="text-2xl font-bold text-success-500 mt-1">{viewingModalVolunteer.attendanceRate || 100}%</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  const toDelete = viewingModalVolunteer;
                  setViewingModalVolunteer(null);
                  setVolunteerToDelete(toDelete);
                }}
                className="rounded-xl border border-error-200 bg-error-50 px-3.5 py-2 text-xs font-semibold text-error-600 hover:bg-error-100 dark:border-error-900/40 dark:bg-error-500/10 dark:text-error-400 transition cursor-pointer"
              >
                Delete Volunteer
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingModalVolunteer(null)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = viewingModalVolunteer;
                    setViewingModalVolunteer(null);
                    handleEditClick(toEdit);
                  }}
                  className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition cursor-pointer"
                >
                  Edit Volunteer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {volunteerToDelete && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-gray-900/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900 text-center animate-in fade-in-0 zoom-in-95 space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error-50 text-error-500 dark:bg-error-500/10">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Volunteer?</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Are you sure you want to remove <strong className="text-gray-800 dark:text-white">{volunteerToDelete.name}</strong> from the directory?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setVolunteerToDelete(null)}
                className="flex-1 rounded-xl border border-gray-300 bg-white py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 rounded-xl bg-error-500 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-error-600 transition cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkUpload && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-gray-900/75 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="volunteer-bulk-title" className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
              <div><h2 id="volunteer-bulk-title" className="text-lg font-bold text-gray-900 dark:text-white">Bulk Upload Volunteers</h2><p className="mt-1 text-xs text-gray-500">Upload an Excel or CSV file with the template columns only.</p></div>
              <button type="button" disabled={isImporting} onClick={() => setShowBulkUpload(false)} aria-label="Close bulk upload" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60">
              <div><p className="text-sm font-semibold text-gray-800 dark:text-white">Required columns</p><p className="mt-1 text-xs text-gray-500">Name · Year · Department · Mail ID · Mobile Number</p></div>
              <button type="button" onClick={downloadBulkTemplate} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"><Download className="h-4 w-4" /> Download Template</button>
            </div>
            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 px-5 py-8 text-center hover:border-brand-400 hover:bg-brand-50/30 dark:border-gray-700 dark:hover:bg-white/[0.02]">
              <FileSpreadsheet className="h-8 w-8 text-brand-500" />
              <span className="mt-2 text-sm font-semibold text-gray-800 dark:text-white">Choose .xlsx, .xls, or .csv file</span>
              <span className="mt-1 text-xs text-gray-500">The first worksheet will be previewed before import.</span>
              <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void parseBulkFile(file); event.currentTarget.value = ''; }} />
            </label>
            {bulkError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{bulkError}</p>}
            {bulkRows.length > 0 && <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-200">{bulkRows.length} valid volunteer{bulkRows.length === 1 ? '' : 's'} ready to import</div>
              <table className="w-full min-w-[650px] text-left text-xs"><thead className="text-gray-500"><tr>{['Name', 'Year', 'Department', 'Mail ID', 'Mobile Number'].map((heading) => <th key={heading} className="px-3 py-2 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{bulkRows.slice(0, 5).map((row, index) => <tr key={`${row.email}-${index}`}><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{row.year}</td><td className="px-3 py-2">{row.department}</td><td className="px-3 py-2">{row.email}</td><td className="px-3 py-2">{row.phone}</td></tr>)}</tbody></table>
              {bulkRows.length > 5 && <p className="px-3 py-2 text-[11px] text-gray-500">Showing first 5 rows.</p>}
            </div>}
            <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
              <button type="button" disabled={isImporting} onClick={() => setShowBulkUpload(false)} className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">Cancel</button>
              <button type="button" disabled={isImporting || !bulkRows.length} onClick={() => void importBulkRows()} className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{isImporting ? 'Uploading…' : `Import ${bulkRows.length || ''} Volunteers`}</button>
            </div>
          </section>
        </div>
      )}

      {/* Add/Edit Volunteer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-gray-900/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingVolunteer ? "Edit Volunteer" : "Add New Volunteer"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVolunteer} className="mt-5 space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter volunteer name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-3.5 py-2.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="you@college.edu"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-3.5 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-3.5 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Gender {!editingVolunteer && '*'}</label>
                <Select value={formData.gender} onValueChange={(value) => setFormData((current) => ({ ...current, gender: value as 'male' | 'female' | 'other' }))}>
                  <SelectTrigger className="w-full rounded-lg border-gray-300 px-3.5 py-2.5 text-xs text-gray-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  College / Institution
                </label>
                {!isSuperAdmin && selectedCluster?.collegeName ? <div className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3.5 py-2.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" aria-readonly="true">{selectedCluster.collegeName}<span className="ml-2 text-[10px] font-normal text-gray-500">Cluster college · fixed</span></div> : <CollegeCombobox
                  value={formData.college}
                  authToken={authToken}
                  placeholder="Search and choose a college"
                  onChange={(college, typedValue) => {
                    const category = classifyCollege(college || typedValue || '');
                    setSelectedCollegeCategory(category);
                    const groups = category === 'engineering'
                      ? departmentGroups.filter((group) => /engineering|technology/i.test(group.category))
                      : category === 'medical'
                        ? departmentGroups.filter((group) => group.category === 'Medical & Health Sciences')
                        : category === 'arts'
                          ? departmentGroups.filter((group) => /arts & science|commerce & management/i.test(group.category))
                          : departmentGroups;
                    const validDepartments = groups.flatMap((group) => group.items);
                    setFormData((current) => {
                      const department = validDepartments.includes(current.department) ? current.department : validDepartments[0] || current.department;
                      const nextYearOptions = getYearOptions(department, category);
                      return {
                        ...current,
                        college: college?.name || typedValue || '',
                        department,
                        year: nextYearOptions.includes(current.year) ? current.year : nextYearOptions[0],
                      };
                    });
                  }}
                />}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Department *
                  </label>
                  <Select
                    value={formData.department}
                    onValueChange={(val) => {
                      const nextYearOptions = getYearOptions(val);
                      setFormData((current) => ({
                        ...current,
                        department: val,
                        year: nextYearOptions.includes(current.year) ? current.year : nextYearOptions[0],
                      }));
                    }}
                  >
                    <SelectTrigger className="w-full rounded-lg border-gray-300 px-3.5 py-2.5 text-xs text-gray-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {collegeDepartmentGroups.map((group) => (
                        <SelectGroup key={group.category}>
                          <SelectLabel>{group.category}</SelectLabel>
                          {group.items.map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Year *
                  </label>
                  <Select
                    value={formData.year}
                    onValueChange={(val) => setFormData({ ...formData, year: val })}
                  >
                    <SelectTrigger className="w-full rounded-lg border-gray-300 px-3.5 py-2.5 text-xs text-gray-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
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

              <div className="pt-3 mt-1 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingVolunteer}
                  className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition cursor-pointer disabled:opacity-60"
                >
                  {isSavingVolunteer ? 'Saving…' : editingVolunteer ? "Update Volunteer" : "Save Volunteer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
