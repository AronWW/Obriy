import { useEffect, useState } from 'react'

export function useCountdown(targetTime: number): number {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (getRemainingSeconds(targetTime) === 0) {
      return
    }

    const interval = window.setInterval(() => {
      setTick((tick) => tick + 1)

      if (getRemainingSeconds(targetTime) === 0) {
        window.clearInterval(interval)
      }
    }, 500)

    return () => window.clearInterval(interval)
  }, [targetTime])

  return getRemainingSeconds(targetTime)
}

function getRemainingSeconds(targetTime: number): number {
  return Math.max(0, Math.ceil((targetTime - Date.now()) / 1000))
}
