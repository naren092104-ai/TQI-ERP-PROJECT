import React, { useState, useMemo, useEffect } from 'react';
import {
  AttendanceSession,
  Student,
  Panchayat,
  Village,
  TabType,
  AttendanceRecord,
  Volunteer,
  Session,
} from '../types';
import { apiUrl } from '../utils/api';
import {
  Search,
  Check,
  X,
  Lock,
  Edit3,
  Send,
  Save,
  Building2,
  House,
  ArrowLeft,
  Users,
  CheckCircle,
  WarningCircle,
  CaretRight,
} from './ui/icons';

interface AttendanceViewProps {
  attendanceSessions: AttendanceSession[];
  students: Student[];
  panchayats: Panchayat[];
  sessions?: Session[];
  programDays?: Array<{ id: string; day_number: number; day_name: string; academic_year_id?: string; status?: string }>;
  selectedAcademicYearId?: string;
  volunteers?: Volunteer[];
  draftId?: string;
  userRole?: string;
  clusterName?: string;
  authToken?: string;
  onNavigate: (tab: TabType) => void;
  onSaveAttendance: (session: AttendanceSession) => void;
}

// Visual color schemes for the program days
const DAY_COLOR_SCHEMES = [
  { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200' },
  { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
  { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' },
  { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200' },
  { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200' },
];

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  attendanceSessions,
  students,
  panchayats,
  sessions = [],
  programDays = [],
  volunteers = [],
  selectedAcademicYearId,
  userRole = 'Cluster Admin',
  clusterName = 'KSR (Dharmapuri)',
  authToken,
  onNavigate,
  onSaveAttendance,
}) => {
  // Navigation levels: 'days' (Screen 1) -> 'panchayats' (Screen 2) -> 'villages' (Screen 3) -> 'mark' (Screen 4, 6, 8)
  const [navLevel, setNavLevel] = useState<'days' | 'panchayats' | 'villages' | 'mark'>('days');
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(1);
  const [selectedPanchayatId, setSelectedPanchayatId] = useState<string>('');
  const [selectedVillageId, setSelectedVillageId] = useState<string>('');
  const [attendanceSubject, setAttendanceSubject] = useState<'students' | 'volunteers'>('students');

  // Active village attendance state
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [recordsMap, setRecordsMap] = useState<Record<string, { status: 'Present' | 'Absent' | 'Not Marked'; taskStatus: 'Completed' | 'Incomplete' | 'Not Marked' }>>({});
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Filters inside Mark view
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [standardFilter, setStandardFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');

  // Modals state
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState<boolean>(false);
  const [showEditRequestModal, setShowEditRequestModal] = useState<boolean>(false);
  const [editRequestReason, setEditRequestReason] = useState<string>('');
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Configured Program Days: "Show only Super Admin configured days"
  const activeDays = useMemo(() => {
    if (programDays && programDays.length > 0) {
      return [...programDays]
        .filter((d) => !d.status || d.status === 'ACTIVE')
        .sort((a, b) => a.day_number - b.day_number);
    }
    // Fallback standard days if no programDays configured
    return [
      { id: 'd1', day_number: 1, day_name: 'Introduction & Orientation' },
      { id: 'd2', day_number: 2, day_name: 'Life Skills' },
      { id: 'd3', day_number: 3, day_name: 'Communication' },
      { id: 'd4', day_number: 4, day_name: 'Team Building' },
      { id: 'd5', day_number: 5, day_name: 'Leadership' },
    ];
  }, [programDays]);

  // Map each day number to its scheduled date
  const dayDateMap = useMemo(() => {
    const map: Record<number, string> = {};
    sessions.forEach((s) => {
      const dNum = s.dayNumber || (s.day ? parseInt(s.day.replace(/\D/g, ''), 10) : undefined);
      if (dNum && s.date && !map[dNum]) {
        try {
          const d = new Date(s.date);
          if (!isNaN(d.getTime())) {
            const dayStr = String(d.getDate()).padStart(2, '0');
            const monthStr = String(d.getMonth() + 1).padStart(2, '0');
            const yearStr = d.getFullYear();
            map[dNum] = `${dayStr}/${monthStr}/${yearStr}`;
          }
        } catch {
          map[dNum] = s.date;
        }
      }
    });
    return map;
  }, [sessions]);

  // Selected Day Object
  const currentDayObj = useMemo(() => {
    return activeDays.find((d) => d.day_number === selectedDayNumber) || activeDays[0] || { day_number: 1, day_name: 'Day 1 Session' };
  }, [activeDays, selectedDayNumber]);

  // Selected Day Date string
  const currentSessionDate = useMemo(() => {
    return dayDateMap[selectedDayNumber] || '10/09/2026';
  }, [dayDateMap, selectedDayNumber]);

  // Selected Panchayat & Village Objects
  const currentPanchayat = useMemo(() => {
    return panchayats.find((p) => p.id === selectedPanchayatId || p.name === selectedPanchayatId) || null;
  }, [panchayats, selectedPanchayatId]);

  const currentVillage = useMemo(() => {
    if (!currentPanchayat) return null;
    return currentPanchayat.villages?.find((v) => v.id === selectedVillageId || v.name === selectedVillageId) || null;
  }, [currentPanchayat, selectedVillageId]);

  // Students belonging to current village
  const villageStudents = useMemo(() => {
    if (!selectedVillageId || !currentPanchayat) return [];
    return students.filter((s) => {
      const matchPanch = s.panchayatId === currentPanchayat.id || s.panchayatName?.toLowerCase() === currentPanchayat.name.toLowerCase();
      const matchVill = s.villageId === selectedVillageId || s.villageName?.toLowerCase() === (currentVillage?.name || '').toLowerCase();
      return matchPanch && matchVill;
    });
  }, [students, currentPanchayat, selectedVillageId, currentVillage]);

  const villageVolunteers = useMemo(() => {
    if (!selectedVillageId || !currentPanchayat) return [];
    return volunteers.filter((volunteer) => {
      const matchPanchayat = volunteer.panchayatId === currentPanchayat.id || volunteer.panchayatName?.toLowerCase() === currentPanchayat.name.toLowerCase();
      const matchVillage = volunteer.villageId === selectedVillageId || volunteer.villageName?.toLowerCase() === (currentVillage?.name || '').toLowerCase();
      return matchPanchayat && matchVillage;
    });
  }, [volunteers, currentPanchayat, selectedVillageId, currentVillage]);

  // Filtered students inside Village Mark screen
  const displayedStudents = useMemo(() => {
    return villageStudents.filter((st) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || st.name.toLowerCase().includes(q) || (st.code || '').toLowerCase().includes(q);
      const matchStd = standardFilter === 'all' || String(st.standard || '').trim() === standardFilter;
      const matchGender = genderFilter === 'all' || (st.gender || '').toLowerCase() === genderFilter.toLowerCase();
      return matchQuery && matchStd && matchGender;
    });
  }, [villageStudents, searchQuery, standardFilter, genderFilter]);

  // Unique standards for dropdown filter
  const availableStandards = useMemo(() => {
    const set = new Set<string>();
    villageStudents.forEach((s) => {
      if (s.standard) set.add(String(s.standard).trim());
    });
    return Array.from(set).sort();
  }, [villageStudents]);

  // Calculate live statistics for the village
  const villageStats = useMemo(() => {
    let total = villageStudents.length;
    let present = 0;
    let absent = 0;
    let notMarked = 0;
    let completedTasks = 0;

    villageStudents.forEach((st) => {
      const rec = recordsMap[st.id];
      if (!rec || rec.status === 'Not Marked') {
        notMarked++;
      } else if (rec.status === 'Present') {
        present++;
      } else if (rec.status === 'Absent') {
        absent++;
      }

      if (rec?.taskStatus === 'Completed') {
        completedTasks++;
      }
    });

    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;
    const taskCompleted = total > 0 && completedTasks === present && present > 0;

    return { total, present, absent, notMarked, completedTasks, attendanceRate, taskCompleted };
  }, [villageStudents, recordsMap]);

  // Calculate Day-level statistics for Screen 1
  const getDayStats = (dayNum: number) => {
    const daySessions = attendanceSessions.filter((s) => Number(s.dayNumber || 1) === dayNum);
    let totalExpected = 0;
    let totalPresent = 0;
    let allTasksDone = daySessions.length > 0;

    if (daySessions.length === 0) {
      return { attendanceRate: 0, hasData: false, isTaskComplete: false };
    }

    daySessions.forEach((s) => {
      totalExpected += Number(s.totalCount || 0);
      totalPresent += Number(s.presentCount || 0);
      const tasksDone = Number(s.taskCompletedCount || s.tasksCompletedCount || 0);
      if (tasksDone < Number(s.presentCount || 0) || Number(s.presentCount || 0) === 0) {
        allTasksDone = false;
      }
    });

    const rate = totalExpected > 0 ? Math.round((totalPresent / totalExpected) * 100) : 0;
    return { attendanceRate: rate, hasData: true, isTaskComplete: allTasksDone && totalPresent > 0 };
  };

  // Calculate Panchayat-level statistics for Screen 2
  const getPanchayatStats = (panchayatId: string, dayNum: number) => {
    const panch = panchayats.find((p) => p.id === panchayatId);
    if (attendanceSubject === 'volunteers') {
      const pVolunteers = volunteers.filter((volunteer) => volunteer.panchayatId === panchayatId || volunteer.panchayatName?.toLowerCase() === panch?.name.toLowerCase());
      const pSessions = attendanceSessions.filter((session) => (session.panchayatId === panchayatId || session.panchayatName?.toLowerCase() === panch?.name.toLowerCase()) && Number(session.dayNumber || 1) === dayNum);
      const presentCount = pSessions.reduce((sum, session) => sum + (session.volunteerAttendance || []).filter((record) => record.status === 'Present').length, 0);
      return {
        totalVillages: panch?.villages?.length || 0,
        totalStudents: pVolunteers.length,
        attendanceRate: pVolunteers.length > 0 ? Math.round((presentCount / pVolunteers.length) * 100) : 0,
        isTaskComplete: false,
        hasSubmissions: pSessions.length > 0,
      };
    }
    const pStudents = students.filter(
      (s) => s.panchayatId === panchayatId || (panch && s.panchayatName?.toLowerCase() === panch.name.toLowerCase())
    );
    const pSessions = attendanceSessions.filter(
      (s) => (s.panchayatId === panchayatId || (panch && s.panchayatName?.toLowerCase() === panch.name.toLowerCase())) && Number(s.dayNumber || 1) === dayNum
    );

    let totalStudents = pStudents.length;
    let presentCount = 0;
    let tasksCompleted = 0;

    pSessions.forEach((s) => {
      presentCount += Number(s.presentCount || 0);
      tasksCompleted += Number(s.taskCompletedCount || s.tasksCompletedCount || 0);
    });

    const rate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;
    const isTaskComplete = presentCount > 0 && tasksCompleted >= presentCount;

    return {
      totalVillages: panch?.villages?.length || 0,
      totalStudents,
      attendanceRate: rate,
      isTaskComplete,
      hasSubmissions: pSessions.length > 0,
    };
  };

  // Calculate Village-level statistics for Screen 3
  const getVillageStats = (villageId: string, dayNum: number) => {
    if (attendanceSubject === 'volunteers') {
      const vVolunteers = volunteers.filter((volunteer) => volunteer.villageId === villageId || volunteer.villageName?.toLowerCase() === villageId.toLowerCase());
      const vSession = attendanceSessions.find((session) => (session.villageId === villageId || session.villageName?.toLowerCase() === villageId.toLowerCase()) && Number(session.dayNumber || 1) === dayNum);
      const present = vSession?.volunteerAttendance?.filter((record) => record.status === 'Present').length || 0;
      return {
        totalStudents: vVolunteers.length,
        attendanceRate: vVolunteers.length > 0 ? Math.round((present / vVolunteers.length) * 100) : 0,
        isTaskComplete: false,
        status: vSession?.status || 'Draft',
      };
    }
    const vStudents = students.filter((s) => s.villageId === villageId || s.villageName?.toLowerCase() === villageId.toLowerCase());
    const vSession = attendanceSessions.find(
      (s) => (s.villageId === villageId || s.villageName?.toLowerCase() === villageId.toLowerCase()) && Number(s.dayNumber || 1) === dayNum
    );

    const totalStudents = vStudents.length;
    if (!vSession) {
      return { totalStudents, attendanceRate: 0, isTaskComplete: false, status: 'Draft' };
    }

    const present = Number(vSession.presentCount || 0);
    const tasksDone = Number(vSession.taskCompletedCount || vSession.tasksCompletedCount || 0);
    const rate = totalStudents > 0 ? Math.round((present / totalStudents) * 100) : 0;
    const isTaskComplete = present > 0 && tasksDone >= present;

    return {
      totalStudents,
      attendanceRate: rate,
      isTaskComplete,
      status: vSession.status || 'Draft',
    };
  };

  // Fetch or initialize session records when entering Screen 4
  const loadVillageSession = async (villageId: string, dayNum: number) => {
    setIsLoadingSession(true);
    try {
      const res = await fetch(
        apiUrl(`/api/attendance/session?villageId=${encodeURIComponent(villageId)}&dayNumber=${dayNum}${selectedAcademicYearId ? `&academicYearId=${encodeURIComponent(selectedAcademicYearId)}` : ''}`),
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        }
      );
      const data = await res.json();
      if (data.success && data.session) {
        setActiveSession(data.session);
        const map: Record<string, { status: 'Present' | 'Absent' | 'Not Marked'; taskStatus: 'Completed' | 'Incomplete' | 'Not Marked' }> = {};
        if (Array.isArray(data.records) && data.records.length > 0) {
          data.records.forEach((r: any) => {
            map[r.studentId] = {
              status: r.status || (r.present ? 'Present' : 'Absent'),
              taskStatus: r.taskStatus || 'Not Marked',
            };
          });
        }
        if (Array.isArray(data.volunteerRecords)) {
          data.volunteerRecords.forEach((r: any) => {
            map[r.volunteerId] = {
              status: r.present ? 'Present' : 'Absent',
              taskStatus: 'Not Marked',
            };
          });
        }
        setRecordsMap(map);
      } else {
        // Find in parent list or create initial draft state
        const existing = attendanceSessions.find(
          (s) => (s.villageId === villageId || s.villageName?.toLowerCase() === villageId.toLowerCase()) && Number(s.dayNumber || 1) === dayNum
        );
        if (existing) {
          setActiveSession(existing);
          const map: Record<string, { status: 'Present' | 'Absent' | 'Not Marked'; taskStatus: 'Completed' | 'Incomplete' | 'Not Marked' }> = {};
          if (existing.records && existing.records.length > 0) {
            existing.records.forEach((r) => {
              map[r.studentId] = {
                status: (r.status as any) || 'Not Marked',
                taskStatus: (r.taskStatus as any) || 'Not Marked',
              };
            });
          }
          setRecordsMap(map);
        } else {
          setActiveSession(null);
          setRecordsMap({});
        }
      }
    } catch (err) {
      console.error('Failed to load session details:', err);
    } finally {
      setIsLoadingSession(false);
    }
  };

  // Navigation handlers
  const handleSelectDay = (dayNum: number) => {
    setSelectedDayNumber(dayNum);
    setNavLevel('panchayats');
  };

  const handleSelectPanchayat = (panchayatId: string) => {
    setSelectedPanchayatId(panchayatId);
    setNavLevel('villages');
  };

  const handleSelectVillage = (villageId: string) => {
    setSelectedVillageId(villageId);
    setNavLevel('mark');
    setSearchQuery('');
    setStandardFilter('all');
    setGenderFilter('all');
    setAttendanceSubject('students');
    loadVillageSession(villageId, selectedDayNumber);
  };

  // Determine locking state of active village
  const isLocked = useMemo(() => {
    if (!activeSession) return false;
    const s = activeSession.status;
    return s === 'Submitted - Pending Review' || s === 'Submitted' || s === 'Edit Requested' || s === 'Approved';
  }, [activeSession]);

  const isEditApproved = useMemo(() => {
    return activeSession?.status === 'Edit Approved';
  }, [activeSession]);

  // Round Indicator click toggles
  const handleToggleAttendance = (studentId: string) => {
    if (isLocked) return;
    setRecordsMap((prev) => {
      const current = prev[studentId] || { status: 'Not Marked', taskStatus: 'Not Marked' };
      let nextStatus: 'Present' | 'Absent' | 'Not Marked';
      let nextTask = current.taskStatus;

      if (current.status === 'Not Marked') {
        nextStatus = 'Present';
        if (nextTask === 'Not Marked') nextTask = 'Completed';
      } else if (current.status === 'Present') {
        nextStatus = 'Absent';
        nextTask = 'Incomplete';
      } else {
        nextStatus = 'Not Marked';
        nextTask = 'Not Marked';
      }

      return {
        ...prev,
        [studentId]: {
          status: nextStatus,
          taskStatus: nextTask,
        },
      };
    });
  };

  const handleToggleTask = (studentId: string) => {
    if (isLocked) return;
    setRecordsMap((prev) => {
      const current = prev[studentId] || { status: 'Not Marked', taskStatus: 'Not Marked' };
      let nextTask: 'Completed' | 'Incomplete' | 'Not Marked';

      if (current.taskStatus === 'Completed') {
        nextTask = 'Incomplete';
      } else if (current.taskStatus === 'Incomplete') {
        nextTask = 'Not Marked';
      } else {
        nextTask = 'Completed';
      }

      return {
        ...prev,
        [studentId]: {
          ...current,
          taskStatus: nextTask,
        },
      };
    });
  };

  // Save Village Attendance (Draft or Submitted)
  const handleSaveAttendanceRecord = async (targetStatus: 'Draft' | 'Submitted - Pending Review') => {
    if (!currentVillage || !currentPanchayat) return;
    setIsSubmittingAction(true);

    const sessionId = activeSession?.id || `att-${currentVillage.id}-day${selectedDayNumber}`;
    const recordsList: AttendanceRecord[] = villageStudents.map((st) => {
      const rec = recordsMap[st.id] || { status: 'Not Marked', taskStatus: 'Not Marked' };
      return {
        studentId: st.id,
        studentName: st.name,
        code: st.code || st.id,
        standard: st.standard || '',
        gender: st.gender || 'other',
        villageName: currentVillage.name,
        status: rec.status,
        taskStatus: rec.taskStatus,
        remarks: '',
      };
    });

    const sessionPayload: AttendanceSession = {
      id: sessionId,
      sessionId: `ses-day${selectedDayNumber}`,
      sessionName: currentDayObj.day_name,
      panchayatId: currentPanchayat.id,
      panchayatName: currentPanchayat.name,
      villageId: currentVillage.id,
      villageName: currentVillage.name,
      day: `Day ${selectedDayNumber}`,
      dayNumber: selectedDayNumber,
      date: currentSessionDate,
      totalCount: attendanceSubject === 'students' ? villageStats.total : villageVolunteers.length,
      presentCount: attendanceSubject === 'students'
        ? villageStats.present
        : villageVolunteers.filter((volunteer) => recordsMap[volunteer.id]?.status === 'Present').length,
      absentCount: attendanceSubject === 'students'
        ? villageStats.absent
        : villageVolunteers.filter((volunteer) => recordsMap[volunteer.id]?.status === 'Absent').length,
      notMarkedCount: attendanceSubject === 'students'
        ? villageStats.notMarked
        : villageVolunteers.filter((volunteer) => !recordsMap[volunteer.id] || recordsMap[volunteer.id].status === 'Not Marked').length,
      taskCompletedCount: villageStats.completedTasks,
      status: targetStatus,
      records: recordsList,
    };

    try {
      const res = await fetch(apiUrl('/api/attendance'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          ...sessionPayload,
          attendanceSubject,
          records: attendanceSubject === 'students' ? recordsList : [],
          volunteerAttendance: attendanceSubject === 'volunteers'
            ? villageVolunteers.map((volunteer) => ({
                volunteerId: volunteer.id,
                present: recordsMap[volunteer.id]?.status === 'Present',
              }))
            : [],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save attendance.');
      }

      const updatedSession = { ...sessionPayload, status: targetStatus };
      setActiveSession(updatedSession);
      onSaveAttendance(updatedSession);

      if (targetStatus === 'Submitted - Pending Review') {
        setShowSubmitConfirmModal(false);
        showToast('Attendance submitted successfully! It is now locked pending review.', 'success');
      } else {
        showToast('Village attendance draft saved successfully.', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving attendance.', 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Submit Request for Edit
  const handleSubmitEditRequest = async () => {
    if (!editRequestReason.trim()) {
      showToast('Please provide a reason for editing.', 'error');
      return;
    }
    if (!activeSession) return;
    setIsSubmittingAction(true);

    try {
      const res = await fetch(apiUrl('/api/attendance/request-edit'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          attendanceSessionId: activeSession.id,
          villageId: currentVillage?.id,
          dayNumber: selectedDayNumber,
          reason: editRequestReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit edit request.');
      }

      const updatedSession: AttendanceSession = {
        ...activeSession,
        status: 'Edit Requested',
        editReason: editRequestReason.trim(),
      };
      setActiveSession(updatedSession);
      onSaveAttendance(updatedSession);
      setShowEditRequestModal(false);
      setEditRequestReason('');
      showToast('Edit request submitted. Super Admin will review your request.', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to submit edit request.', 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // SVG Circular Percentage Ring Component
  const CircularPercentageRing: React.FC<{ percentage: number; size?: number }> = ({ percentage, size = 48 }) => {
    const strokeWidth = 4;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    const strokeColor =
      percentage >= 75 ? 'text-emerald-500' : percentage >= 40 ? 'text-amber-500' : percentage > 0 ? 'text-rose-500' : 'text-slate-300';

    return (
      <div className="flex flex-col items-center justify-center">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Attendance</div>
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
          <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${size} ${size}`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-slate-100"
              fill="transparent"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className={`${strokeColor} transition-all duration-500`}
              fill="transparent"
            />
          </svg>
          <span className="absolute text-xs font-bold text-slate-800">{percentage}%</span>
        </div>
      </div>
    );
  };

  // Round Indicator for Task (Screen 1, 2, 3 summary cards)
  const TaskSummaryIndicator: React.FC<{ isComplete: boolean; hasData?: boolean }> = ({ isComplete, hasData = true }) => {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Task</div>
        <div className="flex flex-col items-center">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center ${
              isComplete ? 'bg-emerald-500 text-white' : hasData ? 'bg-rose-500 text-white' : 'border-2 border-slate-300 bg-white'
            }`}
          >
            {isComplete ? <Check size={14} className="stroke-[3]" /> : hasData ? <span className="font-bold text-xs">!</span> : null}
          </div>
          <span className={`text-[10px] font-medium mt-1 ${isComplete ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isComplete ? 'Completed' : 'Incomplete'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50/50 p-4 sm:p-6 lg:p-8">
      {/* Toast alert message */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : toastMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle size={18} className="text-emerald-600" />
          ) : (
            <WarningCircle size={18} className="text-rose-600" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 1: ATTENDANCE – DAY LIST */}
      {/* ========================================================================= */}
      {navLevel === 'days' && (
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-200">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {attendanceSubject === 'students' ? 'Student Attendance' : 'Volunteer Attendance'}
            </h1>
            <div className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100 self-start sm:self-auto">
              Cluster: {clusterName}
            </div>
          </div>

          <div className="flex w-fit items-center rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setAttendanceSubject('students')}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${attendanceSubject === 'students' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Student Attendance
            </button>
            <button
              type="button"
              onClick={() => setAttendanceSubject('volunteers')}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${attendanceSubject === 'volunteers' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Volunteer Attendance
            </button>
          </div>

          {/* List of Days */}
          <div className="space-y-3">
            {activeDays.map((day, idx) => {
              const dayStats = getDayStats(day.day_number);
              const color = DAY_COLOR_SCHEMES[idx % DAY_COLOR_SCHEMES.length];
              const scheduledDate = dayDateMap[day.day_number] || '10/09/2026';

              return (
                <div
                  key={day.id || day.day_number}
                  onClick={() => handleSelectDay(day.day_number)}
                  className="group bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4 sm:gap-6">
                    {/* Day Badge */}
                    <div
                      className={`w-16 h-16 rounded-xl ${color.bg} ${color.border} border flex flex-col items-center justify-center font-bold shadow-xs`}
                    >
                      <span className={`text-[11px] uppercase tracking-wider ${color.text}`}>DAY</span>
                      <span className={`text-2xl leading-none font-extrabold ${color.text}`}>{day.day_number}</span>
                    </div>

                    {/* Day Title & Date */}
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {day.day_name}
                      </h3>
                      <div className="text-xs text-slate-500 font-medium mt-1">Session Date: {scheduledDate}</div>
                    </div>
                  </div>

                  {/* Attendance & Task Indicators */}
                  <div className="flex items-center gap-6 sm:gap-10">
                    <CircularPercentageRing percentage={dayStats.attendanceRate} size={50} />
                    {attendanceSubject === 'students' && <TaskSummaryIndicator isComplete={dayStats.isTaskComplete} hasData={dayStats.hasData} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 2: DAY X – PANCHAYAT LIST */}
      {/* ========================================================================= */}
      {navLevel === 'panchayats' && (
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Breadcrumbs & Navigation */}
          <div className="flex items-center justify-between text-sm">
            <button
              onClick={() => setNavLevel('days')}
              className="inline-flex items-center gap-2 font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Back to Day List</span>
            </button>
            <div className="text-slate-400 font-medium">
              Attendance <span className="mx-1.5 text-slate-300">&gt;</span>{' '}
              <span className="text-slate-800 font-semibold">Day {selectedDayNumber}</span>
            </div>
          </div>

          {/* Day Header Banner Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
            <div className="w-14 h-14 rounded-xl bg-blue-50 border border-blue-200 flex flex-col items-center justify-center font-bold">
              <span className="text-[10px] uppercase tracking-wider text-blue-600">DAY</span>
              <span className="text-xl font-extrabold text-blue-700 leading-none">{selectedDayNumber}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{currentDayObj.day_name}</h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Session Date: {currentSessionDate}</p>
            </div>
          </div>

          {/* Section: Panchayats */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-900">Panchayats</h3>

            <div className="space-y-3">
              {panchayats.map((p) => {
                const stats = getPanchayatStats(p.id, selectedDayNumber);

                return (
                  <div
                    key={p.id}
                    className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      {/* Panchayat Building Icon */}
                      <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                        <Building2 size={24} />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900">{p.name}</h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          {stats.totalVillages} Villages • {stats.totalStudents} {attendanceSubject === 'students' ? 'Students' : 'Volunteers'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 sm:gap-8">
                      <CircularPercentageRing percentage={stats.attendanceRate} size={46} />
                      {attendanceSubject === 'students' && <TaskSummaryIndicator isComplete={stats.isTaskComplete} hasData={stats.hasSubmissions} />}
                      <button
                        onClick={() => handleSelectPanchayat(p.id)}
                        className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-semibold text-xs transition-colors shadow-xs"
                      >
                        Open →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 3: PANCHAYAT – VILLAGE LIST */}
      {/* ========================================================================= */}
      {navLevel === 'villages' && currentPanchayat && (
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Breadcrumbs & Navigation */}
          <div className="flex items-center justify-between text-sm">
            <button
              onClick={() => setNavLevel('panchayats')}
              className="inline-flex items-center gap-2 font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Back to Panchayats</span>
            </button>
            <div className="text-slate-400 font-medium">
              Attendance <span className="mx-1.5 text-slate-300">&gt;</span> Day {selectedDayNumber}{' '}
              <span className="mx-1.5 text-slate-300">&gt;</span>{' '}
              <span className="text-slate-800 font-semibold">{currentPanchayat.name}</span>
            </div>
          </div>

          {/* Header Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
            <div className="w-14 h-14 rounded-xl bg-blue-50 border border-blue-200 flex flex-col items-center justify-center font-bold">
              <span className="text-[10px] uppercase tracking-wider text-blue-600">DAY</span>
              <span className="text-xl font-extrabold text-blue-700 leading-none">{selectedDayNumber}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{currentDayObj.day_name}</h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Panchayat: <span className="font-semibold text-slate-700">{currentPanchayat.name}</span> | Session Date:{' '}
                {currentSessionDate}
              </p>
            </div>
          </div>

          {/* Section: Villages */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-900">Villages</h3>

            <div className="space-y-3">
              {(currentPanchayat.villages || []).map((v) => {
                const stats = getVillageStats(v.id, selectedDayNumber);

                return (
                  <div
                    key={v.id}
                    className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      {/* Village Home Icon */}
                      <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                        <House size={24} />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900">{v.name}</h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">{stats.totalStudents} {attendanceSubject === 'students' ? 'Students' : 'Volunteers'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 sm:gap-8">
                      <CircularPercentageRing percentage={stats.attendanceRate} size={46} />
                      {attendanceSubject === 'students' && <TaskSummaryIndicator isComplete={stats.isTaskComplete} hasData={stats.attendanceRate > 0} />}
                      <button
                        onClick={() => handleSelectVillage(v.id)}
                        className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-semibold text-xs transition-colors shadow-xs"
                      >
                        Open →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 4, 6, 8: VILLAGE – STUDENT ATTENDANCE (MARK / LOCKED / EDIT) */}
      {/* ========================================================================= */}
      {navLevel === 'mark' && currentPanchayat && currentVillage && (
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Breadcrumbs & Navigation */}
          <div className="flex items-center justify-between text-sm">
            <button
              onClick={() => setNavLevel('villages')}
              className="inline-flex items-center gap-2 font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Back to Villages</span>
            </button>
            <div className="text-slate-400 font-medium text-xs sm:text-sm">
              Attendance <span className="mx-1 text-slate-300">&gt;</span> Day {selectedDayNumber}{' '}
              <span className="mx-1 text-slate-300">&gt;</span> {currentPanchayat.name}{' '}
              <span className="mx-1 text-slate-300">&gt;</span>{' '}
              <span className="text-slate-800 font-semibold">{currentVillage.name}</span>
            </div>
          </div>

          {/* Header Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
            <div className="w-14 h-14 rounded-xl bg-blue-50 border border-blue-200 flex flex-col items-center justify-center font-bold">
              <span className="text-[10px] uppercase tracking-wider text-blue-600">DAY</span>
              <span className="text-xl font-extrabold text-blue-700 leading-none">{selectedDayNumber}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{currentDayObj.day_name}</h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Panchayat: <span className="font-semibold text-slate-700">{currentPanchayat.name}</span> | Village:{' '}
                <span className="font-semibold text-slate-700">{currentVillage.name}</span> | Session Date:{' '}
                {currentSessionDate}
              </p>
            </div>
          </div>

          {/* WORKFLOW STATUS BANNERS */}
          {/* Screen 6: Locked Banner (Submitted - Pending Review) */}
          {(activeSession?.status === 'Submitted - Pending Review' || activeSession?.status === 'Submitted') && (
            <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 flex items-start gap-3.5 shadow-xs">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0 mt-0.5">
                <Lock size={18} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-amber-900">Attendance Submitted – Pending Review</h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  You cannot edit the attendance. Any changes require Super Admin approval.
                </p>
              </div>
            </div>
          )}

          {/* Edit Requested Banner */}
          {activeSession?.status === 'Edit Requested' && (
            <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 flex items-start gap-3.5 shadow-xs">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0 mt-0.5">
                <WarningCircle size={18} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-amber-900">Edit Requested – Pending Approval</h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  Your request to edit attendance has been submitted. Editing will unlock once Super Admin approves it.
                </p>
              </div>
            </div>
          )}

          {/* Screen 8: Edit Approved Banner */}
          {isEditApproved && (
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-4 flex items-start gap-3.5 shadow-xs">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0 mt-0.5">
                <CheckCircle size={18} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-emerald-900">Edit Approved</h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  You can now edit the attendance. Make the required changes and resubmit.
                </p>
              </div>
            </div>
          )}

          {/* Final Approved Banner */}
          {activeSession?.status === 'Approved' && (
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-4 flex items-start gap-3.5 shadow-xs">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0 mt-0.5">
                <CheckCircle size={18} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-emerald-900">Attendance Approved</h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  This attendance session has been finalized and approved by Super Admin.
                </p>
              </div>
            </div>
          )}

          {/* Rejected Banner */}
          {activeSession?.status === 'Rejected' && (
            <div className="bg-rose-50/90 border border-rose-200 rounded-xl p-4 flex items-start gap-3.5 shadow-xs">
              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 flex-shrink-0 mt-0.5">
                <WarningCircle size={18} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-rose-900">Attendance Submission Rejected</h4>
                <p className="text-xs text-rose-700 mt-0.5">
                  {activeSession.reviewRemarks || 'Submission was rejected by Super Admin. Please correct attendance and resubmit.'}
                </p>
              </div>
            </div>
          )}

          {/* Summary Metric Counters Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Students */}
            <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100/80 flex items-center justify-center text-blue-700 font-bold">
                <Users size={18} />
              </div>
              <div>
                <div className="text-base font-extrabold text-blue-950">{villageStats.total}</div>
                <div className="text-[11px] font-semibold text-blue-600">Total Students</div>
              </div>
            </div>

            {/* Present */}
            <div className="bg-emerald-50/80 border border-emerald-100 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100/80 flex items-center justify-center text-emerald-700 font-bold">
                <Check size={18} className="stroke-[3]" />
              </div>
              <div>
                <div className="text-base font-extrabold text-emerald-950">{villageStats.present}</div>
                <div className="text-[11px] font-semibold text-emerald-600">Present</div>
              </div>
            </div>

            {/* Absent */}
            <div className="bg-rose-50/80 border border-rose-100 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-100/80 flex items-center justify-center text-rose-700 font-bold">
                <X size={18} className="stroke-[3]" />
              </div>
              <div>
                <div className="text-base font-extrabold text-rose-950">{villageStats.absent}</div>
                <div className="text-[11px] font-semibold text-rose-600">Absent</div>
              </div>
            </div>

            {/* Not Marked */}
            <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-200/80 flex items-center justify-center text-slate-600 font-bold">
                <span className="text-base font-bold">○</span>
              </div>
              <div>
                <div className="text-base font-extrabold text-slate-800">{villageStats.notMarked}</div>
                <div className="text-[11px] font-semibold text-slate-500">Not Marked</div>
              </div>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shadow-xs">
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setAttendanceSubject('students')}
                className={`rounded-md px-3 py-2 text-xs font-semibold ${attendanceSubject === 'students' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'}`}
              >
                Students
              </button>
              <button
                type="button"
                onClick={() => setAttendanceSubject('volunteers')}
                className={`rounded-md px-3 py-2 text-xs font-semibold ${attendanceSubject === 'volunteers' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'}`}
              >
                Volunteers
              </button>
            </div>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder={attendanceSubject === 'students' ? 'Search by student name or ID...' : 'Search by volunteer name or ID...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {attendanceSubject === 'students' && <div className="flex items-center gap-2">
              <select
                value={standardFilter}
                onChange={(e) => setStandardFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Standards</option>
                {availableStandards.map((std) => (
                  <option key={std} value={std}>
                    Standard {std}
                  </option>
                ))}
              </select>

              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>}
          </div>

          {attendanceSubject === 'volunteers' ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Volunteer Name</th>
                    <th className="py-3 px-4">Volunteer ID</th>
                    <th className="py-3 px-4 text-center">Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {villageVolunteers.filter((volunteer) => {
                    const query = searchQuery.toLowerCase().trim();
                    return !query || volunteer.name.toLowerCase().includes(query) || volunteer.id.toLowerCase().includes(query);
                  }).map((volunteer, index) => {
                    const rec = recordsMap[volunteer.id] || { status: 'Not Marked', taskStatus: 'Not Marked' };
                    return (
                      <tr key={volunteer.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 text-center font-semibold text-slate-400">{index + 1}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{volunteer.name}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-500">{volunteer.id}</td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => handleToggleAttendance(volunteer.id)}
                            className={`w-6 h-6 rounded-full inline-flex items-center justify-center ${isLocked ? 'cursor-not-allowed opacity-90' : ''} ${rec.status === 'Present' ? 'bg-emerald-500 ring-2 ring-emerald-200' : rec.status === 'Absent' ? 'bg-rose-500 ring-2 ring-rose-200' : 'border-2 border-slate-300 bg-slate-50'}`}
                          >
                            {rec.status !== 'Not Marked' && <div className="w-2 h-2 rounded-full bg-white" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {villageVolunteers.length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-slate-400 font-medium">No volunteers found for this village.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          ) : (
          /* Student Roster Table */
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Student ID</th>
                    <th className="py-3 px-4 text-center">Std</th>
                    <th className="py-3 px-4 text-center">Attendance</th>
                    <th className="py-3 px-4 text-center">Task</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                        No students found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedStudents.map((st, index) => {
                      const rec = recordsMap[st.id] || { status: 'Not Marked', taskStatus: 'Not Marked' };

                      return (
                        <tr key={st.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 text-center font-semibold text-slate-400">{index + 1}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">{st.name}</td>
                          <td className="py-3.5 px-4 font-medium text-slate-500">{st.code || st.id}</td>
                          <td className="py-3.5 px-4 text-center font-semibold text-slate-700">{st.standard || '-'}</td>

                          {/* Attendance Round Indicator Column */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => handleToggleAttendance(st.id)}
                                title={isLocked ? 'Locked' : `Click to change: ${rec.status}`}
                                className={`w-6 h-6 rounded-full transition-transform active:scale-90 flex items-center justify-center ${
                                  isLocked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                                } ${
                                  rec.status === 'Present'
                                    ? 'bg-emerald-500 ring-2 ring-emerald-200'
                                    : rec.status === 'Absent'
                                    ? 'bg-rose-500 ring-2 ring-rose-200'
                                    : 'border-2 border-slate-300 bg-slate-50 hover:border-slate-400'
                                }`}
                              >
                                {rec.status === 'Present' ? (
                                  <div className="w-2 h-2 rounded-full bg-white" />
                                ) : rec.status === 'Absent' ? (
                                  <div className="w-2 h-2 rounded-full bg-white" />
                                ) : null}
                              </button>
                            </div>
                          </td>

                          {/* Task Round Indicator Column */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => handleToggleTask(st.id)}
                                title={isLocked ? 'Locked' : `Click to change task: ${rec.taskStatus}`}
                                className={`w-6 h-6 rounded-full transition-transform active:scale-90 flex items-center justify-center ${
                                  isLocked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                                } ${
                                  rec.taskStatus === 'Completed'
                                    ? 'bg-emerald-500 text-white ring-2 ring-emerald-200'
                                    : rec.taskStatus === 'Incomplete'
                                    ? 'bg-rose-500 text-white ring-2 ring-rose-200'
                                    : 'border-2 border-slate-300 bg-slate-50 hover:border-slate-400'
                                }`}
                              >
                                {rec.taskStatus === 'Completed' ? (
                                  <Check size={12} className="stroke-[3]" />
                                ) : rec.taskStatus === 'Incomplete' ? (
                                  <span className="font-bold text-xs">!</span>
                                ) : null}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* Action Buttons Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 order-2 sm:order-1">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                <span>= Present</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                <span>= Absent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border-2 border-slate-300 bg-white inline-block" />
                <span>= Not Marked</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full sm:w-auto order-1 sm:order-2 justify-end">
              {/* Unlocked view: Draft or Edit Approved or Rejected */}
              {!isLocked && (
                <>
                  <button
                    type="button"
                    disabled={isSubmittingAction}
                    onClick={() => handleSaveAttendanceRecord('Draft')}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-colors shadow-xs"
                  >
                    <Save size={16} />
                    <span>Save (Village)</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSubmittingAction || villageStudents.length === 0}
                    onClick={() => setShowSubmitConfirmModal(true)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm"
                  >
                    <Send size={16} />
                    <span>{isEditApproved ? 'Resubmit Attendance' : 'Submit Attendance (Village)'}</span>
                  </button>
                </>
              )}

              {/* Locked view: Submitted - Pending Review */}
              {(activeSession?.status === 'Submitted - Pending Review' || activeSession?.status === 'Submitted') && (
                <button
                  type="button"
                  onClick={() => setShowEditRequestModal(true)}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-blue-600 hover:bg-blue-50 text-blue-600 font-bold text-xs rounded-lg transition-colors shadow-xs"
                >
                  <Edit3 size={16} />
                  <span>Request for Edit</span>
                </button>
              )}

              {/* Locked view: Edit Requested */}
              {activeSession?.status === 'Edit Requested' && (
                <button
                  type="button"
                  disabled
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-lg cursor-not-allowed border border-slate-200"
                >
                  <Lock size={16} />
                  <span>Edit Requested (Pending Review)</span>
                </button>
              )}

              {/* Final status: Approved */}
              {activeSession?.status === 'Approved' && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200">
                  <CheckCircle size={16} />
                  <span>Approved by Super Admin</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 5: SUBMIT CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {showSubmitConfirmModal && currentVillage && currentPanchayat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4">
            {/* Modal Icon */}
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto ring-8 ring-blue-50/50">
              <Send size={26} />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Submit Attendance?</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                You are about to submit the attendance for{' '}
                <span className="font-bold text-slate-800">
                  {currentVillage.name} ({currentPanchayat.name})
                </span>{' '}
                – Day {selectedDayNumber}.
              </p>
            </div>

            {/* Warning Callout Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left text-xs text-amber-800 space-y-1">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <WarningCircle size={15} />
                <span>Notice</span>
              </div>
              <p>
                After submission, you cannot edit the attendance directly. If any correction is needed, you must raise a{' '}
                <span className="font-semibold">Request for Edit</span> and wait for Super Admin approval.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => setShowSubmitConfirmModal(false)}
                className="flex-1 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => handleSaveAttendanceRecord('Submitted - Pending Review')}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
              >
                {isSubmittingAction ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 7: REQUEST FOR EDIT (MODAL) */}
      {/* ========================================================================= */}
      {showEditRequestModal && currentVillage && currentPanchayat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Edit3 size={18} />
                </div>
                <h3 className="text-base font-bold text-slate-900">Request Attendance Edit</h3>
              </div>
              <button
                onClick={() => setShowEditRequestModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Target Metadata Card */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Day:</span>
                <span className="font-bold text-slate-800">
                  Day {selectedDayNumber} – {currentDayObj.day_name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Panchayat:</span>
                <span className="font-bold text-slate-800">{currentPanchayat.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Village:</span>
                <span className="font-bold text-slate-800">{currentVillage.name}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                <span className="text-slate-500 font-medium">Current Status:</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px]">
                  Submitted – Pending Review
                </span>
              </div>
            </div>

            {/* Mandatory Reason Form */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Reason for Edit <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                maxLength={500}
                value={editRequestReason}
                onChange={(e) => setEditRequestReason(e.target.value)}
                placeholder="Please provide the reason for editing the attendance..."
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              />
              <div className="text-right text-[11px] font-semibold text-slate-400">
                {editRequestReason.length}/500
              </div>
            </div>

            {/* Info callout note */}
            <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900">
              <div className="text-blue-600 mt-0.5 flex-shrink-0">
                <WarningCircle size={15} />
              </div>
              <p>
                After submitting the request, you cannot edit the attendance until Super Admin approves. You will be
                notified once the request is reviewed.
              </p>
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => setShowEditRequestModal(false)}
                className="flex-1 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingAction || !editRequestReason.trim()}
                onClick={handleSubmitEditRequest}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors shadow-sm inline-flex items-center justify-center gap-2"
              >
                <Send size={15} />
                <span>{isSubmittingAction ? 'Submitting...' : 'Submit Request'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
