import type { LinkedChild } from '../model/parent.types'
import styles from './ParentHub.module.css'

export function ChildAvatar({
  child,
  size = 'regular',
}: {
  child: LinkedChild
  size?: 'small' | 'regular' | 'large'
}) {
  const initials = child.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <span
      className={`${styles.avatar} ${size === 'small' ? styles.avatarSmall : size === 'large' ? styles.avatarLarge : ''}`}
    >
      {child.avatarUrl ? <img src={child.avatarUrl} alt="" /> : initials}
    </span>
  )
}
