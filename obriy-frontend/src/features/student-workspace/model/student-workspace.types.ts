export type StudentWorkAvailability = 'SCHEDULED' | 'AVAILABLE' | 'CLOSED'
export type StudentAttentionReason = 'NEEDS_REVISION' | 'OVERDUE'
export type StudentWorkStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'NEEDS_REVISION'
  | 'COMPLETED'
  | 'EXPIRED'

export type StudentTasksStatusFilter =
  | 'ALL'
  | 'ATTENTION'
  | 'SCHEDULED'
  | StudentWorkStatus
export type StudentTasksRequiredFilter = 'ALL' | 'REQUIRED' | 'OPTIONAL'

export interface StudentWorkspaceClass {
  id: string
  name: string
}

export interface StudentWorkspaceLesson {
  id: string
  title: string
  position: number
}

export interface StudentWorkItem {
  releaseId: string
  testId: string
  title: string
  description: string | null
  lesson: StudentWorkspaceLesson
  releaseStatus: 'SCHEDULED' | 'ACTIVE' | 'CLOSED'
  isRequired: boolean
  availability: StudentWorkAvailability
  stateStatus: StudentWorkStatus
  availableFrom: string | null
  dueAt: string | null
  maxPoints: number
  scorePoints: number | null
  scorePercent: number | null
  bestPoints: number | null
  bestPercent: number | null
  attemptCount: number
  lastActivityAt: string | null
  attentionReason: StudentAttentionReason | null
  isOverdue: boolean
  canOpen: boolean
}

export interface StudentContinueLesson extends StudentWorkspaceLesson {
  workCount: number
  requiredCount: number
  completedRequiredCount: number
  nextReleaseId: string | null
}

export interface StudentDashboard {
  class: StudentWorkspaceClass | null
  metrics: {
    requiredReleaseCount: number
    completedCount: number
    completionPercent: number | null
    averagePercent: number | null
    attentionCount: number
    nextDueAt: string | null
  }
  attention: StudentWorkItem[]
  upcoming: StudentWorkItem[]
  continueLessons: StudentContinueLesson[]
}

export interface StudentTasksPage {
  class: StudentWorkspaceClass | null
  items: StudentWorkItem[]
  nextCursor: string | null
}

export interface StudentTasksFilters {
  status: StudentTasksStatusFilter
  required: StudentTasksRequiredFilter
  search: string
}
