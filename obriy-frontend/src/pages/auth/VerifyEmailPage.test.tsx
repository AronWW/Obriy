import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { rememberVerification } from '../../features/auth/model/verification-session'
import i18n from '../../i18n/config'
import { API_BASE_URL } from '../../shared/config/env'
import { server } from '../../test/server'
import { VerifyEmailPage } from './VerifyEmailPage'

describe('VerifyEmailPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('uk')
    localStorage.setItem('obriy-language', 'uk')
  })

  it('activates the account using the token from the link', async () => {
    rememberVerification('student@example.com', 60)
    server.use(
      http.post(`${API_BASE_URL}/auth/verify-email`, async ({ request }) => {
        await expect(request.json()).resolves.toEqual({ token: 'valid-token' })
        return HttpResponse.json(
          { code: 'EMAIL_VERIFIED', message: 'Email verified.' },
          { status: 201 },
        )
      }),
    )

    renderVerifyEmailPage('/auth/verify-email?token=valid-token')

    expect(await screen.findByRole('heading', { name: 'Пошту підтверджено' })).toBeInTheDocument()
    expect(sessionStorage.getItem('obriy-email-verification')).toBeNull()
  })

  it('shows a safe state for an expired or previously used link', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/verify-email`, () =>
        HttpResponse.json(
          {
            statusCode: 400,
            code: 'INVALID_EMAIL_VERIFICATION_TOKEN',
            message: 'Invalid token.',
          },
          { status: 400 },
        ),
      ),
    )

    renderVerifyEmailPage('/auth/verify-email?token=expired-token')

    expect(await screen.findByRole('heading', { name: 'Посилання недійсне' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Перейти до входу' })).toHaveAttribute(
      'href',
      '/auth/login',
    )
  })
})

function renderVerifyEmailPage(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <VerifyEmailPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
