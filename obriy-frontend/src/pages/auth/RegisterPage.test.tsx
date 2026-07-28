import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { getVerificationSession } from '../../features/auth/model/verification-session'
import i18n from '../../i18n/config'
import { API_BASE_URL } from '../../shared/config/env'
import { server } from '../../test/server'
import { CheckEmailPage } from './CheckEmailPage'
import { RegisterPage } from './RegisterPage'
import { RoleSelectionPage } from './RoleSelectionPage'

describe('registration flow', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('uk')
    localStorage.setItem('obriy-language', 'uk')
  })

  it('offers only the three public registration roles', () => {
    renderRegistrationRoutes('/auth/register')

    expect(screen.getByRole('link', { name: /Учень/ })).toHaveAttribute(
      'href',
      '/auth/register/student',
    )
    expect(screen.getByRole('link', { name: /Вчитель/ })).toHaveAttribute(
      'href',
      '/auth/register/teacher',
    )
    expect(screen.getByRole('link', { name: /Батьки/ })).toHaveAttribute(
      'href',
      '/auth/register/parent',
    )
    expect(screen.queryByText('ADMIN')).not.toBeInTheDocument()
  })

  it('registers the selected role and opens the verification screen', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/register`, async ({ request }) => {
        await expect(request.json()).resolves.toEqual({
          displayName: 'Олена',
          email: 'student@example.com',
          password: 'Secret1234',
          preferredLocale: 'UK',
          role: 'STUDENT',
        })

        return HttpResponse.json(
          {
            code: 'EMAIL_VERIFICATION_SENT',
            email: 'student@example.com',
            message: 'Verification email sent.',
            retryAfterSeconds: 60,
          },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderRegistrationRoutes('/auth/register/student')

    await user.type(screen.getByLabelText('Ім’я для відображення'), 'Олена')
    await user.type(screen.getByLabelText('Електронна пошта'), 'student@example.com')
    await user.type(screen.getByLabelText('Пароль', { exact: true }), 'Secret1234')
    await user.type(screen.getByLabelText('Повторіть пароль'), 'Secret1234')
    await user.click(screen.getByRole('button', { name: 'Зареєструватися' }))

    expect(await screen.findByRole('heading', { name: 'Перевірте пошту' })).toBeInTheDocument()
    expect(screen.getByText('student@example.com')).toBeInTheDocument()
    expect(getVerificationSession()?.email).toBe('student@example.com')
    expect(screen.getByRole('button', { name: /Надіслати повторно через/ })).toBeDisabled()
  })

  it('passes the selected role to Google registration', () => {
    renderRegistrationRoutes('/auth/register/teacher')

    const link = screen.getByRole('link', { name: 'Зареєструватися через Google' })
    const url = new URL(link.getAttribute('href') || '')

    expect(url.pathname).toBe('/auth/google')
    expect(url.searchParams.get('intent')).toBe('REGISTER')
    expect(url.searchParams.get('role')).toBe('TEACHER')
    expect(url.searchParams.get('locale')).toBe('UK')
  })
})

function renderRegistrationRoutes(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/auth/register" element={<RoleSelectionPage />} />
          <Route path="/auth/register/:role" element={<RegisterPage />} />
          <Route path="/auth/check-email" element={<CheckEmailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
