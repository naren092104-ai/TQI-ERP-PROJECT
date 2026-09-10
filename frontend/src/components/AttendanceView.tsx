import React, { useState, useMemo, useEffect } from 'react';
import {
  AttendanceSession, Student, Panchayat, Cluster, TabType, AttendanceRecord,
} from '../types';
import { Check, X, Calendar, MapPin, CheckCircle2, ChevronRight, ArrowLeft, Users, Plus } from './ui/icons';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { ActionButton } from './ui/action-button';

interface AttendanceViewProps {
  attendanceSessions: AttendanceSession[];
  students: Student[];
  panchayats: Panchayat[];
  clusters?: Cluster[];
  userRole?: string;
  draftId?: string;
  onNavigate: (tab: TabType, targetId?: string, secondaryParam?: string) => void;
  onSaveAttendance: (session: AttendanceSession) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  attendanceSessions,
  students,
  panchayats,
  clusters = [],
  userRole = 'Cluster Admin',
  onNavigate,
  onSaveAttendance,
}) => {
  const isSuperAdmin = userRole === 'Super Admin';

  // Super Admin drills down: Cluster → Panchayat → Village
  // Cluster Admin starts at Panchayat
  const [selectedClusterId, setSelectedClusterId] = useState<string>(
    isSuperAdmin ? (clusters[0]?.id || 'all') : 'my-cluster'
  );
  const [selectedPanchayatId, setSelectedPanchayatId] = useState<string>('');
  const [selectedVillageId, setSelectedVillageId] = useState<string>('all');

  // Available panchayats filtered by cluster (Super Admin) or shown all (Cluster Admin)
  const availablePanchayats = useMemo(() => {
    if (!isSuperAdmin) return panchayats;
    if (selectedClusterId === 'all') return panchayats;
    return panchayats.filter((p) => {
      const cid = (p as any).clusterId || p.cluster;
      return !cid || cid === selectedClusterId;
    });
  }, [panchayats, selectedClusterId, isSuperAdmin]);

  // Initialise panchayat when available list changes
  useEffect(() => {
    if (availablePanchayats.length > 0 && !availablePanchayats.some((p) => p.id === selectedPanchayatId)) {
      setSelectedPanchayatId(availablePanchayats[0].id);
    }
  }, [availablePanchayats, selectedPanchayatId]);

  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [sessionTitle, setSessionTitle] = useState<string>('Day 1 Session');
  const [taskTopic, setTaskTopic] = useState<string>('Worksheet & Activity');
  const [recordsMap, setRecordsMap] = useState<Record<string, AttendanceRecord>>({});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const currentPanchayat = useMemo(
    () => availablePanchayats.find((p) => p.id === selectedPanchayatId) || availablePanchayats[0],
    [availablePanchayats, selectedPanchayatId]
  );
  const availableVillages = currentPanchayat?.villages || [];

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchPanchayat = s.panchayatId === selectedPanchayatId;
      const matchVillage = selectedVillageId === 'all' || s.villageId === selectedVillageId;
      return matchPanchayat && matchVillage;
    });
  }, [students, selectedPanchayatId, selectedVillageId]);

  // Re-seed records when the student set changes
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

  const handleToggleAttendance = (studentId: string, status: 'Present' | 'Absent') => {
    setRecordsMap((prev) => {
      const current = prev[studentId] || {
        studentId, studentName: '', code: '', standard: '', villageName: '',
        status: 'Present', taskStatus: 'Completed',
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
    setRecordsMap((prev) => {
      const current = prev[studentId] || {
        studentId, studentName: '', code: '', standard: '', villageName: '',
        status: 'Present', taskStatus: 'Completed',
      };
      return { ...prev, [studentId]: { ...current, taskStatus } };
    });
  };

  const markAll = (kind: 'attendance' | 'task', value: 'Present' | 'Absent' | 'Completed' | 'Not Completed') => {
    setRecordsMap((prev) => {
      const updated = { ...prev };
      filteredStudents.forEach((st) => {
        const existing = updated[st.id] || {
          studentId: st.id, studentName: st.name, code: st.code, standard: st.standard,
          villageName: st.villageName, status: 'Present', taskStatus: 'Completed',
        };
        if (kind === 'attendance') {
          updated[st.id] = {
            ...existing,
            status: value as any,
            taskStatus: value === 'Absent' ? 'Not Completed' : existing.taskStatus || 'Completed',
          };
        } else {
          updated[st.id] = { ...existing, taskStatus: value as any };
        }
      });
      return updated;
    });
  };

  const currentRecordsList: AttendanceRecord[] = useMemo(
    () => filteredStudents.map((st) =>
      recordsMap[st.id] || {
        studentId: st.id, studentName: st.name, code: st.code, standard: st.standard,
        villageName: st.villageName, status: 'Present' as const, taskStatus: 'Completed' as const,
        taskTitle: taskTopic, remarks: '',
      }
    ),
    [filteredStudents, recordsMap, taskTopic]
  );

  const presentCount = currentRecordsList.filter((r) => r.status === 'Present' || r.status === 'Late').length;
  const absentCount  = currentRecordsList.filter((r) => r.status === 'Absent').length;
  const tasksDone    = currentRecordsList.filter((r) => r.taskStatus === 'Completed').length;

  const selectedVillageName =
    selectedVillageId === 'all'
      ? 'All Villages'
      : availableVillages.find((v) => v.id === selectedVillageId)?.name || 'Village';

  const handleSave = (isFinal: boolean) => {
    if (filteredStudents.length === 0) {
      setSaveSuccessMsg('No students in this selection. Add students first.');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
      return;
    }
    const newSession: AttendanceSession = {
      id: `att-${Date.now()}`,
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
      tasksCompletedCount: tasksDone,
      status: isFinal ? 'Submitted' : 'Draft',
      lastSaved: isFinal ? 'Submitted just now' : 'Saved just now',
      records: currentRecordsList,
    };
    onSaveAttendance(newSession);
    setSaveSuccessMsg(isFinal ? `Submitted Day ${selectedDay} attendance.` : `Saved Day ${selectedDay} draft.`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // ─── Super Admin: cluster landing ────────────────────────────────────────
  if (isSuperAdmin && clusters.length > 0 && selectedClusterId === '__select__') {
    return (
      <div className="w-full space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Attendance</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Choose a cluster to view its attendance records.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clusters.map((cluster) => {
            const clusterPanchayats = panchayats.filter((p) => {
              const cid = (p as any).clusterId || p.cluster;
              return !cid || cid === cluster.id;
            });
            const totalStudents = clusterPanchayats.reduce((acc, p) => acc + (p.activeStudents || 0), 0);
            return (
              <button
                key={cluster.id}
                type="button"
                onClick={() => {
                  setSelectedClusterId(cluster.id);
                  setSelectedPanchayatId('');
                }}
                className="group rounded-xl border border-gray-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_4px_24px_-12px_rgba(0,0,0,0.08)] dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-brand-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate group-hover:text-brand-600">
                      {cluster.collegeName || cluster.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {cluster.district}, Tamil Nadu
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
                </div>
                <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    <span>{clusterPanchayats.length} panchayats</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                    <Users className="h-3.5 w-3.5 text-gray-400" />
                    <span>{totalStudents} students</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Main attendance marking view ────────────────────────────────────────
  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            {isSuperAdmin && clusters.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedClusterId('__select__')}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
                aria-label="Back to clusters"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Attendance
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {currentPanchayat?.name || 'Panchayat'} · {selectedVillageName}
          </p>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-2.5 text-xs text-success-700 dark:border-success-900/40 dark:bg-success-500/10 dark:text-success-300">
          {saveSuccessMsg}
        </div>
      )}

      {/* Empty state: no students in selection */}
      {filteredStudents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center dark:border-gray-800 dark:bg-white/[0.02]">
          <Users className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-3 text-sm font-semibold text-gray-800 dark:text-white">No students in this panchayat yet</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Add students to {currentPanchayat?.name || 'this panchayat'} before marking attendance.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('students', currentPanchayat?.id, undefined)}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-medium text-white hover:bg-brand-600 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Add students
          </button>
        </div>
      ) : (
        <>
          {/* Slim step bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Panchayat</label>
              <Select
                value={selectedPanchayatId}
                onValueChange={(val) => {
                  setSelectedPanchayatId(val);
                  const panch = availablePanchayats.find((p) => p.id === val);
                  setSelectedVillageId(panch?.villages?.[0]?.id || 'all');
                }}
              >
                <SelectTrigger className="w-full rounded-lg border-gray-300 px-3.5 py-2.5 text-xs text-gray-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                  <SelectValue placeholder="Select panchayat" />
                </SelectTrigger>
                <SelectContent>
                  {availablePanchayats.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Village</label>
              <Select value={selectedVillageId} onValueChange={setSelectedVillageId}>
                <SelectTrigger className="w-full rounded-lg border-gray-300 px-3.5 py-2.5 text-xs text-gray-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                  <SelectValue placeholder="All villages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Villages</SelectItem>
                  {availableVillages.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Day</label>
              <Select value={String(selectedDay)} onValueChange={(v) => setSelectedDay(Number(v) || 1)}>
                <SelectTrigger className="w-full rounded-lg border-gray-300 px-3.5 py-2.5 text-xs text-gray-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                  <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((d) => (
                    <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Topic + quick batch */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="text"
              placeholder="Today's topic"
              value={taskTopic}
              onChange={(e) => setTaskTopic(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => markAll('attendance', 'Present')} className="rounded-md border border-success-200 bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700 hover:bg-success-100 dark:border-success-900/40 dark:bg-success-500/10 dark:text-success-300">
                <Check className="inline h-3 w-3" /> All present
              </button>
              <button type="button" onClick={() => markAll('attendance', 'Absent')} className="rounded-md border border-error-200 bg-error-50 px-2.5 py-1 text-xs font-medium text-error-700 hover:bg-error-100 dark:border-error-900/40 dark:bg-error-500/10 dark:text-error-300">
                <X className="inline h-3 w-3" /> All absent
              </button>
              <button type="button" onClick={() => markAll('task', 'Completed')} className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Tasks done
              </button>
              <button type="button" onClick={() => markAll('task', 'Not Completed')} className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Tasks pending
              </button>
            </div>
          </div>

          {/* Single-row stats */}
          <div className="grid grid-cols-4 divide-x divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="px-4 py-3 text-center">
              <div className="text-base font-semibold tabular-nums text-gray-900 dark:text-white">{filteredStudents.length}</div>
              <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Enrolled</div>
            </div>
            <div className="px-4 py-3 text-center">
              <div className="text-base font-semibold tabular-nums text-success-600 dark:text-success-400">{presentCount}</div>
              <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Present</div>
            </div>
            <div className="px-4 py-3 text-center">
              <div className="text-base font-semibold tabular-nums text-error-600 dark:text-error-400">{absentCount}</div>
              <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Absent</div>
            </div>
            <div className="px-4 py-3 text-center">
              <div className="text-base font-semibold tabular-nums text-brand-600 dark:text-brand-400">{tasksDone}</div>
              <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Tasks done</div>
            </div>
          </div>

          {/* Student list */}
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Student Roster · Day {selectedDay}
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredStudents.map((st) => {
                const record = recordsMap[st.id] || {
                  studentId: st.id, studentName: st.name, code: st.code, standard: st.standard,
                  villageName: st.villageName, status: 'Present' as const, taskStatus: 'Completed' as const,
                };
                const isPresent = record.status === 'Present';
                const isAbsent  = record.status === 'Absent';
                const isTaskDone = record.taskStatus === 'Completed';
                return (
                  <div
                    key={st.id}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 transition-colors ${
                      isAbsent ? 'bg-error-50/30 dark:bg-error-950/10' : 'hover:bg-gray-50/60 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                        {st.avatarLetter || st.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-semibold text-gray-900 dark:text-white">{st.name}</span>
                          <span className="font-mono text-[10px] text-gray-400">{st.code}</span>
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          Std {st.standard} · {st.villageName}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleAttendance(st.id, 'Present')}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                          isPresent
                            ? 'bg-success-500 text-white'
                            : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        Present
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleAttendance(st.id, 'Absent')}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                          isAbsent
                            ? 'bg-error-500 text-white'
                            : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        Absent
                      </button>
                      <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
                      <button
                        type="button"
                        onClick={() => handleToggleTask(st.id, 'Completed')}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                          isTaskDone
                            ? 'bg-brand-500 text-white'
                            : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleTask(st.id, 'Not Completed')}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                          !isTaskDone
                            ? 'bg-gray-700 text-white'
                            : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        Pending
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action footer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleSave(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 transition"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600 transition"
            >
              Submit attendance
            </button>
          </div>
        </>
      )}
    </div>
  );
};
