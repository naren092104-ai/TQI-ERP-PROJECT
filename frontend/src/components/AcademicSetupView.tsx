import React, { useEffect, useState } from 'react';
import {
  Edit3,
  Save,
  BookOpen,
  MapPin,
  CheckCircle2,
  Calendar,
  Plus,
} from './ui/icons';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TqiModule } from '../types';
import { apiUrl } from '../utils/api';

interface AcademicSetupViewProps {
  authToken?: string;
  onSetupSaved?: () => void;
}

interface DayEntry {
  sessionName: string;
  topic: string;
  location: string;
  sessionDate: string; // DD-MM-YY
}

// Format a YYYY-MM-DD string as DD-MM-YY.
const formatDateDDMMYY = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}-${m[2]}-${m[3].slice(0, 2)}`;
  return '';
};

// Parse a DD-MM-YY string back into YYYY-MM-DD for the native date input.
const parseDDMMYY = (input: string): string => {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  const m = trimmed.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  if (m) return `20${m[3]}-${m[2]}-${m[1]}`;
  const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return trimmed;
  return '';
};

const emptyDay = (): DayEntry => ({ sessionName: '', topic: '', location: '', sessionDate: '' });

export const AcademicSetupView: React.FC<AcademicSetupViewProps> = ({ authToken, onSetupSaved }) => {
  const [modules, setModules] = useState<TqiModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState('2026-2027');
  // Day 1 always exists. Days 2..8 are added on demand via the "Add Day" button.
  const [days, setDays] = useState<DayEntry[]>([emptyDay()]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [modulesRes, setupRes] = await Promise.all([
          fetch(apiUrl('/api/modules'), {
            signal: controller.signal,
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          }),
          fetch(apiUrl('/api/academic-setup'), {
            signal: controller.signal,
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          }),
        ]);

        const modulesData = await modulesRes.json().catch(() => null);
        if (modulesRes.ok && modulesData?.success) {
          setModules(Array.isArray(modulesData.modules) ? modulesData.modules : []);
        }

        const setupData = await setupRes.json().catch(() => null);
        if (!setupRes.ok || !setupData?.success) {
          throw new Error(setupData?.error || `Unable to load session data (${setupRes.status}).`);
        }
        const setup = Array.isArray(setupData.setup) ? setupData.setup : [];
        const firstYear = setup.find((day: { academic_year?: string }) => day.academic_year)?.academic_year;
        if (firstYear) setAcademicYear(firstYear);

        // Build day entries from the API rows that have data. The first day is
        // always shown even if blank — everything else only appears if the
        // Super Admin created it.
        const filled: DayEntry[] = [emptyDay()];
        for (let i = 2; i <= 8; i++) {
          const row = setup.find((day: { day_number: number }) => day.day_number === i);
          if (row && (row.session_name || row.session_date)) {
            filled.push({
              sessionName: row.session_name || '',
              topic: '',
              location: '',
              sessionDate: formatDateDDMMYY(row.session_date),
            });
          }
        }
        setDays(filled);
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load academic term.');
        }
      } finally {
        setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [authToken]);

  const saveSetup = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);
    try {
      // Persist the visible day slots in order (Day 1 first, then any extras).
      const payloadDays = days.map((day, index) => ({
        dayNumber: index + 1,
        sessionName: day.sessionName.trim(),
        topic: day.topic.trim(),
        location: day.location.trim(),
        sessionDate: day.sessionDate.trim() || null,
      }));
      const response = await fetch(apiUrl('/api/academic-setup'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ academicYear, days: payloadDays }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Unable to save academic term (${response.status}).`);
      }
      setSaveMessage('Academic term saved successfully.');
      setIsEditing(false);
      onSetupSaved?.();
    } catch (error: any) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save academic term.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateDay = (index: number, patch: Partial<DayEntry>) => {
    setDays((current) => current.map((day, i) => (i === index ? { ...day, ...patch } : day)));
    setSaveMessage(null);
  };

  const addDay = () => {
    if (days.length >= 8) return;
    setDays((current) => [...current, emptyDay()]);
  };

  const removeDay = (index: number) => {
    // Day 1 cannot be removed.
    if (index === 0) return;
    setDays((current) => current.filter((_, i) => i !== index));
    setSaveMessage(null);
  };

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border/50 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Academic Term
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {academicYear} • {days.length} {days.length === 1 ? 'Day' : 'Days'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isEditing ? (
            <Button onClick={saveSetup} disabled={isLoading || isSaving} size="sm">
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'Saving...' : 'Save Term'}</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setIsEditing(true); setSaveMessage(null); }}
              disabled={isLoading}
            >
              <Edit3 className="h-4 w-4" />
              <span>Edit Term</span>
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive">
          {errorMessage}
        </div>
      )}

      {saveMessage && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Year input (only visible in edit mode) */}
      {isEditing && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Academic Year:</span>
          <input
            className="bg-transparent border border-border/70 rounded-lg px-3 py-1.5 text-sm font-semibold text-foreground outline-none focus:border-primary"
            value={academicYear}
            placeholder="2026-2027"
            onChange={(e) => { setAcademicYear(e.target.value); setSaveMessage(null); }}
          />
        </div>
      )}

      {/* Day cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {days.map((day, index) => {
          const dayNumber = index + 1;
          const linkedModule = modules.find((m) => m.dayNumber === dayNumber);

          return (
            <Card key={dayNumber} className="flex flex-col justify-between p-6 space-y-4 hover:border-primary/50 transition-colors">
              <CardHeader className="p-0 space-y-3">
                {/* Day label */}
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Day {String(dayNumber).padStart(2, '0')}</span>
                  {isEditing && dayNumber > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDay(index)}
                      className="text-[10px] font-medium text-error-500 hover:text-error-600"
                      aria-label={`Remove Day ${dayNumber}`}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Title */}
                {isEditing ? (
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-bold text-foreground outline-none focus:border-primary"
                    value={day.sessionName}
                    placeholder="Session title"
                    onChange={(e) => updateDay(index, { sessionName: e.target.value })}
                  />
                ) : (
                  <CardTitle className="text-base font-bold text-foreground leading-snug">
                    {day.sessionName || 'Untitled session'}
                  </CardTitle>
                )}
              </CardHeader>

              <CardContent className="p-0 pt-3 space-y-2.5 border-t border-border/40">
                {/* Date (DD-MM-YY) */}
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <Calendar className="h-4 w-4 text-brand-500 shrink-0" />
                  {isEditing ? (
                    <div className="flex flex-1 items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="DD-MM-YY"
                        maxLength={8}
                        value={day.sessionDate}
                        onChange={(e) => updateDay(index, { sessionDate: e.target.value })}
                        className="w-[88px] rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-primary tabular-nums"
                        aria-label={`Date for Day ${dayNumber}`}
                      />
                      <input
                        type="date"
                        value={parseDDMMYY(day.sessionDate)}
                        onChange={(e) => updateDay(index, { sessionDate: e.target.value })}
                        className="rounded-md border border-border bg-background px-1.5 py-1 text-xs text-foreground outline-none focus:border-primary [color-scheme:light_dark]"
                        aria-label={`Calendar picker for Day ${dayNumber}`}
                      />
                    </div>
                  ) : (
                    <span className="truncate font-medium tabular-nums text-foreground/80">
                      {day.sessionDate || 'Date not set'}
                    </span>
                  )}
                </div>

                {/* Topic */}
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <BookOpen className="h-4 w-4 text-primary shrink-0" />
                  {isEditing ? (
                    <input
                      type="text"
                      placeholder="Topic"
                      value={day.topic}
                      onChange={(e) => updateDay(index, { topic: e.target.value })}
                      className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
                      aria-label={`Topic for Day ${dayNumber}`}
                    />
                  ) : (
                    <span className="truncate font-medium">{day.topic || (linkedModule?.topic ?? '')}</span>
                  )}
                </div>

                {/* Location */}
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  {isEditing ? (
                    <input
                      type="text"
                      placeholder="Location"
                      value={day.location}
                      onChange={(e) => updateDay(index, { location: e.target.value })}
                      className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
                      aria-label={`Location for Day ${dayNumber}`}
                    />
                  ) : (
                    <span className="truncate">{day.location || '—'}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Day button (edit mode only, max 8) */}
      {isEditing && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={addDay}
            disabled={days.length >= 8}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-transparent px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-brand-400 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Day {days.length + 1}
          </button>
        </div>
      )}
    </div>
  );
};
