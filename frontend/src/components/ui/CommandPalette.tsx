import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  ArrowUUpLeft,
  ArrowUp,
  ArrowDown,
  Sparkle,
  Compass,
  Users,
  Student,
  CalendarCheck,
  CurrencyInr,
  ShieldCheck,
  MapPin,
  BookOpen,
  FileText,
  Camera,
  Calendar,
  TreeStructure,
  ClipboardText,
  UserCircleCheck,
  Gear,
  Command as CommandIcon,
  CaretRight,
} from './icons';
import { TabType, UserRole } from '../../types';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: TabType) => void;
  currentUserRole?: UserRole | string;
}

interface CommandItem {
  id: string;
  title: string;
  group: 'Navigate' | 'Create' | 'Settings';
  icon: React.ComponentType<any>;
  tab?: TabType;
  hint?: string;
  keywords?: string[];
  roles?: Array<UserRole | string>;
}

const COMMANDS: CommandItem[] = [
  { id: 'go-dashboard', title: 'Go to dashboard', group: 'Navigate', icon: Compass, tab: 'dashboard' },
  { id: 'go-clusters', title: 'Open clusters', group: 'Navigate', icon: TreeStructure, tab: 'clusters', roles: ['Super Admin'] },
  { id: 'go-panchayats', title: 'Panchayats & villages', group: 'Navigate', icon: MapPin, tab: 'panchayats', roles: ['Super Admin', 'Cluster Admin'] },
  { id: 'go-students', title: 'Students', group: 'Navigate', icon: Student, tab: 'students' },
  { id: 'go-volunteers', title: 'Volunteers', group: 'Navigate', icon: Users, tab: 'volunteers' },
  { id: 'go-attendance', title: 'Students attendance', group: 'Navigate', icon: CalendarCheck, tab: 'attendance', keywords: ['log', 'mark', 'students'] },
  { id: 'go-volunteer-attendance', title: 'Volunteer attendance', group: 'Navigate', icon: Users, tab: 'volunteer-attendance', keywords: ['volunteers', 'mentors', 'attendance'] },
  { id: 'go-sessions', title: 'Session scheduling', group: 'Navigate', icon: ClipboardText, tab: 'sessions' },
  { id: 'go-photos', title: 'Session photos', group: 'Navigate', icon: Camera, tab: 'session-photos' },
  { id: 'go-reports', title: 'Session reports', group: 'Navigate', icon: FileText, tab: 'session-reports' },
  { id: 'go-modules', title: 'Module library & PPTs', group: 'Navigate', icon: BookOpen, tab: 'module-library' },
  { id: 'go-lesson', title: 'Lesson plans', group: 'Navigate', icon: FileText, tab: 'lesson-plan' },
  { id: 'go-finance', title: 'Finance & OCR bills', group: 'Navigate', icon: CurrencyInr, tab: 'finance', keywords: ['expense', 'bill'] },
  { id: 'go-statement', title: 'Finance statements', group: 'Navigate', icon: FileText, tab: 'finance-statement', roles: ['Super Admin', 'Cluster Admin'] },
  { id: 'go-approvals', title: 'Approval center', group: 'Navigate', icon: ShieldCheck, tab: 'approvals', keywords: ['review', 'pending'] },
  { id: 'go-submissions', title: 'Session submissions', group: 'Navigate', icon: ClipboardText, tab: 'session-submissions' },
  { id: 'go-analytics', title: 'Analytics & reports', group: 'Navigate', icon: FileText, tab: 'reports' },
  { id: 'go-users', title: 'User & role management', group: 'Navigate', icon: UserCircleCheck, tab: 'users', roles: ['Super Admin'] },
  { id: 'go-audit', title: 'Audit & governance trail', group: 'Navigate', icon: FileText, tab: 'audit-logs', roles: ['Super Admin'] },
  { id: 'go-academic', title: 'Academic term (8-day)', group: 'Navigate', icon: Calendar, tab: 'academic-setup', roles: ['Super Admin'] },
  { id: 'go-settings', title: 'Settings & profile', group: 'Navigate', icon: Gear, tab: 'settings' },
];

function fuzzyMatch(query: string, item: CommandItem): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  const t = item.title.toLowerCase();
  if (t.startsWith(q)) return 100;
  if (t.includes(q)) return 50;
  if (item.keywords?.some((k) => k.includes(q))) return 30;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 5 : 0;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onNavigate,
  currentUserRole,
}) => {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previousOverflowRef = useRef<string>('');

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
      previousOverflowRef.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = previousOverflowRef.current;
    }
    return () => {
      document.body.style.overflow = previousOverflowRef.current;
    };
  }, [open]);

  const results = useMemo(() => {
    const role = currentUserRole as string | undefined;
    return COMMANDS
      .filter((c) => !c.roles || (role && c.roles.includes(role)))
      .map((c) => ({ item: c, score: fuzzyMatch(query, c) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [query, currentUserRole]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof results> = {};
    for (const r of results) {
      if (!map[r.item.group]) map[r.item.group] = [];
      map[r.item.group].push(r);
    }
    return map;
  }, [results]);

  const flat = useMemo(() => {
    const arr: { item: CommandItem; flatIdx: number }[] = [];
    let i = 0;
    for (const r of results) {
      arr.push({ item: r.item, flatIdx: i });
      i++;
    }
    return arr;
  }, [results]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const choice = flat[activeIdx]?.item;
        if (choice?.tab) {
          onNavigate(choice.tab);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flat, activeIdx, onClose, onNavigate]);

  if (!open) return null;

  let runningFlat = -1;
  return (
    <div
      className="tqi-palette-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="tqi-palette"
        role="dialog"
        aria-label="Command palette"
        style={{
          background:
            'color-mix(in srgb, var(--card) 88%, transparent)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          boxShadow:
            '0 1px 0 color-mix(in srgb, var(--text-on-brand) 8%, transparent) inset, 0 32px 80px -24px rgba(15, 23, 42, 0.4)',
          animation:
            'tqi-palette-in var(--dur-medium, 480ms) var(--ease-out-expo) both',
        }}
      >
        <div
          className="tqi-palette-input-row"
          style={{
            borderBottom: '1px solid var(--border-subtle)',
            padding: '14px 16px',
          }}
        >
          <Search
            size={16}
            weight="light"
            className="shrink-0"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            ref={inputRef}
            type="text"
            className="tqi-palette-input"
            placeholder="Search views, actions, settings…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--text)',
            }}
          />
          <span
            className="tqi-kbd"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 22,
              padding: '0 7px',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              background:
                'color-mix(in srgb, var(--surface) 70%, transparent)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
            }}
          >
            ESC
          </span>
        </div>

        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto custom-scrollbar py-1"
        >
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <span
                className="inline-flex items-center justify-center mb-3"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background:
                    'color-mix(in srgb, var(--brand) 12%, transparent)',
                  color: 'var(--brand)',
                }}
              >
                <Sparkle size={20} weight="light" />
              </span>
              <p
                className="text-[14px] font-semibold"
                style={{ color: 'var(--text)' }}
              >
                No matches for &ldquo;{query}&rdquo;
              </p>
              <p
                className="text-[12px] mt-1"
                style={{ color: 'var(--text-muted)' }}
              >
                Try a view name like &ldquo;attendance&rdquo; or
                &ldquo;approvals&rdquo;.
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="tqi-palette-section-label">{group}</div>
                {items.map(({ item }) => {
                  runningFlat++;
                  const isActive = runningFlat === activeIdx;
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      data-active={isActive}
                      className="tqi-palette-item"
                      onMouseEnter={() => setActiveIdx(runningFlat)}
                      onClick={() => {
                        if (item.tab) {
                          onNavigate(item.tab);
                          onClose();
                        }
                      }}
                      style={{
                        margin: '0 6px',
                        padding: '8px 10px',
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        transition:
                          'background var(--dur-fast) var(--ease-out-quart)',
                        background: isActive
                          ? 'color-mix(in srgb, var(--brand) 10%, transparent)'
                          : 'transparent',
                      }}
                    >
                      <span
                        className="inline-flex items-center justify-center shrink-0"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: isActive
                            ? 'var(--brand)'
                            : 'color-mix(in srgb, var(--surface) 80%, transparent)',
                          color: isActive
                            ? 'var(--text-on-brand)'
                            : 'var(--text-secondary)',
                          transition:
                            'background var(--dur-fast) var(--ease-out-quart)',
                        }}
                      >
                        <Icon size={14} weight="light" />
                      </span>
                      <span
                        className="tqi-palette-item-title flex-1 text-left truncate"
                        style={{
                          fontSize: 13,
                          fontWeight: isActive ? 600 : 500,
                          color: isActive ? 'var(--text)' : 'var(--text-secondary)',
                        }}
                      >
                        {item.title}
                      </span>
                      {isActive && (
                        <span
                          className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[9.5px] font-semibold tracking-wider uppercase"
                          style={{
                            color: 'var(--brand)',
                            background:
                              'color-mix(in srgb, var(--brand) 12%, transparent)',
                          }}
                        >
                          <ArrowUUpLeft size={10} weight="bold" /> open
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          className="tqi-palette-footer"
          style={{
            borderTop: '1px solid var(--border-subtle)',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'var(--text-muted)',
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          <div
            className="tqi-palette-keys"
            style={{ display: 'flex', alignItems: 'center', gap: 14 }}
          >
            <span
              className="inline-flex items-center gap-1"
              style={{ letterSpacing: '0.02em' }}
            >
              <ArrowUp size={11} weight="bold" />
              <ArrowDown size={11} weight="bold" />
              navigate
            </span>
            <span
              className="inline-flex items-center gap-1"
              style={{ letterSpacing: '0.02em' }}
            >
              <ArrowUUpLeft size={11} weight="bold" /> open
            </span>
          </div>
          <span
            className="inline-flex items-center gap-1.5"
            style={{ letterSpacing: '0.04em' }}
          >
            <CommandIcon size={11} weight="bold" /> Command palette
          </span>
        </div>
      </div>
    </div>
  );
};
