import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  SessionPhotoItem,
  DayPhotoSummary,
  Panchayat,
  ZipProgressState,
  TabType,
  Cluster,
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

  // Photos Collection
  const [photos, setPhotos] = useState<SessionPhotoItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selection & Modals
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<SessionPhotoItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [photoToDelete, setPhotoToDelete] = useState<SessionPhotoItem | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

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

  // Fetch photos from server
  const fetchPhotos = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const clusterParam = userRole === 'Cluster Admin' ? currentCluster.toLowerCase() : selectedCluster.toLowerCase();
      const yearParam = selectedAcademicYearId ? `&academicYearId=${encodeURIComponent(selectedAcademicYearId)}` : '';
      const res = await fetch(apiUrl(`/api/session-photos?cluster=${clusterParam}&role=${encodeURIComponent(userRole)}${yearParam}`), {
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
      setLoadError('Failed to connect to backend server for photos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [userRole, selectedCluster, authToken, selectedAcademicYearId]);

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

  // Days 1 through 8 Summary
  const daySummaries = useMemo(() => {
    const targetClusterPhotos = photos.filter(
      (p) =>
        userRole === 'Cluster Admin' ||
        selectedCluster === 'all' ||
        p.clusterId.toLowerCase() === selectedCluster.toLowerCase()
    );

    return [1, 2, 3, 4, 5, 6, 7, 8].map((day) => {
      const dayPhotos = targetClusterPhotos.filter((p) => p.dayNumber === day);
      return {
        dayNumber: day,
        photosCount: dayPhotos.length,
      };
    });
  }, [photos, selectedCluster, userRole]);

  // Filtered Photos for Gallery
  const filteredPhotos = useMemo(() => {
    return photos.filter((p) => {
      const matchCluster =
        userRole === 'Cluster Admin'
          ? p.clusterId.toLowerCase() === currentCluster.toLowerCase()
          : selectedCluster === 'all' || p.clusterId.toLowerCase() === selectedCluster.toLowerCase();

      const matchDay = selectedDayTab === 'all' || p.dayNumber === selectedDayTab;

      const matchPanchayat =
        selectedPanchayat === 'all' ||
        p.panchayatId.toLowerCase() === selectedPanchayat.toLowerCase() ||
        p.panchayatName.toLowerCase() === selectedPanchayat.toLowerCase();

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
  }, [photos, selectedCluster, userRole, selectedDayTab, selectedPanchayat, selectedVillage, searchQuery, currentCluster]);

  // ZIP Download Handler
  const handleDownloadZip = async (type: 'day' | 'cluster-all-days' | 'all-clusters' | 'filtered', dayNumber?: number) => {
    const key = type === 'day' ? `day-${dayNumber}` : type === 'filtered' ? 'filtered' : 'all';
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
        if (selectedDayTab !== 'all') params.append('dayNumber', String(selectedDayTab));
        if (selectedPanchayat !== 'all') params.append('panchayatId', selectedPanchayat);
        if (selectedVillage !== 'all') params.append('village', selectedVillage);
      }

      const zipUrl = apiUrl(`/api/session-photos/download-zip?${params.toString()}`);
      const response = await fetch(zipUrl);
      if (!response.ok) {
        throw new Error('Unable to create ZIP archive.');
      }

      let downloadFilename = `TQI_Session_Photos_${selectedCluster}_${Date.now()}.zip`;
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
    const downloadUrl = photo.fileUrl || apiUrl(`/api/session-photos/${photo.id}/download`);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_blank';
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
      setSelectedPhotoIds((prev) => prev.filter((id) => id !== photo.id));
      setPhotoToDelete(null);
      if (previewPhoto?.id === photo.id) setPreviewPhoto(null);
    } catch (err) {
      alert('Failed to delete photo. Please try again.');
    }
  };

  const handleBulkDelete = async () => {
    try {
      for (const id of selectedPhotoIds) {
        await fetch(apiUrl(`/api/session-photos/${id}`), {
          method: 'DELETE',
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
      }
      setPhotos((prev) => prev.filter((p) => !selectedPhotoIds.includes(p.id)));
      setSelectedPhotoIds([]);
      setShowBulkDeleteConfirm(false);
    } catch (err) {
      alert('Failed to delete selected photos.');
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
    formData.append('uploadedRole', userRole);
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

      if (data.photos && Array.isArray(data.photos)) {
        setPhotos((prev) => [...data.photos, ...prev]);
      } else {
        await fetchPhotos();
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

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Session Photographs Archive
            </h1>
            <Badge variant="default" size="sm">
              {filteredPhotos.length} Photos
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Curated visual evidence and activity documentation across Day 1–8 learning program cycles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedPhotoIds.length > 0 && (
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

          <Button
            size="sm"
            onClick={() => setShowUploadModal(true)}
            className="gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Upload Photos</span>
          </Button>
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
              style={{ width: `${zipProgress.progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* 2. Cycle Day Progress Bar (Day 1 - Day 8) */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((day) => {
          const daySummary = daySummaries.find((d) => d.dayNumber === day);
          const count = daySummary?.photosCount || 0;
          const isSelected = selectedDayTab === day;

          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDayTab(isSelected ? 'all' : day)}
              className={`rounded-lg border p-2.5 text-left transition ${
                isSelected
                  ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                  : 'border-border bg-card hover:bg-muted/40 text-foreground'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Day {day}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                  count > 0 ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground'
                }`}>
                  {count}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground truncate">
                {count > 0 ? `${count} photos` : 'No photos'}
              </p>
            </button>
          );
        })}
      </div>

      {/* 3. Filter Bar */}
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

        {userRole === 'Super Admin' && (
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
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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

        {(searchQuery ||
          selectedCluster !== (userRole === 'Cluster Admin' ? currentCluster : 'all') ||
          selectedDayTab !== 'all' ||
          selectedPanchayat !== 'all' ||
          selectedVillage !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedCluster(userRole === 'Cluster Admin' ? currentCluster : 'all');
              setSelectedDayTab('all');
              setSelectedPanchayat('all');
              setSelectedVillage('all');
            }}
            className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Reset Filters
          </Button>
        )}
      </div>

      {/* 4. Photo Gallery Grid */}
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
            description={
              searchQuery || selectedDayTab !== 'all' || selectedPanchayat !== 'all'
                ? 'Try adjusting your day cycle selection or clear current filters.'
                : 'No session photographs have been uploaded yet for this educational cluster.'
            }
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
                className={`group relative flex flex-col justify-between overflow-hidden rounded-lg border bg-card shadow-xs transition hover:shadow-md cursor-pointer ${
                  isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                }`}
              >
                {/* Photo Thumbnail */}
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

                  {/* Top Overlay Badges & Checkbox */}
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2 bg-gradient-to-b from-black/50 to-transparent">
                    <Badge variant="default" size="sm" className="bg-black/60 text-white border-white/20">
                      Day {photo.dayNumber}
                    </Badge>

                    <button
                      type="button"
                      onClick={(e) => handleToggleSelectPhoto(photo.id, e)}
                      className={`flex h-6 w-6 items-center justify-center rounded border transition ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-white/60 bg-black/40 text-transparent hover:border-white'
                      }`}
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

                {/* Photo Card Details */}
                <div className="p-3 space-y-1.5">
                  <h4 className="text-xs font-semibold text-foreground truncate" title={photo.caption || photo.sessionTitle}>
                    {photo.caption || photo.sessionTitle}
                  </h4>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 truncate max-w-[140px]">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{photo.villageName || photo.panchayatName}</span>
                    </span>
                    <span className="font-mono text-[10px]">{photo.date || '—'}</span>
                  </div>
                  <div className="pt-1.5 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="truncate">By {photo.uploadedBy || 'Cluster Admin'}</span>
                    <span className="font-mono">{photo.clusterName || 'Cluster'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Lightbox Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in-0">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-3.5">
              <div>
                <h3 className="text-sm font-bold text-foreground truncate max-w-lg">
                  {previewPhoto.caption || previewPhoto.sessionTitle}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Day {previewPhoto.dayNumber} &middot; {previewPhoto.villageName} &middot; {previewPhoto.clusterName}
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
                  Attach activity evidence for teaching modules and village centers.
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
                      value={String(uploadDay)}
                      onValueChange={(val) => setUploadDay(parseInt(val, 10) || 1)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Day" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            Day {d}
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

                {/* File Upload Box */}
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
                        <span className="font-semibold text-primary">{uploadFiles.length} files selected</span>
                      ) : (
                        'Click to choose photographs from your device'
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Supports multiple JPG, PNG, WebP photos up to 10MB each
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
                  {isUploading ? 'Uploading...' : `Upload ${uploadFiles.length} Photographs`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Delete Confirmation Modal */}
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
                    ? `Are you sure you want to delete ${selectedPhotoIds.length} selected photographs? This action cannot be undone.`
                    : `Are you sure you want to permanently remove this photograph from the session records?`}
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
    </div>
  );
};
