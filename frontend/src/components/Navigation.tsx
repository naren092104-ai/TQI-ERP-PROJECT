import React from "react";
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
  UserCheck,
  X,
  Calendar,
  ClipboardCheck
} from "lucide-react";
import { TabType, NotificationItem, UserRole } from "../types";
import { TqiLogo } from "./TqiLogo";

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
}

interface NavItem {
  id: TabType | string;
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
  userRole = "Super Admin",
  pendingApprovalsCount = 0,
  isCollapsed = false,
  onToggleCollapse,
  onLogout,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const isSuperAdmin = !userRole || userRole === "Super Admin" || userRole.toLowerCase().includes("super");
  const isVolunteer = (userRole as string) === "Volunteer";

  const navGroups: NavGroup[] = [
    {
      label: "Main Dashboard",
      items: [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        ...(isSuperAdmin
          ? [{ id: "academic-setup", label: "Academic Term (8-Day)", icon: CalendarRange, superAdminOnly: true }]
          : []),
      ],
    },
    {
      label: "Field Operations",
      items: [
        ...(!isVolunteer ? [{ id: "clusters", label: "Clusters", icon: Network }] : []),
        { id: "panchayats", label: "Panchayats & Villages", icon: MapPin },
        { id: "students", label: "Students Roster", icon: GraduationCap },
        { id: "volunteers", label: "Volunteers Directory", icon: Users },
        { id: "attendance", label: "8-Day Attendance", icon: CalendarCheck2 },
        { id: "sessions", label: "Session Scheduling", icon: ClipboardList },
        { id: "session-photos", label: "Session Photos", icon: Camera },
        { id: "date-change-requests", label: "Date Change Requests", icon: Calendar },
        { id: "session-reports", label: "Session Reports", icon: FileText },
      ],
    },
    {
      label: "Curriculum & Finance",
      items: [
        { id: "module-library", label: "Module Library & PPTs", icon: BookOpen },
        { id: "lesson-plan", label: "Lesson Plans", icon: FileText },
        { id: "finance", label: "Finance & OCR Bills", icon: ReceiptIndianRupee },
        { id: "finance-statement", label: "Finance Statements", icon: FileText },
      ],
    },
    {
      label: "Governance & Administration",
      items: [
        {
          id: "approvals",
          label: "Approval Center",
          icon: ShieldCheck,
          badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
        },
        { id: "session-submissions", label: "Session Submissions", icon: ClipboardCheck },
        { id: "reports", label: "Analytics & Reports", icon: FileText },
        ...(isSuperAdmin ? [{ id: "users", label: "User & Role Management", icon: UserCheck }] : []),
        ...(isSuperAdmin ? [{ id: "audit-logs", label: "Audit & Governance Trail", icon: FileText }] : []),
        { id: "settings", label: "Settings & Profile", icon: Settings },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-gray-900/60 backdrop-blur-xs lg:hidden transition-opacity animate-in fade-in-0"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 z-40 flex flex-col h-screen border-r border-gray-200 bg-white transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 select-none ${
          isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        } ${isCollapsed ? "lg:w-[90px]" : "w-[280px] sm:w-[290px]"}`}
      >
        {/* Brand Header with Larger Logo */}
        <div className="flex h-20 items-center justify-between px-5 border-b border-gray-100 dark:border-gray-800/80 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <TqiLogo size={44} className="shrink-0" />
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex flex-col">
                <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
                  Talent Quest
                </span>
                <span className="text-xs font-semibold text-brand-500 dark:text-brand-400">
                  ERP System
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse button */}
          {onToggleCollapse && !isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors cursor-pointer"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}

          {/* Mobile Close Button */}
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="flex lg:hidden h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Expand button when collapsed on Desktop */}
        {onToggleCollapse && isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="mx-auto mt-3 hidden lg:flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors cursor-pointer"
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
                {!isCollapsed || isMobileOpen ? (
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
                      onClick={() => {
                        onSelectTab(item.id);
                        onCloseMobile?.();
                      }}
                      title={isCollapsed && !isMobileOpen ? item.label : undefined}
                      className={`group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all cursor-pointer ${
                        isActive
                          ? "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400 font-semibold shadow-theme-xs"
                          : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                      } ${isCollapsed && !isMobileOpen ? "justify-center px-0" : ""}`}
                    >
                      <IconComponent
                        className={`h-5 w-5 shrink-0 transition-colors ${
                          isActive
                            ? "text-brand-500 dark:text-brand-400"
                            : "text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300"
                        }`}
                      />
                      {(!isCollapsed || isMobileOpen) && (
                        <span className="truncate flex-1 text-left">{item.label}</span>
                      )}
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums shadow-theme-xs ${
                            isActive
                              ? "bg-brand-500 text-white"
                              : "bg-error-500 text-white"
                          } ${isCollapsed && !isMobileOpen ? "absolute top-1 right-2" : ""}`}
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
          <div className="border-t border-gray-100 p-4 dark:border-gray-800 shrink-0">
            <button
              type="button"
              onClick={() => {
                onLogout();
                onCloseMobile?.();
              }}
              title={isCollapsed && !isMobileOpen ? "Sign out" : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-600 hover:bg-error-50 hover:text-error-600 dark:text-gray-400 dark:hover:bg-error-500/15 dark:hover:text-error-400 transition-colors cursor-pointer ${
                isCollapsed && !isMobileOpen ? "justify-center px-0" : ""
              }`}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {(!isCollapsed || isMobileOpen) && <span>Sign Out</span>}
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
