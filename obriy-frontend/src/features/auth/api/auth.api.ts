import { apiRequest } from '../../../shared/api/api-client'
import type {
  AuthMessage,
  AuthResponse,
  CompleteGoogleRegistrationInput,
  ForgotPasswordInput,
  LoginInput,
  Locale,
  OAuthExchangeInput,
  RegistrableRole,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  SuspensionContext,
  VerifyEmailInput,
} from '../model/auth.types'
import { API_BASE_URL } from '../../../shared/config/env'

interface GoogleOAuthUrlInput {
  intent: 'LOGIN' | 'REGISTER'
  locale: Locale
  role?: RegistrableRole
}

export const authApi = {
  login(input: LoginInput): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/login', {
      body: input,
      method: 'POST',
    })
  },

  register(input: RegisterInput): Promise<AuthMessage> {
    return apiRequest<AuthMessage>('/auth/register', {
      body: input,
      method: 'POST',
    })
  },

  refresh(): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/refresh', { method: 'POST' })
  },

  logout(): Promise<AuthMessage> {
    return apiRequest<AuthMessage>('/auth/logout', { method: 'POST' })
  },

  resendVerification(input: ResendVerificationInput): Promise<AuthMessage> {
    return apiRequest<AuthMessage>('/auth/resend-verification', {
      body: input,
      method: 'POST',
    })
  },

  verifyEmail(input: VerifyEmailInput): Promise<AuthMessage> {
    return apiRequest<AuthMessage>('/auth/verify-email', {
      body: input,
      method: 'POST',
    })
  },

  forgotPassword(input: ForgotPasswordInput): Promise<AuthMessage> {
    return apiRequest<AuthMessage>('/auth/forgot-password', {
      body: input,
      method: 'POST',
    })
  },

  resetPassword(input: ResetPasswordInput): Promise<AuthMessage> {
    return apiRequest<AuthMessage>('/auth/reset-password', {
      body: input,
      method: 'POST',
    })
  },

  exchangeGoogleCode(input: OAuthExchangeInput): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/google/exchange', {
      body: input,
      method: 'POST',
    })
  },

  completeGoogleRegistration(
    input: CompleteGoogleRegistrationInput,
  ): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/google/complete-registration', {
      body: input,
      method: 'POST',
    })
  },

  getGoogleOAuthUrl(input: GoogleOAuthUrlInput): string {
    const url = new URL(`${API_BASE_URL}/auth/google`)
    url.searchParams.set('intent', input.intent)
    url.searchParams.set('locale', input.locale)
    if (input.role) {
      url.searchParams.set('role', input.role)
    }

    return url.toString()
  },

  suspensionContext(suspensionAccessToken: string): Promise<SuspensionContext> {
    return apiRequest<SuspensionContext>('/auth/suspension-context', {
      method: 'POST',
      body: { suspensionAccessToken },
    })
  },

  submitSuspensionAppeal(
    suspensionAccessToken: string,
    message: string,
  ): Promise<SuspensionContext> {
    return apiRequest<SuspensionContext>('/auth/suspension-appeals', {
      method: 'POST',
      body: { suspensionAccessToken, message },
    })
  },
}
