import styles from '../ClassesPage.module.css'
import { UserAvatarImage } from '../../../shared/ui/UserAvatarImage'

export function MemberAvatar({
  avatarUrl,
  displayName,
  large = false,
}: {
  avatarUrl: string | null
  displayName: string
  large?: boolean
}) {
  return (
    <span
      className={`${styles.avatar} ${large ? styles.avatarLarge : ''}`}
      aria-hidden="true"
    >
      <UserAvatarImage avatarUrl={avatarUrl} displayName={displayName} />
    </span>
  )
}
