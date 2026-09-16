import { authorizedRequest } from '../../auth/model/session.service'
import type {
  ClassLessonItem,
  Lesson,
  LessonDraftInput,
  LessonFilters,
  LessonMoveDirection,
  LessonSummary,
  StudentLesson,
  StudentLessonSummary,
} from '../model/lesson.types'

export function listTeacherLessons(
  filters: LessonFilters = {},
): Promise<LessonSummary[]> {
  const searchParams = new URLSearchParams()

  if (filters.search?.trim()) {
    searchParams.set('search', filters.search.trim())
  }
  if (filters.status) {
    searchParams.set('status', filters.status)
  }

  const query = searchParams.toString()
  return authorizedRequest<LessonSummary[]>(`/lessons${query ? `?${query}` : ''}`)
}

export function createLesson(input: LessonDraftInput): Promise<Lesson> {
  return authorizedRequest<Lesson>('/lessons', {
    method: 'POST',
    body: input,
  })
}

export function getLesson(lessonId: string): Promise<Lesson> {
  return authorizedRequest<Lesson>(`/lessons/${lessonId}`)
}

export function updateLesson(
  lessonId: string,
  input: LessonDraftInput,
): Promise<Lesson> {
  return authorizedRequest<Lesson>(`/lessons/${lessonId}`, {
    method: 'PATCH',
    body: input,
  })
}

export function deleteLesson(lessonId: string): Promise<void> {
  return authorizedRequest<void>(`/lessons/${lessonId}`, {
    method: 'DELETE',
  })
}

export function archiveLesson(lessonId: string): Promise<Lesson> {
  return authorizedRequest<Lesson>(`/lessons/${lessonId}/archive`, {
    method: 'POST',
  })
}

export function restoreLesson(lessonId: string): Promise<Lesson> {
  return authorizedRequest<Lesson>(`/lessons/${lessonId}/restore`, {
    method: 'POST',
  })
}

export function listClassLessons(classId: string): Promise<ClassLessonItem[]> {
  return authorizedRequest<ClassLessonItem[]>(`/classes/${classId}/lessons`)
}

export function setClassLesson(
  classId: string,
  lessonId: string,
  published: boolean,
): Promise<ClassLessonItem> {
  return authorizedRequest<ClassLessonItem>(
    `/classes/${classId}/lessons/${lessonId}`,
    {
      method: 'PUT',
      body: { published },
    },
  )
}

export function unlinkClassLesson(
  classId: string,
  lessonId: string,
): Promise<void> {
  return authorizedRequest<void>(
    `/classes/${classId}/lessons/${lessonId}`,
    { method: 'DELETE' },
  )
}

export function moveClassLesson(
  classId: string,
  lessonId: string,
  direction: LessonMoveDirection,
): Promise<ClassLessonItem[]> {
  return authorizedRequest<ClassLessonItem[]>(
    `/classes/${classId}/lessons/${lessonId}/move`,
    {
      method: 'POST',
      body: { direction },
    },
  )
}

export function listStudentLessons(): Promise<StudentLessonSummary[]> {
  return authorizedRequest<StudentLessonSummary[]>('/classes/me/lessons')
}

export function getStudentLesson(lessonId: string): Promise<StudentLesson> {
  return authorizedRequest<StudentLesson>(`/classes/me/lessons/${lessonId}`)
}

export interface LessonReportInput {
  category: 'AGE_INAPPROPRIATE' | 'VIOLENCE' | 'HATE_OR_HARASSMENT' | 'SEXUAL_CONTENT' | 'PERSONAL_DATA' | 'MISINFORMATION' | 'OTHER'
  details: string
}

export function reportStudentLesson(lessonId: string, input: LessonReportInput) {
  return authorizedRequest<{ caseId: string; status: string; reportedAt: string }>(`/student/lessons/${lessonId}/report`, { method: 'POST', body: input })
}

export function reportParentLesson(childId: string, lessonId: string, input: LessonReportInput) {
  return authorizedRequest<{ caseId: string; status: string; reportedAt: string }>(`/parent/children/${childId}/lessons/${lessonId}/report`, { method: 'POST', body: input })
}

export function resubmitLessonModeration(lessonId: string, expectedEditVersion: number) {
  return authorizedRequest<{ caseId: string; status: string; editVersion: number; resolutionNote: string | null }>(`/lessons/${lessonId}/moderation/resubmit`, { method: 'POST', body: { expectedEditVersion } })
}
