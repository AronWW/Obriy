import { useSearchParams } from 'react-router-dom'
import { LeaderboardPanel } from './components/LeaderboardPanel'
import {
  parseLeaderboardPeriod,
  type LeaderboardPeriod,
} from './model/leaderboard.types'

export function TeacherLeaderboardTab({ classId }: { classId: string }) {
  const [params, setParams] = useSearchParams()
  const period = parseLeaderboardPeriod(params.get('period'))
  const setPeriod = (value: LeaderboardPeriod) => {
    const next = new URLSearchParams(params)
    if (value === 'WEEK') next.delete('period')
    else next.set('period', value)
    setParams(next, { replace: true })
  }
  return (
    <LeaderboardPanel
      classId={classId}
      mode="teacher"
      onPeriodChange={setPeriod}
      period={period}
    />
  )
}
