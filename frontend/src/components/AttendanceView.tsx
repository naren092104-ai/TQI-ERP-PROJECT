import React, { useState, useMemo, useEffect } from 'react';
import { AttendanceSession, Student, Panchayat, TabType, AttendanceRecord } from '../types';

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
    panchayats[0]?.id || 'vedakkattamaduvu'
  );
  const [selectedVillageId, setSelectedVillageId] = useState<string>('all');
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
          // If marked absent, auto-set task to Not Completed unless user overrides
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
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <div className="text-[11px] text-[#434652] mb-0.5 font-medium">
            Dharmapuri &gt; <span className="text-[#002869] font-bold">Attendance &amp; Tasks</span>
          </div>
          <h1 className="text-[20px] font-bold text-[#002869] tracking-tight">
            Attendance &amp; Task Entry
          </h1>
          <p className="text-[12px] text-[#434652]">
            Step 1: Select Panchayat → Step 2: Select Village → Step 3: Mark Round Present/Absent &amp; Task Status.
          </p>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('mark')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'mark'
                ? 'bg-[#002869] text-white shadow-xs'
                : 'bg-white border border-[#c4c6d3] text-[#434652] hover:bg-[#f4f3fb]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
            Mark Attendance &amp; Tasks
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-[#002869] text-white shadow-xs'
                : 'bg-white border border-[#c4c6d3] text-[#434652] hover:bg-[#f4f3fb]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">history_edu</span>
            Session History ({attendanceSessions.length})
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3 bg-[#e6f4ea] border border-[#137333]/30 rounded-md text-[#137333] text-[12px] font-bold flex items-center gap-2 animate-[fadeIn_0.2s_ease-out]">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {saveSuccessMsg}
        </div>
      )}

      {activeTab === 'mark' ? (
        <div className="space-y-4">
          {/* STEP 1 & STEP 2 & STEP 3 FLOW BAR */}
          <div className="bg-white rounded-md border border-[#c4c6d3]/70 p-3.5 shadow-xs space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* STEP 1: 1ST PANCHAYAT SELECTION */}
              <div className="bg-[#f4f3fb] p-2.5 rounded-md border border-[#c4c6d3]/60 relative">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-4 h-4 rounded-full bg-[#002869] text-white text-[10px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <label className="text-[11px] font-bold text-[#002869] uppercase tracking-wider">
                    Select Panchayat *
                  </label>
                </div>
                <select
                  value={selectedPanchayatId}
                  onChange={(e) => handlePanchayatChange(e.target.value)}
                  className="w-full bg-white border border-[#002869]/30 rounded-md px-2.5 py-1 text-[12.5px] font-bold text-[#002869] focus:outline-none focus: focus:ring-[#002869]/20 cursor-pointer h-[34px]"
                >
                  {panchayats.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} Panchayat ({p.activeStudents} students)
                    </option>
                  ))}
                </select>
              </div>

              {/* STEP 2: NEXT VILLAGE SELECTION */}
              <div className="bg-[#f4f3fb] p-2.5 rounded-md border border-[#c4c6d3]/60 relative">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-4 h-4 rounded-full bg-[#fb7800] text-[#592600] text-[10px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <label className="text-[11px] font-bold text-[#592600] uppercase tracking-wider">
                    Select Village / Center *
                  </label>
                </div>
                <select
                  value={selectedVillageId}
                  onChange={(e) => setSelectedVillageId(e.target.value)}
                  className="w-full bg-white border border-[#fb7800]/40 rounded-md px-2.5 py-1 text-[12.5px] font-bold text-[#1a1b21] focus:outline-none focus: focus:ring-[#fb7800]/20 cursor-pointer h-[34px]"
                >
                  <option value="all">All Villages in {currentPanchayat?.name || 'Cluster'}</option>
                  {availableVillages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.studentCount} students)
                    </option>
                  ))}
                </select>
              </div>

              {/* STEP 3: SESSION DATE & DAY */}
              <div className="bg-[#f4f3fb] p-2.5 rounded-md border border-[#c4c6d3]/60 relative">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-4 h-4 rounded-full bg-[#137333] text-white text-[10px] font-bold flex items-center justify-center">
                    3
                  </span>
                  <label className="text-[11px] font-bold text-[#137333] uppercase tracking-wider">
                    Session Date &amp; Day
                  </label>
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="flex-1 bg-white border border-[#c4c6d3] rounded-md px-2.5 py-1 text-[12px] font-semibold text-[#1a1b21] focus:outline-none h-[34px]"
                  />
                  <select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(parseInt(e.target.value) || 1)}
                    className="w-24 bg-white border border-[#c4c6d3] rounded-md px-2 py-1 text-[12px] font-bold text-[#002869] focus:outline-none h-[34px]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((d) => (
                      <option key={d} value={d}>
                        Day {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Task / Activity Topic setup */}
            <div className="pt-2 border-t border-[#c4c6d3]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="flex-1 w-full flex items-center gap-2">
                <span className="material-symbols-outlined text-[17px] text-[#fb7800]">
                  assignment
                </span>
                <span className="text-[11px] font-bold text-[#434652] uppercase whitespace-nowrap">
                  Today's Task / Topic:
                </span>
                <input
                  type="text"
                  placeholder="e.g., Phonics Worksheet & Speaking Practice"
                  value={taskTopic}
                  onChange={(e) => setTaskTopic(e.target.value)}
                  className="flex-1 bg-[#f4f3fb] border border-[#c4c6d3] rounded-md px-2.5 py-1 text-[12px] font-medium text-[#1a1b21] focus:outline-none focus:border-[#002869] h-[32px]"
                />
              </div>

              {/* Day Quick Selectors */}
              <div className="flex items-center gap-1 overflow-x-auto self-end sm:self-center">
                {[1, 2, 3, 4, 5, 6].map((day) => (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      selectedDay === day
                        ? 'bg-[#002869] text-white shadow-xs'
                        : 'bg-[#f4f3fb] text-[#434652] hover:bg-[#e8e7ef]'
                    }`}
                  >
                    Day {day}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SUMMARY BENTO CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-[#c4c6d3]/60 rounded-md p-3 shadow-xs">
              <div className="text-[10px] font-bold text-[#434652] uppercase tracking-wider">
                Total Enrolled
              </div>
              <div className="text-[18px] font-bold text-[#002869] mt-0.5">
                {filteredStudents.length} Students
              </div>
              <p className="text-[10.5px] text-[#434652] mt-0.5 truncate">
                {currentPanchayat?.name || 'Panchayat'} • {selectedVillageName}
              </p>
            </div>

            <div className="bg-white border border-[#c4c6d3]/60 rounded-md p-3 shadow-xs">
              <div className="text-[10px] font-bold text-[#137333] uppercase tracking-wider flex items-center justify-between">
                <span>Present</span>
                <span className="w-2 h-2 rounded-full bg-[#137333]"></span>
              </div>
              <div className="text-[18px] font-bold text-[#137333] mt-0.5">{presentCount}</div>
              <p className="text-[10.5px] text-[#137333] font-semibold mt-0.5">
                {filteredStudents.length > 0
                  ? `${Math.round((presentCount / filteredStudents.length) * 100)}% Attendance`
                  : '0%'}
              </p>
            </div>

            <div className="bg-white border border-[#c4c6d3]/60 rounded-md p-3 shadow-xs">
              <div className="text-[10px] font-bold text-[#ba1a1a] uppercase tracking-wider flex items-center justify-between">
                <span>Absent</span>
                <span className="w-2 h-2 rounded-full bg-[#ba1a1a]"></span>
              </div>
              <div className="text-[18px] font-bold text-[#ba1a1a] mt-0.5">{absentCount}</div>
              <p className="text-[10.5px] text-[#ba1a1a] font-semibold mt-0.5">
                {filteredStudents.length > 0
                  ? `${Math.round((absentCount / filteredStudents.length) * 100)}% Absent`
                  : '0%'}
              </p>
            </div>

            <div className="bg-white border border-[#c4c6d3]/60 rounded-md p-3 shadow-xs">
              <div className="text-[10px] font-bold text-[#fb7800] uppercase tracking-wider flex items-center justify-between">
                <span>Tasks Completed</span>
                <span className="w-2 h-2 rounded-full bg-[#fb7800]"></span>
              </div>
              <div className="text-[18px] font-bold text-[#fb7800] mt-0.5">{tasksCompletedCount}</div>
              <p className="text-[10.5px] text-[#fb7800] font-semibold mt-0.5">
                {filteredStudents.length > 0
                  ? `${Math.round((tasksCompletedCount / filteredStudents.length) * 100)}% Tasks Done`
                  : '0%'}
              </p>
            </div>
          </div>

          {/* BATCH QUICK ACTIONS TOOLBAR */}
          <div className="bg-[#f4f3fb] border border-[#c4c6d3]/60 rounded-md p-2.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#434652] uppercase">
                Attendance Batch:
              </span>
              <button
                onClick={() => markAllAttendance('Present')}
                className="px-2.5 py-1 bg-[#e6f4ea] text-[#137333] border border-[#137333]/40 rounded-full text-[11px] font-bold hover:bg-[#cbf0d7] transition-all cursor-pointer flex items-center gap-1"
              >
                <span className="w-3.5 h-3.5 rounded-full bg-[#137333] text-white flex items-center justify-center text-[9px]">
                  ✓
                </span>
                All Present
              </button>
              <button
                onClick={() => markAllAttendance('Absent')}
                className="px-2.5 py-1 bg-[#ffdad6] text-[#ba1a1a] border border-[#ba1a1a]/40 rounded-full text-[11px] font-bold hover:bg-[#ffc6c1] transition-all cursor-pointer flex items-center gap-1"
              >
                <span className="w-3.5 h-3.5 rounded-full bg-[#ba1a1a] text-white flex items-center justify-center text-[9px]">
                  ✕
                </span>
                All Absent
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#434652] uppercase">
                Task Batch:
              </span>
              <button
                onClick={() => markAllTasks('Completed')}
                className="px-2.5 py-1 bg-[#e6f4ea] text-[#137333] border border-[#137333]/40 rounded-md text-[11px] font-bold hover:bg-[#cbf0d7] transition-all cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">task_alt</span>
                All Tasks Completed
              </button>
              <button
                onClick={() => markAllTasks('Not Completed')}
                className="px-2.5 py-1 bg-white border border-[#c4c6d3] text-[#434652] rounded-md text-[11px] font-bold hover:bg-[#faf8ff] transition-all cursor-pointer"
              >
                Reset Tasks
              </button>
            </div>
          </div>

          {/* STUDENT ROSTER LIST WITH ROUND PRESENT/ABSENT & TASK STATUS */}
          <div className="bg-white rounded-md border border-[#c4c6d3]/70 shadow-xs overflow-hidden">
            <div className="px-4 py-2.5 bg-[#f4f3fb] border-b border-[#c4c6d3] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] font-bold text-[#434652] uppercase">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#002869]">
                  groups
                </span>
                <span>
                  Student Roster ({filteredStudents.length} Enrolled in {currentPanchayat?.name || 'Panchayat'} - {selectedVillageName})
                </span>
              </div>
              <div className="flex items-center gap-6 text-[10.5px]">
                <span className="text-[#002869]">1. Attendance (P / A)</span>
                <span className="text-[#fb7800]">2. Task Status (Completed / Not Completed)</span>
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="p-8 text-center text-[#434652] space-y-1.5">
                <span className="material-symbols-outlined text-[32px] text-[#747783]">
                  person_off
                </span>
                <h3 className="text-[14px] font-bold text-[#1a1b21]">
                  No students found in this Village
                </h3>
                <p className="text-[12px]">
                  Try selecting "All Villages" or switch Panchayat above.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#c4c6d3]/40">
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
                      className={`p-3 sm:px-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition-colors ${
                        isAbsent ? 'bg-[#ffdad6]/20' : 'hover:bg-[#faf8ff]'
                      }`}
                    >
                      {/* Student Info */}
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px] shadow-xs shrink-0 ${
                            st.avatarBg || 'bg-[#002869] text-white'
                          }`}
                        >
                          {st.avatarLetter || st.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-[13px] font-bold text-[#002869]">{st.name}</h4>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-[#f4f3fb] border border-[#c4c6d3]/60 rounded text-[#434652]">
                              {st.code}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#434652] mt-0.5">
                            Standard {st.standard}th • {st.villageName} • Parent: {st.parentName}
                          </p>
                        </div>
                      </div>

                      {/* Right Controls: Round Attendance Buttons + Task Completed/Not Completed */}
                      <div className="flex flex-wrap items-center gap-4 self-start lg:self-center">
                        {/* ROUND PRESENT / ABSENT BUTTONS */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10.5px] font-bold uppercase text-[#747783] hidden sm:inline">
                            Attendance:
                          </span>

                          {/* Round PRESENT Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleAttendance(st.id, 'Present')}
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-[12px] transition-all cursor-pointer active:scale-95 ${
                              isPresent
                                ? 'bg-[#137333] text-white shadow-xs  ring-[#137333]/30 scale-105'
                                : 'bg-[#f4f3fb] text-[#434652] border border-[#c4c6d3] hover:border-[#137333] hover:text-[#137333]'
                            }`}
                            title="Mark Present"
                          >
                            {isPresent ? (
                              <span className="material-symbols-outlined text-[15px]">check</span>
                            ) : (
                              'P'
                            )}
                          </button>

                          {/* Round ABSENT Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleAttendance(st.id, 'Absent')}
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-[12px] transition-all cursor-pointer active:scale-95 ${
                              isAbsent
                                ? 'bg-[#ba1a1a] text-white shadow-xs  ring-[#ba1a1a]/30 scale-105'
                                : 'bg-[#f4f3fb] text-[#434652] border border-[#c4c6d3] hover:border-[#ba1a1a] hover:text-[#ba1a1a]'
                            }`}
                            title="Mark Absent"
                          >
                            {isAbsent ? (
                              <span className="material-symbols-outlined text-[15px]">close</span>
                            ) : (
                              'A'
                            )}
                          </button>
                        </div>

                        {/* TASK COMPLETED / NOT COMPLETED BUTTONS */}
                        <div className="flex items-center gap-1.5 pl-2 sm:border-l sm:border-[#c4c6d3]/60">
                          <span className="text-[10.5px] font-bold uppercase text-[#747783] hidden sm:inline">
                            Task:
                          </span>

                          <button
                            type="button"
                            onClick={() => handleToggleTask(st.id, 'Completed')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
                              isTaskCompleted
                                ? 'bg-[#137333] text-white shadow-xs  ring-[#137333]/20'
                                : 'bg-[#f4f3fb] text-[#434652] hover:bg-[#e8e7ef] border border-[#c4c6d3]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {isTaskCompleted ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                            Completed
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleTask(st.id, 'Not Completed')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
                              !isTaskCompleted
                                ? 'bg-[#ba1a1a] text-white shadow-xs  ring-[#ba1a1a]/20'
                                : 'bg-[#f4f3fb] text-[#434652] hover:bg-[#e8e7ef] border border-[#c4c6d3]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {!isTaskCompleted ? 'cancel' : 'radio_button_unchecked'}
                            </span>
                            Not Completed
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
          <div className="bg-white p-3.5 sm:px-4 rounded-md border border-[#c4c6d3]/70 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[12px] text-[#434652]">
              <span className="font-bold text-[#002869]">
                Day {selectedDay} Session Summary:
              </span>{' '}
              {presentCount} Present • {absentCount} Absent • {tasksCompletedCount} Tasks Completed
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => handleSaveAttendanceSession(false)}
                className="px-3.5 py-1.5 border border-[#002869] text-[#002869] font-bold text-[12px] rounded-md hover:bg-[#f4f3fb] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleSaveAttendanceSession(true)}
                className="px-4 py-1.5 bg-[#002869] text-white font-bold text-[12px] rounded-md hover:bg-[#002869]/90 active:scale-95 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                Submit Attendance &amp; Tasks
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* SESSION HISTORY TAB */
        <div className="bg-white rounded-md border border-[#c4c6d3]/60 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-[#f4f3fb] border-b border-[#c4c6d3] flex justify-between items-center">
            <h3 className="text-[14px] font-bold text-[#002869]">
              Past Recorded Attendance &amp; Task Sessions
            </h3>
            <span className="text-[11px] font-semibold text-[#434652]">
              {attendanceSessions.length} Sessions Logged
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-[#f4f3fb]/60 text-[10.5px] font-bold text-[#434652] uppercase tracking-wider border-b border-[#c4c6d3]">
                <tr>
                  <th className="p-3 pl-4">Session &amp; Day</th>
                  <th className="p-3">Panchayat &amp; Village</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Attendance (P / Total)</th>
                  <th className="p-3">Tasks Completed</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-[12px] divide-y divide-[#c4c6d3]/40">
                {attendanceSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-[#faf8ff] transition-colors">
                    <td className="p-3 pl-4 font-bold text-[#002869]">
                      {session.day || `Day ${session.dayNumber}`}
                      <span className="block text-[10.5px] font-normal text-[#434652]">
                        {session.sessionName}
                      </span>
                    </td>
                    <td className="p-3 text-[#1a1b21]">
                      <span className="font-semibold">{session.panchayatName}</span>
                      <span className="block text-[10.5px] text-[#747783]">
                        {session.villageName}
                      </span>
                    </td>
                    <td className="p-3 text-[#434652]">{session.date}</td>
                    <td className="p-3">
                      <span className="font-bold text-[#137333]">{session.presentCount || 0}</span> /{' '}
                      <span>{session.totalCount || session.records.length}</span> (
                      {Math.round(
                        ((session.presentCount || 0) /
                          (session.totalCount || session.records.length || 1)) *
                          100
                      )}
                      %)
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-[#fb7800]">
                        {session.tasksCompletedCount ??
                          session.records.filter((r) => r.taskStatus === 'Completed').length}
                      </span>{' '}
                      / {session.records.length}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold ${
                          session.status === 'Submitted'
                            ? 'bg-[#e6f4ea] text-[#137333]'
                            : session.status === 'Correction Requested'
                            ? 'bg-[#ffdad6] text-[#ba1a1a]'
                            : 'bg-[#dae2ff] text-[#001947]'
                        }`}
                      >
                        {session.status}
                      </span>
                    </td>
                    <td className="p-3 pr-4 text-right">
                      <button
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
                        className="text-[#002869] font-bold hover:underline cursor-pointer"
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


