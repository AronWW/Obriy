import type { EarnedBadge } from '../../gamification/model/gamification.types'

export type LeaderboardPeriod = 'WEEK' | 'ALL_TIME'

export function parseLeaderboardPeriod(value: string | null): LeaderboardPeriod {
  return value === 'ALL_TIME' ? 'ALL_TIME' : 'WEEK'
}

export interface LeaderboardEntry {
  rank: number
  id: string
  displayName: string
  avatarUrl: string | null
  periodXp: number
  totalXp: number
  level: number
  showcase: EarnedBadge[]
  lastXpAt: string | null
  isCurrentUser: boolean
}

export interface LeaderboardPage {
  class: { id: string; name: string; studentCount: number } | null
  period: {
    type: LeaderboardPeriod
    startAt: string | null
    endAt: string | null
  }
  entries: LeaderboardEntry[]
  selfEntry: LeaderboardEntry | null
  nextCursor: string | null
}
