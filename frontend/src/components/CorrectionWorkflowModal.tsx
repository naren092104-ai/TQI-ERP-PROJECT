import React, { useState } from 'react';

interface CorrectionWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleName: 'Attendance' | 'Lesson Plan' | 'Finance' | 'Sessions';
  recordId: string;
  recordTitle: string;
  clusterName?: string;
  onSubmit: (reason: string) => void;
}

export const CorrectionWorkflowModal: React.FC<CorrectionWorkflowModalProps> = ({
  isOpen,
  onClose,
  moduleName,
  recordId,
  recordTitle,
  clusterName = 'Dharmapuri Cluster',
  onSubmit,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a mandatory reason explaining why correction is required.');
      return;
    }
    onSubmit(reason.trim());
    setReason('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50  flex items-center justify-center p-4">
      <div className="bg-white border border-[#c4c6d3] rounded-md w-full max-w-lg shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-[#002869] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-[#FF7A00]">
              edit_note
            </span>
            <div>
              <h3 className="text-base font-bold">Request Record Correction</h3>
              <p className="text-[11px] text-slate-200">
                Submit formal edit request to Super Admin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-full cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Target Record Info Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-1">
            <div className="flex justify-between items-center text-slate-500 text-[10.5px]">
              <span className="font-bold uppercase tracking-wider">{moduleName}</span>
              <span>{clusterName}</span>
            </div>
            <p className="font-bold text-[#002869] text-sm">{recordTitle}</p>
            <p className="text-[11px] text-slate-400 font-mono">ID: {recordId}</p>
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700">
              Mandatory Correction Reason *
            </label>
            <p className="text-[11px] text-slate-500">
              Explain clearly what needs to be changed (e.g. "Marked student absent by mistake", "Re-attaching legible bus receipt", etc.).
            </p>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              placeholder="Provide a detailed explanation for Super Admin review..."
              className="w-full bg-[#f8fafc] border border-slate-300 rounded-md p-3 text-xs text-slate-800 focus:outline-none focus:border-[#002869]"
            />
            {error && <p className="text-[11px] font-semibold text-red-600">{error}</p>}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 flex items-start gap-2 text-amber-900 text-[11px]">
            <span className="material-symbols-outlined text-[16px] text-amber-700 shrink-0 mt-0.5">
              info
            </span>
            <span>
              Once approved by the Super Admin, the record will be unlocked for editing and resubmission.
            </span>
          </div>

          <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#002869] hover:bg-[#001f52] text-white rounded-md font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
              Submit Request to Super Admin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


