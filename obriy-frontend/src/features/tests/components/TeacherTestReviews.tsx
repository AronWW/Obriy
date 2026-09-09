import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import {
  Box,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Map as MapIcon,
  UserRound,
} from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../shared/api/api-client'
import { assignmentImageUrl } from '../../assignments/api/assignments.api'
import { AssignmentDialog } from '../../assignments/components/AssignmentDialog'
import { listLessonTestReviews, reviewTestAnswer } from '../api/tests.api'
import { testQueryKeys } from '../model/test-query-keys'
import type {
  TeacherTestAnswerReview,
  TeacherTestAttemptReview,
  TeacherTestReviewList,
  TestAttemptStatus,
} from '../model/test.types'
import type {
  MapPoint,
  MapProjection,
  MapRegionOption,
} from '../../maps/model/map.types'
import styles from '../Tests.module.css'

const MapCanvas = lazy(() =>
  import('../../maps/components/MapCanvas').then((module) => ({
    default: module.MapCanvas,
  })),
)

type ReviewFilter =
  'ALL' | Extract<TestAttemptStatus, 'AWAITING_REVIEW' | 'GRADED' | 'RETURNED'>

export function TeacherTestReviews({ lessonId }: { lessonId: string }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<ReviewFilter>('ALL')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const query = useInfiniteQuery({
    queryKey: testQueryKeys.reviews(lessonId),
    queryFn: ({ pageParam }) => listLessonTestReviews(lessonId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  const reviews = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  )
  const selected =
    reviews.find((review) => review.attemptId === selectedId) ?? null
  const filtered =
    filter === 'ALL'
      ? reviews
      : reviews.filter((review) => review.status === filter)
  const counts = {
    ALL: reviews.length,
    AWAITING_REVIEW: reviews.filter(
      (review) => review.status === 'AWAITING_REVIEW',
    ).length,
    GRADED: reviews.filter((review) => review.status === 'GRADED').length,
    RETURNED: reviews.filter((review) => review.status === 'RETURNED').length,
  }
  return (
    <section
      className={styles.testReviews}
      aria-labelledby="test-reviews-title"
    >
      <header className={styles.testReviewsHeader}>
        <div>
          <h2 id="test-reviews-title">{t('tests.reviews.title')}</h2>
          <p>{t('tests.reviews.description')}</p>
        </div>
        {counts.AWAITING_REVIEW > 0 && (
          <span className={styles.pendingBadge}>
            {t('tests.reviews.pendingCount', { count: counts.AWAITING_REVIEW })}
          </span>
        )}
      </header>
      {query.isLoading && (
        <p className={styles.sectionState}>{t('tests.reviews.loading')}</p>
      )}
      {query.isError && (
        <div className={styles.sectionState} role="alert">
          <p>{t('tests.reviews.loadError')}</p>
          <button
            className={styles.secondaryButton}
            onClick={() => void query.refetch()}
            type="button"
          >
            {t('tests.common.retry')}
          </button>
        </div>
      )}
      {!query.isLoading && !query.isError && reviews.length === 0 && (
        <div className={styles.lessonEmpty}>
          <ClipboardCheck size={27} />
          <div>
            <strong>{t('tests.reviews.emptyTitle')}</strong>
            <p>{t('tests.reviews.emptyDescription')}</p>
          </div>
        </div>
      )}
      {reviews.length > 0 && (
        <>
          <div
            className={styles.reviewFilters}
            aria-label={t('tests.reviews.filtersLabel')}
          >
            {(['ALL', 'AWAITING_REVIEW', 'GRADED', 'RETURNED'] as const).map(
              (value) => (
                <button
                  aria-pressed={filter === value}
                  key={value}
                  onClick={() => setFilter(value)}
                  type="button"
                >
                  {t(`tests.reviews.filters.${value}`)}
                  <span>{counts[value]}</span>
                </button>
              ),
            )}
          </div>
          {filtered.length === 0 ? (
            <p className={styles.sectionState}>
              {t('tests.reviews.filterEmpty')}
            </p>
          ) : (
            <div className={styles.reviewAttemptList}>
              {filtered.map((review) => (
                <ReviewAttemptRow
                  key={review.attemptId}
                  onOpen={() => setSelectedId(review.attemptId)}
                  review={review}
                />
              ))}
            </div>
          )}
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
        </>
      )}
      {selected && (
        <ReviewAttemptDialog
          lessonId={lessonId}
          onClose={() => setSelectedId(null)}
          review={selected}
        />
      )}
    </section>
  )
}

function ReviewAttemptRow({
  onOpen,
  review,
}: {
  onOpen: () => void
  review: TeacherTestAttemptReview
}) {
  const { t } = useTranslation()
  return (
    <article className={styles.reviewAttemptRow}>
      <span className={styles.reviewAvatar}>
        <UserRound size={19} />
      </span>
      <div className={styles.reviewAttemptCopy}>
        <div>
          <span>{review.studentName}</span>
          <span>{review.className}</span>
          {review.submittedAt && (
            <span>
              <Clock3 size={13} />
              {formatDate(review.submittedAt)}
            </span>
          )}
        </div>
        <h3>{review.testTitle}</h3>
        <p>
          {t('tests.reviews.attemptSummary', {
            attempt: review.attemptNumber,
            pending: review.pendingReviewCount,
            total: review.answers.length,
          })}
        </p>
      </div>
      <div className={styles.reviewAttemptAction}>
        <span
          className={`${styles.testState} ${styles[`attemptState${review.status}`]}`}
        >
          {t(`tests.reviews.status.${review.status}`)}
        </span>
        {review.scorePoints !== null && (
          <small>
            {t('tests.student.score', {
              score: review.scorePoints,
              max: review.maxPoints,
            })}
          </small>
        )}
        <button
          className={styles.secondaryButton}
          onClick={onOpen}
          type="button"
        >
          {t(
            review.status === 'AWAITING_REVIEW'
              ? 'tests.reviews.review'
              : 'tests.reviews.view',
          )}
        </button>
      </div>
    </article>
  )
}

function ReviewAttemptDialog({
  lessonId,
  onClose,
  review,
}: {
  lessonId: string
  onClose: () => void
  review: TeacherTestAttemptReview
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: ({
      answerId,
      decision,
      scorePoints,
      teacherComment,
    }: ReviewInput) =>
      reviewTestAnswer(answerId, { decision, scorePoints, teacherComment }),
    onSuccess: (updated) => {
      queryClient.setQueryData<InfiniteData<TeacherTestReviewList>>(
        testQueryKeys.reviews(lessonId),
        (current) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  items: page.items.map((entry) =>
                    entry.attemptId === updated.attemptId ? updated : entry,
                  ),
                })),
              }
            : current,
      )
      setEditingAnswerId(null)
    },
  })
  return (
    <AssignmentDialog
      closeLabel={t('tests.common.close')}
      description={t('tests.reviews.dialogDescription', {
        student: review.studentName,
        class: review.className,
        attempt: review.attemptNumber,
      })}
      onClose={onClose}
      title={review.testTitle}
      wide
    >
      <div className={styles.reviewDialogBody}>
        <div className={styles.reviewSummary}>
          <span
            className={`${styles.testState} ${styles[`attemptState${review.status}`]}`}
          >
            {t(`tests.reviews.status.${review.status}`)}
          </span>
          <strong>
            {review.scorePoints === null
              ? t('tests.reviews.notFinal')
              : t('tests.student.score', {
                  score: review.scorePoints,
                  max: review.maxPoints,
                })}
          </strong>
        </div>
        <div className={styles.reviewAnswerList}>
          {review.answers.map((answer, index) => (
            <ReviewAnswerCard
              answer={answer}
              index={index}
              key={answer.answerId}
              mutationError={
                editingAnswerId === answer.answerId && mutation.isError
                  ? reviewError(mutation.error, t)
                  : null
              }
              onSubmit={(input) => {
                setEditingAnswerId(answer.answerId)
                mutation.mutate({ answerId: answer.answerId, ...input })
              }}
              pending={
                editingAnswerId === answer.answerId && mutation.isPending
              }
            />
          ))}
        </div>
      </div>
    </AssignmentDialog>
  )
}

interface ReviewInput {
  answerId: string
  decision: 'APPROVED' | 'RETURNED'
  scorePoints?: number
  teacherComment?: string | null
}

function ReviewAnswerCard({
  answer,
  index,
  mutationError,
  onSubmit,
  pending,
}: {
  answer: TeacherTestAnswerReview
  index: number
  mutationError: string | null
  onSubmit: (input: Omit<ReviewInput, 'answerId'>) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [score, setScore] = useState(
    answer.scorePoints === null
      ? String(answer.maxPoints)
      : String(answer.scorePoints),
  )
  const [comment, setComment] = useState(answer.teacherComment ?? '')
  const text =
    typeof answer.responseData.text === 'string' ? answer.responseData.text : ''
  const manual = answer.type === 'WRITTEN'
  const awaiting = manual && answer.status === 'AWAITING_REVIEW'
  const validScore =
    Number.isFinite(Number(score)) &&
    Number(score) >= 0 &&
    Number(score) <= answer.maxPoints
  return (
    <article className={styles.reviewAnswerCard}>
      <header>
        <span>{index + 1}</span>
        <div>
          <small>{t(`assignments.types.${answer.type}.title`)}</small>
          <h3>{answer.title}</h3>
        </div>
        <strong>
          {answer.scorePoints === null
            ? t('tests.library.points', { count: answer.maxPoints })
            : t('tests.student.score', {
                score: answer.scorePoints,
                max: answer.maxPoints,
              })}
        </strong>
      </header>
      <p className={styles.reviewPrompt}>{answer.prompt}</p>
      <div className={styles.reviewResponse}>
        <small>{t('tests.reviews.studentAnswer')}</small>
        {manual ? (
          <p>{text || t('tests.reviews.emptyAnswer')}</p>
        ) : (
          <ObjectiveReviewResponse answer={answer} />
        )}
      </div>
      {answer.teacherComment && !awaiting && (
        <p className={styles.teacherComment}>{answer.teacherComment}</p>
      )}
      {awaiting && (
        <div className={styles.reviewForm}>
          <label>
            <span>{t('tests.reviews.score')}</span>
            <input
              max={answer.maxPoints}
              min="0"
              onChange={(event) => setScore(event.target.value)}
              step="0.01"
              type="number"
              value={score}
            />
          </label>
          <label>
            <span>{t('tests.reviews.comment')}</span>
            <textarea
              maxLength={5000}
              onChange={(event) => setComment(event.target.value)}
              placeholder={t('tests.reviews.commentPlaceholder')}
              rows={3}
              value={comment}
            />
          </label>
          {mutationError && (
            <p className={styles.inlineError}>{mutationError}</p>
          )}
          <div>
            <button
              className={styles.secondaryButton}
              disabled={pending || !comment.trim()}
              onClick={() =>
                onSubmit({ decision: 'RETURNED', teacherComment: comment })
              }
              type="button"
            >
              {t('tests.reviews.return')}
            </button>
            <button
              className={styles.primaryButton}
              disabled={pending || !validScore}
              onClick={() =>
                onSubmit({
                  decision: 'APPROVED',
                  scorePoints: Number(score),
                  teacherComment: comment.trim() || null,
                })
              }
              type="button"
            >
              {pending ? t('tests.reviews.saving') : t('tests.reviews.approve')}
            </button>
          </div>
        </div>
      )}
      {!manual && (
        <p className={styles.autoGraded}>
          <CheckCircle2 size={15} />
          {t('tests.reviews.autoGraded')}
        </p>
      )}
    </article>
  )
}

function ObjectiveReviewResponse({
  answer,
}: {
  answer: TeacherTestAnswerReview
}) {
  const { t } = useTranslation()
  if (answer.type === 'SINGLE_CHOICE' || answer.type === 'MULTIPLE_CHOICE') {
    return (
      <div className={styles.reviewChoiceOptions}>
        {(answer.choiceOptions ?? []).map((option) => (
          <div
            className={option.correct ? styles.reviewChoiceCorrect : undefined}
            key={option.id}
          >
            <span>{option.text}</span>
            <small>
              {option.selected
                ? t('tests.reviews.optionSelected')
                : t('tests.reviews.optionNotSelected')}
              {' · '}
              {option.correct
                ? t('tests.reviews.optionCorrect')
                : t('tests.reviews.optionIncorrect')}
            </small>
          </div>
        ))}
      </div>
    )
  }
  if (answer.type === 'MATCHING') {
    const left = recordList(answer.publicConfig.leftItems)
    const right = new Map(
      recordList(answer.publicConfig.rightItems).map((item) => [
        stringField(item, 'id'),
        stringField(item, 'text'),
      ]),
    )
    const selected = pairMap(
      answer.responseData.matches,
      'leftItemId',
      'rightItemId',
    )
    const correct = pairMap(
      answer.gradingConfig.matches,
      'leftItemId',
      'rightItemId',
    )
    return (
      <div className={styles.reviewStructuredAnswer}>
        {left.map((item) => {
          const id = stringField(item, 'id')
          const selectedId = selected.get(id)
          const correctId = correct.get(id)
          return (
            <div data-correct={selectedId === correctId || undefined} key={id}>
              <strong>{stringField(item, 'text')}</strong>
              <span>
                {right.get(selectedId ?? '') || t('tests.reviews.emptyAnswer')}
              </span>
              <small>
                {t('tests.reviews.correctValue', {
                  value: right.get(correctId ?? '') ?? '—',
                })}
              </small>
            </div>
          )
        })}
      </div>
    )
  }
  if (answer.type === 'ORDERING') {
    const items = new Map(
      recordList(answer.publicConfig.items).map((item) => [
        stringField(item, 'id'),
        stringField(item, 'text'),
      ]),
    )
    const selected = stringList(answer.responseData.orderedItemIds)
    const correct = stringList(answer.gradingConfig.correctOrderIds)
    return (
      <SequenceReview
        selected={selected.map((id) => items.get(id) ?? id)}
        correct={correct.map((id) => items.get(id) ?? id)}
      />
    )
  }
  if (answer.type === 'CATEGORIZATION') {
    const categories = new Map(
      recordList(answer.publicConfig.categories).map((category) => [
        stringField(category, 'id'),
        stringField(category, 'title'),
      ]),
    )
    const selected = pairMap(
      answer.responseData.assignments,
      'itemId',
      'categoryId',
    )
    const correct = pairMap(
      answer.gradingConfig.assignments,
      'itemId',
      'categoryId',
    )
    return (
      <div className={styles.reviewStructuredAnswer}>
        {recordList(answer.publicConfig.items).map((item) => {
          const id = stringField(item, 'id')
          const selectedId = selected.get(id)
          const correctId = correct.get(id)
          return (
            <div data-correct={selectedId === correctId || undefined} key={id}>
              <strong>{stringField(item, 'text')}</strong>
              <span>
                {categories.get(selectedId ?? '') ||
                  t('tests.reviews.emptyAnswer')}
              </span>
              <small>
                {t('tests.reviews.correctValue', {
                  value: categories.get(correctId ?? '') ?? '—',
                })}
              </small>
            </div>
          )
        })}
      </div>
    )
  }
  if (answer.type === 'FILL_BLANKS') {
    const selected = pairMap(answer.responseData.answers, 'blankId', 'text')
    const correct = new Map(
      recordList(answer.gradingConfig.blanks).map((blank) => [
        stringField(blank, 'blankId'),
        stringList(blank.acceptedAnswers).join(', '),
      ]),
    )
    const blanks = recordList(answer.publicConfig.segments).filter(
      (segment) => segment.type === 'BLANK',
    )
    return (
      <div className={styles.reviewStructuredAnswer}>
        {blanks.map((blank, index) => {
          const id = stringField(blank, 'id')
          return (
            <div key={id}>
              <strong>
                {t('tests.reviews.blankNumber', { count: index + 1 })}
              </strong>
              <span>{selected.get(id) || t('tests.reviews.emptyAnswer')}</span>
              <small>
                {t('tests.reviews.correctValue', {
                  value: correct.get(id) ?? '—',
                })}
              </small>
            </div>
          )
        })}
      </div>
    )
  }
  if (answer.type === 'IMAGE_HOTSPOT') {
    const image = asRecord(answer.publicConfig.promptImage)
    const target = asRecord(answer.gradingConfig.target)
    const selectedX = numberField(answer.responseData, 'x')
    const selectedY = numberField(answer.responseData, 'y')
    const targetX = numberField(target, 'x')
    const targetY = numberField(target, 'y')
    const attachmentId = stringField(image, 'attachmentId')
    return (
      <div className={styles.reviewHotspotAnswer}>
        {attachmentId && (
          <div>
            <img alt={answer.title} src={assignmentImageUrl(attachmentId)} />
            {selectedX !== null && selectedY !== null && (
              <span
                className={styles.reviewHotspotSelected}
                style={{
                  left: `${selectedX * 100}%`,
                  top: `${selectedY * 100}%`,
                }}
              />
            )}
            {targetX !== null && targetY !== null && (
              <span
                className={styles.reviewHotspotCorrect}
                style={{ left: `${targetX * 100}%`, top: `${targetY * 100}%` }}
              />
            )}
          </div>
        )}
        <small>
          {t('tests.reviews.hotspotResult', {
            selected: formatPoint(selectedX, selectedY),
            correct: formatPoint(targetX, targetY),
          })}
        </small>
      </div>
    )
  }
  if (answer.type === 'MAP_POINT') {
    return <MapPointReview answer={answer} />
  }
  if (answer.type === 'MAP_REGION') {
    return <MapRegionReview answer={answer} />
  }
  if (answer.type === 'MAP_MULTI_REGION') {
    return <MapMultiRegionReview answer={answer} />
  }
  return (
    <pre className={styles.reviewRawAnswer}>
      {JSON.stringify(answer.responseData, null, 2)}
    </pre>
  )
}

function MapPointReview({ answer }: { answer: TeacherTestAnswerReview }) {
  const { t } = useTranslation()
  const [projection, setProjection] = useState<MapProjection>(() =>
    answer.publicConfig.initialProjection === 'GLOBE' ? 'GLOBE' : 'MERCATOR',
  )
  const target = asMapPoint(answer.gradingConfig.target)
  const studentPoint = asMapPoint(answer.responseData)
  const radiusKm = numberField(answer.gradingConfig, 'radiusKm')
  const distanceKm = numberField(answer.gradingData, 'distanceKm')
  if (!answer.mapPreset || !target || radiusKm === null) {
    return (
      <pre className={styles.reviewRawAnswer}>
        {JSON.stringify(answer.responseData, null, 2)}
      </pre>
    )
  }
  return (
    <div className={styles.mapResult}>
      <div className={styles.mapAnswerToolbar}>
        <div>
          <strong>{t('tests.reviews.mapResult')}</strong>
          <small>
            {t('tests.reviews.mapDistance', {
              distance: distanceKm ?? '—',
              radius: radiusKm,
            })}
          </small>
        </div>
        <div className={styles.mapProjectionToggle} role="group">
          <button
            aria-pressed={projection === 'MERCATOR'}
            onClick={() => setProjection('MERCATOR')}
            type="button"
          >
            <MapIcon size={14} aria-hidden="true" />
            {t('maps.projection.mercator')}
          </button>
          <button
            aria-pressed={projection === 'GLOBE'}
            onClick={() => setProjection('GLOBE')}
            type="button"
          >
            <Box size={14} aria-hidden="true" />
            {t('maps.projection.globe')}
          </button>
        </div>
      </div>
      <Suspense
        fallback={
          <div className={styles.mapAnswerFallback}>
            {t('maps.sandbox.loadingMap')}
          </div>
        }
      >
        <MapCanvas
          comparisonPoint={studentPoint}
          mapLabel={t('tests.reviews.mapLabel')}
          point={target}
          preset={answer.mapPreset}
          projection={projection}
          radiusKm={radiusKm}
          variant="ASSIGNMENT"
        />
      </Suspense>
    </div>
  )
}

function MapRegionReview({ answer }: { answer: TeacherTestAnswerReview }) {
  const { t } = useTranslation()
  const [projection, setProjection] = useState<MapProjection>(() =>
    answer.publicConfig.initialProjection === 'GLOBE' ? 'GLOBE' : 'MERCATOR',
  )
  const [regions, setRegions] = useState<MapRegionOption[]>([])
  const selectedRegionId = stringField(answer.responseData, 'regionId')
  const correctRegionId = stringField(answer.gradingConfig, 'correctRegionId')
  const selected = regions.find((region) => region.id === selectedRegionId)
  const correct = regions.find((region) => region.id === correctRegionId)
  if (!answer.mapPreset || !correctRegionId) {
    return (
      <pre className={styles.reviewRawAnswer}>
        {JSON.stringify(answer.responseData, null, 2)}
      </pre>
    )
  }
  return (
    <div className={styles.mapResult}>
      <div className={styles.mapAnswerToolbar}>
        <div>
          <strong>{t('tests.reviews.mapRegionResult')}</strong>
          <small>
            {t('tests.reviews.mapRegionSelection', {
              answer: selected?.name ?? (selectedRegionId || '—'),
              correct: correct?.name ?? correctRegionId,
            })}
          </small>
        </div>
        <div className={styles.mapProjectionToggle} role="group">
          <button
            aria-pressed={projection === 'MERCATOR'}
            onClick={() => setProjection('MERCATOR')}
            type="button"
          >
            <MapIcon size={14} aria-hidden="true" />
            {t('maps.projection.mercator')}
          </button>
          <button
            aria-pressed={projection === 'GLOBE'}
            onClick={() => setProjection('GLOBE')}
            type="button"
          >
            <Box size={14} aria-hidden="true" />
            {t('maps.projection.globe')}
          </button>
        </div>
      </div>
      <Suspense
        fallback={
          <div className={styles.mapAnswerFallback}>
            {t('maps.sandbox.loadingMap')}
          </div>
        }
      >
        <MapCanvas
          comparisonRegionIds={[correctRegionId]}
          mapLabel={t('tests.reviews.mapRegionLabel')}
          onRegionsLoad={setRegions}
          preset={answer.mapPreset}
          projection={projection}
          selectedRegionIds={selectedRegionId ? [selectedRegionId] : []}
          variant="ASSIGNMENT"
        />
      </Suspense>
    </div>
  )
}

function MapMultiRegionReview({
  answer,
}: {
  answer: TeacherTestAnswerReview
}) {
  const { t } = useTranslation()
  const [projection, setProjection] = useState<MapProjection>(() =>
    answer.publicConfig.initialProjection === 'GLOBE' ? 'GLOBE' : 'MERCATOR',
  )
  const [regions, setRegions] = useState<MapRegionOption[]>([])
  const selectedRegionIds = stringList(answer.responseData.selectedRegionIds)
  const correctRegionIds = stringList(answer.gradingConfig.correctRegionIds)
  const correctSelectedCount = numberField(
    answer.gradingData,
    'correctSelectedCount',
  )
  const incorrectSelectedCount = numberField(
    answer.gradingData,
    'incorrectSelectedCount',
  )
  const expectedCorrectCount = numberField(
    answer.gradingData,
    'expectedCorrectCount',
  )
  const scoringMode = stringField(answer.gradingConfig, 'scoringMode')
  if (!answer.mapPreset || correctRegionIds.length < 2) {
    return (
      <pre className={styles.reviewRawAnswer}>
        {JSON.stringify(answer.responseData, null, 2)}
      </pre>
    )
  }
  const names = new Map(regions.map((region) => [region.id, region.name]))
  return (
    <div className={styles.mapResult}>
      <div className={styles.mapAnswerToolbar}>
        <div>
          <strong>{t('tests.reviews.mapMultiRegionResult')}</strong>
          <small>
            {t('tests.reviews.mapMultiRegionSelection', {
              correct: correctSelectedCount ?? '—',
              expected: expectedCorrectCount ?? correctRegionIds.length,
              incorrect: incorrectSelectedCount ?? '—',
            })}
          </small>
          <small>
            {t('tests.reviews.mapMultiRegionMode', {
              mode: t(
                `assignments.mapMultiRegion.modes.${
                  scoringMode === 'PARTIAL' ? 'PARTIAL' : 'ALL_OR_NOTHING'
                }`,
              ),
            })}
          </small>
        </div>
        <div className={styles.mapProjectionToggle} role="group">
          <button
            aria-pressed={projection === 'MERCATOR'}
            onClick={() => setProjection('MERCATOR')}
            type="button"
          >
            <MapIcon size={14} aria-hidden="true" />
            {t('maps.projection.mercator')}
          </button>
          <button
            aria-pressed={projection === 'GLOBE'}
            onClick={() => setProjection('GLOBE')}
            type="button"
          >
            <Box size={14} aria-hidden="true" />
            {t('maps.projection.globe')}
          </button>
        </div>
      </div>
      <div className={styles.mapResultRegionLists}>
        <p>
          <strong>{t('tests.reviews.studentAnswer')}</strong>
          <span>
            {selectedRegionIds.map((id) => names.get(id) ?? id).join(', ') ||
              '—'}
          </span>
        </p>
        <p>
          <strong>{t('assignments.mapMultiRegion.mapTitle')}</strong>
          <span>
            {correctRegionIds.map((id) => names.get(id) ?? id).join(', ')}
          </span>
        </p>
      </div>
      <Suspense
        fallback={
          <div className={styles.mapAnswerFallback}>
            {t('maps.sandbox.loadingMap')}
          </div>
        }
      >
        <MapCanvas
          comparisonRegionIds={correctRegionIds}
          mapLabel={t('tests.reviews.mapMultiRegionLabel')}
          onRegionsLoad={setRegions}
          preset={answer.mapPreset}
          projection={projection}
          selectedRegionIds={selectedRegionIds}
          variant="ASSIGNMENT"
        />
      </Suspense>
    </div>
  )
}

function SequenceReview({
  selected,
  correct,
}: {
  selected: string[]
  correct: string[]
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.reviewSequence}>
      <div>
        <strong>{t('tests.reviews.studentSequence')}</strong>
        <ol>
          {selected.map((value, index) => (
            <li key={`${value}-${index}`}>{value}</li>
          ))}
        </ol>
      </div>
      <div>
        <strong>{t('tests.reviews.correctSequence')}</strong>
        <ol>
          {correct.map((value, index) => (
            <li key={`${value}-${index}`}>{value}</li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function recordList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : []
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function stringField(value: unknown, field: string): string {
  const record = asRecord(value)
  return typeof record[field] === 'string' ? record[field] : ''
}

function numberField(value: unknown, field: string): number | null {
  const record = asRecord(value)
  return typeof record[field] === 'number' && Number.isFinite(record[field])
    ? record[field]
    : null
}

function asMapPoint(value: unknown): MapPoint | null {
  const point = asRecord(value)
  const longitude = numberField(point, 'longitude')
  const latitude = numberField(point, 'latitude')
  return longitude === null || latitude === null
    ? null
    : { longitude, latitude }
}

function pairMap(
  value: unknown,
  left: string,
  right: string,
): Map<string, string> {
  return new Map(
    recordList(value).flatMap((item) => {
      const leftValue = stringField(item, left)
      const rightValue = stringField(item, right)
      return leftValue && rightValue ? [[leftValue, rightValue] as const] : []
    }),
  )
}

function formatPoint(x: number | null, y: number | null): string {
  return x === null || y === null
    ? '—'
    : `${Math.round(x * 100)}%, ${Math.round(y * 100)}%`
}

function reviewError(error: Error | null, t: (key: string) => string): string {
  if (error instanceof ApiError && error.code === 'TEST_ANSWER_NOT_REVIEWABLE')
    return t('tests.reviews.errors.stale')
  return t('tests.reviews.errors.action')
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
