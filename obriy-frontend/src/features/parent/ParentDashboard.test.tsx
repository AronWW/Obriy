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
import { ParentChildPage } from './pages/ParentChildPage'
import { ParentHubPage } from './pages/ParentHubPage'
import { ParentProgressPage } from './pages/ParentProgressPage'

describe('Parent learning dashboard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSessionStore.setState({
      accessToken: 'parent-token',
      status: 'authenticated',
      user: {
        id: 'parent-1',
        email: 'parent@example.com',
        role: 'PARENT',
        status: 'ACTIVE',
        emailVerifiedAt: '2026-09-01T10:00:00.000Z',
        profile: {
          displayName: 'Olena',
          avatarUrl: null,
          bio: null,
          gradeLevel: null,
          subjectArea: null,
          preferredLocale: 'EN',
        },
      },
    })
  })

  it('shows compact metrics for multiple children', async () => {
    mockDashboard()
    renderPage('/app/parent', <Route index element={<ParentHubPage />} />)

    expect(await screen.findByRole('heading', { name: 'Your children’s learning' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Marta/ })).toHaveAttribute('href', '/app/parent/child/student-1')
    expect(screen.getByRole('link', { name: /Ostap/ })).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('shows attention, upcoming, and recent work without opening test content', async () => {
    mockDashboard()
    server.use(
      http.get(`${API_BASE_URL}/parent/children/student-1/overview`, () =>
        HttpResponse.json({
          child: children[0],
          attention: [work('Due soon', 'DUE_SOON')],
          upcoming: [work('Next quiz', null)],
          recentActivity: [work('Completed quiz', null, 'COMPLETED')],
        }),
      ),
    )
    renderPage('/app/parent/child/student-1', <Route path="child/:childId" element={<ParentChildPage />} />)

    expect(await screen.findByRole('heading', { name: 'Marta' })).toBeInTheDocument()
    expect(screen.getByText('Due soon')).toBeInTheDocument()
    expect(screen.getByText('Next quiz')).toBeInTheDocument()
    expect(screen.getByText('Completed quiz')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Due soon/ })).not.toBeInTheDocument()
  })

  it('groups tests by lesson and reveals only safe attempt history', async () => {
    mockDashboard()
    server.use(
      http.get(`${API_BASE_URL}/parent/children/student-1/progress`, () =>
        HttpResponse.json({
          child: children[0],
          lessons: [{
            id: 'lesson-1', title: 'Ancient cities', position: 1,
            requiredTestCount: 1, completedRequiredCount: 1,
            completionPercent: 100, averagePercent: 80,
            tests: [{
              ...work('Sources quiz', null, 'COMPLETED'),
              bestPoints: 9, bestPercent: 90, scorePoints: 8, scorePercent: 80,
              attempts: [{
                attemptNumber: 1, status: 'GRADED', maxPoints: 10,
                scorePoints: 8, scorePercent: 80, isPassed: true, isLate: false,
                startedAt: '2026-09-10T10:00:00.000Z',
                submittedAt: '2026-09-10T10:10:00.000Z',
                gradedAt: '2026-09-10T10:10:00.000Z',
              }],
            }],
          }],
        }),
      ),
    )
    const user = userEvent.setup()
    renderPage('/app/parent/child/student-1/progress', <Route path="child/:childId/progress" element={<ParentProgressPage />} />)

    expect(await screen.findByRole('heading', { name: 'Ancient cities' })).toBeInTheDocument()
    await user.click(screen.getByText('Sources quiz'))
    expect(screen.getByText('Attempt history')).toBeInTheDocument()
    expect(screen.getByText('Attempt 1')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})

const children = [
  {
    id: 'student-1', displayName: 'Marta', avatarUrl: null, gradeLevel: 8,
    class: { id: 'class-1', name: 'History' },
    metrics: { requiredReleaseCount: 2, completedCount: 1, completionPercent: 50, averagePercent: 40, attentionCount: 1, nextDueAt: '2026-09-12T10:00:00.000Z' },
  },
  {
    id: 'student-2', displayName: 'Ostap', avatarUrl: null, gradeLevel: 5,
    class: null,
    metrics: { requiredReleaseCount: 0, completedCount: 0, completionPercent: null, averagePercent: null, attentionCount: 0, nextDueAt: null },
  },
]

function mockDashboard() {
  server.use(
    http.get(`${API_BASE_URL}/parent/dashboard`, () => HttpResponse.json({ children })),
  )
}

function work(title: string, attentionReason: string | null, status = 'NOT_STARTED') {
  return {
    releaseId: `release-${title}`, testId: `test-${title}`, title,
    lesson: { id: 'lesson-1', title: 'Ancient cities', position: 1 },
    releaseStatus: 'ACTIVE', isRequired: true, availability: 'AVAILABLE', status,
    availableFrom: null, dueAt: '2026-09-12T10:00:00.000Z', maxPoints: 10,
    scorePoints: null, scorePercent: null, bestPoints: null, bestPercent: null,
    attemptCount: 0, lastActivityAt: '2026-09-11T10:00:00.000Z', attentionReason,
  }
}

function renderPage(path: string, route: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/app/parent">{route}</Route></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
