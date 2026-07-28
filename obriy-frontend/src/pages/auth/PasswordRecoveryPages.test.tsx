import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n/config'
import { API_BASE_URL } from '../../shared/config/env'
import { server } from '../../test/server'
import { ForgotPasswordPage } from './ForgotPasswordPage'
import { ResetPasswordPage } from './ResetPasswordPage'

describe('password recovery', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('uk')
    localStorage.setItem('obriy-language', 'uk')
  })

  it('always shows the generic forgot-password confirmation', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/forgot-password`, async ({ request }) => {
        await expect(request.json()).resolves.toEqual({ email: 'unknown@example.com' })
        return HttpResponse.json(
          { code: 'PASSWORD_RESET_SENT', message: 'Reset email sent.' },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderPage(<ForgotPasswordPage />, '/auth/forgot-password')

    await user.type(screen.getByLabelText('Електронна пошта'), 'unknown@example.com')
    await user.click(screen.getByRole('button', { name: 'Надіслати посилання' }))

    expect(await screen.findByRole('heading', { name: 'Перевірте пошту' })).toBeInTheDocument()
    expect(screen.getByText(/Якщо акаунт із такою адресою існує/)).toBeInTheDocument()
  })

  it('submits a new password with the opaque token', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/reset-password`, async ({ request }) => {
        await expect(request.json()).resolves.toEqual({
          password: 'Secret1234',
          token: 'reset-token',
        })
        return HttpResponse.json(
          { code: 'PASSWORD_RESET', message: 'Password reset.' },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderPage(<ResetPasswordPage />, '/auth/reset-password?token=reset-token')

    await user.type(screen.getByLabelText('Новий пароль'), 'Secret1234')
    await user.type(screen.getByLabelText('Повторіть пароль'), 'Secret1234')
    await user.click(screen.getByRole('button', { name: 'Зберегти новий пароль' }))

    expect(await screen.findByRole('heading', { name: 'Пароль оновлено' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Увійти з новим паролем' })).toHaveAttribute(
      'href',
      '/auth/login',
    )
  })

  it('does not render the reset form without a token', () => {
    renderPage(<ResetPasswordPage />, '/auth/reset-password')

    expect(screen.getByRole('heading', { name: 'Посилання недійсне' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Новий пароль')).not.toBeInTheDocument()
  })
})

function renderPage(page: React.ReactNode, initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>{page}</MemoryRouter>
    </QueryClientProvider>,
  )
}
