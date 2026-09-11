import type { NotificationFilter } from './notification.types'

export const notificationQueryKeys = {
  root: ['notifications'] as const,
  list: (filter: NotificationFilter) =>
    [...notificationQueryKeys.root, 'list', filter] as const,
  unreadCount: () => [...notificationQueryKeys.root, 'unread-count'] as const,
}

