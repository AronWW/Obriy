export type AdminUserRole = 'STUDENT' | 'TEACHER' | 'PARENT' | 'ADMIN'
export type AdminUserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED'
export type ModerationCaseStatus =
  | 'REPORTED'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'DISMISSED'
  | 'REMOVED'

export interface AdminDashboard {
  users: number
  students: number
  teachers: number
  parents: number
  pendingUsers: number
  suspendedUsers: number
  newUsersLast30Days: number
  classes: number
  publishedLessons: number
  publishedReleases: number
  messagesLast30Days: number
  openModerationCases: number
}

export interface AdminUser {
  id: string
  email: string
  role: AdminUserRole
  status: AdminUserStatus
  displayName: string
  avatarUrl: string | null
  subjectArea: string | null
  preferredLocale: 'UK' | 'EN'
  classId: string | null
  className: string | null
  emailVerifiedAt: string | null
  createdAt: string
  updatedAt: string
  stats: { classes: number; lessons: number; assignments: number; tests: number; children: number; guardians: number }
}

export interface AdminClass {
  id: string
  name: string
  teacherId: string
  teacherName: string
  teacherEmail: string
  studentCount: number
  lessonCount: number
  releaseCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminClassDetail extends AdminClass { students: AdminUser[] }

export interface LessonReport {
  id: string
  category: string
  details: string
  reporterId: string
  reporterName: string
  reporterRole: AdminUserRole
  subjectStudentId: string
  subjectStudentName: string
  classId: string
  className: string
  createdAt: string
}

export interface LessonModerationCase {
  id: string
  lessonId: string
  lessonTitle: string
  teacherId: string
  teacherName: string
  status: ModerationCaseStatus
  lessonModerationStatus: string
  lessonStatus: string
  reportCount: number
  editVersion: number
  resolutionNote: string | null
  initialSnapshot: Record<string, unknown>
  currentSnapshot: Record<string, unknown>
  reports: LessonReport[]
  createdAt: string
  updatedAt: string
}

export interface AdminAuditLog {
  id: string
  actorId: string
  actorName: string
  actorEmail: string
  action: string
  targetType: string
  targetId: string
  reason: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface CursorPage<T> { items: T[]; nextCursor: string | null }
