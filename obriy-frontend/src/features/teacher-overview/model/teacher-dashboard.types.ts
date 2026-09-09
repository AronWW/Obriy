import type {
  AssignmentStatus,
  AssignmentType,
} from '../../assignments/model/assignment.types'
import type { LessonStatus } from '../../lessons/model/lesson.types'
import type { TestStatus } from '../../tests/model/test.types'

export interface TeacherDashboardResourceStats {
  total: number
  drafts: number
}

export interface TeacherDashboard {
  stats: {
    classes: {
      total: number
      studentCount: number
    }
    lessons: TeacherDashboardResourceStats
    assignments: TeacherDashboardResourceStats
    tests: TeacherDashboardResourceStats
    pendingReviews: number
  }
  pendingReviews: TeacherDashboardReview[]
  recent: {
    lessons: TeacherDashboardRecentLesson[]
    assignments: TeacherDashboardRecentAssignment[]
    tests: TeacherDashboardRecentTest[]
  }
}

export interface TeacherDashboardReview {
  attemptId: string
  lessonId: string
  lessonTitle: string
  testTitle: string
  studentId: string
  studentName: string
  classId: string
  className: string
  pendingReviewCount: number
  submittedAt: string | null
}

export interface TeacherDashboardRecentLesson {
  id: string
  title: string
  status: LessonStatus
  classCount: number
  updatedAt: string
}

export interface TeacherDashboardRecentAssignment {
  id: string
  title: string
  type: AssignmentType
  status: AssignmentStatus
  updatedAt: string
}

export interface TeacherDashboardRecentTest {
  id: string
  title: string
  status: TestStatus
  itemCount: number
  updatedAt: string
}
