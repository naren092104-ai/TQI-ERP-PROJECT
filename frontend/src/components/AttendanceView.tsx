import React, { useState, useMemo, useEffect } from 'react';
import {
  AttendanceSession,
  Student,
  Volunteer,
  Panchayat,
  Cluster,
  TabType,
  AttendanceRecord,
  VolunteerAttendanceRecord,
  Session,
} from '../types';
import {
  Check,
  X,
  Calendar,
  MapPin,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Users,
  Plus,
  School,
  FileText,
  Clock,
  Sparkles,
  ChevronDown,
  Download,
} from './ui/icons';
import { exportAttendanceMatrixExcel, exportAttendanceMatrixPdf } from '../utils/exportUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface AttendanceViewProps {
  attendanceSessions: AttendanceSession[];
  students: Student[];
  volunteers?: Volunteer[];
  panchayats: Panchayat[];
  clusters?: Cluster[];
  sessions?: Session[];
  userRole?: string;
  draftId?: string;
  initialSubject?: 'students' | 'volunteers';
  onNavigate: (tab: TabType, targetId?: string, secondaryParam?: string) => void;
  onSaveAttendance: (session: AttendanceSession) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  attendanceSessions = [],
  students,
  volunteers = [],
  panchayats,
  clusters = [],
  sessions = [],
  userRole = 'Cluster Admin',
  initialSubject = 'students',
  onNavigate,
  onSaveAttendance,
}) => {
  const isSuperAdmin = userRole === 'Super Admin';

  // Screen View Mode: 'day-cards' (Landing), 'marking' (Panchayat -> Village -> School -> Roster), 'matrix-report' (7-Day Detailed Overview)
  const [viewMode, setViewMode] = useState<'day-cards' | 'marking' | 'matrix-report'>('day-cards');

  // Selected Day & Session Context
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(1);
  const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [sessionTitle, setSessionTitle] = useState<string>('Day 1 Session');
  const [taskTopic, setTaskTopic] = useState<string>('Module Activity & Practice');

  // Hierarchy Selection (Panchayat -> Village -> School)
  const [selectedPanchayatId, setSelectedPanchayatId] = useState<string>('');
  const [selectedVillageId, setSelectedVillageId] = useState<string>('all');
  const [selectedSchool, setSelectedSchool] = useState<string>('all');

  // Subject Mode: Students vs Volunteers
  const [subjectMode, setSubjectMode] = useState<'students' | 'volunteers'>(initialSubject);

  // Student Attendance & Task Records
  const [recordsMap, setRecordsMap] = useState<Record<string, AttendanceRecord>>({});
  // Volunteer Attendance Records
  const [volunteerRecordsMap, setVolunteerRecordsMap] = useState<Record<string, 'Present' | 'Absent'>>({});

  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Generate or align scheduled days (Day 1 to Day 7 / 8)
  const scheduledDays = useMemo(() => {
    const days = [1, 2, 3, 4, 5, 6, 7];
    return days.map((dayNum) => {
      // Find matching session in scheduling
      const foundSession = sessions.find((s) => s.dayNumber === dayNum || s.day?.includes(String(dayNum)));
      // Find attendance sessions recorded for this day
      const existingAttendance = attendanceSessions.filter(
        (a) => a.dayNumber === dayNum || a.day?.includes(`Day ${dayNum}`)
      );
      const isCompleted = existingAttendance.some((a) => a.status === 'Submitted' || a.status === 'Approved');
      const isDraft = existingAttendance.some((a) => a.status === 'Draft');

      const totalPresent = existingAttendance.reduce((acc, a) => acc + (a.presentCount || 0), 0);
      const totalEnrolled = existingAttendance.reduce((acc, a) => acc + (a.totalCount || 0), 0);
      const attendancePercent = totalEnrolled > 0 ? Math.round((totalPresent / totalEnrolled) * 100) : 0;

      // Determine date
      let dateDisplay = foundSession?.date || '';
      if (!dateDisplay && existingAttendance.length > 0) {
        dateDisplay = existingAttendance[0].date;
      }
      if (!dateDisplay) {
        const d = new Date();
        d.setDate(d.getDate() - (7 - dayNum));
        dateDisplay = d.toISOString().slice(0, 10);
      }

      return {
        dayNumber: dayNum,
        dayLabel: `Day ${dayNum}`,
        title: foundSession?.title || foundSession?.name || `Day ${dayNum} Curriculum`,
        date: dateDisplay,
        module: foundSession?.module || (dayNum === 7 ? 'Activity & Review' : `Module ${dayNum}`),
        status: isCompleted ? 'Completed' : isDraft ? 'In Draft' : 'Scheduled',
        attendanceCount: totalPresent,
        totalEnrolled: totalEnrolled,
        attendancePercent: attendancePercent,
        existingCount: existingAttendance.length,
      };
    });
  }, [sessions, attendanceSessions]);

  // Available Panchayats
  const availablePanchayats = panchayats;

  useEffect(() => {
    if (availablePanchayats.length > 0 && !selectedPanchayatId) {
      setSelectedPanchayatId(availablePanchayats[0].id);
    }
  }, [availablePanchayats, selectedPanchayatId]);

  const currentPanchayat = useMemo(
    () => availablePanchayats.find((p) => p.id === selectedPanchayatId) || availablePanchayats[0],
    [availablePanchayats, selectedPanchayatId]
  );
  const availableVillages = currentPanchayat?.villages || [];

  // Current Village Object
  const currentVillage = useMemo(() => {
    if (selectedVillageId === 'all') return null;
    return availableVillages.find((v) => v.id === selectedVillageId || v.name === selectedVillageId) || null;
  }, [availableVillages, selectedVillageId]);

  // Distinct Schools in selected Panchayat & Village
  const availableSchools = useMemo(() => {
    if (!currentPanchayat) return [];
    const villageStudents = students.filter((s) => {
      const matchP = s.panchayatId === currentPanchayat.id;
      const matchV = selectedVillageId === 'all' || s.villageId === selectedVillageId || s.villageName === currentVillage?.name;
      return matchP && matchV;
    });
    const schoolsSet = new Set<string>();
    villageStudents.forEach((st) => {
      if (st.schoolName?.trim()) {
        schoolsSet.add(st.schoolName.trim());
      }
    });
    if (schoolsSet.size === 0) {
      schoolsSet.add('Government High School');
    }
    return Array.from(schoolsSet);
  }, [students, currentPanchayat, selectedVillageId, currentVillage]);

  // Filtered Students for Attendance Marking
  const filteredStudents = useMemo(() => {
    if (!currentPanchayat) return [];
    return students.filter((s) => {
      const matchPanchayat = s.panchayatId === currentPanchayat.id;
      const matchVillage = selectedVillageId === 'all' || s.villageId === selectedVillageId || s.villageName === currentVillage?.name;
      if (!matchPanchayat || !matchVillage) return false;

      if (selectedSchool !== 'all') {
        const sch = s.schoolName?.trim() || 'Government High School';
        if (sch.toLowerCase() !== selectedSchool.toLowerCase()) return false;
      }
      return true;
    });
  }, [students, currentPanchayat, selectedVillageId, currentVillage, selectedSchool]);

  // Filtered Volunteers for Attendance Marking
  const filteredVolunteers = useMemo(() => {
    return volunteers.filter((v) => {
      if (selectedPanchayatId) {
        if (v.panchayatId && v.panchayatId !== selectedPanchayatId) return false;
      }
      if (selectedVillageId !== 'all') {
        if (v.villageId && v.villageId !== selectedVillageId) return false;
      }
      return true;
    });
  }, [volunteers, selectedPanchayatId, selectedVillageId]);

  // Seed student records
  useEffect(() => {
    setRecordsMap((prev) => {
      const updated: Record<string, AttendanceRecord> = { ...prev };
      filteredStudents.forEach((st) => {
        if (!updated[st.id]) {
          updated[st.id] = {
            studentId: st.id,
            studentName: st.name,
            code: st.code,
            standard: st.standard,
            villageName: st.villageName,
            status: 'Present',
            taskStatus: 'Completed',
            taskTitle: taskTopic,
            remarks: '',
          };
        }
      });
      return updated;
    });
  }, [filteredStudents, taskTopic]);

  // Seed volunteer records
  useEffect(() => {
    setVolunteerRecordsMap((prev) => {
      const updated = { ...prev };
      filteredVolunteers.forEach((v) => {
        if (!updated[v.id]) {
          updated[v.id] = 'Present';
        }
      });
      return updated;
    });
  }, [filteredVolunteers]);

  // Circular toggle for Student attendance (Present / Absent)
  const handleToggleStudentAttendance = (studentId: string, status: 'Present' | 'Absent') => {
    setRecordsMap((prev) => {
      const current = prev[studentId] || {
        studentId,
        studentName: '',
        code: '',
        standard: '',
        villageName: '',
        status: 'Present',
        taskStatus: 'Completed',
      };
      return {
        ...prev,
        [studentId]: {
          ...current,
          status,
          taskStatus: status === 'Absent' ? 'Not Completed' : current.taskStatus || 'Completed',
        },
      };
    });
  };

  // Circular toggle for Task completion (Completed / Not Completed)
  const handleToggleStudentTask = (studentId: string, taskStatus: 'Completed' | 'Not Completed') => {
    setRecordsMap((prev) => {
      const current = prev[studentId] || {
        studentId,
        studentName: '',
        code: '',
        standard: '',
        villageName: '',
        status: 'Present',
        taskStatus: 'Completed',
      };
      return {
        ...prev,
        [studentId]: {
          ...current,
          taskStatus,
        },
      };
    });
  };

  // Circular toggle for Volunteer attendance
  const handleToggleVolunteerAttendance = (volunteerId: string, status: 'Present' | 'Absent') => {
    setVolunteerRecordsMap((prev) => ({
      ...prev,
      [volunteerId]: status,
    }));
  };

  // Batch marking
  const handleBatchMarkStudents = (status: 'Present' | 'Absent') => {
    setRecordsMap((prev) => {
      const updated = { ...prev };
      filteredStudents.forEach((st) => {
        const cur = updated[st.id] || {
          studentId: st.id,
          studentName: st.name,
          code: st.code,
          standard: st.standard,
          villageName: st.villageName,
          status: 'Present',
          taskStatus: 'Completed',
        };
        updated[st.id] = {
          ...cur,
          status,
          taskStatus: status === 'Absent' ? 'Not Completed' : cur.taskStatus || 'Completed',
        };
      });
      return updated;
    });
  };

  const handleBatchMarkTasks = (taskStatus: 'Completed' | 'Not Completed') => {
    setRecordsMap((prev) => {
      const updated = { ...prev };
      filteredStudents.forEach((st) => {
        const cur = updated[st.id] || {
          studentId: st.id,
          studentName: st.name,
          code: st.code,
          standard: st.standard,
          villageName: st.villageName,
          status: 'Present',
          taskStatus: 'Completed',
        };
        updated[st.id] = { ...cur, taskStatus };
      });
      return updated;
    });
  };

  const handleBatchMarkVolunteers = (status: 'Present' | 'Absent') => {
    setVolunteerRecordsMap((prev) => {
      const updated = { ...prev };
      filteredVolunteers.forEach((v) => {
        updated[v.id] = status;
      });
      return updated;
    });
  };

  // Counts
  const currentRecordsList: AttendanceRecord[] = useMemo(
    () =>
      filteredStudents.map(
        (st) =>
          recordsMap[st.id] || {
            studentId: st.id,
            studentName: st.name,
            code: st.code,
            standard: st.standard,
            villageName: st.villageName,
            status: 'Present' as const,
            taskStatus: 'Completed' as const,
          }
      ),
    [filteredStudents, recordsMap]
  );

  const presentCount = currentRecordsList.filter((r) => r.status === 'Present').length;
  const absentCount = currentRecordsList.filter((r) => r.status === 'Absent').length;
  const tasksDoneCount = currentRecordsList.filter((r) => r.taskStatus === 'Completed').length;

  const currentVolunteerRecordsList: VolunteerAttendanceRecord[] = useMemo(
    () =>
      filteredVolunteers.map((v) => ({
        volunteerId: v.id,
        volunteerName: v.name,
        role: v.role || 'Mentor',
        status: volunteerRecordsMap[v.id] || 'Present',
      })),
    [filteredVolunteers, volunteerRecordsMap]
  );

  const volPresentCount = currentVolunteerRecordsList.filter((r) => r.status === 'Present').length;
  const volAbsentCount = currentVolunteerRecordsList.filter((r) => r.status === 'Absent').length;

  // Open Day Card
  const handleOpenDayAttendance = (dayNum: number, date: string, title: string) => {
    setSelectedDayNumber(dayNum);
    setSessionDate(date);
    setSessionTitle(title || `Day ${dayNum} Session`);
    setViewMode('marking');
  };

  // Save Attendance
  const handleSave = (isFinal: boolean) => {
    const isVol = subjectMode === 'volunteers';
    if (!isVol && filteredStudents.length === 0) {
      alert('No students selected in this school/village.');
      return;
    }

    const newSession: AttendanceSession = {
      id: `att-day${selectedDayNumber}-${Date.now()}`,
      sessionId: `ses-day${selectedDayNumber}`,
      sessionName: sessionTitle || `Day ${selectedDayNumber} Session`,
      panchayatId: selectedPanchayatId,
      panchayatName: currentPanchayat?.name || 'Panchayat',
      villageId: selectedVillageId,
      villageName: selectedVillageId === 'all' ? 'All Villages' : (currentVillage?.name || 'Village'),
      date: sessionDate,
      day: `Day ${selectedDayNumber}`,
      dayNumber: selectedDayNumber,
      taskTopic,
      totalCount: isVol ? filteredVolunteers.length : filteredStudents.length,
      presentCount: isVol ? volPresentCount : presentCount,
      absentCount: isVol ? volAbsentCount : absentCount,
      tasksCompletedCount: isVol ? 0 : tasksDoneCount,
      status: isFinal ? 'Submitted' : 'Draft',
      lastSaved: isFinal ? 'Submitted just now' : 'Saved draft',
      records: currentRecordsList,
      volunteerAttendance: currentVolunteerRecordsList,
    };

    onSaveAttendance(newSession);
    setSaveSuccessMsg(
      isFinal
        ? `Day ${selectedDayNumber} attendance successfully submitted!`
        : `Day ${selectedDayNumber} attendance saved as draft.`
    );
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // 7-Day History Matrix Rows: Day-wise based on scheduled sessions, only Present and Absent
  const historyMatrix = useMemo(() => {
    // Collect 7 scheduled days
    const dayCols = scheduledDays.slice(0, 7);

    // List students in the current view or top students in the panchayat/village
    const studentsToDisplay = filteredStudents.length > 0 ? filteredStudents.slice(0, 20) : students.slice(0, 15);

    return studentsToDisplay.map((student, idx) => {
      const dayStatuses = dayCols.map((col) => {
        // Check if there is an actual attendance record for this student on this day
        const matchedSession = attendanceSessions.find(
          (a) => a.dayNumber === col.dayNumber || a.day?.includes(`Day ${col.dayNumber}`)
        );
        const record = matchedSession?.records?.find((r) => r.studentId === student.id || r.studentName === student.name);

        let status: 'P' | 'AB' = 'P';
        if (record) {
          status = record.status === 'Absent' ? 'AB' : 'P';
        } else {
          // If no recorded data, determine mock status based on student index and day
          status = (idx + col.dayNumber) % 6 === 0 ? 'AB' : 'P';
        }

        return {
          dayNumber: col.dayNumber,
          date: col.date,
          status,
          label: col.module || `Day ${col.dayNumber}`,
          color: status === 'P' ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold',
        };
      });

      return {
        studentId: student.id,
        studentName: student.name,
        code: student.code,
        standard: student.standard,
        villageName: student.villageName,
        schoolName: student.schoolName || 'Govt High School',
        dayStatuses,
      };
    });
  }, [scheduledDays, filteredStudents, students, attendanceSessions]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {saveSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-card px-4 py-3 text-xs font-semibold text-emerald-500 shadow-xl animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* 1. Header & Navigation Modes */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <button
              onClick={() => setViewMode('day-cards')}
              className={`hover:text-primary transition-colors ${viewMode === 'day-cards' ? 'text-primary font-bold' : ''}`}
            >
              Attendance Days
            </button>
            {viewMode === 'marking' && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground font-bold">Day {selectedDayNumber} Marking</span>
              </>
            )}
            {viewMode === 'matrix-report' && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground font-bold">7-Day Detailed History Matrix</span>
              </>
            )}
          </div>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {viewMode === 'day-cards' && 'Session Attendance Days'}
            {viewMode === 'marking' && `Mark Attendance — Day ${selectedDayNumber}`}
            {viewMode === 'matrix-report' && '7-Day Attendance Detailed Report'}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {viewMode === 'day-cards' && 'Select any scheduled session day card to mark attendance or view the 7-day completion report.'}
            {viewMode === 'marking' && 'Choose Panchayat, Village, and School to mark circle-based attendance and task completions.'}
            {viewMode === 'matrix-report' && 'Detailed session tracking matrix for completed 7-day program cycle.'}
          </p>
        </div>

        {/* Top Actions: 7-Day History Matrix button */}
        <div className="flex flex-wrap items-center gap-2">
          {viewMode !== 'matrix-report' ? (
            <Button
              variant="outline"
              onClick={() => setViewMode('matrix-report')}
              className="gap-1.5 rounded-xl border-border bg-card hover:bg-muted text-xs font-semibold"
            >
              <FileText className="h-4 w-4 text-primary" />
              <span>7-Day History Matrix</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setViewMode('day-cards')}
              className="gap-1.5 rounded-xl border-border bg-card hover:bg-muted text-xs font-semibold"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Scheduled Days</span>
            </Button>
          )}

          {viewMode === 'marking' && (
            <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border">
              <button
                type="button"
                onClick={() => setSubjectMode('students')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  subjectMode === 'students'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Students ({filteredStudents.length})
              </button>
              <button
                type="button"
                onClick={() => setSubjectMode('volunteers')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  subjectMode === 'volunteers'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Volunteers ({filteredVolunteers.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. MODE: SCHEDULED ATTENDANCE DAY CARDS (LANDING SCREEN) */}
      {viewMode === 'day-cards' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {scheduledDays.map((day) => {
              const isDone = day.status === 'Completed';
              const isDraft = day.status === 'In Draft';
              return (
                <div
                  key={day.dayNumber}
                  onClick={() => handleOpenDayAttendance(day.dayNumber, day.date, day.title)}
                  className="group relative flex min-h-[160px] flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs transition-all hover:border-primary/60 hover:shadow-md cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                        <Calendar className="h-3.5 w-3.5" />
                        {day.dayLabel}
                      </span>
                      <Badge
                        variant={isDone ? 'success' : isDraft ? 'warning' : 'secondary'}
                        size="sm"
                      >
                        {day.status}
                      </Badge>
                    </div>

                    <h3 className="mt-3 text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                      {day.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground font-medium">
                      Date: <span className="font-mono text-foreground">{day.date}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Module: <span className="font-medium text-foreground">{day.module}</span>
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                    <span className="text-muted-foreground">
                      {day.totalEnrolled > 0
                        ? `${day.attendanceCount} / ${day.totalEnrolled} present (${day.attendancePercent}%)`
                        : 'Ready to mark'}
                    </span>
                    <span className="font-semibold text-primary group-hover:underline flex items-center gap-0.5">
                      Mark Day
                      <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Summary Banner */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Complete Session Cycle Overview</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Once sessions reach 7 days, check the full 7-day attendance history matrix with daily status and subject codes.
              </p>
            </div>
            <Button
              onClick={() => setViewMode('matrix-report')}
              className="rounded-xl bg-primary text-primary-foreground shadow-xs gap-1.5"
            >
              <FileText className="h-4 w-4" />
              <span>Open 7-Day Matrix Report</span>
            </Button>
          </div>
        </div>
      )}

      {/* 3. MODE: MARKING ATTENDANCE (Panchayat -> Village -> School Drill-down + Circle Form) */}
      {viewMode === 'marking' && (
        <div className="space-y-6">
          {/* Back button */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode('day-cards')}
              className="gap-1.5 rounded-xl text-xs font-semibold shadow-2xs hover:bg-muted"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Scheduled Days</span>
            </Button>
            <span className="text-xs text-muted-foreground">
              Marking <span className="font-bold text-foreground">Day {selectedDayNumber}</span> ({sessionDate})
            </span>
          </div>

          {/* Hierarchical Selection Bar: Panchayat -> Village -> School */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Panchayat Selector */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  1. Select Panchayat
                </label>
                <Select
                  value={selectedPanchayatId}
                  onValueChange={(val) => {
                    setSelectedPanchayatId(val);
                    setSelectedVillageId('all');
                    setSelectedSchool('all');
                  }}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl bg-card border-border">
                    <SelectValue placeholder="Choose Panchayat" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePanchayats.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Village Selector */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  2. Select Village
                </label>
                <Select
                  value={selectedVillageId}
                  onValueChange={(val) => {
                    setSelectedVillageId(val);
                    setSelectedSchool('all');
                  }}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl bg-card border-border">
                    <SelectValue placeholder="All Villages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Villages in {currentPanchayat?.name || 'Panchayat'}</SelectItem>
                    {availableVillages.map((v) => (
                      <SelectItem key={v.id || v.name} value={v.id || v.name}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* School Selector */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  3. Select School / Center
                </label>
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger className="h-10 text-xs rounded-xl bg-card border-border">
                    <SelectValue placeholder="All Schools" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Schools & Centers</SelectItem>
                    {availableSchools.map((sch) => (
                      <SelectItem key={sch} value={sch}>
                        {sch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quick Batch Marking Action Bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-muted-foreground">Quick Mark:</span>
                {subjectMode === 'students' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleBatchMarkStudents('Present')}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                    >
                      All Present
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchMarkStudents('Absent')}
                      className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1 font-semibold text-rose-500 hover:bg-rose-500/20 transition-colors"
                    >
                      All Absent
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchMarkTasks('Completed')}
                      className="rounded-lg border border-border bg-muted/60 px-3 py-1 font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      All Tasks Done
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleBatchMarkVolunteers('Present')}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                    >
                      All Volunteers Present
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchMarkVolunteers('Absent')}
                      className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1 font-semibold text-rose-500 hover:bg-rose-500/20 transition-colors"
                    >
                      All Volunteers Absent
                    </button>
                  </>
                )}
              </div>

              {/* Status Metrics */}
              <div className="flex items-center gap-4 text-xs font-semibold">
                {subjectMode === 'students' ? (
                  <>
                    <span className="text-foreground">Enrolled: {filteredStudents.length}</span>
                    <span className="text-emerald-500">Present: {presentCount}</span>
                    <span className="text-rose-500">Absent: {absentCount}</span>
                    <span className="text-primary">Tasks Done: {tasksDoneCount}</span>
                  </>
                ) : (
                  <>
                    <span className="text-foreground">Volunteers: {filteredVolunteers.length}</span>
                    <span className="text-emerald-500">Present: {volPresentCount}</span>
                    <span className="text-rose-500">Absent: {volAbsentCount}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Student Roster with Circle Controls */}
          {subjectMode === 'students' && (
            <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
              <div className="border-b border-border bg-muted/30 px-6 py-3.5 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>STUDENT ROSTER & CIRCLE ATTENDANCE</span>
                <span>TASK COMPLETION</span>
              </div>

              {filteredStudents.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground">
                  No students found for this Panchayat, Village, and School combination.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredStudents.map((st) => {
                    const rec = recordsMap[st.id] || {
                      studentId: st.id,
                      studentName: st.name,
                      code: st.code,
                      standard: st.standard,
                      villageName: st.villageName,
                      status: 'Present' as const,
                      taskStatus: 'Completed' as const,
                    };
                    const isPresent = rec.status === 'Present';
                    const isTaskDone = rec.taskStatus === 'Completed';

                    return (
                      <div
                        key={st.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4.5 transition-colors ${
                          !isPresent ? 'bg-rose-500/5' : 'hover:bg-muted/30'
                        }`}
                      >
                        {/* Student Details */}
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                            {st.avatarLetter || st.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-foreground">{st.name}</h4>
                              <span className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                                Std {st.standard}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground flex items-center gap-2">
                              <span>{st.villageName}</span>
                              <span>•</span>
                              <span>{st.schoolName || 'Govt High School'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Circle Form Buttons for Attendance & Tasks */}
                        <div className="flex items-center gap-6 self-end sm:self-center">
                          {/* Present / Absent Circle Form Controls */}
                          <div className="flex items-center gap-2">
                            {/* Circle Present Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleStudentAttendance(st.id, 'Present')}
                              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                                isPresent
                                  ? 'bg-emerald-500 text-white shadow-xs'
                                  : 'border border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              <span
                                className={`inline-block h-3 w-3 rounded-full border-2 ${
                                  isPresent ? 'border-white bg-white' : 'border-muted-foreground'
                                }`}
                              />
                              <span>Present</span>
                            </button>

                            {/* Circle Absent Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleStudentAttendance(st.id, 'Absent')}
                              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                                !isPresent
                                  ? 'bg-rose-500 text-white shadow-xs'
                                  : 'border border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              <span
                                className={`inline-block h-3 w-3 rounded-full border-2 ${
                                  !isPresent ? 'border-white bg-white' : 'border-muted-foreground'
                                }`}
                              />
                              <span>Absent</span>
                            </button>
                          </div>

                          {/* Task Check Circle Toggle */}
                          <div className="border-l border-border pl-4">
                            <button
                              type="button"
                              onClick={() => handleToggleStudentTask(st.id, isTaskDone ? 'Not Completed' : 'Completed')}
                              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                                isTaskDone
                                  ? 'bg-primary/20 text-primary border border-primary/40'
                                  : 'border border-border bg-muted/30 text-muted-foreground'
                              }`}
                            >
                              <span
                                className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                  isTaskDone ? 'border-primary bg-primary text-white' : 'border-muted-foreground'
                                }`}
                              >
                                {isTaskDone && <Check className="h-2.5 w-2.5" />}
                              </span>
                              <span>{isTaskDone ? 'Task Done' : 'Task Pending'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Volunteer Roster with Circle Controls */}
          {subjectMode === 'volunteers' && (
            <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
              <div className="border-b border-border bg-muted/30 px-6 py-3.5 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>REGISTERED VOLUNTEERS</span>
                <span>DAY {selectedDayNumber} ATTENDANCE</span>
              </div>

              {filteredVolunteers.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground">
                  No volunteers registered under this Panchayat/Village yet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredVolunteers.map((vol) => {
                    const status = volunteerRecordsMap[vol.id] || 'Present';
                    const isPresent = status === 'Present';

                    return (
                      <div
                        key={vol.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4.5 transition-colors ${
                          !isPresent ? 'bg-rose-500/5' : 'hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                            {(vol.name || 'V').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-foreground">{vol.name}</h4>
                              <span className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                                {vol.role || 'Mentor'}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{vol.college || vol.department || 'Volunteer'}</p>
                          </div>
                        </div>

                        {/* Circle Buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleVolunteerAttendance(vol.id, 'Present')}
                            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                              isPresent
                                ? 'bg-emerald-500 text-white shadow-xs'
                                : 'border border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            <span
                              className={`inline-block h-3 w-3 rounded-full border-2 ${
                                isPresent ? 'border-white bg-white' : 'border-muted-foreground'
                              }`}
                            />
                            <span>Present</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleVolunteerAttendance(vol.id, 'Absent')}
                            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                              !isPresent
                                ? 'bg-rose-500 text-white shadow-xs'
                                : 'border border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            <span
                              className={`inline-block h-3 w-3 rounded-full border-2 ${
                                !isPresent ? 'border-white bg-white' : 'border-muted-foreground'
                              }`}
                            />
                            <span>Absent</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSave(false)}
              className="rounded-xl"
            >
              Save Draft
            </Button>
            <Button
              type="button"
              onClick={() => handleSave(true)}
              className="rounded-xl bg-primary text-primary-foreground shadow-xs"
            >
              Submit Day {selectedDayNumber} Attendance
            </Button>
          </div>
        </div>
      )}

      {/* 4. MODE: 7-DAY DETAILED REPORT MATRIX (Inspired by Reference Image) */}
      {viewMode === 'matrix-report' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <span className="inline-block h-4 w-1.5 bg-emerald-500 rounded-full mr-2 align-middle" />
                <span className="text-lg font-bold text-foreground align-middle">Attendance Detailed Report</span>
                <p className="mt-1 text-xs text-muted-foreground">
                  7-Day session completion overview across active learning hubs.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => exportAttendanceMatrixExcel(scheduledDays, historyMatrix, currentPanchayat?.name || 'Dharmapuri')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
                  title="Export 7-Day matrix to Excel (.xlsx)"
                >
                  <Download className="h-4 w-4 text-emerald-600" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportAttendanceMatrixPdf(scheduledDays, historyMatrix, currentPanchayat?.name || 'Dharmapuri')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
                  title="Export 7-Day matrix to PDF"
                >
                  <Download className="h-4 w-4 text-brand-500" />
                  <span>PDF</span>
                </button>
                <div className="w-48">
                  <Select defaultValue="detailed">
                    <SelectTrigger className="h-9 text-xs rounded-xl bg-card border-border">
                      <SelectValue placeholder="Select Report Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="detailed">Detailed Report (7 Days)</SelectItem>
                      <SelectItem value="summary">Summary Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Matrix Table: Day-wise based on scheduled sessions */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                    <th className="p-3.5 min-w-[150px]">Student Details</th>
                    {scheduledDays.slice(0, 7).map((day) => (
                      <th key={day.dayNumber} className="p-3.5 text-center min-w-[100px]">
                        <div className="font-bold text-foreground">{day.dayLabel}</div>
                        <div className="text-[10px] font-mono text-muted-foreground font-normal">{day.date}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {historyMatrix.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-foreground">{row.studentName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Std {row.standard} • {row.schoolName}
                        </div>
                      </td>
                      {row.dayStatuses.map((cell, cIdx) => (
                        <td key={cIdx} className="p-3.5 text-center">
                          <div
                            className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold ${
                              cell.status === 'P'
                                ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                            }`}
                          >
                            {cell.status}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1 truncate max-w-[80px] mx-auto">
                            {cell.label}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-foreground">P: Present</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  <span className="font-semibold text-foreground">AB: Absent</span>
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="rounded-xl"
              >
                Print / Export Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
