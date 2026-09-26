import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { authApi } from '../../features/auth/api/auth.api'
import { AuthAlert, AuthSubmitButton } from '../../features/auth/components/AuthFormControls'
import styles from './SuspendedAccountPage.module.css'

interface SuspendedLocationState {
  suspensionAccessToken?: string
}

export function SuspendedAccountPage() {
  const { i18n } = useTranslation()
  const copy = i18n.resolvedLanguage === 'en' ? en : uk
  const location = useLocation()
  const queryClient = useQueryClient()
  const token = (location.state as SuspendedLocationState | null)?.suspensionAccessToken ?? ''
  const [message, setMessage] = useState('')
  const context = useQuery({
    queryKey: ['auth', 'suspension-context', token],
    queryFn: () => authApi.suspensionContext(token),
    enabled: Boolean(token),
    retry: false,
  })
  const appeal = useMutation({
    mutationFn: () => authApi.submitSuspensionAppeal(token, message.trim()),
    onSuccess: (value) => {
      queryClient.setQueryData(['auth', 'suspension-context', token], value)
      setMessage('')
    },
  })
  const value = context.data
  const locale = i18n.resolvedLanguage === 'en' ? 'en-GB' : 'uk-UA'
  const formatDate = (date: string) => new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))

  if (!token) {
    return <AuthAlert>{copy.expired}</AuthAlert>
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <span className={styles.icon}><ShieldAlert size={25} /></span>
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
      </header>

      {context.isLoading && <p className={styles.state}>{copy.loading}</p>}
      {context.isError && <AuthAlert>{copy.expired}</AuthAlert>}

      {value && (
        <>
          <dl className={styles.context}>
            <div><dt>{copy.reason}</dt><dd>{value.reason}</dd></div>
            <div><dt>{copy.date}</dt><dd>{formatDate(value.suspendedAt)}</dd></div>
          </dl>

          {value.appeal && (
            <div className={styles.appealState} data-status={value.appeal.status}>
              <strong>{copy.status[value.appeal.status]}</strong>
              {value.appeal.resolutionNote && <p>{value.appeal.resolutionNote}</p>}
              {value.appeal.reviewedAt && <small>{formatDate(value.appeal.reviewedAt)}</small>}
            </div>
          )}

          {value.canAppeal ? (
            <form className={styles.form} onSubmit={(event) => {
              event.preventDefault()
              if (message.trim().length >= 20) appeal.mutate()
            }}>
              <label htmlFor="suspension-appeal">{copy.appeal}</label>
              <textarea
                id="suspension-appeal"
                maxLength={2000}
                minLength={20}
                rows={6}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={copy.placeholder}
              />
              <span className={styles.counter}>{message.trim().length}/2000</span>
              {appeal.isError && <AuthAlert>{copy.submitError}</AuthAlert>}
              <AuthSubmitButton
                disabled={message.trim().length < 20}
                pending={appeal.isPending}
                pendingLabel={copy.submitting}
              >
                {copy.submit}
              </AuthSubmitButton>
            </form>
          ) : value.nextAppealAt && value.appeal?.status === 'REJECTED' ? (
            <p className={styles.state}>{copy.retryAt} {formatDate(value.nextAppealAt)}</p>
          ) : null}
        </>
      )}

      <Link className={styles.back} to="/auth/login">{copy.back}</Link>
    </section>
  )
}

const uk = {
  title: 'Акаунт заблоковано',
  description: 'Нижче вказано причину блокування. Якщо рішення помилкове, ви можете надіслати апеляцію.',
  loading: 'Завантажуємо деталі…', expired: 'Посилання втратило чинність. Увійдіть ще раз, щоб переглянути деталі блокування.',
  reason: 'Причина', date: 'Дата блокування', appeal: 'Текст апеляції',
  placeholder: 'Поясніть, чому рішення варто переглянути…', submit: 'Надіслати апеляцію', submitting: 'Надсилаємо…',
  submitError: 'Не вдалося надіслати апеляцію. Перевірте текст і спробуйте ще раз.',
  retryAt: 'Повторну апеляцію можна подати після', back: 'Повернутися до входу',
  status: { PENDING: 'Апеляція очікує розгляду', APPROVED: 'Апеляцію схвалено', REJECTED: 'Апеляцію відхилено' },
} as const

const en = {
  title: 'Account suspended',
  description: 'The suspension reason is shown below. If the decision is incorrect, you can submit an appeal.',
  loading: 'Loading details…', expired: 'This link has expired. Sign in again to view the suspension details.',
  reason: 'Reason', date: 'Suspended on', appeal: 'Appeal',
  placeholder: 'Explain why this decision should be reviewed…', submit: 'Submit appeal', submitting: 'Submitting…',
  submitError: 'Could not submit the appeal. Check the text and try again.',
  retryAt: 'You may submit another appeal after', back: 'Back to sign in',
  status: { PENDING: 'Appeal pending review', APPROVED: 'Appeal approved', REJECTED: 'Appeal rejected' },
} as const
