import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  PenLine,
  Save,
  Send,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../shared/api/api-client'
import {
  listStudentLessonAssignments,
  saveStudentAssignmentDraft,
  submitStudentAssignment,
} from '../api/assignments.api'
import { assignmentQueryKeys } from '../model/assignment-query-keys'
import type {
  StudentAssignmentAttempt,
  StudentLessonAssignment,
} from '../model/assignment.types'
import { AssignmentDialog } from './AssignmentDialog'
import styles from '../Assignments.module.css'

export function StudentLessonAssignments({ lessonId }: { lessonId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [activeAssignment, setActiveAssignment] =
    useState<StudentLessonAssignment | null>(null)
  const assignmentsQuery = useQuery({
    queryKey: assignmentQueryKeys.studentLesson(lessonId),
    queryFn: () => listStudentLessonAssignments(lessonId),
  })
  const assignments = assignmentsQuery.data ?? []

  const closeRunner = () => {
    setActiveAssignment(null)
    void queryClient.invalidateQueries({
      queryKey: assignmentQueryKeys.studentLesson(lessonId),
    })
  }

  return (
    <section
      className={styles.studentAssignments}
      aria-labelledby="student-assignments-title"
    >
      <header className={styles.studentAssignmentsHeader}>
        <p className={styles.eyebrow}>
          <ClipboardList size={15} aria-hidden="true" />
          {t('assignments.student.eyebrow')}
        </p>
        <h2 id="student-assignments-title">
          {t('assignments.student.title')}
        </h2>
        <p>{t('assignments.student.description')}</p>
      </header>

      {assignmentsQuery.isLoading && (
        <p className={styles.studentAssignmentsState}>
          {t('assignments.student.loading')}
        </p>
      )}
      {assignmentsQuery.isError && (
        <div className={styles.studentAssignmentsState} role="alert">
          <p>{t('assignments.student.loadError')}</p>
          <button
            className={styles.secondaryButton}
            onClick={() => void assignmentsQuery.refetch()}
            type="button"
          >
            {t('assignments.common.retry')}
          </button>
        </div>
      )}
      {!assignmentsQuery.isLoading &&
        !assignmentsQuery.isError &&
        assignments.length === 0 && (
          <div className={styles.studentAssignmentsState}>
            <CheckCircle2 size={25} aria-hidden="true" />
            <p>{t('assignments.student.empty')}</p>
          </div>
        )}

      {assignments.length > 0 && (
        <div className={styles.studentAssignmentGrid}>
          {assignments.map((assignment) => (
            <StudentAssignmentCard
              assignment={assignment}
              key={assignment.releaseId}
              onOpen={() => setActiveAssignment(assignment)}
              t={t}
            />
          ))}
        </div>
      )}

      {activeAssignment && (
        <WrittenAssignmentRunner
          assignment={activeAssignment}
          onClose={closeRunner}
        />
      )}
    </section>
  )
}

function StudentAssignmentCard({
  assignment,
  onOpen,
  t,
}: {
  assignment: StudentLessonAssignment
  onOpen: () => void
  t: (key: string, values?: Record<string, unknown>) => string
}) {
  return (
    <article className={styles.studentAssignmentCard}>
      <div className={styles.studentAssignmentCardTop}>
        <span className={styles.linkedIcon} aria-hidden="true">
          <PenLine size={20} />
        </span>
        <span
          className={`${styles.studentAssignmentStatus} ${styles[`studentStatus${assignment.stateStatus}`]}`}
        >
          {t(`assignments.student.status.${assignment.stateStatus}`)}
        </span>
      </div>
      <div className={styles.studentAssignmentCardCopy}>
        <span>{t('assignments.types.WRITTEN.title')}</span>
        <h3>{assignment.title}</h3>
        <p>{assignment.prompt}</p>
      </div>
      <div className={styles.studentAssignmentCardFooter}>
        <span>
          {t('assignments.student.points', { count: assignment.maxPoints })}
        </span>
        {assignment.dueAt && (
          <span>
            <Clock3 size={13} aria-hidden="true" />
            {t('assignments.student.due', {
              date: new Intl.DateTimeFormat(undefined, {
                day: 'numeric',
                month: 'short',
              }).format(new Date(assignment.dueAt)),
            })}
          </span>
        )}
      </div>
      <button className={styles.studentOpenButton} onClick={onOpen} type="button">
        {getOpenLabel(assignment, t)}
      </button>
    </article>
  )
}

function WrittenAssignmentRunner({
  assignment,
  onClose,
}: {
  assignment: StudentLessonAssignment
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState(assignment.attempt?.responseText ?? '')
  const textRef = useRef(text)
  const [savedText, setSavedText] = useState(
    assignment.attempt?.responseText ?? '',
  )
  const [attempt, setAttempt] = useState<StudentAssignmentAttempt | null>(
    assignment.attempt,
  )
  const [failedText, setFailedText] = useState<string | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const autosaveTimerRef = useRef<number | null>(null)
  const runnerStatus = getRunnerStatus(assignment, attempt)
  const isLocked =
    runnerStatus === 'AWAITING_REVIEW' ||
    runnerStatus === 'COMPLETED' ||
    runnerStatus === 'EXPIRED'
  const maxLength = getWrittenMaxLength(assignment.publicConfig)

  useEffect(() => {
    textRef.current = text
  }, [text])

  const saveMutation = useMutation({
    mutationFn: (snapshot: string) =>
      saveStudentAssignmentDraft(assignment.releaseId, snapshot),
    onSuccess: (savedAttempt) => {
      setAttempt(savedAttempt)
      setSavedText(savedAttempt.responseText)
      setFailedText(null)
      if (isClosing && textRef.current === savedAttempt.responseText) {
        onClose()
      }
    },
    onError: (_error, snapshot) => {
      setFailedText(snapshot)
      setIsClosing(false)
    },
  })
  const submitMutation = useMutation({
    mutationFn: (snapshot: string) =>
      submitStudentAssignment(assignment.releaseId, snapshot),
    onSuccess: (submittedAttempt) => {
      setAttempt(submittedAttempt)
      setSavedText(submittedAttempt.responseText)
      setFailedText(null)
    },
  })

  useEffect(() => {
    if (
      isLocked ||
      text === savedText ||
      text === failedText ||
      saveMutation.isPending ||
      submitMutation.isPending ||
      isClosing
    ) {
      return
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null
      saveMutation.mutate(text)
    }, 900)
    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [
    failedText,
    isClosing,
    isLocked,
    saveMutation,
    savedText,
    submitMutation.isPending,
    text,
  ])

  const requestClose = () => {
    if (saveMutation.isPending || submitMutation.isPending || isClosing) {
      return
    }
    if (!isLocked && text !== savedText) {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      setIsClosing(true)
      saveMutation.mutate(text)
      return
    }
    onClose()
  }

  const submit = () => {
    if (
      isLocked ||
      text.trim().length === 0 ||
      saveMutation.isPending ||
      submitMutation.isPending
    ) {
      return
    }
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    submitMutation.mutate(text)
  }

  const saveState = getSaveState({
    failed: saveMutation.isError,
    isLocked,
    isPending: saveMutation.isPending || isClosing,
    isSaved: text === savedText,
    wasStarted: Boolean(attempt),
  })

  return (
    <AssignmentDialog
      closeLabel={t('assignments.common.close')}
      description={t('assignments.student.runnerDescription')}
      fullScreen
      onClose={requestClose}
      title={assignment.title}
    >
      <div className={styles.studentRunnerViewport}>
        <article className={styles.studentRunner}>
          <header className={styles.studentRunnerHeader}>
            <span className={styles.previewTypeIcon} aria-hidden="true">
              <PenLine size={21} />
            </span>
            <div>
              <p>{t('assignments.types.WRITTEN.title')}</p>
              <span>
                {t('assignments.student.points', {
                  count: assignment.maxPoints,
                })}
              </span>
            </div>
            <span
              className={`${styles.studentAssignmentStatus} ${styles[`studentStatus${runnerStatus}`]}`}
            >
              {t(`assignments.student.status.${runnerStatus}`)}
            </span>
          </header>

          <section className={styles.studentRunnerPrompt}>
            <h2>{assignment.prompt}</h2>
            {assignment.instructions && <p>{assignment.instructions}</p>}
          </section>

          <label className={styles.studentAnswerField}>
            <span>{t('assignments.student.answer')}</span>
            {getWrittenResponseMode(assignment.publicConfig) === 'SHORT' ? (
              <input
                aria-label={t('assignments.student.answer')}
                disabled={isLocked}
                maxLength={maxLength}
                onChange={(event) => {
                  setFailedText(null)
                  setText(event.target.value)
                }}
                placeholder={t('assignments.student.answerPlaceholder')}
                value={text}
              />
            ) : (
              <textarea
                aria-label={t('assignments.student.answer')}
                disabled={isLocked}
                maxLength={maxLength}
                onChange={(event) => {
                  setFailedText(null)
                  setText(event.target.value)
                }}
                placeholder={t('assignments.student.answerPlaceholder')}
                rows={10}
                value={text}
              />
            )}
            <small>
              {text.length}/{maxLength}
            </small>
          </label>

          {attempt?.status === 'GRADED' && attempt.scorePoints !== null && (
            <div className={styles.studentResult}>
              <div>
                <span>{t('assignments.student.result.label')}</span>
                <strong>
                  {t('assignments.student.result.points', {
                    score: attempt.scorePoints,
                    max: assignment.maxPoints,
                  })}
                </strong>
              </div>
              {attempt.scorePercent !== null && (
                <span
                  className={
                    attempt.isPassed
                      ? styles.studentResultPassed
                      : styles.studentResultNotPassed
                  }
                >
                  {t(
                    attempt.isPassed
                      ? 'assignments.student.result.passed'
                      : 'assignments.student.result.notPassed',
                    { percent: attempt.scorePercent },
                  )}
                </span>
              )}
            </div>
          )}

          {attempt?.teacherComment && (
            <div className={styles.studentTeacherComment}>
              <strong>{t('assignments.student.teacherComment')}</strong>
              <p>{attempt.teacherComment}</p>
            </div>
          )}

          {isLocked ? (
            <div className={styles.studentSubmittedNotice} role="status">
              <CheckCircle2 size={20} aria-hidden="true" />
              <div>
                <strong>
                  {t(`assignments.student.lockedNotice.${runnerStatus}.title`)}
                </strong>
                <p>
                  {t(
                    `assignments.student.lockedNotice.${runnerStatus}.description`,
                  )}
                </p>
              </div>
            </div>
          ) : (
            <footer className={styles.studentRunnerActions}>
              <div className={styles.studentSaveState} aria-live="polite">
                <Save size={15} aria-hidden="true" />
                <span>{t(`assignments.student.saveState.${saveState}`)}</span>
                {saveState === 'error' && (
                  <button
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate(text)}
                    type="button"
                  >
                    {t('assignments.common.retry')}
                  </button>
                )}
              </div>
              <button
                className={styles.primaryButton}
                disabled={
                  text.trim().length === 0 ||
                  saveMutation.isPending ||
                  submitMutation.isPending
                }
                onClick={submit}
                type="button"
              >
                <Send size={16} aria-hidden="true" />
                {submitMutation.isPending
                  ? t('assignments.student.submitting')
                  : t('assignments.student.submit')}
              </button>
            </footer>
          )}

          {submitMutation.isError && (
            <p className={styles.inlineError} role="alert">
              {getStudentError(submitMutation.error, t)}
            </p>
          )}
        </article>
      </div>
    </AssignmentDialog>
  )
}

function getWrittenMaxLength(config: Record<string, unknown>): number {
  return typeof config.maxLength === 'number' ? config.maxLength : 5_000
}

function getWrittenResponseMode(
  config: Record<string, unknown>,
): 'SHORT' | 'LONG' {
  return config.responseMode === 'SHORT' ? 'SHORT' : 'LONG'
}

function getOpenLabel(
  assignment: StudentLessonAssignment,
  t: (key: string) => string,
): string {
  if (
    assignment.stateStatus === 'AWAITING_REVIEW' ||
    assignment.stateStatus === 'COMPLETED' ||
    assignment.stateStatus === 'EXPIRED'
  ) {
    return t('assignments.student.openSubmitted')
  }
  if (
    assignment.stateStatus === 'IN_PROGRESS' ||
    assignment.stateStatus === 'NEEDS_REVISION'
  ) {
    return t('assignments.student.continue')
  }
  return t('assignments.student.start')
}

function getRunnerStatus(
  assignment: StudentLessonAssignment,
  attempt: StudentAssignmentAttempt | null,
): StudentLessonAssignment['stateStatus'] {
  if (assignment.stateStatus === 'EXPIRED') return 'EXPIRED'
  if (assignment.stateStatus === 'COMPLETED') return 'COMPLETED'
  if (assignment.stateStatus === 'AWAITING_REVIEW') return 'AWAITING_REVIEW'
  if (attempt?.status === 'AWAITING_REVIEW') return 'AWAITING_REVIEW'
  if (attempt?.status === 'GRADED') return 'COMPLETED'
  if (attempt?.status === 'EXPIRED' || attempt?.status === 'CANCELLED') {
    return 'EXPIRED'
  }
  if (attempt?.status === 'IN_PROGRESS') return 'IN_PROGRESS'
  if (attempt?.status === 'RETURNED') return 'NEEDS_REVISION'
  return assignment.stateStatus
}

function getSaveState({
  failed,
  isLocked,
  isPending,
  isSaved,
  wasStarted,
}: {
  failed: boolean
  isLocked: boolean
  isPending: boolean
  isSaved: boolean
  wasStarted: boolean
}): 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'submitted' {
  if (isLocked) return 'submitted'
  if (isPending) return 'saving'
  if (failed) return 'error'
  if (!isSaved) return 'dirty'
  return wasStarted ? 'saved' : 'idle'
}

function getStudentError(
  error: Error | null,
  t: (key: string) => string,
): string {
  if (error instanceof ApiError) {
    if (error.code === 'ASSIGNMENT_RESPONSE_REQUIRED') {
      return t('assignments.student.errors.required')
    }
    if (error.code === 'ASSIGNMENT_ATTEMPT_LOCKED') {
      return t('assignments.student.errors.locked')
    }
    if (error.code === 'ASSIGNMENT_CLOSED') {
      return t('assignments.student.errors.closed')
    }
    if (error.code === 'NETWORK_ERROR') {
      return t('assignments.errors.network')
    }
  }
  return t('assignments.student.errors.submit')
}
