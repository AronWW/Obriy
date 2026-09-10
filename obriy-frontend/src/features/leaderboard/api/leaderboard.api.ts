import { authorizedRequest } from '../../auth/model/session.service'
import type {
  LeaderboardPage,
  LeaderboardPeriod,
} from '../model/leaderboard.types'

function queryString(period: LeaderboardPeriod, cursor?: string): string {
  const params = new URLSearchParams({ period, limit: '50' })
  if (cursor) params.set('cursor', cursor)
  return params.toString()
}

export function getStudentLeaderboard(
  period: LeaderboardPeriod,
  cursor?: string,
): Promise<LeaderboardPage> {
  return authorizedRequest<LeaderboardPage>(
    `/leaderboard/me?${queryString(period, cursor)}`,
  )
}

export function getTeacherLeaderboard(
  classId: string,
  period: LeaderboardPeriod,
  cursor?: string,
): Promise<LeaderboardPage> {
  return authorizedRequest<LeaderboardPage>(
    `/teacher/leaderboard/classes/${classId}?${queryString(period, cursor)}`,
  )
}
