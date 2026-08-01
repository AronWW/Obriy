import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  BookOpen,
  Clock3,
  Edit3,
  Languages,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../../shared/api/api-client'
import {
  archiveLesson,
  deleteLesson,
  listTeacherLessons,
  restoreLesson,
} from '../api/lessons.api'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { lessonQueryKeys } from '../model/lesson-query-keys'
import type { LessonStatus, LessonSummary } from '../model/lesson.types'
import styles from '../Lessons.module.css'

type LessonAction = 'archive' | 'delete' | 'restore'

interface PendingAction {
  lesson: LessonSummary
  type: LessonAction
}

export function TeacherLessonsPage() {
  const { i18n, t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<'ALL' | LessonStatus>('ALL')
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 250)
    return () => window.clearTimeout(timeout)
  }, [search])

  const filters = {
    search: debouncedSearch,
    status: status === 'ALL' ? undefined : status,
  }
  const lessonsQuery = useQuery({
    queryKey: lessonQueryKeys.list(filters),
    queryFn: () => listTeacherLessons(filters),
  })
  const actionMutation = useMutation({
    mutationFn: async ({ lesson, type }: PendingAction) => {
      if (type === 'archive') {
        return archiveLesson(lesson.id)
      }
      if (type === 'restore') {
        return restoreLesson(lesson.id)
      }

      await deleteLesson(lesson.id)
      return null
    },
    onSuccess: () => {
      setPendingAction(null)
      void queryClient.invalidateQueries({ queryKey: lessonQueryKeys.all })
    },
  })

  const locale = i18n.resolvedLanguage === 'en' ? 'en-GB' : 'uk-UA'

  return (
    <section className={styles.page} aria-labelledby="teacher-lessons-title">
      <div className={styles.content}>
        <header className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>
              <BookOpen size={15} aria-hidden="true" />
              {t('lessons.library.eyebrow')}
            </p>
            <h1 id="teacher-lessons-title">{t('lessons.library.title')}</h1>
            <p>{t('lessons.library.description')}</p>
          </div>
          <Link className={styles.primaryButton} to="/app/teacher/lessons/new">
            <Plus size={17} aria-hidden="true" />
            {t('lessons.library.create')}
          </Link>
        </header>

        <div className={styles.filters}>
          <label className={styles.searchField}>
            <span className={styles.srOnly}>{t('lessons.library.search')}</span>
            <Search size={17} aria-hidden="true" />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('lessons.library.searchPlaceholder')}
              type="search"
              value={search}
            />
          </label>
          <label className={styles.statusFilter}>
            <span>{t('lessons.library.filter')}</span>
            <select
              onChange={(event) =>
                setStatus(event.target.value as 'ALL' | LessonStatus)
              }
              value={status}
            >
              <option value="ALL">{t('lessons.status.all')}</option>
              <option value="DRAFT">{t('lessons.status.DRAFT')}</option>
              <option value="PUBLISHED">{t('lessons.status.PUBLISHED')}</option>
              <option value="ARCHIVED">{t('lessons.status.ARCHIVED')}</option>
            </select>
          </label>
        </div>

        {lessonsQuery.isLoading && (
          <StatusPanel message={t('lessons.library.loading')} />
        )}
        {lessonsQuery.isError && (
          <StatusPanel
            action={t('lessons.common.retry')}
            message={t('lessons.library.loadError')}
            onAction={() => void lessonsQuery.refetch()}
          />
        )}
        {lessonsQuery.data?.length === 0 && (
          <StatusPanel
            action={!search && status === 'ALL' ? t('lessons.library.create') : undefined}
            icon={<BookOpen size={30} />}
            message={
              search || status !== 'ALL'
                ? t('lessons.library.noResultsDescription')
                : t('lessons.library.emptyDescription')
            }
            onAction={
              !search && status === 'ALL'
                ? () => navigate('/app/teacher/lessons/new')
                : undefined
            }
            title={
              search || status !== 'ALL'
                ? t('lessons.library.noResultsTitle')
                : t('lessons.library.emptyTitle')
            }
          />
        )}

        {lessonsQuery.data && lessonsQuery.data.length > 0 && (
          <div className={styles.lessonList}>
            {lessonsQuery.data.map((lesson, index) => (
              <article className={styles.lessonRow} key={lesson.id}>
                <div className={styles.lessonOrdinal} aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className={styles.lessonCopy}>
                  <div className={styles.lessonHeadingRow}>
                    <span
                      className={`${styles.statusBadge} ${styles[`status${lesson.status}`]}`}
                    >
                      {t(`lessons.status.${lesson.status}`)}
                    </span>
                    <span className={styles.lessonMetaItem}>
                      <Languages size={14} aria-hidden="true" />
                      {t(`lessons.locale.${lesson.contentLocale}`)}
                    </span>
                    {lesson.estimatedMinutes !== null && (
                      <span className={styles.lessonMetaItem}>
                        <Clock3 size={14} aria-hidden="true" />
                        {t('lessons.common.minutes', {
                          count: lesson.estimatedMinutes,
                        })}
                      </span>
                    )}
                  </div>
                  <h2>
                    {lesson.title.trim() || t('lessons.common.untitled')}
                  </h2>
                  <p className={styles.lessonSummary}>
                    {lesson.summary.trim() || t('lessons.common.noSummary')}
                  </p>
                  <div className={styles.lessonFooter}>
                    <span>
                      {t('lessons.common.updated', {
                        date: new Intl.DateTimeFormat(locale, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }).format(new Date(lesson.updatedAt)),
                      })}
                    </span>
                    <div className={styles.classChips}>
                      {lesson.classLinks.length === 0 ? (
                        <span>{t('lessons.common.noClasses')}</span>
                      ) : (
                        lesson.classLinks.map((link) => (
                          <span
                            className={
                              link.publishedAt
                                ? styles.classChipPublished
                                : undefined
                            }
                            key={link.classId}
                          >
                            {link.className}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <Link
                    className={styles.secondaryButton}
                    to={`/app/teacher/lessons/${lesson.id}/edit`}
                  >
                    <Edit3 size={15} aria-hidden="true" />
                    {t('lessons.actions.edit')}
                  </Link>
                  {lesson.status === 'ARCHIVED' ? (
                    <button
                      className={styles.iconButton}
                      onClick={() =>
                        setPendingAction({ lesson, type: 'restore' })
                      }
                      title={t('lessons.actions.restore')}
                      type="button"
                    >
                      <RotateCcw size={17} />
                      <span className={styles.srOnly}>
                        {t('lessons.actions.restore')}
                      </span>
                    </button>
                  ) : (
                    <button
                      className={styles.iconButton}
                      onClick={() =>
                        setPendingAction({ lesson, type: 'archive' })
                      }
                      title={t('lessons.actions.archive')}
                      type="button"
                    >
                      <Archive size={17} />
                      <span className={styles.srOnly}>
                        {t('lessons.actions.archive')}
                      </span>
                    </button>
                  )}
                  {lesson.status === 'DRAFT' &&
                    lesson.classLinks.length === 0 && (
                      <button
                        className={`${styles.iconButton} ${styles.dangerIconButton}`}
                        onClick={() =>
                          setPendingAction({ lesson, type: 'delete' })
                        }
                        title={t('lessons.actions.delete')}
                        type="button"
                      >
                        <Trash2 size={17} />
                        <span className={styles.srOnly}>
                          {t('lessons.actions.delete')}
                        </span>
                      </button>
                    )}
                </div>
              </article>
            ))}
          </div>
        )}

        {actionMutation.isError && !pendingAction && (
          <p className={styles.errorStatus} role="alert">
            {getLessonErrorMessage(actionMutation.error, t)}
          </p>
        )}
      </div>

      {pendingAction && (
        <ConfirmationDialog
          cancelLabel={t('lessons.common.cancel')}
          confirmLabel={t(`lessons.confirm.${pendingAction.type}.confirm`)}
          description={t(`lessons.confirm.${pendingAction.type}.description`, {
            title:
              pendingAction.lesson.title.trim() ||
              t('lessons.common.untitled'),
          })}
          error={
            actionMutation.isError
              ? getLessonErrorMessage(actionMutation.error, t)
              : undefined
          }
          isDangerous={pendingAction.type === 'delete'}
          isPending={actionMutation.isPending}
          onCancel={() => {
            actionMutation.reset()
            setPendingAction(null)
          }}
          onConfirm={() => actionMutation.mutate(pendingAction)}
          title={t(`lessons.confirm.${pendingAction.type}.title`)}
        />
      )}
    </section>
  )
}

function StatusPanel({
  action,
  icon,
  message,
  onAction,
  title,
}: {
  action?: string
  icon?: React.ReactNode
  message: string
  onAction?: () => void
  title?: string
}) {
  return (
    <div className={styles.statusPanel}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {title && <h2>{title}</h2>}
      <p>{message}</p>
      {action && onAction && (
        <button
          className={styles.secondaryButton}
          onClick={onAction}
          type="button"
        >
          {action}
        </button>
      )}
    </div>
  )
}

function getLessonErrorMessage(
  error: Error,
  t: (key: string) => string,
): string {
  if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
    return t('lessons.errors.network')
  }
  return t('lessons.errors.action')
}
