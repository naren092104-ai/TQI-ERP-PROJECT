import React, { useState, useMemo } from 'react';
import {
  Building2,
  MapPin,
  Users,
  GraduationCap,
  Plus,
  Search,
  X,
  Phone,
  Mail,
  School,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit3,
  Lock,
  LockOpen,
  Key,
} from './ui/icons';
import { Cluster } from '../types';
import Badge from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { EmptyState } from './ui/EmptyState';

interface ClustersViewProps {
  clusters: Cluster[];
  userRole?: string;
  onAddCluster?: (cluster: Partial<Cluster>) => void | Promise<void | boolean | { message?: string; warning?: string }>;
  onUpdateCluster?: (id: string, cluster: Partial<Cluster>) => void | Promise<void | boolean | { message?: string; warning?: string }>;
  onUpdateAdminStatus?: (id: string, status: 'ACTIVE' | 'BLOCKED', reason?: string) => void | Promise<void | { message?: string; warning?: string }>;
  onRequestPasswordReset?: (adminId: string) => void | Promise<void | { message?: string; warning?: string }>;
  onDeleteCluster?: (id: string) => void | Promise<void>;
}

export const ClustersView: React.FC<ClustersViewProps> = ({
  clusters = [],
  userRole = 'Super Admin',
  onAddCluster,
  onUpdateCluster,
  onUpdateAdminStatus,
  onRequestPasswordReset,
  onDeleteCluster,
}) => {
  const isSuperAdmin = !userRole || userRole === 'Super Admin' || userRole.toLowerCase().includes('super');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formNotice, setFormNotice] = useState('');
  const [clusterToDelete, setClusterToDelete] = useState<Cluster | null>(null);
  const [clusterToEdit, setClusterToEdit] = useState<Cluster | null>(null);
  const [clusterToReset, setClusterToReset] = useState<Cluster | null>(null);
  const [clusterToBlock, setClusterToBlock] = useState<Cluster | null>(null);
  const [blockReason, setBlockReason] = useState('');

  const [newCollegeName, setNewCollegeName] = useState('');
  const [newClusterName, setNewClusterName] = useState('');
  const [newClusterDistrict, setNewClusterDistrict] = useState('');
  const [newSpocName, setNewSpocName] = useState('');
  const [newSpocMobile, setNewSpocMobile] = useState('');
  const [newSpocEmail, setNewSpocEmail] = useState('');

  const filteredClusters = useMemo(() => {
    return clusters.filter((c) => {
      const matchesSearch =
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.district || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.collegeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.spocName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.adminName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.adminEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.code || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      const isBlocked = c.adminStatus === 'BLOCKED';
      if (statusFilter === 'active' && isBlocked) return false;
      if (statusFilter === 'blocked' && !isBlocked) return false;

      return true;
    });
  }, [clusters, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const total = clusters.length;
    const active = clusters.filter((c) => c.adminStatus !== 'BLOCKED').length;
    const blocked = clusters.filter((c) => c.adminStatus === 'BLOCKED').length;
    const totalPanchayats = clusters.reduce((acc, c) => acc + (c.activePanchayats || 0), 0);
    const totalStudents = clusters.reduce((acc, c) => acc + (c.totalStudents || 0), 0);
    const totalVolunteers = clusters.reduce((acc, c) => acc + (c.totalVolunteers || 0), 0);
    return { total, active, blocked, totalPanchayats, totalStudents, totalVolunteers };
  }, [clusters]);

  const handleOpenEdit = (cluster: Cluster) => {
    setClusterToEdit(cluster);
    setNewCollegeName(cluster.collegeName || cluster.name || '');
    setNewClusterName(cluster.name || '');
    setNewClusterDistrict(cluster.district || '');
    setNewSpocName(cluster.spocName || cluster.adminName || '');
    setNewSpocMobile(cluster.spocMobile || cluster.adminPhone || '');
    setNewSpocEmail(cluster.adminEmail || '');
    setFormError('');
    setFormNotice('');
    setIsAddModalOpen(true);
  };

  const handleOpenCreate = () => {
    setClusterToEdit(null);
    setNewCollegeName('');
    setNewClusterName('');
    setNewClusterDistrict('');
    setNewSpocName('');
    setNewSpocMobile('');
    setNewSpocEmail('');
    setFormError('');
    setFormNotice('');
    setIsAddModalOpen(true);
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (
      !newCollegeName.trim() ||
      !newClusterDistrict.trim() ||
      !newClusterName.trim() ||
      (!clusterToEdit && !newSpocName.trim()) ||
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
        spocName: (newSpocName || clusterToEdit?.spocName || '').trim(),
        spocMobile: newSpocMobile.trim(),
        adminName: (newSpocName || clusterToEdit?.adminName || '').trim(),
        adminEmail: newSpocEmail.trim().toLowerCase(),
        adminPhone: newSpocMobile.trim(),
        status: 'Active',
      };

      const res =
        clusterToEdit && onUpdateCluster
          ? await onUpdateCluster(clusterToEdit.id, clusterPayload)
          : onAddCluster
          ? await onAddCluster(clusterPayload)
          : true;

      if (res === false) {
        setIsSubmitting(false);
        return;
      }

      if (res && typeof res === 'object') {
        setFormNotice(res.warning || res.message || 'Saved successfully.');
      } else {
        setFormNotice(clusterToEdit ? 'Cluster details saved successfully.' : 'Cluster created successfully.');
      }

      setIsAddModalOpen(false);
      setClusterToEdit(null);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save college cluster.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {formNotice && (
        <div className={`rounded-md border p-3 text-sm ${formNotice.toLowerCase().includes('could not') || formNotice.toLowerCase().includes('unable') ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`}>
          {formNotice}
        </div>
      )}
      {/* 1. Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Clusters & College Onboarding
            </h1>
            <Badge variant="primary">
              {stats.total} {stats.total === 1 ? 'Cluster' : 'Clusters'}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Manage partner institutions, cluster SPOC coordinators, district mappings, and login access.
          </p>
        </div>

        {isSuperAdmin && (
          <Button onClick={handleOpenCreate} className="shrink-0 gap-1.5 shadow-xs">
            <Plus className="h-4 w-4" />
            <span>Onboard New College</span>
          </Button>
        )}
      </div>

      {/* 2. KPI Metrics Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total Clusters</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">{stats.total}</span>
            <School className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Active Hubs</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.active}</span>
            <Badge variant="success" className="text-[10px] px-1.5 py-0">Online</Badge>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Blocked</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-destructive">{stats.blocked}</span>
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Blocked</Badge>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Panchayats</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">{stats.totalPanchayats}</span>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Students</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">{stats.totalStudents}</span>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Volunteers</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">{stats.totalVolunteers}</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* 3. Filter & Search Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by college, district, SPOC, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded transition-colors ${
                statusFilter === 'all'
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({clusters.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded transition-colors ${
                statusFilter === 'active'
                  ? 'bg-card text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Active ({stats.active})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('blocked')}
              className={`px-3 py-1 rounded transition-colors ${
                statusFilter === 'blocked'
                  ? 'bg-card text-destructive font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Blocked ({stats.blocked})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewMode === 'table' ? 'bg-card text-foreground font-semibold shadow-xs' : 'text-muted-foreground'
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-card text-foreground font-semibold shadow-xs' : 'text-muted-foreground'
              }`}
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* 4. Content Area: Table or Card Grid */}
      {filteredClusters.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No clusters match your filters"
          description={
            searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your search criteria or resetting filters.'
              : 'Get started by onboarding your first college cluster.'
          }
          actionLabel={isSuperAdmin ? 'Onboard New College' : undefined}
          onAction={isSuperAdmin ? handleOpenCreate : undefined}
        />
      ) : viewMode === 'table' ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Cluster Name</th>
                  <th className="px-4 py-3">Partner College</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">SPOC Coordinator</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredClusters.map((cluster) => {
                  const isBlocked = cluster.adminStatus === 'BLOCKED';
                  return (
                    <tr key={cluster.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-foreground">{cluster.name}</div>
                        {cluster.code && (
                          <div className="font-mono text-[11px] text-muted-foreground">{cluster.code}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground">{cluster.collegeName || 'College not assigned'}</div>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                          {cluster.district}, TN
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground">
                          {cluster.spocName || cluster.adminName || 'SPOC Admin'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        <div className="flex flex-col gap-0.5">
                          {(cluster.spocMobile || cluster.adminPhone) && (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                              <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                              {cluster.spocMobile || cluster.adminPhone}
                            </span>
                          )}
                          {cluster.adminEmail && (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                              <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                              {cluster.adminEmail}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={isBlocked ? 'destructive' : 'success'}>
                          {isBlocked ? 'Blocked' : 'Active'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {isSuperAdmin && onUpdateCluster && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(cluster)}
                              title="Edit cluster details"
                              className="h-7 px-2 text-xs"
                            >
                              <Edit3 className="h-3.5 w-3.5 mr-1" />
                              Edit
                            </Button>
                          )}

                          {isSuperAdmin && onUpdateAdminStatus && (
                            <Button
                              variant={isBlocked ? 'outline' : 'ghost'}
                              size="sm"
                              onClick={() => {
                                setClusterToBlock(cluster);
                                setBlockReason('');
                                setFormError('');
                              }}
                              title={isBlocked ? 'Unblock login' : 'Block login'}
                              className={`h-7 px-2 text-xs ${
                                isBlocked
                                  ? 'text-emerald-600 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50'
                                  : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20'
                              }`}
                            >
                              {isBlocked ? (
                                <>
                                  <LockOpen className="h-3.5 w-3.5 mr-1" />
                                  Unblock
                                </>
                              ) : (
                                <>
                                  <Lock className="h-3.5 w-3.5 mr-1" />
                                  Block
                                </>
                              )}
                            </Button>
                          )}

                          {isSuperAdmin && onRequestPasswordReset && cluster.adminId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setClusterToReset(cluster);
                                setFormError('');
                              }}
                              title="Send password reset email"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Key className="h-3.5 w-3.5 mr-1" />
                              Reset
                            </Button>
                          )}

                          {isSuperAdmin && onDeleteCluster && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setClusterToDelete(cluster)}
                              title="Delete Cluster"
                              className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card Grid View */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClusters.map((cluster) => {
            const isBlocked = cluster.adminStatus === 'BLOCKED';
            return (
              <div
                key={cluster.id}
                className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-xs transition hover:border-primary/50"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-foreground">{cluster.name}</h3>
                      <p className="truncate text-xs font-medium text-muted-foreground">
                        {cluster.collegeName || 'College not assigned'}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>{cluster.district}, Tamil Nadu</span>
                      </p>
                    </div>
                    <Badge variant={isBlocked ? 'destructive' : 'success'}>
                      {isBlocked ? 'Blocked' : 'Active'}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 rounded-md border border-border bg-muted/20 p-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SPOC:</span>
                      <span className="font-semibold text-foreground">
                        {cluster.spocName || cluster.adminName || 'SPOC Admin'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="font-mono text-foreground">
                        {cluster.spocMobile || cluster.adminPhone || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="max-w-[180px] truncate font-mono text-foreground">
                        {cluster.adminEmail || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-1 border-t border-border pt-3">
                  {isSuperAdmin && onDeleteCluster ? (
                    <button
                      type="button"
                      onClick={() => setClusterToDelete(cluster)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-1">
                    {isSuperAdmin && onUpdateCluster && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(cluster)}
                        className="h-7 px-2 text-xs"
                      >
                        Edit
                      </Button>
                    )}
                    {isSuperAdmin && onUpdateAdminStatus && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setClusterToBlock(cluster);
                          setBlockReason('');
                          setFormError('');
                        }}
                        className={`h-7 px-2 text-xs ${isBlocked ? 'text-emerald-600' : 'text-amber-600'}`}
                      >
                        {isBlocked ? 'Unblock' : 'Block'}
                      </Button>
                    )}
                    {isSuperAdmin && onRequestPasswordReset && cluster.adminId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setClusterToReset(cluster);
                          setFormError('');
                        }}
                        className="h-7 px-2 text-xs text-muted-foreground"
                      >
                        Reset PW
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Modal: Onboard / Edit Cluster */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {clusterToEdit ? 'Edit Cluster & Institution' : 'Onboard Partner College'}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {clusterToEdit
                    ? 'Update cluster details and SPOC contact credentials.'
                    : 'Register college, define operational cluster hub, and provision SPOC account.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdate} className="mt-4 space-y-4 text-xs">
              {formError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    College / Institution Name *
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. Government Arts College"
                    value={newCollegeName}
                    onChange={(e) => setNewCollegeName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Cluster Name *
                    </label>
                    <Input
                      type="text"
                      required
                      placeholder="e.g. Salem Central Hub"
                      value={newClusterName}
                      onChange={(e) => setNewClusterName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      District (Tamil Nadu) *
                    </label>
                    <Input
                      type="text"
                      required
                      placeholder="e.g. Salem"
                      value={newClusterDistrict}
                      onChange={(e) => setNewClusterDistrict(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                  {clusterToEdit ? 'SPOC Coordinator Contact' : 'SPOC Admin Account Credentials'}
                </h4>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {!clusterToEdit && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-foreground">
                        SPOC Full Name *
                      </label>
                      <Input
                        type="text"
                        required
                        placeholder="e.g. Dr. M. Vignesh"
                        value={newSpocName}
                        onChange={(e) => setNewSpocName(e.target.value)}
                      />
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      SPOC Mobile Number *
                    </label>
                    <Input
                      type="tel"
                      required
                      placeholder="e.g. 9876543210"
                      value={newSpocMobile}
                      onChange={(e) => setNewSpocMobile(e.target.value)}
                    />
                  </div>

                  <div className={clusterToEdit ? 'sm:col-span-2' : ''}>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      SPOC Official Email *
                    </label>
                    <Input
                      type="email"
                      required
                      placeholder="e.g. spoc@institution.edu.in"
                      value={newSpocEmail}
                      onChange={(e) => setNewSpocEmail(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
                <p className="flex items-center gap-1.5 font-semibold text-primary">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {clusterToEdit ? 'Immediate Live Sync' : 'Automated Credential Provisioning'}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {clusterToEdit
                    ? 'Changes will sync immediately across associated Panchayats, Villages, and Super Admin logs.'
                    : 'The SPOC coordinator will receive secure access instructions at ' + (newSpocEmail || 'their official email') + '.'}
                </p>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? clusterToEdit
                      ? 'Saving...'
                      : 'Onboarding...'
                    : clusterToEdit
                    ? 'Save Changes'
                    : 'Onboard College & Create Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal: Delete Confirmation */}
      {clusterToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="mb-3 flex items-center gap-3 text-destructive">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Delete Cluster</h3>
                <p className="text-xs text-muted-foreground">Irreversible ERP operation</p>
              </div>
            </div>

            <p className="mb-5 text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete from MySQL{' '}
              <strong className="text-foreground">{clusterToDelete.collegeName || clusterToDelete.name}</strong> (
              {clusterToDelete.district})? This is allowed only when it has no dependent records.
            </p>
            {formError && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{formError}</p>}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (onDeleteCluster && clusterToDelete) {
                  try {
                    await onDeleteCluster(clusterToDelete.id);
                    setClusterToDelete(null);
                    setFormError('');
                  } catch (error: any) {
                    setFormError(error?.message || 'Unable to delete cluster.');
                  }
                }
              }}
              className="flex justify-end gap-2"
            >
              <Button type="button" variant="outline" onClick={() => setClusterToDelete(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive">
                Delete Cluster
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal: Password Reset */}
      {clusterToReset && onRequestPasswordReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const result = await onRequestPasswordReset(clusterToReset.adminId!);
                setFormNotice(result && typeof result === 'object' ? result.warning || result.message || 'Password reset mail sent successfully.' : 'Password reset mail sent successfully.');
                setClusterToReset(null);
              } catch (error: any) {
                setFormError(error?.message || 'Unable to send password reset link.');
              }
            }}
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl"
          >
            <h3 className="text-sm font-bold text-foreground">Reset Cluster Admin Password</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Send an automated password reset link to the SPOC coordinator.
            </p>

            <div className="mt-4 space-y-1.5 rounded-md border border-border bg-muted/20 p-3 text-xs">
              <div>
                <span className="text-muted-foreground">Cluster:</span>{' '}
                <strong className="text-foreground">{clusterToReset.name}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">SPOC:</span>{' '}
                <strong className="text-foreground">{clusterToReset.spocName || clusterToReset.adminName}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>{' '}
                <span className="font-mono text-foreground">{clusterToReset.adminEmail}</span>
              </div>
            </div>

            {formError && <p className="mt-3 text-xs text-destructive">{formError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setClusterToReset(null)}>
                Cancel
              </Button>
              <Button type="submit">
                Send Reset Link
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* 8. Modal: Block / Unblock Admin */}
      {clusterToBlock && onUpdateAdminStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const blocked = clusterToBlock.adminStatus === 'BLOCKED';
              if (!blocked && !blockReason.trim()) {
                setFormError('Please enter a reason for blocking this account.');
                return;
              }
              try {
                const result = await onUpdateAdminStatus(clusterToBlock.id, blocked ? 'ACTIVE' : 'BLOCKED', blockReason.trim());
                setFormNotice(result && typeof result === 'object' ? result.warning || result.message || 'Account status and notification mail updated successfully.' : 'Account status and notification mail updated successfully.');
                setClusterToBlock(null);
              } catch (error: any) {
                setFormError(error?.message || 'Unable to update administrator status.');
              }
            }}
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl"
          >
            <h3 className="text-sm font-bold text-foreground">
              {clusterToBlock.adminStatus === 'BLOCKED' ? 'Unblock Cluster Admin' : 'Block Cluster Admin'}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Cluster: <strong className="text-foreground">{clusterToBlock.name}</strong>
            </p>

            {clusterToBlock.adminStatus !== 'BLOCKED' && (
              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Reason for Suspension *
                </label>
                <textarea
                  autoFocus
                  required
                  rows={3}
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Explain why this account is being blocked..."
                  className="w-full rounded-md border border-border bg-transparent p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            {formError && <p className="mt-3 text-xs text-destructive">{formError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setClusterToBlock(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={clusterToBlock.adminStatus === 'BLOCKED' ? 'default' : 'destructive'}
              >
                {clusterToBlock.adminStatus === 'BLOCKED' ? 'Unblock Account' : 'Block Account'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};


