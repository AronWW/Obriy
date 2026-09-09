import { authorizedRequest } from '../../auth/model/session.service'
import type { TeacherDashboard } from '../model/teacher-dashboard.types'

export function getTeacherDashboard(): Promise<TeacherDashboard> {
  return authorizedRequest<TeacherDashboard>('/teacher/dashboard')
}
