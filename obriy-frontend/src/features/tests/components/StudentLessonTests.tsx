import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Beaker,
  Box,
  Check,
  CheckCircle2,
  Clock3,
  GripVertical,
  Link2,
  ListChecks,
  ListOrdered,
  Map as MapIcon,
  PenLine,
  Play,
  RotateCcw,
} from 'lucide-react'
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../../shared/api/api-client'
import { registerWorkspaceNavigationGuard } from '../../../shared/navigation/workspace-navigation-guard'
import { studentWorkspaceQueryKeys } from '../../student-workspace/model/student-workspace-query-keys'
import { AssignmentConfirmDialog } from '../../assignments/components/AssignmentConfirmDialog'
import { AssignmentDialog } from '../../assignments/components/AssignmentDialog'
import { assignmentImageUrl } from '../../assignments/api/assignments.api'
import { MapRegionPicker } from '../../maps/components/MapRegionPicker'
import { MapMultiRegionPicker } from '../../maps/components/MapMultiRegionPicker'
import type {
  CategorizationPublicConfig,
  ChoiceOption,
  ChoicePublicConfig,
  FillBlanksPublicConfig,
  MatchingPair,
  MatchingPublicConfig,
  OrderingItem,
  OrderingPublicConfig,
  ImageHotspotPublicConfig,
  WrittenPublicConfig,
} from '../../assignments/model/assignment.types'
import {
  getStudentTestRelease,
  listStudentLessonTests,
  saveStudentTestAnswer,
  startStudentTestAttempt,
  submitStudentTestAttempt,
} from '../api/tests.api'
import { testQueryKeys } from '../model/test-query-keys'
import type {
  MapPointSolutionFeedback,
  MapMultiRegionSolutionFeedback,
  MapRegionSolutionFeedback,
  StudentLessonTest,
  StudentTestAttempt,
  StudentTestItem,
} from '../model/test.types'
import type {
  MapPoint,
  MapProjection,
  MapRegionOption,
} from '../../maps/model/map.types'
import styles from '../Tests.module.css'

type ResponseData = Record<string, unknown>

const MapCanvas = lazy(() =>
  import('../../maps/components/MapCanvas').then((module) => ({
    default: module.MapCanvas,
  })),
)

export function StudentLessonTests({ lessonId }: { lessonId: string }) {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const releaseId = searchParams.get('test')
  const setReleaseId = (nextReleaseId: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (nextReleaseId) next.set('test', nextReleaseId)
    else next.delete('test')
    setSearchParams(next, { replace: true })
  }
  const query = useQuery({
    queryKey: testQueryKeys.studentLesson(lessonId),
    queryFn: () => listStudentLessonTests(lessonId),
  })
  const tests = query.data ?? []
  return (
    <section
      className={styles.studentTests}
      aria-labelledby="student-tests-title"
    >
      <header className={styles.studentTestsHeader}>
        <h2 id="student-tests-title">{t('tests.student.title')}</h2>
        <p>{t('tests.student.description')}</p>
      </header>
      {query.isLoading && (
        <p className={styles.sectionState}>{t('tests.student.loading')}</p>
      )}
      {query.isError && (
        <div className={styles.sectionState} role="alert">
          <p>{t('tests.student.loadError')}</p>
          <button
            className={styles.secondaryButton}
            onClick={() => void query.refetch()}
            type="button"
          >
            {t('tests.common.retry')}
          </button>
        </div>
      )}
      {!query.isLoading && !query.isError && tests.length === 0 && (
        <div className={styles.lessonEmpty}>
          <Beaker size={27} />
          <div>
            <strong>{t('tests.student.emptyTitle')}</strong>
            <p>{t('tests.student.emptyDescription')}</p>
          </div>
        </div>
      )}
      {tests.length > 0 && (
        <div className={styles.studentTestList}>
          {tests.map((test, index) => (
            <StudentTestCard
              key={test.releaseId}
              number={index + 1}
              onOpen={() => setReleaseId(test.releaseId)}
              test={test}
            />
          ))}
        </div>
      )}
      {releaseId && (
        <StudentTestRunner
          lessonId={lessonId}
          onClose={() => setReleaseId(null)}
          releaseId={releaseId}
        />
      )}
    </section>
  )
}

function StudentTestCard({
  number,
  onOpen,
  test,
}: {
  number: number
  onOpen: () => void
  test: StudentLessonTest
}) {
  const { t } = useTranslation()
  const attempt = test.attempt
  const resultVisible =
    attempt?.scorePoints !== null && attempt?.scorePoints !== undefined
  return (
    <article className={styles.studentTestCard}>
      <span className={styles.studentTestNumber}>{number}</span>
      <div className={styles.studentTestCopy}>
        <div className={styles.studentTestMeta}>
          <span>{t('tests.student.questions', { count: test.itemCount })}</span>
          <span>{t('tests.library.points', { count: test.maxPoints })}</span>
          {test.timeLimitSeconds && (
            <span>
              <Clock3 size={13} />
              {t('tests.student.minutes', {
                count: Math.ceil(test.timeLimitSeconds / 60),
              })}
            </span>
          )}
        </div>
        <h3>{test.title}</h3>
        <p>{test.description || t('tests.library.noDescription')}</p>
        <div className={styles.studentTestResult}>
          <span
            className={`${styles.testState} ${styles[`testState${test.stateStatus}`]}`}
          >
            {t(`tests.student.status.${test.stateStatus}`)}
          </span>
          {resultVisible && (
            <strong>
              {t('tests.student.score', {
                score: attempt.scorePoints,
                max: attempt.maxPoints,
              })}
            </strong>
          )}
        </div>
      </div>
      <button className={styles.primaryButton} onClick={onOpen} type="button">
        {test.stateStatus === 'NOT_STARTED' ? (
          <Play size={16} />
        ) : test.stateStatus === 'NEEDS_REVISION' ? (
          <RotateCcw size={16} />
        ) : (
          <ArrowRight size={16} />
        )}
        {t(testActionKey(test))}
      </button>
    </article>
  )
}

function StudentTestRunner({
  lessonId,
  onClose,
  releaseId,
}: {
  lessonId: string
  onClose: () => void
  releaseId: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
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
    const next = Object.fromEntries(
      attempt.answers.map((answer) => {
        const item = release?.items.find(
          (candidate) => candidate.id === answer.testItemId,
        )
        return [answer.testItemId, normalizeResponse(item, answer.responseData)]
      }),
    )
    const hashes = Object.fromEntries(
      attempt.answers.map((answer) => [
        answer.testItemId,
        JSON.stringify(answer.responseData),
      ]),
    )
    hydratedAttempt.current = attempt.id
    // Server state initializes a new whole-test attempt exactly once.
    setDrafts(next)
    setSaved(hashes)
    setAttemptId(attempt.id)
    setActiveIndex(0)
  }, [attempt, release?.items])

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: testQueryKeys.release(releaseId),
    })
    await queryClient.invalidateQueries({
      queryKey: testQueryKeys.studentLesson(lessonId),
    })
    await queryClient.invalidateQueries({
      queryKey: studentWorkspaceQueryKeys.root,
    })
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
    mutationFn: ({
      itemId,
      response,
    }: {
      itemId: string
      response: ResponseData
    }) => enqueueAnswerSave(itemId, response),
    onSuccess: (_next, variables) => {
      setSaved((current) => ({
        ...current,
        [variables.itemId]: JSON.stringify(variables.response),
      }))
    },
  })
  const persistDirtyAnswers = useCallback(async () => {
    for (const item of release?.items ?? []) {
      const response = drafts[item.id] ?? emptyResponse(item)
      const hash = JSON.stringify(response)
      if (hash === saved[item.id]) continue
      await enqueueAnswerSave(item.id, response)
      setSaved((current) => ({ ...current, [item.id]: hash }))
    }
  }, [drafts, enqueueAnswerSave, release?.items, saved])
  const submit = useMutation({
    mutationFn: async () => {
      if (!attemptId) throw new Error('Attempt is unavailable')
      await persistDirtyAnswers()
      return submitStudentTestAttempt(attemptId)
    },
    onSuccess: (next) => {
      setConfirmSubmit(false)
      queryClient.setQueryData<StudentLessonTest>(
        testQueryKeys.release(releaseId),
        (current) => (current ? { ...current, attempt: next } : current),
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
  const activeDraft = activeItem
    ? (drafts[activeItem.id] ?? emptyResponse(activeItem))
    : null
  const draftHash = activeDraft ? JSON.stringify(activeDraft) : ''
  const editable = effectiveAttempt?.status === 'IN_PROGRESS'
  const remainingSeconds = useRemainingSeconds(
    effectiveAttempt?.expiresAt ?? null,
    editable,
  )
  useEffect(() => {
    if (
      remainingSeconds !== 0 ||
      !effectiveAttempt ||
      refreshedExpiredAttempt.current === effectiveAttempt.id
    )
      return
    refreshedExpiredAttempt.current = effectiveAttempt.id
    void queryClient.invalidateQueries({
      queryKey: testQueryKeys.release(releaseId),
    })
    void queryClient.invalidateQueries({
      queryKey: testQueryKeys.studentLesson(lessonId),
    })
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
    )
      return
    const response = drafts[activeItem.id] ?? emptyResponse(activeItem)
    const timeout = window.setTimeout(
      () => save.mutate({ itemId: activeItem.id, response }),
      800,
    )
    return () => window.clearTimeout(timeout)
  }, [
    activeItem,
    attemptId,
    closing,
    confirmSubmit,
    draftHash,
    drafts,
    editable,
    save,
    saved,
    submit.isPending,
  ])

  const allAnswered = useMemo(
    () =>
      release?.items.every((item) =>
        hasAnswer(item, drafts[item.id] ?? emptyResponse(item)),
      ) ?? false,
    [drafts, release?.items],
  )
  const hasDirtyAnswers = useMemo(
    () =>
      release?.items.some(
        (item) =>
          JSON.stringify(drafts[item.id] ?? emptyResponse(item)) !==
          saved[item.id],
      ) ?? false,
    [drafts, release?.items, saved],
  )
  const error = start.error ?? save.error ?? submit.error ?? closeError
  const saveAndNavigate = useCallback(
    async (target: string) => {
      if (closing) return
      setClosing(true)
      setCloseError(null)
      try {
        await persistDirtyAnswers()
        navigate(target)
      } catch (error) {
        setCloseError(error instanceof Error ? error : new Error('Save failed'))
        setClosing(false)
      }
    },
    [closing, navigate, persistDirtyAnswers],
  )

  useEffect(() => {
    if (!editable || (!hasDirtyAnswers && !save.isPending)) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [editable, hasDirtyAnswers, save.isPending])
  useEffect(() => {
    if (!editable || (!hasDirtyAnswers && !save.isPending)) return
    return registerWorkspaceNavigationGuard((target) => {
      void saveAndNavigate(target)
    })
  }, [editable, hasDirtyAnswers, save.isPending, saveAndNavigate])

  return (
    <AssignmentDialog
      closeLabel={closing ? t('tests.student.saving') : t('tests.common.close')}
      fullScreen
      onClose={() => void closeRunner()}
      title={release?.title ?? t('tests.student.loading')}
    >
      {query.isLoading && (
        <p className={styles.runnerState}>{t('tests.student.loadingTest')}</p>
      )}
      {query.isError && (
        <p className={styles.runnerState}>{t('tests.student.loadTestError')}</p>
      )}
      {release && !editable && !canStart(release) && (
        <TestResult attempt={attempt} release={release} />
      )}
      {release && !editable && canStart(release) && (
        <div className={styles.testStart}>
          <span>
            <Beaker size={30} />
          </span>
          <h3>{release.title}</h3>
          {release.instructions && <p>{release.instructions}</p>}
          <div>
            <span>
              {t('tests.student.questions', { count: release.itemCount })}
            </span>
            <span>
              {t('tests.library.points', { count: release.maxPoints })}
            </span>
            <span>
              {t('tests.student.passing', { count: release.passingPercent })}
            </span>
          </div>
          {attempt && (
            <TestResult attempt={attempt} compact release={release} />
          )}
          <button
            className={styles.primaryButton}
            disabled={start.isPending}
            onClick={() => start.mutate()}
            type="button"
          >
            <Play size={16} />
            {start.isPending
              ? t('tests.student.starting')
              : t(attempt ? 'tests.student.retry' : 'tests.student.start')}
          </button>
        </div>
      )}
      {release && editable && activeItem && activeDraft && (
        <div className={styles.runner}>
          <aside className={styles.runnerNavigator}>
            <div>
              <strong>
                {t('tests.student.progress', {
                  current: activeIndex + 1,
                  total: release.items.length,
                })}
              </strong>
              <span>
                {t('tests.student.attempt', {
                  count:
                    attempt?.attemptNumber ?? start.data?.attemptNumber ?? 1,
                })}
              </span>
            </div>
            {remainingSeconds !== null && (
              <div
                className={styles.runnerTimer}
                data-warning={remainingSeconds <= 60 || undefined}
              >
                <Clock3 size={15} />
                <span>
                  {remainingSeconds > 0
                    ? t('tests.student.timeRemaining', {
                        time: formatRemainingTime(remainingSeconds),
                      })
                    : t('tests.student.timeExpired')}
                </span>
              </div>
            )}
            <div className={styles.runnerSteps}>
              {release.items.map((item, index) => (
                <button
                  aria-current={index === activeIndex ? 'step' : undefined}
                  className={
                    hasAnswer(item, drafts[item.id] ?? emptyResponse(item))
                      ? styles.runnerStepAnswered
                      : undefined
                  }
                  key={item.id}
                  onClick={() => setActiveIndex(index)}
                  type="button"
                >
                  {hasAnswer(item, drafts[item.id] ?? emptyResponse(item)) ? (
                    <Check size={15} />
                  ) : (
                    index + 1
                  )}
                </button>
              ))}
            </div>
            <small>
              {save.isPending
                ? t('tests.student.saving')
                : draftHash !== saved[activeItem.id]
                  ? t('tests.student.unsaved')
                  : t('tests.student.saved')}
            </small>
          </aside>
          <main className={styles.runnerQuestion}>
            <div className={styles.questionMeta}>
              <span>
                {assignmentIcon(activeItem)}
                {t(`assignments.types.${activeItem.type}.title`)}
              </span>
              <strong>
                {t('tests.library.points', { count: activeItem.maxPoints })}
              </strong>
            </div>
            <h3>{activeItem.title}</h3>
            <p className={styles.questionPrompt}>{activeItem.prompt}</p>
            {activeItem.instructions && (
              <p className={styles.questionInstructions}>
                {activeItem.instructions}
              </p>
            )}
            {activeItem.type !== 'IMAGE_HOTSPOT' && (
              <PromptImage item={activeItem} />
            )}
            <AnswerField
              item={activeItem}
              onChange={(response) =>
                setDrafts((current) => ({
                  ...current,
                  [activeItem.id]: response,
                }))
              }
              response={activeDraft}
            />
            {error && (
              <p className={styles.inlineError} role="alert">
                {studentError(error, t)}
              </p>
            )}
            <footer className={styles.runnerActions}>
              <button
                className={styles.secondaryButton}
                disabled={activeIndex === 0}
                onClick={() => setActiveIndex((value) => value - 1)}
                type="button"
              >
                <ArrowLeft size={16} />
                {t('tests.student.previous')}
              </button>
              {activeIndex < release.items.length - 1 ? (
                <button
                  className={styles.primaryButton}
                  onClick={() => setActiveIndex((value) => value + 1)}
                  type="button"
                >
                  {t('tests.student.next')}
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  className={styles.primaryButton}
                  disabled={!allAnswered || submit.isPending}
                  onClick={() => setConfirmSubmit(true)}
                  type="button"
                >
                  <CheckCircle2 size={16} />
                  {t('tests.student.submit')}
                </button>
              )}
            </footer>
          </main>
        </div>
      )}
      {confirmSubmit && (
        <AssignmentConfirmDialog
          cancelLabel={t('tests.common.cancel')}
          confirmLabel={t('tests.student.submitConfirm')}
          description={t('tests.student.submitDescription')}
          isPending={submit.isPending}
          onCancel={() => setConfirmSubmit(false)}
          onConfirm={() => submit.mutate()}
          title={t('tests.student.submitTitle')}
        />
      )}
    </AssignmentDialog>
  )

  function seedAttempt(next: StudentTestAttempt) {
    const nextDrafts = Object.fromEntries(
      next.answers.map((answer) => {
        const item = release?.items.find(
          (candidate) => candidate.id === answer.testItemId,
        )
        return [answer.testItemId, normalizeResponse(item, answer.responseData)]
      }),
    )
    setDrafts(nextDrafts)
    setSaved(
      Object.fromEntries(
        next.answers.map((answer) => [
          answer.testItemId,
          JSON.stringify(answer.responseData),
        ]),
      ),
    )
    hydratedAttempt.current = next.id
    setAttemptId(next.id)
    setActiveIndex(0)
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

function AnswerField({
  item,
  onChange,
  response,
}: {
  item: StudentTestItem
  onChange: (response: ResponseData) => void
  response: ResponseData
}) {
  const { t } = useTranslation()
  if (item.type === 'WRITTEN') {
    const config = item.publicConfig as unknown as WrittenPublicConfig
    const text = typeof response.text === 'string' ? response.text : ''
    return (
      <label className={styles.writtenAnswer}>
        <span>{t('tests.student.yourAnswer')}</span>
        <textarea
          maxLength={config.maxLength ?? 5000}
          onChange={(event) =>
            onChange({ text: event.target.value, attachmentIds: [] })
          }
          rows={config.responseMode === 'SHORT' ? 3 : 9}
          value={text}
        />
        <small>
          {t('tests.student.characters', {
            current: text.length,
            max: config.maxLength ?? 5000,
          })}
        </small>
      </label>
    )
  }
  if (item.type === 'MATCHING') {
    const config = item.publicConfig as unknown as MatchingPublicConfig
    const matches = Array.isArray(response.matches)
      ? response.matches.filter(isMatchingPair)
      : []
    const selectedByLeftId = new Map(
      matches.map((pair) => [pair.leftItemId, pair.rightItemId]),
    )
    const usedRightIds = new Set(matches.map((pair) => pair.rightItemId))
    return (
      <fieldset className={styles.matchingAnswers}>
        <legend>{t('tests.student.matchItems')}</legend>
        {config.leftItems.map((leftItem, index) => {
          const selectedRightId = selectedByLeftId.get(leftItem.id) ?? ''
          return (
            <label key={leftItem.id}>
              <span className={styles.matchingAnswerNumber}>{index + 1}</span>
              <strong>{leftItem.text}</strong>
              <select
                aria-label={t('tests.student.matchLeftItem', {
                  item: leftItem.text,
                })}
                onChange={(event) => {
                  const rightItemId = event.target.value
                  const next = matches.filter(
                    (pair) =>
                      pair.leftItemId !== leftItem.id &&
                      pair.rightItemId !== rightItemId,
                  )
                  if (rightItemId)
                    next.push({ leftItemId: leftItem.id, rightItemId })
                  onChange({ matches: next })
                }}
                value={selectedRightId}
              >
                <option value="">{t('tests.student.matchPlaceholder')}</option>
                {config.rightItems.map((rightItem) => (
                  <option
                    disabled={
                      usedRightIds.has(rightItem.id) &&
                      rightItem.id !== selectedRightId
                    }
                    key={rightItem.id}
                    value={rightItem.id}
                  >
                    {rightItem.text}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </fieldset>
    )
  }
  if (item.type === 'ORDERING') {
    return (
      <OrderingAnswerField
        item={item}
        onChange={onChange}
        response={response}
      />
    )
  }
  if (item.type === 'CATEGORIZATION') {
    return (
      <CategorizationAnswerField
        item={item}
        onChange={onChange}
        response={response}
      />
    )
  }
  if (item.type === 'FILL_BLANKS') {
    return (
      <FillBlanksAnswerField
        item={item}
        onChange={onChange}
        response={response}
      />
    )
  }
  if (item.type === 'IMAGE_HOTSPOT') {
    return (
      <ImageHotspotAnswerField
        item={item}
        onChange={onChange}
        response={response}
      />
    )
  }
  if (item.type === 'MAP_POINT') {
    return (
      <MapPointAnswerField
        item={item}
        key={item.id}
        onChange={onChange}
        response={response}
      />
    )
  }
  if (item.type === 'MAP_REGION') {
    return (
      <MapRegionAnswerField
        item={item}
        key={item.id}
        onChange={onChange}
        response={response}
      />
    )
  }
  if (item.type === 'MAP_MULTI_REGION') {
    return (
      <MapMultiRegionAnswerField
        item={item}
        key={item.id}
        onChange={onChange}
        response={response}
      />
    )
  }
  if (item.type !== 'SINGLE_CHOICE' && item.type !== 'MULTIPLE_CHOICE') {
    return (
      <p className={styles.inlineError}>
        {t('tests.student.unsupportedAssignment')}
      </p>
    )
  }
  const config = item.publicConfig as unknown as ChoicePublicConfig
  const selected = Array.isArray(response.selectedOptionIds)
    ? response.selectedOptionIds.filter(
        (value): value is string => typeof value === 'string',
      )
    : []
  return (
    <fieldset className={styles.choiceAnswers}>
      <legend>
        {item.type === 'SINGLE_CHOICE'
          ? t('tests.student.chooseOne')
          : t('tests.student.chooseMany')}
      </legend>
      {config.options.map((option: ChoiceOption) => {
        const checked = selected.includes(option.id)
        return (
          <label
            className={checked ? styles.choiceAnswerSelected : undefined}
            key={option.id}
          >
            <input
              checked={checked}
              name={`test-item-${item.id}`}
              onChange={(event) => {
                const next =
                  item.type === 'SINGLE_CHOICE'
                    ? event.target.checked
                      ? [option.id]
                      : []
                    : event.target.checked
                      ? [...selected, option.id]
                      : selected.filter((id) => id !== option.id)
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

function TestResult({
  attempt,
  compact = false,
  release,
}: {
  attempt: StudentTestAttempt | null
  compact?: boolean
  release: StudentLessonTest
}) {
  const { t } = useTranslation()
  if (!attempt) return null
  return (
    <div className={compact ? styles.resultCompact : styles.testResult}>
      <CheckCircle2 size={compact ? 18 : 30} />
      <div>
        <strong>{t(`tests.student.attemptStatus.${attempt.status}`)}</strong>
        {attempt.scorePoints !== null && (
          <p>
            {t('tests.student.result', {
              score: attempt.scorePoints,
              max: attempt.maxPoints,
              percent: attempt.scorePercent ?? 0,
            })}
          </p>
        )}
        {attempt.pendingReviewCount > 0 && (
          <p>
            {t('tests.student.pendingReview', {
              count: attempt.pendingReviewCount,
            })}
          </p>
        )}
        {attempt.status === 'RETURNED' && (
          <p>{t('tests.student.returnedHint')}</p>
        )}
        {attempt.isPassed !== null && (
          <small>
            {attempt.isPassed
              ? t('tests.student.passed')
              : t('tests.student.notPassed', { count: release.passingPercent })}
          </small>
        )}
      </div>
      {(!compact || attempt.status === 'RETURNED') && (
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
                  {item.type === 'MAP_POINT' &&
                    answer.solutionFeedback &&
                    isMapPointFeedback(answer.solutionFeedback) &&
                    item.mapPreset && (
                      <MapPointResult
                        answer={asMapPoint(answer.responseData)}
                        feedback={answer.solutionFeedback}
                        item={item}
                      />
                    )}
                  {item.type === 'MAP_REGION' &&
                    answer.solutionFeedback &&
                    isMapRegionFeedback(answer.solutionFeedback) &&
                    item.mapPreset && (
                      <MapRegionResult
                        answerRegionId={asRegionId(answer.responseData)}
                        feedback={answer.solutionFeedback}
                        item={item}
                      />
                    )}
                  {item.type === 'MAP_MULTI_REGION' &&
                    answer.solutionFeedback &&
                    isMapMultiRegionFeedback(answer.solutionFeedback) &&
                    item.mapPreset && (
                      <MapMultiRegionResult
                        answerRegionIds={asRegionIds(answer.responseData)}
                        feedback={answer.solutionFeedback}
                        item={item}
                      />
                    )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MapPointAnswerField({
  item,
  onChange,
  response,
}: {
  item: StudentTestItem
  onChange: (response: ResponseData) => void
  response: ResponseData
}) {
  const { t } = useTranslation()
  const [projection, setProjection] = useState<MapProjection>(() =>
    item.publicConfig.initialProjection === 'GLOBE' ? 'GLOBE' : 'MERCATOR',
  )
  const point = asMapPoint(response)
  if (!item.mapPreset) {
    return (
      <p className={styles.inlineError}>{t('tests.student.mapUnavailable')}</p>
    )
  }
  return (
    <div className={styles.mapAnswer}>
      <div className={styles.mapAnswerToolbar}>
        <p>{t('tests.student.mapPointInstruction')}</p>
        <ProjectionToggle projection={projection} onChange={setProjection} />
      </div>
      <Suspense
        fallback={
          <div className={styles.mapAnswerFallback}>
            {t('maps.sandbox.loadingMap')}
          </div>
        }
      >
        <MapCanvas
          mapLabel={t('tests.student.mapAnswerLabel')}
          onPointChange={(nextPoint) => onChange({ ...nextPoint })}
          point={point}
          pointKind="ANSWER"
          preset={item.mapPreset}
          projection={projection}
          variant="ASSIGNMENT"
        />
      </Suspense>
      <small>
        {point
          ? t('tests.student.mapCoordinates', {
              longitude: point.longitude.toFixed(5),
              latitude: point.latitude.toFixed(5),
            })
          : t('tests.student.mapPointEmpty')}
      </small>
    </div>
  )
}

function MapPointResult({
  answer,
  feedback,
  item,
}: {
  answer: MapPoint | null
  feedback: MapPointSolutionFeedback
  item: StudentTestItem
}) {
  const { t } = useTranslation()
  const [projection, setProjection] = useState<MapProjection>(() =>
    item.publicConfig.initialProjection === 'GLOBE' ? 'GLOBE' : 'MERCATOR',
  )
  if (!item.mapPreset) return null
  return (
    <div className={styles.mapResult}>
      <div className={styles.mapAnswerToolbar}>
        <div>
          <strong>{t('tests.student.mapSolution')}</strong>
          <small>
            {t('tests.student.mapDistance', {
              distance: feedback.distanceKm ?? '—',
              radius: feedback.radiusKm,
            })}
          </small>
        </div>
        <ProjectionToggle projection={projection} onChange={setProjection} />
      </div>
      <Suspense
        fallback={
          <div className={styles.mapAnswerFallback}>
            {t('maps.sandbox.loadingMap')}
          </div>
        }
      >
        <MapCanvas
          comparisonPoint={answer}
          mapLabel={t('tests.student.mapSolutionLabel')}
          point={feedback.target}
          preset={item.mapPreset}
          projection={projection}
          radiusKm={feedback.radiusKm}
          variant="ASSIGNMENT"
        />
      </Suspense>
    </div>
  )
}

function MapRegionAnswerField({
  item,
  onChange,
  response,
}: {
  item: StudentTestItem
  onChange: (response: ResponseData) => void
  response: ResponseData
}) {
  const { t } = useTranslation()
  const [projection, setProjection] = useState<MapProjection>(() =>
    item.publicConfig.initialProjection === 'GLOBE' ? 'GLOBE' : 'MERCATOR',
  )
  const [regions, setRegions] = useState<MapRegionOption[]>([])
  const selectedRegionId = asRegionId(response)
  if (!item.mapPreset) {
    return (
      <p className={styles.inlineError}>{t('tests.student.mapUnavailable')}</p>
    )
  }
  return (
    <div className={styles.mapAnswer}>
      <div className={styles.mapAnswerToolbar}>
        <p>{t('tests.student.mapRegionInstruction')}</p>
        <ProjectionToggle projection={projection} onChange={setProjection} />
      </div>
      <div className={styles.mapRegionAnswerLayout}>
        <Suspense
          fallback={
            <div className={styles.mapAnswerFallback}>
              {t('maps.sandbox.loadingMap')}
            </div>
          }
        >
          <MapCanvas
            mapLabel={t('tests.student.mapRegionAnswerLabel')}
            onRegionChange={(region) => onChange({ regionId: region.id })}
            onRegionsLoad={setRegions}
            preset={item.mapPreset}
            projection={projection}
            selectedRegionIds={selectedRegionId ? [selectedRegionId] : []}
            variant="ASSIGNMENT"
          />
        </Suspense>
        <MapRegionPicker
          onChange={(region) => onChange({ regionId: region.id })}
          regions={regions}
          selectedRegionId={selectedRegionId}
        />
      </div>
    </div>
  )
}

function MapRegionResult({
  answerRegionId,
  feedback,
  item,
}: {
  answerRegionId: string | null
  feedback: MapRegionSolutionFeedback
  item: StudentTestItem
}) {
  const { t } = useTranslation()
  const [projection, setProjection] = useState<MapProjection>(() =>
    item.publicConfig.initialProjection === 'GLOBE' ? 'GLOBE' : 'MERCATOR',
  )
  const [regions, setRegions] = useState<MapRegionOption[]>([])
  if (!item.mapPreset) return null
  const answer = regions.find((region) => region.id === answerRegionId)
  const correct = regions.find(
    (region) => region.id === feedback.correctRegionId,
  )
  return (
    <div className={styles.mapResult}>
      <div className={styles.mapAnswerToolbar}>
        <div>
          <strong>{t('tests.student.mapRegionSolution')}</strong>
          <small>
            {t('tests.student.mapRegionResult', {
              answer: answer?.name ?? answerRegionId ?? '—',
              correct: correct?.name ?? feedback.correctRegionId,
            })}
          </small>
        </div>
        <ProjectionToggle projection={projection} onChange={setProjection} />
      </div>
      <Suspense
        fallback={
          <div className={styles.mapAnswerFallback}>
            {t('maps.sandbox.loadingMap')}
          </div>
        }
      >
        <MapCanvas
          comparisonRegionIds={[feedback.correctRegionId]}
          mapLabel={t('tests.student.mapRegionSolutionLabel')}
          onRegionsLoad={setRegions}
          preset={item.mapPreset}
          projection={projection}
          selectedRegionIds={answerRegionId ? [answerRegionId] : []}
          variant="ASSIGNMENT"
        />
      </Suspense>
    </div>
  )
}

function MapMultiRegionAnswerField({
  item,
  onChange,
  response,
}: {
  item: StudentTestItem
  onChange: (response: ResponseData) => void
  response: ResponseData
}) {
  const { t } = useTranslation()
  const [projection, setProjection] = useState<MapProjection>(() =>
    item.publicConfig.initialProjection === 'GLOBE' ? 'GLOBE' : 'MERCATOR',
  )
  const [regions, setRegions] = useState<MapRegionOption[]>([])
  const selectedRegionIds = asRegionIds(response)
  const requiredSelectionCount = numberField(
    item.publicConfig,
    'requiredSelectionCount',
  )
  if (!item.mapPreset || requiredSelectionCount === null) {
    return (
      <p className={styles.inlineError}>{t('tests.student.mapUnavailable')}</p>
    )
  }

  const toggleRegion = (region: MapRegionOption) => {
    const next = selectedRegionIds.includes(region.id)
      ? selectedRegionIds.filter((id) => id !== region.id)
      : selectedRegionIds.length < requiredSelectionCount
        ? [...selectedRegionIds, region.id]
        : selectedRegionIds
    if (next !== selectedRegionIds) onChange({ selectedRegionIds: next })
  }

  return (
    <div className={styles.mapAnswer}>
      <div className={styles.mapAnswerToolbar}>
        <p>
          {t('tests.student.mapMultiRegionInstruction', {
            count: requiredSelectionCount,
          })}
        </p>
        <ProjectionToggle projection={projection} onChange={setProjection} />
      </div>
      <div className={styles.mapRegionAnswerLayout}>
        <Suspense
          fallback={
            <div className={styles.mapAnswerFallback}>
              {t('maps.sandbox.loadingMap')}
            </div>
          }
        >
          <MapCanvas
            mapLabel={t('tests.student.mapMultiRegionAnswerLabel')}
            onRegionChange={toggleRegion}
            onRegionsLoad={setRegions}
            preset={item.mapPreset}
            projection={projection}
            selectedRegionIds={selectedRegionIds}
            variant="ASSIGNMENT"
          />
        </Suspense>
        <MapMultiRegionPicker
          maxSelections={requiredSelectionCount}
          onClear={() => onChange({ selectedRegionIds: [] })}
          onToggle={toggleRegion}
          regions={regions}
          selectedRegionIds={selectedRegionIds}
        />
      </div>
    </div>
  )
}

function MapMultiRegionResult({
  answerRegionIds,
  feedback,
  item,
}: {
  answerRegionIds: string[]
  feedback: MapMultiRegionSolutionFeedback
  item: StudentTestItem
}) {
  const { t } = useTranslation()
  const [projection, setProjection] = useState<MapProjection>(() =>
    item.publicConfig.initialProjection === 'GLOBE' ? 'GLOBE' : 'MERCATOR',
  )
  const [regions, setRegions] = useState<MapRegionOption[]>([])
  if (!item.mapPreset) return null
  const names = new Map(regions.map((region) => [region.id, region.name]))
  return (
    <div className={styles.mapResult}>
      <div className={styles.mapAnswerToolbar}>
        <div>
          <strong>{t('tests.student.mapMultiRegionSolution')}</strong>
          <small>
            {t('tests.student.mapMultiRegionResult', {
              correct: feedback.correctSelectedCount ?? '—',
              expected:
                feedback.expectedCorrectCount ?? feedback.correctRegionIds.length,
              incorrect: feedback.incorrectSelectedCount ?? '—',
            })}
          </small>
        </div>
        <ProjectionToggle projection={projection} onChange={setProjection} />
      </div>
      <div className={styles.mapResultRegionLists}>
        <p>
          <strong>{t('tests.reviews.studentAnswer')}</strong>
          <span>
            {answerRegionIds.map((id) => names.get(id) ?? id).join(', ') || '—'}
          </span>
        </p>
        <p>
          <strong>{t('assignments.mapMultiRegion.mapTitle')}</strong>
          <span>
            {feedback.correctRegionIds
              .map((id) => names.get(id) ?? id)
              .join(', ')}
          </span>
        </p>
      </div>
      <Suspense
        fallback={
          <div className={styles.mapAnswerFallback}>
            {t('maps.sandbox.loadingMap')}
          </div>
        }
      >
        <MapCanvas
          comparisonRegionIds={feedback.correctRegionIds}
          mapLabel={t('tests.student.mapMultiRegionSolutionLabel')}
          onRegionsLoad={setRegions}
          preset={item.mapPreset}
          projection={projection}
          selectedRegionIds={answerRegionIds}
          variant="ASSIGNMENT"
        />
      </Suspense>
    </div>
  )
}

function ProjectionToggle({
  onChange,
  projection,
}: {
  onChange: (projection: MapProjection) => void
  projection: MapProjection
}) {
  const { t } = useTranslation()
  return (
    <div
      aria-label={t('maps.sandbox.projectionLabel')}
      className={styles.mapProjectionToggle}
      role="group"
    >
      <button
        aria-pressed={projection === 'MERCATOR'}
        onClick={() => onChange('MERCATOR')}
        type="button"
      >
        <MapIcon size={14} aria-hidden="true" />
        {t('maps.projection.mercator')}
      </button>
      <button
        aria-pressed={projection === 'GLOBE'}
        onClick={() => onChange('GLOBE')}
        type="button"
      >
        <Box size={14} aria-hidden="true" />
        {t('maps.projection.globe')}
      </button>
    </div>
  )
}

function emptyResponse(item: StudentTestItem): ResponseData {
  if (item.type === 'WRITTEN') return { text: '', attachmentIds: [] }
  if (item.type === 'MATCHING') return { matches: [] }
  if (item.type === 'ORDERING') {
    const config = item.publicConfig as unknown as OrderingPublicConfig
    return {
      orderedItemIds: config.items.map((orderingItem) => orderingItem.id),
    }
  }
  if (item.type === 'CATEGORIZATION') return { assignments: [] }
  if (item.type === 'FILL_BLANKS') return { answers: [] }
  if (item.type === 'IMAGE_HOTSPOT') return {}
  if (item.type === 'MAP_POINT') return {}
  if (item.type === 'MAP_REGION') return {}
  if (item.type === 'MAP_MULTI_REGION') return { selectedRegionIds: [] }
  if (item.type === 'SINGLE_CHOICE' || item.type === 'MULTIPLE_CHOICE') {
    return { selectedOptionIds: [] }
  }
  return {}
}

function hasAnswer(item: StudentTestItem, response: ResponseData): boolean {
  if (item.type === 'WRITTEN')
    return typeof response.text === 'string' && response.text.trim().length > 0
  if (item.type === 'MATCHING') {
    const config = item.publicConfig as unknown as MatchingPublicConfig
    return (
      Array.isArray(response.matches) &&
      response.matches.filter(isMatchingPair).length === config.leftItems.length
    )
  }
  if (item.type === 'ORDERING') {
    const config = item.publicConfig as unknown as OrderingPublicConfig
    return (
      Array.isArray(response.orderedItemIds) &&
      response.orderedItemIds.length === config.items.length
    )
  }
  if (item.type === 'CATEGORIZATION') {
    const config = item.publicConfig as unknown as CategorizationPublicConfig
    return (
      Array.isArray(response.assignments) &&
      response.assignments.length === config.items.length
    )
  }
  if (item.type === 'FILL_BLANKS') {
    const config = item.publicConfig as unknown as FillBlanksPublicConfig
    const blankCount = config.segments.filter(
      (segment) => segment.type === 'BLANK',
    ).length
    return (
      Array.isArray(response.answers) &&
      response.answers.length === blankCount &&
      response.answers.every(
        (answer) =>
          isRecord(answer) &&
          typeof answer.text === 'string' &&
          answer.text.trim() !== '',
      )
    )
  }
  if (item.type === 'IMAGE_HOTSPOT')
    return typeof response.x === 'number' && typeof response.y === 'number'
  if (item.type === 'MAP_POINT') {
    return asMapPoint(response) !== null
  }
  if (item.type === 'MAP_REGION') return asRegionId(response) !== null
  if (item.type === 'MAP_MULTI_REGION') {
    const requiredSelectionCount = numberField(
      item.publicConfig,
      'requiredSelectionCount',
    )
    return (
      requiredSelectionCount !== null &&
      asRegionIds(response).length === requiredSelectionCount
    )
  }
  if (item.type === 'SINGLE_CHOICE' || item.type === 'MULTIPLE_CHOICE') {
    return (
      Array.isArray(response.selectedOptionIds) &&
      response.selectedOptionIds.length > 0
    )
  }
  return false
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
  if (test.stateStatus === 'NEEDS_REVISION' || test.stateStatus === 'EXPIRED')
    return 'tests.student.retry'
  return 'tests.student.viewResult'
}

function assignmentIcon(item: StudentTestItem) {
  if (item.type === 'WRITTEN') return <PenLine size={15} />
  if (item.type === 'MATCHING') return <Link2 size={15} />
  if (item.type === 'ORDERING') return <ListOrdered size={15} />
  if (
    item.type === 'MAP_POINT' ||
    item.type === 'MAP_REGION' ||
    item.type === 'MAP_MULTI_REGION'
  ) {
    return <MapIcon size={15} />
  }
  return <ListChecks size={15} />
}

function isMatchingPair(value: unknown): value is MatchingPair {
  return (
    typeof value === 'object' &&
    value !== null &&
    'leftItemId' in value &&
    typeof value.leftItemId === 'string' &&
    'rightItemId' in value &&
    typeof value.rightItemId === 'string'
  )
}

function OrderingAnswerField({
  item,
  onChange,
  response,
}: {
  item: StudentTestItem
  onChange: (response: ResponseData) => void
  response: ResponseData
}) {
  const { t } = useTranslation()
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const config = item.publicConfig as unknown as OrderingPublicConfig
  const itemById = new Map(
    config.items.map((orderingItem) => [orderingItem.id, orderingItem]),
  )
  const responseIds = Array.isArray(response.orderedItemIds)
    ? response.orderedItemIds.filter(
        (id): id is string => typeof id === 'string' && itemById.has(id),
      )
    : []
  const responseIdSet = new Set(responseIds)
  const orderedIds = [
    ...responseIds,
    ...config.items
      .map((orderingItem) => orderingItem.id)
      .filter((id) => !responseIdSet.has(id)),
  ]
  const orderedItems = orderedIds
    .map((id) => itemById.get(id))
    .filter((orderingItem): orderingItem is OrderingItem =>
      Boolean(orderingItem),
    )

  const move = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= orderedItems.length) return
    onChange({
      orderedItemIds: moveArrayItem(orderedItems, fromIndex, toIndex).map(
        (orderingItem) => orderingItem.id,
      ),
    })
  }
  const dropOn = (targetId: string) => {
    if (!draggedItemId || draggedItemId === targetId) return
    const fromIndex = orderedItems.findIndex(
      (orderingItem) => orderingItem.id === draggedItemId,
    )
    const toIndex = orderedItems.findIndex(
      (orderingItem) => orderingItem.id === targetId,
    )
    if (fromIndex >= 0 && toIndex >= 0) move(fromIndex, toIndex)
    setDraggedItemId(null)
  }

  return (
    <fieldset className={styles.orderingAnswers}>
      <legend>{t('tests.student.orderItems')}</legend>
      {orderedItems.map((orderingItem, index) => (
        <div
          data-dragging={draggedItemId === orderingItem.id || undefined}
          draggable
          key={orderingItem.id}
          onDragEnd={() => setDraggedItemId(null)}
          onDragOver={(event) => event.preventDefault()}
          onDragStart={() => setDraggedItemId(orderingItem.id)}
          onDrop={() => dropOn(orderingItem.id)}
        >
          <GripVertical size={17} aria-hidden="true" />
          <span>{index + 1}</span>
          <strong>{orderingItem.text}</strong>
          <div>
            <button
              aria-label={t('tests.student.orderMoveUp', {
                item: orderingItem.text,
              })}
              disabled={index === 0}
              onClick={() => move(index, index - 1)}
              type="button"
            >
              <ArrowUp size={15} />
            </button>
            <button
              aria-label={t('tests.student.orderMoveDown', {
                item: orderingItem.text,
              })}
              disabled={index === orderedItems.length - 1}
              onClick={() => move(index, index + 1)}
              type="button"
            >
              <ArrowDown size={15} />
            </button>
          </div>
        </div>
      ))}
    </fieldset>
  )
}

function CategorizationAnswerField({
  item,
  onChange,
  response,
}: {
  item: StudentTestItem
  onChange: (response: ResponseData) => void
  response: ResponseData
}) {
  const { t } = useTranslation()
  const config = item.publicConfig as unknown as CategorizationPublicConfig
  const assignments = Array.isArray(response.assignments)
    ? response.assignments.filter(
        (value): value is { itemId: string; categoryId: string } =>
          isRecord(value) &&
          typeof value.itemId === 'string' &&
          typeof value.categoryId === 'string',
      )
    : []
  const selected = new Map(
    assignments.map((value) => [value.itemId, value.categoryId]),
  )
  return (
    <fieldset className={styles.categorizationAnswers}>
      <legend>{t('tests.student.categorizeItems')}</legend>
      {config.items.map((categoryItem, index) => (
        <label key={categoryItem.id}>
          <span>{index + 1}</span>
          <strong>{categoryItem.text}</strong>
          <select
            aria-label={t('tests.student.categoryFor', {
              item: categoryItem.text,
            })}
            onChange={(event) => {
              const next = assignments.filter(
                (value) => value.itemId !== categoryItem.id,
              )
              if (event.target.value)
                next.push({
                  itemId: categoryItem.id,
                  categoryId: event.target.value,
                })
              onChange({ assignments: next })
            }}
            value={selected.get(categoryItem.id) ?? ''}
          >
            <option value="">{t('tests.student.categoryPlaceholder')}</option>
            {config.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.title}
              </option>
            ))}
          </select>
        </label>
      ))}
    </fieldset>
  )
}

function FillBlanksAnswerField({
  item,
  onChange,
  response,
}: {
  item: StudentTestItem
  onChange: (response: ResponseData) => void
  response: ResponseData
}) {
  const { t } = useTranslation()
  const config = item.publicConfig as unknown as FillBlanksPublicConfig
  const answers = Array.isArray(response.answers)
    ? response.answers.filter(
        (value): value is { blankId: string; text: string } =>
          isRecord(value) &&
          typeof value.blankId === 'string' &&
          typeof value.text === 'string',
      )
    : []
  const answerById = new Map(
    answers.map((answer) => [answer.blankId, answer.text]),
  )
  const setAnswer = (blankId: string, text: string) => {
    const next = answers.filter((answer) => answer.blankId !== blankId)
    next.push({ blankId, text })
    onChange({ answers: next })
  }
  const firstEmptyBlank = () =>
    config.segments.find(
      (segment) =>
        segment.type === 'BLANK' && !(answerById.get(segment.id) ?? '').trim(),
    )
  return (
    <div className={styles.fillBlanksAnswer}>
      <div className={styles.fillBlanksText}>
        {config.segments.map((segment, index) =>
          segment.type === 'TEXT' ? (
            <span key={segment.id}>{segment.text}</span>
          ) : (
            <input
              aria-label={t('tests.student.blankNumber', { count: index + 1 })}
              key={segment.id}
              maxLength={500}
              onChange={(event) => setAnswer(segment.id, event.target.value)}
              value={answerById.get(segment.id) ?? ''}
            />
          ),
        )}
      </div>
      {config.wordBankEnabled && config.wordBank.length > 0 && (
        <div className={styles.wordBank}>
          <strong>{t('tests.student.wordBank')}</strong>
          <div>
            {config.wordBank.map((word) => (
              <button
                key={word.id}
                onClick={() => {
                  const blank = firstEmptyBlank()
                  if (blank) setAnswer(blank.id, word.text)
                }}
                type="button"
              >
                {word.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ImageHotspotAnswerField({
  item,
  onChange,
  response,
}: {
  item: StudentTestItem
  onChange: (response: ResponseData) => void
  response: ResponseData
}) {
  const { t } = useTranslation()
  const config = item.publicConfig as unknown as ImageHotspotPublicConfig
  const x = typeof response.x === 'number' ? response.x : 0.5
  const y = typeof response.y === 'number' ? response.y : 0.5
  const selected =
    typeof response.x === 'number' && typeof response.y === 'number'
  if (!config.promptImage) return null
  return (
    <div className={styles.hotspotAnswer}>
      <p>{t('tests.student.hotspotInstruction')}</p>
      <button
        aria-label={t('tests.student.hotspotImage')}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          onChange({
            x: (event.clientX - rect.left) / rect.width,
            y: (event.clientY - rect.top) / rect.height,
          })
        }}
        type="button"
      >
        <img
          alt={item.title}
          src={assignmentImageUrl(config.promptImage.attachmentId)}
        />
        {selected && (
          <span style={{ left: `${x * 100}%`, top: `${y * 100}%` }} />
        )}
      </button>
      <div className={styles.hotspotCoordinates}>
        <label>
          {t('tests.student.hotspotHorizontal')}
          <input
            max="1"
            min="0"
            onChange={(event) => onChange({ x: Number(event.target.value), y })}
            step="0.01"
            type="range"
            value={x}
          />
        </label>
        <label>
          {t('tests.student.hotspotVertical')}
          <input
            max="1"
            min="0"
            onChange={(event) => onChange({ x, y: Number(event.target.value) })}
            step="0.01"
            type="range"
            value={y}
          />
        </label>
      </div>
    </div>
  )
}

function PromptImage({ item }: { item: StudentTestItem }) {
  const config = item.publicConfig as {
    promptImage?: { attachmentId?: string } | null
  }
  if (!config.promptImage?.attachmentId) return null
  return (
    <img
      className={styles.questionImage}
      src={assignmentImageUrl(config.promptImage.attachmentId)}
      alt={item.title}
    />
  )
}

function normalizeResponse(
  item: StudentTestItem | undefined,
  response: ResponseData,
): ResponseData {
  if (item?.type !== 'ORDERING') return response
  if (
    Array.isArray(response.orderedItemIds) &&
    response.orderedItemIds.length > 0
  )
    return response
  return emptyResponse(item)
}

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  if (moved === undefined) return items
  next.splice(toIndex, 0, moved)
  return next
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberField(value: unknown, field: string): number | null {
  if (!isRecord(value)) return null
  const candidate = value[field]
  return typeof candidate === 'number' && Number.isFinite(candidate)
    ? candidate
    : null
}

function asMapPoint(value: unknown): MapPoint | null {
  if (!isRecord(value)) return null
  return typeof value.longitude === 'number' &&
    Number.isFinite(value.longitude) &&
    typeof value.latitude === 'number' &&
    Number.isFinite(value.latitude)
    ? { longitude: value.longitude, latitude: value.latitude }
    : null
}

function asRegionId(value: unknown): string | null {
  if (!isRecord(value)) return null
  return typeof value.regionId === 'string' && value.regionId.trim()
    ? value.regionId
    : null
}

function asRegionIds(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.selectedRegionIds)) return []
  return value.selectedRegionIds.filter(
    (regionId): regionId is string =>
      typeof regionId === 'string' && regionId.trim().length > 0,
  )
}

function isMapPointFeedback(value: unknown): value is MapPointSolutionFeedback {
  return (
    isRecord(value) &&
    isRecord(value.target) &&
    typeof value.radiusKm === 'number'
  )
}

function isMapRegionFeedback(
  value: unknown,
): value is MapRegionSolutionFeedback {
  return isRecord(value) && typeof value.correctRegionId === 'string'
}

function isMapMultiRegionFeedback(
  value: unknown,
): value is MapMultiRegionSolutionFeedback {
  return (
    isRecord(value) &&
    Array.isArray(value.correctRegionIds) &&
    value.correctRegionIds.every((regionId) => typeof regionId === 'string') &&
    (value.scoringMode === 'ALL_OR_NOTHING' || value.scoringMode === 'PARTIAL')
  )
}

function studentError(error: Error | null, t: (key: string) => string): string {
  if (error instanceof ApiError) {
    if (error.code === 'TEST_ANSWER_REQUIRED')
      return t('tests.student.errors.required')
    if (error.code === 'TEST_MAX_ATTEMPTS_REACHED')
      return t('tests.student.errors.attempts')
    if (error.code === 'TEST_TIME_EXPIRED')
      return t('tests.student.errors.expired')
  }
  return t('tests.student.errors.action')
}

function useRemainingSeconds(
  expiresAt: string | null,
  enabled: boolean,
): number | null {
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
