import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n/config'
import { API_BASE_URL } from '../../shared/config/env'
import { server } from '../../test/server'
import type {
  TeacherClassAnalytics,
  TeacherStudentAnalytics,
} from './model/teacher-analytics.types'
import { TeacherAnalyticsPage } from './pages/TeacherAnalyticsPage'
import { TeacherStudentAnalyticsPage } from './pages/TeacherStudentAnalyticsPage'

describe('Teacher analytics pages', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('selects the requested class and switches between students and materials', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API_BASE_URL}/classes`, () => HttpResponse.json(classesFixture)),
      http.get(`${API_BASE_URL}/teacher/analytics/classes/class-2`, () =>
        HttpResponse.json(classAnalyticsFixture),
      ),
      http.get(`${API_BASE_URL}/teacher/leaderboard/classes/class-2`, () =>
        HttpResponse.json(teacherLeaderboardFixture),
      ),
    )
    renderAnalytics('/app/teacher/analytics?classId=class-2&tab=students')

    expect(await screen.findByRole('heading', { name: 'Class analytics' })).toBeInTheDocument()
    expect(await screen.findByRole('combobox', { name: 'Class' })).toHaveValue('class-2')
    expect(await screen.findByRole('link', { name: 'Open results for Marta Ivaniuk' })).toHaveAttribute(
      'href',
      '/app/teacher/analytics/classes/class-2/students/student-1',
    )
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('tab', { name: 'Materials' }))
    expect(await screen.findByText('Source analysis')).toBeInTheDocument()
    expect(screen.getByText('Optional')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Leaderboard' }))
    expect(await screen.findByRole('heading', { name: 'Class leaders' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Marta Ivaniuk/ })[0]).toHaveAttribute(
      'href',
      '/app/teacher/analytics/classes/class-2/students/student-1',
    )
  })

  it('searches students and shows the no-result state', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API_BASE_URL}/classes`, () => HttpResponse.json(classesFixture)),
      http.get(`${API_BASE_URL}/teacher/analytics/classes/class-1`, () =>
        HttpResponse.json(classAnalyticsFixture),
      ),
    )
    renderAnalytics('/app/teacher/analytics')

    const search = await screen.findByRole('searchbox', { name: 'Search students' })
    await user.type(search, 'missing')
    expect(screen.getByText('No students match this search.')).toBeInTheDocument()
  })

  it('offers a useful empty state when the teacher has no classes', async () => {
    server.use(
      http.get(`${API_BASE_URL}/classes`, () => HttpResponse.json([])),
    )
    renderAnalytics('/app/teacher/analytics')

    expect(await screen.findByRole('heading', { name: 'Create a class first' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create class' })).toHaveAttribute(
      'href',
      '/app/teacher/classes?create=1',
    )
  })

  it('renders every attempt and deep-links reviewable attempts', async () => {
    server.use(
      http.get(
        `${API_BASE_URL}/teacher/analytics/classes/class-2/students/student-1`,
        () => HttpResponse.json(studentAnalyticsFixture),
      ),
    )
    renderStudent('/app/teacher/analytics/classes/class-2/students/student-1')

    expect(await screen.findByRole('heading', { name: 'Marta Ivaniuk' })).toBeInTheDocument()
    expect(screen.getByText('Attempt #2')).toBeInTheDocument()
    expect(screen.getByText('Attempt #1')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Review/ })[0]).toHaveAttribute(
      'href',
      '/app/teacher/lessons/lesson-1/edit?reviewAttempt=attempt-2',
    )
  })
})

function providers(children: React.ReactNode, initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function renderAnalytics(initialEntry: string) {
  return render(providers(<Routes><Route path="/app/teacher/analytics" element={<TeacherAnalyticsPage />} /></Routes>, initialEntry))
}

function renderStudent(initialEntry: string) {
  return render(providers(<Routes><Route path="/app/teacher/analytics/classes/:classId/students/:studentId" element={<TeacherStudentAnalyticsPage />} /></Routes>, initialEntry))
}

const classesFixture = [
  { id: 'class-1', name: 'First class', studentCount: 1, createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z' },
  { id: 'class-2', name: 'History club', studentCount: 1, createdAt: '2026-09-02T10:00:00.000Z', updatedAt: '2026-09-02T10:00:00.000Z' },
]

const statusCounts = { notStarted: 0, inProgress: 0, awaitingReview: 1, needsRevision: 0, completed: 1, expired: 0 }

const teacherLeaderboardFixture = {
  class: { id: 'class-2', name: 'History club', studentCount: 1 },
  period: { type: 'WEEK', startAt: '2026-09-06T21:00:00.000Z', endAt: '2026-09-13T21:00:00.000Z' },
  entries: [{ id: 'student-1', displayName: 'Marta Ivaniuk', avatarUrl: null, rank: 1, periodXp: 100, totalXp: 100, level: 1, showcase: [], lastXpAt: '2026-09-09T10:00:00.000Z', isCurrentUser: false }],
  selfEntry: null,
  nextCursor: null,
}

const classAnalyticsFixture: TeacherClassAnalytics = {
  class: { id: 'class-2', name: 'History club' },
  metrics: { studentCount: 1, requiredReleaseCount: 2, requiredWorkCount: 2, completedWorkCount: 1, completionPercent: 50, averagePercent: 80, awaitingReviewCount: 1 },
  students: [{ id: 'student-1', displayName: 'Marta Ivaniuk', avatarUrl: null, requiredCount: 2, completedCount: 1, completionPercent: 50, averagePercent: 80, statuses: statusCounts, lastActivityAt: '2026-09-09T10:00:00.000Z' }],
  lessons: [{ id: 'lesson-1', title: 'Kyivan Rus', position: 1, requiredTestCount: 1, completionPercent: 100, averagePercent: 80, tests: [
    { releaseId: 'release-1', testId: 'test-1', title: 'Source analysis', releaseStatus: 'ACTIVE', isRequired: true, availableFrom: null, dueAt: '2026-09-20T10:00:00.000Z', maxPoints: 10, passingPercent: 60, studentCount: 1, completionPercent: 100, averagePercent: 80, statuses: statusCounts },
    { releaseId: 'release-2', testId: 'test-2', title: 'Extra practice', releaseStatus: 'SCHEDULED', isRequired: false, availableFrom: '2026-09-15T10:00:00.000Z', dueAt: null, maxPoints: 5, passingPercent: 50, studentCount: 1, completionPercent: 0, averagePercent: 0, statuses: { ...statusCounts, notStarted: 1, awaitingReview: 0, completed: 0 } },
  ] }],
}

const studentAnalyticsFixture: TeacherStudentAnalytics = {
  class: { id: 'class-2', name: 'History club' },
  student: classAnalyticsFixture.students[0],
  lessons: [{ id: 'lesson-1', title: 'Kyivan Rus', position: 1, tests: [{
    releaseId: 'release-1', testId: 'test-1', title: 'Source analysis', releaseStatus: 'ACTIVE', isRequired: true, status: 'AWAITING_REVIEW', maxPoints: 10, passingPercent: 60, scorePoints: null, scorePercent: null, bestPoints: 8, bestPercent: 80, attemptCount: 2, isLate: false, availableFrom: null, dueAt: '2026-09-20T10:00:00.000Z', lastActivityAt: '2026-09-09T10:00:00.000Z', attempts: [
      { id: 'attempt-2', attemptNumber: 2, status: 'AWAITING_REVIEW', maxPoints: 10, scorePoints: null, scorePercent: null, isPassed: null, pendingReviewCount: 1, isLate: false, startedAt: '2026-09-09T09:00:00.000Z', submittedAt: '2026-09-09T10:00:00.000Z', gradedAt: null },
      { id: 'attempt-1', attemptNumber: 1, status: 'GRADED', maxPoints: 10, scorePoints: 8, scorePercent: 80, isPassed: true, pendingReviewCount: 0, isLate: false, startedAt: '2026-09-08T09:00:00.000Z', submittedAt: '2026-09-08T10:00:00.000Z', gradedAt: '2026-09-08T11:00:00.000Z' },
    ],
  }] }],
}
