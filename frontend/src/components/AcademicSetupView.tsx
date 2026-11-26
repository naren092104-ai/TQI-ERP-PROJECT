import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Plus,
  Trash2,
  X,
} from './ui/icons';
import { apiUrl } from '../utils/api';
import { AcademicYear } from '../types';
import { AcademicSessionIllustration, ACADEMIC_SESSION_NAMES } from './AcademicSessionIllustration';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Modal } from './ui/modal';

interface AcademicSetupViewProps {
  userRole?: 'Super Admin' | 'Cluster Admin';
  authToken?: string;
  isYearsLoading?: boolean;
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

const DAY_COUNT = ACADEMIC_SESSION_NAMES.length;
const currentCalendarYear = new Date().getFullYear();
const createDefaultDays = (): DayDraft[] =>
  Array.from({ length: DAY_COUNT }, (_, index) => ({
    dayNumber: index + 1,
    sessionName: ACADEMIC_SESSION_NAMES[index],
  }));

const resolveSessionName = (dayNumber: number, storedName?: string | null): string => {
  const standardName = ACADEMIC_SESSION_NAMES[dayNumber - 1];
  const normalized = String(storedName || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
  if (!normalized) return standardName || '';
  if (!standardName) return String(storedName).trim();
  if (normalized === standardName.toLocaleLowerCase('en')) return standardName;
  if (dayNumber === 1 && normalized === 'can do workshop') return standardName;
  if (dayNumber === 2 && normalized === 'know ur locality') return standardName;
  return String(storedName).trim();
};

const normalizeAcademicYearName = (value?: string): string => {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/[–—]/g, '-');
};

const buildAcademicYearDates = (startYear: string, endYear: string) => ({
  startDate: `${String(startYear || currentCalendarYear).trim()}-05-31`,
  endDate: `${String(endYear || currentCalendarYear + 1).trim()}-05-30`,
});

const formatAcademicYearLabel = (year?: string): string => {
  const normalized = normalizeAcademicYearName(year);
  return normalized || 'Academic Year';
};

const getAcademicYearStart = (year?: string): number => {
  const match = normalizeAcademicYearName(year).match(/^(\d{4})-/);
  return match ? Number(match[1]) : 0;
};

export const AcademicSetupView: React.FC<AcademicSetupViewProps> = ({
  userRole = 'Super Admin',
  authToken,
  isYearsLoading = false,
  academicYears = [],
  selectedAcademicYearId,
  onSelectAcademicYear,
  onSetupSaved,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [creationResult, setCreationResult] = useState<{ id: string; name: string } | null>(null);
  const [setupRows, setSetupRows] = useState<Array<{ day_number: number; academic_year: string; session_name: string | null; session_date?: string | null }>>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [transferTargetYear, setTransferTargetYear] = useState<AcademicYear | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'day'>('create');
  const [editingAcademicYearId, setEditingAcademicYearId] = useState('');
  const [isEditingDay, setIsEditingDay] = useState<number | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [copyMode, setCopyMode] = useState<'fresh' | 'copy'>('fresh');
  const [copyFromYearId, setCopyFromYearId] = useState('');
  const [copySelections, setCopySelections] = useState({
    sessionPlan: true,
    clusters: true,
    panchayatsVillages: true,
    schools: true,
    students: true,
    volunteers: true,
    moduleLibrary: true,
    lessonPlans: true,
    attendanceHistory: false,
    sessionReports: false,
    sessionPhotos: false,
    financeRecords: false,
  });
  const [yearDraft, setYearDraft] = useState({
    startYear: String(currentCalendarYear),
    endYear: String(currentCalendarYear + 1),
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
  const isSelectedYearReadOnly = String(selectedAcademicYear?.status || '').toUpperCase() === 'ARCHIVED';
  const canManageAcademicYears = userRole !== 'Cluster Admin';

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
      if (dayIndex < 0) return;
      const entry = { dayNumber: dayIndex + 1, sessionName: resolveSessionName(dayIndex + 1, row.session_name) || `Session Day ${dayIndex + 1}` };
      if (dayIndex < base.length) base[dayIndex] = entry;
      else base.push(entry);
    });

    return base.sort((left, right) => left.dayNumber - right.dayNumber);
  }, [selectedAcademicYearName, setupRows]);

  const showYearDrawer = (mode: 'create' | 'edit', initialYear?: AcademicYear | null) => {
    const existingStartYears = academicYears
      .map((year) => Number(normalizeAcademicYearName(year.name).split('-')[0]))
      .filter(Number.isFinite);
    const nextStartYear = existingStartYears.length
      ? Math.max(...existingStartYears) + 1
      : currentCalendarYear;
    const activeName = normalizeAcademicYearName(initialYear?.name || '');
    const yearParts = activeName.split('-').map((part) => part.trim()).filter(Boolean);
    const startYear = mode === 'create' ? String(nextStartYear) : yearParts[0] || String(currentCalendarYear);
    const endYear = mode === 'create' ? String(nextStartYear + 1) : yearParts[1] || String(currentCalendarYear + 1);

    const days = createDefaultDays().map((item, index) => {
      const matching = currentDayEntries[index];
      const sessionName = matching?.sessionName && matching.sessionName !== 'Session not assigned' ? matching.sessionName : '';
      return { ...item, sessionName };
    });

    setDrawerMode(mode);
    setEditingAcademicYearId(mode === 'edit' ? initialYear?.id || '' : '');
    setWizardStep(1);
    setCopyMode('fresh');
    setCopyFromYearId(academicYears.find((year) => year.id !== initialYear?.id)?.id || '');
    setYearDraft({
      startYear,
      endYear,
      isActive: mode === 'create' ? false : Boolean(initialYear?.isActive),
      days,
    });
    setIsEditingDay(null);
    setIsDrawerOpen(true);
  };

  const openDayEditor = (dayNumber: number) => {
    if (!canManageAcademicYears) return;
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

  const addSessionDay = () => {
    if (!canManageAcademicYears || isSelectedYearReadOnly) return;
    const nextDayNumber = Math.max(0, ...currentDayEntries.map((day) => day.dayNumber)) + 1;
    const nextDays = [...currentDayEntries, { dayNumber: nextDayNumber, sessionName: `Session Day ${nextDayNumber}` }];
    setDrawerMode('day');
    setIsEditingDay(nextDayNumber);
    setYearDraft((current) => ({ ...current, days: nextDays }));
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setIsEditingDay(null);
    setEditingAcademicYearId('');
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

    const editingYear = academicYears.find((year) => year.id === editingAcademicYearId);
    if (!isDayEdit && yearDraft.isActive && (drawerMode === 'create' || !editingYear?.isActive) && !window.confirm(`Set ${normalizedYearName} as the active academic year? The current active year will become a draft.`)) {
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
            status: yearDraft.isActive ? 'ACTIVE' : 'DRAFT',
            copyMode,
            copyFromYearId: copyMode === 'copy' ? copyFromYearId : undefined,
            copySelections,
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
      } else if (drawerMode === 'edit' && editingAcademicYearId) {
        const updateRes = await fetch(apiUrl(`/api/academic-years/${editingAcademicYearId}`), {
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
        const payloadDays = yearDraft.days.map((day) => ({
          dayNumber: day.dayNumber,
          sessionName: (day.sessionName || '').trim(),
          sessionDate: setupRows.find((row) => Number(row.day_number) === day.dayNumber && normalizeAcademicYearName(row.academic_year) === normalizedYearName)?.session_date || null,
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

        setSetupRows((currentRows) => [
          ...currentRows.filter((row) => normalizeAcademicYearName(row.academic_year) !== normalizedYearName),
          ...payloadDays.map((day) => ({
            day_number: day.dayNumber,
            academic_year: normalizedYearName,
            session_name: day.sessionName || null,
            session_date: day.sessionDate,
          })),
        ]);
      }

      if (drawerMode === 'create' && targetYearId) {
        setCreationResult({ id: targetYearId, name: normalizedYearName });
        closeDrawer();
        onSetupSaved?.();
        return;
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

  const openTransferDialog = (year: AcademicYear) => {
    const sourceYears = academicYears
      .filter((candidate) => candidate.id !== year.id && getAcademicYearStart(candidate.name) < getAcademicYearStart(year.name))
      .sort((left, right) => getAcademicYearStart(right.name) - getAcademicYearStart(left.name));
    setCopyFromYearId(sourceYears[0]?.id || '');
    setCopySelections({
      sessionPlan: canManageAcademicYears,
      clusters: true,
      panchayatsVillages: true,
      schools: true,
      students: true,
      volunteers: true,
      moduleLibrary: canManageAcademicYears,
      lessonPlans: true,
      attendanceHistory: false,
      sessionReports: false,
      sessionPhotos: false,
      financeRecords: false,
    });
    setTransferTargetYear(year);
  };

  const copyDataToAcademicYear = async () => {
    if (!transferTargetYear || !copyFromYearId) {
      setToast({ type: 'error', message: 'Select a source academic year.' });
      return;
    }
    if (!window.confirm(`Copy the selected data into ${transferTargetYear.name}? The source academic year will remain unchanged.`)) return;
    setIsTransferring(true);
    try {
      const response = await fetch(apiUrl(`/api/academic-years/${transferTargetYear.id}/copy-data`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ copyFromYearId, copySelections }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to copy academic year data.');
      setTransferTargetYear(null);
      setToast({ type: 'success', message: `Selected data copied to ${transferTargetYear.name}.` });
      onSetupSaved?.();
    } catch (error: any) {
      setToast({ type: 'error', message: error?.message || 'Unable to copy academic year data.' });
    } finally {
      setIsTransferring(false);
    }
  };

  const deleteAcademicYear = async (year: AcademicYear) => {
    const activeNotice = year.isActive ? ' Another available academic year will be activated automatically.' : '';
    if (!window.confirm(`Permanently delete ${year.name} and all data belonging to it?${activeNotice} This cannot be undone.`)) return;
    try {
      const response = await fetch(apiUrl(`/api/academic-years/${year.id}`), {
        method: 'DELETE',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to delete academic year.');
      setToast({ type: 'success', message: `${year.name} and its associated data were deleted.` });
      onSetupSaved?.();
    } catch (error: any) {
      setToast({ type: 'error', message: error?.message || 'Unable to delete academic year.' });
    }
  };

  const activateAcademicYear = async (year: AcademicYear) => {
    if (!window.confirm(`Set ${year.name} as the active academic year? The current active year will become a draft.`)) return;
    try {
      const response = await fetch(apiUrl(`/api/academic-years/${year.id}/activate`), {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to activate academic year.');
      onSelectAcademicYear?.(year.id);
      setToast({ type: 'success', message: `${year.name} is now active.` });
      onSetupSaved?.();
    } catch (error: any) {
      setToast({ type: 'error', message: error?.message || 'Unable to activate academic year.' });
    }
  };

  if (!academicYears.length) {
    return (
      <div className="w-full space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Home › Academic Year</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Academic Year Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create, manage and switch between academic years. Each academic year has its own independent data.</p>
        </div>
        {isYearsLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => <div key={index} className="animate-pulse rounded-2xl border border-border bg-white p-5"><div className="h-5 w-28 rounded bg-slate-200" /><div className="mt-4 h-4 w-40 rounded bg-slate-100" /><div className="mt-5 h-16 rounded bg-slate-100" /></div>)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center shadow-sm">
            <BookOpen className="mx-auto h-8 w-8 text-[#0B3D91]" />
            <h2 className="mt-4 text-xl font-bold text-foreground">No Academic Years Found</h2>
            <p className="mt-2 text-sm text-muted-foreground">Create your first academic year to start managing TQI sessions.</p>
            {canManageAcademicYears && <button type="button" onClick={() => showYearDrawer('create')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0B3D91] px-4 py-2.5 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> Create Academic Year
            </button>}
            {!canManageAcademicYears && <p className="mt-3 text-sm text-muted-foreground">The Super Admin manages new academic-year creation. Cluster Admin can only copy data into the active year.</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Home › Academic Year</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Academic Year Management</h1>
            <p className="mt-1 text-sm text-muted-foreground">{canManageAcademicYears ? 'Create, manage and switch between academic years. Each academic year has its own independent data.' : 'View academic years and copy your cluster data from a previous year into the active year.'}</p>
          </div>
          {canManageAcademicYears && <button type="button" onClick={() => showYearDrawer('create')} className="inline-flex items-center gap-2 rounded-xl bg-[#0B3D91] px-4 py-2.5 text-sm font-semibold text-white shadow-sm">
            <Plus className="h-4 w-4" /> Create Academic Year
          </button>}
        </div>

        {academicYears.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center">
            <h2 className="text-lg font-bold">No Academic Years Found</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create your first academic year to start managing TQI sessions.</p>
            <button type="button" onClick={() => showYearDrawer('create')} className="mt-4 rounded-xl bg-[#0B3D91] px-4 py-2 text-sm font-semibold text-white">+ Create Academic Year</button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {academicYears.map((year) => {
              const status = String(year.status || (year.isActive ? 'ACTIVE' : 'DRAFT')).toUpperCase();
              const isSelected = year.id === selectedAcademicYearId;
              const createdLabel = year.createdAt ? new Date(year.createdAt).toLocaleDateString() : 'Date unavailable';
              const metricItems = [
                ['Sessions', year.sessionCount], ['Clusters', year.clusterCount], ['Schools', year.schoolCount],
                ['Students', year.studentCount], ['Volunteers', year.volunteerCount],
              ];
              return (
                <article key={year.id} className={`rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${isSelected ? 'border-[#0B3D91]/40 ring-1 ring-[#0B3D91]/10' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-bold text-[#0B3D91]">{year.name.replace('-', ' – ')}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : status === 'ARCHIVED' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'}`}>{status}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Created {createdLabel}</p>
                  <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    {metricItems.map(([label, value]) => <div key={label} className="flex justify-between gap-1"><span className="text-muted-foreground">{label}</span><strong>{Number(value || 0)}</strong></div>)}
                  </div>
                  <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                    <button type="button" onClick={() => onSelectAcademicYear?.(year.id)} className="flex-1 rounded-lg border border-[#0B3D91]/15 bg-blue-50 px-3 py-2 text-xs font-semibold text-[#0B3D91]">{isSelected ? 'View Details' : 'View Details'}</button>
                    {status !== 'ARCHIVED' && <button type="button" onClick={() => onSelectAcademicYear?.(year.id)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${isSelected ? 'bg-[#0B3D91] text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{isSelected ? 'Open Year ✓' : 'Open Year'}</button>}
                    {canManageAcademicYears && status === 'DRAFT' && <button type="button" onClick={() => void activateAcademicYear(year)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">Activate</button>}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {canManageAcademicYears && status !== 'ARCHIVED' && <button type="button" onClick={() => showYearDrawer('edit', year)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-[#0B3D91]/30 hover:text-[#0B3D91]"><Edit3 className="h-3.5 w-3.5" />Edit</button>}
                    {canManageAcademicYears && status === 'DRAFT' && <button type="button" onClick={() => openTransferDialog(year)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-[#0B3D91]/30 hover:text-[#0B3D91]"><ClipboardList className="h-3.5 w-3.5" />Copy Data</button>}
                    {!canManageAcademicYears && status === 'ACTIVE' && <button type="button" onClick={() => openTransferDialog(year)} disabled={!academicYears.some((candidate) => getAcademicYearStart(candidate.name) < getAcademicYearStart(year.name))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-[#0B3D91]/30 hover:text-[#0B3D91] disabled:cursor-not-allowed disabled:opacity-50"><ClipboardList className="h-3.5 w-3.5" />Copy Previous Year</button>}
                    {canManageAcademicYears && <button type="button" title="Permanently delete academic year and its data" onClick={() => void deleteAcademicYear(year)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" />Delete</button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

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
          <p className="mt-2 text-sm text-muted-foreground">Manage {currentDayEntries.length} session days for this academic year. Add more days whenever the programme needs them.</p>
          {isSelectedYearReadOnly && <span className="mt-2 inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700">Read Only · Archived</span>}
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
            <p className="mt-1 text-sm text-muted-foreground">{currentDayEntries.length} Days • 1 Session per Day</p>
          </div>
          {canManageAcademicYears && <button
            type="button"
            onClick={addSessionDay}
            disabled={isSelectedYearReadOnly}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3D91] px-3 py-2 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          ><Plus className="h-4 w-4" />Add Day</button>}
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
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_16px_30px_rgba(15,23,42,0.12)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  <AcademicSessionIllustration dayNumber={day.dayNumber} />
                  <span className="absolute left-3 top-3 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0B3D91] shadow-sm">
                    Day {String(day.dayNumber).padStart(2, '0')}
                  </span>
                </div>

                <div className="flex min-h-[92px] flex-col justify-between gap-3 p-3.5">
                  <h3 className="font-serif text-sm font-bold uppercase leading-snug tracking-wide text-slate-800">
                    {day.sessionName || ACADEMIC_SESSION_NAMES[day.dayNumber - 1]}
                  </h3>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => openDayEditor(day.dayNumber)}
                      disabled={!canManageAcademicYears || isSelectedYearReadOnly}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:border-[#0B3D91]/20 hover:text-[#0B3D91] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      {canManageAcademicYears ? 'View / Edit' : 'View'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {canManageAcademicYears && isDrawerOpen && (
        <Modal
          isOpen={isDrawerOpen}
          onClose={isSaving ? () => undefined : closeDrawer}
          size="lg"
          title={drawerMode === 'create' ? 'Create Academic Year' : drawerMode === 'day' ? `Edit Day ${String(isEditingDay).padStart(2, '0')}` : 'Edit Academic Year'}
          subtitle={drawerMode === 'day' ? `Session plan · ${selectedAcademicYearName}` : 'Academic year'}
          sheetOnMobile
          className="tqi-modal-no-fullscreen max-h-[92vh] max-w-[700px] rounded-2xl border-slate-200 bg-white shadow-2xl"
        >
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (drawerMode === 'create' && wizardStep < 3) {
                if (wizardStep === 2 && copyMode === 'copy' && !copyFromYearId) {
                  setErrorMessage('Select the source academic year to copy from.');
                  return;
                }
                setErrorMessage(null);
                setWizardStep((step) => Math.min(3, step + 1));
                return;
              }
              void saveAcademicYear();
            }}
          >
            {drawerMode === 'create' && (
              <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                {[['1', 'Basic details'], ['2', 'Copy data'], ['3', 'Review']].map(([step, label], index) => (
                  <React.Fragment key={step}>
                    <div className={`flex items-center gap-1.5 ${wizardStep === index + 1 ? 'text-[#0B3D91]' : ''}`}>
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${wizardStep >= index + 1 ? 'border-[#0B3D91] bg-[#0B3D91] text-white' : 'border-slate-300'}`}>{step}</span>
                      <span>{label}</span>
                    </div>
                    {index < 2 && <span className="h-px flex-1 bg-slate-200" />}
                  </React.Fragment>
                ))}
              </div>
            )}

            {drawerMode !== 'day' && (drawerMode !== 'create' || wizardStep === 1) && (
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

            {drawerMode !== 'day' && (drawerMode !== 'create' || wizardStep === 1) && <div className="space-y-3">
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
                  Draft
                </label>
              </div>
            </div>}

            {drawerMode === 'create' && wizardStep === 2 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold text-foreground">How do you want to create this academic year?</h4>
                  <p className="mt-1 text-xs text-muted-foreground">Choose whether to start empty or copy selected data into an independent year.</p>
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
                  <input type="radio" name="copy-mode" checked={copyMode === 'fresh'} onChange={() => setCopyMode('fresh')} />
                  <span><strong className="block text-sm">Start Fresh</strong><span className="text-xs text-muted-foreground">Create an empty academic year with its eight session days.</span></span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
                  <input type="radio" name="copy-mode" checked={copyMode === 'copy'} onChange={() => setCopyMode('copy')} />
                  <span><strong className="block text-sm">Copy From Existing Academic Year</strong><span className="text-xs text-muted-foreground">Copy selected configuration and master data; the source remains unchanged.</span></span>
                </label>
                {copyMode === 'copy' && (
                  <>
                    <div className="space-y-1">
                      <span className="block text-xs font-semibold">Copy From</span>
                      <Select value={copyFromYearId} onValueChange={(val) => setCopyFromYearId(val)}>
                        <SelectTrigger className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal">
                          <SelectValue placeholder="Select source year" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 rounded-xl border border-slate-200 bg-white shadow-lg">
                          {academicYears.filter((year) => year.id !== selectedAcademicYearId).map((year) => (
                            <SelectItem key={year.id} value={year.id}>{year.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <h5 className="text-sm font-semibold">Select Data to Copy</h5>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {([
                          ['sessionPlan', 'Session Plan (8 Days)'], ['clusters', 'Clusters'], ['panchayatsVillages', 'Panchayats & Villages'],
                          ['schools', 'Schools'], ['students', 'Students'], ['volunteers', 'Volunteers'], ['moduleLibrary', 'Module Library'],
                          ['lessonPlans', 'Lesson Plans'], ['attendanceHistory', 'Attendance History'], ['sessionReports', 'Session Reports'],
                          ['sessionPhotos', 'Session Photos'], ['financeRecords', 'Finance Records'],
                        ] as const).map(([key, label]) => (
                          <label key={key} className="flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={copySelections[key]} onChange={(event) => setCopySelections((current) => ({ ...current, [key]: event.target.checked }))} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {drawerMode === 'create' && wizardStep === 3 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{copyMode === 'copy' ? 'Source' : 'Setup'}</p>
                  <p className="mt-1 font-bold">{copyMode === 'copy' ? academicYears.find((year) => year.id === copyFromYearId)?.name || 'Select a source' : 'Start Fresh'}</p>
                  <p className="my-2 text-[#0B3D91]">↓</p>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Target</p>
                  <p className="mt-1 text-lg font-bold">{yearDraft.startYear}–{yearDraft.endYear}</p>
                </div>
                {copyMode === 'copy' && <div className="space-y-1 rounded-xl border border-slate-200 p-3 text-xs">
                  <h5 className="mb-2 font-semibold">Selected data</h5>
                  {Object.entries(copySelections).filter(([, selected]) => selected).map(([key]) => <p key={key} className="text-emerald-700">✓ {key.replace(/([A-Z])/g, ' $1')}</p>)}
                  <p className="mt-2 text-amber-800">Copied data will belong to the new year. Changes in it will not affect the source year.</p>
                </div>}
              </div>
            )}

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
              {drawerMode === 'create' && wizardStep > 1 && (
                <button type="button" onClick={() => setWizardStep((step) => Math.max(1, step - 1))} className="mr-auto rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground">
                  Back
                </button>
              )}
              <button type="button" onClick={closeDrawer} className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-xl bg-[#0B3D91] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving
                  ? 'Creating...'
                  : drawerMode === 'day'
                    ? 'Save Session Day'
                    : drawerMode === 'create' && wizardStep < 3
                      ? 'Continue'
                      : drawerMode === 'create'
                        ? 'Create Academic Year'
                        : 'Save Academic Year'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {creationResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-6 w-6" /></div>
            <h3 className="mt-4 text-center text-lg font-bold">Academic Year {creationResult.name} created</h3>
            <p className="mt-2 text-center text-sm text-muted-foreground">{copyMode === 'copy' ? 'Selected data was copied into an independent year. The source was not changed.' : 'The new year is ready. Its session plan is initialized for eight days.'}</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setCreationResult(null)} className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold">Stay on Current Year</button>
              <button type="button" onClick={() => { onSelectAcademicYear?.(creationResult.id); setCreationResult(null); }} className="flex-1 rounded-xl bg-[#0B3D91] px-3 py-2.5 text-sm font-semibold text-white">Open Year</button>
            </div>
          </div>
        </div>
      )}

      {transferTargetYear && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold">Copy Data to {transferTargetYear.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">Choose a previous academic year and the data to copy. The source stays unchanged; Cluster Admin copies only their cluster into the active year.</p>
              </div>
              <button type="button" onClick={() => setTransferTargetYear(null)} className="rounded-lg border border-border p-2 text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-5 space-y-1">
              <span className="block text-sm font-semibold">Copy From</span>
              <Select value={copyFromYearId} onValueChange={(val) => setCopyFromYearId(val)}>
                <SelectTrigger className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal">
                  <SelectValue placeholder="Select source year" />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-xl border border-slate-200 bg-white shadow-lg">
                  {academicYears.filter((year) => year.id !== transferTargetYear.id && (!canManageAcademicYears ? getAcademicYearStart(year.name) < getAcademicYearStart(transferTargetYear.name) : true)).map((year) => (
                    <SelectItem key={year.id} value={year.id}>{year.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 p-3">
              <h4 className="text-sm font-semibold">Select Data to Copy</h4>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([
                  ['sessionPlan', 'Session Plan (8 Days)'], ['clusters', 'Clusters'], ['panchayatsVillages', 'Panchayats & Villages'],
                  ['schools', 'Schools'], ['students', 'Students'], ['volunteers', 'Volunteers'], ['moduleLibrary', 'Module Library'],
                  ['lessonPlans', 'Lesson Plans'], ['attendanceHistory', 'Attendance History'], ['sessionReports', 'Session Reports'],
                  ['sessionPhotos', 'Session Photos'], ['financeRecords', 'Finance Records'],
                ] as const).filter(([key]) => canManageAcademicYears || (key !== 'sessionPlan' && key !== 'moduleLibrary')).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={copySelections[key]} disabled={!canManageAcademicYears && key === 'clusters'} onChange={(event) => setCopySelections((current) => ({ ...current, [key]: event.target.checked }))} />
                    {!canManageAcademicYears && key === 'clusters' ? 'Keep my assigned cluster' : label}
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setTransferTargetYear(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium">Cancel</button>
              <button type="button" onClick={() => void copyDataToAcademicYear()} disabled={isTransferring || !copyFromYearId} className="rounded-xl bg-[#0B3D91] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{isTransferring ? 'Copying…' : 'Copy Selected Data'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
