import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Bell, 
  ChevronDown, 
  LogOut, 
  MapPin, 
  Shield, 
  User as UserIcon, 
  Check, 
  Command,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Moon
} from 'lucide-react';
import { Cluster, NotificationItem, UserRole, TabType } from '../types';
import { ModeToggle } from './mode-toggle';
import Badge from './ui/badge';

interface HeaderProps {
  userEmail?: string;
  userName?: string;
  userRole?: UserRole;
  clusters: Cluster[];
  selectedClusterId: string;
  onSelectCluster: (clusterId: string) => void;
  notifications: NotificationItem[];
  pendingApprovalsCount?: number;
  onNavigate: (tab: TabType, targetId?: string) => void;
  onLogout?: () => void;
  onRoleChange?: (role: UserRole) => void;
  onToggleSidebar?: () => void;
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
  onRoleChange,
  onToggleSidebar,
}) => {
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showClusterMenu, setShowClusterMenu] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const clusterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (clusterRef.current && !clusterRef.current.contains(event.target as Node)) {
        setShowClusterMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeCluster = clusters.find((c) => c.id === selectedClusterId);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const quickSearchItems = [
    { label: 'Academic Setup (8-Day Cycle)', tab: 'academic-setup' as TabType, category: 'Curriculum' },
    { label: 'Attendance & Homework Logs', tab: 'attendance' as TabType, category: 'Operations' },
    { label: 'Students Roster', tab: 'students' as TabType, category: 'Roster' },
    { label: 'Volunteers Directory', tab: 'volunteers' as TabType, category: 'Roster' },
    { label: 'Finance & OCR Bill Verification', tab: 'finance' as TabType, category: 'Finance' },
    { label: 'Approval Center', tab: 'approvals' as TabType, category: 'Governance' },
    { label: 'Module Library & PPTs', tab: 'module-library' as TabType, category: 'Curriculum' },
    { label: 'Panchayats & Villages', tab: 'panchayats' as TabType, category: 'Operations' },
  ];

  const filteredSearch = quickSearchItems.filter(item => 
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="sticky top-0 z-30 flex w-full h-20 items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/95 sm:px-6 lg:px-8">
      {/* Left: Mobile Toggle */}
      <div className="flex items-center gap-3 md:gap-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors"
          aria-label="Toggle navigation"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Right Controls: Bell, Mode, Profile */}
      <div className="flex items-center gap-2 sm:gap-3.5">

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/5 transition-colors"
            aria-label="View notifications"
          >
            <Bell className="h-4.5 w-4.5" />
            {(unreadCount > 0 || pendingApprovalsCount > 0) && (
              <span className="absolute top-2 right-2 flex h-2.5 w-2.5 rounded-full bg-error-500 ring-2 ring-white dark:ring-gray-900" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-[22rem] rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900 z-50 animate-in fade-in-0 zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm font-semibold text-gray-800 dark:text-white">Notifications</span>
                <Badge color="primary" size="sm">
                  {unreadCount + pendingApprovalsCount} new
                </Badge>
              </div>
              <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto custom-scrollbar">
                {pendingApprovalsCount > 0 && (
                  <div
                    onClick={() => { onNavigate('approvals'); setShowNotifications(false); }}
                    className="flex cursor-pointer items-start gap-3 rounded-xl p-3 bg-warning-50/50 hover:bg-warning-50 text-sm transition-colors dark:bg-warning-500/10 dark:hover:bg-warning-500/20"
                  >
                    <Sparkles className="h-4 w-4 mt-0.5 text-warning-500 shrink-0" />
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">{pendingApprovalsCount} Pending Approvals</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Attendance and finance entries require verification.</div>
                    </div>
                  </div>
                )}
                {notifications.slice(0, 4).map((n) => (
                  <div
                    key={n.id}
                    className="rounded-xl p-3 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => {
                      if (n.actionTab) onNavigate(n.actionTab, n.targetId);
                      setShowNotifications(false);
                    }}
                  >
                    <div className="font-medium text-gray-800 dark:text-white/90">{n.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{n.message}</div>
                  </div>
                ))}
                {notifications.length === 0 && pendingApprovalsCount === 0 && (
                  <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    All caught up! No new notifications.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Mode Toggle (Light / Dark) */}
        <ModeToggle />

        {/* User Profile Menu (Clean Without AD initials) */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5 transition-colors border border-gray-200 dark:border-gray-800"
          >
            <div className="flex flex-col text-left leading-tight">
              <span className="max-w-[140px] truncate text-xs font-bold text-gray-800 dark:text-white/90">
                {userName}
              </span>
              <span className="text-[10px] font-semibold text-brand-500 dark:text-brand-400 uppercase tracking-wider">
                {userRole}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900 z-50 animate-in fade-in-0 zoom-in-95">
              <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 mb-1">
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{userName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userEmail}</p>
                <div className="mt-2">
                  <Badge color="primary" size="sm">
                    {userRole}
                  </Badge>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { onNavigate('settings'); setShowProfileMenu(false); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5 transition-colors"
              >
                <UserIcon className="h-4 w-4 text-gray-400" />
                Account Settings
              </button>
              {onLogout && (
                <button
                  type="button"
                  onClick={() => { onLogout(); setShowProfileMenu(false); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10 transition-colors mt-1"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Global Command Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-99999 flex items-start justify-center bg-gray-900/60 pt-20 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-0 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center border-b border-gray-100 dark:border-gray-800 px-4 py-3.5">
              <Search className="h-5 w-5 text-gray-400 shrink-0 mr-3" />
              <input
                type="text"
                autoFocus
                placeholder="Jump to views, rosters, records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 text-gray-800 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
              >
                ESC
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2 custom-scrollbar">
              {filteredSearch.map((item) => (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => {
                    onNavigate(item.tab);
                    setShowSearchModal(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5 transition-colors text-left"
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {item.category}
                  </span>
                </button>
              ))}
              {filteredSearch.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No results found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

