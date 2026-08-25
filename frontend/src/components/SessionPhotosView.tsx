import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  SessionPhotoItem,
  DayPhotoSummary,
  Panchayat,
  ZipProgressState,
  ZipGenerationStage,
  TabType,
  Cluster,
} from '../types';
import { apiUrl } from '../utils/api';

interface SessionPhotosViewProps {
  panchayats: Panchayat[];
  clusters?: Cluster[];
  authToken?: string;
  userRole?: 'Cluster Admin' | 'Super Admin';
  currentCluster?: string;
  onNavigate?: (tab: TabType, targetId?: string) => void;
  onRoleChange?: (role: 'Cluster Admin' | 'Super Admin') => void;
}


export const SessionPhotosView: React.FC<SessionPhotosViewProps> = ({
  panchayats = [],
  clusters = [],
  authToken,
  userRole = 'Cluster Admin',
  currentCluster = 'Dharmapuri',
  onNavigate,
  onRoleChange,
}) => {
  // State
  const [activeRole, setActiveRole] = useState<'Cluster Admin' | 'Super Admin'>(userRole);
  const [selectedCluster, setSelectedCluster] = useState<string>(
    userRole === 'Cluster Admin' ? 'Dharmapuri' : 'all'
  );
  const [selectedDayTab, setSelectedDayTab] = useState<number | 'all'>('all');
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [selectedPanchayat, setSelectedPanchayat] = useState<string>('all');
  const [selectedVillage, setSelectedVillage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Photos Collection (Fetched from Backend API)
  const [photos, setPhotos] = useState<SessionPhotoItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals & Active Selections
  const [selectedPhoto, setSelectedPhoto] = useState<SessionPhotoItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadDayTarget, setUploadDayTarget] = useState<number>(1);
  const [viewDayModal, setViewDayModal] = useState<number | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<SessionPhotoItem | null>(null);

  // ZIP Generation & Download State
  const [downloadingZipKey, setDownloadingZipKey] = useState<string | null>(null);
  const [completedZipKey, setCompletedZipKey] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<ZipProgressState>({
    stage: 'idle',
    message: '',
    progressPercent: 0,
  });

  // Upload Form State
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadTitle, setUploadTitle] = useState<string>('Interactive Learning Workshop');
  const [uploadDay, setUploadDay] = useState<number>(1);
  const [uploadPanchayat, setUploadPanchayat] = useState<string>(panchayats[0]?.id || 'vedakkattamaduvu');
  const [uploadVillage, setUploadVillage] = useState<string>('Ammapettai');
  const [uploadDate, setUploadDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [uploadUploader, setUploadUploader] = useState<string>('Rahul K.');
  const [uploadCaption, setUploadCaption] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showClusterLanding = activeRole === 'Super Admin' && selectedCluster === 'all';
  const photoClusters = useMemo(() => {
    const known = clusters.map((cluster) => ({ id: cluster.id, name: cluster.name }));
    const knownIds = new Set(known.map((cluster) => cluster.id.toLowerCase()));
    photos.forEach((photo) => {
      if (!knownIds.has(photo.clusterId.toLowerCase())) {
        known.push({ id: photo.clusterId, name: photo.clusterName || photo.clusterId });
        knownIds.add(photo.clusterId.toLowerCase());
      }
    });
    return known;
  }, [clusters, photos]);

  // Sync role changes
  useEffect(() => {
    setActiveRole(userRole);
    if (userRole === 'Cluster Admin') {
      setSelectedCluster('Dharmapuri');
    } else {
      setSelectedCluster('all');
    }
  }, [userRole]);

  // Fetch photos from server
  const fetchPhotos = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const clusterParam = activeRole === 'Cluster Admin' ? 'dharmapuri' : selectedCluster.toLowerCase();
      const res = await fetch(apiUrl(`/api/session-photos?cluster=${clusterParam}&role=${encodeURIComponent(activeRole)}`), {
        cache: 'no-store',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();

      if (data.success && Array.isArray(data.photos)) {
        setPhotos(data.photos);
      } else {
        setPhotos([]);
      }
    } catch (err: any) {
      console.error('Failed to load photos:', err);
      setLoadError('Failed to connect to backend server for photos. Retrying...');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [activeRole, selectedCluster, authToken]);

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

  // Update upload village when upload panchayat changes
  useEffect(() => {
    const selectedP = panchayats.find((p) => p.id === uploadPanchayat || p.name === uploadPanchayat);
    if (selectedP && selectedP.villages && selectedP.villages.length > 0) {
      setUploadVillage(selectedP.villages[0].name);
    }
  }, [uploadPanchayat, panchayats]);

  // Days 1 through 8 Summary
  const daySummaries: DayPhotoSummary[] = useMemo(() => {
    const targetClusterPhotos = photos.filter(
      (p) =>
        activeRole === 'Cluster Admin' ||
        selectedCluster === 'all' ||
        p.clusterId.toLowerCase() === selectedCluster.toLowerCase()
    );

    const summaries: DayPhotoSummary[] = [];

    for (let day = 1; day <= 8; day++) {
      const dayPhotos = targetClusterPhotos.filter((p) => p.dayNumber === day);
      const uniquePanchayats = new Set(dayPhotos.map((p) => p.panchayatId)).size;
      const targetCount = 50;

      summaries.push({
        dayNumber: day,
        dayLabel: `Day ${day}`,
        date: `2026-08-${15 + day}`,
        photosCount: dayPhotos.length,
        targetCount,
        panchayatCoverage: uniquePanchayats,
        featuredPhotos: dayPhotos.slice(0, 4),
      });
    }

    return summaries;
  }, [photos, selectedCluster, activeRole]);

  // Filtered Photos for Gallery View
  const filteredPhotos = useMemo(() => {
    return photos.filter((p) => {
      // Cluster filter
      const matchCluster =
        activeRole === 'Cluster Admin'
          ? p.clusterId.toLowerCase() === 'dharmapuri'
          : selectedCluster === 'all' || p.clusterId.toLowerCase() === selectedCluster.toLowerCase();

      // Day Tab filter
      const matchDay = selectedDayTab === 'all' || p.dayNumber === selectedDayTab;

      // Panchayat filter
      const matchPanchayat =
        selectedPanchayat === 'all' ||
        p.panchayatId.toLowerCase() === selectedPanchayat.toLowerCase() ||
        p.panchayatName.toLowerCase() === selectedPanchayat.toLowerCase();

      // Village filter
      const matchVillage =
        selectedVillage === 'all' ||
        (p.villageName || '').toLowerCase() === selectedVillage.toLowerCase();

      // Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.sessionTitle.toLowerCase().includes(q) ||
        p.panchayatName.toLowerCase().includes(q) ||
        p.villageName.toLowerCase().includes(q) ||
        p.uploadedBy.toLowerCase().includes(q) ||
        p.originalFilename.toLowerCase().includes(q);

      return matchCluster && matchDay && matchPanchayat && matchVillage && matchSearch;
    });
  }, [photos, selectedCluster, activeRole, selectedDayTab, selectedPanchayat, selectedVillage, searchQuery]);

  // ==========================================
  // ZIP DOWNLOAD HANDLER WITH REAL PROGRESS
  // ==========================================
  const handleDownloadZip = async (
    type: 'day' | 'cluster-all-days' | 'all-clusters' | 'filtered',
    dayNumber?: number
  ) => {
    // Unique key to track button state and prevent double-clicks
    const key =
      type === 'day'
        ? `day-${dayNumber}`
        : type === 'cluster-all-days'
        ? `cluster-${selectedCluster}`
        : type === 'all-clusters'
        ? 'all-clusters'
        : 'filtered';

    if (downloadingZipKey) {
      console.warn('Another ZIP download is already in progress.');
      return;
    }

    setDownloadingZipKey(key);
    setCompletedZipKey(null);

    // Stepped Progress Simulation
    setZipProgress({
      stage: 'preparing',
      message: 'Preparing ZIP request...',
      progressPercent: 15,
    });

    try {
      await new Promise((r) => setTimeout(r, 250));

      setZipProgress({
        stage: 'collecting',
        message: 'Collecting original session photos from storage...',
        progressPercent: 40,
      });

      await new Promise((r) => setTimeout(r, 300));

      setZipProgress({
        stage: 'creating',
        message: 'Generating compressed ZIP archive on backend...',
        progressPercent: 70,
      });

      // Construct URL parameters
      const params = new URLSearchParams();
      params.append('type', type);
      params.append(
        'cluster',
        activeRole === 'Cluster Admin' ? 'dharmapuri' : selectedCluster
      );
      params.append('userRole', activeRole);

      if (type === 'day' && dayNumber) {
        params.append('dayNumber', String(dayNumber));
      } else if (type === 'filtered') {
        if (selectedDayTab !== 'all') params.append('dayNumber', String(selectedDayTab));
        if (selectedPanchayat !== 'all') params.append('panchayatId', selectedPanchayat);
        if (selectedVillage !== 'all') params.append('village', selectedVillage);
      }

      const zipUrl = apiUrl(`/api/session-photos/download-zip?${params.toString()}`);

      setZipProgress({
        stage: 'downloading',
        message: 'Streaming ZIP package to your device...',
        progressPercent: 90,
      });

      // Perform Fetch to trigger download
      const response = await fetch(zipUrl);
      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(
          errorJson.error || 'Unable to create the ZIP file. Please try again.'
        );
      }

      // Extract filename from header
      let downloadFilename = 'TQI_Session_Photos.zip';
      const disposition = response.headers.get('Content-Disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          downloadFilename = match[1];
        }
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      // Success State
      setZipProgress({
        stage: 'completed',
        message: 'ZIP downloaded successfully.',
        progressPercent: 100,
        zipFilename: downloadFilename,
      });
      setCompletedZipKey(key);

      // Auto clear progress banner after 4 seconds
      setTimeout(() => {
        setZipProgress({
          stage: 'idle',
          message: '',
          progressPercent: 0,
        });
      }, 4000);
    } catch (err: any) {
      console.error('ZIP download failed:', err);
      setZipProgress({
        stage: 'error',
        message: err.message || 'Unable to create the ZIP file. Please try again.',
        progressPercent: 0,
        errorMessage: err.message || 'Unable to create the ZIP file. Please try again.',
      });
    } finally {
      setDownloadingZipKey(null);
    }
  };

  // ==========================================
  // SINGLE PHOTO ACTIONS
  // ==========================================
  const handleDownloadSinglePhoto = (photo: SessionPhotoItem) => {
    const downloadUrl = apiUrl(`/api/session-photos/${photo.id}/download`);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = photo.originalFilename || `Photo_${photo.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeletePhoto = async (photo: SessionPhotoItem) => {
    try {
      const res = await fetch(apiUrl(`/api/session-photos/${photo.id}`), {
        method: 'DELETE',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (!res.ok) {
        throw new Error('Failed to delete photo.');
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setPhotoToDelete(null);
      if (selectedPhoto && selectedPhoto.id === photo.id) {
        setSelectedPhoto(null);
      }
    } catch (err) {
      alert('Failed to delete photo. Please try again.');
    }
  };

  // ==========================================
  // PHOTO UPLOAD HANDLER
  // ==========================================
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0) {
      setUploadError('Please select at least one photograph to upload.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('clusterId', selectedCluster.toLowerCase());
    formData.append('clusterName', selectedCluster);
    formData.append('sessionTitle', uploadTitle);
    formData.append('dayNumber', String(uploadDay));
    formData.append('date', uploadDate);
    formData.append('panchayatId', uploadPanchayat);

    const foundP = panchayats.find((p) => p.id === uploadPanchayat || p.name === uploadPanchayat);
    formData.append('panchayatName', foundP ? foundP.name : uploadPanchayat);
    formData.append('villageName', uploadVillage);
    formData.append('uploadedBy', uploadUploader);
    formData.append('uploadedRole', activeRole);
    formData.append('caption', uploadCaption);

    uploadFiles.forEach((file) => {
      formData.append('photos', file);
    });

    try {
      const res = await fetch(apiUrl('/api/session-photos/upload'), {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Upload failed.');
      }


      // Add new photos to local state
      if (data.photos && Array.isArray(data.photos)) {
        setPhotos((prev) => [...data.photos, ...prev]);
      }

      setShowUploadModal(false);
      setUploadFiles([]);
      setUploadCaption('');
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.message || 'Failed to upload photographs.');
    } finally {
      setIsUploading(false);
    }
  };

  // Quick Open Upload for specific day
  const handleOpenUploadForDay = (day: number) => {
    setUploadDay(day);
    setShowUploadModal(true);
  };

  if (activeRole === 'Super Admin' && selectedCluster !== 'all' && selectedDayTab !== 'all') {
    const selectedDayPhotos = photos.filter(
      (photo) => photo.clusterId.toLowerCase() === selectedCluster.toLowerCase() && photo.dayNumber === selectedDayTab,
    );

    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-2">
              <button type="button" onClick={() => setSelectedCluster('all')} className="hover:text-[#0B3D91]">Session Photos</button>
              <span>/</span><span>{selectedCluster}</span><span>/</span><span className="font-semibold text-[#0B3D91]">Day {selectedDayTab}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{selectedCluster} - Day {selectedDayTab} Photos</h1>
            <p className="text-sm text-slate-500 mt-1">Review the real photo records submitted for this day.</p>
          </div>
          <button type="button" onClick={() => { setSelectedDayTab('all'); setExpandedDay(null); }} className="px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700">Back to Days</button>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>{selectedDayPhotos.length} photo records</span>
          <button type="button" disabled={!selectedDayPhotos.length} onClick={() => handleDownloadZip('day', selectedDayTab)} className="px-3 py-2 rounded-md bg-[#0B3D91] text-white text-xs font-bold disabled:bg-slate-200 disabled:text-slate-400">Download Day {selectedDayTab} ZIP</button>
        </div>

        {selectedDayPhotos.length === 0 ? (
          <div className="py-20 text-center bg-white border border-slate-200 rounded-md text-sm text-slate-500">No photos are available for Day {selectedDayTab}.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedDayPhotos.map((photo) => (
              <article key={photo.id} className="bg-white border border-slate-200 rounded-md p-4 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h2 className="text-sm font-bold text-slate-900 truncate">{photo.originalFilename}</h2><p className="text-xs text-slate-500 mt-1">{photo.caption || photo.sessionTitle}</p></div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-blue-50 text-[#0B3D91]">Day {photo.dayNumber}</span>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">Uploaded by {photo.uploadedBy || 'Cluster Admin'}</div>
                <div className="flex gap-2 mt-3"><a href={photo.fileUrl} target="_blank" rel="noreferrer" className="flex-1 text-center px-3 py-2 rounded-md bg-[#0B3D91] text-white text-xs font-bold">View Photos</a><a href={photo.fileUrl} target="_blank" rel="noreferrer" download className="px-3 py-2 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">Download</a></div>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* ==========================================
          HEADER & ROLE CONTROLS
          ========================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
            <button
              onClick={() => onNavigate && onNavigate('dashboard')}
              className="hover:text-[#0B3D91] transition-colors cursor-pointer"
            >
              Dashboard
            </button>
            <span className="text-slate-400">/</span>
            <span className="text-slate-700 font-semibold">{selectedCluster}</span>
            <span className="text-slate-400">/</span>
            <span className="text-[#0B3D91] font-semibold">Session Photos</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Session Photographs &amp; ZIP Archives
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-blue-50 text-[#0B3D91] border border-blue-200">
              {activeRole}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Browse and download high-resolution session activity images organized across Days 1 through 8.
          </p>
        </div>

        {/* Header Action Buttons & Role Switcher */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">


          {/* Super Admin: Download All Clusters ZIP */}
          {activeRole === 'Super Admin' && (
            <button
              id="download-all-clusters-zip-btn"
              disabled={downloadingZipKey !== null}
              onClick={() => handleDownloadZip('all-clusters')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold shadow-xs transition-all cursor-pointer ${
                downloadingZipKey === 'all-clusters'
                  ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white active:scale-[0.98]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {downloadingZipKey === 'all-clusters' ? 'sync' : 'folder_zip'}
              </span>
              {downloadingZipKey === 'all-clusters'
                ? 'Creating ZIP...'
                : completedZipKey === 'all-clusters'
                ? 'Download All Clusters Again'
                : 'Download All Clusters (ZIP)'}
            </button>
          )}

          {/* Cluster Level: Download All 8 Days ZIP */}
          <button
            id="download-all-8-days-zip-btn"
            disabled={downloadingZipKey !== null}
            onClick={() => handleDownloadZip('cluster-all-days')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold shadow-xs transition-all cursor-pointer ${
              downloadingZipKey === `cluster-${selectedCluster}`
                ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                : 'bg-[#0B3D91] hover:bg-[#082a66] text-white active:scale-[0.98]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {downloadingZipKey === `cluster-${selectedCluster}` ? 'sync' : 'cloud_download'}
            </span>
            {downloadingZipKey === `cluster-${selectedCluster}`
              ? 'Creating ZIP...'
              : completedZipKey === `cluster-${selectedCluster}`
              ? `Download ${selectedCluster} Again`
              : `Download All 8 Days (${selectedCluster})`}
          </button>

          {/* Upload Photos Button */}
          {activeRole !== 'Super Admin' && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-md shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
              Upload Photos
            </button>
          )}
        </div>
      </div>

      {/* ==========================================
          PROGRESS & FEEDBACK BANNER
          ========================================== */}
      {!showClusterLanding && zipProgress.stage !== 'idle' && (
        <div
          className={`rounded-md p-4 border transition-all ${
            zipProgress.stage === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : zipProgress.stage === 'completed'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-blue-50/90 border-blue-200 text-blue-950'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`material-symbols-outlined text-[24px] ${
                  zipProgress.stage === 'error'
                    ? 'text-rose-600'
                    : zipProgress.stage === 'completed'
                    ? 'text-emerald-600'
                    : 'text-[#0B3D91] animate-spin'
                }`}
              >
                {zipProgress.stage === 'error'
                  ? 'error'
                  : zipProgress.stage === 'completed'
                  ? 'check_circle'
                  : 'progress_activity'}
              </span>
              <div>
                <div className="font-bold text-sm">{zipProgress.message}</div>
                {zipProgress.zipFilename && (
                  <div className="text-xs text-slate-600 mt-0.5">
                    Saved as <span className="font-mono font-semibold">{zipProgress.zipFilename}</span>
                  </div>
                )}
                {zipProgress.errorMessage && (
                  <div className="text-xs text-rose-700 mt-0.5 font-medium">
                    {zipProgress.errorMessage}
                  </div>
                )}
              </div>
            </div>

            {zipProgress.stage === 'completed' && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-md">
                Complete
              </span>
            )}
          </div>

          {/* Progress Bar */}
          {zipProgress.stage !== 'error' && zipProgress.stage !== 'completed' && (
            <div className="w-full bg-blue-100/80 h-1.5 rounded-full overflow-hidden mt-3">
              <div
                className="bg-[#0B3D91] h-full transition-all duration-300 rounded-full"
                style={{ width: `${zipProgress.progressPercent}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          SUPER ADMIN CLUSTER SELECTOR (IF SUPER ADMIN)
          ========================================== */}
      {activeRole === 'Super Admin' && (
        <div className="bg-slate-900 text-white rounded-md p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Super Admin Multi-Cluster View
            </span>
            <div className="text-sm font-semibold text-slate-100">
              Select Cluster to Inspect or Download:
            </div>
          </div>
          <div className="flex items-center gap-2">
            {['Dharmapuri', 'Salem', 'Krishnagiri'].map((cName) => (
              <button
                key={cName}
                onClick={() => setSelectedCluster(cName)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  selectedCluster.toLowerCase() === cName.toLowerCase()
                    ? 'bg-[#FF7A00] text-white shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cName} Cluster
              </button>
            ))}
          </div>
        </div>
      )}

      {showClusterLanding && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Session Photos - Clusters</h2>
            <p className="text-xs text-slate-500 mt-1">Select a cluster to view its Day 1 to Day 8 photo albums.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {photoClusters.map((cluster) => {
              const clusterPhotos = photos.filter((photo) => photo.clusterId.toLowerCase() === cluster.id.toLowerCase());
              const days = new Set(clusterPhotos.map((photo) => photo.dayNumber)).size;
              return (
                <button
                  key={cluster.id}
                  type="button"
                  onClick={() => { setSelectedCluster(cluster.id); setSelectedDayTab('all'); }}
                  className="text-left bg-white border border-slate-200 rounded-md p-5 shadow-xs hover:border-[#0B3D91] hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="w-10 h-10 rounded-md bg-blue-50 text-[#0B3D91] flex items-center justify-center"><span className="material-symbols-outlined">hub</span></div>
                    <span className="text-xs font-bold text-[#0B3D91]">View cluster</span>
                  </div>
                  <h3 className="mt-5 text-base font-bold text-slate-900">{cluster.name}</h3>
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-xs">
                    <span><strong className="block text-slate-900">{days}/8</strong><em className="not-italic text-slate-500">Days</em></span>
                    <span><strong className="block text-slate-900">{clusterPhotos.length}</strong><em className="not-italic text-slate-500">Photos</em></span>
                    <span><strong className="block text-slate-900">{new Set(clusterPhotos.map((photo) => photo.panchayatId).filter(Boolean)).size}</strong><em className="not-italic text-slate-500">Panchayats</em></span>
                  </div>
                </button>
              );
            })}
          </div>
          {photoClusters.length === 0 && <div className="py-14 text-center bg-white border border-slate-200 rounded-md text-sm text-slate-500">No session photo clusters found in MySQL.</div>}
        </section>
      )}

      {/* ==========================================
          SECTION 1: DAY 1 TO DAY 8 CARDS
          (Each with [View Photos], [Upload Photos], [Download ZIP])
          ========================================== */}
      <div className={showClusterLanding ? 'hidden' : ''}>
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Daily Session Albums ({selectedCluster})
            </h2>
            <p className="text-xs text-slate-500">
              Download ZIP archives for each individual day or explore photo gallery.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Total Photos: <strong className="text-slate-900">{photos.length}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {daySummaries.map((daySummary) => {
            const isDayDownloading = downloadingZipKey === `day-${daySummary.dayNumber}`;
            const isDayCompleted = completedZipKey === `day-${daySummary.dayNumber}`;

            return (
              <div
                key={daySummary.dayNumber}
                className="bg-white border border-slate-200 rounded-md p-4 shadow-xs hover:border-[#0B3D91]/40 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-md bg-[#0B3D91]/10 text-[#0B3D91] flex items-center justify-center font-bold text-xs">
                        D{daySummary.dayNumber}
                      </span>
                      <div>
                        <button
                          type="button"
                          onClick={() => { setExpandedDay(expandedDay === daySummary.dayNumber ? null : daySummary.dayNumber); setSelectedDayTab(daySummary.dayNumber); }}
                          className="font-bold text-sm text-slate-900 text-left hover:text-[#0B3D91]"
                        >
                          {daySummary.dayLabel}
                        </button>
                        <span className="text-[11px] text-slate-500">{daySummary.date}</span>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        daySummary.photosCount > 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {daySummary.photosCount} Photos
                    </span>
                  </div>

                  {/* Photo Thumbnails Preview */}
                  <div className="grid grid-cols-4 gap-1.5 my-3">
                    {daySummary.featuredPhotos.length > 0 ? (
                      daySummary.featuredPhotos.map((p, pIdx) => (
                        <div
                          key={p.id || pIdx}
                          onClick={() => setSelectedPhoto(p)}
                          className="aspect-square rounded-md overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer hover:opacity-85 transition-opacity"
                        >
                          <img
                            src={p.fileUrl}
                            alt={p.originalFilename}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ))
                    ) : (
                      <div className="col-span-4 py-4 text-center text-xs text-slate-400 bg-slate-50 rounded-md border border-dashed border-slate-200">
                        No photos yet for this day
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 mb-3 flex items-center justify-between">
                    <span>Coverage: {daySummary.panchayatCoverage} Panchayats</span>
                    <span>Target: {daySummary.targetCount}</span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2.5 border-t border-slate-100 flex flex-col gap-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => {
                        setExpandedDay(daySummary.dayNumber);
                        setSelectedDayTab(daySummary.dayNumber);
                        const element = document.getElementById('gallery-section');
                        element?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">grid_view</span>
                      View
                    </button>

                    {activeRole !== 'Super Admin' && (
                      <button
                        onClick={() => handleOpenUploadForDay(daySummary.dayNumber)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">upload</span>
                        Upload
                      </button>
                    )}
                  </div>

                  {/* Download ZIP Button */}
                  <button
                    id={`download-day-${daySummary.dayNumber}-zip-btn`}
                    disabled={downloadingZipKey !== null || daySummary.photosCount === 0}
                    onClick={() => handleDownloadZip('day', daySummary.dayNumber)}
                    className={`w-full py-1.5 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer ${
                      daySummary.photosCount === 0
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : isDayDownloading
                        ? 'bg-blue-100 text-[#0B3D91] cursor-wait'
                        : 'bg-[#0B3D91] hover:bg-[#082a66] text-white active:scale-[0.98]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isDayDownloading ? 'sync' : 'folder_zip'}
                    </span>
                    {isDayDownloading
                      ? 'Creating ZIP...'
                      : isDayCompleted
                      ? 'Download Again'
                      : `Download Day ${daySummary.dayNumber} ZIP`}
                  </button>

                  {expandedDay === daySummary.dayNumber && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Day {daySummary.dayNumber} photo list</span>
                        <button type="button" onClick={() => setExpandedDay(null)} className="text-[11px] font-semibold text-slate-500 hover:text-slate-900">Close</button>
                      </div>
                      {daySummary.featuredPhotos.length === 0 ? (
                        <div className="rounded-md bg-slate-50 border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">No photos or folders are available for this day.</div>
                      ) : (
                        daySummary.featuredPhotos.map((photo) => (
                          <div key={photo.id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 border border-slate-200 px-2.5 py-2">
                            <div className="min-w-0"><div className="text-xs font-semibold text-slate-800 truncate">{photo.originalFilename}</div><div className="text-[10px] text-slate-500 truncate">{photo.caption || photo.sessionTitle}</div></div>
                            <a href={photo.fileUrl} target="_blank" rel="noreferrer" className="shrink-0 px-2 py-1 rounded bg-[#0B3D91] text-white text-[10px] font-bold">View</a>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ==========================================
          SECTION 2: FILTER PANEL & SEARCH
          ========================================== */}
      <div id="gallery-section" className={`${showClusterLanding ? 'hidden ' : ''}bg-white border border-slate-200 rounded-md p-4 shadow-xs space-y-3.5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Session Photos Gallery &amp; Filters</h2>
            <p className="text-xs text-slate-500">Filter photographs by Day, Panchayat, and Village center.</p>
          </div>

          {/* Filtered ZIP Download CTA */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-900">{filteredPhotos.length}</strong> photos
            </span>

            <button
              id="download-filtered-zip-btn"
              disabled={downloadingZipKey !== null || filteredPhotos.length === 0}
              onClick={() => handleDownloadZip('filtered')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ${
                filteredPhotos.length === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : downloadingZipKey === 'filtered'
                  ? 'bg-slate-200 text-slate-600'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {downloadingZipKey === 'filtered' ? 'sync' : 'download'}
              </span>
              {downloadingZipKey === 'filtered' ? 'Creating ZIP...' : 'Download Filtered ZIP'}
            </button>
          </div>
        </div>

        {/* Day Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedDayTab('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              selectedDayTab === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Days ({photos.length})
          </button>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((dNum) => {
            const count = photos.filter((p) => p.dayNumber === dNum).length;
            return (
              <button
                key={dNum}
                onClick={() => setSelectedDayTab(dNum)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedDayTab === dNum
                    ? 'bg-[#0B3D91] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Day {dNum} ({count})
              </button>
            );
          })}
        </div>

        {/* Filter Selectors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Panchayat
            </label>
            <select
              value={selectedPanchayat}
              onChange={(e) => {
                setSelectedPanchayat(e.target.value);
                setSelectedVillage('all');
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#0B3D91]"
            >
              <option value="all">All Panchayats</option>
              {panchayats.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Village Center
            </label>
            <select
              value={selectedVillage}
              onChange={(e) => setSelectedVillage(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#0B3D91]"
            >
              <option value="all">All Villages</option>
              {currentFilterVillages.map((v) => (
                <option key={v.id} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Search by Topic, Village or Volunteer
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2 text-[18px] text-slate-400">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search session title, volunteer name, file..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#0B3D91]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
                >
                  clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================
          SECTION 3: PHOTO GALLERY GRID
          (Every Photo has View, Download, Delete)
          ========================================== */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-500 bg-white rounded-md border border-slate-200">
          <span className="material-symbols-outlined text-[32px] animate-spin text-[#0B3D91]">
            progress_activity
          </span>
          <p className="text-xs font-semibold mt-2">Loading high-resolution session photos...</p>
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-md border border-slate-200 p-6">
          <span className="material-symbols-outlined text-[42px] text-slate-300 mb-2">
            image_not_supported
          </span>
          <h3 className="font-bold text-slate-800 text-sm">No Photographs Match Your Filter</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search criteria, selecting another Day or uploading new session photos.
          </p>
          <button
            onClick={() => {
              setSelectedDayTab('all');
              setSelectedPanchayat('all');
              setSelectedVillage('all');
              setSearchQuery('');
            }}
            className="mt-3 px-3 py-1.5 text-xs font-bold text-[#0B3D91] bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPhotos.map((photo) => (
            <div
              key={photo.id}
              className="group bg-white rounded-md border border-slate-200 overflow-hidden shadow-xs hover:shadow-sm transition-all flex flex-col"
            >
              {/* Photo Display with Hover Overlay */}
              <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden cursor-pointer">
                <img
                  src={photo.fileUrl}
                  alt={photo.sessionTitle}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                  onClick={() => setSelectedPhoto(photo)}
                />

                {/* Day Badge */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70  text-white text-[10px] font-bold">
                  Day {photo.dayNumber}
                </div>

                {/* Original File Size */}
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70  text-white text-[10px] font-mono">
                  {Math.round((photo.fileSize || 50000) / 1024)} KB
                </div>

                {/* Hover Quick Actions */}
                <div className="absolute inset-0  from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 text-white">
                  <p className="text-xs font-bold leading-tight line-clamp-1">{photo.sessionTitle}</p>
                  <p className="text-[11px] text-slate-200 mt-0.5">
                    {photo.panchayatName} â€¢ {photo.villageName}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPhoto(photo);
                      }}
                      className="px-2 py-1 bg-white20 hover:bg-white30  rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">visibility</span>
                      View
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadSinglePhoto(photo);
                      }}
                      className="px-2 py-1 bg-[#0B3D91] hover:bg-[#082a66] rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">download</span>
                      Download
                    </button>
                  </div>
                </div>
              </div>

              {/* Photo Card Footer Details */}
              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-xs text-slate-900 line-clamp-1">
                    {photo.sessionTitle}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {photo.panchayatName} â€¢ {photo.villageName}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>By {photo.uploadedBy}</span>
                    <span>{photo.date}</span>
                  </div>
                </div>

                {/* 3 Explicit Action Buttons: [View] [Download] [Delete] */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-1 text-[11px] font-semibold">
                  <button
                    onClick={() => setSelectedPhoto(photo)}
                    className="py-1 px-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="View Full Resolution"
                  >
                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                    View
                  </button>

                  <button
                    onClick={() => handleDownloadSinglePhoto(photo)}
                    className="py-1 px-1.5 text-[#0B3D91] bg-blue-50 hover:bg-blue-100 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Download Original File"
                  >
                    <span className="material-symbols-outlined text-[14px]">download</span>
                    Download
                  </button>

                  <button
                    onClick={() => setPhotoToDelete(photo)}
                    className="py-1 px-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Delete Photo"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==========================================
          MODAL 1: HIGH RESOLUTION LIGHTBOX MODAL
          ========================================== */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/90  z-[110] flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-5xl w-full bg-slate-900 border border-slate-700 rounded-md overflow-hidden shadow-sm animate-[fadeIn_0.2s_ease-out] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex justify-between items-center text-white">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#0B3D91] rounded text-[10px] font-bold">
                    Day {selectedPhoto.dayNumber}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold">{selectedPhoto.sessionTitle}</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedPhoto.panchayatName} â€¢ {selectedPhoto.villageName} â€¢ {selectedPhoto.date}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadSinglePhoto(selectedPhoto)}
                  className="px-3 py-1.5 bg-[#0B3D91] hover:bg-[#082a66] text-white rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Download Original
                </button>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* High-res Image Preview */}
            <div className="max-h-[68vh] bg-black/90 flex items-center justify-center p-2">
              <img
                src={selectedPhoto.fileUrl}
                alt={selectedPhoto.sessionTitle}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Modal Footer Metadata */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <span>
                  Uploaded by: <strong className="text-white">{selectedPhoto.uploadedBy}</strong>
                </span>
                <span>
                  Filename: <strong className="text-white font-mono">{selectedPhoto.originalFilename}</strong>
                </span>
                <span>
                  Size: <strong className="text-white font-mono">{Math.round((selectedPhoto.fileSize || 50000) / 1024)} KB</strong>
                </span>
              </div>

              <button
                onClick={() => {
                  setPhotoToDelete(selectedPhoto);
                }}
                className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Delete Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 2: UPLOAD MULTIPLE SESSION PHOTOS
          ========================================== */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60  z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-sm w-full max-w-xl overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-slate-900">Upload Session Photographs</h2>
                <p className="text-xs text-slate-500">
                  Upload original high-resolution camera images for session archiving.
                </p>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4 text-xs">
              {uploadError && (
                <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-md font-medium">
                  {uploadError}
                </div>
              )}

              {/* Target Day & Session Title */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Session Day *</label>
                  <select
                    value={uploadDay}
                    onChange={(e) => setUploadDay(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md font-semibold focus:outline-none focus:border-[#0B3D91]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((d) => (
                      <option key={d} value={d}>
                        Day {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Session Title *</label>
                  <input
                    type="text"
                    required
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Spoken English Dialogue Workshop"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#0B3D91]"
                  />
                </div>
              </div>

              {/* Panchayat & Village */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Panchayat *</label>
                  <select
                    value={uploadPanchayat}
                    onChange={(e) => setUploadPanchayat(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#0B3D91]"
                  >
                    {panchayats.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Village Center *</label>
                  <input
                    type="text"
                    required
                    value={uploadVillage}
                    onChange={(e) => setUploadVillage(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#0B3D91]"
                  />
                </div>
              </div>

              {/* Date & Uploader */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={uploadDate}
                    onChange={(e) => setUploadDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#0B3D91]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Uploader Name *</label>
                  <input
                    type="text"
                    required
                    value={uploadUploader}
                    onChange={(e) => setUploadUploader(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#0B3D91]"
                  />
                </div>
              </div>

              {/* File Dropzone */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Photographs *</label>
                <input
                  id="session-photo-file-input"
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    if (e.target.files) {
                      setUploadFiles(Array.from(e.target.files));
                    }
                  }}
                  className="hidden"
                />

                <label
                  htmlFor="session-photo-file-input"
                  className="border-2 border-dashed border-slate-300 hover:border-[#0B3D91] rounded-md p-6 text-center cursor-pointer bg-slate-50 hover:bg-blue-50/40 transition-colors"
                >
                  <span className="material-symbols-outlined text-[32px] text-slate-400 mb-1">
                    cloud_upload
                  </span>
                  <div className="font-bold text-slate-800">Click to choose image files</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Supports JPG, PNG, WEBP high-resolution photos.
                  </p>
                </label>

                {uploadFiles.length > 0 && (
                  <div className="mt-2.5 space-y-1">
                    <span className="font-semibold text-slate-700">
                      Selected {uploadFiles.length} file(s):
                    </span>
                    <div className="max-h-24 overflow-y-auto space-y-1 bg-slate-50 p-2 rounded-md border border-slate-200">
                      {uploadFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] text-slate-600">
                          <span className="truncate max-w-[300px] font-mono">{f.name}</span>
                          <span className="text-slate-400">{Math.round(f.size / 1024)} KB</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || uploadFiles.length === 0}
                  className={`px-5 py-2 rounded-md font-bold text-white transition-all shadow-xs flex items-center gap-2 ${
                    isUploading || uploadFiles.length === 0
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-[#0B3D91] hover:bg-[#082a66]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isUploading ? 'sync' : 'upload'}
                  </span>
                  {isUploading ? 'Uploading Photos...' : `Upload ${uploadFiles.length} Photos`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 3: DELETE PHOTO CONFIRMATION
          ========================================== */}
      {photoToDelete && (
        <div className="fixed inset-0 bg-slate-900/60  z-[120] flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-sm w-full max-w-sm p-5 text-center space-y-3">
            <span className="material-symbols-outlined text-[38px] text-rose-600">
              warning
            </span>
            <h3 className="font-bold text-base text-slate-900">Delete Photo?</h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to permanently remove <strong className="text-slate-900">{photoToDelete.originalFilename}</strong>? This action cannot be undone.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={() => setPhotoToDelete(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePhoto(photoToDelete)}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-bold shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


