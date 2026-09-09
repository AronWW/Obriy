import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Eye,
  GripVertical,
  ListOrdered,
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
  OrderingGradingConfig,
  OrderingItem,
  OrderingPublicConfig,
} from '../model/assignment.types'
import styles from '../Assignments.module.css'

interface OrderingEditorValues {
  defaultMaxPoints: string
  defaultPassingPercent: string
  explanation: string
  instructions: string
  items: OrderingItem[]
  promptImage: AssignmentPromptImage | null
  prompt: string
  scoringMode: OrderingGradingConfig['scoringMode']
  title: string
}

interface SaveResult {
  assignment: AssignmentEditor
  savedValues: OrderingEditorValues
  wasCreated: boolean
}

export function TeacherOrderingAssignmentEditorPage() {
  const { assignmentId, assignmentType } = useParams()
  const isNew = !assignmentId
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [values, setValues] = useState(createInitialValues)
  const valuesRef = useRef(values)
  const [savedHash, setSavedHash] = useState(() => serializeValues(values))
  const [hasHydrated, setHasHydrated] = useState(isNew)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
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
  const isOrdering = isNew
    ? assignmentType?.toUpperCase() === 'ORDERING'
    : assignmentQuery.data?.type === 'ORDERING'

  useEffect(() => {
    if (!assignmentQuery.data || hasHydrated) return
    const hydrated = assignmentToValues(assignmentQuery.data)
    // The server initializes this explicit-save buffer once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(hydrated)
    setSavedHash(serializeValues(hydrated))
    setSaveState('saved')
    setHasHydrated(true)
  }, [assignmentQuery.data, hasHydrated])

  const isDirty = serializeValues(values) !== savedHash
  const displayedSaveState =
    isDirty && (saveState === 'idle' || saveState === 'saved')
      ? 'dirty'
      : saveState
  const validation = useMemo(() => validateValues(values, t), [t, values])
  const readiness = useMemo(() => validateReadiness(values, t), [t, values])
  const isArchived = assignmentQuery.data?.status === 'ARCHIVED'
  const hasMeaningfulContent = Boolean(
    values.title.trim() ||
    values.prompt.trim() ||
    values.items.some((item) => item.text.trim()),
  )

  const saveMutation = useMutation({
    mutationFn: async (snapshot: OrderingEditorValues): Promise<SaveResult> => {
      const draft = valuesToDraft(snapshot)
      if (!assignmentId) {
        const assignment = await createAssignment({
          type: 'ORDERING',
          defaultMaxPoints: Number(snapshot.defaultMaxPoints),
          defaultPassingPercent: Number(snapshot.defaultPassingPercent),
          draft,
        })
        return { assignment, savedValues: snapshot, wasCreated: true }
      }

      let assignment =
        assignmentQuery.data ?? (await getAssignment(assignmentId))
      let revision = assignment.draftRevision
      if (!revision) {
        assignment = await startAssignmentEdit(assignmentId)
        revision = assignment.draftRevision
      }
      if (!revision) throw new Error('Assignment draft was not created')

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
  if (!isOrdering) {
    return (
      <EditorStatus
        action={t('assignments.common.back')}
        message={t('assignments.editor.unsupportedDescription')}
        onAction={() => navigate('/app/teacher/tasks')}
        title={t('assignments.editor.unsupportedTitle')}
      />
    )
  }

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

  const move = (fromIndex: number, toIndex: number) => {
    if (disabled || toIndex < 0 || toIndex >= values.items.length) return
    setValues((current) => ({
      ...current,
      items: moveArrayItem(current.items, fromIndex, toIndex),
    }))
  }

  const dropOn = (targetId: string) => {
    if (!draggedItemId || draggedItemId === targetId) return
    setValues((current) => {
      const fromIndex = current.items.findIndex(
        (item) => item.id === draggedItemId,
      )
      const toIndex = current.items.findIndex((item) => item.id === targetId)
      if (fromIndex < 0 || toIndex < 0) return current
      return {
        ...current,
        items: moveArrayItem(current.items, fromIndex, toIndex),
      }
    })
    setDraggedItemId(null)
  }

  return (
    <section className={styles.page}>
      <div className={styles.content}>
        <header className={styles.editorHeader}>
          <button
            aria-label={t('assignments.common.back')}
            className={styles.iconButton}
            onClick={() => {
              if (shouldWarn) {
                setPendingNavigation('/app/teacher/tasks')
                setShowDiscardDialog(true)
              } else navigate('/app/teacher/tasks')
            }}
            type="button"
          >
            <ArrowLeft size={18} />
          </button>
          <div className={styles.editorHeading}>
            <h1>
              {values.title.trim() ||
                t('assignments.editor.ordering.createTitle')}
            </h1>
            <p>{t('assignments.editor.ordering.description')}</p>
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
                    <h2>{t('assignments.editor.ordering.itemsTitle')}</h2>
                    <p>{t('assignments.editor.ordering.itemsDescription')}</p>
                  </div>
                </div>
                <button
                  className={styles.secondaryButton}
                  disabled={disabled || values.items.length >= 50}
                  onClick={() =>
                    setValues((current) => ({
                      ...current,
                      items: [...current.items, createItem()],
                    }))
                  }
                  type="button"
                >
                  <Plus size={16} />
                  {t('assignments.editor.ordering.addItem')}
                </button>
              </div>

              <div className={styles.orderingList}>
                {values.items.map((item, index) => (
                  <article
                    className={styles.orderingRow}
                    data-dragging={draggedItemId === item.id || undefined}
                    draggable={!disabled}
                    key={item.id}
                    onDragEnd={() => setDraggedItemId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDragStart={() => setDraggedItemId(item.id)}
                    onDrop={() => dropOn(item.id)}
                  >
                    <span className={styles.orderingGrip} aria-hidden="true">
                      <GripVertical size={17} />
                    </span>
                    <span className={styles.orderingNumber}>{index + 1}</span>
                    <label className={styles.field}>
                      <span>
                        {t('assignments.editor.ordering.itemLabel', {
                          index: index + 1,
                        })}
                      </span>
                      <textarea
                        disabled={disabled}
                        maxLength={5_000}
                        onChange={(event) =>
                          updateItem(setValues, item.id, event.target.value)
                        }
                        placeholder={t(
                          'assignments.editor.ordering.itemPlaceholder',
                        )}
                        rows={2}
                        value={item.text}
                      />
                    </label>
                    <div className={styles.orderingActions}>
                      <button
                        aria-label={t('assignments.editor.ordering.moveUp', {
                          index: index + 1,
                        })}
                        className={styles.iconButton}
                        disabled={disabled || index === 0}
                        onClick={() => move(index, index - 1)}
                        type="button"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        aria-label={t('assignments.editor.ordering.moveDown', {
                          index: index + 1,
                        })}
                        className={styles.iconButton}
                        disabled={disabled || index === values.items.length - 1}
                        onClick={() => move(index, index + 1)}
                        type="button"
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        aria-label={t(
                          'assignments.editor.ordering.removeItem',
                          {
                            index: index + 1,
                          },
                        )}
                        className={`${styles.iconButton} ${styles.dangerIconButton}`}
                        disabled={disabled || values.items.length <= 2}
                        onClick={() => removeItem(setValues, item.id)}
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className={styles.orderingShuffleNotice}>
                <ListOrdered size={18} />
                <div>
                  <strong>
                    {t('assignments.editor.ordering.shuffleTitle')}
                  </strong>
                  <p>{t('assignments.editor.ordering.shuffleDescription')}</p>
                </div>
              </div>

              <fieldset className={styles.segmentedField}>
                <legend>{t('assignments.editor.ordering.scoringTitle')}</legend>
                <div>
                  {(['PARTIAL', 'ALL_OR_NOTHING'] as const).map((mode) => (
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
                      <span>
                        {t(`assignments.editor.ordering.scoring.${mode}`)}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
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
              {readiness.length > 0 && (
                <div className={styles.choiceReadiness}>
                  <strong>{t('assignments.editor.ordering.beforeUse')}</strong>
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
                  <ListOrdered size={21} />
                </span>
                <div>
                  <p>{t('assignments.types.ORDERING.title')}</p>
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
              <OrderingPreview items={values.items} />
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

function OrderingPreview({ items }: { items: OrderingItem[] }) {
  const firstItem = items[0]
  const previewItems =
    items.length > 1 && firstItem ? [...items.slice(1), firstItem] : [...items]
  return (
    <div className={styles.orderingPreview}>
      {previewItems.map((item, index) => (
        <div key={item.id}>
          <GripVertical size={16} />
          <span>{index + 1}</span>
          <strong>{item.text}</strong>
        </div>
      ))}
    </div>
  )
}

function createInitialValues(): OrderingEditorValues {
  return {
    defaultMaxPoints: '1',
    defaultPassingPercent: '100',
    explanation: '',
    instructions: '',
    items: [createItem(), createItem()],
    promptImage: null,
    prompt: '',
    scoringMode: 'PARTIAL',
    title: '',
  }
}

function createItem(text = ''): OrderingItem {
  return { id: crypto.randomUUID(), text }
}

function assignmentToValues(
  assignment: AssignmentEditor,
): OrderingEditorValues {
  const revision = assignment.draftRevision ?? assignment.publishedRevision
  const publicConfig = toOrderingPublicConfig(revision?.publicConfig)
  const gradingConfig = toOrderingGradingConfig(revision?.gradingConfig)
  const itemById = new Map(publicConfig.items.map((item) => [item.id, item]))
  const orderedItems = gradingConfig.correctOrderIds
    .map((id) => itemById.get(id))
    .filter((item): item is OrderingItem => Boolean(item))
  const orderedIds = new Set(orderedItems.map((item) => item.id))
  orderedItems.push(
    ...publicConfig.items.filter((item) => !orderedIds.has(item.id)),
  )
  while (orderedItems.length < 2) orderedItems.push(createItem())

  return {
    defaultMaxPoints: String(assignment.defaultMaxPoints),
    defaultPassingPercent: String(assignment.defaultPassingPercent),
    explanation: revision?.explanation ?? '',
    instructions: revision?.instructions ?? '',
    items: orderedItems,
    promptImage: publicConfig.promptImage ?? null,
    prompt: revision?.prompt ?? '',
    scoringMode: gradingConfig.scoringMode,
    title: revision?.title ?? '',
  }
}

function toOrderingPublicConfig(
  value: Record<string, unknown> | undefined,
): OrderingPublicConfig {
  return {
    items: Array.isArray(value?.items)
      ? value.items.filter(isOrderingItem).map((item) => ({ ...item }))
      : [],
    promptImage: toPromptImage(value?.promptImage),
  }
}

function toOrderingGradingConfig(
  value: Record<string, unknown> | null | undefined,
): OrderingGradingConfig {
  return {
    correctOrderIds: Array.isArray(value?.correctOrderIds)
      ? value.correctOrderIds.filter(
          (id): id is string => typeof id === 'string',
        )
      : [],
    scoringMode:
      value?.scoringMode === 'ALL_OR_NOTHING' ? 'ALL_OR_NOTHING' : 'PARTIAL',
  }
}

function isOrderingItem(value: unknown): value is OrderingItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'text' in value &&
    typeof value.text === 'string'
  )
}

function valuesToDraft(values: OrderingEditorValues) {
  return {
    title: values.title,
    prompt: values.prompt,
    instructions: values.instructions.trim() ? values.instructions : null,
    explanation: values.explanation.trim() ? values.explanation : null,
    publicConfig: { items: values.items, promptImage: values.promptImage },
    gradingConfig: {
      correctOrderIds: values.items.map((item) => item.id),
      scoringMode: values.scoringMode,
    },
  }
}

function toPromptImage(value: unknown): AssignmentPromptImage | null {
  if (typeof value !== 'object' || value === null || !('attachmentId' in value) || !('width' in value) || !('height' in value)) return null
  return typeof value.attachmentId === 'string' && typeof value.width === 'number' && typeof value.height === 'number'
    ? { attachmentId: value.attachmentId, width: value.width, height: value.height }
    : null
}

function updateItem(
  setValues: React.Dispatch<React.SetStateAction<OrderingEditorValues>>,
  itemId: string,
  text: string,
) {
  setValues((current) => ({
    ...current,
    items: current.items.map((item) =>
      item.id === itemId ? { ...item, text } : item,
    ),
  }))
}

function removeItem(
  setValues: React.Dispatch<React.SetStateAction<OrderingEditorValues>>,
  itemId: string,
) {
  setValues((current) => ({
    ...current,
    items: current.items.filter((item) => item.id !== itemId),
  }))
}

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  if (moved === undefined) return items
  next.splice(toIndex, 0, moved)
  return next
}

function validateValues(
  values: OrderingEditorValues,
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
  values: OrderingEditorValues,
  t: (key: string) => string,
): string[] {
  const issues: string[] = []
  if (!values.title.trim())
    issues.push(t('assignments.editor.ordering.readyTitle'))
  if (!values.prompt.trim())
    issues.push(t('assignments.editor.ordering.readyPrompt'))
  if (
    values.items.length < 2 ||
    values.items.some((item) => !item.text.trim())
  ) {
    issues.push(t('assignments.editor.ordering.readyItems'))
  }
  return issues
}

function serializeValues(values: OrderingEditorValues): string {
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
