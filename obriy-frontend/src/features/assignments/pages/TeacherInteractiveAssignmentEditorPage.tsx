import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ImagePlus, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import {
  assignmentImageUrl,
  createAssignment,
  getAssignment,
  removeAssignmentImage,
  startAssignmentEdit,
  updateAssignmentDraft,
  uploadAssignmentImage,
} from '../api/assignments.api'
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

export function TeacherInteractiveAssignmentEditorPage({ type }: { type: InteractiveType }) {
  const { assignmentId } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [values, setValues] = useState(() => initialValues(type))
  const [savedHash, setSavedHash] = useState(() => JSON.stringify(initialValues(type)))
  const [hydrated, setHydrated] = useState(!assignmentId)
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null)
  const [pendingImageDimensions, setPendingImageDimensions] = useState<{ width: number; height: number } | null>(null)
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
    setSavedHash(JSON.stringify(next))
    setHydrated(true)
  }, [hydrated, query.data, type])

  useEffect(() => () => {
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl)
  }, [pendingImageUrl])

  const validation = useMemo(() => validate(type, values, pendingImage), [pendingImage, type, values])
  const dirty = JSON.stringify(values) !== savedHash || Boolean(pendingImage)
  const mutation = useMutation({
    mutationFn: async (): Promise<AssignmentEditor> => {
      const draft = toDraft(values)
      let result: AssignmentEditor
      if (!assignmentId) {
        result = await createAssignment({
          type,
          defaultMaxPoints: Number(values.defaultMaxPoints),
          defaultPassingPercent: Number(values.defaultPassingPercent),
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
          defaultMaxPoints: Number(values.defaultMaxPoints),
          defaultPassingPercent: Number(values.defaultPassingPercent),
        })
      }
      if (pendingImage) {
        const revision = result.draftRevision
        if (!revision) throw new Error('Draft is unavailable')
        result = await uploadAssignmentImage(result.id, revision.id, revision.editVersion, pendingImage)
      }
      return result
    },
    onSuccess: (result) => {
      const next = fromAssignment(type, result)
      setValues(next)
      setSavedHash(JSON.stringify(next))
      setPendingImage(null)
      setPendingImageUrl(null)
      queryClient.setQueryData(assignmentQueryKeys.detail(result.id), result)
      void queryClient.invalidateQueries({ queryKey: assignmentQueryKeys.lists })
      if (!assignmentId) navigate(`/app/teacher/tasks/${result.id}/edit`, { replace: true })
    },
  })
  const removeImageMutation = useMutation({
    mutationFn: async () => {
      const revision = query.data?.draftRevision
      if (!assignmentId || !revision) throw new Error('Draft is unavailable')
      return removeAssignmentImage(assignmentId, revision.id, revision.editVersion)
    },
    onSuccess: (assignment) => {
      const next = fromAssignment(type, assignment)
      setValues(next)
      setSavedHash(JSON.stringify(next))
      queryClient.setQueryData(assignmentQueryKeys.detail(assignment.id), assignment)
    },
  })

  if (query.isLoading && assignmentId) return <section className={styles.page}><p>{t('assignments.editor.loading')}</p></section>
  if (query.isError || (query.data && query.data.type !== type)) return <section className={styles.page}><p>{t('assignments.editor.loadError')}</p></section>

  const promptImage = getPromptImage(values.publicConfig)
  const imageSrc = pendingImageUrl ?? (promptImage ? assignmentImageUrl(promptImage.attachmentId) : null)

  return (
    <section className={styles.page}>
      <header className={styles.editorHeader}>
        <button aria-label={t('assignments.common.back')} className={styles.iconButton} onClick={() => navigate('/app/teacher/tasks')} type="button"><ArrowLeft size={18} /></button>
        <div className={styles.editorHeading}>
          <p className={styles.eyebrow}>{t(`assignments.types.${type}.title`)}</p>
          <h1>{assignmentId ? values.title || t(`assignments.types.${type}.title`) : t('assignments.interactive.newTitle')}</h1>
          <p>{t(`assignments.types.${type}.description`)}</p>
        </div>
        <div className={styles.editorHeaderActions}>
          <button className={styles.primaryButton} disabled={!dirty || validation.length > 0 || mutation.isPending} onClick={() => mutation.mutate()} type="button"><Save size={16} />{mutation.isPending ? t('assignments.editor.saving') : t('assignments.editor.save')}</button>
        </div>
      </header>

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
            {imageSrc && type !== 'IMAGE_HOTSPOT' && <img className={styles.assignmentPromptImage} alt="" src={imageSrc} />}
            {imageSrc && <button className={styles.secondaryButton} onClick={() => removeImage()} type="button"><Trash2 size={15} />{t('assignments.interactive.removeImage')}</button>}
          </section>

          {type === 'CATEGORIZATION' && <CategorizationBuilder values={values} onChange={setValues} />}
          {type === 'FILL_BLANKS' && <FillBlanksBuilder values={values} onChange={setValues} />}
          {type === 'IMAGE_HOTSPOT' && <HotspotBuilder dimensions={pendingImageDimensions} imageSrc={imageSrc} onDimensions={setPendingImageDimensions} values={values} onChange={setValues} />}

          <section className={styles.editorSection}>
            <label className={styles.field}><span>{t('assignments.editor.fields.explanation')}</span><textarea maxLength={50_000} onChange={(event) => patch(setValues, { explanation: event.target.value })} rows={3} value={values.explanation} /></label>
          </section>
        </main>
        <aside className={styles.editorAside}>
          <div className={styles.settingsPanel}>
            <label className={styles.field}><span>{t('assignments.editor.settings.points')}</span><input min="0.01" onChange={(event) => patch(setValues, { defaultMaxPoints: event.target.value })} step="0.01" type="number" value={values.defaultMaxPoints} /></label>
            <label className={styles.field}><span>{t('assignments.editor.settings.passing')}</span><input max="100" min="0" onChange={(event) => patch(setValues, { defaultPassingPercent: event.target.value })} type="number" value={values.defaultPassingPercent} /></label>
            {validation.length > 0 && <div className={styles.validationList}>{validation.map((message) => <p key={message}>{message}</p>)}</div>}
            {mutation.isError && <p className={styles.inlineError}>{t('assignments.errors.save')}</p>}
          </div>
        </aside>
      </div>
    </section>
  )

  function selectImage(file: File | null) {
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl)
    setPendingImage(file)
    setPendingImageUrl(file ? URL.createObjectURL(file) : null)
    setPendingImageDimensions(null)
  }

  function removeImage() {
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl)
    setPendingImage(null)
    setPendingImageUrl(null)
    setPendingImageDimensions(null)
    if (assignmentId && query.data?.draftRevision && getPromptImage(values.publicConfig)) {
      removeImageMutation.mutate()
      return
    }
    setValues((current) => ({ ...current, publicConfig: { ...current.publicConfig, promptImage: null } }))
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
    <div className={styles.fillBuilder}>{config.segments.map((segment) => segment.type === 'TEXT' ? <textarea key={segment.id} onChange={(event) => set({ ...config, segments: config.segments.map((value) => value.id === segment.id ? { ...segment, text: event.target.value } : value) })} rows={2} value={segment.text} /> : <div key={segment.id}><strong>{t('assignments.interactive.blank')}</strong><input aria-label={t('assignments.interactive.acceptedAnswers')} onChange={(event) => set(config, { ...grading, blanks: grading.blanks.map((blank) => blank.blankId === segment.id ? { ...blank, acceptedAnswers: event.target.value.split(',') } : blank) })} placeholder={t('assignments.interactive.answersPlaceholder')} value={grading.blanks.find((blank) => blank.blankId === segment.id)?.acceptedAnswers.join(',') ?? ''} /></div>)}</div>
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
  return <section className={styles.editorSection}><div className={styles.sectionHeading}><span>03</span><div><h2>{t('assignments.interactive.hotspot')}</h2><p>{t('assignments.interactive.hotspotHint')}</p></div></div>{imageSrc ? <div className={styles.hotspotEditor} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setTarget({ x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }) }}><img alt="" onLoad={(event) => onDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} src={imageSrc} /><svg aria-hidden="true" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}><circle cx={target.x * width} cy={target.y * height} r={target.radius * Math.min(width, height)} /></svg></div> : <p>{t('assignments.interactive.hotspotNeedsImage')}</p>}<label className={styles.field}><span>{t('assignments.interactive.radius', { count: Math.round(target.radius * 100) })}</span><input max="0.5" min="0.005" onChange={(event) => setTarget({ radius: Number(event.target.value) })} step="0.005" type="range" value={target.radius} /></label></section>
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

function validate(type: InteractiveType, values: Values, pendingImage: File | null): string[] {
  const errors: string[] = []
  if (!values.title.trim()) errors.push('Додайте назву')
  if (!values.prompt.trim()) errors.push('Додайте запитання')
  if (!Number.isFinite(Number(values.defaultMaxPoints)) || Number(values.defaultMaxPoints) <= 0) errors.push('Перевірте кількість балів')
  if (type === 'CATEGORIZATION') {
    const config = values.publicConfig as CategorizationPublicConfig
    const grading = values.gradingConfig as CategorizationGradingConfig
    if (config.categories.length < 2 || config.categories.some((value) => !value.title.trim())) errors.push('Заповніть щонайменше дві категорії')
    if (config.items.length < 2 || config.items.some((value) => !value.text.trim()) || grading.assignments.length !== config.items.length) errors.push('Заповніть і розподіліть щонайменше два елементи')
  }
  if (type === 'FILL_BLANKS') {
    const grading = values.gradingConfig as FillBlanksGradingConfig
    if (grading.blanks.length < 1 || grading.blanks.some((blank) => blank.acceptedAnswers.every((answer) => !answer.trim()))) errors.push('Додайте правильну відповідь для кожного пропуску')
  }
  if (type === 'IMAGE_HOTSPOT' && !getPromptImage(values.publicConfig) && !pendingImage) errors.push('Додайте зображення')
  return errors
}

function getPromptImage(config: PublicConfig): AssignmentPromptImage | null {
  return 'promptImage' in config ? config.promptImage ?? null : null
}

function patch(setter: React.Dispatch<React.SetStateAction<Values>>, next: Partial<Values>) {
  setter((current) => ({ ...current, ...next }))
}
