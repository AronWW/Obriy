export const parentQueryKeys = {
  root: ['parent-dashboard'] as const,
  dashboard: () => [...parentQueryKeys.root, 'dashboard'] as const,
  overview: (childId: string) =>
    [...parentQueryKeys.root, 'overview', childId] as const,
  progress: (childId: string) =>
    [...parentQueryKeys.root, 'progress', childId] as const,
}
