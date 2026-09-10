import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EarnedBadge } from '../model/gamification.types'
import { BadgeIcon } from './BadgeIcon'
import styles from '../Gamification.module.css'

export function BadgeCollectionDialog({
  badges,
  isSaving = false,
  onClose,
  onSave,
  selectedIds = [],
}: {
  badges: EarnedBadge[]
  isSaving?: boolean
  onClose: () => void
  onSave?: (badgeIds: string[]) => void
  selectedIds?: string[]
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(selectedIds)
  const editable = Boolean(onSave)
  const toggle = (badgeId: string) => {
    setSelected((current) => {
      if (current.includes(badgeId)) {
        return current.filter((id) => id !== badgeId)
      }
      return current.length < 3 ? [...current, badgeId] : current
    })
  }
  return (
    <div className={styles.dialogBackdrop} role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="badge-collection-title"
        aria-modal="true"
        className={styles.badgeDialog}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header>
          <div>
            <h2 id="badge-collection-title">
              {t('gamification.badges.collectionTitle')}
            </h2>
            <p>
              {editable
                ? t('gamification.badges.chooseHint', {
                    count: selected.length,
                  })
                : t('gamification.badges.collectionHint')}
            </p>
          </div>
          <button
            aria-label={t('gamification.badges.close')}
            className={styles.iconButton}
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>
        {badges.length === 0 ? (
          <p className={styles.badgesEmpty}>{t('gamification.badges.empty')}</p>
        ) : (
          <div className={styles.badgeGrid}>
            {badges.map((badge) => {
              const active = selected.includes(badge.id)
              return (
                <button
                  aria-pressed={editable ? active : undefined}
                  className={active ? styles.badgeSelected : styles.badgeItem}
                  disabled={!editable}
                  key={badge.id}
                  onClick={() => toggle(badge.id)}
                  type="button"
                >
                  <span className={styles.badgeIcon}>
                    <BadgeIcon iconKey={badge.iconKey} />
                  </span>
                  <span>
                    <strong>{badge.name}</strong>
                    <small>{badge.description}</small>
                  </span>
                  {active && <Check aria-hidden="true" size={17} />}
                </button>
              )
            })}
          </div>
        )}
        <footer>
          <button className={styles.secondaryButton} onClick={onClose} type="button">
            {t('gamification.badges.close')}
          </button>
          {onSave && (
            <button
              className={styles.primaryButton}
              disabled={isSaving}
              onClick={() => onSave(selected)}
              type="button"
            >
              {isSaving
                ? t('gamification.badges.saving')
                : t('gamification.badges.saveShowcase')}
            </button>
          )}
        </footer>
      </section>
    </div>
  )
}
