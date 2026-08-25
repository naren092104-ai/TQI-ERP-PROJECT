import React, { useState, useMemo } from 'react';
import { Volunteer, Panchayat } from '../types';

interface VolunteersViewProps {
  volunteers: Volunteer[];
  panchayats?: Panchayat[];
  onAddVolunteer: (newVol: Omit<Volunteer, 'id' | 'avatarText' | 'recentSessions' | 'totalSessions' | 'attendanceRate'>) => void;
  onUpdateVolunteer: (id: string, updated: Partial<Volunteer>) => void;
  onDeleteVolunteer: (id: string) => void;
}

export const VolunteersView: React.FC<VolunteersViewProps> = ({
  volunteers,
  onAddVolunteer,
  onUpdateVolunteer,
  onDeleteVolunteer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(volunteers[0] || null);
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

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '+91 ',
    college: 'Government College of Engineering, Dharmapuri',
    department: 'Computer Science and Engineering',
    year: '4th Year',
    totalSessions: 0,
    attendanceRate: 100,
  });

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
      showToast('Please enter volunteer name');
      return;
    }

    if (editingVolunteer) {
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

      if (selectedVolunteer?.id === editingVolunteer.id) {
        setSelectedVolunteer({
          ...selectedVolunteer,
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

      showToast(`Updated volunteer ${formData.name}`);
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
      showToast(`Added volunteer ${formData.name}`);
    }

    setShowAddModal(false);
    setFormData({
      name: '',
      email: '',
      phone: '+91 ',
      college: 'Government College of Engineering, Dharmapuri',
      department: 'Computer Science and Engineering',
      year: '4th Year',
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
      college: vol.college || 'Government College of Engineering, Dharmapuri',
      department: vol.department || 'Computer Science and Engineering',
      year: vol.year || '4th Year',
      totalSessions: vol.totalSessions || 0,
      attendanceRate: vol.attendanceRate || 100,
    });
    setShowAddModal(true);
  };

  const handleConfirmDelete = () => {
    if (!volunteerToDelete) return;
    const volName = volunteerToDelete.name;
    onDeleteVolunteer(volunteerToDelete.id);

    if (selectedVolunteer?.id === volunteerToDelete.id) {
      const remaining = volunteers.filter((v) => v.id !== volunteerToDelete.id);
      setSelectedVolunteer(remaining[0] || null);
    }

    if (viewingModalVolunteer?.id === volunteerToDelete.id) {
      setViewingModalVolunteer(null);
    }

    showToast(`Volunteer ${volName} deleted successfully`);
    setVolunteerToDelete(null);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto relative">
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

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-1">
        <div>
          <nav className="flex items-center text-[11px] font-medium text-[#434652] mb-0.5">
            <span>Dharmapuri Cluster</span>
            <span className="material-symbols-outlined text-[13px] mx-1">chevron_right</span>
            <span className="text-[#002869] font-bold">Volunteers</span>
          </nav>
          <h1 className="text-[20px] font-bold text-[#002869] tracking-tight">Volunteers</h1>
          <p className="text-[12px] text-[#434652]">
            Directory of student volunteers, department specializations, and academic years.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingVolunteer(null);
            setFormData({
              name: '',
              email: '',
              phone: '+91 ',
              college: 'Government College of Engineering, Dharmapuri',
              department: 'Computer Science and Engineering',
              year: '4th Year',
              totalSessions: 0,
              attendanceRate: 100,
            });
            setShowAddModal(true);
          }}
          className="bg-[#002869] text-white px-3.5 py-2 rounded-md text-[12.5px] font-bold flex items-center gap-1.5 hover:bg-[#002869]/90 active:scale-95 transition-all shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[17px]">person_add</span>
          Add Volunteer
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#c4c6d3]/60 rounded-md p-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#747783] text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by name, department, college..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#f4f3fb] border border-[#c4c6d3] rounded-md focus:border-[#002869] text-[13px] h-[38px] outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="bg-[#f4f3fb] border border-[#c4c6d3] rounded-md px-3 py-2 text-[13px] focus:border-[#002869] h-[38px] min-w-[160px] outline-none font-medium text-[#002869]"
            >
              <option value="">All Departments</option>
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-[#f4f3fb] border border-[#c4c6d3] rounded-md px-3 py-2 text-[13px] focus:border-[#002869] h-[38px] min-w-[130px] outline-none font-medium text-[#002869]"
            >
              <option value="">All Years</option>
              {yearOptions.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Volunteers Table & List View (Full Width) */}
      <div className="w-full space-y-4">
        {/* Desktop Table View */}
        <div className="hidden md:block bg-white rounded-md border border-[#c4c6d3]/60 shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#f4f3fb] text-[11px] font-bold text-[#002869] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 border-b border-[#c4c6d3]">Volunteer Name</th>
                <th className="px-4 py-3 border-b border-[#c4c6d3]">Department</th>
                <th className="px-4 py-3 border-b border-[#c4c6d3]">Year</th>
                <th className="px-4 py-3 border-b border-[#c4c6d3]">College</th>
                <th className="px-4 py-3 border-b border-[#c4c6d3]">Contact</th>
                <th className="px-4 py-3 border-b border-[#c4c6d3] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-[13px] divide-y divide-[#c4c6d3]/40">
              {filteredVolunteers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#747783] text-[13px]">
                    No volunteers match the current search or filters.
                  </td>
                </tr>
              ) : (
                filteredVolunteers.map((vol) => (
                  <tr
                    key={vol.id}
                    onClick={() => setViewingModalVolunteer(vol)}
                    className="hover:bg-[#faf8ff] transition-colors group cursor-pointer"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#002869] text-white flex items-center justify-center font-bold text-[12px] flex-shrink-0">
                          {vol.avatarText}
                        </div>
                        <span className="font-bold text-[#002869] group-hover:underline">{vol.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-[#1a1b21]">
                      <span className="inline-block bg-[#f4f3fb] text-[#002869] px-2 py-0.5 rounded text-[12px] font-semibold border border-[#c4c6d3]/60">
                        {vol.department}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-block bg-[#dae2ff] text-[#001947] px-2 py-0.5 rounded text-[11px] font-bold">
                        {vol.year}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[#434652] text-[12px] max-w-[220px] truncate" title={vol.college}>
                      {vol.college || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-[#434652] text-[12px] font-mono">{vol.phone}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex justify-end items-center gap-1">
                        {/* View Details button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingModalVolunteer(vol);
                          }}
                          className="p-1.5 text-[#002869] hover:bg-[#dae2ff] rounded-md transition-colors cursor-pointer"
                          title="View Volunteer Details"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>

                        {/* Edit button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(vol);
                          }}
                          className="p-1.5 text-[#434652] hover:text-[#002869] rounded-md hover:bg-[#e8e7ef] transition-colors cursor-pointer"
                          title="Edit Volunteer"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>

                        {/* Delete button with in-app modal confirmation */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVolunteerToDelete(vol);
                          }}
                          className="p-1.5 text-[#434652] hover:text-[#ba1a1a] rounded-md hover:bg-[#ffdad6]/40 transition-colors cursor-pointer"
                          title="Delete Volunteer"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile List View */}
        <div className="md:hidden flex flex-col gap-3">
          {filteredVolunteers.map((vol) => (
            <div
              key={vol.id}
              onClick={() => setViewingModalVolunteer(vol)}
              className="bg-white border border-[#c4c6d3]/60 rounded-md p-4 shadow-xs relative active:bg-[#f4f3fb] transition-colors cursor-pointer"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#002869] text-white flex items-center justify-center font-bold text-[13px] flex-shrink-0">
                    {vol.avatarText}
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-[#002869]">{vol.name}</div>
                    <div className="text-[12px] text-[#434652]">{vol.phone}</div>
                  </div>
                </div>
                <span className="bg-[#dae2ff] text-[#001947] text-[11px] font-bold px-2 py-0.5 rounded">
                  {vol.year}
                </span>
              </div>
              <div className="bg-[#f4f3fb] p-2.5 rounded-md border border-[#c4c6d3]/40 text-[12px] my-2">
                <div className="text-[#002869] font-bold">{vol.department}</div>
                <div className="text-[#434652] text-[11px] mt-0.5">{vol.college}</div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[#c4c6d3]/40">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingModalVolunteer(vol);
                  }}
                  className="text-[#002869] flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 bg-[#dae2ff]/50 rounded hover:bg-[#dae2ff] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span> View Details
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditClick(vol);
                  }}
                  className="text-[#002869] flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded hover:bg-[#f4f3fb] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span> Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setVolunteerToDelete(vol);
                  }}
                  className="text-[#ba1a1a] flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded hover:bg-[#ffdad6]/40 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ==========================================
          FULL VOLUNTEER DETAILS MODAL (POPUP)
         ========================================== */}
      {viewingModalVolunteer && (
        <div className="fixed inset-0 bg-black/60  z-[130] flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white rounded-md max-w-lg w-full overflow-hidden shadow-sm border border-[#c4c6d3] p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#c4c6d3] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#002869] text-[22px]">badge</span>
                <h3 className="text-[17px] font-bold text-[#002869]">Volunteer Profile</h3>
              </div>
              <button
                onClick={() => setViewingModalVolunteer(null)}
                className="p-1 text-[#747783] hover:text-[#1a1b21] rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Profile Content */}
            <div className="flex items-center gap-4 bg-[#f4f3fb] p-4 rounded-md border border-[#c4c6d3]/40">
              <div className="w-14 h-14 rounded-full bg-[#002869] text-white flex items-center justify-center text-[20px] font-bold flex-shrink-0 shadow-sm">
                {viewingModalVolunteer.avatarText}
              </div>
              <div>
                <h4 className="text-[18px] font-bold text-[#002869]">{viewingModalVolunteer.name}</h4>
                <p className="text-[12.5px] text-[#434652]">{viewingModalVolunteer.email}</p>
                <p className="text-[12.5px] text-[#434652] font-semibold">{viewingModalVolunteer.phone}</p>
              </div>
            </div>

            {/* Academic Information */}
            <div className="space-y-3 bg-white p-4 rounded-md border border-[#c4c6d3]/60 text-[13px]">
              <div className="text-[11px] font-bold text-[#002869] uppercase tracking-wider flex items-center gap-1 mb-2">
                <span className="material-symbols-outlined text-[16px]">school</span>
                Academic &amp; Institution Details
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[#747783] text-[11px] font-semibold uppercase block">Department</span>
                  <span className="font-bold text-[#002869]">{viewingModalVolunteer.department}</span>
                </div>
                <div>
                  <span className="text-[#747783] text-[11px] font-semibold uppercase block">Year of Study</span>
                  <span className="font-bold text-[#1a1b21]">{viewingModalVolunteer.year}</span>
                </div>
              </div>
              <div>
                <span className="text-[#747783] text-[11px] font-semibold uppercase block">College / Institution</span>
                <span className="font-medium text-[#434652]">{viewingModalVolunteer.college || 'Government College of Engineering, Dharmapuri'}</span>
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#f4f3fb] p-3.5 rounded-md border border-[#c4c6d3]/40 text-center">
                <div className="text-[11px] font-bold text-[#747783] uppercase">Sessions Attended</div>
                <div className="text-[24px] font-bold text-[#002869]">{viewingModalVolunteer.totalSessions || 0}</div>
              </div>
              <div className="bg-[#f4f3fb] p-3.5 rounded-md border border-[#c4c6d3]/40 text-center">
                <div className="text-[11px] font-bold text-[#747783] uppercase">Attendance Rate</div>
                <div className="text-[24px] font-bold text-[#002869]">{viewingModalVolunteer.attendanceRate || 95}%</div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[#c4c6d3]">
              <button
                type="button"
                onClick={() => {
                  const toDelete = viewingModalVolunteer;
                  setViewingModalVolunteer(null);
                  setVolunteerToDelete(toDelete);
                }}
                className="px-3.5 py-2 bg-[#ffdad6] text-[#ba1a1a] rounded-md text-[12.5px] font-bold hover:bg-[#ffdad6]/80 flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Delete Volunteer
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingModalVolunteer(null)}
                  className="px-4 py-2 bg-white border border-[#c4c6d3] text-[#434652] rounded-md text-[12.5px] font-bold hover:bg-[#f4f3fb] cursor-pointer"
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
                  className="px-4 py-2 bg-[#002869] text-white rounded-md text-[12.5px] font-bold hover:bg-[#002869]/90 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Edit Volunteer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          IN-APP DELETE CONFIRMATION MODAL
         ========================================== */}
      {volunteerToDelete && (
        <div className="fixed inset-0 bg-black/60  z-[150] flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white rounded-md max-w-sm w-full overflow-hidden shadow-sm border border-[#c4c6d3] p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[26px]">delete_forever</span>
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-[#ba1a1a]">Delete Volunteer?</h3>
              <p className="text-[13px] text-[#434652] mt-1.5 leading-relaxed">
                Are you sure you want to delete <strong className="text-[#1a1b21]">{volunteerToDelete.name}</strong> from the volunteer directory?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVolunteerToDelete(null)}
                className="flex-1 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] font-bold text-[#434652] hover:bg-[#f4f3fb] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2 bg-[#ba1a1a] text-white rounded-md text-[13px] font-bold hover:bg-[#93000a] transition-colors shadow-xs cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          ADD / EDIT VOLUNTEER MODAL
         ========================================== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#001947]/40  z-[120] flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-sm w-full max-w-lg overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <div className="px-6 py-4 border-b border-[#c4c6d3] bg-[#f4f3fb] flex justify-between items-center">
              <h2 className="text-[17px] font-bold text-[#002869] flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">badge</span>
                {editingVolunteer ? 'Edit Volunteer' : 'Add New Volunteer'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-[#434652] hover:bg-[#e8e7ef] rounded-full transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveVolunteer} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-[12px] font-bold text-[#002869] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter volunteer name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869] h-[38px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-bold text-[#002869] mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869] h-[38px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-[#002869] mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869] h-[38px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#002869] mb-1">College / Institution</label>
                <input
                  type="text"
                  placeholder="e.g. Government College of Engineering, Dharmapuri"
                  value={formData.college}
                  onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869] h-[38px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-bold text-[#002869] mb-1">Department *</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869] h-[38px]"
                  >
                    {departmentOptions.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#002869] mb-1">Year *</label>
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869] h-[38px]"
                  >
                    {yearOptions.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {editingVolunteer && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-bold text-[#002869] mb-1">Sessions Attended</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.totalSessions}
                      onChange={(e) =>
                        setFormData({ ...formData, totalSessions: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869] h-[38px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[#002869] mb-1">Attendance Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.attendanceRate}
                      onChange={(e) =>
                        setFormData({ ...formData, attendanceRate: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full px-3 py-2 bg-white border border-[#c4c6d3] rounded-md text-[13px] focus:outline-none focus:border-[#002869] h-[38px]"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-[#c4c6d3] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-[13px] font-bold text-[#434652] border border-[#747783] rounded-md hover:bg-[#f4f3fb] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-[13px] font-bold bg-[#002869] text-white rounded-md hover:bg-[#0b3d91] transition-colors shadow-xs cursor-pointer"
                >
                  {editingVolunteer ? 'Update Volunteer' : 'Save Volunteer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};



