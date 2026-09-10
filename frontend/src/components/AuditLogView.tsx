import React, { useState, useMemo } from "react";
import { AuditLogEntry, User } from "../types";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import Badge from "./ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableCell } from "./ui/table";
import { Search, Download, X, ArrowRight, Users as UserIcon, Clock, ChevronRight, Mail, Phone, MapPin } from "./ui/icons";

interface AuditLogViewProps {
  auditLogs: AuditLogEntry[];
  users?: User[];
  userRole: "Super Admin" | "Cluster Admin";
}

type ViewMode = 'users' | 'events';

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  auditLogs = [],
  users = [],
  userRole,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('users');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModule, setSelectedModule] = useState("all");
  const [selectedAction, setSelectedAction] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailLog, setDetailLog] = useState<AuditLogEntry | null>(null);

  // Per-user activity summary
  const userSummaries = useMemo(() => {
    const map = new Map<string, {
      user: User;
      eventCount: number;
      lastActivity: string;
      approvedCount: number;
      rejectedCount: number;
      createdCount: number;
      submittedCount: number;
      modules: Set<string>;
    }>();
    users.forEach((u) => {
      map.set(u.id, {
        user: u,
        eventCount: 0,
        lastActivity: '—',
        approvedCount: 0,
        rejectedCount: 0,
        createdCount: 0,
        submittedCount: 0,
        modules: new Set<string>(),
      });
    });
    auditLogs.forEach((log) => {
      if (!map.has(log.userId)) {
        map.set(log.userId, {
          user: {
            id: log.userId,
            name: log.userName,
            email: '',
            role: (log.userRole as any) || 'Cluster Admin',
            clusterId: log.clusterId || 'all',
            clusterName: log.clusterName || '',
            phone: '',
            status: 'Active',
            mustChangePassword: false,
          },
          eventCount: 0,
          lastActivity: log.timestamp,
          approvedCount: 0,
          rejectedCount: 0,
          createdCount: 0,
          submittedCount: 0,
          modules: new Set<string>(),
        });
      }
      const entry = map.get(log.userId)!;
      entry.eventCount += 1;
      const action = log.action.toLowerCase();
      if (action.includes('approv')) entry.approvedCount += 1;
      if (action.includes('reject') || action.includes('correction')) entry.rejectedCount += 1;
      if (action.includes('creat')) entry.createdCount += 1;
      if (action.includes('submi')) entry.submittedCount += 1;
      if (log.module) entry.modules.add(log.module);
      if (log.timestamp > entry.lastActivity) entry.lastActivity = log.timestamp;
    });
    return Array.from(map.values()).sort((a, b) => b.eventCount - a.eventCount);
  }, [auditLogs, users]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return userSummaries;
    const q = searchTerm.toLowerCase();
    return userSummaries.filter((s) =>
      s.user.name.toLowerCase().includes(q) ||
      (s.user.email || '').toLowerCase().includes(q) ||
      (s.user.role || '').toLowerCase().includes(q)
    );
  }, [userSummaries, searchTerm]);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (selectedUserId && log.userId !== selectedUserId) return false;
      if (selectedModule !== 'all' && log.module !== selectedModule) return false;
      if (selectedAction !== 'all' && !log.action.toLowerCase().includes(selectedAction.toLowerCase())) return false;
      if (searchTerm && viewMode === 'events') {
        const q = searchTerm.toLowerCase();
        return (
          log.userName.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.module.toLowerCase().includes(q) ||
          (log.clusterName && log.clusterName.toLowerCase().includes(q)) ||
          log.details.toLowerCase().includes(q) ||
          log.recordId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [auditLogs, selectedModule, selectedAction, searchTerm, selectedUserId, viewMode]);

  const selectedUser = useMemo(
    () => selectedUserId ? userSummaries.find((s) => s.user.id === selectedUserId) : null,
    [userSummaries, selectedUserId]
  );

  const handleExportCSV = () => {
    window.open("/api/export/excel?module=audit-logs", "_blank");
  };

  const getActionBadge = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes("approved")) return <Badge color="success" size="sm">{action}</Badge>;
    if (act.includes("correction") || act.includes("rejected")) return <Badge color="warning" size="sm">{action}</Badge>;
    if (act.includes("created") || act.includes("submitted")) return <Badge color="primary" size="sm">{action}</Badge>;
    if (act.includes("deleted")) return <Badge color="error" size="sm">{action}</Badge>;
    return <Badge color="light" size="sm">{action}</Badge>;
  };

  const getInitials = (name: string) =>
    name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';

  const totalEvents = auditLogs.length;
  const totalUsers = userSummaries.length;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Breadcrumb (visible when in events view) */}
          {viewMode === 'events' && (
            <button
              type="button"
              onClick={() => { setViewMode('users'); setSelectedUserId(null); }}
              className="mb-1 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10 transition"
            >
              <ArrowRight className="h-3.5 w-3.5 rotate-180" />
              <span>Back to Audit &amp; Governance Trail · Users</span>
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {viewMode === 'events' && selectedUser
                ? selectedUser.user.name
                : 'Audit & Governance Trail'}
            </h1>
            <Badge color="primary" size="sm">
              {viewMode === 'events' && selectedUser
                ? `${selectedUser.eventCount} Events`
                : `${totalEvents} Events`}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {viewMode === 'users'
              ? `${totalUsers} active users · click a user to view their activity trail.`
              : selectedUser
                ? `Activity trail for ${selectedUser.user.name}.`
                : 'Immutable chronological record of submissions, approvals, corrections, enrollments, and status modifications.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5 transition cursor-pointer"
          >
            <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Export
          </button>
        </div>
      </div>

      {/* Search + filters (shown in both views) */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative w-full md:max-w-sm">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={viewMode === 'users' ? 'Search by name, email, role…' : 'Search by user, action, details…'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>

        {viewMode === 'events' && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedModule} onValueChange={setSelectedModule}>
              <SelectTrigger className="w-44 rounded-lg border-gray-300 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800">
                <SelectValue placeholder="All Modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                <SelectItem value="Attendance">Attendance</SelectItem>
                <SelectItem value="Lesson Plan">Lesson Plans</SelectItem>
                <SelectItem value="Finance">Finance</SelectItem>
                <SelectItem value="Sessions">Sessions</SelectItem>
                <SelectItem value="Correction Request">Correction Requests</SelectItem>
                <SelectItem value="Students">Students</SelectItem>
                <SelectItem value="Clusters">Clusters</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger className="w-36 rounded-lg border-gray-300 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="approved">Approvals</SelectItem>
                <SelectItem value="correction">Corrections</SelectItem>
                <SelectItem value="submitted">Submissions</SelectItem>
                <SelectItem value="created">Creations</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* View: USERS */}
      {viewMode === 'users' && (
        filteredUsers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center dark:border-gray-800 dark:bg-white/[0.02]">
            <UserIcon className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No users found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((summary) => {
              const u = summary.user;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { setSelectedUserId(u.id); setViewMode('events'); }}
                  className="group flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_4px_24px_-12px_rgba(0,0,0,0.08)] dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-brand-800"
                >
                  {/* Header: avatar + name + role */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white">
                        {getInitials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">{u.name}</div>
                        {u.email && (
                          <div className="truncate font-mono text-[11px] text-gray-500 dark:text-gray-400">{u.email}</div>
                        )}
                      </div>
                    </div>
                    <Badge color={u.role === 'Super Admin' ? 'primary' : 'light'} size="sm">{u.role}</Badge>
                  </div>

                  {/* Cluster */}
                  {u.clusterName && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <MapPin className="h-3 w-3 text-gray-400" />
                      <span className="truncate">{u.clusterName}</span>
                    </div>
                  )}

                  {/* Activity counters */}
                  <div className="grid grid-cols-4 divide-x divide-gray-100 border-y border-gray-100 py-3 dark:divide-gray-800 dark:border-gray-800">
                    <div className="px-1 text-center">
                      <div className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{summary.eventCount}</div>
                      <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Events</div>
                    </div>
                    <div className="px-1 text-center">
                      <div className="text-sm font-semibold tabular-nums text-success-600 dark:text-success-400">{summary.approvedCount}</div>
                      <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Approved</div>
                    </div>
                    <div className="px-1 text-center">
                      <div className="text-sm font-semibold tabular-nums text-warning-600 dark:text-warning-400">{summary.rejectedCount}</div>
                      <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Corrections</div>
                    </div>
                    <div className="px-1 text-center">
                      <div className="text-sm font-semibold tabular-nums text-brand-600 dark:text-brand-400">{summary.createdCount}</div>
                      <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Created</div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                      <Clock className="h-3 w-3" />
                      <span className="tabular-nums">{summary.lastActivity}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}

      {/* View: EVENTS for selected user */}
      {viewMode === 'events' && (
        <>
          {/* User header card */}
          {selectedUser && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white">
                  {getInitials(selectedUser.user.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-base font-semibold text-gray-900 dark:text-white">{selectedUser.user.name}</span>
                    <Badge color={selectedUser.user.role === 'Super Admin' ? 'primary' : 'light'} size="sm">
                      {selectedUser.user.role}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {selectedUser.user.email && (
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Mail className="h-3 w-3" />{selectedUser.user.email}
                      </span>
                    )}
                    {selectedUser.user.phone && (
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Phone className="h-3 w-3" />{selectedUser.user.phone}
                      </span>
                    )}
                    {selectedUser.user.clusterName && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{selectedUser.user.clusterName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-4 text-xs">
                  <div className="text-center">
                    <div className="text-base font-semibold tabular-nums text-gray-900 dark:text-white">{selectedUser.eventCount}</div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Events</div>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-semibold tabular-nums text-success-600 dark:text-success-400">{selectedUser.approvedCount}</div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Approved</div>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-semibold tabular-nums text-warning-600 dark:text-warning-400">{selectedUser.rejectedCount}</div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Corrections</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Events table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader className="w-[180px]">Timestamp</TableCell>
                  <TableCell isHeader>Action</TableCell>
                  <TableCell isHeader>Module</TableCell>
                  <TableCell isHeader>Cluster</TableCell>
                  <TableCell isHeader>Event Details</TableCell>
                  <TableCell isHeader className="text-right w-20"></TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-sm text-gray-400">
                      No matching events.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow
                      key={log.id}
                      onClick={() => setDetailLog(log)}
                      className="cursor-pointer hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <TableCell className="font-mono text-xs whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {log.timestamp}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{getActionBadge(log.action)}</TableCell>
                      <TableCell className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {log.module}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {log.clusterName || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-gray-700 dark:text-gray-300 max-w-[420px]">
                        <div className="truncate" title={log.details}>{log.details}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Event detail modal */}
      {detailLog && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-gray-900/60 p-4 backdrop-blur-sm"
          onClick={() => setDetailLog(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-xl border border-gray-200 bg-white p-5 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900 animate-in fade-in-0 zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Event Details</h3>
              <button
                type="button"
                onClick={() => setDetailLog(null)}
                aria-label="Close"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Action</div>
                  <div className="mt-1">{getActionBadge(detailLog.action)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Timestamp</div>
                  <div className="mt-1 font-mono text-xs text-gray-700 dark:text-gray-300">{detailLog.timestamp}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-y border-gray-100 py-3 dark:border-gray-800">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">User</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{detailLog.userName}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">{detailLog.userRole}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Module</div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{detailLog.module}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Cluster</div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{detailLog.clusterName || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Record ID</div>
                  <div className="mt-1 font-mono text-xs text-gray-700 dark:text-gray-300 break-all">{detailLog.recordId}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Details</div>
                <div className="mt-1 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2 text-xs text-gray-700 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-300">
                  {detailLog.details}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedUserId(detailLog.userId);
                  setDetailLog(null);
                  setViewMode('events');
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5 transition"
              >
                View all by this user
                <ArrowRight className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setDetailLog(null)}
                className="rounded-md bg-brand-500 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
