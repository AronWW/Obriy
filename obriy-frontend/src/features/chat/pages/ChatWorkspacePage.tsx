import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import type { Socket } from 'socket.io-client'
import { useSessionStore } from '../../auth/model/session.store'
import { chatApi } from '../api/chat.api'
import { ChatConversationList } from '../components/ChatConversationList'
import { ChatThread } from '../components/ChatThread'
import { chatQueryKeys } from '../model/chat-query-keys'
import { createChatSocket } from '../model/chat-realtime'
import type { ChatContact } from '../model/chat.types'
import styles from '../components/ChatWorkspace.module.css'

export function ChatWorkspacePage() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const user = useSessionStore((state) => state.user)
  const accessToken = useSessionStore((state) => state.accessToken)
  const basePath = user?.role === 'TEACHER' ? '/app/teacher/messages' : '/app/student/messages'
  const [search, setSearch] = useState('')
  const [showContacts, setShowContacts] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [connected, setConnected] = useState(true)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const socketRef = useRef<Socket | null>(null)

  const conversationsQuery = useInfiniteQuery({
    queryKey: [...chatQueryKeys.conversations(), search],
    queryFn: ({ pageParam }) => chatApi.conversations(pageParam, search || undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  const messagesQuery = useInfiniteQuery({
    queryKey: chatQueryKeys.messages(conversationId ?? 'none'),
    queryFn: ({ pageParam }) => chatApi.messages(conversationId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(conversationId),
  })
  const conversations = useMemo(() => conversationsQuery.data?.pages.flatMap((page) => page.items) ?? [], [conversationsQuery.data])
  const messages = useMemo(() => [...(messagesQuery.data?.pages ?? [])].reverse().flatMap((page) => page.items), [messagesQuery.data])
  const activeConversation = messagesQuery.data?.pages[0]?.conversation ?? conversations.find((item) => item.id === conversationId)

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: chatQueryKeys.root })
  }, [queryClient])

  useEffect(() => {
    if (!accessToken) return
    const socket = createChatSocket(accessToken)
    socketRef.current = socket
    socket.on('connect', () => { setConnected(true); refresh() })
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', () => setConnected(false))
    socket.on('chat.message.created', refresh)
    socket.on('chat.message.updated', refresh)
    socket.on('chat.read', refresh)
    socket.on('chat.typing', (payload: { conversationId?: string; isTyping?: boolean }) => {
      if (payload.conversationId !== conversationId) return
      setIsTyping(payload.isTyping === true)
      if (typingTimer.current) clearTimeout(typingTimer.current)
      if (payload.isTyping) typingTimer.current = setTimeout(() => setIsTyping(false), 3500)
    })
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current)
      socket.disconnect()
      socketRef.current = null
    }
  }, [accessToken, conversationId, refresh])

  useEffect(() => {
    if (!conversationId || !accessToken) return
    const focused = () => {
      socketRef.current?.emit('chat.watch', { conversationId, focused: true })
      void chatApi.markRead(conversationId).then(refresh)
    }
    const blurred = () => socketRef.current?.emit('chat.watch', { conversationId, focused: false })
    focused()
    window.addEventListener('focus', focused)
    window.addEventListener('blur', blurred)
    return () => {
      blurred()
      window.removeEventListener('focus', focused)
      window.removeEventListener('blur', blurred)
    }
  }, [accessToken, conversationId, refresh])

  const sendMutation = useMutation({
    mutationFn: ({ body, files }: { body: string; files: File[] }) => chatApi.send(conversationId!, body, files),
    onSuccess: refresh,
  })
  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => chatApi.edit(id, body),
    onSuccess: refresh,
  })

  return (
    <div className={styles.page}>
      {!connected && <p className={styles.connectionState}>{t('chat.states.disconnected')}</p>}
      <div className={styles.shell}>
        <ChatConversationList
          activeId={conversationId}
          canStart
          conversations={conversations}
          error={conversationsQuery.isError}
          hasMore={Boolean(conversationsQuery.hasNextPage)}
          isLoading={conversationsQuery.isPending}
          loadMore={() => void conversationsQuery.fetchNextPage()}
          onOpen={(id) => navigate(`${basePath}/${id}`)}
          onSearch={setSearch}
          onRetry={() => void conversationsQuery.refetch()}
          onStart={() => setShowContacts(true)}
          search={search}
        />
        {conversationId && activeConversation ? (
          <ChatThread
            conversation={activeConversation}
            currentUserId={user?.id}
            error={messagesQuery.isError}
            isLoading={messagesQuery.isPending}
            isSending={sendMutation.isPending}
            sendError={sendMutation.isError}
            isTyping={isTyping}
            messages={messages}
            nextCursor={Boolean(messagesQuery.hasNextPage)}
            onBack={() => navigate(basePath)}
            onEdit={async (id, body) => { await editMutation.mutateAsync({ id, body }) }}
            onLoadOlder={() => void messagesQuery.fetchNextPage()}
            onSend={async (body, files) => { await sendMutation.mutateAsync({ body, files }) }}
            onTyping={() => socketRef.current?.emit('chat.typing', { conversationId, isTyping: true })}
          />
        ) : (
          <section className={styles.threadPlaceholder}><span>{t('chat.states.selectConversation')}</span></section>
        )}
      </div>
      {showContacts && <ContactsDialog basePath={basePath} onClose={() => setShowContacts(false)} />}
    </div>
  )
}

function ContactsDialog({ basePath, onClose }: { basePath: string; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const contactsQuery = useInfiniteQuery({
    queryKey: [...chatQueryKeys.contacts(), search],
    queryFn: ({ pageParam }) => chatApi.contacts(pageParam, search || undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  const mutation = useMutation({ mutationFn: chatApi.createConversation })
  const contacts = contactsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const groups = groupContacts(contacts, t('chat.noClass'))
  const open = async (counterpartId: string, existingId: string | null) => {
    const id = existingId ?? (await mutation.mutateAsync(counterpartId)).id
    await queryClient.invalidateQueries({ queryKey: chatQueryKeys.conversations() })
    onClose()
    navigate(`${basePath}/${id}`)
  }
  return (
    <div className={styles.dialogBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }} role="presentation">
      <section aria-modal="true" className={`${styles.dialog} ${styles.contactsDialog}`} role="dialog">
        <header><div><h2>{t('chat.contacts.title')}</h2><p>{t('chat.contacts.description')}</p></div><button aria-label={t('chat.actions.close')} onClick={onClose} type="button"><X size={18} /></button></header>
        <label className={styles.search}><Search size={16} /><input maxLength={100} onChange={(event) => setSearch(event.target.value)} placeholder={t('chat.searchContacts')} value={search} /></label>
        <div className={styles.contactList}>
          {contactsQuery.isPending && <p>{t('chat.states.loading')}</p>}
          {!contactsQuery.isPending && contacts.length === 0 && <p>{t('chat.contacts.empty')}</p>}
          {groups.map(([className, entries]) => <section className={styles.contactGroup} key={className}><h3>{className}</h3>{entries.map((contact) => <button disabled={mutation.isPending} key={contact.id} onClick={() => void open(contact.id, contact.conversationId)} type="button"><span><strong>{contact.displayName}</strong><small>{contact.className ?? t('chat.noClass')}</small></span><span>{contact.conversationId ? t('chat.actions.open') : t('chat.actions.start')}</span></button>)}</section>)}
        </div>
      </section>
    </div>
  )
}

function groupContacts(contacts: ChatContact[], fallback: string): Array<[string, ChatContact[]]> {
  const groups = new Map<string, ChatContact[]>()
  for (const contact of contacts) {
    const key = contact.className ?? fallback
    groups.set(key, [...(groups.get(key) ?? []), contact])
  }
  return Array.from(groups)
}
