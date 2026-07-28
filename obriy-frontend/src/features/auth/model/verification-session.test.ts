import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearVerificationSession,
  getVerificationSession,
  rememberVerification,
} from './verification-session'

describe('verification session', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('stores only the normalized email and the server cooldown deadline', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'))

    const session = rememberVerification(' Student@Example.COM ', 60)

    expect(session).toEqual({
      email: 'student@example.com',
      nextSendAt: new Date('2026-07-18T12:01:00.000Z').getTime(),
    })
    expect(getVerificationSession()).toEqual(session)
    expect(sessionStorage.getItem('obriy-email-verification')).not.toContain('token')
  })

  it('removes malformed storage instead of trusting it', () => {
    sessionStorage.setItem('obriy-email-verification', JSON.stringify({ email: 12 }))

    expect(getVerificationSession()).toBeNull()
    expect(sessionStorage.getItem('obriy-email-verification')).toBeNull()
  })

  it('can explicitly clear the pending verification context', () => {
    rememberVerification('student@example.com', 60)

    clearVerificationSession()

    expect(getVerificationSession()).toBeNull()
  })
})
