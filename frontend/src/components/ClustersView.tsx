import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Building2,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  GridFour,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Users,
  X,
  Rows,
  RefreshCw,
  Pencil,
} from './ui/icons';
import { Cluster, TabType, Panchayat, Student, Volunteer } from '../types';
import { DistrictCombobox } from './ui/DistrictCombobox';
import { TAMIL_NADU_ALL_CITIES_AND_DISTRICTS } from '../data/districts';
import { apiUrl } from '../utils/api';

interface ClustersViewProps {
  clusters: Cluster[];
  panchayats?: Panchayat[];
  students?: Student[];
  volunteers?: Volunteer[];
  authToken?: string;
  selectedAcademicYearId?: string;
  userRole?: string;
  onNavigate: (tab: TabType, targetId?: string) => void;
  onAddCluster?: (cluster: Partial<Cluster>) => void | Promise<void | boolean | { emailSent: boolean }>;
  onUpdateCluster?: (id: string, cluster: Partial<Cluster>) => void | Promise<void | boolean>;
  onArchiveCluster?: (id: string, archived: boolean) => void | Promise<void>;
}

interface ClusterDraft {
  name: string;
  district: string;
  collegeName: string;
  collegeDistrict: string;
  spocName: string;
  spocMobile: string;
  adminEmail: string;
}

const emptyDraft: ClusterDraft = {
  name: '', district: '', collegeName: '', collegeDistrict: '',
  spocName: '', spocMobile: '', adminEmail: '',
};

const accents = [
  'from-blue-50 to-indigo-50 border-blue-100 text-blue-700',
  'from-orange-50 to-amber-50 border-orange-100 text-orange-700',
  'from-emerald-50 to-teal-50 border-emerald-100 text-emerald-700',
  'from-rose-50 to-pink-50 border-rose-100 text-rose-700',
  'from-violet-50 to-purple-50 border-violet-100 text-violet-700',
  'from-cyan-50 to-sky-50 border-cyan-100 text-cyan-700',
];

const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0B3D91] focus:ring-4 focus:ring-blue-100';
const labelClass = 'block text-xs font-semibold text-slate-600';

export const ClustersView: React.FC<ClustersViewProps> = ({
  clusters: initialClusters = [],
  panchayats = [],
  students = [],
  volunteers = [],
  authToken,
  selectedAcademicYearId = '',
  userRole = 'Super Admin',
  onNavigate: _onNavigate,
  onAddCluster,
  onUpdateCluster,
  onArchiveCluster,
}) => {
  const isSuperAdmin = !userRole || userRole === 'Super Admin' || userRole.toLowerCase().includes('super');
  const [clusters, setClusters] = useState<Cluster[]>(initialClusters);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [collegeFilter, setCollegeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showArchived, setShowArchived] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | null>(null);
  const [editingCluster, setEditingCluster] = useState<Cluster | null>(null);
  const [draft, setDraft] = useState<ClusterDraft>(emptyDraft);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState('');

  const loadClusters = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ includeArchived: 'true' });
      if (selectedAcademicYearId) params.set('academicYearId', selectedAcademicYearId);
      const response = await fetch(apiUrl(`/api/clusters?${params.toString()}`), {
        cache: 'no-store',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !Array.isArray(data.clusters)) {
        throw new Error(data?.error || 'Unable to load cluster data.');
      }
      setClusters(data.clusters);
    } catch (error: any) {
      setLoadError(error?.message || 'Unable to load cluster data.');
    } finally {
      setIsLoading(false);
    }
  }, [authToken, selectedAcademicYearId]);

  useEffect(() => {
    void loadClusters();
  }, [loadClusters]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeClusters = useMemo(() => clusters.filter((cluster) => cluster.status !== 'Inactive'), [clusters]);
  const visibleBase = showArchived ? clusters.filter((cluster) => cluster.status === 'Inactive') : activeClusters;
  const districtOptions = useMemo(() => [...new Set(activeClusters.map((cluster) => cluster.district).filter(Boolean))].sort(), [activeClusters]);
  const collegeOptions = useMemo(() => [...new Set(activeClusters.map((cluster) => cluster.collegeName).filter(Boolean))].sort(), [activeClusters]);

  const stats = useMemo(() => ({
    clusters: activeClusters.length,
    panchayats: activeClusters.reduce((sum, cluster) => sum + Number(cluster.activePanchayats || panchayats.filter((p) => p.clusterId === cluster.id).length || 0), 0),
    villages: activeClusters.reduce((sum, cluster) => sum + Number(cluster.villagesCount || panchayats.filter((p) => p.clusterId === cluster.id).reduce((villageSum, p) => villageSum + Number(p.villagesCount || 0), 0)), 0),
    students: activeClusters.reduce((sum, cluster) => sum + Number(cluster.totalStudents || students.filter((student) => student.clusterId === cluster.id).length || 0), 0),
    volunteers: activeClusters.reduce((sum, cluster) => sum + Number(cluster.totalVolunteers || volunteers.filter((volunteer) => volunteer.clusterId === cluster.id).length || 0), 0),
  }), [activeClusters, panchayats, students, volunteers]);

  const filteredClusters = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return visibleBase.filter((cluster) => {
      const matchesSearch = !term || [cluster.name, cluster.district, cluster.collegeName, cluster.collegeDistrict, cluster.spocName, cluster.adminName, cluster.adminEmail, cluster.code]
        .some((value) => String(value || '').toLowerCase().includes(term));
      const matchesDistrict = districtFilter === 'all' || cluster.district === districtFilter;
      const matchesCollege = collegeFilter === 'all' || cluster.collegeName === collegeFilter;
      return matchesSearch && matchesDistrict && matchesCollege;
    }).sort((a, b) => {
      const comparison = (a.name || '').localeCompare(b.name || '');
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [visibleBase, searchTerm, districtFilter, collegeFilter, sortOrder]);

  const getClusterNumbers = (cluster: Cluster) => {
    const clusterPanchayats = panchayats.filter((panchayat) => panchayat.clusterId === cluster.id);
    return {
      panchayats: Number(cluster.activePanchayats || clusterPanchayats.length || 0),
      villages: Number(cluster.villagesCount || clusterPanchayats.reduce((sum, panchayat) => sum + Number(panchayat.villagesCount || 0), 0)),
      students: Number(cluster.totalStudents || students.filter((student) => student.clusterId === cluster.id).length || 0),
      volunteers: Number(cluster.totalVolunteers || volunteers.filter((volunteer) => volunteer.clusterId === cluster.id).length || 0),
    };
  };

  const openCreate = () => {
    setEditingCluster(null);
    setDraft(emptyDraft);
    setFormError('');
    setDrawerMode('create');
  };

  const openEdit = (cluster: Cluster) => {
    setEditingCluster(cluster);
    setDraft({
      name: cluster.name || '',
      district: cluster.district || '',
      collegeName: cluster.collegeName || '',
      collegeDistrict: cluster.collegeDistrict || cluster.district || '',
      spocName: cluster.spocName || cluster.adminName || '',
      spocMobile: cluster.spocMobile || cluster.adminPhone || '',
      adminEmail: cluster.adminEmail || '',
    });
    setFormError('');
    setDrawerMode('edit');
  };

  const saveCluster = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!selectedAcademicYearId) {
      setFormError('Select an academic year before saving a cluster.');
      return;
    }
    setIsSaving(true);
    const payload: Partial<Cluster> = {
      ...draft,
      spocMobile: draft.spocMobile.trim(),
      adminPhone: draft.spocMobile.trim(),
      adminName: draft.spocName.trim(),
      spocName: draft.spocName.trim(),
      adminEmail: draft.adminEmail.trim().toLowerCase(),
      collegeName: draft.collegeName.trim(),
      collegeDistrict: draft.collegeDistrict.trim(),
      district: draft.district.trim(),
      name: draft.name.trim(),
      academicYearId: selectedAcademicYearId,
    } as Partial<Cluster>;
    try {
      const result = drawerMode === 'edit' && editingCluster
        ? await onUpdateCluster?.(editingCluster.id, payload)
        : await onAddCluster?.(payload);
      if (result === false) throw new Error('Unable to save cluster.');
      await loadClusters();
      setDrawerMode(null);
      const emailSent = typeof result === 'object' && result !== null ? result.emailSent : true;
      setToast(drawerMode === 'edit'
        ? 'Cluster changes saved.'
        : emailSent
          ? 'Cluster created. Login email and temporary password sent to the SPOC email.'
          : 'Cluster created, but the credentials email was not sent. Check the server SMTP configuration.');
    } catch (error: any) {
      setFormError(error?.message || 'Unable to save cluster.');
    } finally {
      setIsSaving(false);
    }
  };

  const archiveCluster = async (cluster: Cluster, archived: boolean) => {
    const verb = archived ? 'archive' : 'restore';
    if (!window.confirm(`Are you sure you want to ${verb} ${cluster.name}?`)) return;
    try {
      await onArchiveCluster?.(cluster.id, archived);
      await loadClusters();
      setToast(archived ? 'Cluster archived.' : 'Cluster restored.');
    } catch (error: any) {
      setToast(error?.message || `Unable to ${verb} cluster.`);
    }
  };

  const copyClusterDetails = async (cluster: Cluster) => {
    const details = [cluster.name, `${cluster.district} District`, cluster.collegeName, cluster.collegeDistrict, cluster.spocName || cluster.adminName, cluster.spocMobile || cluster.adminPhone, cluster.adminEmail].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(details);
      setToast('Cluster details copied.');
    } catch {
      setToast('Unable to copy cluster details from this browser.');
    }
  };

  const statsCards = [
    { label: 'Total Clusters', value: stats.clusters, icon: Building2, tint: 'bg-blue-50 text-[#0B3D91]' },
    { label: 'Total Panchayats', value: stats.panchayats, icon: MapPin, tint: 'bg-emerald-50 text-emerald-600' },
    { label: 'Total Villages', value: stats.villages, icon: Building2, tint: 'bg-orange-50 text-[#FF7A00]' },
    { label: 'Total Students', value: stats.students, icon: GraduationCap, tint: 'bg-violet-50 text-violet-600' },
    { label: 'Total Volunteers', value: stats.volunteers, icon: Users, tint: 'bg-sky-50 text-sky-600' },
  ];

  return (
    <div className="min-h-full space-y-6 bg-[#F7F9FC] pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#10234E] sm:text-3xl">Clusters</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Manage clusters, view SPOC details, colleges, students, volunteers and update panchayats &amp; villages.</p>
        </div>
        {isSuperAdmin && <button type="button" onClick={openCreate} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0B3D91] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#082f70]">
          <Plus className="h-4 w-4" /> Add Cluster
        </button>}
      </div>

      <section aria-label="Cluster summary" className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 xl:grid-cols-5">
        {statsCards.map(({ label, value, icon: Icon, tint }) => (
          <div key={label} className="flex min-h-[92px] items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.035)]">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tint}`}><Icon className="h-6 w-6" /></span>
            <div className="min-w-0"><p className="text-xs font-medium text-slate-500">{label}</p>{isLoading ? <div className="mt-2 h-6 w-16 animate-pulse rounded bg-slate-100" /> : <p className="mt-1 text-2xl font-bold tabular-nums text-[#10234E]">{value.toLocaleString()}</p>}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_4px_16px_rgba(15,23,42,0.035)] sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search clusters, colleges, SPOCs..." className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#0B3D91] focus:ring-4 focus:ring-blue-100" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex">
            <select aria-label="Filter by district" value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 outline-none"><option value="all">All Districts</option>{districtOptions.map((district) => <option key={district} value={district}>{district}</option>)}</select>
            <select aria-label="Filter by college" value={collegeFilter} onChange={(event) => setCollegeFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 outline-none"><option value="all">All Colleges</option>{collegeOptions.map((college) => <option key={college} value={college}>{college}</option>)}</select>
            <select aria-label="Sort clusters" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as 'asc' | 'desc')} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 outline-none"><option value="asc">Cluster Name A–Z</option><option value="desc">Cluster Name Z–A</option></select>
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 p-1">
              <button type="button" aria-label="Grid view" aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')} className={`flex flex-1 items-center justify-center rounded-lg p-1.5 ${viewMode === 'grid' ? 'bg-[#0B3D91] text-white' : 'text-slate-500 hover:bg-slate-100'}`}><GridFour className="h-4 w-4" /></button>
              <button type="button" aria-label="List view" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')} className={`flex flex-1 items-center justify-center rounded-lg p-1.5 ${viewMode === 'list' ? 'bg-[#0B3D91] text-white' : 'text-slate-500 hover:bg-slate-100'}`}><Rows className="h-4 w-4" /></button>
            </div>
            {isSuperAdmin && <button type="button" onClick={() => setShowArchived((value) => !value)} className={`col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold sm:col-span-1 ${showArchived ? 'border-[#0B3D91] bg-blue-50 text-[#0B3D91]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}><Archive className="h-4 w-4" />{showArchived ? 'Archived' : 'Archive'}</button>}
          </div>
        </div>
      </section>

      {loadError ? <div className="rounded-2xl border border-rose-200 bg-white px-5 py-12 text-center shadow-sm">
        <p className="font-semibold text-slate-800">Unable to load cluster data.</p><p className="mt-1 text-sm text-slate-500">{loadError}</p>
        <button type="button" onClick={() => void loadClusters()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0B3D91] px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" />Retry</button>
      </div> : isLoading ? <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-3' : 'grid-cols-1'}`} aria-label="Loading clusters">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[285px] animate-pulse rounded-2xl border border-slate-200 bg-white"><div className="h-20 rounded-t-2xl bg-slate-100" /><div className="space-y-4 p-4"><div className="h-4 w-1/2 rounded bg-slate-100" /><div className="h-14 rounded bg-slate-50" /><div className="h-12 rounded bg-slate-50" /><div className="h-9 rounded bg-slate-100" /></div></div>)}
      </div> : filteredClusters.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#0B3D91]"><Building2 className="h-7 w-7" /></span>
        <h2 className="mt-4 text-lg font-bold text-[#10234E]">{showArchived ? 'No Archived Clusters' : 'No Clusters Found'}</h2>
        <p className="mt-1 text-sm text-slate-500">{showArchived ? 'Archived clusters for this academic year will appear here.' : 'No clusters have been added for this academic year yet.'}</p>
        {!showArchived && isSuperAdmin && <button type="button" onClick={openCreate} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0B3D91] px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Add Cluster</button>}
      </div> : <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-3' : 'grid-cols-1'}`}>
        {filteredClusters.map((cluster, index) => {
          const numbers = getClusterNumbers(cluster);
          const spocName = cluster.spocName || cluster.adminName || 'Not assigned';
          const phone = cluster.spocMobile || cluster.adminPhone || '';
          const email = cluster.adminEmail || '';
          const initials = spocName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
          const accent = accents[index % accents.length];
          return <article key={cluster.id} className={`overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_6px_22px_rgba(15,23,42,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.09)] ${viewMode === 'list' ? 'lg:grid lg:grid-cols-[minmax(230px,1.2fr)_minmax(260px,1fr)_minmax(250px,1fr)_auto] lg:items-center' : ''}`}>
            <div className={`relative flex min-h-[78px] items-center gap-3 border-b bg-gradient-to-r px-4 py-3 ${accent} ${viewMode === 'list' ? 'lg:h-full lg:border-b-0 lg:border-r' : ''}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm"><MapPin className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><h2 className="truncate text-[15px] font-bold text-[#10234E]">{cluster.name}</h2><p className="mt-0.5 truncate text-xs text-slate-600">{cluster.district} District</p></div>
              {cluster.status === 'Inactive' && <span className="rounded-full bg-slate-700/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">Archived</span>}
              <button type="button" onClick={() => void copyClusterDetails(cluster)} title="Copy cluster details" aria-label={`Copy ${cluster.name} details`} className="rounded-lg p-2 text-slate-500 transition hover:bg-white/70 hover:text-[#0B3D91]"><ClipboardList className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 border-b border-slate-100 px-4 py-3 sm:grid-cols-4 lg:border-b-0">
              {[['Panchayats', numbers.panchayats], ['Villages', numbers.villages], ['Students', numbers.students], ['Volunteers', numbers.volunteers]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/60 px-2 py-2 text-center"><p className="text-lg font-bold tabular-nums text-[#10234E]">{Number(value).toLocaleString()}</p><p className="text-[10px] font-medium text-slate-500">{label}</p></div>)}
            </div>
            <div className="grid grid-cols-1 gap-3 border-b border-slate-100 px-4 py-3 sm:grid-cols-2 lg:border-b-0">
              <div className="min-w-0"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">SPOC Details</p><div className="flex items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-[#0B3D91]">{initials || 'SP'}</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{spocName}</p><a href={phone ? `tel:${phone.replace(/\s/g, '')}` : undefined} className="block truncate text-[11px] text-slate-500 hover:text-[#0B3D91]">{phone || 'Phone not provided'}</a><a href={email ? `mailto:${email}` : undefined} className="block truncate text-[11px] text-slate-500 hover:text-[#0B3D91]">{email || 'Email not provided'}</a></div></div></div>
              <div className="min-w-0"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">College</p><div className="flex items-start gap-2"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0B3D91]" /><div className="min-w-0"><p className="line-clamp-2 text-xs font-semibold text-slate-800">{cluster.collegeName || 'College not assigned'}</p><p className="truncate text-[11px] text-slate-500">{cluster.collegeDistrict || cluster.district}</p></div></div></div>
            </div>
            <div className={`flex items-center gap-2 px-4 py-3 ${viewMode === 'list' ? 'lg:justify-end' : ''}`}>
              {cluster.status === 'Inactive' ? <button type="button" onClick={() => void archiveCluster(cluster, false)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw className="h-3.5 w-3.5" />Restore</button> : <>
                <a href={phone ? `tel:${phone.replace(/\s/g, '')}` : undefined} aria-disabled={!phone} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold ${phone ? 'bg-blue-50 text-[#0B3D91] hover:bg-blue-100' : 'pointer-events-none bg-slate-100 text-slate-400'}`}><Phone className="h-3.5 w-3.5" />Call</a>
                <a href={email ? `mailto:${email}` : undefined} aria-disabled={!email} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold ${email ? 'bg-blue-50 text-[#0B3D91] hover:bg-blue-100' : 'pointer-events-none bg-slate-100 text-slate-400'}`}><Mail className="h-3.5 w-3.5" />Email</a>
                {isSuperAdmin && <button type="button" onClick={() => openEdit(cluster)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0B3D91] px-2 py-2 text-xs font-semibold text-white hover:bg-[#082f70]"><Pencil className="h-3.5 w-3.5" />Edit</button>}
                {isSuperAdmin && <button type="button" onClick={() => void archiveCluster(cluster, true)} title="Archive cluster" aria-label={`Archive ${cluster.name}`} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:border-orange-200 hover:bg-orange-50 hover:text-[#FF7A00]"><Archive className="h-4 w-4" /></button>}
              </>}
            </div>
          </article>;
        })}
      </div>}

      {drawerMode && <div className="fixed inset-0 z-[99999] flex justify-end bg-slate-950/40 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setDrawerMode(null); }}>
        <aside role="dialog" aria-modal="true" aria-labelledby="cluster-drawer-title" className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-7"><div><h2 id="cluster-drawer-title" className="text-lg font-bold text-[#10234E]">{drawerMode === 'edit' ? 'Edit Cluster' : 'Add Cluster'}</h2><p className="mt-0.5 text-xs text-slate-500">Saved to the currently selected academic year.</p></div><button type="button" disabled={isSaving} onClick={() => setDrawerMode(null)} aria-label="Close drawer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
          <form onSubmit={(event) => void saveCluster(event)} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
              {formError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{formError}</p>}
              <section className="space-y-3"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Cluster and college</h3>
                <label className={labelClass}>Cluster Name *<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Dharmapuri Cluster" className={inputClass} /></label>
                <DistrictCombobox id="cluster-district" label="District *" placeholder="Select district" required value={draft.district} onChange={(value) => setDraft({ ...draft, district: value })} options={TAMIL_NADU_ALL_CITIES_AND_DISTRICTS} />
                <label className={labelClass}>College *<input required value={draft.collegeName} onChange={(event) => setDraft({ ...draft, collegeName: event.target.value })} placeholder="College name" className={inputClass} /></label>
                <DistrictCombobox id="college-location" label="College Location" placeholder="Select college location" value={draft.collegeDistrict} onChange={(value) => setDraft({ ...draft, collegeDistrict: value })} options={TAMIL_NADU_ALL_CITIES_AND_DISTRICTS} />
              </section>
              <section className="space-y-3"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">SPOC details</h3>
                <label className={labelClass}>SPOC Name *<input required value={draft.spocName} onChange={(event) => setDraft({ ...draft, spocName: event.target.value })} placeholder="Full name" className={inputClass} /></label>
                <label className={labelClass}>SPOC Phone *<input required type="tel" value={draft.spocMobile} onChange={(event) => setDraft({ ...draft, spocMobile: event.target.value })} placeholder="+91 98765 43210" className={inputClass} /></label>
                <label className={labelClass}>SPOC Email *<input required type="email" value={draft.adminEmail} onChange={(event) => setDraft({ ...draft, adminEmail: event.target.value })} placeholder="spoc@college.edu.in" className={inputClass} /></label>
              </section>
              {drawerMode === 'edit' && editingCluster && <section className="space-y-2"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Year totals</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(getClusterNumbers(editingCluster)).map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-lg font-bold text-[#10234E]">{Number(value).toLocaleString()}</p><p className="text-[10px] capitalize text-slate-500">{label}</p></div>)}</div><p className="text-[11px] text-slate-500">Totals are calculated from records in this academic year; they are not editable here.</p></section>}
              <div className="flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-[#0B3D91]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>Academic year is locked to the selection in the global navbar. Cluster totals refresh from that year’s records.</span></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 sm:px-7"><button type="button" disabled={isSaving} onClick={() => setDrawerMode(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button type="submit" disabled={isSaving} className="rounded-xl bg-[#0B3D91] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#082f70] disabled:opacity-60">{isSaving ? 'Saving…' : drawerMode === 'edit' ? 'Save Changes' : 'Save Cluster'}</button></div>
          </form>
        </aside>
      </div>}

      {toast && <div role="status" className="fixed bottom-5 right-5 z-[100000] rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl">{toast}</div>}
    </div>
  );
};
