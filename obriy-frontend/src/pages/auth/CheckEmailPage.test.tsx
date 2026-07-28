import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  getVerificationSession,
  rememberVerification,
} from '../../features/auth/model/verification-session'
import i18n from '../../i18n/config'
import { API_BASE_URL } from '../../shared/config/env'
import { server } from '../../test/server'
import { CheckEmailPage } from './CheckEmailPage'

describe('CheckEmailPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('uk')
    localStorage.setItem('obriy-language', 'uk')
  })

  it('applies the authoritative server cooldown after an early resend', async () => {
    rememberVerification('student@example.com', 0)
    server.use(
      http.post(`${API_BASE_URL}/auth/resend-verification`, async ({ request }) => {
        await expect(request.json()).resolves.toEqual({ email: 'student@example.com' })
        return HttpResponse.json(
          {
            statusCode: 429,
            code: 'EMAIL_VERIFICATION_COOLDOWN',
            email: 'student@example.com',
            message: 'Please wait.',
            retryAfterSeconds: 42,
          },
          { status: 429 },
        )
      }),
    )
    const user = userEvent.setup()
    renderCheckEmailPage()

    await user.click(screen.getByRole('button', { name: 'Надіслати посилання ще раз' }))

    expect(
      await screen.findByText(
        'Нове посилання можна буде надіслати після завершення таймера.',
      ),
    ).toBeInTheDocument()
    const resendButton = screen.getByRole('button', { name: /Надіслати повторно через/ })
    await waitFor(() => expect(resendButton).toBeDisabled())
    expect(resendButton).toHaveTextContent(/0:4[12]/)
    expect(getVerificationSession()?.nextSendAt).toBeGreaterThan(Date.now())
  })

  it('sends a new link and replaces the local deadline', async () => {
    rememberVerification('student@example.com', 0)
    server.use(
      http.post(`${API_BASE_URL}/auth/resend-verification`, () =>
        HttpResponse.json(
          {
            code: 'EMAIL_VERIFICATION_SENT',
            email: 'student@example.com',
            message: 'Verification email sent.',
            retryAfterSeconds: 60,
          },
          { status: 201 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderCheckEmailPage()

    await user.click(screen.getByRole('button', { name: 'Надіслати посилання ще раз' }))

    expect(
      await screen.findByText('Нове посилання надіслано. Попереднє вже недійсне.'),
    ).toBeInTheDocument()
    expect(getVerificationSession()?.nextSendAt).toBeGreaterThan(Date.now())
  })
})

function renderCheckEmailPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/auth/check-email']}>
        <Routes>
          <Route path="/auth/check-email" element={<CheckEmailPage />} />
          <Route path="/auth/register" element={<div>Registration</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
