import {
  ArrowRight,
  GraduationCap,
  HeartHandshake,
  LoaderCircle,
  Presentation,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { RegistrableRole } from '../model/auth.types'
import styles from './RolePicker.module.css'

interface RoleOption {
  icon: LucideIcon
  path: string
  role: RegistrableRole
}

const roles: RoleOption[] = [
  { icon: GraduationCap, path: 'student', role: 'STUDENT' },
  { icon: Presentation, path: 'teacher', role: 'TEACHER' },
  { icon: HeartHandshake, path: 'parent', role: 'PARENT' },
]

interface RolePickerProps {
  getHref?: (path: string) => string
  onSelect?: (role: RegistrableRole) => void
  pendingRole?: RegistrableRole | null
}

export function RolePicker({
  getHref,
  onSelect,
  pendingRole = null,
}: RolePickerProps) {
  const { t } = useTranslation()

  return (
    <ul className={styles.list}>
      {roles.map(({ icon: Icon, path, role }) => {
        const content = (
          <>
            <span className={styles.icon} aria-hidden="true">
              <Icon size={21} />
            </span>
            <span className={styles.copy}>
              <strong>{t(`auth.roles.${role}.name`)}</strong>
              <small>{t(`auth.roles.${role}.description`)}</small>
            </span>
            {pendingRole === role ? (
              <LoaderCircle className={styles.spinner} size={17} aria-hidden="true" />
            ) : (
              <ArrowRight size={17} aria-hidden="true" />
            )}
          </>
        )

        return (
          <li key={role}>
            {getHref ? (
              <Link className={styles.option} to={getHref(path)}>
                {content}
              </Link>
            ) : (
              <button
                className={styles.option}
                type="button"
                disabled={pendingRole !== null}
                onClick={() => onSelect?.(role)}
              >
                {content}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
