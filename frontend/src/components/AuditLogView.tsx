import React, { useState, useMemo } from "react";
import { AuditLogEntry } from "../types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import Badge from "./ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableCell } from "./ui/table";
import { Search, Download } from "lucide-react";

interface AuditLogViewProps {
  auditLogs: AuditLogEntry[];
  userRole: "Super Admin" | "Cluster Admin";
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ auditLogs = [], userRole }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModule, setSelectedModule] = useState("all");
  const [selectedAction, setSelectedAction] = useState("all");

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (selectedModule !== "all" && log.module !== selectedModule) return false;
      if (selectedAction !== "all" && !log.action.toLowerCase().includes(selectedAction.toLowerCase())) return false;

      if (searchTerm) {
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
  }, [auditLogs, selectedModule, selectedAction, searchTerm]);

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

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Audit & Governance Trail
            </h1>
            <Badge color="primary" size="sm">
              {filteredLogs.length} Events Logged
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Immutable chronological record of submissions, approvals, corrections, enrollments, and status modifications.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5 transition cursor-pointer self-start sm:self-auto"
        >
          <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Export CSV / Excel
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by user, action, details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-48">
            <Select
              value={selectedModule || "all"}
              onValueChange={(val) => setSelectedModule(val)}
            >
              <SelectTrigger className="h-9 text-xs">
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
          </div>

          <div className="w-40">
            <Select
              value={selectedAction || "all"}
              onValueChange={(val) => setSelectedAction(val)}
            >
              <SelectTrigger className="h-9 text-xs">
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
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell isHeader className="w-[180px]">Timestamp</TableCell>
              <TableCell isHeader>User</TableCell>
              <TableCell isHeader>Role</TableCell>
              <TableCell isHeader>Action</TableCell>
              <TableCell isHeader>Module</TableCell>
              <TableCell isHeader>Cluster</TableCell>
              <TableCell isHeader>Event Details</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-400 dark:text-gray-500">
                  No matching audit log events found.
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors">
                  <TableCell className="text-gray-500 dark:text-gray-400 font-mono text-xs whitespace-nowrap">
                    {log.timestamp}
                  </TableCell>
                  <TableCell className="font-semibold text-gray-900 dark:text-white text-xs whitespace-nowrap">
                    {log.userName}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge color={log.userRole === "Super Admin" ? "primary" : "light"} size="sm">
                      {log.userRole}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {getActionBadge(log.action)}
                  </TableCell>
                  <TableCell className="font-medium text-gray-700 dark:text-gray-300 text-xs whitespace-nowrap">
                    {log.module}
                  </TableCell>
                  <TableCell className="text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                    {log.clusterName || "Central"}
                  </TableCell>
                  <TableCell className="text-gray-700 dark:text-gray-300 text-xs max-w-[340px]">
                    <div className="truncate" title={log.details}>
                      {log.details}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
