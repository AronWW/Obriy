import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n/config'
import { API_BASE_URL } from '../../../shared/config/env'
import { server } from '../../../test/server'
import { useSessionStore } from '../../auth/model/session.store'
import { notificationRoute } from '../model/notification-route'
import { NotificationCenter } from './NotificationCenter'

const socket = vi.hoisted(() => ({
  on: vi.fn(),
  disconnect: vi.fn(),
}))

vi.mock('socket.io-client', () => ({ io: vi.fn(() => socket) }))

describe('NotificationCenter', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    vi.clearAllMocks()
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
          displayName: 'Student',
          avatarUrl: null,
          bio: null,
          gradeLevel: 8,
          subjectArea: null,
          preferredLocale: 'EN',
        },
      },
    })
  })

  it('does not read on panel open and reads when navigating from an item', async () => {
    let readCalls = 0
    server.use(
      http.get(`${API_BASE_URL}/notifications/unread-count`, () =>
        HttpResponse.json({ unreadCount: 1 }),
      ),
      http.get(`${API_BASE_URL}/notifications`, () =>
        HttpResponse.json({
          items: [
            {
              id: 'notification-1',
              type: 'TEST_AVAILABLE',
              subjectStudentId: 'student-1',
              payload: {
                lessonId: 'lesson-1',
                releaseId: 'release-1',
                testTitle: 'Ancient cities',
              },
              isRead: false,
              readAt: null,
              createdAt: '2026-09-11T12:00:00.000Z',
            },
          ],
          nextCursor: null,
          unreadCount: 1,
        }),
      ),
      http.patch(`${API_BASE_URL}/notifications/notification-1/read`, () => {
        readCalls += 1
        return HttpResponse.json({
          id: 'notification-1',
          type: 'TEST_AVAILABLE',
          subjectStudentId: 'student-1',
          payload: {},
          isRead: true,
          readAt: '2026-09-11T12:01:00.000Z',
          createdAt: '2026-09-11T12:00:00.000Z',
        })
      }),
    )
    const user = userEvent.setup()
    renderCenter()

    await user.click(screen.getByRole('button', { name: 'Open notifications' }))
    expect(await screen.findByText('Ancient cities', { exact: false })).toBeInTheDocument()
    expect(readCalls).toBe(0)

    await user.click(screen.getByText('Ancient cities', { exact: false }))
    await waitFor(() => expect(readCalls).toBe(1))
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/app/student/lessons/lesson-1?test=release-1',
    )
  })

  it('filters unread notifications through the REST query', async () => {
    const unreadValues: string[] = []
    server.use(
      http.get(`${API_BASE_URL}/notifications/unread-count`, () =>
        HttpResponse.json({ unreadCount: 0 }),
      ),
      http.get(`${API_BASE_URL}/notifications`, ({ request }) => {
        unreadValues.push(new URL(request.url).searchParams.get('unreadOnly') ?? '')
        return HttpResponse.json({ items: [], nextCursor: null, unreadCount: 0 })
      }),
    )
    const user = userEvent.setup()
    renderCenter()
    await user.click(screen.getByRole('button', { name: 'Open notifications' }))
    await screen.findByText('There are no updates yet.')
    await user.click(screen.getByRole('button', { name: 'Unread' }))
    await screen.findByText('All notifications are read.')
    expect(unreadValues).toEqual(expect.arrayContaining(['false', 'true']))
  })

  it('routes teacher reviews, parent child updates, and rewards safely', () => {
    const base = {
      id: 'notification-1',
      subjectStudentId: 'student-1',
      isRead: false,
      readAt: null,
      createdAt: '2026-09-11T12:00:00.000Z',
    } as const
    expect(notificationRoute({
      ...base,
      type: 'TEST_REVIEW_REQUIRED',
      payload: { lessonId: 'lesson-1', attemptId: 'attempt-1' },
    }, 'TEACHER')).toBe(
      '/app/teacher/lessons/lesson-1/edit?reviewAttempt=attempt-1',
    )
    expect(notificationRoute({
      ...base,
      type: 'TEST_GRADED',
      payload: {},
    }, 'PARENT')).toBe('/app/parent/child/student-1')
    expect(notificationRoute({
      ...base,
      type: 'BADGE_UNLOCKED',
      payload: {},
    }, 'STUDENT')).toBe('/app/student/achievements')
    expect(notificationRoute({
      ...base,
      type: 'CHAT_MESSAGE',
      payload: { conversationId: 'conversation-1' },
    }, 'TEACHER')).toBe('/app/teacher/messages/conversation-1')
  })
})

function renderCenter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app/student']}>
        <NotificationCenter />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function Location() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}
