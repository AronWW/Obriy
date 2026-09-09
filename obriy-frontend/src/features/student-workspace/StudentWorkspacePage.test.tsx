import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n/config'
import { API_BASE_URL } from '../../shared/config/env'
import { server } from '../../test/server'
import { useSessionStore } from '../auth/model/session.store'
import { StudentOverviewPage } from '../student-overview'
import { StudentLessonTests } from '../tests'
import type {
  StudentDashboard,
  StudentTasksPage,
  StudentWorkItem,
} from './model/student-workspace.types'
import { StudentTasksPage as TasksPage } from './StudentTasksPage'

describe('student workspace pages', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSessionStore.setState({
      accessToken: 'student-token',
      status: 'authenticated',
      user: {
        id: 'student-1',
        email: 'student@example.com',
        role: 'STUDENT',
        status: 'ACTIVE',
        emailVerifiedAt: '2026-09-01T10:00:00.000Z',
        profile: {
          displayName: 'Marta',
          avatarUrl: null,
          bio: null,
          gradeLevel: 8,
          subjectArea: null,
          preferredLocale: 'EN',
        },
      },
    })
  })

  it('renders real metrics, priority work and lesson deep links', async () => {
    server.use(
      http.get(`${API_BASE_URL}/student/dashboard`, () =>
        HttpResponse.json(dashboardFixture()),
      ),
    )
    renderPage(<StudentOverviewPage />)

    expect(await screen.findByText('Marta')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('72%')).toBeInTheDocument()
    expect(screen.getByText('Revise chronology')).toBeInTheDocument()
    expect(screen.getByText('Scheduled map')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Early states/ }),
    ).toHaveAttribute(
      'href',
      '/app/student/lessons/lesson-1?test=release-revision',
    )
    expect(screen.queryByText('Your learning journey')).not.toBeInTheDocument()
  })

  it('offers class joining instead of failing for a student without a class', async () => {
    const empty = dashboardFixture()
    empty.class = null
    empty.attention = []
    empty.upcoming = []
    empty.continueLessons = []
    server.use(
      http.get(`${API_BASE_URL}/student/dashboard`, () =>
        HttpResponse.json(empty),
      ),
    )
    renderPage(<StudentOverviewPage />)

    expect(await screen.findByText('Join a class first')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Go to class joining' }),
    ).toHaveAttribute('href', '/app/student/classes')
  })

  it('syncs task filters with the URL and keeps scheduled work locked', async () => {
    const requests: URL[] = []
    server.use(
      http.get(`${API_BASE_URL}/student/tasks`, ({ request }) => {
        requests.push(new URL(request.url))
        return HttpResponse.json(tasksFixture())
      }),
    )
    const user = userEvent.setup()
    renderPage(<TasksPage />, ['/app/student/tasks?status=SCHEDULED'])

    expect(await screen.findByText('Scheduled map')).toBeInTheDocument()
    expect(screen.getByText('Not open yet')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open' })).not.toBeInTheDocument()
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Assignment requirement' }),
      'REQUIRED',
    )
    await waitFor(() =>
      expect(requests.at(-1)?.searchParams.get('required')).toBe('REQUIRED'),
    )
    expect(requests.at(-1)?.searchParams.get('status')).toBe('SCHEDULED')
  })

  it('opens a deep-linked test and removes only its query parameter on close', async () => {
    server.use(
      http.get(
        `${API_BASE_URL}/classes/me/lessons/lesson-1/tests`,
        () => HttpResponse.json([]),
      ),
      http.get(`${API_BASE_URL}/test-releases/release-1`, () =>
        HttpResponse.json({
          releaseId: 'release-1',
          testId: 'test-1',
          testRevisionId: 'revision-1',
          title: 'Deep-linked test',
          description: '',
          instructions: null,
          maxPoints: 10,
          passingPercent: 60,
          isRequired: true,
          maxAttempts: 1,
          timeLimitSeconds: null,
          dueAt: null,
          stateStatus: 'AWAITING_REVIEW',
          itemCount: 0,
          items: [],
          attempt: null,
        }),
      ),
    )
    const user = userEvent.setup()
    renderPage(
      <>
        <StudentLessonTests lessonId="lesson-1" />
        <LocationProbe />
      </>,
      ['/app/student/lessons/lesson-1?test=release-1&from=dashboard'],
    )

    expect(
      await screen.findByRole('dialog', { name: 'Deep-linked test' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/app/student/lessons/lesson-1?from=dashboard',
    )
  })
})

function renderPage(element: ReactNode, initialEntries = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{element}</MemoryRouter>
    </QueryClientProvider>,
  )
}

function work(
  releaseId: string,
  overrides: Partial<StudentWorkItem> = {},
): StudentWorkItem {
  return {
    releaseId,
    testId: `test-${releaseId}`,
    title: releaseId,
    description: 'Short description',
    lesson: { id: 'lesson-1', title: 'Early states', position: 1 },
    releaseStatus: 'ACTIVE',
    isRequired: true,
    availability: 'AVAILABLE',
    stateStatus: 'NOT_STARTED',
    availableFrom: null,
    dueAt: '2026-09-15T12:00:00.000Z',
    maxPoints: 10,
    scorePoints: null,
    scorePercent: null,
    bestPoints: null,
    bestPercent: null,
    attemptCount: 0,
    lastActivityAt: null,
    attentionReason: null,
    isOverdue: false,
    canOpen: true,
    ...overrides,
  }
}

function dashboardFixture(): StudentDashboard {
  const revision = work('release-revision', {
    title: 'Revise chronology',
    stateStatus: 'NEEDS_REVISION',
    attentionReason: 'NEEDS_REVISION',
    attemptCount: 1,
  })
  const scheduled = work('release-scheduled', {
    title: 'Scheduled map',
    releaseStatus: 'SCHEDULED',
    availability: 'SCHEDULED',
    availableFrom: '2026-09-18T12:00:00.000Z',
    dueAt: null,
    canOpen: false,
  })
  return {
    class: { id: 'class-1', name: 'History club' },
    metrics: {
      requiredReleaseCount: 4,
      completedCount: 2,
      completionPercent: 50,
      averagePercent: 72,
      attentionCount: 1,
      nextDueAt: '2026-09-15T12:00:00.000Z',
    },
    attention: [revision],
    upcoming: [scheduled],
    continueLessons: [
      {
        id: 'lesson-1',
        title: 'Early states',
        position: 1,
        workCount: 2,
        requiredCount: 2,
        completedRequiredCount: 0,
        nextReleaseId: 'release-revision',
      },
    ],
  }
}

function tasksFixture(): StudentTasksPage {
  return {
    class: { id: 'class-1', name: 'History club' },
    items: [
      work('release-scheduled', {
        title: 'Scheduled map',
        releaseStatus: 'SCHEDULED',
        availability: 'SCHEDULED',
        availableFrom: '2026-09-18T12:00:00.000Z',
        dueAt: null,
        canOpen: false,
      }),
    ],
    nextCursor: null,
  }
}

function LocationProbe() {
  const location = useLocation()
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  )
}
