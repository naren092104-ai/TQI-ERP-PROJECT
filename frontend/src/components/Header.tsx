import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  CaretDown,
  SignOut,
  UserCircle,
  Check,
  Command,
  Sliders,
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
      {/* Floating glass island header — detached from the top edge with
          a hairline outer ring and an inner pill core (Double-Bezel). */}
      <header className="sticky top-3 z-30 w-full px-3 sm:px-5 lg:px-7 pointer-events-none">
        <div
          className="tqi-glass-island flex items-center justify-between gap-2 sm:gap-3 px-2.5 sm:px-3.5 py-2 pointer-events-auto"
          style={{
            height: 'var(--header-h, 64px)',
            background:
              'color-mix(in srgb, var(--card) 78%, transparent)',
            backdropFilter: 'saturate(180%) blur(24px)',
            WebkitBackdropFilter: 'saturate(180%) blur(24px)',
            border: '1px solid color-mix(in srgb, var(--border) 80%, transparent)',
            borderRadius: 'var(--radius-xl, 18px)',
            boxShadow:
              '0 1px 0 color-mix(in srgb, var(--text-on-brand) 8%, transparent) inset, 0 12px 32px -16px rgba(15, 23, 42, 0.18)',
          }}
        >
          {/* Left: mobile toggle + search */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={onToggleSidebar}
              className="tqi-touch lg:hidden flex items-center justify-center transition-all"
              style={{
                width: 38,
                height: 38,
                color: 'var(--text-secondary)',
                background: 'color-mix(in srgb, var(--surface) 70%, transparent)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md, 12px)',
              }}
              aria-label="Toggle navigation"
            >
              <Sliders size={18} weight="light" />
            </button>

            {/* Mobile search trigger */}
            <button
              type="button"
              onClick={() => setMobileSearchOpen(true)}
              className="tqi-touch sm:hidden flex items-center justify-center transition-all"
              style={{
                width: 38,
                height: 38,
                color: 'var(--text-secondary)',
                background: 'color-mix(in srgb, var(--surface) 70%, transparent)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md, 12px)',
              }}
              aria-label="Open search"
            >
              <Search size={18} weight="light" />
            </button>

            {/* Inline search (tablet+) — Double-Bezel: outer + inner */}
            <div
              ref={searchContainerRef}
              className="tqi-search w-full max-w-md hidden sm:inline-flex"
              style={{
                background: 'color-mix(in srgb, var(--surface) 60%, transparent)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '999px',
                height: 40,
                padding: '0 0.875rem',
                transition:
                  'border-color var(--dur-fast) var(--ease-out-quart), box-shadow var(--dur-fast) var(--ease-out-quart)',
              }}
            >
              <Search size={16} weight="light" className="shrink-0" style={{ color: 'var(--text-muted)' }} />
              <input
                ref={searchRef}
                type="text"
                placeholder="Jump to a view, roster, or record…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={(e) => {
                  const root = e.currentTarget.parentElement!;
                  root.style.borderColor = 'var(--brand)';
                  root.style.boxShadow = '0 0 0 4px var(--brand-ring, color-mix(in srgb, var(--brand) 18%, transparent))';
                  setSearchFocused(true);
                }}
                onBlur={() => {}}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  flex: 1,
                  fontSize: 13.5,
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                }}
              />
              <kbd
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  height: 22,
                  padding: '0 6px',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  color: 'var(--text-muted)',
                  background: 'color-mix(in srgb, var(--card) 70%, transparent)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  fontFamily: 'inherit',
                }}
              >
                <Command size={11} weight="bold" />K
              </kbd>

              {searchFocused && searchQuery && (
                <div
                  className="absolute left-0 right-0 top-[48px] rounded-2xl py-2 max-h-96 overflow-y-auto custom-scrollbar"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    boxShadow:
                      '0 1px 0 color-mix(in srgb, var(--text-on-brand) 8%, transparent) inset, 0 24px 48px -16px rgba(15, 23, 42, 0.22)',
                    borderRadius: 'var(--radius-lg, 14px)',
                    animation:
                      'tqi-reveal-up var(--dur-base, 320ms) var(--ease-out-quart) both',
                  }}
                >
                  {Object.keys(grouped).length > 0 ? (
                    Object.entries(grouped).map(([cat, items]) => (
                      <div key={cat} className="px-1.5">
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
                            }}
                            className="tqi-reveal-item flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-colors"
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
                              size={12}
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
                      className="px-4 py-10 text-center text-[13px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      No results for &ldquo;{searchQuery}&rdquo;.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: notifications, mode, profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="tqi-touch relative flex items-center justify-center transition-all"
                style={{
                  width: 38,
                  height: 38,
                  color: showNotifications ? 'var(--brand)' : 'var(--text-secondary)',
                  background: showNotifications
                    ? 'var(--brand-light)'
                    : 'color-mix(in srgb, var(--surface) 70%, transparent)',
                  border: '1px solid',
                  borderColor: showNotifications ? 'var(--brand-xlight, var(--border))' : 'var(--border-subtle)',
                  borderRadius: 'var(--radius-md, 12px)',
                }}
                aria-label="View notifications"
              >
                <Bell size={16} weight="light" />
                {(unreadCount > 0 || pendingApprovalsCount > 0) && (
                  <span
                    className="absolute top-1 right-1 flex h-2 w-2 rounded-full"
                    style={{
                      background: 'var(--error, #c0392b)',
                      boxShadow:
                        '0 0 0 2px var(--card), 0 0 8px color-mix(in srgb, var(--error, #c0392b) 50%, transparent)',
                    }}
                  />
                )}
              </button>

              {showNotifications && (
                <div
                  className="absolute right-0 mt-2 w-[22rem] rounded-2xl py-3 z-50"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    boxShadow:
                      '0 1px 0 color-mix(in srgb, var(--text-on-brand) 8%, transparent) inset, 0 24px 48px -16px rgba(15, 23, 42, 0.22)',
                    animation: 'tqi-reveal-up var(--dur-base, 320ms) var(--ease-out-quart) both',
                  }}
                >
                  <div
                    className="flex items-center justify-between px-4 pb-2.5 mb-1"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="tqi-eyebrow"
                        style={{ fontSize: 10, color: 'var(--text-muted)' }}
                      >
                        Inbox
                      </span>
                      <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                        Notifications
                      </span>
                    </div>
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
                        className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors"
                        style={{ background: 'var(--warning-bg)' }}
                      >
                        <span
                          className="tqi-icon-chip tqi-icon-chip-warn shrink-0"
                          style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)' }}
                        >
                          <Lightning size={14} weight="light" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                            {pendingApprovalsCount} pending approvals
                          </div>
                          <div
                            className="text-[11.5px] mt-0.5"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Attendance and finance entries need verification.
                          </div>
                        </div>
                        <span
                          className="tqi-pill-icon shrink-0"
                          aria-hidden
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            background: 'color-mix(in srgb, var(--card) 80%, transparent)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <ArrowRight size={11} weight="light" />
                        </span>
                      </button>
                    )}
                    {notifications.slice(0, 4).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          if (n.actionTab) onNavigate(n.actionTab, n.targetId);
                          setShowNotifications(false);
                        }}
                        className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--surface-hover)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span
                          className="tqi-icon-chip shrink-0"
                          style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)' }}
                        >
                          <Bell size={14} weight="light" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                            {n.title}
                          </div>
                          <div
                            className="text-[11.5px] mt-0.5 truncate"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {n.message}
                          </div>
                        </div>
                      </button>
                    ))}
                    {notifications.length === 0 && pendingApprovalsCount === 0 && (
                      <div
                        className="px-4 py-10 text-center"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <span
                          className="tqi-icon-chip mx-auto mb-2"
                          style={{
                            width: 36,
                            height: 36,
                            background: 'var(--success-bg)',
                            color: 'var(--success)',
                          }}
                        >
                          <CheckCircle size={16} weight="light" />
                        </span>
                        <p className="text-[13px]">All caught up. No new notifications.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <ModeToggle />

            {/* Profile — chip with avatar + name (no plain border) */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 text-sm font-medium transition-all"
                style={{
                  color: 'var(--text)',
                  border: '1px solid',
                  borderColor: showProfileMenu
                    ? 'var(--brand-xlight, var(--border))'
                    : 'var(--border-subtle)',
                  background: showProfileMenu
                    ? 'var(--brand-light)'
                    : 'color-mix(in srgb, var(--surface) 60%, transparent)',
                  borderRadius: 999,
                  height: 40,
                }}
              >
                <span
                  className="flex items-center justify-center h-7 w-7 rounded-full text-[10.5px] font-bold tracking-wider"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 65%, var(--accent)))',
                    color: 'var(--text-on-brand)',
                    boxShadow:
                      '0 1px 0 color-mix(in srgb, var(--text-on-brand) 25%, transparent) inset',
                  }}
                >
                  {userName
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <div className="hidden md:flex flex-col text-left leading-tight min-w-0">
                  <span
                    className="text-[12.5px] font-semibold truncate max-w-[140px]"
                    style={{ color: 'var(--text)' }}
                  >
                    {userName}
                  </span>
                  <span
                    className="text-[9.5px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: 'var(--brand)' }}
                  >
                    {userRole}
                  </span>
                </div>
                <CaretDown
                  size={12}
                  weight="light"
                  className="shrink-0 transition-transform"
                  style={{
                    color: 'var(--text-muted)',
                    transform: showProfileMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform var(--dur-fast) var(--ease-out-quart)',
                  }}
                />
              </button>

              {showProfileMenu && (
                <div
                  className="absolute right-0 mt-2 w-64 rounded-2xl py-2 z-50"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    boxShadow:
                      '0 1px 0 color-mix(in srgb, var(--text-on-brand) 8%, transparent) inset, 0 24px 48px -16px rgba(15, 23, 42, 0.22)',
                    animation: 'tqi-reveal-up var(--dur-base, 320ms) var(--ease-out-quart) both',
                  }}
                >
                  <div
                    className="px-3 py-2.5 mb-1"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                      {userName}
                    </p>
                    <p className="text-[11.5px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {userEmail}
                    </p>
                    <div className="mt-2">
                      <Badge color="primary" size="sm">
                        {userRole}
                      </Badge>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('settings');
                      setShowProfileMenu(false);
                    }}
                    className="tqi-reveal-item flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--surface-hover)';
                      e.currentTarget.style.color = 'var(--text)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <UserCircle size={15} weight="light" style={{ color: 'var(--text-muted)' }} />
                    Account settings
                  </button>

                  <button
                    type="button"
                    className="tqi-reveal-item flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--surface-hover)';
                      e.currentTarget.style.color = 'var(--text)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <Question size={15} weight="light" style={{ color: 'var(--text-muted)' }} />
                    Help &amp; documentation
                  </button>

                  {onLogout && (
                    <>
                      <div
                        className="my-1 h-px"
                        style={{ background: 'var(--border-subtle)' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onLogout();
                          setShowProfileMenu(false);
                        }}
                        className="tqi-reveal-item flex w-full items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors"
                        style={{ color: 'var(--error, #c0392b)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--error-bg, #FEF3F2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <SignOut size={15} weight="light" />
                        Sign out
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
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
