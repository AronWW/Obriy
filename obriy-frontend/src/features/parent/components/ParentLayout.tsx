import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'
import { ObriyBackground } from '../../../shared/backgrounds/ObriyBackground'
import { BrandLogo } from '../../../shared/brand/BrandLogo'
import styles from './ParentHub.module.css'

export function ParentLayout() {
  const { t } = useTranslation()

  return (
    <div className={styles.page}>
      <ObriyBackground compactHorizon />
      <header className={styles.header}>
        <Link
          className={styles.brandLink}
          to="/app/parent"
          aria-label={t('parentHub.homeAriaLabel')}
        >
          <BrandLogo />
        </Link>
        <p className={styles.headerTitle}>{t('parentHub.header.title')}</p>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
