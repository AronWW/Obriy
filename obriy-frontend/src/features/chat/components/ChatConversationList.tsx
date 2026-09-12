import { MessageCircle, Plus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChatConversation } from '../model/chat.types'
import { ChatAvatar } from './ChatAvatar'
import styles from './ChatWorkspace.module.css'

interface Props {
  activeId?: string
  canStart: boolean
  conversations: ChatConversation[]
  hasMore: boolean
  isLoading: boolean
  error?: boolean
  loadMore: () => void
  onOpen: (id: string) => void
  onSearch: (value: string) => void
  onRetry?: () => void
  onStart: () => void
  search: string
}

export function ChatConversationList(props: Props) {
  const { t, i18n } = useTranslation()
  return (
    <aside className={styles.conversationPane} data-hidden-mobile={Boolean(props.activeId)}>
      <header className={styles.listHeader}>
        <div><h1>{t('chat.title')}</h1><p>{t('chat.subtitle')}</p></div>
        {props.canStart && <button aria-label={t('chat.actions.new')} onClick={props.onStart} type="button"><Plus size={18} /></button>}
      </header>
      <label className={styles.search}><Search size={16} /><span className={styles.srOnly}>{t('chat.search')}</span><input maxLength={100} onChange={(event) => props.onSearch(event.target.value)} placeholder={t('chat.search')} value={props.search} /></label>
      <div className={styles.conversationList}>
        {props.isLoading && <p className={styles.listState}>{t('chat.states.loading')}</p>}
        {props.error && <div className={styles.emptyList} role="alert"><strong>{t('chat.states.error')}</strong>{props.onRetry && <button className={styles.loadMore} onClick={props.onRetry} type="button">{t('chat.actions.retry')}</button>}</div>}
        {!props.isLoading && !props.error && props.conversations.length === 0 && <div className={styles.emptyList}><MessageCircle size={26} /><strong>{t('chat.states.emptyTitle')}</strong><span>{t('chat.states.emptyDescription')}</span></div>}
        {props.conversations.map((conversation) => (
          <button aria-current={props.activeId === conversation.id ? 'page' : undefined} className={styles.conversationRow} key={conversation.id} onClick={() => props.onOpen(conversation.id)} type="button">
            <ChatAvatar person={conversation.counterpart} />
            <span className={styles.conversationCopy}>
              <span><strong>{conversation.counterpart.displayName}</strong><time>{conversation.lastMessageAt ? formatTime(conversation.lastMessageAt, i18n.resolvedLanguage) : ''}</time></span>
              <small>{conversation.lastMessage?.body || (conversation.lastMessage?.attachments.length ? t('chat.attachmentMessage') : t('chat.noMessages'))}</small>
            </span>
            {conversation.unreadCount > 0 && <span className={styles.unread}>{conversation.unreadCount}</span>}
          </button>
        ))}
        {props.hasMore && <button className={styles.loadMore} onClick={props.loadMore} type="button">{t('chat.actions.more')}</button>}
      </div>
    </aside>
  )
}

function formatTime(value: string, language?: string): string {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'uk-UA', { day: '2-digit', month: 'short' }).format(new Date(value))
}
