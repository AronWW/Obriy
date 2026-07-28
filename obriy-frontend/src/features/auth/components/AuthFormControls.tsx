import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import styles from './AuthFormControls.module.css'

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  error?: string
  hint?: string
  label: string
}

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(
  function AuthField({ error, hint, id: providedId, label, ...inputProps }, ref) {
    const generatedId = useId()
    const id = providedId || generatedId
    const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined

    return (
      <div className={styles.field}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        <input
          {...inputProps}
          className={`${styles.input} ${error ? styles.inputInvalid : ''}`}
          id={id}
          ref={ref}
          aria-invalid={Boolean(error)}
          aria-describedby={descriptionId}
        />
        {error && (
          <p className={styles.fieldError} id={descriptionId}>
            {error}
          </p>
        )}
        {!error && hint && (
          <p className={styles.hint} id={descriptionId}>
            {hint}
          </p>
        )}
      </div>
    )
  },
)

interface AuthPasswordFieldProps extends AuthFieldProps {
  hidePasswordLabel: string
  showPasswordLabel: string
}

export const AuthPasswordField = forwardRef<
  HTMLInputElement,
  AuthPasswordFieldProps
>(function AuthPasswordField(
  {
    error,
    hidePasswordLabel,
    hint,
    id: providedId,
    label,
    showPasswordLabel,
    ...inputProps
  },
  ref,
) {
  const generatedId = useId()
  const id = providedId || generatedId
  const [isVisible, setIsVisible] = useState(false)
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  const visibilityLabel = isVisible ? hidePasswordLabel : showPasswordLabel

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.inputWrap}>
        <input
          {...inputProps}
          className={`${styles.input} ${styles.passwordInput} ${error ? styles.inputInvalid : ''}`}
          id={id}
          ref={ref}
          type={isVisible ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          aria-describedby={descriptionId}
        />
        <button
          className={styles.passwordToggle}
          type="button"
          aria-label={visibilityLabel}
          title={visibilityLabel}
          onClick={() => setIsVisible((visible) => !visible)}
        >
          {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && (
        <p className={styles.fieldError} id={descriptionId}>
          {error}
        </p>
      )}
      {!error && hint && (
        <p className={styles.hint} id={descriptionId}>
          {hint}
        </p>
      )}
    </div>
  )
})

interface AuthSubmitButtonProps {
  children: ReactNode
  disabled?: boolean
  pending: boolean
  pendingLabel: string
}

export function AuthSubmitButton({
  children,
  disabled = false,
  pending,
  pendingLabel,
}: AuthSubmitButtonProps) {
  return (
    <button className={styles.submit} type="submit" disabled={disabled || pending}>
      {pending ? (
        <>
          <span className={styles.spinner} aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        <>
          {children}
          <ArrowRight size={18} />
        </>
      )}
    </button>
  )
}

interface AuthAlertProps {
  children: ReactNode
  tone?: 'error' | 'info' | 'success'
}

export function AuthAlert({ children, tone = 'error' }: AuthAlertProps) {
  const toneClass = {
    error: styles.errorAlert,
    info: styles.infoAlert,
    success: styles.successAlert,
  }[tone]

  return (
    <p className={`${styles.alert} ${toneClass}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}
