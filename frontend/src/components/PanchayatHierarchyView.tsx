import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  MapPin,
  Building2,
  Users,
  GraduationCap,
  CheckCircle2,
  X,
  AlertCircle,
  School,
  Sparkles,
} from './ui/icons';
import { Cluster, Panchayat, Village } from '../types';
import { Badge } from './ui/badge';
import { EmptyState } from './ui/EmptyState';

export type PanchayatHierarchyRoute =
  | { level: 'clusters' }
  | { level: 'panchayats'; clusterId: string }
  | { level: 'villages'; clusterId: string; panchayatId: string };

interface Props {
  route: PanchayatHierarchyRoute;
  clusters: Cluster[];
  panchayats: Panchayat[];
  onNavigate: (route: PanchayatHierarchyRoute, replace?: boolean) => void;
  onAddPanchayat: (clusterId: string, name: string) => Promise<void>;
  onAddVillage: (panchayatId: string, name: string) => Promise<void>;
  onEditVillage: (id: string, name: string, status: string) => Promise<void>;
  onDeletePanchayat: (id: string) => Promise<void>;
  onDeleteVillage: (id: string) => Promise<void>;
}

const statusLabel = (status?: string) =>
  status === 'ACTIVE' || status === 'On Track' ? 'Active' : status || 'Active';

export const PanchayatHierarchyView: React.FC<Props> = ({
  route,
  clusters,
  panchayats,
  onNavigate,
  onAddPanchayat,
  onAddVillage,
  onEditVillage,
  onDeletePanchayat,
  onDeleteVillage,
}) => {
  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editingVillage, setEditingVillage] = useState<Village | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; name: string; type: 'panchayat' | 'village' } | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [confirmSameName, setConfirmSameName] = useState(false);
  const [saving, setSaving] = useState(false);

  const cluster = route.level === 'clusters' ? undefined : clusters.find((item) => item.id === route.clusterId);
  const panchayat = route.level === 'villages' ? panchayats.find((item) => item.id === route.panchayatId) : undefined;
  const clusterPanchayats = cluster ? panchayats.filter((item) => item.clusterId === cluster.id) : [];
  const villages = panchayat?.villages || [];

  const districts = useMemo(
    () => Array.from(new Set(clusters.map((item) => item.district).filter(Boolean))).sort(),
    [clusters]
  );

  const visibleClusters = clusters.filter(
    (item) =>
      (!search || `${item.name} ${item.collegeName || ''} ${item.district}`.toLowerCase().includes(search.toLowerCase())) &&
      (district === 'all' || item.district === district)
  );

  const visiblePanchayats = clusterPanchayats.filter(
    (item) => !search || item.name.toLowerCase().includes(search.toLowerCase())
  );

  const visibleVillages = villages.filter(
    (item) => !search || item.name.toLowerCase().includes(search.toLowerCase())
  );

  const submitAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || saving) return;
    if (
      route.level === 'villages' &&
      panchayat &&
      name.trim().toLowerCase() === panchayat.name.trim().toLowerCase() &&
      !confirmSameName
    ) {
      setConfirmSameName(true);
      return;
    }
    setSaving(true);
    try {
      if (route.level === 'panchayats') await onAddPanchayat(route.clusterId, name.trim());
      if (route.level === 'villages') await onAddVillage(route.panchayatId, name.trim());
      closeVillageForm();
    } finally {
      setSaving(false);
    }
  };

  const closeVillageForm = () => {
    setName('');
    setStatus('ACTIVE');
    setConfirmSameName(false);
    setEditingVillage(null);
    setShowAdd(false);
  };

  const openAdd = () => {
    setName('');
    setStatus('ACTIVE');
    setConfirmSameName(false);
    setEditingVillage(null);
    setShowAdd(true);
  };

  const openEdit = (v: Village) => {
    setName(v.name);
    setStatus(v.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
    setConfirmSameName(false);
    setEditingVillage(v);
    setShowAdd(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;
    setSaving(true);
    try {
      if (deleteConfirmation.type === 'panchayat') {
        await onDeletePanchayat(deleteConfirmation.id);
      } else {
        await onDeleteVillage(deleteConfirmation.id);
      }
      setDeleteConfirmation(null);
    } finally {
      setSaving(false);
    }
  };

  const title =
    route.level === 'clusters'
      ? 'Panchayats & Villages'
      : route.level === 'panchayats'
      ? `${cluster?.name || 'Cluster'} — Panchayats & Villages`
      : `${panchayat?.name || 'Panchayat'} — Villages`;

  const subtitle =
    route.level === 'clusters'
      ? 'Statewide cluster hierarchy, panchayat coverage, and rural village operations'
      : route.level === 'panchayats'
      ? `${cluster?.collegeName || 'Cluster College'} · ${cluster?.district || ''}, Tamil Nadu`
      : `Cluster: ${cluster?.name || ''} · ${cluster?.collegeName || ''} · ${cluster?.district || ''}, Tamil Nadu`;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        {/* Breadcrumb trail */}
        {route.level !== 'clusters' && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
            <button
              type="button"
              onClick={() =>
                onNavigate(
                  route.level === 'villages'
                    ? { level: 'panchayats', clusterId: route.clusterId }
                    : { level: 'clusters' }
                )
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-medium transition-all shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>
                Back to {route.level === 'villages' ? 'Panchayats' : 'Clusters'}
              </span>
            </button>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <button
              type="button"
              onClick={() => onNavigate({ level: 'clusters' })}
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Panchayats & Villages
            </button>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            {route.level === 'villages' ? (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate({ level: 'panchayats', clusterId: route.clusterId })}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  {cluster?.name}
                </button>
                <span className="text-slate-300 dark:text-slate-600">/</span>
                <span className="font-semibold text-slate-900 dark:text-white">{panchayat?.name}</span>
              </>
            ) : (
              <span className="font-semibold text-slate-900 dark:text-white">{cluster?.name}</span>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#1717B8]/10 dark:bg-[#1717B8]/20 flex items-center justify-center text-[#1717B8] dark:text-indigo-400 shrink-0">
              {route.level === 'villages' ? (
                <MapPin className="h-5 w-5" />
              ) : route.level === 'panchayats' ? (
                <Building2 className="h-5 w-5" />
              ) : (
                <School className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {title}
                </h1>
                {route.level === 'villages' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1717B8]/10 text-[#1717B8] dark:bg-indigo-950/40 dark:text-indigo-300">
                    {villages.length} Villages
                  </span>
                )}
                {route.level === 'panchayats' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1717B8]/10 text-[#1717B8] dark:bg-indigo-950/40 dark:text-indigo-300">
                    {clusterPanchayats.length} Panchayats
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                {subtitle}
              </p>
            </div>
          </div>

          {route.level !== 'clusters' && (
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs sm:text-sm font-semibold shadow-sm hover:shadow transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add {route.level === 'panchayats' ? 'Panchayat' : 'Village'}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metric Cards */}
      {route.level === 'clusters' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#1717B8] flex items-center justify-center shrink-0">
              <School className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">{clusters.length}</div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Clusters</div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-teal-700 dark:text-teal-400">
                {clusters.reduce((sum, item) => sum + item.activePanchayats, 0)}
              </div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Panchayats</div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                {panchayats.reduce((sum, item) => sum + item.villagesCount, 0)}
              </div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Villages</div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-purple-700 dark:text-purple-400">
                {clusters.reduce((sum, item) => sum + item.totalStudents, 0)}
              </div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Students</div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {clusters.reduce((sum, item) => sum + item.totalVolunteers, 0)}
              </div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Volunteers</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#1717B8] dark:text-blue-400 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {clusterPanchayats.length}
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Panchayats</div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-teal-700 dark:text-teal-400">
                {route.level === 'villages'
                  ? villages.length
                  : clusterPanchayats.reduce((sum, item) => sum + item.villagesCount, 0)}
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Villages</div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {route.level === 'villages'
                  ? villages.reduce((sum, v) => sum + (v.studentCount || 0), 0)
                  : clusterPanchayats.reduce((sum, item) => sum + item.activeStudents, 0)}
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Students</div>
            </div>
          </div>

          {route.level !== 'villages' && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {clusterPanchayats.reduce((sum, item) => sum + item.volunteersCount, 0)}
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Volunteers</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Container Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        {/* Search & Filter Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {route.level === 'clusters'
                ? 'Statewide Clusters'
                : route.level === 'panchayats'
                ? 'Cluster Panchayats'
                : 'Panchayat Villages'}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {route.level === 'clusters'
                ? visibleClusters.length
                : route.level === 'panchayats'
                ? visiblePanchayats.length
                : visibleVillages.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  route.level === 'clusters'
                    ? 'Search clusters...'
                    : route.level === 'panchayats'
                    ? 'Search panchayats...'
                    : 'Search villages...'
                }
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1717B8] transition-all"
              />
            </div>

            {route.level === 'clusters' && (
              <select
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1717B8]"
              >
                <option value="all">All Districts</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Level 1: Clusters Cards */}
        {route.level === 'clusters' && (
          <div className="grid gap-5 p-5 md:grid-cols-2 lg:grid-cols-3 bg-slate-50/50 dark:bg-slate-950/20">
            {visibleClusters.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-[#1717B8] transition-colors">
                        {item.name}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {item.collegeName || 'College not assigned'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span>
                          {item.district}, {item.state || 'Tamil Nadu'}
                        </span>
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {statusLabel(item.adminStatus)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase tracking-wider">
                        Panchayats
                      </span>
                      <strong className="text-slate-900 dark:text-white font-bold">
                        {item.activePanchayats}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase tracking-wider">
                        Villages
                      </span>
                      <strong className="text-slate-900 dark:text-white font-bold">
                        {panchayats
                          .filter((p) => p.clusterId === item.id)
                          .reduce((sum, p) => sum + p.villagesCount, 0)}
                      </strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate({ level: 'panchayats', clusterId: item.id })}
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs font-semibold shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span>View Panchayats & Villages</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {visibleClusters.length === 0 && (
              <div className="col-span-full py-12">
                <EmptyState
                  icon={School}
                  title="No clusters found"
                  description="No clusters match your search query."
                />
              </div>
            )}
          </div>
        )}

        {/* Level 2: Panchayats Table */}
        {route.level === 'panchayats' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-16">S.No</th>
                  <th className="py-3.5 px-4">Panchayat Name</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Villages</th>
                  <th className="py-3.5 px-4">Students</th>
                  <th className="py-3.5 px-4">Volunteers</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visiblePanchayats.map((item, index) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-400">{index + 1}</td>
                    <td className="py-3.5 px-4">
                      <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#1717B8] transition-colors">
                        {item.name}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {item.villagesCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {item.villagesCount} Villages
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No villages configured</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {item.activeStudents}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {item.volunteersCount}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate({
                              level: 'villages',
                              clusterId: route.clusterId,
                              panchayatId: item.id,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
                        >
                          <span>View Villages</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirmation({
                              id: item.id,
                              name: item.name,
                              type: 'panchayat',
                            })
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title="Delete Panchayat"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {visiblePanchayats.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8">
                      <EmptyState
                        icon={Building2}
                        title="No panchayats found"
                        description="There are no panchayats configured for this cluster yet."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Level 3: Villages Table (Exact view in screenshot!) */}
        {route.level === 'villages' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-16">S.No</th>
                  <th className="py-3.5 px-4">Village Name</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Students</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleVillages.map((item, index) => {
                  const isInactive = item.status === 'INACTIVE';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-400">{index + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-[#1717B8] dark:text-indigo-400 flex items-center justify-center shrink-0">
                            <MapPin className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            isInactive
                              ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/80'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isInactive ? 'bg-slate-400' : 'bg-emerald-500'
                            }`}
                          />
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-[#1717B8] dark:bg-blue-950/40 dark:text-blue-300">
                          {item.studentCount || 0} Students
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all cursor-pointer"
                          >
                            <Pencil className="h-3 w-3 text-slate-500" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteConfirmation({
                                id: item.id,
                                name: item.name,
                                type: 'village',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-700 dark:text-rose-400 text-xs font-medium transition-all cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {visibleVillages.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8">
                      <EmptyState
                        icon={MapPin}
                        title="No villages found"
                        description="This panchayat does not have any villages configured yet. Click '+ Add Village' above to add one."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Village & Panchayat Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                editingVillage &&
                panchayat &&
                name.trim().toLowerCase() === panchayat.name.trim().toLowerCase() &&
                !confirmSameName
              ) {
                setConfirmSameName(true);
                return;
              }
              if (editingVillage) {
                if (saving) return;
                setSaving(true);
                try {
                  await onEditVillage(editingVillage.id, name.trim(), status);
                  closeVillageForm();
                } finally {
                  setSaving(false);
                }
              } else {
                await submitAdd(event);
              }
            }}
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
          >
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1717B8]/10 text-[#1717B8] flex items-center justify-center">
                  <MapPin className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {editingVillage
                    ? 'Edit Village'
                    : route.level === 'panchayats'
                    ? 'Add New Panchayat'
                    : 'Add New Village'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeVillageForm}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {route.level === 'villages' ? 'Village Name' : 'Panchayat Name'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  autoFocus
                  required
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setConfirmSameName(false);
                  }}
                  placeholder={
                    route.level === 'villages' ? 'e.g. Vedakkattamaduvu' : 'e.g. Bairnaikanpatti'
                  }
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1717B8]"
                />
              </div>

              {route.level === 'villages' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Operating Status
                  </label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1717B8]"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              )}

              {confirmSameName && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Confirm Village Name</p>
                    <p className="mt-0.5 text-amber-800">
                      This village name matches the Panchayat name ({panchayat?.name}). Are you sure you wish to proceed?
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmSameName(false)}
                        className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-900 text-xs font-medium hover:bg-amber-50 cursor-pointer"
                      >
                        Change Name
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        Yes, Continue
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeVillageForm}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || confirmSameName}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {saving
                  ? 'Saving...'
                  : editingVillage
                  ? 'Save Changes'
                  : route.level === 'panchayats'
                  ? 'Add Panchayat'
                  : 'Add Village'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete {deleteConfirmation.type === 'panchayat' ? 'Panchayat' : 'Village'}?
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to delete{' '}
              <strong className="text-slate-900 dark:text-white">
                &ldquo;{deleteConfirmation.name}&rdquo;
              </strong>
              ? This action cannot be undone and will affect associated student records.
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PanchayatHierarchyView;
