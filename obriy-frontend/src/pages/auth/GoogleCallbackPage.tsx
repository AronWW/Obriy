import { useMutation, useQuery } from '@tanstack/react-query'
import { CircleX, LogIn, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../../features/auth/api/auth.api'
import { AuthAlert } from '../../features/auth/components/AuthFormControls'
import { RolePicker } from '../../features/auth/components/RolePicker'
import { establishSession } from '../../features/auth/model/session.service'
import type { Locale, RegistrableRole } from '../../features/auth/model/auth.types'
import { ApiError } from '../../shared/api/api-client'
import styles from './AuthFlowPage.module.css'

type GoogleCallback =
  | { type: 'EXCHANGE'; code: string }
  | { type: 'REGISTRATION'; code: string }
  | { type: 'ERROR'; code: string }
  | { type: 'INVALID' }

export function GoogleCallbackPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [callback] = useState<GoogleCallback>(() => parseCallback(searchParams))
  const exchangeQuery = useQuery({
    queryKey: [
      'auth',
      'google-exchange',
      callback.type === 'EXCHANGE' ? callback.code : '',
    ],
    queryFn: () =>
      authApi.exchangeGoogleCode({
        code: callback.type === 'EXCHANGE' ? callback.code : '',
      }),
    enabled: callback.type === 'EXCHANGE',
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  })

  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    if (exchangeQuery.data) {
      establishSession(exchangeQuery.data)
      navigate('/app', { replace: true })
    }
  }, [exchangeQuery.data, navigate])

  if (callback.type === 'REGISTRATION') {
    return <GoogleRoleStep code={callback.code} />
  }

  if (callback.type === 'ERROR') {
    return <GoogleErrorView code={callback.code} />
  }

  if (callback.type === 'INVALID') {
    return <GoogleErrorView code="INVALID_OAUTH_EXCHANGE_CODE" />
  }

  if (exchangeQuery.isError) {
    return <GoogleErrorView code={getErrorCode(exchangeQuery.error)} />
  }

  return (
    <div className={styles.statusView} role="status">
      <span className={styles.loadingSpinner} aria-hidden="true" />
      <h2 className={styles.statusTitle}>{t('auth.google.completingTitle')}</h2>
      <p className={styles.statusCopy}>{t('auth.google.completingDescription')}</p>
    </div>
  )
}

function GoogleRoleStep({ code }: { code: string }) {
  const { i18n, t } = useTranslation()
  const navigate = useNavigate()
  const [pendingRole, setPendingRole] = useState<RegistrableRole | null>(null)
  const completeMutation = useMutation({
    mutationFn: authApi.completeGoogleRegistration,
    onMutate: ({ role }) => setPendingRole(role),
    onSuccess: (session) => {
      establishSession(session)
      navigate('/app', { replace: true })
    },
    onSettled: () => setPendingRole(null),
  })

  if (
    completeMutation.error instanceof ApiError &&
    completeMutation.error.code === 'INVALID_OAUTH_REGISTRATION_TICKET'
  ) {
    return <GoogleErrorView code={completeMutation.error.code} />
  }

  const selectRole = (role: RegistrableRole) => {
    completeMutation.mutate({
      code,
      preferredLocale: (i18n.resolvedLanguage === 'en' ? 'EN' : 'UK') as Locale,
      role,
    })
  }

  return (
    <div>
      <header className={styles.header}>
        <p className={styles.eyebrow}>
          <ShieldCheck size={14} />
          {t('auth.google.verifiedEyebrow')}
        </p>
        <h2 className={styles.title}>{t('auth.google.chooseRoleTitle')}</h2>
        <p className={styles.subtitle}>{t('auth.google.chooseRoleDescription')}</p>
      </header>

      {completeMutation.isError && (
        <div className={styles.inlineAlert}>
          <AuthAlert>{getGoogleErrorMessage(getErrorCode(completeMutation.error), t)}</AuthAlert>
        </div>
      )}

      <RolePicker
        onSelect={selectRole}
        pendingRole={completeMutation.isPending ? pendingRole : null}
      />
    </div>
  )
}

function GoogleErrorView({ code }: { code: string }) {
  const { t } = useTranslation()
  const isCancelled = code === 'GOOGLE_OAUTH_CANCELLED'

  return (
    <div className={styles.statusView}>
      <span className={styles.statusIcon} aria-hidden="true">
        <CircleX size={29} />
      </span>
      <h2 className={styles.statusTitle}>
        {t(isCancelled ? 'auth.google.cancelledTitle' : 'auth.google.errorTitle')}
      </h2>
      <p className={styles.statusCopy}>{getGoogleErrorMessage(code, t)}</p>
      <div className={styles.statusActions}>
        <Link className={styles.primaryButton} to="/auth/login">
          {t('auth.google.tryAgain')}
          <LogIn size={17} />
        </Link>
        <Link className={styles.textLink} to="/auth/register">
          {t('auth.google.chooseRegistration')}
        </Link>
      </div>
    </div>
  )
}

function parseCallback(searchParams: URLSearchParams): GoogleCallback {
  const error = searchParams.get('error')?.trim()
  if (error) {
    return { type: 'ERROR', code: error }
  }

  const registrationCode = searchParams.get('registration')?.trim()
  if (registrationCode) {
    return { type: 'REGISTRATION', code: registrationCode }
  }

  const exchangeCode = searchParams.get('code')?.trim()
  return exchangeCode
    ? { type: 'EXCHANGE', code: exchangeCode }
    : { type: 'INVALID' }
}

function getErrorCode(error: Error): string {
  return error instanceof ApiError ? error.code : 'GOOGLE_OAUTH_FAILED'
}

function getGoogleErrorMessage(
  code: string,
  t: (key: string) => string,
): string {
  const supportedCodes = new Set([
    'GOOGLE_OAUTH_CANCELLED',
    'GOOGLE_EMAIL_NOT_VERIFIED',
    'GOOGLE_ACCOUNT_CONFLICT',
    'INVALID_OAUTH_STATE',
    'INVALID_OAUTH_EXCHANGE_CODE',
    'INVALID_OAUTH_REGISTRATION_TICKET',
    'GOOGLE_OAUTH_NOT_CONFIGURED',
    'USER_SUSPENDED',
    'NETWORK_ERROR',
  ])

  return t(`auth.errors.${supportedCodes.has(code) ? code : 'GOOGLE_OAUTH_FAILED'}`)
}
