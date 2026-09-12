import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, CircleAlert, Link as LinkIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../../shared/api/api-client'
import { parentLinksApi } from '../../parent-links/api/parent-links.api'
import {
  clearPendingParentInvitation,
  getPendingParentInvitation,
} from '../../parent-links/model/parent-invitation-session'
import { ChildAvatar } from '../components/ChildAvatar'
import styles from '../components/ParentHub.module.css'
import { linkedChildrenQueryKey } from '../hooks/useLinkedChildren'
import { parentQueryKeys } from '../model/parent-query-keys'

export function ParentConnectPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const token = getPendingParentInvitation()
  const previewQuery = useQuery({
    queryKey: ['parent-links', 'preview', token],
    queryFn: () => parentLinksApi.previewInvitation(token ?? ''),
    enabled: Boolean(token),
    retry: false,
  })
  const acceptMutation = useMutation({
    mutationFn: () => parentLinksApi.acceptInvitation(token ?? ''),
    onSuccess: (child) => {
      clearPendingParentInvitation()
      queryClient.setQueryData(linkedChildrenQueryKey, (current: unknown) =>
        Array.isArray(current) ? [...current, child] : [child],
      )
      void queryClient.invalidateQueries({ queryKey: linkedChildrenQueryKey })
      void queryClient.invalidateQueries({ queryKey: parentQueryKeys.root })
      navigate('/app/parent', { replace: true })
    },
  })

  useEffect(() => {
    if (
      previewQuery.error instanceof ApiError &&
      previewQuery.error.code === 'INVALID_PARENT_INVITATION'
    ) {
      clearPendingParentInvitation()
    }
  }, [previewQuery.error])

  if (!token) {
    return (
      <ConnectState
        icon={<LinkIcon size={23} />}
        title={t('parentLinks.connect.noInvitationTitle')}
        description={t('parentLinks.connect.noInvitationDescription')}
      />
    )
  }

  if (previewQuery.isLoading) {
    return (
      <ConnectState
        icon={<span className={styles.spinner} />}
        title={t('parentLinks.connect.loadingTitle')}
        description={t('parentLinks.connect.loadingDescription')}
      />
    )
  }

  if (previewQuery.isError || !previewQuery.data) {
    return (
      <ConnectState
        icon={<CircleAlert size={23} />}
        title={t('parentLinks.connect.invalidTitle')}
        description={t('parentLinks.connect.invalidDescription')}
      />
    )
  }

  const { child, alreadyLinked } = previewQuery.data

  return (
    <section className={styles.contentColumn}>
      <Link className={styles.backLink} to="/app/parent">
        <ArrowLeft size={16} />
        {t('parentHub.actions.backToHome')}
      </Link>
      <section className={`${styles.stateCard} ${styles.connectState}`}>
        <ChildAvatar child={{ ...child, gradeLevel: null }} size="large" />
        <h1>{child.displayName}</h1>
        <p>{t('parentLinks.connect.confirmDescription')}</p>

        {alreadyLinked ? (
          <>
            <p className={styles.quietNote}>
              <Check size={16} />
              {t('parentLinks.connect.alreadyLinked')}
            </p>
            <Link
              className={styles.primaryButton}
              to="/app/parent"
              onClick={clearPendingParentInvitation}
            >
              {t('parentLinks.connect.openOverview')}
            </Link>
          </>
        ) : (
          <>
            {acceptMutation.isError && (
              <p className={styles.quietNote} role="alert">
                <CircleAlert size={16} />
                {getAcceptError(acceptMutation.error, t)}
              </p>
            )}
            <button
              className={styles.primaryButton}
              type="button"
              disabled={acceptMutation.isPending}
              onClick={() => acceptMutation.mutate()}
            >
              <LinkIcon size={16} />
              {acceptMutation.isPending
                ? t('parentLinks.connect.connecting')
                : t('parentLinks.connect.confirm')}
            </button>
          </>
        )}
        <p className={styles.quietNote}>
          <CircleAlert size={16} />
          {t('parentLinks.connect.privacy')}
        </p>
      </section>
    </section>
  )
}

function ConnectState({
  description,
  icon,
  title,
}: {
  description: string
  icon: React.ReactNode
  title: string
}) {
  const { t } = useTranslation()

  return (
    <section className={styles.contentColumn}>
      <Link className={styles.backLink} to="/app/parent">
        <ArrowLeft size={16} />
        {t('parentHub.actions.backToHome')}
      </Link>
      <section className={`${styles.stateCard} ${styles.connectState}`}>
        <span className={styles.iconMedallion}>{icon}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
    </section>
  )
}

function getAcceptError(
  error: Error,
  t: (key: string) => string,
): string {
  if (error instanceof ApiError) {
    if (error.code === 'PARENT_LIMIT_REACHED') {
      return t('parentLinks.connect.limitReached')
    }
    if (error.code === 'PARENT_ALREADY_LINKED') {
      return t('parentLinks.connect.alreadyLinked')
    }
    if (error.code === 'INVALID_PARENT_INVITATION') {
      return t('parentLinks.connect.invalidDescription')
    }
    if (error.code === 'NETWORK_ERROR') {
      return t('parentLinks.errors.network')
    }
  }

  return t('parentLinks.errors.unexpected')
}
