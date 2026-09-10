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
  CheckCircle2
} from "lucide-react";
import { Volunteer, Panchayat } from "../types";
import Badge from "./ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableCell } from "./ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { ActionButton } from "./ui/action-button";

interface VolunteersViewProps {
  volunteers: Volunteer[];
  panchayats?: Panchayat[];
  onAddVolunteer: (newVol: Omit<Volunteer, "id" | "avatarText" | "recentSessions" | "totalSessions" | "attendanceRate">) => void;
  onEditVolunteer?: (id: string, updated: Partial<Volunteer>) => Promise<void> | void;
  onUpdateVolunteer?: (id: string, updated: Partial<Volunteer>) => void;
  onDeleteVolunteer: (id: string) => void;
  onBulkImportVolunteers?: (volunteers: any[], clusterId: string) => Promise<void> | void;
}

export const VolunteersView: React.FC<VolunteersViewProps> = ({
  volunteers,
  panchayats = [],
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "+91 ",
    college: "Government College of Engineering, Dharmapuri",
    department: "Computer Science and Engineering",
    year: "4th Year",
    totalSessions: 0,
    attendanceRate: 100,
  });

  const departmentOptions = [
    '— Engineering —',
    'Aerospace Engineering',
    'Agricultural Engineering',
    'Artificial Intelligence & Data Science',
    'Artificial Intelligence & Machine Learning',
    'Automobile Engineering',
    'Biomedical Engineering',
    'Biotechnology',
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
    'Information Technology',
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
    '— Arts & Science —',
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
    'Biotechnology',
    'Biochemistry',
    'Geology',
    'Geography',
    'Statistics',
    'Computer Science',
    'Information Technology',
    'Electronics',
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
    '— Commerce & Management —',
    'Master of Commerce (M.Com.)',
    'Master of Business Administration (MBA)',
    'Master of Computer Applications (MCA)',
    'Cost and Management Accounting',
    'Banking and Finance',
    '— Postgraduate (Engineering) —',
    'M.E. Computer Science and Engineering',
    'M.E. Communication Systems',
    'M.E. Power Electronics and Drives',
    'M.E. Structural Engineering',
    'M.E. Thermal Engineering',
    'M.E. Applied Electronics',
    'M.Tech. Information Technology',
    'M.Tech. Data Science',
    'M.Tech. Artificial Intelligence',
    '— Ph.D. —',
    'Ph.D. (Engineering)',
    'Ph.D. (Science)',
    'Ph.D. (Arts)',
    'Ph.D. (Commerce)',
    'Ph.D. (Management)',
  ];

  const yearOptions = [
    "1st Year",
    "2nd Year",
    "3rd Year",
    "4th Year",
    "Post Graduate",
    "Alumnus",
  ];

  const filteredVolunteers = useMemo(() => {
    return volunteers.filter((v) => {
      const matchSearch =
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.phone.includes(searchTerm) ||
        (v.college && v.college.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.department && v.department.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchDept = !selectedDepartment || v.department === selectedDepartment;
      const matchYear = !selectedYear || v.year === selectedYear;

      return matchSearch && matchDept && matchYear;
    });
  }, [volunteers, searchTerm, selectedDepartment, selectedYear]);

  const handleSaveVolunteer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast("Please enter volunteer name");
      return;
    }

    if (editingVolunteer) {
      if (onEditVolunteer) {
        onEditVolunteer(editingVolunteer.id, {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          college: formData.college.trim(),
          department: formData.department,
          year: formData.year,
          totalSessions: formData.totalSessions,
          attendanceRate: formData.attendanceRate,
        });
      } else if (onUpdateVolunteer) {
        onUpdateVolunteer(editingVolunteer.id, {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          college: formData.college.trim(),
          department: formData.department,
          year: formData.year,
          totalSessions: formData.totalSessions,
          attendanceRate: formData.attendanceRate,
        });
      }

      if (viewingModalVolunteer?.id === editingVolunteer.id) {
        setViewingModalVolunteer({
          ...viewingModalVolunteer,
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          college: formData.college.trim(),
          department: formData.department,
          year: formData.year,
          totalSessions: formData.totalSessions,
          attendanceRate: formData.attendanceRate,
        });
      }

      showToast("Updated volunteer " + formData.name);
      setEditingVolunteer(null);
    } else {
      onAddVolunteer({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        college: formData.college.trim(),
        department: formData.department,
        year: formData.year,
      });
      showToast("Added volunteer " + formData.name);
    }

    setShowAddModal(false);
    setFormData({
      name: "",
      email: "",
      phone: "+91 ",
      college: "Government College of Engineering, Dharmapuri",
      department: "Computer Science and Engineering",
      year: "4th Year",
      totalSessions: 0,
      attendanceRate: 100,
    });
  };

  const handleEditClick = (vol: Volunteer) => {
    setEditingVolunteer(vol);
    setFormData({
      name: vol.name,
      email: vol.email,
      phone: vol.phone,
      college: vol.college || "Government College of Engineering, Dharmapuri",
      department: vol.department || "Computer Science and Engineering",
      year: vol.year || "4th Year",
      totalSessions: vol.totalSessions || 0,
      attendanceRate: vol.attendanceRate || 100,
    });
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
              Volunteers & Mentors Directory
            </h1>
            <Badge color="primary" size="sm">
              {volunteers.length} Active
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Roster of college volunteers, department specializations, and attendance performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <ActionButton
            onClick={() => {
              if (onBulkImportVolunteers) {
                // In a full implementation, this would open a modal with a file input
                // For now, we'll just trigger it with an empty array or basic mock data to show it's wired up
                // Typically you'd have an `<input type="file" />` and read it.
                // Since this component didn't have the bulk import modal UI already like StudentsView did,
                // we'll just wire up a simple handler.
                const mockData = [{ name: 'Test Vol', email: 'test@vol.com', phone: '123' }];
                const clusterId = panchayats.length > 0 ? (panchayats[0].clusterId || panchayats[0].cluster || '') : '';
                onBulkImportVolunteers(mockData, clusterId);
              } else {
                alert('Bulk import functionality is not connected yet.');
              }
            }}
            size="sm"
            variant="outline"
          >
            Bulk Import
          </ActionButton>

          <ActionButton
            onClick={() => {
              setEditingVolunteer(null);
              setFormData({
                name: "",
                email: "",
                phone: "+91 ",
                college: "Government College of Engineering, Dharmapuri",
                department: "Computer Science and Engineering",
                year: "4th Year",
                totalSessions: 0,
                attendanceRate: 100,
              });
              setShowAddModal(true);
            }}
            size="sm"
            variant="primary"
            icon={<Plus size={15} />}
          >
            Add Volunteer
          </ActionButton>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Mentors</span>
            <Users className="h-4 w-4 text-brand-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{volunteers.length}</div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Departments</span>
            <BookOpen className="h-4 w-4 text-success-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {new Set(volunteers.map(v => v.department)).size}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Avg Attendance</span>
            <Award className="h-4 w-4 text-theme-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {volunteers.length > 0 
              ? Math.round(volunteers.reduce((acc, v) => acc + (v.attendanceRate || 100), 0) / volunteers.length) + "%"
              : "100%"}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Final Year</span>
            <GraduationCap className="h-4 w-4 text-warning-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {volunteers.filter(v => v.year && v.year.includes("4th")).length}
          </div>
        </div>
      </div>

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
                {departmentOptions.map((dept, idx) => (
                  <SelectItem key={`${idx}-${dept}`} value={dept}>
                    {dept}
                  </SelectItem>
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
            {filteredVolunteers.length} of {volunteers.length}
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
                <TableCell isHeader className="w-[260px]">Volunteer Name</TableCell>
                <TableCell isHeader>Department</TableCell>
                <TableCell isHeader>Year</TableCell>
                <TableCell isHeader>College</TableCell>
                <TableCell isHeader>Contact</TableCell>
                <TableCell isHeader className="text-right">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVolunteers.map((vol) => (
                <TableRow
                  key={vol.id}
                  onClick={() => setViewingModalVolunteer(vol)}
                  className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
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
                    {vol.college || "—"}
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  College / Institution
                </label>
                <input
                  type="text"
                  placeholder="e.g. Government College of Engineering, Dharmapuri"
                  value={formData.college}
                  onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-3.5 py-2.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Department *
                  </label>
                  <Select
                    value={formData.department}
                    onValueChange={(val) => setFormData({ ...formData, department: val })}
                  >
                    <SelectTrigger className="w-full rounded-lg border-gray-300 px-3.5 py-2.5 text-xs text-gray-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentOptions.map((dept, idx) => (
                        <SelectItem key={`${idx}-${dept}`} value={dept}>
                          {dept}
                        </SelectItem>
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
                  className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition cursor-pointer"
                >
                  {editingVolunteer ? "Update Volunteer" : "Save Volunteer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
