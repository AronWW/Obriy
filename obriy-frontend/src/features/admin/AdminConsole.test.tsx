import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n/config'
import { API_BASE_URL } from '../../shared/config/env'
import { server } from '../../test/server'
import { useSessionStore } from '../auth/model/session.store'
import { AdminAppealsPage, AdminDashboardPage, AdminUserDetailPage } from './AdminPages'

describe('Admin console', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSessionStore.setState({ accessToken: 'admin-token', status: 'authenticated', user: null })
  })

  it('shows platform counters from the protected dashboard', async () => {
    server.use(http.get(`${API_BASE_URL}/admin/dashboard`, () => HttpResponse.json({ users: 12, students: 7, teachers: 2, parents: 2, pendingUsers: 1, suspendedUsers: 1, newUsersLast30Days: 4, classes: 3, publishedLessons: 8, publishedReleases: 6, messagesLast30Days: 19, openModerationCases: 2, pendingSuspensionAppeals: 1 })))
    renderPage('/app/admin', <Route path="/app/admin" element={<AdminDashboardPage />} />)
    expect(await screen.findByRole('heading', { name: 'Platform overview' })).toBeInTheDocument()
    expect(await screen.findByText('Open cases')).toBeInTheDocument()
    expect(screen.getByText('19')).toBeInTheDocument()
  })

  it('requires a meaningful reason before suspending a user', async () => {
    const user = userEvent.setup()
    let receivedReason = ''
    server.use(
      http.get(`${API_BASE_URL}/admin/users/user-1`, () => HttpResponse.json(userFixture())),
      http.post(`${API_BASE_URL}/admin/users/user-1/suspend`, async ({ request }) => {
        const body = await request.json() as { reason: string }
        receivedReason = body.reason
        return HttpResponse.json({ ...userFixture(), status: 'SUSPENDED' })
      }),
    )
    renderPage('/app/admin/users/user-1', <Route path="/app/admin/users/:userId" element={<AdminUserDetailPage />} />)
    await user.click(await screen.findByRole('button', { name: 'Suspend' }))
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    expect(confirm).toBeDisabled()
    await user.type(screen.getByRole('textbox'), 'Repeated harmful conduct in class materials.')
    await user.click(confirm)
    expect(await screen.findByText('SUSPENDED')).toBeInTheDocument()
    expect(receivedReason).toBe('Repeated harmful conduct in class materials.')
  })

  it('reviews a pending suspension appeal from the admin queue', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API_BASE_URL}/admin/suspension-appeals`, () => HttpResponse.json({
        items: [{ id: 'appeal-1', userId: 'user-1', displayName: 'Teacher One', email: 'teacher@example.com', role: 'TEACHER', userStatus: 'SUSPENDED', status: 'PENDING', suspensionReason: 'Repeated harmful conduct.', suspendedAt: '2026-09-20T10:00:00.000Z', message: 'Please review the context of this incident.', resolutionNote: null, reviewedAt: null, createdAt: '2026-09-21T10:00:00.000Z' }],
        nextCursor: null,
      })),
    )
    renderPage('/app/admin/appeals', <Route path="/app/admin/appeals" element={<AdminAppealsPage />} />)
    expect(await screen.findByRole('heading', { name: 'Suspension appeals' })).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Details' }))
    expect(screen.getByText('Please review the context of this incident.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve and restore' })).toBeInTheDocument()
  })
})

function renderPage(path: string, route: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes>{route}</Routes></MemoryRouter></QueryClientProvider>)
}

function userFixture() {
  return { id: 'user-1', email: 'teacher@example.com', role: 'TEACHER', status: 'ACTIVE', displayName: 'Teacher One', avatarUrl: null, subjectArea: 'History', preferredLocale: 'EN', classId: null, className: null, emailVerifiedAt: '2026-09-01T00:00:00.000Z', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', stats: { classes: 1, lessons: 2, assignments: 3, tests: 4, children: 0, guardians: 0 } }
}
