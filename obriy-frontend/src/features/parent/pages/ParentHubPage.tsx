import { useQuery } from '@tanstack/react-query'
import { parentApi } from '../api/parent.api'
import {
  FamilyDashboard,
  ParentEmptyState,
  ParentErrorState,
  ParentLoadingState,
} from '../components/ParentDashboardView'
import { parentQueryKeys } from '../model/parent-query-keys'

export function ParentHubPage() {
  const query = useQuery({
    queryKey: parentQueryKeys.dashboard(),
    queryFn: parentApi.getDashboard,
  })
  if (query.isLoading) return <ParentLoadingState />
  if (query.isError) return <ParentErrorState onRetry={() => void query.refetch()} />
  if (!query.data?.children.length) return <ParentEmptyState />
  return <FamilyDashboard dashboard={query.data} />
}
