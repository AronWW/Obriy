import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  RotateCcw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { StudentWorkItem } from '../model/student-workspace.types'
import styles from '../StudentWorkspace.module.css'

export function StudentWorkRow({ item }: { item: StudentWorkItem }) {
  const { i18n, t } = useTranslation()
  const dateLocale = i18n.language === 'en' ? 'en-GB' : 'uk-UA'
  const destination = `/app/student/lessons/${item.lesson.id}?test=${item.releaseId}`
  const statusIcon =
    item.attentionReason === 'NEEDS_REVISION' ? (
      <RotateCcw size={18} />
    ) : item.attentionReason === 'OVERDUE' ? (
      <AlertTriangle size={18} />
    ) : item.stateStatus === 'COMPLETED' ? (
      <CheckCircle2 size={18} />
    ) : item.availability === 'SCHEDULED' ? (
      <CalendarClock size={18} />
    ) : (
      <Clock3 size={18} />
    )

  return (
    <article className={styles.workRow} data-status={item.stateStatus}>
      <span className={styles.workStatusIcon} aria-hidden="true">
        {statusIcon}
      </span>
      <div className={styles.workCopy}>
        <div className={styles.workMeta}>
          <span>{item.lesson.title}</span>
          <span>
            {item.isRequired
              ? t('studentWorkspace.common.required')
              : t('studentWorkspace.common.optional')}
          </span>
          <span>{t(`studentWorkspace.status.${item.stateStatus}`)}</span>
        </div>
        <h3>{item.title}</h3>
        {item.description && <p>{item.description}</p>}
        <div className={styles.workDates}>
          {item.availability === 'SCHEDULED' && item.availableFrom ? (
            <span>
              {t('studentWorkspace.common.opens', {
                date: formatDate(item.availableFrom, dateLocale),
              })}
            </span>
          ) : item.dueAt ? (
            <span className={item.isOverdue ? styles.overdue : undefined}>
              {t('studentWorkspace.common.deadline', {
                date: formatDate(item.dueAt, dateLocale),
              })}
            </span>
          ) : (
            <span>{t('studentWorkspace.common.noDeadline')}</span>
          )}
          {item.bestPercent !== null && (
            <span>
              {t('studentWorkspace.common.bestScore', {
                score: Math.round(item.bestPercent),
              })}
            </span>
          )}
        </div>
      </div>
      {item.canOpen ? (
        <Link className={styles.openWork} to={destination}>
          {t('studentWorkspace.common.open')}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <span className={styles.lockedWork}>
          {item.availability === 'SCHEDULED'
            ? t('studentWorkspace.common.notOpenYet')
            : t('studentWorkspace.common.unavailable')}
        </span>
      )}
    </article>
  )
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
