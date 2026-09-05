import type {
  AssignmentStatus,
  AssignmentType,
  ContentLocale,
} from '../../assignments/model/assignment.types'
import type { MapPoint, MapPreset } from '../../maps/model/map.types'

export type TestStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type TestRevisionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type TestScorePolicy = 'BEST' | 'LATEST'

export interface TestItem {
  id: string
  position: number
  maxPoints: number
  assignmentId: string
  assignmentRevisionId: string
  assignmentType: AssignmentType
  title: string
  hasUpdate: boolean
}

export interface TestRevision {
  id: string
  version: number
  status: TestRevisionStatus
  title: string
  description: string
  instructions: string | null
  passingPercent: number
  maxAttempts: number | null
  timeLimitSeconds: number | null
  scorePolicy: TestScorePolicy
  shuffleItems: boolean
  schemaVersion: number
  editVersion: number
  items: TestItem[]
  totalMaxPoints: number
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TestEditor {
  id: string
  contentLocale: ContentLocale
  status: TestStatus
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  draftRevision: TestRevision | null
  publishedRevision: TestRevision | null
}

export interface TestListResponse {
  items: TestSummary[]
  nextCursor: string | null
}

export interface TestRevisionSummary {
  id: string
  version: number
  status: TestRevisionStatus
  title: string
  description: string
  itemCount: number
  totalMaxPoints: number
  publishedAt: string | null
  updatedAt: string
}

export interface TestSummary {
  id: string
  contentLocale: ContentLocale
  status: TestStatus
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  draftRevision: TestRevisionSummary | null
  publishedRevision: TestRevisionSummary | null
}

export interface TestFilters {
  search?: string
  status?: TestStatus
  contentLocale?: ContentLocale
}

export interface TestDraftVersionInput {
  expectedRevisionId: string
  expectedEditVersion: number
}

export interface UpdateTestDraftInput extends TestDraftVersionInput {
  title?: string
  description?: string
  instructions?: string | null
  passingPercent?: number
  maxAttempts?: number | null
  timeLimitSeconds?: number | null
  scorePolicy?: TestScorePolicy
  shuffleItems?: boolean
}

export interface LessonTest {
  id: string
  lessonId: string
  testId: string
  testRevisionId: string
  revisionVersion: number
  position: number
  title: string
  description: string
  itemCount: number
  maxPoints: number
  hasUpdate: boolean
  activeReleaseCount: number
  releaseCount: number
  releaseStatuses: TestReleaseStatus[]
  linkedAt: string
}

export type TestReleaseStatus =
  'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED'

export type TestStudentStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'NEEDS_REVISION'
  | 'COMPLETED'
  | 'EXPIRED'

export type TestAttemptStatus =
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'GRADED'
  | 'RETURNED'
  | 'EXPIRED'
  | 'CANCELLED'

export type TestAnswerStatus =
  'DRAFT' | 'AWAITING_REVIEW' | 'GRADED' | 'RETURNED'

export interface StudentTestAnswer {
  id: string
  testItemId: string
  status: TestAnswerStatus
  responseData: Record<string, unknown>
  maxPoints: number
  scorePoints: number | null
  scorePercent: number | null
  isCorrect: boolean | null
  teacherComment: string | null
  solutionFeedback: MapSolutionFeedback | null
}

export interface MapPointSolutionFeedback {
  target: MapPoint
  radiusKm: number
  distanceKm: number | null
  withinRadius: boolean | null
}

export interface MapRegionSolutionFeedback {
  correctRegionId: string
  matches: boolean | null
}

export type MapSolutionFeedback =
  MapPointSolutionFeedback | MapRegionSolutionFeedback

export interface StudentTestAttempt {
  id: string
  attemptNumber: number
  status: TestAttemptStatus
  maxPoints: number
  scorePoints: number | null
  scorePercent: number | null
  isPassed: boolean | null
  pendingReviewCount: number
  answers: StudentTestAnswer[]
  startedAt: string
  expiresAt: string | null
  submittedAt: string | null
  gradedAt: string | null
}

export interface StudentTestItem {
  id: string
  position: number
  maxPoints: number
  assignmentId: string
  assignmentRevisionId: string
  type: AssignmentType
  title: string
  prompt: string
  instructions: string | null
  publicConfig: Record<string, unknown>
  mapPreset: MapPreset | null
}

export interface StudentLessonTest {
  releaseId: string
  testId: string
  testRevisionId: string
  title: string
  description: string
  instructions: string | null
  maxPoints: number
  passingPercent: number
  isRequired: boolean
  maxAttempts: number | null
  timeLimitSeconds: number | null
  dueAt: string | null
  stateStatus: TestStudentStatus
  itemCount: number
  items: StudentTestItem[]
  attempt: StudentTestAttempt | null
}

export interface TeacherTestAnswerReview {
  answerId: string
  testItemId: string
  type: AssignmentType
  title: string
  prompt: string
  responseData: Record<string, unknown>
  status: TestAnswerStatus
  maxPoints: number
  scorePoints: number | null
  scorePercent: number | null
  isCorrect: boolean | null
  teacherComment: string | null
  publicConfig: Record<string, unknown>
  gradingConfig: Record<string, unknown>
  gradingData: Record<string, unknown>
  mapPreset: MapPreset | null
  choiceOptions: Array<{
    id: string
    text: string
    selected: boolean
    correct: boolean
  }> | null
}

export interface TeacherTestAttemptReview {
  attemptId: string
  releaseId: string
  testId: string
  testTitle: string
  attemptNumber: number
  status: TestAttemptStatus
  maxPoints: number
  scorePoints: number | null
  scorePercent: number | null
  isPassed: boolean | null
  pendingReviewCount: number
  studentId: string
  studentName: string
  classId: string
  className: string
  answers: TeacherTestAnswerReview[]
  submittedAt: string | null
  gradedAt: string | null
}

export interface TeacherTestReviewList {
  items: TeacherTestAttemptReview[]
  nextCursor: string | null
}

export interface AssignmentPickerItem {
  id: string
  type: AssignmentType
  status: AssignmentStatus
  defaultMaxPoints: number
  title: string
}
