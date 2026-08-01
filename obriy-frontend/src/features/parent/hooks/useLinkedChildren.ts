import { useQuery } from '@tanstack/react-query'
import { parentApi } from '../api/parent.api'

export const linkedChildrenQueryKey = ['parent', 'linked-children'] as const

export function useLinkedChildren() {
  return useQuery({
    queryKey: linkedChildrenQueryKey,
    queryFn: parentApi.getLinkedChildren,
  })
}
