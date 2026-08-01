import { Navigate, Outlet } from 'react-router-dom'
import type { UserRole } from '../model/auth.types'
import { getRoleHomeRoute } from '../model/role-routes'
import { useSessionStore } from '../model/session.store'
import { hasPendingParentInvitation } from '../../parent-links/model/parent-invitation-session'

export function RoleHomeRedirect() {
  const role = useSessionStore((state) => state.user?.role)

  if (role === 'PARENT' && hasPendingParentInvitation()) {
    return <Navigate to="/app/parent/connect" replace />
  }

  return role ? (
    <Navigate to={getRoleHomeRoute(role)} replace />
  ) : (
    <Navigate to="/" replace />
  )
}

export function RoleRoute({ role }: { role: UserRole }) {
  const currentRole = useSessionStore((state) => state.user?.role)

  if (!currentRole) {
    return <Navigate to="/" replace />
  }

  return currentRole === role ? (
    <Outlet />
  ) : (
    <Navigate to={getRoleHomeRoute(currentRole)} replace />
  )
}
