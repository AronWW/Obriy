import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Beaker, Edit3, Plus, RefreshCw, Search, Settings2, Unlink } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ApiError } from '../../../shared/api/api-client'
import { AssignmentConfirmDialog } from '../../assignments/components/AssignmentConfirmDialog'
import { AssignmentDialog } from '../../assignments/components/AssignmentDialog'
import {
  linkLessonTest,
  listLessonTests,
  listTests,
  reorderLessonTests,
  unlinkLessonTest,
  updateLessonTestVersion,
} from '../api/tests.api'
import { testQueryKeys } from '../model/test-query-keys'
import type { LessonTest, TestEditor, TestSummary } from '../model/test.types'
import styles from '../Tests.module.css'
import { TeacherTestReleaseDialog } from './TeacherTestReleaseDialog'

export function TeacherLessonTests({ contentLocale, lessonId, readOnly }: { contentLocale: TestEditor['contentLocale']; lessonId: string; readOnly: boolean }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [unlinkTarget, setUnlinkTarget] = useState<LessonTest | null>(null)
  const [releaseTarget, setReleaseTarget] = useState<LessonTest | null>(null)
  const query = useQuery({
    queryKey: testQueryKeys.lesson(lessonId),
    queryFn: () => listLessonTests(lessonId),
  })
  const action = useMutation({
    mutationFn: async (input: LessonTestAction) => {
      if (input.type === 'link') return linkLessonTest(lessonId, input.testId)
      if (input.type === 'unlink') {
        await unlinkLessonTest(lessonId, input.testId)
        return null
      }
      if (input.type === 'update') return updateLessonTestVersion(lessonId, input.testId)
      return reorderLessonTests(lessonId, input.testIds)
    },
    onSuccess: (result, input) => {
      if (input.type === 'link') {
        setPickerOpen(false)
        if (result && !Array.isArray(result)) setReleaseTarget(result)
      }
      if (input.type === 'unlink') setUnlinkTarget(null)
      void queryClient.invalidateQueries({ queryKey: testQueryKeys.lesson(lessonId) })
      void queryClient.invalidateQueries({ queryKey: testQueryKeys.lists })
    },
  })
  const links = query.data ?? []

  return (
    <section className={styles.lessonTests} aria-labelledby="lesson-tests-title">
      <header className={styles.lessonTestsHeader}>
        <div>
          <h2 id="lesson-tests-title">{t('tests.lesson.title')}</h2>
          <p>{t('tests.lesson.description')}</p>
        </div>
        {!readOnly && (
          <button className={styles.primaryButton} onClick={() => { action.reset(); setPickerOpen(true) }} type="button">
            <Plus size={17} aria-hidden="true" />
            {t('tests.lesson.add')}
          </button>
        )}
      </header>

      {query.isLoading && <p className={styles.sectionState}>{t('tests.lesson.loading')}</p>}
      {query.isError && (
        <div className={styles.sectionState} role="alert">
          <p>{t('tests.lesson.loadError')}</p>
          <button className={styles.secondaryButton} onClick={() => void query.refetch()} type="button">
            {t('tests.common.retry')}
          </button>
        </div>
      )}
      {!query.isLoading && !query.isError && links.length === 0 && (
        <div className={styles.lessonEmpty}>
          <Beaker size={27} aria-hidden="true" />
          <div>
            <strong>{t('tests.lesson.emptyTitle')}</strong>
            <p>{t('tests.lesson.emptyDescription')}</p>
          </div>
        </div>
      )}
      {links.length > 0 && (
        <div className={styles.lessonTestList}>
          {links.map((link, index) => (
            <article className={styles.lessonTestCard} key={link.id}>
              <span className={styles.lessonTestNumber}>{index + 1}</span>
              <div className={styles.lessonTestCopy}>
                <div>
                  <span>{t('tests.lesson.version', { version: link.revisionVersion })}</span>
                  <span>{t('tests.library.questions', { count: link.itemCount })}</span>
                  <span>{t('tests.library.points', { count: link.maxPoints })}</span>
                </div>
                <h3>{link.title}</h3>
                <p>{link.description || t('tests.library.noDescription')}</p>
                <small>
                  {lessonReleaseSummary(link, t)}
                </small>
              </div>
              <div className={styles.lessonTestActions}>
                {!readOnly && (
                  <>
                    <button aria-label={t('tests.lesson.moveUp')} disabled={action.isPending || index === 0} onClick={() => action.mutate({ type: 'reorder', testIds: move(links, index, -1) })} type="button">
                      <ArrowUp size={15} />
                    </button>
                    <button aria-label={t('tests.lesson.moveDown')} disabled={action.isPending || index === links.length - 1} onClick={() => action.mutate({ type: 'reorder', testIds: move(links, index, 1) })} type="button">
                      <ArrowDown size={15} />
                    </button>
                  </>
                )}
                {link.hasUpdate && !readOnly && (
                  <button aria-label={t('tests.lesson.updateVersion')} disabled={action.isPending} onClick={() => action.mutate({ type: 'update', testId: link.testId })} type="button">
                    <RefreshCw size={15} />
                  </button>
                )}
                {!readOnly && (
                  <button aria-label={t('tests.releases.open')} disabled={action.isPending} onClick={() => setReleaseTarget(link)} type="button">
                    <Settings2 size={15} />
                  </button>
                )}
                <Link aria-label={t('tests.actions.edit')} to={`/app/teacher/tests/${link.testId}/edit`}><Edit3 size={15} /></Link>
                {!readOnly && (
                  <button aria-label={t('tests.lesson.unlink')} className={styles.danger} onClick={() => setUnlinkTarget(link)} type="button"><Unlink size={15} /></button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {action.isError && !pickerOpen && !unlinkTarget && (
        <p className={styles.inlineError} role="alert">{lessonActionError(action.error, t)}</p>
      )}

      {pickerOpen && (
        <LessonTestPicker
          contentLocale={contentLocale}
          error={action.isError ? lessonActionError(action.error, t) : null}
          linkedIds={new Set(links.map((link) => link.testId))}
          onClose={() => setPickerOpen(false)}
          onSelect={(testId) => action.mutate({ type: 'link', testId })}
          pending={action.isPending}
        />
      )}
      {unlinkTarget && (
        <AssignmentConfirmDialog
          cancelLabel={t('tests.common.cancel')}
          confirmLabel={t('tests.lesson.unlinkConfirm')}
          description={t('tests.lesson.unlinkDescription', { title: unlinkTarget.title })}
          error={action.isError ? lessonActionError(action.error, t) : undefined}
          isDangerous
          isPending={action.isPending}
          onCancel={() => setUnlinkTarget(null)}
          onConfirm={() => action.mutate({ type: 'unlink', testId: unlinkTarget.testId })}
          title={t('tests.lesson.unlinkTitle')}
        />
      )}
      {releaseTarget && (
        <TeacherTestReleaseDialog
          lessonId={lessonId}
          onClose={() => setReleaseTarget(null)}
          testId={releaseTarget.testId}
          title={releaseTarget.title}
        />
      )}
    </section>
  )
}

type LessonTestAction =
  | { type: 'link'; testId: string }
  | { type: 'unlink'; testId: string }
  | { type: 'update'; testId: string }
  | { type: 'reorder'; testIds: string[] }

function move(links: LessonTest[], index: number, direction: -1 | 1): string[] {
  const next = [...links]
  const target = index + direction
  ;[next[index], next[target]] = [next[target], next[index]]
  return next.map((link) => link.testId)
}

function lessonReleaseSummary(link: LessonTest, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (link.activeReleaseCount > 0) return t('tests.lesson.activeClasses', { count: link.activeReleaseCount })
  const draftCount = link.releaseStatuses.filter((status) => status === 'DRAFT').length
  if (draftCount > 0) return t('tests.lesson.draftClasses', { count: draftCount })
  const scheduledCount = link.releaseStatuses.filter((status) => status === 'SCHEDULED').length
  if (scheduledCount > 0) return t('tests.lesson.scheduledClasses', { count: scheduledCount })
  const closedCount = link.releaseStatuses.filter((status) => status === 'CLOSED').length
  if (closedCount > 0) return t('tests.lesson.closedClasses', { count: closedCount })
  return t('tests.lesson.notReleased')
}

function LessonTestPicker({ contentLocale, error, linkedIds, onClose, onSelect, pending }: {
  contentLocale: TestEditor['contentLocale']
  error: string | null
  linkedIds: Set<string>
  onClose: () => void
  onSelect: (testId: string) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(search), 250)
    return () => window.clearTimeout(timeout)
  }, [search])
  const filters = useMemo(
    () => ({ contentLocale, search: debounced || undefined }),
    [contentLocale, debounced],
  )
  const query = useInfiniteQuery({
    queryKey: [...testQueryKeys.list(filters), 'lesson-picker'],
    queryFn: ({ pageParam }) => listTests(filters, pageParam, 50),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  const available = (query.data?.pages.flatMap((page) => page.items) ?? []).filter((test) => test.status !== 'ARCHIVED' && !linkedIds.has(test.id))
  return (
    <AssignmentDialog closeLabel={t('tests.common.close')} description={t('tests.lesson.pickerDescription')} onClose={onClose} title={t('tests.lesson.pickerTitle')} wide>
      <div className={styles.lessonPicker}>
        <label className={styles.searchField}>
          <Search size={17} />
          <input aria-label={t('tests.lesson.search')} onChange={(event) => setSearch(event.target.value)} placeholder={t('tests.lesson.searchPlaceholder')} type="search" value={search} />
        </label>
        {error && <p className={styles.inlineError}>{error}</p>}
        {query.isLoading && <p className={styles.sectionState}>{t('tests.lesson.loadingLibrary')}</p>}
        {query.isError && <p className={styles.sectionState}>{t('tests.lesson.libraryError')}</p>}
        {!query.isLoading && !query.isError && available.length === 0 && <p className={styles.sectionState}>{t('tests.lesson.noAvailable')}</p>}
        <div className={styles.pickerGrid}>
          {available.map((test) => <PickerTest key={test.id} onSelect={onSelect} pending={pending} test={test} />)}
        </div>
        {query.hasNextPage && (
          <button
            className={styles.loadMore}
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
            type="button"
          >
            {t('tests.library.more')}
          </button>
        )}
      </div>
    </AssignmentDialog>
  )
}

function PickerTest({ onSelect, pending, test }: { onSelect: (testId: string) => void; pending: boolean; test: TestSummary }) {
  const { t } = useTranslation()
  const revision = test.draftRevision ?? test.publishedRevision
  return (
    <button disabled={pending} onClick={() => onSelect(test.id)} type="button">
      <span><Beaker size={19} /></span>
      <div>
        <strong>{revision?.title || t('tests.common.untitled')}</strong>
        <small>{t('tests.library.questions', { count: revision?.itemCount ?? 0 })} · {t('tests.library.points', { count: revision?.totalMaxPoints ?? 0 })}</small>
      </div>
      <Plus size={16} />
    </button>
  )
}

function lessonActionError(error: Error | null, t: (key: string) => string): string {
  if (error instanceof ApiError) {
    if (error.code === 'TEST_INCOMPLETE' || error.code === 'TEST_PUBLISHED_REVISION_NOT_FOUND') return t('tests.lesson.errors.incomplete')
    if (error.code === 'LESSON_TEST_ALREADY_LINKED') return t('tests.lesson.errors.alreadyLinked')
    if (error.code === 'TEST_RELEASE_HAS_OPEN_ATTEMPTS') return t('tests.lesson.errors.openAttempts')
    if (error.code === 'TEST_CONTENT_LOCALE_MISMATCH') return t('tests.lesson.errors.localeMismatch')
  }
  return t('tests.lesson.errors.action')
}
