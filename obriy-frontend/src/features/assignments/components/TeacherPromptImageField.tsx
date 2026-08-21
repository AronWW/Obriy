import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  assignmentImageUrl,
  removeAssignmentImage,
  uploadAssignmentImage,
} from '../api/assignments.api'
import { assignmentQueryKeys } from '../model/assignment-query-keys'
import type {
  AssignmentEditorRevision,
  AssignmentPromptImage,
} from '../model/assignment.types'
import styles from '../Assignments.module.css'

export function TeacherPromptImageField({
  assignmentId,
  onChange,
  promptImage,
  revision,
}: {
  assignmentId?: string
  onChange: (image: AssignmentPromptImage | null) => void
  promptImage: AssignmentPromptImage | null
  revision: AssignmentEditorRevision | null | undefined
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: async () => {
      if (!assignmentId || !revision || !file) throw new Error('Save the assignment first')
      return uploadAssignmentImage(assignmentId, revision.id, revision.editVersion, file)
    },
    onSuccess: (assignment) => {
      const config = assignment.draftRevision?.publicConfig as { promptImage?: AssignmentPromptImage | null } | undefined
      onChange(config?.promptImage ?? null)
      queryClient.setQueryData(assignmentQueryKeys.detail(assignment.id), assignment)
      setFile(null)
      if (preview) URL.revokeObjectURL(preview)
      setPreview(null)
    },
  })
  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!assignmentId || !revision) throw new Error('Draft is unavailable')
      return removeAssignmentImage(assignmentId, revision.id, revision.editVersion)
    },
    onSuccess: (assignment) => {
      onChange(null)
      queryClient.setQueryData(assignmentQueryKeys.detail(assignment.id), assignment)
    },
  })
  const src = preview ?? (promptImage ? assignmentImageUrl(promptImage.attachmentId) : null)
  return <div className={styles.promptImageField}>
    <div>
      <strong>{t('assignments.interactive.image')}</strong>
      <small>{assignmentId && revision ? t('assignments.interactive.imageHint') : t('assignments.interactive.saveBeforeImage')}</small>
    </div>
    {src && <img alt="" src={src} />}
    <div>
      <label className={styles.secondaryButton}><ImagePlus size={15} />{src ? t('assignments.interactive.replaceImage') : t('assignments.interactive.addImage')}<input accept="image/jpeg,image/png,image/webp" disabled={!assignmentId || !revision} onChange={(event) => { const next = event.target.files?.[0] ?? null; if (preview) URL.revokeObjectURL(preview); setFile(next); setPreview(next ? URL.createObjectURL(next) : null) }} type="file" /></label>
      {file && <button className={styles.primaryButton} disabled={mutation.isPending} onClick={() => mutation.mutate()} type="button">{mutation.isPending ? t('assignments.editor.saving') : t('assignments.interactive.uploadImage')}</button>}
      {promptImage && !file && <button className={styles.secondaryButton} disabled={removeMutation.isPending} onClick={() => removeMutation.mutate()} type="button"><Trash2 size={15} />{t('assignments.interactive.removeImage')}</button>}
    </div>
    {(mutation.isError || removeMutation.isError) && <p className={styles.inlineError}>{t('assignments.interactive.uploadError')}</p>}
  </div>
}
