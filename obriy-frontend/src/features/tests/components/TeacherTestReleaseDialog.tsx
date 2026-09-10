import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Check, Copy, LockKeyhole, Play, RotateCcw, Settings2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../shared/api/api-client'
import { AssignmentDialog } from '../../assignments/components/AssignmentDialog'
import {
  closeTeacherTestRelease,
  listTeacherTestReleases,
  publishTeacherTestRelease,
  publishTeacherTestReleases,
  reopenTeacherTestRelease,
  updateTeacherTestRelease,
  updateTeacherTestReleases,
} from '../api/tests.api'
import { testQueryKeys } from '../model/test-query-keys'
import type {
  TeacherTestRelease,
  TestLatePolicy,
  UpdateTestReleaseSettingsInput,
} from '../model/test.types'
import styles from '../Tests.module.css'

interface ReleaseFormValues {
  isRequired: boolean
  availableFrom: string
  dueAt: string
  maxAttempts: string
  latePolicy: TestLatePolicy
  latePenaltyPercent: string
  xpReward: string
}

type ReleaseAction =
  | { type: 'save'; releaseId: string; settings: UpdateTestReleaseSettingsInput }
  | { type: 'copy'; releaseIds: string[]; settings: UpdateTestReleaseSettingsInput }
  | { type: 'publish'; releaseId: string }
  | { type: 'publishMany'; releaseIds: string[] }
  | { type: 'close'; releaseId: string }
  | { type: 'reopen'; releaseId: string }

export function TeacherTestReleaseDialog({
  lessonId,
  onClose,
  testId,
  title,
}: {
  lessonId: string
  onClose: () => void
  testId: string
  title: string
}) {
  const { i18n, t } = useTranslation()
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [values, setValues] = useState<ReleaseFormValues | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [validationError, setValidationError] = useState<string | null>(null)
  const query = useQuery({
    queryKey: testQueryKeys.lessonReleases(lessonId, testId),
    queryFn: () => listTeacherTestReleases(lessonId, testId),
  })
  const releases = useMemo(() => query.data ?? [], [query.data])
  const action = useMutation<
    TeacherTestRelease | TeacherTestRelease[],
    Error,
    ReleaseAction
  >({
    mutationFn: (input: ReleaseAction) => {
      if (input.type === 'save') {
        return updateTeacherTestRelease(input.releaseId, input.settings)
      }
      if (input.type === 'copy') {
        return updateTeacherTestReleases(
          lessonId,
          testId,
          input.releaseIds,
          input.settings,
        )
      }
      if (input.type === 'publish') {
        return publishTeacherTestRelease(input.releaseId)
      }
      if (input.type === 'publishMany') {
        return publishTeacherTestReleases(
          lessonId,
          testId,
          input.releaseIds,
        )
      }
      if (input.type === 'close') {
        return closeTeacherTestRelease(input.releaseId)
      }
      return reopenTeacherTestRelease(input.releaseId)
    },
    onSuccess: () => {
      setEditingId(null)
      setValues(null)
      setValidationError(null)
      void queryClient.invalidateQueries({
        queryKey: testQueryKeys.lessonReleases(lessonId, testId),
      })
      void queryClient.invalidateQueries({ queryKey: testQueryKeys.lesson(lessonId) })
    },
  })

  const selectedDraftIds = useMemo(
    () => releases.filter((release) => selected.has(release.id) && release.status === 'DRAFT').map((release) => release.id),
    [releases, selected],
  )

  const startEditing = (release: TeacherTestRelease) => {
    action.reset()
    setValidationError(null)
    setEditingId(release.id)
    setValues(toFormValues(release))
  }

  const submitSettings = (copyToAll: boolean) => {
    if (!editingId || !values) return
    if (copyToAll && !window.confirm(t('tests.releases.confirmCopy', { count: releases.length }))) return
    const parsed = parseSettings(values, t)
    if (typeof parsed === 'string') {
      setValidationError(parsed)
      return
    }
    setValidationError(null)
    action.mutate(
      copyToAll
        ? { type: 'copy', releaseIds: releases.map((release) => release.id), settings: parsed }
        : { type: 'save', releaseId: editingId, settings: parsed },
    )
  }

  return (
    <AssignmentDialog
      closeLabel={t('tests.common.close')}
      description={t('tests.releases.description', { title })}
      onClose={onClose}
      title={t('tests.releases.title')}
      wide
    >
      <div className={styles.releaseDialogBody}>
        {query.isLoading && <p className={styles.sectionState}>{t('tests.releases.loading')}</p>}
        {query.isError && (
          <div className={styles.sectionState} role="alert">
            <p>{t('tests.releases.loadError')}</p>
            <button className={styles.secondaryButton} onClick={() => void query.refetch()} type="button">
              {t('tests.common.retry')}
            </button>
          </div>
        )}
        {!query.isLoading && !query.isError && releases.length === 0 && (
          <div className={styles.releaseEmpty}>
            <CalendarClock size={24} aria-hidden="true" />
            <div>
              <strong>{t('tests.releases.emptyTitle')}</strong>
              <p>{t('tests.releases.emptyDescription')}</p>
            </div>
          </div>
        )}
        {releases.length > 0 && (
          <>
            <div className={styles.releaseToolbar}>
              <label>
                <input
                  checked={selected.size === releases.length}
                  onChange={(event) => setSelected(event.target.checked ? new Set(releases.map((release) => release.id)) : new Set())}
                  type="checkbox"
                />
                {t('tests.releases.selectAll')}
              </label>
              <button
                className={styles.primaryButton}
                disabled={action.isPending || selectedDraftIds.length === 0}
                onClick={() => {
                  if (window.confirm(t('tests.releases.confirmPublishMany', { count: selectedDraftIds.length }))) {
                    action.mutate({ type: 'publishMany', releaseIds: selectedDraftIds })
                  }
                }}
                type="button"
              >
                <Play size={16} aria-hidden="true" />
                {t('tests.releases.publishSelected', { count: selectedDraftIds.length })}
              </button>
            </div>
            <div className={styles.releaseList}>
              {releases.map((release) => (
                <article className={styles.releaseCard} key={release.id}>
                  <label className={styles.releaseSelect}>
                    <input
                      checked={selected.has(release.id)}
                      onChange={(event) => {
                        setSelected((current) => {
                          const next = new Set(current)
                          if (event.target.checked) next.add(release.id)
                          else next.delete(release.id)
                          return next
                        })
                      }}
                      type="checkbox"
                    />
                    <span className="sr-only">{t('tests.releases.selectClass', { name: release.class.name })}</span>
                  </label>
                  <div className={styles.releaseSummary}>
                    <div className={styles.releaseTitleRow}>
                      <h3>{release.class.name}</h3>
                      <span className={`${styles.releaseStatus} ${styles[`releaseStatus${release.status}`]}`}>
                        {t(`tests.releases.status.${release.status}`)}
                      </span>
                    </div>
                    <div className={styles.releaseFacts}>
                      <span>{release.isRequired ? t('tests.releases.required') : t('tests.releases.optional')}</span>
                      <span>{release.availableFrom ? t('tests.releases.opensAt', { date: formatDate(release.availableFrom, i18n.resolvedLanguage) }) : t('tests.releases.opensNow')}</span>
                      <span>{release.dueAt ? t('tests.releases.dueAt', { date: formatDate(release.dueAt, i18n.resolvedLanguage) }) : t('tests.releases.noDeadline')}</span>
                      <span>{release.maxAttempts === null ? t('tests.releases.unlimitedAttempts') : t('tests.releases.attempts', { count: release.maxAttempts })}</span>
                      <span>{t('tests.releases.xp', { count: release.xpReward })}</span>
                    </div>
                    {(release.attemptCount > 0 || release.inProgressCount > 0) && (
                      <small>{t('tests.releases.activity', { attempts: release.attemptCount, active: release.inProgressCount })}</small>
                    )}
                  </div>
                  <div className={styles.releaseActions}>
                    <button disabled={action.isPending} onClick={() => startEditing(release)} type="button">
                      <Settings2 size={15} aria-hidden="true" />
                      {t('tests.releases.configure')}
                    </button>
                    {release.status === 'DRAFT' && (
                      <button
                        disabled={action.isPending}
                        onClick={() => {
                          if (window.confirm(t('tests.releases.confirmPublish', { name: release.class.name }))) action.mutate({ type: 'publish', releaseId: release.id })
                        }}
                        type="button"
                      >
                        <Play size={15} aria-hidden="true" />
                        {t('tests.releases.publish')}
                      </button>
                    )}
                    {(release.status === 'ACTIVE' || release.status === 'SCHEDULED') && (
                      <button
                        disabled={action.isPending}
                        onClick={() => {
                          if (window.confirm(t('tests.releases.confirmClose', { name: release.class.name }))) action.mutate({ type: 'close', releaseId: release.id })
                        }}
                        type="button"
                      >
                        <LockKeyhole size={15} aria-hidden="true" />
                        {t('tests.releases.close')}
                      </button>
                    )}
                    {release.status === 'CLOSED' && (
                      <button
                        disabled={action.isPending}
                        onClick={() => {
                          if (window.confirm(t('tests.releases.confirmReopen', { name: release.class.name }))) action.mutate({ type: 'reopen', releaseId: release.id })
                        }}
                        type="button"
                      >
                        <RotateCcw size={15} aria-hidden="true" />
                        {t('tests.releases.reopen')}
                      </button>
                    )}
                  </div>
                  {editingId === release.id && values && (
                    <ReleaseSettingsForm
                      allCount={releases.length}
                      disabled={action.isPending}
                      error={validationError ?? (action.isError ? releaseError(action.error, t) : null)}
                      onCancel={() => { setEditingId(null); setValues(null); setValidationError(null); action.reset() }}
                      onChange={setValues}
                      onSubmit={submitSettings}
                      values={values}
                    />
                  )}
                </article>
              ))}
            </div>
          </>
        )}
        {action.isError && editingId === null && (
          <p className={styles.inlineError} role="alert">{releaseError(action.error, t)}</p>
        )}
      </div>
    </AssignmentDialog>
  )
}

function ReleaseSettingsForm({ allCount, disabled, error, onCancel, onChange, onSubmit, values }: {
  allCount: number
  disabled: boolean
  error: string | null
  onCancel: () => void
  onChange: (values: ReleaseFormValues) => void
  onSubmit: (copyToAll: boolean) => void
  values: ReleaseFormValues
}) {
  const { t } = useTranslation()
  const set = <K extends keyof ReleaseFormValues>(key: K, value: ReleaseFormValues[K]) => onChange({ ...values, [key]: value })
  return (
    <div className={styles.releaseForm}>
      <label className={styles.releaseCheckbox}>
        <input checked={values.isRequired} disabled={disabled} onChange={(event) => set('isRequired', event.target.checked)} type="checkbox" />
        <span><strong>{t('tests.releases.form.required')}</strong><small>{t('tests.releases.form.requiredHint')}</small></span>
      </label>
      <div className={styles.releaseFormGrid}>
        <label><span>{t('tests.releases.form.availableFrom')}</span><input disabled={disabled} onChange={(event) => set('availableFrom', event.target.value)} type="datetime-local" value={values.availableFrom} /></label>
        <label><span>{t('tests.releases.form.dueAt')}</span><input disabled={disabled} onChange={(event) => set('dueAt', event.target.value)} type="datetime-local" value={values.dueAt} /></label>
        <label><span>{t('tests.releases.form.maxAttempts')}</span><input disabled={disabled} max="100" min="1" onChange={(event) => set('maxAttempts', event.target.value)} placeholder={t('tests.releases.form.unlimited')} type="number" value={values.maxAttempts} /></label>
        <label><span>{t('tests.releases.form.latePolicy')}</span><select disabled={disabled} onChange={(event) => set('latePolicy', event.target.value as TestLatePolicy)} value={values.latePolicy}><option value="DISALLOW">{t('tests.releases.policy.DISALLOW')}</option><option value="ALLOW">{t('tests.releases.policy.ALLOW')}</option><option value="ALLOW_WITH_PENALTY">{t('tests.releases.policy.ALLOW_WITH_PENALTY')}</option></select></label>
        {values.latePolicy === 'ALLOW_WITH_PENALTY' && <label><span>{t('tests.releases.form.penalty')}</span><input disabled={disabled} max="100" min="0" onChange={(event) => set('latePenaltyPercent', event.target.value)} type="number" value={values.latePenaltyPercent} /></label>}
        <label><span>{t('tests.releases.form.xp')}</span><input disabled={disabled} max="1000" min="0" onChange={(event) => set('xpReward', event.target.value)} type="number" value={values.xpReward} /></label>
      </div>
      {error && <p className={styles.inlineError} role="alert">{error}</p>}
      <div className={styles.releaseFormActions}>
        <button className={styles.secondaryButton} disabled={disabled} onClick={onCancel} type="button">{t('tests.common.cancel')}</button>
        {allCount > 1 && <button className={styles.secondaryButton} disabled={disabled} onClick={() => onSubmit(true)} type="button"><Copy size={15} aria-hidden="true" />{t('tests.releases.form.saveAll')}</button>}
        <button className={styles.primaryButton} disabled={disabled} onClick={() => onSubmit(false)} type="button"><Check size={15} aria-hidden="true" />{t('tests.releases.form.save')}</button>
      </div>
    </div>
  )
}

function toFormValues(release: TeacherTestRelease): ReleaseFormValues {
  return {
    isRequired: release.isRequired,
    availableFrom: toLocalInput(release.availableFrom),
    dueAt: toLocalInput(release.dueAt),
    maxAttempts: release.maxAttempts === null ? '' : String(release.maxAttempts),
    latePolicy: release.latePolicy,
    latePenaltyPercent: release.latePenaltyPercent === null ? '' : String(release.latePenaltyPercent),
    xpReward: String(release.xpReward),
  }
}

function parseSettings(values: ReleaseFormValues, t: (key: string) => string): UpdateTestReleaseSettingsInput | string {
  const maxAttempts = values.maxAttempts === '' ? null : Number(values.maxAttempts)
  const penalty = values.latePenaltyPercent === '' ? null : Number(values.latePenaltyPercent)
  const xpReward = Number(values.xpReward)
  const availableFrom = values.availableFrom ? new Date(values.availableFrom) : null
  const dueAt = values.dueAt ? new Date(values.dueAt) : null
  if (maxAttempts !== null && (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 100)) return t('tests.releases.validation.attempts')
  if (!Number.isInteger(xpReward) || xpReward < 0 || xpReward > 1000) return t('tests.releases.validation.xp')
  if (values.latePolicy === 'ALLOW_WITH_PENALTY' && (penalty === null || !Number.isInteger(penalty) || penalty < 0 || penalty > 100)) return t('tests.releases.validation.penalty')
  if (availableFrom && dueAt && availableFrom >= dueAt) return t('tests.releases.validation.dates')
  return {
    isRequired: values.isRequired,
    availableFrom: availableFrom?.toISOString() ?? null,
    dueAt: dueAt?.toISOString() ?? null,
    maxAttempts,
    latePolicy: values.latePolicy,
    latePenaltyPercent: values.latePolicy === 'ALLOW_WITH_PENALTY' ? penalty : null,
    xpReward,
  }
}

function toLocalInput(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatDate(value: string, language?: string): string {
  return new Intl.DateTimeFormat(language ?? 'uk', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function releaseError(error: Error | null, t: (key: string) => string): string {
  if (error instanceof ApiError) {
    const known: Record<string, string> = {
      TEST_RELEASE_DATE_ORDER_INVALID: 'dates',
      TEST_RELEASE_PENALTY_REQUIRED: 'penalty',
      TEST_RELEASE_ALREADY_STARTED: 'alreadyStarted',
      TEST_RELEASE_ATTEMPT_LIMIT_TOO_LOW: 'attemptLimit',
      TEST_RELEASE_DEADLINE_PASSED: 'deadlinePassed',
      TEST_RELEASE_LESSON_NOT_PUBLISHED: 'lessonNotPublished',
    }
    const key = known[error.code]
    if (key) return t(`tests.releases.errors.${key}`)
  }
  return t('tests.releases.errors.action')
}
