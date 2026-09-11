import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Award, CheckCircle2, LockKeyhole, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../auth/model/session.store'
import {
  getMyAchievements,
  updateBadgeShowcase,
} from './api/gamification.api'
import { BadgeCollectionDialog } from './components/BadgeCollectionDialog'
import { BadgeIcon } from './components/BadgeIcon'
import { BadgeShowcase } from './components/BadgeShowcase'
import { GamificationProgressCard } from './components/GamificationProgressCard'
import { gamificationQueryKeys } from './model/gamification-query-keys'
import type {
  AchievementBadge,
  AchievementBadgeStatus,
  EarnedBadge,
} from './model/gamification.types'
import styles from './StudentAchievementsPage.module.css'

type CollectionFilter = 'ALL' | AchievementBadgeStatus

const filters: CollectionFilter[] = ['ALL', 'EARNED', 'LOCKED']

export function StudentAchievementsPage() {
  const { i18n, t } = useTranslation()
  const user = useSessionStore((state) => state.user)
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<CollectionFilter>('ALL')
  const [showcaseOpen, setShowcaseOpen] = useState(false)
  const query = useQuery({
    queryKey: gamificationQueryKeys.achievements(),
    queryFn: getMyAchievements,
    enabled: Boolean(user),
  })
  const showcaseMutation = useMutation({
    mutationFn: updateBadgeShowcase,
    onSuccess: (profile) => {
      queryClient.setQueryData(gamificationQueryKeys.me(), profile)
      void queryClient.invalidateQueries({
        queryKey: gamificationQueryKeys.achievements(),
      })
      setShowcaseOpen(false)
    },
  })
  const filteredBadges = useMemo(
    () =>
      query.data?.badges.filter(
        (badge) => filter === 'ALL' || badge.status === filter,
      ) ?? [],
    [filter, query.data?.badges],
  )
  const earnedBadges = useMemo(
    () =>
      query.data?.badges
        .filter((badge) => badge.status === 'EARNED')
        .map(toEarnedBadge) ?? [],
    [query.data?.badges],
  )
  const dateLocale = i18n.language === 'en' ? 'en-GB' : 'uk-UA'

  return (
    <main className={styles.page} aria-labelledby="student-achievements-title">
      <div className={styles.content}>
        <header className={styles.pageHeader}>
          <div>
            <h1 id="student-achievements-title">
              {t('achievements.title')}
            </h1>
            <p>{t('achievements.description')}</p>
          </div>
        </header>

        {query.isLoading && <StatePanel text={t('achievements.states.loading')} />}
        {query.isError && (
          <StatePanel
            action={() => void query.refetch()}
            actionLabel={t('achievements.states.retry')}
            text={t('achievements.states.error')}
          />
        )}

        {query.data && (
          <>
            <section className={styles.summary} aria-label={t('achievements.summary.label')}>
              <GamificationProgressCard progress={query.data.progress} />
              <div className={styles.collectionSummary}>
                <Award aria-hidden="true" size={25} />
                <strong>
                  {t('achievements.summary.value', {
                    earned: query.data.summary.earnedCount,
                    total: query.data.summary.totalCount,
                  })}
                </strong>
                <span>{t('achievements.summary.caption')}</span>
              </div>
            </section>

            <section className={styles.section} aria-labelledby="achievement-showcase-title">
              <div className={styles.sectionHeader}>
                <div>
                  <h2 id="achievement-showcase-title">
                    {t('achievements.showcase.title')}
                  </h2>
                  <p>{t('achievements.showcase.description')}</p>
                </div>
                <button
                  disabled={earnedBadges.length === 0}
                  onClick={() => setShowcaseOpen(true)}
                  type="button"
                >
                  <SlidersHorizontal aria-hidden="true" size={16} />
                  {t('achievements.showcase.action')}
                </button>
              </div>
              <BadgeShowcase badges={query.data.showcase} />
            </section>

            <section className={styles.section} aria-labelledby="achievement-collection-title">
              <div className={styles.collectionHeader}>
                <div>
                  <h2 id="achievement-collection-title">
                    {t('achievements.collection.title')}
                  </h2>
                  <p>{t('achievements.collection.description')}</p>
                </div>
                <div className={styles.filters} aria-label={t('achievements.filters.label')}>
                  {filters.map((value) => (
                    <button
                      aria-pressed={filter === value}
                      key={value}
                      onClick={() => setFilter(value)}
                      type="button"
                    >
                      {t(`achievements.filters.${value}`)}
                    </button>
                  ))}
                </div>
              </div>

              {query.data.badges.length === 0 ? (
                <p className={styles.empty}>{t('achievements.states.noBadges')}</p>
              ) : filteredBadges.length === 0 ? (
                <p className={styles.empty}>{t('achievements.states.noMatches')}</p>
              ) : (
                <div className={styles.badgeGrid}>
                  {filteredBadges.map((badge) => (
                    <AchievementCard
                      badge={badge}
                      dateLocale={dateLocale}
                      key={badge.id}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {showcaseOpen && query.data && (
        <BadgeCollectionDialog
          badges={earnedBadges}
          isSaving={showcaseMutation.isPending}
          onClose={() => setShowcaseOpen(false)}
          onSave={(badgeIds) => showcaseMutation.mutate(badgeIds)}
          selectedIds={query.data.showcase.map((badge) => badge.id)}
        />
      )}
    </main>
  )
}

function AchievementCard({
  badge,
  dateLocale,
}: {
  badge: AchievementBadge
  dateLocale: string
}) {
  const { t } = useTranslation()
  const earned = badge.status === 'EARNED'
  return (
    <article className={styles.badgeCard} data-status={badge.status}>
      <div className={styles.badgeMark}>
        <BadgeIcon iconKey={badge.iconKey} size={28} />
      </div>
      <div className={styles.badgeCopy}>
        <div className={styles.badgeTitle}>
          <h3>{badge.name}</h3>
          {earned ? (
            <CheckCircle2 aria-label={t('achievements.badge.earned')} size={18} />
          ) : (
            <LockKeyhole aria-label={t('achievements.badge.locked')} size={17} />
          )}
        </div>
        <p>{badge.description}</p>
        {earned && badge.earnedAt ? (
          <time dateTime={badge.earnedAt}>
            {t('achievements.badge.earnedAt', {
              date: new Intl.DateTimeFormat(dateLocale, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(new Date(badge.earnedAt)),
            })}
          </time>
        ) : (
          <div className={styles.badgeProgress}>
            <div>
              <span>{t('achievements.badge.progress')}</span>
              <strong>
                {badge.progress.current}/{badge.progress.target}
              </strong>
            </div>
            <div
              aria-label={t('achievements.badge.progressLabel', {
                name: badge.name,
              })}
              aria-valuemax={badge.progress.target}
              aria-valuemin={0}
              aria-valuenow={badge.progress.current}
              className={styles.progressTrack}
              role="progressbar"
            >
              <span style={{ width: `${badge.progress.percent}%` }} />
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

function StatePanel({
  action,
  actionLabel,
  text,
}: {
  action?: () => void
  actionLabel?: string
  text: string
}) {
  return (
    <div className={styles.statePanel} role={action ? 'alert' : 'status'}>
      <p>{text}</p>
      {action && actionLabel && (
        <button onClick={action} type="button">
          {actionLabel}
        </button>
      )}
    </div>
  )
}

function toEarnedBadge(badge: AchievementBadge): EarnedBadge {
  return {
    id: badge.id,
    key: badge.key,
    iconKey: badge.iconKey,
    name: badge.name,
    description: badge.description,
    earnedAt: badge.earnedAt ?? '',
    showcasePosition: badge.showcasePosition,
  }
}
