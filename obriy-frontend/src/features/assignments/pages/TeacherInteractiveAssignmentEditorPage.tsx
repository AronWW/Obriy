import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { AlertTriangle, ArrowLeft, ImagePlus, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../../shared/api/api-client'
import { registerWorkspaceNavigationGuard } from '../../../shared/navigation/workspace-navigation-guard'
import {
  assignmentImageUrl,
  createAssignment,
  getAssignment,
  removeAssignmentImage,
  startAssignmentEdit,
  updateAssignmentDraft,
  uploadAssignmentImage,
} from '../api/assignments.api'
import { AssignmentConfirmDialog } from '../components/AssignmentConfirmDialog'
import { assignmentQueryKeys } from '../model/assignment-query-keys'
import type {
  AssignmentDraftInput,
  AssignmentEditor,
  AssignmentPromptImage,
  CategorizationGradingConfig,
  CategorizationPublicConfig,
  FillBlanksGradingConfig,
  FillBlanksPublicConfig,
  ImageHotspotGradingConfig,
  ImageHotspotPublicConfig,
} from '../model/assignment.types'
import styles from '../Assignments.module.css'

type InteractiveType = 'CATEGORIZATION' | 'FILL_BLANKS' | 'IMAGE_HOTSPOT'
type PublicConfig = CategorizationPublicConfig | FillBlanksPublicConfig | ImageHotspotPublicConfig
type GradingConfig = CategorizationGradingConfig | FillBlanksGradingConfig | ImageHotspotGradingConfig

interface Values {
  title: string
  prompt: string
  instructions: string
  explanation: string
  defaultMaxPoints: string
  defaultPassingPercent: string
  publicConfig: PublicConfig
  gradingConfig: GradingConfig
}

interface SaveResult {
  assignment: AssignmentEditor
  savedValues: Values
  wasCreated: boolean
}

class ImageActionError extends Error {
  readonly assignment: AssignmentEditor
  readonly savedValues: Values
  readonly wasCreated: boolean

  constructor(
    assignment: AssignmentEditor,
    savedValues: Values,
    wasCreated: boolean,
    options: { cause: unknown },
  ) {
    super('The assignment was saved, but its image action failed.', options)
    this.assignment = assignment
    this.savedValues = savedValues
    this.wasCreated = wasCreated
  }
}

export function TeacherInteractiveAssignmentEditorPage({ type }: { type: InteractiveType }) {
  const { assignmentId } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [initialEditorValues] = useState(() => initialValues(type))
  const [values, setValues] = useState(initialEditorValues)
  const [savedHash, setSavedHash] = useState(() =>
    serializeValues(initialEditorValues),
  )
  const [hydrated, setHydrated] = useState(!assignmentId)
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null)
  const [pendingImageDimensions, setPendingImageDimensions] = useState<{ width: number; height: number } | null>(null)
  const [removeExistingImage, setRemoveExistingImage] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict'>('idle')
  const query = useQuery({
    queryKey: assignmentQueryKeys.detail(assignmentId ?? ''),
    queryFn: () => getAssignment(assignmentId ?? ''),
    enabled: Boolean(assignmentId),
  })

  useEffect(() => {
    if (!query.data || hydrated) return
    const next = fromAssignment(type, query.data)
    // The server initializes this explicit-save buffer once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(next)
    setSavedHash(serializeValues(next))
    setSaveState('saved')
    setHydrated(true)
  }, [hydrated, query.data, type])

  useEffect(() => () => {
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl)
  }, [pendingImageUrl])

  const validation = useMemo(
    () => validate(type, values, pendingImage, removeExistingImage, t),
    [pendingImage, removeExistingImage, t, type, values],
  )
  const dirty = serializeValues(values) !== savedHash || Boolean(pendingImage) || removeExistingImage
  const displayedSaveState = dirty && (saveState === 'idle' || saveState === 'saved') ? 'dirty' : saveState
  const isArchived = query.data?.status === 'ARCHIVED'
  const mutation = useMutation({
    mutationFn: async (snapshot: Values): Promise<SaveResult> => {
      const draft = toDraft(snapshot)
      let result: AssignmentEditor
      const wasCreated = !assignmentId
      if (!assignmentId) {
        result = await createAssignment({
          type,
          defaultMaxPoints: Number(snapshot.defaultMaxPoints),
          defaultPassingPercent: Number(snapshot.defaultPassingPercent),
          draft,
        })
      } else {
        let current = query.data ?? await getAssignment(assignmentId)
        if (!current.draftRevision) current = await startAssignmentEdit(assignmentId)
        const revision = current.draftRevision
        if (!revision) throw new Error('Draft is unavailable')
        result = await updateAssignmentDraft(assignmentId, {
          ...draft,
          expectedRevisionId: revision.id,
          expectedEditVersion: revision.editVersion,
          defaultMaxPoints: Number(snapshot.defaultMaxPoints),
          defaultPassingPercent: Number(snapshot.defaultPassingPercent),
        })
      }
      const savedValues = fromAssignment(type, result)
      try {
        if (pendingImage) {
          const revision = result.draftRevision
          if (!revision) throw new Error('Draft is unavailable')
          result = await uploadAssignmentImage(result.id, revision.id, revision.editVersion, pendingImage)
        } else if (removeExistingImage) {
          const revision = result.draftRevision
          if (!revision) throw new Error('Draft is unavailable')
          result = await removeAssignmentImage(result.id, revision.id, revision.editVersion)
        }
      } catch (error) {
        throw new ImageActionError(result, savedValues, wasCreated, { cause: error })
      }
      return { assignment: result, savedValues: fromAssignment(type, result), wasCreated }
    },
    onMutate: () => setSaveState('saving'),
    onSuccess: ({ assignment, savedValues, wasCreated }) => {
      setValues(savedValues)
      setSavedHash(serializeValues(savedValues))
      setSaveState('saved')
      setPendingImage(null)
      setPendingImageUrl(null)
      setPendingImageDimensions(null)
      setRemoveExistingImage(false)
      queryClient.setQueryData(assignmentQueryKeys.detail(assignment.id), assignment)
      void queryClient.invalidateQueries({ queryKey: assignmentQueryKeys.lists })
      if (wasCreated) navigate(`/app/teacher/tasks/${assignment.id}/edit`, { replace: true })
    },
    onError: (error) => {
      if (error instanceof ImageActionError) {
        setValues(error.savedValues)
        setSavedHash(serializeValues(error.savedValues))
        setSaveState('error')
        queryClient.setQueryData(assignmentQueryKeys.detail(error.assignment.id), error.assignment)
        void queryClient.invalidateQueries({ queryKey: assignmentQueryKeys.lists })
        if (error.wasCreated) navigate(`/app/teacher/tasks/${error.assignment.id}/edit`, { replace: true })
        return
      }
      setSaveState(error instanceof ApiError && error.code === 'ASSIGNMENT_DRAFT_VERSION_CONFLICT' ? 'conflict' : 'error')
    },
  })

  const shouldWarn = dirty || mutation.isPending || saveState === 'error'
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

  if (query.isLoading && assignmentId) return <section className={styles.page}><div className={`${styles.content} ${styles.statusPanel}`}><p>{t('assignments.editor.loading')}</p></div></section>
  if (query.isError || (query.data && query.data.type !== type)) return <section className={styles.page}><div className={`${styles.content} ${styles.statusPanel}`}><p>{t('assignments.editor.loadError')}</p></div></section>

  const promptImage = getPromptImage(values.publicConfig)
  const imageSrc = pendingImageUrl ?? (!removeExistingImage && promptImage ? assignmentImageUrl(promptImage.attachmentId) : null)
  const disabled =
    isArchived || mutation.isPending || saveState === 'conflict'

  return (
    <section className={styles.page}>
      <div className={styles.content}>
      <header className={styles.editorHeader}>
        <button aria-label={t('assignments.common.back')} className={`${styles.iconButton} ${styles.editorBackButton}`} onClick={() => requestLeave('/app/teacher/tasks')} type="button"><ArrowLeft size={18} /></button>
        <div className={styles.editorHeading}>
          <h1>{assignmentId ? values.title || t(`assignments.types.${type}.title`) : t('assignments.interactive.newTitle')}</h1>
          <p>{t(`assignments.types.${type}.description`)}</p>
        </div>
        <div className={styles.editorHeaderActions}>
          <button className={styles.primaryButton} disabled={!dirty || validation.length > 0 || disabled} onClick={() => mutation.mutate(values)} type="button"><Save size={16} />{mutation.isPending ? t('assignments.editor.saving') : t('assignments.editor.save')}</button>
        </div>
      </header>

      {isArchived && <div className={styles.notice}><AlertTriangle size={18} /><div><strong>{t('assignments.editor.archivedTitle')}</strong><p>{t('assignments.editor.archivedDescription')}</p></div></div>}
      {saveState === 'conflict' && <div className={styles.notice}><AlertTriangle size={18} /><div><strong>{t('assignments.editor.conflictTitle')}</strong><p>{t('assignments.editor.conflictDescription')}</p><button className={styles.secondaryButton} onClick={() => void reloadCurrent()} type="button">{t('assignments.editor.reload')}</button></div></div>}

      <fieldset className={styles.editorFieldset} disabled={disabled}>
      <div className={styles.editorLayout}>
        <main className={styles.editorMain}>
          <section className={styles.editorSection}>
            <div className={styles.sectionHeading}><span>01</span><div><h2>{t('assignments.interactive.content')}</h2><p>{t('assignments.interactive.contentHint')}</p></div></div>
            <label className={styles.field}><span>{t('assignments.editor.fields.title')}</span><input maxLength={160} onChange={(event) => patch(setValues, { title: event.target.value })} value={values.title} /></label>
            <label className={styles.field}><span>{t('assignments.editor.fields.prompt')}</span><textarea maxLength={50_000} onChange={(event) => patch(setValues, { prompt: event.target.value })} rows={4} value={values.prompt} /></label>
            <label className={styles.field}><span>{t('assignments.editor.fields.instructions')}</span><textarea maxLength={50_000} onChange={(event) => patch(setValues, { instructions: event.target.value })} rows={2} value={values.instructions} /></label>
          </section>

          <section className={styles.editorSection}>
            <div className={styles.sectionHeading}><span>02</span><div><h2>{t('assignments.interactive.image')}</h2><p>{t('assignments.interactive.imageHint')}</p></div></div>
            <label className={styles.imageUploadField}>
              <ImagePlus size={22} />
              <span>{imageSrc ? t('assignments.interactive.replaceImage') : t('assignments.interactive.addImage')}</span>
              <input accept="image/jpeg,image/png,image/webp" onChange={(event) => selectImage(event.target.files?.[0] ?? null)} type="file" />
            </label>
            {imageSrc && type !== 'IMAGE_HOTSPOT' && <img className={styles.assignmentPromptImage} alt={values.title || values.prompt || t(`assignments.types.${type}.title`)} src={imageSrc} />}
            {imageSrc && <button className={styles.secondaryButton} onClick={() => removeImage()} type="button"><Trash2 size={15} />{t('assignments.interactive.removeImage')}</button>}
          </section>

          {type === 'CATEGORIZATION' && <CategorizationBuilder values={values} onChange={setValues} />}
          {type === 'FILL_BLANKS' && <FillBlanksBuilder values={values} onChange={setValues} />}
          {type === 'IMAGE_HOTSPOT' && <HotspotBuilder dimensions={pendingImageDimensions} imageSrc={imageSrc} onDimensions={setPendingImageDimensions} values={values} onChange={setValues} />}

          <section className={styles.editorSection}>
            <label className={styles.field}><span>{t('assignments.editor.feedback.label')}</span><textarea maxLength={50_000} onChange={(event) => patch(setValues, { explanation: event.target.value })} rows={3} value={values.explanation} /></label>
          </section>
        </main>
        <aside className={styles.editorAside}>
          <div className={styles.settingsPanel}>
            <label className={styles.field}><span>{t('assignments.editor.settings.points')}</span><input min="0.01" onChange={(event) => patch(setValues, { defaultMaxPoints: event.target.value })} step="0.01" type="number" value={values.defaultMaxPoints} /></label>
            <label className={styles.field}><span>{t('assignments.editor.settings.passingPercent')}</span><input max="100" min="0" onChange={(event) => patch(setValues, { defaultPassingPercent: event.target.value })} type="number" value={values.defaultPassingPercent} /></label>
            <p className={styles.saveState} data-state={displayedSaveState}>{t(`assignments.editor.saveState.${displayedSaveState}`)}</p>
            {validation.length > 0 && <div className={styles.validationList}>{validation.map((message) => <p key={message}>{message}</p>)}</div>}
            {mutation.isError && saveState !== 'conflict' && <p className={styles.inlineError}>{mutation.error instanceof ImageActionError ? t('assignments.interactive.uploadError') : t('assignments.errors.save')}</p>}
          </div>
        </aside>
      </div>
      </fieldset>
      </div>
      {showDiscardDialog && <AssignmentConfirmDialog cancelLabel={t('assignments.editor.discard.cancel')} confirmLabel={t('assignments.editor.discard.confirm')} description={t('assignments.editor.discard.description')} onCancel={() => { setShowDiscardDialog(false); setPendingNavigation(null) }} onConfirm={() => { const target = pendingNavigation ?? '/app/teacher/tasks'; setShowDiscardDialog(false); setPendingNavigation(null); navigate(target) }} title={t('assignments.editor.discard.title')} />}
    </section>
  )

  function selectImage(file: File | null) {
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl)
    setPendingImage(file)
    setPendingImageUrl(file ? URL.createObjectURL(file) : null)
    setPendingImageDimensions(null)
    if (file) setRemoveExistingImage(false)
  }

  function removeImage() {
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl)
    setPendingImage(null)
    setPendingImageUrl(null)
    setPendingImageDimensions(null)
    setRemoveExistingImage(Boolean(getPromptImage(values.publicConfig)))
  }

  function requestLeave(target: string) {
    if (shouldWarn) {
      setPendingNavigation(target)
      setShowDiscardDialog(true)
      return
    }
    navigate(target)
  }

  async function reloadCurrent() {
    const result = await query.refetch()
    if (!result.data) return
    const next = fromAssignment(type, result.data)
    setValues(next)
    setSavedHash(serializeValues(next))
    setPendingImage(null)
    setPendingImageUrl(null)
    setPendingImageDimensions(null)
    setRemoveExistingImage(false)
    setSaveState('saved')
  }
}

function CategorizationBuilder({ values, onChange }: { values: Values; onChange: React.Dispatch<React.SetStateAction<Values>> }) {
  const { t } = useTranslation()
  const config = values.publicConfig as CategorizationPublicConfig
  const grading = values.gradingConfig as CategorizationGradingConfig
  const updateConfig = (next: CategorizationPublicConfig, nextGrading = grading) => onChange((current) => ({ ...current, publicConfig: next, gradingConfig: nextGrading }))
  return <section className={styles.editorSection}>
    <div className={styles.sectionHeadingWithAction}><div className={styles.sectionHeading}><span>03</span><div><h2>{t('assignments.interactive.categories')}</h2><p>{t('assignments.interactive.categoriesHint')}</p></div></div><button className={styles.secondaryButton} onClick={() => updateConfig({ ...config, categories: [...config.categories, { id: crypto.randomUUID(), title: '' }] })} type="button"><Plus size={15} />{t('assignments.interactive.addCategory')}</button></div>
    <div className={styles.compactBuilderList}>{config.categories.map((category, index) => <div key={category.id}><input aria-label={t('assignments.interactive.categoryNumber', { count: index + 1 })} onChange={(event) => updateConfig({ ...config, categories: config.categories.map((value) => value.id === category.id ? { ...value, title: event.target.value } : value) })} value={category.title} /><button aria-label={t('assignments.interactive.remove')} onClick={() => updateConfig({ ...config, categories: config.categories.filter((value) => value.id !== category.id) }, { ...grading, assignments: grading.assignments.filter((value) => value.categoryId !== category.id) })} type="button"><Trash2 size={15} /></button></div>)}</div>
    <div className={styles.sectionHeadingWithAction}><h3>{t('assignments.interactive.items')}</h3><button className={styles.secondaryButton} onClick={() => updateConfig({ ...config, items: [...config.items, { id: crypto.randomUUID(), text: '' }] })} type="button"><Plus size={15} />{t('assignments.interactive.addItem')}</button></div>
    <div className={styles.compactBuilderList}>{config.items.map((item, index) => <div key={item.id}><input aria-label={t('assignments.interactive.itemNumber', { count: index + 1 })} onChange={(event) => updateConfig({ ...config, items: config.items.map((value) => value.id === item.id ? { ...value, text: event.target.value } : value) })} value={item.text} /><select aria-label={t('assignments.interactive.correctCategory')} onChange={(event) => updateConfig(config, { ...grading, assignments: [...grading.assignments.filter((value) => value.itemId !== item.id), { itemId: item.id, categoryId: event.target.value }] })} value={grading.assignments.find((value) => value.itemId === item.id)?.categoryId ?? ''}><option value="">—</option>{config.categories.map((category) => <option key={category.id} value={category.id}>{category.title || '…'}</option>)}</select><button aria-label={t('assignments.interactive.remove')} onClick={() => updateConfig({ ...config, items: config.items.filter((value) => value.id !== item.id) }, { ...grading, assignments: grading.assignments.filter((value) => value.itemId !== item.id) })} type="button"><Trash2 size={15} /></button></div>)}</div>
    <ScoringMode grading={grading} onChange={(scoringMode) => updateConfig(config, { ...grading, scoringMode })} />
  </section>
}

function FillBlanksBuilder({ values, onChange }: { values: Values; onChange: React.Dispatch<React.SetStateAction<Values>> }) {
  const { t } = useTranslation()
  const config = values.publicConfig as FillBlanksPublicConfig
  const grading = values.gradingConfig as FillBlanksGradingConfig
  const set = (next: FillBlanksPublicConfig, nextGrading = grading) => onChange((current) => ({ ...current, publicConfig: next, gradingConfig: nextGrading }))
  const addBlank = () => {
    const blankId = crypto.randomUUID()
    set({ ...config, segments: [...config.segments, { id: blankId, type: 'BLANK' }, { id: crypto.randomUUID(), type: 'TEXT', text: '' }] }, { ...grading, blanks: [...grading.blanks, { blankId, acceptedAnswers: [''] }] })
  }
  return <section className={styles.editorSection}>
    <div className={styles.sectionHeadingWithAction}><div className={styles.sectionHeading}><span>03</span><div><h2>{t('assignments.interactive.fillText')}</h2><p>{t('assignments.interactive.fillHint')}</p></div></div><button className={styles.secondaryButton} onClick={addBlank} type="button"><Plus size={15} />{t('assignments.interactive.addBlank')}</button></div>
    <div className={styles.fillBuilder}>{config.segments.map((segment) => segment.type === 'TEXT' ? <textarea key={segment.id} onChange={(event) => set({ ...config, segments: config.segments.map((value) => value.id === segment.id ? { ...segment, text: event.target.value } : value) })} rows={2} value={segment.text} /> : <div key={segment.id}><strong>{t('assignments.interactive.blank')}</strong><input aria-label={t('assignments.interactive.acceptedAnswers')} onChange={(event) => set(config, { ...grading, blanks: grading.blanks.map((blank) => blank.blankId === segment.id ? { ...blank, acceptedAnswers: event.target.value.split(',') } : blank) })} placeholder={t('assignments.interactive.answersPlaceholder')} value={grading.blanks.find((blank) => blank.blankId === segment.id)?.acceptedAnswers.join(',') ?? ''} /><button aria-label={t('assignments.interactive.removeBlank')} onClick={() => set({ ...config, segments: config.segments.filter((value) => value.id !== segment.id) }, { ...grading, blanks: grading.blanks.filter((blank) => blank.blankId !== segment.id) })} type="button"><Trash2 size={15} /></button></div>)}</div>
    <label className={styles.toggleRow}><input checked={config.wordBankEnabled} onChange={(event) => set({ ...config, wordBankEnabled: event.target.checked })} type="checkbox" /><span>{t('assignments.interactive.wordBank')}</span></label>
    {config.wordBankEnabled && <label className={styles.field}><span>{t('assignments.interactive.wordBankWords')}</span><textarea onChange={(event) => set({ ...config, wordBank: event.target.value.split(',').map((text, index) => ({ id: config.wordBank[index]?.id ?? crypto.randomUUID(), text })) })} rows={2} value={config.wordBank.map((word) => word.text).join(',')} /></label>}
    <ScoringMode grading={grading} onChange={(scoringMode) => set(config, { ...grading, scoringMode })} />
  </section>
}

function HotspotBuilder({ dimensions, imageSrc, onDimensions, values, onChange }: { dimensions: { width: number; height: number } | null; imageSrc: string | null; onDimensions: (value: { width: number; height: number }) => void; values: Values; onChange: React.Dispatch<React.SetStateAction<Values>> }) {
  const { t } = useTranslation()
  const grading = values.gradingConfig as ImageHotspotGradingConfig
  const target = grading.target
  const setTarget = (next: Partial<typeof target>) => onChange((current) => ({ ...current, gradingConfig: { target: { ...target, ...next } } }))
  const image = getPromptImage(values.publicConfig)
  const width = dimensions?.width ?? image?.width ?? 1
  const height = dimensions?.height ?? image?.height ?? 1
  const moveTarget = (x: number, y: number) => setTarget({ x: clamp(x), y: clamp(y) })
  return <section className={styles.editorSection}><div className={styles.sectionHeading}><span>03</span><div><h2>{t('assignments.interactive.hotspot')}</h2><p>{t('assignments.interactive.hotspotHint')}</p></div></div>{imageSrc ? <button aria-label={t('assignments.interactive.hotspotImage')} className={styles.hotspotEditor} onClick={(event) => { if (event.detail === 0) return; const rect = event.currentTarget.getBoundingClientRect(); moveTarget((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height) }} onKeyDown={(event) => { const step = event.shiftKey ? 0.05 : 0.01; if (event.key === 'ArrowLeft') moveTarget(target.x - step, target.y); else if (event.key === 'ArrowRight') moveTarget(target.x + step, target.y); else if (event.key === 'ArrowUp') moveTarget(target.x, target.y - step); else if (event.key === 'ArrowDown') moveTarget(target.x, target.y + step); else return; event.preventDefault() }} type="button"><img alt={values.title || values.prompt || t('assignments.types.IMAGE_HOTSPOT.title')} onLoad={(event) => onDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} src={imageSrc} /><svg aria-hidden="true" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}><circle cx={target.x * width} cy={target.y * height} r={target.radius * Math.min(width, height)} /></svg></button> : <p>{t('assignments.interactive.hotspotNeedsImage')}</p>}<div className={styles.hotspotCoordinates}><label>{t('assignments.interactive.hotspotHorizontal')}<input max="1" min="0" onChange={(event) => moveTarget(Number(event.target.value), target.y)} step="0.01" type="range" value={target.x} /></label><label>{t('assignments.interactive.hotspotVertical')}<input max="1" min="0" onChange={(event) => moveTarget(target.x, Number(event.target.value))} step="0.01" type="range" value={target.y} /></label></div><label className={styles.field}><span>{t('assignments.interactive.radius', { count: Math.round(target.radius * 100) })}</span><input max="0.5" min="0.005" onChange={(event) => setTarget({ radius: Number(event.target.value) })} step="0.005" type="range" value={target.radius} /></label></section>
}

function ScoringMode({ grading, onChange }: { grading: { scoringMode: 'PARTIAL' | 'ALL_OR_NOTHING' }; onChange: (value: 'PARTIAL' | 'ALL_OR_NOTHING') => void }) {
  const { t } = useTranslation()
  return <fieldset className={styles.segmentedField}><legend>{t('assignments.interactive.scoring')}</legend><div>{(['PARTIAL', 'ALL_OR_NOTHING'] as const).map((mode) => <label key={mode}><input checked={grading.scoringMode === mode} onChange={() => onChange(mode)} type="radio" /><span>{t(`assignments.interactive.scoringMode.${mode}`)}</span></label>)}</div></fieldset>
}

function initialValues(type: InteractiveType): Values {
  const common = { title: '', prompt: '', instructions: '', explanation: '', defaultMaxPoints: '1', defaultPassingPercent: '100' }
  if (type === 'CATEGORIZATION') {
    const categories = [{ id: crypto.randomUUID(), title: '' }, { id: crypto.randomUUID(), title: '' }]
    const items = [{ id: crypto.randomUUID(), text: '' }, { id: crypto.randomUUID(), text: '' }]
    return { ...common, publicConfig: { categories, items, promptImage: null }, gradingConfig: { assignments: [], scoringMode: 'PARTIAL' } }
  }
  if (type === 'FILL_BLANKS') {
    const blankId = crypto.randomUUID()
    return { ...common, publicConfig: { segments: [{ id: crypto.randomUUID(), type: 'TEXT', text: '' }, { id: blankId, type: 'BLANK' }, { id: crypto.randomUUID(), type: 'TEXT', text: '' }], wordBankEnabled: false, wordBank: [], promptImage: null }, gradingConfig: { blanks: [{ blankId, acceptedAnswers: [''] }], scoringMode: 'PARTIAL' } }
  }
  return { ...common, publicConfig: { promptImage: null }, gradingConfig: { target: { x: 0.5, y: 0.5, radius: 0.08 } } }
}

function fromAssignment(type: InteractiveType, assignment: AssignmentEditor): Values {
  const revision = assignment.draftRevision ?? assignment.publishedRevision
  if (!revision) return initialValues(type)
  return { title: revision.title, prompt: revision.prompt, instructions: revision.instructions ?? '', explanation: revision.explanation ?? '', defaultMaxPoints: String(assignment.defaultMaxPoints), defaultPassingPercent: String(assignment.defaultPassingPercent), publicConfig: revision.publicConfig as unknown as PublicConfig, gradingConfig: revision.gradingConfig as unknown as GradingConfig }
}

function toDraft(values: Values): AssignmentDraftInput {
  return { title: values.title.trim(), prompt: values.prompt.trim(), instructions: values.instructions.trim() || null, explanation: values.explanation.trim() || null, publicConfig: values.publicConfig, gradingConfig: values.gradingConfig }
}

function validate(type: InteractiveType, values: Values, pendingImage: File | null, removeExistingImage: boolean, t: TFunction): string[] {
  const errors: string[] = []
  if (!values.title.trim()) errors.push(t('assignments.interactive.validation.title'))
  if (!values.prompt.trim()) errors.push(t('assignments.interactive.validation.prompt'))
  const points = Number(values.defaultMaxPoints)
  if (!Number.isFinite(points) || points < 0.01 || points > 999_999.99) errors.push(t('assignments.editor.validation.points'))
  const passing = Number(values.defaultPassingPercent)
  if (!Number.isFinite(passing) || passing < 0 || passing > 100) errors.push(t('assignments.editor.validation.passingPercent'))
  if (type === 'CATEGORIZATION') {
    const config = values.publicConfig as CategorizationPublicConfig
    const grading = values.gradingConfig as CategorizationGradingConfig
    if (config.categories.length < 2 || config.categories.some((value) => !value.title.trim())) errors.push(t('assignments.interactive.validation.categories'))
    if (config.items.length < 2 || config.items.some((value) => !value.text.trim()) || grading.assignments.length !== config.items.length) errors.push(t('assignments.interactive.validation.items'))
  }
  if (type === 'FILL_BLANKS') {
    const grading = values.gradingConfig as FillBlanksGradingConfig
    if (grading.blanks.length < 1 || grading.blanks.some((blank) => blank.acceptedAnswers.every((answer) => !answer.trim()))) errors.push(t('assignments.interactive.validation.blanks'))
  }
  if (type === 'IMAGE_HOTSPOT' && (!getPromptImage(values.publicConfig) || removeExistingImage) && !pendingImage) errors.push(t('assignments.interactive.validation.image'))
  return errors
}

function getPromptImage(config: PublicConfig): AssignmentPromptImage | null {
  return 'promptImage' in config ? config.promptImage ?? null : null
}

function patch(setter: React.Dispatch<React.SetStateAction<Values>>, next: Partial<Values>) {
  setter((current) => ({ ...current, ...next }))
}

function serializeValues(values: Values): string {
  return JSON.stringify(values)
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value))
}
