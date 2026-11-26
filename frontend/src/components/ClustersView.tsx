import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
  Trash2,
} from './ui/icons';
import { Cluster, TabType, Panchayat, Student, Volunteer } from '../types';
import { apiUrl } from '../utils/api';
import { TAMIL_NADU_OFFICIAL_DISTRICTS } from '../data/districts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Modal } from './ui/modal';

interface ClustersViewProps {
  clusters: Cluster[];
  panchayats?: Panchayat[];
  students?: Student[];
  volunteers?: Volunteer[];
  authToken?: string;
  selectedAcademicYearId?: string;
  userRole?: string;
  onNavigate: (tab: TabType, targetId?: string) => void;
  onAddCluster?: (cluster: Partial<Cluster>) => void | Promise<void | boolean | { emailSent: boolean; temporaryPassword?: string; loginEmail?: string; clusterName?: string }>;
  onUpdateCluster?: (id: string, cluster: Partial<Cluster>) => void | Promise<void | boolean>;
  onResendCredentials?: (id: string) => Promise<{ emailSent: boolean; temporaryPassword: string; loginEmail: string; clusterName: string }>;
  onDeleteCluster?: (id: string) => Promise<void>;
}

interface CredentialDisplay {
  clusterName: string;
  loginEmail: string;
  temporaryPassword: string;
  emailSent: boolean;
}

interface ClusterDraft {
  name: string;
  collegeName: string;
  spocName: string;
  spocMobile: string;
  adminEmail: string;
}

const emptyDraft: ClusterDraft = {
  name: '', collegeName: '',
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
  onResendCredentials,
  onDeleteCluster,
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
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | null>(null);
  const [editingCluster, setEditingCluster] = useState<Cluster | null>(null);
  const [draft, setDraft] = useState<ClusterDraft>(emptyDraft);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [toast, setToast] = useState('');
  const [credentialDisplay, setCredentialDisplay] = useState<CredentialDisplay | null>(null);
  const [resettingCredentialsFor, setResettingCredentialsFor] = useState<string | null>(null);
  const resendInFlight = useRef(new Set<string>());

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
  const visibleBase = activeClusters;
  const districtOptions = useMemo(() => [...new Set(activeClusters.map((cluster) => cluster.district).filter(Boolean))].sort(), [activeClusters]);
  const collegeOptions = useMemo(() => [...new Set(activeClusters.map((cluster) => cluster.collegeName).filter((college): college is string => Boolean(college)) )].sort(), [activeClusters]);

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
      collegeName: cluster.collegeName || '',
      spocName: cluster.spocName || cluster.adminName || '',
      spocMobile: String(cluster.spocMobile || cluster.adminPhone || '').replace(/\D/g, '').slice(-10),
      adminEmail: cluster.adminEmail || '',
    });
    setFormError('');
    setDrawerMode('edit');
  };

  const saveCluster = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saveInFlight.current) return;
    setFormError('');
    const mobile = draft.spocMobile.replace(/\D/g, '').slice(-10);
    const email = draft.adminEmail.trim().toLowerCase();
    if (!selectedAcademicYearId) {
      setFormError('Select an academic year before saving a cluster.');
      return;
    }
    if (!draft.name.trim()) {
      setFormError('Cluster name is required.');
      return;
    }
    if (!draft.collegeName.trim()) {
      setFormError('College / Institution name is required.');
      return;
    }
    if (!/^\d{10}$/.test(mobile)) {
      setFormError('SPOC mobile number must contain exactly 10 digits.');
      return;
    }
    if (drawerMode === 'create' && !/^[a-z0-9]+(?:\.[a-z0-9]+)*(?:\+[a-z0-9]+(?:\.[a-z0-9]+)*)?@gmail\.com$/i.test(email)) {
      setFormError('Enter a valid Gmail address ending in @gmail.com.');
      return;
    }
    saveInFlight.current = true;
    setIsSaving(true);
    const payload: Partial<Cluster> = {
      ...draft,
      spocMobile: mobile,
      adminPhone: mobile,
      adminName: draft.spocName.trim(),
      spocName: draft.spocName.trim(),
      adminEmail: email,
      collegeName: draft.collegeName.trim(),
      district: draft.name.trim(),
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
      const credentialResult = typeof result === 'object' && result !== null ? result : null;
      const emailSent = credentialResult ? credentialResult.emailSent : true;
      if (drawerMode === 'create' && credentialResult?.temporaryPassword) {
        setCredentialDisplay({
          clusterName: credentialResult.clusterName || payload.name || payload.collegeName || 'New cluster',
          loginEmail: credentialResult.loginEmail || payload.adminEmail || '',
          temporaryPassword: credentialResult.temporaryPassword,
          emailSent,
        });
      }
      setToast(drawerMode === 'edit'
        ? 'Cluster changes saved.'
        : emailSent
          ? 'Cluster created. Login email and temporary password sent to the SPOC email.'
          : 'Cluster created, but the credentials email was not sent. Check the server SMTP configuration.');
    } catch (error: any) {
      setFormError(error?.message || 'Unable to save cluster.');
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
    }
  };

  const resetClusterCredentials = async (cluster: Cluster) => {
    if (!onResendCredentials) return;
    if (resendInFlight.current.has(cluster.id)) return;
    if (!window.confirm(`Reset the login password for ${cluster.name}? A new temporary password will be generated.`)) return;
    resendInFlight.current.add(cluster.id);
    setResettingCredentialsFor(cluster.id);
    try {
      const result = await onResendCredentials(cluster.id);
      setCredentialDisplay({
        clusterName: result.clusterName || cluster.name,
        loginEmail: result.loginEmail || cluster.adminEmail || '',
        temporaryPassword: result.temporaryPassword,
        emailSent: result.emailSent,
      });
      setToast(result.emailSent ? 'New login credentials emailed to the SPOC.' : 'Email could not be sent; copy the temporary password below.');
    } catch (error: any) {
      setToast(error?.message || 'Unable to reset cluster credentials.');
    } finally {
      resendInFlight.current.delete(cluster.id);
      setResettingCredentialsFor(null);
    }
  };

  const deleteCluster = async (cluster: Cluster) => {
    if (!onDeleteCluster) return;
    if (!window.confirm(`Delete ${cluster.name} from ${cluster.district}? If it has historical records, it will be deactivated instead to preserve linked data.`)) return;
    try {
      await onDeleteCluster(cluster.id);
      await loadClusters();
      setToast(`${cluster.name} deleted or deactivated.`);
    } catch (error: any) {
      setToast(error?.message || 'Unable to delete cluster.');
    }
  };

  const copyTemporaryPassword = async () => {
    if (!credentialDisplay?.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(credentialDisplay.temporaryPassword);
      setToast('Temporary password copied.');
    } catch {
      setToast('Unable to copy password from this browser.');
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
    <div className="min-h-full space-y-6 pb-8">
      {/* Google Console Breadcrumb & Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/90 pb-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <span>TQI ERP</span>
            <span>/</span>
            <span>Operations</span>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">Clusters</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-slate-900 dark:text-slate-100">Clusters</h1>
          <p className="mt-0.5 text-xs text-slate-500">Manage regional college clusters, SPOC coordinators, and educational coverage.</p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-blue-700"
          >
            Create cluster
          </button>
        )}
      </div>

      {/* Google Console Metric Summary Bar (Clean, No Icon Boxes) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {statsCards.map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
            {isLoading ? (
              <div className="mt-2 h-7 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            ) : (
              <p className="mt-1 text-2xl font-normal tabular-nums text-slate-900 dark:text-slate-100">{value.toLocaleString()}</p>
            )}
          </div>
        ))}
      </div>

      {/* Google Console Filter Strip */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Filter clusters, colleges, SPOCs..."
              className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-850 dark:text-slate-100"
            />
          </div>

          <Select value={districtFilter} onValueChange={(val) => setDistrictFilter(val)}>
            <SelectTrigger className="h-9 min-w-[130px] rounded-md border-slate-300 text-xs">
              <SelectValue placeholder="All Districts" />
            </SelectTrigger>
            <SelectContent className="max-h-60 rounded-xl border border-slate-200 bg-white shadow-lg">
              <SelectItem value="all">All Districts</SelectItem>
              {districtOptions.map((district) => (
                <SelectItem key={district} value={district}>{district}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={collegeFilter} onValueChange={(val) => setCollegeFilter(val)}>
            <SelectTrigger className="h-9 min-w-[130px] rounded-md border-slate-300 text-xs">
              <SelectValue placeholder="All Colleges" />
            </SelectTrigger>
            <SelectContent className="max-h-60 rounded-xl border border-slate-200 bg-white shadow-lg">
              <SelectItem value="all">All Colleges</SelectItem>
              {collegeOptions.map((college) => (
                <SelectItem key={college} value={college}>{college}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortOrder} onValueChange={(val) => setSortOrder(val as 'asc' | 'desc')}>
            <SelectTrigger className="h-9 min-w-[140px] rounded-md border-slate-300 text-xs">
              <SelectValue placeholder="Sort Clusters" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-slate-200 bg-white shadow-lg">
              <SelectItem value="asc">Cluster Name A–Z</SelectItem>
              <SelectItem value="desc">Cluster Name Z–A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* View Mode Toggle (Tesla / Google Pill Switch) */}
        <div className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1 self-end sm:self-auto">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
            onClick={() => setViewMode('grid')}
            className={`flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              viewMode === 'grid'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
            }`}
          >
            Grid
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
            onClick={() => setViewMode('list')}
            className={`flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-white px-5 py-12 text-center shadow-xs">
          <p className="font-medium text-slate-800">Unable to load cluster data.</p>
          <p className="mt-1 text-xs text-slate-500">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadClusters()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white"
          >
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-3' : 'grid-cols-1'}`}>
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-lg border border-slate-200 bg-white p-4" />
          ))}
        </div>
      ) : filteredClusters.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
          <h2 className="text-base font-medium text-slate-900">No Clusters Found</h2>
          <p className="mt-1 text-xs text-slate-500">No clusters have been added for this academic year yet.</p>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white"
            >
              Add Cluster
            </button>
          )}
        </div>
      ) : (
        <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-3' : 'grid-cols-1'}`}>
          {filteredClusters.map((cluster) => {
            const numbers = getClusterNumbers(cluster);
            const spocName = cluster.spocName || cluster.adminName || 'Not assigned';
            const phone = cluster.spocMobile || cluster.adminPhone || '';
            const email = cluster.adminEmail || '';

            return (
              <article
                key={cluster.id}
                className={`rounded-lg border border-slate-200 bg-white shadow-xs transition hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 ${
                  viewMode === 'list' ? 'lg:grid lg:grid-cols-[1.5fr_1.2fr_1.2fr_auto] lg:items-center lg:gap-4' : ''
                }`}
              >
                {/* Header (Clean Google Resource Style, No loud gradients) */}
                <div className="border-b border-slate-100 p-4 dark:border-slate-800/80">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{cluster.name}</h2>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0">
                      {cluster.district} District
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">{cluster.collegeName || 'No college mapped'}</p>
                </div>

                {/* Numbers Grid */}
                <div className="grid grid-cols-4 gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800/80">
                  {[
                    ['Panchayats', numbers.panchayats],
                    ['Villages', numbers.villages],
                    ['Students', numbers.students],
                    ['Volunteers', numbers.volunteers],
                  ].map(([label, value]) => (
                    <div key={label} className="text-center">
                      <p className="text-base font-medium tabular-nums text-slate-900 dark:text-slate-100">{Number(value).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500 uppercase">{label}</p>
                    </div>
                  ))}
                </div>

                {/* SPOC & Contact */}
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 text-xs">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Coordinator / SPOC</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{spocName}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                    {phone && <span>{phone}</span>}
                    {email && <span className="truncate">{email}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void copyClusterDetails(cluster)}
                    className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    Copy
                  </button>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => openEdit(cluster)}
                      className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:border-slate-700"
                    >
                      Edit
                    </button>
                  )}
                  {isSuperAdmin && onResendCredentials && (
                    <button
                      type="button"
                      disabled={resettingCredentialsFor === cluster.id}
                      onClick={() => void resetClusterCredentials(cluster)}
                      className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700"
                    >
                      {resettingCredentialsFor === cluster.id ? 'Sending…' : 'Reset Login'}
                    </button>
                  )}
                  {isSuperAdmin && onDeleteCluster && (
                    <button
                      type="button"
                      onClick={() => void deleteCluster(cluster)}
                      aria-label={`Delete ${cluster.name}`}
                      className="rounded-md border border-slate-200 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-slate-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {drawerMode && (
        <Modal
          isOpen={Boolean(drawerMode)}
          onClose={isSaving ? () => undefined : () => setDrawerMode(null)}
          size="lg"
          title={drawerMode === 'edit' ? 'Edit Cluster' : 'Add Cluster'}
          subtitle="Saved to the currently selected academic year"
          sheetOnMobile
          className="tqi-modal-no-fullscreen max-h-[92vh] max-w-[850px] rounded-2xl border-slate-200 bg-white shadow-2xl"
        >
          <form onSubmit={(event) => void saveCluster(event)} className="flex max-h-[calc(92vh-64px)] flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1 pr-2 sm:px-1">
              {formError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{formError}</p>}
              <section className="space-y-3"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Cluster and college</h3>
                <div>
                  <label className={labelClass}>District * (Cluster Name)</label>
                  <Select value={draft.name} onValueChange={(value) => setDraft({ ...draft, name: value })}>
                    <SelectTrigger className="mt-1 h-10 w-full rounded-xl border-slate-200 bg-white text-sm text-slate-800 focus:ring-4 focus:ring-blue-100">
                      <SelectValue placeholder="Select one of 38 Tamil Nadu districts" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 rounded-xl border border-slate-200 bg-white shadow-xl">
                      {TAMIL_NADU_OFFICIAL_DISTRICTS.map((district) => (
                        <SelectItem key={district} value={district}>{district}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className={labelClass}>College / Institution *<input required value={draft.collegeName} onChange={(event) => setDraft({ ...draft, collegeName: event.target.value })} placeholder="Type college or institution name" className={inputClass} /></label>
              </section>
              <section className="space-y-3"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">SPOC details</h3>
                <label className={labelClass}>SPOC Name *<input required value={draft.spocName} onChange={(event) => setDraft({ ...draft, spocName: event.target.value })} placeholder="Full name" className={inputClass} /></label>
                <label className={labelClass}>SPOC Phone *<input required type="tel" inputMode="numeric" maxLength={10} pattern="[0-9]{10}" value={draft.spocMobile} onChange={(event) => setDraft({ ...draft, spocMobile: event.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10-digit mobile number" className={inputClass} /></label>
                <label className={labelClass}>SPOC Email *<input required type="email" value={draft.adminEmail} onChange={(event) => setDraft({ ...draft, adminEmail: event.target.value })} placeholder="name@gmail.com" className={inputClass} /></label>
              </section>
              {drawerMode === 'edit' && editingCluster && <section className="space-y-2"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Year totals</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(getClusterNumbers(editingCluster)).map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-lg font-bold text-[#10234E]">{Number(value).toLocaleString()}</p><p className="text-[10px] capitalize text-slate-500">{label}</p></div>)}</div><p className="text-[11px] text-slate-500">Totals are calculated from records in this academic year; they are not editable here.</p></section>}
              <div className="flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-[#0B3D91]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>Academic year is locked to the selection in the global navbar. Cluster totals refresh from that year’s records.</span></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 sm:px-7"><button type="button" disabled={isSaving} onClick={() => setDrawerMode(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button type="submit" disabled={isSaving} className="rounded-xl bg-[#0B3D91] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#082f70] disabled:opacity-60">{isSaving ? 'Saving…' : drawerMode === 'edit' ? 'Save Changes' : 'Save Cluster'}</button></div>
          </form>
        </Modal>
      )}

      {credentialDisplay && <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
        <section role="dialog" aria-modal="true" aria-labelledby="cluster-credentials-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="cluster-credentials-title" className="text-lg font-bold text-[#10234E]">Cluster login credentials</h2>
              <p className="mt-1 text-sm text-slate-500">{credentialDisplay.clusterName}</p>
            </div>
            <button type="button" onClick={() => setCredentialDisplay(null)} aria-label="Close credentials" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
          <p className={`mt-4 rounded-xl border px-3 py-2.5 text-sm ${credentialDisplay.emailSent ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
            {credentialDisplay.emailSent ? `Credentials were emailed to ${credentialDisplay.loginEmail}.` : `Email could not be sent to ${credentialDisplay.loginEmail}. Copy and share this password securely; SMTP delivery needs valid configuration.`}
          </p>
          <label className="mt-4 block text-xs font-semibold text-slate-600">Temporary password
            <div className="mt-1.5 flex gap-2">
              <input readOnly value={credentialDisplay.temporaryPassword} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-900" />
              <button type="button" onClick={() => void copyTemporaryPassword()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><ClipboardList className="h-4 w-4" />Copy</button>
            </div>
          </label>
          <p className="mt-3 text-xs text-slate-500">The Cluster Admin must change this password at first sign-in. Share it only with the intended recipient.</p>
          <div className="mt-5 flex justify-end"><button type="button" onClick={() => setCredentialDisplay(null)} className="rounded-xl bg-[#0B3D91] px-4 py-2.5 text-sm font-semibold text-white">Done</button></div>
        </section>
      </div>}

      {toast && <div role="status" className="fixed bottom-5 right-5 z-[100000] rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl">{toast}</div>}
    </div>
  );
};
