export type TabType =
  | 'dashboard'
  | 'academic-setup'
  | 'module-library'
  | 'clusters'
  | 'panchayats'
  | 'panchayat-detail'
  | 'villages'
  | 'students'
  | 'volunteers'
  | 'sessions'
  | 'attendance'
  | 'volunteer-attendance'
  | 'attendance-draft'
  | 'lesson-plan'
  | 'session-photos'
  | 'finance'
  | 'finance-statement'
  | 'reports'
  | 'report-preview'
  | 'approvals'
  | 'audit-logs'
  | 'users'
  | 'notifications'
  | 'settings'
  | 'date-change-requests'
  | 'session-submissions'
  | 'session-reports'
  | 'user-management'
  | 'academic-years';

export type UserRole = 'Super Admin' | 'Cluster Admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  clusterId?: string;
  collegeId?: string;
  collegeName?: string;
  clusterName?: string;
  status: 'Active' | 'Inactive';
  phone?: string;
  avatar?: string;
  mustChangePassword?: boolean;
}

export interface Cluster {
  id: string;
  name: string;
  district: string;
  state: string;
  code: string;
  activePanchayats: number;
  totalStudents: number;
  totalVolunteers: number;
  adminId: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminStatus?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  status: 'Active' | 'Under Review' | 'Inactive';
  completedSessions?: number;
  totalSessions?: number;
  collegeName?: string;
  collegeDistrict?: string;
  clusterDistrict?: string;
  spocName?: string;
  spocMobile?: string;
}

export interface Village {
  id: string;
  name: string;
  panchayatId?: string;
  studentCount: number;
  volunteerCount?: number;
  clusterId?: string;
  status?: string;
}

export interface Panchayat {
  id: string;
  name: string;
  cluster: string;
  clusterId?: string;
  villagesCount: number;
  activeStudents: number;
  volunteersCount: number;
  status: 'On Track' | 'Correction Required' | 'Action Needed';
  villages: Village[];
}

export interface Student {
  id: string;
  code: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  dob: string;
  standard: string;
  clusterId?: string;
  panchayatId: string;
  panchayatName: string;
  villageId: string;
  villageName: string;
  schoolName?: string;
  parentName: string;
  phone: string;
  status: 'active' | 'inactive';
  avatarLetter: string;
  avatarBg: string;
}

export interface VolunteerSessionHistory {
  date: string;
  title: string;
  status: 'Present' | 'Absent';
}

export interface Volunteer {
  id: string;
  name: string;
  email: string;
  phone: string;
  college?: string;
  collegeId?: string;
  department: string;
  stream?: string;
  year: string;
  passingOutYear?: number | string;
  role?: 'Coordinator' | 'Mentor' | 'Lead Volunteer';
  clusterId?: string;
  panchayatId?: string;
  panchayatName?: string;
  villageId?: string;
  villageName?: string;
  module?: string;
  status?: 'Active' | 'Inactive';
  totalSessions: number;
  attendanceRate: number;
  recentSessions: VolunteerSessionHistory[];
  avatarText: string;
}

export interface Session {
  id: string;
  code?: string;
  name: string;
  title?: string;
  moduleId?: string;
  module?: string;
  clusterId?: string;
  clusterName?: string;
  academicYear?: string;
  academicYearId?: string;
  dayId?: string;
  dayNumber?: number;
  date: string;
  dateFixed?: boolean;
  dateFixedAt?: string;
  dateFixedBy?: string;
  day?: string;
  time?: string;
  endTime?: string;
  panchayatId: string;
  panchayatName: string;
  villageId?: string;
  villageName: string;
  volunteerId?: string;
  volunteerName: string;
  status: 'Pending' | 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled' | 'Needs Attention' | 'Draft' | 'Action Req.' | 'Submitted' | 'Pending Review' | 'Approved' | 'Resubmission Required';
  sessionType?: 'Academic' | 'Life Skills' | 'Assessment' | 'Orientation';
  description?: string;
  lessonPlanId?: string;
  spoc?: string;
  financer?: string;
  photos?: string[];
  attendanceCount?: number;
  totalStudents?: number;
}

export interface LessonPlanSection {
  id: string;
  timeSlot: string;
  title: string;
  description: string;
  methodology: string;
}

export interface LessonPlanActivity {
  activityNumber: number;
  title: string;
  description: string;
}

export interface LessonPlanGradeSegment {
  grade: string;
  title: string;
  description: string;
}

export interface LessonPlan {
  id: string;
  sessionId?: string;
  sessionName?: string;
  moduleId?: string;
  moduleName?: string;
  moduleNumber?: number;
  title?: string;
  topic?: string;
  status?: 'Draft' | 'Submitted' | 'Approved' | 'Correction Requested' | 'Resubmitted' | 'Completed' | 'Active' | 'Upcoming';
  description?: string;
  objective?: string;
  objectives?: string[];
  learningOutcomes?: string[];
  introduction?: string;
  activity?: string;
  activitiesList?: string[];
  teachingMethod?: string;
  materials?: string | string[];
  materialsList?: string[];
  assessmentTask?: string;
  duration?: string;
  cluster?: string;
  clusterId?: string;
  collegeName?: string;
  teamCollegeName?: string;
  panchayatId?: string;
  panchayatName?: string;
  villageId?: string;
  villageName?: string;
  villagesList?: string[];
  volunteerId?: string;
  volunteerName?: string;
  volunteersCount?: number;
  assignedVolunteers?: string[];
  dayOfSession?: string;
  dayNumber?: number;
  summitNumbers?: string;
  grades?: string;
  overview?: string;
  gradeSegments?: LessonPlanGradeSegment[];
  activitiesDetailed?: LessonPlanActivity[];
  expectedOutcome?: string;
  date?: string;
  lastUpdated?: string;
  spoc?: string;
  financer?: string;
  sections?: LessonPlanSection[];
  skillEnhancementList?: string[];
  feedbackText?: string;
  notes?: string;
  photos?: string[];
  targetStandard?: string;
  totalSessions?: number;
  completedSessions?: number;
  academicYear?: string;
  correctionReason?: string;
  correctionRequestedBy?: string;
  correctionDate?: string;
}

export interface SessionPhotoItem {
  id: string;
  clusterId: string;
  clusterName: string;
  sessionId?: string;
  sessionTitle: string;
  dayNumber: number; // 1 to 8
  date: string;
  panchayatId: string;
  panchayatName: string;
  villageId?: string;
  villageName: string;
  filePath?: string;
  fileUrl: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedRole?: string;
  uploadedAt: string;
  status: 'active' | 'archived';
  caption?: string;
  photoType?: 'session' | 'homework' | 'feedback';
  academicYearId?: string;
  deleteRequestStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  deleteRequestId?: string | null;
  deleteRequestReason?: string | null;
}

export interface PhotoDeleteRequest {
  id: string;
  photoId: string;
  clusterId: string;
  clusterName: string;
  academicYearId?: string;
  academicYear?: string;
  dayNumber: number;
  dayName: string;
  sessionName: string;
  fileName: string;
  fileUrl: string;
  requestedBy: string;
  reason: string;
  requestedDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface DayPhotoStatus {
  dayNumber: number;
  dayName: string;
  sessionName: string;
  photosCount: number;
  maxPhotos: number;
  status: 'DRAFT' | 'SUBMITTED' | 'PENDING REVIEW' | 'APPROVED' | 'EDIT_REQUESTED' | 'EDIT_APPROVED' | 'RESUBMISSION_REQUIRED';
  isLocked: boolean;
  submittedBy?: string;
  submittedAt?: string;
}

export interface DayPhotoSummary {
  dayNumber: number;
  dayLabel: string;
  date: string;
  photosCount: number;
  targetCount: number;
  panchayatCoverage: number;
  featuredPhotos: SessionPhotoItem[];
}

export type ZipGenerationStage =
  | 'idle'
  | 'preparing'
  | 'collecting'
  | 'creating'
  | 'downloading'
  | 'completed'
  | 'error';

export interface ZipProgressState {
  stage: ZipGenerationStage;
  message: string;
  progressPercent: number;
  currentCount?: number;
  totalCount?: number;
  zipFilename?: string;
  errorMessage?: string;
}

export interface SessionPhotoGroup {
  id: string;
  date: string;
  sessionTitle: string;
  panchayatName: string;
  villageName: string;
  uploaderName: string;
  uploaderRole: string;
  photos: string[];
}

export interface FinanceEntry {
  id: string;
  sessionId?: string;
  date: string;
  description: string;
  category: 'Materials' | 'Travel' | 'Food' | 'Admin' | 'Other';
  amount: number;
  clusterId?: string;
  clusterName?: string;
  panchayatId: string;
  panchayatName: string;
  villageName: string;
  status: 'Approved' | 'Pending' | 'Correction' | 'Draft';
  billUrl?: string;
  remarks?: string;
  count?: number;
  countAmount?: string;
  sessionDay?: string;
  draftId?: string;
  submittedAt?: string;
  updatedAt?: string;
  submittedBy?: string;
  vendor?: string;
}

export interface RouteDraftItem {
  id: string;
  from: string;
  to: string;
  volunteers: number;
  perPerson: number;
  remarks: string;
  bill: {
    url: string;
    fileName: string;
    detectedAmount?: number;
    isVerified?: boolean;
    origin?: string;
    destination?: string;
    count?: number;
    quality?: string;
  } | null;
}

export interface FoodDraftItem {
  amount: number;
  remarks: string;
  bill: {
    url: string;
    fileName: string;
    detectedAmount?: number;
    isVerified?: boolean;
    origin?: string;
    destination?: string;
    count?: number;
    quality?: string;
  } | null;
}

export interface FinanceDraft {
  id: string;
  title: string;
  sessionDay: string;
  sessionDate: string;
  clusterId?: string;
  clusterName: string;
  collegeName: string;
  spocName: string;
  financerName: string;
  status: 'Draft' | 'Pending' | 'Approved' | 'Correction Requested';
  correctionReason?: string;
  lastSaved: string;
  routes: RouteDraftItem[];
  food: {
    breakfast: FoodDraftItem;
    lunch: FoodDraftItem;
    dinner: FoodDraftItem;
    refreshments: FoodDraftItem;
  };
  stationery: {
    amount: number;
    remarks: string;
    bill: {
      url: string;
      fileName: string;
      detectedAmount?: number;
      isVerified?: boolean;
      origin?: string;
      destination?: string;
      count?: number;
      quality?: string;
    } | null;
  };
  otherItems: {
    id: string;
    description: string;
    amount: number;
    remarks: string;
    bill: {
      url: string;
      fileName: string;
      detectedAmount?: number;
      isVerified?: boolean;
      origin?: string;
      destination?: string;
      count?: number;
      quality?: string;
    } | null;
  }[];
  totalAmount: number;
}

export interface ExpenseItem {
  sNo: number;
  category: string;
  description: string;
  count: number;
  countAmount: string;
  total: number;
  bill: string;
  remarks: string;
}

export interface FinanceStatement {
  collegeName: string;
  clusterName: string;
  clusterId?: string;
  sessionName: string;
  sessionDay: string;
  date: string;
  spocName: string;
  financerName: string;
  volunteerCount: number;
  expenses: ExpenseItem[];
  travelTotal: number;
  foodTotal: number;
  stationeryTotal: number;
  otherTotal: number;
  grandTotal: number;
  advanceReleased: number;
  balance: number;
  volunteers: { sNo: number; name: string; college: string; year: string }[];
  billImages: string[];
}

export interface ActivityReport {
  id: string;
  title: string;
  academicYear: string;
  name: string;
  clusterId?: string;
  clusterName?: string;
  date: string;
  venue: string;
  studentsCount: number;
  villageTown: string;
  volunteersCount: number;
  introduction: string;
  skillEnhancement: string[];
  feedback: string[];
  photos: string[];
}

export interface NotificationItem {
  id: string;
  type: 'correction' | 'approval' | 'session' | 'info';
  title: string;
  message: string;
  timeAgo: string;
  isRead: boolean;
  actionLabel?: string;
  actionTab?: TabType;
  targetId?: string;
}

export interface VolunteerAttendanceRecord {
  volunteerId: string;
  volunteerName: string;
  role?: string;
  roundNumber?: 1 | 2;
  status: 'Present' | 'Absent';
}

export interface AttendanceRecord {
  studentId: string;
  studentName: string;
  code: string;
  standard?: string;
  gender?: string;
  villageName?: string;
  status: 'Present' | 'Absent' | 'Not Marked' | 'Late';
  taskStatus?: 'Completed' | 'Incomplete' | 'Not Completed' | 'Not Marked';
  taskTitle?: string;
  remarks?: string;
  roundNumber?: 1 | 2;
}

export interface AttendanceSession {
  id: string;
  sessionId?: string;
  sessionName?: string;
  clusterId?: string;
  clusterName?: string;
  panchayatId?: string;
  panchayatName: string;
  villageId?: string;
  villageName: string;
  date: string;
  day: string;
  dayNumber?: number;
  taskTopic?: string;
  totalCount?: number;
  presentCount?: number;
  absentCount?: number;
  taskCompletedCount?: number;
  tasksCompletedCount?: number;
  notMarkedCount?: number;
  status:
    | 'Draft'
    | 'Submitted - Pending Review'
    | 'Edit Requested'
    | 'Edit Approved'
    | 'Resubmission'
    | 'Approved'
    | 'Rejected'
    | 'Submitted'
    | 'Correction Requested'
    | 'Pending Review'
    | 'Resubmission Required';
  lastSaved?: string;
  adminComment?: string;
  correctionReason?: string;
  editReason?: string;
  editRequestedBy?: string;
  editRequestedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  submittedAt?: string;
  updatedAt?: string;
  submittedBy?: string;
  records: AttendanceRecord[];
  volunteerAttendance?: VolunteerAttendanceRecord[];
}

export interface CorrectionRequest {
  id: string;
  module: 'Attendance' | 'Lesson Plan' | 'Finance' | 'Sessions' | 'Session Photos';
  clusterId: string;
  clusterName: string;
  recordId: string;
  recordTitle: string;
  requestedBy: string;
  requesterRole: string;
  requestedAt: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Resubmission Requested';
  resubmissionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface ApprovalItem {
  id: string;
  module: 'Attendance' | 'Lesson Plan' | 'Finance' | 'Sessions' | 'Correction Request' | 'Session Photos';
  clusterId: string;
  clusterName: string;
  recordId: string;
  recordTitle: string;
  submittedBy: string;
  submittedAt: string;
  status: 'Pending' | 'Approved' | 'Correction Requested' | 'Rejected';
  details: any;
  correctionReason?: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  recordId: string;
  clusterId?: string;
  clusterName?: string;
  details: string;
  timestamp: string;
}

// ==========================================
// TQI OFFICIAL MODULE RESOURCE MANAGEMENT
// ==========================================

export type ModuleResourceType = 'PPT' | 'PPTX' | 'PDF' | 'DOCX' | 'ZIP' | 'IMAGE' | 'SUPPORTING_DOC';

export interface ModuleResource {
  id: string;
  moduleId: string;
  fileName: string;
  originalFileName: string;
  fileType: ModuleResourceType;
  mimeType: string;
  fileSize: number; // in bytes
  fileSizeFormatted: string; // e.g. "8.4 MB"
  filePath?: string;
  fileUrl?: string;
  isPrimaryPPT: boolean;
  storageProvider: 'local' | 'google_drive';
  googleDriveFileId?: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface ModuleSlide {
  slideNumber: number;
  title: string;
  subtitle?: string;
  bullets?: string[];
  keyTakeaway?: string;
  activityPrompt?: string;
  timeAllocation?: string;
  notes?: string;
}

export interface TqiModule {
  id: string;
  moduleNumber: string; // e.g. "M01", "Module 01"
  moduleName: string; // e.g. "Communication Skills"
  topic: string; // e.g. "Communication & Confidence"
  academicYear: string; // e.g. "2026–2027"
  dayNumber?: number; // 1 to 8, or undefined if not specified
  dayLabel?: string; // e.g. "Day 1"
  description?: string;
  duration?: string; // e.g. "90 Mins"
  learningObjectives?: string[];
  targetAudience?: string; // e.g. "6th - 10th Standard"
  status: 'Active' | 'Under Review' | 'Archived' | 'Draft';
  version: number;
  primaryFileName?: string;
  primaryFileSize?: string;
  primaryFileType?: string;
  totalSlides?: number;
  resources: ModuleResource[];
  slides?: ModuleSlide[];
  googleDriveFileId?: string;
  googleDriveFolderId?: string;
  googleDriveUrl?: string;
  googleDriveLastModified?: string;
  hasDriveUpdate?: boolean;
  driveUpdateDetails?: {
    driveVersionTime?: string;
    driveFileName?: string;
    driveFileSize?: string;
  };
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DuplicateModuleCheckResult {
  isDuplicate: boolean;
  duplicateType?: 'module_number' | 'file_name' | 'drive_id' | 'exact_match';
  existingModule?: TqiModule;
  message?: string;
}

export interface DateChangeRequest {
  id: string;
  sessionId: string;
  clusterId: string;
  clusterName?: string;
  dayNumber?: number;
  originalDate: string;
  requestedDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewRemarks?: string;
  reviewedAt?: string;
  requestedBy: string;
  requestedByName?: string;
  createdAt: string;
}

export interface SessionReport {
  id: string;
  sessionId: string;
  clusterId: string;
  clusterName?: string;
  dayNumber?: number;
  sessionSummary: string;
  studentCount: number;
  attendanceSummary: string;
  activities: string;
  issues: string;
  remarks: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SessionSubmission {
  id: string;
  sessionId: string;
  clusterId: string;
  clusterName?: string;
  dayNumber: number;
  attendanceComplete: boolean;
  lessonPlanComplete: boolean;
  photosComplete: boolean;
  reportComplete: boolean;
  financeComplete: boolean;
  status: 'DRAFT' | 'SUBMITTED' | 'PENDING_REVIEW' | 'APPROVED' | 'RESUBMISSION_REQUIRED' | 'RESUBMITTED' | 'COMPLETED';
  submittedAt?: string;
  submittedBy?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  resubmissionReason?: string;
  resubmittedAt?: string;
  createdAt?: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClusterDayPhotoSummary {
  dayNumber: number;
  status: string;
  photoCount: number;
  maxPhotos: number;
  submittedBy?: string | null;
  submittedAt?: string | null;
  isLocked: boolean;
}

export interface ClusterPhotoSummary {
  clusterId: string;
  clusterName: string;
  district: string;
  totalPhotos: number;
  submittedDaysCount: number;
  days: ClusterDayPhotoSummary[];
}
