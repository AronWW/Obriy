import type { UserRole } from './auth.types'

export const roleHomeRoutes = {
  STUDENT: '/app/student',
  TEACHER: '/app/teacher',
  PARENT: '/app/parent',
  ADMIN: '/app/admin',
} satisfies Record<UserRole, string>

export function getRoleHomeRoute(role: UserRole): string {
  return roleHomeRoutes[role]
}
