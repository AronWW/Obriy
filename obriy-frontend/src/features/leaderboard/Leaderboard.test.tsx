import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n/config'
import { API_BASE_URL } from '../../shared/config/env'
import { server } from '../../test/server'
import { useSessionStore } from '../auth/model/session.store'
import type { LeaderboardPage } from './model/leaderboard.types'
import { StudentLeaderboardPage } from './StudentLeaderboardPage'

describe('Student leaderboard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSessionStore.setState({
      accessToken: 'student-token',
      status: 'authenticated',
      user: {
        id: 'student-self',
        email: 'student@example.com',
        role: 'STUDENT',
        status: 'ACTIVE',
        emailVerifiedAt: '2026-09-01T10:00:00.000Z',
        profile: {
          displayName: 'Zed',
          avatarUrl: null,
          bio: null,
          gradeLevel: 8,
          subjectArea: null,
          preferredLocale: 'EN',
        },
      },
    })
  })

  it('shows the top three, pins the current student, and changes period in the URL', async () => {
    const periods: string[] = []
    server.use(
      http.get(`${API_BASE_URL}/leaderboard/me`, ({ request }) => {
        const period = new URL(request.url).searchParams.get('period') ?? 'WEEK'
        periods.push(period)
        return HttpResponse.json(leaderboardFixture(period as 'WEEK' | 'ALL_TIME'))
      }),
    )
    const user = userEvent.setup()
    renderLeaderboard('/app/student/leaderboard')

    expect(await screen.findByRole('heading', { name: 'Class leaders' })).toBeInTheDocument()
    expect(screen.getAllByText('Anna')).toHaveLength(2)
    expect(screen.getByText('Your place')).toBeInTheDocument()
    expect(screen.getByText('Zed')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Anna/ })[0]).toHaveAttribute(
      'href',
      '/app/student/classmates/student-1',
    )

    await user.click(screen.getByRole('button', { name: 'All time' }))
    await waitFor(() => expect(periods.at(-1)).toBe('ALL_TIME'))
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/app/student/leaderboard?period=ALL_TIME',
    )
  })

  it('offers class joining when the student has no class', async () => {
    server.use(
      http.get(`${API_BASE_URL}/leaderboard/me`, () =>
        HttpResponse.json({
          ...leaderboardFixture('WEEK'),
          class: null,
          entries: [],
          selfEntry: null,
        }),
      ),
    )
    renderLeaderboard('/app/student/leaderboard')

    expect(await screen.findByText('Join a class first')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open classes' })).toHaveAttribute(
      'href',
      '/app/student/classes',
    )
  })
})

function renderLeaderboard(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/app/student/leaderboard"
            element={
              <>
                <StudentLeaderboardPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function LocationProbe() {
  const location = useLocation()
  return (
    <span data-testid="location">
      {location.pathname}
      {location.search}
    </span>
  )
}

function leaderboardFixture(period: 'WEEK' | 'ALL_TIME'): LeaderboardPage {
  const entries = [
    entry('student-1', 'Anna', 1, 300),
    entry('student-2', 'Bohdan', 2, 200),
    entry('student-3', 'Charlie', 3, 100),
  ]
  return {
    class: { id: 'class-1', name: 'History club', studentCount: 5 },
    period: {
      type: period,
      startAt: period === 'WEEK' ? '2026-09-06T21:00:00.000Z' : null,
      endAt: period === 'WEEK' ? '2026-09-13T21:00:00.000Z' : null,
    },
    entries,
    selfEntry: { ...entry('student-self', 'Zed', 5, 0), isCurrentUser: true },
    nextCursor: null,
  }
}

function entry(
  id: string,
  displayName: string,
  rank: number,
  periodXp: number,
) {
  return {
    id,
    displayName,
    rank,
    avatarUrl: null,
    periodXp,
    totalXp: periodXp,
    level: 1,
    showcase: [],
    lastXpAt: null,
    isCurrentUser: false,
  }
}
