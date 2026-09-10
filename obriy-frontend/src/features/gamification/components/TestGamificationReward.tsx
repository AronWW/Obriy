import confetti from 'canvas-confetti'
import { Award, Sparkles } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { GamificationReward } from '../model/gamification.types'
import styles from '../Gamification.module.css'

export function TestGamificationReward({ reward }: { reward: GamificationReward }) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const levelUp = Boolean(
    reward.xp && reward.xp.levelAfter > reward.xp.levelBefore,
  )
  useEffect(() => {
    if (reducedMotion || (!levelUp && reward.badges.length === 0)) return
    void confetti({
      particleCount: 70,
      spread: 62,
      origin: { y: 0.72 },
      colors: ['#d5a255', '#3b78a6', '#f4e6c9'],
    })
  }, [levelUp, reducedMotion, reward.badges.length])
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={styles.resultReward}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
    >
      {reward.badges.length > 0 ? <Award size={20} /> : <Sparkles size={20} />}
      <div>
        {reward.xp && (
          <strong>
            {t('gamification.rewards.xpEarned', { count: reward.xp.amount })}
          </strong>
        )}
        {levelUp && (
          <span>
            {t('gamification.rewards.levelReached', {
              count: reward.xp?.levelAfter ?? 1,
            })}
          </span>
        )}
        {reward.badges.map((item) => (
          <span key={item.id}>
            {t('gamification.rewards.badgeUnlocked', {
              name: item.badge.name,
            })}
          </span>
        ))}
      </div>
    </motion.div>
  )
}
