import React, { useState, useMemo, useEffect } from 'react';
import { AttendanceSession, Student, Panchayat, TabType, AttendanceRecord, Volunteer } from '../types';
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
  Check,
  X,
  Calendar,
  MapPin,
  CheckCircle2,
  Users,
  Search,
  BookOpen,
  Eye,
  AlertCircle,
  Phone,
  GraduationCap,
  CaretLeft,
  CaretRight,
} from './ui/icons';

interface AttendanceViewProps {
  attendanceSessions: AttendanceSession[];
  students: Student[];
  panchayats: Panchayat[];
  volunteers?: Volunteer[];
  draftId?: string;
  userRole?: string;
  onNavigate: (tab: TabType) => void;
  onSaveAttendance: (session: AttendanceSession) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  attendanceSessions,
  students,
  panchayats,
  volunteers = [],
  draftId,
  userRole = 'Super Admin',
  onNavigate,
  onSaveAttendance,
}) => {
  const [activeTab, setActiveTab] = useState<'mark' | 'history'>('mark');
  const [selectedPanchayatId, setSelectedPanchayatId] = useState<string>(
    panchayats[0]?.id || ''
  );
  const [selectedVillageId, setSelectedVillageId] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [sessionDate, setSessionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [sessionTitle, setSessionTitle] = useState<string>(
    'Day 1 Spoken English & Life Skills'
  );
  const [taskTopic, setTaskTopic] = useState<string>(
    'Worksheet & Conversational Drill'
  );
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [activeDraftSessionId, setActiveDraftSessionId] = useState<string | null>(
    draftId || null
  );

  // Correction request modal state
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');

  // Roster search & filter inside workspace
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStandard, setSelectedStandard] = useState<string>('all');

  // Volunteer attendance toggle map: { [volunteerId]: 'Present' | 'Absent' }
  const [volunteerAttendanceMap, setVolunteerAttendanceMap] = useState<Record<string, 'Present' | 'Absent'>>({});

  useEffect(() => {
    if (panchayats.length > 0) {
      const exists = panchayats.some((p) => p.id === selectedPanchayatId);
      if (!exists) {
        setSelectedPanchayatId(panchayats[0].id);
      }
    }
  }, [panchayats, selectedPanchayatId]);

  const currentPanchayat = useMemo(() => {
    return panchayats.find((p) => p.id === selectedPanchayatId) || panchayats[0];
  }, [panchayats, selectedPanchayatId]);

  const availableVillages = useMemo(() => {
    return currentPanchayat?.villages || [];
  }, [currentPanchayat]);

  const handlePanchayatChange = (panchayatId: string) => {
    setSelectedPanchayatId(panchayatId);
    const panch = panchayats.find((p) => p.id === panchayatId);
    if (panch && panch.villages && panch.villages.length > 0) {
      setSelectedVillageId(panch.villages[0].id);
    } else {
      setSelectedVillageId('all');
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchPanchayat = s.panchayatId === selectedPanchayatId || 
        (currentPanchayat && (s.panchayatName || '').toLowerCase() === currentPanchayat.name.toLowerCase());
      const matchVillage =
        selectedVillageId === 'all' ||
        s.villageId === selectedVillageId ||
        (s.villageName || '').toLowerCase() === selectedVillageId.toLowerCase();
      return matchPanchayat && matchVillage;
    });
  }, [students, selectedPanchayatId, selectedVillageId, currentPanchayat]);

  const [recordsMap, setRecordsMap] = useState<Record<string, AttendanceRecord>>({});

  // Initialize records when draftId or filtered students change
  useEffect(() => {
    if (draftId) {
      const draft = attendanceSessions.find((s) => s.id === draftId);
      if (draft) {
        if (draft.panchayatId) setSelectedPanchayatId(draft.panchayatId);
        if (draft.villageId) setSelectedVillageId(draft.villageId);
        if (draft.dayNumber) setSelectedDay(draft.dayNumber);
        if (draft.date) setSessionDate(draft.date);
        if (draft.sessionName) setSessionTitle(draft.sessionName);
        if (draft.taskTopic) setTaskTopic(draft.taskTopic);

        const newMap: Record<string, AttendanceRecord> = {};
        draft.records.forEach((rec) => {
          newMap[rec.studentId] = rec;
        });
        setRecordsMap(newMap);
        setActiveDraftSessionId(draft.id);
        return;
      }
    }

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
  }, [selectedPanchayatId, selectedVillageId, draftId, filteredStudents, taskTopic, attendanceSessions]);

  const activeSessionObj = useMemo(() => {
    return attendanceSessions.find((s) => s.id === activeDraftSessionId);
  }, [attendanceSessions, activeDraftSessionId]);

  const isSessionLocked = useMemo(() => {
    if (!activeSessionObj) return false;
    return ['Submitted', 'Approved', 'Completed'].includes(activeSessionObj.status);
  }, [activeSessionObj]);

  const handleToggleAttendance = (studentId: string, status: 'Present' | 'Absent' | 'Late') => {
    if (isSessionLocked) return;
    setRecordsMap((prev) => {
      const current = prev[studentId] || {
        studentId,
        studentName: students.find((s) => s.id === studentId)?.name || 'Student',
        code: students.find((s) => s.id === studentId)?.code || '',
        standard: students.find((s) => s.id === studentId)?.standard || '',
        villageName: students.find((s) => s.id === studentId)?.villageName || '',
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

  const handleToggleTask = (studentId: string, taskStatus: 'Completed' | 'Not Completed') => {
    if (isSessionLocked) return;
    setRecordsMap((prev) => {
      const current = prev[studentId] || {
        studentId,
        studentName: students.find((s) => s.id === studentId)?.name || 'Student',
        code: students.find((s) => s.id === studentId)?.code || '',
        standard: students.find((s) => s.id === studentId)?.standard || '',
        villageName: students.find((s) => s.id === studentId)?.villageName || '',
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

  const markAllAttendance = (status: 'Present' | 'Absent') => {
    if (isSessionLocked) return;
    setRecordsMap((prev) => {
      const updated = { ...prev };
      filteredStudents.forEach((st) => {
        const existing = updated[st.id] || {
          studentId: st.id,
          studentName: st.name,
          code: st.code,
          standard: st.standard,
          villageName: st.villageName,
          status: 'Present',
          taskStatus: 'Completed',
        };
        updated[st.id] = {
          ...existing,
          status,
          taskStatus: status === 'Absent' ? 'Not Completed' : existing.taskStatus || 'Completed',
        };
      });
      return updated;
    });
  };

  const markAllTasks = (taskStatus: 'Completed' | 'Not Completed') => {
    if (isSessionLocked) return;
    setRecordsMap((prev) => {
      const updated = { ...prev };
      filteredStudents.forEach((st) => {
        const existing = updated[st.id] || {
          studentId: st.id,
          studentName: st.name,
          code: st.code,
          standard: st.standard,
          villageName: st.villageName,
          status: 'Present',
          taskStatus: 'Completed',
        };
        updated[st.id] = {
          ...existing,
          taskStatus,
        };
      });
      return updated;
    });
  };

  const currentRecordsList: AttendanceRecord[] = useMemo(() => {
    return filteredStudents.map((st) => {
      const record = recordsMap[st.id];
      if (record) return record;
      return {
        studentId: st.id,
        studentName: st.name,
        code: st.code,
        standard: st.standard,
        villageName: st.villageName,
        status: 'Present' as const,
        taskStatus: 'Completed' as const,
        taskTitle: taskTopic,
        remarks: '',
      };
    });
  }, [filteredStudents, recordsMap, taskTopic]);

  const presentCount = useMemo(
    () => currentRecordsList.filter((r) => r.status === 'Present' || r.status === 'Late').length,
    [currentRecordsList]
  );
  const absentCount = useMemo(
    () => currentRecordsList.filter((r) => r.status === 'Absent').length,
    [currentRecordsList]
  );
  const tasksCompletedCount = useMemo(
    () => currentRecordsList.filter((r) => r.taskStatus === 'Completed').length,
    [currentRecordsList]
  );

  const selectedVillageName = useMemo(() => {
    if (selectedVillageId === 'all') return 'All Villages';
    return availableVillages.find((v) => v.id === selectedVillageId || v.name === selectedVillageId)?.name || 'Village';
  }, [selectedVillageId, availableVillages]);

  const displayedStudents = useMemo(() => {
    return filteredStudents.filter((st) => {
      const q = studentSearch.toLowerCase();
      const matchSearch =
        !studentSearch ||
        st.name.toLowerCase().includes(q) ||
        (st.code || '').toLowerCase().includes(q) ||
        (st.parentName || '').toLowerCase().includes(q);

      const matchStd = selectedStandard === 'all' || st.standard === selectedStandard;
      return matchSearch && matchStd;
    });
  }, [filteredStudents, studentSearch, selectedStandard]);

  const handleSaveAttendanceSession = (statusToSave: 'Draft' | 'Submitted' | 'Approved') => {
    if (filteredStudents.length === 0) {
      alert('No students found for this Panchayat and Village. Please enroll students first.');
      return;
    }

    const sessionIdToSave = activeDraftSessionId || `att-${Date.now()}`;
    const newSession: AttendanceSession = {
      id: sessionIdToSave,
      sessionId: `ses-day${selectedDay}`,
      sessionName: sessionTitle || `Day ${selectedDay} Session`,
      panchayatId: selectedPanchayatId,
      panchayatName: currentPanchayat?.name || 'Panchayat',
      villageId: selectedVillageId,
      villageName: selectedVillageName,
      date: sessionDate,
      day: `Day ${selectedDay}`,
      dayNumber: selectedDay,
      taskTopic,
      totalCount: filteredStudents.length,
      presentCount,
      absentCount,
      tasksCompletedCount,
      status: statusToSave,
      lastSaved: statusToSave === 'Approved' ? 'Approved just now' : statusToSave === 'Submitted' ? 'Submitted just now' : 'Saved draft just now',
      records: currentRecordsList,
    };

    onSaveAttendance(newSession);
    setActiveDraftSessionId(sessionIdToSave);
    setSaveSuccessMsg(
      statusToSave === 'Approved'
        ? `Day ${selectedDay} Attendance for ${currentPanchayat?.name} (${selectedVillageName}) has been approved!`
        : statusToSave === 'Submitted'
        ? `Day ${selectedDay} Attendance submitted successfully for administrative review!`
        : `Day ${selectedDay} Attendance Draft saved successfully!`
    );
    setTimeout(() => setSaveSuccessMsg(''), 4500);
  };

  const handleRequestCorrection = () => {
    if (!correctionReason.trim()) {
      alert('Please enter the reason or correction note.');
      return;
    }

    const sessionIdToSave = activeDraftSessionId || `att-${Date.now()}`;
    const updated: AttendanceSession = {
      id: sessionIdToSave,
      sessionId: `ses-day${selectedDay}`,
      sessionName: sessionTitle || `Day ${selectedDay} Session`,
      panchayatId: selectedPanchayatId,
      panchayatName: currentPanchayat?.name || 'Panchayat',
      villageId: selectedVillageId,
      villageName: selectedVillageName,
      date: sessionDate,
      day: `Day ${selectedDay}`,
      dayNumber: selectedDay,
      taskTopic,
      totalCount: filteredStudents.length,
      presentCount,
      absentCount,
      tasksCompletedCount,
      status: 'Correction Requested',
      correctionReason: correctionReason.trim(),
      lastSaved: 'Correction requested',
      records: currentRecordsList,
    };

    onSaveAttendance(updated);
    setActiveDraftSessionId(sessionIdToSave);
    setShowCorrectionModal(false);
    setCorrectionReason('');
    setSaveSuccessMsg('Correction request sent to the cluster team.');
    setTimeout(() => setSaveSuccessMsg(''), 4500);
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Attendance &amp; Task Workspace
            </h1>
            <Badge variant="default" size="sm">
              Day {selectedDay}
            </Badge>
            {activeSessionObj && (
              <Badge
                variant={
                  activeSessionObj.status === 'Approved'
                    ? 'success'
                    : activeSessionObj.status === 'Submitted'
                    ? 'info'
                    : activeSessionObj.status === 'Correction Requested'
                    ? 'destructive'
                    : 'secondary'
                }
                size="sm"
              >
                {activeSessionObj.status}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Mark student attendance, monitor learning task progress, and submit daily sessions for administrative review.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant={activeTab === 'mark' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('mark')}
            className="text-xs font-semibold"
          >
            Attendance Entry
          </Button>
          <Button
            variant={activeTab === 'history' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('history')}
            className="text-xs font-semibold"
          >
            Session History ({attendanceSessions.length})
          </Button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccessMsg('')}
            className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {activeTab === 'mark' ? (
        <div className="space-y-6">
          {/* Top Workspace Selector Card */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-xs space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* STEP 1: PANCHAYAT SELECTION */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span>1. Target Panchayat *</span>
                </label>
                <Select
                  value={selectedPanchayatId}
                  onValueChange={(val) => handlePanchayatChange(val)}
                  disabled={isSessionLocked}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Panchayat" />
                  </SelectTrigger>
                  <SelectContent>
                    {panchayats.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.villages?.length || 0} villages)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* STEP 2: VILLAGE SELECTION */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span>2. Village Hub *</span>
                </label>
                <Select
                  value={selectedVillageId}
                  onValueChange={(val) => setSelectedVillageId(val)}
                  disabled={isSessionLocked}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Village" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Villages ({currentPanchayat?.name || 'Cluster'})</SelectItem>
                    {availableVillages.map((v) => (
                      <SelectItem key={v.id || v.name} value={v.id || v.name}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* STEP 3: SESSION DATE & DAY */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>3. Session Date &amp; Cycle *</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    disabled={isSessionLocked}
                    className="h-9 text-xs"
                  />
                  <div className="w-32">
                    <Select
                      value={String(selectedDay)}
                      onValueChange={(val) => setSelectedDay(parseInt(val) || 1)}
                      disabled={isSessionLocked}
                    >
                      <SelectTrigger className="h-9 text-xs font-semibold">
                        <SelectValue placeholder="Day" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            Day {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Locked Warning / Correction Notice */}
            {isSessionLocked && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>This session has been {activeSessionObj?.status.toLowerCase()} and attendance records are read-only.</span>
              </div>
            )}
            {activeSessionObj?.status === 'Correction Requested' && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Correction Requested by Reviewer:</strong>
                  <span>{activeSessionObj.correctionReason || 'Please review absent records and verify student counts.'}</span>
                </div>
              </div>
            )}

            {/* Curriculum Topic input & Quick Day buttons */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-3">
              <div className="flex flex-1 items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Curriculum Topic:
                </span>
                <Input
                  type="text"
                  placeholder="e.g. Day 1: Self Introductions & Action Verbs"
                  value={taskTopic}
                  onChange={(e) => setTaskTopic(e.target.value)}
                  disabled={isSessionLocked}
                  className="h-8 text-xs"
                />
              </div>

              {/* Day Quick Selectors 1-8 */}
              <div className="flex items-center gap-1 overflow-x-auto">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((day) => (
                  <Button
                    key={day}
                    type="button"
                    variant={selectedDay === day ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedDay(day)}
                    disabled={isSessionLocked}
                    className="h-7 px-2 text-xs"
                  >
                    Day {day}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. KPI Stat Metric Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Total Enrolled</span>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{filteredStudents.length}</p>
              <p className="mt-1 text-[11px] text-muted-foreground truncate">
                {currentPanchayat?.name || 'Panchayat'} &middot; {selectedVillageName}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Present</span>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{presentCount}</p>
              <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                {filteredStudents.length > 0
                  ? `${Math.round((presentCount / filteredStudents.length) * 100)}% Attendance`
                  : '0%'}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <X className="h-3.5 w-3.5 text-red-600" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Absent</span>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">{absentCount}</p>
              <p className="mt-1 text-[11px] font-medium text-red-600 dark:text-red-400">
                {filteredStudents.length > 0
                  ? `${Math.round((absentCount / filteredStudents.length) * 100)}% Absent`
                  : '0%'}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5 text-purple-600" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Tasks Done</span>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">{tasksCompletedCount}</p>
              <p className="mt-1 text-[11px] font-medium text-purple-600 dark:text-purple-400">
                {filteredStudents.length > 0
                  ? `${Math.round((tasksCompletedCount / filteredStudents.length) * 100)}% Completed`
                  : '0%'}
              </p>
            </div>
          </div>

          {/* 3. Batch Actions & Roster Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search students in this roster..."
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <div className="w-32">
                <Select
                  value={selectedStandard}
                  onValueChange={(val) => setSelectedStandard(val)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Standard" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Standards</SelectItem>
                    <SelectItem value="9">Std 9</SelectItem>
                    <SelectItem value="10">Std 10</SelectItem>
                    <SelectItem value="11">Std 11</SelectItem>
                    <SelectItem value="12">Std 12</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 border-r border-border pr-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => markAllAttendance('Present')}
                  disabled={isSessionLocked}
                  className="h-8 gap-1 text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                >
                  <Check className="h-3 w-3" />
                  <span>All Present</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => markAllAttendance('Absent')}
                  disabled={isSessionLocked}
                  className="h-8 gap-1 text-xs text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <X className="h-3 w-3" />
                  <span>All Absent</span>
                </Button>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => markAllTasks('Completed')}
                  disabled={isSessionLocked}
                  className="h-8 gap-1 text-xs text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/40"
                >
                  <Check className="h-3 w-3" />
                  <span>All Tasks Done</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllTasks('Not Completed')}
                  disabled={isSessionLocked}
                  className="h-8 text-xs text-muted-foreground"
                >
                  Reset Tasks
                </Button>
              </div>
            </div>
          </div>

          {/* 4. Student Roster Attendance Table */}
          <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground">
              <span>
                Student Roster ({displayedStudents.length} of {filteredStudents.length} Students)
              </span>
              <span className="font-normal text-muted-foreground">
                Mark attendance and task evaluation status
              </span>
            </div>

            {displayedStudents.length === 0 ? (
              <div className="py-12">
                <EmptyState
                  icon={Users}
                  title="No students found"
                  description="No students enrolled matching this Panchayat and Village filter."
                  actionLabel="Back to All Villages"
                  onAction={() => setSelectedVillageId('all')}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/20 font-semibold text-muted-foreground">
                    <tr>
                      <th className="w-14 px-4 py-3 text-center">S.No</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Standard</th>
                      <th className="px-4 py-3">Village</th>
                      <th className="px-4 py-3 text-center">Attendance Status</th>
                      <th className="px-4 py-3 text-center">Curriculum Task</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayedStudents.map((st, idx) => {
                      const rec = recordsMap[st.id] || {
                        studentId: st.id,
                        studentName: st.name,
                        code: st.code,
                        standard: st.standard,
                        villageName: st.villageName,
                        status: 'Present',
                        taskStatus: 'Completed',
                        taskTitle: taskTopic,
                      };
                      const isPresent = rec.status === 'Present';
                      const isAbsent = rec.status === 'Absent';
                      const isTaskCompleted = rec.taskStatus === 'Completed';

                      return (
                        <tr
                          key={st.id}
                          className={`transition-colors ${
                            isAbsent
                              ? 'bg-red-50/20 dark:bg-red-950/10'
                              : 'hover:bg-muted/30'
                          }`}
                        >
                          <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {st.avatarLetter || st.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-semibold text-foreground">
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
                          <td className="px-4 py-3 text-muted-foreground">
                            {st.villageName}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex items-center rounded-md border border-border p-0.5 bg-background">
                              <button
                                type="button"
                                onClick={() => handleToggleAttendance(st.id, 'Present')}
                                disabled={isSessionLocked}
                                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                                  isPresent
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                <Check className="h-3 w-3" />
                                <span>Present</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleAttendance(st.id, 'Absent')}
                                disabled={isSessionLocked}
                                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                                  isAbsent
                                    ? 'bg-red-600 text-white shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                <X className="h-3 w-3" />
                                <span>Absent</span>
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex items-center rounded-md border border-border p-0.5 bg-background">
                              <button
                                type="button"
                                onClick={() => handleToggleTask(st.id, 'Completed')}
                                disabled={isSessionLocked || isAbsent}
                                className={`rounded px-2.5 py-1 text-xs font-semibold transition disabled:opacity-40 ${
                                  isTaskCompleted && !isAbsent
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                Done
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleTask(st.id, 'Not Completed')}
                                disabled={isSessionLocked || isAbsent}
                                className={`rounded px-2.5 py-1 text-xs font-semibold transition disabled:opacity-40 ${
                                  !isTaskCompleted || isAbsent
                                    ? 'bg-muted text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                Pending
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 5. Volunteer Attendance Sub-Section */}
          {volunteers.length > 0 && (
            <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
              <div className="border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Assigned College Volunteers Attendance</span>
                <span className="text-[11px] font-normal">Check in mentors for Day {selectedDay}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/20 text-muted-foreground">
                    <tr>
                      <th className="w-14 px-4 py-2.5 text-center">S.No</th>
                      <th className="px-4 py-2.5">Mentor Name</th>
                      <th className="px-4 py-2.5">College / Institution</th>
                      <th className="px-4 py-2.5">Department</th>
                      <th className="px-4 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {volunteers.slice(0, 5).map((vol, vIdx) => {
                      const volStatus = volunteerAttendanceMap[vol.id] || 'Present';
                      return (
                        <tr key={vol.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5 text-center font-mono text-muted-foreground">
                            {vIdx + 1}
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-foreground">
                            {vol.name}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {vol.college || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {vol.department}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="inline-flex items-center rounded-md border border-border p-0.5 bg-background">
                              <button
                                type="button"
                                onClick={() => setVolunteerAttendanceMap((m) => ({ ...m, [vol.id]: 'Present' }))}
                                className={`rounded px-2 py-0.5 text-xs font-semibold ${
                                  volStatus === 'Present'
                                    ? 'bg-emerald-600 text-white'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                Present
                              </button>
                              <button
                                type="button"
                                onClick={() => setVolunteerAttendanceMap((m) => ({ ...m, [vol.id]: 'Absent' }))}
                                className={`rounded px-2 py-0.5 text-xs font-semibold ${
                                  volStatus === 'Absent'
                                    ? 'bg-red-600 text-white'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                Absent
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. Footer Workflow Action Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Day {selectedDay} Summary:</span>{' '}
              {presentCount} Present &middot; {absentCount} Absent &middot; {tasksCompletedCount} Tasks Done
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isSessionLocked && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveAttendanceSession('Draft')}
                  >
                    Save as Draft
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSaveAttendanceSession('Submitted')}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Submit for Approval
                  </Button>
                </>
              )}

              {/* Super Admin Approval Controls */}
              {userRole === 'Super Admin' && (
                <>
                  {activeSessionObj?.status !== 'Approved' && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSaveAttendanceSession('Approved')}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Approve Attendance
                    </Button>
                  )}
                  {activeSessionObj?.status !== 'Correction Requested' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCorrectionModal(true)}
                      className="text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-900"
                    >
                      Request Correction
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ==========================================
            SESSION HISTORY TAB
           ========================================== */
        <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Recorded Attendance Sessions
              </h3>
              <p className="text-xs text-muted-foreground">
                History of logged attendance and task records across academic cycles.
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {attendanceSessions.length} Sessions Total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Session &amp; Day</th>
                  <th className="px-4 py-3">Panchayat &amp; Village</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Attendance</th>
                  <th className="px-4 py-3">Tasks Completed</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attendanceSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12">
                      <EmptyState
                        icon={Calendar}
                        title="No attendance sessions recorded"
                        description="Start logging attendance for Day 1 through Day 8 from the Attendance Entry tab."
                        actionLabel="Mark Attendance"
                        onAction={() => setActiveTab('mark')}
                      />
                    </td>
                  </tr>
                ) : (
                  attendanceSessions.map((session) => (
                    <tr
                      key={session.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {session.day || `Day ${session.dayNumber}`}
                        <div className="text-[11px] font-normal text-muted-foreground">
                          {session.sessionName}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{session.panchayatName}</div>
                        <div className="text-[11px] text-muted-foreground">{session.villageName}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {session.date}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {session.presentCount || 0}
                        </span>{' '}
                        /{' '}
                        <span className="text-muted-foreground">
                          {session.totalCount || session.records.length}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-purple-600 dark:text-purple-400">
                        {session.tasksCompletedCount ??
                          session.records.filter((r) => r.taskStatus === 'Completed').length}{' '}
                        /{' '}
                        <span className="font-normal text-muted-foreground">
                          {session.records.length}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            session.status === 'Approved'
                              ? 'success'
                              : session.status === 'Submitted'
                              ? 'info'
                              : session.status === 'Correction Requested'
                              ? 'destructive'
                              : 'secondary'
                          }
                          size="sm"
                        >
                          {session.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (session.panchayatId) setSelectedPanchayatId(session.panchayatId);
                            if (session.villageId) setSelectedVillageId(session.villageId);
                            if (session.dayNumber) setSelectedDay(session.dayNumber);
                            if (session.date) setSessionDate(session.date);
                            if (session.sessionName) setSessionTitle(session.sessionName);
                            if (session.taskTopic) setTaskTopic(session.taskTopic);

                            const map: Record<string, AttendanceRecord> = {};
                            session.records.forEach((r) => {
                              map[r.studentId] = r;
                            });
                            setRecordsMap(map);
                            setActiveDraftSessionId(session.id);
                            setActiveTab('mark');
                          }}
                          className="text-xs font-semibold text-primary hover:text-primary/90"
                        >
                          {session.status === 'Draft' || session.status === 'Correction Requested'
                            ? 'Continue Entry →'
                            : 'Review Roster →'}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Correction Request Modal */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Request Resubmission</h3>
              <button
                type="button"
                onClick={() => setShowCorrectionModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Reason for Correction / Notes to Cluster Team *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Explain why this attendance sheet requires changes (e.g. absent counts mismatch with student roster)..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCorrectionModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleRequestCorrection}
                >
                  Send Correction Request
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
