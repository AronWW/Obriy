import type { ChatPerson } from '../model/chat.types'
import styles from './ChatWorkspace.module.css'

export function ChatAvatar({ person }: { person: ChatPerson }) {
  const initials = person.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  return person.avatarUrl ? (
    <img className={styles.avatar} src={person.avatarUrl} alt="" />
  ) : (
    <span className={styles.avatar} aria-hidden="true">{initials}</span>
  )
}

