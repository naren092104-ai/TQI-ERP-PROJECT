import React, { useEffect, useState, useRef } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Printer, Loader2 } from 'lucide-react';
import {
  X,
  Download,
  ExternalLink,
  AlertCircle,
  FileText,
  RotateCcw,
} from './ui/icons';
import { apiUrl } from '../utils/api';
import {
  VillageAttendancePdf,
  VillageAttendanceReportData,
  formatShortAcademicYear,
} from '../utils/pdf/VillageAttendancePdf';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  villageId: string;
  standard?: string;
  villageName?: string;
  panchayatName?: string;
  clusterName?: string;
  academicYear?: string;
}

export const VillageAttendancePdfViewer: React.FC<Props> = ({
  isOpen,
  onClose,
  villageId,
  standard = 'all',
  villageName = '',
  panchayatName = '',
  clusterName = '',
  academicYear,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [reportData, setReportData] = useState<VillageAttendanceReportData | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const fetchAndBuildPdf = async () => {
    if (!villageId) return;
    setLoading(true);
    setError(null);

    try {
      let token = '';
      try {
        const sessionStr = localStorage.getItem('tqi_auth_session');
        if (sessionStr) {
          const sessionObj = JSON.parse(sessionStr);
          token = sessionObj.token || sessionObj.accessToken || '';
        }
      } catch {}
      if (!token) {
        token = localStorage.getItem('tqi_auth_token') || '';
      }

      const params = new URLSearchParams({ villageId });
      if (standard && standard !== 'all') {
        params.append('standard', standard);
      }
      if (academicYear) {
        params.append('academicYear', academicYear);
      }

      const requestUrl = apiUrl(`/api/attendance/village-report?${params.toString()}`);
      const res = await fetch(requestUrl, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load report (HTTP ${res.status})`);
      }

      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || 'No report data received.');
      }

      const data: VillageAttendanceReportData = json.data;
      if (academicYear && !data.academicYear) {
        data.academicYear = academicYear;
      }

      // Pre-fetch logo as base64 for rock-solid embedded rendering
      try {
        const logoRes = await fetch('/logo.png');
        if (logoRes.ok) {
          const blob = await logoRes.blob();
          const logoBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          data.logoUrl = logoBase64;
        }
      } catch {
        data.logoUrl = typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : '/logo.png';
      }

      setReportData(data);

      // Render PDF into Blob
      const docElement = React.createElement(VillageAttendancePdf, { data }) as unknown as Parameters<typeof pdf>[0];
      const blob = await pdf(docElement).toBlob();
      const url = URL.createObjectURL(blob);

      // Revoke previous url if any
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      setPdfUrl(url);
    } catch (err: any) {
      console.error('VillageAttendancePdfViewer error:', err);
      setError(err.message || 'Unable to generate attendance PDF.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && villageId) {
      fetchAndBuildPdf();
    } else {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
      setReportData(null);
      setError(null);
    }

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [isOpen, villageId, standard, academicYear]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!pdfUrl) return;
    const safeVillage = (reportData?.village?.name || villageName || 'Village').replace(/[^a-zA-Z0-9]+/g, '_');
    const yr = reportData?.academicYear || academicYear || '2025-2026';
    const safeYear = yr.replace(/[^a-zA-Z0-9_-]/g, '');
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `TQI_Physical_Attendance_Sheet_${safeVillage}_${safeYear}.pdf`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    if (!iframeRef.current || !pdfUrl) return;
    try {
      iframeRef.current.contentWindow?.print();
    } catch {
      const printWindow = window.open(pdfUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
  };

  const handleOpenNewTab = () => {
    if (!pdfUrl) return;
    window.open(pdfUrl, '_blank');
  };

  const displayTitle = reportData?.village?.name || villageName || 'Village';
  const displayPanchayat = reportData?.panchayat?.name || panchayatName;
  const displayCluster = reportData?.cluster?.name || clusterName;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#1F4E79]/10 text-[#1F4E79] dark:bg-blue-900/30 dark:text-blue-300 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  Physical Attendance Sheet — {displayTitle}
                </h2>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#1F4E79] text-white">
                  SHDP {formatShortAcademicYear(reportData?.academicYear || academicYear)}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {displayPanchayat && `Panchayat: ${displayPanchayat} • `}
                {displayCluster && `Cluster: ${displayCluster} • `}
                {reportData ? `${reportData.totalStudentsCount} Students` : 'Loading roster...'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {pdfUrl && !loading && (
              <>
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  title="Open in New Tab"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">New Tab</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  title="Print Attendance Sheet"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  title="Download PDF"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1F4E79] hover:bg-[#163a5c] text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download PDF</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              title="Close Viewer"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 sm:p-4 overflow-hidden relative flex flex-col">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs z-10 gap-3">
              <div className="w-10 h-10 border-3 border-slate-200 dark:border-slate-700 border-t-[#1F4E79] rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Generating official Village Attendance PDF...
              </p>
              <p className="text-[11px] text-slate-400">
                Compiling D-1 to D-8 attendance records & session dates
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="m-auto max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/40 text-center shadow-lg">
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                Unable to Load Attendance PDF
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                {error}
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={fetchAndBuildPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1F4E79] text-white text-xs font-semibold cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Retry</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {pdfUrl && !error && (
            <iframe
              ref={iframeRef}
              src={pdfUrl}
              title="Village Attendance PDF Preview"
              className="w-full h-full rounded-xl bg-white shadow-inner border border-slate-200/80 dark:border-slate-800"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default VillageAttendancePdfViewer;
