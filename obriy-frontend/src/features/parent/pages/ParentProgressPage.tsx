import { Navigate, useParams } from 'react-router-dom'
import {
  ParentDataState,
  ProgressPlaceholder,
} from '../components/ParentHubContent'
import { useLinkedChildren } from '../hooks/useLinkedChildren'

export function ParentProgressPage() {
  const { childId } = useParams()
  const childrenQuery = useLinkedChildren()
  if (
    childrenQuery.isLoading ||
    childrenQuery.isError ||
    !childrenQuery.data?.length
  ) {
    return (
      <ParentDataState
        isLoading={childrenQuery.isLoading}
        isError={childrenQuery.isError}
        onRetry={() => void childrenQuery.refetch()}
        children={childrenQuery.data}
      />
    )
  }
  const children = childrenQuery.data ?? []
  const child = children.find((entry) => entry.id === childId)
  return child ? (
    <ProgressPlaceholder child={child} children={children} />
  ) : (
    <Navigate to="/app/parent" replace />
  )
}
