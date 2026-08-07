import type { LessonFilters } from './lesson.types'

export const lessonQueryKeys = {
  all: ['lessons'] as const,
  classes: ['lessons', 'class'] as const,
  class: (classId: string) => ['lessons', 'class', classId] as const,
  detail: (lessonId: string) => ['lessons', 'detail', lessonId] as const,
  list: (filters: LessonFilters = {}) =>
    ['lessons', 'list', filters.search ?? '', filters.status ?? 'ALL'] as const,
  lists: ['lessons', 'list'] as const,
  tasks: (lessonId: string) => ['lessons', 'tasks', lessonId] as const,
  taskSubmissions: (lessonId: string) =>
    ['lessons', 'task-submissions', lessonId] as const,
  student: ['lessons', 'student'] as const,
  studentList: ['lessons', 'student', 'list'] as const,
  studentDetail: (lessonId: string) =>
    ['lessons', 'student', 'detail', lessonId] as const,
}
