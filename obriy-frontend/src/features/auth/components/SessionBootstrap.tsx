import { useEffect, type PropsWithChildren } from 'react'
import { restoreSession } from '../model/session.service'
import { useSessionStore } from '../model/session.store'

export function SessionBootstrap({ children }: PropsWithChildren) {
  const status = useSessionStore((state) => state.status)

  useEffect(() => {
    if (status === 'checking') {
      void restoreSession()
    }
  }, [status])

  return children
}
