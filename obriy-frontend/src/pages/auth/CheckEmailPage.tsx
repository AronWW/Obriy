import { useMutation } from '@tanstack/react-query'
import { Check, LogIn, MailCheck, RefreshCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router-dom'
import { authApi } from '../../features/auth/api/auth.api'
import { AuthAlert } from '../../features/auth/components/AuthFormControls'
import { useCountdown } from '../../features/auth/hooks/useCountdown'
import {
  clearVerificationSession,
  getVerificationSession,
  rememberVerification,
  type VerificationSession,
} from '../../features/auth/model/verification-session'
import { ApiError } from '../../shared/api/api-client'
import styles from './AuthFlowPage.module.css'

export function CheckEmailPage() {
  const { t } = useTranslation()
  const [verification, setVerification] = useState<VerificationSession | null>(
    getVerificationSession,
  )
  const [isAlreadyVerified, setIsAlreadyVerified] = useState(false)
  const remainingSeconds = useCountdown(verification?.nextSendAt ?? 0)

  const resendMutation = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: (message) => {
      if (message.code === 'EMAIL_ALREADY_VERIFIED') {
        clearVerificationSession()
        setIsAlreadyVerified(true)
        return
      }

      if (verification) {
        setVerification(
          rememberVerification(
            message.email || verification.email,
            message.retryAfterSeconds ?? 60,
          ),
        )
      }
    },
    onError: (error) => {
      if (
        verification &&
        error instanceof ApiError &&
        error.code === 'EMAIL_VERIFICATION_COOLDOWN'
      ) {
        setVerification(
          rememberVerification(
            error.email || verification.email,
            error.retryAfterSeconds ?? 60,
          ),
        )
      }
    },
  })

  if (!verification) {
    return <Navigate to="/auth/register" replace />
  }

  if (isAlreadyVerified) {
    return (
      <StatusView
        icon={<Check size={28} />}
        title={t('auth.checkEmail.alreadyVerifiedTitle')}
        description={t('auth.checkEmail.alreadyVerifiedDescription')}
      >
        <Link className={styles.primaryButton} to="/auth/login">
          {t('auth.checkEmail.goToLogin')}
          <LogIn size={17} />
        </Link>
      </StatusView>
    )
  }

  const resendLabel =
    remainingSeconds > 0
      ? t('auth.checkEmail.resendIn', { time: formatCountdown(remainingSeconds) })
      : t('auth.checkEmail.resend')

  return (
    <StatusView
      icon={<MailCheck size={29} />}
      title={t('auth.checkEmail.title')}
      description={
        <>
          {t('auth.checkEmail.description')}{' '}
          <span className={styles.email}>{verification.email}</span>
        </>
      }
    >
      {resendMutation.isSuccess && (
        <AuthAlert tone="success">{t('auth.checkEmail.sentAgain')}</AuthAlert>
      )}

      {resendMutation.isError && (
        <AuthAlert
          tone={
            resendMutation.error instanceof ApiError &&
            resendMutation.error.code === 'EMAIL_VERIFICATION_COOLDOWN'
              ? 'info'
              : 'error'
          }
        >
          {getResendErrorMessage(resendMutation.error, t)}
        </AuthAlert>
      )}

      <button
        className={styles.secondaryButton}
        type="button"
        disabled={remainingSeconds > 0 || resendMutation.isPending}
        onClick={() => resendMutation.mutate({ email: verification.email })}
      >
        <RefreshCw size={16} />
        <span>{resendMutation.isPending ? t('auth.checkEmail.sending') : resendLabel}</span>
      </button>

      <Link className={styles.textLink} to="/auth/login">
        {t('auth.checkEmail.backToLogin')}
      </Link>
    </StatusView>
  )
}

function StatusView({
  children,
  description,
  icon,
  title,
}: {
  children: ReactNode
  description: ReactNode
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

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = String(seconds % 60).padStart(2, '0')
  return `${minutes}:${remainder}`
}

function getResendErrorMessage(error: Error, t: (key: string) => string): string {
  const code = error instanceof ApiError ? error.code : 'UNEXPECTED_API_ERROR'
  const supportedCodes = new Set(['EMAIL_VERIFICATION_COOLDOWN', 'NETWORK_ERROR'])
  return t(`auth.errors.${supportedCodes.has(code) ? code : 'RESEND_FAILED'}`)
}
