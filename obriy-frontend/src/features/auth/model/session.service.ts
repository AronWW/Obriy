import { apiRequest, ApiError } from '../../../shared/api/api-client'
import { authApi } from '../api/auth.api'
import type { AuthResponse } from './auth.types'
import { hasSessionHint } from './session-hint'
import { useSessionStore } from './session.store'

let refreshPromise: Promise<AuthResponse | null> | null = null

export function establishSession(session: AuthResponse): void {
  useSessionStore.getState().setSession(session)
}

export function refreshSession(): Promise<AuthResponse | null> {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = authApi
    .refresh()
    .then((session) => {
      establishSession(session)
      return session
    })
    .catch(() => {
      useSessionStore.getState().clearSession()
      return null
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

export function restoreSession(): Promise<AuthResponse | null> {
  if (!hasSessionHint()) {
    useSessionStore.getState().clearSession()
    return Promise.resolve(null)
  }

  return refreshSession()
}

export async function logoutSession(): Promise<void> {
  try {
    await authApi.logout()
  } finally {
    useSessionStore.getState().clearSession()
  }
}

export async function authorizedRequest<T>(
  path: string,
  init: Omit<RequestInit, 'body'> & { body?: unknown } = {},
): Promise<T> {
  let accessToken = useSessionStore.getState().accessToken

  if (!accessToken) {
    const refreshedSession = await restoreSession()
    accessToken = refreshedSession?.accessToken ?? null
  }

  try {
    return await apiRequest<T>(path, { ...init, accessToken })
  } catch (error: unknown) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error
    }

    if (!hasSessionHint()) {
      throw error
    }

    const refreshedSession = await refreshSession()
    if (!refreshedSession) {
      throw error
    }

    return apiRequest<T>(path, {
      ...init,
      accessToken: refreshedSession.accessToken,
    })
  }
}
