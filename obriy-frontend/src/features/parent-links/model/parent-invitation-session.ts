const STORAGE_KEY = 'obriy-parent-invitation'
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const LOCAL_LIFETIME_MS = 24 * 60 * 60 * 1000

interface StoredParentInvitation {
  token: string
  storedAt: number
}

export function rememberParentInvitation(token: string): boolean {
  if (!TOKEN_PATTERN.test(token)) {
    return false
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ token, storedAt: Date.now() } satisfies StoredParentInvitation),
  )
  return true
}

export function getPendingParentInvitation(): string | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const value: unknown = JSON.parse(raw)
    if (!isStoredInvitation(value)) {
      clearPendingParentInvitation()
      return null
    }

    if (Date.now() - value.storedAt >= LOCAL_LIFETIME_MS) {
      clearPendingParentInvitation()
      return null
    }

    return value.token
  } catch {
    clearPendingParentInvitation()
    return null
  }
}

export function clearPendingParentInvitation(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function hasPendingParentInvitation(): boolean {
  return getPendingParentInvitation() !== null
}

function isStoredInvitation(value: unknown): value is StoredParentInvitation {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.token === 'string' &&
    TOKEN_PATTERN.test(candidate.token) &&
    typeof candidate.storedAt === 'number' &&
    Number.isFinite(candidate.storedAt)
  )
}
