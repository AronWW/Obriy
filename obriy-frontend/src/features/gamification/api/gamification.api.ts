import { authorizedRequest } from '../../auth/model/session.service'
import type {
  GamificationProfile,
  StudentAchievements,
  UnseenGamificationRewards,
} from '../model/gamification.types'

export function getMyGamification(): Promise<GamificationProfile> {
  return authorizedRequest<GamificationProfile>('/gamification/me')
}

export function getMyAchievements(): Promise<StudentAchievements> {
  return authorizedRequest<StudentAchievements>(
    '/gamification/me/achievements',
  )
}

export function updateBadgeShowcase(
  badgeIds: string[],
): Promise<GamificationProfile> {
  return authorizedRequest<GamificationProfile>('/gamification/me/showcase', {
    method: 'PATCH',
    body: { badgeIds },
  })
}

export function getUnseenGamificationRewards(): Promise<UnseenGamificationRewards> {
  return authorizedRequest<UnseenGamificationRewards>(
    '/gamification/me/rewards/unseen',
  )
}

export function acknowledgeGamificationRewards(input: {
  xpLedgerIds: string[]
  userBadgeIds: string[]
}): Promise<void> {
  return authorizedRequest<void>('/gamification/me/rewards/acknowledge', {
    method: 'POST',
    body: input,
  })
}
