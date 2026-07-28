import { useTranslation } from 'react-i18next'
import { ObriyBackground } from '../../../shared/backgrounds/ObriyBackground'
import styles from './RouteStatus.module.css'

export function RouteStatus() {
  const { t } = useTranslation()

  return (
    <div className={styles.page} role="status">
      <ObriyBackground />
      <div className={styles.status}>
        <span className={styles.spinner} aria-hidden="true" />
        <span>{t('auth.session.checking')}</span>
      </div>
    </div>
  )
}
