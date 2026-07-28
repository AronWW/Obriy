import { useQuery } from '@tanstack/react-query'
import { Check, Link2Off, LogIn } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../../features/auth/api/auth.api'
import { clearVerificationSession } from '../../features/auth/model/verification-session'
import styles from './AuthFlowPage.module.css'

export function VerifyEmailPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() || ''
  const verificationQuery = useQuery({
    queryKey: ['auth', 'verify-email', token],
    queryFn: () => authApi.verifyEmail({ token }),
    enabled: token.length > 0,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  })

  useEffect(() => {
    if (verificationQuery.isSuccess) {
      clearVerificationSession()
    }
  }, [verificationQuery.isSuccess])

  if (!token || verificationQuery.isError) {
    return (
      <VerificationStatus
        icon={<Link2Off size={29} />}
        title={t('auth.verify.invalidTitle')}
        description={t('auth.verify.invalidDescription')}
      >
        <Link className={styles.primaryButton} to="/auth/login">
          {t('auth.verify.goToLogin')}
          <LogIn size={17} />
        </Link>
      </VerificationStatus>
    )
  }

  if (verificationQuery.isSuccess) {
    return (
      <VerificationStatus
        icon={<Check size={29} />}
        title={t('auth.verify.successTitle')}
        description={t('auth.verify.successDescription')}
      >
        <Link className={styles.primaryButton} to="/auth/login">
          {t('auth.verify.signIn')}
          <LogIn size={17} />
        </Link>
      </VerificationStatus>
    )
  }

  return (
    <div className={styles.statusView} role="status">
      <span className={styles.loadingSpinner} aria-hidden="true" />
      <h2 className={styles.statusTitle}>{t('auth.verify.checkingTitle')}</h2>
      <p className={styles.statusCopy}>{t('auth.verify.checkingDescription')}</p>
    </div>
  )
}

function VerificationStatus({
  children,
  description,
  icon,
  title,
}: {
  children: ReactNode
  description: string
  icon: ReactNode
  title: string
}) {
  return (
    <div className={styles.statusView}>
      <span className={styles.statusIcon} aria-hidden="true">
        {icon}
      </span>
      <h2 className={styles.statusTitle}>{title}</h2>
      <p className={styles.statusCopy}>{description}</p>
      <div className={styles.statusActions}>{children}</div>
    </div>
  )
}
