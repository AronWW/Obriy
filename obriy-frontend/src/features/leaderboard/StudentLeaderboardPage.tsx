import { Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { LeaderboardPanel } from './components/LeaderboardPanel'
import {
  parseLeaderboardPeriod,
  type LeaderboardPeriod,
} from './model/leaderboard.types'
import styles from './Leaderboard.module.css'

export function StudentLeaderboardPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const period = parseLeaderboardPeriod(params.get('period'))
  const setPeriod = (value: LeaderboardPeriod) => {
    const next = new URLSearchParams(params)
    if (value === 'WEEK') next.delete('period')
    else next.set('period', value)
    setParams(next, { replace: true })
  }
  return (
    <main className={styles.page} aria-labelledby="student-leaderboard-title">
      <div className={styles.content}>
        <header className={styles.pageHeader}>
          <span aria-hidden="true"><Trophy size={24} /></span>
          <div>
            <h1 id="student-leaderboard-title">{t('leaderboard.title')}</h1>
            <p>{t('leaderboard.description')}</p>
          </div>
        </header>
        <LeaderboardPanel
          mode="student"
          onPeriodChange={setPeriod}
          period={period}
        />
      </div>
    </main>
  )
}
