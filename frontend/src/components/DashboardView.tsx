import React, { useState, useEffect } from 'react';
import { 
  Users, 
  GraduationCap, 
  CalendarCheck, 
  ReceiptIndianRupee, 
  ShieldAlert, 
  MapPin, 
  Plus, 
  CheckCircle2, 
  ArrowRight, 
  ChevronRight, 
  Search, 
  BookOpen, 
  Clock, 
  ExternalLink,
  Calendar,
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Layers
} from 'lucide-react';
import { TabType, Panchayat, AttendanceSession, Cluster, ApprovalItem, UserRole, FinanceEntry, Session, Student, Volunteer } from '../types';
import { apiUrl } from '../utils/api';
import Badge from './ui/badge';
import ComponentCard from './ui/ComponentCard';
import { Table, TableBody, TableCell, TableHeader, TableRow } from './ui/table';

interface DashboardViewProps {
  onNavigate: (tab: TabType, targetId?: string) => void;
  onOpenNewSession: () => void;
  onOpenNewFinance: () => void;
  onOpenNewAttendance: () => void;
  panchayats: Panchayat[];
  studentsCount: number;
  volunteersCount: number;
  sessionsCount: number;
  pendingCount: number;
  attendanceDrafts: AttendanceSession[];
  userRole?: UserRole;
  clusters?: Cluster[];
  approvals?: ApprovalItem[];
  clusterName?: string;
  financeEntries?: FinanceEntry[];
  sessions?: Session[];
  students?: Student[];
  volunteers?: Volunteer[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenNewSession,
  onOpenNewFinance,
  onOpenNewAttendance,
  panchayats = [],
  studentsCount = 0,
  volunteersCount = 0,
  sessionsCount = 0,
  pendingCount = 0,
  attendanceDrafts = [],
  userRole = 'Cluster Admin',
  clusters = [],
  approvals = [],
  clusterName = 'Dharmapuri Cluster',
  financeEntries = [],
  sessions = [],
  students = [],
  volunteers = [],
}) => {
  const [panchayatSearch, setPanchayatSearch] = useState('');
  const [setupDays, setSetupDays] = useState<{ dayNumber: number; sessionName: string }[]>([]);
  const isSuperAdmin = userRole === 'Super Admin';
  const pendingApprovals = approvals.filter((a) => a.status === 'Pending');
  
  // Total dynamic villages
  const totalVillages = panchayats.reduce((sum, p) => sum + (p.villages?.length || p.villagesCount || 0), 0);
  
  // Total dynamic expenses calculated from verified entries
  const totalExpenses = financeEntries.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

  // Dynamic unique colleges count
  const uniqueColleges = Array.from(new Set(volunteers.map((v) => v.college).filter(Boolean)));
  const collegesText = uniqueColleges.length > 0 
    ? `${uniqueColleges.length} Partner College${uniqueColleges.length > 1 ? 's' : ''}` 
    : 'No colleges mapped';

  // Load custom academic day names dynamically if configured
  useEffect(() => {
    fetch(apiUrl('/api/academic-setup'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.setup)) {
          setSetupDays(data.setup.map((s: { day_number: number; session_name: string }) => ({
            dayNumber: s.day_number,
            sessionName: s.session_name,
          })));
        }
      })
      .catch(() => {});
  }, []);

  const defaultSuggestedNames: Record<number, { name: string; month: string; topic: string }> = {
    1: { name: 'Spoken English & Goal Setting', month: 'Feb', topic: 'Communication' },
    2: { name: 'Basic Arithmetic & Logic Puzzles', month: 'Feb', topic: 'Quantitative Aptitude' },
    3: { name: 'Hands-on Science Observation', month: 'Mar', topic: 'Applied Sciences' },
    4: { name: 'Life Skills, Health & Hygiene', month: 'Mar', topic: 'Wellness & Sanitation' },
    5: { name: 'Creative Arts & Expression', month: 'Mar', topic: 'Creative Arts' },
    6: { name: 'Digital Literacy Basics', month: 'Apr', topic: 'Technology' },
    7: { name: 'Environment & Community Action', month: 'Apr', topic: 'Civic Action' },
    8: { name: 'Culmination Showcase & Feedback', month: 'Apr', topic: 'Presentation' },
  };

  // Build dynamic 8-day status based on logged attendance
  const dynamicRoadmap = Array.from({ length: 8 }, (_, i) => {
    const dayNum = i + 1;
    const customConfig = setupDays.find((s) => s.dayNumber === dayNum);
    const meta = defaultSuggestedNames[dayNum];
    const sessionName = customConfig?.sessionName || meta.name;
    
    const hasCompletedAttendance = attendanceDrafts.some((a) => a.dayNumber === dayNum && a.status === 'Approved');
    const hasPendingAttendance = attendanceDrafts.some((a) => a.dayNumber === dayNum && a.status !== 'Approved');
    
    let status: 'Completed' | 'In Progress' | 'Scheduled' = 'Scheduled';
    if (hasCompletedAttendance) status = 'Completed';
    else if (hasPendingAttendance) status = 'In Progress';

    return {
      day: dayNum,
      title: sessionName,
      month: meta.month,
      topic: meta.topic,
      status,
    };
  });

  const completedDaysCount = dynamicRoadmap.filter((d) => d.status === 'Completed').length;
  const progressPercent = Math.round((completedDaysCount / 8) * 100);

  const filteredPanchayats = panchayats.filter((p) =>
    p.name.toLowerCase().includes(panchayatSearch.toLowerCase()) ||
    p.villages?.some((v) => v.name.toLowerCase().includes(panchayatSearch.toLowerCase()))
  );

  return (
    <div className="w-full space-y-6">
      {/* 1. TailAdmin Welcome Header Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Good day, {isSuperAdmin ? 'Super Administrator' : clusterName}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Overview of rural education operations, field mentorship, and 8-session cycle milestones.
            </p>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {pendingApprovals.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('approvals')}
                className="inline-flex items-center gap-2 rounded-xl border border-warning-200 bg-warning-50/70 px-3.5 py-2.5 text-xs font-semibold text-warning-700 hover:bg-warning-100 dark:border-warning-900/40 dark:bg-warning-500/10 dark:text-warning-400 transition"
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Pending Approvals</span>
                <span className="inline-flex items-center justify-center rounded-full bg-warning-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {pendingApprovals.length}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenNewAttendance}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Mark Attendance</span>
            </button>

            <button
              type="button"
              onClick={onOpenNewFinance}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5 transition"
            >
              <ReceiptIndianRupee className="h-4 w-4 text-brand-500" />
              <span>Record Expense</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. TailAdmin Ecommerce/ERP Metrics 4-Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
        {/* Metric 1: Enrolled Students */}
        <div
          onClick={() => onNavigate('students')}
          className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs transition hover:border-brand-300 dark:border-gray-800 dark:bg-white/[0.03] md:p-6"
        >
          <div className="flex items-center justify-center w-12 h-12 bg-brand-50 rounded-xl dark:bg-brand-500/10">
            <GraduationCap className="h-6 w-6 text-brand-500 dark:text-brand-400" />
          </div>
          <div className="flex items-end justify-between mt-5">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Enrolled Students</span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {studentsCount.toLocaleString('en-IN')}
              </h4>
            </div>
            <Badge color="success">
              <TrendingUp className="h-3.5 w-3.5" />
              Active
            </Badge>
          </div>
        </div>

        {/* Metric 2: Field Mentors */}
        <div
          onClick={() => onNavigate('volunteers')}
          className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs transition hover:border-blue-light-300 dark:border-gray-800 dark:bg-white/[0.03] md:p-6"
        >
          <div className="flex items-center justify-center w-12 h-12 bg-blue-light-50 rounded-xl dark:bg-blue-light-500/10">
            <Users className="h-6 w-6 text-blue-light-500" />
          </div>
          <div className="flex items-end justify-between mt-5">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Field Mentors</span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {volunteersCount.toLocaleString('en-IN')}
              </h4>
            </div>
            <Badge color="info">
              {uniqueColleges.length} Colleges
            </Badge>
          </div>
        </div>

        {/* Metric 3: Attendance Logs */}
        <div
          onClick={() => onNavigate('attendance')}
          className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs transition hover:border-success-300 dark:border-gray-800 dark:bg-white/[0.03] md:p-6"
        >
          <div className="flex items-center justify-center w-12 h-12 bg-success-50 rounded-xl dark:bg-success-500/10">
            <CalendarCheck className="h-6 w-6 text-success-500" />
          </div>
          <div className="flex items-end justify-between mt-5">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Attendance Logs</span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {(attendanceDrafts.length || sessionsCount).toLocaleString('en-IN')}
              </h4>
            </div>
            <Badge color="success">
              {completedDaysCount}/8 Days ({progressPercent}%)
            </Badge>
          </div>
        </div>

        {/* Metric 4: Cluster Expenses */}
        <div
          onClick={() => onNavigate('finance')}
          className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs transition hover:border-warning-300 dark:border-gray-800 dark:bg-white/[0.03] md:p-6"
        >
          <div className="flex items-center justify-center w-12 h-12 bg-warning-50 rounded-xl dark:bg-warning-500/10">
            <ReceiptIndianRupee className="h-6 w-6 text-warning-500" />
          </div>
          <div className="flex items-end justify-between mt-5">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Cluster Expenses</span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                &#8377;{totalExpenses.toLocaleString('en-IN')}
              </h4>
            </div>
            <Badge color="warning">
              {financeEntries.length} Bills
            </Badge>
          </div>
        </div>
      </div>

      {/* 3. Main Dashboard Bento Layout */}
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {/* Academic Curriculum Roadmap */}
        <div className="col-span-12 xl:col-span-8 rounded-2xl border border-gray-200 bg-white p-5 md:p-6 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-gray-100 dark:border-gray-800">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                  8-Day Academic Curriculum (Feb&ndash;Apr)
                </h3>
                <Badge color="primary" size="sm">
                  {progressPercent}% Delivered
                </Badge>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Structured milestone progression synchronised across village school centres.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate(isSuperAdmin ? 'academic-setup' : 'module-library')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5 transition self-start sm:self-auto"
            >
              <span>{isSuperAdmin ? 'Configure term' : 'Module library'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
              <span>Delivery Status</span>
              <span className="font-semibold text-gray-800 dark:text-white">{completedDaysCount} of 8 Sessions Completed</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* 8 Milestone Cards */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {dynamicRoadmap.map((item) => {
              const badgeVariant = item.status === 'Completed' ? 'success' : item.status === 'In Progress' ? 'primary' : 'light';
              return (
                <div
                  key={item.day}
                  onClick={() => onNavigate('attendance')}
                  className="group cursor-pointer rounded-xl border border-gray-200 bg-gray-50/50 p-4 hover:border-brand-300 hover:bg-brand-50/30 transition-all dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-brand-800 dark:hover:bg-brand-500/5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Day 0{item.day}
                    </span>
                    <span className="text-xs font-semibold text-brand-500 dark:text-brand-400">
                      {item.month}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-gray-800 group-hover:text-brand-500 dark:text-white dark:group-hover:text-brand-400 transition-colors line-clamp-1">
                    {item.title}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                    {item.topic}
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-gray-200/60 dark:border-gray-800 flex items-center justify-between">
                    <Badge color={badgeVariant as any} size="sm">
                      {item.status}
                    </Badge>
                    <span className="text-xs font-semibold text-gray-400 group-hover:text-brand-500 dark:text-gray-500 dark:group-hover:text-brand-400 transition-colors">
                      Logs &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Approvals Queue */}
        <div className="col-span-12 xl:col-span-4 rounded-2xl border border-gray-200 bg-white p-5 md:p-6 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                  Pending Approvals
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {pendingApprovals.length} entries requiring verification
                </p>
              </div>
              {pendingApprovals.length > 0 && (
                <Badge color="warning" size="sm">
                  {pendingApprovals.length}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              {pendingApprovals.length > 0 ? (
                pendingApprovals.slice(0, 4).map((appr) => (
                  <div
                    key={appr.id}
                    onClick={() => onNavigate('approvals')}
                    className="cursor-pointer rounded-xl p-3 bg-gray-50 hover:bg-brand-50/40 dark:bg-white/[0.02] dark:hover:bg-brand-500/5 transition space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white">
                        {appr.module}
                      </span>
                      <span className="text-xs font-semibold text-warning-600 dark:text-warning-400">
                        Review &rarr;
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {appr.recordId} &middot; {appr.submittedBy || 'Volunteer'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-success-50 dark:bg-success-500/10 text-success-500">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                    All field logs and expenses approved.
                  </p>
                </div>
              )}
            </div>
          </div>

          {pendingApprovals.length > 0 && (
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => onNavigate('approvals')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-2 text-xs font-semibold text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5 transition"
              >
                Open Approval Center
              </button>
            </div>
          )}
        </div>

        {/* 8-Day Progress by Cluster */}
        <div className="col-span-12 rounded-2xl border border-gray-200 bg-white p-5 md:p-6 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
            <div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                8-Day Curriculum Progress by Cluster
              </h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Milestone tracking across all 8 academic program days
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Completed
              </span>
              <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> In Progress
              </span>
              <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Scheduled
              </span>
              <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600" /> Pending
              </span>
            </div>
          </div>

          <div className="space-y-3.5">
            {clusters.length > 0 ? clusters.map(cluster => {
              const clusterSessions = sessions.filter(s => s.clusterId === cluster.id);
              
              const daysStatus = Array.from({length: 8}, (_, i) => {
                const day = i + 1;
                const daySession = clusterSessions.find(s => s.dayNumber === day);
                if (daySession && (daySession.status === 'Completed' || daySession.status === 'Approved')) {
                  return { state: 'Completed', label: daySession.name || `Day ${day}` };
                } else if (daySession && (daySession.status === 'In Progress' || daySession.status === 'Submitted' || daySession.status === 'Pending Review')) {
                  return { state: 'In Progress', label: daySession.name || `Day ${day}` };
                } else if (daySession && daySession.status === 'Scheduled') {
                  return { state: 'Scheduled', label: daySession.name || `Day ${day}` };
                }
                return { state: 'Pending', label: `Day ${day}` };
              });

              const compCount = daysStatus.filter(s => s.state === 'Completed').length;
              const inProgCount = daysStatus.filter(s => s.state === 'In Progress').length;
              const progressPct = Math.round((compCount / 8) * 100);

              return (
                <div key={cluster.id} className="rounded-xl border border-gray-200/80 bg-gray-50/40 p-4 dark:border-gray-800 dark:bg-white/[0.02] hover:border-brand-300 dark:hover:border-brand-500/30 transition">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="w-full lg:w-64 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white">{cluster.name}</span>
                        {cluster.collegeName && (
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[120px]">
                            &middot; {cluster.collegeName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-brand-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                          {progressPct}%
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {daysStatus.map((d, idx) => {
                        const isDone = d.state === 'Completed';
                        const isInProg = d.state === 'In Progress';
                        const isSched = d.state === 'Scheduled';

                        return (
                          <div
                            key={idx}
                            title={`Day ${idx + 1}: ${d.state} (${d.label})`}
                            className={`group relative flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                              isDone
                                ? 'border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400'
                                : isInProg
                                ? 'border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400 shadow-sm animate-pulse'
                                : isSched
                                ? 'border-blue-200 bg-blue-50/80 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-400'
                                : 'border-gray-200/60 bg-white dark:border-gray-800 dark:bg-gray-800/40 text-gray-400'
                            }`}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider mb-0.5">
                              Day {idx + 1}
                            </span>
                            <div className="flex items-center justify-center h-4">
                              {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                              {isInProg && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Active</span>}
                              {isSched && <Calendar className="w-3 h-3 text-blue-600 dark:text-blue-400" />}
                              {!isDone && !isInProg && !isSched && <span className="text-[10px] text-gray-300 dark:text-gray-600">&bull;</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="text-sm text-gray-500 text-center py-6 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                No clusters onboarded yet. Create a cluster under the Clusters tab to begin tracking 8-day progress.
              </div>
            )}
          </div>
        </div>
        
        {/* Panchayats & Village Units Table */}
        <div className="col-span-12 xl:col-span-8 rounded-2xl border border-gray-200 bg-white p-5 md:p-6 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                Panchayats & Village Units
              </h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {panchayats.length} panchayats &middot; {totalVillages} villages active under {clusterName}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative w-44 sm:w-56">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search panchayats..."
                  value={panchayatSearch}
                  onChange={(e) => setPanchayatSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-transparent pl-9 pr-3 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <button
                type="button"
                onClick={() => onNavigate('panchayats')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5 transition"
              >
                <span>Directory</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell isHeader>Panchayat Hub</TableCell>
                    <TableCell isHeader>Mapped Villages</TableCell>
                    <TableCell isHeader className="text-right">Active Students</TableCell>
                    <TableCell isHeader className="text-right">Action</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPanchayats.length > 0 ? (
                    filteredPanchayats.map((p) => (
                      <TableRow
                        key={p.id}
                        onClick={() => onNavigate('panchayats')}
                        className="cursor-pointer group"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <MapPin className="h-4 w-4 text-gray-400 group-hover:text-brand-500 transition-colors shrink-0" />
                            <span className="font-semibold text-gray-800 group-hover:text-brand-500 dark:text-white/90 dark:group-hover:text-brand-400 transition-colors">
                              {p.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-500 dark:text-gray-400 truncate max-w-xs">
                          {p.villages?.map((v) => v.name).join(', ') || `${p.villagesCount || 0} villages`}
                        </TableCell>
                        <TableCell className="text-right font-bold text-gray-800 dark:text-white tabular-nums">
                          {p.activeStudents || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-white transition-colors inline-block" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-gray-500 dark:text-gray-400">
                        No panchayats found matching "{panchayatSearch || clusterName}".
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Operational Quick Links */}
        <div className="col-span-12 xl:col-span-4 rounded-2xl border border-gray-200 bg-white p-5 md:p-6 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] space-y-4">
          <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              Operational Navigation
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Direct access to field workflows
            </p>
          </div>

          <div className="space-y-2">
            {[
              { label: '8-Day Attendance & Homework', tab: 'attendance' as TabType, desc: 'Log daily marks & volunteer attendance' },
              { label: 'Finance & OCR Bill Scanning', tab: 'finance' as TabType, desc: 'Verify tickets, fuel & food bills' },
              { label: 'Curriculum PPT Module Library', tab: 'module-library' as TabType, desc: 'Teaching slides & worksheets' },
              { label: 'Analytics & Semester Reports', tab: 'reports' as TabType, desc: 'Download CSV & PDF completion reports' },
            ].map((item) => (
              <button
                key={item.tab}
                type="button"
                onClick={() => onNavigate(item.tab)}
                className="group flex w-full items-start justify-between rounded-xl p-3 text-left transition-colors bg-gray-50/60 hover:bg-brand-50/40 dark:bg-white/[0.02] dark:hover:bg-brand-500/5"
              >
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-gray-800 group-hover:text-brand-500 dark:text-white/90 dark:group-hover:text-brand-400 transition-colors">
                    {item.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors mt-0.5 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

