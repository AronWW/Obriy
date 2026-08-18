import { authorizedRequest } from '../../auth/model/session.service'
import type {
  AssignmentEditor,
  AssignmentFilters,
  AssignmentListResponse,
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
  if (filters.contentLocale) {
    searchParams.set('contentLocale', filters.contentLocale)
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
