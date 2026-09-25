import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Clipboard,
  Link2,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
  UsersRound,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserAvatarImage } from '../../../shared/ui/UserAvatarImage'
import { ApiError } from '../../../shared/api/api-client'
import { parentLinksApi } from '../api/parent-links.api'
import type { ParentInvitation } from '../model/parent-link.types'
import styles from './StudentGuardiansSection.module.css'

const MAX_GUARDIANS = 4

export function StudentGuardiansSection() {
  const { i18n, t } = useTranslation()
  const queryClient = useQueryClient()
  const [revealedInvitation, setRevealedInvitation] =
    useState<ParentInvitation | null>(null)
  const [copied, setCopied] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null)
  const guardiansQuery = useQuery({
    queryKey: ['parent-links', 'guardians'],
    queryFn: parentLinksApi.listGuardians,
  })
  const invitationQuery = useQuery({
    queryKey: ['parent-links', 'invitation'],
    queryFn: parentLinksApi.getActiveInvitation,
  })
  const createMutation = useMutation({
    mutationFn: parentLinksApi.createInvitation,
    onSuccess: (invitation) => {
      setRevealedInvitation(invitation)
      setCopied(false)
      queryClient.setQueryData(
        ['parent-links', 'invitation'],
        { expiresAt: invitation.expiresAt },
      )
    },
  })
  const revokeMutation = useMutation({
    mutationFn: parentLinksApi.revokeInvitation,
    onSuccess: () => {
      setRevealedInvitation(null)
      queryClient.setQueryData(['parent-links', 'invitation'], null)
    },
  })
  const unlinkMutation = useMutation({
    mutationFn: parentLinksApi.unlinkGuardian,
    onSuccess: () => {
      setPendingRemoval(null)
      void queryClient.invalidateQueries({
        queryKey: ['parent-links', 'guardians'],
      })
    },
  })

  const invitationUrl = revealedInvitation
    ? `${window.location.origin}/parent-invite?token=${encodeURIComponent(revealedInvitation.token)}`
    : null
  const guardianCount = guardiansQuery.data?.length ?? 0
  const limitReached = guardianCount >= MAX_GUARDIANS

  const copyInvitation = async () => {
    if (!invitationUrl) return

    try {
      await navigator.clipboard.writeText(invitationUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className={styles.section} aria-labelledby="guardians-title">
      <div className={styles.heading}>
        <span className={styles.headingIcon} aria-hidden="true">
          <UsersRound size={20} />
        </span>
        <div>
          <h2 id="guardians-title">{t('parentLinks.student.title')}</h2>
          <p>{t('parentLinks.student.description')}</p>
        </div>
        <span className={styles.counter}>
          {guardianCount}/{MAX_GUARDIANS}
        </span>
      </div>

      {guardiansQuery.isLoading && (
        <p className={styles.quiet}>{t('parentLinks.student.loading')}</p>
      )}
      {guardiansQuery.isError && (
        <p className={styles.error} role="alert">
          {t('parentLinks.student.loadError')}
        </p>
      )}
      {guardiansQuery.data?.length === 0 && (
        <div className={styles.empty}>
          <ShieldCheck size={25} aria-hidden="true" />
          <p>{t('parentLinks.student.empty')}</p>
        </div>
      )}
      {guardiansQuery.data && guardiansQuery.data.length > 0 && (
        <ul className={styles.guardianList}>
          {guardiansQuery.data.map((guardian) => (
            <li key={guardian.id}>
              <GuardianAvatar
                avatarUrl={guardian.avatarUrl}
                displayName={guardian.displayName}
              />
              <div>
                <strong>{guardian.displayName}</strong>
                <span>
                  {t('parentLinks.student.linkedAt', {
                    date: new Intl.DateTimeFormat(i18n.language, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }).format(new Date(guardian.linkedAt)),
                  })}
                </span>
              </div>
              {pendingRemoval === guardian.id ? (
                <div className={styles.confirmActions}>
                  <button
                    type="button"
                    disabled={unlinkMutation.isPending}
                    onClick={() => unlinkMutation.mutate(guardian.id)}
                  >
                    <Check size={15} />
                    {t('parentLinks.student.confirmRemove')}
                  </button>
                  <button
                    type="button"
                    aria-label={t('parentLinks.student.cancelRemove')}
                    onClick={() => setPendingRemoval(null)}
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <button
                  className={styles.removeButton}
                  type="button"
                  aria-label={t('parentLinks.student.remove', {
                    name: guardian.displayName,
                  })}
                  onClick={() => setPendingRemoval(guardian.id)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className={styles.invitationArea}>
        <div>
          <h3>{t('parentLinks.student.invitationTitle')}</h3>
          <p>{t('parentLinks.student.invitationDescription')}</p>
        </div>

        {revealedInvitation && invitationUrl && (
          <div className={styles.revealBox}>
            <label htmlFor="parent-invitation-link">
              {t('parentLinks.student.linkLabel')}
            </label>
            <div>
              <input
                id="parent-invitation-link"
                readOnly
                value={invitationUrl}
              />
              <button type="button" onClick={() => void copyInvitation()}>
                {copied ? <Check size={16} /> : <Clipboard size={16} />}
                {copied
                  ? t('parentLinks.student.copied')
                  : t('parentLinks.student.copy')}
              </button>
            </div>
            <small>{t('parentLinks.student.revealWarning')}</small>
          </div>
        )}

        {!revealedInvitation && invitationQuery.data && (
          <p className={styles.activeNote}>
            <Link2 size={16} aria-hidden="true" />
            {t('parentLinks.student.activeUntil', {
              date: new Intl.DateTimeFormat(i18n.language, {
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                month: 'long',
              }).format(new Date(invitationQuery.data.expiresAt)),
            })}
          </p>
        )}

        {(createMutation.isError || revokeMutation.isError ||
          unlinkMutation.isError) && (
          <p className={styles.error} role="alert">
            {getMutationError(
              createMutation.error || revokeMutation.error || unlinkMutation.error,
              t,
            )}
          </p>
        )}

        <div className={styles.invitationActions}>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={
              limitReached ||
              createMutation.isPending ||
              invitationQuery.isLoading
            }
            onClick={() => createMutation.mutate()}
          >
            <UserRoundPlus size={16} />
            {invitationQuery.data
              ? t('parentLinks.student.replaceInvitation')
              : t('parentLinks.student.createInvitation')}
          </button>
          {invitationQuery.data && (
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={revokeMutation.isPending}
              onClick={() => revokeMutation.mutate()}
            >
              {t('parentLinks.student.revokeInvitation')}
            </button>
          )}
        </div>
        {limitReached && (
          <p className={styles.limitNote}>
            {t('parentLinks.student.limitReached')}
          </p>
        )}
      </div>
    </section>
  )
}

function GuardianAvatar({
  avatarUrl,
  displayName,
}: {
  avatarUrl: string | null
  displayName: string
}) {
  return (
    <span className={styles.avatar} aria-hidden="true">
      <UserAvatarImage avatarUrl={avatarUrl} displayName={displayName} />
    </span>
  )
}

function getMutationError(
  error: Error | null,
  t: (key: string) => string,
): string {
  if (error instanceof ApiError && error.code === 'PARENT_LIMIT_REACHED') {
    return t('parentLinks.student.limitReached')
  }

  if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
    return t('parentLinks.errors.network')
  }

  return t('parentLinks.errors.unexpected')
}
