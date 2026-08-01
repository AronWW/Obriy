import { create } from 'zustand'
import type { AuthResponse, PrivateProfile } from './auth.types'
import {
  clearSessionHint,
  hasSessionHint,
  rememberSessionHint,
} from './session-hint'

export type SessionStatus = 'checking' | 'authenticated' | 'anonymous'

interface SessionState {
  accessToken: string | null
  status: SessionStatus
  user: PrivateProfile | null
  clearSession: () => void
  setChecking: () => void
  setSession: (session: AuthResponse) => void
  updateUser: (user: PrivateProfile) => void
}

export const useSessionStore = create<SessionState>()((set) => ({
  accessToken: null,
  status: hasSessionHint() ? 'checking' : 'anonymous',
  user: null,
  clearSession: () => {
    clearSessionHint()
    set({ accessToken: null, status: 'anonymous', user: null })
  },
  setChecking: () => set({ status: 'checking' }),
  setSession: (session) => {
    rememberSessionHint()
    set({
      accessToken: session.accessToken,
      status: 'authenticated',
      user: session.user,
    })
  },
  updateUser: (user) => set({ user }),
}))
