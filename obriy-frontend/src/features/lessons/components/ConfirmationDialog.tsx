import { AlertTriangle, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import styles from '../Lessons.module.css'

interface ConfirmationDialogProps {
  cancelLabel: string
  confirmLabel: string
  description: string
  error?: string
  isDangerous?: boolean
  isPending?: boolean
  onCancel: () => void
  onConfirm: () => void
  title: string
}

export function ConfirmationDialog({
  cancelLabel,
  confirmLabel,
  description,
  error,
  isDangerous = false,
  isPending = false,
  onCancel,
  onConfirm,
  title,
}: ConfirmationDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const previouslyFocusedElement = useRef<HTMLElement | null>(null)
  const onCancelRef = useRef(onCancel)
  const isPendingRef = useRef(isPending)

  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])

  useEffect(() => {
    isPendingRef.current = isPending
  }, [isPending])

  useEffect(() => {
    previouslyFocusedElement.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    cancelButtonRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPendingRef.current) {
        onCancelRef.current()
      }
      if (event.key === 'Tab') {
        const first = closeButtonRef.current
        const last = confirmButtonRef.current
        if (!first || !last) {
          return
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousBodyOverflow
      previouslyFocusedElement.current?.focus()
    }
  }, [])

  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.dialog}
        role={isDangerous ? 'alertdialog' : 'dialog'}
      >
        <button
          aria-label={cancelLabel}
          className={styles.iconButton}
          disabled={isPending}
          onClick={onCancel}
          ref={closeButtonRef}
          type="button"
        >
          <X size={18} />
        </button>
        <span className={styles.dialogIcon} aria-hidden="true">
          <AlertTriangle size={22} />
        </span>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
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
            ref={cancelButtonRef}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={isDangerous ? styles.dangerButton : styles.primaryButton}
            disabled={isPending}
            onClick={onConfirm}
            ref={confirmButtonRef}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
