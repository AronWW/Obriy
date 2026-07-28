const STORAGE_KEY = 'obriy-email-verification'

export interface VerificationSession {
  email: string
  nextSendAt: number
}

export function rememberVerification(
  email: string,
  retryAfterSeconds = 60,
): VerificationSession {
  const session = {
    email: email.trim().toLowerCase(),
    nextSendAt: Date.now() + Math.max(0, retryAfterSeconds) * 1000,
  }

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  return session
}

export function getVerificationSession(): VerificationSession | null {
  const rawValue = sessionStorage.getItem(STORAGE_KEY)
  if (!rawValue) {
    return null
  }

  try {
    const value: unknown = JSON.parse(rawValue)
    if (!isVerificationSession(value)) {
      clearVerificationSession()
      return null
    }

    return value
  } catch {
    clearVerificationSession()
    return null
  }
}

export function clearVerificationSession(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

function isVerificationSession(value: unknown): value is VerificationSession {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Partial<VerificationSession>
  return (
    typeof candidate.email === 'string' &&
    candidate.email.length > 0 &&
    typeof candidate.nextSendAt === 'number' &&
    Number.isFinite(candidate.nextSendAt)
  )
}
