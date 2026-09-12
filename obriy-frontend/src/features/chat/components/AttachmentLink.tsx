import { Download, FileText, Image as ImageIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { chatApi } from '../api/chat.api'
import type { ChatAttachment } from '../model/chat.types'
import styles from './ChatWorkspace.module.css'

export function AttachmentLink({ attachment }: { attachment: ChatAttachment }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  useEffect(() => {
    if (attachment.resourceType !== 'IMAGE') return
    let active = true
    void chatApi.attachment(attachment.id).then(({ url }) => {
      if (active) setPreviewUrl(url)
    }).catch(() => undefined)
    return () => { active = false }
  }, [attachment.id, attachment.resourceType])
  const open = async () => {
    setBusy(true)
    try {
      const { url } = await chatApi.attachment(attachment.id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setBusy(false)
    }
  }
  const Icon = attachment.resourceType === 'IMAGE' ? ImageIcon : FileText
  return (
    <button className={styles.attachment} disabled={busy} onClick={() => void open()} type="button">
      {previewUrl && <img className={styles.attachmentPreview} src={previewUrl} alt="" />}
      <Icon size={17} />
      <span><strong>{attachment.originalFileName}</strong><small>{formatBytes(attachment.sizeBytes)}</small></span>
      <Download size={15} aria-label={t('chat.actions.download')} />
    </button>
  )
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
