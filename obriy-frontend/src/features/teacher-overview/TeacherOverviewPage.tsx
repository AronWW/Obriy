import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  FileQuestion,
  Plus,
  School,
  UsersRound,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useSessionStore } from '../auth/model/session.store'
import { getTeacherDashboard } from './api/teacher-dashboard.api'
import type {
  TeacherDashboardRecentAssignment,
  TeacherDashboardRecentLesson,
  TeacherDashboardRecentTest,
} from './model/teacher-dashboard.types'
import styles from './TeacherOverviewPage.module.css'

const dashboardQueryKey = ['teacher-dashboard'] as const

export function TeacherOverviewPage() {
  const { i18n, t } = useTranslation()
  const displayName = useSessionStore(
    (state) => state.user?.profile.displayName ?? '',
  )
  const dashboard = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: getTeacherDashboard,
  })

  return (
    <section className={styles.page} aria-labelledby="teacher-overview-title">
      <div className={styles.content}>
        <header className={styles.intro}>
          <div>
            <h1 id="teacher-overview-title">{t('teacherOverview.title')}</h1>
            <p>
              {t('teacherOverview.greeting', { name: displayName })}{' '}
              {t('teacherOverview.description')}
            </p>
          </div>
        </header>

        <QuickActions />

        {dashboard.isLoading && <DashboardLoading />}
        {dashboard.isError && (
          <div className={styles.errorState} role="alert">
            <ClipboardCheck aria-hidden="true" size={28} />
            <div>
              <strong>{t('teacherOverview.error.title')}</strong>
              <p>{t('teacherOverview.error.description')}</p>
            </div>
            <button onClick={() => void dashboard.refetch()} type="button">
              {t('teacherOverview.error.retry')}
            </button>
          </div>
        )}

        {dashboard.data && (
          <>
            <div className={styles.statsGrid}>
              <StatCard
                icon={School}
                label={t('teacherOverview.stats.classes')}
                meta={t('teacherOverview.stats.students', {
                  count: dashboard.data.stats.classes.studentCount,
                })}
                to="/app/teacher/classes"
                value={dashboard.data.stats.classes.total}
              />
              <StatCard
                icon={BookOpen}
                label={t('teacherOverview.stats.lessons')}
                meta={t('teacherOverview.stats.drafts', {
                  count: dashboard.data.stats.lessons.drafts,
                })}
                to="/app/teacher/lessons"
                value={dashboard.data.stats.lessons.total}
              />
              <StatCard
                icon={FileQuestion}
                label={t('teacherOverview.stats.assignments')}
                meta={t('teacherOverview.stats.drafts', {
                  count: dashboard.data.stats.assignments.drafts,
                })}
                to="/app/teacher/tasks"
                value={dashboard.data.stats.assignments.total}
              />
              <StatCard
                icon={ClipboardList}
                label={t('teacherOverview.stats.tests')}
                meta={t('teacherOverview.stats.drafts', {
                  count: dashboard.data.stats.tests.drafts,
                })}
                to="/app/teacher/tests"
                value={dashboard.data.stats.tests.total}
              />
            </div>

            <section
              className={styles.attention}
              aria-labelledby="teacher-attention-title"
            >
              <header className={styles.sectionHeader}>
                <div>
                  <h2 id="teacher-attention-title">
                    {t('teacherOverview.attention.title')}
                  </h2>
                  <p>{t('teacherOverview.attention.description')}</p>
                </div>
                <span className={styles.attentionCount}>
                  {dashboard.data.stats.pendingReviews}
                </span>
              </header>
              {dashboard.data.pendingReviews.length === 0 ? (
                <EmptyLine icon={ClipboardCheck}>
                  {t('teacherOverview.attention.empty')}
                </EmptyLine>
              ) : (
                <div className={styles.reviewList}>
                  {dashboard.data.pendingReviews.map((review) => (
                    <article className={styles.reviewRow} key={review.attemptId}>
                      <span className={styles.reviewIcon}>
                        <UsersRound aria-hidden="true" size={19} />
                      </span>
                      <div className={styles.reviewCopy}>
                        <strong>{review.studentName}</strong>
                        <span>
                          {review.className} · {review.lessonTitle}
                        </span>
                        <p>{review.testTitle}</p>
                      </div>
                      <div className={styles.reviewMeta}>
                        <span>
                          {t('teacherOverview.attention.pendingAnswers', {
                            count: review.pendingReviewCount,
                          })}
                        </span>
                        {review.submittedAt && (
                          <time dateTime={review.submittedAt}>
                            {formatDate(review.submittedAt, i18n.resolvedLanguage)}
                          </time>
                        )}
                      </div>
                      <Link
                        className={styles.reviewLink}
                        to={`/app/teacher/lessons/${review.lessonId}/edit?reviewAttempt=${review.attemptId}`}
                      >
                        {t('teacherOverview.attention.review')}
                        <ArrowRight aria-hidden="true" size={15} />
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <div className={styles.recentGrid}>
              <RecentSection
                allHref="/app/teacher/lessons"
                allLabel={t('teacherOverview.recent.viewAll')}
                empty={t('teacherOverview.recent.lessonsEmpty')}
                items={dashboard.data.recent.lessons}
                renderItem={(item) => (
                  <RecentItem
                    href={`/app/teacher/lessons/${item.id}/edit`}
                    key={item.id}
                    meta={t('teacherOverview.recent.classes', {
                      count: item.classCount,
                    })}
                    status={item.status}
                    title={item.title}
                    updatedAt={item.updatedAt}
                  />
                )}
                title={t('teacherOverview.recent.lessons')}
              />
              <RecentSection
                allHref="/app/teacher/tasks"
                allLabel={t('teacherOverview.recent.viewAll')}
                empty={t('teacherOverview.recent.assignmentsEmpty')}
                items={dashboard.data.recent.assignments}
                renderItem={(item) => (
                  <RecentItem
                    href={`/app/teacher/tasks/${item.id}/edit`}
                    key={item.id}
                    meta={t(`assignments.types.${item.type}.title`)}
                    status={item.status}
                    title={item.title}
                    updatedAt={item.updatedAt}
                  />
                )}
                title={t('teacherOverview.recent.assignments')}
              />
              <RecentSection
                allHref="/app/teacher/tests"
                allLabel={t('teacherOverview.recent.viewAll')}
                empty={t('teacherOverview.recent.testsEmpty')}
                items={dashboard.data.recent.tests}
                renderItem={(item) => (
                  <RecentItem
                    href={`/app/teacher/tests/${item.id}/edit`}
                    key={item.id}
                    meta={t('teacherOverview.recent.items', {
                      count: item.itemCount,
                    })}
                    status={item.status}
                    title={item.title}
                    updatedAt={item.updatedAt}
                  />
                )}
                title={t('teacherOverview.recent.tests')}
              />
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function QuickActions() {
  const { t } = useTranslation()
  const actions = [
    { icon: School, label: t('teacherOverview.quick.class'), to: '/app/teacher/classes?create=1' },
    { icon: BookOpen, label: t('teacherOverview.quick.lesson'), to: '/app/teacher/lessons/new' },
    { icon: FileQuestion, label: t('teacherOverview.quick.assignment'), to: '/app/teacher/tasks?create=1' },
    { icon: ClipboardList, label: t('teacherOverview.quick.test'), to: '/app/teacher/tests/new' },
  ]
  return (
    <nav className={styles.quickActions} aria-label={t('teacherOverview.quick.title')}>
      <span>{t('teacherOverview.quick.title')}</span>
      <div>
        {actions.map(({ icon: Icon, label, to }) => (
          <Link key={to} to={to}>
            <Icon aria-hidden="true" size={16} />
            {label}
            <Plus aria-hidden="true" size={14} />
          </Link>
        ))}
      </div>
    </nav>
  )
}

function StatCard({ icon: Icon, label, meta, to, value }: {
  icon: ComponentType<{ size?: number }>
  label: string
  meta: string
  to: string
  value: number
}) {
  return (
    <Link className={styles.statCard} to={to}>
      <span aria-hidden="true"><Icon size={20} /></span>
      <div><strong>{value}</strong><p>{label}</p><small>{meta}</small></div>
      <ArrowRight aria-hidden="true" size={17} />
    </Link>
  )
}

type Recent =
  | TeacherDashboardRecentLesson
  | TeacherDashboardRecentAssignment
  | TeacherDashboardRecentTest

function RecentSection<T extends Recent>({ allHref, allLabel, empty, items, renderItem, title }: {
  allHref: string
  allLabel: string
  empty: string
  items: T[]
  renderItem: (item: T) => ReactNode
  title: string
}) {
  return (
    <section className={styles.recentSection}>
      <header><h2>{title}</h2><Link to={allHref}>{allLabel}<ArrowRight aria-hidden="true" size={14} /></Link></header>
      {items.length === 0 ? <p className={styles.recentEmpty}>{empty}</p> : <div className={styles.recentList}>{items.map(renderItem)}</div>}
    </section>
  )
}

function RecentItem({ href, meta, status, title, updatedAt }: {
  href: string
  meta: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  title: string
  updatedAt: string
}) {
  const { i18n, t } = useTranslation()
  return (
    <Link className={styles.recentItem} to={href}>
      <div><strong>{title || t('teacherOverview.recent.untitled')}</strong><span>{meta}</span></div>
      <div className={styles.recentItemMeta}><span data-status={status}>{t(`teacherOverview.status.${status}`)}</span><time dateTime={updatedAt}>{formatDate(updatedAt, i18n.resolvedLanguage)}</time></div>
    </Link>
  )
}

function EmptyLine({ children, icon: Icon }: { children: ReactNode; icon: ComponentType<{ size?: number }> }) {
  return <div className={styles.emptyLine}><span aria-hidden="true"><Icon size={22} /></span><p>{children}</p></div>
}

function DashboardLoading() {
  const { t } = useTranslation()
  return <div aria-live="polite" className={styles.loading}><span /><span /><span /><span /><p>{t('teacherOverview.loading')}</p></div>
}

function formatDate(value: string, language?: string): string {
  return new Intl.DateTimeFormat(language === 'en' ? 'en' : 'uk', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(value))
}
