import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Map as MapIcon,
  Save,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../../shared/api/api-client'
import { registerWorkspaceNavigationGuard } from '../../../shared/navigation/workspace-navigation-guard'
import { listMapPresets } from '../../maps/api/map-presets.api'
import { MapRegionPicker } from '../../maps/components/MapRegionPicker'
import { mapQueryKeys } from '../../maps/model/map-query-keys'
import type { MapRegionOption } from '../../maps/model/map.types'
import {
  createAssignment,
  getAssignment,
  startAssignmentEdit,
  updateAssignmentDraft,
} from '../api/assignments.api'
import { AssignmentConfirmDialog } from '../components/AssignmentConfirmDialog'
import { assignmentQueryKeys } from '../model/assignment-query-keys'
import type {
  AssignmentEditor,
  MapRegionAssignmentDraftInput,
  MapRegionGradingConfig,
  MapRegionPublicConfig,
} from '../model/assignment.types'
import styles from '../Assignments.module.css'

const MapCanvas = lazy(() =>
  import('../../maps/components/MapCanvas').then((module) => ({
    default: module.MapCanvas,
  })),
)

interface Values {
  defaultMaxPoints: string
  defaultPassingPercent: string
  explanation: string
  gradingConfig: MapRegionGradingConfig
  instructions: string
  mapPresetId: string | null
  prompt: string
  publicConfig: MapRegionPublicConfig
  title: string
}

interface SaveResult {
  assignment: AssignmentEditor
  savedValues: Values
  wasCreated: boolean
}

const emptyValues: Values = {
  defaultMaxPoints: '1',
  defaultPassingPercent: '100',
  explanation: '',
  gradingConfig: { correctRegionId: null },
  instructions: '',
  mapPresetId: null,
  prompt: '',
  publicConfig: { initialProjection: 'MERCATOR' },
  title: '',
}

export function TeacherMapRegionAssignmentEditorPage() {
  const { assignmentId } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [values, setValues] = useState<Values>(emptyValues)
  const [regions, setRegions] = useState<MapRegionOption[]>([])
  const [savedHash, setSavedHash] = useState(() => serialize(emptyValues))
  const [hydrated, setHydrated] = useState(!assignmentId)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  )
  const [saveState, setSaveState] = useState<
    'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict'
  >('idle')
  const assignmentQuery = useQuery({
    queryKey: assignmentQueryKeys.detail(assignmentId ?? ''),
    queryFn: () => getAssignment(assignmentId ?? ''),
    enabled: Boolean(assignmentId),
  })
  const presetsQuery = useQuery({
    queryKey: mapQueryKeys.presets,
    queryFn: listMapPresets,
  })

  useEffect(() => {
    if (!assignmentQuery.data || hydrated) return
    const next = fromAssignment(assignmentQuery.data)
    // The API hydrates this explicit-save buffer once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(next)
    setSavedHash(serialize(next))
    setSaveState('saved')
    setHydrated(true)
  }, [assignmentQuery.data, hydrated])

  const selectedPreset = useMemo(
    () =>
      presetsQuery.data?.find((preset) => preset.id === values.mapPresetId) ??
      null,
    [presetsQuery.data, values.mapPresetId],
  )
  const blockingValidation = useMemo(() => validateSave(values, t), [t, values])
  const readinessIssues = useMemo(
    () => validatePublishReadiness(values, t),
    [t, values],
  )
  const dirty = serialize(values) !== savedHash
  const displayedSaveState =
    dirty && (saveState === 'idle' || saveState === 'saved')
      ? 'dirty'
      : saveState
  const isArchived = assignmentQuery.data?.status === 'ARCHIVED'
  const disabled = Boolean(isArchived) || saveState === 'conflict'

  const saveMutation = useMutation({
    mutationFn: async (snapshot: Values): Promise<SaveResult> => {
      const draft = toDraft(snapshot)
      const wasCreated = !assignmentId
      let assignment: AssignmentEditor
      if (!assignmentId) {
        assignment = await createAssignment({
          type: 'MAP_REGION',
          defaultMaxPoints: Number(snapshot.defaultMaxPoints),
          defaultPassingPercent: Number(snapshot.defaultPassingPercent),
          draft,
        })
      } else {
        let current =
          assignmentQuery.data ?? (await getAssignment(assignmentId))
        if (!current.draftRevision)
          current = await startAssignmentEdit(assignmentId)
        const revision = current.draftRevision
        if (!revision) throw new Error('Draft is unavailable')
        assignment = await updateAssignmentDraft(assignmentId, {
          ...draft,
          expectedRevisionId: revision.id,
          expectedEditVersion: revision.editVersion,
          defaultMaxPoints: Number(snapshot.defaultMaxPoints),
          defaultPassingPercent: Number(snapshot.defaultPassingPercent),
        })
      }
      return { assignment, savedValues: fromAssignment(assignment), wasCreated }
    },
    onMutate: () => setSaveState('saving'),
    onSuccess: ({ assignment, savedValues, wasCreated }) => {
      setValues(savedValues)
      setSavedHash(serialize(savedValues))
      setSaveState('saved')
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

  const shouldWarn = dirty || saveMutation.isPending || saveState === 'error'
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
  if (
    assignmentQuery.isError ||
    (assignmentQuery.data && assignmentQuery.data.type !== 'MAP_REGION')
  ) {
    return <EditorStatus message={t('assignments.editor.loadError')} />
  }

  const updateRegion = (region: MapRegionOption) => {
    setValues((current) => ({
      ...current,
      gradingConfig: { correctRegionId: region.id },
    }))
  }
  const requestLeave = (target: string) => {
    if (shouldWarn) {
      setPendingNavigation(target)
      setShowDiscardDialog(true)
    } else navigate(target)
  }

  return (
    <section className={styles.page}>
      <header className={styles.editorHeader}>
        <button
          aria-label={t('assignments.common.back')}
          className={styles.iconButton}
          onClick={() => requestLeave('/app/teacher/tasks')}
          type="button"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div className={styles.editorHeading}>
          <h1>
            {assignmentId
              ? values.title || t('assignments.types.MAP_REGION.title')
              : t('assignments.mapRegion.newTitle')}
          </h1>
          <p>{t('assignments.mapRegion.description')}</p>
        </div>
        <div className={styles.editorHeaderActions}>
          <button
            className={styles.primaryButton}
            disabled={
              !dirty ||
              blockingValidation.length > 0 ||
              disabled ||
              saveMutation.isPending
            }
            onClick={() => saveMutation.mutate(values)}
            type="button"
          >
            <Save size={16} aria-hidden="true" />
            {saveMutation.isPending
              ? t('assignments.editor.saving')
              : t('assignments.editor.save')}
          </button>
        </div>
      </header>

      {isArchived && (
        <Notice
          title={t('assignments.editor.archivedTitle')}
          text={t('assignments.editor.archivedDescription')}
        />
      )}
      {saveState === 'conflict' && (
        <div className={styles.notice}>
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>{t('assignments.editor.conflictTitle')}</strong>
            <p>{t('assignments.editor.conflictDescription')}</p>
            <button
              className={styles.secondaryButton}
              onClick={() => void reloadCurrent()}
              type="button"
            >
              {t('assignments.editor.reload')}
            </button>
          </div>
        </div>
      )}

      <fieldset className={styles.editorFieldset} disabled={disabled}>
        <div className={styles.editorLayout}>
          <main className={styles.editorMain}>
            <section className={styles.editorSection}>
              <SectionHeading
                number="01"
                title={t('assignments.mapRegion.content')}
                text={t('assignments.mapRegion.contentHint')}
              />
              <label className={styles.field}>
                <span>{t('assignments.editor.fields.title')}</span>
                <input
                  maxLength={160}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  value={values.title}
                />
              </label>
              <label className={styles.field}>
                <span>{t('assignments.editor.fields.prompt')}</span>
                <textarea
                  maxLength={50_000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      prompt: event.target.value,
                    }))
                  }
                  rows={4}
                  value={values.prompt}
                />
              </label>
              <label className={styles.field}>
                <span>{t('assignments.editor.fields.instructions')}</span>
                <textarea
                  maxLength={50_000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      instructions: event.target.value,
                    }))
                  }
                  rows={2}
                  value={values.instructions}
                />
              </label>
            </section>

            <section className={styles.editorSection}>
              <SectionHeading
                number="02"
                title={t('assignments.mapRegion.mapTitle')}
                text={t('assignments.mapRegion.mapHint')}
              />
              <label className={styles.field}>
                <span>{t('assignments.mapPoint.preset')}</span>
                <select
                  onChange={(event) => {
                    setRegions([])
                    setValues((current) => ({
                      ...current,
                      mapPresetId: event.target.value || null,
                      gradingConfig: { correctRegionId: null },
                    }))
                  }}
                  value={values.mapPresetId ?? ''}
                >
                  <option value="">
                    {t('assignments.mapPoint.selectPreset')}
                  </option>
                  {presetsQuery.data?.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {t(`maps.presets.${preset.key}`, {
                        defaultValue: preset.name,
                      })}
                    </option>
                  ))}
                </select>
              </label>
              {presetsQuery.isError && (
                <p className={styles.inlineError}>
                  {t('assignments.mapPoint.presetError')}
                </p>
              )}
              <fieldset className={styles.segmentedField}>
                <legend>{t('assignments.mapPoint.initialProjection')}</legend>
                <div>
                  <ProjectionButton
                    active={
                      values.publicConfig.initialProjection === 'MERCATOR'
                    }
                    icon={MapIcon}
                    label={t('maps.projection.mercator')}
                    onClick={() => setProjection('MERCATOR')}
                  />
                  <ProjectionButton
                    active={values.publicConfig.initialProjection === 'GLOBE'}
                    icon={Box}
                    label={t('maps.projection.globe')}
                    onClick={() => setProjection('GLOBE')}
                  />
                </div>
              </fieldset>
              {selectedPreset ? (
                <div className={styles.mapRegionWorkspace}>
                  <Suspense
                    fallback={
                      <div className={styles.mapEditorFallback}>
                        {t('maps.sandbox.loadingMap')}
                      </div>
                    }
                  >
                    <MapCanvas
                      comparisonRegionIds={
                        values.gradingConfig.correctRegionId
                          ? [values.gradingConfig.correctRegionId]
                          : []
                      }
                      key={selectedPreset.id}
                      mapLabel={t('assignments.mapRegion.mapLabel')}
                      onRegionChange={disabled ? undefined : updateRegion}
                      onRegionsLoad={setRegions}
                      preset={selectedPreset}
                      projection={values.publicConfig.initialProjection}
                      variant="ASSIGNMENT"
                    />
                  </Suspense>
                  <MapRegionPicker
                    disabled={disabled}
                    onChange={updateRegion}
                    regions={regions}
                    selectedRegionId={values.gradingConfig.correctRegionId}
                  />
                </div>
              ) : (
                <div className={styles.mapEditorFallback}>
                  {t('assignments.mapPoint.chooseMapFirst')}
                </div>
              )}
            </section>

            <section className={styles.editorSection}>
              <label className={styles.field}>
                <span>{t('assignments.editor.feedback.label')}</span>
                <textarea
                  maxLength={50_000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      explanation: event.target.value,
                    }))
                  }
                  rows={3}
                  value={values.explanation}
                />
              </label>
            </section>
          </main>

          <aside className={styles.editorAside}>
            <div className={styles.settingsPanel}>
              <label className={styles.field}>
                <span>{t('assignments.editor.settings.points')}</span>
                <input
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
                <input
                  max="100"
                  min="0"
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      defaultPassingPercent: event.target.value,
                    }))
                  }
                  type="number"
                  value={values.defaultPassingPercent}
                />
              </label>
              <p className={styles.saveState} data-state={displayedSaveState}>
                {t(`assignments.editor.saveState.${displayedSaveState}`)}
              </p>
              {blockingValidation.length > 0 && (
                <div className={styles.validationList}>
                  {blockingValidation.map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                </div>
              )}
              <div className={styles.mapReadiness}>
                <strong>{t('assignments.mapRegion.readiness')}</strong>
                {readinessIssues.length > 0 ? (
                  <ul>
                    {readinessIssues.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{t('assignments.mapRegion.ready')}</p>
                )}
              </div>
              {saveMutation.isError && saveState !== 'conflict' && (
                <p className={styles.inlineError}>
                  {t('assignments.errors.save')}
                </p>
              )}
            </div>
          </aside>
        </div>
      </fieldset>

      {showDiscardDialog && (
        <AssignmentConfirmDialog
          cancelLabel={t('assignments.editor.discard.cancel')}
          confirmLabel={t('assignments.editor.discard.confirm')}
          description={t('assignments.editor.discard.description')}
          onCancel={() => {
            setShowDiscardDialog(false)
            setPendingNavigation(null)
          }}
          onConfirm={() => {
            const target = pendingNavigation ?? '/app/teacher/tasks'
            setShowDiscardDialog(false)
            setPendingNavigation(null)
            navigate(target)
          }}
          title={t('assignments.editor.discard.title')}
        />
      )}
    </section>
  )

  function setProjection(projection: 'MERCATOR' | 'GLOBE') {
    setValues((current) => ({
      ...current,
      publicConfig: { initialProjection: projection },
    }))
  }

  async function reloadCurrent() {
    const result = await assignmentQuery.refetch()
    if (!result.data) return
    const next = fromAssignment(result.data)
    setValues(next)
    setSavedHash(serialize(next))
    setSaveState('saved')
  }
}

function ProjectionButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof MapIcon
  label: string
  onClick: () => void
}) {
  return (
    <label>
      <input
        checked={active}
        name="map-region-initial-projection"
        onChange={onClick}
        type="radio"
      />
      <span>
        <Icon size={15} aria-hidden="true" />
        {label}
      </span>
    </label>
  )
}

function SectionHeading({
  number,
  text,
  title,
}: {
  number: string
  text: string
  title: string
}) {
  return (
    <div className={styles.sectionHeading}>
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </div>
  )
}

function Notice({ text, title }: { text: string; title: string }) {
  return (
    <div className={styles.notice}>
      <AlertTriangle size={18} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  )
}

function EditorStatus({ message }: { message: string }) {
  return (
    <section className={styles.page}>
      <div className={styles.statusPanel}>
        <p>{message}</p>
      </div>
    </section>
  )
}

function fromAssignment(assignment: AssignmentEditor): Values {
  const revision = assignment.draftRevision ?? assignment.publishedRevision
  if (!revision) return emptyValues
  return {
    defaultMaxPoints: String(assignment.defaultMaxPoints),
    defaultPassingPercent: String(assignment.defaultPassingPercent),
    explanation: revision.explanation ?? '',
    gradingConfig: {
      correctRegionId:
        typeof revision.gradingConfig?.correctRegionId === 'string'
          ? revision.gradingConfig.correctRegionId
          : null,
    },
    instructions: revision.instructions ?? '',
    mapPresetId: revision.mapPresetId,
    prompt: revision.prompt,
    publicConfig: {
      initialProjection:
        revision.publicConfig.initialProjection === 'GLOBE'
          ? 'GLOBE'
          : 'MERCATOR',
    },
    title: revision.title,
  }
}

function toDraft(values: Values): MapRegionAssignmentDraftInput {
  return {
    title: values.title.trim(),
    prompt: values.prompt.trim(),
    instructions: values.instructions.trim() || null,
    explanation: values.explanation.trim() || null,
    publicConfig: values.publicConfig,
    gradingConfig: values.gradingConfig,
    mapPresetId: values.mapPresetId,
  }
}

function validateSave(values: Values, t: (key: string) => string): string[] {
  const issues: string[] = []
  const points = Number(values.defaultMaxPoints)
  const passing = Number(values.defaultPassingPercent)
  if (!Number.isFinite(points) || points < 0.01 || points > 999_999.99)
    issues.push(t('assignments.editor.validation.points'))
  if (!Number.isFinite(passing) || passing < 0 || passing > 100)
    issues.push(t('assignments.editor.validation.passingPercent'))
  return issues
}

function validatePublishReadiness(
  values: Values,
  t: (key: string) => string,
): string[] {
  const issues: string[] = []
  if (!values.title.trim())
    issues.push(t('assignments.mapRegion.validation.title'))
  if (!values.prompt.trim())
    issues.push(t('assignments.mapRegion.validation.prompt'))
  if (!values.mapPresetId)
    issues.push(t('assignments.mapRegion.validation.preset'))
  if (!values.gradingConfig.correctRegionId)
    issues.push(t('assignments.mapRegion.validation.region'))
  return issues
}

function serialize(values: Values): string {
  return JSON.stringify(values)
}
