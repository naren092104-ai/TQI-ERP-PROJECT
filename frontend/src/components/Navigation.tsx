import React from 'react';
import {
  House,
  CalendarBlank,
  MapPin,
  Student,
  Users,
  CalendarCheck,
  BookOpen,
  Receipt,
  ShieldCheck,
  FileText,
  Gear,
  Camera,
  TreeStructure,
  SignOut,
  CaretLeft,
  CaretRight,
  ClipboardText,
  UserCircleCheck,
  X,
  Calendar,
  Clipboard,
  MagnifyingGlass,
  Sparkle,
  HouseLine,
  CurrencyInr,
} from './ui/icons';
import { TabType, NotificationItem, UserRole } from '../types';
import { TqiLogo } from './TqiLogo';

interface NavigationProps {
  currentTab: TabType | string;
  onSelectTab: (tab: TabType | string) => void;
  notifications?: NotificationItem[];
  userRole?: UserRole;
  clusterName?: string;
  adminName?: string;
  userEmail?: string;
  pendingApprovalsCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onLogout?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenCommandPalette?: () => void;
}

interface NavItem {
  id: TabType | string;
  label: string;
  icon: React.ComponentType<any>;
  badge?: number;
  superAdminOnly?: boolean;
  clusterAdminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  userRole = 'Super Admin',
  pendingApprovalsCount = 0,
  isCollapsed = false,
  onToggleCollapse,
  onLogout,
  isMobileOpen = false,
  onCloseMobile,
  onOpenCommandPalette,
}) => {
  const isSuperAdmin =
    !userRole || userRole === 'Super Admin' || userRole.toLowerCase().includes('super');
  const isVolunteer = (userRole as string) === 'Volunteer';

  const navGroups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: House },
        ...(isSuperAdmin
          ? [
              {
                id: 'academic-setup',
                label: 'Academic term (8-day)',
                icon: CalendarBlank,
                superAdminOnly: true,
              },
            ]
          : []),
      ],
    },
    {
      label: 'Field operations',
      items: [
        ...(!isVolunteer ? [{ id: 'clusters', label: 'Clusters', icon: TreeStructure }] : []),
        { id: 'panchayats', label: 'Panchayats & villages', icon: MapPin },
        { id: 'students', label: 'Students roster', icon: Student },
        { id: 'volunteers', label: 'Volunteers directory', icon: Users },
        { id: 'attendance', label: '8-day attendance', icon: CalendarCheck },
        { id: 'sessions', label: 'Session scheduling', icon: ClipboardText },
        { id: 'session-photos', label: 'Session photos', icon: Camera },
        { id: 'date-change-requests', label: 'Date change requests', icon: Calendar },
        { id: 'session-reports', label: 'Session reports', icon: FileText },
      ],
    },
    {
      label: 'Curriculum & finance',
      items: [
        { id: 'module-library', label: 'Module library & PPTs', icon: BookOpen },
        { id: 'lesson-plan', label: 'Lesson plans', icon: FileText },
        { id: 'finance', label: 'Finance & OCR bills', icon: CurrencyInr },
        { id: 'finance-statement', label: 'Finance statements', icon: Receipt },
      ],
    },
    {
      label: 'Governance',
      items: [
        {
          id: 'approvals',
          label: 'Approval center',
          icon: ShieldCheck,
          badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
        },
        { id: 'session-submissions', label: 'Session submissions', icon: Clipboard },
        { id: 'reports', label: 'Analytics & reports', icon: FileText },
        ...(isSuperAdmin
          ? [{ id: 'users', label: 'User & role management', icon: UserCircleCheck }]
          : []),
        ...(isSuperAdmin ? [{ id: 'audit-logs', label: 'Audit & governance trail', icon: FileText }] : []),
        { id: 'settings', label: 'Settings & profile', icon: Gear },
      ],
    },
  ];

  return (
    <>
      {/* Mobile backdrop with smooth fade */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 lg:hidden"
          style={{
            background:
              'color-mix(in srgb, color-mix(in srgb, var(--text) 22%, transparent) 80%, transparent)',
            backdropFilter: 'blur(6px) saturate(140%)',
            WebkitBackdropFilter: 'blur(6px) saturate(140%)',
            animation: 'tqi-fade-in var(--dur-fast, 220ms) var(--ease-out-quart) both',
          }}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-40 flex flex-col h-dvh border-r select-none ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-[var(--sidebar-w-collapsed)]' : 'w-[var(--sidebar-w)]'}`}
        style={{
          background:
            'color-mix(in srgb, var(--card) 92%, transparent)',
          borderColor: 'var(--border)',
          boxShadow: isMobileOpen
            ? '0 1px 0 color-mix(in srgb, var(--text-on-brand) 6%, transparent) inset, 0 24px 64px -16px rgba(15, 23, 42, 0.28)'
            : 'none',
          transition:
            'transform var(--dur-medium, 480ms) var(--ease-out-expo), width var(--dur-medium, 480ms) var(--ease-out-expo), box-shadow var(--dur-fast) var(--ease-out-quart)',
        }}
      >
        {/* Brand header — Double-Bezel friendly */}
        <div
          className="flex h-16 lg:h-[76px] items-center justify-between px-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span
              className="shrink-0"
              style={{
                display: 'inline-flex',
                padding: 4,
                background:
                  'color-mix(in srgb, var(--card) 70%, transparent)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md, 12px)',
              }}
            >
              <TqiLogo size={32} />
            </span>
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex flex-col leading-tight min-w-0">
                <span
                  className="text-[15px] font-bold tracking-tight truncate"
                  style={{ color: 'var(--text)' }}
                >
                  Talent Quest
                </span>
                <span
                  className="text-[9.5px] font-semibold tracking-[0.18em] uppercase"
                  style={{ color: 'var(--brand)' }}
                >
                  ERP · connect · share
                </span>
              </div>
            )}
          </div>

          {onToggleCollapse && !isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex h-8 w-8 items-center justify-center transition-colors"
              style={{
                color: 'var(--text-muted)',
                background:
                  'color-mix(in srgb, var(--surface) 60%, transparent)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md, 10px)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface-hover)';
                e.currentTarget.style.color = 'var(--text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  'color-mix(in srgb, var(--surface) 60%, transparent)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
              title="Collapse sidebar"
            >
              <CaretLeft size={14} weight="light" />
            </button>
          )}

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="tqi-touch flex lg:hidden items-center justify-center transition-colors"
              style={{
                width: 32,
                height: 32,
                color: 'var(--text-muted)',
                background:
                  'color-mix(in srgb, var(--surface) 60%, transparent)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md, 10px)',
              }}
              aria-label="Close sidebar"
            >
              <X size={16} weight="light" />
            </button>
          )}
        </div>

        {onToggleCollapse && isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="mx-auto mt-3 hidden lg:flex h-8 w-8 items-center justify-center transition-colors"
            style={{
              color: 'var(--text-muted)',
              background:
                'color-mix(in srgb, var(--surface) 60%, transparent)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md, 10px)',
            }}
            title="Expand sidebar"
          >
            <CaretRight size={14} weight="light" />
          </button>
        )}

        {/* Quick command palette trigger (only when expanded) */}
        {(!isCollapsed || isMobileOpen) && onOpenCommandPalette && (
          <div className="px-3 pt-4">
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="tqi-reveal-item group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12.5px] font-medium transition-all"
              style={{
                color: 'var(--text-secondary)',
                background:
                  'color-mix(in srgb, var(--surface) 50%, transparent)',
                border: '1px solid var(--border-subtle)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface-hover)';
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  'color-mix(in srgb, var(--surface) 50%, transparent)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <MagnifyingGlass
                size={14}
                weight="light"
                style={{ color: 'var(--text-muted)' }}
              />
              <span className="truncate flex-1 text-left">Quick search</span>
              <span
                className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[9.5px] font-semibold tracking-wider uppercase"
                style={{
                  color: 'var(--text-muted)',
                  background:
                    'color-mix(in srgb, var(--card) 70%, transparent)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Sparkle size={10} weight="fill" /> ⌘K
              </span>
            </button>
          </div>
        )}

        {/* Nav groups — staggered reveal */}
        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6 custom-scrollbar">
          {navGroups.map((group, gIdx) => {
            const visibleItems = group.items.filter((item) => !item.superAdminOnly || isSuperAdmin);
            if (visibleItems.length === 0) return null;

            return (
              <div
                key={group.label}
                className="space-y-1"
                style={{
                  animation: `tqi-reveal-up var(--dur-medium) var(--ease-out-quart) both`,
                  animationDelay: `${120 + gIdx * 80}ms`,
                }}
              >
                {(!isCollapsed || isMobileOpen) ? (
                  <div
                    className="tqi-eyebrow px-3 pb-1.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {group.label}
                  </div>
                ) : (
                  <div
                    className="mx-2 my-2 h-px"
                    style={{ background: 'var(--border-subtle)' }}
                  />
                )}
                {visibleItems.map((item, iIdx) => {
                  const IconComponent = item.icon;
                  const isActive = currentTab === item.id;
                  const collapsed = isCollapsed && !isMobileOpen;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectTab(item.id);
                        onCloseMobile?.();
                      }}
                      title={collapsed ? item.label : undefined}
                      className={`tqi-reveal-item group relative flex w-full items-center gap-3 rounded-xl text-[13px] font-medium transition-all ${
                        collapsed ? 'justify-center' : ''
                      } ${!collapsed ? 'tqi-touch' : ''}`}
                      style={{
                        padding: collapsed ? '0.6rem 0' : '0.55rem 0.75rem',
                        background: isActive
                          ? 'var(--brand-light)'
                          : 'transparent',
                        color: isActive ? 'var(--brand)' : 'var(--text-secondary)',
                        fontWeight: isActive ? 600 : 500,
                        border: '1px solid',
                        borderColor: isActive
                          ? 'var(--brand-xlight, var(--border))'
                          : 'transparent',
                        transition:
                          'background var(--dur-fast) var(--ease-out-quart), color var(--dur-fast) var(--ease-out-quart), border-color var(--dur-fast) var(--ease-out-quart), transform var(--dur-fast) var(--ease-out-quart)',
                        animationDelay: `${160 + gIdx * 80 + iIdx * 30}ms`,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'var(--surface-hover)';
                          e.currentTarget.style.color = 'var(--text)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }
                      }}
                    >
                      {isActive && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r"
                          style={{ background: 'var(--brand)' }}
                        />
                      )}
                      <span
                        className="shrink-0 flex items-center justify-center"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: isActive
                            ? 'color-mix(in srgb, var(--brand) 12%, transparent)'
                            : 'transparent',
                          color: isActive ? 'var(--brand)' : 'var(--text-muted)',
                          transition: 'background var(--dur-fast) var(--ease-out-quart)',
                        }}
                      >
                        <IconComponent size={16} weight="light" />
                      </span>
                      {!collapsed && (
                        <span className="truncate flex-1 text-left">{item.label}</span>
                      )}
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold"
                          style={{
                            background: isActive
                              ? 'var(--brand)'
                              : 'var(--error, #c0392b)',
                            color: isActive ? 'var(--text-on-brand)' : '#fff',
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Sign out */}
        {onLogout && (
          <div
            className="p-3 shrink-0"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <button
              type="button"
              onClick={() => {
                onLogout();
                onCloseMobile?.();
              }}
              title={isCollapsed && !isMobileOpen ? 'Sign out' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl text-[13px] font-medium transition-all ${
                isCollapsed && !isMobileOpen ? 'justify-center' : ''
              }`}
              style={{
                padding: isCollapsed && !isMobileOpen ? '0.6rem 0' : '0.55rem 0.75rem',
                color: 'var(--text-secondary)',
                background: 'transparent',
                border: '1px solid transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--error-bg, #FEF3F2)';
                e.currentTarget.style.color = 'var(--error, #c0392b)';
                e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--error, #c0392b) 14%, transparent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <span
                className="shrink-0 flex items-center justify-center"
                style={{ width: 28, height: 28, borderRadius: 8 }}
              >
                <SignOut size={16} weight="light" />
              </span>
              {(!isCollapsed || isMobileOpen) && <span>Sign out</span>}
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
