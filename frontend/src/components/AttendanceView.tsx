import React, { useState, useMemo, useEffect } from 'react';
import { AttendanceSession, Student, Panchayat, TabType, AttendanceRecord } from '../types';
import { Badge } from './ui/badge';
import { Check, X, Calendar, MapPin, Sparkles, CheckCircle2 } from './ui/icons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { ActionButton } from './ui/action-button';

interface AttendanceViewProps {
  attendanceSessions: AttendanceSession[];
  students: Student[];
  panchayats: Panchayat[];
  draftId?: string;
  onNavigate: (tab: TabType) => void;
  onSaveAttendance: (session: AttendanceSession) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  attendanceSessions,
  students,
  panchayats,
  draftId,
  onSaveAttendance,
}) => {
  // Step 1 & 2 selections
  const [selectedPanchayatId, setSelectedPanchayatId] = useState<string>(
    panchayats[0]?.id || ''
  );
  const [selectedVillageId, setSelectedVillageId] = useState<string>('all');

  // Synchronize selectedPanchayatId if panchayats array loads or updates
  useEffect(() => {
    if (panchayats.length > 0) {
      const exists = panchayats.some((p) => p.id === selectedPanchayatId);
      if (!exists) {
        setSelectedPanchayatId(panchayats[0].id);
      }
    }
  }, [panchayats, selectedPanchayatId]);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [sessionDate, setSessionDate] = useState<string>('2023-10-24');
  const [sessionTitle, setSessionTitle] = useState<string>('Day 1 Spoken English & Life Skills');
  const [taskTopic, setTaskTopic] = useState<string>('Worksheet & Conversational Drill');
  const [activeTab, setActiveTab] = useState<'mark' | 'history'>('mark');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [activeDraftSessionId, setActiveDraftSessionId] = useState<string | null>(draftId || null);

  // Get current panchayat & its villages
  const currentPanchayat = useMemo(() => {
    return panchayats.find((p) => p.id === selectedPanchayatId) || panchayats[0];
  }, [panchayats, selectedPanchayatId]);

  const availableVillages = useMemo(() => {
    return currentPanchayat?.villages || [];
  }, [currentPanchayat]);

  // When panchayat changes, auto-adjust village
  const handlePanchayatChange = (panchayatId: string) => {
    setSelectedPanchayatId(panchayatId);
    const panch = panchayats.find((p) => p.id === panchayatId);
    if (panch && panch.villages && panch.villages.length > 0) {
      setSelectedVillageId(panch.villages[0].id);
    } else {
      setSelectedVillageId('all');
    }
  };

  // Filter students based on Step 1 (Panchayat) and Step 2 (Village)
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchPanchayat = s.panchayatId === selectedPanchayatId;
      const matchVillage = selectedVillageId === 'all' || s.villageId === selectedVillageId;
      return matchPanchayat && matchVillage;
    });
  }, [students, selectedPanchayatId, selectedVillageId]);

  // Student Attendance & Task records map state
  const [recordsMap, setRecordsMap] = useState<Record<string, AttendanceRecord>>({});

  // Initialize records when students list or draft changes
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

    // Default initialization for current filtered students
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

  // Toggle single student attendance status (Present / Absent / Late)
  const handleToggleAttendance = (studentId: string, status: 'Present' | 'Absent' | 'Late') => {
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

  // Toggle single student task status (Completed / Not Completed)
  const handleToggleTask = (studentId: string, taskStatus: 'Completed' | 'Not Completed') => {
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

  // Batch actions
  const markAllAttendance = (status: 'Present' | 'Absent') => {
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

  // Metric computations
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
    return availableVillages.find((v) => v.id === selectedVillageId)?.name || 'Village';
  }, [selectedVillageId, availableVillages]);

  // Save / Submit handler
  const handleSaveAttendanceSession = (isFinalSubmit: boolean) => {
    if (filteredStudents.length === 0) {
      alert('No students found for this Panchayat and Village. Please add students first.');
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
      status: isFinalSubmit ? 'Submitted' : 'Draft',
      lastSaved: isFinalSubmit ? 'Submitted just now' : 'Saved just now',
      records: currentRecordsList,
    };

    onSaveAttendance(newSession);
    setActiveDraftSessionId(sessionIdToSave);
    setSaveSuccessMsg(
      isFinalSubmit
        ? `Day ${selectedDay} Attendance & Task records submitted successfully for ${currentPanchayat?.name || 'Panchayat'} (${selectedVillageName})!`
        : `Day ${selectedDay} Attendance Draft saved successfully!`
    );
    setTimeout(() => setSaveSuccessMsg(''), 4500);
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Cardless Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Attendance &amp; Task Entry
            </h1>
            <Badge color="primary" size="sm">
              Day {selectedDay}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Step 1: Select Panchayat &rarr; Step 2: Select Village &rarr; Step 3: Mark Present/Absent &amp; Tasks.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('mark')}
            className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition shadow-theme-xs ${
              activeTab === 'mark'
                ? 'bg-brand-500 text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5'
            }`}
          >
            Mark Attendance &amp; Tasks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition shadow-theme-xs ${
              activeTab === 'history'
                ? 'bg-brand-500 text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5'
            }`}
          >
            History ({attendanceSessions.length})
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="rounded-xl border border-success-200 bg-success-50 p-4 text-xs font-medium text-success-600 dark:border-success-900/40 dark:bg-success-500/10 dark:text-success-400 flex items-center justify-between">
          <span>{saveSuccessMsg}</span>
          <button
            type="button"
            onClick={() => setSaveSuccessMsg('')}
            className="text-success-600 hover:text-success-800 dark:text-success-400"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {activeTab === 'mark' ? (
        <div className="space-y-6">
          {/* STEP SELECTORS BAR - Cardless Flat Styling */}
          <div className="space-y-4 pb-2 border-b border-gray-100 dark:border-gray-800">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* STEP 1: PANCHAYAT SELECTION */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-brand-500" />
                  1. Panchayat
                </label>
                <Select
                  value={selectedPanchayatId}
                  onValueChange={(val) => handlePanchayatChange(val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Panchayat" />
                  </SelectTrigger>
                  <SelectContent>
                    {panchayats.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} Panchayat ({p.activeStudents} students)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* STEP 2: VILLAGE SELECTION */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-brand-500" />
                  2. Village / Center
                </label>
                <Select
                  value={selectedVillageId}
                  onValueChange={(val) => setSelectedVillageId(val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Village" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Villages ({currentPanchayat?.name || 'Cluster'})</SelectItem>
                    {availableVillages.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} ({v.studentCount} students)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* STEP 3: SESSION DATE & DAY */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-brand-500" />
                  3. Date &amp; Day
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    disabled={['Submitted', 'Approved', 'Completed'].includes(attendanceSessions.find(s => s.id === activeDraftSessionId)?.status || '')}
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-theme-xs focus:border-brand-500 focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white disabled:opacity-50"
                  />
                  <div className="w-28">
                    <Select
                      value={String(selectedDay)}
                      onValueChange={(val) => setSelectedDay(parseInt(val) || 1)}
                      disabled={['Submitted', 'Approved', 'Completed'].includes(attendanceSessions.find(s => s.id === activeDraftSessionId)?.status || '')}
                    >
                      <SelectTrigger className="w-full text-brand-500 font-bold disabled:opacity-50">
                        <SelectValue placeholder="Day" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((d) => (
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

            {/* Edit Lock Messages */}
            {(() => {
              const activeSession = attendanceSessions.find(s => s.id === activeDraftSessionId);
              if (activeSession && ['Submitted', 'Approved', 'Completed'].includes(activeSession.status)) {
                return (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="w-5 h-5 text-success-500" />
                    <span>This attendance has been {activeSession.status.toLowerCase()} and cannot be edited.</span>
                  </div>
                );
              }
              if (activeSession && activeSession.status === 'Correction Requested') {
                return (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-sm text-amber-800">
                    <span className="material-symbols-outlined text-[20px] text-amber-600">warning</span>
                    <span>Correction Requested: {activeSession.correctionReason || 'Please review and resubmit.'}</span>
                  </div>
                );
              }
              return null;
            })()}

            {/* Task / Activity Topic setup */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Today&apos;s Topic:
                </span>
                <input
                  type="text"
                  placeholder="e.g., Phonics Worksheet & Speaking Practice"
                  value={taskTopic}
                  onChange={(e) => setTaskTopic(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 shadow-theme-xs focus:border-brand-500 focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                />
              </div>

              {/* Day Quick Selectors */}
              <div className="flex items-center gap-1 overflow-x-auto">
                {[1, 2, 3, 4, 5, 6].map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      selectedDay === day
                        ? 'bg-brand-500 text-white shadow-theme-xs'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    Day {day}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Compact Metric Cards (counts & status only) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Enrolled</div>
              <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{filteredStudents.length}</div>
              <p className="mt-1 text-xs text-gray-400 truncate">
                {currentPanchayat?.name || 'Panchayat'} &middot; {selectedVillageName}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="text-xs font-semibold uppercase tracking-wider text-success-500">Present</div>
              <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{presentCount}</div>
              <p className="mt-1 text-xs font-medium text-success-500">
                {filteredStudents.length > 0
                  ? `${Math.round((presentCount / filteredStudents.length) * 100)}% Attendance`
                  : '0%'}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="text-xs font-semibold uppercase tracking-wider text-error-500">Absent</div>
              <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{absentCount}</div>
              <p className="mt-1 text-xs font-medium text-error-500">
                {filteredStudents.length > 0
                  ? `${Math.round((absentCount / filteredStudents.length) * 100)}% Absent`
                  : '0%'}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="text-xs font-semibold uppercase tracking-wider text-warning-500">Tasks Completed</div>
              <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{tasksCompletedCount}</div>
              <p className="mt-1 text-xs font-medium text-warning-500">
                {filteredStudents.length > 0
                  ? `${Math.round((tasksCompletedCount / filteredStudents.length) * 100)}% Tasks Done`
                  : '0%'}
              </p>
            </div>
          </div>

          {/* 3. Cardless Batch Action Toolbar with Lucide Icons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Attendance:</span>
              <button
                type="button"
                onClick={() => markAllAttendance('Present')}
                disabled={['Submitted', 'Approved', 'Completed'].includes(attendanceSessions.find(s => s.id === activeDraftSessionId)?.status || '')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-success-200 bg-success-50 px-3 py-1.5 text-xs font-semibold text-success-600 hover:bg-success-100 dark:border-success-900/40 dark:bg-success-500/10 dark:text-success-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-3.5 h-3.5" />
                <span>All Present</span>
              </button>
              <button
                type="button"
                onClick={() => markAllAttendance('Absent')}
                disabled={['Submitted', 'Approved', 'Completed'].includes(attendanceSessions.find(s => s.id === activeDraftSessionId)?.status || '')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-error-200 bg-error-50 px-3 py-1.5 text-xs font-semibold text-error-600 hover:bg-error-100 dark:border-error-900/40 dark:bg-error-500/10 dark:text-error-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-3.5 h-3.5" />
                <span>All Absent</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tasks:</span>
              <button
                type="button"
                onClick={() => markAllTasks('Completed')}
                disabled={['Submitted', 'Approved', 'Completed'].includes(attendanceSessions.find(s => s.id === activeDraftSessionId)?.status || '')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-success-200 bg-success-50 px-3 py-1.5 text-xs font-semibold text-success-600 hover:bg-success-100 dark:border-success-900/40 dark:bg-success-500/10 dark:text-success-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-3.5 h-3.5" />
                <span>All Tasks Done</span>
              </button>
              <button
                type="button"
                onClick={() => markAllTasks('Not Completed')}
                disabled={['Submitted', 'Approved', 'Completed'].includes(attendanceSessions.find(s => s.id === activeDraftSessionId)?.status || '')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Reset Tasks</span>
              </button>
            </div>
          </div>

          {/* 4. Student Attendance Roster (Cardless list) */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <span>
                Student Roster ({filteredStudents.length} Enrolled)
              </span>
              <span className="text-[11px] lowercase font-normal">Attendance &amp; Task status</span>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-xs">
                No students found in this selection.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredStudents.map((st) => {
                  const record = recordsMap[st.id] || {
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

                  const isPresent = record.status === 'Present';
                  const isAbsent = record.status === 'Absent';
                  const isTaskCompleted = record.taskStatus === 'Completed';

                  return (
                    <div
                      key={st.id}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isAbsent ? 'bg-error-50/20 dark:bg-error-950/10' : 'hover:bg-gray-50/80 dark:hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* Student Info */}
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center font-bold text-xs shrink-0 dark:bg-brand-500/10 dark:text-brand-400"
                        >
                          {st.avatarLetter || st.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-gray-900 dark:text-white">{st.name}</h4>
                            <span className="font-mono text-[10px] text-gray-400">
                              {st.code}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Std {st.standard} &middot; {st.villageName} &middot; Parent: {st.parentName || '—'}
                          </p>
                        </div>
                      </div>

                      {/* Attendance Toggle Buttons & Task Status */}
                      <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleAttendance(st.id, 'Present')}
                            disabled={['Submitted', 'Approved', 'Completed'].includes(attendanceSessions.find(s => s.id === activeDraftSessionId)?.status || '')}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                              isPresent
                                ? 'bg-success-500 text-white shadow-theme-xs'
                                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleAttendance(st.id, 'Absent')}
                            disabled={['Submitted', 'Approved', 'Completed'].includes(attendanceSessions.find(s => s.id === activeDraftSessionId)?.status || '')}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                              isAbsent
                                ? 'bg-error-500 text-white shadow-theme-xs'
                                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                          >
                            Absent
                          </button>
                        </div>

                        <div className="border-l border-gray-200 pl-3 dark:border-gray-800 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleTask(st.id, 'Completed')}
                            disabled={['Submitted', 'Approved', 'Completed'].includes(attendanceSessions.find(s => s.id === activeDraftSessionId)?.status || '')}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                              isTaskCompleted
                                ? 'bg-brand-500 text-white shadow-theme-xs'
                                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                          >
                            Task Done
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleTask(st.id, 'Not Completed')}
                            disabled={['Submitted', 'Approved', 'Completed'].includes(attendanceSessions.find(s => s.id === activeDraftSessionId)?.status || '')}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                              !isTaskCompleted
                                ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-white'
                                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                          >
                            Pending
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ACTION BUTTONS (SAVE DRAFT & SUBMIT) */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-900 dark:text-white">Day {selectedDay}:</span>{' '}
              {presentCount} Present &middot; {absentCount} Absent &middot; {tasksCompletedCount} Tasks Done
            </div>

            {!['Submitted', 'Approved', 'Completed'].includes(attendanceSessions.find(s => s.id === activeDraftSessionId)?.status || '') && (
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => handleSaveAttendanceSession(false)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 transition"
                >
                  Save as Draft
                </button>
                <ActionButton
                  onClick={() => handleSaveAttendanceSession(true)}
                  size="sm"
                  variant="primary"
                >
                  Submit Attendance &amp; Tasks
                </ActionButton>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SESSION HISTORY TAB */
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Past Recorded Attendance &amp; Task Sessions
            </h3>
            <span className="text-xs font-medium text-gray-400">
              {attendanceSessions.length} Sessions Logged
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="tqi-table-compact w-full text-left border-collapse">
              <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
                <tr>
                  <th className="px-5 py-3.5">Session &amp; Day</th>
                  <th className="px-5 py-3.5">Panchayat &amp; Village</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Attendance</th>
                  <th className="px-5 py-3.5">Tasks Done</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                {attendanceSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 font-bold text-gray-900 dark:text-white">
                      {session.day || `Day ${session.dayNumber}`}
                      <span className="block text-[11px] font-normal text-gray-400">
                        {session.sessionName}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 dark:text-gray-300">
                      <span className="font-semibold text-gray-900 dark:text-white">{session.panchayatName}</span>
                      <span className="block text-[11px] text-gray-400">
                        {session.villageName}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 font-mono">{session.date}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-success-500">{session.presentCount || 0}</span> /{' '}
                      <span className="text-gray-500">{session.totalCount || session.records.length}</span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-warning-500">
                      {session.tasksCompletedCount ??
                        session.records.filter((r) => r.taskStatus === 'Completed').length}{' '}
                      / {session.records.length}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge
                        color={
                          session.status === 'Submitted'
                            ? 'success'
                            : session.status === 'Correction Requested'
                            ? 'error'
                            : 'primary'
                        }
                        size="sm"
                      >
                        {session.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
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
                        className="text-xs font-bold text-brand-500 hover:text-brand-600 transition"
                      >
                        {session.status === 'Draft' || session.status === 'Correction Requested'
                          ? 'Continue Entry →'
                          : 'View / Edit →'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
