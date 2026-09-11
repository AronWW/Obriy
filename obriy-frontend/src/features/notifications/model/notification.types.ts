export type NotificationType =
  | 'TEST_ASSIGNED'
  | 'TEST_AVAILABLE'
  | 'TEST_DUE_SOON'
  | 'TEST_OVERDUE'
  | 'TEST_REVIEW_REQUIRED'
  | 'TEST_GRADED'
  | 'TEST_NEEDS_REVISION'
  | 'BADGE_UNLOCKED'
  | 'LEVEL_UP'

export interface AppNotification {
  id: string
  type: NotificationType
  subjectStudentId: string | null
  payload: Record<string, unknown>
  isRead: boolean
  readAt: string | null
  createdAt: string
}

export interface NotificationPage {
  items: AppNotification[]
  nextCursor: string | null
  unreadCount: number
}

export interface NotificationUnreadCount {
  unreadCount: number
}

export type NotificationFilter = 'ALL' | 'UNREAD'

