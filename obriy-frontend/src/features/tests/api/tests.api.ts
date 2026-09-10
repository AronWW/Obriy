import { authorizedRequest } from '../../auth/model/session.service'
import type { ContentLocale } from '../../assignments/model/assignment.types'
import type {
  LessonTest,
  StudentLessonTest,
  StudentTestAttempt,
  TeacherTestRelease,
  TeacherTestAttemptReview,
  TeacherTestReviewList,
  TestDraftVersionInput,
  TestEditor,
  TestFilters,
  TestListResponse,
  UpdateTestDraftInput,
  UpdateTestReleaseSettingsInput,
} from '../model/test.types'

export function listTests(
  filters: TestFilters,
  cursor?: string,
  limit = 20,
): Promise<TestListResponse> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (filters.search?.trim()) params.set('search', filters.search.trim())
  if (filters.status) params.set('status', filters.status)
  if (filters.contentLocale) params.set('contentLocale', filters.contentLocale)
  if (cursor) params.set('cursor', cursor)
  return authorizedRequest<TestListResponse>(`/tests?${params.toString()}`)
}

export function createTest(input: {
  contentLocale?: ContentLocale
  title?: string
  description?: string
  instructions?: string | null
  passingPercent?: number
  maxAttempts?: number | null
  timeLimitSeconds?: number | null
  scorePolicy?: 'BEST' | 'LATEST'
  shuffleItems?: boolean
}): Promise<TestEditor> {
  return authorizedRequest<TestEditor>('/tests', { method: 'POST', body: input })
}

export function getTest(testId: string): Promise<TestEditor> {
  return authorizedRequest<TestEditor>(`/tests/${testId}`)
}

export function updateTestDraft(
  testId: string,
  input: UpdateTestDraftInput,
): Promise<TestEditor> {
  return authorizedRequest<TestEditor>(`/tests/${testId}/draft`, {
    method: 'PATCH',
    body: input,
  })
}

export function startTestEdit(testId: string): Promise<TestEditor> {
  return authorizedRequest<TestEditor>(`/tests/${testId}/start-edit`, {
    method: 'POST',
  })
}

export function addTestItem(
  testId: string,
  assignmentId: string,
  version: TestDraftVersionInput,
): Promise<TestEditor> {
  return authorizedRequest<TestEditor>(`/tests/${testId}/draft/items`, {
    method: 'POST',
    body: { assignmentId, ...version },
  })
}

export function updateTestItem(
  testId: string,
  itemId: string,
  maxPoints: number,
  version: TestDraftVersionInput,
): Promise<TestEditor> {
  return authorizedRequest<TestEditor>(
    `/tests/${testId}/draft/items/${itemId}`,
    { method: 'PATCH', body: { maxPoints, ...version } },
  )
}

export function updateTestItemRevision(
  testId: string,
  itemId: string,
  version: TestDraftVersionInput,
): Promise<TestEditor> {
  return authorizedRequest<TestEditor>(
    `/tests/${testId}/draft/items/${itemId}/update-revision`,
    { method: 'POST', body: version },
  )
}

export function reorderTestItems(
  testId: string,
  itemIds: string[],
  version: TestDraftVersionInput,
): Promise<TestEditor> {
  return authorizedRequest<TestEditor>(`/tests/${testId}/draft/items/order`, {
    method: 'PUT',
    body: { itemIds, ...version },
  })
}

export function removeTestItem(
  testId: string,
  itemId: string,
  version: TestDraftVersionInput,
): Promise<TestEditor> {
  return authorizedRequest<TestEditor>(
    `/tests/${testId}/draft/items/${itemId}`,
    { method: 'DELETE', body: version },
  )
}

export function archiveTest(testId: string): Promise<TestEditor> {
  return authorizedRequest<TestEditor>(`/tests/${testId}/archive`, {
    method: 'POST',
  })
}

export function restoreTest(testId: string): Promise<TestEditor> {
  return authorizedRequest<TestEditor>(`/tests/${testId}/restore`, {
    method: 'POST',
  })
}

export function deleteTest(testId: string): Promise<void> {
  return authorizedRequest<void>(`/tests/${testId}`, { method: 'DELETE' })
}

export function listLessonTests(lessonId: string): Promise<LessonTest[]> {
  return authorizedRequest<LessonTest[]>(`/lessons/${lessonId}/tests`)
}

export function linkLessonTest(
  lessonId: string,
  testId: string,
): Promise<LessonTest> {
  return authorizedRequest<LessonTest>(`/lessons/${lessonId}/tests`, {
    method: 'POST',
    body: { testId },
  })
}

export function updateLessonTestVersion(
  lessonId: string,
  testId: string,
): Promise<LessonTest> {
  return authorizedRequest<LessonTest>(
    `/lessons/${lessonId}/tests/${testId}/update-version`,
    { method: 'POST' },
  )
}

export function reorderLessonTests(
  lessonId: string,
  testIds: string[],
): Promise<LessonTest[]> {
  return authorizedRequest<LessonTest[]>(`/lessons/${lessonId}/tests/order`, {
    method: 'PUT',
    body: { testIds },
  })
}

export function unlinkLessonTest(
  lessonId: string,
  testId: string,
): Promise<void> {
  return authorizedRequest<void>(`/lessons/${lessonId}/tests/${testId}`, {
    method: 'DELETE',
  })
}

export function listTeacherTestReleases(
  lessonId: string,
  testId: string,
): Promise<TeacherTestRelease[]> {
  return authorizedRequest<TeacherTestRelease[]>(
    `/lessons/${lessonId}/tests/${testId}/releases`,
  )
}

export function updateTeacherTestRelease(
  releaseId: string,
  settings: UpdateTestReleaseSettingsInput,
): Promise<TeacherTestRelease> {
  return authorizedRequest<TeacherTestRelease>(`/test-releases/${releaseId}`, {
    method: 'PATCH',
    body: settings,
  })
}

export function updateTeacherTestReleases(
  lessonId: string,
  testId: string,
  releaseIds: string[],
  settings: UpdateTestReleaseSettingsInput,
): Promise<TeacherTestRelease[]> {
  return authorizedRequest<TeacherTestRelease[]>(
    `/lessons/${lessonId}/tests/${testId}/releases/bulk`,
    { method: 'PATCH', body: { releaseIds, settings } },
  )
}

export function publishTeacherTestRelease(
  releaseId: string,
): Promise<TeacherTestRelease> {
  return authorizedRequest<TeacherTestRelease>(
    `/test-releases/${releaseId}/publish`,
    { method: 'POST' },
  )
}

export function publishTeacherTestReleases(
  lessonId: string,
  testId: string,
  releaseIds: string[],
): Promise<TeacherTestRelease[]> {
  return authorizedRequest<TeacherTestRelease[]>(
    `/lessons/${lessonId}/tests/${testId}/releases/publish`,
    { method: 'POST', body: { releaseIds } },
  )
}

export function closeTeacherTestRelease(
  releaseId: string,
): Promise<TeacherTestRelease> {
  return authorizedRequest<TeacherTestRelease>(
    `/test-releases/${releaseId}/close`,
    { method: 'POST' },
  )
}

export function reopenTeacherTestRelease(
  releaseId: string,
): Promise<TeacherTestRelease> {
  return authorizedRequest<TeacherTestRelease>(
    `/test-releases/${releaseId}/reopen`,
    { method: 'POST' },
  )
}

export function listStudentLessonTests(
  lessonId: string,
): Promise<StudentLessonTest[]> {
  return authorizedRequest<StudentLessonTest[]>(
    `/classes/me/lessons/${lessonId}/tests`,
  )
}

export function getStudentTestRelease(
  releaseId: string,
): Promise<StudentLessonTest> {
  return authorizedRequest<StudentLessonTest>(`/test-releases/${releaseId}`)
}

export function startStudentTestAttempt(
  releaseId: string,
): Promise<StudentTestAttempt> {
  return authorizedRequest<StudentTestAttempt>(
    `/test-releases/${releaseId}/attempts`,
    { method: 'POST' },
  )
}

export function saveStudentTestAnswer(
  attemptId: string,
  testItemId: string,
  responseData: Record<string, unknown>,
): Promise<StudentTestAttempt> {
  return authorizedRequest<StudentTestAttempt>(
    `/test-attempts/${attemptId}/answers/${testItemId}`,
    { method: 'PUT', body: { responseData } },
  )
}

export function submitStudentTestAttempt(
  attemptId: string,
): Promise<StudentTestAttempt> {
  return authorizedRequest<StudentTestAttempt>(
    `/test-attempts/${attemptId}/submit`,
    { method: 'POST' },
  )
}

export function listLessonTestReviews(
  lessonId: string,
  cursor?: string,
): Promise<TeacherTestReviewList> {
  const params = new URLSearchParams({ limit: '20' })
  if (cursor) params.set('cursor', cursor)
  return authorizedRequest<TeacherTestReviewList>(
    `/lessons/${lessonId}/test-attempts?${params.toString()}`,
  )
}

export function getLessonTestReview(
  lessonId: string,
  attemptId: string,
): Promise<TeacherTestAttemptReview> {
  return authorizedRequest<TeacherTestAttemptReview>(
    `/lessons/${lessonId}/test-attempts/${attemptId}`,
  )
}

export function reviewTestAnswer(
  answerId: string,
  input: {
    decision: 'APPROVED' | 'RETURNED'
    scorePoints?: number
    teacherComment?: string | null
  },
): Promise<TeacherTestAttemptReview> {
  return authorizedRequest<TeacherTestAttemptReview>(
    `/test-answers/${answerId}/review`,
    { method: 'PATCH', body: input },
  )
}
