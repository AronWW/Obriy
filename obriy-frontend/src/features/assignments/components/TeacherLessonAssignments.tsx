import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpenCheck,
  Edit3,
  Link2,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Unlink,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ApiError } from '../../../shared/api/api-client'
import {
  linkLessonAssignment,
  listAssignments,
  listLessonAssignments,
  unlinkLessonAssignment,
  updateLessonAssignmentVersion,
} from '../api/assignments.api'
import { assignmentQueryKeys } from '../model/assignment-query-keys'
import type {
  AssignmentSummary,
  LessonAssignment,
} from '../model/assignment.types'
import { AssignmentConfirmDialog } from './AssignmentConfirmDialog'
import { AssignmentDialog } from './AssignmentDialog'
import styles from '../Assignments.module.css'

export function TeacherLessonAssignments({
  lessonId,
  readOnly,
}: {
  lessonId: string
  readOnly: boolean
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showPicker, setShowPicker] = useState(false)
  const [unlinkTarget, setUnlinkTarget] = useState<LessonAssignment | null>(null)
  const linksQuery = useQuery({
    queryKey: assignmentQueryKeys.lesson(lessonId),
    queryFn: () => listLessonAssignments(lessonId),
  })

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: assignmentQueryKeys.lesson(lessonId),
    })
  const linkMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      linkLessonAssignment(lessonId, assignmentId),
    onSuccess: () => {
      setShowPicker(false)
      void refresh()
      void queryClient.invalidateQueries({ queryKey: assignmentQueryKeys.lists })
    },
  })
  const updateMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      updateLessonAssignmentVersion(lessonId, assignmentId),
    onSuccess: () => {
      void refresh()
      void queryClient.invalidateQueries({ queryKey: assignmentQueryKeys.lists })
    },
  })
  const unlinkMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      unlinkLessonAssignment(lessonId, assignmentId),
    onSuccess: () => {
      setUnlinkTarget(null)
      void refresh()
      void queryClient.invalidateQueries({ queryKey: assignmentQueryKeys.lists })
    },
  })
  const links = linksQuery.data ?? []

  return (
    <section className={styles.lessonAssignments} aria-labelledby="lesson-assignments-title">
      <header className={styles.lessonAssignmentsHeader}>
        <div>
          <p className={styles.eyebrow}>
            <BookOpenCheck size={15} aria-hidden="true" />
            {t('assignments.lesson.eyebrow')}
          </p>
          <h2 id="lesson-assignments-title">{t('assignments.lesson.title')}</h2>
          <p>{t('assignments.lesson.description')}</p>
        </div>
        {!readOnly && (
          <button
            className={styles.primaryButton}
            onClick={() => {
              linkMutation.reset()
              setShowPicker(true)
            }}
            type="button"
          >
            <Plus size={17} aria-hidden="true" />
            {t('assignments.lesson.add')}
          </button>
        )}
      </header>

      {readOnly && <p className={styles.inlineNotice}>{t('assignments.lesson.readOnly')}</p>}
      {linksQuery.isLoading && (
        <p className={styles.pickerStatus}>{t('assignments.lesson.loading')}</p>
      )}
      {linksQuery.isError && (
        <div className={styles.pickerStatus} role="alert">
          <p>{t('assignments.lesson.loadError')}</p>
          <button
            className={styles.secondaryButton}
            onClick={() => void linksQuery.refetch()}
            type="button"
          >
            {t('assignments.common.retry')}
          </button>
        </div>
      )}
      {!linksQuery.isLoading && !linksQuery.isError && links.length === 0 && (
        <div className={styles.lessonAssignmentsEmpty}>
          <Link2 size={27} aria-hidden="true" />
          <div>
            <strong>{t('assignments.lesson.emptyTitle')}</strong>
            <p>{t('assignments.lesson.emptyDescription')}</p>
          </div>
        </div>
      )}

      {links.length > 0 && (
        <div className={styles.linkedGrid}>
          {links.map((link) => (
            <article className={styles.linkedCard} key={link.id}>
              <span className={styles.linkedIcon} aria-hidden="true">
                <PenLine size={20} />
              </span>
              <div className={styles.linkedCopy}>
                <div className={styles.linkedMeta}>
                  <span>{t(`assignments.types.${link.type}.title`)}</span>
                  <span>
                    {t('assignments.lesson.version', {
                      version: link.revisionVersion,
                    })}
                  </span>
                  <span>
                    {t('assignments.lesson.points', { count: link.maxPoints })}
                  </span>
                </div>
                <h3>{link.title || t('assignments.common.untitled')}</h3>
                <p>{link.prompt || t('assignments.lesson.noPrompt')}</p>
                <small>
                  {link.activeReleaseCount > 0
                    ? t('assignments.lesson.activeClasses', {
                        count: link.activeReleaseCount,
                      })
                    : t('assignments.lesson.notReleased')}
                </small>
              </div>
              <div className={styles.linkedActions}>
                {link.hasUpdate && !readOnly && (
                  <button
                    className={styles.updateButton}
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate(link.assignmentId)}
                    type="button"
                  >
                    <RefreshCw size={15} aria-hidden="true" />
                    {t('assignments.lesson.updateVersion')}
                  </button>
                )}
                <Link
                  className={styles.iconButton}
                  aria-label={t('assignments.lesson.editNamed', {
                    title: link.title,
                  })}
                  to={`/app/teacher/tasks/${link.assignmentId}/edit`}
                >
                  <Edit3 size={16} aria-hidden="true" />
                </Link>
                {!readOnly && (
                  <button
                    aria-label={t('assignments.lesson.unlinkNamed', {
                      title: link.title,
                    })}
                    className={`${styles.iconButton} ${styles.dangerIconButton}`}
                    onClick={() => {
                      unlinkMutation.reset()
                      setUnlinkTarget(link)
                    }}
                    type="button"
                  >
                    <Unlink size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {updateMutation.isError && (
        <p className={styles.inlineError} role="alert">
          {getLinkError(updateMutation.error, t)}
        </p>
      )}

      {showPicker && (
        <LessonAssignmentPicker
          error={
            linkMutation.isError ? getLinkError(linkMutation.error, t) : null
          }
          isPending={linkMutation.isPending}
          linkedIds={new Set(links.map((link) => link.assignmentId))}
          onClose={() => setShowPicker(false)}
          onSelect={(assignmentId) => linkMutation.mutate(assignmentId)}
        />
      )}

      {unlinkTarget && (
        <AssignmentConfirmDialog
          cancelLabel={t('assignments.common.cancel')}
          confirmLabel={t('assignments.lesson.unlinkConfirm')}
          description={t('assignments.lesson.unlinkDescription', {
            title: unlinkTarget.title,
          })}
          error={
            unlinkMutation.isError
              ? getLinkError(unlinkMutation.error, t)
              : undefined
          }
          isDangerous
          isPending={unlinkMutation.isPending}
          onCancel={() => setUnlinkTarget(null)}
          onConfirm={() => unlinkMutation.mutate(unlinkTarget.assignmentId)}
          title={t('assignments.lesson.unlinkTitle')}
        />
      )}
    </section>
  )
}

function LessonAssignmentPicker({
  error,
  isPending,
  linkedIds,
  onClose,
  onSelect,
}: {
  error: string | null
  isPending: boolean
  linkedIds: Set<string>
  onClose: () => void
  onSelect: (assignmentId: string) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 250)
    return () => window.clearTimeout(timeout)
  }, [search])
  const filters = useMemo(
    () => ({ search: debouncedSearch || undefined }),
    [debouncedSearch],
  )
  const libraryQuery = useQuery({
    queryKey: [...assignmentQueryKeys.list(filters), 'lesson-picker'],
    queryFn: () => listAssignments(filters, undefined, 100),
  })
  const available = (libraryQuery.data?.items ?? []).filter(
    (assignment) => !linkedIds.has(assignment.id),
  )

  return (
    <AssignmentDialog
      closeLabel={t('assignments.common.close')}
      description={t('assignments.lesson.pickerDescription')}
      onClose={onClose}
      title={t('assignments.lesson.pickerTitle')}
      wide
    >
      <div className={styles.pickerBody}>
        <label className={styles.pickerSearch}>
          <Search size={17} aria-hidden="true" />
          <span className={styles.srOnly}>{t('assignments.lesson.search')}</span>
          <input
            aria-label={t('assignments.lesson.search')}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('assignments.lesson.searchPlaceholder')}
            type="search"
            value={search}
          />
        </label>
        {error && (
          <p className={styles.inlineError} role="alert">
            {error}
          </p>
        )}
        {libraryQuery.isLoading && (
          <p className={styles.pickerStatus}>{t('assignments.lesson.loadingLibrary')}</p>
        )}
        {libraryQuery.isError && (
          <p className={styles.pickerStatus} role="alert">
            {t('assignments.lesson.libraryError')}
          </p>
        )}
        {!libraryQuery.isLoading &&
          !libraryQuery.isError &&
          available.length === 0 && (
            <p className={styles.pickerStatus}>
              {t('assignments.lesson.noAvailable')}
            </p>
          )}
        {available.length > 0 && (
          <div className={styles.pickerList}>
            {available.map((assignment) => (
              <PickerRow
                assignment={assignment}
                disabled={isPending}
                key={assignment.id}
                onSelect={onSelect}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </AssignmentDialog>
  )
}

function PickerRow({
  assignment,
  disabled,
  onSelect,
  t,
}: {
  assignment: AssignmentSummary
  disabled: boolean
  onSelect: (assignmentId: string) => void
  t: (key: string, values?: Record<string, unknown>) => string
}) {
  const revision = assignment.draftRevision ?? assignment.publishedRevision
  return (
    <button
      className={styles.pickerRow}
      disabled={disabled}
      onClick={() => onSelect(assignment.id)}
      type="button"
    >
      <span className={styles.linkedIcon} aria-hidden="true">
        <PenLine size={19} />
      </span>
      <span className={styles.pickerRowCopy}>
        <strong>{revision?.title || t('assignments.common.untitled')}</strong>
        <span>
          {t(`assignments.types.${assignment.type}.title`)} ·{' '}
          {t('assignments.lesson.points', {
            count: assignment.defaultMaxPoints,
          })}
        </span>
      </span>
      <span className={styles.pickerAdd}>
        <Plus size={15} aria-hidden="true" />
        {t('assignments.lesson.addShort')}
      </span>
    </button>
  )
}

function getLinkError(
  error: Error | null,
  t: (key: string) => string,
): string {
  if (error instanceof ApiError) {
    if (error.code === 'ASSIGNMENT_INCOMPLETE') {
      return t('assignments.lesson.errors.incomplete')
    }
    if (error.code === 'LESSON_ASSIGNMENT_ALREADY_LINKED') {
      return t('assignments.lesson.errors.alreadyLinked')
    }
    if (error.code === 'NETWORK_ERROR') {
      return t('assignments.errors.network')
    }
  }
  return t('assignments.lesson.errors.action')
}
