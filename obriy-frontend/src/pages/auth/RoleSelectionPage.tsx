import {
  ArrowLeft,
  UsersRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { RolePicker } from '../../features/auth/components/RolePicker'
import styles from './AuthFlowPage.module.css'

export function RoleSelectionPage() {
  const { t } = useTranslation()

  return (
    <div>
      <Link className={styles.backLink} to="/">
        <ArrowLeft size={15} />
        {t('auth.common.backHome')}
      </Link>

      <header className={styles.header}>
        <p className={styles.eyebrow}>
          <UsersRound size={14} />
          {t('auth.register.eyebrow')}
        </p>
        <h2 className={styles.title}>{t('auth.roles.title')}</h2>
        <p className={styles.subtitle}>{t('auth.roles.subtitle')}</p>
      </header>

      <RolePicker getHref={(path) => `/auth/register/${path}`} />

      <p className={styles.footerPrompt}>
        {t('auth.register.hasAccount')}
        <Link className={styles.textLink} to="/auth/login">
          {t('auth.register.signIn')}
        </Link>
      </p>
    </div>
  )
}
