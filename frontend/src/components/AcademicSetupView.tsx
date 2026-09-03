import React, { useEffect, useState } from 'react';
import { 
  Edit3, 
  Save, 
  Search,
  BookOpen,
  MapPin,
  CheckCircle2
} from './ui/icons';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TqiModule } from '../types';
import { apiUrl } from '../utils/api';

interface AcademicSetupViewProps {
  authToken?: string;
  onSetupSaved?: () => void;
}

export const AcademicSetupView: React.FC<AcademicSetupViewProps> = ({ authToken, onSetupSaved }) => {
  const [modules, setModules] = useState<TqiModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [sessionNames, setSessionNames] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const defaultSuggestedNames: Record<number, { name: string; month: string; description: string; topic: string; location: string }> = {
    1: { 
      name: 'Spoken English & Goal Setting', 
      month: 'February', 
      description: 'Foundational conversational drills, student goal setting and self-confidence building.',
      topic: 'Communication & Life Skills',
      location: 'Panchayat Community Centers'
    },
    2: { 
      name: 'Basic Arithmetic & Logic Puzzles', 
      month: 'February', 
      description: 'Mental math drills, interactive logic puzzles and practical number operations.',
      topic: 'Quantitative & Logical Aptitude',
      location: 'Village Study Hubs'
    },
    3: { 
      name: 'Hands-on Science & Daily Observation', 
      month: 'March', 
      description: 'Simple science experiments, natural observation and curiosity-driven inquiry.',
      topic: 'Applied Physical & Nature Sciences',
      location: 'Panchayat Community Centers'
    },
    4: { 
      name: 'Life Skills, Health & Hygiene', 
      month: 'March', 
      description: 'Personal wellness, sanitation awareness, peer teamwork and emotional resilience.',
      topic: 'Health, Sanitation & Teamwork',
      location: 'Village Study Hubs'
    },
    5: { 
      name: 'Creative Arts & Expression', 
      month: 'March', 
      description: 'Artistic crafts, expressive storytelling, drawing and collaborative group drama.',
      topic: 'Creative & Expressive Arts',
      location: 'Panchayat Community Centers'
    },
    6: { 
      name: 'Digital Literacy & Computer Basics', 
      month: 'April', 
      description: 'Computer fundamentals, typing practice, basic tools and cyber safety habits.',
      topic: 'Digital & Technology Literacy',
      location: 'Cluster Digital Centers'
    },
    7: { 
      name: 'Environment & Community Action', 
      month: 'April', 
      description: 'Tree plantation drives, local water conservation and clean village initiatives.',
      topic: 'Environmental & Social Responsibility',
      location: 'Village Open Grounds'
    },
    8: { 
      name: 'Culmination Showcase & Feedback', 
      month: 'April', 
      description: 'Student project exhibitions, recognition certificates and academic cycle review.',
      topic: 'Showcase & Term Review',
      location: 'Main Cluster Hall'
    },
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch(apiUrl('/api/modules'), {
      signal: controller.signal,
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load academic term.');
        const loadedModules: TqiModule[] = Array.isArray(data.modules) ? data.modules : [];
        setModules(loadedModules);
        const firstYear = loadedModules.find((module) => module.academicYear)?.academicYear;
        if (firstYear) setAcademicYear(firstYear);
        const setupResponse = await fetch(apiUrl('/api/academic-setup'), { 
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} 
        });
        const setupData = await setupResponse.json().catch(() => null);
        if (!setupResponse.ok || !setupData?.success) throw new Error(setupData?.error || `Unable to load session data (${setupResponse.status}).`);
        const setup = Array.isArray(setupData.setup) ? setupData.setup : [];
        const firstSetupYear = setup.find((day: { academic_year?: string }) => day.academic_year)?.academic_year;
        if (firstSetupYear) setAcademicYear(firstSetupYear);
        
        const initialMap: Record<number, string> = {};
        for (let i = 1; i <= 8; i++) {
          const found = setup.find((day: { day_number: number }) => day.day_number === i);
          initialMap[i] = found?.session_name || defaultSuggestedNames[i].name;
        }
        setSessionNames(initialMap);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setErrorMessage(error instanceof Error ? error.message : 'Unable to load academic term.');
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [authToken]);

  const saveSetup = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);
    try {
      const response = await fetch(apiUrl('/api/academic-setup'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ 
          academicYear, 
          days: Array.from({ length: 8 }, (_, index) => ({ 
            dayNumber: index + 1, 
            sessionName: sessionNames[index + 1] || defaultSuggestedNames[index + 1].name 
          })) 
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || `Unable to save academic term (${response.status}).`);
      setSaveMessage('Academic term saved successfully.');
      setIsEditing(false);
      onSetupSaved?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save academic term.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSessionName = (dayNumber: number, sessionName: string) => {
    setSessionNames((current) => ({ ...current, [dayNumber]: sessionName }));
    setSaveMessage(null);
  };

  const filteredDays = Array.from({ length: 8 }, (_, i) => i + 1).filter((dayNum) => {
    const meta = defaultSuggestedNames[dayNum];
    const name = sessionNames[dayNum] || meta.name;
    const query = searchQuery.toLowerCase();
    return (
      name.toLowerCase().includes(query) ||
      meta.month.toLowerCase().includes(query) ||
      meta.topic.toLowerCase().includes(query) ||
      meta.location.toLowerCase().includes(query) ||
      `day ${dayNum}`.includes(query)
    );
  });

  return (
    <div className="w-full space-y-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border/50 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Academic Term
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {academicYear} Academic Term • 8 Curriculum Milestones (Feb – Apr)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isEditing ? (
            <Button 
              onClick={saveSetup} 
              disabled={isLoading || isSaving}
              size="sm"
            >
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

      {/* Search Bar & Edit Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search sessions, topics, locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border border-border/70 rounded-xl pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>

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
      </div>

      {/* Clean Grid of Cards with Proper Text Spacing */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {filteredDays.map((dayNumber) => {
          const meta = defaultSuggestedNames[dayNumber];
          const sessionName = sessionNames[dayNumber] || meta.name;
          const linkedModule = modules.find((m) => m.dayNumber === dayNumber || m.moduleName.toLowerCase().includes(sessionName.toLowerCase()));

          return (
            <Card key={dayNumber} className="flex flex-col justify-between p-6 space-y-4 hover:border-primary/50 transition-colors">
              <CardHeader className="p-0 space-y-3">
                {/* Header Tag */}
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Day 0{dayNumber}</span>
                  <span className="text-primary font-semibold">{meta.month}</span>
                </div>

                {/* Title */}
                {isEditing ? (
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-bold text-foreground outline-none focus:border-primary"
                    value={sessionNames[dayNumber] || ''}
                    placeholder={meta.name}
                    onChange={(e) => updateSessionName(dayNumber, e.target.value)}
                  />
                ) : (
                  <CardTitle className="text-base font-bold text-foreground leading-snug">
                    {sessionName}
                  </CardTitle>
                )}

                {/* Description */}
                <CardDescription className="text-sm text-muted-foreground leading-relaxed">
                  {meta.description}
                </CardDescription>
              </CardHeader>

              {/* Content / Metadata with Proper Spacing */}
              <CardContent className="p-0 pt-3 space-y-2.5 border-t border-border/40">
                {/* Topic */}
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <BookOpen className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate font-medium">{linkedModule?.topic || meta.topic}</span>
                </div>

                {/* Location */}
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">{meta.location}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
