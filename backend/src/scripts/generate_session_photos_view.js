import fs from 'fs';
import path from 'path';

const content = `import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  SessionPhotoItem,
  DayPhotoSummary,
  Panchayat,
  ZipProgressState,
  TabType,
  Cluster,
  PhotoDeleteRequest,
  ClusterPhotoSummary,
} from '../types';
import { apiUrl } from '../utils/api';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { EmptyState } from './ui/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Calendar,
  Search,
  Plus,
  Trash2,
  Eye,
  X,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Building2,
  Clock,
  Sparkle,
  Image as ImageIcon,
  Lock,
  LockOpen,
  ArrowLeft,
} from './ui/icons';

interface SessionPhotosViewProps {
  panchayats: Panchayat[];
  clusters?: Cluster[];
  authToken?: string;
  selectedAcademicYearId?: string;
  userRole?: 'Cluster Admin' | 'Super Admin';
  currentCluster?: string;
  onNavigate?: (tab: TabType, targetId?: string) => void;
  onRoleChange?: (role: 'Cluster Admin' | 'Super Admin') => void;
}

export const SessionPhotosView: React.FC<SessionPhotosViewProps> = ({
  panchayats = [],
  clusters = [],
  authToken,
  selectedAcademicYearId,
  userRole = 'Super Admin',
  currentCluster = 'Dharmapuri',
  onNavigate,
}) => {
  const [selectedCluster, setSelectedCluster] = useState<string>(
    userRole === 'Cluster Admin' ? currentCluster : 'all'
  );
  const [selectedDayTab, setSelectedDayTab] = useState<number | 'all'>('all');
  const [selectedPanchayat, setSelectedPanchayat] = useState<string>('all');
  const [selectedVillage, setSelectedVillage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Dedicated Day Page (both Cluster Admin and Super Admin)
  const [activeDayNumber, setActiveDayNumber] = useState<number | null>(null);

  // Super Admin view mode ('submissions' | 'gallery' | 'delete-requests')
  const [adminViewTab, setAdminViewTab] = useState<'submissions' | 'gallery' | 'delete-requests'>('submissions');

  // Photos Collection
  const [photos, setPhotos] = useState<SessionPhotoItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Dynamic Days from Super Admin Academic Setup
  const [programDays, setProgramDays] = useState<Array<{ id: string; day_number: number; day_name: string }>>([]);
  const [academicSetupMap, setAcademicSetupMap] = useState<Record<number, string>>({});
  const [dayStatuses, setDayStatuses] = useState<Record<number, { status: string; count: number }>>({});
  const [clusterSummaries, setClusterSummaries] = useState<ClusterPhotoSummary[]>([]);
  const [deleteRequests, setDeleteRequests] = useState<PhotoDeleteRequest[]>([]);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  // Selection & Modals
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<SessionPhotoItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [photoToDelete, setPhotoToDelete] = useState<SessionPhotoItem | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Workflow Modals
  const [submitDayConfirm, setSubmitDayConfirm] = useState<number | null>(null);
  const [deleteRequestTarget, setDeleteRequestTarget] = useState<SessionPhotoItem | null>(null);
  const [deleteRequestReason, setDeleteRequestReason] = useState<string>('');
  const [changeRequestDay, setChangeRequestDay] = useState<number | null>(null);
  const [changeRequestReason, setChangeRequestReason] = useState<string>('');

  // ZIP Generation & Download State
  const [downloadingZipKey, setDownloadingZipKey] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<ZipProgressState>({
    stage: 'idle',
    message: '',
    progressPercent: 0,
  });

  // Upload Form State
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadTitle, setUploadTitle] = useState<string>('Interactive Learning Workshop');
  const [uploadDay, setUploadDay] = useState<number>(1);
  const [uploadPanchayat, setUploadPanchayat] = useState<string>(panchayats[0]?.id || '');
  const [uploadVillage, setUploadVillage] = useState<string>(panchayats[0]?.villages[0]?.name || '');
  const [uploadDate, setUploadDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [uploadUploader, setUploadUploader] = useState<string>('Cluster Mentor');
  const [uploadCaption, setUploadCaption] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolved Cluster Name
  const resolvedClusterName = useMemo(() => {
    const cId = userRole === 'Cluster Admin' ? currentCluster : selectedCluster;
    const match = clusters.find((c) => c.id.toLowerCase() === cId.toLowerCase() || c.name.toLowerCase() === cId.toLowerCase());
    return match ? match.name : cId === 'all' ? 'All Clusters' : cId;
  }, [clusters, currentCluster, selectedCluster, userRole]);

  // Fetch photos from server
  const fetchPhotos = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const clusterParam = userRole === 'Cluster Admin' ? currentCluster.toLowerCase() : selectedCluster.toLowerCase();
      const yearParam = selectedAcademicYearId ? \`&academicYearId=\${encodeURIComponent(selectedAcademicYearId)}\` : '';
      const res = await fetch(apiUrl(\`/api/session-photos?cluster=\${clusterParam}&role=\${encodeURIComponent(userRole)}\${yearParam}\`), {
        cache: 'no-store',
        headers: authToken ? { Authorization: \`Bearer \${authToken}\` } : {},
      });
      if (!res.ok) {
        throw new Error(\`Server returned \${res.status}\`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.photos)) {
        setPhotos(data.photos);
      } else {
        setPhotos([]);
      }
    } catch (err: any) {
      console.error('Failed to load photos:', err);
      setLoadError('Failed to connect to backend server for photos.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch dynamic program days & academic setup
  const fetchDynamicDays = async () => {
    try {
      const yearParam = selectedAcademicYearId ? \`?academicYearId=\${encodeURIComponent(selectedAcademicYearId)}\` : '';
      const [daysRes, setupRes] = await Promise.all([
        fetch(apiUrl(\`/api/program-days\${yearParam}\`), {
          headers: authToken ? { Authorization: \`Bearer \${authToken}\` } : {},
        }),
        fetch(apiUrl('/api/academic-setup'), {
          headers: authToken ? { Authorization: \`Bearer \${authToken}\` } : {},
        }),
      ]);

      if (daysRes.ok) {
        const daysData = await daysRes.json();
        if (daysData.success && Array.isArray(daysData.programDays)) {
          setProgramDays(daysData.programDays);
        }
      }

      if (setupRes.ok) {
        const setupData = await setupRes.json();
        if (setupData.success && Array.isArray(setupData.setup)) {
          const map: Record<number, string> = {};
          setupData.setup.forEach((s: any) => {
            if (s.day_number) map[s.day_number] = s.session_name || '';
          });
          setAcademicSetupMap(map);
        }
      }
    } catch (err) {
      console.error('Failed to fetch dynamic program days:', err);
    }
  };

  // Fetch day submission statuses & counts
  const fetchDayStatuses = async () => {
    try {
      const clusterParam = userRole === 'Cluster Admin' ? currentCluster : selectedCluster;
      const yearParam = selectedAcademicYearId ? \`&academicYearId=\${encodeURIComponent(selectedAcademicYearId)}\` : '';
      const res = await fetch(apiUrl(\`/api/session-photos/day-statuses?clusterId=\${encodeURIComponent(clusterParam)}\${yearParam}\`), {
        headers: authToken ? { Authorization: \`Bearer \${authToken}\` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (Array.isArray(data.clusterSummaries)) {
            setClusterSummaries(data.clusterSummaries);
          }
          const statusMap: Record<number, { status: string; count: number }> = {};
          if (Array.isArray(data.statuses)) {
            data.statuses.forEach((s: any) => {
              statusMap[s.day_number] = {
                status: s.status || 'DRAFT',
                count: data.counts?.[s.day_number] || 0,
              };
            });
          }
          // Merge counts
          if (data.counts) {
            Object.keys(data.counts).forEach((d) => {
              const num = Number(d);
              if (!statusMap[num]) {
                statusMap[num] = { status: 'DRAFT', count: data.counts[num] };
              } else {
                statusMap[num].count = data.counts[num];
              }
            });
          }
          setDayStatuses(statusMap);
        }
      }
    } catch (err) {
      console.error('Failed to fetch day statuses:', err);
    }
  };

  // Fetch Photo Delete Requests (for Super Admin review & Cluster Admin badges)
  const fetchDeleteRequests = async () => {
    try {
      const clusterParam = userRole === 'Cluster Admin' ? \`?clusterId=\${encodeURIComponent(currentCluster)}\` : '';
      const res = await fetch(apiUrl(\`/api/session-photos/delete-requests\${clusterParam}\`), {
        headers: authToken ? { Authorization: \`Bearer \${authToken}\` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.requests)) {
          setDeleteRequests(data.requests);
        }
      }
    } catch (err) {
      console.error('Failed to fetch delete requests:', err);
    }
  };

  useEffect(() => {
    fetchPhotos();
    fetchDynamicDays();
    fetchDayStatuses();
    fetchDeleteRequests();
  }, [userRole, selectedCluster, authToken, selectedAcademicYearId, currentCluster]);

  // Dynamic configured days list
  const configuredDays = useMemo(() => {
    const filterCluster = userRole === 'Cluster Admin' ? currentCluster : selectedCluster;
    const isAll = filterCluster === 'all';

    if (programDays.length > 0) {
      return programDays.map((pd) => {
        const statusInfo = dayStatuses[pd.day_number];
        const dayPhotos = photos.filter((p) => {
          const matchCluster =
            isAll ||
            (p.clusterId || '').toLowerCase() === filterCluster.toLowerCase() ||
            (p.clusterName || '').toLowerCase() === filterCluster.toLowerCase();
          return matchCluster && p.dayNumber === pd.day_number;
        });
        const actualCount = dayPhotos.length;
        return {
          dayNumber: pd.day_number,
          dayName: pd.day_name || \`Day \${pd.day_number}\`,
          sessionName: academicSetupMap[pd.day_number] || pd.day_name || \`Session Day \${pd.day_number}\`,
          photosCount: actualCount,
          status: (statusInfo?.status || 'DRAFT').toUpperCase(),
          isLocked: ['SUBMITTED', 'PENDING REVIEW', 'APPROVED', 'EDIT_REQUESTED'].includes(
            (statusInfo?.status || 'DRAFT').toUpperCase()
          ),
        };
      });
    }

    // Default fallback if program days not yet loaded
    return [1, 2, 3, 4, 5, 6, 7, 8].map((d) => {
      const statusInfo = dayStatuses[d];
      const dayPhotos = photos.filter((p) => {
        const matchCluster =
          isAll ||
          (p.clusterId || '').toLowerCase() === filterCluster.toLowerCase() ||
          (p.clusterName || '').toLowerCase() === filterCluster.toLowerCase();
        return matchCluster && p.dayNumber === d;
      });
      return {
        dayNumber: d,
        dayName: \`Day \${d}\`,
        sessionName: academicSetupMap[d] || \`Session Day \${d}\`,
        photosCount: dayPhotos.length,
        status: (statusInfo?.status || 'DRAFT').toUpperCase(),
        isLocked: ['SUBMITTED', 'PENDING REVIEW', 'APPROVED', 'EDIT_REQUESTED'].includes(
          (statusInfo?.status || 'DRAFT').toUpperCase()
        ),
      };
    });
  }, [programDays, academicSetupMap, dayStatuses, photos, userRole, currentCluster, selectedCluster]);

  // Current active day config (when inside dedicated Day view)
  const activeDayConfig = useMemo(() => {
    if (activeDayNumber === null) return null;
    return (
      configuredDays.find((d) => d.dayNumber === activeDayNumber) || {
        dayNumber: activeDayNumber,
        dayName: \`Day \${activeDayNumber}\`,
        sessionName: academicSetupMap[activeDayNumber] || \`Session Day \${activeDayNumber}\`,
        photosCount: photos.filter((p) => p.dayNumber === activeDayNumber).length,
        status: 'DRAFT',
        isLocked: false,
      }
    );
  }, [activeDayNumber, configuredDays, photos, academicSetupMap]);

  // Dynamic villages for filter
  const currentFilterVillages = useMemo(() => {
    if (selectedPanchayat === 'all') {
      const allVillages: { id: string; name: string }[] = [];
      panchayats.forEach((p) => {
        p.villages?.forEach((v) => {
          if (!allVillages.some((existing) => existing.name === v.name)) {
            allVillages.push({ id: v.id, name: v.name });
          }
        });
      });
      return allVillages;
    }
    const found = panchayats.find((p) => p.id === selectedPanchayat || p.name === selectedPanchayat);
    return found?.villages || [];
  }, [selectedPanchayat, panchayats]);

  // Dynamic villages for upload modal
  const uploadVillages = useMemo(() => {
    if (!uploadPanchayat) return [];
    const p = panchayats.find((item) => item.id === uploadPanchayat || item.name === uploadPanchayat);
    return p?.villages || [];
  }, [panchayats, uploadPanchayat]);

  // Filtered Photos for Gallery or Dedicated Day
  const filteredPhotos = useMemo(() => {
    return photos.filter((p) => {
      const matchCluster =
        userRole === 'Cluster Admin'
          ? (p.clusterId || '').toLowerCase() === currentCluster.toLowerCase()
          : selectedCluster === 'all'
          ? true
          : (p.clusterId || '').toLowerCase() === selectedCluster.toLowerCase() ||
            (p.clusterName || '').toLowerCase() === selectedCluster.toLowerCase();

      const targetDay = activeDayNumber !== null ? activeDayNumber : selectedDayTab;
      const matchDay = targetDay === 'all' || p.dayNumber === targetDay;

      const matchPanchayat =
        selectedPanchayat === 'all' ||
        (p.panchayatId || '').toLowerCase() === selectedPanchayat.toLowerCase() ||
        (p.panchayatName || '').toLowerCase() === selectedPanchayat.toLowerCase();

      const matchVillage =
        selectedVillage === 'all' ||
        (p.villageName || '').toLowerCase() === selectedVillage.toLowerCase();

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (p.sessionTitle || '').toLowerCase().includes(q) ||
        (p.panchayatName || '').toLowerCase().includes(q) ||
        (p.villageName || '').toLowerCase().includes(q) ||
        (p.uploadedBy || '').toLowerCase().includes(q) ||
        (p.caption || '').toLowerCase().includes(q) ||
        (p.originalFilename || '').toLowerCase().includes(q);

      return matchCluster && matchDay && matchPanchayat && matchVillage && matchSearch;
    });
  }, [photos, selectedCluster, userRole, selectedDayTab, activeDayNumber, selectedPanchayat, selectedVillage, searchQuery, currentCluster]);

  // Count of pending delete requests for Super Admin badge
  const pendingDeleteCount = useMemo(() => {
    return deleteRequests.filter((r) => r.status === 'PENDING').length;
  }, [deleteRequests]);

  // ZIP Download Handler
  const handleDownloadZip = async (type: 'day' | 'cluster-all-days' | 'all-clusters' | 'filtered', dayNumber?: number) => {
    const key = type === 'day' ? \`day-\${dayNumber}\` : type === 'filtered' ? 'filtered' : 'all';
    if (downloadingZipKey) return;
    setDownloadingZipKey(key);

    setZipProgress({ stage: 'preparing', message: 'Preparing archive request...', progressPercent: 20 });

    try {
      await new Promise((r) => setTimeout(r, 200));
      setZipProgress({ stage: 'collecting', message: 'Gathering photographic records...', progressPercent: 50 });

      await new Promise((r) => setTimeout(r, 200));
      setZipProgress({ stage: 'creating', message: 'Compressing into high-resolution ZIP...', progressPercent: 80 });

      const params = new URLSearchParams();
      params.append('type', type);
      params.append('cluster', userRole === 'Cluster Admin' ? currentCluster : selectedCluster);
      params.append('userRole', userRole);

      if (type === 'day' && dayNumber) {
        params.append('dayNumber', String(dayNumber));
      } else if (type === 'filtered') {
        const d = activeDayNumber !== null ? activeDayNumber : selectedDayTab;
        if (d !== 'all') params.append('dayNumber', String(d));
        if (selectedPanchayat !== 'all') params.append('panchayatId', selectedPanchayat);
        if (selectedVillage !== 'all') params.append('village', selectedVillage);
      }

      const zipUrl = apiUrl(\`/api/session-photos/download-zip?\${params.toString()}\`);
      const response = await fetch(zipUrl, {
        headers: authToken ? { Authorization: \`Bearer \${authToken}\` } : {},
      });
      if (!response.ok) {
        throw new Error('Unable to create ZIP archive.');
      }

      let downloadFilename = \`TQI_Session_Photos_\${selectedCluster}_\${Date.now()}.zip\`;
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setZipProgress({ stage: 'completed', message: 'ZIP archive downloaded successfully.', progressPercent: 100 });
      setTimeout(() => setZipProgress({ stage: 'idle', message: '', progressPercent: 0 }), 4000);
    } catch (err: any) {
      console.error('ZIP download failed:', err);
      setZipProgress({ stage: 'error', message: err.message || 'Failed to download ZIP.', progressPercent: 0 });
      setTimeout(() => setZipProgress({ stage: 'idle', message: '', progressPercent: 0 }), 4000);
    } finally {
      setDownloadingZipKey(null);
    }
  };

  const handleDownloadSinglePhoto = (photo: SessionPhotoItem) => {
    const downloadUrl = photo.fileUrl || apiUrl(\`/api/session-photos/\${photo.id}/download\`);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_blank';
    link.download = photo.originalFilename || \`Photo_\${photo.id}.jpg\`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Direct Delete Photo (Draft only)
  const handleDeletePhoto = async (photo: SessionPhotoItem) => {
    try {
      const res = await fetch(apiUrl(\`/api/session-photos/\${photo.id}\`), {
        method: 'DELETE',
        headers: authToken ? { Authorization: \`Bearer \${authToken}\` } : {},
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete photo.');
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setSelectedPhotoIds((prev) => prev.filter((id) => id !== photo.id));
      setPhotoToDelete(null);
      if (previewPhoto?.id === photo.id) setPreviewPhoto(null);
      await fetchDayStatuses();
    } catch (err: any) {
      alert(err.message || 'Failed to delete photo. Please try again.');
    }
  };

  // Bulk Delete (Draft only)
  const handleBulkDelete = async () => {
    try {
      for (const id of selectedPhotoIds) {
        const res = await fetch(apiUrl(\`/api/session-photos/\${id}\`), {
          method: 'DELETE',
          headers: authToken ? { Authorization: \`Bearer \${authToken}\` } : {},
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to delete selected photo.');
        }
      }
      setPhotos((prev) => prev.filter((p) => !selectedPhotoIds.includes(p.id)));
      setSelectedPhotoIds([]);
      setShowBulkDeleteConfirm(false);
      await fetchDayStatuses();
    } catch (err: any) {
      alert(err.message || 'Failed to delete selected photos.');
    }
  };

  // Submit Day Photos Workflow (Cluster Admin)
  const handleConfirmSubmitDay = async (dayNumber: number) => {
    setIsProcessingAction(true);
    try {
      const res = await fetch(apiUrl('/api/session-photos/submit'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: \`Bearer \${authToken}\` } : {}),
        },
        body: JSON.stringify({
          dayNumber,
          academicYearId: selectedAcademicYearId,
          clusterId: currentCluster,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit photos.');
      }
      setSubmitDayConfirm(null);
      await Promise.all([fetchPhotos(), fetchDayStatuses()]);
    } catch (err: any) {
      alert(err.message || 'Unable to submit photos. Please try again.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Super Admin: Approve Day Submission
  const handleApproveDaySubmission = async (clusterIdToApprove: string, dayNum: number) => {
    setIsProcessingAction(true);
    try {
      const res = await fetch(apiUrl('/api/session-photos/submissions/approve'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: \`Bearer \${authToken}\` } : {}),
        },
        body: JSON.stringify({
          clusterId: clusterIdToApprove,
          dayNumber: dayNum,
          academicYearId: selectedAcademicYearId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to approve day submission.');
      }
      alert(\`Day \${dayNum} photos collection approved successfully!\`);
      await Promise.all([fetchPhotos(), fetchDayStatuses()]);
    } catch (err: any) {
      alert(err.message || 'Failed to approve day submission.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Request Photo Delete Workflow
  const handleConfirmDeleteRequest = async () => {
    if (!deleteRequestTarget) return;
    if (!deleteRequestReason.trim()) {
      alert('Reason for photo deletion is mandatory.');
      return;
    }

    setIsProcessingAction(true);
    try {
      const res = await fetch(apiUrl('/api/session-photos/request-delete'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: \`Bearer \${authToken}\` } : {}),
        },
        body: JSON.stringify({
          photoId: deleteRequestTarget.id,
          reason: deleteRequestReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit delete request.');
      }

      setPhotos((prev) =>
        prev.map((p) =>
          p.id === deleteRequestTarget.id
            ? { ...p, deleteRequestStatus: 'PENDING', deleteRequestReason: deleteRequestReason.trim() }
            : p
        )
      );

      setDeleteRequestTarget(null);
      setDeleteRequestReason('');
      await fetchDeleteRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to submit deletion request.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Request Photo Change / Edit Workflow
  const handleConfirmChangeRequest = async () => {
    if (!changeRequestDay) return;
    if (!changeRequestReason.trim()) {
      alert('Reason for requesting photo change is mandatory.');
      return;
    }

    setIsProcessingAction(true);
    try {
      const res = await fetch(apiUrl('/api/session-photos/request-change'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: \`Bearer \${authToken}\` } : {}),
        },
        body: JSON.stringify({
          dayNumber: changeRequestDay,
          academicYearId: selectedAcademicYearId,
          reason: changeRequestReason.trim(),
          clusterId: currentCluster,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit change request.');
      }

      setChangeRequestDay(null);
      setChangeRequestReason('');
      await fetchDayStatuses();
      alert('Photo change request submitted for Super Admin review.');
    } catch (err: any) {
      alert(err.message || 'Failed to submit change request.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Super Admin: Approve Photo Delete
  const handleApproveDeleteRequest = async (request: PhotoDeleteRequest) => {
    setIsProcessingAction(true);
    try {
      const res = await fetch(apiUrl(\`/api/session-photos/delete-requests/\${request.id}/approve\`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: \`Bearer \${authToken}\` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to approve delete request.');
      }

      setPhotos((prev) => prev.filter((p) => p.id !== request.photoId));
      setDeleteRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, status: 'APPROVED' } : r))
      );
      await Promise.all([fetchPhotos(), fetchDayStatuses(), fetchDeleteRequests()]);
    } catch (err: any) {
      alert(err.message || 'Failed to approve photo deletion.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Super Admin: Reject Photo Delete
  const handleRejectDeleteRequest = async (request: PhotoDeleteRequest) => {
    const reason = window.prompt('Optional rejection remarks for Cluster Admin:', '');
    setIsProcessingAction(true);
    try {
      const res = await fetch(apiUrl(\`/api/session-photos/delete-requests/\${request.id}/reject\`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: \`Bearer \${authToken}\` } : {}),
        },
        body: JSON.stringify({ remarks: reason || '' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reject delete request.');
      }

      setPhotos((prev) =>
        prev.map((p) => (p.id === request.photoId ? { ...p, deleteRequestStatus: 'REJECTED' } : p))
      );
      setDeleteRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, status: 'REJECTED' } : r))
      );
      await Promise.all([fetchPhotos(), fetchDeleteRequests()]);
    } catch (err: any) {
      alert(err.message || 'Failed to reject delete request.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Upload Form Submit
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0) {
      setUploadError('Please select at least one photograph to upload.');
      return;
    }

    const currentDay = activeDayNumber !== null ? activeDayNumber : uploadDay;
    const existingCount = photos.filter((p) => p.dayNumber === currentDay).length;
    if (existingCount + uploadFiles.length > 50) {
      setUploadError(\`Maximum 50 photos per Day/Session allowed. Currently \${existingCount}/50. Cannot upload \${uploadFiles.length} more.\`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('clusterId', (userRole === 'Cluster Admin' ? currentCluster : selectedCluster).toLowerCase());
    formData.append('clusterName', resolvedClusterName);
    formData.append('sessionTitle', uploadTitle);
    formData.append('dayNumber', String(currentDay));
    formData.append('date', uploadDate);
    formData.append('academicYearId', selectedAcademicYearId || '');
    formData.append('panchayatId', uploadPanchayat);

    const foundP = panchayats.find((p) => p.id === uploadPanchayat || p.name === uploadPanchayat);
    formData.append('panchayatName', foundP ? foundP.name : uploadPanchayat);
    formData.append('villageName', uploadVillage);
    formData.append('uploadedBy', uploadUploader);
    formData.append('uploadedRole', userRole);
    formData.append('caption', uploadCaption);

    uploadFiles.forEach((file) => {
      formData.append('photos', file);
    });

    try {
      const res = await fetch(apiUrl('/api/session-photos/upload'), {
        method: 'POST',
        headers: authToken ? { Authorization: \`Bearer \${authToken}\` } : {},
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Upload failed.');
      }

      if (data.photos && Array.isArray(data.photos)) {
        setPhotos((prev) => [...data.photos, ...prev]);
      } else {
        await fetchPhotos();
      }

      setShowUploadModal(false);
      setUploadFiles([]);
      setUploadCaption('');
      await fetchDayStatuses();
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.message || 'Failed to upload photographs.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedPhotoIds.length === filteredPhotos.length) {
      setSelectedPhotoIds([]);
    } else {
      setSelectedPhotoIds(filteredPhotos.map((p) => p.id));
    }
  };

  const handleToggleSelectPhoto = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPhotoIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {activeDayNumber !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveDayNumber(null)}
                className="gap-1 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to {userRole === 'Super Admin' ? 'Cluster Overview' : 'Days'}</span>
              </Button>
            )}
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {activeDayNumber !== null
                ? \`DAY \${activeDayNumber} — \${activeDayConfig?.dayName || 'Session Photos'}\`
                : 'Session Photographs Archive'}
            </h1>
            <Badge variant="default" size="sm">
              {filteredPhotos.length} Photos
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeDayNumber !== null
              ? \`Curated visual evidence for \${activeDayConfig?.sessionName || activeDayConfig?.dayName}. Maximum 50 photos per session.\`
              : 'Curated visual evidence and activity documentation across Super Admin configured program cycle days.'}
          </p>
        </div>

        {/* Action Buttons Top Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {userRole === 'Super Admin' && (
            <div className="flex rounded-md border border-border bg-muted/40 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setAdminViewTab('submissions');
                  setActiveDayNumber(null);
                }}
                className={\`rounded px-2.5 py-1 transition \${
                  adminViewTab === 'submissions'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }\`}
              >
                Day Submissions
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminViewTab('gallery');
                  setActiveDayNumber(null);
                }}
                className={\`rounded px-2.5 py-1 transition \${
                  adminViewTab === 'gallery'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }\`}
              >
                All Gallery
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminViewTab('delete-requests');
                  setActiveDayNumber(null);
                }}
                className={\`relative flex items-center gap-1.5 rounded px-2.5 py-1 transition \${
                  adminViewTab === 'delete-requests'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }\`}
              >
                <span>Delete Requests</span>
                {pendingDeleteCount > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {pendingDeleteCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {selectedPhotoIds.length > 0 && (userRole === 'Super Admin' || !activeDayConfig?.isLocked) && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="gap-1.5 text-xs font-semibold"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete ({selectedPhotoIds.length})</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownloadZip('filtered')}
            disabled={downloadingZipKey !== null || filteredPhotos.length === 0}
            className="gap-1.5 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{downloadingZipKey === 'filtered' ? 'Preparing ZIP...' : 'Download ZIP'}</span>
          </Button>

          {(userRole === 'Super Admin' || (userRole === 'Cluster Admin' && activeDayNumber !== null && !activeDayConfig?.isLocked)) && (
            <Button
              size="sm"
              onClick={() => {
                if (activeDayNumber) setUploadDay(activeDayNumber);
                setShowUploadModal(true);
              }}
              disabled={(activeDayConfig?.photosCount || 0) >= 50 && userRole === 'Cluster Admin'}
              className="gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
              title={(activeDayConfig?.photosCount || 0) >= 50 ? '50-photo limit reached' : 'Upload photos'}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Upload Photos</span>
            </Button>
          )}

          {userRole === 'Cluster Admin' && activeDayNumber !== null && !activeDayConfig?.isLocked && (
            <Button
              size="sm"
              variant="default"
              disabled={isProcessingAction || (activeDayConfig?.photosCount || 0) === 0}
              onClick={() => setSubmitDayConfirm(activeDayNumber)}
              className="gap-1.5 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Submit Photos</span>
            </Button>
          )}

          {userRole === 'Cluster Admin' && activeDayNumber !== null && activeDayConfig?.isLocked && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setChangeRequestDay(activeDayNumber);
                setChangeRequestReason('');
              }}
              className="gap-1.5 text-xs font-semibold text-amber-700 border-amber-300 hover:bg-amber-50"
            >
              <Sparkle className="h-3.5 w-3.5 text-amber-600" />
              <span>Request Photo Change</span>
            </Button>
          )}
        </div>
      </div>

      {/* ZIP Download Progress Alert */}
      {zipProgress.stage !== 'idle' && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm animate-in fade-in-0">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1.5">
            <span className="flex items-center gap-2">
              <Download className="h-4 w-4 text-primary animate-bounce" />
              <span>{zipProgress.message}</span>
            </span>
            <span className="font-mono text-muted-foreground">{zipProgress.progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: \`\${zipProgress.progressPercent}%\` }}
            />
          </div>
        </div>
      )}

      {/* VIEW MODE 1: SUPER ADMIN REVIEW DELETE REQUESTS TAB */}
      {userRole === 'Super Admin' && adminViewTab === 'delete-requests' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <h3 className="text-sm font-bold text-foreground">Pending Photo Deletion Requests</h3>
                <p className="text-xs text-muted-foreground">
                  Review submitted requests from Cluster Admins. Approving removes both the database record and the actual stored file.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {deleteRequests.filter((r) => r.status === 'PENDING').length} Pending Review
            </Badge>
          </div>

          {deleteRequests.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center shadow-xs">
              <EmptyState
                icon={CheckCircle2}
                title="No photo deletion requests"
                description="There are currently no deletion requests submitted by Cluster Admins requiring review."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {deleteRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex flex-col justify-between overflow-hidden rounded-lg border border-border bg-card shadow-xs transition hover:shadow-md"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-muted/40">
                    <img
                      src={req.fileUrl || '/logo.png'}
                      alt={req.fileName}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2 bg-gradient-to-b from-black/60 to-transparent">
                      <Badge variant="default" size="sm" className="bg-black/60 text-white border-white/20">
                        Day {req.dayNumber}
                      </Badge>
                      <Badge
                        variant="default"
                        size="sm"
                        className={\`text-[10px] font-bold \${
                          req.status === 'PENDING'
                            ? 'bg-amber-600 text-white'
                            : req.status === 'APPROVED'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-red-600 text-white'
                        }\`}
                      >
                        {req.status === 'PENDING' ? 'Pending Review' : req.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-border pb-1.5">
                      <span className="font-semibold text-foreground truncate max-w-[180px]" title={req.fileName}>
                        {req.fileName}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {req.requestedDate ? new Date(req.requestedDate).toLocaleDateString() : '—'}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      <div>
                        <strong className="text-foreground">Cluster:</strong> {req.clusterName}
                      </div>
                      <div>
                        <strong className="text-foreground">Day / Session:</strong> Day {req.dayNumber} — {req.sessionName}
                      </div>
                      <div>
                        <strong className="text-foreground">Requested By:</strong> {req.requestedBy}
                      </div>
                    </div>

                    <div className="rounded border border-amber-200 bg-amber-50/70 p-2 text-amber-950">
                      <strong className="block font-semibold text-[11px] text-amber-900">Reason for Deletion:</strong>
                      <p className="mt-0.5 text-[11px] italic leading-relaxed">{req.reason}</p>
                    </div>

                    {req.status === 'PENDING' && (
                      <div className="pt-2 flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isProcessingAction}
                          onClick={() => handleRejectDeleteRequest(req)}
                          className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={isProcessingAction}
                          onClick={() => handleApproveDeleteRequest(req)}
                          className="text-xs bg-red-600 text-white hover:bg-red-700 font-semibold"
                        >
                          Approve Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeDayNumber !== null ? (
        /* VIEW MODE 2: DEDICATED DAY VIEW (FOR BOTH CLUSTER ADMIN AND SUPER ADMIN) */
        <div className="space-y-4">
          {activeDayConfig && (
            <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary">
                      DAY {activeDayConfig.dayNumber}
                    </span>
                    <h2 className="text-base font-bold text-foreground">
                      {activeDayConfig.dayName}
                    </h2>
                    <Badge
                      variant="default"
                      size="sm"
                      className={\`text-xs font-semibold \${
                        activeDayConfig.status === 'SUBMITTED' || activeDayConfig.status === 'PENDING REVIEW'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : activeDayConfig.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : activeDayConfig.status === 'EDIT_APPROVED'
                          ? 'bg-blue-100 text-blue-900 border-blue-300'
                          : 'bg-muted text-muted-foreground'
                      }\`}
                    >
                      {activeDayConfig.status === 'SUBMITTED' || activeDayConfig.status === 'PENDING REVIEW' ? (
                        <span className="flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          <span>Submitted — Pending Review</span>
                        </span>
                      ) : activeDayConfig.status === 'APPROVED' ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Approved</span>
                        </span>
                      ) : (
                        <span>DRAFT (Editable)</span>
                      )}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      <strong className="text-foreground">Session:</strong> {activeDayConfig.sessionName}
                    </span>
                    <span>&middot;</span>
                    <span>
                      <strong className="text-foreground">Cluster:</strong> {resolvedClusterName}
                    </span>
                    <span>&middot;</span>
                    <span>
                      <strong className="text-foreground">Photos:</strong>{' '}
                      <span className="font-mono font-bold text-foreground">{filteredPhotos.length} / 50</span>
                    </span>
                  </div>
                </div>

                {/* Super Admin Action Controls */}
                {userRole === 'Super Admin' && (activeDayConfig.status === 'SUBMITTED' || activeDayConfig.status === 'PENDING REVIEW') && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={isProcessingAction}
                      onClick={() => handleApproveDaySubmission(selectedCluster, activeDayConfig.dayNumber)}
                      className="gap-1.5 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Approve Day Collection</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Filter Bar inside Day View */}
          <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-card p-3 shadow-xs">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search photos by filename, caption, uploader..."
                className="h-9 pl-8 text-xs"
              />
            </div>

            <div className="w-44">
              <Select
                value={selectedPanchayat}
                onValueChange={(val) => {
                  setSelectedPanchayat(val);
                  setSelectedVillage('all');
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Panchayats" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Panchayats</SelectItem>
                  {panchayats.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-44">
              <Select
                value={selectedVillage}
                onValueChange={(val) => setSelectedVillage(val)}
                disabled={selectedPanchayat === 'all'}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Villages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Villages</SelectItem>
                  {currentFilterVillages.map((v) => (
                    <SelectItem key={v.id || v.name} value={v.name}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filteredPhotos.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleSelectAll}
                className="h-9 text-xs"
              >
                {selectedPhotoIds.length === filteredPhotos.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </div>

          {/* Photos Grid */}
          {isLoading ? (
            <div className="py-16 text-center text-xs text-muted-foreground">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
              <p>Loading session photographs...</p>
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 shadow-xs">
              <EmptyState
                icon={ImageIcon}
                title="No photographs found for this Day"
                description="No photos have been uploaded for this day and cluster yet."
                actionLabel={userRole === 'Super Admin' || !activeDayConfig?.isLocked ? '+ Upload First Photo' : undefined}
                onAction={() => {
                  setUploadDay(activeDayNumber);
                  setShowUploadModal(true);
                }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredPhotos.map((photo) => {
                const isSelected = selectedPhotoIds.includes(photo.id);
                const isPhotoLocked = userRole === 'Cluster Admin' && activeDayConfig?.isLocked;
                const isDeleteRequested = photo.deleteRequestStatus === 'PENDING';
                const isDeleteRejected = photo.deleteRequestStatus === 'REJECTED';

                return (
                  <div
                    key={photo.id}
                    onClick={() => setPreviewPhoto(photo)}
                    className={\`group relative flex flex-col justify-between overflow-hidden rounded-lg border bg-card shadow-xs transition hover:shadow-md cursor-pointer \${
                      isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                    }\`}
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-muted/40">
                      <img
                        src={photo.fileUrl || '/logo.png'}
                        alt={photo.caption || photo.sessionTitle}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />

                      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2 bg-gradient-to-b from-black/60 to-transparent">
                        <div className="flex items-center gap-1">
                          <Badge variant="default" size="sm" className="bg-black/60 text-white border-white/20">
                            Day {photo.dayNumber}
                          </Badge>
                          {isDeleteRequested && (
                            <Badge variant="default" size="sm" className="bg-amber-600 text-white text-[10px]">
                              Delete Requested
                            </Badge>
                          )}
                          {isDeleteRejected && (
                            <Badge variant="default" size="sm" className="bg-rose-600 text-white text-[10px]">
                              Delete Rejected
                            </Badge>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleToggleSelectPhoto(photo.id, e)}
                          className={\`flex h-6 w-6 items-center justify-center rounded border transition \${
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-white/60 bg-black/40 text-transparent hover:border-white'
                          }\`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Hover Quick Actions */}
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition group-hover:opacity-100">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-white/90 text-foreground hover:bg-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewPhoto(photo);
                          }}
                          title="View High-Res"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-white/90 text-foreground hover:bg-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadSinglePhoto(photo);
                          }}
                          title="Download Photo"
                        >
                          <Download className="h-4 w-4" />
                        </Button>

                        {(userRole === 'Super Admin' || !isPhotoLocked) && (
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-white/90 text-red-600 hover:bg-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPhotoToDelete(photo);
                            }}
                            title="Delete Photo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}

                        {isPhotoLocked && !isDeleteRequested && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 rounded-full bg-amber-600 text-white hover:bg-amber-700 text-[11px] px-2.5 font-semibold"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteRequestTarget(photo);
                              setDeleteRequestReason('');
                            }}
                            title="Request Photo Deletion"
                          >
                            Request Delete
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-foreground truncate max-w-[170px]" title={photo.originalFilename || photo.caption}>
                          {photo.originalFilename || photo.caption || photo.sessionTitle}
                        </h4>
                        {isPhotoLocked && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5" title="Photo Locked">
                            <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                          </span>
                        )}
                      </div>

                      {isDeleteRequested && (
                        <div className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                          Delete Request: Pending Approval
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 truncate max-w-[140px]">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{photo.villageName || photo.panchayatName || resolvedClusterName}</span>
                        </span>
                        <span className="font-mono text-[10px]">{photo.date || '—'}</span>
                      </div>
                      <div className="pt-1.5 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="truncate">By {photo.uploadedBy || 'Cluster Admin'}</span>
                        <span className="font-mono">{photo.clusterName || resolvedClusterName}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : userRole === 'Cluster Admin' ? (
        /* VIEW MODE 3: CLUSTER ADMIN DYNAMIC SUPER ADMIN CONFIGURED DAYS MAIN GRID */
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Program Cycles &amp; Photo Collections — {resolvedClusterName}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Select a Day to upload, review, and submit activity evidence. Each session has a maximum limit of 50 photos.
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {configuredDays.length} Configured Days
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {configuredDays.map((day) => {
              const count = day.photosCount;
              const isLocked = day.isLocked;

              return (
                <div
                  key={day.dayNumber}
                  onClick={() => setActiveDayNumber(day.dayNumber)}
                  className="group flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-xs transition hover:border-primary hover:shadow-md cursor-pointer"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary tracking-wide">
                        DAY {day.dayNumber}
                      </span>
                      <Badge
                        variant="default"
                        size="sm"
                        className={\`text-[10px] font-semibold \${
                          isLocked
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-muted text-muted-foreground'
                        }\`}
                      >
                        {isLocked ? (
                          <span className="flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            <span>Submitted</span>
                          </span>
                        ) : (
                          <span>Draft</span>
                        )}
                      </Badge>
                    </div>

                    <h3 className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition" title={day.dayName}>
                      {day.dayName}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2" title={day.sessionName}>
                      {day.sessionName}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Photos Uploaded</span>
                      <span className="font-mono font-bold text-foreground">
                        {count} / 50
                      </span>
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={\`h-full transition-all duration-300 \${
                          count >= 50 ? 'bg-amber-500' : 'bg-primary'
                        }\`}
                        style={{ width: \`\${Math.min(100, (count / 50) * 100)}%\` }}
                      />
                    </div>

                    <div className="pt-1 flex items-center justify-between text-[11px] text-primary font-semibold group-hover:underline">
                      <span>Open Day {day.dayNumber} Photos &rarr;</span>
                      {count > 0 && isLocked && (
                        <span className="text-muted-foreground flex items-center gap-1 font-normal">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : adminViewTab === 'submissions' ? (
        /* VIEW MODE 4: SUPER ADMIN CLUSTER-WISE DAY SUBMISSIONS OVERVIEW */
        <div className="space-y-6">
          {/* Cluster Pills Bar */}
          <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-border bg-card shadow-xs">
            <span className="text-xs font-bold text-muted-foreground px-2">Filter Cluster:</span>
            <button
              type="button"
              onClick={() => setSelectedCluster('all')}
              className={\`px-3 py-1.5 rounded-md text-xs font-semibold transition \${
                selectedCluster === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
              }\`}
            >
              All Clusters ({clusters.length})
            </button>
            {clusters.map((c) => {
              const summary = clusterSummaries.find(
                (cs) => cs.clusterId.toLowerCase() === c.id.toLowerCase() || cs.clusterName.toLowerCase() === c.name.toLowerCase()
              );
              const subCount = summary?.submittedDaysCount || 0;
              const photoCount = summary?.totalPhotos || 0;
              const isSelected = selectedCluster.toLowerCase() === c.id.toLowerCase() || selectedCluster.toLowerCase() === c.name.toLowerCase();

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCluster(c.id)}
                  className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition \${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                  }\`}
                >
                  <span>{c.name}</span>
                  {subCount > 0 ? (
                    <span className={\`px-1.5 py-0.2 rounded-full text-[10px] font-bold \${
                      isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }\`}>
                      {subCount} submitted
                    </span>
                  ) : photoCount > 0 ? (
                    <span className={\`px-1.5 py-0.2 rounded-full text-[10px] \${
                      isSelected ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                    }\`}>
                      {photoCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Render Cluster Sections */}
          {(selectedCluster === 'all' ? clusters : clusters.filter((c) => c.id.toLowerCase() === selectedCluster.toLowerCase() || c.name.toLowerCase() === selectedCluster.toLowerCase())).map((c) => {
            const summary = clusterSummaries.find(
              (cs) => cs.clusterId.toLowerCase() === c.id.toLowerCase() || cs.clusterName.toLowerCase() === c.name.toLowerCase()
            );
            const totalPhotos = summary?.totalPhotos || photos.filter((p) => p.clusterId?.toLowerCase() === c.id.toLowerCase() || p.clusterName?.toLowerCase() === c.name.toLowerCase()).length;
            const submittedCount = summary?.submittedDaysCount || 0;

            return (
              <div key={c.id} className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-foreground">
                        {c.name} Cluster
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        District: {c.district || 'Tamil Nadu'} &middot; SPOC: {c.spoc_name || 'Cluster Admin'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono">
                      {totalPhotos} Photos
                    </Badge>
                    <Badge
                      variant="default"
                      size="sm"
                      className={\`text-xs font-semibold \${
                        submittedCount > 0 ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-muted text-muted-foreground'
                      }\`}
                    >
                      {submittedCount} / 8 Days Submitted
                    </Badge>
                  </div>
                </div>

                {/* Day Cards for this Cluster */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((dayNum) => {
                    const daySummary = summary?.days?.find((d) => d.dayNumber === dayNum);
                    const dayPhotos = photos.filter(
                      (p) =>
                        (p.clusterId?.toLowerCase() === c.id.toLowerCase() || p.clusterName?.toLowerCase() === c.name.toLowerCase()) &&
                        p.dayNumber === dayNum
                    );
                    const photoCount = daySummary ? daySummary.photoCount : dayPhotos.length;
                    const status = (daySummary?.status || 'DRAFT').toUpperCase();
                    const isSubmitted = ['SUBMITTED', 'PENDING REVIEW', 'APPROVED', 'EDIT_REQUESTED'].includes(status);
                    const isApproved = status === 'APPROVED';
                    const sessionName = academicSetupMap[dayNum] || \`Session Day \${dayNum}\`;

                    return (
                      <div
                        key={dayNum}
                        onClick={() => {
                          setSelectedCluster(c.id);
                          setActiveDayNumber(dayNum);
                        }}
                        className="group flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-xs transition hover:border-primary hover:shadow-md cursor-pointer"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-primary tracking-wide">
                              DAY {dayNum}
                            </span>
                            <Badge
                              variant="default"
                              size="sm"
                              className={\`text-[10px] font-semibold \${
                                isApproved
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : isSubmitted
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-muted text-muted-foreground'
                              }\`}
                            >
                              {isApproved ? (
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-700" />
                                  <span>Approved</span>
                                </span>
                              ) : isSubmitted ? (
                                <span className="flex items-center gap-1">
                                  <Lock className="h-3 w-3 text-amber-700" />
                                  <span>Submitted</span>
                                </span>
                              ) : (
                                <span>Draft</span>
                              )}
                            </Badge>
                          </div>

                          <h3 className="text-xs font-bold text-foreground line-clamp-1 group-hover:text-primary transition">
                            Day {dayNum}
                          </h3>
                          <p className="text-[11px] text-muted-foreground line-clamp-2" title={sessionName}>
                            {sessionName}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-border space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-medium">Photos Uploaded</span>
                            <span className="font-mono font-bold text-foreground">
                              {photoCount} / 50
                            </span>
                          </div>

                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={\`h-full transition-all duration-300 \${
                                photoCount >= 50 ? 'bg-amber-500' : 'bg-primary'
                              }\`}
                              style={{ width: \`\${Math.min(100, (photoCount / 50) * 100)}%\` }}
                            />
                          </div>

                          <div className="pt-1 flex items-center justify-between text-[11px] text-primary font-semibold group-hover:underline">
                            <span>Open Day {dayNum} Photos &rarr;</span>
                            {isSubmitted && (
                              <span className="text-amber-700 flex items-center gap-1 text-[10px] font-medium">
                                <Lock className="h-2.5 w-2.5" /> Review
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VIEW MODE 5: RAW MULTI-CLUSTER GALLERY FOR SUPER ADMIN */
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-card p-3 shadow-xs">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by caption, topic, village, uploader..."
                className="h-9 pl-8 text-xs"
              />
            </div>

            <div className="w-44">
              <Select
                value={selectedCluster}
                onValueChange={(val) => setSelectedCluster(val)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Clusters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clusters</SelectItem>
                  {clusters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-44">
              <Select
                value={selectedPanchayat}
                onValueChange={(val) => {
                  setSelectedPanchayat(val);
                  setSelectedVillage('all');
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Panchayats" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Panchayats</SelectItem>
                  {panchayats.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-44">
              <Select
                value={selectedVillage}
                onValueChange={(val) => setSelectedVillage(val)}
                disabled={selectedPanchayat === 'all'}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Villages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Villages</SelectItem>
                  {currentFilterVillages.map((v) => (
                    <SelectItem key={v.id || v.name} value={v.name}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filteredPhotos.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleSelectAll}
                className="h-9 text-xs"
              >
                {selectedPhotoIds.length === filteredPhotos.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </div>

          {/* Photo Gallery Grid */}
          {isLoading ? (
            <div className="py-16 text-center text-xs text-muted-foreground">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
              <p>Loading session photographs...</p>
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 shadow-xs">
              <EmptyState
                icon={ImageIcon}
                title="No photographs found"
                description="No session photographs matched your filters."
                actionLabel="+ Upload First Photo"
                onAction={() => setShowUploadModal(true)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredPhotos.map((photo) => {
                const isSelected = selectedPhotoIds.includes(photo.id);
                return (
                  <div
                    key={photo.id}
                    onClick={() => setPreviewPhoto(photo)}
                    className={\`group relative flex flex-col justify-between overflow-hidden rounded-lg border bg-card shadow-xs transition hover:shadow-md cursor-pointer \${
                      isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                    }\`}
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-muted/40">
                      <img
                        src={photo.fileUrl || '/logo.png'}
                        alt={photo.caption || photo.sessionTitle}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />

                      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2 bg-gradient-to-b from-black/60 to-transparent">
                        <Badge variant="default" size="sm" className="bg-black/60 text-white border-white/20">
                          Day {photo.dayNumber}
                        </Badge>
                        <button
                          type="button"
                          onClick={(e) => handleToggleSelectPhoto(photo.id, e)}
                          className={\`flex h-6 w-6 items-center justify-center rounded border transition \${
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-white/60 bg-black/40 text-transparent hover:border-white'
                          }\`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition group-hover:opacity-100">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-white/90 text-foreground hover:bg-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewPhoto(photo);
                          }}
                          title="View High-Res"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-white/90 text-foreground hover:bg-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadSinglePhoto(photo);
                          }}
                          title="Download Photo"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-white/90 text-red-600 hover:bg-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoToDelete(photo);
                          }}
                          title="Delete Photo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="p-3 space-y-1.5">
                      <h4 className="text-xs font-semibold text-foreground truncate max-w-[170px]" title={photo.originalFilename || photo.caption}>
                        {photo.originalFilename || photo.caption || photo.sessionTitle}
                      </h4>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 truncate max-w-[140px]">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{photo.villageName || photo.panchayatName || resolvedClusterName}</span>
                        </span>
                        <span className="font-mono text-[10px]">{photo.date || '—'}</span>
                      </div>
                      <div className="pt-1.5 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="truncate">By {photo.uploadedBy || 'Cluster Admin'}</span>
                        <span className="font-mono">{photo.clusterName || resolvedClusterName}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. Lightbox Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in-0">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-3.5">
              <div>
                <h3 className="text-sm font-bold text-foreground truncate max-w-lg">
                  {previewPhoto.originalFilename || previewPhoto.caption || previewPhoto.sessionTitle}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Day {previewPhoto.dayNumber} &middot; {previewPhoto.villageName || previewPhoto.panchayatName} &middot; {previewPhoto.clusterName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative max-h-[65vh] w-full overflow-hidden bg-black/95 flex items-center justify-center">
              <img
                src={previewPhoto.fileUrl || '/logo.png'}
                alt={previewPhoto.caption || previewPhoto.sessionTitle}
                className="max-h-[65vh] w-auto object-contain"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 border-t border-border bg-muted/20 text-xs">
              <div className="text-muted-foreground">
                Uploaded by <strong className="text-foreground">{previewPhoto.uploadedBy}</strong> on {previewPhoto.date}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadSinglePhoto(previewPhoto)}
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </Button>

                {(userRole === 'Super Admin' || !activeDayConfig?.isLocked) && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const toDel = previewPhoto;
                      setPreviewPhoto(null);
                      setPhotoToDelete(toDel);
                    }}
                    className="gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </Button>
                )}

                {userRole === 'Cluster Admin' && activeDayConfig?.isLocked && previewPhoto.deleteRequestStatus !== 'PENDING' && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const toReq = previewPhoto;
                      setPreviewPhoto(null);
                      setDeleteRequestTarget(toReq);
                      setDeleteRequestReason('');
                    }}
                    className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
                  >
                    <span>Request Delete</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Upload Photos Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Upload Session Photographs</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Attach activity evidence. Maximum 50 photos allowed per program day.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="mt-4 space-y-4 text-xs">
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Cycle Day *
                    </label>
                    <Select
                      value={String(activeDayNumber !== null ? activeDayNumber : uploadDay)}
                      onValueChange={(val) => setUploadDay(parseInt(val, 10) || 1)}
                      disabled={activeDayNumber !== null}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Day" />
                      </SelectTrigger>
                      <SelectContent>
                        {configuredDays.map((d) => (
                          <SelectItem key={d.dayNumber} value={String(d.dayNumber)}>
                            Day {d.dayNumber} ({d.photosCount}/50)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Session Date *
                    </label>
                    <Input
                      type="date"
                      required
                      value={uploadDate}
                      onChange={(e) => setUploadDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Session Title / Activity *
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. Spoken English Vocabulary Workshop"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Target Panchayat *
                    </label>
                    <Select
                      value={uploadPanchayat}
                      onValueChange={(val) => {
                        setUploadPanchayat(val);
                        const p = panchayats.find((item) => item.id === val);
                        setUploadVillage(p?.villages[0]?.name || '');
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Panchayat" />
                      </SelectTrigger>
                      <SelectContent>
                        {panchayats.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Target Village *
                    </label>
                    <Select
                      value={uploadVillage}
                      onValueChange={(val) => setUploadVillage(val)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Village" />
                      </SelectTrigger>
                      <SelectContent>
                        {uploadVillages.map((v) => (
                          <SelectItem key={v.id || v.name} value={v.name}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Caption / Context Note
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Students practicing dialogue pairs in village hall"
                    value={uploadCaption}
                    onChange={(e) => setUploadCaption(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Image Files (JPG, PNG, WebP) *
                  </label>
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setUploadFiles(files);
                      }}
                      className="hidden"
                    />
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-xs font-medium text-foreground">
                      {uploadFiles.length > 0 ? (
                        <span className="font-semibold text-primary">{uploadFiles.length} file(s) selected</span>
                      ) : (
                        'Click to choose photographs from your device'
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Maximum 50 photos allowed per day. Up to 10MB each.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3"
                    >
                      Browse Files
                    </Button>
                  </div>
                </div>

                {uploadError && (
                  <p className="text-xs font-semibold text-destructive">{uploadError}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUploading || uploadFiles.length === 0}>
                  {isUploading ? 'Uploading...' : \`Upload \${uploadFiles.length} Photographs\`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Delete Confirmation Modal (Direct Delete) */}
      {(photoToDelete || showBulkDeleteConfirm) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">
                  {showBulkDeleteConfirm ? 'Delete Selected Photos?' : 'Delete Photograph?'}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {showBulkDeleteConfirm
                    ? \`Are you sure you want to delete \${selectedPhotoIds.length} selected photographs? This action cannot be undone.\`
                    : 'Are you sure you want to permanently remove this photograph from the session records?'}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPhotoToDelete(null);
                  setShowBulkDeleteConfirm(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (showBulkDeleteConfirm) {
                    handleBulkDelete();
                  } else if (photoToDelete) {
                    handleDeletePhoto(photoToDelete);
                  }
                }}
              >
                Yes, Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 8. SUBMIT PHOTOS CONFIRMATION MODAL */}
      {submitDayConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                <Lock className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-foreground">
                  Submit these photos for review?
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  After submission, you cannot directly add or delete photos. Any correction or deletion will require Super Admin approval.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isProcessingAction}
                onClick={() => setSubmitDayConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isProcessingAction}
                onClick={() => handleConfirmSubmitDay(submitDayConfirm)}
                className="bg-primary text-primary-foreground font-semibold"
              >
                {isProcessingAction ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 9. REQUEST PHOTO DELETION MODAL */}
      {deleteRequestTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-amber-600 font-bold text-sm tracking-wide uppercase">
                <AlertCircle className="h-4 w-4" />
                <span>Request Photo Deletion</span>
              </div>
              <button
                type="button"
                onClick={() => setDeleteRequestTarget(null)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-2.5">
                <div className="h-14 w-18 overflow-hidden rounded border border-border bg-muted shrink-0">
                  <img
                    src={deleteRequestTarget.fileUrl || '/logo.png'}
                    alt={deleteRequestTarget.originalFilename}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  <div className="font-semibold text-foreground truncate" title={deleteRequestTarget.originalFilename}>
                    {deleteRequestTarget.originalFilename}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Day {deleteRequestTarget.dayNumber} &middot; {activeDayConfig?.sessionName || deleteRequestTarget.sessionTitle}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-foreground">
                  Reason for Deletion * <span className="font-normal text-muted-foreground">(Mandatory)</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={deleteRequestReason}
                  onChange={(e) => setDeleteRequestReason(e.target.value)}
                  placeholder="Explain why this photograph must be permanently removed..."
                  className="w-full rounded-md border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <p className="text-[11px] text-muted-foreground italic">
                Deleting a submitted photo requires Super Admin approval. The photo remains visible until approved.
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={isProcessingAction}
                onClick={() => setDeleteRequestTarget(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isProcessingAction || !deleteRequestReason.trim()}
                onClick={handleConfirmDeleteRequest}
                className="bg-amber-600 text-white hover:bg-amber-700 font-semibold"
              >
                {isProcessingAction ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 10. REQUEST PHOTO CHANGE / EDIT MODAL */}
      {changeRequestDay !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-wide">
                <Sparkle className="h-4 w-4" />
                <span>Request Photo Correction / Additions</span>
              </div>
              <button
                type="button"
                onClick={() => setChangeRequestDay(null)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                Explain what needs to be added, replaced, or corrected for <strong>Day {changeRequestDay}</strong>. Upon Super Admin approval, this specific day collection will be unlocked for editing.
              </p>

              <div>
                <label className="mb-1 block font-semibold text-foreground">
                  Reason / Required Changes *
                </label>
                <textarea
                  required
                  rows={3}
                  value={changeRequestReason}
                  onChange={(e) => setChangeRequestReason(e.target.value)}
                  placeholder="e.g. Additional group activity photos taken by mentor need to be added..."
                  className="w-full rounded-md border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={isProcessingAction}
                onClick={() => setChangeRequestDay(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isProcessingAction || !changeRequestReason.trim()}
                onClick={handleConfirmChangeRequest}
                className="bg-primary text-primary-foreground font-semibold"
              >
                {isProcessingAction ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
`;

const targetPath = path.resolve('..', 'frontend', 'src', 'components', 'SessionPhotosView.tsx');
fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully wrote SessionPhotosView.tsx to:', targetPath);
