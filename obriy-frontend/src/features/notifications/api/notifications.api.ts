import { authorizedRequest } from '../../auth/model/session.service'
import type {
  AppNotification,
  NotificationFilter,
  NotificationPage,
  NotificationUnreadCount,
} from '../model/notification.types'

export function getNotifications(
  filter: NotificationFilter,
  cursor?: string,
): Promise<NotificationPage> {
  const params = new URLSearchParams({
    limit: '20',
    unreadOnly: String(filter === 'UNREAD'),
  })
  if (cursor) params.set('cursor', cursor)
  return authorizedRequest<NotificationPage>(`/notifications?${params}`)
}

export function getNotificationUnreadCount(): Promise<NotificationUnreadCount> {
  return authorizedRequest<NotificationUnreadCount>(
    '/notifications/unread-count',
  )
}

export function markNotificationRead(id: string): Promise<AppNotification> {
  return authorizedRequest<AppNotification>(`/notifications/${id}/read`, {
    method: 'PATCH',
  })
}

export function markAllNotificationsRead(): Promise<void> {
  return authorizedRequest<void>('/notifications/read-all', {
    method: 'POST',
  })
}

