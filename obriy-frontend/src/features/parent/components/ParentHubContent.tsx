import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Link as LinkIcon,
  RefreshCw,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import type { LinkedChild } from '../model/parent.types'
import { ChildAvatar } from './ChildAvatar'
import styles from './ParentHub.module.css'
import { parentLinksApi } from '../../parent-links/api/parent-links.api'
import { linkedChildrenQueryKey } from '../hooks/useLinkedChildren'

export function ParentDataState({
  isLoading,
  isError,
  onRetry,
  children,
}: {
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  children?: LinkedChild[]
}) {
  const { t } = useTranslation()
  if (isLoading) {
    return (
      <section className={styles.stateCard} aria-busy="true">
        <div className={styles.spinner} />
        <p>{t('parentHub.states.loading')}</p>
      </section>
    )
  }
  if (isError) {
    return (
      <section className={styles.stateCard} role="alert">
        <CircleAlert size={25} />
        <h1>{t('parentHub.states.errorTitle')}</h1>
        <p>{t('parentHub.states.errorDescription')}</p>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={onRetry}
        >
          <RefreshCw size={16} />
          {t('parentHub.actions.retry')}
        </button>
      </section>
    )
  }
  if (!children?.length) return <EmptyParentHub />
  return null
}

export function EmptyParentHub() {
  const { t } = useTranslation()
  return (
    <section className={`${styles.stateCard} ${styles.emptyState}`}>
      <span className={styles.iconMedallion}>
        <LinkIcon size={23} />
      </span>
      <p className={styles.eyebrow}>{t('parentHub.empty.eyebrow')}</p>
      <h1>{t('parentHub.empty.title')}</h1>
      <p>{t('parentHub.empty.description')}</p>
      <Link className={styles.primaryButton} to="/app/parent/connect">
        <LinkIcon size={16} />
        {t('parentHub.empty.action')}
      </Link>
    </section>
  )
}

export function FamilyOverview({ children }: { children: LinkedChild[] }) {
  const { t } = useTranslation()
  return (
    <section className={styles.contentColumn}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>{t('parentHub.family.eyebrow')}</p>
        <h1>{t('parentHub.family.title')}</h1>
        <p>{t('parentHub.family.description')}</p>
      </div>
      <div
        className={styles.familyList}
        aria-label={t('parentHub.family.listLabel')}
      >
        {children.map((child) => (
          <ChildFamilyRow child={child} key={child.id} />
        ))}
      </div>
      <p className={styles.quietNote}>
        <UsersRound size={16} />
        {t('parentHub.family.quietNote')}
      </p>
    </section>
  )
}

function ChildFamilyRow({ child }: { child: LinkedChild }) {
  const { t } = useTranslation()
  return (
    <Link className={styles.childRow} to={`/app/parent/child/${child.id}`}>
      <ChildAvatar child={child} size="large" />
      <span className={styles.childRowBody}>
        <strong>{child.displayName}</strong>
        <small>
          {child.gradeLevel === null
            ? t('parentHub.child.gradeUnavailable')
            : t('parentHub.child.grade', { grade: child.gradeLevel })}
        </small>
      </span>
      <span className={styles.childRowAction}>
        {t('parentHub.family.openChild')}
        <ChevronRight size={18} />
      </span>
    </Link>
  )
}

export function ChildOverview({
  child,
  children,
}: {
  child: LinkedChild
  children: LinkedChild[]
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmingUnlink, setConfirmingUnlink] = useState(false)
  const unlinkMutation = useMutation({
    mutationFn: () => parentLinksApi.unlinkChild(child.id),
    onSuccess: () => {
      queryClient.setQueryData(linkedChildrenQueryKey, (current: unknown) =>
        Array.isArray(current)
          ? current.filter(
              (entry) =>
                typeof entry !== 'object' ||
                entry === null ||
                !('id' in entry) ||
                entry.id !== child.id,
            )
          : [],
      )
      void queryClient.invalidateQueries({ queryKey: linkedChildrenQueryKey })
      navigate('/app/parent', { replace: true })
    },
  })
  const grade =
    child.gradeLevel === null
      ? t('parentHub.child.gradeUnavailable')
      : t('parentHub.child.grade', { grade: child.gradeLevel })

  return (
    <article className={styles.contentColumn}>
      <div className={styles.backLine}>
        {children.length > 1 && (
          <Link to="/app/parent">
            <ArrowLeft size={16} />
            {t('parentHub.actions.allChildren')}
          </Link>
        )}
        {children.length > 1 && (
          <label className={styles.childSwitcher}>
            <span className={styles.visuallyHidden}>
              {t('parentHub.child.switcherLabel')}
            </span>
            <select
              value={child.id}
              onChange={(event) =>
                navigate(`/app/parent/child/${event.target.value}`)
              }
            >
              {children.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.displayName}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <header className={styles.childHero}>
        <ChildAvatar child={child} size="large" />
        <div>
          <p className={styles.eyebrow}>{t('parentHub.child.eyebrow')}</p>
          <h1>{child.displayName}</h1>
          <p>{grade}</p>
        </div>
      </header>
      <section className={styles.attentionCard}>
        <CircleAlert size={21} />
        <div>
          <h2>{t('parentHub.attention.title')}</h2>
          <p>{t('parentHub.attention.unavailable')}</p>
        </div>
      </section>
      <section className={styles.reportSection}>
        <div className={styles.sectionHeading}>
          <CalendarDays size={19} />
          <div>
            <h2>{t('parentHub.weekly.title')}</h2>
            <p>{t('parentHub.weekly.description')}</p>
          </div>
        </div>
        <div className={styles.summaryGrid}>
          <SummaryItem label={t('parentHub.weekly.learningTime')} />
          <SummaryItem label={t('parentHub.weekly.completed')} />
          <SummaryItem label={t('parentHub.weekly.progress')} />
        </div>
        <p className={styles.unavailableNote}>
          {t('parentHub.common.unavailable')}
        </p>
      </section>
      <div className={styles.reportGrid}>
        <section className={styles.reportSection}>
          <div className={styles.sectionHeading}>
            <BookOpen size={19} />
            <div>
              <h2>{t('parentHub.learningNow.title')}</h2>
              <p>{t('parentHub.learningNow.description')}</p>
            </div>
          </div>
          <p className={styles.emptyCopy}>{t('parentHub.learningNow.empty')}</p>
        </section>
        <section className={styles.reportSection}>
          <div className={styles.sectionHeading}>
            <ClipboardCheck size={19} />
            <div>
              <h2>{t('parentHub.activity.title')}</h2>
              <p>{t('parentHub.activity.description')}</p>
            </div>
          </div>
          <p className={styles.emptyCopy}>{t('parentHub.activity.empty')}</p>
        </section>
      </div>
      <div className={styles.childActions}>
        <Link
          className={styles.secondaryButton}
          to={`/app/parent/child/${child.id}/progress`}
        >
          <Sparkles size={16} />
          {t('parentHub.actions.openProgress')}
          <ArrowRight size={16} />
        </Link>
        {confirmingUnlink ? (
          <div className={styles.unlinkConfirmation}>
            <button
              className={styles.dangerButton}
              type="button"
              disabled={unlinkMutation.isPending}
              onClick={() => unlinkMutation.mutate()}
            >
              {t('parentLinks.parent.confirmUnlink')}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => setConfirmingUnlink(false)}
            >
              {t('parentLinks.parent.cancelUnlink')}
            </button>
          </div>
        ) : (
          <button
            className={styles.textDangerButton}
            type="button"
            onClick={() => setConfirmingUnlink(true)}
          >
            {t('parentLinks.parent.unlink')}
          </button>
        )}
      </div>
      {unlinkMutation.isError && (
        <p className={styles.unlinkError} role="alert">
          {t('parentLinks.parent.unlinkError')}
        </p>
      )}
    </article>
  )
}

function SummaryItem({ label }: { label: string }) {
  return (
    <div className={styles.summaryItem}>
      <span>—</span>
      <small>{label}</small>
    </div>
  )
}

export function ProgressPlaceholder({
  child,
  children,
}: {
  child: LinkedChild
  children: LinkedChild[]
}) {
  const { t } = useTranslation()
  return (
    <article className={styles.contentColumn}>
      <div className={styles.backLine}>
        <Link to={`/app/parent/child/${child.id}`}>
          <ArrowLeft size={16} />
          {t('parentHub.actions.backToOverview')}
        </Link>
        {children.length > 1 && (
          <ChildPicker child={child} children={children} />
        )}
      </div>
      <header className={styles.childHero}>
        <ChildAvatar child={child} size="large" />
        <div>
          <p className={styles.eyebrow}>{t('parentHub.progress.eyebrow')}</p>
          <h1>{t('parentHub.progress.title', { name: child.displayName })}</h1>
          <p>{t('parentHub.progress.description')}</p>
        </div>
      </header>
      <section className={`${styles.stateCard} ${styles.progressEmpty}`}>
        <Sparkles size={25} />
        <h2>{t('parentHub.progress.emptyTitle')}</h2>
        <p>{t('parentHub.progress.emptyDescription')}</p>
      </section>
    </article>
  )
}

function ChildPicker({
  child,
  children,
}: {
  child: LinkedChild
  children: LinkedChild[]
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <label className={styles.childSwitcher}>
      <span className={styles.visuallyHidden}>
        {t('parentHub.child.switcherLabel')}
      </span>
      <select
        value={child.id}
        onChange={(event) =>
          navigate(`/app/parent/child/${event.target.value}/progress`)
        }
      >
        {children.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.displayName}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ConnectPlaceholder() {
  const { t } = useTranslation()
  return (
    <section className={styles.contentColumn}>
      <Link className={styles.backLink} to="/app/parent">
        <ArrowLeft size={16} />
        {t('parentHub.actions.backToHome')}
      </Link>
      <section className={`${styles.stateCard} ${styles.connectState}`}>
        <span className={styles.iconMedallion}>
          <LinkIcon size={23} />
        </span>
        <p className={styles.eyebrow}>{t('parentHub.connect.eyebrow')}</p>
        <h1>{t('parentHub.connect.title')}</h1>
        <p>{t('parentHub.connect.description')}</p>
        <p className={styles.quietNote}>
          <CircleAlert size={16} />
          {t('parentHub.connect.unavailable')}
        </p>
      </section>
    </section>
  )
}
