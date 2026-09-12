import { useQuery } from '@tanstack/react-query'
import { chatApi } from '../api/chat.api'
import { chatQueryKeys } from '../model/chat-query-keys'
import styles from './ChatWorkspace.module.css'

export function ChatUnreadBadge() {
  const query = useQuery({
    queryKey: chatQueryKeys.unread(),
    queryFn: chatApi.unread,
    refetchInterval: 30_000,
  })
  const count = query.data?.unreadCount ?? 0
  if (count === 0) return null
  return <span className={styles.navBadge}>{count > 99 ? '99+' : count}</span>
}

