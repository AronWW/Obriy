import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../auth/api/auth.api'
import { useSessionStore } from '../../auth/model/session.store'
import { profileApi } from '../api/profile.api'
import { ApiError } from '../../../shared/api/api-client'
import styles from './ProfileControls.module.css'

export function SecuritySection() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useSessionStore((state) => state.user)
  const clearSession = useSessionStore((state) => state.clearSession)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const change = useMutation({
    mutationFn: profileApi.changePassword,
    onSuccess: () => {
      queryClient.clear()
      clearSession()
      navigate('/auth/login', {
        replace: true,
        state: { passwordChanged: true },
      })
    },
  })
  const resetEmail = useMutation({
    mutationFn: () => authApi.forgotPassword({ email: user?.email ?? '' }),
  })

  if (!user) return null

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidationError(null)
    if (newPassword !== confirmation) {
      setValidationError(t('profileSettings.security.passwordMismatch'))
      return
    }
    change.mutate({ currentPassword, newPassword })
  }

  return (
    <section className={styles.security} aria-labelledby="profile-security-title">
      <h2 id="profile-security-title">{t('profileSettings.security.title')}</h2>
      <p>{t('profileSettings.security.description')}</p>

      {user.hasPassword ? (
        <form className={styles.securityForm} onSubmit={submit}>
          <label className={styles.field}>
            <span>{t('profileSettings.security.currentPassword')}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              required
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>{t('profileSettings.security.newPassword')}</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={72}
              value={newPassword}
              required
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>{t('profileSettings.security.confirmPassword')}</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={72}
              value={confirmation}
              required
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          <button className={styles.primaryButton} type="submit" disabled={change.isPending}>
            <KeyRound size={16} aria-hidden="true" />
            {change.isPending
              ? t('profileSettings.security.changing')
              : t('profileSettings.security.change')}
          </button>
          {(validationError || change.isError) && (
            <p className={styles.error} role="alert">
              {validationError ?? changeError(change.error, t)}
            </p>
          )}
        </form>
      ) : (
        <div>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={resetEmail.isPending || resetEmail.isSuccess}
            onClick={() => resetEmail.mutate()}
          >
            <Mail size={16} aria-hidden="true" />
            {resetEmail.isPending
              ? t('profileSettings.security.sending')
              : t('profileSettings.security.createPassword')}
          </button>
          {resetEmail.isSuccess && (
            <p className={styles.success} role="status">
              {t('profileSettings.security.emailSent')}
            </p>
          )}
          {resetEmail.isError && (
            <p className={styles.error} role="alert">
              {t('profileSettings.security.emailError')}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function changeError(error: Error | null, t: (key: string) => string): string {
  if (error instanceof ApiError && error.code === 'CURRENT_PASSWORD_INVALID') {
    return t('profileSettings.security.currentInvalid')
  }
  if (error instanceof ApiError && error.code === 'PASSWORD_REUSE_FORBIDDEN') {
    return t('profileSettings.security.reuseForbidden')
  }
  return t('profileSettings.security.changeError')
}
