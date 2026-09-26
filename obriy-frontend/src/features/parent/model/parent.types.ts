export interface LinkedChild {
  id: string
  displayName: string
  avatarUrl: string | null
}

export type ParentAttentionReason = 'NEEDS_REVISION' | 'OVERDUE' | 'DUE_SOON'
export type ParentWorkAvailability = 'SCHEDULED' | 'AVAILABLE' | 'CLOSED'
export type TestStudentStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'NEEDS_REVISION'
  | 'COMPLETED'
  | 'EXPIRED'

export interface ParentClass {
  id: string
  name: string
}

export interface ParentMetrics {
  requiredReleaseCount: number
  completedCount: number
  completionPercent: number | null
  averagePercent: number | null
  attentionCount: number
  nextDueAt: string | null
}

export interface ParentChildSummary extends LinkedChild {
  class: ParentClass | null
  metrics: ParentMetrics
}

export interface ParentDashboard {
  children: ParentChildSummary[]
}

export interface ParentLessonRef {
  id: string
  title: string
  position: number
}

export interface ParentWorkItem {
  releaseId: string
  testId: string
  title: string
  lesson: ParentLessonRef
  releaseStatus: 'SCHEDULED' | 'ACTIVE' | 'CLOSED'
  isRequired: boolean
  availability: ParentWorkAvailability
  status: TestStudentStatus
  availableFrom: string | null
  dueAt: string | null
  maxPoints: number
  scorePoints: number | null
  scorePercent: number | null
  bestPoints: number | null
  bestPercent: number | null
  attemptCount: number
  lastActivityAt: string | null
  attentionReason: ParentAttentionReason | null
}

export interface ParentChildOverview {
  child: ParentChildSummary
  attention: ParentWorkItem[]
  upcoming: ParentWorkItem[]
  recentActivity: ParentWorkItem[]
}

export interface ParentAttempt {
  id: string
  attemptNumber: number
  status: 'IN_PROGRESS' | 'AWAITING_REVIEW' | 'GRADED' | 'RETURNED' | 'EXPIRED' | 'CANCELLED'
  maxPoints: number
  scorePoints: number | null
  scorePercent: number | null
  isPassed: boolean | null
  isLate: boolean
  startedAt: string
  submittedAt: string | null
  gradedAt: string | null
}

export interface ParentTestProgress extends ParentWorkItem {
  attempts: ParentAttempt[]
}

export interface ParentLessonProgress extends ParentLessonRef {
  summary: string | null
  content: string
  contentLocale: 'UK' | 'EN'
  estimatedMinutes: number | null
  requiredTestCount: number
  completedRequiredCount: number
  completionPercent: number | null
  averagePercent: number | null
  tests: ParentTestProgress[]
}

export interface ParentChildProgress {
  child: ParentChildSummary
  lessons: ParentLessonProgress[]
}
