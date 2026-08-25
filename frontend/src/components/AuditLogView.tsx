import React, { useState, useMemo } from 'react';
import { AuditLogEntry } from '../types';

interface AuditLogViewProps {
  auditLogs: AuditLogEntry[];
  userRole: 'Super Admin' | 'Cluster Admin';
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ auditLogs = [], userRole }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (selectedModule !== 'all' && log.module !== selectedModule) return false;
      if (selectedAction !== 'all' && !log.action.toLowerCase().includes(selectedAction.toLowerCase())) return false;

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
    window.open('/api/export/excel?module=audit-logs', '_blank');
  };

  const getActionBadgeColor = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('approved')) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (act.includes('correction') || act.includes('rejected')) return 'bg-amber-50 text-amber-900 border-amber-200';
    if (act.includes('created') || act.includes('submitted')) return 'bg-blue-50 text-blue-800 border-blue-200';
    if (act.includes('deleted')) return 'bg-red-50 text-red-800 border-red-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-[#c4c6d3]/80 rounded-md p-4 md:p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-[#002869] text-white flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">history_edu</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-[#002869] tracking-tight">
              Audit & Governance Trail
            </h1>
            <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
              {filteredLogs.length} Events Logged
            </span>
          </div>
          <p className="text-xs text-[#747783] mt-1">
            Immutable chronological record of submissions, approvals, corrections, enrollments, and status modifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined text-[16px] text-emerald-600">table_view</span>
            Export CSV / Excel
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#c4c6d3]/80 rounded-md p-3 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Module Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">Module:</span>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="bg-[#f8fafc] border border-slate-300 rounded-md px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:border-[#002869] cursor-pointer"
            >
              <option value="all">All Modules</option>
              <option value="Attendance">Attendance</option>
              <option value="Lesson Plan">Lesson Plans</option>
              <option value="Finance">Finance</option>
              <option value="Sessions">Sessions</option>
              <option value="Correction Request">Correction Requests</option>
              <option value="Students">Students</option>
              <option value="Clusters">Clusters</option>
            </select>
          </div>

          {/* Action Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">Action:</span>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="bg-[#f8fafc] border border-slate-300 rounded-md px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:border-[#002869] cursor-pointer"
            >
              <option value="all">All Actions</option>
              <option value="approved">Approvals</option>
              <option value="correction">Corrections</option>
              <option value="submitted">Submissions</option>
              <option value="created">Creations</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <span className="material-symbols-outlined absolute left-2.5 top-2 text-[18px] text-slate-400">
            search
          </span>
          <input
            type="text"
            placeholder="Search by user, action, details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#f8fafc] border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#002869]"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-[#c4c6d3]/80 rounded-md overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] text-[#002869] font-bold border-b border-slate-200">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Cluster</th>
                <th className="py-3 px-4">Event Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No matching audit log events found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {log.timestamp}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                      {log.userName}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.userRole === 'Super Admin'
                            ? 'bg-[#002869] text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {log.userRole}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10.5px] font-semibold border ${getActionBadgeColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-600">
                      {log.module}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {log.clusterName || 'Central'}
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-[320px]">
                      <div className="truncate" title={log.details}>
                        {log.details}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

