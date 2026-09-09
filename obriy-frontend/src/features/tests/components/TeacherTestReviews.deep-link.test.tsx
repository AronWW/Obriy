import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../../i18n/config'
import { API_BASE_URL } from '../../../shared/config/env'
import { server } from '../../../test/server'
import { TeacherTestReviews } from './TeacherTestReviews'

describe('TeacherTestReviews direct attempt', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('opens the requested attempt even when it is not in the first list page', async () => {
    server.use(
      http.get(
        `${API_BASE_URL}/lessons/lesson-1/test-attempts`,
        () => HttpResponse.json({ items: [], nextCursor: null }),
      ),
      http.get(
        `${API_BASE_URL}/lessons/lesson-1/test-attempts/attempt-9`,
        () =>
          HttpResponse.json({
            attemptId: 'attempt-9',
            releaseId: 'release-1',
            testId: 'test-1',
            testTitle: 'Written sources',
            attemptNumber: 1,
            status: 'AWAITING_REVIEW',
            maxPoints: 5,
            scorePoints: null,
            scorePercent: null,
            isPassed: null,
            pendingReviewCount: 1,
            studentId: 'student-1',
            studentName: 'Marta',
            classId: 'class-1',
            className: 'History club',
            answers: [],
            submittedAt: '2026-09-09T09:30:00.000Z',
            gradedAt: null,
          }),
      ),
    )
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <TeacherTestReviews
          initialAttemptId="attempt-9"
          lessonId="lesson-1"
        />
      </QueryClientProvider>,
    )

    expect(
      await screen.findByRole('dialog', { name: 'Written sources' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Marta/)).toBeInTheDocument()
  })
})
