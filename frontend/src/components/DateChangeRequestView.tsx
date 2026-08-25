import React, { useState, useMemo } from 'react';
import { Calendar, Clock, CheckCircle2, XCircle, Send, AlertCircle, Filter, Search, ChevronDown, Eye } from 'lucide-react';
import type { DateChangeRequest, Session, UserRole } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface DateChangeRequestViewProps {
  dateChangeRequests: DateChangeRequest[];
  sessions: Session[];
  currentUserRole: UserRole;
  currentUserId: string;
  currentUserClusterId: string;
  onSubmitRequest: (sessionId: string, originalDate: string, requestedDate: string, reason: string) => Promise<void>;
  onReviewRequest: (requestId: string, action: 'approve' | 'reject', remarks: string) => Promise<void>;
}

const DateChangeRequestView: React.FC<DateChangeRequestViewProps> = ({
  dateChangeRequests,
  sessions,
  currentUserRole,
  currentUserId,
  currentUserClusterId,
  onSubmitRequest,
  onReviewRequest
}) => {
  const [activeTab, setActiveTab] = useState<'All' | 'PENDING' | 'APPROVED' | 'REJECTED'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DateChangeRequest | null>(null);

  // New Request Form State
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [reason, setReason] = useState('');

  // Review Form State
  const [reviewRemarks, setReviewRemarks] = useState('');

  const isSuperAdmin = currentUserRole === 'Super Admin';

  const visibleRequests = useMemo(() => {
    let filtered = dateChangeRequests;
    if (!isSuperAdmin) {
      filtered = filtered.filter(req => req.clusterId === currentUserClusterId);
    }
    
    if (activeTab !== 'All') {
      filtered = filtered.filter(req => req.status === activeTab);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(req => {
        const session = sessions.find(s => s.id === req.sessionId);
        return session?.name.toLowerCase().includes(q) || req.clusterName?.toLowerCase().includes(q);
      });
    }
    return filtered;
  }, [dateChangeRequests, currentUserClusterId, isSuperAdmin, activeTab, searchQuery, sessions]);

  const clusterSessions = useMemo(() => {
    return sessions.filter(s => s.clusterId === currentUserClusterId);
  }, [sessions, currentUserClusterId]);

  const handleNewRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const session = clusterSessions.find(s => s.id === selectedSessionId);
    if (!session || !requestedDate || !reason) return;
    
    setIsSubmitting(true);
    try {
      await onSubmitRequest(selectedSessionId, session.date, requestedDate, reason);
      setShowNewModal(false);
      setSelectedSessionId('');
      setRequestedDate('');
      setReason('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewSubmit = async (action: 'approve' | 'reject') => {
    if (!selectedRequest) return;
    setIsSubmitting(true);
    try {
      await onReviewRequest(selectedRequest.id, action, reviewRemarks);
      setShowReviewModal(false);
      setSelectedRequest(null);
      setReviewRemarks('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Pending</span>;
      case 'APPROVED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Approved</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Rejected</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            Date Change Requests
            <span className="bg-brand-100 text-brand-800 text-sm font-medium px-2.5 py-0.5 rounded-full dark:bg-brand-900/30 dark:text-brand-300">
              {dateChangeRequests.length}
            </span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage and track session date changes</p>
        </div>
        
        {!isSuperAdmin && (
          <button 
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            <Calendar className="h-4 w-4" />
            New Request
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Filters and Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex space-x-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
            {['All', 'PENDING', 'APPROVED', 'REJECTED'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === tab 
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300' 
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                {tab === 'All' ? 'All Requests' : tab.charAt(0) + tab.slice(1).toLowerCase()}
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

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
                {isSuperAdmin && <th className="p-4 font-medium">Cluster</th>}
                <th className="p-4 font-medium">Session</th>
                <th className="p-4 font-medium">Original Date</th>
                <th className="p-4 font-medium">Requested Date</th>
                <th className="p-4 font-medium">Reason</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {visibleRequests.map((req) => {
                const session = sessions.find(s => s.id === req.sessionId);
                return (
                  <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    {isSuperAdmin && (
                      <td className="p-4 text-sm text-gray-800 dark:text-gray-200">
                        {req.clusterName || 'Unknown Cluster'}
                      </td>
                    )}
                    <td className="p-4 text-sm text-gray-800 dark:text-gray-200 font-medium">
                      {session?.name || 'Unknown Session'}
                      <div className="text-xs text-gray-500 dark:text-gray-400">Day {req.dayNumber || session?.dayNumber}</div>
                    </td>
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(req.originalDate).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400 font-medium">
                      {new Date(req.requestedDate).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate" title={req.reason}>
                      {req.reason}
                    </td>
                    <td className="p-4">
                      {getStatusBadge(req.status)}
                    </td>
                    <td className="p-4">
                      {isSuperAdmin && req.status === 'PENDING' ? (
                        <button
                          onClick={() => { setSelectedRequest(req); setShowReviewModal(true); }}
                          className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium"
                        >
                          <Eye className="h-4 w-4" />
                          Review
                        </button>
                      ) : (
                        <button
                          onClick={() => { setSelectedRequest(req); setShowReviewModal(true); }}
                          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visibleRequests.length === 0 && (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No date change requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Request Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New Date Change Request</h3>
              <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-gray-500">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleNewRequestSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Session</label>
                <Select
                  value={selectedSessionId}
                  onValueChange={(val) => setSelectedSessionId(val)}
                >
                  <SelectTrigger className="w-full h-10 text-xs rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700">
                    <SelectValue placeholder="Select a session" />
                  </SelectTrigger>
                  <SelectContent>
                    {clusterSessions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} (Original: {s.date})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedSessionId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Original Date</label>
                  <input
                    type="text"
                    disabled
                    value={clusterSessions.find(s => s.id === selectedSessionId)?.date || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Requested New Date</label>
                <input
                  type="date"
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason for Change</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Explain why the date needs to be changed..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review / Details Modal */}
      {showReviewModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isSuperAdmin && selectedRequest.status === 'PENDING' ? 'Review Request' : 'Request Details'}
              </h3>
              <button onClick={() => { setShowReviewModal(false); setSelectedRequest(null); }} className="text-gray-400 hover:text-gray-500">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Cluster</span>
                  <span className="block text-sm text-gray-900 dark:text-gray-200">{selectedRequest.clusterName || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Original Date</span>
                  <span className="block text-sm text-gray-900 dark:text-gray-200">{new Date(selectedRequest.originalDate).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Requested Date</span>
                  <span className="block text-sm font-semibold text-brand-600 dark:text-brand-400">{new Date(selectedRequest.requestedDate).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div>
                <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Reason</span>
                <p className="mt-1 text-sm text-gray-800 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                  {selectedRequest.reason}
                </p>
              </div>

              {selectedRequest.status !== 'PENDING' && selectedRequest.reviewRemarks && (
                <div>
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Review Remarks</span>
                  <p className="mt-1 text-sm text-gray-800 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                    {selectedRequest.reviewRemarks}
                  </p>
                </div>
              )}

              {isSuperAdmin && selectedRequest.status === 'PENDING' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Remarks (Optional)</label>
                  <textarea
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 mt-6">
                {isSuperAdmin && selectedRequest.status === 'PENDING' ? (
                  <>
                    <button
                      onClick={() => handleReviewSubmit('reject')}
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleReviewSubmit('approve')}
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      Approve Change
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setShowReviewModal(false); setSelectedRequest(null); }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateChangeRequestView;
