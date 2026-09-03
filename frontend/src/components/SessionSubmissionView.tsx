import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, XCircle, ChevronDown, ChevronRight, AlertCircle, 
  Send, RotateCcw, Clock, Eye, FileText, Image, DollarSign, CalendarDays, Users
} from './ui/icons';
import type { SessionSubmission, Session, UserRole } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface SessionSubmissionViewProps {
  sessionSubmissions: SessionSubmission[];
  sessions: Session[];
  clusters: { id: string; name: string }[];
  currentUserRole: UserRole;
  currentUserId: string;
  currentUserClusterId: string;
  onSubmitSession: (sessionId: string, clusterId: string, dayNumber: number) => Promise<{ success: boolean; error?: string; missingItems?: string[] }>;
  onReviewSubmission: (submissionId: string, action: 'approve' | 'resubmission', remarks: string) => Promise<void>;
  onResubmit: (submissionId: string) => Promise<void>;
  onNavigateToTab: (tab: string) => void;
}

const SessionSubmissionView: React.FC<SessionSubmissionViewProps> = ({
  sessionSubmissions,
  sessions,
  clusters,
  currentUserRole,
  currentUserId,
  currentUserClusterId,
  onSubmitSession,
  onReviewSubmission,
  onResubmit,
  onNavigateToTab
}) => {
  const isSuperAdmin = currentUserRole === 'Super Admin';
  const [selectedClusterId, setSelectedClusterId] = useState(isSuperAdmin ? '' : currentUserClusterId);
  const [selectedDay, setSelectedDay] = useState<number | ''>('');
  
  // Modals / State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<SessionSubmission | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'resubmission'>('approve');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [missingItems, setMissingItems] = useState<string[]>([]);

  // Derived data
  const activeSession = useMemo(() => {
    if (!selectedClusterId || !selectedDay) return null;
    return sessions.find(s => s.clusterId === selectedClusterId && s.dayNumber === selectedDay) || null;
  }, [sessions, selectedClusterId, selectedDay]);

  const currentSubmission = useMemo(() => {
    if (!activeSession) return null;
    return sessionSubmissions.find(s => s.sessionId === activeSession.id) || null;
  }, [sessionSubmissions, activeSession]);

  const adminSubmissions = useMemo(() => {
    if (!isSuperAdmin) return [];
    return sessionSubmissions.sort((a, b) => {
      // PENDING_REVIEW first
      if (a.status === 'PENDING_REVIEW' && b.status !== 'PENDING_REVIEW') return -1;
      if (b.status === 'PENDING_REVIEW' && a.status !== 'PENDING_REVIEW') return 1;
      return new Date(b.submittedAt || '').getTime() - new Date(a.submittedAt || '').getTime();
    });
  }, [sessionSubmissions, isSuperAdmin]);

  const handleSubmit = async () => {
    if (!activeSession) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setMissingItems([]);
    try {
      const res = await onSubmitSession(activeSession.id, selectedClusterId, selectedDay as number);
      if (!res.success) {
        setSubmitError(res.error || 'Failed to submit session.');
        if (res.missingItems) setMissingItems(res.missingItems);
      }
    } catch (e) {
      setSubmitError('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewSubmit = async () => {
    if (!selectedSubmission) return;
    setIsSubmitting(true);
    try {
      await onReviewSubmission(selectedSubmission.id, reviewAction, reviewRemarks);
      setShowReviewModal(false);
      setSelectedSubmission(null);
      setReviewRemarks('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResubmit = async (submissionId: string) => {
    setIsSubmitting(true);
    try {
      await onResubmit(submissionId);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'SUBMITTED': 
      case 'PENDING_REVIEW': return 'bg-blue-100 text-blue-800';
      case 'APPROVED': 
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'RESUBMISSION_REQUIRED': return 'bg-red-100 text-red-800';
      case 'RESUBMITTED': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderStepper = (status: string) => {
    const steps = ['Draft', 'Submitted', 'Pending Review', 'Approved/Completed'];
    let currentStepIndex = 0;
    
    if (status === 'SUBMITTED') currentStepIndex = 1;
    if (status === 'PENDING_REVIEW' || status === 'RESUBMISSION_REQUIRED' || status === 'RESUBMITTED') currentStepIndex = 2;
    if (status === 'APPROVED' || status === 'COMPLETED') currentStepIndex = 3;

    return (
      <div className="flex items-center w-full my-6">
        {steps.map((step, idx) => (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center relative z-10">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                idx < currentStepIndex 
                  ? 'bg-green-500 border-green-500 text-white' 
                  : idx === currentStepIndex
                    ? 'bg-brand-500 border-brand-500 text-white'
                    : 'bg-white border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-600'
              }`}>
                {idx < currentStepIndex ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
              </div>
              <span className={`text-xs mt-2 font-medium ${
                idx <= currentStepIndex ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {step}
              </span>
              {status === 'RESUBMISSION_REQUIRED' && idx === 2 && (
                <span className="text-[10px] text-red-500 font-bold mt-1">Needs Resubmission</span>
              )}
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-1 mx-2 ${
                idx < currentStepIndex ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const ValidationItem = ({ label, isComplete, tabRoute, icon: Icon }: { label: string, isComplete: boolean, tabRoute: string, icon: any }) => (
    <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isComplete ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="font-medium text-gray-800 dark:text-gray-200">{label}</span>
      </div>
      <div className="flex items-center gap-4">
        {isComplete ? (
          <span className="flex items-center text-sm font-medium text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-5 h-5 mr-1" /> Complete
          </span>
        ) : (
          <span className="flex items-center text-sm font-medium text-red-600 dark:text-red-400">
            <XCircle className="w-5 h-5 mr-1" /> Missing
          </span>
        )}
        <button 
          onClick={() => onNavigateToTab(tabRoute)}
          className="text-brand-600 hover:text-brand-700 text-sm font-medium flex items-center"
        >
          View <ChevronRight className="w-4 h-4 ml-0.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Session Submissions</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Submit or review complete session packages</p>
        </div>
      </div>

      {!isSuperAdmin ? (
        // CLUSTER ADMIN VIEW
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Select Session</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Session Day</label>
                  <Select
                    value={selectedDay ? String(selectedDay) : ''}
                    onValueChange={(val) => setSelectedDay(val ? Number(val) : '')}
                  >
                    <SelectTrigger className="w-full h-10 text-xs rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700">
                      <SelectValue placeholder="Select a day" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((day) => (
                        <SelectItem key={day} value={String(day)}>
                          Day {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {activeSession && (
                  <div className="p-3 bg-brand-50 dark:bg-brand-900/20 rounded-lg border border-brand-100 dark:border-brand-800">
                    <div className="text-sm font-medium text-brand-800 dark:text-brand-300">{activeSession.name}</div>
                    <div className="text-xs text-brand-600 dark:text-brand-400 mt-1">{new Date(activeSession.date).toLocaleDateString()}</div>
                  </div>
                )}
              </div>
            </div>

            {currentSubmission && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Submission Status</h3>
                
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Current Status:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(currentSubmission.status)}`}>
                    {currentSubmission.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {currentSubmission.status === 'RESUBMISSION_REQUIRED' && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-red-800 dark:text-red-300">Resubmission Required</h4>
                        <p className="text-sm text-red-700 dark:text-red-400 mt-1">{currentSubmission.resubmissionReason}</p>
                        
                        <button
                          onClick={() => handleResubmit(currentSubmission.id)}
                          disabled={isSubmitting}
                          className="mt-3 flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" /> Edit & Resubmit
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {renderStepper(currentSubmission.status)}

                {['PENDING_REVIEW', 'APPROVED', 'COMPLETED'].includes(currentSubmission.status) && (
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-800 dark:text-amber-300 text-sm flex items-start gap-2">
                    <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>This session is currently locked for review. You cannot edit these sections unless a resubmission is requested.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            {activeSession ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Validation Checklist</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">All items must be completed before you can submit the session.</p>
                </div>
                
                <div className="flex-1 flex flex-col">
                  {currentSubmission ? (
                    <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
                      <ValidationItem label="Attendance Complete" isComplete={currentSubmission.attendanceComplete} tabRoute="attendance" icon={Users} />
                      <ValidationItem label="Lesson Plan Complete" isComplete={currentSubmission.lessonPlanComplete} tabRoute="lesson-plan" icon={FileText} />
                      <ValidationItem label="Session Photos Uploaded" isComplete={currentSubmission.photosComplete} tabRoute="session-photos" icon={Image} />
                      <ValidationItem label="Session Report Complete" isComplete={currentSubmission.reportComplete} tabRoute="session-reports" icon={FileText} />
                      <ValidationItem label="Finance Statement Complete" isComplete={currentSubmission.financeComplete} tabRoute="finance-statement" icon={DollarSign} />
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                      <AlertCircle className="w-12 h-12 text-gray-300 mb-3" />
                      <p>No submission data found for this session yet.</p>
                    </div>
                  )}
                </div>

                <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  {submitError && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                      <span className="font-semibold">Error:</span> {submitError}
                      {missingItems.length > 0 && (
                        <ul className="list-disc ml-5 mt-1">
                          {missingItems.map(i => <li key={i}>{i}</li>)}
                        </ul>
                      )}
                    </div>
                  )}

                  {!currentSubmission || ['DRAFT', 'RESUBMITTED'].includes(currentSubmission.status) ? (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {currentSubmission && 
                         currentSubmission.attendanceComplete && 
                         currentSubmission.lessonPlanComplete && 
                         currentSubmission.photosComplete && 
                         currentSubmission.reportComplete && 
                         currentSubmission.financeComplete 
                         ? "All items complete. Ready to submit." 
                         : "Complete all checklist items to unlock submission."}
                      </p>
                      <button
                        onClick={handleSubmit}
                        disabled={
                          isSubmitting || 
                          !currentSubmission || 
                          !(currentSubmission.attendanceComplete && 
                            currentSubmission.lessonPlanComplete && 
                            currentSubmission.photosComplete && 
                            currentSubmission.reportComplete && 
                            currentSubmission.financeComplete)
                        }
                        className="w-full sm:w-auto px-6 py-2.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        Submit Session for Review
                      </button>
                    </div>
                  ) : (
                    <div className="text-center p-2 text-sm font-medium text-gray-600">
                      Submission is currently {currentSubmission.status.replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-8 text-center">
                <CalendarDays className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Session Selected</h3>
                <p className="max-w-md">Please select a session day from the panel to view its submission checklist and status.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        // SUPER ADMIN VIEW
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminSubmissions.map(sub => {
              const session = sessions.find(s => s.id === sub.sessionId);
              const isPending = sub.status === 'PENDING_REVIEW';
              
              return (
                <div key={sub.id} className={`bg-white dark:bg-gray-800 rounded-2xl border ${isPending ? 'border-brand-300 shadow-md ring-1 ring-brand-100' : 'border-gray-200 dark:border-gray-700 shadow-sm'} p-5 transition-all`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{sub.clusterName}</h3>
                      <p className="text-sm text-gray-500">Day {sub.dayNumber} • {session?.name}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(sub.status)}`}>
                      {sub.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="space-y-2 mb-5">
                    <div className="flex justify-between text-xs items-center">
                      <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5"><Users className="w-3.5 h-3.5"/> Attendance</span>
                      {sub.attendanceComplete ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="flex justify-between text-xs items-center">
                      <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5"/> Lesson Plan</span>
                      {sub.lessonPlanComplete ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="flex justify-between text-xs items-center">
                      <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5"><Image className="w-3.5 h-3.5"/> Photos</span>
                      {sub.photosComplete ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="flex justify-between text-xs items-center">
                      <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5"/> Report</span>
                      {sub.reportComplete ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="flex justify-between text-xs items-center">
                      <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5"/> Finance</span>
                      {sub.financeComplete ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                    </div>
                  </div>

                  {isPending && (
                    <button
                      onClick={() => { setSelectedSubmission(sub); setShowReviewModal(true); setReviewAction('approve'); }}
                      className="w-full py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2"
                    >
                      <Eye className="w-4 h-4" /> Review Submission
                    </button>
                  )}
                </div>
              );
            })}
            {adminSubmissions.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-500">
                No submissions found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review Modal for Super Admin */}
      {showReviewModal && selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Review Session Submission</h3>
              <button onClick={() => setShowReviewModal(false)} className="text-gray-400 hover:text-gray-500">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">Cluster</span>
                    <span className="font-medium text-gray-900 dark:text-white">{selectedSubmission.clusterName}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">Day</span>
                    <span className="font-medium text-gray-900 dark:text-white">Day {selectedSubmission.dayNumber}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-gray-500 block mb-1">Submitted On</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {selectedSubmission.submittedAt ? new Date(selectedSubmission.submittedAt).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Review Action</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewAction('approve')}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 font-medium flex items-center justify-center gap-2 transition-colors ${
                      reviewAction === 'approve' 
                        ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' 
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewAction('resubmission')}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 font-medium flex items-center justify-center gap-2 transition-colors ${
                      reviewAction === 'resubmission' 
                        ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' 
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <RotateCcw className="w-4 h-4" /> Request Resubmit
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {reviewAction === 'approve' ? 'Remarks (Optional)' : 'Reason for Resubmission (Required)'}
                </label>
                <textarea
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  rows={3}
                  required={reviewAction === 'resubmission'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder={reviewAction === 'approve' ? "Add any notes here..." : "Explain what needs to be fixed..."}
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg dark:text-gray-300 dark:bg-gray-700 dark:border-gray-600 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleReviewSubmit}
                disabled={isSubmitting || (reviewAction === 'resubmission' && !reviewRemarks.trim())}
                className={`px-6 py-2 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 ${
                  reviewAction === 'approve' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                <Send className="w-4 h-4" />
                Submit Decision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionSubmissionView;
