import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  Users,
  GraduationCap,
  Plus,
  Search,
  ArrowRight,
  X,
  School,
  AlertCircle,
  Trash2
} from './ui/icons';
import { Cluster, TabType } from '../types';

interface ClustersViewProps {
  clusters: Cluster[];
  userRole?: string;
  onNavigate: (tab: TabType, targetId?: string) => void;
  onAddCluster?: (cluster: Partial<Cluster>) => void | Promise<void | boolean>;
  onDeleteCluster?: (id: string) => void | Promise<void>;
}

export const ClustersView: React.FC<ClustersViewProps> = ({
  clusters = [],
  userRole = 'Super Admin',
  onNavigate,
  onAddCluster,
  onDeleteCluster,
}) => {
  const isSuperAdmin = !userRole || userRole === 'Super Admin' || userRole.toLowerCase().includes('super');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [clusterToDelete, setClusterToDelete] = useState<Cluster | null>(null);

  const [newCollegeName, setNewCollegeName] = useState('');
  const [newClusterDistrict, setNewClusterDistrict] = useState('');
  const [newSpocName, setNewSpocName] = useState('');
  const [newSpocMobile, setNewSpocMobile] = useState('');
  const [newSpocEmail, setNewSpocEmail] = useState('');

  const filteredClusters = clusters.filter(
    (c) =>
      (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.district || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.collegeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.spocName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.adminName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.code || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (
      !newCollegeName.trim() ||
      !newClusterDistrict.trim() ||
      !newSpocName.trim() ||
      !newSpocMobile.trim() ||
      !newSpocEmail.trim()
    ) {
      setFormError('Please fill in all required fields marked with *.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (onAddCluster) {
        const res = await onAddCluster({
          collegeName: newCollegeName.trim(),
          district: newClusterDistrict.trim(),
          name: `${newCollegeName.trim()} (${newClusterDistrict.trim()})`,
          spocName: newSpocName.trim(),
          spocMobile: newSpocMobile.trim(),
          adminName: newSpocName.trim(),
          adminEmail: newSpocEmail.trim().toLowerCase(),
          adminPhone: newSpocMobile.trim(),
          status: 'Active',
        });

        if (res === false) {
          setIsSubmitting(false);
          return;
        }
      }

      setIsAddModalOpen(false);
      setNewCollegeName('');
      setNewClusterDistrict('');
      setNewSpocName('');
      setNewSpocMobile('');
      setNewSpocEmail('');
      setFormError('');
    } catch (err: any) {
      setFormError(err?.message || 'Failed to onboard college cluster.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Clusters
          </h1>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsAddModalOpen(true);
            setFormError('');
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-600 transition shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Onboard College</span>
        </button>
      </div>

      {/* 2. Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <School className="h-4 w-4 text-brand-500" />
            <span>Colleges</span>
          </div>
          <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
            {clusters.length}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <MapPin className="h-4 w-4 text-success-500" />
            <span>Panchayats</span>
          </div>
          <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
            {clusters.reduce((acc, c) => acc + (c.activePanchayats || 0), 0)}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <GraduationCap className="h-4 w-4 text-theme-purple-500" />
            <span>Students</span>
          </div>
          <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
            {clusters.reduce((acc, c) => acc + (c.totalStudents || 0), 0)}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Users className="h-4 w-4 text-warning-500" />
            <span>Volunteers</span>
          </div>
          <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
            {clusters.reduce((acc, c) => acc + (c.totalVolunteers || 0), 0)}
          </div>
        </div>
      </div>

      {/* 3. Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search clusters…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* 4. Grid List */}
      {filteredClusters.length === 0 ? (
        <div className="py-16 text-center">
          <Building2 className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? 'No results.' : 'No clusters yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClusters.map((cluster) => {
            const completionRate = Math.round(
              ((cluster.completedSessions || 0) / (cluster.totalSessions || 48)) * 100
            );
            const spocName = cluster.spocName || cluster.adminName || 'SPOC';
            const spocInitials = spocName
              .split(' ')
              .map((p: string) => p[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();
            const isComplete = completionRate >= 100;

            return (
              <div
                key={cluster.id}
                className="group relative flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[0_4px_24px_-12px_rgba(0,0,0,0.08)] dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-gray-700 dark:hover:shadow-[0_4px_24px_-12px_rgba(0,0,0,0.4)]"
              >
                {/* Header: name + status dot */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-gray-900 dark:text-white transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-400">
                      {cluster.collegeName || cluster.name}
                    </h3>
                    <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <MapPin className="h-3 w-3 shrink-0 text-gray-400" />
                      <span className="truncate">{cluster.district}, Tamil Nadu</span>
                    </p>
                  </div>
                  <span
                    className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                      isComplete ? 'bg-emerald-500' : 'bg-brand-500'
                    }`}
                    aria-hidden="true"
                  />
                </div>

                {/* Progress */}
                <div className="mt-5 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Curriculum
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                      {completionRate}<span className="text-gray-400 dark:text-gray-500">%</span>
                    </span>
                  </div>
                  <div className="h-[3px] w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all duration-700 ease-out"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>

                {/* Stats — divided row */}
                <div className="mt-5 grid grid-cols-3 divide-x divide-gray-100 border-y border-gray-100 dark:divide-gray-800 dark:border-gray-800">
                  {[
                    { label: 'Panchayats', value: cluster.activePanchayats || 0 },
                    { label: 'Students', value: cluster.totalStudents || 0 },
                    { label: 'Volunteers', value: cluster.totalVolunteers || 0 },
                  ].map((stat) => (
                    <div key={stat.label} className="py-3 text-center first:pl-0 last:pr-0">
                      <div className="text-base font-semibold tabular-nums text-gray-900 dark:text-white">
                        {stat.value}
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* SPOC */}
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-semibold text-white">
                    {spocInitials || 'SP'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">
                      {spocName}
                    </div>
                    {cluster.adminEmail && (
                      <div className="truncate font-mono text-[11px] text-gray-400 dark:text-gray-500">
                        {cluster.adminEmail}
                      </div>
                    )}
                  </div>
                  {cluster.spocMobile || cluster.adminPhone ? (
                    <span className="shrink-0 font-mono text-[11px] text-gray-500 dark:text-gray-400">
                      {cluster.spocMobile || cluster.adminPhone}
                    </span>
                  ) : null}
                </div>

                {/* Footer */}
                <div className="mt-5 flex items-center justify-between">
                  {isSuperAdmin && onDeleteCluster ? (
                    <button
                      type="button"
                      onClick={() => setClusterToDelete(cluster)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-error-600 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-error-400"
                      aria-label="Delete cluster"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </button>
                  ) : <span />}
                  <button
                    type="button"
                    onClick={() => onNavigate('panchayats', cluster.id)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-brand-600 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-brand-400"
                  >
                    <span>Open</span>
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Onboard New College Modal — minimalist */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Onboard College
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                aria-label="Close"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCluster} className="space-y-3.5 text-sm">
              {formError && (
                <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700 dark:border-error-900/40 dark:bg-error-500/10 dark:text-error-300 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  College name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Government Arts College"
                  value={newCollegeName}
                  onChange={(e) => setNewCollegeName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  District
                </label>
                <input
                  type="text"
                  required
                  placeholder="Dharmapuri"
                  value={newClusterDistrict}
                  onChange={(e) => setNewClusterDistrict(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SPOC name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Dr. M. Vignesh"
                    value={newSpocName}
                    onChange={(e) => setNewSpocName(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SPOC mobile
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={newSpocMobile}
                    onChange={(e) => setNewSpocMobile(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SPOC email
                </label>
                <input
                  type="email"
                  required
                  placeholder="vignesh.m@college.edu.in"
                  value={newSpocEmail}
                  onChange={(e) => setNewSpocEmail(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="pt-3 mt-1 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-brand-500 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Onboarding…' : 'Onboard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {clusterToDelete && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-gray-900/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center gap-3 text-error-500 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-error-50 dark:bg-error-500/10">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Cluster</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-5 leading-relaxed">
              Are you sure you want to permanently delete <strong>{clusterToDelete.collegeName || clusterToDelete.name}</strong> ({clusterToDelete.district})? Associated local operational mapping will be unassigned.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setClusterToDelete(null)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (onDeleteCluster && clusterToDelete) {
                    await onDeleteCluster(clusterToDelete.id);
                    setClusterToDelete(null);
                  }
                }}
                className="rounded-xl bg-error-500 px-4 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-error-600 transition"
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

