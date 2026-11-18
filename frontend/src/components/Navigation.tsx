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
      label: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: House },
        {
          id: 'academic-setup',
          label: 'Academic Term (8-day)',
          icon: CalendarBlank,
        },
      ],
    },
    {
      label: 'FIELD OPERATIONS',
      items: [
        ...(!isVolunteer ? [{ id: 'clusters', label: 'Clusters', icon: TreeStructure, superAdminOnly: true }] : []),
        { id: 'panchayats', label: 'Panchayats & Villages', icon: MapPin },
        { id: 'students', label: 'Students', icon: Student },
        { id: 'volunteers', label: 'Volunteers', icon: Users },
        { id: 'attendance', label: 'Students Attendance', icon: CalendarCheck },
        { id: 'volunteer-attendance', label: 'Volunteer Attendance', icon: Users },
        { id: 'sessions', label: 'Session Scheduling', icon: ClipboardText },
        { id: 'session-photos', label: 'Session Photos', icon: Camera },
        { id: 'session-reports', label: 'Session Reports', icon: FileText },
      ],
    },
    {
      label: 'CURRICULUM & FINANCE',
      items: [
        { id: 'module-library', label: 'Module Library & PPTs', icon: BookOpen },
        { id: 'lesson-plan', label: 'Lesson Plans', icon: FileText },
        { id: 'finance', label: 'Finance', icon: CurrencyInr },
      ],
    },
    {
      label: 'ADMINISTRATION',
      items: [
        ...(isSuperAdmin
          ? [{ id: 'users', label: 'User Management', icon: UserCircleCheck }]
          : []),
        ...(isSuperAdmin
          ? [{
              id: 'approvals',
              label: 'Approval Center',
              icon: ShieldCheck,
              badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
              superAdminOnly: true,
            }]
          : []),
        ...(isSuperAdmin ? [{ id: 'audit-logs', label: 'Audit Logs', icon: FileText }] : []),
        { id: 'notifications', label: 'Notifications', icon: Sparkle },
        { id: 'settings', label: 'Settings', icon: Gear },
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
        {/* Brand header */}
        <div
          className="flex h-16 items-center justify-between px-4 shrink-0 border-b border-border"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="shrink-0 flex items-center justify-center">
              <TqiLogo size={36} />
            </span>
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-sm font-bold tracking-tight text-foreground truncate">
                  Talent Quest for India
                </span>
                <span className="text-[10px] font-semibold tracking-wider text-primary uppercase mt-0.5">
                  ERP · CONNECT · SHARE
                </span>
              </div>
            )}
          </div>

          {onToggleCollapse && !isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
              title="Collapse sidebar"
            >
              <CaretLeft size={14} />
            </button>
          )}

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="flex lg:hidden h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
              aria-label="Close sidebar"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {onToggleCollapse && isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="mx-auto mt-3 hidden lg:flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
            title="Expand sidebar"
          >
            <CaretRight size={14} />
          </button>
        )}

        {/* Quick command palette trigger (only when expanded) */}
        {(!isCollapsed || isMobileOpen) && onOpenCommandPalette && (
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="group flex w-full items-center gap-2 rounded-full border border-slate-200/90 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white hover:border-slate-300 dark:hover:bg-slate-800 transition-all"
            >
              <MagnifyingGlass size={14} className="shrink-0 text-slate-500" />
              <span className="truncate flex-1 text-left font-medium">Quick search</span>
              <span className="inline-flex items-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                ⌘K
              </span>
            </button>
          </div>
        )}

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => !item.superAdminOnly || isSuperAdmin);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label} className="space-y-0.5">
                {(!isCollapsed || isMobileOpen) ? (
                  <div className="px-3.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500/90 dark:text-slate-400 select-none">
                    {group.label}
                  </div>
                ) : (
                  <div className="mx-2 my-2 h-px bg-border/60" />
                )}
                {visibleItems.map((item) => {
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
                      className={`relative flex w-full items-center gap-3 rounded-full text-xs transition-colors ${
                        collapsed ? 'justify-center py-2.5' : 'px-3.5 py-2'
                      } ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 font-semibold'
                          : 'text-slate-700 font-medium hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                      }`}
                    >
                      <span
                        className={`shrink-0 flex items-center justify-center ${
                          isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <IconComponent size={17} />
                      </span>
                      {!collapsed && (
                        <span className="truncate flex-1 text-left">{item.label}</span>
                      )}
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="inline-flex items-center justify-center min-w-4 h-4 px-1.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
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
          <div className="p-3 shrink-0 border-t border-border">
            <button
              type="button"
              onClick={() => {
                onLogout();
                onCloseMobile?.();
              }}
              title={isCollapsed && !isMobileOpen ? 'Sign out' : undefined}
              className={`flex w-full items-center gap-2.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 transition-colors ${
                isCollapsed && !isMobileOpen ? 'justify-center py-2' : 'px-2.5 py-2'
              }`}
            >
              <SignOut size={15} className="shrink-0" />
              {(!isCollapsed || isMobileOpen) && <span>Sign Out</span>}
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
