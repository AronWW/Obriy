export interface GamificationProgress {
  totalXp: number
  level: number
  levelStartXp: number
  nextLevelXp: number
  xpIntoLevel: number
  xpForNextLevel: number
}

export interface EarnedBadge {
  id: string
  key: string
  iconKey: string
  name: string
  description: string
  earnedAt: string
  showcasePosition: number | null
}

export interface GamificationProfile {
  progress: GamificationProgress
  showcase: EarnedBadge[]
  badges: EarnedBadge[]
}

export interface XPAward {
  id: string
  amount: number
  totalXpBefore: number
  totalXpAfter: number
  levelBefore: number
  levelAfter: number
  createdAt: string
}

export interface BadgeAward {
  id: string
  badge: EarnedBadge
}

export interface GamificationReward {
  xp: XPAward | null
  badges: BadgeAward[]
}

export interface UnseenGamificationRewards {
  xp: XPAward[]
  badges: BadgeAward[]
}
