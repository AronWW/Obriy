import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import type {
  ParentChildOverview,
  ParentChildProgress,
  ParentChildSummary,
  ParentDashboard,
  ParentMetrics,
  ParentTestProgress,
  ParentWorkItem,
} from '../model/parent.types'
import { parentLinksApi } from '../../parent-links/api/parent-links.api'
import { linkedChildrenQueryKey } from '../hooks/useLinkedChildren'
import { parentQueryKeys } from '../model/parent-query-keys'
import { ChildAvatar } from './ChildAvatar'
import styles from './ParentDashboardView.module.css'

export function ParentLoadingState() {
  const { t } = useTranslation()
  return <div aria-busy="true" className={styles.state}><span className={styles.spinner} />{t('parentLearning.states.loading')}</div>
}

export function ParentErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className={styles.state} role="alert">
      <CircleAlert size={25} />
      <h1>{t('parentLearning.states.errorTitle')}</h1>
      <p>{t('parentLearning.states.errorDescription')}</p>
      <button className={styles.primaryButton} onClick={onRetry} type="button"><RefreshCw size={16} />{t('parentLearning.actions.retry')}</button>
    </div>
  )
}

export function ParentEmptyState() {
  const { t } = useTranslation()
  return (
    <div className={styles.state}>
      <h1>{t('parentLearning.empty.title')}</h1>
      <p>{t('parentLearning.empty.description')}</p>
      <Link className={styles.primaryButton} to="/app/parent/connect">{t('parentLearning.empty.action')}</Link>
    </div>
  )
}

export function FamilyDashboard({ dashboard }: { dashboard: ParentDashboard }) {
  const { t } = useTranslation()
  return (
    <div className={styles.pageBody}>
      <header className={styles.pageHeader}>
        <h1>{t('parentLearning.family.title')}</h1>
        <p>{t('parentLearning.family.description')}</p>
      </header>
      <div className={styles.childGrid}>
        {dashboard.children.map((child) => (
          <Link className={styles.childCard} key={child.id} to={`/app/parent/child/${child.id}`}>
            <div className={styles.childIdentity}>
              <ChildAvatar child={child} size="large" />
              <div><h2>{child.displayName}</h2><p>{child.class?.name ?? t('parentLearning.common.noClass')}</p></div>
              <ArrowRight size={18} />
            </div>
            <MetricStrip metrics={child.metrics} compact />
            {child.metrics.nextDueAt && (
              <p className={styles.nextDeadline}><CalendarClock size={15} />{t('parentLearning.family.nextDeadline', { date: formatDate(child.metrics.nextDueAt) })}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

export function ChildOverviewView({
  overview,
  children,
}: {
  overview: ParentChildOverview
  children: ParentChildSummary[]
}) {
  const { t } = useTranslation()
  const child = overview.child
  return (
    <div className={styles.pageBody}>
      <ChildNavigation child={child} children={children} />
      <header className={styles.childHeader}>
        <ChildAvatar child={child} size="large" />
        <div><h1>{child.displayName}</h1><p>{child.class?.name ?? t('parentLearning.common.noClass')}</p></div>
      </header>
      <MetricStrip metrics={child.metrics} />
      {!child.class ? (
        <EmptyPanel title={t('parentLearning.noClass.title')} description={t('parentLearning.noClass.description')} />
      ) : (
        <>
          <WorkSection icon={<CircleAlert size={19} />} title={t('parentLearning.attention.title')} empty={t('parentLearning.attention.empty')} items={overview.attention} />
          <WorkSection icon={<CalendarClock size={19} />} title={t('parentLearning.upcoming.title')} empty={t('parentLearning.upcoming.empty')} items={overview.upcoming} />
          <WorkSection icon={<Clock3 size={19} />} title={t('parentLearning.recent.title')} empty={t('parentLearning.recent.empty')} items={overview.recentActivity} />
        </>
      )}
      <Link className={styles.progressLink} to={`/app/parent/child/${child.id}/progress`}>
        <BookOpen size={17} />{t('parentLearning.actions.details')}<ArrowRight size={16} />
      </Link>
      <UnlinkChildButton childId={child.id} />
    </div>
  )
}

export function ChildProgressView({
  progress,
  children,
}: {
  progress: ParentChildProgress
  children: ParentChildSummary[]
}) {
  const { t } = useTranslation()
  const child = progress.child
  return (
    <div className={styles.pageBody}>
      <ChildNavigation child={child} children={children} progress />
      <header className={styles.pageHeader}>
        <h1>{t('parentLearning.progress.title', { name: child.displayName })}</h1>
        <p>{t('parentLearning.progress.description')}</p>
      </header>
      <MetricStrip metrics={child.metrics} />
      {progress.lessons.length === 0 ? (
        <EmptyPanel title={t('parentLearning.progress.emptyTitle')} description={t('parentLearning.progress.emptyDescription')} />
      ) : (
        <div className={styles.lessonList}>
          {progress.lessons.map((lesson) => (
            <section className={styles.lesson} key={lesson.id}>
              <header className={styles.lessonHeader}>
                <div><span>{t('parentLearning.progress.lesson', { number: lesson.position })}</span><h2>{lesson.title}</h2></div>
                <div className={styles.lessonMetric}><strong>{percent(lesson.completionPercent)}</strong><small>{t('parentLearning.metrics.progress')}</small></div>
              </header>
              {lesson.tests.length === 0 ? <p className={styles.lessonEmpty}>{t('parentLearning.progress.noTests')}</p> : (
                <div className={styles.testList}>{lesson.tests.map((test) => <TestProgress key={test.releaseId} test={test} />)}</div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function ChildNavigation({ child, children, progress = false }: { child: ParentChildSummary; children: ParentChildSummary[]; progress?: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className={styles.navigationLine}>
      <Link to={progress ? `/app/parent/child/${child.id}` : '/app/parent'}><ArrowLeft size={16} />{t(progress ? 'parentLearning.actions.backOverview' : 'parentLearning.actions.allChildren')}</Link>
      {children.length > 1 && (
        <label className={styles.childSwitch}>
          <span>{t('parentLearning.actions.selectChild')}</span>
          <select value={child.id} onChange={(event) => navigate(progress ? `/app/parent/child/${event.target.value}/progress` : `/app/parent/child/${event.target.value}`)}>
            {children.map((entry) => <option key={entry.id} value={entry.id}>{entry.displayName}</option>)}
          </select>
        </label>
      )}
    </div>
  )
}

function MetricStrip({ metrics, compact = false }: { metrics: ParentMetrics; compact?: boolean }) {
  const { t } = useTranslation()
  return (
    <dl className={`${styles.metrics} ${compact ? styles.metricsCompact : ''}`}>
      <div><dt><TrendingUp size={15} />{t('parentLearning.metrics.progress')}</dt><dd>{percent(metrics.completionPercent)}</dd><small>{t('parentLearning.metrics.completed', { completed: metrics.completedCount, total: metrics.requiredReleaseCount })}</small></div>
      <div><dt><CheckCircle2 size={15} />{t('parentLearning.metrics.average')}</dt><dd>{percent(metrics.averagePercent)}</dd></div>
      <div data-attention={metrics.attentionCount > 0}><dt><CircleAlert size={15} />{t('parentLearning.metrics.attention')}</dt><dd>{metrics.attentionCount}</dd></div>
    </dl>
  )
}

function WorkSection({ icon, title, empty, items }: { icon: ReactNode; title: string; empty: string; items: ParentWorkItem[] }) {
  return (
    <section className={styles.workSection}>
      <header>{icon}<h2>{title}</h2></header>
      {items.length === 0 ? <p className={styles.sectionEmpty}>{empty}</p> : <div className={styles.workList}>{items.map((item) => <WorkRow item={item} key={item.releaseId} />)}</div>}
    </section>
  )
}

function UnlinkChildButton({ childId }: { childId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const mutation = useMutation({
    mutationFn: () => parentLinksApi.unlinkChild(childId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: parentQueryKeys.root }),
        queryClient.invalidateQueries({ queryKey: linkedChildrenQueryKey }),
      ])
      navigate('/app/parent', { replace: true })
    },
  })
  if (!confirming) {
    return <button className={styles.unlinkButton} onClick={() => setConfirming(true)} type="button">{t('parentLinks.parent.unlink')}</button>
  }
  return (
    <div className={styles.unlinkRow}>
      <button className={styles.dangerButton} disabled={mutation.isPending} onClick={() => mutation.mutate()} type="button">{t('parentLinks.parent.confirmUnlink')}</button>
      <button className={styles.cancelButton} onClick={() => setConfirming(false)} type="button">{t('parentLinks.parent.cancelUnlink')}</button>
      {mutation.isError && <span role="alert">{t('parentLinks.parent.unlinkError')}</span>}
    </div>
  )
}

function WorkRow({ item }: { item: ParentWorkItem }) {
  const { t } = useTranslation()
  return (
    <article className={styles.workRow}>
      <div><strong>{item.title}</strong><span>{item.lesson.title}</span></div>
      <div className={styles.workMeta}>
        <Status status={item.status} />
        {item.dueAt && <time dateTime={item.dueAt}>{formatDate(item.dueAt)}</time>}
        {item.scorePercent !== null && <b>{percent(item.scorePercent)}</b>}
      </div>
      {item.attentionReason && <small className={styles.reason}>{t(`parentLearning.reasons.${item.attentionReason}`)}</small>}
    </article>
  )
}

function TestProgress({ test }: { test: ParentTestProgress }) {
  const { t } = useTranslation()
  return (
    <details className={styles.test}>
      <summary>
        <div><strong>{test.title}</strong><span>{test.isRequired ? t('parentLearning.common.required') : t('parentLearning.common.optional')}</span></div>
        <div className={styles.testScore}><Status status={test.status} /><b>{percent(test.scorePercent)}</b>{test.bestPercent !== null && test.bestPercent !== test.scorePercent && <small>{t('parentLearning.progress.best', { score: percent(test.bestPercent) })}</small>}<ChevronDown size={17} /></div>
      </summary>
      <div className={styles.testDetails}>
        <dl><div><dt>{t('parentLearning.progress.deadline')}</dt><dd>{test.dueAt ? formatDate(test.dueAt) : '—'}</dd></div><div><dt>{t('parentLearning.progress.attempts')}</dt><dd>{test.attemptCount}</dd></div><div><dt>{t('parentLearning.progress.currentPoints')}</dt><dd>{test.scorePoints === null ? '—' : `${test.scorePoints}/${test.maxPoints}`}</dd></div></dl>
        {test.attempts.length > 0 && <div className={styles.attempts}><h3>{t('parentLearning.progress.attemptHistory')}</h3>{test.attempts.map((attempt) => <div className={styles.attempt} key={attempt.attemptNumber}><span>{t('parentLearning.progress.attempt', { number: attempt.attemptNumber })}</span><Status status={attempt.status} /><b>{percent(attempt.scorePercent)}</b><time dateTime={attempt.gradedAt ?? attempt.submittedAt ?? attempt.startedAt}>{formatDate(attempt.gradedAt ?? attempt.submittedAt ?? attempt.startedAt)}</time></div>)}</div>}
      </div>
    </details>
  )
}

function Status({ status }: { status: string }) {
  const { t } = useTranslation()
  return <span className={styles.status} data-status={status}>{t(`parentLearning.status.${status}`)}</span>
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return <section className={styles.emptyPanel}><h2>{title}</h2><p>{description}</p></section>
}

function percent(value: number | null) {
  return value === null ? '—' : `${Math.round(value * 100) / 100}%`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(document.documentElement.lang === 'en' ? 'en-GB' : 'uk-UA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
