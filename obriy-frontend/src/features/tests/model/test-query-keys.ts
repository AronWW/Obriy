import type { TestFilters } from './test.types'

export const testQueryKeys = {
  all: ['tests'] as const,
  lists: ['tests', 'list'] as const,
  list: (filters: TestFilters) => ['tests', 'list', filters] as const,
  detail: (testId: string) => ['tests', 'detail', testId] as const,
  lesson: (lessonId: string) => ['tests', 'lesson', lessonId] as const,
  studentLesson: (lessonId: string) =>
    ['tests', 'student-lesson', lessonId] as const,
  release: (releaseId: string) => ['tests', 'release', releaseId] as const,
  reviews: (lessonId: string) => ['tests', 'reviews', lessonId] as const,
  review: (lessonId: string, attemptId: string) =>
    ['tests', 'reviews', lessonId, attemptId] as const,
}
