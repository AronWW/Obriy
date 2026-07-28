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
import { LoginPage } from './LoginPage'

const authResponse = {
  accessToken: 'new-access-token',
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

describe('LoginPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('uk')
    localStorage.setItem('obriy-language', 'uk')
    useSessionStore.setState({ accessToken: null, status: 'anonymous', user: null })
  })

  it('signs in through the real API client and stores the session', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
        await expect(request.json()).resolves.toEqual({
          email: 'student@example.com',
          password: 'Secret1234',
        })
        return HttpResponse.json(authResponse, { status: 201 })
      }),
    )
    const user = userEvent.setup()

    renderLoginPage()

    await user.type(screen.getByLabelText('Електронна пошта'), 'student@example.com')
    await user.type(screen.getByLabelText('Пароль'), 'Secret1234')
    await user.click(screen.getByRole('button', { name: 'Увійти' }))

    expect(await screen.findByText('Protected workspace')).toBeInTheDocument()
    expect(useSessionStore.getState().status).toBe('authenticated')
    expect(useSessionStore.getState().user?.email).toBe('student@example.com')
  })

  it('shows the localized API error for invalid credentials', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/login`, () =>
        HttpResponse.json(
          {
            statusCode: 401,
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
          },
          { status: 401 },
        ),
      ),
    )
    const user = userEvent.setup()

    renderLoginPage()

    await user.type(screen.getByLabelText('Електронна пошта'), 'student@example.com')
    await user.type(screen.getByLabelText('Пароль'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Увійти' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Невірна пошта або пароль.')
    expect(useSessionStore.getState().status).toBe('anonymous')
  })

  it('starts Google login without guessing a role', () => {
    renderLoginPage()

    const link = screen.getByRole('link', { name: 'Продовжити з Google' })
    const url = new URL(link.getAttribute('href') || '')

    expect(url.pathname).toBe('/auth/google')
    expect(url.searchParams.get('intent')).toBe('LOGIN')
    expect(url.searchParams.get('locale')).toBe('UK')
    expect(url.searchParams.has('role')).toBe(false)
  })
})

function renderLoginPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/auth/login']}>
        <Routes>
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/app" element={<div>Protected workspace</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
