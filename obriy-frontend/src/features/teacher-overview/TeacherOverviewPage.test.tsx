import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n/config'
import { API_BASE_URL } from '../../shared/config/env'
import { server } from '../../test/server'
import { useSessionStore } from '../auth/model/session.store'
import type { TeacherDashboard } from './model/teacher-dashboard.types'
import { TeacherOverviewPage } from './TeacherOverviewPage'

describe('TeacherOverviewPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSessionStore.setState({
      accessToken: 'teacher-token',
      status: 'authenticated',
      user: {
        id: 'teacher-1',
        email: 'teacher@example.com',
        role: 'TEACHER',
        status: 'ACTIVE',
        emailVerifiedAt: '2026-09-01T10:00:00.000Z',
        profile: {
          displayName: 'Olena',
          avatarUrl: null,
          bio: null,
          gradeLevel: null,
          subjectArea: 'History',
          preferredLocale: 'EN',
        },
      },
    })
  })

  it('shows working totals, recent materials and a direct review link', async () => {
    server.use(
      http.get(`${API_BASE_URL}/teacher/dashboard`, () =>
        HttpResponse.json(dashboardFixture()),
      ),
    )
    renderOverview()

    expect(
      await screen.findByRole('heading', { name: 'Overview' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Welcome, Olena/)).toBeInTheDocument()
    expect(await screen.findByText('Students: 42')).toBeInTheDocument()
    expect(screen.getByText('17')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Review/ }),
    ).toHaveAttribute(
      'href',
      '/app/teacher/lessons/lesson-1/edit?reviewAttempt=attempt-1',
    )
    expect(screen.getByText('Recent lessons')).toBeInTheDocument()
    expect(screen.getByText('Recent assignments')).toBeInTheDocument()
    expect(screen.getByText('Recent tests')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Create class/ }),
    ).toHaveAttribute('href', '/app/teacher/classes?create=1')
    expect(
      screen.getByRole('link', { name: /Create assignment/ }),
    ).toHaveAttribute('href', '/app/teacher/tasks?create=1')
  })

  it('shows useful empty states for a new teacher', async () => {
    const empty = dashboardFixture()
    empty.stats = {
      classes: { total: 0, studentCount: 0 },
      lessons: { total: 0, drafts: 0 },
      assignments: { total: 0, drafts: 0 },
      tests: { total: 0, drafts: 0 },
      pendingReviews: 0,
    }
    empty.pendingReviews = []
    empty.recent = { lessons: [], assignments: [], tests: [] }
    server.use(
      http.get(`${API_BASE_URL}/teacher/dashboard`, () =>
        HttpResponse.json(empty),
      ),
    )
    renderOverview()

    expect(
      await screen.findByText(
        'There are no answers waiting for manual review.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Create your first lesson to see it here.'),
    ).toBeInTheDocument()
  })

  it('retries after a loading error', async () => {
    const user = userEvent.setup()
    let requests = 0
    server.use(
      http.get(`${API_BASE_URL}/teacher/dashboard`, () => {
        requests += 1
        return requests === 1
          ? HttpResponse.json({ message: 'Failure' }, { status: 500 })
          : HttpResponse.json(dashboardFixture())
      }),
    )
    renderOverview()

    await user.click(
      await screen.findByRole('button', { name: 'Try again' }),
    )
    expect(await screen.findByText('Students: 42')).toBeInTheDocument()
    expect(requests).toBe(2)
  })
})

function renderOverview() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TeacherOverviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function dashboardFixture(): TeacherDashboard {
  return {
    stats: {
      classes: { total: 3, studentCount: 42 },
      lessons: { total: 17, drafts: 4 },
      assignments: { total: 28, drafts: 5 },
      tests: { total: 8, drafts: 2 },
      pendingReviews: 1,
    },
    pendingReviews: [
      {
        attemptId: 'attempt-1',
        lessonId: 'lesson-1',
        lessonTitle: 'Kyivan Rus',
        testTitle: 'Written sources',
        studentId: 'student-1',
        studentName: 'Marta',
        classId: 'class-1',
        className: 'History club',
        pendingReviewCount: 2,
        submittedAt: '2026-09-09T09:30:00.000Z',
      },
    ],
    recent: {
      lessons: [
        {
          id: 'lesson-1',
          title: 'Kyivan Rus',
          status: 'PUBLISHED',
          classCount: 2,
          updatedAt: '2026-09-08T11:00:00.000Z',
        },
      ],
      assignments: [
        {
          id: 'assignment-1',
          title: 'Compare sources',
          type: 'WRITTEN',
          status: 'DRAFT',
          updatedAt: '2026-09-08T10:00:00.000Z',
        },
      ],
      tests: [
        {
          id: 'test-1',
          title: 'Topic check',
          status: 'PUBLISHED',
          itemCount: 5,
          updatedAt: '2026-09-07T10:00:00.000Z',
        },
      ],
    },
  }
}
