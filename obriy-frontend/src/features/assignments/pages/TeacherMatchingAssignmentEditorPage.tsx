import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Eye,
  Link2,
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
  MatchingGradingConfig,
  MatchingItem,
  MatchingPair,
  MatchingPublicConfig,
} from '../model/assignment.types'
import styles from '../Assignments.module.css'

interface EditablePair {
  left: MatchingItem
  right: MatchingItem
}

interface MatchingEditorValues {
  defaultMaxPoints: string
  defaultPassingPercent: string
  distractors: MatchingItem[]
  explanation: string
  instructions: string
  pairs: EditablePair[]
  promptImage: AssignmentPromptImage | null
  prompt: string
  scoringMode: MatchingGradingConfig['scoringMode']
  shuffleRightItems: boolean
  title: string
}

interface SaveResult {
  assignment: AssignmentEditor
  savedValues: MatchingEditorValues
  wasCreated: boolean
}

export function TeacherMatchingAssignmentEditorPage() {
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
  const isMatching = isNew
    ? assignmentType?.toUpperCase() === 'MATCHING'
    : assignmentQuery.data?.type === 'MATCHING'

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
    values.pairs.some(
      (pair) => pair.left.text.trim() || pair.right.text.trim(),
    ) ||
    values.distractors.some((item) => item.text.trim()),
  )

  const saveMutation = useMutation({
    mutationFn: async (snapshot: MatchingEditorValues): Promise<SaveResult> => {
      const draft = valuesToDraft(snapshot)
      if (!assignmentId) {
        const assignment = await createAssignment({
          type: 'MATCHING',
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
  if (!isMatching) {
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
                t('assignments.editor.matching.createTitle')}
            </h1>
            <p>{t('assignments.editor.matching.description')}</p>
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
                    <h2>{t('assignments.editor.matching.pairsTitle')}</h2>
                    <p>{t('assignments.editor.matching.pairsDescription')}</p>
                  </div>
                </div>
                <button
                  className={styles.secondaryButton}
                  disabled={disabled || values.pairs.length >= 50}
                  onClick={() =>
                    setValues((current) => ({
                      ...current,
                      pairs: [...current.pairs, createPair()],
                    }))
                  }
                  type="button"
                >
                  <Plus size={16} />
                  {t('assignments.editor.matching.addPair')}
                </button>
              </div>

              <div className={styles.matchingColumnLabels} aria-hidden="true">
                <span>{t('assignments.editor.matching.leftColumn')}</span>
                <span />
                <span>{t('assignments.editor.matching.rightColumn')}</span>
                <span />
              </div>
              <div className={styles.matchingPairList}>
                {values.pairs.map((pair, index) => (
                  <article
                    className={styles.matchingPairRow}
                    key={pair.left.id}
                  >
                    <label className={styles.field}>
                      <span>
                        {t('assignments.editor.matching.leftItem', {
                          index: index + 1,
                        })}
                      </span>
                      <textarea
                        disabled={disabled}
                        maxLength={5_000}
                        onChange={(event) =>
                          updatePair(
                            setValues,
                            pair.left.id,
                            'left',
                            event.target.value,
                          )
                        }
                        placeholder={t(
                          'assignments.editor.matching.leftPlaceholder',
                        )}
                        rows={2}
                        value={pair.left.text}
                      />
                    </label>
                    <span className={styles.matchingConnector}>
                      <ArrowRight size={17} />
                    </span>
                    <label className={styles.field}>
                      <span>
                        {t('assignments.editor.matching.rightItem', {
                          index: index + 1,
                        })}
                      </span>
                      <textarea
                        disabled={disabled}
                        maxLength={5_000}
                        onChange={(event) =>
                          updatePair(
                            setValues,
                            pair.left.id,
                            'right',
                            event.target.value,
                          )
                        }
                        placeholder={t(
                          'assignments.editor.matching.rightPlaceholder',
                        )}
                        rows={2}
                        value={pair.right.text}
                      />
                    </label>
                    <button
                      aria-label={t('assignments.editor.matching.removePair', {
                        index: index + 1,
                      })}
                      className={`${styles.iconButton} ${styles.dangerIconButton}`}
                      disabled={disabled || values.pairs.length <= 2}
                      onClick={() => removePair(setValues, pair.left.id)}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))}
              </div>

              <div className={styles.matchingDistractors}>
                <div className={styles.matchingDistractorHeader}>
                  <div>
                    <h3>{t('assignments.editor.matching.distractorsTitle')}</h3>
                    <p>
                      {t('assignments.editor.matching.distractorsDescription')}
                    </p>
                  </div>
                  <button
                    className={styles.secondaryButton}
                    disabled={
                      disabled ||
                      values.pairs.length + values.distractors.length >= 50
                    }
                    onClick={() =>
                      setValues((current) => ({
                        ...current,
                        distractors: [...current.distractors, createItem()],
                      }))
                    }
                    type="button"
                  >
                    <Plus size={16} />
                    {t('assignments.editor.matching.addDistractor')}
                  </button>
                </div>
                {values.distractors.length === 0 ? (
                  <p className={styles.matchingEmptyDistractors}>
                    {t('assignments.editor.matching.noDistractors')}
                  </p>
                ) : (
                  <div className={styles.matchingDistractorList}>
                    {values.distractors.map((item, index) => (
                      <div
                        className={styles.matchingDistractorRow}
                        key={item.id}
                      >
                        <label className={styles.field}>
                          <span>
                            {t('assignments.editor.matching.distractorItem', {
                              index: index + 1,
                            })}
                          </span>
                          <textarea
                            disabled={disabled}
                            maxLength={5_000}
                            onChange={(event) =>
                              updateDistractor(
                                setValues,
                                item.id,
                                event.target.value,
                              )
                            }
                            placeholder={t(
                              'assignments.editor.matching.rightPlaceholder',
                            )}
                            rows={2}
                            value={item.text}
                          />
                        </label>
                        <button
                          aria-label={t(
                            'assignments.editor.matching.removeDistractor',
                            { index: index + 1 },
                          )}
                          className={`${styles.iconButton} ${styles.dangerIconButton}`}
                          disabled={disabled}
                          onClick={() => removeDistractor(setValues, item.id)}
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label className={styles.toggleField}>
                <input
                  checked={values.shuffleRightItems}
                  disabled={disabled}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      shuffleRightItems: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                <span>
                  <strong>{t('assignments.editor.matching.shuffle')}</strong>
                  <small>{t('assignments.editor.matching.shuffleHint')}</small>
                </span>
              </label>

              <fieldset className={styles.segmentedField}>
                <legend>{t('assignments.editor.matching.scoringTitle')}</legend>
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
                        {t(`assignments.editor.matching.scoring.${mode}`)}
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
                  <strong>{t('assignments.editor.matching.beforeUse')}</strong>
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
                  <Link2 size={21} />
                </span>
                <div>
                  <p>{t('assignments.types.MATCHING.title')}</p>
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
              <MatchingPreview values={values} />
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

function MatchingPreview({ values }: { values: MatchingEditorValues }) {
  const { t } = useTranslation()
  const rightItems = [
    ...values.pairs.map((pair) => pair.right),
    ...values.distractors,
  ]
  return (
    <div className={styles.matchingPreview}>
      {values.pairs.map((pair, index) => (
        <label key={pair.left.id}>
          <span>{pair.left.text || `${index + 1}.`}</span>
          <select defaultValue="">
            <option disabled value="">
              {t('assignments.editor.matching.previewPlaceholder')}
            </option>
            {rightItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.text || t('assignments.common.untitled')}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  )
}

function createInitialValues(): MatchingEditorValues {
  return {
    defaultMaxPoints: '1',
    defaultPassingPercent: '100',
    distractors: [],
    explanation: '',
    instructions: '',
    pairs: [createPair(), createPair()],
    promptImage: null,
    prompt: '',
    scoringMode: 'PARTIAL',
    shuffleRightItems: false,
    title: '',
  }
}

function createItem(text = ''): MatchingItem {
  return { id: crypto.randomUUID(), text }
}

function createPair(): EditablePair {
  return { left: createItem(), right: createItem() }
}

function assignmentToValues(
  assignment: AssignmentEditor,
): MatchingEditorValues {
  const revision = assignment.draftRevision ?? assignment.publishedRevision
  const publicConfig = toMatchingPublicConfig(revision?.publicConfig)
  const gradingConfig = toMatchingGradingConfig(revision?.gradingConfig)
  const rightById = new Map(
    publicConfig.rightItems.map((item) => [item.id, item]),
  )
  const matchByLeftId = new Map(
    gradingConfig.matches.map((pair) => [pair.leftItemId, pair.rightItemId]),
  )
  const usedRightIds = new Set<string>()
  const pairs = publicConfig.leftItems.map((left) => {
    const rightId = matchByLeftId.get(left.id)
    const right = rightId ? rightById.get(rightId) : undefined
    if (right) usedRightIds.add(right.id)
    return { left, right: right ?? createItem() }
  })

  while (pairs.length < 2) pairs.push(createPair())
  return {
    defaultMaxPoints: String(assignment.defaultMaxPoints),
    defaultPassingPercent: String(assignment.defaultPassingPercent),
    distractors: publicConfig.rightItems.filter(
      (item) => !usedRightIds.has(item.id),
    ),
    explanation: revision?.explanation ?? '',
    instructions: revision?.instructions ?? '',
    pairs,
    promptImage: publicConfig.promptImage ?? null,
    prompt: revision?.prompt ?? '',
    scoringMode: gradingConfig.scoringMode,
    shuffleRightItems: publicConfig.shuffleRightItems,
    title: revision?.title ?? '',
  }
}

function toMatchingPublicConfig(
  value: Record<string, unknown> | undefined,
): MatchingPublicConfig {
  return {
    leftItems: Array.isArray(value?.leftItems)
      ? value.leftItems.filter(isMatchingItem).map((item) => ({ ...item }))
      : [],
    rightItems: Array.isArray(value?.rightItems)
      ? value.rightItems.filter(isMatchingItem).map((item) => ({ ...item }))
      : [],
    shuffleRightItems: value?.shuffleRightItems === true,
    promptImage: toPromptImage(value?.promptImage),
  }
}

function toMatchingGradingConfig(
  value: Record<string, unknown> | null | undefined,
): MatchingGradingConfig {
  return {
    matches: Array.isArray(value?.matches)
      ? value.matches.filter(isMatchingPair).map((pair) => ({ ...pair }))
      : [],
    scoringMode:
      value?.scoringMode === 'ALL_OR_NOTHING' ? 'ALL_OR_NOTHING' : 'PARTIAL',
  }
}

function isMatchingItem(value: unknown): value is MatchingItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'text' in value &&
    typeof value.text === 'string'
  )
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

function valuesToDraft(values: MatchingEditorValues) {
  return {
    title: values.title,
    prompt: values.prompt,
    instructions: values.instructions.trim() ? values.instructions : null,
    explanation: values.explanation.trim() ? values.explanation : null,
    publicConfig: {
      leftItems: values.pairs.map((pair) => pair.left),
      rightItems: [
        ...values.pairs.map((pair) => pair.right),
        ...values.distractors,
      ],
      shuffleRightItems: values.shuffleRightItems,
      promptImage: values.promptImage,
    },
    gradingConfig: {
      matches: values.pairs.map((pair) => ({
        leftItemId: pair.left.id,
        rightItemId: pair.right.id,
      })),
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

function updatePair(
  setValues: React.Dispatch<React.SetStateAction<MatchingEditorValues>>,
  leftId: string,
  side: 'left' | 'right',
  text: string,
) {
  setValues((current) => ({
    ...current,
    pairs: current.pairs.map((pair) =>
      pair.left.id === leftId
        ? { ...pair, [side]: { ...pair[side], text } }
        : pair,
    ),
  }))
}

function removePair(
  setValues: React.Dispatch<React.SetStateAction<MatchingEditorValues>>,
  leftId: string,
) {
  setValues((current) => ({
    ...current,
    pairs: current.pairs.filter((pair) => pair.left.id !== leftId),
  }))
}

function updateDistractor(
  setValues: React.Dispatch<React.SetStateAction<MatchingEditorValues>>,
  itemId: string,
  text: string,
) {
  setValues((current) => ({
    ...current,
    distractors: current.distractors.map((item) =>
      item.id === itemId ? { ...item, text } : item,
    ),
  }))
}

function removeDistractor(
  setValues: React.Dispatch<React.SetStateAction<MatchingEditorValues>>,
  itemId: string,
) {
  setValues((current) => ({
    ...current,
    distractors: current.distractors.filter((item) => item.id !== itemId),
  }))
}

function validateValues(
  values: MatchingEditorValues,
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
  values: MatchingEditorValues,
  t: (key: string) => string,
): string[] {
  const issues: string[] = []
  if (!values.title.trim()) {
    issues.push(t('assignments.editor.matching.readyTitle'))
  }
  if (!values.prompt.trim()) {
    issues.push(t('assignments.editor.matching.readyPrompt'))
  }
  if (
    values.pairs.length < 2 ||
    values.pairs.some(
      (pair) => !pair.left.text.trim() || !pair.right.text.trim(),
    )
  ) {
    issues.push(t('assignments.editor.matching.readyPairs'))
  }
  if (values.distractors.some((item) => !item.text.trim())) {
    issues.push(t('assignments.editor.matching.readyDistractors'))
  }
  return issues
}

function serializeValues(values: MatchingEditorValues): string {
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
