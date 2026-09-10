import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import confetti from 'canvas-confetti'
import { Award, Sparkles, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../../auth/model/session.store'
import {
  acknowledgeGamificationRewards,
  getUnseenGamificationRewards,
} from '../api/gamification.api'
import { gamificationQueryKeys } from '../model/gamification-query-keys'
import type { UnseenGamificationRewards } from '../model/gamification.types'
import styles from '../Gamification.module.css'

export function GamificationRewardNotifier() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const role = useSessionStore((state) => state.user?.role)
  const reducedMotion = useReducedMotion()
  const [visibleReward, setVisibleReward] =
    useState<UnseenGamificationRewards | null>(null)
  const handled = useRef('')
  const query = useQuery({
    queryKey: gamificationQueryKeys.unseen(),
    queryFn: getUnseenGamificationRewards,
    enabled: role === 'STUDENT',
    staleTime: 30_000,
  })
  const acknowledge = useMutation({
    mutationFn: acknowledgeGamificationRewards,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gamificationQueryKeys.me() })
      void queryClient.invalidateQueries({ queryKey: gamificationQueryKeys.unseen() })
    },
  })

  useEffect(() => {
    const reward = query.data
    if (!reward || (reward.xp.length === 0 && reward.badges.length === 0)) return
    const key = `${reward.xp.map((item) => item.id).join(',')}|${reward.badges
      .map((item) => item.id)
      .join(',')}`
    if (handled.current === key) return
    handled.current = key
    setVisibleReward(reward)
    acknowledge.mutate({
      xpLedgerIds: reward.xp.map((item) => item.id),
      userBadgeIds: reward.badges.map((item) => item.id),
    })
    const hasCelebration =
      reward.badges.length > 0 ||
      reward.xp.some((item) => item.levelAfter > item.levelBefore)
    if (hasCelebration && !reducedMotion) {
      void confetti({
        particleCount: 70,
        spread: 62,
        origin: { y: 0.78 },
        colors: ['#d5a255', '#3b78a6', '#f4e6c9'],
      })
    }
  }, [acknowledge, query.data, reducedMotion])

  const summary = useMemo(() => {
    if (!visibleReward) return null
    const xp = visibleReward.xp.reduce((sum, item) => sum + item.amount, 0)
    return {
      xp,
      badgeCount: visibleReward.badges.length,
      levelUp: visibleReward.xp.some(
        (item) => item.levelAfter > item.levelBefore,
      ),
    }
  }, [visibleReward])

  return (
    <AnimatePresence>
      {visibleReward && summary && (
        <motion.aside
          animate={{ opacity: 1, y: 0 }}
          aria-live="polite"
          className={styles.rewardToast}
          exit={{ opacity: 0, y: 16 }}
          initial={reducedMotion ? false : { opacity: 0, y: 18 }}
        >
          {visibleReward.badges.length > 0 ? (
            <Award aria-hidden="true" size={25} />
          ) : (
            <Sparkles aria-hidden="true" size={25} />
          )}
          <div>
            <strong>
              {summary.badgeCount > 0
                ? t('gamification.rewards.badges', {
                    count: summary.badgeCount,
                  })
                : summary.levelUp
                  ? t('gamification.rewards.levelUp')
                  : t('gamification.rewards.xpTitle')}
            </strong>
            <span>
              {summary.xp > 0
                ? t('gamification.rewards.xpEarned', { count: summary.xp })
                : visibleReward.badges.map((item) => item.badge.name).join(', ')}
            </span>
          </div>
          <button
            aria-label={t('gamification.rewards.close')}
            className={styles.iconButton}
            onClick={() => setVisibleReward(null)}
            type="button"
          >
            <X size={17} />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
