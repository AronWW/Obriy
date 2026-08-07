import { Check, Clipboard, KeyRound, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ClassInvite } from '../model/class.types'
import styles from '../ClassesPage.module.css'

export function InvitePanel({
  invite,
  isError = false,
  isLoading = false,
  onRetry,
}: {
  invite: ClassInvite | null
  isError?: boolean
  isLoading?: boolean
  onRetry?: () => void
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    if (!invite) {
      return
    }

    try {
      await navigator.clipboard.writeText(invite.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className={styles.invitePanel}>
      <div className={styles.sectionHeading}>
        <KeyRound size={19} aria-hidden="true" />
        <div>
          <h2>{t('classes.teacher.invite.title')}</h2>
          <p>{t('classes.teacher.invite.description')}</p>
        </div>
      </div>

      {isLoading ? (
        <p className={styles.quietCopy}>
          {t('classes.teacher.invite.loading')}
        </p>
      ) : isError ? (
        <div className={styles.inviteStatus}>
          <p className={styles.errorStatus} role="alert">
            {t('classes.teacher.invite.error')}
          </p>
          {onRetry && (
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={onRetry}
            >
              <RotateCcw size={16} aria-hidden="true" />
              {t('classes.common.retry')}
            </button>
          )}
        </div>
      ) : invite ? (
        <>
          <div className={styles.inviteCodeRow}>
            <code>{invite.code}</code>
            <button type="button" onClick={() => void copyCode()}>
              {copied ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Clipboard size={16} aria-hidden="true" />
              )}
              {copied
                ? t('classes.teacher.invite.copied')
                : t('classes.teacher.invite.copy')}
            </button>
          </div>
        </>
      ) : (
        <p className={styles.quietCopy}>
          {t('classes.teacher.invite.error')}
        </p>
      )}
    </section>
  )
}
