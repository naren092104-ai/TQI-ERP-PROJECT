import React, { useState, useMemo } from 'react';
import { FileText, Users, ClipboardList, AlertTriangle, MessageSquare, Save, Send, Eye, XCircle, Search } from 'lucide-react';
import type { SessionReport, Session, UserRole } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface SessionReportViewProps {
  sessionReports: SessionReport[];
  sessions: Session[];
  clusters: { id: string; name: string }[];
  currentUserRole: UserRole;
  currentUserClusterId: string;
  onSaveReport: (report: Partial<SessionReport>) => Promise<void>;
  onDeleteReport: (reportId: string) => Promise<void>;
}

const SessionReportView: React.FC<SessionReportViewProps> = ({
  sessionReports,
  sessions,
  clusters,
  currentUserRole,
  currentUserClusterId,
  onSaveReport,
  onDeleteReport
}) => {
  const isSuperAdmin = currentUserRole === 'Super Admin';
  const [activeTab, setActiveTab] = useState<'All' | 'DRAFT' | 'SUBMITTED' | 'APPROVED'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SessionReport | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<SessionReport>>({
    sessionId: '',
    sessionSummary: '',
    studentCount: 0,
    attendanceSummary: '',
    activities: '',
    issues: '',
    remarks: '',
  });

  const clusterSessions = useMemo(() => {
    return isSuperAdmin ? sessions : sessions.filter(s => s.clusterId === currentUserClusterId);
  }, [sessions, isSuperAdmin, currentUserClusterId]);

  const visibleReports = useMemo(() => {
    let filtered = sessionReports;
    if (!isSuperAdmin) {
      filtered = filtered.filter(r => r.clusterId === currentUserClusterId);
    }
    
    if (activeTab !== 'All') {
      filtered = filtered.filter(r => r.status === activeTab);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r => {
        const session = sessions.find(s => s.id === r.sessionId);
        return session?.name.toLowerCase().includes(q) || r.clusterName?.toLowerCase().includes(q);
      });
    }
    return filtered;
  }, [sessionReports, currentUserClusterId, isSuperAdmin, activeTab, searchQuery, sessions]);

  const handleOpenForm = (report?: SessionReport) => {
    if (report) {
      setFormData(report);
    } else {
      setFormData({
        sessionId: '',
        sessionSummary: '',
        studentCount: 0,
        attendanceSummary: '',
        activities: '',
        issues: '',
        remarks: '',
      });
    }
    setShowFormModal(true);
  };

  const handleSave = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (!formData.sessionId) return;
    setIsSubmitting(true);
    try {
      await onSaveReport({ ...formData, status });
      setShowFormModal(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">Draft</span>;
      case 'SUBMITTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Submitted</span>;
      case 'APPROVED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Approved</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            Session Reports
            <span className="bg-brand-100 text-brand-800 text-sm font-medium px-2.5 py-0.5 rounded-full dark:bg-brand-900/30 dark:text-brand-300">
              {sessionReports.length}
            </span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Detailed qualitative session reporting</p>
        </div>
        
        <button 
          onClick={() => handleOpenForm()}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg transition-colors font-medium"
        >
          <FileText className="h-4 w-4" />
          New Report
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex space-x-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
            {['All', 'DRAFT', 'SUBMITTED', 'APPROVED'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === tab 
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300' 
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                {tab === 'All' ? 'All Reports' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search session or cluster..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
          {visibleReports.map((report) => {
            const session = sessions.find(s => s.id === report.sessionId);
            return (
              <div key={report.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate" title={session?.name || 'Unknown Session'}>
                      {session?.name || 'Unknown Session'}
                    </h3>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Day {report.dayNumber || session?.dayNumber} {isSuperAdmin && `• ${report.clusterName}`}
                    </div>
                  </div>
                  {getStatusBadge(report.status)}
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-4 h-15">
                  {report.sessionSummary || <span className="text-gray-400 italic">No summary provided</span>}
                </p>

                <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <Users className="h-4 w-4" />
                    <span>{report.studentCount} Students</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSelectedReport(report); setShowViewModal(true); }}
                      className="p-1.5 text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 rounded-md hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {!isSuperAdmin && report.status === 'DRAFT' && (
                      <button
                        onClick={() => handleOpenForm(report)}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 px-2 py-1"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {visibleReports.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400">
              No session reports found matching your filters.
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {formData.id ? 'Edit Session Report' : 'New Session Report'}
              </h3>
              <button onClick={() => setShowFormModal(false)} className="text-gray-400 hover:text-gray-500">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Session</label>
                <Select
                  value={formData.sessionId}
                  onValueChange={(val) => setFormData({ ...formData, sessionId: val })}
                  disabled={!!formData.id}
                >
                  <SelectTrigger className="w-full h-10 text-xs rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 disabled:opacity-60">
                    <SelectValue placeholder="Select a session" />
                  </SelectTrigger>
                  <SelectContent>
                    {clusterSessions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} (Day {s.dayNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Session Summary
                </label>
                <textarea
                  value={formData.sessionSummary}
                  onChange={(e) => setFormData({...formData, sessionSummary: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Provide a general summary of how the session went..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <Users className="h-4 w-4" /> Student Count
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.studentCount}
                    onChange={(e) => setFormData({...formData, studentCount: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <ClipboardList className="h-4 w-4" /> Attendance Summary
                  </label>
                  <textarea
                    value={formData.attendanceSummary}
                    onChange={(e) => setFormData({...formData, attendanceSummary: e.target.value})}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Brief note on attendance..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Activities Conducted
                </label>
                <textarea
                  value={formData.activities}
                  onChange={(e) => setFormData({...formData, activities: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Detail the activities carried out..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
                  <AlertTriangle className="h-4 w-4" /> Issues / Challenges
                </label>
                <textarea
                  value={formData.issues}
                  onChange={(e) => setFormData({...formData, issues: e.target.value})}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Note any challenges faced during the session..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4" /> General Remarks
                </label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Any additional remarks..."
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg dark:text-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave('DRAFT')}
                disabled={isSubmitting || !formData.sessionId}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg dark:text-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save Draft
              </button>
              <button
                onClick={() => handleSave('SUBMITTED')}
                disabled={isSubmitting || !formData.sessionId}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-3">
                Report Details
                {getStatusBadge(selectedReport.status)}
              </h3>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-500">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block font-medium text-gray-500 dark:text-gray-400">Session</span>
                  <span className="block mt-1 text-gray-900 dark:text-gray-200 font-medium">
                    {sessions.find(s => s.id === selectedReport.sessionId)?.name || 'Unknown'}
                  </span>
                </div>
                <div>
                  <span className="block font-medium text-gray-500 dark:text-gray-400">Cluster</span>
                  <span className="block mt-1 text-gray-900 dark:text-gray-200">{selectedReport.clusterName}</span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-2">
                  <FileText className="h-4 w-4" /> Session Summary
                </h4>
                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-300 whitespace-pre-wrap">
                  {selectedReport.sessionSummary}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-2">
                    <Users className="h-4 w-4" /> Student Count
                  </h4>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white px-3">
                    {selectedReport.studentCount}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-2">
                    <ClipboardList className="h-4 w-4" /> Attendance Summary
                  </h4>
                  <div className="text-sm text-gray-800 dark:text-gray-300 px-3">
                    {selectedReport.attendanceSummary || '-'}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-2">
                  <FileText className="h-4 w-4" /> Activities
                </h4>
                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-300 whitespace-pre-wrap">
                  {selectedReport.activities || '-'}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="h-4 w-4" /> Issues
                </h4>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30 text-sm text-gray-800 dark:text-gray-300 whitespace-pre-wrap">
                  {selectedReport.issues || '-'}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-2">
                  <MessageSquare className="h-4 w-4" /> Remarks
                </h4>
                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-300 whitespace-pre-wrap">
                  {selectedReport.remarks || '-'}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end shrink-0">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg dark:text-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
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

export default SessionReportView;
