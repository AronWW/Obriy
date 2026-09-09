import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  ListChecks,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../../shared/api/api-client'
import { registerWorkspaceNavigationGuard } from '../../../shared/navigation/workspace-navigation-guard'
import {
  createAssignment,
  getAssignment,
  startAssignmentEdit,
  updateAssignmentDraft,
} from '../api/assignments.api'
import { AssignmentConfirmDialog } from '../components/AssignmentConfirmDialog'
import { WrittenAssignmentPreview } from '../components/WrittenAssignmentPreview'
import { TeacherPromptImageField } from '../components/TeacherPromptImageField'
import { assignmentQueryKeys } from '../model/assignment-query-keys'
import { TeacherChoiceAssignmentEditorPage } from './TeacherChoiceAssignmentEditorPage'
import { TeacherMatchingAssignmentEditorPage } from './TeacherMatchingAssignmentEditorPage'
import { TeacherOrderingAssignmentEditorPage } from './TeacherOrderingAssignmentEditorPage'
import { TeacherInteractiveAssignmentEditorPage } from './TeacherInteractiveAssignmentEditorPage'
import { TeacherMapPointAssignmentEditorPage } from './TeacherMapPointAssignmentEditorPage'
import { TeacherMapRegionAssignmentEditorPage } from './TeacherMapRegionAssignmentEditorPage'
import { TeacherMapMultiRegionAssignmentEditorPage } from './TeacherMapMultiRegionAssignmentEditorPage'
import type {
  AssignmentEditor,
  AssignmentEditorRevision,
  AssignmentRubricItem,
  WrittenPublicConfig,
  WrittenAssignmentDraftInput,
} from '../model/assignment.types'
import styles from '../Assignments.module.css'

const WRITTEN_MAX_LENGTH = 5_000

interface EditorValues {
  defaultMaxPoints: string
  defaultPassingPercent: string
  explanation: string
  instructions: string
  prompt: string
  publicConfig: WrittenPublicConfig
  title: string
}

interface SaveResult {
  assignment: AssignmentEditor
  savedValues: EditorValues
  wasCreated: boolean
}

const emptyValues: EditorValues = {
  defaultMaxPoints: '1',
  defaultPassingPercent: '100',
  explanation: '',
  instructions: '',
  prompt: '',
  publicConfig: {
    responseMode: 'LONG',
    minLength: 0,
    maxLength: WRITTEN_MAX_LENGTH,
    allowAttachments: false,
    rubric: [],
  },
  title: '',
}

export function TeacherAssignmentEditorPage() {
  const { assignmentId, assignmentType } = useParams()
  const assignmentQuery = useQuery({
    queryKey: assignmentQueryKeys.detail(assignmentId ?? ''),
    queryFn: () => getAssignment(assignmentId ?? ''),
    enabled: Boolean(assignmentId),
  })
  const type = assignmentQuery.data?.type ?? assignmentType?.toUpperCase()

  if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') {
    return <TeacherChoiceAssignmentEditorPage />
  }
  if (type === 'MATCHING') {
    return <TeacherMatchingAssignmentEditorPage />
  }
  if (type === 'ORDERING') {
    return <TeacherOrderingAssignmentEditorPage />
  }
  if (
    type === 'CATEGORIZATION' ||
    type === 'FILL_BLANKS' ||
    type === 'IMAGE_HOTSPOT'
  ) {
    return <TeacherInteractiveAssignmentEditorPage type={type} />
  }
  if (type === 'MAP_POINT') {
    return <TeacherMapPointAssignmentEditorPage />
  }
  if (type === 'MAP_REGION') {
    return <TeacherMapRegionAssignmentEditorPage />
  }
  if (type === 'MAP_MULTI_REGION') {
    return <TeacherMapMultiRegionAssignmentEditorPage />
  }

  return <TeacherWrittenAssignmentEditorPage />
}

function TeacherWrittenAssignmentEditorPage() {
  const { assignmentId, assignmentType } = useParams()
  const isNew = !assignmentId
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [values, setValues] = useState<EditorValues>(emptyValues)
  const valuesRef = useRef(values)
  const [savedHash, setSavedHash] = useState(() => serializeValues(emptyValues))
  const [hasHydrated, setHasHydrated] = useState(isNew)
  const [showPreview, setShowPreview] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  )
  const [saveState, setSaveState] = useState<
    'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict'
  >('idle')

  useEffect(() => {
    valuesRef.current = values
  }, [values])

  const assignmentQuery = useQuery({
    queryKey: assignmentQueryKeys.detail(assignmentId ?? ''),
    queryFn: () => getAssignment(assignmentId ?? ''),
    enabled: Boolean(assignmentId),
  })

  useEffect(() => {
    if (!assignmentQuery.data || hasHydrated) {
      return
    }

    const hydrated = assignmentToEditorValues(assignmentQuery.data)
    // The remote assignment initializes the local editing buffer once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(hydrated)
    setSavedHash(serializeValues(hydrated))
    setSaveState('saved')
    setHasHydrated(true)
  }, [assignmentQuery.data, hasHydrated])

  const currentHash = serializeValues(values)
  const isDirty = currentHash !== savedHash
  const displayedSaveState =
    isDirty && (saveState === 'idle' || saveState === 'saved')
      ? 'dirty'
      : saveState
  const validation = useMemo(() => validateValues(values, t), [t, values])
  const isArchived = assignmentQuery.data?.status === 'ARCHIVED'
  const isUnsupportedType = isNew
    ? assignmentType?.toLowerCase() !== 'written'
    : assignmentQuery.data?.type !== 'WRITTEN'
  const hasMeaningfulContent = Boolean(
    values.title.trim() || values.prompt.trim() || values.instructions.trim(),
  )

  const saveMutation = useMutation({
    mutationFn: async (snapshot: EditorValues): Promise<SaveResult> => {
      if (!assignmentId) {
        const assignment = await createAssignment({
          type: 'WRITTEN',
          defaultMaxPoints: Number(snapshot.defaultMaxPoints),
          defaultPassingPercent: Number(snapshot.defaultPassingPercent),
          draft: editorValuesToDraft(snapshot),
        })
        return { assignment, savedValues: snapshot, wasCreated: true }
      }

      let assignment = assignmentQuery.data
      if (!assignment) {
        assignment = await getAssignment(assignmentId)
      }
      let draft = assignment.draftRevision
      if (!draft) {
        assignment = await startAssignmentEdit(assignmentId)
        draft = assignment.draftRevision
      }
      if (!draft) {
        throw new Error('Assignment draft was not created.')
      }

      const updated = await updateAssignmentDraft(assignmentId, {
        ...editorValuesToDraft(snapshot),
        defaultMaxPoints: Number(snapshot.defaultMaxPoints),
        defaultPassingPercent: Number(snapshot.defaultPassingPercent),
        expectedRevisionId: draft.id,
        expectedEditVersion: draft.editVersion,
      })
      return { assignment: updated, savedValues: snapshot, wasCreated: false }
    },
    onMutate: () => setSaveState('saving'),
    onSuccess: ({ assignment, savedValues, wasCreated }) => {
      const snapshotHash = serializeValues(savedValues)
      const hasNewerChanges =
        serializeValues(valuesRef.current) !== snapshotHash
      setSavedHash(snapshotHash)
      setSaveState(hasNewerChanges ? 'dirty' : 'saved')
      setHasHydrated(true)
      queryClient.setQueryData(
        assignmentQueryKeys.detail(assignment.id),
        assignment,
      )
      void queryClient.invalidateQueries({
        queryKey: assignmentQueryKeys.lists,
      })
      if (wasCreated) {
        navigate(`/app/teacher/tasks/${assignment.id}/edit`, { replace: true })
      }
    },
    onError: (error) => {
      setSaveState(
        error instanceof ApiError &&
          error.code === 'ASSIGNMENT_DRAFT_VERSION_CONFLICT'
          ? 'conflict'
          : 'error',
      )
    },
  })

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
    if (!shouldWarn) {
      return
    }
    return registerWorkspaceNavigationGuard((target) => {
      setPendingNavigation(target)
      setShowDiscardDialog(true)
    })
  }, [shouldWarn])

  const requestLeave = (target = '/app/teacher/tasks') => {
    if (shouldWarn) {
      setPendingNavigation(target)
      setShowDiscardDialog(true)
      return
    }
    navigate(target)
  }

  const save = () => {
    if (
      validation.length > 0 ||
      !hasMeaningfulContent ||
      saveMutation.isPending ||
      isArchived
    ) {
      return
    }
    saveMutation.mutate(values)
  }

  const reloadAfterConflict = async () => {
    if (!assignmentId) {
      return
    }
    const fresh = await queryClient.fetchQuery({
      queryKey: assignmentQueryKeys.detail(assignmentId),
      queryFn: () => getAssignment(assignmentId),
    })
    const hydrated = assignmentToEditorValues(fresh)
    setValues(hydrated)
    setSavedHash(serializeValues(hydrated))
    setSaveState('saved')
    saveMutation.reset()
  }

  if (isNew && isUnsupportedType) {
    return (
      <EditorStatus
        action={t('assignments.common.back')}
        message={t('assignments.editor.unsupportedDescription')}
        onAction={() => navigate('/app/teacher/tasks')}
        title={t('assignments.editor.unsupportedTitle')}
      />
    )
  }

  if (!isNew && (assignmentQuery.isLoading || !hasHydrated)) {
    return <EditorStatus message={t('assignments.editor.loading')} />
  }

  if (!isNew && (assignmentQuery.isError || !assignmentQuery.data)) {
    return (
      <EditorStatus
        action={t('assignments.common.retry')}
        message={t('assignments.editor.loadError')}
        onAction={() => void assignmentQuery.refetch()}
      />
    )
  }

  if (!isNew && isUnsupportedType) {
    return (
      <EditorStatus
        action={t('assignments.common.back')}
        message={t('assignments.editor.unsupportedDescription')}
        onAction={() => navigate('/app/teacher/tasks')}
        title={t('assignments.editor.unsupportedTitle')}
      />
    )
  }

  const previewDraft = editorValuesToDraft(values)

  return (
    <section className={styles.page} aria-labelledby="assignment-editor-title">
      <div className={styles.content}>
        <header className={styles.editorHeader}>
          <button
            aria-label={t('assignments.common.back')}
            className={styles.iconButton}
            onClick={() => requestLeave()}
            type="button"
          >
            <ArrowLeft size={19} aria-hidden="true" />
          </button>
          <div className={styles.editorHeading}>
            <h1 id="assignment-editor-title">
              {isNew
                ? t('assignments.editor.createTitle')
                : values.title.trim() || t('assignments.common.untitled')}
            </h1>
          </div>
          <div className={styles.editorHeaderActions}>
            <button
              className={styles.secondaryButton}
              onClick={() => setShowPreview(true)}
              type="button"
            >
              <Eye size={17} aria-hidden="true" />
              {t('assignments.editor.preview')}
            </button>
            <button
              className={styles.primaryButton}
              disabled={
                validation.length > 0 ||
                !hasMeaningfulContent ||
                saveMutation.isPending ||
                !isDirty ||
                isArchived
              }
              onClick={save}
              type="button"
            >
              <Save size={17} aria-hidden="true" />
              {saveMutation.isPending
                ? t('assignments.editor.saving')
                : t('assignments.editor.save')}
            </button>
          </div>
        </header>

        {isArchived && (
          <div className={styles.notice} role="status">
            <AlertTriangle size={18} aria-hidden="true" />
            <div>
              <strong>{t('assignments.editor.archivedTitle')}</strong>
              <p>{t('assignments.editor.archivedDescription')}</p>
            </div>
          </div>
        )}

        {saveState === 'conflict' && (
          <div className={styles.notice} role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <div>
              <strong>{t('assignments.editor.conflictTitle')}</strong>
              <p>{t('assignments.editor.conflictDescription')}</p>
              <button
                className={styles.secondaryButton}
                onClick={() => void reloadAfterConflict()}
                type="button"
              >
                {t('assignments.editor.reload')}
              </button>
            </div>
          </div>
        )}

        {saveState === 'error' && (
          <p className={styles.errorStatus} role="alert">
            {getSaveError(saveMutation.error, t)}
          </p>
        )}

        <div className={styles.editorLayout}>
          <main className={styles.editorMain}>
            <section className={styles.editorSection}>
              <div className={styles.sectionHeading}>
                <span aria-hidden="true">01</span>
                <div>
                  <h2>{t('assignments.editor.content.title')}</h2>
                  <p>{t('assignments.editor.content.description')}</p>
                </div>
              </div>
              <label className={styles.field}>
                <span>{t('assignments.editor.fields.title')}</span>
                <input
                  aria-label={t('assignments.editor.fields.title')}
                  disabled={isArchived}
                  maxLength={160}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder={t('assignments.editor.fields.titlePlaceholder')}
                  value={values.title}
                />
                <small>{values.title.length}/160</small>
              </label>
              <label className={styles.field}>
                <span>{t('assignments.editor.fields.prompt')}</span>
                <textarea
                  aria-label={t('assignments.editor.fields.prompt')}
                  disabled={isArchived}
                  maxLength={50_000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      prompt: event.target.value,
                    }))
                  }
                  placeholder={t('assignments.editor.fields.promptPlaceholder')}
                  rows={7}
                  value={values.prompt}
                />
              </label>
              <label className={styles.field}>
                <span>{t('assignments.editor.fields.instructions')}</span>
                <textarea
                  aria-label={t('assignments.editor.fields.instructions')}
                  disabled={isArchived}
                  maxLength={50_000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      instructions: event.target.value,
                    }))
                  }
                  placeholder={t(
                    'assignments.editor.fields.instructionsPlaceholder',
                  )}
                  rows={4}
                  value={values.instructions}
                />
                <small>{t('assignments.editor.optional')}</small>
              </label>
              <TeacherPromptImageField
                assignmentId={assignmentId}
                onChange={(promptImage) =>
                  setValues((current) => ({
                    ...current,
                    publicConfig: { ...current.publicConfig, promptImage },
                  }))
                }
                promptImage={values.publicConfig.promptImage ?? null}
                revision={assignmentQuery.data?.draftRevision}
              />
            </section>

            <section className={styles.editorSection}>
              <div className={styles.sectionHeading}>
                <span aria-hidden="true">02</span>
                <div>
                  <h2>{t('assignments.editor.answer.title')}</h2>
                  <p>{t('assignments.editor.answer.description')}</p>
                </div>
              </div>
              <fieldset className={styles.segmentedField} disabled={isArchived}>
                <legend>{t('assignments.editor.answer.mode')}</legend>
                <div>
                  {(['SHORT', 'LONG'] as const).map((mode) => (
                    <label key={mode}>
                      <input
                        checked={values.publicConfig.responseMode === mode}
                        name="response-mode"
                        onChange={() =>
                          setValues((current) => ({
                            ...current,
                            publicConfig: {
                              ...current.publicConfig,
                              responseMode: mode,
                            },
                          }))
                        }
                        type="radio"
                      />
                      <span>{t(`assignments.editor.answer.${mode}`)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className={styles.inlineHint}>
                {t('assignments.editor.answer.fixedLimit', {
                  count: WRITTEN_MAX_LENGTH,
                })}
              </p>
            </section>

            <section className={styles.editorSection}>
              <div className={styles.sectionHeadingWithAction}>
                <div className={styles.sectionHeading}>
                  <span aria-hidden="true">03</span>
                  <div>
                    <h2>{t('assignments.editor.criteria.title')}</h2>
                    <p>{t('assignments.editor.criteria.description')}</p>
                  </div>
                </div>
                <button
                  className={styles.secondaryButton}
                  disabled={
                    isArchived || values.publicConfig.rubric.length >= 50
                  }
                  onClick={() =>
                    setValues((current) => ({
                      ...current,
                      publicConfig: {
                        ...current.publicConfig,
                        rubric: [
                          ...current.publicConfig.rubric,
                          createRubricItem(),
                        ],
                      },
                    }))
                  }
                  type="button"
                >
                  <Plus size={16} aria-hidden="true" />
                  {t('assignments.editor.criteria.add')}
                </button>
              </div>
              {values.publicConfig.rubric.length === 0 ? (
                <div className={styles.criteriaEmpty}>
                  <ListChecks size={24} aria-hidden="true" />
                  <p>{t('assignments.editor.criteria.empty')}</p>
                </div>
              ) : (
                <div className={styles.criteriaList}>
                  {values.publicConfig.rubric.map((item, index) => (
                    <RubricEditor
                      disabled={Boolean(isArchived)}
                      index={index}
                      item={item}
                      key={item.id}
                      onChange={(nextItem) =>
                        updateRubric(setValues, index, nextItem)
                      }
                      onRemove={() => removeRubric(setValues, index)}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className={styles.editorSection}>
              <div className={styles.sectionHeading}>
                <span aria-hidden="true">04</span>
                <div>
                  <h2>{t('assignments.editor.feedback.title')}</h2>
                  <p>{t('assignments.editor.feedback.description')}</p>
                </div>
              </div>
              <label className={styles.field}>
                <span>{t('assignments.editor.feedback.label')}</span>
                <textarea
                  aria-label={t('assignments.editor.feedback.label')}
                  disabled={isArchived}
                  maxLength={50_000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      explanation: event.target.value,
                    }))
                  }
                  placeholder={t('assignments.editor.feedback.placeholder')}
                  rows={4}
                  value={values.explanation}
                />
                <small>{t('assignments.editor.optional')}</small>
              </label>
            </section>
          </main>

          <aside className={styles.editorAside}>
            <section className={styles.settingsCard}>
              <h2>{t('assignments.editor.settings.title')}</h2>
              <label className={styles.field}>
                <span>{t('assignments.editor.settings.points')}</span>
                <input
                  disabled={isArchived}
                  inputMode="decimal"
                  max="999999.99"
                  min="0.01"
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      defaultMaxPoints: event.target.value,
                    }))
                  }
                  step="0.01"
                  type="number"
                  value={values.defaultMaxPoints}
                />
              </label>
              <label className={styles.field}>
                <span>{t('assignments.editor.settings.passingPercent')}</span>
                <div className={styles.suffixInput}>
                  <input
                    aria-label={t('assignments.editor.settings.passingPercent')}
                    disabled={isArchived}
                    inputMode="decimal"
                    max="100"
                    min="0"
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        defaultPassingPercent: event.target.value,
                      }))
                    }
                    step="0.01"
                    type="number"
                    value={values.defaultPassingPercent}
                  />
                  <span>%</span>
                </div>
              </label>
              <div className={styles.saveSummary} aria-live="polite">
                <span
                  className={
                    styles[`saveState${capitalize(displayedSaveState)}`]
                  }
                />
                <p>{t(`assignments.editor.saveState.${displayedSaveState}`)}</p>
              </div>
              {validation.length > 0 && (
                <ul className={styles.validationList}>
                  {validation.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
              <button
                className={styles.previewButton}
                onClick={() => setShowPreview(true)}
                type="button"
              >
                <Eye size={17} aria-hidden="true" />
                {t('assignments.editor.preview')}
              </button>
              <button
                className={styles.primaryButton}
                disabled={
                  validation.length > 0 ||
                  !hasMeaningfulContent ||
                  saveMutation.isPending ||
                  !isDirty ||
                  isArchived
                }
                onClick={save}
                type="button"
              >
                <Save size={17} aria-hidden="true" />
                {saveMutation.isPending
                  ? t('assignments.editor.saving')
                  : t('assignments.editor.save')}
              </button>
            </section>
          </aside>
        </div>
      </div>

      {showPreview && (
        <WrittenAssignmentPreview
          defaultMaxPoints={Number(values.defaultMaxPoints) || 0}
          draft={previewDraft}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showDiscardDialog && (
        <AssignmentConfirmDialog
          cancelLabel={t('assignments.editor.discard.cancel')}
          confirmLabel={t('assignments.editor.discard.confirm')}
          description={t('assignments.editor.discard.description')}
          isDangerous
          isPending={saveMutation.isPending}
          onCancel={() => {
            setPendingNavigation(null)
            setShowDiscardDialog(false)
          }}
          onConfirm={() => {
            const target = pendingNavigation ?? '/app/teacher/tasks'
            setSavedHash(serializeValues(valuesRef.current))
            setShowDiscardDialog(false)
            setPendingNavigation(null)
            navigate(target)
          }}
          title={t('assignments.editor.discard.title')}
        />
      )}
    </section>
  )
}

function RubricEditor({
  disabled,
  index,
  item,
  onChange,
  onRemove,
  t,
}: {
  disabled: boolean
  index: number
  item: AssignmentRubricItem
  onChange: (item: AssignmentRubricItem) => void
  onRemove: () => void
  t: (key: string, values?: Record<string, unknown>) => string
}) {
  return (
    <article className={styles.criteriaRow}>
      <span className={styles.criteriaNumber}>{index + 1}</span>
      <div className={styles.criteriaFields}>
        <label className={styles.field}>
          <span>{t('assignments.editor.criteria.name')}</span>
          <input
            disabled={disabled}
            maxLength={160}
            onChange={(event) =>
              onChange({ ...item, title: event.target.value })
            }
            placeholder={t('assignments.editor.criteria.namePlaceholder')}
            value={item.title}
          />
        </label>
        <label className={styles.field}>
          <span>{t('assignments.editor.criteria.details')}</span>
          <textarea
            disabled={disabled}
            maxLength={2_000}
            onChange={(event) =>
              onChange({ ...item, description: event.target.value })
            }
            placeholder={t('assignments.editor.criteria.detailsPlaceholder')}
            rows={2}
            value={item.description}
          />
        </label>
      </div>
      <label className={`${styles.field} ${styles.weightField}`}>
        <span>{t('assignments.editor.criteria.weight')}</span>
        <input
          disabled={disabled}
          inputMode="decimal"
          min="0.01"
          onChange={(event) =>
            onChange({ ...item, weight: Number(event.target.value) })
          }
          step="0.01"
          type="number"
          value={item.weight}
        />
      </label>
      <button
        aria-label={t('assignments.editor.criteria.removeNamed', {
          index: index + 1,
        })}
        className={`${styles.iconButton} ${styles.dangerIconButton}`}
        disabled={disabled}
        onClick={onRemove}
        type="button"
      >
        <Trash2 size={17} aria-hidden="true" />
      </button>
    </article>
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
      <div className={`${styles.content} ${styles.statusPanel}`}>
        {title && <h1>{title}</h1>}
        <p>{message}</p>
        {action && onAction && (
          <button
            className={styles.secondaryButton}
            onClick={onAction}
            type="button"
          >
            {action}
          </button>
        )}
      </div>
    </section>
  )
}

function assignmentToEditorValues(assignment: AssignmentEditor): EditorValues {
  const revision = assignment.draftRevision ?? assignment.publishedRevision
  const config = toWrittenConfig(revision)
  return {
    defaultMaxPoints: String(assignment.defaultMaxPoints),
    defaultPassingPercent: String(assignment.defaultPassingPercent),
    explanation: revision?.explanation ?? '',
    instructions: revision?.instructions ?? '',
    prompt: revision?.prompt ?? '',
    publicConfig: config,
    title: revision?.title ?? '',
  }
}

function toWrittenConfig(
  revision: AssignmentEditorRevision | null | undefined,
): WrittenPublicConfig {
  const config = revision?.publicConfig
  const rubric = Array.isArray(config?.rubric)
    ? config.rubric.filter(isRubricItem).map((item) => ({ ...item }))
    : []
  return {
    responseMode: config?.responseMode === 'SHORT' ? 'SHORT' : 'LONG',
    minLength: 0,
    maxLength: WRITTEN_MAX_LENGTH,
    allowAttachments: false,
    rubric,
  }
}

function isRubricItem(value: unknown): value is AssignmentRubricItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'title' in value &&
    typeof value.title === 'string' &&
    'description' in value &&
    typeof value.description === 'string' &&
    'weight' in value &&
    typeof value.weight === 'number'
  )
}

function editorValuesToDraft(
  values: EditorValues,
): WrittenAssignmentDraftInput {
  return {
    title: values.title,
    prompt: values.prompt,
    instructions: values.instructions.trim() ? values.instructions : null,
    explanation: values.explanation.trim() ? values.explanation : null,
    publicConfig: {
      ...values.publicConfig,
      minLength: 0,
      maxLength: WRITTEN_MAX_LENGTH,
      allowAttachments: false,
    },
    gradingConfig: { mode: 'MANUAL' },
  }
}

function createRubricItem(): AssignmentRubricItem {
  return {
    id: crypto.randomUUID(),
    title: '',
    description: '',
    weight: 1,
  }
}

function updateRubric(
  setValues: React.Dispatch<React.SetStateAction<EditorValues>>,
  index: number,
  item: AssignmentRubricItem,
) {
  setValues((current) => ({
    ...current,
    publicConfig: {
      ...current.publicConfig,
      rubric: current.publicConfig.rubric.map((currentItem, currentIndex) =>
        currentIndex === index ? item : currentItem,
      ),
    },
  }))
}

function removeRubric(
  setValues: React.Dispatch<React.SetStateAction<EditorValues>>,
  index: number,
) {
  setValues((current) => ({
    ...current,
    publicConfig: {
      ...current.publicConfig,
      rubric: current.publicConfig.rubric.filter(
        (_item, currentIndex) => currentIndex !== index,
      ),
    },
  }))
}

function validateValues(
  values: EditorValues,
  t: (key: string) => string,
): string[] {
  const issues: string[] = []
  const maxPoints = Number(values.defaultMaxPoints)
  const passingPercent = Number(values.defaultPassingPercent)
  if (
    !Number.isFinite(maxPoints) ||
    maxPoints < 0.01 ||
    maxPoints > 999_999.99
  ) {
    issues.push(t('assignments.editor.validation.points'))
  }
  if (
    !Number.isFinite(passingPercent) ||
    passingPercent < 0 ||
    passingPercent > 100
  ) {
    issues.push(t('assignments.editor.validation.passingPercent'))
  }
  if (values.publicConfig.rubric.some((item) => item.weight <= 0)) {
    issues.push(t('assignments.editor.validation.weight'))
  }
  return issues
}

function serializeValues(values: EditorValues): string {
  return JSON.stringify(values)
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function getSaveError(error: Error | null, t: (key: string) => string): string {
  if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
    return t('assignments.errors.network')
  }
  if (error instanceof ApiError && error.code === 'ASSIGNMENT_ARCHIVED') {
    return t('assignments.errors.archived')
  }
  return t('assignments.errors.save')
}
