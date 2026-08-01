import {
  ChildOverview,
  FamilyOverview,
  ParentDataState,
} from '../components/ParentHubContent'
import { useLinkedChildren } from '../hooks/useLinkedChildren'

export function ParentHubPage() {
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
  return children.length === 1 ? (
    <ChildOverview child={children[0]} children={children} />
  ) : (
    <FamilyOverview children={children} />
  )
}
