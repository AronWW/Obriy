import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n/config'
import { API_BASE_URL } from '../../shared/config/env'
import { server } from '../../test/server'
import { useSessionStore } from '../auth/model/session.store'
import { ChatWorkspacePage } from './pages/ChatWorkspacePage'
import { ParentChatPage } from './pages/ParentChatPage'

const socket = vi.hoisted(() => ({
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
}))

vi.mock('./model/chat-realtime', () => ({ createChatSocket: vi.fn(() => socket) }))

const conversation = {
  id: 'conversation-1',
  counterpart: { id: 'teacher-1', displayName: 'Olena Teacher', avatarUrl: null, classId: 'class-1', className: 'History' },
  isWritable: true,
  unreadCount: 1,
  lastMessage: null,
  createdAt: '2026-09-12T10:00:00.000Z',
  lastMessageAt: null,
}

describe('chat workspace', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    vi.clearAllMocks()
    useSessionStore.setState({
      accessToken: 'student-token',
      status: 'authenticated',
      user: {
        id: 'student-1', email: 'student@example.com', role: 'STUDENT', status: 'ACTIVE', emailVerifiedAt: null, hasPassword: true,
        profile: { displayName: 'Student', avatarUrl: null, bio: null, subjectArea: null, preferredLocale: 'EN' },
      },
    })
  })

  it('opens a conversation, marks it read and sends a message', async () => {
    let readCalls = 0
    let sentBody = ''
    server.use(
      http.get(`${API_BASE_URL}/chat/conversations`, () => HttpResponse.json({ items: [conversation], nextCursor: null })),
      http.get(`${API_BASE_URL}/chat/conversations/conversation-1/messages`, () => HttpResponse.json({ conversation, items: [], nextCursor: null })),
      http.post(`${API_BASE_URL}/chat/conversations/conversation-1/read`, () => { readCalls += 1; return new HttpResponse(null, { status: 204 }) }),
      http.post(`${API_BASE_URL}/chat/conversations/conversation-1/messages`, async ({ request }) => {
        const form = await request.formData()
        sentBody = String(form.get('body'))
        return HttpResponse.json({ id: 'message-1', conversationId: 'conversation-1', senderId: 'student-1', senderRole: 'STUDENT', body: sentBody, editedAt: null, createdAt: '2026-09-12T10:01:00.000Z', isReadByCounterpart: false, attachments: [] })
      }),
    )
    const user = userEvent.setup()
    renderAt('/app/student/messages')

    await user.click(await screen.findByRole('button', { name: /Olena Teacher/ }))
    expect(await screen.findByPlaceholderText('Write a message…')).toBeInTheDocument()
    await waitFor(() => expect(readCalls).toBeGreaterThan(0))
    await user.type(screen.getByPlaceholderText('Write a message…'), 'Hello teacher')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(sentBody).toBe('Hello teacher'))
    expect(socket.emit).toHaveBeenCalledWith('chat.watch', expect.objectContaining({ conversationId: 'conversation-1' }))
  })

  it('keeps the parent view read-only and does not mark child messages read', async () => {
    let readCalls = 0
    server.use(
      http.get(`${API_BASE_URL}/parent/children/student-1/conversations`, () => HttpResponse.json({ items: [{ ...conversation, isWritable: false, unreadCount: 0 }], nextCursor: null })),
      http.get(`${API_BASE_URL}/parent/children/student-1/conversations/conversation-1/messages`, () => HttpResponse.json({ conversation: { ...conversation, isWritable: false }, items: [], nextCursor: null })),
      http.post(`${API_BASE_URL}/chat/conversations/conversation-1/read`, () => { readCalls += 1; return new HttpResponse(null, { status: 204 }) }),
    )
    useSessionStore.setState((state) => ({ user: state.user ? { ...state.user, id: 'parent-1', role: 'PARENT' } : null }))
    const user = userEvent.setup()
    renderAt('/app/parent/child/student-1/messages', true)

    await user.click(await screen.findByRole('button', { name: /Olena Teacher/ }))
    expect(await screen.findByText('Supervised view')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Write a message…')).not.toBeInTheDocument()
    expect(readCalls).toBe(0)
    expect(socket.emit).not.toHaveBeenCalled()
  })
})

function renderAt(initialEntry: string, parent = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          {parent ? (
            <>
              <Route path="/app/parent/child/:childId/messages" element={<ParentChatPage />} />
              <Route path="/app/parent/child/:childId/messages/:conversationId" element={<ParentChatPage />} />
            </>
          ) : (
            <>
              <Route path="/app/student/messages" element={<ChatWorkspacePage />} />
              <Route path="/app/student/messages/:conversationId" element={<ChatWorkspacePage />} />
            </>
          )}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
