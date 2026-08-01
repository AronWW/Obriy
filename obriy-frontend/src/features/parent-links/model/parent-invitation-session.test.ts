import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearPendingParentInvitation,
  getPendingParentInvitation,
  hasPendingParentInvitation,
  rememberParentInvitation,
} from './parent-invitation-session'

describe('parent invitation session', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  it('stores a valid invitation across authentication navigation', () => {
    const token = 'A'.repeat(43)

    expect(rememberParentInvitation(token)).toBe(true)
    expect(getPendingParentInvitation()).toBe(token)
    expect(hasPendingParentInvitation()).toBe(true)
  })

  it('rejects malformed invitation tokens', () => {
    expect(rememberParentInvitation('short-token')).toBe(false)
    expect(getPendingParentInvitation()).toBeNull()
  })

  it('expires a locally remembered invitation after 24 hours', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T10:00:00.000Z'))
    rememberParentInvitation('B'.repeat(43))

    vi.setSystemTime(new Date('2026-08-02T10:00:00.000Z'))
    expect(getPendingParentInvitation()).toBeNull()
  })

  it('clears the invitation after acceptance', () => {
    rememberParentInvitation('C'.repeat(43))
    clearPendingParentInvitation()

    expect(getPendingParentInvitation()).toBeNull()
  })
})
