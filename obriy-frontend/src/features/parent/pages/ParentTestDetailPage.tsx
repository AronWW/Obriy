import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { assignmentImageUrl } from '../../assignments/api/assignments.api'
import type { StudentTestAnswer, StudentTestItem } from '../../tests/model/test.types'
import { parentApi } from '../api/parent.api'
import styles from './ParentLearningDetail.module.css'

const MapCanvas = lazy(() => import('../../maps/components/MapCanvas').then((module) => ({ default: module.MapCanvas })))

export function ParentTestDetailPage() {
  const { childId = '', releaseId = '' } = useParams()
  const [params] = useSearchParams()
  const attemptId = params.get('attempt') ?? ''
  const { i18n } = useTranslation()
  const copy = i18n.resolvedLanguage === 'en' ? en : uk
  const release = useQuery({ queryKey: ['parent', 'child', childId, 'test', releaseId], queryFn: () => parentApi.getChildTestRelease(childId, releaseId), enabled: Boolean(childId && releaseId) })
  const attempt = useQuery({ queryKey: ['parent', 'child', childId, 'attempt', attemptId], queryFn: () => parentApi.getChildTestAttempt(childId, attemptId), enabled: Boolean(childId && attemptId) })
  const selectedAttempt = attemptId ? attempt.data : release.data?.attempt
  const answers = new Map(selectedAttempt?.answers.map((answer) => [answer.testItemId, answer]) ?? [])
  if (release.isLoading || attempt.isLoading) return <State text={copy.loading} />
  if (release.isError || attempt.isError || !release.data) return <State text={copy.error} retry={() => { void release.refetch(); if (attemptId) void attempt.refetch() }} />
  return <div className={styles.page}>
    <Link className={styles.back} to={`/app/parent/child/${childId}/progress`}><ArrowLeft size={16} />{copy.back}</Link>
    <header className={styles.hero}><div><span>{release.data.isRequired ? copy.required : copy.optional}</span><h1>{release.data.title}</h1><p>{release.data.description}</p></div>{selectedAttempt && <div className={styles.result}><strong>{selectedAttempt.scorePercent === null ? '—' : `${Math.round(selectedAttempt.scorePercent * 100) / 100}%`}</strong><small>{copy.attempt} {selectedAttempt.attemptNumber}</small></div>}</header>
    {release.data.instructions && <p className={styles.instructions}>{release.data.instructions}</p>}
    <div className={styles.questions}>{release.data.items.map((item, index) => <Question copy={copy} item={item} answer={answers.get(item.id) ?? null} index={index} key={item.id} />)}</div>
  </div>
}

function Question({ answer, copy, index, item }: { answer: StudentTestAnswer | null; copy: typeof uk; index: number; item: StudentTestItem }) {
  const image = asRecord(item.publicConfig.promptImage)?.attachmentId
  return <article className={styles.question}>
    <header><span>{index + 1}</span><div><h2>{item.title}</h2><p>{item.prompt}</p></div><b>{item.maxPoints} {copy.points}</b></header>
    {item.instructions && <p className={styles.instructions}>{item.instructions}</p>}
    {typeof image === 'string' && <img className={styles.promptImage} alt={item.title} src={assignmentImageUrl(image)} />}
    <PublicMaterial item={item} />
    {item.mapPreset && <MapPreview item={item} answer={answer} />}
    {answer ? <section className={styles.answer}><h3>{copy.answer}</h3><pre>{formatValue(answer.responseData)}</pre><div className={styles.answerMeta}><span>{answer.status.replaceAll('_', ' ')}</span><strong>{answer.scorePoints === null ? '—' : `${answer.scorePoints}/${answer.maxPoints}`}</strong></div>{answer.teacherComment && <p><b>{copy.comment}:</b> {answer.teacherComment}</p>}{answer.solutionFeedback && <details><summary>{copy.solution}</summary><pre>{formatValue(answer.solutionFeedback)}</pre></details>}</section> : <p className={styles.noAnswer}>{copy.noAnswer}</p>}
  </article>
}

function PublicMaterial({ item }: { item: StudentTestItem }) {
  const config = item.publicConfig
  if (item.type === 'SINGLE_CHOICE' || item.type === 'MULTIPLE_CHOICE') return <ul className={styles.optionList}>{asArray(config.options).map((entry) => <li key={String(entry.id)}>{String(entry.text ?? '')}</li>)}</ul>
  if (item.type === 'MATCHING') return <div className={styles.columns}><ul>{asArray(config.leftItems).map((entry) => <li key={String(entry.id)}>{String(entry.text ?? '')}</li>)}</ul><ul>{asArray(config.rightItems).map((entry) => <li key={String(entry.id)}>{String(entry.text ?? '')}</li>)}</ul></div>
  if (item.type === 'ORDERING') return <ol className={styles.optionList}>{asArray(config.items).map((entry) => <li key={String(entry.id)}>{String(entry.text ?? '')}</li>)}</ol>
  if (item.type === 'CATEGORIZATION') return <div className={styles.columns}><ul>{asArray(config.categories).map((entry) => <li key={String(entry.id)}>{String(entry.title ?? '')}</li>)}</ul><ul>{asArray(config.items).map((entry) => <li key={String(entry.id)}>{String(entry.text ?? '')}</li>)}</ul></div>
  if (item.type === 'FILL_BLANKS') return <p className={styles.fillText}>{asArray(config.segments).map((entry) => entry.type === 'BLANK' ? ' ______ ' : String(entry.text ?? '')).join('')}</p>
  return null
}

function MapPreview({ answer, item }: { answer: StudentTestAnswer | null; item: StudentTestItem }) {
  if (!item.mapPreset) return null
  const projection = item.publicConfig.initialProjection === 'GLOBE' ? 'GLOBE' : 'MERCATOR'
  const response = answer?.responseData ?? {}
  const solution = asRecord(answer?.solutionFeedback)
  const point = typeof response.longitude === 'number' && typeof response.latitude === 'number' ? { longitude: response.longitude, latitude: response.latitude } : null
  const regions = Array.isArray(response.selectedRegionIds) ? response.selectedRegionIds.filter((value): value is string => typeof value === 'string') : typeof response.regionId === 'string' ? [response.regionId] : []
  const target = asRecord(solution?.target)
  const comparisonPoint = target && typeof target.longitude === 'number' && typeof target.latitude === 'number' ? { longitude: target.longitude, latitude: target.latitude } : null
  const comparisonRegionIds = Array.isArray(solution?.correctRegionIds) ? solution.correctRegionIds.filter((value): value is string => typeof value === 'string') : typeof solution?.correctRegionId === 'string' ? [solution.correctRegionId] : []
  const radiusKm = typeof solution?.radiusKm === 'number' ? solution.radiusKm : null
  return <div className={styles.map}><Suspense fallback={null}><MapCanvas comparisonPoint={comparisonPoint} comparisonRegionIds={comparisonRegionIds} point={point} pointKind="ANSWER" preset={item.mapPreset} projection={projection} radiusKm={radiusKm} selectedRegionIds={regions} variant="ASSIGNMENT" /></Suspense></div>
}

function asRecord(value: unknown): Record<string, unknown> | null { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null }
function asArray(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.map(asRecord).filter((value): value is Record<string, unknown> => value !== null) : [] }
function formatValue(value: unknown): string { if (typeof value === 'string') return value; return JSON.stringify(value, null, 2) }
function State({ text, retry }: { text: string; retry?: () => void }) { return <div className={styles.state}><p>{text}</p>{retry && <button onClick={retry}>Retry</button>}</div> }
const uk = { back: 'До прогресу', loading: 'Завантажуємо тест…', error: 'Не вдалося завантажити тест.', required: 'Обов’язковий тест', optional: 'Необов’язковий тест', attempt: 'Спроба', points: 'балів', answer: 'Відповідь дитини', noAnswer: 'Завершеної відповіді ще немає.', comment: 'Коментар учителя', solution: 'Правильне рішення' }
const en: typeof uk = { back: 'Back to progress', loading: 'Loading test…', error: 'Could not load the test.', required: 'Required test', optional: 'Optional test', attempt: 'Attempt', points: 'points', answer: 'Child’s answer', noAnswer: 'There is no submitted answer yet.', comment: 'Teacher comment', solution: 'Correct solution' }
