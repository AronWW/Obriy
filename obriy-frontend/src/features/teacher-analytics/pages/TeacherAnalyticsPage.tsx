import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownAZ,
  ArrowRight,
  ArrowUpAZ,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  Search,
  UsersRound,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { listTeacherClasses } from '../../classes/api/classes.api'
import { TeacherLeaderboardTab } from '../../leaderboard'
import { getTeacherClassAnalytics } from '../api/teacher-analytics.api'
import { teacherAnalyticsQueryKeys } from '../model/teacher-analytics-query-keys'
import {
  formatAnalyticsDate,
  formatAnalyticsPercent,
} from '../model/teacher-analytics-format'
import type {
  TeacherAnalyticsStatusCounts,
  TeacherAnalyticsStudent,
} from '../model/teacher-analytics.types'
import styles from '../TeacherAnalytics.module.css'

type AnalyticsTab = 'students' | 'materials' | 'leaderboard'
type StudentSort = 'name' | 'completion' | 'average' | 'activity'

export function TeacherAnalyticsPage() {
  const { i18n, t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<StudentSort>('name')
  const [descending, setDescending] = useState(false)
  const classesQuery = useQuery({
    queryKey: ['classes', 'teacher'],
    queryFn: listTeacherClasses,
  })
  const requestedClassId = searchParams.get('classId') ?? ''
  const selectedClassId =
    classesQuery.data?.some(({ id }) => id === requestedClassId)
      ? requestedClassId
      : (classesQuery.data?.[0]?.id ?? '')
  const requestedTab = searchParams.get('tab')
  const tab: AnalyticsTab =
    requestedTab === 'materials' || requestedTab === 'leaderboard'
      ? requestedTab
      : 'students'
  const analyticsQuery = useQuery({
    queryKey: teacherAnalyticsQueryKeys.class(selectedClassId),
    queryFn: () => getTeacherClassAnalytics(selectedClassId),
    enabled: Boolean(selectedClassId),
  })

  const visibleStudents = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase(
      i18n.resolvedLanguage === 'en' ? 'en' : 'uk',
    )
    const students = (analyticsQuery.data?.students ?? []).filter((student) =>
      student.displayName.toLocaleLowerCase().includes(normalizedSearch),
    )
    return students.toSorted((left, right) => {
      const direction = descending ? -1 : 1
      if (sort === 'name') {
        return (
          left.displayName.localeCompare(
            right.displayName,
            i18n.resolvedLanguage === 'en' ? 'en' : 'uk',
          ) * direction
        )
      }
      const leftValue = studentSortValue(left, sort)
      const rightValue = studentSortValue(right, sort)
      if (leftValue === null && rightValue === null) return 0
      if (leftValue === null) return 1
      if (rightValue === null) return -1
      return (leftValue - rightValue) * direction
    })
  }, [analyticsQuery.data?.students, descending, i18n.resolvedLanguage, search, sort])

  const updateQuery = (updates: { classId?: string; tab?: AnalyticsTab }) => {
    const next = new URLSearchParams(searchParams)
    if (updates.classId) next.set('classId', updates.classId)
    if (updates.tab) next.set('tab', updates.tab)
    setSearchParams(next)
  }

  return (
    <main className={styles.page} aria-labelledby="teacher-analytics-title">
      <div className={styles.content}>
        <header className={styles.intro}>
          <div>
            <h1 id="teacher-analytics-title">{t('teacherAnalytics.title')}</h1>
            <p>{t('teacherAnalytics.description')}</p>
          </div>
          {classesQuery.data && classesQuery.data.length > 0 && (
            <label className={styles.classSelect}>
              <span>{t('teacherAnalytics.classSelector')}</span>
              <select
                value={selectedClassId}
                onChange={(event) => updateQuery({ classId: event.target.value })}
              >
                {classesQuery.data.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </header>

        {classesQuery.isLoading && <LoadingState />}
        {classesQuery.isError && (
          <ErrorState onRetry={() => void classesQuery.refetch()} />
        )}
        {classesQuery.data?.length === 0 && <NoClassesState />}

        {selectedClassId && analyticsQuery.isLoading && <LoadingState />}
        {selectedClassId && analyticsQuery.isError && (
          <ErrorState onRetry={() => void analyticsQuery.refetch()} />
        )}

        {analyticsQuery.data && (
          <>
            <section
              className={styles.metricsGrid}
              aria-label={t('teacherAnalytics.summary.label')}
            >
              <MetricCard
                icon={UsersRound}
                label={t('teacherAnalytics.summary.students')}
                value={String(analyticsQuery.data.metrics.studentCount)}
              />
              <MetricCard
                icon={BookOpen}
                label={t('teacherAnalytics.summary.required')}
                value={String(analyticsQuery.data.metrics.requiredReleaseCount)}
              />
              <MetricCard
                icon={CheckCircle2}
                label={t('teacherAnalytics.summary.completion')}
                value={formatAnalyticsPercent(analyticsQuery.data.metrics.completionPercent, t('teacherAnalytics.common.noData'))}
              />
              <MetricCard
                icon={ClipboardCheck}
                label={t('teacherAnalytics.summary.average')}
                value={formatAnalyticsPercent(analyticsQuery.data.metrics.averagePercent, t('teacherAnalytics.common.noData'))}
              />
              <MetricCard
                accent={analyticsQuery.data.metrics.awaitingReviewCount > 0}
                icon={RefreshCw}
                label={t('teacherAnalytics.summary.review')}
                value={String(analyticsQuery.data.metrics.awaitingReviewCount)}
              />
            </section>

            <div className={styles.tabs} role="tablist" aria-label={t('teacherAnalytics.tabs.label')}>
              {(['students', 'materials', 'leaderboard'] as const).map((value) => (
                <button
                  aria-selected={tab === value}
                  className={tab === value ? styles.activeTab : undefined}
                  key={value}
                  onClick={() => updateQuery({ tab: value })}
                  role="tab"
                  type="button"
                >
                  {t(`teacherAnalytics.tabs.${value}`)}
                </button>
              ))}
            </div>

            {tab === 'students' ? (
              <StudentsTab
                classId={selectedClassId}
                descending={descending}
                onDirectionChange={() => setDescending((value) => !value)}
                onSearchChange={setSearch}
                onSortChange={setSort}
                search={search}
                sort={sort}
                students={visibleStudents}
                totalStudents={analyticsQuery.data.students.length}
              />
            ) : tab === 'materials' ? (
              <MaterialsTab lessons={analyticsQuery.data.lessons} />
            ) : (
              <TeacherLeaderboardTab classId={selectedClassId} />
            )}
          </>
        )}
      </div>
    </main>
  )
}

function MetricCard({ accent = false, icon: Icon, label, value }: {
  accent?: boolean
  icon: typeof UsersRound
  label: string
  value: string
}) {
  return (
    <article className={styles.metricCard} data-accent={accent || undefined}>
      <span aria-hidden="true"><Icon size={20} /></span>
      <div><strong>{value}</strong><p>{label}</p></div>
    </article>
  )
}

function StudentsTab({ classId, descending, onDirectionChange, onSearchChange, onSortChange, search, sort, students, totalStudents }: {
  classId: string
  descending: boolean
  onDirectionChange: () => void
  onSearchChange: (value: string) => void
  onSortChange: (value: StudentSort) => void
  search: string
  sort: StudentSort
  students: TeacherAnalyticsStudent[]
  totalStudents: number
}) {
  const { i18n, t } = useTranslation()
  return (
    <section className={styles.panel} aria-labelledby="analytics-students-title">
      <header className={styles.panelHeader}>
        <div>
          <h2 id="analytics-students-title">{t('teacherAnalytics.students.title')}</h2>
          <p>{t('teacherAnalytics.students.description')}</p>
        </div>
        <div className={styles.studentTools}>
          <label className={styles.searchField}>
            <Search aria-hidden="true" size={16} />
            <span className={styles.srOnly}>{t('teacherAnalytics.students.search')}</span>
            <input
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t('teacherAnalytics.students.searchPlaceholder')}
              type="search"
              value={search}
            />
          </label>
          <label className={styles.sortField}>
            <span className={styles.srOnly}>{t('teacherAnalytics.students.sort')}</span>
            <select
              aria-label={t('teacherAnalytics.students.sort')}
              onChange={(event) => onSortChange(event.target.value as StudentSort)}
              value={sort}
            >
              {(['name', 'completion', 'average', 'activity'] as const).map((value) => (
                <option key={value} value={value}>{t(`teacherAnalytics.students.sorts.${value}`)}</option>
              ))}
            </select>
          </label>
          <button
            aria-label={t(descending ? 'teacherAnalytics.students.descending' : 'teacherAnalytics.students.ascending')}
            className={styles.directionButton}
            onClick={onDirectionChange}
            type="button"
          >
            {descending ? <ArrowDownAZ aria-hidden="true" size={18} /> : <ArrowUpAZ aria-hidden="true" size={18} />}
          </button>
        </div>
      </header>
      {totalStudents === 0 ? (
        <EmptyState text={t('teacherAnalytics.students.empty')} />
      ) : students.length === 0 ? (
        <EmptyState text={t('teacherAnalytics.students.noResults')} />
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.studentsTable}>
            <thead><tr>
              <th>{t('teacherAnalytics.students.columns.student')}</th>
              <th>{t('teacherAnalytics.students.columns.progress')}</th>
              <th>{t('teacherAnalytics.students.columns.average')}</th>
              <th>{t('teacherAnalytics.students.columns.status')}</th>
              <th>{t('teacherAnalytics.students.columns.activity')}</th>
              <th><span className={styles.srOnly}>{t('teacherAnalytics.students.columns.open')}</span></th>
            </tr></thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td><StudentIdentity student={student} /></td>
                  <td><strong>{formatAnalyticsPercent(student.completionPercent, t('teacherAnalytics.common.noData'))}</strong><small>{t('teacherAnalytics.students.completed', { completed: student.completedCount, total: student.requiredCount })}</small></td>
                  <td><strong>{formatAnalyticsPercent(student.averagePercent, t('teacherAnalytics.common.noData'))}</strong></td>
                  <td><StatusSummary counts={student.statuses} /></td>
                  <td>{student.lastActivityAt ? <time dateTime={student.lastActivityAt}>{formatAnalyticsDate(student.lastActivityAt, i18n.resolvedLanguage)}</time> : t('teacherAnalytics.common.noActivity')}</td>
                  <td><Link aria-label={t('teacherAnalytics.students.openStudent', { name: student.displayName })} className={styles.rowLink} to={`/app/teacher/analytics/classes/${classId}/students/${student.id}`}><ArrowRight aria-hidden="true" size={17} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function MaterialsTab({ lessons }: { lessons: import('../model/teacher-analytics.types').TeacherAnalyticsLesson[] }) {
  const { i18n, t } = useTranslation()
  return (
    <section className={styles.materials} aria-labelledby="analytics-materials-title">
      <header className={styles.materialsHeader}>
        <h2 id="analytics-materials-title">{t('teacherAnalytics.materials.title')}</h2>
        <p>{t('teacherAnalytics.materials.description')}</p>
      </header>
      {lessons.length === 0 ? <EmptyState text={t('teacherAnalytics.materials.empty')} /> : lessons.map((lesson) => (
        <article className={styles.lessonCard} key={lesson.id}>
          <header>
            <div><h3>{lesson.title}</h3><span>{t('teacherAnalytics.materials.tests', { count: lesson.tests.length })}</span></div>
            <div className={styles.lessonMetrics}><span>{t('teacherAnalytics.materials.completion')} <strong>{formatAnalyticsPercent(lesson.completionPercent, t('teacherAnalytics.common.noData'))}</strong></span><span>{t('teacherAnalytics.materials.average')} <strong>{formatAnalyticsPercent(lesson.averagePercent, t('teacherAnalytics.common.noData'))}</strong></span></div>
          </header>
          <div className={styles.testList}>
            {lesson.tests.map((test) => (
              <div className={styles.testRow} key={test.releaseId}>
                <div className={styles.testTitle}>
                  <strong>{test.title}</strong>
                  <div><span data-release={test.releaseStatus}>{t(`teacherAnalytics.releaseStatus.${test.releaseStatus}`)}</span><span>{t(test.isRequired ? 'teacherAnalytics.materials.required' : 'teacherAnalytics.materials.optional')}</span></div>
                </div>
                <div className={styles.testDates}>
                  <span>{t('teacherAnalytics.materials.deadline')}</span>
                  <strong>{test.dueAt ? formatAnalyticsDate(test.dueAt, i18n.resolvedLanguage) : t('teacherAnalytics.common.noDeadline')}</strong>
                </div>
                <div className={styles.testScores}><span>{t('teacherAnalytics.materials.completion')} <strong>{formatAnalyticsPercent(test.completionPercent, t('teacherAnalytics.common.noData'))}</strong></span><span>{t('teacherAnalytics.materials.average')} <strong>{formatAnalyticsPercent(test.averagePercent, t('teacherAnalytics.common.noData'))}</strong></span></div>
                <StatusSummary counts={test.statuses} compact />
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  )
}

function StudentIdentity({ student }: { student: TeacherAnalyticsStudent }) {
  return (
    <div className={styles.studentIdentity}>
      <span aria-hidden="true">
        {student.avatarUrl ? <img alt="" src={student.avatarUrl} /> : initials(student.displayName)}
      </span>
      <strong>{student.displayName}</strong>
    </div>
  )
}

function StatusSummary({ compact = false, counts }: { compact?: boolean; counts: TeacherAnalyticsStatusCounts }) {
  const { t } = useTranslation()
  const items = [
    ['completed', counts.completed],
    ['awaitingReview', counts.awaitingReview],
    ['inProgress', counts.inProgress],
    ['needsRevision', counts.needsRevision],
    ['expired', counts.expired],
    ['notStarted', counts.notStarted],
  ] as const
  return (
    <div className={compact ? styles.compactStatuses : styles.statuses}>
      {items.filter(([, count]) => count > 0).map(([status, count]) => (
        <span data-status={status} key={status} title={t(`teacherAnalytics.studentStatus.${status}`)}>{compact ? `${count}` : `${t(`teacherAnalytics.studentStatus.${status}`)}: ${count}`}</span>
      ))}
    </div>
  )
}

function LoadingState() {
  const { t } = useTranslation()
  return <div aria-live="polite" className={styles.loading}><span /><span /><span /><p>{t('teacherAnalytics.loading')}</p></div>
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return <div className={styles.errorState} role="alert"><div><strong>{t('teacherAnalytics.error.title')}</strong><p>{t('teacherAnalytics.error.description')}</p></div><button onClick={onRetry} type="button"><RefreshCw aria-hidden="true" size={15} />{t('teacherAnalytics.error.retry')}</button></div>
}

function NoClassesState() {
  const { t } = useTranslation()
  return <div className={styles.largeEmpty}><SchoolIcon /><h2>{t('teacherAnalytics.noClasses.title')}</h2><p>{t('teacherAnalytics.noClasses.description')}</p><Link to="/app/teacher/classes?create=1">{t('teacherAnalytics.noClasses.action')}</Link></div>
}

function SchoolIcon() {
  return <UsersRound aria-hidden="true" size={30} />
}

function EmptyState({ text }: { text: string }) {
  return <div className={styles.emptyState}><p>{text}</p></div>
}

function studentSortValue(student: TeacherAnalyticsStudent, sort: Exclude<StudentSort, 'name'>): number | null {
  if (sort === 'completion') return student.completionPercent
  if (sort === 'average') return student.averagePercent
  return student.lastActivityAt ? new Date(student.lastActivityAt).getTime() : null
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}
