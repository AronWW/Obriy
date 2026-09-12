import { ArrowLeft, Edit3, FilePlus2, LoaderCircle, Send, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatConversation, ChatMessage } from '../model/chat.types'
import { AttachmentLink } from './AttachmentLink'
import { ChatAvatar } from './ChatAvatar'
import styles from './ChatWorkspace.module.css'

interface Props {
  conversation: ChatConversation
  currentUserId?: string
  error?: boolean
  isLoading: boolean
  isSending?: boolean
  sendError?: boolean
  isTyping?: boolean
  messages: ChatMessage[]
  nextCursor?: boolean
  onBack: () => void
  onEdit?: (messageId: string, body: string) => Promise<void>
  onLoadOlder: () => void
  onSend?: (body: string, files: File[]) => Promise<void>
  onTyping?: () => void
  readOnly?: boolean
}

export function ChatThread(props: Props) {
  const { t, i18n } = useTranslation()
  const [body, setBody] = useState('')
  const [renderedAt] = useState(() => Date.now())
  const [files, setFiles] = useState<File[]>([])
  const [editing, setEditing] = useState<ChatMessage | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const canSend = Boolean(body.trim() || files.length) && !props.isSending
  const ordered = useMemo(() => uniqueMessages(props.messages), [props.messages])

  const submit = async () => {
    if (!canSend || !props.onSend) return
    await props.onSend(body, files)
    setBody('')
    setFiles([])
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <section className={styles.threadPane} data-visible-mobile="true">
      <header className={styles.threadHeader}>
        <button className={styles.backButton} onClick={props.onBack} type="button" aria-label={t('chat.actions.back')}><ArrowLeft size={19} /></button>
        <ChatAvatar person={props.conversation.counterpart} />
        <div><h2>{props.conversation.counterpart.displayName}</h2><p>{props.conversation.counterpart.className ?? t('chat.noClass')}</p></div>
        {!props.conversation.isWritable && <span className={styles.readOnlyLabel}>{t('chat.readOnly.short')}</span>}
      </header>
      {!props.conversation.isWritable && <p className={styles.readOnlyBanner}>{t('chat.readOnly.description')}</p>}
      <div className={styles.messages} aria-live="polite">
        {props.nextCursor && <button className={styles.loadMore} onClick={props.onLoadOlder} type="button">{t('chat.actions.older')}</button>}
        {props.isLoading && <p className={styles.messageState}><LoaderCircle className={styles.spin} size={20} />{t('chat.states.loading')}</p>}
        {props.error && <p className={styles.messageState} role="alert">{t('chat.states.error')}</p>}
        {!props.isLoading && ordered.length === 0 && <p className={styles.messageState}>{t('chat.states.noMessages')}</p>}
        {ordered.map((message) => {
          const mine = message.senderId === props.currentUserId
          const editable = mine && Boolean(message.body) && renderedAt - new Date(message.createdAt).getTime() <= 15 * 60_000 && props.conversation.isWritable
          return (
            <article className={styles.message} data-mine={mine} key={message.id}>
              {message.body && <p>{message.body}</p>}
              {message.attachments.map((attachment) => <AttachmentLink attachment={attachment} key={attachment.id} />)}
              <footer>
                <time dateTime={message.createdAt}>{formatDate(message.createdAt, i18n.resolvedLanguage)}</time>
                {message.editedAt && <span>{t('chat.edited')}</span>}
                {mine && <span>{t(message.isReadByCounterpart ? 'chat.read' : 'chat.sent')}</span>}
                {editable && props.onEdit && <button aria-label={t('chat.actions.edit')} onClick={() => setEditing(message)} type="button"><Edit3 size={13} /></button>}
              </footer>
            </article>
          )
        })}
        {props.isTyping && <p className={styles.typing}>{t('chat.typing', { name: props.conversation.counterpart.displayName })}</p>}
      </div>
      {!props.readOnly && props.conversation.isWritable && props.onSend && (
        <div className={styles.composer}>
          {props.sendError && <p className={styles.composerError} role="alert">{t('chat.states.sendError')}</p>}
          {files.length > 0 && <div className={styles.fileChips}>{files.map((file, index) => <span key={`${file.name}-${index}`}>{file.name}<button aria-label={t('chat.actions.removeFile')} onClick={() => setFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))} type="button"><X size={12} /></button></span>)}</div>}
          <div className={styles.composerRow}>
            <label className={styles.fileButton}><FilePlus2 size={19} /><span className={styles.srOnly}>{t('chat.actions.attach')}</span><input accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.pptx,.xlsx" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))} ref={inputRef} type="file" /></label>
            <textarea maxLength={4000} onChange={(event) => { setBody(event.target.value); props.onTyping?.() }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit() } }} placeholder={t('chat.composer')} rows={1} value={body} />
            <button aria-label={t('chat.actions.send')} className={styles.sendButton} disabled={!canSend} onClick={() => void submit()} type="button">{props.isSending ? <LoaderCircle className={styles.spin} size={18} /> : <Send size={18} />}</button>
          </div>
        </div>
      )}
      {editing && props.onEdit && <EditDialog message={editing} onCancel={() => setEditing(null)} onSave={async (value) => { await props.onEdit?.(editing.id, value); setEditing(null) }} />}
    </section>
  )
}

function EditDialog({ message, onCancel, onSave }: { message: ChatMessage; onCancel: () => void; onSave: (value: string) => Promise<void> }) {
  const { t } = useTranslation()
  const [value, setValue] = useState(message.body ?? '')
  const [busy, setBusy] = useState(false)
  return <div className={styles.dialogBackdrop} role="presentation"><section aria-modal="true" className={styles.dialog} role="dialog"><h2>{t('chat.editTitle')}</h2><textarea autoFocus maxLength={4000} onChange={(event) => setValue(event.target.value)} rows={5} value={value} /><div><button onClick={onCancel} type="button">{t('chat.actions.cancel')}</button><button disabled={!value.trim() || busy} onClick={() => { setBusy(true); void onSave(value.trim()).finally(() => setBusy(false)) }} type="button">{t('chat.actions.save')}</button></div></section></div>
}

function uniqueMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...new Map(messages.map((message) => [message.id, message])).values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

function formatDate(value: string, language?: string): string {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'uk-UA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
