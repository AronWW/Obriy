import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../../i18n/config'
import { API_BASE_URL } from '../../../shared/config/env'
import { server } from '../../../test/server'
import { TeacherTestReleaseDialog } from './TeacherTestReleaseDialog'

describe('TeacherTestReleaseDialog', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('shows a class release and saves its settings', async () => {
    let requestBody: unknown
    server.use(
      http.get(
        `${API_BASE_URL}/lessons/lesson-1/tests/test-1/releases`,
        () => HttpResponse.json([releaseFixture]),
      ),
      http.patch(
        `${API_BASE_URL}/test-releases/release-1`,
        async ({ request }) => {
          requestBody = await request.json()
          return HttpResponse.json({ ...releaseFixture, xpReward: 250 })
        },
      ),
    )
    const user = userEvent.setup()
    renderDialog()

    expect(
      await screen.findByRole('dialog', { name: 'Class release settings' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('History class')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Configure' }))
    const xp = screen.getByRole('spinbutton', { name: 'Maximum XP reward' })
    await user.clear(xp)
    await user.type(xp, '250')
    await user.click(
      screen.getByRole('button', { name: 'Save for this class' }),
    )

    await waitFor(() =>
      expect(requestBody).toMatchObject({ xpReward: 250, isRequired: true }),
    )
  })

  it('publishes selected draft releases in one request', async () => {
    let requestBody: unknown
    server.use(
      http.get(
        `${API_BASE_URL}/lessons/lesson-1/tests/test-1/releases`,
        () => HttpResponse.json([releaseFixture]),
      ),
      http.post(
        `${API_BASE_URL}/lessons/lesson-1/tests/test-1/releases/publish`,
        async ({ request }) => {
          requestBody = await request.json()
          return HttpResponse.json([
            { ...releaseFixture, status: 'ACTIVE', publishedAt: new Date().toISOString() },
          ])
        },
      ),
    )
    const confirm = window.confirm
    window.confirm = () => true
    const user = userEvent.setup()
    renderDialog()

    await screen.findByText('History class')
    await user.click(screen.getByRole('checkbox', { name: 'Select class History class' }))
    await user.click(screen.getByRole('button', { name: 'Publish selected (1)' }))

    await waitFor(() =>
      expect(requestBody).toEqual({ releaseIds: ['release-1'] }),
    )
    window.confirm = confirm
  })
})

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <TeacherTestReleaseDialog
        lessonId="lesson-1"
        onClose={() => undefined}
        testId="test-1"
        title="Sources test"
      />
    </QueryClientProvider>,
  )
}

const releaseFixture = {
  id: 'release-1',
  lessonId: 'lesson-1',
  testId: 'test-1',
  testRevisionId: 'revision-1',
  class: { id: 'class-1', name: 'History class' },
  status: 'DRAFT',
  isRequired: true,
  availableFrom: null,
  dueAt: null,
  maxAttempts: 1,
  latePolicy: 'DISALLOW',
  latePenaltyPercent: null,
  xpReward: 100,
  attemptCount: 0,
  inProgressCount: 0,
  publishedAt: null,
  closedAt: null,
  updatedAt: '2026-09-10T10:00:00.000Z',
}
