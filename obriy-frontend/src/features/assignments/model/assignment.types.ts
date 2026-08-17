export type AssignmentType =
  | 'WRITTEN'
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'MATCHING'
  | 'ORDERING'
  | 'CATEGORIZATION'
  | 'FILL_BLANKS'
  | 'IMAGE_HOTSPOT'
  | 'MAP_POINT'
  | 'MAP_REGION'
  | 'MAP_MULTI_REGION'

export type AssignmentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type AssignmentRevisionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type ContentLocale = 'UK' | 'EN'
export type AssignmentRevisionSource = 'DRAFT' | 'PUBLISHED'

export interface AssignmentRubricItem {
  id: string
  title: string
  description: string
  weight: number
}

export interface WrittenPublicConfig {
  responseMode: 'SHORT' | 'LONG'
  minLength: number
  maxLength: number
  allowAttachments: boolean
  rubric: AssignmentRubricItem[]
}

export interface AssignmentRevisionSummary {
  id: string
  version: number
  status: AssignmentRevisionStatus
  title: string
  editVersion: number
  publishedAt: string | null
  updatedAt: string
}

export interface AssignmentSummary {
  id: string
  type: AssignmentType
  contentLocale: ContentLocale
  status: AssignmentStatus
  defaultMaxPoints: number
  defaultPassingPercent: number
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  draftRevision: AssignmentRevisionSummary | null
  publishedRevision: AssignmentRevisionSummary | null
}

export interface AssignmentEditorRevision {
  id: string
  version: number
  status: AssignmentRevisionStatus
  title: string
  prompt: string
  instructions: string | null
  explanation: string | null
  publicConfig: Record<string, unknown>
  gradingConfig: Record<string, unknown> | null
  mapPresetId: string | null
  schemaVersion: number
  editVersion: number
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AssignmentEditor {
  id: string
  type: AssignmentType
  contentLocale: ContentLocale
  status: AssignmentStatus
  defaultMaxPoints: number
  defaultPassingPercent: number
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  draftRevision: AssignmentEditorRevision | null
  publishedRevision: AssignmentEditorRevision | null
}

export interface AssignmentListResponse {
  items: AssignmentSummary[]
  nextCursor: string | null
}

export interface AssignmentFilters {
  search?: string
  status?: AssignmentStatus
  type?: AssignmentType
}

export interface AssignmentDraftInput {
  title: string
  prompt: string
  instructions: string | null
  explanation: string | null
  publicConfig: WrittenPublicConfig
  gradingConfig: { mode: 'MANUAL' }
}

export interface CreateAssignmentInput {
  type: AssignmentType
  defaultMaxPoints: number
  defaultPassingPercent: number
  draft: AssignmentDraftInput
}

export interface UpdateAssignmentDraftInput extends AssignmentDraftInput {
  expectedRevisionId: string
  expectedEditVersion: number
  defaultMaxPoints: number
  defaultPassingPercent: number
}

export interface LessonAssignment {
  id: string
  lessonId: string
  assignmentId: string
  revisionId: string
  revisionVersion: number
  type: AssignmentType
  contentLocale: ContentLocale
  title: string
  prompt: string
  maxPoints: number
  passingPercent: number
  hasUpdate: boolean
  activeReleaseCount: number
  releaseCount: number
  linkedAt: string
}

export type AssignmentStudentStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'NEEDS_REVISION'
  | 'COMPLETED'
  | 'EXPIRED'

export type AssignmentAttemptStatus =
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'GRADED'
  | 'RETURNED'
  | 'EXPIRED'
  | 'CANCELLED'

export interface StudentAssignmentAttempt {
  id: string
  attemptNumber: number
  status: AssignmentAttemptStatus
  responseText: string
  teacherComment: string | null
  scorePoints: number | null
  scorePercent: number | null
  isPassed: boolean | null
  submittedAt: string | null
  reviewedAt: string | null
  updatedAt: string
}

export interface StudentLessonAssignment {
  releaseId: string
  assignmentId: string
  revisionId: string
  type: AssignmentType
  title: string
  prompt: string
  instructions: string | null
  publicConfig: Record<string, unknown>
  maxPoints: number
  passingPercent: number
  isRequired: boolean
  dueAt: string | null
  stateStatus: AssignmentStudentStatus
  attempt: StudentAssignmentAttempt | null
}

export interface TeacherAssignmentReview {
  attemptId: string
  releaseId: string
  assignmentId: string
  type: AssignmentType
  assignmentTitle: string
  prompt: string
  responseText: string
  attemptNumber: number
  status: 'AWAITING_REVIEW' | 'GRADED' | 'RETURNED'
  maxPoints: number
  passingPercent: number
  scorePoints: number | null
  scorePercent: number | null
  isPassed: boolean | null
  teacherComment: string | null
  submittedAt: string | null
  reviewedAt: string | null
  updatedAt: string
  student: {
    id: string
    displayName: string
  }
  class: {
    id: string
    name: string
  }
}

export interface ReviewAssignmentAttemptInput {
  decision: 'APPROVED' | 'RETURNED'
  scorePoints?: number
  teacherComment?: string | null
}
