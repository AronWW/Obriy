import type { PrivateProfile } from '../../auth/model/auth.types'
import { authorizedRequest } from '../../auth/model/session.service'

export interface UpdateStudentProfileInput {
  displayName: string
  bio: string
}

export function updateStudentProfile(
  input: UpdateStudentProfileInput,
): Promise<PrivateProfile> {
  return authorizedRequest<PrivateProfile>('/users/me/profile', {
    method: 'PATCH',
    body: input,
  })
}
