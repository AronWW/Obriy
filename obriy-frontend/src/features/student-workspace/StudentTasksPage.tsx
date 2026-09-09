import { useInfiniteQuery } from '@tanstack/react-query'
import { Filter, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { getStudentTasks } from './api/student-workspace.api'
import { StudentWorkRow } from './components/StudentWorkRow'
import { studentWorkspaceQueryKeys } from './model/student-workspace-query-keys'
import type {
  StudentTasksRequiredFilter,
  StudentTasksStatusFilter,
} from './model/student-workspace.types'
import styles from './StudentWorkspace.module.css'

const statusValues: StudentTasksStatusFilter[] = [
  'ALL',
  'ATTENTION',
  'NOT_STARTED',
  'IN_PROGRESS',
  'NEEDS_REVISION',
  'SCHEDULED',
  'AWAITING_REVIEW',
  'COMPLETED',
  'EXPIRED',
]
const requiredValues: StudentTasksRequiredFilter[] = [
  'ALL',
  'REQUIRED',
  'OPTIONAL',
]

export function StudentTasksPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const status = parseStatus(params.get('status'))
  const required = parseRequired(params.get('required'))
  const search = params.get('search')?.trim() ?? ''
  const filters = { status, required, search }
  const query = useInfiniteQuery({
    queryKey: studentWorkspaceQueryKeys.tasks(filters),
    queryFn: ({ pageParam }) => getStudentTasks(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  const classroom = query.data?.pages[0]?.class
  const items = query.data?.pages.flatMap((page) => page.items) ?? []
  const setFilter = (key: 'status' | 'required' | 'search', value: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'ALL') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  return (
    <section className={styles.page} aria-labelledby="student-tasks-title">
      <div className={styles.content}>
        <header className={styles.pageHeader}>
          <div>
            <h1 id="student-tasks-title">{t('studentWorkspace.tasks.title')}</h1>
            <p>{t('studentWorkspace.tasks.description')}</p>
          </div>
        </header>

        <div className={styles.filters} aria-label={t('studentWorkspace.tasks.filters')}>
          <label className={styles.searchField}>
            <span className={styles.srOnly}>{t('studentWorkspace.tasks.search')}</span>
            <Search size={17} aria-hidden="true" />
            <input
              onChange={(event) => setFilter('search', event.target.value)}
              placeholder={t('studentWorkspace.tasks.search')}
              type="search"
              value={search}
            />
          </label>
          <label className={styles.selectField}>
            <Filter size={16} aria-hidden="true" />
            <span className={styles.srOnly}>{t('studentWorkspace.tasks.statusFilter')}</span>
            <select
              aria-label={t('studentWorkspace.tasks.statusFilter')}
              onChange={(event) => setFilter('status', event.target.value)}
              value={status}
            >
              {statusValues.map((value) => (
                <option key={value} value={value}>
                  {t(`studentWorkspace.filters.status.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.selectField}>
            <span className={styles.srOnly}>{t('studentWorkspace.tasks.requiredFilter')}</span>
            <select
              aria-label={t('studentWorkspace.tasks.requiredFilter')}
              onChange={(event) => setFilter('required', event.target.value)}
              value={required}
            >
              {requiredValues.map((value) => (
                <option key={value} value={value}>
                  {t(`studentWorkspace.filters.required.${value}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {query.isLoading && <StatePanel text={t('studentWorkspace.states.loading')} />}
        {query.isError && (
          <StatePanel
            action={() => void query.refetch()}
            actionLabel={t('studentWorkspace.states.retry')}
            text={t('studentWorkspace.states.error')}
          />
        )}
        {!query.isLoading && !query.isError && !classroom && (
          <StatePanel
            link="/app/student/classes"
            actionLabel={t('studentWorkspace.noClass.action')}
            text={t('studentWorkspace.noClass.description')}
            title={t('studentWorkspace.noClass.title')}
          />
        )}
        {!query.isLoading && !query.isError && classroom && items.length === 0 && (
          <StatePanel
            text={
              search || status !== 'ALL' || required !== 'ALL'
                ? t('studentWorkspace.tasks.noMatches')
                : t('studentWorkspace.tasks.empty')
            }
          />
        )}
        {items.length > 0 && (
          <div className={styles.workList}>
            {items.map((item) => (
              <StudentWorkRow item={item} key={item.releaseId} />
            ))}
          </div>
        )}
        {query.hasNextPage && (
          <button
            className={styles.loadMore}
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
            type="button"
          >
            {query.isFetchingNextPage
              ? t('studentWorkspace.tasks.loadingMore')
              : t('studentWorkspace.tasks.loadMore')}
          </button>
        )}
      </div>
    </section>
  )
}

function StatePanel({
  action,
  actionLabel,
  link,
  text,
  title,
}: {
  action?: () => void
  actionLabel?: string
  link?: string
  text: string
  title?: string
}) {
  return (
    <div className={styles.statePanel} role={action ? 'alert' : undefined}>
      {title && <h2>{title}</h2>}
      <p>{text}</p>
      {action && actionLabel && (
        <button onClick={action} type="button">{actionLabel}</button>
      )}
      {link && actionLabel && <Link to={link}>{actionLabel}</Link>}
    </div>
  )
}

function parseStatus(value: string | null): StudentTasksStatusFilter {
  return statusValues.includes(value as StudentTasksStatusFilter)
    ? (value as StudentTasksStatusFilter)
    : 'ALL'
}

function parseRequired(value: string | null): StudentTasksRequiredFilter {
  return requiredValues.includes(value as StudentTasksRequiredFilter)
    ? (value as StudentTasksRequiredFilter)
    : 'ALL'
}
