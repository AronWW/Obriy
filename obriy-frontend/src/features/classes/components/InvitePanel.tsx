import { Check, Clipboard, KeyRound, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ClassInvite } from '../model/class.types'
import styles from '../ClassesPage.module.css'

export function InvitePanel({
  invite,
  isRefreshing,
  onRefresh,
}: {
  invite: ClassInvite | null
  isRefreshing: boolean
  onRefresh?: () => void
}) {
  const { t, i18n } = useTranslation()
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

      {invite ? (
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
          <p className={styles.inviteExpiry}>
            {t('classes.teacher.invite.expires', {
              date: new Intl.DateTimeFormat(i18n.language, {
                day: 'numeric',
                month: 'long',
              }).format(new Date(invite.expiresAt)),
            })}
          </p>
        </>
      ) : (
        <p className={styles.quietCopy}>
          {t('classes.teacher.invite.hidden')}
        </p>
      )}

      {onRefresh && (
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={isRefreshing}
          onClick={onRefresh}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {isRefreshing
            ? t('classes.teacher.invite.refreshing')
            : t('classes.teacher.invite.refresh')}
        </button>
      )}
    </section>
  )
}
