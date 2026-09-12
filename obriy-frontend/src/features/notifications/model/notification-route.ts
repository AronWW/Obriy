import type { AppNotification } from './notification.types'

export function notificationRoute(
  notification: AppNotification,
  role?: string,
): string {
  const value = (key: string) =>
    typeof notification.payload[key] === 'string'
      ? (notification.payload[key] as string)
      : null
  if (notification.type === 'CHAT_MESSAGE') {
    const conversationId = value('conversationId')
    if (conversationId && role === 'TEACHER') {
      return `/app/teacher/messages/${conversationId}`
    }
    return conversationId
      ? `/app/student/messages/${conversationId}`
      : '/app/student/messages'
  }
  if (role === 'TEACHER') {
    const lessonId = value('lessonId')
    const attemptId = value('attemptId')
    return lessonId && attemptId
      ? `/app/teacher/lessons/${lessonId}/edit?reviewAttempt=${attemptId}`
      : '/app/teacher'
  }
  if (role === 'PARENT') {
    return notification.subjectStudentId
      ? `/app/parent/child/${notification.subjectStudentId}`
      : '/app/parent'
  }
  if (
    notification.type === 'BADGE_UNLOCKED' ||
    notification.type === 'LEVEL_UP'
  ) {
    return '/app/student/achievements'
  }
  const lessonId = value('lessonId')
  const releaseId = value('releaseId')
  return lessonId && releaseId
    ? `/app/student/lessons/${lessonId}?test=${releaseId}`
    : '/app/student/tasks'
}
