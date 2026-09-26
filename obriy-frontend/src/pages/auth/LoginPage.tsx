import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '../../features/auth/api/auth.api'
import {
  AuthAlert,
  AuthField,
  AuthPasswordField,
  AuthSubmitButton,
} from '../../features/auth/components/AuthFormControls'
import {
  AuthMethodDivider,
  GoogleAuthButton,
} from '../../features/auth/components/GoogleAuthButton'
import { establishSession } from '../../features/auth/model/session.service'
import { rememberVerification } from '../../features/auth/model/verification-session'
import { ApiError } from '../../shared/api/api-client'
import styles from './LoginPage.module.css'

interface LoginLocationState {
  from?: string
  passwordChanged?: boolean
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .trim()
          .min(1, t('auth.validation.emailRequired'))
          .email(t('auth.validation.emailInvalid')),
        password: z.string().min(1, t('auth.validation.passwordRequired')),
      }),
    [t],
  )

  type LoginValues = z.infer<typeof schema>

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<LoginValues>({
    defaultValues: { email: '', password: '' },
    resolver: zodResolver(schema),
  })

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (session) => {
      establishSession(session)
      navigate(getSafeDestination(location.state), { replace: true })
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.code === 'EMAIL_VERIFICATION_REQUIRED' &&
        error.email
      ) {
        const verification = rememberVerification(
          error.email,
          error.retryAfterSeconds ?? 60,
        )
        navigate('/auth/check-email', { replace: true, state: verification })
        return
      }
      if (
        error instanceof ApiError &&
        error.code === 'USER_SUSPENDED' &&
        error.suspensionAccessToken
      ) {
        navigate('/auth/suspended', {
          replace: true,
          state: { suspensionAccessToken: error.suspensionAccessToken },
        })
      }
    },
  })

  const onSubmit = handleSubmit((values) => {
    loginMutation.mutate(values)
  })

  return (
    <div>
      <header className={styles.header}>
        <p className={styles.eyebrow}>
          <KeyRound size={14} />
          {t('auth.login.eyebrow')}
        </p>
        <h2 className={styles.title}>{t('auth.login.title')}</h2>
        <p className={styles.subtitle}>{t('auth.login.subtitle')}</p>
      </header>

      {(location.state as LoginLocationState | null)?.passwordChanged && (
        <AuthAlert tone="success">{t('profileSettings.security.changedSuccess')}</AuthAlert>
      )}

      <GoogleAuthButton intent="LOGIN" />
      <AuthMethodDivider />

      <form className={styles.form} noValidate onSubmit={(event) => void onSubmit(event)}>
        <AuthField
          {...register('email')}
          id="login-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={254}
          label={t('auth.login.email')}
          placeholder={t('auth.login.emailPlaceholder')}
          error={errors.email?.message}
        />

        <AuthPasswordField
          {...register('password')}
          id="login-password"
          autoComplete="current-password"
          maxLength={72}
          label={t('auth.login.password')}
          showPasswordLabel={t('auth.login.showPassword')}
          hidePasswordLabel={t('auth.login.hidePassword')}
          error={errors.password?.message}
        />

        <div className={styles.formOptions}>
          <Link className={styles.textLink} to="/auth/forgot-password">
            {t('auth.login.forgotPassword')}
          </Link>
        </div>

        {loginMutation.isError && (
          <AuthAlert>
            {getLoginErrorMessage(loginMutation.error, t)}
          </AuthAlert>
        )}

        <AuthSubmitButton
          pending={loginMutation.isPending}
          pendingLabel={t('auth.login.submitting')}
        >
          {t('auth.login.submit')}
        </AuthSubmitButton>
      </form>

      <p className={styles.registerPrompt}>
        {t('auth.login.noAccount')}
        <Link className={styles.textLink} to="/auth/register">
          {t('auth.login.createAccount')}
        </Link>
      </p>
    </div>
  )
}

function getSafeDestination(state: unknown): string {
  if (!isLoginLocationState(state) || !state.from?.startsWith('/') || state.from.startsWith('//')) {
    return '/app'
  }

  return state.from
}

function isLoginLocationState(state: unknown): state is LoginLocationState {
  return typeof state === 'object' && state !== null
}

function getLoginErrorMessage(
  error: Error,
  t: (key: string) => string,
): string {
  const code = error instanceof ApiError ? error.code : 'UNEXPECTED_API_ERROR'
  const supportedCodes = new Set([
    'INVALID_CREDENTIALS',
    'USER_SUSPENDED',
    'EMAIL_VERIFICATION_REQUIRED',
    'NETWORK_ERROR',
  ])

  return t(`auth.errors.${supportedCodes.has(code) ? code : 'UNEXPECTED_API_ERROR'}`)
}
