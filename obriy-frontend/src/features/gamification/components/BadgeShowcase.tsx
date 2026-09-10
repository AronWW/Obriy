import { Award } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { EarnedBadge } from '../model/gamification.types'
import { BadgeIcon } from './BadgeIcon'
import styles from '../Gamification.module.css'

export function BadgeShowcase({ badges }: { badges: EarnedBadge[] }) {
  const { t } = useTranslation()
  return (
    <div className={styles.showcase} aria-label={t('gamification.badges.showcaseLabel')}>
      {[0, 1, 2].map((index) => {
        const badge = badges[index]
        return badge ? (
          <div className={styles.showcaseBadge} key={badge.id} title={badge.description}>
            <BadgeIcon iconKey={badge.iconKey} />
            <small>{badge.name}</small>
          </div>
        ) : (
          <div className={styles.showcaseEmpty} key={`empty-${index}`}>
            <Award aria-hidden="true" size={22} />
          </div>
        )
      })}
    </div>
  )
}
