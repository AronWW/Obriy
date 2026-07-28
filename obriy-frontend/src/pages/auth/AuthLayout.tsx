import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'
import { ObriyBackground } from '../../shared/backgrounds/ObriyBackground'
import { BrandLogo } from '../../shared/brand/BrandLogo'
import styles from './AuthLayout.module.css'

export function AuthLayout() {
  const { t } = useTranslation()

  return (
    <div className={styles.page}>
      <ObriyBackground />

      <Link className={styles.brandLink} to="/" aria-label={t('home.openHome')}>
        <BrandLogo large />
      </Link>

      <main className={styles.content}>
        <section className={styles.panel} aria-label={t('auth.layout.formRegion')}>
          <Outlet />
        </section>
      </main>
    </div>
  )
}
