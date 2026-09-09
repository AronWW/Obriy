import type { StudentTasksFilters } from './student-workspace.types'

export const studentWorkspaceQueryKeys = {
  root: ['student-workspace'] as const,
  dashboard: () => [...studentWorkspaceQueryKeys.root, 'dashboard'] as const,
  tasks: (filters: StudentTasksFilters) =>
    [...studentWorkspaceQueryKeys.root, 'tasks', filters] as const,
}
