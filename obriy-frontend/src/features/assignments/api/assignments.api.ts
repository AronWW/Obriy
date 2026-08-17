import { authorizedRequest } from '../../auth/model/session.service'
import type {
  AssignmentEditor,
  AssignmentFilters,
  AssignmentListResponse,
  LessonAssignment,
  StudentAssignmentAttempt,
  StudentLessonAssignment,
  TeacherAssignmentReview,
  ReviewAssignmentAttemptInput,
  AssignmentRevisionSource,
  CreateAssignmentInput,
  UpdateAssignmentDraftInput,
} from '../model/assignment.types'

export function listAssignments(
  filters: AssignmentFilters,
  cursor?: string,
  limit = 20,
): Promise<AssignmentListResponse> {
  const searchParams = new URLSearchParams({ limit: String(limit) })
  if (filters.search?.trim()) {
    searchParams.set('search', filters.search.trim())
  }
  if (filters.status) {
    searchParams.set('status', filters.status)
  }
  if (filters.type) {
    searchParams.set('type', filters.type)
  }
  if (cursor) {
    searchParams.set('cursor', cursor)
  }

  return authorizedRequest<AssignmentListResponse>(
    `/assignments?${searchParams.toString()}`,
  )
}

export function createAssignment(
  input: CreateAssignmentInput,
): Promise<AssignmentEditor> {
  return authorizedRequest<AssignmentEditor>('/assignments', {
    method: 'POST',
    body: input,
  })
}

export function getAssignment(
  assignmentId: string,
): Promise<AssignmentEditor> {
  return authorizedRequest<AssignmentEditor>(`/assignments/${assignmentId}`)
}

export function updateAssignmentDraft(
  assignmentId: string,
  input: UpdateAssignmentDraftInput,
): Promise<AssignmentEditor> {
  return authorizedRequest<AssignmentEditor>(
    `/assignments/${assignmentId}/draft`,
    { method: 'PATCH', body: input },
  )
}

export function startAssignmentEdit(
  assignmentId: string,
): Promise<AssignmentEditor> {
  return authorizedRequest<AssignmentEditor>(
    `/assignments/${assignmentId}/start-edit`,
    { method: 'POST' },
  )
}

export function duplicateAssignment(
  assignmentId: string,
  source?: AssignmentRevisionSource,
): Promise<AssignmentEditor> {
  return authorizedRequest<AssignmentEditor>(
    `/assignments/${assignmentId}/duplicate`,
    { method: 'POST', body: source ? { source } : {} },
  )
}

export function archiveAssignment(
  assignmentId: string,
): Promise<AssignmentEditor> {
  return authorizedRequest<AssignmentEditor>(
    `/assignments/${assignmentId}/archive`,
    { method: 'POST' },
  )
}

export function restoreAssignment(
  assignmentId: string,
): Promise<AssignmentEditor> {
  return authorizedRequest<AssignmentEditor>(
    `/assignments/${assignmentId}/restore`,
    { method: 'POST' },
  )
}

export function deleteAssignment(assignmentId: string): Promise<void> {
  return authorizedRequest<void>(`/assignments/${assignmentId}`, {
    method: 'DELETE',
  })
}

export function listLessonAssignments(
  lessonId: string,
): Promise<LessonAssignment[]> {
  return authorizedRequest<LessonAssignment[]>(
    `/lessons/${lessonId}/assignments`,
  )
}

export function linkLessonAssignment(
  lessonId: string,
  assignmentId: string,
): Promise<LessonAssignment> {
  return authorizedRequest<LessonAssignment>(
    `/lessons/${lessonId}/assignments`,
    { method: 'POST', body: { assignmentId } },
  )
}

export function updateLessonAssignmentVersion(
  lessonId: string,
  assignmentId: string,
): Promise<LessonAssignment> {
  return authorizedRequest<LessonAssignment>(
    `/lessons/${lessonId}/assignments/${assignmentId}/update-version`,
    { method: 'POST' },
  )
}

export function unlinkLessonAssignment(
  lessonId: string,
  assignmentId: string,
): Promise<void> {
  return authorizedRequest<void>(
    `/lessons/${lessonId}/assignments/${assignmentId}`,
    { method: 'DELETE' },
  )
}

export function listStudentLessonAssignments(
  lessonId: string,
): Promise<StudentLessonAssignment[]> {
  return authorizedRequest<StudentLessonAssignment[]>(
    `/classes/me/lessons/${lessonId}/assignments`,
  )
}

export function saveStudentAssignmentDraft(
  releaseId: string,
  text: string,
): Promise<StudentAssignmentAttempt> {
  return authorizedRequest<StudentAssignmentAttempt>(
    `/assignment-releases/${releaseId}/draft`,
    { method: 'PUT', body: { text } },
  )
}

export function submitStudentAssignment(
  releaseId: string,
  text: string,
): Promise<StudentAssignmentAttempt> {
  return authorizedRequest<StudentAssignmentAttempt>(
    `/assignment-releases/${releaseId}/submit`,
    { method: 'POST', body: { text } },
  )
}

export function listLessonAssignmentReviews(
  lessonId: string,
): Promise<TeacherAssignmentReview[]> {
  return authorizedRequest<TeacherAssignmentReview[]>(
    `/lessons/${lessonId}/assignment-attempts`,
  )
}

export function reviewAssignmentAttempt(
  attemptId: string,
  input: ReviewAssignmentAttemptInput,
): Promise<TeacherAssignmentReview> {
  return authorizedRequest<TeacherAssignmentReview>(
    `/assignment-attempts/${attemptId}/review`,
    { method: 'PATCH', body: input },
  )
}
