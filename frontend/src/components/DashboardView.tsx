import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck,
  CurrencyInr,
  BookOpen,
  FileText,
  Camera,
  Users,
  TreeStructure,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Calendar,
} from './ui/icons';
import {
  TabType,
  Panchayat,
  AttendanceSession,
  Cluster,
  ApprovalItem,
  UserRole,
  FinanceEntry,
  Session,
  Student,
  Volunteer,
} from '../types';
import { apiUrl } from '../utils/api';
import Badge from './ui/badge';

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

const todayFormatted = () => {
  const d = new Date();
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenNewAttendance,
  onOpenNewFinance,
  panchayats = [],
  studentsCount = 0,
  volunteersCount = 0,
  sessionsCount = 0,
  attendanceDrafts = [],
  userRole = 'Super Admin',
  clusters = [],
  approvals = [],
  clusterName = 'All Clusters',
  financeEntries = [],
  sessions = [],
  students = [],
  volunteers = [],
}) => {
  const [setupDays, setSetupDays] = useState<{ dayNumber: number; sessionName: string }[]>([]);
  const isClusterAdmin = userRole === 'Cluster Admin';

  useEffect(() => {
    fetch(apiUrl('/api/academic-setup'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.setup)) {
          setSetupDays(
            data.setup.map((s: { day_number: number; session_name: string }) => ({
              dayNumber: s.day_number,
              sessionName: s.session_name,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Real MySQL calculated metrics
  const totalClusters = clusters.length;
  const totalStudents = students.length || studentsCount;
  const totalVolunteers = volunteers.length || volunteersCount;
  const totalSessions = sessions.length || sessionsCount;
  const completedSessions = sessions.filter(
    (s) => s.status === 'Completed' || (s as any).deliveryStatus === 'Completed'
  ).length;
  const pendingReview = approvals.filter(
    (a) => (a.status as string) === 'Pending' || (a.status as string) === 'Pending Review'
  ).length;
  const resubmissions = approvals.filter(
    (a) => (a.status as string) === 'Correction' || (a.status as string) === 'Correction Requested' || (a.status as string) === 'Resubmission'
  ).length;

  // Today & Upcoming Sessions
  const todayIso = new Date().toISOString().split('T')[0];
  const todaySessions = useMemo(
    () => sessions.filter((s) => s.date === todayIso),
    [sessions, todayIso]
  );
  const upcomingSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.date >= todayIso)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6),
    [sessions, todayIso]
  );

  // Finance summary calculation
  const totalExpenses = useMemo(
    () =>
      financeEntries
        .filter((f) => f.status === 'Approved')
        .reduce((sum, f) => sum + (Number(f.amount) || 0), 0),
    [financeEntries]
  );
  const pendingExpenses = useMemo(
    () =>
      financeEntries
        .filter((f) => f.status === 'Pending' || f.status === 'Draft')
        .reduce((sum, f) => sum + (Number(f.amount) || 0), 0),
    [financeEntries]
  );
  const totalAdvanceAllocated = 60000;
  const balanceAvailable = Math.max(0, totalAdvanceAllocated - totalExpenses);

  // 8-Day Progress
  const dayProgressList = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const dayNum = i + 1;
      const customConfig = setupDays.find((s) => s.dayNumber === dayNum);
      const dayName = customConfig?.sessionName || 'Name not set';
      const daySessions = sessions.filter((s) => s.dayNumber === dayNum);
      const isDone =
        daySessions.length > 0 && daySessions.every((s) => s.status === 'Completed');
      const inProgress = daySessions.some(
        (s) => s.status === 'In Progress' || s.status === 'Scheduled'
      );
      let status: 'Completed' | 'In Progress' | 'Not Started' = 'Not Started';
      if (isDone) status = 'Completed';
      else if (inProgress || daySessions.length > 0) status = 'In Progress';

      return {
        dayNumber: dayNum,
        dayName,
        sessionsCount: daySessions.length,
        status,
      };
    });
  }, [setupDays, sessions]);

  // Real recent activities
  const recentActivities = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      detail: string;
      time: string;
      badgeVariant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary';
    }> = [];

    approvals.slice(0, 4).forEach((a) => {
      list.push({
        id: a.id,
        title: `${a.module}: ${a.recordTitle || a.id}`,
        detail: `Submitted by ${a.submittedBy} (${a.clusterName || 'Cluster'})`,
        time: a.submittedAt || (a as any).date || 'Recent',
        badgeVariant: a.status === 'Approved' ? 'success' : a.status === 'Pending' ? 'warning' : 'destructive',
      });
    });

    sessions.slice(0, 3).forEach((s) => {
      list.push({
        id: s.id,
        title: `Session: ${s.name || s.module}`,
        detail: `${s.panchayatName || 'Panchayat'} - ${s.villageName || 'Village'}`,
        time: s.date,
        badgeVariant: s.status === 'Completed' ? 'success' : 'default',
      });
    });

    return list.slice(0, 6);
  }, [approvals, sessions]);

  return (
    <div className="w-full space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {isClusterAdmin ? 'Cluster Admin Dashboard' : 'Super Admin Dashboard'}
            </h1>
            <Badge variant="default" className="text-[10px]">
              {todayFormatted()}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {isClusterAdmin
              ? `Operational overview for ${clusterName}.`
              : `Enterprise overview of field operations across ${totalClusters} college clusters.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenNewFinance}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground shadow-xs hover:bg-surface-hover transition-colors"
          >
            <CurrencyInr size={14} className="text-muted-foreground" />
            <span>Record Expense</span>
          </button>
          <button
            type="button"
            onClick={onOpenNewAttendance}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs hover:bg-brand-dark transition-colors"
          >
            <CalendarCheck size={14} />
            <span>Mark Attendance</span>
          </button>
        </div>
      </div>

      {/* 2. Compact KPI Blocks */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          {
            label: 'Total Clusters',
            val: totalClusters,
            tab: 'clusters' as TabType,
            hint: 'Active networks',
          },
          {
            label: 'Total Students',
            val: totalStudents,
            tab: 'students' as TabType,
            hint: 'Enrolled roster',
          },
          {
            label: 'Total Volunteers',
            val: totalVolunteers,
            tab: 'volunteers' as TabType,
            hint: 'Field mentors',
          },
          {
            label: 'Total Sessions',
            val: totalSessions,
            tab: 'sessions' as TabType,
            hint: 'Curriculum logs',
          },
          {
            label: 'Completed',
            val: completedSessions,
            tab: 'sessions' as TabType,
            hint: 'Verified delivery',
          },
          {
            label: 'Pending Review',
            val: pendingReview,
            tab: 'approvals' as TabType,
            hint: 'Requires action',
            highlight: pendingReview > 0,
          },
          {
            label: 'Resubmissions',
            val: resubmissions,
            tab: 'approvals' as TabType,
            hint: 'Returned items',
            alert: resubmissions > 0,
          },
        ].map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={() => onNavigate(kpi.tab)}
            className={`flex flex-col justify-between p-3.5 rounded-md border bg-card text-left transition-colors hover:border-border-strong hover:bg-surface-hover shadow-xs ${
              kpi.alert
                ? 'border-red-200 dark:border-red-900/60'
                : kpi.highlight
                ? 'border-amber-200 dark:border-amber-900/60'
                : 'border-border'
            }`}
          >
            <span className="text-[11px] font-medium text-muted-foreground truncate">
              {kpi.label}
            </span>
            <span
              className={`mt-1.5 text-2xl font-bold tracking-tight ${
                kpi.alert
                  ? 'text-red-700 dark:text-red-400'
                  : kpi.highlight
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-foreground'
              }`}
            >
              {kpi.val}
            </span>
            <span className="mt-1 text-[10px] text-muted-foreground truncate">{kpi.hint}</span>
          </button>
        ))}
      </div>

      {/* 3. Operational Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Operational Tables */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Sessions */}
          <div className="rounded-md border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Today&apos;s Sessions</h2>
                <p className="text-xs text-muted-foreground">
                  Active field operations scheduled for {todayFormatted()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('sessions')}
                className="text-xs font-medium text-primary hover:underline"
              >
                View Full Schedule
              </button>
            </div>

            {todaySessions.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No sessions scheduled for today. Field mentors are preparing upcoming sessions.
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                      <th className="pb-2 font-medium">Cluster</th>
                      <th className="pb-2 font-medium">Day</th>
                      <th className="pb-2 font-medium">Village</th>
                      <th className="pb-2 font-medium">Module</th>
                      <th className="pb-2 font-medium">Volunteer</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {todaySessions.map((s) => (
                      <tr key={s.id} className="hover:bg-surface-hover transition-colors">
                        <td className="py-2.5 font-medium text-foreground">{s.clusterId}</td>
                        <td className="py-2.5 text-muted-foreground">Day {s.dayNumber}</td>
                        <td className="py-2.5 text-foreground">{s.villageName}</td>
                        <td className="py-2.5 text-foreground">{s.module}</td>
                        <td className="py-2.5 text-muted-foreground">{s.volunteerName}</td>
                        <td className="py-2.5">
                          <Badge
                            variant={
                              s.status === 'Completed'
                                ? 'success'
                                : s.status === 'In Progress'
                                ? 'warning'
                                : 'default'
                            }
                            size="sm"
                          >
                            {s.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Upcoming Sessions */}
          <div className="rounded-md border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Upcoming Sessions</h2>
                <p className="text-xs text-muted-foreground">
                  Scheduled curriculum milestones across village learning centres
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('sessions')}
                className="text-xs font-medium text-primary hover:underline"
              >
                Manage Sessions
              </button>
            </div>

            {upcomingSessions.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No upcoming sessions found in active academic term.
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Cluster</th>
                      <th className="pb-2 font-medium">Day</th>
                      <th className="pb-2 font-medium">Panchayat &amp; Village</th>
                      <th className="pb-2 font-medium">Volunteer</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {upcomingSessions.map((s) => (
                      <tr key={s.id} className="hover:bg-surface-hover transition-colors">
                        <td className="py-2.5 font-medium text-foreground">{s.date}</td>
                        <td className="py-2.5 text-muted-foreground">{s.clusterId}</td>
                        <td className="py-2.5 text-foreground">Day {s.dayNumber}</td>
                        <td className="py-2.5 text-foreground">
                          {s.panchayatName} &middot; {s.villageName}
                        </td>
                        <td className="py-2.5 text-muted-foreground">{s.volunteerName}</td>
                        <td className="py-2.5">
                          <Badge variant="default" size="sm">
                            {s.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 8-Day Progress Summary */}
          <div className="rounded-md border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">8-Day Cycle Progress</h2>
                <p className="text-xs text-muted-foreground">
                  Status of curriculum delivery across active program days
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('academic-setup')}
                className="text-xs font-medium text-primary hover:underline"
              >
                Academic Term Setup
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {dayProgressList.map((d) => (
                <div
                  key={d.dayNumber}
                  className="flex flex-col justify-between p-3 rounded border border-border bg-muted/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-foreground">Day {d.dayNumber}</span>
                    <Badge
                      variant={
                        d.status === 'Completed'
                          ? 'success'
                          : d.status === 'In Progress'
                          ? 'warning'
                          : 'secondary'
                      }
                      size="sm"
                    >
                      {d.status}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground font-medium truncate">
                    {d.dayName}
                  </p>
                  <span className="mt-1 text-[10px] text-muted-foreground">
                    {d.sessionsCount} sessions
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Finance Summary & Activity */}
        <div className="space-y-6">
          {/* Finance Summary */}
          <div className="rounded-md border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Finance Summary</h2>
                <p className="text-xs text-muted-foreground">Operational budget reconciliation</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('finance')}
                className="text-xs font-medium text-primary hover:underline"
              >
                Finance Ledger
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
                <span className="text-muted-foreground">Advance Budget</span>
                <span className="font-semibold text-foreground">{formatINR(totalAdvanceAllocated)}</span>
              </div>
              <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
                <span className="text-muted-foreground">Verified Expenses</span>
                <span className="font-semibold text-foreground">{formatINR(totalExpenses)}</span>
              </div>
              <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
                <span className="text-muted-foreground">Pending Review</span>
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  {formatINR(pendingExpenses)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="font-semibold text-foreground">Available Balance</span>
                <span className="font-bold text-sm text-emerald-700 dark:text-emerald-400">
                  {formatINR(balanceAvailable)}
                </span>
              </div>
            </div>
          </div>

          {/* Pending Reviews Queue */}
          <div className="rounded-md border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Approval Center</h2>
                <p className="text-xs text-muted-foreground">Items awaiting Super Admin decision</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('approvals')}
                className="text-xs font-medium text-primary hover:underline"
              >
                Review All ({pendingReview})
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {approvals.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  onClick={() => onNavigate('approvals')}
                  className="flex items-center justify-between p-2.5 rounded border border-border/70 bg-muted/20 hover:bg-surface-hover cursor-pointer transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-foreground truncate">
                      {item.recordTitle || item.module}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {item.submittedBy} &middot; {item.clusterName}
                    </div>
                  </div>
                  <Badge
                    variant={
                      item.status === 'Approved'
                        ? 'success'
                        : item.status === 'Pending'
                        ? 'warning'
                        : 'destructive'
                    }
                    size="sm"
                    className="shrink-0 ml-2"
                  >
                    {item.status}
                  </Badge>
                </div>
              ))}
              {approvals.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Approval queue is clear.
                </p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-md border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
                <p className="text-xs text-muted-foreground">Live submissions &amp; log trail</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('audit-logs')}
                className="text-xs font-medium text-primary hover:underline"
              >
                Audit Trail
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {recentActivities.map((act) => (
                <div key={act.id} className="flex items-start gap-2.5 text-xs">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground truncate">{act.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{act.detail}</div>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{act.time}</span>
                </div>
              ))}
              {recentActivities.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  No activity recorded yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
