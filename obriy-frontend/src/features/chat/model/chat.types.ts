export type ChatRole = 'STUDENT' | 'TEACHER'
export type ChatAttachmentResourceType = 'IMAGE' | 'RAW'

export interface ChatPerson {
  id: string
  displayName: string
  avatarUrl: string | null
  classId: string | null
  className: string | null
}

export interface ChatAttachment {
  id: string
  originalFileName: string
  mimeType: string
  sizeBytes: number
  resourceType: ChatAttachmentResourceType
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  senderRole: ChatRole
  body: string | null
  editedAt: string | null
  createdAt: string
  isReadByCounterpart: boolean
  attachments: ChatAttachment[]
}

export interface ChatConversation {
  id: string
  counterpart: ChatPerson
  isWritable: boolean
  unreadCount: number
  lastMessage: ChatMessage | null
  createdAt: string
  lastMessageAt: string | null
}

export interface ChatConversationPage {
  items: ChatConversation[]
  nextCursor: string | null
}

export interface ChatContact extends ChatPerson {
  conversationId: string | null
}

export interface ChatContactPage {
  items: ChatContact[]
  nextCursor: string | null
}

export interface ChatMessagePage {
  conversation: ChatConversation
  items: ChatMessage[]
  nextCursor: string | null
}

export interface ChatUnreadCount {
  unreadCount: number
}

export interface ChatAttachmentDownload {
  url: string
}

export interface ChatRealtimeMessage {
  conversationId: string
  message: ChatMessage
}

