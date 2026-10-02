import React, { useState, useMemo, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
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
  Download,
} from './ui/icons';
import { exportAttendanceRosterExcel, exportVolunteerAttendanceRosterExcel, triggerFileDownload } from '../utils/exportUtils';
import { AttendanceDownloadContext, AttendanceDownloadRow, AttendanceRosterPdf } from '../utils/pdf/AttendanceRosterPdf';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { SuperAdminAttendanceReviewView } from './SuperAdminAttendanceReviewView';

interface AttendanceViewProps {
  attendanceSessions: AttendanceSession[];
  students: Student[];
  volunteers?: Volunteer[];
  panchayats: Panchayat[];
  clusters?: Cluster[];
  sessions?: Session[];
  academicYear?: string;
  userRole?: string;
  draftId?: string;
  initialSubject?: 'students' | 'volunteers';
  onNavigate: (tab: TabType, targetId?: string, secondaryParam?: string) => void;
  onSaveAttendance: (session: AttendanceSession) => Promise<void> | void;
  onReviewAttendance?: (attendanceId: string, action: 'approve' | 'request-resubmission' | 'approve-edit' | 'deny-edit', remarks: string) => Promise<void>;
  onRequestAttendanceEdit?: (attendanceId: string, reason: string) => Promise<void>;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  attendanceSessions = [],
  students,
  volunteers = [],
  panchayats,
  clusters = [],
  sessions = [],
  academicYear = '',
  userRole = 'Cluster Admin',
  initialSubject = 'students',
  onNavigate,
  onSaveAttendance,
  onReviewAttendance,
  onRequestAttendanceEdit,
}) => {
  const isSuperAdmin = userRole === 'Super Admin';

  // Attendance flow: scheduled days, then location/standard cards and roster.
  const [viewMode, setViewMode] = useState<'day-cards' | 'marking'>('day-cards');

  // Selected Day & Session Context
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(1);
  const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [sessionTitle, setSessionTitle] = useState<string>('Day 1 Session');
  const [taskTopic, setTaskTopic] = useState<string>('Module Activity & Practice');

  // Hierarchy Selection (Panchayat -> Village -> Standard)
  const [selectedPanchayatId, setSelectedPanchayatId] = useState<string>('');
  const [selectedVillageId, setSelectedVillageId] = useState<string>('all');
  const [selectedStandard, setSelectedStandard] = useState<string>('');
  const [markingStep, setMarkingStep] = useState<'panchayats' | 'villages' | 'standards' | 'roster'>('panchayats');

  // Subject Mode: Students vs Volunteers
  const [subjectMode, setSubjectMode] = useState<'students' | 'volunteers'>(initialSubject);

  // Student Attendance & Task Records
  const [recordsMap, setRecordsMap] = useState<Record<string, AttendanceRecord>>({});
  // Volunteer Attendance Records
  const [volunteerRecordsMap, setVolunteerRecordsMap] = useState<Record<string, 'Present' | 'Absent'>>({});

  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [showEditRequest, setShowEditRequest] = useState(false);
  const [editRequestReason, setEditRequestReason] = useState('');
  const [isRequestingEdit, setIsRequestingEdit] = useState(false);
  const [isDownloadingRosterPdf, setIsDownloadingRosterPdf] = useState(false);

  useEffect(() => {
    setSubjectMode(initialSubject);
  }, [initialSubject]);

  // Use the days configured for this academic year rather than a fixed list.
  const scheduledDays = useMemo(() => {
    const configuredDayNumbers = sessions
      .map((session) => Number(session.dayNumber))
      .filter((dayNumber) => Number.isInteger(dayNumber) && dayNumber > 0);
    const recordedDayNumbers = attendanceSessions
      .map((attendance) => Number(attendance.dayNumber))
      .filter((dayNumber) => Number.isInteger(dayNumber) && dayNumber > 0);
    const days = [...new Set([...configuredDayNumbers, ...recordedDayNumbers])].sort((a, b) => a - b);
    return days.map((dayNum) => {
      // Find matching session in scheduling
      const foundSession = sessions.find((s) => Number(s.dayNumber) === dayNum || s.day === `Day ${dayNum}`);
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

  const currentPanchayat = useMemo(
    () => availablePanchayats.find((p) => p.id === selectedPanchayatId),
    [availablePanchayats, selectedPanchayatId]
  );
  const availableVillages = currentPanchayat?.villages || [];

  // Current Village Object
  const currentVillage = useMemo(() => {
    if (selectedVillageId === 'all') return null;
    return availableVillages.find((v) => v.id === selectedVillageId || v.name === selectedVillageId) || null;
  }, [availableVillages, selectedVillageId]);

  const standardKey = (value?: string) => String(value || '').match(/\d+/)?.[0] || String(value || '').trim();
  const availableStandards = useMemo(() => {
    if (!currentPanchayat) return [];
    return [...new Set(students
      .filter((student) => student.panchayatId === currentPanchayat.id && (selectedVillageId === 'all' || student.villageId === currentVillage?.id || student.villageName === currentVillage?.name))
      .map((student) => standardKey(student.standard))
      .filter(Boolean))]
      .sort((first, second) => Number(first) - Number(second) || first.localeCompare(second));
  }, [students, currentPanchayat, currentVillage, selectedVillageId]);

  // Filtered Students for Attendance Marking
  const filteredStudents = useMemo(() => {
    if (!currentPanchayat) return [];
    return students.filter((s) => {
      const matchPanchayat = s.panchayatId === currentPanchayat.id;
      const matchVillage = selectedVillageId === 'all' || s.villageId === selectedVillageId || s.villageName === currentVillage?.name;
      if (!matchPanchayat || !matchVillage) return false;

      if (selectedStandard && standardKey(s.standard) !== selectedStandard) return false;
      return true;
    });
  }, [students, currentPanchayat, selectedVillageId, currentVillage, selectedStandard]);

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

  const currentSavedAttendance = useMemo(() => attendanceSessions.find((attendance) =>
    attendance.clusterId === (currentPanchayat?.clusterId || filteredVolunteers[0]?.clusterId) &&
    attendance.panchayatId === selectedPanchayatId &&
    (attendance.villageId || 'all') === selectedVillageId &&
    Number(attendance.dayNumber) === selectedDayNumber &&
    (attendance.attendanceType || 'students') === subjectMode
  ), [attendanceSessions, currentPanchayat, filteredVolunteers, selectedPanchayatId, selectedVillageId, selectedDayNumber, subjectMode]);
  const canEditAttendance = !currentSavedAttendance || ['Draft', 'Resubmission', 'Edit Approved'].includes(currentSavedAttendance.status);
  const editApprovalPending = currentSavedAttendance?.status === 'Edit Requested';
  const canRequestEdit = Boolean(currentSavedAttendance && ['Submitted', 'Approved'].includes(currentSavedAttendance.status));

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

  useEffect(() => {
    if (!currentSavedAttendance) return;
    setRecordsMap((previous) => ({
      ...previous,
      ...(currentSavedAttendance.records || []).reduce<Record<string, AttendanceRecord>>((records, record) => {
        records[record.studentId] = record;
        return records;
      }, {}),
    }));
    setVolunteerRecordsMap((previous) => ({
      ...previous,
      ...(currentSavedAttendance.volunteerAttendance || []).reduce<Record<string, 'Present' | 'Absent'>>((records, record) => {
        records[record.volunteerId] = record.status;
        return records;
      }, {}),
    }));
  }, [currentSavedAttendance]);

  // Circular toggle for Student attendance (Present / Absent)
  const handleToggleStudentAttendance = (studentId: string, status: 'Present' | 'Absent') => {
    if (!canEditAttendance) return;
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
    if (!canEditAttendance) return;
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
    if (!canEditAttendance) return;
    setVolunteerRecordsMap((prev) => ({
      ...prev,
      [volunteerId]: status,
    }));
  };

  // Batch marking
  const handleBatchMarkStudents = (status: 'Present' | 'Absent') => {
    if (!canEditAttendance) return;
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
    if (!canEditAttendance) return;
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
    if (!canEditAttendance) return;
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
  const canShowRoster = markingStep === 'roster' && (subjectMode === 'volunteers' || (Boolean(currentPanchayat) && Boolean(selectedStandard)));

  const attendanceExportContext: AttendanceDownloadContext = {
    kind: subjectMode,
    academicYear: academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    cluster: clusters.find((cluster) => cluster.id === (currentPanchayat?.clusterId || filteredVolunteers[0]?.clusterId || sessions.find((session) => Number(session.dayNumber) === selectedDayNumber)?.clusterId))?.name || 'Cluster',
    panchayat: subjectMode === 'students' ? currentPanchayat?.name || '—' : currentPanchayat?.name || 'All Panchayats',
    village: selectedVillageId === 'all' ? 'All Villages' : currentVillage?.name || 'Village',
    day: `Day ${selectedDayNumber}`,
    date: sessionDate,
    standard: selectedStandard ? `Standard ${selectedStandard}` : 'All Standards',
  };

  const getAttendanceExportRows = (): AttendanceDownloadRow[] => subjectMode === 'students'
    ? currentRecordsList.map((record) => ({
        name: record.studentName,
        standard: `Standard ${standardKey(record.standard)}`,
        village: record.villageName || currentVillage?.name || attendanceExportContext.village,
        attendance: record.status,
        taskStatus: record.taskStatus,
        day: attendanceExportContext.day,
        date: attendanceExportContext.date,
      }))
    : currentVolunteerRecordsList.map((record) => ({
        name: record.volunteerName,
        role: record.role || 'Volunteer',
        village: attendanceExportContext.village,
        attendance: record.status,
        day: attendanceExportContext.day,
        date: attendanceExportContext.date,
      }));

  const handleExportAttendanceExcel = () => {
    if (subjectMode === 'students') {
      exportAttendanceRosterExcel(getAttendanceExportRows().map((row) => ({
        name: row.name,
        standard: row.standard || '',
        village: row.village,
        attendance: row.attendance,
        taskStatus: row.taskStatus,
      })), {
        cluster: attendanceExportContext.cluster,
        panchayat: attendanceExportContext.panchayat,
        village: attendanceExportContext.village,
        day: attendanceExportContext.day,
        date: attendanceExportContext.date,
        standard: attendanceExportContext.standard || '',
      });
      return;
    }
    exportVolunteerAttendanceRosterExcel(getAttendanceExportRows().map((row) => ({
      name: row.name,
      role: row.role || 'Volunteer',
      attendance: row.attendance,
    })), {
      cluster: attendanceExportContext.cluster,
      panchayat: attendanceExportContext.panchayat,
      village: attendanceExportContext.village,
      day: attendanceExportContext.day,
      date: attendanceExportContext.date,
      academicYear: attendanceExportContext.academicYear,
    });
  };

  const handleDownloadAttendancePdf = async () => {
    const rows = getAttendanceExportRows();
    if (!rows.length) return;
    setIsDownloadingRosterPdf(true);
    try {
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
        // Keep the branded organization name if the logo cannot be embedded.
      }
      const context = { ...attendanceExportContext, logoDataUrl };
      const pdfDocument = React.createElement(AttendanceRosterPdf, { rows, context }) as unknown as Parameters<typeof pdf>[0];
      const blob = await pdf(pdfDocument).toBlob();
      const safeLocation = `${context.village}_${context.standard || 'Volunteers'}_${context.day}`.replace(/[^a-zA-Z0-9_-]+/g, '_');
      triggerFileDownload(blob, `TQI_${subjectMode === 'students' ? 'Student' : 'Volunteer'}_Attendance_${safeLocation}.pdf`);
    } catch (error) {
      console.error('Unable to generate attendance PDF:', error);
      alert('Unable to generate the attendance PDF. Please try again.');
    } finally {
      setIsDownloadingRosterPdf(false);
    }
  };

  // Open Day Card
  const handleOpenDayAttendance = (dayNum: number, date: string, title: string) => {
    setSelectedDayNumber(dayNum);
    setSessionDate(date);
    setSessionTitle(title || `Day ${dayNum} Session`);
    setSelectedPanchayatId('');
    setSelectedVillageId('all');
    setSelectedStandard('');
    setMarkingStep(subjectMode === 'volunteers' ? 'roster' : 'panchayats');
    setViewMode('marking');
  };

  const handleSelectPanchayat = (panchayatId: string) => {
    setSelectedPanchayatId(panchayatId);
    setSelectedVillageId('all');
    setSelectedStandard('');
    setMarkingStep('villages');
  };

  const handleSelectVillage = (villageId: string) => {
    setSelectedVillageId(villageId);
    setSelectedStandard('');
    setMarkingStep(subjectMode === 'students' ? 'standards' : 'roster');
  };

  const handleSelectStandard = (standard: string) => {
    setSelectedStandard(standard);
    setMarkingStep('roster');
  };

  // Save Attendance
  const handleRequestEdit = async () => {
    if (!currentSavedAttendance || !editRequestReason.trim() || !onRequestAttendanceEdit) return;
    setIsRequestingEdit(true);
    try {
      await onRequestAttendanceEdit(currentSavedAttendance.id, editRequestReason.trim());
      setShowEditRequest(false);
      setEditRequestReason('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to request attendance edit approval.');
    } finally {
      setIsRequestingEdit(false);
    }
  };

  const handleSave = async (isFinal: boolean) => {
    const isVol = subjectMode === 'volunteers';
    if (!canEditAttendance) {
      alert('This attendance submission is locked. Request and receive edit approval before changing it.');
      return;
    }
    if (!isVol && !selectedStandard) {
      alert('Select a student standard before saving attendance.');
      return;
    }
    if (!isVol && filteredStudents.length === 0) {
      alert('No students selected in this school/village.');
      return;
    }
    if (isVol && filteredVolunteers.length === 0) {
      alert('No volunteers are registered in this cluster.');
      return;
    }

    const selectedClusterId = currentPanchayat?.clusterId || filteredVolunteers[0]?.clusterId;
    const scheduledSession = sessions.find((session) =>
      session.clusterId === selectedClusterId && Number(session.dayNumber) === selectedDayNumber
    );
    if (!scheduledSession) {
      alert('This day is not configured in Academic Setup for the selected cluster.');
      return;
    }
    const preservedRecords = isVol ? [] : (currentSavedAttendance?.records || []).filter((record) =>
      !currentRecordsList.some((currentRecord) => currentRecord.studentId === record.studentId)
    );
    const submittedStudentRecords = isVol ? [] : [...preservedRecords, ...currentRecordsList];
    const submittedStudentPresent = submittedStudentRecords.filter((record) => record.status === 'Present').length;
    const newSession: AttendanceSession = {
      id: currentSavedAttendance?.id || `att-day${selectedDayNumber}-${subjectMode}-${Date.now()}`,
      sessionId: scheduledSession.id,
      attendanceType: subjectMode,
      clusterId: selectedClusterId,
      clusterName: clusters.find((cluster) => cluster.id === selectedClusterId)?.name,
      sessionName: sessionTitle || `Day ${selectedDayNumber} Session`,
      panchayatId: isVol ? '' : selectedPanchayatId,
      panchayatName: isVol ? 'All Panchayats' : (currentPanchayat?.name || 'Panchayat'),
      villageId: isVol ? '' : selectedVillageId,
      villageName: isVol ? 'All Villages' : (currentVillage?.name || 'Village'),
      date: sessionDate,
      day: `Day ${selectedDayNumber}`,
      dayNumber: selectedDayNumber,
      taskTopic,
      totalCount: isVol ? filteredVolunteers.length : submittedStudentRecords.length,
      presentCount: isVol ? volPresentCount : submittedStudentPresent,
      absentCount: isVol ? volAbsentCount : submittedStudentRecords.length - submittedStudentPresent,
      tasksCompletedCount: isVol ? 0 : submittedStudentRecords.filter((record) => record.taskStatus === 'Completed').length,
      status: isFinal ? 'Submitted' : 'Draft',
      lastSaved: isFinal ? 'Submitted just now' : 'Saved draft',
      records: submittedStudentRecords,
      volunteerAttendance: isVol ? currentVolunteerRecordsList : [],
    };

    setIsSavingAttendance(true);
    try {
      await onSaveAttendance(newSession);
      setSaveSuccessMsg(isFinal
        ? `Day ${selectedDayNumber} attendance successfully submitted!`
        : `Day ${selectedDayNumber} attendance saved as draft.`);
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to save attendance.');
    } finally {
      setIsSavingAttendance(false);
    }
  };

  if (isSuperAdmin) {
    return (
      <SuperAdminAttendanceReviewView
        attendanceSessions={attendanceSessions}
        clusters={clusters}
        panchayats={panchayats}
        sessions={sessions}
        subject={initialSubject}
        academicYear={academicYear}
        onReviewAttendance={onReviewAttendance || (async () => undefined)}
      />
    );
  }

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
          </div>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {viewMode === 'day-cards' && 'Session Attendance Days'}
            {viewMode === 'marking' && `Mark Attendance — Day ${selectedDayNumber}`}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {viewMode === 'day-cards' && 'Select a scheduled day to mark student attendance.'}
            {viewMode === 'marking' && (subjectMode === 'volunteers' ? 'Mark volunteer attendance for this cluster and day.' : 'Choose a panchayat, village, and standard before marking student attendance.')}
          </p>
        </div>

      </div>

      {/* 2. MODE: SCHEDULED ATTENDANCE DAY CARDS (LANDING SCREEN) */}
      {viewMode === 'day-cards' && (
        <div className="space-y-6">
          {scheduledDays.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
          </div> : <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><Calendar className="mx-auto h-8 w-8 text-primary" /><h2 className="mt-3 font-bold text-foreground">No attendance days configured</h2><p className="mt-1 text-sm text-muted-foreground">Configure the session days for this academic year in Academic Setup first.</p></div>}

        </div>
      )}

      {/* Student attendance drilldown: Panchayat -> Village -> Standard -> Roster */}
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

          <div className="space-y-4">
            {subjectMode === 'students' && <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <button type="button" onClick={() => { setSelectedPanchayatId(''); setSelectedVillageId('all'); setSelectedStandard(''); setMarkingStep('panchayats'); }} className={`rounded-full px-3 py-1.5 ${markingStep === 'panchayats' ? 'bg-primary/10 font-semibold text-primary' : 'hover:text-primary'}`}>Panchayats</button>
              {currentPanchayat && <><ChevronRight className="h-3 w-3" /><button type="button" onClick={() => { setSelectedVillageId('all'); setSelectedStandard(''); setMarkingStep('villages'); }} className={`rounded-full px-3 py-1.5 ${markingStep === 'villages' ? 'bg-primary/10 font-semibold text-primary' : 'hover:text-primary'}`}>{currentPanchayat.name}</button></>}
              {currentPanchayat && selectedVillageId === 'all' && markingStep === 'standards' && <><ChevronRight className="h-3 w-3" /><span className="rounded-full bg-primary/10 px-3 py-1.5 font-semibold text-primary">All Villages</span></>}
              {currentVillage && <><ChevronRight className="h-3 w-3" /><button type="button" onClick={() => { setSelectedStandard(''); setMarkingStep(subjectMode === 'students' ? 'standards' : 'roster'); }} className={`rounded-full px-3 py-1.5 ${markingStep === 'standards' ? 'bg-primary/10 font-semibold text-primary' : 'hover:text-primary'}`}>{currentVillage.name}</button></>}
              {markingStep === 'roster' && subjectMode === 'students' && <><ChevronRight className="h-3 w-3" /><span className="rounded-full bg-primary/10 px-3 py-1.5 font-semibold text-primary">Standard {selectedStandard}</span></>}
              {markingStep !== 'panchayats' && <Button variant="outline" size="sm" onClick={() => {
                if (markingStep === 'roster') setMarkingStep(subjectMode === 'students' ? 'standards' : 'villages');
                else if (markingStep === 'standards') { setSelectedVillageId('all'); setMarkingStep('villages'); }
                else { setSelectedPanchayatId(''); setSelectedVillageId('all'); setMarkingStep('panchayats'); }
              }} className="ml-auto h-8 gap-1 rounded-lg text-xs"><ArrowLeft className="h-3.5 w-3.5" />Back</Button>}
            </div>}

            {subjectMode === 'students' && markingStep === 'panchayats' && <section className="space-y-3"><h2 className="text-lg font-bold text-foreground">Select a Panchayat</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{availablePanchayats.map((panchayat) => {
              const studentCount = students.filter((student) => student.panchayatId === panchayat.id).length;
              return <button key={panchayat.id} type="button" onClick={() => handleSelectPanchayat(panchayat.id)} className="rounded-2xl border border-border bg-card p-5 text-left shadow-xs transition hover:border-primary/50 hover:shadow-md"><div className="flex items-center justify-between"><div><h3 className="font-bold text-foreground">{panchayat.name}</h3><p className="mt-1 text-xs text-muted-foreground">{panchayat.villages?.length || 0} villages · {studentCount} students</p></div><MapPin className="h-5 w-5 text-primary" /></div><p className="mt-4 border-t border-border pt-3 text-xs font-semibold text-primary">Open villages <ChevronRight className="inline h-3 w-3" /></p></button>;
            })}{!availablePanchayats.length && <p className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No panchayats are configured for this cluster.</p>}</div></section>}

            {subjectMode === 'students' && markingStep === 'villages' && currentPanchayat && <section className="space-y-3"><h2 className="text-lg font-bold text-foreground">All villages in {currentPanchayat.name}</h2><p className="text-xs text-muted-foreground">Choose one village or open the entire panchayat roster.</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><button type="button" onClick={() => handleSelectVillage('all')} className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-left shadow-xs transition hover:border-primary/60 hover:shadow-md"><div className="flex items-center justify-between"><div><h3 className="font-bold text-foreground">All Villages</h3><p className="mt-1 text-xs text-muted-foreground">{students.filter((student) => student.panchayatId === currentPanchayat.id).length} students across {availableVillages.length} villages</p></div><Users className="h-5 w-5 text-primary" /></div><p className="mt-4 border-t border-primary/10 pt-3 text-xs font-semibold text-primary">Open all villages <ChevronRight className="inline h-3 w-3" /></p></button>{availableVillages.map((village) => {
              const studentCount = students.filter((student) => student.panchayatId === currentPanchayat.id && (student.villageId === village.id || student.villageName === village.name)).length;
              const volunteerCount = volunteers.filter((volunteer) => (!volunteer.panchayatId || volunteer.panchayatId === currentPanchayat.id) && (!volunteer.villageId || volunteer.villageId === village.id || volunteer.villageName === village.name)).length;
              return <button key={village.id || village.name} type="button" onClick={() => handleSelectVillage(village.id || village.name)} className="rounded-2xl border border-border bg-card p-5 text-left shadow-xs transition hover:border-primary/50 hover:shadow-md"><div className="flex items-center justify-between"><div><h3 className="font-bold text-foreground">{village.name}</h3><p className="mt-1 text-xs text-muted-foreground">{studentCount} students · {volunteerCount} volunteers</p></div><MapPin className="h-5 w-5 text-primary" /></div><p className="mt-4 border-t border-border pt-3 text-xs font-semibold text-primary">Select village <ChevronRight className="inline h-3 w-3" /></p></button>;
            })}{!availableVillages.length && <p className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No villages are configured for this panchayat.</p>}</div></section>}

            {subjectMode === 'students' && markingStep === 'standards' && currentPanchayat && <section className="space-y-3"><h2 className="text-lg font-bold text-foreground">Select a standard · {currentVillage?.name || 'All Villages'}</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{availableStandards.map((standard) => {
              const count = students.filter((student) => student.panchayatId === currentPanchayat.id && (selectedVillageId === 'all' || student.villageId === currentVillage?.id || student.villageName === currentVillage?.name) && standardKey(student.standard) === standard).length;
              return <button key={standard} type="button" onClick={() => handleSelectStandard(standard)} className="rounded-2xl border border-border bg-card p-5 text-left shadow-xs transition hover:border-primary/50 hover:shadow-md"><div className="flex items-center justify-between"><span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">Standard {standard}</span><Users className="h-5 w-5 text-primary" /></div><p className="mt-4 text-2xl font-bold text-foreground">{count}</p><p className="text-xs text-muted-foreground">students</p><p className="mt-4 border-t border-border pt-3 text-xs font-semibold text-primary">Mark attendance <ChevronRight className="inline h-3 w-3" /></p></button>;
            })}{!availableStandards.length && <p className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No students are registered in this village.</p>}</div></section>}

            {canShowRoster && <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-foreground">{subjectMode === 'students' ? `Standard ${selectedStandard} · ` : ''}{currentVillage?.name || 'All Villages'} attendance</h2><p className="text-xs text-muted-foreground">{currentPanchayat?.name} · Day {selectedDayNumber}</p></div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-muted-foreground">Quick Mark:</span>{subjectMode === 'students' ? <><button type="button" disabled={!canEditAttendance} onClick={() => handleBatchMarkStudents('Present')} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 disabled:opacity-50">All Present</button><button type="button" disabled={!canEditAttendance} onClick={() => handleBatchMarkStudents('Absent')} className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 disabled:opacity-50">All Absent</button><button type="button" disabled={!canEditAttendance} onClick={() => handleBatchMarkTasks('Completed')} className="rounded-lg border border-border bg-muted/60 px-3 py-1 text-xs disabled:opacity-50">All Tasks Done</button></> : <><button type="button" disabled={!canEditAttendance} onClick={() => handleBatchMarkVolunteers('Present')} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 disabled:opacity-50">All Present</button><button type="button" disabled={!canEditAttendance} onClick={() => handleBatchMarkVolunteers('Absent')} className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 disabled:opacity-50">All Absent</button></>}</div></div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs font-semibold"><div className="flex flex-wrap gap-4">{subjectMode === 'students' ? <><span>Enrolled: {filteredStudents.length}</span><span className="text-emerald-600">Present: {presentCount}</span><span className="text-rose-600">Absent: {absentCount}</span><span className="text-primary">Tasks done: {tasksDoneCount}</span></> : <><span>Volunteers: {filteredVolunteers.length}</span><span className="text-emerald-600">Present: {volPresentCount}</span><span className="text-rose-600">Absent: {volAbsentCount}</span></>}</div>{subjectMode === 'students' && <div className="flex gap-2">
  <Button type="button" variant="outline" size="sm" onClick={handleExportAttendanceExcel} disabled={!getAttendanceExportRows().length}>
    <Download className="h-4 w-4" />Excel
  </Button>
  <Button type="button" variant="outline" size="sm" onClick={() => void handleDownloadAttendancePdf()} disabled={!getAttendanceExportRows().length || isDownloadingRosterPdf}>
    <Download className="h-4 w-4" />{isDownloadingRosterPdf ? 'Preparing PDF…' : 'PDF'}
  </Button>
</div>}</div>
            </div>}
            {canShowRoster && subjectMode === 'volunteers' && <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleExportAttendanceExcel} disabled={!filteredVolunteers.length}>
                <Download className="h-4 w-4" />Excel
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void handleDownloadAttendancePdf()} disabled={!filteredVolunteers.length || isDownloadingRosterPdf}>
                <Download className="h-4 w-4" />{isDownloadingRosterPdf ? 'Preparing PDF…' : 'PDF'}
              </Button>
            </div>}
            {canShowRoster && !canEditAttendance && canRequestEdit && <div className="flex justify-end">
              <Button type="button" onClick={() => { setEditRequestReason(''); setShowEditRequest(true); }} className="rounded-xl bg-amber-700 text-white hover:bg-amber-800">Request Edit Approval</Button>
            </div>}
          </div>

          {/* Standard-filtered student attendance table */}
          {subjectMode === 'students' && canShowRoster && (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
              <table className="w-full min-w-[850px] text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground"><tr><th className="w-14 px-4 py-3">S.No</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Standard</th><th className="px-4 py-3">Attendance</th><th className="px-4 py-3">Task completion</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {filteredStudents.map((st, index) => {
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
                      <tr key={st.id} className={!isPresent ? 'bg-rose-500/5' : 'hover:bg-muted/30'}>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">{index + 1}</td>
                        <td className="px-4 py-3"><div className="font-semibold text-foreground">{st.name}</div><div className="mt-0.5 text-[11px] text-muted-foreground">{st.villageName} · {st.schoolName || 'School not set'}</div></td>
                        <td className="px-4 py-3">Standard {standardKey(st.standard)}</td>
                        <td className="px-4 py-3">
                          {/* Present / Absent Circle Form Controls */}
                          <div className="flex items-center gap-1.5">
                            {/* Circle Present Button */}
                            <button
                              type="button"
                              disabled={!canEditAttendance}
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
                              disabled={!canEditAttendance}
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
                        </td>
                        <td className="px-4 py-3">
                          {/* Task Check Circle Toggle */}
                            <button
                              type="button"
                              disabled={!canEditAttendance}
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
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredStudents.length && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">No students found in Standard {selectedStandard} for this village.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Volunteer Roster with Circle Controls */}
          {subjectMode === 'volunteers' && canShowRoster && (
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
                            disabled={!canEditAttendance}
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
                            disabled={!canEditAttendance}
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

          {/* Submit once; later changes require explicit Super Admin permission. */}
          {canShowRoster && canEditAttendance && <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSave(false)}
              disabled={isSavingAttendance}
              className="rounded-xl"
            >
              Save Draft
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave(true)}
              disabled={isSavingAttendance}
              className="rounded-xl bg-primary text-primary-foreground shadow-xs"
            >
              Submit Day {selectedDayNumber} Attendance
            </Button>
          </div>}
          {canShowRoster && !canEditAttendance && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <p className="font-semibold">{editApprovalPending ? 'Edit approval is pending' : `Attendance ${currentSavedAttendance?.status === 'Approved' ? 'approved' : 'submitted'} and locked`}</p>
            <p className="mt-1">{currentSavedAttendance?.editReason || currentSavedAttendance?.reviewRemarks || 'To change this attendance, request edit approval from the Super Admin.'}</p>
          </div>}
        </div>
      )}

      {showEditRequest && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Request Edit Approval</h2><p className="mt-1 text-xs text-slate-500">The submitted attendance stays locked until the Super Admin reviews this request.</p></div><button type="button" onClick={() => setShowEditRequest(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
          <label className="mt-4 block text-xs font-semibold text-slate-700">Reason for editing<textarea autoFocus value={editRequestReason} onChange={(event) => setEditRequestReason(event.target.value)} rows={4} className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-primary" placeholder="Explain why this attendance needs to be changed" /></label>
          <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowEditRequest(false)} disabled={isRequestingEdit}>Cancel</Button><Button type="button" onClick={() => void handleRequestEdit()} disabled={isRequestingEdit || !editRequestReason.trim()} className="bg-primary text-primary-foreground">{isRequestingEdit ? 'Requesting…' : 'Send Request'}</Button></div>
        </div>
      </div>}

    </div>
  );
};
