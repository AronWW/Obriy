import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Compass,
  UserRound,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useSessionStore } from '../auth/model/session.store'
import styles from './StudentOverviewPage.module.css'

export function StudentOverviewPage() {
  const { t } = useTranslation()
  const user = useSessionStore((state) => state.user)

  if (!user) {
    return (
      <section className={styles.page} aria-labelledby="student-overview-title">
        <div className={styles.content}>
          <h1 id="student-overview-title">{t('studentOverview.title')}</h1>
          <p className={styles.unavailable}>
            {t('studentOverview.unavailable')}
          </p>
        </div>
      </section>
    )
  }

  const grade =
    user.profile.gradeLevel === null
      ? t('studentOverview.profile.gradeUnavailable')
      : t('studentOverview.profile.grade', {
          grade: user.profile.gradeLevel,
        })

  return (
    <section className={styles.page} aria-labelledby="student-overview-title">
      <div className={styles.content}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>
            <Compass size={15} aria-hidden="true" />
            {t('studentOverview.eyebrow')}
          </p>
          <h1 id="student-overview-title">{t('studentOverview.title')}</h1>
          <p>{t('studentOverview.description')}</p>
        </header>

        <div className={styles.overviewGrid}>
          <div className={styles.primaryColumn}>
            <article className={styles.identityCard}>
              <div className={styles.cornerStar} aria-hidden="true">
                ✦
              </div>
              <div className={styles.identity}>
                <StudentAvatar
                  avatarUrl={user.profile.avatarUrl}
                  displayName={user.profile.displayName}
                />
                <div className={styles.identityCopy}>
                  <p>{t('studentOverview.profile.label')}</p>
                  <h2>{user.profile.displayName}</h2>
                  <span>{grade}</span>
                </div>
                <Link
                  className={styles.profileLink}
                  to="/app/student/profile"
                >
                  <UserRound size={16} aria-hidden="true" />
                  {t('studentOverview.profile.open')}
                </Link>
              </div>
            </article>

            <article className={styles.progressCard}>
              <header className={styles.cardHeading}>
                <p className={styles.cardEyebrow}>
                  <Compass size={14} aria-hidden="true" />
                  {t('studentOverview.progress.eyebrow')}
                </p>
                <h2>{t('studentOverview.progress.title')}</h2>
              </header>

              <div className={styles.progressIntro}>
                <div className={styles.compassMark} aria-hidden="true">
                  <Compass size={44} />
                </div>
                <div>
                  <h3>{t('studentOverview.progress.emptyTitle')}</h3>
                  <p>{t('studentOverview.progress.emptyDescription')}</p>
                </div>
              </div>

              <div
                className={styles.summary}
                aria-label={t('studentOverview.progress.summaryLabel')}
              >
                <SummaryItem
                  icon={<ClipboardList size={17} />}
                  label={t('studentOverview.progress.tasks')}
                />
                <SummaryItem
                  icon={<Award size={17} />}
                  label={t('studentOverview.progress.achievements')}
                />
                <SummaryItem
                  icon={<CalendarDays size={17} />}
                  label={t('studentOverview.progress.activeDays')}
                />
              </div>
            </article>
          </div>

          <div className={styles.secondaryColumn}>
            <OverviewSection
              action={t('studentOverview.learning.action')}
              description={t('studentOverview.learning.description')}
              empty={t('studentOverview.learning.empty')}
              icon={<BookOpen size={19} />}
              title={t('studentOverview.learning.title')}
              to="/app/student/classes"
            />
            <OverviewSection
              action={t('studentOverview.tasks.action')}
              description={t('studentOverview.tasks.description')}
              empty={t('studentOverview.tasks.empty')}
              icon={<ClipboardList size={19} />}
              title={t('studentOverview.tasks.title')}
              to="/app/student/tasks"
            />
            <OverviewSection
              action={t('studentOverview.achievements.action')}
              description={t('studentOverview.achievements.description')}
              empty={t('studentOverview.achievements.empty')}
              icon={<Award size={19} />}
              title={t('studentOverview.achievements.title')}
              to="/app/student/achievements"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function StudentAvatar({
  avatarUrl,
  displayName,
}: {
  avatarUrl: string | null
  displayName: string
}) {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <div className={styles.avatar} aria-hidden="true">
      {avatarUrl ? <img alt="" src={avatarUrl} /> : initials || 'O'}
    </div>
  )
}

function SummaryItem({
  icon,
  label,
}: {
  icon: ReactNode
  label: string
}) {
  const { t } = useTranslation()

  return (
    <div className={styles.summaryItem}>
      <span className={styles.summaryIcon} aria-hidden="true">
        {icon}
      </span>
      <strong>—</strong>
      <span>{label}</span>
      <small>{t('studentOverview.progress.unavailable')}</small>
    </div>
  )
}

function OverviewSection({
  action,
  description,
  empty,
  icon,
  title,
  to,
}: {
  action: string
  description: string
  empty: string
  icon: ReactNode
  title: string
  to: string
}) {
  return (
    <article className={styles.overviewSection}>
      <div className={styles.sectionHeading}>
        <span aria-hidden="true">{icon}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <p className={styles.emptyCopy}>{empty}</p>
      <Link className={styles.sectionLink} to={to}>
        {action}
        <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </article>
  )
}
