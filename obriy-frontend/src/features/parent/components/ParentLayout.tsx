import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'
import { ObriyBackground } from '../../../shared/backgrounds/ObriyBackground'
import { BrandLogo } from '../../../shared/brand/BrandLogo'
import { UserAvatarImage } from '../../../shared/ui/UserAvatarImage'
import styles from './ParentHub.module.css'
import { useSessionStore } from '../../auth/model/session.store'

export function ParentLayout() {
  const { t } = useTranslation()
  const user = useSessionStore((state) => state.user)
  return (
    <div className={styles.page}>
      <ObriyBackground compactHorizon />
      <header className={styles.header}>
        <div className={styles.headerIdentity}>
          <Link
            className={styles.brandLink}
            to="/app/parent"
            aria-label={t('parentHub.homeAriaLabel')}
          >
            <BrandLogo />
          </Link>
          <Link className={styles.parentProfileLink} to="/app/parent/profile" aria-label={t('profileSettings.parent.open')}>
            <UserAvatarImage avatarUrl={user?.profile.avatarUrl} displayName={user?.profile.displayName ?? ''} />
          </Link>
        </div>
        <p className={styles.headerTitle}>{t('parentHub.header.title')}</p>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
