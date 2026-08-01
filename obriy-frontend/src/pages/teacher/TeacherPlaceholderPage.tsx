import { WorkspacePlaceholderPage } from '../../shared/layout/WorkspacePlaceholderPage'

export type TeacherSection =
  | 'overview'
  | 'classes'
  | 'lessons'
  | 'tasks'
  | 'analytics'
  | 'profile'

export function TeacherPlaceholderPage({
  section,
}: {
  section: TeacherSection
}) {
  return (
    <WorkspacePlaceholderPage
      namespace="teacherWorkspace"
      section={section}
    />
  )
}
