import { authorizedRequest } from '../../auth/model/session.service'
import type {
  LinkedChild,
  ParentChildOverview,
  ParentChildProgress,
  ParentDashboard,
} from '../model/parent.types'

export const parentApi = {
  getLinkedChildren: () =>
    authorizedRequest<LinkedChild[]>('/users/me/children'),
  getDashboard: () => authorizedRequest<ParentDashboard>('/parent/dashboard'),
  getChildOverview: (childId: string) =>
    authorizedRequest<ParentChildOverview>(
      `/parent/children/${childId}/overview`,
    ),
  getChildProgress: (childId: string) =>
    authorizedRequest<ParentChildProgress>(
      `/parent/children/${childId}/progress`,
    ),
}
