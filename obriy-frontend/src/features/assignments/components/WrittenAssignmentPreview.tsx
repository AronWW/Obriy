import { Paperclip, PenLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { WrittenAssignmentDraftInput } from '../model/assignment.types'
import { AssignmentDialog } from './AssignmentDialog'
import styles from '../Assignments.module.css'

export function WrittenAssignmentPreview({
  defaultMaxPoints,
  draft,
  onClose,
}: {
  defaultMaxPoints: number
  draft: WrittenAssignmentDraftInput
  onClose: () => void
}) {
  const { t } = useTranslation()
  const config = draft.publicConfig

  return (
    <AssignmentDialog
      closeLabel={t('assignments.common.close')}
      description={t('assignments.preview.description')}
      fullScreen
      onClose={onClose}
      title={t('assignments.preview.title')}
    >
      <div className={styles.previewViewport}>
        <article className={styles.studentPreview}>
          <header className={styles.studentPreviewHeader}>
            <span className={styles.previewTypeIcon} aria-hidden="true">
              <PenLine size={22} />
            </span>
            <div>
              <p>{t('assignments.types.WRITTEN.title')}</p>
              <span>
                {t('assignments.preview.points', { count: defaultMaxPoints })}
              </span>
            </div>
          </header>

          <h1>
            {draft.title.trim() || t('assignments.common.untitled')}
          </h1>
          <p className={styles.previewPrompt}>
            {draft.prompt.trim() || t('assignments.preview.emptyPrompt')}
          </p>
          {draft.instructions?.trim() && (
            <div className={styles.previewInstructions}>
              <strong>{t('assignments.preview.instructions')}</strong>
              <p>{draft.instructions}</p>
            </div>
          )}

          <label className={styles.previewAnswer}>
            <span>{t('assignments.preview.answer')}</span>
            {config.responseMode === 'SHORT' ? (
              <input
                maxLength={config.maxLength}
                placeholder={t('assignments.preview.answerPlaceholder')}
              />
            ) : (
              <textarea
                maxLength={config.maxLength}
                placeholder={t('assignments.preview.answerPlaceholder')}
                rows={9}
              />
            )}
            <small>
              {t('assignments.preview.limit', { count: config.maxLength })}
            </small>
          </label>

          {config.allowAttachments && (
            <button className={styles.previewAttachment} type="button">
              <Paperclip size={16} aria-hidden="true" />
              {t('assignments.preview.attach')}
            </button>
          )}

          {config.rubric.length > 0 && (
            <section className={styles.previewRubric}>
              <h2>{t('assignments.preview.criteria')}</h2>
              <ul>
                {config.rubric.map((item) => (
                  <li key={item.id}>
                    <strong>
                      {item.title.trim() || t('assignments.editor.criteria.untitled')}
                    </strong>
                    {item.description.trim() && <p>{item.description}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </div>
    </AssignmentDialog>
  )
}
