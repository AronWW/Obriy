import { authorizedRequest } from '../../auth/model/session.service'
import type {
  ClassLessonItem,
  Lesson,
  LessonDraftInput,
  LessonFilters,
  LessonMoveDirection,
  LessonSummary,
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
