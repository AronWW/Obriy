import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { GamificationProgress } from '../model/gamification.types'
import styles from '../Gamification.module.css'

export function GamificationProgressCard({
  compact = false,
  progress,
}: {
  compact?: boolean
  progress: GamificationProgress
}) {
  const { t } = useTranslation()
  const percent = Math.min(
    100,
    Math.round((progress.xpIntoLevel / progress.xpForNextLevel) * 100),
  )
  return (
    <section
      className={compact ? styles.progressCompact : styles.progressCard}
      aria-label={t('gamification.progress.label')}
    >
      <div className={styles.levelMedallion}>
        <Sparkles aria-hidden="true" size={compact ? 14 : 18} />
        <strong>{progress.level}</strong>
        <span>{t('gamification.progress.level')}</span>
      </div>
      <div className={styles.progressCopy}>
        <div>
          <strong>
            {t('gamification.progress.totalXp', { count: progress.totalXp })}
          </strong>
          <span>
            {t('gamification.progress.toNext', {
              count: progress.nextLevelXp - progress.totalXp,
            })}
          </span>
        </div>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.xpForNextLevel}
          aria-valuenow={progress.xpIntoLevel}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
    </section>
  )
}
