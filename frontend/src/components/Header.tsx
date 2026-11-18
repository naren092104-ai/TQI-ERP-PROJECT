import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  CaretDown,
  SignOut,
  UserCircle,
  Check,
  Command,
  Menu,
  Sparkle,
  Gear,
  Question,
  X,
  Lightning,
  ArrowRight,
  CheckCircle,
  CalendarBlank,
} from './ui/icons';
import { NotificationItem, UserRole, TabType } from '../types';
import { ModeToggle } from './mode-toggle';
import Badge from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface HeaderProps {
  userEmail?: string;
  userName?: string;
  userRole?: UserRole;
  clusters: any[];
  selectedClusterId: string;
  onSelectCluster: (clusterId: string) => void;
  notifications: NotificationItem[];
  pendingApprovalsCount?: number;
  onNavigate: (tab: TabType, targetId?: string) => void;
  onLogout?: () => void;
  onRoleChange?: (role: UserRole) => void;
  onToggleSidebar?: () => void;
  onOpenCommandPalette?: () => void;
  maintenance?: { enabled: boolean; title: string; message: string; expectedCompletion: string | null; showCountdown: boolean; autoDisable: boolean } | null;
  onManageMaintenance?: () => void;
  academicYears?: Array<{ id: string; name: string; is_active?: boolean; status?: string }>;
  selectedAcademicYearId?: string;
  onSelectAcademicYear?: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  userEmail = 'admin@tqierp.org',
  userName = 'Admin User',
  userRole = 'Super Admin',
  clusters = [],
  selectedClusterId = 'all',
  onSelectCluster,
  notifications = [],
  pendingApprovalsCount = 0,
  onNavigate,
  onLogout,
  onToggleSidebar,
  onOpenCommandPalette,
  maintenance = null,
  onManageMaintenance,
  academicYears = [],
  selectedAcademicYearId = '',
  onSelectAcademicYear,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    if (mobileSearchOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileSearchOpen]);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K is owned by App.tsx — it toggles the global
      // CommandPalette. Header does not register its own Ctrl+K handler.
      if (e.key === 'Escape') {
        setShowNotifications(false);
        setShowProfileMenu(false);
        if (searchFocused) {
          setSearchQuery('');
          setSearchFocused(false);
          searchRef.current?.blur();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchFocused]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const quickSearchItems = [
    { label: 'Dashboard', tab: 'dashboard' as TabType, category: 'Overview' },
    { label: 'Academic setup (8-day cycle)', tab: 'academic-setup' as TabType, category: 'Curriculum' },
    { label: 'Students attendance', tab: 'attendance' as TabType, category: 'Operations' },
    { label: 'Students', tab: 'students' as TabType, category: 'Roster' },
    { label: 'Volunteers', tab: 'volunteers' as TabType, category: 'Roster' },
    { label: 'Finance & OCR bill verification', tab: 'finance' as TabType, category: 'Finance' },
    { label: 'Approval center', tab: 'approvals' as TabType, category: 'Governance' },
    { label: 'Module library & PPTs', tab: 'module-library' as TabType, category: 'Curriculum' },
    { label: 'Panchayats & villages', tab: 'panchayats' as TabType, category: 'Operations' },
  ];

  const filteredSearch = quickSearchItems.filter(
    (item) =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const grouped = filteredSearch.reduce<Record<string, typeof quickSearchItems>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <>
      {/* Google Admin Console Style Top Header */}
      <header className="tqi-app-header sticky top-0 z-30 w-full h-16 border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
        {/* Left: mobile toggle + Google style search */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="lg:hidden flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle navigation"
          >
            <Menu size={20} />
          </button>

          {/* Google Admin Style Global Search (tablet+) */}
          <div
            ref={searchContainerRef}
            className={`relative w-full max-w-lg hidden sm:flex items-center gap-3 h-10 rounded-full border transition-all px-3.5 ${
              searchFocused
                ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-slate-900 shadow-sm'
                : 'border-transparent bg-slate-100 hover:bg-slate-200/60 dark:bg-slate-800/80 dark:hover:bg-slate-800'
            }`}
          >
            <Search size={16} className="shrink-0 text-slate-500 dark:text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search in ERP (users, students, sessions, clusters...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 font-sans"
            />
            <kbd className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 text-[10px] font-mono text-slate-500">
              <Command size={10} />K
            </kbd>

            {searchFocused && searchQuery && (
              <div
                className="absolute left-0 right-0 top-[46px] rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 py-2.5 max-h-96 overflow-y-auto custom-scrollbar shadow-xl z-50"
              >
                {Object.keys(grouped).length > 0 ? (
                  Object.entries(grouped).map(([cat, items]) => (
                    <div key={cat} className="px-2">
                      <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {cat}
                      </div>
                      {items.map((item) => (
                        <button
                          key={item.tab}
                          type="button"
                          onClick={() => {
                            onNavigate(item.tab);
                            setSearchQuery('');
                            setSearchFocused(false);
                          }}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                        >
                          <span className="truncate">{item.label}</span>
                          <CaretDown size={12} className="-rotate-90 text-slate-400" />
                        </button>
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-xs text-slate-500">
                    No records matching &ldquo;{searchQuery}&rdquo;.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Academic Year, Notifications, Mode, User profile */}
        <div className="tqi-header-actions flex items-center gap-2 shrink-0">
          {userRole === 'Super Admin' && maintenance?.enabled && (
            <button
              type="button"
              onClick={() => onManageMaintenance?.()}
              className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-red-700 shadow-sm hover:bg-red-100"
            >
              <span className="h-2 w-2 rounded-full bg-red-600" />
              Maintenance Mode
            </button>
          )}
          {/* Global Academic Year Selector */}
          <div className="tqi-header-year relative">
            <Select
              value={selectedAcademicYearId || ''}
              onValueChange={(val) => {
                if (val && onSelectAcademicYear) {
                  onSelectAcademicYear(val);
                }
              }}
            >
              <SelectTrigger
                className="h-9 w-[195px] sm:w-[210px] rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-850 px-3.5 text-xs font-medium text-slate-800 dark:text-slate-100 shadow-xs hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                title="Select an academic year to view data for that cycle"
              >
                <div className="flex items-center gap-2 truncate">
                  <CalendarBlank size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <SelectValue placeholder="Select Academic Year" />
                </div>
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                sideOffset={6}
                className="w-[195px] sm:w-[210px] rounded-2xl border border-slate-200/90 bg-white dark:border-slate-700 dark:bg-slate-900 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-[999999]"
              >
                {academicYears.map((year) => {
                  const isActive = Boolean(year.is_active || year.status === 'ACTIVE');
                  return (
                    <SelectItem
                      key={year.id}
                      value={year.id}
                      className="cursor-pointer rounded-xl py-2 pl-3 pr-8 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800 focus:bg-slate-100/70 dark:focus:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="truncate">{year.name}</span>
                        {isActive && (
                          <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors relative ${
                showNotifications
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
              aria-label="View notifications"
            >
              <Bell size={17} />
              {(unreadCount > 0 || pendingApprovalsCount > 0) && (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-red-600 ring-2 ring-white dark:ring-slate-900" />
              )}
            </button>

            {showNotifications && (
              <div
                className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 py-2.5 z-50 shadow-xl"
              >
                <div className="flex items-center justify-between px-4 pb-2.5 mb-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">Notifications</span>
                  <Badge color="primary" size="sm">
                    {unreadCount + pendingApprovalsCount} new
                  </Badge>
                </div>

                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  {pendingApprovalsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate('approvals');
                        setShowNotifications(false);
                      }}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 transition-colors"
                    >
                      <div>
                        <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                          {pendingApprovalsCount} pending approvals
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Attendance, lesson plans &amp; finance reviews
                        </div>
                      </div>
                      <ArrowRight size={12} className="text-slate-400 shrink-0" />
                    </button>
                  )}
                  {notifications.slice(0, 5).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        if (n.actionTab) onNavigate(n.actionTab, n.targetId);
                        setShowNotifications(false);
                      }}
                      className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-100/60 dark:border-slate-800/60 transition-colors last:border-b-0"
                    >
                      <Bell size={14} className="text-slate-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-slate-900 dark:text-slate-100">{n.title}</div>
                        <div className="text-[11px] text-slate-500 truncate">{n.message}</div>
                      </div>
                    </button>
                  ))}
                  {notifications.length === 0 && pendingApprovalsCount === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-slate-400">
                      All caught up. No new notifications.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <ModeToggle />

          {/* User Profile (Google Account Style) */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className={`flex items-center gap-2 h-9 px-3.5 rounded-full border text-xs font-medium transition-all ${
                showProfileMenu
                  ? 'border-blue-500 bg-blue-50/80 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-850 dark:text-slate-100'
              }`}
            >
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                {userRole === 'Cluster Admin' ? 'Cluster Admin' : 'Super Admin'}
              </span>
              <CaretDown
                size={11}
                className={`text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {showProfileMenu && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 p-2 z-50 shadow-[0_12px_36px_rgba(0,0,0,0.12)]"
              >
                <div className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{userName}</p>
                  <p className="text-[11px] text-slate-500 truncate">{userEmail}</p>
                  <span className="inline-block mt-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    {userRole === 'Cluster Admin' ? 'CLUSTER ADMIN' : 'SUPER ADMIN'}
                  </span>
                </div>

                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('settings');
                      setShowProfileMenu(false);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    <UserCircle size={15} className="text-slate-400" />
                    Account Settings
                  </button>

                  {onLogout && (
                    <>
                      <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                      <button
                        type="button"
                        onClick={() => {
                          onLogout();
                          setShowProfileMenu(false);
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
                      >
                        <SignOut size={15} />
                        Sign Out
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile search overlay (kept outside the floating header so it
          spans the full viewport) */}
      {mobileSearchOpen && (
        <div
          className="tqi-mobile-search sm:hidden"
          role="dialog"
          aria-label="Search"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'color-mix(in srgb, var(--card) 96%, transparent)',
            backdropFilter: 'blur(20px)',
            zIndex: 60,
            animation: 'tqi-reveal-up var(--dur-base) var(--ease-out-quart) both',
          }}
        >
          <div
            className="flex items-center gap-2 px-3 py-3"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <div
              className="tqi-search flex-1"
              style={{
                background: 'color-mix(in srgb, var(--surface) 70%, transparent)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 999,
                height: 40,
                padding: '0 0.875rem',
              }}
            >
              <Search size={16} weight="light" className="shrink-0" style={{ color: 'var(--text-muted)' }} />
              <input
                autoFocus
                type="text"
                placeholder="Jump to a view, roster, or record…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  flex: 1,
                  fontSize: 14,
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="tqi-touch"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Clear search"
                >
                  <X size={14} weight="light" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen(false);
                setSearchQuery('');
              }}
              className="tqi-btn-ghost tqi-touch"
              style={{ height: 40, padding: '0 0.75rem' }}
            >
              Cancel
            </button>
          </div>
          <div
            className="flex-1 overflow-y-auto custom-scrollbar"
            style={{ padding: '0.5rem' }}
          >
            {Object.keys(grouped).length > 0 ? (
              Object.entries(grouped).map(([cat, items]) => (
                <div key={cat} style={{ padding: '0.25rem 0.5rem' }}>
                  <div
                    className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {cat}
                  </div>
                  {items.map((item) => (
                    <button
                      key={item.tab}
                      type="button"
                      onClick={() => {
                        onNavigate(item.tab);
                        setSearchQuery('');
                        setMobileSearchOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-[13px] font-medium transition-colors tqi-touch"
                      style={{ color: 'var(--text)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--surface-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span className="truncate">{item.label}</span>
                      <CaretDown
                        size={14}
                        weight="light"
                        className="-rotate-90"
                        style={{ color: 'var(--text-muted)' }}
                      />
                    </button>
                  ))}
                </div>
              ))
            ) : (
              <div
                className="px-4 py-16 text-center text-[13px]"
                style={{ color: 'var(--text-muted)' }}
              >
                {searchQuery
                  ? `No results for "${searchQuery}".`
                  : 'Start typing to search.'}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
