import { useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router-dom'
import {
  ChildProgressView,
  ParentErrorState,
  ParentLoadingState,
} from '../components/ParentDashboardView'
import { parentApi } from '../api/parent.api'
import { parentQueryKeys } from '../model/parent-query-keys'

export function ParentProgressPage() {
  const { childId } = useParams()
  if (!childId) return <Navigate to="/app/parent" replace />
  return <ParentProgressContent childId={childId} />
}

function ParentProgressContent({ childId }: { childId: string }) {
  const dashboard = useQuery({ queryKey: parentQueryKeys.dashboard(), queryFn: parentApi.getDashboard })
  const progress = useQuery({ queryKey: parentQueryKeys.progress(childId), queryFn: () => parentApi.getChildProgress(childId), retry: false })
  if (dashboard.isLoading || progress.isLoading) return <ParentLoadingState />
  if (dashboard.isError || progress.isError) return <ParentErrorState onRetry={() => { void dashboard.refetch(); void progress.refetch() }} />
  if (!dashboard.data || !progress.data) return <Navigate to="/app/parent" replace />
  return <ChildProgressView progress={progress.data} children={dashboard.data.children} />
}
