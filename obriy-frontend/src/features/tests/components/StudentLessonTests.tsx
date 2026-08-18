import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Beaker,
  Check,
  CheckCircle2,
  Clock3,
  ListChecks,
  PenLine,
  Play,
  RotateCcw,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../shared/api/api-client'
import { AssignmentConfirmDialog } from '../../assignments/components/AssignmentConfirmDialog'
import { AssignmentDialog } from '../../assignments/components/AssignmentDialog'
import type { ChoiceOption, ChoicePublicConfig, WrittenPublicConfig } from '../../assignments/model/assignment.types'
import {
  getStudentTestRelease,
  listStudentLessonTests,
  saveStudentTestAnswer,
  startStudentTestAttempt,
  submitStudentTestAttempt,
} from '../api/tests.api'
import { testQueryKeys } from '../model/test-query-keys'
import type {
  StudentLessonTest,
  StudentTestAttempt,
  StudentTestItem,
} from '../model/test.types'
import styles from '../Tests.module.css'

type ResponseData = Record<string, unknown>

export function StudentLessonTests({ lessonId }: { lessonId: string }) {
  const { t } = useTranslation()
  const [releaseId, setReleaseId] = useState<string | null>(null)
  const query = useQuery({
    queryKey: testQueryKeys.studentLesson(lessonId),
    queryFn: () => listStudentLessonTests(lessonId),
  })
  const tests = query.data ?? []
  return (
    <section className={styles.studentTests} aria-labelledby="student-tests-title">
      <header className={styles.studentTestsHeader}>
        <p className={styles.eyebrow}>
          <Beaker size={15} />
          {t('tests.student.eyebrow')}
        </p>
        <h2 id="student-tests-title">{t('tests.student.title')}</h2>
        <p>{t('tests.student.description')}</p>
      </header>
      {query.isLoading && <p className={styles.sectionState}>{t('tests.student.loading')}</p>}
      {query.isError && (
        <div className={styles.sectionState} role="alert">
          <p>{t('tests.student.loadError')}</p>
          <button className={styles.secondaryButton} onClick={() => void query.refetch()} type="button">{t('tests.common.retry')}</button>
        </div>
      )}
      {!query.isLoading && !query.isError && tests.length === 0 && (
        <div className={styles.lessonEmpty}>
          <Beaker size={27} />
          <div><strong>{t('tests.student.emptyTitle')}</strong><p>{t('tests.student.emptyDescription')}</p></div>
        </div>
      )}
      {tests.length > 0 && (
        <div className={styles.studentTestList}>
          {tests.map((test, index) => (
            <StudentTestCard key={test.releaseId} number={index + 1} onOpen={() => setReleaseId(test.releaseId)} test={test} />
          ))}
        </div>
      )}
      {releaseId && <StudentTestRunner lessonId={lessonId} onClose={() => setReleaseId(null)} releaseId={releaseId} />}
    </section>
  )
}

function StudentTestCard({ number, onOpen, test }: { number: number; onOpen: () => void; test: StudentLessonTest }) {
  const { t } = useTranslation()
  const attempt = test.attempt
  const resultVisible = attempt?.scorePoints !== null && attempt?.scorePoints !== undefined
  return (
    <article className={styles.studentTestCard}>
      <span className={styles.studentTestNumber}>{number}</span>
      <div className={styles.studentTestCopy}>
        <div className={styles.studentTestMeta}>
          <span>{t('tests.student.questions', { count: test.itemCount })}</span>
          <span>{t('tests.library.points', { count: test.maxPoints })}</span>
          {test.timeLimitSeconds && <span><Clock3 size={13} />{t('tests.student.minutes', { count: Math.ceil(test.timeLimitSeconds / 60) })}</span>}
        </div>
        <h3>{test.title}</h3>
        <p>{test.description || t('tests.library.noDescription')}</p>
        <div className={styles.studentTestResult}>
          <span className={`${styles.testState} ${styles[`testState${test.stateStatus}`]}`}>{t(`tests.student.status.${test.stateStatus}`)}</span>
          {resultVisible && <strong>{t('tests.student.score', { score: attempt.scorePoints, max: attempt.maxPoints })}</strong>}
        </div>
      </div>
      <button className={styles.primaryButton} onClick={onOpen} type="button">
        {test.stateStatus === 'NOT_STARTED' ? <Play size={16} /> : test.stateStatus === 'NEEDS_REVISION' ? <RotateCcw size={16} /> : <ArrowRight size={16} />}
        {t(testActionKey(test))}
      </button>
    </article>
  )
}

function StudentTestRunner({ lessonId, onClose, releaseId }: { lessonId: string; onClose: () => void; releaseId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [activeIndex, setActiveIndex] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, ResponseData>>({})
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<Error | null>(null)
  const hydratedAttempt = useRef<string | null>(null)
  const refreshedExpiredAttempt = useRef<string | null>(null)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const query = useQuery({
    queryKey: testQueryKeys.release(releaseId),
    queryFn: () => getStudentTestRelease(releaseId),
  })
  const release = query.data
  const attempt = release?.attempt ?? null
  useEffect(() => {
    if (!attempt || hydratedAttempt.current === attempt.id) return
    const next = Object.fromEntries(attempt.answers.map((answer) => [answer.testItemId, answer.responseData]))
    const hashes = Object.fromEntries(Object.entries(next).map(([key, value]) => [key, JSON.stringify(value)]))
    hydratedAttempt.current = attempt.id
    // Server state initializes a new whole-test attempt exactly once.
    setDrafts(next)
    setSaved(hashes)
    setAttemptId(attempt.id)
    setActiveIndex(0)
  }, [attempt])

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: testQueryKeys.release(releaseId) })
    await queryClient.invalidateQueries({ queryKey: testQueryKeys.studentLesson(lessonId) })
  }
  const start = useMutation({
    mutationFn: () => startStudentTestAttempt(releaseId),
    onSuccess: (next) => {
      seedAttempt(next)
      void refresh()
    },
  })
  const enqueueAnswerSave = useCallback(
    (itemId: string, response: ResponseData) => {
      if (!attemptId) return Promise.reject(new Error('Attempt is unavailable'))
      const operation = saveQueue.current.then(async () => {
        await saveStudentTestAnswer(attemptId, itemId, response)
      })
      saveQueue.current = operation.catch(() => undefined)
      return operation
    },
    [attemptId],
  )
  const save = useMutation({
    mutationFn: ({ itemId, response }: { itemId: string; response: ResponseData }) =>
      enqueueAnswerSave(itemId, response),
    onSuccess: (_next, variables) => {
      setSaved((current) => ({ ...current, [variables.itemId]: JSON.stringify(variables.response) }))
    },
  })
  const submit = useMutation({
    mutationFn: async () => {
      if (!attemptId) throw new Error('Attempt is unavailable')
      await persistDirtyAnswers()
      return submitStudentTestAttempt(attemptId)
    },
    onSuccess: (next) => {
      setConfirmSubmit(false)
      queryClient.setQueryData<StudentLessonTest>(testQueryKeys.release(releaseId), (current) =>
        current ? { ...current, attempt: next } : current,
      )
      void refresh()
    },
  })

  const effectiveAttempt =
    attemptId && attempt?.id === attemptId
      ? attempt
      : attemptId && start.data?.id === attemptId
        ? start.data
        : attempt
  const activeItem = release?.items[activeIndex]
  const activeDraft = activeItem ? drafts[activeItem.id] ?? emptyResponse(activeItem) : null
  const draftHash = activeDraft ? JSON.stringify(activeDraft) : ''
  const editable = effectiveAttempt?.status === 'IN_PROGRESS'
  const remainingSeconds = useRemainingSeconds(effectiveAttempt?.expiresAt ?? null, editable)
  useEffect(() => {
    if (remainingSeconds !== 0 || !effectiveAttempt || refreshedExpiredAttempt.current === effectiveAttempt.id) return
    refreshedExpiredAttempt.current = effectiveAttempt.id
    void queryClient.invalidateQueries({ queryKey: testQueryKeys.release(releaseId) })
    void queryClient.invalidateQueries({ queryKey: testQueryKeys.studentLesson(lessonId) })
  }, [effectiveAttempt, lessonId, queryClient, releaseId, remainingSeconds])
  useEffect(() => {
    if (
      !editable ||
      !attemptId ||
      !activeItem ||
      confirmSubmit ||
      closing ||
      submit.isPending ||
      draftHash === saved[activeItem.id]
    ) return
    const response = drafts[activeItem.id] ?? emptyResponse(activeItem)
    const timeout = window.setTimeout(() => save.mutate({ itemId: activeItem.id, response }), 800)
    return () => window.clearTimeout(timeout)
  }, [activeItem, attemptId, closing, confirmSubmit, draftHash, drafts, editable, save, saved, submit.isPending])

  const allAnswered = useMemo(
    () => release?.items.every((item) => hasAnswer(item, drafts[item.id] ?? emptyResponse(item))) ?? false,
    [drafts, release?.items],
  )
  const error = start.error ?? save.error ?? submit.error ?? closeError

  return (
    <AssignmentDialog closeLabel={closing ? t('tests.student.saving') : t('tests.common.close')} fullScreen onClose={() => void closeRunner()} title={release?.title ?? t('tests.student.loading')}>
      {query.isLoading && <p className={styles.runnerState}>{t('tests.student.loadingTest')}</p>}
      {query.isError && <p className={styles.runnerState}>{t('tests.student.loadTestError')}</p>}
      {release && !editable && !canStart(release) && (
        <TestResult attempt={attempt} release={release} />
      )}
      {release && !editable && canStart(release) && (
        <div className={styles.testStart}>
          <span><Beaker size={30} /></span>
          <h3>{release.title}</h3>
          {release.instructions && <p>{release.instructions}</p>}
          <div>
            <span>{t('tests.student.questions', { count: release.itemCount })}</span>
            <span>{t('tests.library.points', { count: release.maxPoints })}</span>
            <span>{t('tests.student.passing', { count: release.passingPercent })}</span>
          </div>
          {attempt && <TestResult attempt={attempt} compact release={release} />}
          <button className={styles.primaryButton} disabled={start.isPending} onClick={() => start.mutate()} type="button">
            <Play size={16} />{start.isPending ? t('tests.student.starting') : t(attempt ? 'tests.student.retry' : 'tests.student.start')}
          </button>
        </div>
      )}
      {release && editable && activeItem && activeDraft && (
        <div className={styles.runner}>
          <aside className={styles.runnerNavigator}>
            <div><strong>{t('tests.student.progress', { current: activeIndex + 1, total: release.items.length })}</strong><span>{t('tests.student.attempt', { count: attempt?.attemptNumber ?? start.data?.attemptNumber ?? 1 })}</span></div>
            {remainingSeconds !== null && (
              <div className={styles.runnerTimer} data-warning={remainingSeconds <= 60 || undefined}>
                <Clock3 size={15} />
                <span>{remainingSeconds > 0 ? t('tests.student.timeRemaining', { time: formatRemainingTime(remainingSeconds) }) : t('tests.student.timeExpired')}</span>
              </div>
            )}
            <div className={styles.runnerSteps}>
              {release.items.map((item, index) => (
                <button aria-current={index === activeIndex ? 'step' : undefined} className={hasAnswer(item, drafts[item.id] ?? emptyResponse(item)) ? styles.runnerStepAnswered : undefined} key={item.id} onClick={() => setActiveIndex(index)} type="button">
                  {hasAnswer(item, drafts[item.id] ?? emptyResponse(item)) ? <Check size={15} /> : index + 1}
                </button>
              ))}
            </div>
            <small>{save.isPending ? t('tests.student.saving') : draftHash !== saved[activeItem.id] ? t('tests.student.unsaved') : t('tests.student.saved')}</small>
          </aside>
          <main className={styles.runnerQuestion}>
            <div className={styles.questionMeta}>
              <span>{assignmentIcon(activeItem)}{t(`assignments.types.${activeItem.type}.title`)}</span>
              <strong>{t('tests.library.points', { count: activeItem.maxPoints })}</strong>
            </div>
            <h3>{activeItem.title}</h3>
            <p className={styles.questionPrompt}>{activeItem.prompt}</p>
            {activeItem.instructions && <p className={styles.questionInstructions}>{activeItem.instructions}</p>}
            <AnswerField item={activeItem} onChange={(response) => setDrafts((current) => ({ ...current, [activeItem.id]: response }))} response={activeDraft} />
            {error && <p className={styles.inlineError} role="alert">{studentError(error, t)}</p>}
            <footer className={styles.runnerActions}>
              <button className={styles.secondaryButton} disabled={activeIndex === 0} onClick={() => setActiveIndex((value) => value - 1)} type="button"><ArrowLeft size={16} />{t('tests.student.previous')}</button>
              {activeIndex < release.items.length - 1 ? (
                <button className={styles.primaryButton} onClick={() => setActiveIndex((value) => value + 1)} type="button">{t('tests.student.next')}<ArrowRight size={16} /></button>
              ) : (
                <button className={styles.primaryButton} disabled={!allAnswered || submit.isPending} onClick={() => setConfirmSubmit(true)} type="button"><CheckCircle2 size={16} />{t('tests.student.submit')}</button>
              )}
            </footer>
          </main>
        </div>
      )}
      {confirmSubmit && (
        <AssignmentConfirmDialog cancelLabel={t('tests.common.cancel')} confirmLabel={t('tests.student.submitConfirm')} description={t('tests.student.submitDescription')} isPending={submit.isPending} onCancel={() => setConfirmSubmit(false)} onConfirm={() => submit.mutate()} title={t('tests.student.submitTitle')} />
      )}
    </AssignmentDialog>
  )

  function seedAttempt(next: StudentTestAttempt) {
    const nextDrafts = Object.fromEntries(next.answers.map((answer) => [answer.testItemId, answer.responseData]))
    setDrafts(nextDrafts)
    setSaved(Object.fromEntries(Object.entries(nextDrafts).map(([key, value]) => [key, JSON.stringify(value)])))
    hydratedAttempt.current = next.id
    setAttemptId(next.id)
    setActiveIndex(0)
  }

  async function persistDirtyAnswers() {
    for (const item of release?.items ?? []) {
      const response = drafts[item.id] ?? emptyResponse(item)
      const hash = JSON.stringify(response)
      if (hash === saved[item.id]) continue
      await enqueueAnswerSave(item.id, response)
      setSaved((current) => ({ ...current, [item.id]: hash }))
    }
  }

  async function closeRunner() {
    if (closing) return
    if (!editable || !attemptId) {
      onClose()
      return
    }
    setClosing(true)
    setCloseError(null)
    try {
      await persistDirtyAnswers()
      onClose()
    } catch (error) {
      setCloseError(error instanceof Error ? error : new Error('Save failed'))
      setClosing(false)
    }
  }
}

function AnswerField({ item, onChange, response }: { item: StudentTestItem; onChange: (response: ResponseData) => void; response: ResponseData }) {
  const { t } = useTranslation()
  if (item.type === 'WRITTEN') {
    const config = item.publicConfig as unknown as WrittenPublicConfig
    const text = typeof response.text === 'string' ? response.text : ''
    return (
      <label className={styles.writtenAnswer}>
        <span>{t('tests.student.yourAnswer')}</span>
        <textarea maxLength={config.maxLength ?? 5000} onChange={(event) => onChange({ text: event.target.value, attachmentIds: [] })} rows={config.responseMode === 'SHORT' ? 3 : 9} value={text} />
        <small>{t('tests.student.characters', { current: text.length, max: config.maxLength ?? 5000 })}</small>
      </label>
    )
  }
  const config = item.publicConfig as unknown as ChoicePublicConfig
  const selected = Array.isArray(response.selectedOptionIds) ? response.selectedOptionIds.filter((value): value is string => typeof value === 'string') : []
  return (
    <fieldset className={styles.choiceAnswers}>
      <legend>{item.type === 'SINGLE_CHOICE' ? t('tests.student.chooseOne') : t('tests.student.chooseMany')}</legend>
      {config.options.map((option: ChoiceOption) => {
        const checked = selected.includes(option.id)
        return (
          <label className={checked ? styles.choiceAnswerSelected : undefined} key={option.id}>
            <input
              checked={checked}
              name={`test-item-${item.id}`}
              onChange={(event) => {
                const next = item.type === 'SINGLE_CHOICE'
                  ? event.target.checked ? [option.id] : []
                  : event.target.checked ? [...selected, option.id] : selected.filter((id) => id !== option.id)
                onChange({ selectedOptionIds: next })
              }}
              type={item.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
            />
            <span>{option.text}</span>
          </label>
        )
      })}
    </fieldset>
  )
}

function TestResult({ attempt, compact = false, release }: { attempt: StudentTestAttempt | null; compact?: boolean; release: StudentLessonTest }) {
  const { t } = useTranslation()
  if (!attempt) return null
  return (
    <div className={compact ? styles.resultCompact : styles.testResult}>
      <CheckCircle2 size={compact ? 18 : 30} />
      <div>
        <strong>{t(`tests.student.attemptStatus.${attempt.status}`)}</strong>
        {attempt.scorePoints !== null && <p>{t('tests.student.result', { score: attempt.scorePoints, max: attempt.maxPoints, percent: attempt.scorePercent ?? 0 })}</p>}
        {attempt.pendingReviewCount > 0 && <p>{t('tests.student.pendingReview', { count: attempt.pendingReviewCount })}</p>}
        {attempt.status === 'RETURNED' && <p>{t('tests.student.returnedHint')}</p>}
        {attempt.isPassed !== null && <small>{attempt.isPassed ? t('tests.student.passed') : t('tests.student.notPassed', { count: release.passingPercent })}</small>}
      </div>
      {!compact && (
        <div className={styles.studentResultAnswers}>
          {release.items.map((item, index) => {
            const answer = attempt.answers.find(
              (candidate) => candidate.testItemId === item.id,
            )
            if (!answer) return null
            return (
              <div key={item.id}>
                <span>{index + 1}</span>
                <div>
                  <strong>{item.title}</strong>
                  {answer.scorePoints !== null && (
                    <small>
                      {t('tests.student.score', {
                        score: answer.scorePoints,
                        max: answer.maxPoints,
                      })}
                    </small>
                  )}
                  {answer.teacherComment && <p>{answer.teacherComment}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function emptyResponse(item: StudentTestItem): ResponseData {
  return item.type === 'WRITTEN' ? { text: '', attachmentIds: [] } : { selectedOptionIds: [] }
}

function hasAnswer(item: StudentTestItem, response: ResponseData): boolean {
  if (item.type === 'WRITTEN') return typeof response.text === 'string' && response.text.trim().length > 0
  return Array.isArray(response.selectedOptionIds) && response.selectedOptionIds.length > 0
}

function canStart(release: StudentLessonTest): boolean {
  if (release.stateStatus === 'AWAITING_REVIEW') return false
  if (release.attempt?.status === 'RETURNED') return true
  const used = release.attempt?.attemptNumber ?? 0
  return release.maxAttempts === null || used < release.maxAttempts
}

function testActionKey(test: StudentLessonTest): string {
  if (test.attempt?.status === 'IN_PROGRESS') return 'tests.student.continue'
  if (test.stateStatus === 'NOT_STARTED') return 'tests.student.start'
  if (test.stateStatus === 'NEEDS_REVISION' || test.stateStatus === 'EXPIRED') return 'tests.student.retry'
  return 'tests.student.viewResult'
}

function assignmentIcon(item: StudentTestItem) {
  if (item.type === 'WRITTEN') return <PenLine size={15} />
  return <ListChecks size={15} />
}

function studentError(error: Error | null, t: (key: string) => string): string {
  if (error instanceof ApiError) {
    if (error.code === 'TEST_ANSWER_REQUIRED') return t('tests.student.errors.required')
    if (error.code === 'TEST_MAX_ATTEMPTS_REACHED') return t('tests.student.errors.attempts')
    if (error.code === 'TEST_TIME_EXPIRED') return t('tests.student.errors.expired')
  }
  return t('tests.student.errors.action')
}

function useRemainingSeconds(expiresAt: string | null, enabled: boolean): number | null {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!enabled || !expiresAt) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [enabled, expiresAt])

  if (!expiresAt) return null
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000))
}

function formatRemainingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}
