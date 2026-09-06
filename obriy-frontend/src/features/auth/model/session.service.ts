import { apiRequest, ApiError } from '../../../shared/api/api-client'
import { authApi } from '../api/auth.api'
import type { AuthResponse } from './auth.types'
import { hasSessionHint } from './session-hint'
import { useSessionStore } from './session.store'
import { API_BASE_URL } from '../../../shared/config/env'

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

export async function authorizedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  let accessToken = useSessionStore.getState().accessToken
  if (!accessToken) accessToken = (await restoreSession())?.accessToken ?? null

  const perform = (token: string | null) => {
    const headers = new Headers(init.headers)
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    })
  }

  let response = await perform(accessToken)
  if (response.status === 401 && hasSessionHint()) {
    const refreshed = await refreshSession()
    if (refreshed) response = await perform(refreshed.accessToken)
  }
  return response
}
