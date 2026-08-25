import React from 'react';
import {
  LayoutDashboard,
  CalendarRange,
  MapPin,
  GraduationCap,
  Users,
  CalendarCheck2,
  BookOpen,
  ReceiptIndianRupee,
  ShieldCheck,
  FileText,
  Settings,
  Camera,
  Network,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Sparkles
} from 'lucide-react';
import { TabType, NotificationItem, UserRole } from '../types';
import { TqiLogo } from './TqiLogo';

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  notifications?: NotificationItem[];
  userRole?: UserRole;
  clusterName?: string;
  adminName?: string;
  userEmail?: string;
  pendingApprovalsCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onLogout?: () => void;
}

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
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
}) => {
  const isSuperAdmin = userRole === 'Super Admin';
  const isVolunteer = (userRole as string) === 'Volunteer';

  const navGroups: NavGroup[] = [
    {
      label: 'Main Dashboard',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...(isSuperAdmin
          ? [{ id: 'academic-setup' as TabType, label: 'Academic Term (8-Day)', icon: CalendarRange, superAdminOnly: true }]
          : []),
      ],
    },
    {
      label: 'Field Operations',
      items: [
        ...(!isVolunteer ? [{ id: 'clusters' as TabType, label: 'Clusters', icon: Network }] : []),
        { id: 'panchayats', label: 'Panchayats & Villages', icon: MapPin },
        { id: 'students', label: 'Students Roster', icon: GraduationCap },
        { id: 'volunteers', label: 'Volunteers Directory', icon: Users },
        { id: 'attendance', label: '8-Day Attendance', icon: CalendarCheck2 },
        { id: 'sessions', label: 'Session Scheduling', icon: ClipboardList },
        { id: 'session-photos', label: 'Session Photos', icon: Camera },
      ],
    },
    {
      label: 'Curriculum & Finance',
      items: [
        { id: 'module-library', label: 'Module Library & PPTs', icon: BookOpen },
        { id: 'lesson-plan', label: 'Lesson Plans', icon: FileText },
        { id: 'finance', label: 'Finance & OCR Bills', icon: ReceiptIndianRupee },
        { id: 'finance-statement', label: 'Finance Statements', icon: FileText },
      ],
    },
    {
      label: 'Governance & Analytics',
      items: [
        {
          id: 'approvals',
          label: 'Approval Center',
          icon: ShieldCheck,
          badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
        },
        { id: 'reports', label: 'Analytics & Reports', icon: FileText },
        ...(isSuperAdmin ? [{ id: 'users' as TabType, label: 'User Management', icon: Users }] : []),
        ...(isSuperAdmin ? [{ id: 'audit-logs' as TabType, label: 'Audit Logs', icon: FileText }] : []),
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-9999 flex flex-col h-screen border-r border-gray-200 bg-white transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 ${
        isCollapsed ? 'w-[90px]' : 'w-[290px]'
      } select-none`}
    >
      {/* Brand Header */}
      <div className="flex h-20 items-center justify-between px-6 border-b border-gray-100 dark:border-gray-800/80">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 shadow-theme-xs dark:bg-brand-500/10">
            <TqiLogo size={28} className="drop-shadow-sm" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
                Talent Quest
              </span>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                ERP System
              </span>
            </div>
          )}
        </div>

        {/* Collapse toggle button */}
        {onToggleCollapse && !isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {onToggleCollapse && isCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="mx-auto mt-3 hidden lg:flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors"
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Navigation Group Items */}
      <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6 custom-scrollbar">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (item.superAdminOnly && !isSuperAdmin) return false;
            return true;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="space-y-1">
              {!isCollapsed ? (
                <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {group.label}
                </div>
              ) : (
                <div className="mx-2 my-2 h-px bg-gray-100 dark:bg-gray-800" />
              )}
              {visibleItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = currentTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400 font-semibold shadow-theme-xs'
                        : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    <IconComponent
                      className={`h-5 w-5 shrink-0 transition-colors ${
                        isActive
                          ? 'text-brand-500 dark:text-brand-400'
                          : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300'
                      }`}
                    />
                    {!isCollapsed && (
                      <span className="truncate flex-1 text-left">{item.label}</span>
                    )}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums shadow-theme-xs ${
                          isActive
                            ? 'bg-brand-500 text-white'
                            : 'bg-error-500 text-white'
                        } ${isCollapsed ? 'absolute top-1 right-2' : ''}`}
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

      {/* Footer / User & Sign out */}
      {onLogout && (
        <div className="border-t border-gray-100 p-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onLogout}
            title={isCollapsed ? 'Sign out' : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-600 hover:bg-error-50 hover:text-error-600 dark:text-gray-400 dark:hover:bg-error-500/15 dark:hover:text-error-400 transition-colors ${
              isCollapsed ? 'justify-center px-0' : ''
            }`}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      )}
    </aside>
  );
};

