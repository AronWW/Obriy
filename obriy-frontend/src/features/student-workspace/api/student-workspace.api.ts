import { authorizedRequest } from '../../auth/model/session.service'
import type {
  StudentDashboard,
  StudentTasksFilters,
  StudentTasksPage,
} from '../model/student-workspace.types'

export function getStudentDashboard(): Promise<StudentDashboard> {
  return authorizedRequest<StudentDashboard>('/student/dashboard')
}

export function getStudentTasks(
  filters: StudentTasksFilters,
  cursor?: string,
): Promise<StudentTasksPage> {
  const params = new URLSearchParams()
  if (filters.status !== 'ALL') params.set('status', filters.status)
  if (filters.required !== 'ALL') params.set('required', filters.required)
  if (filters.search) params.set('search', filters.search)
  if (cursor) params.set('cursor', cursor)
  params.set('limit', '20')
  return authorizedRequest<StudentTasksPage>(`/student/tasks?${params}`)
}
