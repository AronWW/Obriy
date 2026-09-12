import { useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router-dom'
import { parentApi } from '../api/parent.api'
import {
  ChildOverviewView,
  ParentErrorState,
  ParentLoadingState,
} from '../components/ParentDashboardView'
import { parentQueryKeys } from '../model/parent-query-keys'

export function ParentChildPage() {
  const { childId } = useParams()
  if (!childId) return <Navigate to="/app/parent" replace />
  return <ChildOverviewPageContent childId={childId} />
}

function ChildOverviewPageContent({ childId }: { childId: string }) {
  const dashboard = useQuery({ queryKey: parentQueryKeys.dashboard(), queryFn: parentApi.getDashboard })
  const overview = useQuery({ queryKey: parentQueryKeys.overview(childId), queryFn: () => parentApi.getChildOverview(childId), retry: false })
  if (dashboard.isLoading || overview.isLoading) return <ParentLoadingState />
  if (dashboard.isError || overview.isError) return <ParentErrorState onRetry={() => { void dashboard.refetch(); void overview.refetch() }} />
  if (!dashboard.data || !overview.data) return <Navigate to="/app/parent" replace />
  return <ChildOverviewView overview={overview.data} children={dashboard.data.children} />
}
