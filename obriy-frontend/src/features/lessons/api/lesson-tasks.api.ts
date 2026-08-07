import { authorizedRequest } from '../../auth/model/session.service'
import type {
  LessonTask,
  LessonTaskInput,
  LessonTaskReviewInput,
  StudentTaskSubmission,
  TeacherTaskSubmission,
} from '../model/lesson-task.types'

export function listLessonTasks(lessonId: string): Promise<LessonTask[]> {
  return authorizedRequest<LessonTask[]>(`/lessons/${lessonId}/tasks`)
}

export function createLessonTask(
  lessonId: string,
  input: LessonTaskInput,
): Promise<LessonTask> {
  return authorizedRequest<LessonTask>(`/lessons/${lessonId}/tasks`, {
    method: 'POST',
    body: input,
  })
}

export function updateLessonTask(
  lessonId: string,
  taskId: string,
  input: LessonTaskInput,
): Promise<LessonTask> {
  return authorizedRequest<LessonTask>(
    `/lessons/${lessonId}/tasks/${taskId}`,
    { method: 'PATCH', body: input },
  )
}

export function deleteLessonTask(
  lessonId: string,
  taskId: string,
): Promise<void> {
  return authorizedRequest<void>(`/lessons/${lessonId}/tasks/${taskId}`, {
    method: 'DELETE',
  })
}

export function listLessonTaskSubmissions(
  lessonId: string,
): Promise<TeacherTaskSubmission[]> {
  return authorizedRequest<TeacherTaskSubmission[]>(
    `/lessons/${lessonId}/task-submissions`,
  )
}

export function reviewLessonTaskSubmission(
  lessonId: string,
  taskId: string,
  submissionId: string,
  input: LessonTaskReviewInput,
): Promise<TeacherTaskSubmission> {
  return authorizedRequest<TeacherTaskSubmission>(
    `/lessons/${lessonId}/tasks/${taskId}/submissions/${submissionId}`,
    { method: 'PATCH', body: input },
  )
}

export function submitStudentLessonTask(
  lessonId: string,
  taskId: string,
  answerText: string,
): Promise<StudentTaskSubmission> {
  return authorizedRequest<StudentTaskSubmission>(
    `/classes/me/lessons/${lessonId}/tasks/${taskId}/submission`,
    { method: 'PUT', body: { answerText } },
  )
}
