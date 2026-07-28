import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Check, KeyRound, LogIn } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '../../features/auth/api/auth.api'
import {
  AuthAlert,
  AuthField,
  AuthSubmitButton,
} from '../../features/auth/components/AuthFormControls'
import { ApiError } from '../../shared/api/api-client'
import styles from './AuthFlowPage.module.css'

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .trim()
          .min(1, t('auth.validation.emailRequired'))
          .email(t('auth.validation.emailInvalid')),
      }),
    [t],
  )
  type ForgotPasswordValues = z.infer<typeof schema>
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<ForgotPasswordValues>({
    defaultValues: { email: '' },
    resolver: zodResolver(schema),
  })
  const forgotMutation = useMutation({ mutationFn: authApi.forgotPassword })
  const onSubmit = handleSubmit((values) => forgotMutation.mutate(values))

  if (forgotMutation.isSuccess) {
    return (
      <div className={styles.statusView}>
        <span className={styles.statusIcon} aria-hidden="true">
          <Check size={29} />
        </span>
        <h2 className={styles.statusTitle}>{t('auth.forgot.sentTitle')}</h2>
        <p className={styles.statusCopy}>{t('auth.forgot.sentDescription')}</p>
        <div className={styles.statusActions}>
          <Link className={styles.primaryButton} to="/auth/login">
            {t('auth.forgot.backToLogin')}
            <LogIn size={17} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Link className={styles.backLink} to="/auth/login">
        <ArrowLeft size={15} />
        {t('auth.forgot.backToLogin')}
      </Link>

      <header className={styles.header}>
        <p className={styles.eyebrow}>
          <KeyRound size={14} />
          {t('auth.forgot.eyebrow')}
        </p>
        <h2 className={styles.title}>{t('auth.forgot.title')}</h2>
        <p className={styles.subtitle}>{t('auth.forgot.subtitle')}</p>
      </header>

      <form className={styles.form} noValidate onSubmit={(event) => void onSubmit(event)}>
        <AuthField
          {...register('email')}
          id="forgot-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={254}
          label={t('auth.login.email')}
          placeholder={t('auth.login.emailPlaceholder')}
          error={errors.email?.message}
        />

        {forgotMutation.isError && (
          <AuthAlert>{getForgotErrorMessage(forgotMutation.error, t)}</AuthAlert>
        )}

        <AuthSubmitButton
          pending={forgotMutation.isPending}
          pendingLabel={t('auth.forgot.submitting')}
        >
          {t('auth.forgot.submit')}
        </AuthSubmitButton>
      </form>
    </div>
  )
}

function getForgotErrorMessage(error: Error, t: (key: string) => string): string {
  const code = error instanceof ApiError ? error.code : 'UNEXPECTED_API_ERROR'
  return t(`auth.errors.${code === 'NETWORK_ERROR' ? code : 'PASSWORD_RESET_REQUEST_FAILED'}`)
}
