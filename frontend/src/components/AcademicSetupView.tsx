import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Edit3, Plus, Save, X } from './ui/icons';
import { apiUrl } from '../utils/api';

interface AcademicYear { id: string; name: string; start_date?: string; end_date?: string; is_active?: boolean; status?: string; }
interface ProgramDay { id: string; academic_year_id: string; day_number: number; day_name: string; status: string; }
interface AcademicSetupViewProps { authToken?: string; onSetupSaved?: () => void; onOpenDay?: (academicYearId: string, dayId: string) => void; onAcademicYearChange?: (academicYearId: string) => void; }

export const AcademicSetupView: React.FC<AcademicSetupViewProps> = ({ authToken, onSetupSaved, onOpenDay, onAcademicYearChange }) => {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<ProgramDay | null>(null);
  const [dayName, setDayName] = useState('');
  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [yearName, setYearName] = useState('');
  const [yearStartDate, setYearStartDate] = useState('');
  const [yearEndDate, setYearEndDate] = useState('');

  const headers = { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) };
  const loadYears = async () => {
    const response = await fetch(apiUrl('/api/academic-years'), { headers });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load academic years.');
    const loaded = Array.isArray(data.academicYears) ? data.academicYears : [];
    setYears(loaded);
    setSelectedYearId((current) => current || loaded.find((year: AcademicYear) => year.is_active || year.status === 'ACTIVE')?.id || loaded[0]?.id || '');
  };
  const loadDays = async (yearId: string) => {
    if (!yearId) { setDays([]); return; }
    const response = await fetch(apiUrl(`/api/program-days?academicYearId=${encodeURIComponent(yearId)}`), { headers });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load programme days.');
    setDays(Array.isArray(data.programDays) ? data.programDays : []);
  };
  useEffect(() => { setLoading(true); loadYears().catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [authToken]);
  useEffect(() => { if (selectedYearId) loadDays(selectedYearId).catch((e) => setError(e.message)); }, [selectedYearId]);

  const openAdd = () => { setEditingDay(null); setDayName(''); setModalOpen(true); setError(''); };
  const openEdit = (day: ProgramDay) => { setEditingDay(day); setDayName(day.day_name); setModalOpen(true); setError(''); };
  const saveDay = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const nextNumber = Math.max(0, ...days.map((day) => day.day_number)) + 1;
      const response = await fetch(apiUrl(editingDay ? `/api/program-days/${editingDay.id}` : '/api/program-days'), {
        method: editingDay ? 'PUT' : 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(editingDay ? { dayName } : { academicYearId: selectedYearId, dayNumber: nextNumber, dayName }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to save day.');
      await loadDays(selectedYearId); setModalOpen(false); setMessage(editingDay ? 'Day updated.' : 'Day added.'); onSetupSaved?.();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save day.'); } finally { setSaving(false); }
  };
  const saveYear = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!yearName.trim() || !yearStartDate || !yearEndDate || yearStartDate >= yearEndDate) {
      setError('Enter a year name and a valid date range.');
      return;
    }
    setSaving(true); setError('');
    try {
      const response = await fetch(apiUrl('/api/academic-years'), {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: yearName.trim(), startDate: yearStartDate, endDate: yearEndDate, isActive: false }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to create academic year.');
      await loadYears();
      if (data.data?.id) { setSelectedYearId(data.data.id); onAcademicYearChange?.(data.data.id); }
      setYearModalOpen(false); setYearName(''); setYearStartDate(''); setYearEndDate(''); setMessage('Academic year created.'); onSetupSaved?.();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create academic year.'); } finally { setSaving(false); }
  };
  const selectedYear = years.find((year) => year.id === selectedYearId);

  return <div className="w-full space-y-7">
    <header className="flex flex-col gap-4 border-b border-border/50 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Academic Setup</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Academic Term</h1></div>
      <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-3 text-sm font-semibold text-foreground"><span>Academic Year</span><select value={selectedYearId} onChange={(e) => { setSelectedYearId(e.target.value); onAcademicYearChange?.(e.target.value); }} className="min-w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"><option value="">Select academic year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{(year.is_active || year.status === 'ACTIVE') ? ' (Active)' : ''}</option>)}</select></label><button type="button" onClick={() => { setYearModalOpen(true); setError(''); }} className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary"><Plus className="h-4 w-4" />Create Academic Year</button></div>
    </header>
    {message && <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />{message}</div>}
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-foreground">8-Day Program</h2><p className="mt-1 text-sm text-muted-foreground">{selectedYear?.name || 'Select an academic year'}</p></div><button type="button" onClick={openAdd} disabled={!selectedYearId || loading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Plus className="h-4 w-4" />Add Day</button></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[...days].sort((a, b) => a.day_number - b.day_number).map((day) => <article key={day.id} className="group flex min-h-44 flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/50"><div><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Day {day.day_number}</span><button type="button" onClick={() => openEdit(day)} className="text-muted-foreground opacity-0 transition group-hover:opacity-100" aria-label={`Edit Day ${day.day_number}`}><Edit3 className="h-4 w-4" /></button></div><h3 className="mt-8 text-lg font-bold leading-snug text-foreground">{day.day_name || 'Name not set'}</h3></div><button type="button" onClick={() => onOpenDay?.(selectedYearId, day.id)} className="mt-5 inline-flex items-center justify-between text-sm font-semibold text-primary">Open day <ArrowRight className="h-4 w-4" /></button></article>)}</div>
    {!loading && selectedYearId && days.length === 0 && <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No days configured for this academic year.</div>}
    {yearModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><form onSubmit={saveYear} className="w-full max-w-md space-y-5 rounded-xl bg-card p-6 shadow-xl"><div className="flex items-center justify-between"><h3 className="text-lg font-bold text-foreground">Create Academic Year</h3><button type="button" onClick={() => setYearModalOpen(false)}><X className="h-5 w-5" /></button></div><div><label className="mb-1 block text-xs font-semibold text-muted-foreground">Academic Year Name</label><input required value={yearName} onChange={(e) => setYearName(e.target.value)} placeholder="2027-2028" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></div><div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-xs font-semibold text-muted-foreground">Start Date</label><input required type="date" value={yearStartDate} onChange={(e) => setYearStartDate(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></div><div><label className="mb-1 block text-xs font-semibold text-muted-foreground">End Date</label><input required type="date" value={yearEndDate} onChange={(e) => setYearEndDate(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></div></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setYearModalOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cancel</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save Academic Year'}</button></div></form></div>}
    {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><form onSubmit={saveDay} className="w-full max-w-md space-y-5 rounded-xl bg-card p-6 shadow-xl"><div className="flex items-center justify-between"><h3 className="text-lg font-bold text-foreground">{editingDay ? 'Edit Day' : 'Add Day'}</h3><button type="button" onClick={() => setModalOpen(false)}><X className="h-5 w-5" /></button></div><div><label className="mb-1 block text-xs font-semibold text-muted-foreground">Day Number</label><input readOnly value={`Day ${editingDay?.day_number || Math.max(0, ...days.map((day) => day.day_number)) + 1}`} className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm" /></div><div><label className="mb-1 block text-xs font-semibold text-muted-foreground">Day Name</label><input autoFocus value={dayName} onChange={(e) => setDayName(e.target.value)} placeholder="Community Leadership" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cancel</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save Day'}</button></div></form></div>}
  </div>;
};
