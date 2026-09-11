import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BookOpen, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useSessionStore } from '../auth/model/session.store'
import { getStudentDashboard } from '../student-workspace/api/student-workspace.api'
import { StudentWorkRow } from '../student-workspace/components/StudentWorkRow'
import { studentWorkspaceQueryKeys } from '../student-workspace/model/student-workspace-query-keys'
import type { StudentWorkItem } from '../student-workspace/model/student-workspace.types'
import styles from '../student-workspace/StudentWorkspace.module.css'
import { getMyGamification } from '../gamification/api/gamification.api'
import { BadgeIcon, GamificationProgressCard } from '../gamification'
import { gamificationQueryKeys } from '../gamification/model/gamification-query-keys'
import type { GamificationProgress } from '../gamification/model/gamification.types'

export function StudentOverviewPage() {
  const { i18n, t } = useTranslation()
  const user = useSessionStore((state) => state.user)
  const query = useQuery({
    queryKey: studentWorkspaceQueryKeys.dashboard(),
    queryFn: getStudentDashboard,
    enabled: Boolean(user),
  })
  const gamificationQuery = useQuery({
    queryKey: gamificationQueryKeys.me(),
    queryFn: getMyGamification,
    enabled: Boolean(user),
  })

  if (!user) {
    return (
      <section className={styles.page} aria-labelledby="student-overview-title">
        <div className={styles.content}>
          <StatePanel text={t('studentWorkspace.states.unavailable')} />
        </div>
      </section>
    )
  }

  const grade =
    user.profile.gradeLevel === null
      ? t('studentWorkspace.profile.gradeUnavailable')
      : t('studentWorkspace.profile.grade', {
          grade: user.profile.gradeLevel,
        })
  const dashboard = query.data
  const dateLocale = i18n.language === 'en' ? 'en-GB' : 'uk-UA'

  return (
    <section className={styles.page} aria-labelledby="student-overview-title">
      <div className={styles.content}>
        <header className={styles.pageHeader}>
          <div>
            <h1 id="student-overview-title">{t('studentWorkspace.overview.title')}</h1>
            <p>{t('studentWorkspace.overview.greeting', { name: user.profile.displayName })}</p>
          </div>
        </header>

        {query.isLoading && <StatePanel text={t('studentWorkspace.states.loading')} />}
        {query.isError && (
          <StatePanel
            action={() => void query.refetch()}
            actionLabel={t('studentWorkspace.states.retry')}
            text={t('studentWorkspace.states.error')}
          />
        )}
        {dashboard && !dashboard.class && (
          <div className={styles.noClassLayout}>
            <ProfilePanel
              avatarUrl={user.profile.avatarUrl}
              displayName={user.profile.displayName}
              grade={grade}
              progress={gamificationQuery.data?.progress}
            />
            <StatePanel
              actionLabel={t('studentWorkspace.noClass.action')}
              link="/app/student/classes"
              text={t('studentWorkspace.noClass.description')}
              title={t('studentWorkspace.noClass.title')}
            />
          </div>
        )}
        {dashboard?.class && (
          <>
            <div className={styles.overviewTop}>
              <ProfilePanel
                avatarUrl={user.profile.avatarUrl}
                className={dashboard.class.name}
                displayName={user.profile.displayName}
                grade={grade}
                progress={gamificationQuery.data?.progress}
              />
              <div className={styles.metrics} aria-label={t('studentWorkspace.metrics.label')}>
                <Metric
                  label={t('studentWorkspace.metrics.completion')}
                  value={percent(dashboard.metrics.completionPercent)}
                />
                <Metric
                  label={t('studentWorkspace.metrics.average')}
                  value={percent(dashboard.metrics.averagePercent)}
                />
                <Metric
                  label={t('studentWorkspace.metrics.attention')}
                  value={String(dashboard.metrics.attentionCount)}
                />
                <Metric
                  compact
                  label={t('studentWorkspace.metrics.nextDeadline')}
                  value={
                    dashboard.metrics.nextDueAt
                      ? new Intl.DateTimeFormat(dateLocale, {
                          day: 'numeric',
                          month: 'short',
                        }).format(new Date(dashboard.metrics.nextDueAt))
                      : '—'
                  }
                />
              </div>
            </div>

            <OverviewSection
              action="/app/student/tasks?status=ATTENTION"
              actionLabel={t('studentWorkspace.overview.allAttention')}
              empty={t('studentWorkspace.overview.noAttention')}
              items={dashboard.attention}
              title={t('studentWorkspace.overview.attentionTitle')}
            />
            <OverviewSection
              action="/app/student/tasks"
              actionLabel={t('studentWorkspace.overview.allTasks')}
              empty={t('studentWorkspace.overview.noUpcoming')}
              items={dashboard.upcoming}
              title={t('studentWorkspace.overview.upcomingTitle')}
            />

            <section className={styles.section} aria-labelledby="recent-achievements-title">
              <div className={styles.sectionHeader}>
                <h2 id="recent-achievements-title">
                  {t('achievements.overview.title')}
                </h2>
                <Link to="/app/student/achievements">
                  {t('achievements.overview.action')}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
              {!gamificationQuery.data?.badges.length ? (
                <p className={styles.emptyLine}>
                  {t('achievements.overview.empty')}
                </p>
              ) : (
                <div className={styles.achievementList}>
                  {gamificationQuery.data.badges.slice(0, 3).map((badge) => (
                    <Link
                      className={styles.achievementItem}
                      key={badge.id}
                      to="/app/student/achievements"
                    >
                      <span className={styles.achievementIcon}>
                        <BadgeIcon iconKey={badge.iconKey} size={21} />
                      </span>
                      <span>
                        <strong>{badge.name}</strong>
                        <small>
                          {new Intl.DateTimeFormat(dateLocale, {
                            day: 'numeric',
                            month: 'short',
                          }).format(new Date(badge.earnedAt))}
                        </small>
                      </span>
                      <ArrowRight aria-hidden="true" size={15} />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.section} aria-labelledby="continue-title">
              <div className={styles.sectionHeader}>
                <h2 id="continue-title">{t('studentWorkspace.overview.continueTitle')}</h2>
                <Link to="/app/student/classes">
                  {t('studentWorkspace.overview.allLessons')}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
              {dashboard.continueLessons.length === 0 ? (
                <p className={styles.emptyLine}>{t('studentWorkspace.overview.noLessons')}</p>
              ) : (
                <div className={styles.lessonList}>
                  {dashboard.continueLessons.map((lesson) => (
                    <Link
                      key={lesson.id}
                      to={`/app/student/lessons/${lesson.id}${lesson.nextReleaseId ? `?test=${lesson.nextReleaseId}` : ''}`}
                    >
                      <BookOpen size={19} aria-hidden="true" />
                      <span>
                        <strong>{lesson.title}</strong>
                        <small>
                          {t('studentWorkspace.overview.lessonProgress', {
                            completed: lesson.completedRequiredCount,
                            total: lesson.requiredCount,
                          })}
                        </small>
                      </span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </section>
  )
}

function ProfilePanel({
  avatarUrl,
  className,
  displayName,
  grade,
  progress,
}: {
  avatarUrl: string | null
  className?: string
  displayName: string
  grade: string
  progress?: GamificationProgress
}) {
  const { t } = useTranslation()
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  return (
    <article className={styles.profilePanel}>
      <div className={styles.avatar} aria-hidden="true">
        {avatarUrl ? <img alt="" src={avatarUrl} /> : initials || 'O'}
      </div>
      <div>
        <h2>{displayName}</h2>
        <p>{className ? `${className} · ${grade}` : grade}</p>
      </div>
      <Link to="/app/student/profile">
        <UserRound size={16} aria-hidden="true" />
        {t('studentWorkspace.profile.open')}
      </Link>
      {progress && <GamificationProgressCard compact progress={progress} />}
    </article>
  )
}

function Metric({ compact, label, value }: { compact?: boolean; label: string; value: string }) {
  return (
    <div className={compact ? styles.metricCompact : undefined}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function OverviewSection({
  action,
  actionLabel,
  empty,
  items,
  title,
}: {
  action: string
  actionLabel: string
  empty: string
  items: StudentWorkItem[]
  title: string
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>{title}</h2>
        <Link to={action}>
          {actionLabel}
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className={styles.emptyLine}>{empty}</p>
      ) : (
        <div className={styles.workList}>
          {items.map((item) => <StudentWorkRow item={item} key={item.releaseId} />)}
        </div>
      )}
    </section>
  )
}

function StatePanel({
  action,
  actionLabel,
  link,
  text,
  title,
}: {
  action?: () => void
  actionLabel?: string
  link?: string
  text: string
  title?: string
}) {
  return (
    <div className={styles.statePanel} role={action ? 'alert' : undefined}>
      {title && <h2>{title}</h2>}
      <p>{text}</p>
      {action && actionLabel && <button onClick={action} type="button">{actionLabel}</button>}
      {link && actionLabel && <Link to={link}>{actionLabel}</Link>}
    </div>
  )
}

function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}%`
}
