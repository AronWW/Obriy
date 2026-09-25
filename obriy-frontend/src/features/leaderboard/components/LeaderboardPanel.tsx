import { useInfiniteQuery } from '@tanstack/react-query'
import { Award, RefreshCw, Trophy, UsersRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { UserAvatarImage } from '../../../shared/ui/UserAvatarImage'
import { Link } from 'react-router-dom'
import { BadgeIcon } from '../../gamification'
import {
  getStudentLeaderboard,
  getTeacherLeaderboard,
} from '../api/leaderboard.api'
import { leaderboardQueryKeys } from '../model/leaderboard-query-keys'
import type {
  LeaderboardEntry,
  LeaderboardPeriod,
} from '../model/leaderboard.types'
import styles from '../Leaderboard.module.css'

export function LeaderboardPanel({
  classId,
  mode,
  onPeriodChange,
  period,
}: {
  classId?: string
  mode: 'student' | 'teacher'
  onPeriodChange: (period: LeaderboardPeriod) => void
  period: LeaderboardPeriod
}) {
  const { i18n, t } = useTranslation()
  const query = useInfiniteQuery({
    queryKey:
      mode === 'student'
        ? leaderboardQueryKeys.student(period)
        : leaderboardQueryKeys.teacher(classId ?? '', period),
    queryFn: ({ pageParam }) =>
      mode === 'student'
        ? getStudentLeaderboard(period, pageParam)
        : getTeacherLeaderboard(classId ?? '', period, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: mode === 'student' || Boolean(classId),
  })
  const firstPage = query.data?.pages[0]
  const entries = uniqueEntries(
    query.data?.pages.flatMap((page) => page.entries) ?? [],
  )
  const topThree = firstPage?.entries.filter(({ rank }) => rank <= 3) ?? []
  const selfIsVisible = entries.some(({ isCurrentUser }) => isCurrentUser)

  return (
    <section className={styles.board} aria-label={t('leaderboard.boardLabel')}>
      <header className={styles.boardHeader}>
        <div>
          <h2>{t('leaderboard.classTitle', { name: firstPage?.class?.name ?? '' })}</h2>
          {firstPage?.period.startAt && firstPage.period.endAt && (
            <p>
              {t('leaderboard.weekRange', {
                start: formatDate(firstPage.period.startAt, i18n.resolvedLanguage),
                end: formatDate(
                  new Date(new Date(firstPage.period.endAt).getTime() - 1),
                  i18n.resolvedLanguage,
                ),
              })}
            </p>
          )}
        </div>
        <div
          aria-label={t('leaderboard.period.label')}
          className={styles.periodSwitch}
          role="group"
        >
          {(['WEEK', 'ALL_TIME'] as const).map((value) => (
            <button
              aria-pressed={period === value}
              key={value}
              onClick={() => onPeriodChange(value)}
              type="button"
            >
              {t(`leaderboard.period.${value}`)}
            </button>
          ))}
        </div>
      </header>

      {query.isLoading && <LoadingState />}
      {query.isError && (
        <StatePanel
          action={() => void query.refetch()}
          actionLabel={t('leaderboard.states.retry')}
          icon={<RefreshCw aria-hidden="true" size={25} />}
          text={t('leaderboard.states.error')}
        />
      )}
      {!query.isLoading && !query.isError && !firstPage?.class && (
        <StatePanel
          actionLabel={t('leaderboard.noClass.action')}
          icon={<UsersRound aria-hidden="true" size={27} />}
          link="/app/student/classes"
          text={t('leaderboard.noClass.description')}
          title={t('leaderboard.noClass.title')}
        />
      )}
      {firstPage?.class && firstPage.class.studentCount === 0 && (
        <StatePanel
          icon={<UsersRound aria-hidden="true" size={27} />}
          text={t('leaderboard.states.empty')}
        />
      )}

      {firstPage?.class && entries.length > 0 && (
        <>
          <section className={styles.topSection} aria-labelledby="leaderboard-top-title">
            <h3 id="leaderboard-top-title">{t('leaderboard.topTitle')}</h3>
            <div className={styles.podium}>
              {topThree.map((entry) => (
                <LeaderboardTopCard
                  classId={classId}
                  entry={entry}
                  key={entry.id}
                  mode={mode}
                />
              ))}
            </div>
          </section>

          {mode === 'student' && firstPage.selfEntry && !selfIsVisible && (
            <section className={styles.selfPanel} aria-labelledby="leaderboard-self-title">
              <h3 id="leaderboard-self-title">{t('leaderboard.yourPlace')}</h3>
              <LeaderboardRow
                classId={classId}
                entry={firstPage.selfEntry}
                mode={mode}
                period={period}
              />
            </section>
          )}

          <section className={styles.listSection} aria-labelledby="leaderboard-list-title">
            <div className={styles.listHeading}>
              <div>
                <h3 id="leaderboard-list-title">{t('leaderboard.listTitle')}</h3>
                <p>
                  {t('leaderboard.studentCount', {
                    count: firstPage.class.studentCount,
                  })}
                </p>
              </div>
              <span>{t(`leaderboard.period.${period}`)}</span>
            </div>
            <div className={styles.rankingList}>
              {entries.map((entry) => (
                <LeaderboardRow
                  entry={entry}
                  key={entry.id}
                  classId={classId}
                  mode={mode}
                  period={period}
                />
              ))}
            </div>
          </section>

          {query.hasNextPage && (
            <button
              className={styles.loadMore}
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
              type="button"
            >
              {query.isFetchingNextPage
                ? t('leaderboard.states.loadingMore')
                : t('leaderboard.states.loadMore')}
            </button>
          )}
        </>
      )}
    </section>
  )
}

function LeaderboardTopCard({
  classId,
  entry,
  mode,
}: {
  classId?: string
  entry: LeaderboardEntry
  mode: 'student' | 'teacher'
}) {
  const { t } = useTranslation()
  return (
    <Link
      className={styles.topCard}
      data-current={entry.isCurrentUser || undefined}
      data-rank={entry.rank}
      to={entryLink(entry, mode, classId)}
    >
      <span className={styles.rankSeal}>
        <Trophy aria-hidden="true" size={16} />
        {entry.rank}
      </span>
      <Avatar entry={entry} />
      <strong>{entry.displayName}</strong>
      {entry.isCurrentUser && <small>{t('leaderboard.you')}</small>}
      <b>{t('leaderboard.xp', { count: entry.periodXp })}</b>
      <BadgeMiniatures badges={entry.showcase} />
    </Link>
  )
}

function LeaderboardRow({
  classId,
  entry,
  mode,
  period,
}: {
  classId?: string
  entry: LeaderboardEntry
  mode: 'student' | 'teacher'
  period: LeaderboardPeriod
}) {
  const { t } = useTranslation()
  return (
    <Link
      className={styles.rankRow}
      data-current={entry.isCurrentUser || undefined}
      to={entryLink(entry, mode, classId)}
    >
      <strong className={styles.rankNumber}>{entry.rank}</strong>
      <Avatar entry={entry} />
      <span className={styles.studentCopy}>
        <strong>
          {entry.displayName}
          {entry.isCurrentUser && <small>{t('leaderboard.you')}</small>}
        </strong>
        <span>{t('leaderboard.level', { count: entry.level })}</span>
      </span>
      <BadgeMiniatures badges={entry.showcase} />
      <span className={styles.xpCopy}>
        <strong>{t('leaderboard.xp', { count: entry.periodXp })}</strong>
        {period === 'WEEK' && (
          <small>{t('leaderboard.totalXp', { count: entry.totalXp })}</small>
        )}
      </span>
    </Link>
  )
}

function Avatar({ entry }: { entry: LeaderboardEntry }) {
  return (
    <span className={styles.avatar} aria-hidden="true">
      <UserAvatarImage avatarUrl={entry.avatarUrl} displayName={entry.displayName} />
    </span>
  )
}

function BadgeMiniatures({ badges }: { badges: LeaderboardEntry['showcase'] }) {
  const { t } = useTranslation()
  return (
    <span className={styles.badges} aria-label={t('leaderboard.badges')}>
      {badges.length === 0 ? (
        <Award aria-hidden="true" className={styles.emptyBadge} size={16} />
      ) : (
        badges.map((badge) => (
          <span key={badge.id} title={badge.name}>
            <BadgeIcon iconKey={badge.iconKey} size={15} />
          </span>
        ))
      )}
    </span>
  )
}

function LoadingState() {
  const { t } = useTranslation()
  return (
    <div aria-live="polite" className={styles.loading}>
      <span />
      <span />
      <span />
      <p>{t('leaderboard.states.loading')}</p>
    </div>
  )
}

function StatePanel({
  action,
  actionLabel,
  icon,
  link,
  text,
  title,
}: {
  action?: () => void
  actionLabel?: string
  icon: ReactNode
  link?: string
  text: string
  title?: string
}) {
  return (
    <div className={styles.statePanel} role={action ? 'alert' : undefined}>
      {icon}
      {title && <h3>{title}</h3>}
      <p>{text}</p>
      {action && actionLabel && <button onClick={action}>{actionLabel}</button>}
      {link && actionLabel && <Link to={link}>{actionLabel}</Link>}
    </div>
  )
}

function entryLink(
  entry: LeaderboardEntry,
  mode: 'student' | 'teacher',
  classId?: string,
) {
  if (mode === 'teacher') {
    return `/app/teacher/analytics/classes/${classId ?? ''}/students/${entry.id}`
  }
  return entry.isCurrentUser
    ? '/app/student/profile'
    : `/app/student/classmates/${entry.id}`
}

function uniqueEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...new Map(entries.map((entry) => [entry.id, entry])).values()]
}

function formatDate(value: string | Date, language?: string): string {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'uk-UA', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Kyiv',
  }).format(new Date(value))
}
