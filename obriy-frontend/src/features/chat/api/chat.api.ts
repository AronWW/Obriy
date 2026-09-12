import { authorizedRequest } from '../../auth/model/session.service'
import type {
  ChatAttachmentDownload,
  ChatContactPage,
  ChatConversation,
  ChatConversationPage,
  ChatMessage,
  ChatMessagePage,
  ChatUnreadCount,
} from '../model/chat.types'

function pageParams(cursor?: string, search?: string): string {
  const params = new URLSearchParams({ limit: '30' })
  if (cursor) params.set('cursor', cursor)
  if (search) params.set('search', search)
  return params.toString()
}

export const chatApi = {
  conversations(cursor?: string, search?: string) {
    return authorizedRequest<ChatConversationPage>(
      `/chat/conversations?${pageParams(cursor, search)}`,
    )
  },
  contacts(cursor?: string, search?: string) {
    return authorizedRequest<ChatContactPage>(
      `/chat/contacts?${pageParams(cursor, search)}`,
    )
  },
  createConversation(counterpartId: string) {
    return authorizedRequest<ChatConversation>('/chat/conversations', {
      method: 'POST',
      body: { counterpartId },
    })
  },
  messages(conversationId: string, cursor?: string) {
    return authorizedRequest<ChatMessagePage>(
      `/chat/conversations/${conversationId}/messages?${pageParams(cursor)}`,
    )
  },
  parentConversations(childId: string, cursor?: string, search?: string) {
    return authorizedRequest<ChatConversationPage>(
      `/parent/children/${childId}/conversations?${pageParams(cursor, search)}`,
    )
  },
  parentMessages(childId: string, conversationId: string, cursor?: string) {
    return authorizedRequest<ChatMessagePage>(
      `/parent/children/${childId}/conversations/${conversationId}/messages?${pageParams(cursor)}`,
    )
  },
  send(conversationId: string, body: string, files: File[]) {
    const data = new FormData()
    data.set('clientMessageId', crypto.randomUUID())
    if (body.trim()) data.set('body', body.trim())
    files.forEach((file) => data.append('files', file))
    return authorizedRequest<ChatMessage>(
      `/chat/conversations/${conversationId}/messages`,
      { method: 'POST', body: data },
    )
  },
  edit(messageId: string, body: string) {
    return authorizedRequest<ChatMessage>(`/chat/messages/${messageId}`, {
      method: 'PATCH',
      body: { body },
    })
  },
  markRead(conversationId: string) {
    return authorizedRequest<void>(`/chat/conversations/${conversationId}/read`, {
      method: 'POST',
    })
  },
  unread() {
    return authorizedRequest<ChatUnreadCount>('/chat/unread-count')
  },
  attachment(attachmentId: string) {
    return authorizedRequest<ChatAttachmentDownload>(
      `/chat/attachments/${attachmentId}`,
    )
  },
}

