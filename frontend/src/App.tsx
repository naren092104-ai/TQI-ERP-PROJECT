import React, { useState, useEffect, useCallback } from 'react';
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

const KNOWN_TABS: Set<string> = new Set([
  'dashboard', 'academic-setup', 'approvals', 'clusters', 'audit-logs', 'users',
  'panchayats', 'panchayat-detail', 'students', 'volunteers', 'sessions',
  'attendance', 'lesson-plan', 'session-photos',
  'finance', 'finance-statement', 'reports', 'report-preview',
  'notifications', 'settings', 'date-change-requests',
  'session-reports', 'session-submissions', 'module-library',
]);


export default function App() {
  // Session & Authentication State
  const [currentUser, setCurrentUser] = useState<AuthSession | null>(() => {
    try {
      const saved = localStorage.getItem('tqi_auth_session');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore invalid session data
    }
    return null;
  });

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
      if (savedTab === 'academic-setup' && role !== 'Super Admin') return 'dashboard';
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
  const [openNewFinanceModal, setOpenNewFinanceModal] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [selectedLessonPlanId, setSelectedLessonPlanId] = useState<string | undefined>(undefined);
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);

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
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [photoGroups, setPhotoGroups] = useState<SessionPhotoGroup[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dateChangeRequests, setDateChangeRequests] = useState<DateChangeRequest[]>([]);
  const [sessionReports, setSessionReports] = useState<SessionReport[]>([]);
  const [sessionSubmissions, setSessionSubmissions] = useState<SessionSubmission[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [modules, setModules] = useState<TqiModule[]>([]);

  // Sync with API Backend
  const fetchBackendData = useCallback(async (signal: AbortSignal) => {
    if (!currentUser?.token) return;

    // 300 ms debounce — React 19 Strict Mode unmounts and remounts immediately
    // in dev. The abort from the first mount cancels this timer before the
    // requests fire, so only the second (surviving) mount actually fetches.
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 300);
      signal.addEventListener('abort', () => clearTimeout(t), { once: true });
    });
    if (signal.aborted) return;

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
            setCurrentUser(null);
            return null;
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
      ] = await Promise.all([
        get(`/api/panchayats?clusterId=${currentUserClusterId}`),
        get(`/api/students?clusterId=${currentUserClusterId}`),
        get(`/api/volunteers?clusterId=${currentUserClusterId}`),
        get(`/api/sessions?clusterId=${currentUserClusterId}`),
        get(`/api/attendance?clusterId=${currentUserClusterId}`),
        get(`/api/finance?clusterId=${currentUserClusterId}`),
        get(`/api/lesson-plans?clusterId=${currentUserClusterId}`),
        get(`/api/approvals?clusterId=${currentUserClusterId}`),
        get(`/api/audit-logs?clusterId=${currentUserClusterId}`),
        get('/api/notifications'),
        get('/api/clusters'),
        get('/api/users'),
        get('/api/date-change-requests'),
        get('/api/session-reports'),
        get('/api/session-submissions'),
        get('/api/academic-years'),
        get('/api/modules'),
      ]);

      if (signal.aborted) return;

      if (Array.isArray(panchayatsRes?.panchayats))         setPanchayats(panchayatsRes.panchayats);
      if (Array.isArray(studentsRes?.students))             setStudents(studentsRes.students);
      if (Array.isArray(volunteersRes?.volunteers))         setVolunteers(volunteersRes.volunteers);
      if (Array.isArray(sessionsRes?.sessions))             setSessions(sessionsRes.sessions);
      if (Array.isArray(attendanceRes?.attendanceSessions)) setAttendanceSessions(attendanceRes.attendanceSessions);
      if (Array.isArray(financeRes?.financeEntries))        setFinanceEntries(financeRes.financeEntries);
      if (Array.isArray(lessonPlansRes?.lessonPlans))       setLessonPlans(lessonPlansRes.lessonPlans);
      if (Array.isArray(approvalsRes?.approvals))           setApprovals(approvalsRes.approvals);
      if (Array.isArray(auditRes?.auditLogs))               setAuditLogs(auditRes.auditLogs);
      if (Array.isArray(notificationsRes?.notifications))   setNotifications(notificationsRes.notifications);
      if (Array.isArray(clustersRes?.clusters))             setClusters(clustersRes.clusters);
      if (Array.isArray(usersRes?.users))                   setUsers(usersRes.users);
      if (Array.isArray(dateChangeRequestsRes?.dateChangeRequests)) setDateChangeRequests(dateChangeRequestsRes.dateChangeRequests);
      if (Array.isArray(sessionReportsRes?.sessionReports))         setSessionReports(sessionReportsRes.sessionReports);
      if (Array.isArray(sessionSubmissionsRes?.sessionSubmissions)) setSessionSubmissions(sessionSubmissionsRes.sessionSubmissions);
      if (Array.isArray(academicYearsRes?.academicYears))           setAcademicYears(academicYearsRes.academicYears);
      if (Array.isArray(modulesRes?.modules))                       setModules(modulesRes.modules);
      else if (Array.isArray(modulesRes?.data))                     setModules(modulesRes.data);
    } catch {
      // Network error or abort — keep existing in-memory state.
    }
  }, [currentUser?.token, currentUserRole, currentUserClusterId]);

  useEffect(() => {
    if (!currentUser?.token) return;
    const controller = new AbortController();
    fetchBackendData(controller.signal);
    return () => controller.abort();
  }, [fetchBackendData, currentUser?.token]);

  // Auth Handlers
  const handleLoginSuccess = (session: AuthSession) => {
    try {
      localStorage.setItem('tqi_auth_session', JSON.stringify(session));
    } catch {
      // ignore
    }
    setCurrentUser(session);
    setCurrentUserRole(session.role);
    setCurrentUserClusterId(session.clusterId);
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
    try {
      await fetch(apiUrl(`/api/approvals/${id}/approve`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: currentUser?.token ? `Bearer ${currentUser.token}` : '',
          'x-user-role': currentUserRole,
          'x-user-cluster-id': currentUserClusterId,
        },
      });
    } catch {
      // ignore
    }

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

    const newLog: AuditLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      userId: 'u-super-admin-1',
      userName: 'Dr. K. Senthil Nathan',
      userRole: 'Super Admin',
      action: `Approved ${module}`,
      module,
      recordId,
      clusterId: currentUserClusterId,
      clusterName: 'Dharmapuri Cluster',
      details: `Approved ${module} submission (${recordId})`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: `${module} Approved`,
      message: `Super Admin has approved ${module} (${recordId}).`,
      timeAgo: 'Just now',
      isRead: false,
      type: 'approval',
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const handleRequestCorrection = async (id: string, module: string, recordId: string, reason: string) => {
    try {
      await fetch(apiUrl(`/api/approvals/${id}/request-correction`), {
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
      prev.map((a) =>
        a.id === id ? { ...a, status: 'Correction Requested', correctionReason: reason } : a
      )
    );

    if (module === 'Attendance') {
      setAttendanceSessions((prev) =>
        prev.map((s) =>
          s.id === recordId
            ? { ...s, status: 'Correction Requested', correctionReason: reason }
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

    const newLog: AuditLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      userId: 'u-super-admin-1',
      userName: 'Dr. K. Senthil Nathan',
      userRole: 'Super Admin',
      action: `Correction Requested on ${module}`,
      module,
      recordId,
      clusterId: currentUserClusterId,
      clusterName: 'Dharmapuri Cluster',
      details: `Correction requested for ${recordId}: "${reason}"`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: `Correction Requested: ${module}`,
      message: `Super Admin requested changes on ${recordId}: "${reason}"`,
      timeAgo: 'Just now',
      isRead: false,
      type: 'correction',
    };
    setNotifications((prev) => [newNotif, ...prev]);
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
        body: JSON.stringify(newC),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to create cluster.');
      if (data.cluster) setClusters((prev) => [...prev, data.cluster]);
      if (data.user) setUsers((prev) => [...prev, data.user]);
      else {
        const usersResponse = await fetch(apiUrl('/api/users'), { headers: { Authorization: currentUser?.token ? `Bearer ${currentUser.token}` : '' } });
        const usersData = await usersResponse.json();
        if (Array.isArray(usersData?.users)) setUsers(usersData.users);
      }
      return true;
    } catch (error: any) {
      throw error;
    }
  };

  // Delete Cluster Mutation
  const handleDeleteCluster = async (clusterId: string) => {
    try {
      await fetch(apiUrl(`/api/clusters/${clusterId}`), {
        method: 'DELETE',
        headers: { Authorization: currentUser?.token ? `Bearer ${currentUser.token}` : '' },
      });
      setClusters((prev) => prev.filter((c) => c.id !== clusterId));
    } catch (error: any) {
      setClusters((prev) => prev.filter((c) => c.id !== clusterId));
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

  const handleResetPassword = async (id: string, password: string) => {
    const response = await fetch(apiUrl(`/api/users/${id}/reset-password`), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token || ''}` }, body: JSON.stringify({ password }) });
    const data = await response.json();
    if (!response.ok || !data.success) return;
    setUsers((prev) => prev.map((item) => item.id === id ? { ...item, mustChangePassword: false } : item));
  };

  // Navigation handlers
  const handleNavigate = (tab: TabType, targetId?: string, secondaryParam?: string) => {
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
        setActiveFinanceDraftId(targetId);
      }
      setCurrentTab('finance-statement');
      return;
    }
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Panchayat mutations
  const handleAddPanchayat = (newPanchayat: {
    name: string;
    cluster: string;
    status: 'On Track' | 'Correction Required' | 'Action Needed';
    initialVillages: string[];
  }) => {
    const newId = newPanchayat.name.toLowerCase().replace(/\s+/g, '-');
    const villagesList = newPanchayat.initialVillages.map((vName, idx) => ({
      id: `v-${Date.now()}-${idx}`,
      name: vName,
      studentCount: 0,
    }));

    const created: Panchayat = {
      id: newId,
      name: newPanchayat.name,
      cluster: newPanchayat.cluster || 'Dharmapuri',
      status: newPanchayat.status || 'On Track',
      villagesCount: villagesList.length,
      activeStudents: 0,
      volunteersCount: 0,
      villages: villagesList,
    };

    setPanchayats((prev) => [created, ...prev]);
  };

  const handleAddVillage = (panchayatId: string, villageName: string) => {
    setPanchayats((prev) =>
      prev.map((p) => {
        if (p.id === panchayatId) {
          const newVillage = {
            id: `v-${Date.now()}`,
            name: villageName,
            studentCount: 0,
          };
          const updatedVillages = [...p.villages, newVillage];
          return {
            ...p,
            villages: updatedVillages,
            villagesCount: updatedVillages.length,
          };
        }
        return p;
      })
    );
  };

  // Student mutations
  const handleAddStudent = (newStudent: Omit<Student, 'id' | 'code' | 'avatarLetter' | 'avatarBg'>) => {
    const newId = `stu-${Date.now()}`;
    const code = `STU-24-${String(students.length + 1).padStart(3, '0')}`;
    const avatarLetter = newStudent.name.charAt(0).toUpperCase();
    const colors = ['bg-[#0b3d91] text-white', 'bg-[#345baf] text-white', 'bg-[#521a00] text-white', 'bg-[#592600] text-white'];
    const avatarBg = colors[students.length % colors.length];

    const created: Student = {
      ...newStudent,
      id: newId,
      code,
      avatarLetter,
      avatarBg,
    };
    setStudents((prev) => [created, ...prev]);

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
  };

  const handleBulkAddStudents = (
    newStudentsList: Array<Omit<Student, 'id' | 'code' | 'avatarLetter' | 'avatarBg'>>
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
      const codeNumber = currentTotal + idx + 1;
      return {
        ...st,
        id: `stu-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        code: `STU-24-${String(codeNumber).padStart(3, '0')}`,
        avatarLetter: (st.name || 'S').charAt(0).toUpperCase(),
        avatarBg: colors[(currentTotal + idx) % colors.length],
      };
    });

    setStudents((prev) => [...createdBatch, ...prev]);

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
  };

  const handleUpdateStudent = (id: string, updated: Partial<Student>) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
  };

  const handleDeleteStudent = (id: string) => {
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
  };

  // Volunteer mutations
  const handleAddVolunteer = (newVol: Omit<Volunteer, 'id' | 'avatarText' | 'recentSessions' | 'totalSessions' | 'attendanceRate'>) => {
    const newId = `vol-${Date.now()}`;
    const names = newVol.name.split(' ');
    const avatarText = names.length > 1 ? `${names[0][0]}${names[1][0]}`.toUpperCase() : newVol.name.slice(0, 2).toUpperCase();

    const created: Volunteer = {
      ...newVol,
      id: newId,
      avatarText,
      totalSessions: 0,
      attendanceRate: 100,
      recentSessions: [],
    };
    setVolunteers((prev) => [created, ...prev]);
  };

  const handleUpdateVolunteer = (id: string, updated: Partial<Volunteer>) => {
    setVolunteers((prev) => prev.map((v) => (v.id === id ? { ...v, ...updated } : v)));
  };

  const handleDeleteVolunteer = (id: string) => {
    setVolunteers((prev) => prev.filter((v) => v.id !== id));
  };

  // Session mutations
  const handleAddSession = (newSession: Omit<Session, 'id'>) => {
    const created: Session = {
      ...newSession,
      id: `sess-${Date.now()}`,
    };
    setSessions((prev) => [created, ...prev]);
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
          dayNumber: existing.dayNumber,
          sessionName: existing.name,
        }),
      });
      if (!response.ok) return;
    }
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
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
        body: JSON.stringify(session),
      });
      if (!response.ok) return;
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
        recordTitle: `${session.panchayatName || 'Center'} - ${session.sessionName || 'Attendance'}`,
        clusterId: currentUserClusterId,
        clusterName: 'Dharmapuri Cluster',
        submittedBy: 'Dharmapuri Cluster Admin',
        submittedAt: 'Just now',
        status: 'Pending',
        details: {
          presentCount: session.presentCount || session.records?.filter((s) => s.status === 'Present').length || 0,
          totalCount: session.totalCount || session.records?.length || 0,
          villageName: session.villageName || '',
          dayNumber: session.dayNumber || 1,
        },
      };
      setApprovals((prev) => [newAppr, ...prev]);
    }
  };

  // Finance mutations
  const handleAddFinanceEntry = (entry: Omit<FinanceEntry, 'id'>) => {
    const created: FinanceEntry = {
      ...entry,
      id: `fin-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    setFinanceEntries((prev) => [created, ...prev]);
  };

  const handleUpdateFinanceEntry = (id: string, updated: Partial<FinanceEntry>) => {
    setFinanceEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e)));
  };

  const handleDeleteFinanceEntry = (id: string) => {
    setFinanceEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleSaveFinanceDraft = (draft: FinanceDraft) => {
    setFinanceDrafts((prev) => {
      const idx = prev.findIndex((d) => d.id === draft.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = draft;
        return copy;
      }
      return [draft, ...prev];
    });
  };

  const handleDeleteFinanceDraft = (draftId: string) => {
    setFinanceDrafts((prev) => prev.filter((d) => d.id !== draftId));
  };

  const handleSubmitFinanceDraft = (draftId: string) => {
    setFinanceDrafts((prev) =>
      prev.map((d) => (d.id === draftId ? { ...d, status: 'Pending' } : d))
    );
    setFinanceEntries((prev) =>
      prev.map((e) => (e.draftId === draftId ? { ...e, status: 'Pending' } : e))
    );

    const targetDraft = financeDrafts.find((d) => d.id === draftId);
    const newAppr: ApprovalItem = {
      id: `appr-${Date.now()}`,
      module: 'Finance',
      recordId: draftId,
      recordTitle: targetDraft?.title || 'Finance Claim Voucher',
      clusterId: currentUserClusterId,
      clusterName: 'Dharmapuri Cluster',
      submittedBy: 'Dharmapuri Cluster Admin',
      submittedAt: 'Just now',
      status: 'Pending',
      details: {
        totalAmount: targetDraft?.totalAmount || 0,
        itemCount: targetDraft?.routes?.length || 1,
        spocName: 'Admin',
      },
    };
    setApprovals((prev) => [newAppr, ...prev]);
  };

  // Lesson Plan mutations
  const handleAddLessonPlan = (plan: Omit<LessonPlan, 'id'>) => {
    const created: LessonPlan = {
      ...plan,
      id: `lp-${Date.now()}`,
    };
    setLessonPlans((prev) => [created, ...prev]);
  };

  const handleUpdateLessonPlan = (id: string, plan: Partial<LessonPlan>) => {
    setLessonPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...plan } : p)));
  };

  const handleDeleteLessonPlan = (id: string) => {
    setLessonPlans((prev) => prev.filter((p) => p.id !== id));
  };

  // Notification actions
  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  // Date Change Request handlers
  const handleSubmitDateChangeRequest = async (sessionId: string, originalDate: string, requestedDate: string, reason: string) => {
    try {
      const response = await fetch(apiUrl('/api/date-change-requests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token || ''}` },
        body: JSON.stringify({ sessionId, originalDate, requestedDate, reason }),
      });
      const data = await response.json();
      if (data?.success && data.dateChangeRequest) {
        setDateChangeRequests(prev => [data.dateChangeRequest, ...prev]);
      }
    } catch { /* ignore */ }
  };

  const handleReviewDateChangeRequest = async (requestId: string, action: 'approve' | 'reject', remarks: string) => {
    try {
      const response = await fetch(apiUrl(`/api/date-change-requests/${requestId}/${action}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token || ''}` },
        body: JSON.stringify({ remarks }),
      });
      const data = await response.json();
      if (data?.success) {
        setDateChangeRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: action === 'approve' ? 'APPROVED' : 'REJECTED', reviewRemarks: remarks } : r));
        if (action === 'approve') {
          // Refresh sessions to get updated dates
          fetchBackendData(new AbortController().signal);
        }
      }
    } catch { /* ignore */ }
  };

  // Session Report handlers
  const handleSaveSessionReport = async (report: Partial<SessionReport>) => {
    try {
      const response = await fetch(apiUrl('/api/session-reports'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token || ''}` },
        body: JSON.stringify(report),
      });
      const data = await response.json();
      if (data?.success && data.sessionReport) {
        setSessionReports(prev => {
          const idx = prev.findIndex(r => r.id === data.sessionReport.id);
          if (idx >= 0) { const copy = [...prev]; copy[idx] = data.sessionReport; return copy; }
          return [data.sessionReport, ...prev];
        });
      }
    } catch { /* ignore */ }
  };

  const handleDeleteSessionReport = async (reportId: string) => {
    try {
      await fetch(apiUrl(`/api/session-reports/${reportId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentUser?.token || ''}` },
      });
      setSessionReports(prev => prev.filter(r => r.id !== reportId));
    } catch { /* ignore */ }
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
    try {
      const response = await fetch(apiUrl('/api/modules'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token || ''}` },
        body: JSON.stringify(moduleData),
      });
      const data = await response.json();
      const newMod: TqiModule = {
        id: data?.module?.id || `mod-${Date.now()}`,
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
      setModules(prev => [newMod, ...prev]);
    } catch { /* ignore */ }
  };

  const handleUpdateModule = async (id: string, moduleData: any) => {
    try {
      const response = await fetch(apiUrl(`/api/modules/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token || ''}` },
        body: JSON.stringify(moduleData),
      });
      const data = await response.json();
      if (data?.success && data.data) {
        setModules(prev => prev.map(m => m.id === id ? { ...m, ...data.data } : m));
      }
    } catch { /* ignore */ }
  };

  const handleDeleteModule = async (id: string) => {
    try {
      await fetch(apiUrl(`/api/modules/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentUser?.token || ''}` },
      });
      setModules(prev => prev.filter(m => m.id !== id));
    } catch { /* ignore */ }
  };

  const handleUploadModuleResource = async (moduleId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(apiUrl(`/api/modules/${moduleId}/resources`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser?.token || ''}` },
        body: formData,
      });
      const data = await response.json();
      if (data?.success && data.resource) {
        setModules(prev => prev.map(m => {
          if (m.id === moduleId) {
            const resources = m.resources ? [...m.resources, data.resource] : [data.resource];
            return { ...m, resources };
          }
          return m;
        }));
      }
    } catch { /* ignore */ }
  };

  const handleDownloadModuleResource = (moduleId: string, resourceId: string) => {
    const downloadUrl = apiUrl(`/api/modules/${moduleId}/resources/${resourceId}/download`);
    window.open(downloadUrl, '_blank');
  };

  // If user is logged out, render the Login Page
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Scoped Data Lists based on Logged-in User Role and Cluster
  const clusterFilterKey = currentUserClusterId === 'salem' ? 'Salem' : currentUserClusterId === 'namakkal' ? 'Namakkal' : 'Dharmapuri';
  
  const displayPanchayats = currentUserRole === 'Super Admin'
    ? panchayats
    : panchayats.filter((p) => (p.cluster || '').toLowerCase() === clusterFilterKey.toLowerCase());

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

  const displayFinance = currentUserRole === 'Super Admin'
    ? financeEntries
    : financeEntries.filter((f) => !f.panchayatId || displayPanchayatIds.has(f.panchayatId) || f.clusterId === currentUserClusterId);

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
  const activeClusterName = currentUserRole === 'Super Admin' ? 'All Clusters (Tamil Nadu)' : (currentClusterObj?.name || 'Dharmapuri Cluster');

  return (
    <AdminLayout
      sidebarCollapsed={sidebarCollapsed}
      overlays={
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onNavigate={(tab) => {
            handleNavigate(tab);
            setPaletteOpen(false);
          }}
          currentUserRole={currentUserRole}
        />
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
                />
              )}

              {currentTab === 'academic-setup' && currentUserRole === 'Super Admin' && (
                <AcademicSetupView
                  authToken={currentUser.token}
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
                />
              )}

              {currentTab === 'clusters' && (
                <ClustersView
                  clusters={clusters}
                  userRole={currentUserRole}
                  onNavigate={handleNavigate}
                  onAddCluster={handleAddCluster}
                  onDeleteCluster={handleDeleteCluster}
                />
              )}

              {currentTab === 'audit-logs' && (
                <AuditLogView
                  auditLogs={displayAuditLogs}
                  userRole={currentUserRole}
                />
              )}

              {currentTab === 'users' && (
                <UserManagementView
                  users={users}
                  clusters={clusters}
                  onAddUser={handleAddUser}
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}
                  onResetPassword={handleResetPassword}
                />
              )}

              {currentTab === 'panchayats' && (
                <PanchayatsView
                  panchayats={displayPanchayats}
                  onSelectPanchayat={(id) => {
                    setSelectedPanchayatId(id);
                    setCurrentTab('panchayat-detail');
                  }}
                  onAddPanchayat={handleAddPanchayat}
                  onNavigate={handleNavigate}
                />
              )}

              {currentTab === 'panchayat-detail' && (
                <PanchayatDetailView
                  panchayat={currentPanchayat}
                  students={displayStudents}
                  onBack={() => setCurrentTab('panchayats')}
                  onNavigate={handleNavigate}
                  onAddVillage={handleAddVillage}
                />
              )}

              {currentTab === 'students' && (
                <StudentsView
                  students={displayStudents}
                  panchayats={displayPanchayats}
                  initialFilters={initialStudentFilters}
                  onAddStudent={handleAddStudent}
                  onBulkImportStudents={handleBulkAddStudents}
                  onUpdateStudent={handleUpdateStudent}
                  onDeleteStudent={handleDeleteStudent}
                />
              )}

              {currentTab === 'volunteers' && (
                <VolunteersView
                  volunteers={displayVolunteers}
                  panchayats={displayPanchayats}
                  onAddVolunteer={handleAddVolunteer}
                  onUpdateVolunteer={handleUpdateVolunteer}
                  onDeleteVolunteer={handleDeleteVolunteer}
                />
              )}

              {currentTab === 'sessions' && (
                <SessionsView
                  sessions={displaySessions}
                  panchayats={displayPanchayats}
                  volunteers={displayVolunteers}
                  onNavigate={handleNavigate}
                  onAddSession={handleAddSession}
                  onUpdateSession={handleUpdateSession}
                  onDeleteSession={handleDeleteSession}
                  canManageSchedule={currentUserRole === 'Cluster Admin'}
                />
              )}

              {currentTab === 'attendance' && (
                <AttendanceView
                  attendanceSessions={displayAttendance}
                  students={displayStudents}
                  panchayats={displayPanchayats}
                  draftId={activeDraftId}
                  onNavigate={handleNavigate}
                  onSaveAttendance={handleSaveAttendance}
                />
              )}

              {currentTab === 'lesson-plan' && (
                <LessonPlanView
                  lessonPlans={displayLessonPlans}
                  sessions={displaySessions}
                  panchayats={displayPanchayats}
                  volunteers={displayVolunteers}
                  selectedLessonPlanId={selectedLessonPlanId}
                  onNavigate={handleNavigate}
                  onAddLessonPlan={handleAddLessonPlan}
                  onUpdateLessonPlan={handleUpdateLessonPlan}
                  onDeleteLessonPlan={handleDeleteLessonPlan}
                />
              )}

              {currentTab === 'session-photos' && (
                <SessionPhotosView
                  panchayats={displayPanchayats}
                  clusters={clusters}
                  authToken={currentUser.token}
                  userRole={currentUserRole}
                  currentCluster={currentUserClusterId === 'all' ? 'Dharmapuri' : currentUserClusterId}
                  onNavigate={handleNavigate}
                />
              )}

              {currentTab === 'finance' && (
                <FinanceView
                  financeEntries={displayFinance}
                  panchayats={displayPanchayats}
                  sessions={sessions}
                  drafts={displayFinanceDrafts}
                  onNavigate={handleNavigate}
                  onAddFinanceEntry={handleAddFinanceEntry}
                  onUpdateFinanceEntry={handleUpdateFinanceEntry}
                  onDeleteFinanceEntry={handleDeleteFinanceEntry}
                  onSaveDraft={handleSaveFinanceDraft}
                  onDeleteDraft={handleDeleteFinanceDraft}
                  onSubmitDraft={handleSubmitFinanceDraft}
                  isOpenNewModal={openNewFinanceModal}
                  onCloseNewModal={() => setOpenNewFinanceModal(false)}
                />
              )}

              {currentTab === 'finance-statement' && (
                <FinanceStatementView
                  entries={displayFinance}
                  drafts={displayFinanceDrafts}
                  activeDraftId={activeFinanceDraftId}
                  onBack={() => setCurrentTab('finance')}
                  onNavigate={handleNavigate}
                  onSaveDraft={handleSaveFinanceDraft}
                  onDeleteDraft={handleDeleteFinanceDraft}
                  onSubmitDraft={handleSubmitFinanceDraft}
                  onAddFinanceEntry={handleAddFinanceEntry}
                  onUpdateFinanceEntry={handleUpdateFinanceEntry}
                  onDeleteFinanceEntry={handleDeleteFinanceEntry}
                />
              )}

              {currentTab === 'reports' && (
                <ReportsView
                  sessions={displaySessions}
                  lessonPlans={displayLessonPlans}
                  panchayats={displayPanchayats}
                  volunteers={displayVolunteers}
                  students={displayStudents}
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
                  onUpdateProfile={(updated) => {
                    setCurrentUser((prev) => (prev ? { ...prev, ...updated } : prev));
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
                  sessions={displaySessions}
                  clusters={clusters}
                  currentUserRole={currentUserRole}
                  currentUserClusterId={currentUserClusterId}
                  onSaveReport={handleSaveSessionReport}
                  onDeleteReport={handleDeleteSessionReport}
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
                  currentUserRole={currentUserRole}
                  onCreateModule={handleCreateModule}
                  onUpdateModule={handleUpdateModule}
                  onDeleteModule={handleDeleteModule}
                  onUploadResource={handleUploadModuleResource}
                  onDownloadResource={handleDownloadModuleResource}
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


