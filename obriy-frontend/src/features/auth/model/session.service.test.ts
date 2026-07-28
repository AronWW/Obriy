import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi } from '../api/auth.api'
import type { AuthResponse } from './auth.types'
import {
  establishSession,
  logoutSession,
  refreshSession,
  restoreSession,
} from './session.service'
import { hasSessionHint } from './session-hint'
import { useSessionStore } from './session.store'

const session: AuthResponse = {
  accessToken: 'access-token',
  user: {
    id: 'user-1',
    email: 'student@example.com',
    role: 'STUDENT',
    status: 'ACTIVE',
    emailVerifiedAt: '2026-07-18T12:00:00.000Z',
    profile: {
      displayName: 'Olena',
      avatarUrl: null,
      bio: null,
      gradeLevel: 9,
      subjectArea: null,
      preferredLocale: 'UK',
    },
  },
}

describe('session service', () => {
  beforeEach(() => {
    localStorage.clear()
    useSessionStore.setState({
      accessToken: null,
      status: 'checking',
      user: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not request a refresh for an anonymous browser', async () => {
    const refreshSpy = vi.spyOn(authApi, 'refresh')

    await expect(restoreSession()).resolves.toBeNull()

    expect(refreshSpy).not.toHaveBeenCalled()
    expect(useSessionStore.getState().status).toBe('anonymous')
  })

  it('restores a previously established browser session', async () => {
    establishSession(session)
    useSessionStore.setState({
      accessToken: null,
      status: 'checking',
      user: null,
    })
    const refreshSpy = vi.spyOn(authApi, 'refresh').mockResolvedValue(session)

    await expect(restoreSession()).resolves.toEqual(session)

    expect(refreshSpy).toHaveBeenCalledTimes(1)
    expect(useSessionStore.getState().status).toBe('authenticated')
  })

  it('coalesces simultaneous refresh requests into one API call', async () => {
    let resolveRefresh: ((value: AuthResponse) => void) | undefined
    const deferredRefresh = new Promise<AuthResponse>((resolve) => {
      resolveRefresh = resolve
    })
    const refreshSpy = vi.spyOn(authApi, 'refresh').mockReturnValue(deferredRefresh)

    const firstRefresh = refreshSession()
    const secondRefresh = refreshSession()

    expect(refreshSpy).toHaveBeenCalledTimes(1)
    resolveRefresh?.(session)

    await expect(firstRefresh).resolves.toEqual(session)
    await expect(secondRefresh).resolves.toEqual(session)
    expect(useSessionStore.getState().status).toBe('authenticated')
    expect(useSessionStore.getState().accessToken).toBe('access-token')
  })

  it('clears the local session even when the logout request fails', async () => {
    establishSession(session)
    expect(hasSessionHint()).toBe(true)
    vi.spyOn(authApi, 'logout').mockRejectedValue(new Error('offline'))

    await expect(logoutSession()).rejects.toThrow('offline')

    expect(useSessionStore.getState().status).toBe('anonymous')
    expect(useSessionStore.getState().accessToken).toBeNull()
    expect(useSessionStore.getState().user).toBeNull()
    expect(hasSessionHint()).toBe(false)
  })
})
