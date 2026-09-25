import type { ChatPerson } from '../model/chat.types'
import { UserAvatarImage } from '../../../shared/ui/UserAvatarImage'
import styles from './ChatWorkspace.module.css'

export function ChatAvatar({ person }: { person: ChatPerson }) {
  return (
    <UserAvatarImage
      avatarUrl={person.avatarUrl}
      className={styles.avatar}
      displayName={person.displayName}
    />
  )
}
