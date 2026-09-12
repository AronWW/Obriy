import { useInfiniteQuery } from '@tanstack/react-query'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { chatApi } from '../api/chat.api'
import { ChatConversationList } from '../components/ChatConversationList'
import { ChatThread } from '../components/ChatThread'
import { chatQueryKeys } from '../model/chat-query-keys'
import styles from '../components/ChatWorkspace.module.css'

export function ParentChatPage() {
  const { childId = '', conversationId } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const basePath = `/app/parent/child/${childId}/messages`
  const conversationsQuery = useInfiniteQuery({
    queryKey: [...chatQueryKeys.conversations(childId), search],
    queryFn: ({ pageParam }) => chatApi.parentConversations(childId, pageParam, search || undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(childId),
  })
  const messagesQuery = useInfiniteQuery({
    queryKey: chatQueryKeys.messages(conversationId ?? 'none', childId),
    queryFn: ({ pageParam }) => chatApi.parentMessages(childId, conversationId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(childId && conversationId),
  })
  const conversations = useMemo(() => conversationsQuery.data?.pages.flatMap((page) => page.items) ?? [], [conversationsQuery.data])
  const messages = useMemo(() => [...(messagesQuery.data?.pages ?? [])].reverse().flatMap((page) => page.items), [messagesQuery.data])
  const active = messagesQuery.data?.pages[0]?.conversation ?? conversations.find((item) => item.id === conversationId)
  return (
    <div className={`${styles.page} ${styles.parentPage}`}>
      <Link className={styles.parentBack} to={`/app/parent/child/${childId}`}><ArrowLeft size={16} />{t('chat.actions.backChild')}</Link>
      <div className={styles.supervisionNote}><ShieldCheck size={18} /><span><strong>{t('chat.parent.title')}</strong>{t('chat.parent.description')}</span></div>
      <div className={styles.shell}>
        <ChatConversationList activeId={conversationId} canStart={false} conversations={conversations} error={conversationsQuery.isError} hasMore={Boolean(conversationsQuery.hasNextPage)} isLoading={conversationsQuery.isPending} loadMore={() => void conversationsQuery.fetchNextPage()} onOpen={(id) => navigate(`${basePath}/${id}`)} onRetry={() => void conversationsQuery.refetch()} onSearch={setSearch} onStart={() => undefined} search={search} />
        {conversationId && active ? <ChatThread conversation={active} currentUserId={childId} error={messagesQuery.isError} isLoading={messagesQuery.isPending} messages={messages} nextCursor={Boolean(messagesQuery.hasNextPage)} onBack={() => navigate(basePath)} onLoadOlder={() => void messagesQuery.fetchNextPage()} readOnly /> : <section className={styles.threadPlaceholder}><span>{t('chat.states.selectConversation')}</span></section>}
      </div>
    </div>
  )
}
