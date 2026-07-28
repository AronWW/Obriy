import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Check, KeyRound, Link2Off, LogIn } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '../../features/auth/api/auth.api'
import {
  AuthAlert,
  AuthPasswordField,
  AuthSubmitButton,
} from '../../features/auth/components/AuthFormControls'
import { ApiError } from '../../shared/api/api-client'
import styles from './AuthFlowPage.module.css'

const PASSWORD_PATTERN = /^(?=.*\p{L})(?=.*\p{N})[\s\S]+$/u

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() || ''
  const schema = useMemo(
    () =>
      z
        .object({
          password: z
            .string()
            .min(10, t('auth.validation.passwordMin'))
            .max(72, t('auth.validation.passwordMax'))
            .regex(PASSWORD_PATTERN, t('auth.validation.passwordPattern')),
          confirmPassword: z.string().min(1, t('auth.validation.confirmPasswordRequired')),
        })
        .refine((values) => values.password === values.confirmPassword, {
          message: t('auth.validation.passwordsMismatch'),
          path: ['confirmPassword'],
        }),
    [t],
  )
  type ResetPasswordValues = z.infer<typeof schema>
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<ResetPasswordValues>({
    defaultValues: { confirmPassword: '', password: '' },
    resolver: zodResolver(schema),
  })
  const resetMutation = useMutation({ mutationFn: authApi.resetPassword })
  const onSubmit = handleSubmit(({ password }) => {
    resetMutation.mutate({ password, token })
  })

  if (
    !token ||
    (resetMutation.error instanceof ApiError &&
      resetMutation.error.code === 'INVALID_PASSWORD_RESET_TOKEN')
  ) {
    return (
      <ResetStatus
        icon={<Link2Off size={29} />}
        title={t('auth.reset.invalidTitle')}
        description={t('auth.reset.invalidDescription')}
      >
        <Link className={styles.primaryButton} to="/auth/forgot-password">
          {t('auth.reset.requestAgain')}
          <KeyRound size={17} />
        </Link>
      </ResetStatus>
    )
  }

  if (resetMutation.isSuccess) {
    return (
      <ResetStatus
        icon={<Check size={29} />}
        title={t('auth.reset.successTitle')}
        description={t('auth.reset.successDescription')}
      >
        <Link className={styles.primaryButton} to="/auth/login">
          {t('auth.reset.signIn')}
          <LogIn size={17} />
        </Link>
      </ResetStatus>
    )
  }

  return (
    <div>
      <header className={styles.header}>
        <p className={styles.eyebrow}>
          <KeyRound size={14} />
          {t('auth.reset.eyebrow')}
        </p>
        <h2 className={styles.title}>{t('auth.reset.title')}</h2>
        <p className={styles.subtitle}>{t('auth.reset.subtitle')}</p>
      </header>

      <form className={styles.form} noValidate onSubmit={(event) => void onSubmit(event)}>
        <AuthPasswordField
          {...register('password')}
          id="reset-password"
          autoComplete="new-password"
          maxLength={72}
          label={t('auth.reset.password')}
          hint={t('auth.register.passwordHint')}
          showPasswordLabel={t('auth.login.showPassword')}
          hidePasswordLabel={t('auth.login.hidePassword')}
          error={errors.password?.message}
        />

        <AuthPasswordField
          {...register('confirmPassword')}
          id="reset-confirm-password"
          autoComplete="new-password"
          maxLength={72}
          label={t('auth.register.confirmPassword')}
          showPasswordLabel={t('auth.login.showPassword')}
          hidePasswordLabel={t('auth.login.hidePassword')}
          error={errors.confirmPassword?.message}
        />

        {resetMutation.isError && (
          <AuthAlert>{t('auth.errors.PASSWORD_RESET_FAILED')}</AuthAlert>
        )}

        <AuthSubmitButton
          pending={resetMutation.isPending}
          pendingLabel={t('auth.reset.submitting')}
        >
          {t('auth.reset.submit')}
        </AuthSubmitButton>
      </form>
    </div>
  )
}

function ResetStatus({
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
