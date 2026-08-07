export type TaskSubmissionStatus = 'SUBMITTED' | 'APPROVED' | 'RETURNED'

export interface LessonTask {
  id: string
  lessonId: string
  title: string
  prompt: string
  position: number
  isRequired: boolean
  createdAt: string
  updatedAt: string
}

export interface LessonTaskInput {
  title: string
  prompt: string
  isRequired?: boolean
}

export interface TeacherTaskSubmission {
  id: string
  taskId: string
  taskTitle: string
  taskPosition: number
  taskIsRequired: boolean
  answerText: string
  status: TaskSubmissionStatus
  teacherComment: string | null
  submittedAt: string
  reviewedAt: string | null
  updatedAt: string
  student: {
    id: string
    displayName: string
  }
  class: {
    id: string
    name: string
  }
}

export interface LessonTaskReviewInput {
  status: 'APPROVED' | 'RETURNED'
  teacherComment?: string | null
}

export interface StudentTaskSubmission {
  id: string
  taskId: string
  answerText: string
  status: TaskSubmissionStatus
  teacherComment: string | null
  submittedAt: string
  reviewedAt: string | null
  updatedAt: string
}

export interface StudentLessonTask {
  id: string
  title: string
  prompt: string
  position: number
  isRequired: boolean
  submission: StudentTaskSubmission | null
}

export type StudentLessonProgressStatus =
  | 'NO_TASKS'
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'

export interface StudentLessonProgress {
  status: StudentLessonProgressStatus
  requiredTotal: number
  approved: number
  submitted: number
  returned: number
}
