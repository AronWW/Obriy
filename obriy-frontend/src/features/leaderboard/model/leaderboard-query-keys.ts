import type { LeaderboardPeriod } from './leaderboard.types'

export const leaderboardQueryKeys = {
  student: (period: LeaderboardPeriod) =>
    ['leaderboard', 'student', period] as const,
  teacher: (classId: string, period: LeaderboardPeriod) =>
    ['leaderboard', 'teacher', classId, period] as const,
}
