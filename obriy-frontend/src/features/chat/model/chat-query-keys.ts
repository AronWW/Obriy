export const chatQueryKeys = {
  root: ['chat'] as const,
  conversations: (childId?: string) =>
    [...chatQueryKeys.root, 'conversations', childId ?? 'me'] as const,
  messages: (conversationId: string, childId?: string) =>
    [...chatQueryKeys.root, 'messages', childId ?? 'me', conversationId] as const,
  contacts: () => [...chatQueryKeys.root, 'contacts'] as const,
  unread: () => [...chatQueryKeys.root, 'unread'] as const,
}

