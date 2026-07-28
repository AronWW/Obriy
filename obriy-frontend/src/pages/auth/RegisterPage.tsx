import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, UserPlus } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
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
import type { Locale, RegistrableRole } from '../../features/auth/model/auth.types'
import { rememberVerification } from '../../features/auth/model/verification-session'
import { ApiError } from '../../shared/api/api-client'
import styles from './AuthFlowPage.module.css'

const roleByPath: Record<string, RegistrableRole> = {
  student: 'STUDENT',
  teacher: 'TEACHER',
  parent: 'PARENT',
}

const PASSWORD_PATTERN = /^(?=.*\p{L})(?=.*\p{N})[\s\S]+$/u

export function RegisterPage() {
  const { role: rolePath = '' } = useParams()
  const role = roleByPath[rolePath]

  return role ? <RegistrationForm role={role} /> : <Navigate to="/auth/register" replace />
}

function RegistrationForm({ role }: { role: RegistrableRole }) {
  const { i18n, t } = useTranslation()
  const navigate = useNavigate()
  const schema = useMemo(
    () =>
      z
        .object({
          displayName: z
            .string()
            .trim()
            .min(2, t('auth.validation.displayNameMin'))
            .max(80, t('auth.validation.displayNameMax')),
          email: z
            .string()
            .trim()
            .min(1, t('auth.validation.emailRequired'))
            .email(t('auth.validation.emailInvalid')),
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
  type RegistrationValues = z.infer<typeof schema>

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<RegistrationValues>({
    defaultValues: {
      confirmPassword: '',
      displayName: '',
      email: '',
      password: '',
    },
    resolver: zodResolver(schema),
  })

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (message, variables) => {
      const verification = rememberVerification(
        message.email || variables.email,
        message.retryAfterSeconds ?? 60,
      )
      navigate('/auth/check-email', { replace: true, state: verification })
    },
  })

  const onSubmit = handleSubmit((values) => {
    registerMutation.mutate({
      displayName: values.displayName,
      email: values.email,
      password: values.password,
      preferredLocale: (i18n.resolvedLanguage === 'en' ? 'EN' : 'UK') as Locale,
      role,
    })
  })

  return (
    <div>
      <Link className={styles.backLink} to="/auth/register">
        <ArrowLeft size={15} />
        {t('auth.register.changeRole')}
      </Link>

      <header className={styles.header}>
        <p className={styles.eyebrow}>
          <UserPlus size={14} />
          {t(`auth.roles.${role}.name`)}
        </p>
        <h2 className={styles.title}>{t('auth.register.title')}</h2>
        <p className={styles.subtitle}>{t('auth.register.subtitle')}</p>
      </header>

      <GoogleAuthButton intent="REGISTER" role={role} />
      <AuthMethodDivider />

      <form className={styles.form} noValidate onSubmit={(event) => void onSubmit(event)}>
        <AuthField
          {...register('displayName')}
          id="register-display-name"
          autoComplete="name"
          maxLength={80}
          label={t('auth.register.displayName')}
          error={errors.displayName?.message}
        />

        <AuthField
          {...register('email')}
          id="register-email"
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
          id="register-password"
          autoComplete="new-password"
          maxLength={72}
          label={t('auth.login.password')}
          hint={t('auth.register.passwordHint')}
          showPasswordLabel={t('auth.login.showPassword')}
          hidePasswordLabel={t('auth.login.hidePassword')}
          error={errors.password?.message}
        />

        <AuthPasswordField
          {...register('confirmPassword')}
          id="register-confirm-password"
          autoComplete="new-password"
          maxLength={72}
          label={t('auth.register.confirmPassword')}
          showPasswordLabel={t('auth.login.showPassword')}
          hidePasswordLabel={t('auth.login.hidePassword')}
          error={errors.confirmPassword?.message}
        />

        {registerMutation.isError && (
          <AuthAlert>{getRegisterErrorMessage(registerMutation.error, t)}</AuthAlert>
        )}

        <AuthSubmitButton
          pending={registerMutation.isPending}
          pendingLabel={t('auth.register.submitting')}
        >
          {t('auth.register.submit')}
        </AuthSubmitButton>
      </form>
    </div>
  )
}

function getRegisterErrorMessage(error: Error, t: (key: string) => string): string {
  const code = error instanceof ApiError ? error.code : 'UNEXPECTED_API_ERROR'
  const supportedCodes = new Set(['EMAIL_ALREADY_REGISTERED', 'NETWORK_ERROR'])
  return t(`auth.errors.${supportedCodes.has(code) ? code : 'REGISTRATION_FAILED'}`)
}
