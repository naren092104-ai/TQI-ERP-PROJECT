import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  MapPin, 
  Home, 
  GraduationCap, 
  Users, 
  X,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { TabType, Panchayat } from '../types';
import Badge from './ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableCell } from './ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { ActionButton } from './ui/action-button';

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
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showAdd, setShowAdd]           = useState(false);

  const [form, setForm] = useState({
    name: '',
    block: 'Harur Block',
    status: 'On Track' as 'On Track' | 'Correction Required' | 'Action Needed',
    villages: '',
  });

  const totalVillages  = useMemo(() => panchayats.reduce((s, p) => s + (p.villagesCount || p.villages.length), 0), [panchayats]);
  const totalStudents  = useMemo(() => panchayats.reduce((s, p) => s + p.activeStudents, 0), [panchayats]);
  const totalVols      = useMemo(() => panchayats.reduce((s, p) => s + p.volunteersCount, 0), [panchayats]);

  const filtered = useMemo(() =>
    panchayats.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        p.name.toLowerCase().includes(q) ||
        p.villages.some((v) => v.name.toLowerCase().includes(q));
      const matchStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchSearch && matchStatus;
    }),
    [panchayats, search, statusFilter]
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onAddPanchayat({
      name: form.name.trim(),
      cluster: `Dharmapuri (${form.block})`,
      status: form.status,
      initialVillages: form.villages.split(',').map((v) => v.trim()).filter(Boolean),
    });
    setForm({ name: '', block: 'Harur Block', status: 'On Track', villages: '' });
    setShowAdd(false);
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
              Panchayats & Village Clusters
            </h1>
            <Badge color="primary" size="sm">
              {panchayats.length} Panchayats
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {panchayats.length} panchayat hubs &middot; {totalVillages} active villages &middot; {totalStudents} enrolled students
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Add Panchayat</span>
        </button>
      </div>

      {/* 2. Compact Metric Cards (counts & status only) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Panchayats</span>
            <MapPin className="h-4 w-4 text-brand-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{panchayats.length}</div>
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
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Students</span>
            <GraduationCap className="h-4 w-4 text-theme-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{totalStudents}</div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Volunteers</span>
            <Users className="h-4 w-4 text-warning-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{totalVols}</div>
        </div>
      </div>

      {/* 3. Cardless Search & Filter Bar */}
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
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader className="w-[300px]">Panchayat</TableCell>
                <TableCell isHeader>Status</TableCell>
                <TableCell isHeader>Villages</TableCell>
                <TableCell isHeader>Students</TableCell>
                <TableCell isHeader>Volunteers</TableCell>
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
                  <TableCell className="text-gray-600 dark:text-gray-300 font-medium">
                    {p.activeStudents}
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-gray-300 font-medium">
                    {p.volunteersCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigate('students', p.id)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white transition"
                      >
                        Students
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectPanchayat(p.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-500 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20 transition"
                      >
                        <span>Open</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Panchayat Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-gray-900/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900 animate-in fade-in-0 zoom-in-95">
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

            <form onSubmit={handleSave} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5" htmlFor="pan-name">
                  Panchayat Name *
                </label>
                <input
                  id="pan-name"
                  type="text"
                  required
                  placeholder="e.g. Vedakkattamaduvu"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-3.5 py-2.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5" htmlFor="pan-block">
                  Block
                </label>
                <input
                  id="pan-block"
                  type="text"
                  value={form.block}
                  onChange={(e) => setForm({ ...form, block: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-3.5 py-2.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5" htmlFor="pan-status">
                  Operational Status
                </label>
                <Select
                  value={form.status}
                  onValueChange={(val: any) => setForm({ ...form, status: val })}
                >
                  <SelectTrigger className="h-10 text-xs">
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5" htmlFor="pan-villages">
                  Initial Villages (comma separated)
                </label>
                <input
                  id="pan-villages"
                  type="text"
                  placeholder="e.g. Ammapettai, Pudur, Kottai"
                  value={form.villages}
                  onChange={(e) => setForm({ ...form, villages: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-3.5 py-2.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition"
                >
                  Save Panchayat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
