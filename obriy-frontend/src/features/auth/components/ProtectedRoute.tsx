import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSessionStore } from '../model/session.store'
import { RouteStatus } from './RouteStatus'

export function ProtectedRoute() {
  const location = useLocation()
  const status = useSessionStore((state) => state.status)

  if (status === 'checking') {
    return <RouteStatus />
  }

  if (status === 'anonymous') {
    const from = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/auth/login" replace state={{ from }} />
  }

  return <Outlet />
}
