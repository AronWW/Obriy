import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  Edit3,
  ListChecks,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { AssignmentConfirmDialog } from '../../assignments/components/AssignmentConfirmDialog'
import {
  archiveTest,
  deleteTest,
  listTests,
  restoreTest,
} from '../api/tests.api'
import { testQueryKeys } from '../model/test-query-keys'
import type { TestFilters, TestStatus, TestSummary } from '../model/test.types'
import styles from '../Tests.module.css'

type Action = 'archive' | 'restore' | 'delete'

export function TeacherTestsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<'ALL' | TestStatus>('ALL')
  const [pending, setPending] = useState<{ test: TestSummary; action: Action } | null>(
    null,
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 250)
    return () => window.clearTimeout(timeout)
  }, [search])
  const filters = useMemo<TestFilters>(
    () => ({
      search: debouncedSearch,
      status: status === 'ALL' ? undefined : status,
    }),
    [debouncedSearch, status],
  )
  const testsQuery = useInfiniteQuery({
    queryKey: testQueryKeys.list(filters),
    queryFn: ({ pageParam }) => listTests(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
  const tests = testsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const actionMutation = useMutation({
    mutationFn: async ({ test, action }: NonNullable<typeof pending>) => {
      if (action === 'archive') return archiveTest(test.id)
      if (action === 'restore') return restoreTest(test.id)
      await deleteTest(test.id)
      return null
    },
    onSuccess: () => {
      setPending(null)
      void queryClient.invalidateQueries({ queryKey: testQueryKeys.all })
    },
  })

  return (
    <section className={styles.page}>
      <div className={styles.content}>
        <header className={styles.intro}>
          <div>
            <h1>{t('tests.library.title')}</h1>
            <p>{t('tests.library.description')}</p>
          </div>
          <button
            className={styles.primaryButton}
            onClick={() => navigate('/app/teacher/tests/new')}
            type="button"
          >
            <Plus size={17} />
            {t('tests.library.create')}
          </button>
        </header>

        <div className={styles.filters}>
          <label className={styles.searchField}>
            <Search size={17} />
            <input
              aria-label={t('tests.library.search')}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('tests.library.searchPlaceholder')}
              type="search"
              value={search}
            />
          </label>
          <label className={styles.filterField}>
            <span>{t('tests.library.status')}</span>
            <select
              onChange={(event) =>
                setStatus(event.target.value as 'ALL' | TestStatus)
              }
              value={status}
            >
              <option value="ALL">{t('tests.status.ALL')}</option>
              <option value="DRAFT">{t('tests.status.DRAFT')}</option>
              <option value="PUBLISHED">{t('tests.status.PUBLISHED')}</option>
              <option value="ARCHIVED">{t('tests.status.ARCHIVED')}</option>
            </select>
          </label>
        </div>

        {testsQuery.isLoading && <Status message={t('tests.library.loading')} />}
        {testsQuery.isError && (
          <Status
            action={t('tests.common.retry')}
            message={t('tests.library.error')}
            onAction={() => void testsQuery.refetch()}
          />
        )}
        {!testsQuery.isLoading && !testsQuery.isError && tests.length === 0 && (
          <Status
            action={t('tests.library.create')}
            message={t('tests.library.emptyDescription')}
            onAction={() => navigate('/app/teacher/tests/new')}
            title={t('tests.library.emptyTitle')}
          />
        )}
        {tests.length > 0 && (
          <div className={styles.libraryList}>
            {tests.map((test) => {
              const revision = test.draftRevision ?? test.publishedRevision
              const title = revision?.title.trim() || t('tests.common.untitled')
              return (
                <article className={styles.libraryRow} key={test.id}>
                  <span className={styles.rowIcon}>
                    <ListChecks size={21} />
                  </span>
                  <div className={styles.rowCopy}>
                    <div className={styles.rowMeta}>
                      <span className={`${styles.status} ${styles[`status${test.status}`]}`}>
                        {t(`tests.status.${test.status}`)}
                      </span>
                      <span>
                        {t('tests.library.questions', {
                          count: revision?.itemCount ?? 0,
                        })}
                      </span>
                      <span>
                        {t('tests.library.points', {
                          count: revision?.totalMaxPoints ?? 0,
                        })}
                      </span>
                    </div>
                    <h2>{title}</h2>
                    <p>{revision?.description || t('tests.library.noDescription')}</p>
                  </div>
                  <div className={styles.rowActions}>
                    <Link
                      className={styles.secondaryButton}
                      to={`/app/teacher/tests/${test.id}/edit`}
                    >
                      <Edit3 size={15} />
                      {t('tests.actions.edit')}
                    </Link>
                    {test.status === 'ARCHIVED' ? (
                      <button
                        className={styles.iconButton}
                        onClick={() => setPending({ test, action: 'restore' })}
                        title={t('tests.actions.restore')}
                        type="button"
                      >
                        <RotateCcw size={17} />
                      </button>
                    ) : (
                      <button
                        className={styles.iconButton}
                        onClick={() => setPending({ test, action: 'archive' })}
                        title={t('tests.actions.archive')}
                        type="button"
                      >
                        <Archive size={17} />
                      </button>
                    )}
                    <button
                      className={`${styles.iconButton} ${styles.danger}`}
                      onClick={() => setPending({ test, action: 'delete' })}
                      title={t('tests.actions.delete')}
                      type="button"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
        {testsQuery.hasNextPage && (
          <button
            className={styles.loadMore}
            disabled={testsQuery.isFetchingNextPage}
            onClick={() => void testsQuery.fetchNextPage()}
            type="button"
          >
            {t('tests.library.more')}
          </button>
        )}
      </div>

      {pending && (
        <AssignmentConfirmDialog
          cancelLabel={t('tests.common.cancel')}
          confirmLabel={t(`tests.confirm.${pending.action}.confirm`)}
          description={t(`tests.confirm.${pending.action}.description`, {
            title:
              pending.test.draftRevision?.title ||
              pending.test.publishedRevision?.title ||
              t('tests.common.untitled'),
          })}
          error={actionMutation.isError ? t('tests.errors.action') : undefined}
          isDangerous={pending.action === 'delete'}
          isPending={actionMutation.isPending}
          onCancel={() => setPending(null)}
          onConfirm={() => actionMutation.mutate(pending)}
          title={t(`tests.confirm.${pending.action}.title`)}
        />
      )}
    </section>
  )
}

function Status({
  action,
  message,
  onAction,
  title,
}: {
  action?: string
  message: string
  onAction?: () => void
  title?: string
}) {
  return (
    <div className={styles.statusPanel}>
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
