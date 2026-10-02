import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Plus,
  Search,
  Users,
  Home,
  GraduationCap,
  CalendarCheck,
  X,
  Trash2,
} from './ui/icons';
import { TabType, Panchayat, Student, UserRole } from '../types';
import Badge from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { EmptyState } from './ui/EmptyState';
import { apiUrl } from '../utils/api';

interface PanchayatDetailViewProps {
  panchayat: Panchayat;
  students: Student[];
  authToken?: string;
  selectedAcademicYearId?: string;
  userRole?: UserRole;
  onBack: () => void;
  onNavigate: (tab: TabType, targetId?: string, secondaryParam?: string) => void;
  onAddVillage: (panchayatId: string, villageName: string) => Promise<void>;
  onDeleteVillage?: (panchayatId: string, villageId: string) => Promise<void>;
}

function villageStudentsOf(panchayatId: string, villageName: string, all: Student[]) {
  return all.filter(
    (s) =>
      (s.panchayatId === panchayatId ||
        (s.panchayatName || '').toLowerCase().includes(panchayatId.toLowerCase())) &&
      (s.villageName || '').toLowerCase() === villageName.toLowerCase()
  );
}

export const PanchayatDetailView: React.FC<PanchayatDetailViewProps> = ({
  panchayat,
  students = [],
  authToken,
  selectedAcademicYearId = '',
  onBack,
  onNavigate,
  onAddVillage,
  onDeleteVillage,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newVillage, setNewVillage] = useState('');
  const [villageDirectory, setVillageDirectory] = useState<string[]>([]);
  const [isLoadingVillageDirectory, setIsLoadingVillageDirectory] = useState(false);
  const [villageDirectoryError, setVillageDirectoryError] = useState('');
  const [villageSaveError, setVillageSaveError] = useState('');
  const [isSavingVillage, setIsSavingVillage] = useState(false);
  const [isVillageMenuOpen, setIsVillageMenuOpen] = useState(false);
  const [villageDeleteError, setVillageDeleteError] = useState('');
  const [deletingVillageId, setDeletingVillageId] = useState('');
  const [search, setSearch] = useState('');

  React.useEffect(() => {
    if (!showAdd || !selectedAcademicYearId) {
      setVillageDirectory([]);
      setVillageDirectoryError('');
      setIsLoadingVillageDirectory(false);
      return;
    }

    const controller = new AbortController();
    const loadVillageDirectory = async () => {
      setVillageDirectory([]);
      setVillageDirectoryError('');
      setVillageSaveError('');
      setIsLoadingVillageDirectory(true);
      try {
        const response = await fetch(apiUrl(`/api/villages/directory?panchayatId=${encodeURIComponent(panchayat.id)}`), {
          signal: controller.signal,
          cache: 'no-store',
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success || !Array.isArray(data.villages)) {
          throw new Error(data?.error || 'Unable to load villages for this Panchayat.');
        }
        setVillageDirectory(data.villages.filter((name: unknown): name is string => typeof name === 'string' && Boolean(name.trim())));
      } catch (error: any) {
        if (error?.name !== 'AbortError') setVillageDirectoryError(error?.message || 'Unable to load this Panchayat’s village list.');
      } finally {
        if (!controller.signal.aborted) setIsLoadingVillageDirectory(false);
      }
    };

    void loadVillageDirectory();
    return () => controller.abort();
  }, [authToken, panchayat.id, selectedAcademicYearId, showAdd]);

  const panStudents = useMemo(() => {
    return students.filter(
      (s) =>
        s.panchayatId === panchayat.id ||
        (s.panchayatName || '').toLowerCase() === (panchayat.name || '').toLowerCase()
    );
  }, [students, panchayat]);

  const boys = panStudents.filter((s) => s.gender === 'male').length;
  const girls = panStudents.filter((s) => s.gender === 'female').length;

  const filteredVillages = useMemo(() => {
    return (panchayat.villages || []).filter((v) =>
      (v.name || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [panchayat.villages, search]);

  const normalizeVillageName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
  const matchingVillageOptions = villageDirectory.filter((name) =>
    !newVillage.trim() || normalizeVillageName(name).includes(normalizeVillageName(newVillage)),
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedName = newVillage.trim().replace(/\s+/g, ' ');
    if (panchayat.villages.some((village) => normalizeVillageName(village.name) === normalizeVillageName(selectedName))) {
      setVillageSaveError('This village is already added to this Panchayat.');
      return;
    }
    setIsSavingVillage(true);
    setVillageSaveError('');
    try {
      await onAddVillage(panchayat.id, selectedName);
      setNewVillage('');
      setShowAdd(false);
      setIsVillageMenuOpen(false);
    } catch (error: any) {
      setVillageSaveError(error?.message || 'Unable to save this village.');
    } finally {
      setIsSavingVillage(false);
    }
  };

  const handleDeleteVillage = async (villageId: string, villageName: string) => {
    if (!onDeleteVillage || !window.confirm(`Delete village ${villageName}? Deletion is blocked if linked student or school records exist.`)) return;
    setDeletingVillageId(villageId);
    setVillageDeleteError('');
    try {
      await onDeleteVillage(panchayat.id, villageId);
    } catch (error: any) {
      setVillageDeleteError(error?.message || `Unable to delete ${villageName}.`);
    } finally {
      setDeletingVillageId('');
    }
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
      {/* 1. Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Panchayats</span>
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className="font-semibold text-foreground">{panchayat.name}</span>
      </div>

      {/* 2. Header Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border bg-card p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {panchayat.name}
            </h1>
            {getStatusBadge(panchayat.status)}
          </div>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
            <span>{panchayat.cluster}</span>
            <span>&middot;</span>
            <span>{(panchayat.villages || []).length} Villages</span>
            <span>&middot;</span>
            <span>{panStudents.length} Students</span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('attendance', panchayat.id)}
            className="gap-1.5"
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            <span>Attendance</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAdd(true)}
            className="gap-1.5 shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Village</span>
          </Button>
        </div>
      </div>

      {/* 3. KPI Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Villages</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">{(panchayat.villages || []).length}</span>
            <Home className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total Students</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">{panStudents.length}</span>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Girls Enrolled</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">{girls}</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Boys Enrolled</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">{boys}</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* 4. Villages Data Table */}
      <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
        {villageDeleteError && <p role="alert" className="m-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{villageDeleteError}</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Village Learning Centers</h3>
            <p className="text-xs text-muted-foreground">Constituent villages mapped to this panchayat</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filter villages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdd(true)}
              className="h-8 gap-1 text-xs shrink-0"
            >
              <Plus className="h-3 w-3" />
              <span>Add</span>
            </Button>
          </div>
        </div>

        {filteredVillages.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Home}
              title="No village centers found"
              description={
                search
                  ? 'Try a different search query.'
                  : 'Add the first village center to this panchayat.'
              }
              actionLabel="Add Village"
              onAction={() => setShowAdd(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-12 px-4 py-3 text-center">#</th>
                  <th className="px-4 py-3">Village Name</th>
                  <th className="px-4 py-3">Learners</th>
                  <th className="px-4 py-3">Demographics</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredVillages.map((v, idx) => {
                  const vs = villageStudentsOf(panchayat.id, v.name, panStudents);
                  const vBoys = vs.filter((s) => s.gender === 'male').length;
                  const vGirls = vs.filter((s) => s.gender === 'female').length;
                  const count = vs.length || v.studentCount || 0;

                  return (
                    <tr
                      key={v.id || v.name}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3.5 text-center font-mono text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-foreground">
                          {v.name}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant="primary" className="font-medium">
                          {count} learners
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {vBoys} boys &middot; {vGirls} girls
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {onDeleteVillage && <button type="button" title={`Delete ${v.name}`} disabled={Boolean(deletingVillageId)} onClick={() => void handleDeleteVillage(v.id, v.name)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Add Village Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">
                Add Village to {panchayat.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                {isLoadingVillageDirectory
                  ? 'Loading villages for this Panchayat…'
                  : villageDirectoryError || `${villageDirectory.length} villages mapped to this Panchayat are available.`}
              </div>
              {villageSaveError && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{villageSaveError}</p>}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="vil-name">
                  Village Name *
                </label>
                <div className="relative">
                  <Input
                    id="vil-name"
                    type="search"
                    required
                    autoComplete="off"
                    placeholder="Search villages in this Panchayat"
                    value={newVillage}
                    onFocus={() => setIsVillageMenuOpen(true)}
                    onChange={(e) => { setNewVillage(e.target.value); setVillageSaveError(''); setIsVillageMenuOpen(true); }}
                    onKeyDown={(e) => { if (e.key === 'Escape') setIsVillageMenuOpen(false); }}
                    role="combobox"
                    aria-expanded={isVillageMenuOpen}
                    aria-controls="village-name-options"
                    autoFocus
                  />
                  {isVillageMenuOpen && <div id="village-name-options" role="listbox" aria-label={`Villages under ${panchayat.name}`} className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg">
                    {isLoadingVillageDirectory
                      ? <p className="px-3 py-2 text-xs text-muted-foreground">Loading village names…</p>
                      : villageDirectoryError
                        ? <p className="px-3 py-2 text-xs text-destructive">{villageDirectoryError}</p>
                        : matchingVillageOptions.length
                          ? matchingVillageOptions.map((name) => {
                              const alreadyAdded = panchayat.villages.some((village) => normalizeVillageName(village.name) === normalizeVillageName(name));
                              return <button key={name} type="button" role="option" aria-selected={normalizeVillageName(newVillage) === normalizeVillageName(name)} disabled={alreadyAdded} onClick={() => { setNewVillage(name); setIsVillageMenuOpen(false); setVillageSaveError(''); }} className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground">{name}{alreadyAdded && <span className="ml-2 text-[10px]">Already added</span>}</button>;
                            })
                          : <p className="px-3 py-2 text-xs text-muted-foreground">{villageDirectory.length ? 'No directory match. You can still save the village name you typed.' : 'Directory unavailable. You can still type and save the village name.'}</p>}
                  </div>}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Parent Panchayat
                </label>
                <Input
                  type="text"
                  disabled
                  value={panchayat.name}
                  className="bg-muted/40 cursor-not-allowed"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSavingVillage || isLoadingVillageDirectory}>
                  {isSavingVillage ? 'Saving…' : 'Save Village'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

