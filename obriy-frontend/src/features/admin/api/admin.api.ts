import { authorizedRequest } from '../../auth/model/session.service'
import type { AdminAuditLog, AdminClass, AdminClassDetail, AdminDashboard, AdminSuspensionAppeal, AdminUser, CursorPage, LessonModerationCase } from '../model/admin.types'

function queryString(values: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => { if (value) query.set(key, value) })
  const result = query.toString()
  return result ? `?${result}` : ''
}

export const adminApi = {
  dashboard: () => authorizedRequest<AdminDashboard>('/admin/dashboard'),
  users: (filters: Record<string, string | undefined>) => authorizedRequest<CursorPage<AdminUser>>(`/admin/users${queryString(filters)}`),
  user: (id: string) => authorizedRequest<AdminUser>(`/admin/users/${id}`),
  suspend: (id: string, reason: string) => authorizedRequest<AdminUser>(`/admin/users/${id}/suspend`, { method: 'POST', body: { reason } }),
  restore: (id: string, reason: string) => authorizedRequest<AdminUser>(`/admin/users/${id}/restore`, { method: 'POST', body: { reason } }),
  classes: (filters: Record<string, string | undefined>) => authorizedRequest<CursorPage<AdminClass>>(`/admin/classes${queryString(filters)}`),
  classDetail: (id: string) => authorizedRequest<AdminClassDetail>(`/admin/classes/${id}`),
  moderation: (filters: Record<string, string | undefined>) => authorizedRequest<CursorPage<LessonModerationCase>>(`/admin/moderation/lessons${queryString(filters)}`),
  moderationCase: (id: string) => authorizedRequest<LessonModerationCase>(`/admin/moderation/lessons/${id}`),
  moderate: (id: string, action: string, reason: string, expectedEditVersion: number) =>
    authorizedRequest<LessonModerationCase>(`/admin/moderation/lessons/${id}/${action}`, { method: 'POST', body: { reason, expectedEditVersion } }),
  audit: (filters: Record<string, string | undefined>) => authorizedRequest<CursorPage<AdminAuditLog>>(`/admin/audit-logs${queryString(filters)}`),
  appeals: (filters: Record<string, string | undefined>) => authorizedRequest<CursorPage<AdminSuspensionAppeal>>(`/admin/suspension-appeals${queryString(filters)}`),
  appeal: (id: string) => authorizedRequest<AdminSuspensionAppeal>(`/admin/suspension-appeals/${id}`),
  resolveAppeal: (id: string, action: 'approve' | 'reject', resolutionNote: string) =>
    authorizedRequest<AdminSuspensionAppeal>(`/admin/suspension-appeals/${id}/${action}`, { method: 'POST', body: { resolutionNote } }),
}
