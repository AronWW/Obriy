const SESSION_HINT_KEY = 'obriy-has-session'

export function hasSessionHint(): boolean {
  try {
    return getStorage()?.getItem(SESSION_HINT_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberSessionHint(): void {
  try {
    getStorage()?.setItem(SESSION_HINT_KEY, '1')
  } catch {
    // Storage can be unavailable in privacy-restricted browsers.
  }
}

export function clearSessionHint(): void {
  try {
    getStorage()?.removeItem(SESSION_HINT_KEY)
  } catch {
    // Session state still remains authoritative in memory and on the server.
  }
}

function getStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}
