import type { Locale } from '../../auth/model/auth.types'

export type LessonStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface LessonClassLink {
  classId: string
  className: string
  position: number
  publishedAt: string | null
}

export interface LessonSummary {
  id: string
  title: string
  summary: string
  contentLocale: Locale
  estimatedMinutes: number | null
  status: LessonStatus
  createdAt: string
  updatedAt: string
  classLinks: LessonClassLink[]
}

export interface Lesson extends LessonSummary {
  content: string
}

export interface LessonDraftInput {
  title?: string
  summary?: string
  content?: string
  contentLocale?: Locale
  estimatedMinutes?: number | null
}

export interface LessonFilters {
  search?: string
  status?: LessonStatus
}

export interface ClassLessonItem {
  classId: string
  id: string
  title: string
  summary: string
  contentLocale: Locale
  estimatedMinutes: number | null
  status: LessonStatus
  createdAt: string
  updatedAt: string
  position: number
  publishedAt: string | null
}

export type LessonMoveDirection = 'UP' | 'DOWN'
