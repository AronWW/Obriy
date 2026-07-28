import { Navigate, Outlet } from 'react-router-dom'
import { useSessionStore } from '../model/session.store'
import { RouteStatus } from './RouteStatus'

export function PublicOnlyRoute() {
  const status = useSessionStore((state) => state.status)

  if (status === 'checking') {
    return <RouteStatus />
  }

  return status === 'authenticated' ? <Navigate to="/app" replace /> : <Outlet />
}
