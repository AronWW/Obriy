import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionStore } from '../../features/auth/model/session.store'
import i18n from '../../i18n/config'
import { API_BASE_URL } from '../../shared/config/env'
import { server } from '../../test/server'
import { GoogleCallbackPage } from './GoogleCallbackPage'

const studentSession = {
  accessToken: 'google-access-token',
  user: {
    id: 'google-user-1',
    email: 'student@example.com',
    role: 'STUDENT',
    status: 'ACTIVE',
    emailVerifiedAt: '2026-07-19T12:00:00.000Z',
    hasPassword: false,
    profile: {
      displayName: 'Google Student',
      avatarUrl: 'https://example.com/avatar.png',
      bio: null,
      subjectArea: null,
      preferredLocale: 'UK',
    },
  },
}

describe('GoogleCallbackPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('uk')
    localStorage.setItem('obriy-language', 'uk')
    useSessionStore.setState({ accessToken: null, status: 'anonymous', user: null })
  })

  it('exchanges the callback code and establishes a session', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/google/exchange`, async ({ request }) => {
        await expect(request.json()).resolves.toEqual({ code: 'exchange-code' })
        return HttpResponse.json(studentSession, { status: 201 })
      }),
    )

    renderCallback('/auth/google/callback?code=exchange-code')

    expect(await screen.findByText('Protected Google workspace')).toBeInTheDocument()
    expect(useSessionStore.getState().status).toBe('authenticated')
    expect(useSessionStore.getState().user?.email).toBe('student@example.com')
  })

  it('completes a first-time Google registration after choosing a role', async () => {
    server.use(
      http.post(
        `${API_BASE_URL}/auth/google/complete-registration`,
        async ({ request }) => {
          await expect(request.json()).resolves.toEqual({
            code: 'registration-code',
            preferredLocale: 'UK',
            role: 'PARENT',
          })
          return HttpResponse.json(
            {
              ...studentSession,
              user: { ...studentSession.user, role: 'PARENT' },
            },
            { status: 201 },
          )
        },
      ),
    )
    const user = userEvent.setup()
    renderCallback('/auth/google/callback?registration=registration-code')

    expect(
      screen.getByRole('heading', { name: 'Оберіть свою роль' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Батьки/ }))

    expect(await screen.findByText('Protected Google workspace')).toBeInTheDocument()
    expect(useSessionStore.getState().user?.role).toBe('PARENT')
  })

  it('shows a localized cancellation instead of a raw provider error', () => {
    renderCallback('/auth/google/callback?error=GOOGLE_OAUTH_CANCELLED')

    expect(screen.getByRole('heading', { name: 'Вхід скасовано' })).toBeInTheDocument()
    expect(screen.getByText('Ви скасували вхід через Google.')).toBeInTheDocument()
  })

  it('renders the callback state in English when English is selected', async () => {
    await i18n.changeLanguage('en')
    localStorage.setItem('obriy-language', 'en')

    renderCallback('/auth/google/callback?error=GOOGLE_OAUTH_FAILED')

    expect(
      screen.getByRole('heading', { name: 'Could not sign in with Google' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Google sign in could not be completed. Try again.'),
    ).toBeInTheDocument()
  })
})

function renderCallback(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
          <Route path="/app" element={<div>Protected Google workspace</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
