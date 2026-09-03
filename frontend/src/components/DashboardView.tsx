import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Student as StudentIcon,
  CalendarCheck,
  CurrencyInr,
  Warning,
  MapPin,
  Plus,
  CheckCircle,
  ArrowRight,
  CaretRight,
  Search,
  Calendar,
  TrendingUp as TrendingUpIcon,
  TreeStructure,
  BookOpen,
  FileText,
  Camera,
  Circle,
  Clock,
  Sparkle,
  ArrowUpRight,
  Pulse,
} from './ui/icons';
import { TabType, Panchayat, AttendanceSession, Cluster, ApprovalItem, UserRole, FinanceEntry, Session, Student, Volunteer } from '../types';
import { apiUrl } from '../utils/api';
import Badge from './ui/badge';
import { AttendanceTrendChart } from './ui/AttendanceTrendChart';
import { ActivityFeed, ActivityItem } from './ui/ActivityFeed';

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

const todayLabel = () => {
  const d = new Date();
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
};

const formatINR = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString('en-IN')}`;

const relativeTime = (ts: number | string | Date): string => {
  const t = typeof ts === 'number' ? ts : new Date(ts).getTime();
  const diff = Date.now() - t;
  if (Number.isNaN(diff) || diff < 0) return 'just now';
  const m = 60_000, h = 60 * m, d = 24 * h;
  if (diff < m) return 'just now';
  if (diff < h) return `${Math.floor(diff / m)}m ago`;
  if (diff < d) return `${Math.floor(diff / h)}h ago`;
  if (diff < 7 * d) return `${Math.floor(diff / d)}d ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenNewAttendance,
  onOpenNewFinance,
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
  volunteers = [],
}) => {
  const [panchayatSearch, setPanchayatSearch] = useState('');
  const [setupDays, setSetupDays] = useState<{ dayNumber: number; sessionName: string }[]>([]);
  const isSuperAdmin = userRole === 'Super Admin';
  const pendingApprovals = approvals.filter((a) => a.status === 'Pending');

  const totalVillages = useMemo(
    () => panchayats.reduce((sum, p) => sum + (p.villages?.length || p.villagesCount || 0), 0),
    [panchayats]
  );
  const totalExpenses = useMemo(
    () => financeEntries.reduce((sum, f) => sum + (Number(f.amount) || 0), 0),
    [financeEntries]
  );
  const uniqueColleges = useMemo(
    () => Array.from(new Set(volunteers.map((v) => v.college).filter(Boolean))),
    [volunteers]
  );

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

  const dynamicRoadmap = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const dayNum = i + 1;
      const customConfig = setupDays.find((s) => s.dayNumber === dayNum);
      const meta = defaultSuggestedNames[dayNum];
      const sessionName = customConfig?.sessionName || meta.name;
      const hasCompleted = attendanceDrafts.some(
        (a) => a.dayNumber === dayNum && a.status === 'Approved'
      );
      const hasPending = attendanceDrafts.some(
        (a) => a.dayNumber === dayNum && a.status !== 'Approved'
      );
      let status: 'Completed' | 'In Progress' | 'Scheduled' = 'Scheduled';
      if (hasCompleted) status = 'Completed';
      else if (hasPending) status = 'In Progress';
      return { day: dayNum, title: sessionName, month: meta.month, topic: meta.topic, status };
    });
  }, [attendanceDrafts, setupDays]);

  const completedDaysCount = dynamicRoadmap.filter((d) => d.status === 'Completed').length;
  const inProgressDay = dynamicRoadmap.find((d) => d.status === 'In Progress');
  const progressPercent = Math.round((completedDaysCount / 8) * 100);

  const filteredPanchayats = panchayats.filter(
    (p) =>
      p.name.toLowerCase().includes(panchayatSearch.toLowerCase()) ||
      p.villages?.some((v) => v.name.toLowerCase().includes(panchayatSearch.toLowerCase()))
  );

  // Build chart data: 8 days, completed count per day
  const chartData = useMemo(() => {
    return dynamicRoadmap.map((d) => {
      const sessionToday = sessions.find(
        (s) => s.dayNumber === d.day
      );
      return {
        day: d.day,
        label: d.title,
        completed:
          d.status === 'Completed' ? Math.max(1, Math.round((sessionsCount || 8) / 8)) : 0,
        inProgress: d.status === 'In Progress' ? 1 : 0,
        scheduled: d.status === 'Scheduled' ? 1 : 0,
        total: 1,
      };
    });
  }, [dynamicRoadmap, sessions, sessionsCount]);

  // Build recent activity from the data we have
  const recentActivity: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];
    attendanceDrafts.slice(0, 3).forEach((a, i) => {
      const raw = a.submittedAt || a.updatedAt || Date.now() - (i + 1) * 3600_000;
      items.push({
        id: `att-${a.id || i}`,
        kind: 'attendance',
        title: `Day ${a.dayNumber} attendance logged`,
        meta: `${a.status} · ${a.panchayatName || 'cluster entry'}`,
        actor: a.submittedBy || 'Field mentor',
        timestamp: relativeTime(raw),
        timestampMs: new Date(raw).getTime(),
        status: a.status === 'Approved' ? 'success' : 'pending',
        tab: 'attendance',
      });
    });
    financeEntries.slice(0, 3).forEach((f, i) => {
      const raw = f.submittedAt || f.date || Date.now() - (i + 2) * 3600_000;
      items.push({
        id: `fin-${f.id || i}`,
        kind: 'finance',
        title: `${f.vendor || 'Expense'} — ₹${Number(f.amount || 0).toLocaleString('en-IN')}`,
        meta: f.category || 'Reimbursement',
        actor: f.submittedBy || 'Volunteer',
        timestamp: relativeTime(raw),
        timestampMs: new Date(raw).getTime(),
        status: f.status === 'Approved' ? 'success' : f.status === 'Pending' ? 'pending' : 'info',
        tab: 'finance',
      });
    });
    pendingApprovals.slice(0, 2).forEach((p, i) => {
      const raw = Date.now() - (i + 1) * 1800_000;
      items.push({
        id: `apr-${p.id || i}`,
        kind: 'approval',
        title: `${p.module} awaiting review`,
        meta: p.recordId,
        actor: p.submittedBy || 'Volunteer',
        timestamp: relativeTime(raw),
        timestampMs: raw,
        status: 'pending',
        tab: 'approvals',
      });
    });
    // Sort by raw epoch ms (newest first) — comparing pre-formatted strings
    // is unsafe because "12h ago" < "5m ago" lexicographically.
    return items
      .sort((a, b) => {
        const am = a.timestampMs ?? 0;
        const bm = b.timestampMs ?? 0;
        return bm - am;
      })
      .slice(0, 8);
  }, [attendanceDrafts, financeEntries, pendingApprovals]);

  return (
    <div className="w-full space-y-6">
      {/* ============================================================
          HERO STRIP — single-line greeting + primary action
          ============================================================ */}
      <section className="tqi-page-hero">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="pl-3">
            <div className="flex flex-wrap items-center gap-2 text-text-muted">
              <span className="tqi-pulse">
                {isSuperAdmin ? 'Operations live' : `${clusterName} active`}
              </span>
              <span className="text-xs">·</span>
              <span className="text-xs font-medium tracking-wide">{todayLabel()}</span>
            </div>
            <h1 className="mt-2 text-[1.7rem] sm:text-[1.9rem] font-bold leading-[1.15] text-text">
              Good day, {isSuperAdmin ? 'Super Administrator' : clusterName.split(' ')[0]}.
            </h1>
            <p className="mt-1.5 text-sm text-text-muted max-w-2xl">
              {completedDaysCount === 8
                ? 'All 8 sessions completed. Time to wrap reports and plan the next cycle.'
                : inProgressDay
                ? `Day ${inProgressDay.day} of the cycle is in motion — ${inProgressDay.title.toLowerCase()}.`
                : `Cycle progress sits at ${progressPercent}%. The next milestone is Day ${
                    dynamicRoadmap.find((d) => d.status !== 'Completed')?.day || 8
                  }.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            {pendingApprovals.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('approvals')}
                className="tqi-cta-secondary"
              >
                <Warning className="h-4 w-4" style={{ color: 'var(--warning)' }} />
                <span>{pendingApprovals.length} pending</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('finance')}
              className="tqi-cta-secondary"
            >
              <CurrencyInr className="h-4 w-4" style={{ color: 'var(--brand-orange)' }} />
              <span>Record expense</span>
            </button>
            <button
              type="button"
              onClick={onOpenNewAttendance}
              className="tqi-cta"
            >
              <span>Mark attendance</span>
              <span className="tqi-cta-icon">
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================
          KPI STRIP — 4 metrics, editorial single row
          ============================================================ */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4 tqi-stagger">
        <button
          type="button"
          onClick={() => onNavigate('students')}
          className="tqi-kpi text-left"
        >
          <div className="tqi-kpi-head">
            <span className="tqi-icon-chip"><StudentIcon className="h-4.5 w-4.5" /></span>
            <Badge color="success" size="sm">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success mr-1" />
              Active
            </Badge>
          </div>
          <div>
            <div className="tqi-kpi-label">Enrolled students</div>
            <div className="tqi-kpi-value">{studentsCount.toLocaleString('en-IN')}</div>
          </div>
          <div className="tqi-kpi-foot">
            <TrendingUpIcon className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />
            <span>Across {panchayats.length} panchayats</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('volunteers')}
          className="tqi-kpi text-left"
        >
          <div className="tqi-kpi-head">
            <span className="tqi-icon-chip tqi-icon-chip-teal"><Users className="h-4.5 w-4.5" /></span>
            <Badge color="info" size="sm">
              {uniqueColleges.length} {uniqueColleges.length === 1 ? 'college' : 'colleges'}
            </Badge>
          </div>
          <div>
            <div className="tqi-kpi-label">Field mentors</div>
            <div className="tqi-kpi-value">{volunteersCount.toLocaleString('en-IN')}</div>
          </div>
          <div className="tqi-kpi-foot">
            <TreeStructure className="h-3.5 w-3.5" />
            <span>Volunteer rosters & attendance</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('attendance')}
          className="tqi-kpi text-left"
        >
          <div className="tqi-kpi-head">
            <span className="tqi-icon-chip tqi-icon-chip-success"><CalendarCheck className="h-4.5 w-4.5" /></span>
            <Badge color="success" size="sm">{progressPercent}%</Badge>
          </div>
          <div>
            <div className="tqi-kpi-label">Cycle progress</div>
            <div className="tqi-kpi-value">{completedDaysCount}<span className="text-text-muted text-base font-semibold"> / 8</span></div>
          </div>
          <div className="tqi-kpi-foot">
            <Clock className="h-3.5 w-3.5" />
            <span>{(attendanceDrafts.length || sessionsCount)} logs recorded</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('finance')}
          className="tqi-kpi text-left"
        >
          <div className="tqi-kpi-head">
            <span className="tqi-icon-chip tqi-icon-chip-orange"><CurrencyInr className="h-4.5 w-4.5" /></span>
            <Badge color="warning" size="sm">{financeEntries.length} bills</Badge>
          </div>
          <div>
            <div className="tqi-kpi-label">Cluster expenses</div>
            <div className="tqi-kpi-value">{formatINR(totalExpenses)}</div>
          </div>
          <div className="tqi-kpi-foot">
            <FileText className="h-3.5 w-3.5" />
            <span>Verified entries this cycle</span>
          </div>
        </button>
      </section>

      {/* ============================================================
          CENTERPIECE BENTO — Trend chart (8) + Activity (4)
          ============================================================ */}
      <section className="grid grid-cols-12 gap-4 md:gap-5 tqi-stagger">
        <div className="col-span-12 xl:col-span-8">
          <AttendanceTrendChart data={chartData} height={240} />
        </div>
        <div className="col-span-12 xl:col-span-4 tqi-card flex flex-col">
          <div className="tqi-section-header">
            <div>
              <h3 className="tqi-section-title">Recent activity</h3>
              <p className="tqi-section-sub">Latest updates from your cluster.</p>
            </div>
            <span className="tqi-chip tqi-chip-brand">
              <span className="tqi-live">Live</span>
            </span>
          </div>
          <div className="flex-1 -mx-1">
            <ActivityFeed
              items={recentActivity}
              onItemClick={(it) => it.tab && onNavigate(it.tab)}
            />
          </div>
          {recentActivity.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="tqi-btn-ghost mt-3 w-full justify-center"
            >
              <span>View full activity log</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* ============================================================
          BENTO ROW — Curriculum (8) + Approvals (4)
          ============================================================ */}
      <section className="grid grid-cols-12 gap-4 md:gap-5">
        {/* Curriculum roadmap */}
        <div className="col-span-12 xl:col-span-8 tqi-card">
          <div className="tqi-section-header">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="tqi-section-title">8-day academic cycle</h3>
                <span className="tqi-chip tqi-chip-brand">
                  <span className="tqi-chip-dot" style={{ background: 'var(--brand)' }} />
                  {progressPercent}% delivered
                </span>
              </div>
              <p className="tqi-section-sub">
                Structured milestone progression synchronised across village school centres, Feb–Apr.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(isSuperAdmin ? 'academic-setup' : 'module-library')}
              className="tqi-btn-ghost"
            >
              <span>{isSuperAdmin ? 'Configure term' : 'Module library'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Refined progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-text-muted font-medium">
              <span>Delivery status</span>
              <span className="font-semibold text-text">{completedDaysCount} of 8 sessions</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ background: 'var(--surface-hover)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPercent}%`,
                  background:
                    'linear-gradient(90deg, var(--brand) 0%, var(--brand-teal) 60%, var(--brand-orange) 100%)',
                }}
              />
            </div>
          </div>

          {/* Timeline */}
          <div className="mt-6 -mx-2 overflow-x-auto custom-scrollbar">
            <div className="tqi-timeline px-2 min-w-[640px]">
              {dynamicRoadmap.map((item) => {
                const state =
                  item.status === 'Completed'
                    ? 'completed'
                    : item.status === 'In Progress'
                    ? 'progress'
                    : 'scheduled';
                return (
                  <div key={item.day} className="tqi-timeline-step" data-state={state}>
                    <div className="tqi-timeline-dot">
                      {item.status === 'Completed' ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : item.status === 'In Progress' ? (
                        <Circle className="h-3 w-3" />
                      ) : (
                        <span className="text-[10px] font-bold">{item.day}</span>
                      )}
                    </div>
                    <div className="tqi-timeline-day">Day {item.day}</div>
                    <div className="tqi-timeline-title">{item.title}</div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      {item.month}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Approvals */}
        <div className="col-span-12 xl:col-span-4 tqi-card flex flex-col">
          <div className="tqi-section-header">
            <div>
              <h3 className="tqi-section-title">Pending approvals</h3>
              <p className="tqi-section-sub">
                {pendingApprovals.length > 0
                  ? `${pendingApprovals.length} entries awaiting verification`
                  : 'All field logs and expenses are reviewed.'}
              </p>
            </div>
            {pendingApprovals.length > 0 && (
              <span className="tqi-chip tqi-chip-warning">
                <span className="tqi-chip-dot" style={{ background: 'var(--warning)' }} />
                {pendingApprovals.length}
              </span>
            )}
          </div>

          {pendingApprovals.length > 0 ? (
            <ul className="space-y-1 -mx-1">
              {pendingApprovals.slice(0, 4).map((appr) => (
                <li key={appr.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate('approvals')}
                    className="tqi-link-row"
                  >
                    <div className="min-w-0">
                      <div className="tqi-link-title truncate">{appr.module}</div>
                      <div className="tqi-link-desc truncate">
                        {appr.recordId} · {appr.submittedBy || 'Volunteer'}
                      </div>
                    </div>
                    <CaretRight className="h-4 w-4 text-text-muted shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center py-6">
              <span
                className="tqi-icon-chip tqi-icon-chip-success"
                style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)' }}
              >
                <CheckCircle className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-medium text-text-secondary">
                All field logs and expenses approved.
              </p>
            </div>
          )}

          {pendingApprovals.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('approvals')}
              className="tqi-btn-outline mt-4 w-full"
            >
              <span>Open approval center</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* ============================================================
          CLUSTER PROGRESS — full width, refined row layout
          ============================================================ */}
      <section className="tqi-card">
        <div className="tqi-section-header">
          <div>
            <h3 className="tqi-section-title">Cluster progress</h3>
            <p className="tqi-section-sub">
              Milestone tracking across the 8-day academic program by cluster.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--success)' }} />
              Completed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--brand-orange)' }} />
              In progress
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--brand)' }} />
              Scheduled
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--border-strong)' }} />
              Pending
            </span>
          </div>
        </div>

        {clusters.length > 0 ? (
          <ul className="space-y-2.5">
            {clusters.map((cluster) => {
              const clusterSessions = sessions.filter((s) => s.clusterId === cluster.id);
              const daysStatus = Array.from({ length: 8 }, (_, i) => {
                const day = i + 1;
                const ds = clusterSessions.find((s) => s.dayNumber === day);
                if (ds && (ds.status === 'Completed' || ds.status === 'Approved'))
                  return { state: 'Completed' as const, label: ds.name || `Day ${day}` };
                if (
                  ds &&
                  (ds.status === 'In Progress' ||
                    ds.status === 'Submitted' ||
                    ds.status === 'Pending Review')
                )
                  return { state: 'In Progress' as const, label: ds.name || `Day ${day}` };
                if (ds && ds.status === 'Scheduled')
                  return { state: 'Scheduled' as const, label: ds.name || `Day ${day}` };
                return { state: 'Pending' as const, label: `Day ${day}` };
              });
              const compCount = daysStatus.filter((s) => s.state === 'Completed').length;
              const progressPct = Math.round((compCount / 8) * 100);

              return (
                <li
                  key={cluster.id}
                  className="rounded-xl px-4 py-3.5 transition"
                  style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface)' }}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
                    <div className="lg:w-56 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text">{cluster.name}</span>
                        {cluster.collegeName && (
                          <span className="text-[11px] text-text-muted truncate">
                            · {cluster.collegeName}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2.5">
                        <div
                          className="flex-1 h-1.5 rounded-full overflow-hidden"
                          style={{ background: 'var(--border-subtle)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progressPct}%`,
                              background: 'var(--brand)',
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--brand)' }}>
                          {progressPct}%
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                      {daysStatus.map((d, idx) => {
                        const bg =
                          d.state === 'Completed'
                            ? 'var(--success-bg)'
                            : d.state === 'In Progress'
                            ? 'var(--brand-orange-light)'
                            : d.state === 'Scheduled'
                            ? 'var(--brand-light)'
                            : 'var(--surface-hover)';
                        const color =
                          d.state === 'Completed'
                            ? 'var(--success)'
                            : d.state === 'In Progress'
                            ? 'var(--brand-orange)'
                            : d.state === 'Scheduled'
                            ? 'var(--brand)'
                            : 'var(--text-muted)';
                        const border =
                          d.state === 'Completed'
                            ? 'var(--success-border)'
                            : d.state === 'In Progress'
                            ? 'color-mix(in srgb, var(--brand-orange) 30%, transparent)'
                            : d.state === 'Scheduled'
                            ? 'var(--brand-xlight)'
                            : 'var(--border)';
                        return (
                          <div
                            key={idx}
                            title={`Day ${idx + 1}: ${d.state} (${d.label})`}
                            className="flex flex-col items-center justify-center py-1.5 rounded-md text-center"
                            style={{ background: bg, border: `1px solid ${border}` }}
                          >
                            <span
                              className="text-[9px] font-bold uppercase tracking-wider"
                              style={{ color }}
                            >
                              D{idx + 1}
                            </span>
                            <div className="mt-0.5">
                              {d.state === 'Completed' && (
                                <CheckCircle className="h-3 w-3" style={{ color }} />
                              )}
                              {d.state === 'In Progress' && (
                                <Circle className="h-3 w-3" style={{ color }} />
                              )}
                              {d.state === 'Scheduled' && (
                                <Calendar className="h-3 w-3" style={{ color }} />
                              )}
                              {d.state === 'Pending' && (
                                <span className="block h-1 w-1 rounded-full bg-text-muted" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="tqi-tint">
            <p className="text-sm font-medium text-text">No clusters onboarded yet.</p>
            <p className="mt-1 text-xs">
              Create a cluster under the <button
                type="button"
                onClick={() => onNavigate('clusters')}
                className="font-semibold underline underline-offset-2"
                style={{ color: 'var(--brand)' }}
              >Clusters tab</button> to begin tracking 8-day progress.
            </p>
          </div>
        )}
      </section>

      {/* ============================================================
          BOTTOM BENTO — Panchayats (8) + Quick links (4)
          ============================================================ */}
      <section className="grid grid-cols-12 gap-4 md:gap-5">
        {/* Panchayats table */}
        <div className="col-span-12 xl:col-span-8 tqi-card">
          <div className="tqi-section-header">
            <div>
              <h3 className="tqi-section-title">Panchayats & village units</h3>
              <p className="tqi-section-sub">
                {panchayats.length} panchayats · {totalVillages} villages active under {clusterName}.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="tqi-search" style={{ minWidth: 0, width: 220 }}>
                <Search className="h-4 w-4 shrink-0" />
                <input
                  type="text"
                  placeholder="Search panchayats…"
                  value={panchayatSearch}
                  onChange={(e) => setPanchayatSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => onNavigate('panchayats')}
                className="tqi-btn-ghost"
                title="Open directory"
              >
                <span className="hidden sm:inline">Directory</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="tqi-table-container">
            <div className="max-w-full overflow-x-auto custom-scrollbar">
              <table className="tqi-table">
                <thead>
                  <tr>
                    <th>Panchayat hub</th>
                    <th>Mapped villages</th>
                    <th className="text-right">Active students</th>
                    <th className="text-right w-12" />
                  </tr>
                </thead>
                <tbody>
                  {filteredPanchayats.length > 0 ? (
                    filteredPanchayats.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => onNavigate('panchayats')}
                        className="cursor-pointer"
                      >
                        <td>
                          <div className="flex items-center gap-2.5">
                            <MapPin className="h-4 w-4 text-text-muted shrink-0" />
                            <span className="font-semibold text-text">{p.name}</span>
                          </div>
                        </td>
                        <td className="text-text-muted max-w-xs truncate">
                          {p.villages?.map((v) => v.name).join(', ') ||
                            `${p.villagesCount || 0} villages`}
                        </td>
                        <td className="text-right font-semibold text-text tabular-nums">
                          {(p.activeStudents || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="text-right">
                          <CaretRight className="h-4 w-4 text-text-muted inline-block" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-text-muted">
                        No panchayats match "{panchayatSearch || clusterName}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Quick links — inline rows, not cards */}
        <div className="col-span-12 xl:col-span-4 tqi-card flex flex-col">
          <div className="tqi-section-header">
            <div>
              <h3 className="tqi-section-title">Field workflows</h3>
              <p className="tqi-section-sub">Direct access to daily operations.</p>
            </div>
          </div>
          <ul className="space-y-1 -mx-1 flex-1">
            {[
              { label: '8-day attendance & homework', tab: 'attendance' as TabType, desc: 'Log daily marks & volunteer attendance', icon: CalendarCheck },
              { label: 'Finance & OCR bill scanning', tab: 'finance' as TabType, desc: 'Verify tickets, fuel & food bills', icon: CurrencyInr },
              { label: 'Curriculum module library', tab: 'module-library' as TabType, desc: 'Teaching slides & worksheets', icon: BookOpen },
              { label: 'Analytics & semester reports', tab: 'reports' as TabType, desc: 'Download CSV & PDF completion reports', icon: FileText },
              { label: 'Session photos', tab: 'session-photos' as TabType, desc: 'Field captures & media archive', icon: Camera },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.tab}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.tab)}
                    className="tqi-link-row"
                  >
                    <span
                      className="tqi-icon-chip"
                      style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)' }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="tqi-link-title truncate">{item.label}</div>
                      <div className="tqi-link-desc truncate">{item.desc}</div>
                    </div>
                    <CaretRight className="h-4 w-4 text-text-muted shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>

          <div
            className="mt-4 -mx-1 rounded-lg px-3 py-2.5 text-xs flex items-center gap-2"
            style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}
          >
            <Sparkle className="h-3.5 w-3.5 shrink-0" />
            <span>
              Tip: Press{' '}
              <kbd
                className="rounded border px-1.5 py-0.5 font-mono text-[10px]"
                style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                ⌘K
              </kbd>{' '}
              anywhere to jump to any view.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
