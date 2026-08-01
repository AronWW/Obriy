import { authorizedRequest } from '../../auth/model/session.service'
import type { LinkedChild } from '../../parent/model/parent.types'
import type {
  ActiveParentInvitation,
  LinkedGuardian,
  ParentInvitation,
  ParentInvitationPreview,
} from '../model/parent-link.types'

export const parentLinksApi = {
  listGuardians: () =>
    authorizedRequest<LinkedGuardian[]>('/parent-links/me/guardians'),
  getActiveInvitation: () =>
    authorizedRequest<ActiveParentInvitation | null>(
      '/parent-links/invitation',
    ),
  createInvitation: () =>
    authorizedRequest<ParentInvitation>('/parent-links/invitation', {
      method: 'POST',
    }),
  revokeInvitation: () =>
    authorizedRequest<void>('/parent-links/invitation', {
      method: 'DELETE',
    }),
  previewInvitation: (token: string) =>
    authorizedRequest<ParentInvitationPreview>(
      '/parent-links/invitation/preview',
      { method: 'POST', body: { token } },
    ),
  acceptInvitation: (token: string) =>
    authorizedRequest<LinkedChild>('/parent-links/invitation/accept', {
      method: 'POST',
      body: { token },
    }),
  unlinkGuardian: (parentId: string) =>
    authorizedRequest<void>(`/parent-links/guardians/${parentId}`, {
      method: 'DELETE',
    }),
  unlinkChild: (childId: string) =>
    authorizedRequest<void>(`/parent-links/children/${childId}`, {
      method: 'DELETE',
    }),
}
