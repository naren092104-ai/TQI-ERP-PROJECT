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
} from './ui/icons';
import { NotificationItem, UserRole, TabType } from '../types';
import { ModeToggle } from './mode-toggle';
import Badge from './ui/badge';

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
    { label: 'Attendance & homework logs', tab: 'attendance' as TabType, category: 'Operations' },
    { label: 'Students roster', tab: 'students' as TabType, category: 'Roster' },
    { label: 'Volunteers directory', tab: 'volunteers' as TabType, category: 'Roster' },
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
      {/* Enterprise Top Header */}
      <header className="tqi-app-header sticky top-0 z-30 w-full h-14 border-b border-border bg-card px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 shadow-xs">
        {/* Left: mobile toggle + search */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
            aria-label="Toggle navigation"
          >
            <Menu size={18} />
          </button>

          {/* Inline search (tablet+) */}
          <div
            ref={searchContainerRef}
            className={`relative w-full max-w-md hidden sm:flex items-center gap-2 h-9 rounded-md border transition-colors px-2.5 ${
              searchFocused
                ? 'border-primary ring-1 ring-primary bg-card'
                : 'border-border bg-background hover:border-border-strong'
            }`}
          >
            <Search size={14} className="shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search records, students, sessions, clusters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              className="flex-1 bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground font-sans"
            />
            <kbd className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded border border-border bg-muted/60 text-[10px] font-mono text-muted-foreground">
              <Command size={10} />K
            </kbd>

            {searchFocused && searchQuery && (
              <div
                className="absolute left-0 right-0 top-[40px] rounded-md border border-border bg-card py-2 max-h-96 overflow-y-auto custom-scrollbar shadow-lg z-50"
              >
                {Object.keys(grouped).length > 0 ? (
                  Object.entries(grouped).map(([cat, items]) => (
                    <div key={cat} className="px-1.5">
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
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
                          className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover transition-colors text-left"
                        >
                          <span className="truncate">{item.label}</span>
                          <CaretDown size={12} className="-rotate-90 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No records matching &ldquo;{searchQuery}&rdquo;.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Academic Year, Notifications, Mode, User profile */}
        <div className="tqi-header-actions flex items-center gap-2 shrink-0">
          {/* Global Academic Year Selector */}
          <div className="tqi-header-year relative">
            <select
              aria-label="Academic Year"
              value={selectedAcademicYearId}
              onChange={(event) => onSelectAcademicYear?.(event.target.value)}
              className="tqi-header-year-select h-8 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
            >
              <option value="">Select Academic Year</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}{(year.is_active || year.status === 'ACTIVE') ? ' (Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors relative ${
                showNotifications
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-surface-hover hover:text-foreground'
              }`}
              aria-label="View notifications"
            >
              <Bell size={15} />
              {(unreadCount > 0 || pendingApprovalsCount > 0) && (
                <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-red-600 ring-2 ring-card" />
              )}
            </button>

            {showNotifications && (
              <div
                className="absolute right-0 mt-2 w-80 rounded-md border border-border bg-card py-2 z-50 shadow-lg"
              >
                <div className="flex items-center justify-between px-3.5 pb-2 mb-1 border-b border-border">
                  <span className="text-xs font-semibold text-foreground">Notifications</span>
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
                      className="flex w-full items-center justify-between px-3.5 py-2 text-left hover:bg-surface-hover border-b border-border/60 transition-colors"
                    >
                      <div>
                        <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                          {pendingApprovalsCount} pending approvals
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Attendance, lesson plans &amp; finance reviews
                        </div>
                      </div>
                      <ArrowRight size={12} className="text-muted-foreground shrink-0" />
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
                      className="flex w-full items-start gap-2.5 px-3.5 py-2 text-left hover:bg-surface-hover border-b border-border/40 transition-colors last:border-b-0"
                    >
                      <Bell size={13} className="text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-foreground">{n.title}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{n.message}</div>
                      </div>
                    </button>
                  ))}
                  {notifications.length === 0 && pendingApprovalsCount === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                      All caught up. No new notifications.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <ModeToggle />

          {/* User Profile */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className={`flex items-center gap-2 h-8 pl-1.5 pr-2.5 rounded-md border text-xs transition-colors ${
                showProfileMenu
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-foreground hover:bg-surface-hover'
              }`}
            >
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground font-bold text-[10px]">
                {userName
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('') || 'AD'}
              </span>
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
                  {userRole === 'Cluster Admin' ? 'Cluster Admin' : 'Admin'}
                </span>
                <span className="text-[9px] font-bold text-primary tracking-wider uppercase">
                  {userRole === 'Cluster Admin' ? 'CLUSTER ADMIN' : 'SUPER ADMIN'}
                </span>
              </div>
              <CaretDown
                size={11}
                className={`text-muted-foreground transition-transform ${showProfileMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {showProfileMenu && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-md border border-border bg-card py-1.5 z-50 shadow-lg"
              >
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs font-semibold text-foreground">{userName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
                  <span className="inline-block mt-1 text-[10px] font-bold text-primary uppercase">
                    {userRole === 'Cluster Admin' ? 'CLUSTER ADMIN' : 'SUPER ADMIN'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onNavigate('settings');
                    setShowProfileMenu(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-surface-hover transition-colors"
                >
                  <UserCircle size={14} className="text-muted-foreground" />
                  Account Settings
                </button>

                {onLogout && (
                  <>
                    <div className="my-1 h-px bg-border" />
                    <button
                      type="button"
                      onClick={() => {
                        onLogout();
                        setShowProfileMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <SignOut size={14} />
                      Sign Out
                    </button>
                  </>
                )}
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
