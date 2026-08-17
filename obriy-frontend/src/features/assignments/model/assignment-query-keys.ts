import type { AssignmentFilters } from './assignment.types'

export const assignmentQueryKeys = {
  all: ['assignments'] as const,
  detail: (assignmentId: string) =>
    ['assignments', 'detail', assignmentId] as const,
  list: (filters: AssignmentFilters) =>
    [
      'assignments',
      'list',
      filters.search ?? '',
      filters.status ?? 'ALL',
      filters.type ?? 'ALL',
    ] as const,
  lists: ['assignments', 'list'] as const,
  lesson: (lessonId: string) =>
    ['assignments', 'lesson', lessonId] as const,
  lessonReviews: (lessonId: string) =>
    ['assignments', 'lesson-reviews', lessonId] as const,
  studentLesson: (lessonId: string) =>
    ['assignments', 'student-lesson', lessonId] as const,
}
