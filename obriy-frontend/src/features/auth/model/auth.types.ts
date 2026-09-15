export type UserRole = 'STUDENT' | 'TEACHER' | 'PARENT' | 'ADMIN'
export type RegistrableRole = Exclude<UserRole, 'ADMIN'>
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED'
export type Locale = 'UK' | 'EN'

export interface PrivateProfile {
  id: string
  email: string
  role: UserRole
  status: UserStatus
  emailVerifiedAt: string | null
  hasPassword: boolean
  profile: {
    displayName: string
    avatarUrl: string | null
    bio: string | null
    subjectArea: string | null
    preferredLocale: Locale
  }
}

export interface AuthResponse {
  accessToken: string
  user: PrivateProfile
}

export interface AuthMessage {
  code: string
  message: string
  email?: string
  retryAfterSeconds?: number
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  displayName: string
  email: string
  password: string
  preferredLocale: Locale
  role: RegistrableRole
}

export interface ResendVerificationInput {
  email: string
}

export interface VerifyEmailInput {
  token: string
}

export interface ForgotPasswordInput {
  email: string
}

export interface ResetPasswordInput {
  token: string
  password: string
}

export interface OAuthExchangeInput {
  code: string
}

export interface CompleteGoogleRegistrationInput {
  code: string
  preferredLocale: Locale
  role: RegistrableRole
}
