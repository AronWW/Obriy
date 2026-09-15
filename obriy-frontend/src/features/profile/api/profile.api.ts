import type { AuthMessage, Locale, PrivateProfile } from '../../auth/model/auth.types'
import { authorizedRequest } from '../../auth/model/session.service'

export interface UpdateProfileInput {
  displayName?: string
  bio?: string
  subjectArea?: string
  preferredLocale?: Locale
}

export const profileApi = {
  update(input: UpdateProfileInput): Promise<PrivateProfile> {
    return authorizedRequest<PrivateProfile>('/users/me/profile', {
      method: 'PATCH',
      body: input,
    })
  },

  uploadAvatar(file: Blob): Promise<PrivateProfile> {
    const body = new FormData()
    body.append('avatar', file, 'avatar.webp')
    return authorizedRequest<PrivateProfile>('/users/me/avatar', {
      method: 'PUT',
      body,
    })
  },

  removeAvatar(): Promise<PrivateProfile> {
    return authorizedRequest<PrivateProfile>('/users/me/avatar', {
      method: 'DELETE',
    })
  },

  changePassword(input: {
    currentPassword: string
    newPassword: string
  }): Promise<AuthMessage> {
    return authorizedRequest<AuthMessage>('/auth/change-password', {
      method: 'POST',
      body: input,
    })
  },
}
