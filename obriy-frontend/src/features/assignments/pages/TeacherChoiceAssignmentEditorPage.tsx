import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  CircleDot,
  Eye,
  GripVertical,
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
import { AssignmentDialog } from '../components/AssignmentDialog'
import { TeacherPromptImageField } from '../components/TeacherPromptImageField'
import { assignmentQueryKeys } from '../model/assignment-query-keys'
import type {
  AssignmentEditor,
  AssignmentPromptImage,
  AssignmentType,
  ChoiceGradingConfig,
  ChoiceOption,
  ChoicePublicConfig,
} from '../model/assignment.types'
import styles from '../Assignments.module.css'

interface ChoiceEditorValues {
  defaultMaxPoints: string
  defaultPassingPercent: string
  explanation: string
  instructions: string
  options: ChoiceOption[]
  promptImage: AssignmentPromptImage | null
  prompt: string
  scoringMode: ChoiceGradingConfig['scoringMode']
  selectedCorrectIds: string[]
  shuffleOptions: boolean
  title: string
}

interface SaveResult {
  assignment: AssignmentEditor
  savedValues: ChoiceEditorValues
  wasCreated: boolean
}

export function TeacherChoiceAssignmentEditorPage() {
  const { assignmentId, assignmentType } = useParams()
  const isNew = !assignmentId
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [values, setValues] = useState(createInitialValues)
  const valuesRef = useRef(values)
  const [savedHash, setSavedHash] = useState(() => serializeValues(values))
  const [hasHydrated, setHasHydrated] = useState(isNew)
  const [showPreview, setShowPreview] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
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
  const type = resolveChoiceType(assignmentType, assignmentQuery.data?.type)

  useEffect(() => {
    if (!assignmentQuery.data || hasHydrated) {
      return
    }
    const hydrated = assignmentToValues(assignmentQuery.data)
    // The server draft initializes this local explicit-save buffer once.
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
  const readiness = useMemo(
    () => validateReadiness(values, type, t),
    [t, type, values],
  )
  const isArchived = assignmentQuery.data?.status === 'ARCHIVED'
  const hasMeaningfulContent = Boolean(
    values.title.trim() ||
      values.prompt.trim() ||
      values.options.some((option) => option.text.trim()),
  )

  const saveMutation = useMutation({
    mutationFn: async (snapshot: ChoiceEditorValues): Promise<SaveResult> => {
      if (!type) {
        throw new Error('Unsupported assignment type')
      }
      const draft = valuesToDraft(snapshot, type)
      if (!assignmentId) {
        const assignment = await createAssignment({
          type,
          defaultMaxPoints: Number(snapshot.defaultMaxPoints),
          defaultPassingPercent: Number(snapshot.defaultPassingPercent),
          draft,
        })
        return { assignment, savedValues: snapshot, wasCreated: true }
      }

      let assignment = assignmentQuery.data ?? (await getAssignment(assignmentId))
      let revision = assignment.draftRevision
      if (!revision) {
        assignment = await startAssignmentEdit(assignmentId)
        revision = assignment.draftRevision
      }
      if (!revision) {
        throw new Error('Assignment draft was not created')
      }
      const updated = await updateAssignmentDraft(assignmentId, {
        ...draft,
        expectedRevisionId: revision.id,
        expectedEditVersion: revision.editVersion,
        defaultMaxPoints: Number(snapshot.defaultMaxPoints),
        defaultPassingPercent: Number(snapshot.defaultPassingPercent),
      })
      return { assignment: updated, savedValues: snapshot, wasCreated: false }
    },
    onMutate: () => setSaveState('saving'),
    onSuccess: ({ assignment, savedValues, wasCreated }) => {
      const snapshotHash = serializeValues(savedValues)
      const hasNewerChanges = serializeValues(valuesRef.current) !== snapshotHash
      setSavedHash(snapshotHash)
      setSaveState(hasNewerChanges ? 'dirty' : 'saved')
      setHasHydrated(true)
      queryClient.setQueryData(assignmentQueryKeys.detail(assignment.id), assignment)
      void queryClient.invalidateQueries({ queryKey: assignmentQueryKeys.lists })
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
    if (!shouldWarn) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [shouldWarn])
  useEffect(() => {
    if (!shouldWarn) return
    return registerWorkspaceNavigationGuard((target) => {
      setPendingNavigation(target)
      setShowDiscardDialog(true)
    })
  }, [shouldWarn])

  if (assignmentQuery.isLoading && assignmentId) {
    return <EditorStatus message={t('assignments.editor.loading')} />
  }
  if (assignmentQuery.isError) {
    return (
      <EditorStatus
        action={t('assignments.common.retry')}
        message={t('assignments.editor.loadError')}
        onAction={() => void assignmentQuery.refetch()}
      />
    )
  }
  if (!type) {
    return (
      <EditorStatus
        action={t('assignments.common.back')}
        message={t('assignments.editor.unsupportedDescription')}
        onAction={() => navigate('/app/teacher/tasks')}
        title={t('assignments.editor.unsupportedTitle')}
      />
    )
  }

  const TypeIcon = type === 'SINGLE_CHOICE' ? CircleDot : ListChecks
  const disabled = isArchived || saveMutation.isPending
  const save = () => {
    if (
      validation.length > 0 ||
      !hasMeaningfulContent ||
      disabled ||
      !isDirty
    ) {
      return
    }
    saveMutation.mutate(values)
  }

  return (
    <section className={styles.page}>
      <div className={styles.content}>
        <header className={styles.editorHeader}>
          <button
            aria-label={t('assignments.common.back')}
            className={`${styles.iconButton} ${styles.editorBackButton}`}
            onClick={() => {
              if (shouldWarn) {
                setPendingNavigation('/app/teacher/tasks')
                setShowDiscardDialog(true)
              } else {
                navigate('/app/teacher/tasks')
              }
            }}
            type="button"
          >
            <ArrowLeft size={18} />
          </button>
          <div className={styles.editorHeading}>
            <h1>
              {values.title.trim() ||
                t('assignments.editor.choice.createTitle', {
                  type: t(`assignments.types.${type}.title`),
                })}
            </h1>
            <p>{t('assignments.editor.choice.description')}</p>
          </div>
          <div className={styles.editorHeaderActions}>
            <button
              className={styles.secondaryButton}
              onClick={() => setShowPreview(true)}
              type="button"
            >
              <Eye size={16} />
              {t('assignments.editor.preview')}
            </button>
            <button
              className={styles.primaryButton}
              disabled={
                disabled ||
                validation.length > 0 ||
                !hasMeaningfulContent ||
                !isDirty
              }
              onClick={save}
              type="button"
            >
              <Save size={16} />
              {saveMutation.isPending
                ? t('assignments.editor.saving')
                : t('assignments.editor.save')}
            </button>
          </div>
        </header>

        {isArchived && (
          <div className={styles.notice}>
            <AlertTriangle size={18} />
            <div>
              <strong>{t('assignments.editor.archivedTitle')}</strong>
              <p>{t('assignments.editor.archivedDescription')}</p>
            </div>
          </div>
        )}

        <div className={styles.editorLayout}>
          <main className={styles.editorMain}>
            <section className={styles.editorSection}>
              <div className={styles.sectionHeading}>
                <span>01</span>
                <div>
                  <h2>{t('assignments.editor.content.title')}</h2>
                  <p>{t('assignments.editor.content.description')}</p>
                </div>
              </div>
              <label className={styles.field}>
                <span>{t('assignments.editor.fields.title')}</span>
                <input
                  disabled={disabled}
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
              </label>
              <label className={styles.field}>
                <span>{t('assignments.editor.fields.prompt')}</span>
                <textarea
                  disabled={disabled}
                  maxLength={50_000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      prompt: event.target.value,
                    }))
                  }
                  placeholder={t('assignments.editor.fields.promptPlaceholder')}
                  rows={5}
                  value={values.prompt}
                />
              </label>
              <label className={styles.field}>
                <span>{t('assignments.editor.fields.instructions')}</span>
                <textarea
                  disabled={disabled}
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
                  rows={3}
                  value={values.instructions}
                />
              </label>
              <TeacherPromptImageField
                assignmentId={assignmentId}
                onChange={(promptImage) => setValues((current) => ({ ...current, promptImage }))}
                promptImage={values.promptImage}
                revision={assignmentQuery.data?.draftRevision}
              />
            </section>

            <section className={styles.editorSection}>
              <div className={styles.sectionHeadingWithAction}>
                <div className={styles.sectionHeading}>
                  <span>02</span>
                  <div>
                    <h2>{t('assignments.editor.choice.optionsTitle')}</h2>
                    <p>{t('assignments.editor.choice.optionsDescription')}</p>
                  </div>
                </div>
                <button
                  className={styles.secondaryButton}
                  disabled={disabled || values.options.length >= 50}
                  onClick={() =>
                    setValues((current) => ({
                      ...current,
                      options: [...current.options, createOption()],
                    }))
                  }
                  type="button"
                >
                  <Plus size={16} />
                  {t('assignments.editor.choice.addOption')}
                </button>
              </div>
              <div className={styles.choiceOptionList}>
                {values.options.map((option, index) => {
                  const checked = values.selectedCorrectIds.includes(option.id)
                  return (
                    <article className={styles.choiceOptionRow} key={option.id}>
                      <GripVertical size={17} aria-hidden="true" />
                      <label className={styles.choiceCorrectControl}>
                        <input
                          checked={checked}
                          disabled={disabled}
                          name={type === 'SINGLE_CHOICE' ? 'correct-option' : undefined}
                          onChange={() =>
                            setValues((current) => ({
                              ...current,
                              selectedCorrectIds:
                                type === 'SINGLE_CHOICE'
                                  ? [option.id]
                                  : checked
                                    ? current.selectedCorrectIds.filter(
                                        (id) => id !== option.id,
                                      )
                                    : [...current.selectedCorrectIds, option.id],
                            }))
                          }
                          type={type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                        />
                        <span className={styles.srOnly}>
                          {t('assignments.editor.choice.markCorrect', {
                            index: index + 1,
                          })}
                        </span>
                      </label>
                      <label className={styles.field}>
                        <span>
                          {t('assignments.editor.choice.optionLabel', {
                            index: index + 1,
                          })}
                        </span>
                        <textarea
                          disabled={disabled}
                          maxLength={5_000}
                          onChange={(event) =>
                            updateOption(setValues, option.id, event.target.value)
                          }
                          placeholder={t(
                            'assignments.editor.choice.optionPlaceholder',
                          )}
                          rows={2}
                          value={option.text}
                        />
                      </label>
                      <button
                        aria-label={t('assignments.editor.choice.removeOption', {
                          index: index + 1,
                        })}
                        className={`${styles.iconButton} ${styles.dangerIconButton}`}
                        disabled={disabled || values.options.length <= 2}
                        onClick={() => removeOption(setValues, option.id)}
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </article>
                  )
                })}
              </div>
              <label className={styles.toggleField}>
                <input
                  checked={values.shuffleOptions}
                  disabled={disabled}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      shuffleOptions: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                <span>
                  <strong>{t('assignments.editor.choice.shuffle')}</strong>
                  <small>{t('assignments.editor.choice.shuffleHint')}</small>
                </span>
              </label>
              {type === 'MULTIPLE_CHOICE' && (
                <fieldset className={styles.segmentedField}>
                  <legend>{t('assignments.editor.choice.scoringTitle')}</legend>
                  <div>
                    {(['ALL_OR_NOTHING', 'PARTIAL'] as const).map((mode) => (
                      <label key={mode}>
                        <input
                          checked={values.scoringMode === mode}
                          disabled={disabled}
                          onChange={() =>
                            setValues((current) => ({
                              ...current,
                              scoringMode: mode,
                            }))
                          }
                          type="radio"
                        />
                        <span>{t(`assignments.editor.choice.scoring.${mode}`)}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </section>

            <section className={styles.editorSection}>
              <div className={styles.sectionHeading}>
                <span>03</span>
                <div>
                  <h2>{t('assignments.editor.feedback.title')}</h2>
                  <p>{t('assignments.editor.feedback.description')}</p>
                </div>
              </div>
              <label className={styles.field}>
                <span>{t('assignments.editor.feedback.label')}</span>
                <textarea
                  disabled={disabled}
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
              </label>
            </section>
          </main>

          <aside className={styles.editorAside}>
            <section className={styles.settingsCard}>
              <h2>{t('assignments.editor.settings.title')}</h2>
              <label className={styles.field}>
                <span>{t('assignments.editor.settings.points')}</span>
                <input
                  disabled={disabled}
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
                    disabled={disabled}
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
                  className={styles[`saveState${capitalize(displayedSaveState)}`]}
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
              {readiness.length > 0 && (
                <div className={styles.choiceReadiness}>
                  <strong>{t('assignments.editor.choice.beforeUse')}</strong>
                  <ul>
                    {readiness.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                className={styles.primaryButton}
                disabled={
                  disabled ||
                  validation.length > 0 ||
                  !hasMeaningfulContent ||
                  !isDirty
                }
                onClick={save}
                type="button"
              >
                <Save size={16} />
                {saveMutation.isPending
                  ? t('assignments.editor.saving')
                  : t('assignments.editor.save')}
              </button>
              {saveMutation.isError && saveState !== 'conflict' && (
                <p className={styles.inlineError} role="alert">
                  {t('assignments.errors.save')}
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>

      {showPreview && (
        <AssignmentDialog
          closeLabel={t('assignments.common.close')}
          description={t('assignments.preview.description')}
          fullScreen
          onClose={() => setShowPreview(false)}
          title={t('assignments.preview.title')}
        >
          <div className={styles.previewViewport}>
            <article className={styles.studentPreview}>
              <div className={styles.studentPreviewHeader}>
                <span className={styles.previewTypeIcon}>
                  <TypeIcon size={21} />
                </span>
                <div>
                  <p>{t(`assignments.types.${type}.title`)}</p>
                  <span>
                    {t('assignments.preview.points', {
                      count: Number(values.defaultMaxPoints) || 0,
                    })}
                  </span>
                </div>
              </div>
              <h1>{values.title || t('assignments.common.untitled')}</h1>
              <p className={styles.previewPrompt}>
                {values.prompt || t('assignments.preview.emptyPrompt')}
              </p>
              <div className={styles.choicePreviewOptions}>
                {values.options.map((option) => (
                  <label key={option.id}>
                    <input
                      name="choice-preview"
                      type={type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                    />
                    <span>{option.text || t('assignments.editor.choice.emptyOption')}</span>
                  </label>
                ))}
              </div>
            </article>
          </div>
        </AssignmentDialog>
      )}

      {saveState === 'conflict' && (
        <AssignmentConfirmDialog
          cancelLabel={t('assignments.common.cancel')}
          confirmLabel={t('assignments.editor.reload')}
          description={t('assignments.editor.conflictDescription')}
          onCancel={() => setSaveState('dirty')}
          onConfirm={() => window.location.reload()}
          title={t('assignments.editor.conflictTitle')}
        />
      )}
      {showDiscardDialog && (
        <AssignmentConfirmDialog
          cancelLabel={t('assignments.editor.discard.cancel')}
          confirmLabel={t('assignments.editor.discard.confirm')}
          description={t('assignments.editor.discard.description')}
          isDangerous
          onCancel={() => {
            setPendingNavigation(null)
            setShowDiscardDialog(false)
          }}
          onConfirm={() => navigate(pendingNavigation ?? '/app/teacher/tasks')}
          title={t('assignments.editor.discard.title')}
        />
      )}
    </section>
  )
}

function createInitialValues(): ChoiceEditorValues {
  return {
    defaultMaxPoints: '1',
    defaultPassingPercent: '100',
    explanation: '',
    instructions: '',
    options: [createOption(), createOption()],
    promptImage: null,
    prompt: '',
    scoringMode: 'ALL_OR_NOTHING',
    selectedCorrectIds: [],
    shuffleOptions: false,
    title: '',
  }
}

function createOption(): ChoiceOption {
  return { id: crypto.randomUUID(), text: '' }
}

function resolveChoiceType(
  routeType: string | undefined,
  storedType: AssignmentType | undefined,
): 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | null {
  const type = storedType ?? routeType?.toUpperCase()
  return type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE' ? type : null
}

function assignmentToValues(assignment: AssignmentEditor): ChoiceEditorValues {
  const revision = assignment.draftRevision ?? assignment.publishedRevision
  const publicConfig = toChoicePublicConfig(revision?.publicConfig)
  const gradingConfig = toChoiceGradingConfig(revision?.gradingConfig)
  return {
    defaultMaxPoints: String(assignment.defaultMaxPoints),
    defaultPassingPercent: String(assignment.defaultPassingPercent),
    explanation: revision?.explanation ?? '',
    instructions: revision?.instructions ?? '',
    options:
      publicConfig.options.length >= 2
        ? publicConfig.options
        : [...publicConfig.options, ...Array.from({ length: 2 - publicConfig.options.length }, createOption)],
    promptImage: publicConfig.promptImage ?? null,
    prompt: revision?.prompt ?? '',
    scoringMode: gradingConfig.scoringMode,
    selectedCorrectIds: gradingConfig.correctOptionIds,
    shuffleOptions: publicConfig.shuffleOptions,
    title: revision?.title ?? '',
  }
}

function toChoicePublicConfig(value: Record<string, unknown> | undefined): ChoicePublicConfig {
  const options = Array.isArray(value?.options)
    ? value.options.filter(isChoiceOption).map((option) => ({ ...option }))
    : []
  return {
    options,
    promptImage: toPromptImage(value?.promptImage),
    shuffleOptions: value?.shuffleOptions === true,
  }
}

function toChoiceGradingConfig(
  value: Record<string, unknown> | null | undefined,
): ChoiceGradingConfig {
  return {
    correctOptionIds: Array.isArray(value?.correctOptionIds)
      ? value.correctOptionIds.filter((id): id is string => typeof id === 'string')
      : [],
    scoringMode: value?.scoringMode === 'PARTIAL' ? 'PARTIAL' : 'ALL_OR_NOTHING',
  }
}

function isChoiceOption(value: unknown): value is ChoiceOption {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'text' in value &&
    typeof value.text === 'string'
  )
}

function valuesToDraft(
  values: ChoiceEditorValues,
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE',
) {
  return {
    title: values.title,
    prompt: values.prompt,
    instructions: values.instructions.trim() ? values.instructions : null,
    explanation: values.explanation.trim() ? values.explanation : null,
    publicConfig: {
      options: values.options,
      shuffleOptions: values.shuffleOptions,
      promptImage: values.promptImage,
    },
    gradingConfig: {
      correctOptionIds: values.selectedCorrectIds,
      scoringMode:
        type === 'SINGLE_CHOICE' ? 'ALL_OR_NOTHING' : values.scoringMode,
    } as ChoiceGradingConfig,
  }
}

function toPromptImage(value: unknown): AssignmentPromptImage | null {
  if (typeof value !== 'object' || value === null || !('attachmentId' in value) || !('width' in value) || !('height' in value)) return null
  return typeof value.attachmentId === 'string' && typeof value.width === 'number' && typeof value.height === 'number'
    ? { attachmentId: value.attachmentId, width: value.width, height: value.height }
    : null
}

function updateOption(
  setValues: React.Dispatch<React.SetStateAction<ChoiceEditorValues>>,
  optionId: string,
  text: string,
) {
  setValues((current) => ({
    ...current,
    options: current.options.map((option) =>
      option.id === optionId ? { ...option, text } : option,
    ),
  }))
}

function removeOption(
  setValues: React.Dispatch<React.SetStateAction<ChoiceEditorValues>>,
  optionId: string,
) {
  setValues((current) => ({
    ...current,
    options: current.options.filter((option) => option.id !== optionId),
    selectedCorrectIds: current.selectedCorrectIds.filter(
      (id) => id !== optionId,
    ),
  }))
}

function validateValues(
  values: ChoiceEditorValues,
  t: (key: string) => string,
): string[] {
  const issues: string[] = []
  const points = Number(values.defaultMaxPoints)
  const passing = Number(values.defaultPassingPercent)
  if (!Number.isFinite(points) || points < 0.01 || points > 999_999.99) {
    issues.push(t('assignments.editor.validation.points'))
  }
  if (!Number.isFinite(passing) || passing < 0 || passing > 100) {
    issues.push(t('assignments.editor.validation.passingPercent'))
  }
  return issues
}

function validateReadiness(
  values: ChoiceEditorValues,
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | null,
  t: (key: string) => string,
): string[] {
  const issues: string[] = []
  if (!values.title.trim()) issues.push(t('assignments.editor.choice.readyTitle'))
  if (!values.prompt.trim()) issues.push(t('assignments.editor.choice.readyPrompt'))
  if (values.options.some((option) => !option.text.trim())) {
    issues.push(t('assignments.editor.choice.readyOptions'))
  }
  if (
    (type === 'SINGLE_CHOICE' && values.selectedCorrectIds.length !== 1) ||
    (type === 'MULTIPLE_CHOICE' && values.selectedCorrectIds.length < 1)
  ) {
    issues.push(t('assignments.editor.choice.readyCorrect'))
  }
  return issues
}

function serializeValues(values: ChoiceEditorValues): string {
  return JSON.stringify(values)
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
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
          <button className={styles.secondaryButton} onClick={onAction} type="button">
            {action}
          </button>
        )}
      </div>
    </section>
  )
}
