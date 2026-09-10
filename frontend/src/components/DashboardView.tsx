import React, { useState, useEffect, useMemo } from 'react';
// Deliberately short list. Icons here earn their place by aiding
// navigation (row chevrons, the workflow menu, the search field);
// none are used as decoration next to a number or a heading.
import {
  CalendarCheck,
  CurrencyInr,
  CaretRight,
  Search,
  BookOpen,
  FileText,
  Camera,
} from './ui/icons';
import { TabType, Panchayat, AttendanceSession, Cluster, ApprovalItem, UserRole, FinanceEntry, Session, Student, Volunteer } from '../types';
import { apiUrl } from '../utils/api';
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
  authToken?: string;
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
  authToken,
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
    fetch(apiUrl('/api/academic-setup'), {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    })
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
  }, [authToken]);

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
    <div className="w-full space-y-8">
      {/* ============================================================
          PAGE HEADER — plain type, no card, no gradient.
          The greeting is the only large type on the page.
          ============================================================ */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-muted">
            {todayLabel()} &middot; {isSuperAdmin ? 'All clusters' : clusterName}
          </p>
          <h1 className="mt-2 text-[1.75rem] font-bold leading-tight tracking-tight text-text">
            Good day, {isSuperAdmin ? 'Super Administrator' : clusterName.split(' ')[0]}.
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-text-muted">
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
          <button type="button" onClick={onOpenNewFinance} className="tqi-btn-outline">
            Record expense
          </button>
          <button type="button" onClick={onOpenNewAttendance} className="tqi-btn-primary">
            Mark attendance
          </button>
        </div>
      </header>

      {/* ============================================================
          METRIC BAR — one surface, four numbers, hairline dividers.
          No icon chips and no status badges: the number is the
          content, so nothing else competes with it.
          ============================================================ */}
      <section className="tqi-card !p-0">
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Enrolled students',
              value: studentsCount.toLocaleString('en-IN'),
              note: `Across ${panchayats.length} ${panchayats.length === 1 ? 'panchayat' : 'panchayats'}`,
              tab: 'students' as TabType,
            },
            {
              label: 'Field mentors',
              value: volunteersCount.toLocaleString('en-IN'),
              note: `${uniqueColleges.length} ${uniqueColleges.length === 1 ? 'college' : 'colleges'}`,
              tab: 'volunteers' as TabType,
            },
            {
              label: 'Cycle progress',
              value: `${completedDaysCount} / 8`,
              note: `${attendanceDrafts.length || sessionsCount} logs recorded`,
              tab: 'attendance' as TabType,
            },
            {
              label: 'Cluster expenses',
              value: formatINR(totalExpenses),
              note: `${financeEntries.length} ${financeEntries.length === 1 ? 'bill' : 'bills'} filed`,
              tab: 'finance' as TabType,
            },
          ].map((m, i) => (
            <button
              key={m.label}
              type="button"
              onClick={() => onNavigate(m.tab)}
              className={[
                'group px-5 py-5 text-left transition-colors hover:bg-surface-hover',
                // 2-up on mobile: divide the pair, then rule off the second row.
                i % 2 === 1 ? 'border-l border-border-subtle' : '',
                i >= 2 ? 'border-t border-border-subtle lg:border-t-0' : '',
                // 4-up on desktop: a single hairline between each column.
                i > 0 ? 'lg:border-l lg:border-border-subtle' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
                {m.label}
              </dt>
              <dd className="mt-2 text-[1.875rem] font-bold leading-none tracking-tight text-text tqi-num">
                {m.value}
              </dd>
              <p className="mt-2 text-xs text-text-muted">{m.note}</p>
            </button>
          ))}
        </dl>
      </section>

      {/* ============================================================
          PRIORITY ROW — the cycle you are running (8) and the queue
          waiting on you (4). This sits directly under the metrics
          because it is what the operator has to act on.
          ============================================================ */}
      <section className="grid grid-cols-12 gap-5">
        {/* 8-day academic cycle */}
        <div className="col-span-12 tqi-card xl:col-span-8">
          <div className="tqi-section-header">
            <div>
              <h3 className="tqi-section-title">8-day academic cycle</h3>
              <p className="tqi-section-sub">
                Milestone progression across village school centres, Feb&ndash;Apr.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(isSuperAdmin ? 'academic-setup' : 'module-library')}
              className="tqi-btn-ghost"
            >
              {isSuperAdmin ? 'Configure term' : 'Module library'}
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-text-muted">Delivery status</span>
              <span className="font-semibold text-text tqi-num">
                {completedDaysCount} of 8 sessions &middot; {progressPercent}%
              </span>
            </div>
            {/* One colour. A gradient here would imply the value changes
                meaning as it grows, which it does not. */}
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ background: 'var(--border-subtle)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%`, background: 'var(--brand)' }}
              />
            </div>
          </div>

          <div className="mt-6 -mx-2 overflow-x-auto custom-scrollbar">
            <div className="tqi-timeline min-w-[640px] px-2">
              {dynamicRoadmap.map((item) => (
                <div
                  key={item.day}
                  className="tqi-timeline-step"
                  data-state={
                    item.status === 'Completed'
                      ? 'completed'
                      : item.status === 'In Progress'
                      ? 'progress'
                      : 'scheduled'
                  }
                >
                  {/* The dot's colour already carries the state, so it
                      holds the day number rather than a second icon. */}
                  <div className="tqi-timeline-dot">
                    <span className="text-[10px] font-bold">{item.day}</span>
                  </div>
                  <div className="tqi-timeline-title">{item.title}</div>
                  <div className="tqi-timeline-day">{item.month}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Needs attention */}
        <div className="col-span-12 tqi-card flex flex-col xl:col-span-4">
          <div className="tqi-section-header">
            <div>
              <h3 className="tqi-section-title">Needs attention</h3>
              <p className="tqi-section-sub">
                {pendingApprovals.length > 0
                  ? `${pendingApprovals.length} ${
                      pendingApprovals.length === 1 ? 'entry' : 'entries'
                    } awaiting verification`
                  : 'Every field log and expense is reviewed.'}
              </p>
            </div>
          </div>

          {pendingApprovals.length > 0 ? (
            <>
              <ul className="-mx-1 flex-1 space-y-1">
                {pendingApprovals.slice(0, 5).map((appr) => (
                  <li key={appr.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate('approvals')}
                      className="tqi-link-row"
                    >
                      <div className="min-w-0">
                        <div className="tqi-link-title truncate">{appr.module}</div>
                        <div className="tqi-link-desc truncate">
                          {appr.recordId} &middot; {appr.submittedBy || 'Volunteer'}
                        </div>
                      </div>
                      <CaretRight className="h-4 w-4 shrink-0 text-text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => onNavigate('approvals')}
                className="tqi-btn-outline mt-4 w-full"
              >
                Open approval center
              </button>
            </>
          ) : (
            <p className="flex-1 py-8 text-center text-sm text-text-muted">
              Nothing in the queue.
            </p>
          )}
        </div>
      </section>

      {/* ============================================================
          ANALYSIS ROW — attendance trend (8) + activity log (4).
          Sits below the priority row: this is context, not a task.
          ============================================================ */}
      <section className="grid grid-cols-12 gap-5">
        <div className="col-span-12 xl:col-span-8">
          <AttendanceTrendChart data={chartData} height={240} />
        </div>
        <div className="col-span-12 tqi-card flex flex-col xl:col-span-4">
          <div className="tqi-section-header">
            <div>
              <h3 className="tqi-section-title">Recent activity</h3>
              <p className="tqi-section-sub">Latest updates from your cluster.</p>
            </div>
          </div>
          <div className="-mx-1 flex-1">
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
              View full activity log
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
          {/* The only place on this page that spends colour on legend
              swatches — it is teaching the code used by the cells below,
              so each dot has to match its cell's `tone` exactly. */}
          <div className="hidden items-center gap-4 text-xs text-text-muted sm:flex">
            {[
              { label: 'Completed', color: 'var(--success)' },
              { label: 'In progress', color: 'var(--warning-fg)' },
              { label: 'Scheduled', color: 'var(--brand)' },
              { label: 'Pending', color: 'var(--text-muted)' },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
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

                    <div className="grid flex-1 grid-cols-4 gap-1.5 sm:grid-cols-8">
                      {daysStatus.map((d, idx) => {
                        // One lookup instead of three parallel ternaries.
                        // The legend above already teaches these colours, so
                        // the cell needs no icon on top of them.
                        const tone = {
                          Completed: { bg: 'var(--success-bg)', fg: 'var(--success)' },
                          'In Progress': { bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' },
                          Scheduled: { bg: 'var(--brand-light)', fg: 'var(--brand)' },
                          Pending: { bg: 'var(--surface-hover)', fg: 'var(--text-muted)' },
                        }[d.state];
                        return (
                          <div
                            key={idx}
                            title={`Day ${idx + 1}: ${d.state} (${d.label})`}
                            className="rounded-md py-2 text-center text-[10px] font-bold uppercase tracking-wider tqi-num"
                            style={{ background: tone.bg, color: tone.fg }}
                          >
                            D{idx + 1}
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
                Directory
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
                          <span className="font-semibold text-text">{p.name}</span>
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
          <ul className="-mx-1 flex-1 space-y-1">
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
                    {/* Icons stay in this list — it is a navigation menu,
                        so the glyph genuinely helps you find the row. No
                        tinted chip around it though. */}
                    <Icon className="h-4 w-4 shrink-0 text-text-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="tqi-link-title truncate">{item.label}</div>
                      <div className="tqi-link-desc truncate">{item.desc}</div>
                    </div>
                    <CaretRight className="h-4 w-4 shrink-0 text-text-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
};
