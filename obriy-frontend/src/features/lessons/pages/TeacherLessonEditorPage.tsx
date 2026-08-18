import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookOpen,
  Clock3,
  Eye,
  EyeOff,
  Link2,
  Link2Off,
  Save,
  School,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../../shared/api/api-client'
import { registerWorkspaceNavigationGuard } from '../../../shared/navigation/workspace-navigation-guard'
import { useSessionStore } from '../../auth/model/session.store'
import { listTeacherClasses } from '../../classes/api/classes.api'
import { TeacherLessonTests, TeacherTestReviews } from '../../tests'
import {
  createLesson,
  getLesson,
  setClassLesson,
  unlinkClassLesson,
  updateLesson,
} from '../api/lessons.api'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { lessonQueryKeys } from '../model/lesson-query-keys'
import type { Lesson, LessonDraftInput } from '../model/lesson.types'
import styles from '../Lessons.module.css'

interface EditorValues {
  content: string
  contentLocale: 'UK' | 'EN'
  estimatedMinutes: string
  summary: string
  title: string
}

type ClassAction = 'add' | 'hide' | 'publish' | 'unlink'

interface ClassActionInput {
  classId: string
  type: ClassAction
}

interface SaveResult {
  lesson: Lesson
  savedValues: EditorValues
  wasCreated: boolean
}

export function TeacherLessonEditorPage() {
  const { lessonId: routeLessonId } = useParams()
  const isNew = !routeLessonId
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const profileLocale = useSessionStore(
    (state) => state.user?.profile.preferredLocale ?? 'UK',
  )
  const initialValues = useMemo<EditorValues>(
    () => ({
      content: '',
      contentLocale: profileLocale,
      estimatedMinutes: '',
      summary: '',
      title: '',
    }),
    [profileLocale],
  )
  const [values, setValues] = useState<EditorValues>(initialValues)
  const valuesRef = useRef(values)
  const autosaveTimeoutRef = useRef<number | null>(null)
  const [activeLessonId, setActiveLessonId] = useState(routeLessonId ?? null)
  const [lessonStatus, setLessonStatus] = useState<Lesson['status']>('DRAFT')
  const [savedHash, setSavedHash] = useState(() => serializeValues(initialValues))
  const [hasHydrated, setHasHydrated] = useState(isNew)
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')
  const [hasInteracted, setHasInteracted] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const [classError, setClassError] = useState<string | null>(null)
  const [unlinkClassId, setUnlinkClassId] = useState<string | null>(null)

  useEffect(() => {
    valuesRef.current = values
  }, [values])
  const currentHash = serializeValues(values)
  const isDirty = currentHash !== savedHash
  const durationError = getDurationError(values.estimatedMinutes, t)
  const hasMeaningfulContent =
    values.title.trim().length > 0 ||
    values.summary.trim().length > 0 ||
    values.content.trim().length > 0 ||
    values.estimatedMinutes !== ''

  const lessonQuery = useQuery({
    queryKey: lessonQueryKeys.detail(routeLessonId ?? ''),
    queryFn: () => getLesson(routeLessonId ?? ''),
    enabled: Boolean(routeLessonId),
  })
  const classesQuery = useQuery({
    queryKey: ['classes', 'teacher'],
    queryFn: listTeacherClasses,
  })

  useEffect(() => {
    if (!lessonQuery.data || hasHydrated) {
      return
    }

    const hydrated = lessonToEditorValues(lessonQuery.data)
    // Async server data initializes the local editor buffer exactly once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(hydrated)
    setSavedHash(serializeValues(hydrated))
    setLessonStatus(lessonQuery.data.status)
    setActiveLessonId(lessonQuery.data.id)
    setSaveState('saved')
    setHasHydrated(true)
  }, [hasHydrated, lessonQuery.data])

  const saveMutation = useMutation({
    mutationFn: async (snapshot: EditorValues): Promise<SaveResult> => {
      const lessonId = activeLessonId
      const lesson = lessonId
        ? await updateLesson(lessonId, editorValuesToInput(snapshot))
        : await createLesson(editorValuesToInput(snapshot))

      // Persist exactly one immutable snapshot per mutation. If the teacher
      // keeps typing, the remaining dirty buffer is saved by the next draft
      // autosave (or the next explicit save for a published lesson). This also
      // prevents a successful POST followed by a failed catch-up PATCH from
      // losing the newly created id and creating a duplicate draft on retry.
      return { lesson, savedValues: snapshot, wasCreated: lessonId === null }
    },
    onMutate: () => setSaveState('saving'),
    onSuccess: ({ lesson, savedValues, wasCreated }) => {
      const savedSnapshotHash = serializeValues(savedValues)
      const hasNewerLocalChanges =
        serializeValues(valuesRef.current) !== savedSnapshotHash

      setActiveLessonId(lesson.id)
      setLessonStatus(lesson.status)
      setSavedHash(savedSnapshotHash)
      setSaveState(hasNewerLocalChanges ? 'dirty' : 'saved')
      setHasHydrated(true)
      queryClient.setQueryData(lessonQueryKeys.detail(lesson.id), lesson)
      void queryClient.invalidateQueries({ queryKey: lessonQueryKeys.lists })
      void queryClient.invalidateQueries({ queryKey: lessonQueryKeys.classes })

      if (wasCreated) {
        navigate(`/app/teacher/lessons/${lesson.id}/edit`, { replace: true })
      }
    },
    onError: () => setSaveState('error'),
  })

  useEffect(() => {
    if (
      !hasHydrated ||
      !isDirty ||
      durationError ||
      lessonStatus !== 'DRAFT' ||
      saveMutation.isPending ||
      saveState === 'error' ||
      showDiscardDialog ||
      (!activeLessonId && (!hasInteracted || !hasMeaningfulContent))
    ) {
      return
    }

    autosaveTimeoutRef.current = window.setTimeout(() => {
      autosaveTimeoutRef.current = null
      saveMutation.mutate(values)
    }, 1000)

    return () => {
      if (autosaveTimeoutRef.current !== null) {
        window.clearTimeout(autosaveTimeoutRef.current)
        autosaveTimeoutRef.current = null
      }
    }
  }, [
    activeLessonId,
    currentHash,
    durationError,
    hasHydrated,
    hasInteracted,
    hasMeaningfulContent,
    isDirty,
    lessonStatus,
    saveMutation,
    saveState,
    showDiscardDialog,
    values,
  ])

  const shouldWarn = isDirty || saveMutation.isPending || saveState === 'error'
  useEffect(() => {
    if (!shouldWarn) {
      return
    }

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [shouldWarn])

  useEffect(() => {
    if (!showDiscardDialog || shouldWarn) {
      return
    }

    // The teacher requested navigation while a save was already in flight.
    // Once that save finishes and nothing newer remains dirty, continue to
    // the requested destination instead of leaving a stale discard dialog.
    const target = pendingNavigation ?? '/app/teacher/lessons'
    navigate(target)
  }, [navigate, pendingNavigation, shouldWarn, showDiscardDialog])

  useEffect(() => {
    if (!shouldWarn) {
      return
    }

    return registerWorkspaceNavigationGuard((target) => {
      setPendingNavigation(target)
      setShowDiscardDialog(true)
    })
  }, [shouldWarn])

  const classMutation = useMutation({
    mutationFn: async ({ classId, type }: ClassActionInput) => {
      if (!activeLessonId) {
        throw new Error('Lesson must be saved before assigning a class.')
      }
      if (type === 'unlink') {
        await unlinkClassLesson(classId, activeLessonId)
        return
      }
      await setClassLesson(classId, activeLessonId, type === 'publish')
    },
    onMutate: () => setClassError(null),
    onSuccess: async (_result, variables) => {
      setUnlinkClassId(null)
      if (!activeLessonId) {
        return
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: lessonQueryKeys.detail(activeLessonId),
        }),
        queryClient.invalidateQueries({ queryKey: lessonQueryKeys.lists }),
        queryClient.invalidateQueries({
          queryKey: lessonQueryKeys.class(variables.classId),
        }),
      ])
      const refreshed = await queryClient.fetchQuery({
        queryKey: lessonQueryKeys.detail(activeLessonId),
        queryFn: () => getLesson(activeLessonId),
      })
      setLessonStatus(refreshed.status)
    },
    onError: (error) => setClassError(getClassActionError(error, t)),
  })

  const leaveEditor = () => {
    if (shouldWarn) {
      setShowDiscardDialog(true)
      return
    }
    navigate('/app/teacher/lessons')
  }

  const saveNow = () => {
    if (durationError || saveMutation.isPending) {
      return
    }
    if (!activeLessonId && !hasMeaningfulContent) {
      navigate('/app/teacher/lessons')
      return
    }
    if (autosaveTimeoutRef.current !== null) {
      window.clearTimeout(autosaveTimeoutRef.current)
      autosaveTimeoutRef.current = null
    }
    saveMutation.mutate(values)
  }

  if (!isNew && (lessonQuery.isLoading || !hasHydrated)) {
    return <EditorStatus message={t('lessons.editor.loading')} />
  }

  if (!isNew && (lessonQuery.isError || !lessonQuery.data)) {
    return (
      <EditorStatus
        action={t('lessons.editor.back')}
        message={t('lessons.editor.notFoundDescription')}
        onAction={() => navigate('/app/teacher/lessons')}
        title={t('lessons.editor.notFoundTitle')}
      />
    )
  }

  const classLinks = lessonQuery.data?.classLinks ?? []
  const isArchived = lessonStatus === 'ARCHIVED'
  const classControlsDisabled = isArchived || shouldWarn

  return (
    <section className={styles.page} aria-labelledby="lesson-editor-title">
      <div className={`${styles.content} ${styles.editorContent}`}>
        <button className={styles.backButton} onClick={leaveEditor} type="button">
          <ArrowLeft size={16} aria-hidden="true" />
          {t('lessons.editor.back')}
        </button>

        <header className={styles.editorHeader}>
          <div>
            <p className={styles.eyebrow}>
              <BookOpen size={15} aria-hidden="true" />
              {isNew
                ? t('lessons.editor.createEyebrow')
                : t('lessons.editor.editEyebrow')}
            </p>
            <h1 id="lesson-editor-title">
              {isNew
                ? t('lessons.editor.createTitle')
                : values.title.trim() || t('lessons.common.untitled')}
            </h1>
            <p>{t('lessons.editor.description')}</p>
          </div>
          <div className={styles.editorHeaderActions}>
            <SaveIndicator state={saveState} />
            <button
              className={styles.primaryButton}
              disabled={
                isArchived ||
                Boolean(durationError) ||
                saveMutation.isPending ||
                (!isDirty && Boolean(activeLessonId))
              }
              onClick={saveNow}
              type="button"
            >
              <Save size={16} aria-hidden="true" />
              {saveMutation.isPending
                ? t('lessons.editor.saving')
                : lessonStatus === 'PUBLISHED'
                  ? t('lessons.editor.savePublished')
                  : t('lessons.editor.saveNow')}
            </button>
          </div>
        </header>

        {isArchived && (
          <p className={styles.archiveNotice}>{t('lessons.editor.archived')}</p>
        )}
        {saveMutation.isError && (
          <p className={styles.errorStatus} role="alert">
            {getSaveError(saveMutation.error, t)}
          </p>
        )}

        <div className={styles.editorLayout}>
          <form
            className={styles.editorForm}
            onSubmit={(event) => event.preventDefault()}
          >
              <fieldset disabled={isArchived}>
                <section className={styles.editorFormSection}>
                  <div className={styles.editorSectionHeading}>
                    <h2>{t('lessons.editor.sections.basicsTitle')}</h2>
                    <p>{t('lessons.editor.sections.basicsDescription')}</p>
                  </div>
                  <div className={styles.editorSectionFields}>
                    <label className={styles.fullField}>
                      <span>{t('lessons.editor.fields.title')}</span>
                      <input
                        className={styles.titleInput}
                        maxLength={160}
                        onChange={(event) =>
                          updateEditorValue('title', event.target.value)
                        }
                        placeholder={t('lessons.editor.fields.titlePlaceholder')}
                        value={values.title}
                      />
                      <small>{t('lessons.editor.fields.titleHint')}</small>
                    </label>

                    <label className={styles.fullField}>
                      <span>{t('lessons.editor.fields.summary')}</span>
                      <textarea
                        className={styles.summaryInput}
                        maxLength={500}
                        onChange={(event) =>
                          updateEditorValue('summary', event.target.value)
                        }
                        placeholder={t('lessons.editor.fields.summaryPlaceholder')}
                        rows={3}
                        value={values.summary}
                      />
                      <small>{t('lessons.editor.fields.summaryHint')}</small>
                    </label>

                    <div className={styles.lessonSettingsRow}>
                      <label>
                        <span>
                          <Clock3 size={14} aria-hidden="true" />
                          {t('lessons.editor.fields.duration')}
                        </span>
                        <input
                          aria-describedby={
                            durationError ? 'lesson-duration-error' : undefined
                          }
                          inputMode="numeric"
                          max={180}
                          min={1}
                          onChange={(event) =>
                            updateEditorValue(
                              'estimatedMinutes',
                              event.target.value,
                            )
                          }
                          placeholder={t(
                            'lessons.editor.fields.durationPlaceholder',
                          )}
                          type="number"
                          value={values.estimatedMinutes}
                        />
                        {durationError && (
                          <small
                            className={styles.fieldError}
                            id="lesson-duration-error"
                          >
                            {durationError}
                          </small>
                        )}
                      </label>
                    </div>
                  </div>
                </section>

                <section className={styles.editorFormSection}>
                  <div className={styles.editorSectionHeading}>
                    <h2>{t('lessons.editor.sections.contentTitle')}</h2>
                    <p>{t('lessons.editor.sections.contentDescription')}</p>
                  </div>
                  <div className={styles.editorSectionFields}>
                    <label className={styles.fullField}>
                      <span>{t('lessons.editor.fields.content')}</span>
                      <textarea
                        className={styles.contentInput}
                        onChange={(event) =>
                          updateEditorValue('content', event.target.value)
                        }
                        placeholder={t('lessons.editor.fields.contentPlaceholder')}
                        rows={18}
                        value={values.content}
                      />
                      <small>{t('lessons.editor.fields.contentHint')}</small>
                    </label>
                  </div>
                </section>
              </fieldset>
          </form>

          <aside className={styles.classAssignmentPanel}>
            <div className={styles.sectionHeading}>
              <School size={19} aria-hidden="true" />
              <div>
                <h2>{t('lessons.editor.classes.title')}</h2>
                <p>{t('lessons.editor.classes.description')}</p>
              </div>
            </div>

            {!activeLessonId && (
              <p className={styles.quietNotice}>
                {t('lessons.editor.classes.saveFirst')}
              </p>
            )}
            {classesQuery.isLoading && (
              <p className={styles.quietNotice}>
                {t('lessons.editor.classes.loading')}
              </p>
            )}
            {classesQuery.isError && (
              <p className={styles.errorStatus} role="alert">
                {t('lessons.editor.classes.loadError')}
              </p>
            )}
            {classesQuery.data?.length === 0 && (
              <p className={styles.quietNotice}>
                {t('lessons.editor.classes.empty')}
              </p>
            )}
            {classError && (
              <p className={styles.errorStatus} role="alert">
                {classError}
              </p>
            )}

            {classesQuery.data && classesQuery.data.length > 0 && (
              <ul className={styles.assignmentList}>
                {classesQuery.data.map((classroom) => {
                  const link = classLinks.find(
                    (item) => item.classId === classroom.id,
                  )
                  const pendingThisClass =
                    classMutation.isPending &&
                    classMutation.variables?.classId === classroom.id

                  return (
                    <li key={classroom.id}>
                      <div className={styles.assignmentCopy}>
                        <strong>{classroom.name}</strong>
                        <span>
                          {!link
                            ? t('lessons.editor.classes.notAdded')
                            : link.publishedAt
                              ? t('lessons.editor.classes.published')
                              : t('lessons.editor.classes.hidden')}
                        </span>
                      </div>
                      <div className={styles.assignmentActions}>
                        {!link && (
                          <button
                            disabled={!activeLessonId || classControlsDisabled || pendingThisClass}
                            onClick={() =>
                              classMutation.mutate({
                                classId: classroom.id,
                                type: 'add',
                              })
                            }
                            type="button"
                          >
                            <Link2 size={15} aria-hidden="true" />
                            {t('lessons.editor.classes.add')}
                          </button>
                        )}
                        {link && !link.publishedAt && (
                          <button
                            disabled={classControlsDisabled || pendingThisClass}
                            onClick={() =>
                              classMutation.mutate({
                                classId: classroom.id,
                                type: 'publish',
                              })
                            }
                            type="button"
                          >
                            <Eye size={15} aria-hidden="true" />
                            {t('lessons.editor.classes.publish')}
                          </button>
                        )}
                        {link?.publishedAt && (
                          <button
                            disabled={classControlsDisabled || pendingThisClass}
                            onClick={() =>
                              classMutation.mutate({
                                classId: classroom.id,
                                type: 'hide',
                              })
                            }
                            type="button"
                          >
                            <EyeOff size={15} aria-hidden="true" />
                            {t('lessons.editor.classes.hide')}
                          </button>
                        )}
                        {link && (
                          <button
                            aria-label={t('lessons.editor.classes.unlinkNamed', {
                              name: classroom.name,
                            })}
                            className={styles.assignmentUnlink}
                            disabled={classControlsDisabled || pendingThisClass}
                            onClick={() => setUnlinkClassId(classroom.id)}
                            title={t('lessons.editor.classes.unlink')}
                            type="button"
                          >
                            <Link2Off size={15} />
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </aside>

          {activeLessonId && (
            <div className={styles.editorTasks}>
              <TeacherLessonTests
                contentLocale={values.contentLocale}
                lessonId={activeLessonId}
                readOnly={isArchived}
              />
              <TeacherTestReviews lessonId={activeLessonId} />
            </div>
          )}
        </div>
      </div>

      {showDiscardDialog && (
        <ConfirmationDialog
          cancelLabel={t('lessons.confirm.discard.cancel')}
          confirmLabel={t('lessons.confirm.discard.confirm')}
          description={t('lessons.confirm.discard.description')}
          isDangerous
          isPending={saveMutation.isPending}
          onCancel={() => {
            setPendingNavigation(null)
            setShowDiscardDialog(false)
          }}
          onConfirm={() =>
            navigate(pendingNavigation ?? '/app/teacher/lessons')
          }
          title={t('lessons.confirm.discard.title')}
        />
      )}

      {unlinkClassId && (
        <ConfirmationDialog
          cancelLabel={t('lessons.common.cancel')}
          confirmLabel={t('lessons.confirm.unlink.confirm')}
          description={t('lessons.confirm.unlink.description')}
          error={
            classMutation.isError
              ? getClassActionError(classMutation.error, t)
              : undefined
          }
          isPending={classMutation.isPending}
          onCancel={() => {
            classMutation.reset()
            setClassError(null)
            setUnlinkClassId(null)
          }}
          onConfirm={() =>
            classMutation.mutate({ classId: unlinkClassId, type: 'unlink' })
          }
          title={t('lessons.confirm.unlink.title')}
        />
      )}
    </section>
  )

  function updateEditorValue<Key extends keyof EditorValues>(
    key: Key,
    value: EditorValues[Key],
  ) {
    setHasInteracted(true)
    setValues((current) => ({ ...current, [key]: value }))
    setSaveState('dirty')
  }
}

function SaveIndicator({
  state,
}: {
  state: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
}) {
  const { t } = useTranslation()

  if (state === 'idle') {
    return null
  }

  return (
    <span
      aria-live="polite"
      className={`${styles.saveIndicator} ${state === 'error' ? styles.saveIndicatorError : ''}`}
    >
      {state === 'saving' && t('lessons.editor.saving')}
      {state === 'saved' && t('lessons.editor.saved')}
      {state === 'dirty' && t('lessons.editor.unsaved')}
      {state === 'error' && t('lessons.editor.saveFailed')}
    </span>
  )
}

function EditorStatus({
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
    <section className={styles.page}>
      <div className={styles.content}>
        <div className={styles.statusPanel}>
          {title && <h1>{title}</h1>}
          <p>{message}</p>
          {action && onAction && (
            <button className={styles.secondaryButton} onClick={onAction} type="button">
              {action}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

function lessonToEditorValues(lesson: Lesson): EditorValues {
  return {
    content: lesson.content,
    contentLocale: lesson.contentLocale,
    estimatedMinutes:
      lesson.estimatedMinutes === null ? '' : String(lesson.estimatedMinutes),
    summary: lesson.summary,
    title: lesson.title,
  }
}

function editorValuesToInput(values: EditorValues): LessonDraftInput {
  return {
    content: values.content,
    contentLocale: values.contentLocale,
    estimatedMinutes:
      values.estimatedMinutes === '' ? null : Number(values.estimatedMinutes),
    summary: values.summary,
    title: values.title,
  }
}

function serializeValues(values: EditorValues): string {
  return JSON.stringify(values)
}

function getDurationError(
  value: string,
  t: (key: string) => string,
): string | null {
  if (value === '') {
    return null
  }
  const duration = Number(value)
  if (!Number.isInteger(duration) || duration < 1 || duration > 180) {
    return t('lessons.validation.duration')
  }
  return null
}

function getSaveError(error: Error, t: (key: string) => string): string {
  if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
    return t('lessons.errors.network')
  }
  return t('lessons.errors.save')
}

function getClassActionError(
  error: Error,
  t: (key: string) => string,
): string {
  if (error instanceof ApiError) {
    if (
      error.status === 400 ||
      error.code === 'LESSON_INCOMPLETE' ||
      error.code === 'LESSON_NOT_READY'
    ) {
      return t('lessons.errors.publishIncomplete')
    }
    if (error.code === 'NETWORK_ERROR') {
      return t('lessons.errors.network')
    }
  }
  return t('lessons.errors.classAction')
}
