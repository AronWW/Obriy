import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import i18n from '../../../i18n/config'
import { API_BASE_URL } from '../../../shared/config/env'
import { server } from '../../../test/server'
import type { PrivateProfile } from '../../auth/model/auth.types'
import { useSessionStore } from '../../auth/model/session.store'
import { AvatarEditor } from './AvatarEditor'
import { SecuritySection } from './SecuritySection'

describe('profile controls', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSessionStore.setState({
      accessToken: 'access-token',
      status: 'authenticated',
      user: profile(),
    })
  })

  it('opens a crop preview for a supported image and can cancel it', async () => {
    const user = userEvent.setup()
    const view = renderControl(<AvatarEditor hasAvatar={false} />)
    const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).not.toBeNull()

    await user.upload(
      input!,
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0])], 'avatar.jpg', {
        type: 'image/jpeg',
      }),
    )

    expect(await screen.findByRole('dialog', { name: 'Crop avatar' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('removes an avatar and updates the active session profile', async () => {
    server.use(
      http.delete(`${API_BASE_URL}/users/me/avatar`, () =>
        HttpResponse.json(profile({ avatarUrl: null })),
      ),
    )
    const user = userEvent.setup()
    renderControl(<AvatarEditor hasAvatar />)

    await user.click(screen.getByRole('button', { name: 'Remove photo' }))
    await waitFor(() =>
      expect(useSessionStore.getState().user?.profile.avatarUrl).toBeNull(),
    )
  })

  it('validates password confirmation before sending a request', async () => {
    const user = userEvent.setup()
    renderControl(<SecuritySection />)

    await user.type(screen.getByLabelText('Current password'), 'Current123!')
    await user.type(screen.getByLabelText('New password'), 'NewPassword123!')
    await user.type(screen.getByLabelText('Confirm new password'), 'Different123!')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByText('The new passwords do not match.')).toBeInTheDocument()
  })

  it('clears the local session and redirects after changing the password', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/change-password`, async ({ request }) => {
        expect(await request.json()).toEqual({
          currentPassword: 'Current123!',
          newPassword: 'NewPassword123!',
        })
        return HttpResponse.json({ code: 'PASSWORD_CHANGED', message: 'Changed' })
      }),
    )
    const user = userEvent.setup()
    renderControl(
      <>
        <SecuritySection />
        <Location />
      </>,
    )

    await user.type(screen.getByLabelText('Current password'), 'Current123!')
    await user.type(screen.getByLabelText('New password'), 'NewPassword123!')
    await user.type(screen.getByLabelText('Confirm new password'), 'NewPassword123!')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/auth/login'))
    expect(useSessionStore.getState().status).toBe('anonymous')
  })

  it('offers the reset-email flow to a Google-only account', async () => {
    useSessionStore.setState({ user: profile({ hasPassword: false }) })
    let called = false
    server.use(
      http.post(`${API_BASE_URL}/auth/forgot-password`, () => {
        called = true
        return HttpResponse.json({ code: 'PASSWORD_RESET_SENT', message: 'Sent' })
      }),
    )
    const user = userEvent.setup()
    renderControl(<SecuritySection />)

    await user.click(screen.getByRole('button', { name: 'Send password setup email' }))
    await waitFor(() => expect(called).toBe(true))
    expect(await screen.findByText('Email sent. Check your inbox.')).toBeInTheDocument()
  })
})

function renderControl(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  )
}

function Location() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function profile(
  overrides: Partial<PrivateProfile> & {
    avatarUrl?: string | null
    hasPassword?: boolean
  } = {},
): PrivateProfile {
  const { avatarUrl, hasPassword, ...userOverrides } = overrides
  return {
    id: 'student-1',
    email: 'student@example.com',
    role: 'STUDENT',
    status: 'ACTIVE',
    emailVerifiedAt: '2026-09-01T10:00:00.000Z',
    hasPassword: hasPassword ?? true,
    profile: {
      displayName: 'Student',
      avatarUrl:
        avatarUrl === undefined
          ? 'https://cdn.example/avatar.webp'
          : avatarUrl,
      bio: null,
      subjectArea: null,
      preferredLocale: 'EN',
    },
    ...userOverrides,
  }
}
