import styles from '../ClassesPage.module.css'

export function MemberAvatar({
  avatarUrl,
  displayName,
  large = false,
}: {
  avatarUrl: string | null
  displayName: string
  large?: boolean
}) {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <span
      className={`${styles.avatar} ${large ? styles.avatarLarge : ''}`}
      aria-hidden="true"
    >
      {avatarUrl ? <img alt="" src={avatarUrl} /> : initials || 'O'}
    </span>
  )
}
