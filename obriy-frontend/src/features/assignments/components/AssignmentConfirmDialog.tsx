import { AssignmentDialog } from './AssignmentDialog'
import styles from '../Assignments.module.css'

export function AssignmentConfirmDialog({
  cancelLabel,
  confirmLabel,
  description,
  error,
  isDangerous = false,
  isPending = false,
  onCancel,
  onConfirm,
  title,
}: {
  cancelLabel: string
  confirmLabel: string
  description: string
  error?: string
  isDangerous?: boolean
  isPending?: boolean
  onCancel: () => void
  onConfirm: () => void
  title: string
}) {
  return (
    <AssignmentDialog
      closeLabel={cancelLabel}
      description={description}
      onClose={onCancel}
      title={title}
    >
      {error && (
        <p className={styles.dialogError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.dialogActions}>
        <button
          className={styles.secondaryButton}
          disabled={isPending}
          onClick={onCancel}
          type="button"
        >
          {cancelLabel}
        </button>
        <button
          className={isDangerous ? styles.dangerButton : styles.primaryButton}
          disabled={isPending}
          onClick={onConfirm}
          type="button"
        >
          {confirmLabel}
        </button>
      </div>
    </AssignmentDialog>
  )
}
