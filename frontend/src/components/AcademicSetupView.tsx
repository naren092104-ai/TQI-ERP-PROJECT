import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Edit3,
  Plus,
  X,
} from './ui/icons';
import { apiUrl } from '../utils/api';
import { AcademicYear } from '../types';

interface AcademicSetupViewProps {
  authToken?: string;
  academicYears?: AcademicYear[];
  selectedAcademicYearId?: string;
  onSelectAcademicYear?: (id: string) => void;
  onSetupSaved?: () => void;
}

interface DayDraft {
  dayNumber: number;
  sessionName: string;
}

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

const DAY_COUNT = 8;
const createDefaultDays = (): DayDraft[] =>
  Array.from({ length: DAY_COUNT }, (_, index) => ({
    dayNumber: index + 1,
    sessionName: '',
  }));

const normalizeAcademicYearName = (value?: string): string => {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/[–—]/g, '-');
};

const buildAcademicYearDates = (startYear: string, endYear: string) => ({
  startDate: `${String(startYear || '2026').trim()}-05-31`,
  endDate: `${String(endYear || '2027').trim()}-05-30`,
});

const formatAcademicYearLabel = (year?: string): string => {
  const normalized = normalizeAcademicYearName(year);
  return normalized || 'Academic Year';
};

export const AcademicSetupView: React.FC<AcademicSetupViewProps> = ({
  authToken,
  academicYears = [],
  selectedAcademicYearId,
  onSelectAcademicYear,
  onSetupSaved,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [setupRows, setSetupRows] = useState<Array<{ day_number: number; academic_year: string; session_name: string | null }>>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'day'>('create');
  const [isEditingDay, setIsEditingDay] = useState<number | null>(null);
  const [yearDraft, setYearDraft] = useState({
    startYear: '2026',
    endYear: '2027',
    isActive: true,
    days: createDefaultDays(),
  });

  const selectedAcademicYear = useMemo(() => {
    if (!academicYears.length) return null;
    if (selectedAcademicYearId) {
      return academicYears.find((year) => year.id === selectedAcademicYearId) || academicYears[0];
    }
    return academicYears[0];
  }, [academicYears, selectedAcademicYearId]);

  const selectedAcademicYearName = normalizeAcademicYearName(selectedAcademicYear?.name || '');

  useEffect(() => {
    if (!selectedAcademicYearId && academicYears.length) {
      onSelectAcademicYear?.(academicYears[0].id);
    }
  }, [academicYears, selectedAcademicYearId, onSelectAcademicYear]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const controller = new AbortController();

    const loadData = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [setupRes] = await Promise.all([
          fetch(apiUrl('/api/academic-setup'), {
            signal: controller.signal,
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          }),
        ]);

        const setupData = await setupRes.json().catch(() => null);
        if (!setupRes.ok || !setupData?.success) {
          throw new Error(setupData?.error || 'Unable to load academic year setup.');
        }

        setSetupRows(Array.isArray(setupData.setup) ? setupData.setup : []);
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          setErrorMessage(error?.message || 'Unable to load academic year data.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    return () => controller.abort();
  }, [authToken, selectedAcademicYearId]);

  const currentDayEntries = useMemo(() => {
    const base = createDefaultDays();
    if (!selectedAcademicYearName) return base;

    const matchingRows = setupRows.filter((row) => normalizeAcademicYearName(row.academic_year) === selectedAcademicYearName);
    matchingRows.forEach((row) => {
      const dayIndex = Number(row.day_number || 0) - 1;
      if (dayIndex >= 0 && dayIndex < DAY_COUNT) {
        base[dayIndex] = {
          dayNumber: dayIndex + 1,
          sessionName: row.session_name && row.session_name.trim() ? row.session_name.trim() : 'Session not assigned',
        };
      }
    });

    return base;
  }, [selectedAcademicYearName, setupRows]);

  const showYearDrawer = (mode: 'create' | 'edit', initialYear?: AcademicYear | null) => {
    const activeName = normalizeAcademicYearName(initialYear?.name || selectedAcademicYearName);
    const yearParts = activeName.split('-').map((part) => part.trim()).filter(Boolean);
    const startYear = yearParts[0] || '2026';
    const endYear = yearParts[1] || '2027';

    const days = createDefaultDays().map((item, index) => {
      const matching = currentDayEntries[index];
      const sessionName = matching?.sessionName && matching.sessionName !== 'Session not assigned' ? matching.sessionName : '';
      return { ...item, sessionName };
    });

    setDrawerMode(mode);
    setYearDraft({
      startYear,
      endYear,
      isActive: initialYear ? Boolean(initialYear.isActive) : true,
      days,
    });
    setIsEditingDay(null);
    setIsDrawerOpen(true);
  };

  const openDayEditor = (dayNumber: number) => {
    setDrawerMode('day');
    setIsEditingDay(dayNumber);
    setYearDraft({
      startYear: yearDraft.startYear,
      endYear: yearDraft.endYear,
      isActive: Boolean(selectedAcademicYear?.isActive),
      days: currentDayEntries.map((item) => ({
        ...item,
        sessionName: item.sessionName === 'Session not assigned' ? '' : item.sessionName,
      })),
    });
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setIsEditingDay(null);
  };

  const saveAcademicYear = async () => {
    const isDayEdit = drawerMode === 'day';
    const normalizedYearName = isDayEdit
      ? selectedAcademicYearName
      : `${yearDraft.startYear.trim()}-${yearDraft.endYear.trim()}`;
    if (!isDayEdit && (!yearDraft.startYear.trim() || !yearDraft.endYear.trim())) {
      setErrorMessage('Academic year start and end years are required.');
      return;
    }

    if (!isDayEdit && Number(yearDraft.startYear) >= Number(yearDraft.endYear)) {
      setErrorMessage('The end year must be greater than the start year.');
      return;
    }

    const duplicateExists = academicYears.some((year) => normalizeAcademicYearName(year.name) === normalizedYearName);
    if (drawerMode === 'create' && duplicateExists) {
      setErrorMessage('This academic year already exists.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const { startDate, endDate } = buildAcademicYearDates(yearDraft.startYear, yearDraft.endYear);
      let targetYearId = selectedAcademicYearId || academicYears[0]?.id || '';

      if (drawerMode === 'create') {
        const createRes = await fetch(apiUrl('/api/academic-years'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            name: normalizedYearName,
            startDate,
            endDate,
            isActive: yearDraft.isActive,
          }),
        });

        const createData = await createRes.json().catch(() => null);
        if (!createRes.ok || !createData?.success) {
          if (createRes.status === 409 || /already exists/i.test(createData?.error || '')) {
            throw new Error('This academic year already exists.');
          }
          throw new Error(createData?.error || 'Unable to create academic year.');
        }

        targetYearId = createData?.data?.id || targetYearId;
      } else if (drawerMode === 'edit' && selectedAcademicYearId) {
        const updateRes = await fetch(apiUrl(`/api/academic-years/${selectedAcademicYearId}`), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            name: normalizedYearName,
            startDate,
            endDate,
            isActive: yearDraft.isActive,
          }),
        });

        const updateData = await updateRes.json().catch(() => null);
        if (!updateRes.ok || !updateData?.success) {
          throw new Error(updateData?.error || 'Unable to update academic year.');
        }
      }

      if (isDayEdit) {
        const payloadDays = yearDraft.days.map((day, index) => ({
          dayNumber: index + 1,
          sessionName: (day.sessionName || '').trim(),
          sessionDate: null,
        }));

        const saveRes = await fetch(apiUrl('/api/academic-setup'), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            academicYear: normalizedYearName,
            days: payloadDays,
          }),
        });

        const saveData = await saveRes.json().catch(() => null);
        if (!saveRes.ok || !saveData?.success) {
          throw new Error(saveData?.error || 'Unable to save session day.');
        }
      }

      if (drawerMode === 'create' && targetYearId) {
        onSelectAcademicYear?.(targetYearId);
      }

      setToast({
        type: 'success',
        message: drawerMode === 'create'
          ? 'Academic year created successfully.'
          : isDayEdit
            ? `Day ${String(isEditingDay).padStart(2, '0')} updated successfully.`
            : 'Academic year updated successfully.',
      });
      closeDrawer();
      onSetupSaved?.();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Unable to save academic year.');
      setToast({ type: 'error', message: error?.message || 'Unable to save academic year.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDayDraftChange = (dayNumber: number, value: string) => {
    setYearDraft((current) => ({
      ...current,
      days: current.days.map((day) => (day.dayNumber === dayNumber ? { ...day, sessionName: value } : day)),
    }));
  };

  if (!academicYears.length && !isLoading) {
    return (
      <div className="w-full rounded-3xl border border-dashed border-border bg-white/70 p-10 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0B3D91]/10 text-[#0B3D91]">
          <BookOpen className="h-5 w-5" />
        </div>
        <h2 className="mt-5 text-xl font-bold text-foreground">No academic year yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">Create an academic year to set up the 8-day session plan.</p>
        <button
          type="button"
          onClick={() => showYearDrawer('create')}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0B3D91] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" />
          Add Academic Year
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span>Home</span>
            <span>›</span>
            <span>Academic Year</span>
            <span>›</span>
            <span className="text-[#0B3D91]">{formatAcademicYearLabel(selectedAcademicYearName)}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Academic Year — {formatAcademicYearLabel(selectedAcademicYearName)}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage the 8 session days for this academic year.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => showYearDrawer('edit', selectedAcademicYear)}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#0B3D91]/40"
          >
            <Edit3 className="h-4 w-4 text-[#0B3D91]" />
            Edit Academic Year
          </button>
          <button
            type="button"
            onClick={() => showYearDrawer('create')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0B3D91] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" />
            Add Academic Year
          </button>
        </div>
      </div>

      {toast && (
        <div className={`fixed right-5 top-5 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="rounded-3xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">Session Plan</h2>
            <p className="mt-1 text-sm text-muted-foreground">8 Days • 1 Session per Day</p>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-[18px] border border-border bg-slate-100 p-4">
                <div className="h-7 w-20 rounded-full bg-slate-200" />
                <div className="mt-5 h-8 w-2/3 rounded bg-slate-200" />
                <div className="mt-8 h-8 w-24 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {currentDayEntries.map((day) => (
              <div
                key={day.dayNumber}
                className="group rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_30px_rgba(15,23,42,0.08)]"
                style={{
                  background: `linear-gradient(135deg, ${[
                    '#F7F9FF',
                    '#FFF9F1',
                    '#F5FBF8',
                    '#F9F4FF',
                    '#F6F8FF',
                    '#FFF9F3',
                    '#F5FBFF',
                    '#FFF7F5',
                  ][day.dayNumber - 1]} 0%, #FFFFFF 100%)`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center rounded-full border border-[#0B3D91]/10 bg-[#0B3D91]/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0B3D91]">
                    Day {String(day.dayNumber).padStart(2, '0')}
                  </span>
                </div>

                <div className="mt-5 min-h-[96px] flex items-center">
                  <p className="text-xl font-bold text-slate-900 leading-snug">
                    {day.sessionName || 'Session not assigned'}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => openDayEditor(day.dayNumber)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:border-[#0B3D91]/20 hover:text-[#0B3D91]"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    View / Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px]">
          <div className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-border bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {drawerMode === 'day' ? `Session plan · ${selectedAcademicYearName}` : 'Academic year'}
                </p>
                <h3 className="mt-1 text-xl font-bold text-foreground">
                  {drawerMode === 'create'
                    ? 'Add Academic Year'
                    : drawerMode === 'day'
                      ? `Edit Day ${String(isEditingDay).padStart(2, '0')}`
                      : 'Edit Academic Year'}
                </h3>
              </div>
              <button type="button" onClick={closeDrawer} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 p-5">
              {drawerMode !== 'day' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Academic Year</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      min="2000"
                      max="2100"
                      value={yearDraft.startYear}
                      onChange={(e) => setYearDraft((current) => ({ ...current, startYear: e.target.value }))}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#0B3D91]"
                    />
                    <input
                      type="number"
                      min="2000"
                      max="2100"
                      value={yearDraft.endYear}
                      onChange={(e) => setYearDraft((current) => ({ ...current, endYear: e.target.value }))}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#0B3D91]"
                    />
                  </div>
                </div>
              )}

              {drawerMode !== 'day' && <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Status</label>
                <div className="flex items-center gap-6">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="year-status"
                      checked={yearDraft.isActive}
                      onChange={() => setYearDraft((current) => ({ ...current, isActive: true }))}
                    />
                    Active
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="year-status"
                      checked={!yearDraft.isActive}
                      onChange={() => setYearDraft((current) => ({ ...current, isActive: false }))}
                    />
                    Inactive
                  </label>
                </div>
              </div>}

              {drawerMode === 'day' && <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-foreground">{drawerMode === 'day' ? `Day ${String(isEditingDay).padStart(2, '0')} session` : 'Session Plan'}</h4>
                  {drawerMode !== 'day' && <span className="text-xs font-medium text-muted-foreground">{DAY_COUNT} Days</span>}
                </div>

                <div className="space-y-3">
                  {yearDraft.days.filter((day) => drawerMode !== 'day' || day.dayNumber === isEditingDay).map((day) => (
                    <div key={day.dayNumber} className="grid grid-cols-[72px_1fr] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#0B3D91]">Day {String(day.dayNumber).padStart(2, '0')}</span>
                      <input
                        type="text"
                        value={day.sessionName}
                        onChange={(e) => handleDayDraftChange(day.dayNumber, e.target.value)}
                        placeholder="Enter session name"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0B3D91]"
                      />
                    </div>
                  ))}
                </div>
              </div>}

              <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
                <button type="button" onClick={closeDrawer} className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveAcademicYear}
                  disabled={isSaving}
                  className="rounded-xl bg-[#0B3D91] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? 'Saving...' : drawerMode === 'day' ? 'Save Session Day' : drawerMode === 'create' ? 'Create Academic Year' : 'Save Academic Year'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
