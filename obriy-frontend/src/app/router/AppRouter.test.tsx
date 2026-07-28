import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionStore } from '../../features/auth/model/session.store'
import i18n from '../../i18n/config'
import { API_BASE_URL } from '../../shared/config/env'
import { server } from '../../test/server'
import { AppRouter } from './AppRouter'

const authenticatedUser = {
  id: 'user-1',
  email: 'student@example.com',
  role: 'STUDENT' as const,
  status: 'ACTIVE' as const,
  emailVerifiedAt: '2026-07-18T12:00:00.000Z',
  profile: {
    displayName: 'Іван',
    avatarUrl: null,
    bio: null,
    gradeLevel: 9,
    subjectArea: null,
    preferredLocale: 'UK' as const,
  },
}

describe('AppRouter auth boundaries', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('uk')
    useSessionStore.setState({
      accessToken: 'access-token',
      status: 'authenticated',
      user: authenticatedUser,
    })
  })

  it('redirects an authenticated user away from guest-only pages', async () => {
    renderRouter('/auth/login')

    expect(
      await screen.findByRole('navigation', { name: 'Основна навігація' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'З поверненням' })).not.toBeInTheDocument()
  })

  it('keeps email token routes reachable for an authenticated browser session', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/verify-email`, () =>
        HttpResponse.json(
          { code: 'EMAIL_VERIFIED', message: 'Email verified.' },
          { status: 201 },
        ),
      ),
    )

    renderRouter('/auth/verify-email?token=email-token')

    expect(
      await screen.findByRole('heading', { name: 'Пошту підтверджено' }),
    ).toBeInTheDocument()
  })
})

function renderRouter(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRouter />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
