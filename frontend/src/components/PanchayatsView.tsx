import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft,
  Plus, 
  Search, 
  MapPin, 
  Home, 
  GraduationCap, 
  Users, 
  X,
  ChevronRight,
  Trash2,
  GridFour,
  Rows,
} from './ui/icons';
import { Cluster, TabType, Panchayat, UserRole } from '../types';
import Badge from './ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableCell } from './ui/table';
import { ActionButton } from './ui/action-button';
import { apiUrl } from '../utils/api';

interface PanchayatsViewProps {
  panchayats: Panchayat[];
  clusters?: Cluster[];
  currentClusterId?: string;
  authToken?: string;
  selectedAcademicYearId?: string;
  selectedAcademicYearName?: string;
  userRole?: UserRole;
  onSelectPanchayat: (panchayatId: string) => void;
  onAddPanchayat: (panchayat: { name: string; clusterId: string }) => Promise<Panchayat>;
  onDeletePanchayat?: (panchayatId: string) => Promise<void>;
  onNavigate: (tab: TabType, targetId?: string, secondaryParam?: string) => void;
}

export const PanchayatsView: React.FC<PanchayatsViewProps> = ({
  panchayats,
  clusters = [],
  currentClusterId = '',
  authToken,
  selectedAcademicYearId = '',
  selectedAcademicYearName = '',
  userRole = 'Cluster Admin',
  onSelectPanchayat,
  onAddPanchayat,
  onDeletePanchayat,
  onNavigate,
}) => {
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showAdd, setShowAdd]           = useState(false);
  const [selectedCluster, setSelectedCluster] = useState(currentClusterId && currentClusterId !== 'all' ? currentClusterId : 'all');
  const [form, setForm] = useState({ name: '' });
  const [formError, setFormError] = useState('');
  const [isSavingPanchayat, setIsSavingPanchayat] = useState(false);
  const [isPanchayatNameMenuOpen, setIsPanchayatNameMenuOpen] = useState(false);
  const [modalPanchayats, setModalPanchayats] = useState<Panchayat[]>([]);
  const [isLoadingModalPanchayats, setIsLoadingModalPanchayats] = useState(false);
  const [modalPanchayatError, setModalPanchayatError] = useState('');
  const [districtDirectoryNames, setDistrictDirectoryNames] = useState<string[]>([]);
  const [isLoadingDistrictDirectory, setIsLoadingDistrictDirectory] = useState(false);
  const [districtDirectoryError, setDistrictDirectoryError] = useState('');
  const [reloadModalPanchayats, setReloadModalPanchayats] = useState(0);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (currentClusterId && currentClusterId !== 'all' && clusters.some((cluster) => cluster.id === currentClusterId) && selectedCluster !== currentClusterId) {
      setSelectedCluster(currentClusterId);
    } else if (clusters.length === 1 && !clusters.some((cluster) => cluster.id === selectedCluster)) {
      setSelectedCluster(clusters[0].id);
    }
  }, [clusters, currentClusterId, selectedCluster]);

  useEffect(() => {
    if (!showAdd || selectedCluster === 'all' || !selectedAcademicYearId) {
      setModalPanchayats([]);
      setModalPanchayatError('');
      setIsLoadingModalPanchayats(false);
      return;
    }
    const controller = new AbortController();
    const loadModalPanchayats = async () => {
      setModalPanchayats([]);
      setModalPanchayatError('');
      setIsLoadingModalPanchayats(true);
      try {
        const params = new URLSearchParams({
          clusterId: selectedCluster,
          academicYearId: selectedAcademicYearId,
        });
        const response = await fetch(apiUrl(`/api/panchayats?${params.toString()}`), {
          signal: controller.signal,
          cache: 'no-store',
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success || !Array.isArray(data.panchayats)) {
          throw new Error(data?.error || 'Unable to load this cluster’s panchayats.');
        }
        setModalPanchayats(data.panchayats);
      } catch (error: any) {
        if (error?.name !== 'AbortError') setModalPanchayatError(error?.message || 'Unable to load this cluster’s panchayats.');
      } finally {
        if (!controller.signal.aborted) setIsLoadingModalPanchayats(false);
      }
    };
    void loadModalPanchayats();
    return () => controller.abort();
  }, [authToken, reloadModalPanchayats, selectedAcademicYearId, selectedCluster, showAdd]);

  useEffect(() => {
    if (!showAdd || selectedCluster === 'all' || !selectedAcademicYearId) {
      setDistrictDirectoryNames([]);
      setDistrictDirectoryError('');
      setIsLoadingDistrictDirectory(false);
      return;
    }

    const controller = new AbortController();
    const loadDistrictDirectory = async () => {
      setDistrictDirectoryNames([]);
      setDistrictDirectoryError('');
      setIsLoadingDistrictDirectory(true);
      try {
        const response = await fetch(apiUrl(`/api/panchayats/directory?clusterId=${encodeURIComponent(selectedCluster)}`), {
          signal: controller.signal,
          cache: 'no-store',
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        const data = await response.json().catch(() => null);
        if (response.status === 404 && !data?.error) {
          throw new Error('Restart the backend server to load the district panchayat list.');
        }
        if (!response.ok || !data?.success || !Array.isArray(data.panchayats)) {
          throw new Error(data?.error || 'Unable to load the district panchayat list.');
        }
        const names = data.panchayats.filter((name: unknown): name is string => typeof name === 'string' && Boolean(name.trim()));
        setDistrictDirectoryNames(names);
      } catch (error: any) {
        if (error?.name !== 'AbortError') setDistrictDirectoryError(error?.message || 'Unable to load the district panchayat list.');
      } finally {
        if (!controller.signal.aborted) setIsLoadingDistrictDirectory(false);
      }
    };

    void loadDistrictDirectory();
    return () => controller.abort();
  }, [authToken, reloadModalPanchayats, selectedAcademicYearId, selectedCluster, showAdd]);

  const clusterOptions = useMemo(() => [...clusters].sort((a, b) => a.name.localeCompare(b.name)), [clusters]);
  const selectedClusterRecord = clusters.find((cluster) => cluster.id === selectedCluster);
  const selectedClusterLabel = selectedClusterRecord?.name || selectedClusterRecord?.district || 'this cluster';
  const isSuperAdmin = userRole === 'Super Admin';
  const visiblePanchayats = useMemo(() => panchayats.filter((panchayat) =>
    selectedCluster === 'all' || panchayat.clusterId === selectedCluster,
  ), [panchayats, selectedCluster]);
  const totalVillages = useMemo(() => visiblePanchayats.reduce((count, panchayat) => count + (panchayat.villagesCount || panchayat.villages.length), 0), [visiblePanchayats]);
  const totalStudents = useMemo(() => visiblePanchayats.reduce((count, panchayat) => count + panchayat.activeStudents, 0), [visiblePanchayats]);
  const totalVols = useMemo(() => visiblePanchayats.reduce((count, panchayat) => count + panchayat.volunteersCount, 0), [visiblePanchayats]);

  const filtered = useMemo(() =>
    visiblePanchayats.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        p.name.toLowerCase().includes(q) ||
        p.villages.some((v) => v.name.toLowerCase().includes(q));
      const matchStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchSearch && matchStatus;
    }),
    [visiblePanchayats, search, statusFilter]
  );

  const clusterCards = useMemo(() => clusterOptions.map((cluster) => {
    const clusterRows = panchayats.filter((panchayat) => panchayat.clusterId === cluster.id);
    return {
      cluster,
      panchayatCount: clusterRows.length,
      villageCount: clusterRows.reduce((count, panchayat) => count + (panchayat.villagesCount || panchayat.villages.length), 0),
      studentCount: clusterRows.reduce((count, panchayat) => count + panchayat.activeStudents, 0),
    };
  }), [clusterOptions, panchayats]);

  const isShowingClusterCards = isSuperAdmin && selectedCluster === 'all';

  const openAdd = () => {
    setForm({ name: '' });
    setFormError('');
    setIsPanchayatNameMenuOpen(false);
    setShowAdd(true);
  };

  const normalizedPanchayatName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
  const matchingPanchayatOptions = useMemo(() => {
    const query = normalizedPanchayatName(form.name);
    const options = new Map<string, { name: string; alreadyAdded: boolean }>();
    districtDirectoryNames.forEach((name) => options.set(normalizedPanchayatName(name), { name, alreadyAdded: false }));
    modalPanchayats.forEach((item) => options.set(normalizedPanchayatName(item.name), { name: item.name, alreadyAdded: true }));
    return [...options.values()].filter((item) => !query || normalizedPanchayatName(item.name).includes(query));
  }, [districtDirectoryNames, form.name, modalPanchayats]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const name = form.name.trim().replace(/\s+/g, ' ');
    if (!name) {
      setFormError('Panchayat name is required.');
      return;
    }
    if (!selectedAcademicYearId) {
      setFormError('Select an academic year before creating a panchayat.');
      return;
    }
    if (!selectedClusterRecord || selectedCluster === 'all') {
      setFormError('Select a cluster before creating a panchayat.');
      return;
    }
    if (modalPanchayats.some((item) => normalizedPanchayatName(item.name) === normalizedPanchayatName(name))) {
      setFormError('This Panchayat already exists in this Cluster for the selected Academic Year.');
      return;
    }
    setIsSavingPanchayat(true);
    try {
      const created = await onAddPanchayat({ name, clusterId: selectedCluster });
      setModalPanchayats((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setForm({ name: '' });
      setIsPanchayatNameMenuOpen(false);
      setShowAdd(false);
    } catch (error: any) {
      setFormError(error?.message || 'Unable to save panchayat.');
    } finally {
      setIsSavingPanchayat(false);
    }
  };

  const removePanchayat = async (panchayat: Panchayat) => {
    if (!onDeletePanchayat) return;
    if (!window.confirm(`Delete ${panchayat.name}? Linked villages and operational records may prevent deletion.`)) return;
    setDeleteError('');
    try {
      await onDeletePanchayat(panchayat.id);
    } catch (error: any) {
      setDeleteError(error?.message || `Unable to delete ${panchayat.name}.`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'On Track':
        return <Badge color="success" size="sm">On Track</Badge>;
      case 'Correction Required':
        return <Badge color="warning" size="sm">Correction Required</Badge>;
      case 'Action Needed':
        return <Badge color="error" size="sm">Action Needed</Badge>;
      default:
        return <Badge color="light" size="sm">{status}</Badge>;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Cardless Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {isShowingClusterCards ? 'Clusters · Panchayat Directory' : `${selectedClusterRecord?.name || 'Cluster'} · Panchayats & Villages`}
            </h1>
            <Badge color="primary" size="sm">
              {isShowingClusterCards ? `${clusters.length} Clusters` : `${visiblePanchayats.length} Panchayats`}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isShowingClusterCards
              ? 'Choose a cluster to view only its panchayats. Open a panchayat to manage its villages; student records remain in Students.'
              : `${visiblePanchayats.length} panchayats · ${totalVillages} villages · ${totalStudents} students`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSuperAdmin && selectedCluster !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedCluster('all')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Clusters
            </button>
          )}
          {!isShowingClusterCards && <button
            type="button"
            onClick={openAdd}
            disabled={!clusters.length}
            title={clusters.length ? 'Add a Panchayat to a cluster' : 'Create a cluster first'}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>Add Panchayat</span>
          </button>}
        </div>
      </div>
      {/* 2. Compact Metric Cards (counts & status only) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Panchayats</span>
            <MapPin className="h-4 w-4 text-brand-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{visiblePanchayats.length}</div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Villages</span>
            <Home className="h-4 w-4 text-success-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{totalVillages}</div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Coverage</span>
            <Users className="h-4 w-4 text-warning-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{totalStudents + totalVols}</div>
        </div>
      </div>

      {isShowingClusterCards && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Panchayat directory by cluster</h2>
            <p className="mt-1 text-sm text-slate-500">Choose a cluster to see its panchayats, villages, and student counts.</p>
          </div>
          {clusterCards.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {clusterCards.map(({ cluster, panchayatCount, villageCount, studentCount }) => (
                <button
                  key={cluster.id}
                  type="button"
                  onClick={() => { setSelectedCluster(cluster.id); setSearch(''); setStatusFilter('All'); }}
                  className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#0B3D91]/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{cluster.name}</h3>
                      <p className="mt-1 text-xs text-slate-500">{cluster.collegeName || 'College not assigned'}</p>
                      <p className="mt-1 text-xs text-slate-500">{cluster.district || 'District not set'}{cluster.state ? `, ${cluster.state}` : ''}</p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#0B3D91]" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                    <div><strong className="block text-lg text-slate-900">{panchayatCount}</strong><span className="text-[10px] text-slate-500">Panchayats</span></div>
                    <div><strong className="block text-lg text-slate-900">{villageCount}</strong><span className="text-[10px] text-slate-500">Villages</span></div>
                    <div><strong className="block text-lg text-slate-900">{studentCount}</strong><span className="text-[10px] text-slate-500">Students</span></div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No clusters are available for this academic year.</p>
          )}
        </section>
      )}

      {!isShowingClusterCards && <>
      {/* 3. Cardless Search & Filter Bar */}
      {deleteError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{deleteError}</p>}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search panchayats or villages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(['All', 'On Track', 'Correction Required', 'Action Needed'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === s
                  ? 'bg-brand-500 text-white shadow-theme-xs'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto sm:ml-2">
            {filtered.length} of {panchayats.length}
          </span>
          <div className="ml-1 flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800" role="group" aria-label="Panchayat display mode">
            <button
              type="button"
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={`rounded-md p-1.5 transition ${viewMode === 'list' ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
            >
              <Rows className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Card view"
              aria-pressed={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
              className={`rounded-md p-1.5 transition ${viewMode === 'grid' ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
            >
              <GridFour className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Cardless Modern Table */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <MapPin className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-3 text-base font-semibold text-gray-800 dark:text-white">No panchayats found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {search ? 'Try adjusting your search query.' : 'Add your first panchayat to get started.'}
          </p>
        </div>
      ) : (
        viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <article key={p.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectPanchayat(p.id)}
                      className="text-left text-sm font-semibold text-gray-900 hover:text-brand-500 dark:text-white dark:hover:text-brand-400"
                    >
                      {p.name}
                    </button>
                    <p className="mt-1 truncate text-xs text-gray-400 dark:text-gray-500">
                      {p.villages.slice(0, 3).map((v) => v.name).join(', ') || 'No villages added'}
                      {p.villages.length > 3 && ` +${p.villages.length - 3} more`}
                    </p>
                  </div>
                  {getStatusBadge(p.status)}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {p.villagesCount || p.villages.length} {((p.villagesCount || p.villages.length) === 1) ? 'village' : 'villages'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectPanchayat(p.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-500 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20"
                    >
                      Open <ChevronRight className="h-3 w-3" />
                    </button>
                    {isSuperAdmin && <button type="button" onClick={() => void removePanchayat(p)} title={`Delete ${p.name}`} aria-label={`Delete ${p.name}`} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader className="w-[300px]">Panchayat</TableCell>
                <TableCell isHeader>Status</TableCell>
                <TableCell isHeader>Villages</TableCell>
                <TableCell isHeader className="text-right">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors">
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onSelectPanchayat(p.id)}
                      className="text-sm font-semibold text-gray-900 hover:text-brand-500 dark:text-white dark:hover:text-brand-400 text-left transition-colors cursor-pointer"
                    >
                      {p.name}
                    </button>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {p.villages.slice(0, 3).map((v) => v.name).join(', ')}
                      {p.villages.length > 3 && ` +${p.villages.length - 3} more`}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(p.status)}
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-gray-300 font-medium">
                    {p.villagesCount || p.villages.length}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectPanchayat(p.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-500 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20 transition"
                      >
                        <span>Open</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>
                      {isSuperAdmin && <button type="button" onClick={() => void removePanchayat(p)} title={`Delete ${p.name}`} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        )
      )}
      </>}

      {/* Add Panchayat Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-gray-900/75 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Add New Panchayat
              </h3>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedCluster === 'all' && (
              <label className="mt-4 block text-xs font-semibold text-slate-700">
                Cluster / District <span className="text-rose-600">*</span>
                <select
                  value={selectedCluster}
                  onChange={(event) => { setSelectedCluster(event.target.value); setForm({ name: '' }); setFormError(''); }}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-[#0B3D91] focus:ring-4 focus:ring-blue-100"
                >
                  <option value="all">Select a cluster</option>
                  {clusterOptions.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.name} — {cluster.district || 'District not set'}</option>)}
                </select>
              </label>
            )}

            <div className="mt-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/60 px-3 py-2 text-[11px] text-[#0B3D91]">
              {isLoadingDistrictDirectory
                ? `Loading ${selectedClusterRecord?.district || 'district'} Panchayats…`
                : districtDirectoryError
                  ? districtDirectoryError
                  : `${districtDirectoryNames.length} directory Panchayats available. Select one, or type a custom name to add it.`}
            </div>
            {modalPanchayatError && <p role="alert" className="mt-2 text-xs text-rose-700">{modalPanchayatError} <button type="button" onClick={() => setReloadModalPanchayats((value) => value + 1)} className="font-semibold underline">Retry</button></p>}

            <form onSubmit={(event) => void handleSave(event)} className="mt-5 space-y-5 text-sm">
              {formError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{formError}</p>}
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3.5">
                <p className="text-xs font-semibold text-slate-500">Cluster / District</p>
                <p className="mt-1 font-semibold text-slate-900">{selectedClusterRecord?.name || selectedClusterRecord?.district || 'Select a cluster first'}</p>
                <p className="mt-1 text-[11px] text-slate-600">{selectedAcademicYearName ? `Academic year: ${selectedAcademicYearName}` : selectedAcademicYearId ? `Academic year: ${selectedAcademicYearId}` : 'No academic year selected'}</p>
              </div>

              <label className="block text-xs font-semibold text-slate-700" htmlFor="pan-name">
                PANCHAYAT NAME <span className="text-rose-600">*</span>
                <span className="relative mt-1.5 block">
                  <input
                    id="pan-name"
                    type="text"
                    required
                    autoComplete="off"
                    value={form.name}
                    onFocus={() => setIsPanchayatNameMenuOpen(true)}
                    onChange={(event) => { setForm({ name: event.target.value }); setFormError(''); setIsPanchayatNameMenuOpen(true); }}
                    onKeyDown={(event) => { if (event.key === 'Escape') setIsPanchayatNameMenuOpen(false); }}
                    role="combobox"
                    aria-expanded={isPanchayatNameMenuOpen}
                    aria-controls="panchayat-name-options"
                    placeholder="Search district Panchayats"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#0B3D91] focus:ring-4 focus:ring-blue-100"
                  />
                  {isPanchayatNameMenuOpen && <div id="panchayat-name-options" role="listbox" aria-label="Panchayats in selected cluster" className="absolute z-[100001] mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    {isLoadingModalPanchayats || isLoadingDistrictDirectory ? <p className="px-3 py-3 text-xs text-slate-500">Loading district Panchayats for {selectedClusterLabel}…</p>
                      : districtDirectoryError ? <div className="px-3 py-3 text-xs text-rose-700"><p>{districtDirectoryError}</p><button type="button" onClick={() => setReloadModalPanchayats((value) => value + 1)} className="mt-2 font-semibold text-[#0B3D91] underline">Retry</button></div>
                        : matchingPanchayatOptions.length ? matchingPanchayatOptions.map((item) => <button key={normalizedPanchayatName(item.name)} type="button" role="option" aria-selected={normalizedPanchayatName(form.name) === normalizedPanchayatName(item.name)} disabled={item.alreadyAdded} onClick={() => { setForm({ name: item.name }); setIsPanchayatNameMenuOpen(false); setFormError(item.alreadyAdded ? 'This Panchayat is already added to this academic year.' : ''); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400">{item.name}{item.alreadyAdded && <span className="ml-2 text-[10px]">Already added</span>}</button>)
                          : districtDirectoryNames.length ? <p className="px-3 py-3 text-xs text-slate-500">No directory match. You can still save the name you typed.</p>
                            : <p className="px-3 py-3 text-xs text-slate-500">Directory unavailable. You can type a Panchayat name and save it manually.</p>}
                  </div>}
                </span>
              </label>

              <p className="rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-[#0B3D91]">Panchayats are saved only under the selected cluster and academic year.</p>
              <div className="flex justify-end gap-2.5 border-t border-gray-100 pt-4 dark:border-gray-800">
                <button type="button" disabled={isSavingPanchayat} onClick={() => { setShowAdd(false); setForm({ name: '' }); setFormError(''); setIsPanchayatNameMenuOpen(false); }} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">Cancel</button>
                <button type="submit" disabled={isSavingPanchayat || !selectedClusterRecord || isLoadingModalPanchayats} className="rounded-xl bg-[#0B3D91] px-4 py-2.5 text-xs font-semibold text-white shadow-theme-xs hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">{isSavingPanchayat ? 'Saving…' : 'Save Panchayat'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
