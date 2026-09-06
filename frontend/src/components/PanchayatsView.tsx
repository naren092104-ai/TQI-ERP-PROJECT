import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  MapPin,
  Home,
  GraduationCap,
  Users,
  X,
  ChevronRight,
  School,
  CalendarCheck,
} from './ui/icons';
import { TabType, Panchayat } from '../types';
import Badge from './ui/badge';
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

interface PanchayatsViewProps {
  panchayats: Panchayat[];
  onSelectPanchayat: (panchayatId: string) => void;
  onAddPanchayat: (p: {
    name: string;
    cluster: string;
    status: 'On Track' | 'Correction Required' | 'Action Needed';
    initialVillages: string[];
  }) => void;
  onNavigate: (tab: TabType, targetId?: string, secondaryParam?: string) => void;
}

export const PanchayatsView: React.FC<PanchayatsViewProps> = ({
  panchayats,
  onSelectPanchayat,
  onAddPanchayat,
  onNavigate,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'On Track' | 'Correction Required' | 'Action Needed'>('All');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showAdd, setShowAdd] = useState(false);

  const [form, setForm] = useState({
    name: '',
    cluster: 'Dharmapuri Cluster',
    status: 'On Track' as 'On Track' | 'Correction Required' | 'Action Needed',
    villages: '',
  });

  const totalVillages = useMemo(
    () => panchayats.reduce((s, p) => s + (p.villagesCount || p.villages?.length || 0), 0),
    [panchayats]
  );
  const totalStudents = useMemo(
    () => panchayats.reduce((s, p) => s + (p.activeStudents || 0), 0),
    [panchayats]
  );
  const totalVols = useMemo(
    () => panchayats.reduce((s, p) => s + (p.volunteersCount || 0), 0),
    [panchayats]
  );

  const filtered = useMemo(() => {
    return panchayats.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.cluster || '').toLowerCase().includes(q) ||
        (p.villages || []).some((v) => (v.name || '').toLowerCase().includes(q));
      const matchStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [panchayats, search, statusFilter]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onAddPanchayat({
      name: form.name.trim(),
      cluster: form.cluster.trim(),
      status: form.status,
      initialVillages: form.villages.split(',').map((v) => v.trim()).filter(Boolean),
    });
    setForm({ name: '', cluster: 'Dharmapuri Cluster', status: 'On Track', villages: '' });
    setShowAdd(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'On Track':
        return <Badge variant="success">On Track</Badge>;
      case 'Correction Required':
        return <Badge variant="warning">Correction Required</Badge>;
      case 'Action Needed':
        return <Badge variant="destructive">Action Needed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Panchayats & Village Learning Hubs
            </h1>
            <Badge variant="primary">
              {panchayats.length} {panchayats.length === 1 ? 'Panchayat' : 'Panchayats'}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Operational mapping of village jurisdictions, learning centers, students, and volunteer deployments.
          </p>
        </div>

        <Button onClick={() => setShowAdd(true)} className="shrink-0 gap-1.5 shadow-xs">
          <Plus className="h-4 w-4" />
          <span>Add Panchayat</span>
        </Button>
      </div>

      {/* 2. KPI Metrics Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total Panchayats</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">{panchayats.length}</span>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Mapped Villages</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">{totalVillages}</span>
            <Home className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Enrolled Students</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">{totalStudents}</span>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Active Volunteers</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">{totalVols}</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search panchayats, clusters, or villages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5 text-xs font-medium">
            {(['All', 'On Track', 'Correction Required', 'Action Needed'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded transition-colors ${
                  statusFilter === s
                    ? 'bg-card text-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'All' ? `All (${panchayats.length})` : s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-muted-foreground">
            Showing {filtered.length} of {panchayats.length}
          </span>
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

      {/* 4. Table or Grid View */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No panchayats match your search"
          description={
            search || statusFilter !== 'All'
              ? 'Try adjusting your search criteria or resetting filters.'
              : 'Get started by creating your first panchayat learning hub.'
          }
          actionLabel="Add Panchayat"
          onAction={() => setShowAdd(true)}
        />
      ) : viewMode === 'table' ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Panchayat Name</th>
                  <th className="px-4 py-3">Assigned Cluster</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Villages</th>
                  <th className="px-4 py-3">Students</th>
                  <th className="px-4 py-3">Volunteers</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => {
                  const villageCount = p.villagesCount || p.villages?.length || 0;
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => onSelectPanchayat(p.id)}
                          className="text-left font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
                        >
                          {p.name}
                        </button>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {(p.villages || []).slice(0, 3).map((v) => (
                            <span
                              key={v.id || v.name}
                              className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {v.name}
                            </span>
                          ))}
                          {(p.villages?.length || 0) > 3 && (
                            <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              +{(p.villages?.length || 0) - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <School className="h-3 w-3 shrink-0" />
                          <span className="font-medium text-foreground">{p.cluster || 'General Hub'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {getStatusBadge(p.status)}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-foreground">
                        {villageCount}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-foreground">
                        {p.activeStudents || 0}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-foreground">
                        {p.volunteersCount || 0}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onNavigate('students', p.id)}
                            className="h-7 px-2 text-xs"
                          >
                            Students
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onNavigate('attendance', p.id)}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Attendance
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSelectPanchayat(p.id)}
                            className="h-7 gap-1 px-2.5 text-xs text-primary border-primary/30 hover:bg-primary/5"
                          >
                            <span>Open</span>
                            <ChevronRight className="h-3 w-3" />
                          </Button>
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
          {filtered.map((p) => {
            const villageCount = p.villagesCount || p.villages?.length || 0;
            return (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-xs transition hover:border-primary/50"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onSelectPanchayat(p.id)}
                        className="text-left font-bold text-foreground hover:text-primary transition-colors text-sm truncate block"
                      >
                        {p.name}
                      </button>
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">{p.cluster || 'Cluster Hub'}</p>
                    </div>
                    {getStatusBadge(p.status)}
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-muted/20 p-2.5 text-center text-xs">
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">Villages</div>
                      <div className="mt-0.5 font-bold text-foreground">{villageCount}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">Students</div>
                      <div className="mt-0.5 font-bold text-foreground">{p.activeStudents || 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">Mentors</div>
                      <div className="mt-0.5 font-bold text-foreground">{p.volunteersCount || 0}</div>
                    </div>
                  </div>

                  {p.villages && p.villages.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.villages.slice(0, 4).map((v) => (
                        <span
                          key={v.id || v.name}
                          className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {v.name}
                        </span>
                      ))}
                      {p.villages.length > 4 && (
                        <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          +{p.villages.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() => onNavigate('students', p.id)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    View Students
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectPanchayat(p.id)}
                    className="h-7 gap-1 px-2.5 text-xs text-primary border-primary/30"
                  >
                    <span>Open Hub</span>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Add Panchayat Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Add New Panchayat</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Create a panchayat hub and register its constituent learning villages.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="pan-name">
                  Panchayat Name *
                </label>
                <Input
                  id="pan-name"
                  type="text"
                  required
                  placeholder="e.g. Vedakkattamaduvu"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="pan-cluster">
                  Cluster Hub *
                </label>
                <Input
                  id="pan-cluster"
                  type="text"
                  required
                  placeholder="e.g. Dharmapuri Cluster"
                  value={form.cluster}
                  onChange={(e) => setForm({ ...form, cluster: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="pan-status">
                  Operational Status
                </label>
                <Select
                  value={form.status}
                  onValueChange={(val: any) => setForm({ ...form, status: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="On Track">On Track</SelectItem>
                    <SelectItem value="Correction Required">Correction Required</SelectItem>
                    <SelectItem value="Action Needed">Action Needed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="pan-villages">
                  Initial Villages (comma separated)
                </label>
                <Input
                  id="pan-villages"
                  type="text"
                  placeholder="e.g. Ammapettai, Pudur, Kottai"
                  value={form.villages}
                  onChange={(e) => setForm({ ...form, villages: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save Panchayat
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

