import { WorkspacePlaceholderPage } from '../../shared/layout/WorkspacePlaceholderPage'

export type StudentSection =
  | 'overview'
  | 'classes'
  | 'tasks'
  | 'achievements'
  | 'leaderboard'
  | 'profile'

export function StudentPlaceholderPage({
  section,
}: {
  section: StudentSection
}) {
  return (
    <WorkspacePlaceholderPage
      namespace="studentPlaceholder"
      section={section}
    />
  )
}
