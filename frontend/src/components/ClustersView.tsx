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
  Phone, 
  Mail,
  School,
  CheckCircle2,
  AlertCircle,
  Trash2
} from './ui/icons';
import { Cluster, Session, TabType } from '../types';
import Badge from './ui/badge';
import { ActionButton } from './ui/action-button';

interface ClustersViewProps {
  clusters: Cluster[];
  sessions?: Session[];
  userRole?: string;
  onNavigate: (tab: TabType, targetId?: string) => void;
  onAddCluster?: (cluster: Partial<Cluster>) => void | Promise<void | boolean>;
  onUpdateCluster?: (id: string, cluster: Partial<Cluster>) => void | Promise<void | boolean>;
  onUpdateAdminStatus?: (id: string, status: 'ACTIVE' | 'BLOCKED', reason?: string) => void | Promise<void>;
  onDeleteCluster?: (id: string) => void | Promise<void>;
}

export const ClustersView: React.FC<ClustersViewProps> = ({
  clusters = [],
  sessions = [],
  userRole = 'Super Admin',
  onNavigate,
  onAddCluster,
  onUpdateCluster,
  onUpdateAdminStatus,
  onDeleteCluster,
}) => {
  const isSuperAdmin = !userRole || userRole === 'Super Admin' || userRole.toLowerCase().includes('super');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [clusterToDelete, setClusterToDelete] = useState<Cluster | null>(null);
  const [clusterToEdit, setClusterToEdit] = useState<Cluster | null>(null);

  const [newCollegeName, setNewCollegeName] = useState('');
  const [newClusterName, setNewClusterName] = useState('');
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
      !newClusterName.trim() ||
      !newSpocName.trim() ||
      !newSpocMobile.trim() ||
      !newSpocEmail.trim()
    ) {
      setFormError('Please fill in all required fields marked with *.');
      return;
    }

    setIsSubmitting(true);
    try {
      const clusterPayload: Partial<Cluster> = {
          collegeName: newCollegeName.trim(),
          district: newClusterDistrict.trim(),
          name: newClusterName.trim(),
          spocName: newSpocName.trim(),
          spocMobile: newSpocMobile.trim(),
          adminName: newSpocName.trim(),
          adminEmail: newSpocEmail.trim().toLowerCase(),
          adminPhone: newSpocMobile.trim(),
          status: 'Active',
        };
      const res = clusterToEdit && onUpdateCluster
        ? await onUpdateCluster(clusterToEdit.id, clusterPayload)
        : onAddCluster
          ? await onAddCluster(clusterPayload)
          : true;

      if (res === false) {
        setIsSubmitting(false);
        return;
      }

      setIsAddModalOpen(false);
      setNewCollegeName('');
      setNewClusterName('');
      setNewClusterDistrict('');
      setNewSpocName('');
      setNewSpocMobile('');
      setNewSpocEmail('');
      setFormError('');
      setClusterToEdit(null);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to onboard college cluster.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Cardless Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Clusters & College Onboarding
            </h1>
            <Badge color="primary" size="sm">
              {clusters.length} Onboarded
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage partner colleges, district hubs, SPOC coordinators, and regional administrators.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsAddModalOpen(true);
            setFormError('');
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Onboard New College</span>
        </button>
      </div>

      {/* 2. Compact Metric Cards (for count and status) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Onboarded Colleges</span>
            <School className="h-5 w-5 text-brand-500" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{clusters.length}</span>
            <Badge color="primary" size="sm">Active</Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Panchayats</span>
            <MapPin className="h-5 w-5 text-success-500" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {clusters.reduce((acc, c) => acc + (c.activePanchayats || 0), 0)}
            </span>
            <Badge color="success" size="sm">Mapped</Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Enrolled Students</span>
            <GraduationCap className="h-5 w-5 text-theme-purple-500" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {clusters.reduce((acc, c) => acc + (c.totalStudents || 0), 0)}
            </span>
            <Badge color="info" size="sm">Enrolled</Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Active Volunteers</span>
            <Users className="h-5 w-5 text-warning-500" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {clusters.reduce((acc, c) => acc + (c.totalVolunteers || 0), 0)}
            </span>
            <Badge color="warning" size="sm">Mentors</Badge>
          </div>
        </div>
      </div>

      {/* 3. Cardless Search & Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by college, district, or SPOC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* 4. Cardless Grid List */}
      {filteredClusters.length === 0 ? (
        <div className="py-16 text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-3 text-base font-semibold text-gray-800 dark:text-white">No partner colleges found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search terms.' : 'Click "Onboard New College" to register a college and assign its SPOC coordinator.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClusters.map((cluster) => {
            const clusterSessions = sessions.filter((session) => session.clusterId === cluster.id);
            const scheduledSessions = clusterSessions.filter((session) => session.status === 'Scheduled' || session.status === 'Completed' || session.status === 'In Progress');
            const completionRate = Math.round(
              ((cluster.completedSessions || 0) / Math.max(cluster.totalSessions || 8, 1)) * 100
            );

            return (
              <div
                key={cluster.id}
                role="button"
                tabIndex={0}
                onClick={() => onNavigate('sessions', cluster.id)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onNavigate('sessions', cluster.id); }}
                className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs transition-all hover:border-brand-300 dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-brand-800 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* College Info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white truncate group-hover:text-brand-500 transition-colors">
                        {cluster.collegeName || cluster.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span>{cluster.district}, Tamil Nadu</span>
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-400">
                      <span>Curriculum Progress</span>
                      <span className="font-bold text-brand-500 dark:text-brand-400">
                        {completionRate}% ({cluster.completedSessions || 0}/{cluster.totalSessions || 48})
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all duration-500"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Key Stats Row */}
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-50/70 p-2.5 text-center dark:bg-white/[0.02]">
                    <div>
                      <span className="text-[11px] text-gray-400 font-medium block">Panchayats</span>
                      <span className="text-sm font-bold text-gray-800 dark:text-white">{cluster.activePanchayats || 0}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-400 font-medium block">Students</span>
                      <span className="text-sm font-bold text-gray-800 dark:text-white">{cluster.totalStudents || 0}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-400 font-medium block">Volunteers</span>
                      <span className="text-sm font-bold text-gray-800 dark:text-white">{cluster.totalVolunteers || 0}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-3 dark:border-brand-900/40 dark:bg-brand-500/10">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-200">
                      <span>Sessions</span>
                      <span className="text-brand-600 dark:text-brand-300">{scheduledSessions.length} scheduled</span>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Open session schedule for this cluster</p>
                  </div>

                  {/* SPOC Details */}
                  <div className="rounded-xl border border-gray-100 p-3 space-y-1 text-xs dark:border-gray-800/80">
                    <div className="flex items-center justify-between font-semibold text-gray-800 dark:text-gray-200">
                      <span className="truncate">{cluster.spocName || cluster.adminName || 'SPOC Admin'}</span>
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400 shrink-0">{cluster.spocMobile || cluster.adminPhone}</span>
                    </div>
                    <div className="text-[11px] text-gray-400 truncate font-mono">
                      {cluster.adminEmail}
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  {isSuperAdmin && onDeleteCluster ? (
                    <button
                      type="button"
                      onClick={() => setClusterToDelete(cluster)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-error-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10 px-2 py-1 rounded-lg transition-colors"
                      title="Delete Cluster"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  ) : <div />}
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); onNavigate('sessions', cluster.id); }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-500 hover:text-brand-600 dark:text-brand-400 transition-colors"
                  >
                    <span>View Sessions</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  {isSuperAdmin && onUpdateCluster && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setClusterToEdit(cluster);
                        setNewCollegeName(cluster.collegeName || cluster.name || '');
                        setNewClusterName(cluster.name || '');
                        setNewClusterDistrict(cluster.district || '');
                        setNewSpocName(cluster.spocName || cluster.adminName || '');
                        setNewSpocMobile(cluster.spocMobile || cluster.adminPhone || '');
                        setNewSpocEmail(cluster.adminEmail || '');
                        setFormError('');
                        setIsAddModalOpen(true);
                      }}
                      className="text-xs font-semibold text-gray-500 hover:text-brand-500"
                    >
                      Edit
                    </button>
                  )}
                  {isSuperAdmin && onUpdateAdminStatus && (
                    <button type="button" onClick={async (event) => { event.stopPropagation(); const blocked = cluster.adminStatus === 'BLOCKED'; const reason = blocked ? '' : window.prompt('Reason for blocking this Cluster Admin:') || ''; if (!blocked && !reason) return; try { await onUpdateAdminStatus(cluster.id, blocked ? 'ACTIVE' : 'BLOCKED', reason); } catch (error: any) { setFormError(error?.message || 'Unable to update administrator status.'); } }} className="text-xs font-semibold text-gray-500 hover:text-brand-500">{cluster.adminStatus === 'BLOCKED' ? 'Unblock' : 'Block'}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Onboard New College Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-gray-900/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {clusterToEdit ? 'Edit Cluster / College' : 'Onboard Partner College'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Register institution and provision SPOC cluster admin credentials.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCluster} className="mt-5 space-y-4 text-xs">
              {formError && (
                <div className="rounded-xl border border-error-200 bg-error-50 p-3 text-xs text-error-600 dark:border-error-900/40 dark:bg-error-500/10 dark:text-error-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    College / Institution Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Government Arts College"
                    value={newCollegeName}
                    onChange={(e) => setNewCollegeName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-3.5 py-2.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    District *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dharmapuri"
                    value={newClusterDistrict}
                    onChange={(e) => setNewClusterDistrict(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-3.5 py-2.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Cluster Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KSR Cluster"
                    value={newClusterName}
                    onChange={(e) => setNewClusterName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-3.5 py-2.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-500 dark:text-brand-400">
                  College SPOC & Regional Administrator
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      SPOC Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. M. Vignesh"
                      value={newSpocName}
                      onChange={(e) => setNewSpocName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-transparent px-3.5 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      SPOC Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91 98765 43210"
                      value={newSpocMobile}
                      onChange={(e) => setNewSpocMobile(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-transparent px-3.5 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    SPOC Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. vignesh.m@gac-dpi.edu.in"
                    value={newSpocEmail}
                    onChange={(e) => setNewSpocEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-3.5 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-blue-light-200 bg-blue-light-50/70 p-3 text-xs text-blue-light-900 dark:border-blue-light-900/40 dark:bg-blue-light-500/10 dark:text-blue-light-300">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-light-500 shrink-0" />
                  Automated Credentials Email
                </p>
                <p className="mt-1 text-[11px] opacity-90">
                  The SPOC will be provisioned as Regional Cluster Admin. Login credentials will be dispatched to <strong>{newSpocEmail || 'their email'}</strong>.
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50"
                >
                  {isSubmitting ? (clusterToEdit ? 'Saving Changes...' : 'Onboarding College...') : (clusterToEdit ? 'Save Changes' : 'Onboard College & Send Credentials')}
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

