import type { LinkedChild } from '../model/parent.types'
import { UserAvatarImage } from '../../../shared/ui/UserAvatarImage'
import styles from './ParentHub.module.css'

export function ChildAvatar({
  child,
  size = 'regular',
}: {
  child: LinkedChild
  size?: 'small' | 'regular' | 'large'
}) {
  return (
    <span
      className={`${styles.avatar} ${size === 'small' ? styles.avatarSmall : size === 'large' ? styles.avatarLarge : ''}`}
    >
      <UserAvatarImage avatarUrl={child.avatarUrl} displayName={child.displayName} />
    </span>
  )
}
