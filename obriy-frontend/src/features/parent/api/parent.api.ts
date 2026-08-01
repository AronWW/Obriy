import { authorizedRequest } from '../../auth/model/session.service'
import type { LinkedChild } from '../model/parent.types'

export const parentApi = {
  getLinkedChildren: () =>
    authorizedRequest<LinkedChild[]>('/users/me/children'),
}
