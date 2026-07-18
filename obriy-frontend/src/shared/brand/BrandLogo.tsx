import styles from './BrandLogo.module.css'

interface BrandLogoProps {
  compact?: boolean
  large?: boolean
}

export function BrandLogo({ compact = false, large = false }: BrandLogoProps) {
  return (
    <div className={`${styles.brand} ${large ? styles.large : ''}`} aria-label="Obriy">
      <span className={styles.mark} aria-hidden="true">
        <span className={styles.orbit} />
        <svg viewBox="0 0 64 64">
          <path d="M32 4 37 27 60 32 37 37 32 60 27 37 4 32 27 27Z" />
        </svg>
      </span>
      {!compact && <span className={styles.wordmark}>Obriy</span>}
    </div>
  )
}
