import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2 } from './components/ui/icons';
import {
  TabType,
  Student,
  Volunteer,
  Session,
  AttendanceSession,
  FinanceEntry,
  FinanceDraft,
  LessonPlan,
  SessionPhotoGroup,
  NotificationItem,
  Panchayat,
  UserRole,
  Cluster,
  ApprovalItem,
  AuditLogEntry,
  User,
  DateChangeRequest,
  SessionReport,
  SessionSubmission,
  AcademicYear,
  TqiModule,
} from './types';
import { Navigation } from './components/Navigation';
import { LoginPage, AuthSession } from './components/LoginPage';
import { DashboardView } from './components/DashboardView';
import { ApprovalCenterView } from './components/ApprovalCenterView';
import { ClustersView } from './components/ClustersView';
import { AuditLogView } from './components/AuditLogView';
import { UserManagementView } from './components/UserManagementView';
import { PanchayatsView } from './components/PanchayatsView';
import { PanchayatDetailView } from './components/PanchayatDetailView';
import { StudentsView } from './components/StudentsView';
import { VolunteersView } from './components/VolunteersView';
import { SessionsView } from './components/SessionsView';
import { AttendanceView } from './components/AttendanceView';
import { LessonPlanView } from './components/LessonPlanView';
import { SessionPhotosView } from './components/SessionPhotosView';
import { FinanceView } from './components/FinanceView';
import { FinanceStatementView } from './components/FinanceStatementView';
import { ReportsView } from './components/ReportsView';
import { ReportPreviewView } from './components/ReportPreviewView';
import { NotificationsView } from './components/NotificationsView';
import { SettingsView } from './components/SettingsView';
import { ModuleLibraryView } from './components/ModuleLibraryView';
import { AcademicSetupView } from './components/AcademicSetupView';
import { Header } from './components/Header';
import { AdminLayout } from './components/layout/AdminLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import DateChangeRequestView from './components/DateChangeRequestView';
import SessionReportView from './components/SessionReportView';
import SessionSubmissionView from './components/SessionSubmissionView';
import { apiUrl } from './utils/api';
import { CommandPalette } from './components/ui/CommandPalette';
import { NotFoundView } from './components/NotFoundView';
import { DataResetModal } from './components/DataResetModal';
import { MaintenancePage } from './components/MaintenancePage';

const KNOWN_TABS: Set<string> = new Set([
  'dashboard', 'academic-setup', 'approvals', 'clusters', 'audit-logs', 'users',
  'panchayats', 'panchayat-detail', 'students', 'volunteers', 'sessions',
  'attendance', 'volunteer-attendance', 'lesson-plan', 'session-photos',
  'finance', 'finance-statement', 'reports', 'report-preview',
  'notifications', 'settings', 'date-change-requests',
  'session-reports', 'session-submissions', 'module-library',
]);

const normalizeUserRole = (role?: string): UserRole => {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'super_admin' || normalized === 'super admin') return 'Super Admin';
  if (normalized === 'cluster_admin' || normalized === 'cluster admin') return 'Cluster Admin';
  return 'Super Admin';
};

const isJwtExpired = (token?: string): boolean => {
  if (!token) return false;
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return true;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    return typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

const readStoredAuthSession = (): Partial<AuthSession> | null => {
  try {
    const saved = localStorage.getItem('tqi_auth_session');
    if (!saved) return null;
    const session = JSON.parse(saved) as Partial<AuthSession> | null;
    return session && typeof session === 'object' ? session : null;
  } catch {
    return null;
  }
};

const readStoredAuthToken = (): string | null => {
  const token = readStoredAuthSession()?.token;
  return typeof token === 'string' && token.trim() ? token : null;
};

export default function App() {
  // Session & Authentication State
  const [currentUser, setCurrentUser] = useState<AuthSession | null>(() => {
    const savedSession = readStoredAuthSession();
    if (typeof savedSession?.token !== 'string' || !savedSession.token.trim()) {
      try {
        if (localStorage.getItem('tqi_auth_session')) {
          localStorage.removeItem('tqi_auth_session');
        }
      } catch {
        // Continue unauthenticated if browser storage is unavailable.
      }
      return null;
    }
    return {
      ...savedSession,
      role: normalizeUserRole(savedSession.role),
    } as AuthSession;
  });
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');

  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(currentUser?.role || 'Super Admin');
  const [currentUserClusterId, setCurrentUserClusterId] = useState<string>(currentUser?.clusterId || 'all');

  // Navigation & View State
  const [currentTab, setCurrentTab] = useState<TabType>(() => {
    try {
      const role = currentUser?.role || 'Super Admin';
      const savedTab = localStorage.getItem(`tqi_current_tab_${role}`) as TabType | null;
      if (!savedTab) return 'dashboard';
      // Stale localStorage from older builds may have stored tabs that no
      // longer exist (e.g. 'attendance-draft'). Normalize them back to
      // 'dashboard' so the user doesn't land on a blank pane.
      if (!KNOWN_TABS.has(savedTab)) return 'dashboard';
      return savedTab;
    } catch {
      return 'dashboard';
    }
  });
  const [selectedPanchayatId, setSelectedPanchayatId] = useState<string>('vedakkattamaduvu');
  const [initialStudentFilters, setInitialStudentFilters] = useState<{ panchayatId?: string; villageId?: string } | undefined>(undefined);
  const [activeDraftId, setActiveDraftId] = useState<string | undefined>(undefined);
  const [activeFinanceDraftId, setActiveFinanceDraftId] = useState<string | undefined>(undefined);
  const [activeFinanceClusterId, setActiveFinanceClusterId] = useState<string | undefined>(undefined);
  const [maintenanceState, setMaintenanceState] = useState<{ enabled: boolean; title: string; message: string; expectedCompletion: string | null; showCountdown: boolean; autoDisable: boolean } | null>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceCheckedToken, setMaintenanceCheckedToken] = useState<string | null>(null);
  const [authValidatedToken, setAuthValidatedToken] = useState<string | null>(null);
  const [openNewFinanceModal, setOpenNewFinanceModal] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [selectedLessonPlanId, setSelectedLessonPlanId] = useState<string | undefined>(undefined);
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [suggestedResetModule, setSuggestedResetModule] = useState<string | undefined>();
  const [resetHistoryVersion, setResetHistoryVersion] = useState(0);

  // Global ⌘K / Ctrl+K to open the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      } else if (e.key === '/' && document.activeElement === document.body) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(`tqi_current_tab_${currentUserRole}`, currentTab);
    } catch {
      // ignore storage failures
    }
  }, [currentTab, currentUserRole]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    try {
      const sessionToStore: AuthSession = {
        ...currentUser,
        role: normalizeUserRole(currentUser.role),
        clusterId: currentUser.clusterId || 'all',
      };
      localStorage.setItem('tqi_auth_session', JSON.stringify(sessionToStore));
    } catch {
      // ignore storage failures
    }
  }, [currentUser]);

  useEffect(() => {
    const sessionToken = currentUser?.token;
    if (!sessionToken) {
      setAuthValidatedToken(null);
      setAuthStatus('unauthenticated');
      return;
    }
    setAuthValidatedToken(null);
    setAuthStatus('checking');

    let active = true;
    let rejected = false;
    let requestInFlight = false;
    const controller = new AbortController();
    const clearInvalidSession = () => {
      if (readStoredAuthToken() === sessionToken) {
        try {
          localStorage.removeItem('tqi_auth_session');
        } catch {
          // Keep the in-memory logout even if browser storage is unavailable.
        }
      }
      if (!active) return;
      setAuthValidatedToken((token) => token === sessionToken ? null : token);
      setAuthStatus('unauthenticated');
      setCurrentUser((user) => user?.token === sessionToken ? null : user);
    };

    const verifyPasswordState = async () => {
      if (!active || rejected || requestInFlight) return;

      const storedToken = readStoredAuthToken();
      if (!storedToken || storedToken !== sessionToken) {
        rejected = true;
        clearInvalidSession();
        return;
      }
      requestInFlight = true;
      try {
        const response = await fetch(apiUrl('/api/auth/me'), {
          headers: { Authorization: `Bearer ${storedToken}` },
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!active) return;
        if (response.status === 401) {
          rejected = true;
          clearInvalidSession();
          return;
        }
        const data = await response.json().catch(() => null);
        if (!active) return;
        if (data?.user?.mustChangePassword) {
          rejected = true;
          clearInvalidSession();
          return;
        }
        if (response.ok && data?.user) {
          const verifiedUser = data.user;
          const verifiedRole = normalizeUserRole(verifiedUser.role);
          setCurrentUser((user) => user?.token === storedToken
            ? {
                ...user,
                id: String(verifiedUser.id ?? user.id),
                name: String(verifiedUser.name ?? user.name),
                email: String(verifiedUser.email ?? user.email),
                phone: verifiedUser.phone ?? user.phone,
                role: verifiedRole,
                clusterId: verifiedUser.clusterId || user.clusterId || 'all',
                clusterName: verifiedUser.clusterName || user.clusterName,
                designation: verifiedRole === 'Super Admin' ? 'Statewide Super Admin' : 'Cluster Admin (College SPOC)',
                mustChangePassword: Boolean(verifiedUser.mustChangePassword),
              }
            : user);
          setCurrentUserRole(verifiedRole);
          setCurrentUserClusterId(verifiedUser.clusterId || 'all');
          setAuthValidatedToken(storedToken);
          setAuthStatus('authenticated');
        }
      } catch {
        // Brief network failures should not sign the user out.
      } finally {
        requestInFlight = false;
      }
    };

    // Defer the first request so React StrictMode's development-only effect
    // replay can cancel its first setup before any network request is sent.
    const initialCheck = window.setTimeout(() => void verifyPasswordState(), 0);
    return () => {
      active = false;
      window.clearTimeout(initialCheck);
      controller.abort();
    };
  }, [currentUser?.token]);

  // Core Data Collections (clean initial state from DB)
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [panchayats, setPanchayats] = useState<Panchayat[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [financeEntries, setFinanceEntries] = useState<FinanceEntry[]>([]);
  const [financeDrafts, setFinanceDrafts] = useState<FinanceDraft[]>([]);
  const [financeOfficerName, setFinanceOfficerName] = useState('TQI Finance Team');
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [photoGroups, setPhotoGroups] = useState<SessionPhotoGroup[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [areNotificationsLoaded, setAreNotificationsLoaded] = useState(false);
  const [toastNotification, setToastNotification] = useState<NotificationItem | null>(null);
  const seenNotificationIds = useRef<Set<string> | null>(null);
  const [dateChangeRequests, setDateChangeRequests] = useState<DateChangeRequest[]>([]);
  const [sessionReports, setSessionReports] = useState<SessionReport[]>([]);
  const [sessionSubmissions, setSessionSubmissions] = useState<SessionSubmission[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [areAcademicYearsLoading, setAreAcademicYearsLoading] = useState(true);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>(() => {
    try {
      return localStorage.getItem('tqi_selected_academic_year_id') || '';
    } catch {
      return '';
    }
  });
  const [modules, setModules] = useState<TqiModule[]>([]);
  const [moduleAcademicDays, setModuleAcademicDays] = useState<Array<{ dayNumber: number; sessionName: string }>>([]);

  const uniqueById = useCallback(<T extends { id?: string | number | null }>(items: T[] = []): T[] => {
    const next = new Map<string, T>();
    items.forEach((item) => {
      if (!item || item.id == null || item.id === '') return;
      const key = String(item.id);
      if (!next.has(key)) next.set(key, item);
    });
    return Array.from(next.values());
  }, []);

  // Sync with API Backend
  const fetchBackendData = useCallback(async (signal?: AbortSignal) => {
    if (authStatus !== 'authenticated' || !currentUser?.token) return;
    if (currentUserRole !== 'Super Admin' && maintenanceCheckedToken !== currentUser.token) return;
    if (currentUserRole !== 'Super Admin' && maintenanceState?.enabled) return;

    // 300 ms debounce — React 19 Strict Mode unmounts and remounts immediately
    // in dev. The abort from the first mount cancels this timer before the
    // requests fire, so only the second (surviving) mount actually fetches.
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 300);
      if (signal) {
        signal.addEventListener('abort', () => clearTimeout(t), { once: true });
      }
    });
    if (signal?.aborted) return;
    if (currentUserRole !== 'Super Admin' && (maintenanceCheckedToken !== currentUser.token || maintenanceState?.enabled)) return;

    const headers = {
      Authorization: `Bearer ${currentUser.token}`,
      'x-user-role': currentUserRole,
      'x-user-cluster-id': currentUserClusterId,
    };

    const get = (url: string) =>
      fetch(apiUrl(url), { headers, signal })
        .then((response) => {
          if (response.status === 401) {
            localStorage.removeItem('tqi_auth_session');
            setAuthStatus('unauthenticated');
            setCurrentUser(null);
            return null;
          }
          if (response.status === 403) {
            return response.json().then((data) => {
              if (data?.code === 'PASSWORD_CHANGE_REQUIRED') {
                localStorage.removeItem('tqi_auth_session');
                setAuthStatus('unauthenticated');
                setCurrentUser(null);
              }
              return null;
            }).catch(() => null);
          }
          return response.ok ? response.json() : null;
        })
        .catch(() => null);

    try {
      const [
        panchayatsRes,
        studentsRes,
        volunteersRes,
        sessionsRes,
        attendanceRes,
        financeRes,
        lessonPlansRes,
        approvalsRes,
        auditRes,
        notificationsRes,
        clustersRes,
        usersRes,
        dateChangeRequestsRes,
        sessionReportsRes,
        sessionSubmissionsRes,
        academicYearsRes,
        modulesRes,
        financeSettingsRes,
      ] = await Promise.all([
        get(`/api/panchayats?clusterId=${currentUserClusterId}&academicYearId=${encodeURIComponent(selectedAcademicYearId)}`),
        get(`/api/students?clusterId=${currentUserClusterId}&academicYearId=${encodeURIComponent(selectedAcademicYearId)}`),
        get(`/api/volunteers?clusterId=${currentUserClusterId}&academicYearId=${encodeURIComponent(selectedAcademicYearId)}`),
        get(`/api/sessions?clusterId=${currentUserClusterId}&academicYearId=${encodeURIComponent(selectedAcademicYearId)}`),
        get(`/api/attendance?clusterId=${currentUserClusterId}&academicYearId=${encodeURIComponent(selectedAcademicYearId)}`),
        get(`/api/finance?clusterId=${currentUserClusterId}`),
        get(`/api/lesson-plans?clusterId=${currentUserClusterId}&academicYearId=${encodeURIComponent(selectedAcademicYearId)}`),
        get(`/api/approvals?clusterId=${currentUserClusterId}&academicYearId=${encodeURIComponent(selectedAcademicYearId)}`),
        get(`/api/audit-logs?clusterId=${currentUserClusterId}`),
        get('/api/notifications'),
        get(`/api/clusters?includeArchived=true&academicYearId=${encodeURIComponent(selectedAcademicYearId)}`),
        currentUserRole === 'Super Admin' ? get('/api/users') : Promise.resolve({ users: [] }),
        get('/api/date-change-requests'),
        get('/api/session-reports'),
        get('/api/session-submissions'),
        get('/api/academic-years'),
        get(`/api/modules?academicYearId=${encodeURIComponent(selectedAcademicYearId)}`),
        get('/api/settings/finance'),
      ]);

      if (signal.aborted) return;

      if (Array.isArray(panchayatsRes?.panchayats))         setPanchayats(uniqueById(panchayatsRes.panchayats));
      if (Array.isArray(studentsRes?.students))             setStudents(uniqueById(studentsRes.students));
      if (Array.isArray(volunteersRes?.volunteers))         setVolunteers(uniqueById(volunteersRes.volunteers));
      if (Array.isArray(sessionsRes?.sessions))             setSessions(sessionsRes.sessions);
      if (Array.isArray(attendanceRes?.attendanceSessions)) setAttendanceSessions(attendanceRes.attendanceSessions);
      if (Array.isArray(financeRes?.financeEntries))        setFinanceEntries(financeRes.financeEntries);
      if (Array.isArray(financeRes?.financeDrafts))         setFinanceDrafts(financeRes.financeDrafts);
      if (Array.isArray(lessonPlansRes?.lessonPlans))       setLessonPlans(lessonPlansRes.lessonPlans);
      if (Array.isArray(approvalsRes?.approvals))           setApprovals(approvalsRes.approvals);
      if (Array.isArray(auditRes?.auditLogs))               setAuditLogs(auditRes.auditLogs);
      if (Array.isArray(notificationsRes?.notifications)) {
        setNotifications(notificationsRes.notifications);
        setAreNotificationsLoaded(true);
      }
      if (Array.isArray(clustersRes?.clusters))             setClusters(uniqueById(clustersRes.clusters));
      if (Array.isArray(usersRes?.users))                   setUsers(uniqueById(usersRes.users));
      if (typeof financeSettingsRes?.financeOfficerName === 'string') setFinanceOfficerName(financeSettingsRes.financeOfficerName);
      if (Array.isArray(dateChangeRequestsRes?.dateChangeRequests)) setDateChangeRequests(dateChangeRequestsRes.dateChangeRequests);
      else if (Array.isArray(dateChangeRequestsRes?.data)) setDateChangeRequests(dateChangeRequestsRes.data);

      if (Array.isArray(sessionReportsRes?.sessionReports)) setSessionReports(sessionReportsRes.sessionReports);
      else if (Array.isArray(sessionReportsRes?.data)) setSessionReports(sessionReportsRes.data);

      if (Array.isArray(sessionSubmissionsRes?.sessionSubmissions)) setSessionSubmissions(sessionSubmissionsRes.sessionSubmissions);
      else if (Array.isArray(sessionSubmissionsRes?.data)) setSessionSubmissions(sessionSubmissionsRes.data);
      const academicYearRows = Array.isArray(academicYearsRes?.academicYears)
        ? academicYearsRes.academicYears
        : Array.isArray(academicYearsRes?.data)
          ? academicYearsRes.data
          : null;
      if (academicYearRows) {
        setAcademicYears(academicYearRows.map((year: any) => ({
          id: String(year.id),
          name: String(year.name || ''),
          startDate: year.start_date || year.startDate || '',
          endDate: year.end_date || year.endDate || '',
          isActive: Boolean(year.is_active ?? year.isActive),
          is_active: year.is_active,
          status: String(year.status || (year.is_active ? 'ACTIVE' : 'DRAFT')).toUpperCase(),
          sessionCount: Number(year.session_count ?? year.sessionCount ?? 0),
          clusterCount: Number(year.cluster_count ?? year.clusterCount ?? 0),
          schoolCount: Number(year.school_count ?? year.schoolCount ?? 0),
          studentCount: Number(year.student_count ?? year.studentCount ?? 0),
          volunteerCount: Number(year.volunteer_count ?? year.volunteerCount ?? 0),
          createdBy: year.created_by || year.createdBy,
          createdAt: year.created_at || year.createdAt,
          updatedAt: year.updated_at || year.updatedAt,
          archivedAt: year.archived_at || null,
        })));
      }
      setAreAcademicYearsLoading(false);
      if (Array.isArray(modulesRes?.academicDays)) setModuleAcademicDays(modulesRes.academicDays);
      else if (Array.isArray(sessionsRes?.sessions)) {
        const dayMap = new Map<number, { dayNumber: number; sessionName: string }>();
        sessionsRes.sessions.forEach((session: any) => {
          const dayNumber = Number(session.dayNumber);
          const sessionName = String(session.name || session.title || '').trim();
          if (Number.isInteger(dayNumber) && dayNumber > 0 && sessionName && !dayMap.has(dayNumber)) {
            dayMap.set(dayNumber, { dayNumber, sessionName });
          }
        });
        setModuleAcademicDays([...dayMap.values()].sort((first, second) => first.dayNumber - second.dayNumber));
      }
      if (Array.isArray(modulesRes?.modules))                       setModules(modulesRes.modules);
      else if (Array.isArray(modulesRes?.data))                     setModules(modulesRes.data);
    } catch {
      setAreAcademicYearsLoading(false);
      // Network error or abort — keep existing in-memory state.
    }
  }, [authStatus, currentUser?.token, currentUserRole, currentUserClusterId, selectedAcademicYearId, maintenanceCheckedToken, maintenanceState?.enabled]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !currentUser?.token) return;
    if (currentUserRole !== 'Super Admin' && maintenanceCheckedToken !== currentUser.token) return;
    if (currentUserRole !== 'Super Admin' && maintenanceState?.enabled) return;
    const controller = new AbortController();
    fetchBackendData(controller.signal);
    return () => controller.abort();
  }, [authStatus, fetchBackendData, currentUser?.token, currentUserRole, maintenanceCheckedToken, maintenanceState?.enabled]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !currentUser?.token) {
      setMaintenanceState(null);
      setMaintenanceCheckedToken(null);
      return;
    }
    if (isJwtExpired(currentUser.token)) {
      localStorage.removeItem('tqi_auth_session');
      setAuthStatus('unauthenticated');
      setCurrentUser(null);
      return;
    }
    // Validate the saved JWT once before starting the maintenance poller. This
    // prevents two simultaneous 401s when a previously saved session is stale.
    if (authValidatedToken !== currentUser.token) return;
    const controller = new AbortController();
    let authenticationRejected = false;
    const loadMaintenance = async () => {
      if (authenticationRejected || controller.signal.aborted) return;
      if (maintenanceCheckedToken !== currentUser.token) setMaintenanceLoading(true);
      try {
        const response = await fetch(apiUrl('/api/system/maintenance'), {
          headers: { Authorization: `Bearer ${currentUser.token}` },
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.status === 401) {
          authenticationRejected = true;
          controller.abort();
          localStorage.removeItem('tqi_auth_session');
          setMaintenanceLoading(false);
          setAuthValidatedToken(null);
          setAuthStatus('unauthenticated');
          setCurrentUser(null);
          return;
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) return;
        setMaintenanceState(data.maintenance || null);
        setMaintenanceCheckedToken(currentUser.token);
      } catch {
        // Ignore transient maintenance fetch failures while keeping the current app visible.
      } finally {
        if (!controller.signal.aborted && maintenanceCheckedToken !== currentUser.token) setMaintenanceLoading(false);
      }
    };
    void loadMaintenance();
    const timer = window.setInterval(() => void loadMaintenance(), 10_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [authStatus, currentUser?.token, maintenanceCheckedToken, authValidatedToken]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !currentUser?.token) return;
    if (currentUserRole !== 'Super Admin' && maintenanceCheckedToken !== currentUser.token) return;
    if (currentUserRole !== 'Super Admin' && maintenanceState?.enabled) return;
    let active = true;
    const refreshNotifications = async () => {
      try {
        const response = await fetch(apiUrl('/api/notifications'), {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${currentUser.token}` },
        });
        if (!response.ok || !active) return;
        const data = await response.json().catch(() => null);
        if (Array.isArray(data?.notifications) && active) {
          setNotifications(data.notifications);
          setAreNotificationsLoaded(true);
        }
      } catch {
        // Keep the last known notifications while offline.
      }
    };
    const timer = window.setInterval(() => void refreshNotifications(), 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [authStatus, currentUser?.token, currentUserRole, maintenanceCheckedToken, maintenanceState?.enabled]);

  useEffect(() => {
    if (!areNotificationsLoaded) return;
    const currentIds = new Set(notifications.map((notification) => notification.id));
    if (seenNotificationIds.current === null) {
      seenNotificationIds.current = currentIds;
      return;
    }
    const newlyReceived = notifications.find((notification) => !notification.isRead && !seenNotificationIds.current?.has(notification.id));
    seenNotificationIds.current = currentIds;
    if (newlyReceived) setToastNotification(newlyReceived);
  }, [notifications, areNotificationsLoaded]);

  useEffect(() => {
    if (!toastNotification) return;
    const timer = window.setTimeout(() => setToastNotification(null), 8000);
    return () => window.clearTimeout(timer);
  }, [toastNotification]);

  useEffect(() => {
    if (!academicYears.length) return;

    if (!selectedAcademicYearId) {
      const fallback = academicYears.find((year) => year.isActive || year.status === 'ACTIVE') || academicYears[0];
      if (fallback) handleSelectAcademicYear(fallback.id);
      return;
    }

    const exists = academicYears.some((year) => year.id === selectedAcademicYearId);
    if (!exists) {
      handleSelectAcademicYear(academicYears[0].id);
    }
  }, [academicYears, selectedAcademicYearId]);

  function handleSelectAcademicYear(yearId: string) {
    if (yearId !== selectedAcademicYearId) {
      setClusters([]);
      setPanchayats([]);
      setStudents([]);
      setVolunteers([]);
      setSessions([]);
      setAttendanceSessions([]);
      setFinanceEntries([]);
      setFinanceDrafts([]);
      setLessonPlans([]);
      setApprovals([]);
      setDateChangeRequests([]);
      setSessionReports([]);
      setSessionSubmissions([]);
      setModules([]);
    }
    try {
      if (yearId) localStorage.setItem('tqi_selected_academic_year_id', yearId);
      else localStorage.removeItem('tqi_selected_academic_year_id');
    } catch {
      // Keep the in-memory selection if storage is unavailable.
    }
    setSelectedAcademicYearId(yearId);
  }

  // Auth Handlers
  const handleLoginSuccess = (session: AuthSession) => {
    const normalizedSession: AuthSession = {
      ...session,
      role: normalizeUserRole(session.role),
      clusterId: session.clusterId || 'all',
    };

    try {
      localStorage.setItem('tqi_auth_session', JSON.stringify(normalizedSession));
    } catch {
      // ignore
    }
    setCurrentUser(normalizedSession);
    setCurrentUserRole(normalizedSession.role);
    setAuthStatus('checking');
    setCurrentUserClusterId(normalizedSession.clusterId);
    setCurrentTab('dashboard');
    if (session.role === 'Super Admin') {
      setSelectedPanchayatId('vedakkattamaduvu');
    } else if (session.clusterId === 'salem') {
      setSelectedPanchayatId('yercaud');
    } else if (session.clusterId === 'namakkal') {
      setSelectedPanchayatId('kolli-hills');
    } else if (session.clusterId === 'dharmapuri') {
      setSelectedPanchayatId('vedakkattamaduvu');
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('tqi_auth_session');
    } catch {
      // ignore
    }
    setAuthStatus('unauthenticated');
    setCurrentUser(null);
    setCurrentTab('dashboard');
  };

  // Role switching
  const handleRoleChange = (role: UserRole, clusterId?: string) => {
    setCurrentUserRole(role);
    if (role === 'Cluster Admin' && clusterId) {
      setCurrentUserClusterId(clusterId);
    } else if (role === 'Super Admin') {
      setCurrentUserClusterId('all');
    }
  };

  // Super Admin Approval Actions
  const handleApproveSubmission = async (id: string, module: string, recordId: string) => {
    const response = module === 'Attendance'
      ? await fetch(apiUrl(`/api/attendance/${encodeURIComponent(recordId)}/review`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: currentUser?.token ? `Bearer ${currentUser.token}` : '' },
          body: JSON.stringify({ action: 'approve', academicYearId: selectedAcademicYearId }),
        })
      : await fetch(apiUrl(`/api/approvals/${encodeURIComponent(id)}/approve`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: currentUser?.token ? `Bearer ${currentUser.token}` : '',
            'x-user-role': currentUserRole,
            'x-user-cluster-id': currentUserClusterId,
          },
          body: JSON.stringify({ academicYearId: selectedAcademicYearId }),
        });
    const responseData = await response.json().catch(() => null);
    if (!response.ok || !responseData?.success) throw new Error(responseData?.error || `Unable to approve ${module.toLowerCase()}.`);

    setApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Approved' } : a))
    );

    if (module === 'Attendance') {
      setAttendanceSessions((prev) =>
        prev.map((s) => (s.id === recordId ? { ...s, status: 'Approved' } : s))
      );
    } else if (module === 'Lesson Plan') {
      setLessonPlans((prev) =>
        prev.map((lp) => (lp.id === recordId ? { ...lp, status: 'Approved' } : lp))
      );
    } else if (module === 'Finance') {
      setFinanceDrafts((prev) =>
        prev.map((fd) => (fd.id === recordId ? { ...fd, status: 'Approved' } : fd))
      );
      setFinanceEntries((prev) =>
        prev.map((fe) => (fe.id === recordId || fe.draftId === recordId ? { ...fe, status: 'Approved' } : fe))
      );
    }
    await fetchBackendData(new AbortController().signal);
  };

  const handleRequestCorrection = async (id: string, module: string, recordId: string, reason: string) => {
    const response = module === 'Attendance'
      ? await fetch(apiUrl(`/api/attendance/${encodeURIComponent(recordId)}/review`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: currentUser?.token ? `Bearer ${currentUser.token}` : '' },
          body: JSON.stringify({ action: 'request-resubmission', remarks: reason, academicYearId: selectedAcademicYearId }),
        })
      : await fetch(apiUrl(`/api/approvals/${encodeURIComponent(id)}/request-correction`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: currentUser?.token ? `Bearer ${currentUser.token}` : '',
          'x-user-role': currentUserRole,
          'x-user-cluster-id': currentUserClusterId,
        },
        body: JSON.stringify({ reason, academicYearId: selectedAcademicYearId }),
      });
    const responseData = await response.json().catch(() => null);
    if (!response.ok || !responseData?.success) throw new Error(responseData?.error || 'Unable to request correction.');

    setApprovals((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: 'Correction Requested', correctionReason: reason } : a
      )
    );

    if (module === 'Attendance') {
      setAttendanceSessions((prev) =>
        prev.map((s) =>
          s.id === recordId
            ? { ...s, status: 'Resubmission', correctionReason: reason, reviewRemarks: reason }
            : s
        )
      );
    } else if (module === 'Lesson Plan') {
      setLessonPlans((prev) =>
        prev.map((lp) =>
          lp.id === recordId
            ? { ...lp, status: 'Correction Requested', correctionReason: reason }
            : lp
        )
      );
    } else if (module === 'Finance') {
      setFinanceDrafts((prev) =>
        prev.map((fd) =>
          fd.id === recordId
            ? { ...fd, status: 'Correction Requested', correctionReason: reason }
            : fd
        )
      );
    }

    await fetchBackendData(new AbortController().signal);
  };

  const handleRejectSubmission = async (id: string, module: string, recordId: string, reason: string) => {
    try {
      await fetch(apiUrl(`/api/approvals/${id}/reject`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: currentUser?.token ? `Bearer ${currentUser.token}` : '',
          'x-user-role': currentUserRole,
          'x-user-cluster-id': currentUserClusterId,
        },
        body: JSON.stringify({ reason }),
      });
    } catch {
      // ignore
    }

    setApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Rejected', correctionReason: reason } : a))
    );
  };

  // Add Cluster Mutation
  const handleAddCluster = async (newC: Partial<Cluster>) => {
    try {
      const response = await fetch(apiUrl('/api/clusters'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: currentUser?.token ? `Bearer ${currentUser.token}` : '' },
        body: JSON.stringify({ ...newC, academicYearId: selectedAcademicYearId }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to create cluster.');
      if (data.cluster) setClusters((prev) => uniqueById([...prev, data.cluster]));
      if (data.user) setUsers((prev) => uniqueById([...prev, data.user]));
      else {
        const usersResponse = await fetch(apiUrl('/api/users'), { headers: { Authorization: currentUser?.token ? `Bearer ${currentUser.token}` : '' } });
        const usersData = await usersResponse.json();
        if (Array.isArray(usersData?.users)) setUsers(usersData.users);
      }
      return {
        emailSent: Boolean(data.emailSent),
        temporaryPassword: String(data.temporaryPassword || ''),
        loginEmail: String(data.loginEmail || newC.adminEmail || ''),
        clusterName: String(data.cluster?.name || newC.name || ''),
      };
    } catch (error: any) {
      throw error;
    }
  };

  const handleResendClusterCredentials = async (clusterId: string) => {
    const response = await fetch(apiUrl(`/api/clusters/${encodeURIComponent(clusterId)}/resend-credentials`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: currentUser?.token ? `Bearer ${currentUser.token}` : '',
      },
      body: JSON.stringify({ academicYearId: selectedAcademicYearId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to reset cluster credentials.');
    return {
      emailSent: Boolean(data.emailSent),
      temporaryPassword: String(data.temporaryPassword || ''),
      loginEmail: String(data.loginEmail || ''),
      clusterName: String(data.clusterName || ''),
    };
  };

  const handleUpdateCluster = async (clusterId: string, changes: Partial<Cluster>) => {
    const response = await fetch(apiUrl(`/api/clusters/${encodeURIComponent(clusterId)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: currentUser?.token ? `Bearer ${currentUser.token}` : '' },
      body: JSON.stringify({ ...changes, academicYearId: selectedAcademicYearId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to save cluster.');
    await fetchBackendData(new AbortController().signal);
    return true;
  };

  // Delete Cluster Mutation
  const handleDeleteCluster = async (clusterId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/clusters/${clusterId}`), {
        method: 'DELETE',
        headers: { Authorization: currentUser?.token ? `Bearer ${currentUser.token}` : '' },
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(result?.error || 'Failed to delete cluster.');
      }
      if (result?.deactivated) {
        await fetchBackendData(new AbortController().signal);
        return;
      }
      setClusters((prev) => prev.filter((c) => c.id !== clusterId));
      setUsers((prev) => prev.filter((u) => u.clusterId !== clusterId));
    } catch (error: any) {
      console.error('Failed to delete cluster:', error);
      throw error;
    }
  };

  // Add User Mutation
  const handleAddUser = async (newU: Partial<User>) => {
    try {
      const response = await fetch(apiUrl('/api/users'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: currentUser?.token ? `Bearer ${currentUser.token}` : '',
        },
        body: JSON.stringify(newU),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Unable to create user.');
      }
      if (data.user) {
        setUsers((prev) => [...prev, data.user]);
      }
      try {
        const cRes = await fetch(apiUrl('/api/clusters'), {
          headers: { Authorization: currentUser?.token ? `Bearer ${currentUser.token}` : '' },
        });
        const cData = await cRes.json();
        if (Array.isArray(cData?.clusters)) setClusters(cData.clusters);
      } catch {
        // ignore
      }
      return true;
    } catch (error: any) {
      throw error;
    }
  };

  const handleUpdateUser = async (id: string, user: Partial<User>) => {
    try {
      const response = await fetch(apiUrl(`/api/users/${id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token || ''}` }, body: JSON.stringify(user) });
      const data = await response.json();
      if (!response.ok || !data.success) { return false; }
      setUsers((prev) => prev.map((item) => item.id === id ? { ...item, ...data.user } : item));
      return true;
    } catch {
      return false;
    }
  };

  const handleDeleteUser = async (id: string) => {
    const response = await fetch(apiUrl(`/api/users/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${currentUser?.token || ''}` } });
    const data = await response.json();
    if (!response.ok || !data.success) return;
    setUsers((prev) => prev.filter((item) => item.id !== id));
  };

  const handleResetPassword = async (id: string) => {
    const response = await fetch(apiUrl(`/api/users/${id}/reset-password`), { method: 'POST', headers: { Authorization: `Bearer ${currentUser?.token || ''}` } });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data?.error || 'Unable to reset password.');
    if (data.user) setUsers((prev) => prev.map((item) => item.id === id ? { ...item, ...data.user } : item));
    await fetchBackendData(new AbortController().signal);
    return { temporaryPassword: String(data.temporaryPassword), user: data.user };
  };

  const handleAdminChangePassword = async (id: string, password: string) => {
    const response = await fetch(apiUrl(`/api/users/${encodeURIComponent(id)}/change-password`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token || ''}` },
      body: JSON.stringify({ password }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to change user password.');
    setUsers((prev) => prev.map((item) => item.id === id ? { ...item, mustChangePassword: false, passwordChangedAt: new Date().toISOString(), passwordStatus: 'SET' } : item));
    await fetchBackendData(new AbortController().signal);
  };

  // Navigation handlers
  const handleNavigate = (tab: TabType, targetId?: string, secondaryParam?: string) => {
    if (tab === 'panchayats' && targetId && currentUserRole === 'Super Admin') {
      setCurrentUserClusterId(targetId);
    }
    if (tab === 'panchayat-detail' && targetId) {
      setSelectedPanchayatId(targetId);
    }
    if (tab === 'students') {
      if (targetId || secondaryParam) {
        setInitialStudentFilters({
          panchayatId: targetId,
          villageId: secondaryParam,
        });
      }
    }
    if (tab === 'attendance-draft' || tab === 'attendance') {
      if (targetId) {
        setActiveDraftId(targetId);
      }
      setCurrentTab('attendance');
      return;
    }
    if (tab === 'lesson-plan') {
      if (targetId) {
        setSelectedLessonPlanId(targetId);
      } else {
        setSelectedLessonPlanId(undefined);
      }
      setCurrentTab('lesson-plan');
      return;
    }
    if (tab === 'finance-statement') {
      if (targetId) {
        const scopedTarget = targetId.match(/^finance:([^:]+):(.+)$/);
        if (scopedTarget) {
          setActiveFinanceClusterId(scopedTarget[1]);
          setActiveFinanceDraftId(scopedTarget[2]);
        } else {
          setActiveFinanceClusterId(undefined);
          setActiveFinanceDraftId(targetId);
        }
      } else {
        setActiveFinanceClusterId(undefined);
        setActiveFinanceDraftId(undefined);
      }
      setCurrentTab('finance-statement');
      return;
    }
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Panchayat mutations
  const handleAddPanchayat = async (newPanchayat: { name: string; clusterId: string }): Promise<Panchayat> => {
    if (!currentUser?.token) throw new Error('Sign in again before saving a panchayat.');
    if (!selectedAcademicYearId) throw new Error('Select an academic year before saving a panchayat.');
    const response = await fetch(apiUrl('/api/panchayats'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentUser.token}`,
      },
      body: JSON.stringify({
        name: newPanchayat.name,
        clusterId: newPanchayat.clusterId,
        academicYearId: selectedAcademicYearId,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success || !data?.panchayat?.id) {
      throw new Error(data?.error || 'Unable to save panchayat.');
    }

    const saved = data.panchayat;
    const created: Panchayat = {
      id: String(saved.id),
      name: String(saved.name),
      cluster: String(saved.cluster || ''),
      clusterId: String(saved.clusterId),
      academicYearId: String(saved.academicYearId || selectedAcademicYearId),
      villagesCount: 0,
      activeStudents: 0,
      volunteersCount: 0,
      status: 'On Track',
      villages: [],
    };
    setPanchayats((previous) => uniqueById([created, ...previous.filter((item) => item.id !== created.id)]));
    return created;
  };

  const handleAddVillage = async (panchayatId: string, villageName: string) => {
    if (!currentUser?.token) throw new Error('Sign in again before saving a village.');
    if (!selectedAcademicYearId) throw new Error('Select an academic year before saving a village.');
    const parentPanchayat = panchayats.find((panchayat) => panchayat.id === panchayatId);
    if (!parentPanchayat?.clusterId) throw new Error('Could not resolve the panchayat cluster.');

    const newVillageId = `v-${Date.now()}`;
    const response = await fetch(apiUrl('/api/villages'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentUser.token}`,
      },
      body: JSON.stringify({
        id: newVillageId,
        name: villageName,
        panchayat_id: panchayatId,
        cluster_id: parentPanchayat.clusterId,
        academicYearId: selectedAcademicYearId,
      }),
    });
    const data = await response.json().catch(() => null);
    if (response.status === 401) throw new Error('Your session has expired. Sign out and sign in again, then retry adding the village.');
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to save village.');

    const savedVillage = {
      id: String(data.data?.id || `${newVillageId}-${selectedAcademicYearId}`),
      name: villageName,
      studentCount: 0,
    };
    setPanchayats((previous) => previous.map((panchayat) => {
      if (panchayat.id !== panchayatId) return panchayat;
      if (panchayat.villages.some((village) => village.name.trim().toLowerCase() === villageName.trim().toLowerCase())) return panchayat;
      const villages = [...panchayat.villages, savedVillage];
      return { ...panchayat, villages, villagesCount: villages.length };
    }));
  };

  const handleUpdatePanchayat = (panchayatId: string, name: string) => {
    setPanchayats((prev) =>
      prev.map((p) => (p.id === panchayatId ? { ...p, name } : p))
    );
    setStudents((prev) =>
      prev.map((s) => (s.panchayatId === panchayatId ? { ...s, panchayatName: name } : s))
    );
  };

  const handleDeletePanchayat = async (panchayatId: string) => {
    if (!currentUser?.token) throw new Error('Sign in again before deleting a panchayat.');
    const response = await fetch(apiUrl(`/api/panchayats/${encodeURIComponent(panchayatId)}?academicYearId=${encodeURIComponent(selectedAcademicYearId)}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${currentUser.token}` },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to delete panchayat.');
    setPanchayats((prev) => prev.filter((p) => p.id !== panchayatId));
    setSelectedPanchayatId((selected) => selected === panchayatId ? '' : selected);
  };

  const handleUpdateVillage = (panchayatId: string, villageId: string, name: string) => {
    setPanchayats((prev) =>
      prev.map((p) => {
        if (p.id === panchayatId) {
          return {
            ...p,
            villages: p.villages.map((v) => (v.id === villageId ? { ...v, name } : v)),
          };
        }
        return p;
      })
    );
    setStudents((prev) =>
      prev.map((s) =>
        s.panchayatId === panchayatId && s.villageId === villageId
          ? { ...s, villageName: name }
          : s
      )
    );
  };

  const handleDeleteVillage = async (panchayatId: string, villageId: string) => {
    if (!currentUser?.token) throw new Error('Sign in again before deleting a village.');
    const response = await fetch(apiUrl(`/api/villages/${encodeURIComponent(villageId)}?panchayatId=${encodeURIComponent(panchayatId)}&academicYearId=${encodeURIComponent(selectedAcademicYearId)}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${currentUser.token}` },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to delete village.');
    setPanchayats((prev) => prev.map((p) => {
      if (p.id !== panchayatId) return p;
      const villages = p.villages.filter((v) => v.id !== villageId);
      return { ...p, villages, villagesCount: villages.length };
    }));
  };

  // Student mutations
  const handleAddStudent = async (newStudent: Omit<Student, 'id' | 'code' | 'avatarLetter' | 'avatarBg'>) => {
    const parentPanchayat = panchayats.find((panchayat) => panchayat.id === newStudent.panchayatId);
    const clusterId = parentPanchayat?.clusterId;
    if (!clusterId) throw new Error('Could not resolve the student’s cluster from the selected panchayat.');
    const newId = `stu-${Date.now()}`;
    const code = `STU-24-${String(students.length + 1).padStart(3, '0')}`;
    const avatarLetter = newStudent.name.charAt(0).toUpperCase();
    const colors = ['bg-[#0b3d91] text-white', 'bg-[#345baf] text-white', 'bg-[#521a00] text-white', 'bg-[#592600] text-white'];
    const avatarBg = colors[students.length % colors.length];

    const created: Student = {
      ...newStudent,
      clusterId,
      id: newId,
      code,
      avatarLetter,
      avatarBg,
    };
    setStudents((prev) => uniqueById([created, ...prev]));

    setPanchayats((prev) =>
      prev.map((p) => {
        if (p.id === newStudent.panchayatId) {
          const updatedVillages = p.villages.map((v) =>
            v.name === newStudent.villageName || v.id === newStudent.villageId
              ? { ...v, studentCount: v.studentCount + 1 }
              : v
          );
          return {
            ...p,
            activeStudents: p.activeStudents + 1,
            villages: updatedVillages,
          };
        }
        return p;
      })
    );

    if (currentUser?.token) {
      try {
        await fetch(apiUrl('/api/students'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentUser.token}`,
          },
          body: JSON.stringify({
            ...newStudent,
            id: newId,
            code,
            clusterId,
          }),
        });
      } catch (err) {
        console.error('Failed to persist student to backend:', err);
      }
    }
  };

  const handleBulkAddStudents = async (
    newStudentsList: Array<Omit<Student, 'id' | 'code' | 'avatarLetter' | 'avatarBg'>>,
    requestedClusterId?: string,
  ) => {
    if (!newStudentsList || newStudentsList.length === 0) return;

    const colors = [
      'bg-[#0b3d91] text-white',
      'bg-[#345baf] text-white',
      'bg-[#521a00] text-white',
      'bg-[#592600] text-white',
    ];

    const currentTotal = students.length;
    const createdBatch: Student[] = newStudentsList.map((st, idx) => {
      const parentPanchayat = panchayats.find((panchayat) => panchayat.id === st.panchayatId);
      if (!parentPanchayat?.clusterId) throw new Error(`Could not resolve the cluster for ${st.name || 'a student'}.`);
      if (requestedClusterId && requestedClusterId !== 'all' && requestedClusterId !== parentPanchayat.clusterId) {
        throw new Error('The import cluster does not match the selected panchayat.');
      }
      const codeNumber = currentTotal + idx + 1;
      return {
        ...st,
        clusterId: parentPanchayat.clusterId,
        id: `stu-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        code: `STU-24-${String(codeNumber).padStart(3, '0')}`,
        avatarLetter: (st.name || 'S').charAt(0).toUpperCase(),
        avatarBg: colors[(currentTotal + idx) % colors.length],
      };
    });
    if (createdBatch.some((student) => student.clusterId !== createdBatch[0]?.clusterId)) {
      throw new Error('Import students from one cluster at a time.');
    }

    setStudents((prev) => uniqueById([...createdBatch, ...prev]));

    setPanchayats((prev) =>
      prev.map((p) => {
        const matchingAdded = createdBatch.filter((s) => s.panchayatId === p.id);
        if (matchingAdded.length > 0) {
          const updatedVillages = p.villages.map((v) => {
            const villageAdded = matchingAdded.filter(
              (s) => s.villageId === v.id || s.villageName === v.name
            );
            return {
              ...v,
              studentCount: v.studentCount + villageAdded.length,
            };
          });
          return {
            ...p,
            activeStudents: p.activeStudents + matchingAdded.length,
            villages: updatedVillages,
          };
        }
        return p;
      })
    );

    if (currentUser?.token) {
      try {
        await fetch(apiUrl('/api/students/bulk'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentUser.token}`,
          },
          body: JSON.stringify({
            clusterId: createdBatch[0]?.clusterId || requestedClusterId,
            students: createdBatch,
          }),
        });
      } catch (err) {
        console.error('Failed to bulk persist students to backend:', err);
      }
    }
  };

  const handleUpdateStudent = async (id: string, updated: Partial<Student>) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
    if (currentUser?.token) {
      try {
        await fetch(apiUrl(`/api/students/${id}`), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentUser.token}`,
          },
          body: JSON.stringify(updated),
        });
      } catch (err) {
        console.error('Failed to update student in backend:', err);
      }
    }
  };

  const handleDeleteStudent = async (id: string) => {
    const toDelete = students.find((s) => s.id === id);
    if (toDelete) {
      setPanchayats((prev) =>
        prev.map((p) => {
          if (p.id === toDelete.panchayatId) {
            const updatedVillages = p.villages.map((v) =>
              v.name === toDelete.villageName || v.id === toDelete.villageId
                ? { ...v, studentCount: Math.max(0, v.studentCount - 1) }
                : v
            );
            return {
              ...p,
              activeStudents: Math.max(0, p.activeStudents - 1),
              villages: updatedVillages,
            };
          }
          return p;
        })
      );
    }
    setStudents((prev) => prev.filter((s) => s.id !== id));

    if (currentUser?.token) {
      try {
        await fetch(apiUrl(`/api/students/${id}`), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${currentUser.token}` },
        });
      } catch (err) {
        console.error('Failed to delete student from backend:', err);
      }
    }
  };

  // Volunteer mutations
  const handleAddVolunteer = async (newVol: Omit<Volunteer, 'id' | 'avatarText' | 'recentSessions' | 'totalSessions' | 'attendanceRate'>) => {
    const newId = `vol-${Date.now()}`;
    const names = newVol.name.split(' ');
    const avatarText = names.length > 1 ? `${names[0][0]}${names[1][0]}`.toUpperCase() : newVol.name.slice(0, 2).toUpperCase();

    const created: Volunteer = {
      ...newVol,
      clusterId: newVol.clusterId || currentUserClusterId,
      id: newId,
      avatarText,
      totalSessions: 0,
      attendanceRate: 100,
      recentSessions: [],
    };
    setVolunteers((prev) => [created, ...prev]);

    try {
      if (currentUser?.token) {
        const response = await fetch(apiUrl('/api/volunteers'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentUser.token}`,
          },
          body: JSON.stringify({
            ...newVol,
            id: newId,
            clusterId: newVol.clusterId || currentUserClusterId,
            academicYearId: selectedAcademicYearId,
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to save volunteer.');
      }
    } catch (error) {
      setVolunteers((previous) => previous.filter((volunteer) => volunteer.id !== newId));
      throw error;
    }
  };

  const handleUpdateVolunteer = async (id: string, updated: Partial<Volunteer>) => {
    const previousVolunteer = volunteers.find((volunteer) => volunteer.id === id);
    setVolunteers((previous) => previous.map((volunteer) => volunteer.id === id ? { ...volunteer, ...updated } : volunteer));
    try {
      if (currentUser?.token) {
        const response = await fetch(apiUrl(`/api/volunteers/${encodeURIComponent(id)}`), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentUser.token}`,
          },
          body: JSON.stringify({ ...updated, academicYearId: selectedAcademicYearId }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to save volunteer changes.');
      }
    } catch (error) {
      if (previousVolunteer) {
        setVolunteers((previous) => previous.map((volunteer) => volunteer.id === id ? previousVolunteer : volunteer));
      }
      throw error;
    }
  };

  const handleBulkImportVolunteers = async (
    bulkVolunteers: Array<Pick<Volunteer, 'name' | 'year' | 'department' | 'email' | 'phone'>>,
    clusterId: string,
  ) => {
    if (!currentUser?.token) throw new Error('You must be signed in to import volunteers.');
    const response = await fetch(apiUrl('/api/volunteers/bulk'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ volunteers: bulkVolunteers, clusterId, academicYearId: selectedAcademicYearId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to upload volunteers.');
    await fetchBackendData(new AbortController().signal);
  };

  const handleDeleteVolunteer = async (id: string) => {
    setVolunteers((prev) => prev.filter((v) => v.id !== id));
    if (currentUser?.token) {
      try {
        await fetch(apiUrl(`/api/volunteers/${id}`), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${currentUser.token}` },
        });
      } catch (err) {
        console.error('Failed to delete volunteer from backend:', err);
      }
    }
  };

  // Session mutations
  const handleAddSession = async (newSession: Omit<Session, 'id'>) => {
    if (!currentUser?.token) throw new Error('You must be signed in to schedule sessions.');
    const response = await fetch(apiUrl('/api/sessions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ ...newSession, academicYearId: selectedAcademicYearId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success || !data.session) throw new Error(data?.error || 'Unable to schedule session.');
    const created: Session = { ...newSession, ...data.session, id: String(data.session.id) };
    setSessions((previous) => [created, ...previous.filter((session) => !(session.clusterId === created.clusterId && session.dayNumber === created.dayNumber))]);
  };

  const handleUpdateSession = async (id: string, updated: Partial<Session>) => {
    const existing = sessions.find((session) => session.id === id);
    if (currentUser?.token && existing) {
      const response = await fetch(apiUrl(`/api/sessions/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
        body: JSON.stringify({
          ...existing,
          ...updated,
          academicYear: existing.academicYear,
          academicYearId: selectedAcademicYearId,
          dayNumber: existing.dayNumber,
          sessionName: updated.name || updated.title || existing.name,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to save session changes.');
    }
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
  };

  const handleApproveSessionDate = async (session: Session, date: string) => {
    if (!currentUser?.token) throw new Error('You must be signed in to approve session dates.');
    const response = await fetch(apiUrl(`/api/sessions/${encodeURIComponent(session.id)}/approve-date`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({
        date,
        dayNumber: session.dayNumber,
        clusterId: session.clusterId,
        academicYearId: selectedAcademicYearId,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success || !data.session) throw new Error(data?.error || 'Unable to approve session date.');
    const approvedSession = { ...session, ...data.session } as Session;
    setSessions((previous) => previous.map((item) => item.id === session.id || (item.clusterId === session.clusterId && item.dayNumber === session.dayNumber)
      ? { ...item, ...approvedSession }
      : item));
    await fetchBackendData(new AbortController().signal);
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  // Attendance mutations
  const handleSaveAttendance = async (session: AttendanceSession) => {
    if (currentUserRole === 'Cluster Admin' && currentUser?.token) {
      const response = await fetch(apiUrl('/api/attendance'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
        body: JSON.stringify({ ...session, academicYearId: selectedAcademicYearId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to save attendance.');
    }

    setAttendanceSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === session.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = session;
        return copy;
      }
      return [session, ...prev];
    });

    if (session.status === 'Submitted') {
      const newAppr: ApprovalItem = {
        id: `appr-${Date.now()}`,
        module: 'Attendance',
        recordId: session.id,
        recordTitle: `${session.panchayatName || 'Center'} · ${session.villageName || 'All Villages'} · Day ${session.dayNumber || 1}`,
        clusterId: session.clusterId || currentUserClusterId,
        clusterName: clusters.find((cluster) => cluster.id === session.clusterId)?.name || 'Cluster',
        submittedBy: currentUser?.name || 'Cluster Admin',
        submittedAt: 'Just now',
        status: 'Pending',
        details: {
          attendanceType: session.attendanceType || 'students',
          presentCount: session.presentCount || session.records?.filter((s) => s.status === 'Present').length || 0,
          totalCount: session.totalCount || session.records?.length || 0,
          panchayatName: session.panchayatName || '',
          villageName: session.villageName || '',
          dayNumber: session.dayNumber || 1,
          records: session.records || [],
          volunteerAttendance: session.volunteerAttendance || [],
        },
      };
      setApprovals((prev) => [newAppr, ...prev]);
    }
  };

  const handleReviewAttendance = async (
    attendanceId: string,
    action: 'approve' | 'request-resubmission' | 'approve-edit' | 'deny-edit',
    remarks: string,
  ) => {
    const response = await fetch(apiUrl(`/api/attendance/${encodeURIComponent(attendanceId)}/review`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: currentUser?.token ? `Bearer ${currentUser.token}` : '',
      },
      body: JSON.stringify({ action, remarks, academicYearId: selectedAcademicYearId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || 'Unable to update the attendance review.');
    }
    setAttendanceSessions((previous) => previous.map((attendance) => attendance.id === attendanceId
      ? { ...attendance, status: data.status, reviewRemarks: data.reviewRemarks || undefined }
      : attendance));
    if (action === 'approve' || action === 'request-resubmission') {
      setApprovals((previous) => previous.map((approval) => approval.module === 'Attendance' && approval.recordId === attendanceId
        ? { ...approval, status: action === 'approve' ? 'Approved' : 'Correction Requested' }
        : approval));
      await fetchBackendData(new AbortController().signal);
    }
  };

  const handleRequestAttendanceEdit = async (attendanceId: string, reason: string) => {
    const response = await fetch(apiUrl(`/api/attendance/${encodeURIComponent(attendanceId)}/request-edit`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: currentUser?.token ? `Bearer ${currentUser.token}` : '' },
      body: JSON.stringify({ reason, academicYearId: selectedAcademicYearId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to request attendance edit approval.');
    setAttendanceSessions((previous) => previous.map((attendance) => attendance.id === attendanceId
      ? { ...attendance, status: 'Edit Requested', editReason: reason }
      : attendance));
  };

  const handleAdminEditAttendance = async (
    attendanceId: string,
    records: AttendanceSession['records'],
    volunteerAttendance: NonNullable<AttendanceSession['volunteerAttendance']>,
  ) => {
    if (!currentUser?.token) throw new Error('You must be signed in to edit attendance.');
    const attendance = attendanceSessions.find((item) => item.id === attendanceId);
    const response = await fetch(apiUrl(`/api/attendance/${encodeURIComponent(attendanceId)}/admin-edit`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({
        academicYearId: selectedAcademicYearId,
        records,
        volunteerAttendance,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to save attendance changes.');
    setAttendanceSessions((previous) => previous.map((item) => item.id === attendanceId
      ? {
          ...item,
          records: attendance?.attendanceType === 'volunteers' ? item.records : records,
          volunteerAttendance: attendance?.attendanceType === 'volunteers' ? volunteerAttendance : item.volunteerAttendance,
          totalCount: data.totalCount,
          presentCount: data.presentCount,
          absentCount: Math.max(0, data.totalCount - data.presentCount),
          tasksCompletedCount: data.taskCompletedCount,
        }
      : item));
  };

  const handleAdminDeleteAttendance = async (attendanceId: string) => {
    if (!currentUser?.token) throw new Error('You must be signed in to delete attendance.');
    const response = await fetch(apiUrl(`/api/attendance/${encodeURIComponent(attendanceId)}?academicYearId=${encodeURIComponent(selectedAcademicYearId)}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${currentUser.token}` },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to delete this attendance submission.');
    setAttendanceSessions((previous) => previous.filter((item) => item.id !== attendanceId));
    setApprovals((previous) => previous.filter((item) => !(item.module === 'Attendance' && item.recordId === attendanceId)));
  };

  // Finance mutations
  const handleAddFinanceEntry = async (entry: Omit<FinanceEntry, 'id'>) => {
    const created: FinanceEntry = {
      ...entry,
      id: `fin-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    setFinanceEntries((prev) => [created, ...prev]);

    if (currentUser?.token) {
      try {
        const response = await fetch(apiUrl('/api/finance'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentUser.token}`,
          },
          body: JSON.stringify({
            ...created,
            clusterId: currentUserClusterId,
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Unable to save finance entry.');
        }
        setFinanceEntries((previous) => previous.map((entry) => entry.id === created.id
          ? { ...entry, status: data.financeEntry?.status || entry.status }
          : entry));
      } catch (err) {
        console.error('Failed to persist finance entry to backend:', err);
        setFinanceEntries((prev) => prev.filter((item) => item.id !== created.id));
        throw err;
      }
    }
  };

  const handleUpdateFinanceEntry = async (id: string, updated: Partial<FinanceEntry>) => {
    const existing = financeEntries.find((entry) => entry.id === id);
    if (!existing) throw new Error('Finance entry was not found. Refresh and try again.');
    const merged = { ...existing, ...updated, id };
    if (!currentUser?.token) throw new Error('Sign in again before updating finance.');
    const response = await fetch(apiUrl('/api/finance'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ ...merged, clusterId: merged.clusterId || currentUserClusterId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to update finance entry.');
    const savedEntry = { ...merged, status: data.financeEntry?.status || merged.status };
    setFinanceEntries((prev) => prev.map((entry) => (entry.id === id ? savedEntry : entry)));
    if (existing.draftId && savedEntry.status === 'Draft') {
      setFinanceDrafts((prev) => prev.map((draft) => draft.id === existing.draftId
        ? { ...draft, status: 'Draft', reportStatus: 'DRAFT' }
        : draft));
    }
  };

  const handleDeleteFinanceEntry = async (id: string) => {
    if (!currentUser?.token) throw new Error('Sign in again before deleting a finance entry.');
    const response = await fetch(apiUrl(`/api/finance/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${currentUser.token}` },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to delete finance entry.');
    setFinanceEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleSaveFinanceDraft = async (draft: FinanceDraft) => {
    if (!currentUser?.token) throw new Error('Sign in again before saving this finance report.');
    const response = await fetch(apiUrl('/api/finance/reports'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ report: draft }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to save finance report.');
    setFinanceDrafts((prev) => {
      const idx = prev.findIndex((d) => d.id === draft.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = draft;
        return copy;
      }
      return [draft, ...prev];
    });
    await fetchBackendData(new AbortController().signal);
  };

  const handleRequestFinanceEdit = async (entryId: string, reason: string) => {
    if (!currentUser?.token) throw new Error('Sign in again before requesting a finance edit.');
    const response = await fetch(apiUrl(`/api/finance/${encodeURIComponent(entryId)}/request-edit`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentUser.token}`,
      },
      body: JSON.stringify({ reason }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || 'Unable to request a finance edit approval.');
    }

    await fetchBackendData(new AbortController().signal);
  };

  const handleReviewFinanceEditRequest = async (draftId: string, action: 'approve' | 'reject', reason?: string) => {
    if (!currentUser?.token) throw new Error('Sign in again before reviewing finance edit requests.');
    const response = await fetch(apiUrl(`/api/finance/reports/${encodeURIComponent(draftId)}/edit-request`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ action, reason }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to review finance edit request.');
    await fetchBackendData(new AbortController().signal);
  };

  const handleDeleteFinanceDraft = async (draftId: string) => {
    if (!currentUser?.token) throw new Error('Sign in again before deleting this draft.');
    const response = await fetch(apiUrl(`/api/finance/reports/${encodeURIComponent(draftId)}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${currentUser.token}` },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to delete finance draft.');
    setFinanceDrafts((prev) => prev.filter((d) => d.id !== draftId));
    setFinanceEntries((prev) => prev.filter((entry) => entry.draftId !== draftId));
  };

  const handleSaveFinanceOfficerName = async (name: string) => {
    if (!currentUser?.token) throw new Error('You must be signed in to update finance settings.');
    const response = await fetch(apiUrl('/api/settings/finance'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ financeOfficerName: name }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to save the finance officer name.');
    setFinanceOfficerName(data.financeOfficerName);
  };

  const handleSubmitFinanceDraft = async (draftId: string, missingBillReason?: string) => {
    if (!currentUser?.token) throw new Error('Sign in again before submitting finance.');
    const targetDraft = financeDrafts.find((draft) => draft.id === draftId);
    let groupedEntries = financeEntries.filter((entry) => entry.draftId === draftId);

    if (!groupedEntries.length) {
      const draftResponse = await fetch(apiUrl(`/api/finance?draftId=${encodeURIComponent(draftId)}`), {
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      const draftData = await draftResponse.json().catch(() => null);
      if (draftResponse.ok && Array.isArray(draftData?.financeEntries)) {
        groupedEntries = draftData.financeEntries;
      }
    }

    const clusterId = targetDraft?.clusterId || groupedEntries[0]?.clusterId || currentUserClusterId;
    const response = await fetch(apiUrl('/api/finance/submit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({
        draftId,
        clusterId,
        academicYearId: selectedAcademicYearId,
        entryIds: groupedEntries.map((entry) => entry.id),
        entries: groupedEntries.map((entry) => ({
          id: entry.id,
          amount: Number(entry.amount || 0),
          billUrl: entry.billUrl || undefined,
          billDetectedAmount: entry.billDetectedAmount != null ? Number(entry.billDetectedAmount) : undefined,
        })),
        missingBillReason: missingBillReason?.trim() || undefined,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || 'Unable to submit finance for approval.');
    }

    setFinanceDrafts((previous) => previous.map((draft) => draft.id === draftId ? { ...draft, status: 'Pending' } : draft));
    setFinanceEntries((previous) => previous.map((entry) =>
      entry.draftId === draftId ? { ...entry, status: 'Pending' } : entry
    ));
    await fetchBackendData(new AbortController().signal);
  };

  const handleApproveFinanceReport = async (draftId?: string) => {
    if (!draftId) return;
    const approval = approvals.find((item) => item.module === 'Finance' && item.recordId === draftId && item.status === 'Pending');
    if (!approval || !currentUser?.token) throw new Error('Pending finance approval was not found. Refresh and try again.');
    const response = await fetch(apiUrl(`/api/approvals/${encodeURIComponent(approval.id)}/approve`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ academicYearId: selectedAcademicYearId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to approve finance report.');
    await fetchBackendData(new AbortController().signal);
  };

  const handleRejectFinanceReport = async (draftId?: string, reason?: string) => {
    if (!draftId) return;
    const approval = approvals.find((item) => item.module === 'Finance' && item.recordId === draftId && item.status === 'Pending');
    if (!approval || !currentUser?.token) throw new Error('Pending finance approval was not found. Refresh and try again.');
    const response = await fetch(apiUrl(`/api/approvals/${encodeURIComponent(approval.id)}/reject`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ reason: reason || 'No reason provided' }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to reject finance report.');
    await fetchBackendData(new AbortController().signal);
  };

  // Lesson Plan mutations
  const handleAddLessonPlan = async (plan: Omit<LessonPlan, 'id'>) => {
    if (!currentUser?.token) throw new Error('Sign in is required to save a lesson plan.');
    const response = await fetch(apiUrl('/api/lesson-plans'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentUser.token}`,
      },
      body: JSON.stringify({ ...plan, academicYearId: selectedAcademicYearId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to save lesson plan.');
    await fetchBackendData(new AbortController().signal);
  };

  const handleUpdateLessonPlan = async (id: string, plan: Partial<LessonPlan>) => {
    if (!currentUser?.token) throw new Error('Sign in is required to update a lesson plan.');
    const existing = lessonPlans.find((p) => p.id === id);
    const response = await fetch(apiUrl('/api/lesson-plans'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentUser.token}`,
      },
      body: JSON.stringify({ ...(existing || {}), ...plan, id, academicYearId: selectedAcademicYearId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to update lesson plan.');
    await fetchBackendData(new AbortController().signal);
  };

  const handleReviewLessonPlan = async (id: string, action: 'approve' | 'correction', reason?: string) => {
    if (!currentUser?.token) throw new Error('Sign in is required to review a lesson plan.');
    const response = await fetch(apiUrl(`/api/lesson-plans/${encodeURIComponent(id)}/review`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ action, reason, academicYearId: selectedAcademicYearId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to review lesson plan.');
    await fetchBackendData(new AbortController().signal);
  };

  const handleRequestLessonPlanAction = async (id: string, type: 'edit' | 'delete', reason: string) => {
    if (!currentUser?.token) throw new Error('Sign in is required to request lesson-plan access.');
    const response = await fetch(apiUrl(`/api/lesson-plans/${encodeURIComponent(id)}/requests`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ type, reason, academicYearId: selectedAcademicYearId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to send lesson-plan request.');
    await fetchBackendData(new AbortController().signal);
  };

  const handleReviewLessonPlanRequest = async (approvalId: string, action: 'approve' | 'reject') => {
    if (!currentUser?.token) throw new Error('Sign in is required to review this request.');
    const response = await fetch(apiUrl(`/api/lesson-plan-requests/${encodeURIComponent(approvalId)}/review`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ action, academicYearId: selectedAcademicYearId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to review lesson-plan request.');
    await fetchBackendData(new AbortController().signal);
  };

  const handleDeleteLessonPlan = async (id: string) => {
    if (!currentUser?.token) throw new Error('Sign in is required to delete a lesson plan.');
    const response = await fetch(apiUrl(`/api/lesson-plans/${encodeURIComponent(id)}?academicYearId=${encodeURIComponent(selectedAcademicYearId)}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${currentUser.token}` },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to delete lesson plan.');
    await fetchBackendData(new AbortController().signal);
  };

  // Notification actions
  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    if (!currentUser?.token) return;
    try {
      const response = await fetch(apiUrl(`/api/notifications/${encodeURIComponent(id)}/read`), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (!response.ok) console.error('Unable to mark notification as read.');
    } catch (error) {
      console.error('Unable to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (!currentUser?.token) return;
    try {
      const response = await fetch(apiUrl('/api/notifications/read-all'), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (!response.ok) console.error('Unable to mark notifications as read.');
    } catch (error) {
      console.error('Unable to mark notifications as read:', error);
    }
  };

  // Date Change Request handlers
  const handleSubmitDateChangeRequest = async (sessionId: string, originalDate: string, requestedDate: string, reason: string) => {
    const response = await fetch(apiUrl('/api/date-change-requests'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token || ''}` },
      body: JSON.stringify({ sessionId, originalDate, requestedDate, reason, academicYearId: selectedAcademicYearId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success || !(data.request || data.dateChangeRequest)) {
      throw new Error(data?.error || 'Unable to submit date change request.');
    }
    const request = data.request || data.dateChangeRequest;
    setDateChangeRequests((previous) => [request, ...previous.filter((item) => item.id !== request.id)]);
  };

  const handleReviewDateChangeRequest = async (requestId: string, action: 'approve' | 'reject', remarks: string) => {
    const response = await fetch(apiUrl(`/api/date-change-requests/${encodeURIComponent(requestId)}/${action}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token || ''}` },
      body: JSON.stringify({ remarks, academicYearId: selectedAcademicYearId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to review date change request.');
    const request = dateChangeRequests.find((item) => item.id === requestId);
    setDateChangeRequests((previous) => previous.map((item) => item.id === requestId
      ? { ...item, status: action === 'approve' ? 'APPROVED' : 'REJECTED', reviewRemarks: remarks }
      : item));
    if (action === 'approve' && request) {
      setSessions((previous) => previous.map((session) => session.id === request.sessionId
        ? { ...session, date: request.requestedDate, dateFixed: true, status: 'Scheduled' }
        : session));
    }
    await fetchBackendData(new AbortController().signal);
  };

  // Session Report handlers
  const handleSaveSessionReport = async (report: Partial<SessionReport>) => {
    const response = await fetch(apiUrl('/api/session-reports'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token || ''}` },
      body: JSON.stringify({ ...report, academicYearId: selectedAcademicYearId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success || !data.sessionReport) {
      throw new Error(data?.error || 'Unable to save session report.');
    }
    setSessionReports((previous) => {
      const index = previous.findIndex((item) => item.id === data.sessionReport.id);
      if (index >= 0) {
        const copy = [...previous];
        copy[index] = { ...data.sessionReport, photos: data.sessionReport.photos?.length ? data.sessionReport.photos : previous[index].photos };
        return copy;
      }
      return [data.sessionReport, ...previous];
    });
    return data.sessionReport as SessionReport;
  };

  const handleDeleteSessionReport = async (reportId: string) => {
    const response = await fetch(apiUrl(`/api/session-reports/${reportId}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${currentUser?.token || ''}` },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to delete session report.');
    setSessionReports((previous) => previous.filter((item) => item.id !== reportId));
  };

  const handleSessionReportWorkflowUpdate = (reportId: string, status: string, fields: Partial<SessionReport> = {}) => {
    setSessionReports((previous) => status === 'DELETED'
      ? previous.filter((report) => report.id !== reportId)
      : previous.map((report) => report.id === reportId ? { ...report, ...fields, status: status as SessionReport['status'], updatedAt: new Date().toISOString() } : report));
  };

  // Session Submission handlers
  const handleSubmitSession = async (sessionId: string, clusterId: string, dayNumber: number) => {
    try {
      const response = await fetch(apiUrl('/api/session-submissions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token || ''}` },
        body: JSON.stringify({ sessionId, clusterId, dayNumber }),
      });
      const data = await response.json();
      if (data?.success && data.submission) {
        setSessionSubmissions(prev => [data.submission, ...prev]);
        return { success: true };
      }
      return { success: false, error: data?.error, missingItems: data?.missingItems };
    } catch {
      return { success: false, error: 'Network error' };
    }
  };

  const handleReviewSubmission = async (submissionId: string, action: 'approve' | 'resubmission', remarks: string) => {
    try {
      await fetch(apiUrl(`/api/session-submissions/${submissionId}/review`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token || ''}` },
        body: JSON.stringify({ action, remarks }),
      });
      setSessionSubmissions(prev => prev.map(s => s.id === submissionId ? {
        ...s,
        status: action === 'approve' ? 'APPROVED' : 'RESUBMISSION_REQUIRED',
        reviewRemarks: remarks,
      } : s));
    } catch { /* ignore */ }
  };

  const handleResubmitSession = async (submissionId: string) => {
    try {
      await fetch(apiUrl(`/api/session-submissions/${submissionId}/resubmit`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token || ''}` },
      });
      setSessionSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, status: 'RESUBMITTED' } : s));
    } catch { /* ignore */ }
  };

  // Module handlers
  const handleCreateModule = async (moduleData: { moduleNumber: string; moduleName: string; topic: string; description: string; academicYear: string; dayNumber: number }) => {
    const response = await fetch(apiUrl('/api/modules'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token || ''}` },
      body: JSON.stringify({ ...moduleData, academicYearId: selectedAcademicYearId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success || !data?.module?.id) throw new Error(data?.error || 'Unable to create module.');
    const moduleId = String(data.module.id);
    const newMod: TqiModule = {
      id: moduleId,
      moduleNumber: moduleData.moduleNumber,
      moduleName: moduleData.moduleName,
      topic: moduleData.topic,
      description: moduleData.description,
      academicYear: moduleData.academicYear,
      dayNumber: moduleData.dayNumber,
      status: 'Active',
      version: 1,
      resources: [],
      createdBy: currentUser?.name || 'Super Admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setModules((previous) => [newMod, ...previous]);
    return moduleId;
  };

  const handleUpdateModule = async (id: string, moduleData: any) => {
    const response = await fetch(apiUrl(`/api/modules/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token || ''}` },
      body: JSON.stringify({ ...moduleData, academicYearId: selectedAcademicYearId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to update module.');
    setModules((previous) => previous.map((module) => module.id === id ? { ...module, ...moduleData } : module));
  };

  const handleDeleteModule = async (id: string) => {
    const response = await fetch(apiUrl(`/api/modules/${id}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${currentUser?.token || ''}` },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to archive module.');
    setModules((previous) => previous.filter((module) => module.id !== id));
  };

  const handleUploadModuleResource = async (moduleId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(apiUrl(`/api/modules/${moduleId}/resources`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentUser?.token || ''}` },
      body: formData,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success || !data.resource) throw new Error(data?.error || 'Unable to upload module resource.');
    setModules((previous) => previous.map((module) => module.id === moduleId
      ? { ...module, resources: [...(module.resources || []), data.resource] }
      : module));
  };

  const handleViewModuleResource = async (moduleId: string, resourceId: string) => {
    const previewWindow = window.open('about:blank', '_blank');
    try {
      const response = await fetch(apiUrl(`/api/modules/${moduleId}/resources/${resourceId}/download?inline=1`), {
        headers: { Authorization: `Bearer ${currentUser?.token || ''}` },
      });
      if (!response.ok) throw new Error('Unable to open this resource.');
      const url = URL.createObjectURL(await response.blob());
      if (previewWindow) previewWindow.location.href = url;
      else window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      previewWindow?.close();
      console.error('Failed to preview module resource:', error);
    }
  };

  const handleDownloadModuleResource = async (moduleId: string, resourceId: string) => {
    try {
      const response = await fetch(apiUrl(`/api/modules/${moduleId}/resources/${resourceId}/download`), {
        headers: { Authorization: `Bearer ${currentUser?.token || ''}` },
      });
      if (!response.ok) throw new Error('Unable to download this resource.');
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = modules.find((module) => module.id === moduleId)?.resources.find((resource) => resource.id === resourceId)?.fileName || 'module-resource';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download module resource:', error);
    }
  };

  const handleDeleteModuleResource = async (moduleId: string, resourceId: string) => {
    const response = await fetch(apiUrl(`/api/modules/${moduleId}/resources/${resourceId}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${currentUser?.token || ''}` },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to delete this resource.');
    setModules((previous) => previous.map((module) => module.id === moduleId
      ? { ...module, resources: module.resources.filter((resource) => resource.id !== resourceId) }
      : module));
  };

  if (authStatus === 'checking') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p role="status" aria-live="polite">Checking your session…</p>
      </main>
    );
  }

  // If user is logged out, render the Login Page
  if (authStatus === 'unauthenticated' || !currentUser?.token) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Scoped Data Lists based on Logged-in User Role and Cluster
  const displayPanchayats = currentUserRole === 'Super Admin'
    ? panchayats
    : panchayats.filter((p) => p.clusterId === currentUserClusterId);

  const displayPanchayatIds = new Set(displayPanchayats.map((p) => p.id));

  const displayStudents = currentUserRole === 'Super Admin'
    ? students
    : students.filter((s) => displayPanchayatIds.has(s.panchayatId));

  const displayVolunteers = currentUserRole === 'Super Admin'
    ? volunteers
    : volunteers.filter((v) => !v.panchayatId || displayPanchayatIds.has(v.panchayatId) || v.clusterId === currentUserClusterId);

  const displaySessions = currentUserRole === 'Super Admin'
    ? sessions
    : sessions.filter((s) => displayPanchayatIds.has(s.panchayatId) || s.clusterId === currentUserClusterId);

  const displayAttendance = currentUserRole === 'Super Admin'
    ? attendanceSessions
    : attendanceSessions.filter((a) => displayPanchayatIds.has(a.panchayatId) || a.clusterId === currentUserClusterId);

  const displayFinance = financeEntries.filter((f) => {
    if (currentUserRole === 'Super Admin') {
      return true;
    }
    return !f.panchayatId || displayPanchayatIds.has(f.panchayatId) || f.clusterId === currentUserClusterId;
  });

  const displayFinanceDrafts = currentUserRole === 'Super Admin'
    ? financeDrafts
    : financeDrafts.filter((fd) => !fd.clusterId || fd.clusterId === currentUserClusterId);

  const displayLessonPlans = currentUserRole === 'Super Admin'
    ? lessonPlans
    : lessonPlans.filter((lp) => !lp.clusterId || lp.clusterId === currentUserClusterId || (lp.panchayatId && displayPanchayatIds.has(lp.panchayatId)));

  const displayApprovals = currentUserRole === 'Super Admin'
    ? approvals
    : approvals.filter((a) => a.clusterId === currentUserClusterId);

  const displayAuditLogs = currentUserRole === 'Super Admin'
    ? auditLogs
    : auditLogs.filter((al) => al.clusterId === currentUserClusterId);

  const displayDateChangeRequests = currentUserRole === 'Super Admin'
    ? dateChangeRequests
    : dateChangeRequests.filter(r => r.clusterId === currentUserClusterId);

  const displaySessionReports = currentUserRole === 'Super Admin'
    ? sessionReports
    : sessionReports.filter(r => r.clusterId === currentUserClusterId);

  const displaySessionSubmissions = currentUserRole === 'Super Admin'
    ? sessionSubmissions
    : sessionSubmissions.filter(s => s.clusterId === currentUserClusterId);

  const currentPanchayat = displayPanchayats.find((p) => p.id === selectedPanchayatId) || displayPanchayats[0] || panchayats[0];
  const pendingApprovalsCount = displayApprovals.filter((a) => a.status === 'Pending').length;
  const pendingCount = notifications.filter((n) => !n.isRead).length;

  const currentClusterObj = clusters.find((c) => c.id === currentUserClusterId) || clusters[0];
  const activeClusterName = currentUserRole === 'Super Admin' ? 'All Clusters (Tamil Nadu)' : (currentClusterObj?.name || 'Cluster');
  const activeCollegeName = currentClusterObj?.collegeName || (currentUserRole === 'Super Admin' ? 'All Partner Institutions' : 'Partner Institution');
  const openResetWizard = (moduleId?: string) => {
    setSuggestedResetModule(moduleId);
    setIsResetModalOpen(true);
  };

  if (currentUser && currentUser.role !== 'Super Admin' && maintenanceState?.enabled) {
    return <MaintenancePage maintenance={maintenanceState} />;
  }

  return (
    <AdminLayout
      sidebarCollapsed={sidebarCollapsed}
      overlays={
        <>
          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            onNavigate={(tab) => {
              handleNavigate(tab);
              setPaletteOpen(false);
            }}
            currentUserRole={currentUserRole}
          />
          {toastNotification && <div role="status" aria-live="polite" className="fixed right-5 top-20 z-[100000] w-[min(24rem,calc(100vw-2.5rem))] rounded-2xl border border-border bg-card p-4 shadow-2xl animate-in fade-in-0 slide-in-from-top-3">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><CheckCircle2 className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><div className="text-sm font-bold text-foreground">{toastNotification.title}</div><p className="mt-1 text-xs text-muted-foreground">{toastNotification.message}</p><button type="button" onClick={() => { handleNavigate('notifications'); setToastNotification(null); }} className="mt-2 text-xs font-semibold text-primary hover:underline">Open notifications</button></div>
              <button type="button" aria-label="Dismiss notification" onClick={() => setToastNotification(null)} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><span aria-hidden="true">×</span></button>
            </div>
          </div>}
          <DataResetModal
            open={isResetModalOpen}
            authToken={currentUser?.token || ''}
            suggestedModule={suggestedResetModule}
            onClose={() => { setIsResetModalOpen(false); setSuggestedResetModule(undefined); }}
            onCompleted={() => {
              setResetHistoryVersion((version) => version + 1);
              void fetchBackendData(new AbortController().signal);
            }}
          />
        </>
      }
      sidebar={
        <Navigation
          currentTab={currentTab}
          onSelectTab={(tab) => {
            if (tab === 'attendance') setActiveDraftId(undefined);
            if (tab === 'students') setInitialStudentFilters(undefined);
            setCurrentTab(tab as TabType);
            setMobileSidebarOpen(false);
          }}
          notifications={notifications}
          userRole={currentUserRole}
          clusterName={activeClusterName}
          adminName={currentUser.name}
          userEmail={currentUser.email}
          pendingApprovalsCount={pendingApprovalsCount}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          onLogout={handleLogout}
          isMobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
      }
      header={
        <Header
          userEmail={currentUser.email}
          userName={currentUser.name}
          userRole={currentUserRole}
          clusters={clusters}
          selectedClusterId={currentUserClusterId}
          onSelectCluster={(cid) => setCurrentUserClusterId(cid)}
          notifications={notifications}
          pendingApprovalsCount={pendingApprovalsCount}
          maintenance={maintenanceState}
          onManageMaintenance={() => setCurrentTab('settings')}
          onNavigate={(tab, targetId) => {
            handleNavigate(tab, targetId);
            setMobileSidebarOpen(false);
          }}
          onLogout={handleLogout}
          onRoleChange={(role) => handleRoleChange(role, currentUserClusterId)}
          onToggleSidebar={() => {
            if (window.innerWidth < 1024) {
              setMobileSidebarOpen((prev) => !prev);
            } else {
              setSidebarCollapsed((prev) => !prev);
            }
          }}
          academicYears={academicYears.map((year) => ({
            id: year.id,
            name: year.name,
            is_active: Boolean(year.isActive || year.is_active),
            status: year.status || (year.isActive || year.is_active ? 'ACTIVE' : 'DRAFT'),
          }))}
          selectedAcademicYearId={selectedAcademicYearId}
          onSelectAcademicYear={handleSelectAcademicYear}
        />
      }
    >
      <ErrorBoundary key={`${currentTab}-${currentUserRole}`}>

              {currentTab === 'dashboard' && (
                <DashboardView
                  onNavigate={handleNavigate}
                  onOpenNewSession={() => setCurrentTab('sessions')}
                  onOpenNewFinance={() => {
                    setCurrentTab('finance');
                    setOpenNewFinanceModal(true);
                  }}
                  onOpenNewAttendance={() => {
                    setActiveDraftId(undefined);
                    setCurrentTab('attendance');
                  }}
                  panchayats={displayPanchayats}
                  studentsCount={displayStudents.length}
                  volunteersCount={displayVolunteers.length}
                  sessionsCount={displaySessions.length}
                  pendingCount={pendingCount}
                  attendanceDrafts={displayAttendance}
                  userRole={currentUserRole}
                  clusters={clusters}
                  approvals={displayApprovals}
                  clusterName={activeClusterName}
                  financeEntries={displayFinance}
                  sessions={displaySessions}
                  students={displayStudents}
                  volunteers={displayVolunteers}
                  authToken={currentUser?.token ?? ''}
                />
              )}

              {currentTab === 'academic-setup' && (
                <AcademicSetupView
                  userRole={currentUserRole}
                  authToken={currentUser?.token ?? ''}
                  academicYears={academicYears}
                  isYearsLoading={areAcademicYearsLoading}
                  selectedAcademicYearId={selectedAcademicYearId}
                  onSelectAcademicYear={handleSelectAcademicYear}
                  onSetupSaved={() => fetchBackendData(new AbortController().signal)}
                />
              )}

              {currentTab === 'approvals' && (
                <ApprovalCenterView
                  approvals={displayApprovals}
                  clusters={clusters}
                  userRole={currentUserRole}
                  onApprove={handleApproveSubmission}
                  onRequestCorrection={handleRequestCorrection}
                  onReject={handleRejectSubmission}
                  onNavigate={handleNavigate}
                  dateChangeRequests={displayDateChangeRequests}
                  sessions={displaySessions}
                  currentUserId={currentUser.id || ''}
                  currentUserClusterId={currentUserClusterId}
                  onSubmitDateChange={handleSubmitDateChangeRequest}
                  onReviewDateChange={handleReviewDateChangeRequest}
                  onReviewFinanceEditRequest={handleReviewFinanceEditRequest}
                  onReviewLessonPlanRequest={handleReviewLessonPlanRequest}
                />
              )}

              {currentTab === 'clusters' && (
                <ClustersView
                  clusters={clusters}
                  panchayats={panchayats}
                  students={students}
                  volunteers={volunteers}
                  authToken={currentUser?.token ?? ''}
                  selectedAcademicYearId={selectedAcademicYearId}
                  userRole={currentUserRole}
                  onNavigate={handleNavigate}
                  onAddCluster={handleAddCluster}
                  onUpdateCluster={handleUpdateCluster}
                  onResendCredentials={handleResendClusterCredentials}
                  onDeleteCluster={handleDeleteCluster}
                />
              )}

              {currentTab === 'audit-logs' && (
                <AuditLogView
                  auditLogs={displayAuditLogs}
                  users={users}
                  userRole={currentUserRole}
                />
              )}

              {currentTab === 'users' && (
                <UserManagementView
                  users={users}
                  clusters={clusters}
                  authToken={currentUser?.token || ''}
                  onAddUser={handleAddUser}
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}
                  onResetPassword={handleResetPassword}
                  onChangePassword={handleAdminChangePassword}
                />
              )}

              {currentTab === 'panchayats' && (
                <PanchayatsView
                  panchayats={displayPanchayats}
                  clusters={clusters}
                  currentClusterId={currentUserClusterId}
                  authToken={currentUser?.token ?? ''}
                  selectedAcademicYearId={selectedAcademicYearId}
                  selectedAcademicYearName={academicYears.find((year) => year.id === selectedAcademicYearId)?.name || ''}
                  userRole={currentUserRole}
                  onSelectPanchayat={(id) => {
                    setSelectedPanchayatId(id);
                    setCurrentTab('panchayat-detail');
                  }}
                  onAddPanchayat={handleAddPanchayat}
                  onDeletePanchayat={handleDeletePanchayat}
                  onNavigate={handleNavigate}
                />
              )}

              {currentTab === 'panchayat-detail' && (currentPanchayat ? (
                <PanchayatDetailView
                  panchayat={currentPanchayat}
                  students={displayStudents}
                  authToken={currentUser?.token ?? ''}
                  selectedAcademicYearId={selectedAcademicYearId}
                  userRole={currentUserRole}
                  onBack={() => setCurrentTab('panchayats')}
                  onNavigate={handleNavigate}
                  onAddVillage={handleAddVillage}
                  onDeleteVillage={handleDeleteVillage}
                />
              ) : (
                <div className="rounded-2xl border border-border bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {panchayats.length === 0 ? 'Loading Panchayat details…' : 'No Panchayat is available to display.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCurrentTab('panchayats')}
                    className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    Back to Panchayats
                  </button>
                </div>
              ))}

              {currentTab === 'students' && (
                <StudentsView
                  authToken={currentUser?.token ?? ''}
                  students={displayStudents}
                  panchayats={displayPanchayats}
                  clusters={clusters}
                  academicYear={academicYears.find((year) => year.id === selectedAcademicYearId)?.name || ''}
                  userRole={currentUserRole}
                  onBulkImportStudents={handleBulkAddStudents}
                  initialFilters={initialStudentFilters}
                  onAddStudent={handleAddStudent}
                  onUpdateStudent={handleUpdateStudent}
                  onDeleteStudent={handleDeleteStudent}
                />
              )}

              {currentTab === 'volunteers' && (
                <VolunteersView
                  volunteers={displayVolunteers}
                  panchayats={displayPanchayats}
                  clusters={clusters}
                  userRole={currentUserRole}
                  currentClusterId={currentUserClusterId}
                  authToken={currentUser?.token ?? ''}
                  academicYear={academicYears.find((year) => year.id === selectedAcademicYearId)?.name || ''}
                  onAddVolunteer={handleAddVolunteer}
                  onUpdateVolunteer={handleUpdateVolunteer}
                  onDeleteVolunteer={handleDeleteVolunteer}
                  onBulkImportVolunteers={handleBulkImportVolunteers}
                />
              )}

              {currentTab === 'sessions' && (
                <SessionsView
                  sessions={displaySessions}
                  clusters={clusters}
                  panchayats={displayPanchayats}
                  volunteers={displayVolunteers}
                  userRole={currentUserRole}
                  currentClusterId={currentUserClusterId}
                  dateChangeRequests={displayDateChangeRequests}
                  onNavigate={handleNavigate}
                  onAddSession={handleAddSession}
                  onUpdateSession={handleUpdateSession}
                  onApproveSessionDate={handleApproveSessionDate}
                  onDeleteSession={handleDeleteSession}
                  onRequestDateChange={handleSubmitDateChangeRequest}
                  onReviewDateChange={handleReviewDateChangeRequest}
                  canManageSchedule={true}
                />
              )}

              {(currentTab === 'attendance' || currentTab === 'volunteer-attendance') && (
                <AttendanceView
                  attendanceSessions={displayAttendance}
                  students={displayStudents}
                  volunteers={displayVolunteers}
                  panchayats={displayPanchayats}
                  clusters={clusters}
                  sessions={displaySessions}
                  academicYear={academicYears.find((year) => year.id === selectedAcademicYearId)?.name || ''}
                  userRole={currentUserRole}
                  draftId={activeDraftId}
                  initialSubject={currentTab === 'volunteer-attendance' ? 'volunteers' : 'students'}
                  onNavigate={handleNavigate}
                  onSaveAttendance={handleSaveAttendance}
                  onReviewAttendance={handleReviewAttendance}
                  onRequestAttendanceEdit={handleRequestAttendanceEdit}
                  onAdminEditAttendance={handleAdminEditAttendance}
                  onAdminDeleteAttendance={handleAdminDeleteAttendance}
                />
              )}

              {currentTab === 'lesson-plan' && (
                <LessonPlanView
                  lessonPlans={displayLessonPlans}
                  clusters={clusters}
                  sessions={displaySessions}
                  panchayats={displayPanchayats}
                  volunteers={displayVolunteers}
                  currentUserRole={currentUserRole}
                  currentCluster={currentUserRole === 'Super Admin' && currentUserClusterId === 'all' ? 'All Clusters' : (currentClusterObj?.name || currentUserClusterId)}
                  currentClusterId={currentUserClusterId}
                  currentAcademicYear={academicYears.find((year) => year.id === selectedAcademicYearId)?.name || ''}
                  selectedLessonPlanId={selectedLessonPlanId}
                  onNavigate={handleNavigate}
                  onAddLessonPlan={handleAddLessonPlan}
                  onUpdateLessonPlan={handleUpdateLessonPlan}
                  onDeleteLessonPlan={handleDeleteLessonPlan}
                  onReviewLessonPlan={handleReviewLessonPlan}
                  onRequestLessonPlanAction={handleRequestLessonPlanAction}
                />
              )}

              {currentTab === 'session-photos' && (
                <SessionPhotosView
                  panchayats={displayPanchayats}
                  clusters={clusters}
                  authToken={currentUser.token}
                  userRole={currentUserRole}
                  currentCluster={currentUserClusterId === 'all' ? (currentClusterObj?.name || 'All Clusters') : (currentClusterObj?.name || currentUserClusterId)}
                  onNavigate={handleNavigate}
                />
              )}

              {currentTab === 'finance' && (
                <FinanceView
                  financeEntries={displayFinance}
                  panchayats={displayPanchayats}
                  clusters={clusters}
                  authToken={currentUser?.token || ''}
                  selectedAcademicYearId={selectedAcademicYearId}
                  drafts={displayFinanceDrafts}
                  sessions={displaySessions}
                  userRole={currentUserRole}
                  clusterId={currentUserClusterId}
                  initialSelectedClusterId={currentUserRole === 'Super Admin' ? activeFinanceClusterId : undefined}
                  clusterName={currentUserRole === 'Super Admin' ? 'All Clusters' : (currentClusterObj?.name || 'Cluster')}
                  collegeName={activeCollegeName}
                  spocName={currentClusterObj?.spocName || currentClusterObj?.adminName || ''}
                  financerName={financeOfficerName}
                  onNavigate={handleNavigate}
                  onAddFinanceEntry={handleAddFinanceEntry}
                  onUpdateFinanceEntry={handleUpdateFinanceEntry}
                  onDeleteFinanceEntry={handleDeleteFinanceEntry}
                  onSaveDraft={handleSaveFinanceDraft}
                  onDeleteDraft={handleDeleteFinanceDraft}
                  onSubmitDraft={handleSubmitFinanceDraft}
                  onRequestFinanceEdit={handleRequestFinanceEdit}
                  isOpenNewModal={openNewFinanceModal}
                  onCloseNewModal={() => setOpenNewFinanceModal(false)}
                />
              )}

              {currentTab === 'finance-statement' && (
                <FinanceStatementView
                  academicYear={academicYears.find((year) => year.id === selectedAcademicYearId)?.name || ''}
                  entries={activeFinanceClusterId
                    ? displayFinance.filter((entry) => entry.clusterId === activeFinanceClusterId || entry.clusterName === clusters.find((cluster) => cluster.id === activeFinanceClusterId)?.name)
                    : displayFinance}
                  drafts={activeFinanceClusterId
                    ? displayFinanceDrafts.filter((draft) => draft.clusterId === activeFinanceClusterId || draft.clusterName === clusters.find((cluster) => cluster.id === activeFinanceClusterId)?.name)
                    : displayFinanceDrafts}
                  activeDraftId={activeFinanceDraftId}
                  canManageDrafts={currentUserRole === 'Cluster Admin'}
                  userRole={currentUserRole}
                  sessions={activeFinanceClusterId
                    ? displaySessions.filter((session) => session.clusterId === activeFinanceClusterId || session.clusterName === clusters.find((cluster) => cluster.id === activeFinanceClusterId)?.name)
                    : displaySessions}
                  clusterId={activeFinanceClusterId || currentUserClusterId}
                  clusterName={activeFinanceClusterId
                    ? (clusters.find((cluster) => cluster.id === activeFinanceClusterId)?.name || 'Cluster')
                    : currentUserRole === 'Super Admin' ? 'All Clusters' : (currentClusterObj?.name || 'Cluster')}
                  collegeName={activeCollegeName}
                  spocName={currentClusterObj?.spocName || currentClusterObj?.adminName || ''}
                  financerName={financeOfficerName}
                  onBack={() => setCurrentTab('finance')}
                  onNavigate={handleNavigate}
                  onSaveDraft={handleSaveFinanceDraft}
                  onDeleteDraft={handleDeleteFinanceDraft}
                  onSubmitDraft={handleSubmitFinanceDraft}
                  onApproveReport={handleApproveFinanceReport}
                  onRejectReport={handleRejectFinanceReport}
                  onAddFinanceEntry={handleAddFinanceEntry}
                  onUpdateFinanceEntry={handleUpdateFinanceEntry}
                  onDeleteFinanceEntry={handleDeleteFinanceEntry}
                  onRequestFinanceEdit={handleRequestFinanceEdit}
                />
              )}

              {currentTab === 'reports' && (
                <ReportsView
                  sessions={displaySessions}
                  lessonPlans={displayLessonPlans}
                  panchayats={displayPanchayats}
                  volunteers={displayVolunteers}
                  students={displayStudents}
                  clusters={clusters}
                  financeEntries={displayFinance}
                  onNavigate={handleNavigate}
                />
              )}

              {currentTab === 'report-preview' && (
                <ReportPreviewView
                  onBack={() => setCurrentTab('reports')}
                  onNavigate={handleNavigate}
                />
              )}

              {currentTab === 'notifications' && (
                <NotificationsView
                  notifications={notifications}
                  onNavigate={handleNavigate}
                  onMarkAsRead={handleMarkAsRead}
                  onMarkAllAsRead={handleMarkAllAsRead}
                />
              )}

              {currentTab === 'settings' && (
                <SettingsView
                  currentUser={currentUser}
                  financeOfficerName={financeOfficerName}
                  canManageFinanceSettings={currentUserRole === 'Super Admin'}
                  canResetData={currentUserRole === 'Super Admin'}
                  authToken={currentUser?.token || ''}
                  maintenance={maintenanceState}
                  onMaintenanceRefresh={() => {
                    if (!currentUser?.token) return;
                    fetch(apiUrl('/api/system/maintenance'), {
                      headers: { Authorization: `Bearer ${currentUser.token}` },
                      cache: 'no-store',
                    })
                      .then((response) => response.json().catch(() => null))
                      .then((data) => setMaintenanceState(data?.maintenance || null))
                      .catch(() => undefined);
                  }}
                  resetHistoryVersion={resetHistoryVersion}
                  onOpenResetData={() => openResetWizard()}
                  onBackupRestored={() => void fetchBackendData(new AbortController().signal)}
                  onSaveFinanceOfficerName={handleSaveFinanceOfficerName}
                  onUpdateProfile={(updated) => {
                    setCurrentUser((prev) => {
                      if (!prev) return prev;
                      const nextUser = { ...prev, ...updated } as AuthSession;
                      try {
                        localStorage.setItem('tqi_auth_session', JSON.stringify(nextUser));
                      } catch {
                        // ignore storage failures
                      }
                      return nextUser;
                    });
                  }}
                />
              )}

              {currentTab === 'date-change-requests' && (
                <DateChangeRequestView
                  dateChangeRequests={displayDateChangeRequests}
                  sessions={displaySessions}
                  currentUserRole={currentUserRole}
                  currentUserId={currentUser.id || ''}
                  currentUserClusterId={currentUserClusterId}
                  onSubmitRequest={handleSubmitDateChangeRequest}
                  onReviewRequest={handleReviewDateChangeRequest}
                />
              )}

              {currentTab === 'session-reports' && (
                <SessionReportView
                  sessionReports={displaySessionReports}
                  lessonPlans={lessonPlans}
                  panchayats={displayPanchayats}
                  volunteers={displayVolunteers}
                  sessions={displaySessions}
                  clusters={clusters}
                  currentUserRole={currentUserRole}
                  currentUserClusterId={currentUserClusterId}
                  authToken={currentUser?.token || ''}
                  academicYears={academicYears}
                  selectedAcademicYearId={selectedAcademicYearId}
                  onSaveReport={handleSaveSessionReport}
                  onReportPhotosUpdate={(reportId, photos) => setSessionReports((previous) => previous.map((report) => report.id === reportId ? { ...report, photos } : report))}
                  onDeleteReport={handleDeleteSessionReport}
                  onWorkflowUpdate={handleSessionReportWorkflowUpdate}
                />
              )}

              {currentTab === 'session-submissions' && (
                <SessionSubmissionView
                  sessionSubmissions={displaySessionSubmissions}
                  sessions={displaySessions}
                  clusters={clusters}
                  currentUserRole={currentUserRole}
                  currentUserId={currentUser.id || ''}
                  currentUserClusterId={currentUserClusterId}
                  onSubmitSession={handleSubmitSession}
                  onReviewSubmission={handleReviewSubmission}
                  onResubmit={handleResubmitSession}
                  onNavigateToTab={(tab) => setCurrentTab(tab as TabType)}
                />
              )}
              {currentTab === 'module-library' && (
                <ModuleLibraryView
                  modules={modules}
                  academicDays={moduleAcademicDays}
                  currentUserRole={currentUserRole}
                  currentAcademicYear={academicYears.find((year) => year.id === selectedAcademicYearId)?.name || ''}
                  onCreateModule={handleCreateModule}
                  onUpdateModule={handleUpdateModule}
                  onDeleteModule={handleDeleteModule}
                  onUploadResource={handleUploadModuleResource}
                  onDownloadResource={handleDownloadModuleResource}
                  onViewResource={handleViewModuleResource}
                  onDeleteResource={handleDeleteModuleResource}
                  onRefreshModules={fetchBackendData}
                />
              )}

              {/* Fallback for unknown / future tabs */}
              {!KNOWN_TABS.has(currentTab) && (
                <NotFoundView
                  onBack={() => setCurrentTab('dashboard')}
                  title="This workspace is being built"
                  message={`The "${currentTab}" view is not available in this build. Head back to the dashboard to continue.`}
                />
              )}
            </ErrorBoundary>
    </AdminLayout>
  );
}


