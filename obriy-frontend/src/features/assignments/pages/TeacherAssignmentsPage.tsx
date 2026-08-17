import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ClipboardList,
  Copy,
  Edit3,
  PenLine,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../../shared/api/api-client'
import {
  archiveAssignment,
  deleteAssignment,
  duplicateAssignment,
  listAssignments,
  restoreAssignment,
} from '../api/assignments.api'
import { AssignmentConfirmDialog } from '../components/AssignmentConfirmDialog'
import { AssignmentTypeDialog } from '../components/AssignmentTypeDialog'
import { assignmentQueryKeys } from '../model/assignment-query-keys'
import type {
  AssignmentFilters,
  AssignmentStatus,
  AssignmentSummary,
  AssignmentType,
} from '../model/assignment.types'
import styles from '../Assignments.module.css'

type AssignmentAction = 'archive' | 'delete' | 'restore'

interface PendingAction {
  assignment: AssignmentSummary
  type: AssignmentAction
}

export function TeacherAssignmentsPage() {
  const { i18n, t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<'ALL' | AssignmentStatus>('ALL')
  const [type, setType] = useState<'ALL' | AssignmentType>('ALL')
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 250)
    return () => window.clearTimeout(timeout)
  }, [search])

  const filters = useMemo<AssignmentFilters>(
    () => ({
      search: debouncedSearch,
      status: status === 'ALL' ? undefined : status,
      type: type === 'ALL' ? undefined : type,
    }),
    [debouncedSearch, status, type],
  )
  const assignmentsQuery = useInfiniteQuery({
    queryKey: assignmentQueryKeys.list(filters),
    queryFn: ({ pageParam }) => listAssignments(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
  const assignments = assignmentsQuery.data?.pages.flatMap((page) => page.items) ?? []

  const actionMutation = useMutation({
    mutationFn: async ({ assignment, type: action }: PendingAction) => {
      if (action === 'archive') {
        return archiveAssignment(assignment.id)
      }
      if (action === 'restore') {
        return restoreAssignment(assignment.id)
      }
      await deleteAssignment(assignment.id)
      return null
    },
    onSuccess: () => {
      setPendingAction(null)
      void queryClient.invalidateQueries({ queryKey: assignmentQueryKeys.all })
    },
  })
  const duplicateMutation = useMutation({
    mutationFn: (assignment: AssignmentSummary) =>
      duplicateAssignment(
        assignment.id,
        assignment.draftRevision ? 'DRAFT' : 'PUBLISHED',
      ),
    onSuccess: (assignment) => {
      void queryClient.invalidateQueries({ queryKey: assignmentQueryKeys.all })
      navigate(`/app/teacher/tasks/${assignment.id}/edit`)
    },
  })

  const hasFilters = Boolean(search || status !== 'ALL' || type !== 'ALL')
  const locale = i18n.resolvedLanguage === 'en' ? 'en-GB' : 'uk-UA'

  return (
    <section className={styles.page} aria-labelledby="assignments-title">
      <div className={styles.content}>
        <header className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>
              <ClipboardList size={15} aria-hidden="true" />
              {t('assignments.library.eyebrow')}
            </p>
            <h1 id="assignments-title">{t('assignments.library.title')}</h1>
            <p>{t('assignments.library.description')}</p>
          </div>
          <button
            className={styles.primaryButton}
            onClick={() => setShowTypePicker(true)}
            type="button"
          >
            <Plus size={17} aria-hidden="true" />
            {t('assignments.library.create')}
          </button>
        </header>

        <div className={styles.filters}>
          <label className={styles.searchField}>
            <span className={styles.srOnly}>{t('assignments.library.search')}</span>
            <Search size={17} aria-hidden="true" />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('assignments.library.searchPlaceholder')}
              type="search"
              value={search}
            />
          </label>
          <label className={styles.filterField}>
            <span>{t('assignments.library.statusFilter')}</span>
            <select
              onChange={(event) =>
                setStatus(event.target.value as 'ALL' | AssignmentStatus)
              }
              value={status}
            >
              <option value="ALL">{t('assignments.status.ALL')}</option>
              <option value="DRAFT">{t('assignments.status.DRAFT')}</option>
              <option value="PUBLISHED">{t('assignments.status.PUBLISHED')}</option>
              <option value="ARCHIVED">{t('assignments.status.ARCHIVED')}</option>
            </select>
          </label>
          <label className={styles.filterField}>
            <span>{t('assignments.library.typeFilter')}</span>
            <select
              onChange={(event) =>
                setType(event.target.value as 'ALL' | AssignmentType)
              }
              value={type}
            >
              <option value="ALL">{t('assignments.types.ALL')}</option>
              <option value="WRITTEN">{t('assignments.types.WRITTEN.title')}</option>
              <option value="SINGLE_CHOICE">{t('assignments.types.SINGLE_CHOICE.title')}</option>
              <option value="MULTIPLE_CHOICE">{t('assignments.types.MULTIPLE_CHOICE.title')}</option>
              <option value="MATCHING">{t('assignments.types.MATCHING.title')}</option>
              <option value="ORDERING">{t('assignments.types.ORDERING.title')}</option>
              <option value="CATEGORIZATION">{t('assignments.types.CATEGORIZATION.title')}</option>
              <option value="FILL_BLANKS">{t('assignments.types.FILL_BLANKS.title')}</option>
              <option value="IMAGE_HOTSPOT">{t('assignments.types.IMAGE_HOTSPOT.title')}</option>
              <option value="MAP_POINT">{t('assignments.types.MAP_POINT.title')}</option>
              <option value="MAP_REGION">{t('assignments.types.MAP_REGION.title')}</option>
              <option value="MAP_MULTI_REGION">{t('assignments.types.MAP_MULTI_REGION.title')}</option>
            </select>
          </label>
        </div>

        {assignmentsQuery.isLoading && (
          <StatusPanel message={t('assignments.library.loading')} />
        )}
        {assignmentsQuery.isError && (
          <StatusPanel
            action={t('assignments.common.retry')}
            message={t('assignments.library.loadError')}
            onAction={() => void assignmentsQuery.refetch()}
          />
        )}
        {!assignmentsQuery.isLoading && !assignmentsQuery.isError && assignments.length === 0 && (
          <StatusPanel
            action={!hasFilters ? t('assignments.library.create') : undefined}
            icon={<ClipboardList size={30} />}
            message={
              hasFilters
                ? t('assignments.library.noResultsDescription')
                : t('assignments.library.emptyDescription')
            }
            onAction={!hasFilters ? () => setShowTypePicker(true) : undefined}
            title={
              hasFilters
                ? t('assignments.library.noResultsTitle')
                : t('assignments.library.emptyTitle')
            }
          />
        )}

        {assignments.length > 0 && (
          <div className={styles.assignmentList}>
            {assignments.map((assignment) => {
              const revision = assignment.draftRevision ?? assignment.publishedRevision
              const title = revision?.title.trim() || t('assignments.common.untitled')

              return (
                <article className={styles.assignmentRow} key={assignment.id}>
                  <span className={styles.assignmentTypeIcon} aria-hidden="true">
                    <PenLine size={21} />
                  </span>
                  <div className={styles.assignmentCopy}>
                    <div className={styles.assignmentMeta}>
                      <span
                        className={`${styles.statusBadge} ${styles[`status${assignment.status}`]}`}
                      >
                        {t(`assignments.status.${assignment.status}`)}
                      </span>
                      <span>{t(`assignments.types.${assignment.type}.title`)}</span>
                      <span>
                        {t('assignments.library.points', {
                          count: assignment.defaultMaxPoints,
                        })}
                      </span>
                    </div>
                    <h2>{title}</h2>
                    <p>
                      {t('assignments.library.updated', {
                        date: new Intl.DateTimeFormat(locale, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }).format(new Date(assignment.updatedAt)),
                      })}
                    </p>
                  </div>
                  <div className={styles.rowActions}>
                    <Link
                      className={styles.secondaryButton}
                      to={`/app/teacher/tasks/${assignment.id}/edit`}
                    >
                      <Edit3 size={15} aria-hidden="true" />
                      {t('assignments.actions.edit')}
                    </Link>
                    <button
                      aria-label={t('assignments.actions.duplicateNamed', { title })}
                      className={styles.iconButton}
                      disabled={duplicateMutation.isPending}
                      onClick={() => duplicateMutation.mutate(assignment)}
                      title={t('assignments.actions.duplicate')}
                      type="button"
                    >
                      <Copy size={17} aria-hidden="true" />
                    </button>
                    {assignment.status === 'ARCHIVED' ? (
                      <button
                        aria-label={t('assignments.actions.restoreNamed', { title })}
                        className={styles.iconButton}
                        onClick={() => setPendingAction({ assignment, type: 'restore' })}
                        title={t('assignments.actions.restore')}
                        type="button"
                      >
                        <RotateCcw size={17} aria-hidden="true" />
                      </button>
                    ) : (
                      <button
                        aria-label={t('assignments.actions.archiveNamed', { title })}
                        className={styles.iconButton}
                        onClick={() => setPendingAction({ assignment, type: 'archive' })}
                        title={t('assignments.actions.archive')}
                        type="button"
                      >
                        <Archive size={17} aria-hidden="true" />
                      </button>
                    )}
                    <button
                      aria-label={t('assignments.actions.deleteNamed', { title })}
                      className={`${styles.iconButton} ${styles.dangerIconButton}`}
                      onClick={() => setPendingAction({ assignment, type: 'delete' })}
                      title={t('assignments.actions.delete')}
                      type="button"
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {assignmentsQuery.hasNextPage && (
          <div className={styles.loadMoreRow}>
            <button
              className={styles.secondaryButton}
              disabled={assignmentsQuery.isFetchingNextPage}
              onClick={() => void assignmentsQuery.fetchNextPage()}
              type="button"
            >
              {assignmentsQuery.isFetchingNextPage
                ? t('assignments.library.loadingMore')
                : t('assignments.library.loadMore')}
            </button>
          </div>
        )}

        {duplicateMutation.isError && (
          <p className={styles.errorStatus} role="alert">
            {getAssignmentError(
              duplicateMutation.error,
              t,
            )}
          </p>
        )}
      </div>

      {showTypePicker && (
        <AssignmentTypeDialog
          onClose={() => setShowTypePicker(false)}
          onSelect={(selectedType) => {
            setShowTypePicker(false)
            navigate(`/app/teacher/tasks/new/${selectedType.toLowerCase()}`)
          }}
        />
      )}

      {pendingAction && (
        <AssignmentConfirmDialog
          cancelLabel={t('assignments.common.cancel')}
          confirmLabel={t(`assignments.confirm.${pendingAction.type}.confirm`)}
          description={t(`assignments.confirm.${pendingAction.type}.description`, {
            title:
              pendingAction.assignment.draftRevision?.title ||
              pendingAction.assignment.publishedRevision?.title ||
              t('assignments.common.untitled'),
          })}
          error={
            actionMutation.isError
              ? getAssignmentError(actionMutation.error, t)
              : undefined
          }
          isDangerous={pendingAction.type === 'delete'}
          isPending={actionMutation.isPending}
          onCancel={() => {
            actionMutation.reset()
            setPendingAction(null)
          }}
          onConfirm={() => actionMutation.mutate(pendingAction)}
          title={t(`assignments.confirm.${pendingAction.type}.title`)}
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
        <button className={styles.secondaryButton} onClick={onAction} type="button">
          {action}
        </button>
      )}
    </div>
  )
}

function getAssignmentError(
  error: Error | null,
  t: (key: string) => string,
): string {
  if (error instanceof ApiError) {
    if (error.code === 'ASSIGNMENT_IN_USE') {
      return t('assignments.errors.inUse')
    }
    if (error.code === 'NETWORK_ERROR') {
      return t('assignments.errors.network')
    }
  }
  return t('assignments.errors.action')
}
