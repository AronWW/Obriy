import type { PrivateProfile } from '../../auth/model/auth.types'
import { authorizedRequest } from '../../auth/model/session.service'

export interface UpdateTeacherProfileInput {
  displayName: string
  subjectArea: string
  bio: string
}

/**
 * The profile endpoint accepts a partial `UpdateMyProfileDto`.  This feature
 * deliberately sends only the teacher-facing fields, so it cannot overwrite
 * locale or avatar settings owned by another flow.
 */
export function updateTeacherProfile(
  input: UpdateTeacherProfileInput,
): Promise<PrivateProfile> {
  return authorizedRequest<PrivateProfile>('/users/me/profile', {
    method: 'PATCH',
    body: input,
  })
}
