import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  CircleDot,
  Link2,
  ListOrdered,
  ListChecks,
  PenLine,
  Plus,
  Save,
  Settings2,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { listAssignments } from '../../assignments/api/assignments.api'
import { AssignmentConfirmDialog } from '../../assignments/components/AssignmentConfirmDialog'
import { AssignmentDialog } from '../../assignments/components/AssignmentDialog'
import type { AssignmentType } from '../../assignments/model/assignment.types'
import { registerWorkspaceNavigationGuard } from '../../../shared/navigation/workspace-navigation-guard'
import {
  addTestItem,
  createTest,
  getTest,
  removeTestItem,
  reorderTestItems,
  startTestEdit,
  updateTestDraft,
  updateTestItem,
  updateTestItemRevision,
} from '../api/tests.api'
import { testQueryKeys } from '../model/test-query-keys'
import type { TestEditor, TestItem, TestRevision } from '../model/test.types'
import styles from '../Tests.module.css'

interface EditorValues {
  title: string
  description: string
  instructions: string
  passingPercent: string
  maxAttempts: string
  timeLimitMinutes: string
  scorePolicy: 'BEST' | 'LATEST'
  shuffleItems: boolean
}

const emptyValues: EditorValues = {
  title: '',
  description: '',
  instructions: '',
  passingPercent: '100',
  maxAttempts: '1',
  timeLimitMinutes: '',
  scorePolicy: 'BEST',
  shuffleItems: false,
}

export function TeacherTestEditorPage() {
  const { testId } = useParams()
  const isNew = !testId
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [values, setValues] = useState(emptyValues)
  const valuesRef = useRef(values)
  const [savedHash, setSavedHash] = useState(() => JSON.stringify(emptyValues))
  const [hydrated, setHydrated] = useState(isNew)
  const [showPicker, setShowPicker] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    valuesRef.current = values
  }, [values])
  const testQuery = useQuery({
    queryKey: testQueryKeys.detail(testId ?? ''),
    queryFn: () => getTest(testId ?? ''),
    enabled: Boolean(testId),
  })
  useEffect(() => {
    if (!testQuery.data || hydrated) return
    const next = testToValues(testQuery.data)
    // Remote data initializes the local explicit-save metadata buffer once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(next)
    setSavedHash(JSON.stringify(next))
    setSaveState('saved')
    setHydrated(true)
  }, [hydrated, testQuery.data])

  const currentHash = JSON.stringify(values)
  const isDirty = currentHash !== savedHash
  const revision = testQuery.data?.draftRevision ?? testQuery.data?.publishedRevision
  const isArchived = testQuery.data?.status === 'ARCHIVED'
  const validation = useMemo(() => validateValues(values, t), [t, values])
  const busy = saveState === 'saving'

  const saveMutation = useMutation({
    mutationFn: async (snapshot: EditorValues) => {
      if (!testId) {
        return createTest({
          title: snapshot.title,
          description: snapshot.description,
          instructions: snapshot.instructions.trim() ? snapshot.instructions : null,
          passingPercent: Number(snapshot.passingPercent),
          maxAttempts: snapshot.maxAttempts ? Number(snapshot.maxAttempts) : null,
          timeLimitSeconds: snapshot.timeLimitMinutes
            ? Number(snapshot.timeLimitMinutes) * 60
            : null,
          scorePolicy: snapshot.scorePolicy,
          shuffleItems: snapshot.shuffleItems,
        })
      }
      const editor = await ensureDraft(testQuery.data ?? (await getTest(testId)))
      const draft = requireDraft(editor)
      return updateTestDraft(testId, {
        expectedRevisionId: draft.id,
        expectedEditVersion: draft.editVersion,
        title: snapshot.title,
        description: snapshot.description,
        instructions: snapshot.instructions.trim() ? snapshot.instructions : null,
        passingPercent: Number(snapshot.passingPercent),
        maxAttempts: snapshot.maxAttempts ? Number(snapshot.maxAttempts) : null,
        timeLimitSeconds: snapshot.timeLimitMinutes
          ? Number(snapshot.timeLimitMinutes) * 60
          : null,
        scorePolicy: snapshot.scorePolicy,
        shuffleItems: snapshot.shuffleItems,
      })
    },
    onMutate: () => setSaveState('saving'),
    onSuccess: (editor, snapshot) => {
      const hash = JSON.stringify(snapshot)
      setSavedHash(hash)
      setSaveState(JSON.stringify(valuesRef.current) === hash ? 'saved' : 'idle')
      queryClient.setQueryData(testQueryKeys.detail(editor.id), editor)
      void queryClient.invalidateQueries({ queryKey: testQueryKeys.lists })
      if (isNew) navigate(`/app/teacher/tests/${editor.id}/edit`, { replace: true })
    },
    onError: () => setSaveState('error'),
  })

  const itemMutation = useMutation({
    mutationFn: async (action: ItemAction) => {
      if (!testId) throw new Error('Save the test first')
      const editor = await ensureDraft(testQuery.data ?? (await getTest(testId)))
      const draft = requireDraft(editor)
      const version = {
        expectedRevisionId: draft.id,
        expectedEditVersion: draft.editVersion,
      }
      if (action.type === 'add') return addTestItem(testId, action.assignmentId, version)
      if (action.type === 'remove') return removeTestItem(testId, action.itemId, version)
      if (action.type === 'points') {
        return updateTestItem(testId, action.itemId, action.maxPoints, version)
      }
      if (action.type === 'updateRevision') {
        return updateTestItemRevision(testId, action.itemId, version)
      }
      return reorderTestItems(testId, action.itemIds, version)
    },
    onSuccess: (editor) => {
      queryClient.setQueryData(testQueryKeys.detail(editor.id), editor)
      void queryClient.invalidateQueries({ queryKey: testQueryKeys.lists })
      setShowPicker(false)
    },
  })

  const shouldWarn = isDirty || saveMutation.isPending
  useEffect(() => {
    if (!shouldWarn) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [shouldWarn])
  useEffect(() => {
    if (!shouldWarn) return
    return registerWorkspaceNavigationGuard(setPendingNavigation)
  }, [shouldWarn])

  const leaveEditor = (target = '/app/teacher/tests') => {
    if (shouldWarn) {
      setPendingNavigation(target)
      return
    }
    navigate(target)
  }

  if (testQuery.isLoading && testId) return <Status message={t('tests.editor.loading')} />
  if (testQuery.isError) {
    return (
      <Status
        action={t('tests.common.retry')}
        message={t('tests.editor.error')}
        onAction={() => void testQuery.refetch()}
      />
    )
  }

  const items = revision?.items ?? []
  const canSave =
    isDirty &&
    validation.length === 0 &&
    Boolean(values.title.trim()) &&
    !busy &&
    !isArchived

  return (
    <section className={styles.page}>
      <div className={`${styles.content} ${styles.editorContent}`}>
        <header className={styles.editorHeader}>
          <button
            className={styles.iconButton}
            onClick={() => leaveEditor()}
            type="button"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>{values.title || t('tests.editor.newTitle')}</h1>
            <p>{t('tests.editor.description')}</p>
          </div>
          <button
            className={styles.primaryButton}
            disabled={!canSave}
            onClick={() => saveMutation.mutate(values)}
            type="button"
          >
            <Save size={16} />
            {saveMutation.isPending ? t('tests.editor.saving') : t('tests.editor.save')}
          </button>
        </header>

        <div className={styles.labLayout}>
          <aside className={styles.outlinePanel}>
            <div className={styles.panelHeading}>
              <div>
                <span>{t('tests.editor.questions')}</span>
                <strong>{items.length}</strong>
              </div>
              <button
                className={styles.iconButton}
                disabled={isNew || isArchived || itemMutation.isPending}
                onClick={() => setShowPicker(true)}
                title={t('tests.editor.addQuestion')}
                type="button"
              >
                <Plus size={17} />
              </button>
            </div>
            {items.length === 0 ? (
              <div className={styles.outlineEmpty}>
                <BookOpen size={24} />
                <p>{t('tests.editor.emptyQuestions')}</p>
              </div>
            ) : (
              <div className={styles.outlineList}>
                {items.map((item, index) => (
                  <TestItemRow
                    disabled={itemMutation.isPending || isArchived}
                    index={index}
                    item={item}
                    key={item.id}
                    onMove={(direction) => {
                      const target = index + direction
                      if (target < 0 || target >= items.length) return
                      const next = [...items]
                      ;[next[index], next[target]] = [next[target], next[index]]
                      itemMutation.mutate({
                        type: 'reorder',
                        itemIds: next.map((entry) => entry.id),
                      })
                    }}
                    onPoints={(maxPoints) =>
                      itemMutation.mutate({
                        type: 'points',
                        itemId: item.id,
                        maxPoints,
                      })
                    }
                    onRemove={() =>
                      itemMutation.mutate({ type: 'remove', itemId: item.id })
                    }
                    onUpdateRevision={() =>
                      itemMutation.mutate({
                        type: 'updateRevision',
                        itemId: item.id,
                      })
                    }
                  />
                ))}
              </div>
            )}
            <button
              className={styles.addQuestionButton}
              disabled={isNew || isArchived || itemMutation.isPending}
              onClick={() => setShowPicker(true)}
              type="button"
            >
              <Plus size={16} />
              {t('tests.editor.addQuestion')}
            </button>
          </aside>

          <main className={styles.settingsPanel}>
            <section className={styles.editorSection}>
              <div className={styles.sectionTitle}>
                <Settings2 size={18} />
                <div>
                  <h2>{t('tests.editor.mainSettings')}</h2>
                  <p>{t('tests.editor.mainSettingsDescription')}</p>
                </div>
              </div>
              <label className={styles.field}>
                <span>{t('tests.editor.fields.title')}</span>
                <input
                  disabled={isArchived}
                  maxLength={160}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, title: event.target.value }))
                  }
                  value={values.title}
                />
              </label>
              <label className={styles.field}>
                <span>{t('tests.editor.fields.description')}</span>
                <textarea
                  disabled={isArchived}
                  maxLength={500}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  value={values.description}
                />
              </label>
              <label className={styles.field}>
                <span>{t('tests.editor.fields.instructions')}</span>
                <textarea
                  disabled={isArchived}
                  maxLength={50_000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      instructions: event.target.value,
                    }))
                  }
                  rows={4}
                  value={values.instructions}
                />
              </label>
            </section>

            <section className={styles.editorSection}>
              <div className={styles.sectionTitle}>
                <ListChecks size={18} />
                <div>
                  <h2>{t('tests.editor.attemptSettings')}</h2>
                  <p>{t('tests.editor.attemptSettingsDescription')}</p>
                </div>
              </div>
              <div className={styles.settingsGrid}>
                <label className={styles.field}>
                  <span>{t('tests.editor.fields.passingPercent')}</span>
                  <input
                    disabled={isArchived}
                    max="100"
                    min="0"
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        passingPercent: event.target.value,
                      }))
                    }
                    type="number"
                    value={values.passingPercent}
                  />
                </label>
                <label className={styles.field}>
                  <span>{t('tests.editor.fields.maxAttempts')}</span>
                  <input
                    disabled={isArchived}
                    max="100"
                    min="1"
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        maxAttempts: event.target.value,
                      }))
                    }
                    placeholder={t('tests.editor.unlimited')}
                    type="number"
                    value={values.maxAttempts}
                  />
                </label>
                <label className={styles.field}>
                  <span>{t('tests.editor.fields.timeLimit')}</span>
                  <input
                    disabled={isArchived}
                    min="1"
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        timeLimitMinutes: event.target.value,
                      }))
                    }
                    placeholder={t('tests.editor.noLimit')}
                    type="number"
                    value={values.timeLimitMinutes}
                  />
                </label>
                <label className={styles.field}>
                  <span>{t('tests.editor.fields.scorePolicy')}</span>
                  <select
                    disabled={isArchived}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        scorePolicy: event.target.value as 'BEST' | 'LATEST',
                      }))
                    }
                    value={values.scorePolicy}
                  >
                    <option value="BEST">{t('tests.editor.scorePolicy.BEST')}</option>
                    <option value="LATEST">{t('tests.editor.scorePolicy.LATEST')}</option>
                  </select>
                </label>
              </div>
              <label className={styles.toggle}>
                <input
                  checked={values.shuffleItems}
                  disabled={isArchived}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      shuffleItems: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                <span>
                  <strong>{t('tests.editor.fields.shuffle')}</strong>
                  <small>{t('tests.editor.fields.shuffleHint')}</small>
                </span>
              </label>
            </section>

            <footer className={styles.editorFooter}>
              <div>
                <span>{t('tests.editor.total')}</span>
                <strong>
                  {t('tests.library.points', {
                    count: revision?.totalMaxPoints ?? 0,
                  })}
                </strong>
              </div>
              <div className={styles.saveState}>
                {isDirty
                  ? t('tests.editor.unsaved')
                  : saveState === 'error'
                    ? t('tests.editor.saveError')
                    : t('tests.editor.saved')}
              </div>
              <button
                className={styles.primaryButton}
                disabled={!canSave}
                onClick={() => saveMutation.mutate(values)}
                type="button"
              >
                <Save size={16} />
                {t('tests.editor.save')}
              </button>
            </footer>
            {validation.length > 0 && (
              <ul className={styles.validationList}>
                {validation.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            )}
            {itemMutation.isError && (
              <p className={styles.inlineError}>{t('tests.editor.itemError')}</p>
            )}
          </main>
        </div>
      </div>

      {showPicker && testId && testQuery.data && (
        <AssignmentPicker
          contentLocale={testQuery.data.contentLocale}
          excluded={new Set(items.map((item) => item.assignmentId))}
          onClose={() => setShowPicker(false)}
          onSelect={(assignmentId) =>
            itemMutation.mutate({ type: 'add', assignmentId })
          }
          pending={itemMutation.isPending}
        />
      )}
      {pendingNavigation && (
        <AssignmentConfirmDialog
          cancelLabel={t('tests.editor.discard.cancel')}
          confirmLabel={t('tests.editor.discard.confirm')}
          description={t('tests.editor.discard.description')}
          isDangerous
          onCancel={() => setPendingNavigation(null)}
          onConfirm={() => navigate(pendingNavigation)}
          title={t('tests.editor.discard.title')}
        />
      )}
    </section>
  )

  async function ensureDraft(editor: TestEditor): Promise<TestEditor> {
    if (editor.draftRevision) return editor
    const next = await startTestEdit(editor.id)
    queryClient.setQueryData(testQueryKeys.detail(editor.id), next)
    return next
  }
}

type ItemAction =
  | { type: 'add'; assignmentId: string }
  | { type: 'remove'; itemId: string }
  | { type: 'points'; itemId: string; maxPoints: number }
  | { type: 'updateRevision'; itemId: string }
  | { type: 'reorder'; itemIds: string[] }

function TestItemRow({
  disabled,
  index,
  item,
  onMove,
  onPoints,
  onRemove,
  onUpdateRevision,
}: {
  disabled: boolean
  index: number
  item: TestItem
  onMove: (direction: -1 | 1) => void
  onPoints: (points: number) => void
  onRemove: () => void
  onUpdateRevision: () => void
}) {
  const { t } = useTranslation()
  const [points, setPoints] = useState(String(item.maxPoints))
  return (
    <article className={styles.outlineItem}>
      <span className={styles.itemNumber}>{index + 1}</span>
      <span className={styles.itemIcon}>{assignmentIcon(item.assignmentType, 17)}</span>
      <div className={styles.itemCopy}>
        <small>{t(`assignments.types.${item.assignmentType}.title`)}</small>
        <strong>{item.title}</strong>
        <label>
          <input
            disabled={disabled}
            min="0.01"
            onChange={(event) => setPoints(event.target.value)}
            step="0.01"
            type="number"
            value={points}
          />
          <button
            disabled={disabled || Number(points) === item.maxPoints || Number(points) <= 0}
            onClick={() => onPoints(Number(points))}
            type="button"
          >
            {t('tests.editor.applyPoints')}
          </button>
        </label>
        {item.hasUpdate && (
          <button
            className={styles.itemUpdateButton}
            disabled={disabled}
            onClick={onUpdateRevision}
            type="button"
          >
            {t('tests.editor.updateAssignmentRevision')}
          </button>
        )}
      </div>
      <div className={styles.itemActions}>
        <button disabled={disabled || index === 0} onClick={() => onMove(-1)} type="button">
          <ArrowUp size={15} />
        </button>
        <button disabled={disabled} onClick={() => onMove(1)} type="button">
          <ArrowDown size={15} />
        </button>
        <button className={styles.danger} disabled={disabled} onClick={onRemove} type="button">
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  )
}

function AssignmentPicker({
  contentLocale,
  excluded,
  onClose,
  onSelect,
  pending,
}: {
  contentLocale: TestEditor['contentLocale']
  excluded: Set<string>
  onClose: () => void
  onSelect: (assignmentId: string) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const query = useInfiniteQuery({
    queryKey: ['assignments', 'test-picker', contentLocale],
    queryFn: ({ pageParam }) =>
      listAssignments({ contentLocale }, pageParam, 50),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  const assignments =
    query.data?.pages.flatMap((page) => page.items).filter((item) => !excluded.has(item.id)) ?? []
  return (
    <AssignmentDialog
      closeLabel={t('tests.common.close')}
      description={t('tests.picker.description')}
      onClose={onClose}
      title={t('tests.picker.title')}
      wide
    >
      <div className={styles.pickerGrid}>
        {assignments.map((assignment) => {
          const revision = assignment.draftRevision ?? assignment.publishedRevision
          return (
            <button
              disabled={pending}
              key={assignment.id}
              onClick={() => onSelect(assignment.id)}
              type="button"
            >
              <span>{assignmentIcon(assignment.type, 19)}</span>
              <div>
                <strong>{revision?.title || t('tests.common.untitled')}</strong>
                <small>{t(`assignments.types.${assignment.type}.title`)}</small>
              </div>
              <Plus size={16} />
            </button>
          )
        })}
      </div>
      {query.hasNextPage && (
        <button
          className={styles.loadMore}
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
          type="button"
        >
          {t('tests.library.more')}
        </button>
      )}
      {assignments.length === 0 && (
        <p className={styles.pickerEmpty}>{t('tests.picker.empty')}</p>
      )}
    </AssignmentDialog>
  )
}

function assignmentIcon(type: AssignmentType, size: number) {
  if (type === 'WRITTEN') return <PenLine size={size} />
  if (type === 'SINGLE_CHOICE') return <CircleDot size={size} />
  if (type === 'MATCHING') return <Link2 size={size} />
  if (type === 'ORDERING') return <ListOrdered size={size} />
  return <ListChecks size={size} />
}

function testToValues(test: TestEditor): EditorValues {
  const revision = test.draftRevision ?? test.publishedRevision
  return {
    title: revision?.title ?? '',
    description: revision?.description ?? '',
    instructions: revision?.instructions ?? '',
    passingPercent: String(revision?.passingPercent ?? 100),
    maxAttempts: revision?.maxAttempts === null ? '' : String(revision?.maxAttempts ?? 1),
    timeLimitMinutes:
      revision?.timeLimitSeconds === null || revision?.timeLimitSeconds === undefined
        ? ''
        : String(revision.timeLimitSeconds / 60),
    scorePolicy: revision?.scorePolicy ?? 'BEST',
    shuffleItems: revision?.shuffleItems ?? false,
  }
}

function requireDraft(editor: TestEditor): TestRevision {
  if (!editor.draftRevision) throw new Error('Test draft is unavailable')
  return editor.draftRevision
}

function validateValues(values: EditorValues, t: (key: string) => string): string[] {
  const issues: string[] = []
  const passing = Number(values.passingPercent)
  if (!Number.isFinite(passing) || passing < 0 || passing > 100) {
    issues.push(t('tests.editor.validation.passing'))
  }
  if (
    values.maxAttempts &&
    (Number(values.maxAttempts) < 1 || Number(values.maxAttempts) > 100)
  ) {
    issues.push(t('tests.editor.validation.attempts'))
  }
  if (values.timeLimitMinutes && Number(values.timeLimitMinutes) < 0.5) {
    issues.push(t('tests.editor.validation.time'))
  }
  return issues
}

function Status({ action, message, onAction }: { action?: string; message: string; onAction?: () => void }) {
  return (
    <section className={styles.page}>
      <div className={`${styles.content} ${styles.statusPanel}`}>
        <p>{message}</p>
        {action && onAction && <button onClick={onAction} type="button">{action}</button>}
      </div>
    </section>
  )
}
