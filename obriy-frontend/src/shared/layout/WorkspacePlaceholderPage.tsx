import { Construction } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from './WorkspacePlaceholderPage.module.css'

export function WorkspacePlaceholderPage({
  namespace,
  section,
  showEyebrow = true,
}: {
  namespace: 'studentWorkspace' | 'teacherWorkspace'
  section: string
  showEyebrow?: boolean
}) {
  const { t } = useTranslation()

  return (
    <section className={styles.page}>
      <div className={styles.content}>
        {showEyebrow && (
          <p className={styles.eyebrow}>
            <Construction size={15} />
            {t(`${namespace}.placeholderLabel`)}
          </p>
        )}
        <h1>{t(`${namespace}.pages.${section}.title`)}</h1>
        <p className={styles.description}>
          {t(`${namespace}.pages.${section}.description`)}
        </p>
      </div>
    </section>
  )
}
