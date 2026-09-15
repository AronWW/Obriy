export type AnalyticsReleaseStatus = 'SCHEDULED' | 'ACTIVE' | 'CLOSED'

export type AnalyticsStudentStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'NEEDS_REVISION'
  | 'COMPLETED'
  | 'EXPIRED'

export type AnalyticsAttemptStatus =
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'GRADED'
  | 'RETURNED'
  | 'CANCELLED'
  | 'EXPIRED'

export interface TeacherAnalyticsStatusCounts {
  notStarted: number
  inProgress: number
  awaitingReview: number
  needsRevision: number
  completed: number
  expired: number
}

export interface TeacherAnalyticsStudent {
  id: string
  displayName: string
  avatarUrl: string | null
  requiredCount: number
  completedCount: number
  completionPercent: number | null
  averagePercent: number | null
  statuses: TeacherAnalyticsStatusCounts
  lastActivityAt: string | null
}

export interface TeacherAnalyticsTest {
  releaseId: string
  testId: string
  title: string
  releaseStatus: AnalyticsReleaseStatus
  isRequired: boolean
  availableFrom: string | null
  dueAt: string | null
  maxPoints: number
  passingPercent: number
  studentCount: number
  completionPercent: number | null
  averagePercent: number | null
  statuses: TeacherAnalyticsStatusCounts
}

export interface TeacherAnalyticsLesson {
  id: string
  title: string
  position: number
  requiredTestCount: number
  completionPercent: number | null
  averagePercent: number | null
  tests: TeacherAnalyticsTest[]
}

export interface TeacherClassAnalytics {
  class: { id: string; name: string }
  metrics: {
    studentCount: number
    requiredReleaseCount: number
    requiredWorkCount: number
    completedWorkCount: number
    completionPercent: number | null
    averagePercent: number | null
    awaitingReviewCount: number
  }
  students: TeacherAnalyticsStudent[]
  lessons: TeacherAnalyticsLesson[]
}

export interface TeacherStudentAttempt {
  id: string
  attemptNumber: number
  status: AnalyticsAttemptStatus
  maxPoints: number
  scorePoints: number | null
  scorePercent: number | null
  isPassed: boolean | null
  pendingReviewCount: number
  isLate: boolean
  startedAt: string
  submittedAt: string | null
  gradedAt: string | null
}

export interface TeacherStudentTestResult {
  releaseId: string
  testId: string
  title: string
  releaseStatus: AnalyticsReleaseStatus
  isRequired: boolean
  status: AnalyticsStudentStatus
  maxPoints: number
  passingPercent: number
  scorePoints: number | null
  scorePercent: number | null
  bestPoints: number | null
  bestPercent: number | null
  attemptCount: number
  isLate: boolean
  availableFrom: string | null
  dueAt: string | null
  lastActivityAt: string | null
  attempts: TeacherStudentAttempt[]
}

export interface TeacherStudentAnalytics {
  class: { id: string; name: string }
  student: TeacherAnalyticsStudent
  lessons: Array<{
    id: string
    title: string
    position: number
    tests: TeacherStudentTestResult[]
  }>
}
