import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Edit3,
  Plus,
  Save,
  X,
  Calendar,
  Clock,
  Archive,
  Play,
  Check,
  Trash2,
} from './ui/icons';
import { apiUrl } from '../utils/api';
import Badge from './ui/badge';

interface AcademicYear {
  id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  status?: 'ACTIVE' | 'UPCOMING' | 'COMPLETED' | 'ARCHIVED' | string;
}

interface ProgramDay {
  id: string;
  academic_year_id: string;
  day_number: number;
  day_name: string;
  status: string;
}

interface AcademicSetupViewProps {
  authToken?: string;
  selectedAcademicYearId?: string;
  onSetupSaved?: () => void;
  onOpenDay?: (academicYearId: string, dayId: string) => void;
  onAcademicYearChange?: (academicYearId: string) => void;
}

export const AcademicSetupView: React.FC<AcademicSetupViewProps> = ({
  authToken,
  selectedAcademicYearId,
  onSetupSaved,
  onOpenDay,
  onAcademicYearChange,
}) => {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState(selectedAcademicYearId || '');
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Modals
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<ProgramDay | null>(null);
  const [dayName, setDayName] = useState('');

  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [yearName, setYearName] = useState('');
  const [yearStartDate, setYearStartDate] = useState('');
  const [yearEndDate, setYearEndDate] = useState('');

  const headers = {
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    'Content-Type': 'application/json',
  };

  const loadYears = async () => {
    const response = await fetch(apiUrl('/api/academic-years'), { headers });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load academic years.');
    const loaded = Array.isArray(data.academicYears) ? data.academicYears : [];
    setYears(loaded);
    const active = loaded.find((y: AcademicYear) => y.is_active || y.status === 'ACTIVE');
    const defaultId = selectedAcademicYearId || active?.id || loaded[0]?.id || '';
    if (!selectedYearId && defaultId) {
      setSelectedYearId(defaultId);
    }
  };

  const loadDays = async (yearId: string) => {
    if (!yearId) {
      setDays([]);
      return;
    }
    const response = await fetch(
      apiUrl(`/api/program-days?academicYearId=${encodeURIComponent(yearId)}`),
      { headers }
    );
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load program days.');
    setDays(Array.isArray(data.programDays) ? data.programDays : []);
  };

  useEffect(() => {
    setLoading(true);
    loadYears()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [authToken, selectedAcademicYearId]);

  useEffect(() => {
    if (selectedAcademicYearId && selectedAcademicYearId !== selectedYearId) {
      setSelectedYearId(selectedAcademicYearId);
    }
  }, [selectedAcademicYearId]);

  useEffect(() => {
    if (selectedYearId) {
      loadDays(selectedYearId).catch((e) => setError(e.message));
    }
  }, [selectedYearId]);

  // Day Handlers
  const openAddDay = () => {
    setEditingDay(null);
    setDayName('');
    setDayModalOpen(true);
    setError('');
  };

  const openEditDay = (day: ProgramDay) => {
    setEditingDay(day);
    setDayName(day.day_name);
    setDayModalOpen(true);
    setError('');
  };

  const handleSaveDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYearId) {
      setError('Please select an Academic Year first.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const nextNumber = Math.max(0, ...days.map((d) => d.day_number)) + 1;
      const response = await fetch(
        apiUrl(editingDay ? `/api/program-days/${editingDay.id}` : '/api/program-days'),
        {
          method: editingDay ? 'PUT' : 'POST',
          headers,
          body: JSON.stringify(
            editingDay
              ? { dayName: dayName.trim() }
              : { academicYearId: selectedYearId, dayNumber: nextNumber, dayName: dayName.trim() }
          ),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to save program day.');

      await loadDays(selectedYearId);
      setDayModalOpen(false);
      setMessage(editingDay ? 'Program day updated.' : 'Program day added.');
      onSetupSaved?.();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Unable to save program day.');
    } finally {
      setSaving(false);
    }
  };

  // Year Handlers
  const openCreateYear = () => {
    setEditingYear(null);
    setYearName('');
    setYearStartDate('');
    setYearEndDate('');
    setYearModalOpen(true);
    setError('');
  };

  const openEditYear = (year: AcademicYear) => {
    setEditingYear(year);
    setYearName(year.name);
    setYearStartDate(year.start_date || '');
    setYearEndDate(year.end_date || '');
    setYearModalOpen(true);
    setError('');
  };

  const handleSaveYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yearName.trim() || !yearStartDate || !yearEndDate) {
      setError('Enter academic year name and valid date range.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = editingYear ? `/api/academic-years/${editingYear.id}` : '/api/academic-years';
      const method = editingYear ? 'PUT' : 'POST';
      const response = await fetch(apiUrl(url), {
        method,
        headers,
        body: JSON.stringify({
          name: yearName.trim(),
          startDate: yearStartDate,
          endDate: yearEndDate,
          isActive: editingYear ? editingYear.is_active : false,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to save academic year.');

      await loadYears();
      if (data.data?.id) {
        setSelectedYearId(data.data.id);
        onAcademicYearChange?.(data.data.id);
      }
      setYearModalOpen(false);
      setMessage(editingYear ? 'Academic year updated.' : 'Academic year created.');
      onSetupSaved?.();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save academic year.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateYearStatus = async (year: AcademicYear, status: string) => {
    setSaving(true);
    try {
      const isActive = status === 'ACTIVE';
      const response = await fetch(apiUrl(`/api/academic-years/${year.id}`), {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          ...year,
          status,
          isActive,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Status update failed.');
      await loadYears();
      setMessage(`Academic year marked as ${status}.`);
      onSetupSaved?.();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update academic year status.');
    } finally {
      setSaving(false);
    }
  };

  const selectedYear = years.find((y) => y.id === selectedYearId);
  const sortedDays = [...days].sort((a, b) => a.day_number - b.day_number);

  return (
    <div className="w-full space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Academic Term &amp; 8-Day Setup
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage academic years, active program timeline, and 8-day curriculum configuration.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateYear}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs hover:bg-brand-dark transition-colors self-start sm:self-auto"
        >
          <Plus size={14} />
          <span>Create Academic Year</span>
        </button>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          <X size={15} className="shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Academic Year Management Table */}
      <div className="rounded-md border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Academic Years</h2>
            <p className="text-xs text-muted-foreground">
              Lifecycle status and scheduling parameters for academic cycles
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {years.length} {years.length === 1 ? 'Year' : 'Years'} Registered
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left">
                <th className="pb-2 font-medium">Academic Year</th>
                <th className="pb-2 font-medium">Start Date</th>
                <th className="pb-2 font-medium">End Date</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {years.map((year) => {
                const isActive = year.is_active || year.status === 'ACTIVE';
                const isSelected = year.id === selectedYearId;

                return (
                  <tr
                    key={year.id}
                    className={`hover:bg-surface-hover transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="py-2.5 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedYearId(year.id);
                            onAcademicYearChange?.(year.id);
                          }}
                          className="font-semibold hover:text-primary hover:underline text-left"
                        >
                          {year.name}
                        </button>
                        {isSelected && (
                          <Badge variant="default" size="sm" className="text-[10px]">
                            Selected
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 text-muted-foreground">{year.start_date || '—'}</td>
                    <td className="py-2.5 text-muted-foreground">{year.end_date || '—'}</td>
                    <td className="py-2.5">
                      <Badge
                        variant={
                          isActive
                            ? 'success'
                            : year.status === 'COMPLETED'
                            ? 'default'
                            : year.status === 'ARCHIVED'
                            ? 'secondary'
                            : 'warning'
                        }
                        size="sm"
                      >
                        {isActive ? 'Active' : year.status || 'Upcoming'}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditYear(year)}
                          className="inline-flex h-7 px-2 items-center gap-1 rounded border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                          title="Edit Dates & Name"
                        >
                          <Edit3 size={12} />
                          <span>Edit</span>
                        </button>
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => handleUpdateYearStatus(year, 'ACTIVE')}
                            disabled={saving}
                            className="inline-flex h-7 px-2 items-center gap-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            title="Set as Active Year"
                          >
                            <Play size={11} />
                            <span>Start</span>
                          </button>
                        )}
                        {isActive && (
                          <button
                            type="button"
                            onClick={() => handleUpdateYearStatus(year, 'COMPLETED')}
                            disabled={saving}
                            className="inline-flex h-7 px-2 items-center gap-1 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                            title="Mark as Completed"
                          >
                            <Check size={12} />
                            <span>Complete</span>
                          </button>
                        )}
                        {year.status !== 'ARCHIVED' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateYearStatus(year, 'ARCHIVED')}
                            disabled={saving}
                            className="inline-flex h-7 px-2 items-center gap-1 rounded border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                            title="Archive Year"
                          >
                            <Archive size={12} />
                            <span>Archive</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {years.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                    No academic years configured. Click &ldquo;Create Academic Year&rdquo; to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. 8-Day Program Day Configuration */}
      <div className="rounded-md border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">8-Day Program Cycle</h2>
              {selectedYear && (
                <Badge variant="default" size="sm">
                  {selectedYear.name}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Curriculum milestone days. Only configured days appear below.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddDay}
            disabled={!selectedYearId || loading || days.length >= 8}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs hover:bg-brand-dark disabled:opacity-50 transition-colors self-start sm:self-auto"
          >
            <Plus size={14} />
            <span>Add Program Day</span>
          </button>
        </div>

        {/* Days Grid - Only Configured Days */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {sortedDays.map((day) => (
            <div
              key={day.id}
              className="group flex flex-col justify-between p-4 rounded-md border border-border bg-card hover:border-border-strong hover:bg-surface-hover transition-colors shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary tracking-wide">
                    Day {day.day_number}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditDay(day)}
                    className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-surface-hover hover:text-foreground opacity-80 group-hover:opacity-100 transition-opacity"
                    aria-label={`Edit Day ${day.day_number}`}
                  >
                    <Edit3 size={13} />
                  </button>
                </div>

                <h3 className="mt-3 text-sm font-semibold text-foreground leading-snug">
                  {day.day_name && day.day_name.trim() ? day.day_name : 'Name not set'}
                </h3>
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {day.status || 'Active'}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenDay?.(selectedYearId, day.id)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <span>Open Day</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {sortedDays.length === 0 && !loading && selectedYearId && (
          <div className="py-12 text-center rounded-md border border-dashed border-border mt-3 text-xs text-muted-foreground">
            No program days configured for {selectedYear?.name || 'this academic year'}. Click &ldquo;Add Program Day&rdquo; to set up Day 1.
          </div>
        )}
      </div>

      {/* Modal: Create / Edit Academic Year */}
      {yearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveYear}
            className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-semibold text-foreground">
                {editingYear ? 'Edit Academic Year' : 'Create Academic Year'}
              </h3>
              <button
                type="button"
                onClick={() => setYearModalOpen(false)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Academic Year Name *
              </label>
              <input
                required
                value={yearName}
                onChange={(e) => setYearName(e.target.value)}
                placeholder="2025–2026"
                className="h-9 w-full rounded-md border border-border bg-card px-3 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Start Date *</label>
                <input
                  required
                  type="date"
                  value={yearStartDate}
                  onChange={(e) => setYearStartDate(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-card px-3 text-xs text-foreground focus:outline-none focus:border-primary shadow-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">End Date *</label>
                <input
                  required
                  type="date"
                  value={yearEndDate}
                  onChange={(e) => setYearEndDate(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-card px-3 text-xs text-foreground focus:outline-none focus:border-primary shadow-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setYearModalOpen(false)}
                className="h-8 px-3 rounded-md border border-border text-xs font-medium text-foreground hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3.5 text-xs font-medium text-primary-foreground shadow-xs hover:bg-brand-dark disabled:opacity-50"
              >
                <Save size={13} />
                <span>{saving ? 'Saving...' : 'Save Academic Year'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Add / Edit Program Day */}
      {dayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveDay}
            className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-semibold text-foreground">
                {editingDay ? `Edit Day ${editingDay.day_number}` : 'Add Program Day'}
              </h3>
              <button
                type="button"
                onClick={() => setDayModalOpen(false)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Day Number
              </label>
              <input
                readOnly
                value={`Day ${
                  editingDay?.day_number || Math.max(0, ...days.map((d) => d.day_number)) + 1
                }`}
                className="h-9 w-full rounded-md border border-border bg-muted/50 px-3 text-xs font-semibold text-muted-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Day Name (Theme / Topic)
              </label>
              <input
                autoFocus
                value={dayName}
                onChange={(e) => setDayName(e.target.value)}
                placeholder="e.g. Spoken English &amp; Goal Setting"
                className="h-9 w-full rounded-md border border-border bg-card px-3 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Leave blank to display &ldquo;Name not set&rdquo;. Day number is preserved separately.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setDayModalOpen(false)}
                className="h-8 px-3 rounded-md border border-border text-xs font-medium text-foreground hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3.5 text-xs font-medium text-primary-foreground shadow-xs hover:bg-brand-dark disabled:opacity-50"
              >
                <Save size={13} />
                <span>{saving ? 'Saving...' : 'Save Day'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

