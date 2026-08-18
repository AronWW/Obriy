import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { CheckCircle2, ClipboardCheck, Clock3, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../shared/api/api-client'
import { AssignmentDialog } from '../../assignments/components/AssignmentDialog'
import { listLessonTestReviews, reviewTestAnswer } from '../api/tests.api'
import { testQueryKeys } from '../model/test-query-keys'
import type { TeacherTestAnswerReview, TeacherTestAttemptReview, TeacherTestReviewList, TestAttemptStatus } from '../model/test.types'
import styles from '../Tests.module.css'

type ReviewFilter = 'ALL' | Extract<TestAttemptStatus, 'AWAITING_REVIEW' | 'GRADED' | 'RETURNED'>

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
  const reviews = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data])
  const selected = reviews.find((review) => review.attemptId === selectedId) ?? null
  const filtered = filter === 'ALL' ? reviews : reviews.filter((review) => review.status === filter)
  const counts = {
    ALL: reviews.length,
    AWAITING_REVIEW: reviews.filter((review) => review.status === 'AWAITING_REVIEW').length,
    GRADED: reviews.filter((review) => review.status === 'GRADED').length,
    RETURNED: reviews.filter((review) => review.status === 'RETURNED').length,
  }
  return (
    <section className={styles.testReviews} aria-labelledby="test-reviews-title">
      <header className={styles.testReviewsHeader}>
        <div>
          <p className={styles.eyebrow}><ClipboardCheck size={15} />{t('tests.reviews.eyebrow')}</p>
          <h2 id="test-reviews-title">{t('tests.reviews.title')}</h2>
          <p>{t('tests.reviews.description')}</p>
        </div>
        {counts.AWAITING_REVIEW > 0 && <span className={styles.pendingBadge}>{t('tests.reviews.pendingCount', { count: counts.AWAITING_REVIEW })}</span>}
      </header>
      {query.isLoading && <p className={styles.sectionState}>{t('tests.reviews.loading')}</p>}
      {query.isError && (
        <div className={styles.sectionState} role="alert"><p>{t('tests.reviews.loadError')}</p><button className={styles.secondaryButton} onClick={() => void query.refetch()} type="button">{t('tests.common.retry')}</button></div>
      )}
      {!query.isLoading && !query.isError && reviews.length === 0 && (
        <div className={styles.lessonEmpty}><ClipboardCheck size={27} /><div><strong>{t('tests.reviews.emptyTitle')}</strong><p>{t('tests.reviews.emptyDescription')}</p></div></div>
      )}
      {reviews.length > 0 && (
        <>
          <div className={styles.reviewFilters} aria-label={t('tests.reviews.filtersLabel')}>
            {(['ALL', 'AWAITING_REVIEW', 'GRADED', 'RETURNED'] as const).map((value) => (
              <button aria-pressed={filter === value} key={value} onClick={() => setFilter(value)} type="button">
                {t(`tests.reviews.filters.${value}`)}<span>{counts[value]}</span>
              </button>
            ))}
          </div>
          {filtered.length === 0 ? <p className={styles.sectionState}>{t('tests.reviews.filterEmpty')}</p> : (
            <div className={styles.reviewAttemptList}>
              {filtered.map((review) => <ReviewAttemptRow key={review.attemptId} onOpen={() => setSelectedId(review.attemptId)} review={review} />)}
            </div>
          )}
          {query.hasNextPage && (
            <button className={styles.loadMore} disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()} type="button">
              {t('tests.library.more')}
            </button>
          )}
        </>
      )}
      {selected && <ReviewAttemptDialog lessonId={lessonId} onClose={() => setSelectedId(null)} review={selected} />}
    </section>
  )
}

function ReviewAttemptRow({ onOpen, review }: { onOpen: () => void; review: TeacherTestAttemptReview }) {
  const { t } = useTranslation()
  return (
    <article className={styles.reviewAttemptRow}>
      <span className={styles.reviewAvatar}><UserRound size={19} /></span>
      <div className={styles.reviewAttemptCopy}>
        <div><span>{review.studentName}</span><span>{review.className}</span>{review.submittedAt && <span><Clock3 size={13} />{formatDate(review.submittedAt)}</span>}</div>
        <h3>{review.testTitle}</h3>
        <p>{t('tests.reviews.attemptSummary', { attempt: review.attemptNumber, pending: review.pendingReviewCount, total: review.answers.length })}</p>
      </div>
      <div className={styles.reviewAttemptAction}>
        <span className={`${styles.testState} ${styles[`attemptState${review.status}`]}`}>{t(`tests.reviews.status.${review.status}`)}</span>
        {review.scorePoints !== null && <small>{t('tests.student.score', { score: review.scorePoints, max: review.maxPoints })}</small>}
        <button className={styles.secondaryButton} onClick={onOpen} type="button">{t(review.status === 'AWAITING_REVIEW' ? 'tests.reviews.review' : 'tests.reviews.view')}</button>
      </div>
    </article>
  )
}

function ReviewAttemptDialog({ lessonId, onClose, review }: { lessonId: string; onClose: () => void; review: TeacherTestAttemptReview }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: ({ answerId, decision, scorePoints, teacherComment }: ReviewInput) => reviewTestAnswer(answerId, { decision, scorePoints, teacherComment }),
    onSuccess: (updated) => {
      queryClient.setQueryData<InfiniteData<TeacherTestReviewList>>(
        testQueryKeys.reviews(lessonId),
        (current) => current ? {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            items: page.items.map((entry) => entry.attemptId === updated.attemptId ? updated : entry),
          })),
        } : current,
      )
      setEditingAnswerId(null)
    },
  })
  return (
    <AssignmentDialog closeLabel={t('tests.common.close')} description={t('tests.reviews.dialogDescription', { student: review.studentName, class: review.className, attempt: review.attemptNumber })} onClose={onClose} title={review.testTitle} wide>
      <div className={styles.reviewDialogBody}>
        <div className={styles.reviewSummary}>
          <span className={`${styles.testState} ${styles[`attemptState${review.status}`]}`}>{t(`tests.reviews.status.${review.status}`)}</span>
          <strong>{review.scorePoints === null ? t('tests.reviews.notFinal') : t('tests.student.score', { score: review.scorePoints, max: review.maxPoints })}</strong>
        </div>
        <div className={styles.reviewAnswerList}>
          {review.answers.map((answer, index) => (
            <ReviewAnswerCard
              answer={answer}
              index={index}
              key={answer.answerId}
              mutationError={editingAnswerId === answer.answerId && mutation.isError ? reviewError(mutation.error, t) : null}
              onSubmit={(input) => { setEditingAnswerId(answer.answerId); mutation.mutate({ answerId: answer.answerId, ...input }) }}
              pending={editingAnswerId === answer.answerId && mutation.isPending}
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

function ReviewAnswerCard({ answer, index, mutationError, onSubmit, pending }: {
  answer: TeacherTestAnswerReview
  index: number
  mutationError: string | null
  onSubmit: (input: Omit<ReviewInput, 'answerId'>) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [score, setScore] = useState(answer.scorePoints === null ? String(answer.maxPoints) : String(answer.scorePoints))
  const [comment, setComment] = useState(answer.teacherComment ?? '')
  const text = typeof answer.responseData.text === 'string' ? answer.responseData.text : ''
  const manual = answer.type === 'WRITTEN'
  const awaiting = manual && answer.status === 'AWAITING_REVIEW'
  const validScore = Number.isFinite(Number(score)) && Number(score) >= 0 && Number(score) <= answer.maxPoints
  return (
    <article className={styles.reviewAnswerCard}>
      <header>
        <span>{index + 1}</span>
        <div><small>{t(`assignments.types.${answer.type}.title`)}</small><h3>{answer.title}</h3></div>
        <strong>{answer.scorePoints === null ? t('tests.library.points', { count: answer.maxPoints }) : t('tests.student.score', { score: answer.scorePoints, max: answer.maxPoints })}</strong>
      </header>
      <p className={styles.reviewPrompt}>{answer.prompt}</p>
      <div className={styles.reviewResponse}>
        <small>{t('tests.reviews.studentAnswer')}</small>
        {manual ? (
          <p>{text || t('tests.reviews.emptyAnswer')}</p>
        ) : (
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
        )}
      </div>
      {answer.teacherComment && !awaiting && <p className={styles.teacherComment}>{answer.teacherComment}</p>}
      {awaiting && (
        <div className={styles.reviewForm}>
          <label><span>{t('tests.reviews.score')}</span><input max={answer.maxPoints} min="0" onChange={(event) => setScore(event.target.value)} step="0.01" type="number" value={score} /></label>
          <label><span>{t('tests.reviews.comment')}</span><textarea maxLength={5000} onChange={(event) => setComment(event.target.value)} placeholder={t('tests.reviews.commentPlaceholder')} rows={3} value={comment} /></label>
          {mutationError && <p className={styles.inlineError}>{mutationError}</p>}
          <div>
            <button className={styles.secondaryButton} disabled={pending || !comment.trim()} onClick={() => onSubmit({ decision: 'RETURNED', teacherComment: comment })} type="button">{t('tests.reviews.return')}</button>
            <button className={styles.primaryButton} disabled={pending || !validScore} onClick={() => onSubmit({ decision: 'APPROVED', scorePoints: Number(score), teacherComment: comment.trim() || null })} type="button">{pending ? t('tests.reviews.saving') : t('tests.reviews.approve')}</button>
          </div>
        </div>
      )}
      {!manual && <p className={styles.autoGraded}><CheckCircle2 size={15} />{t('tests.reviews.autoGraded')}</p>}
    </article>
  )
}

function reviewError(error: Error | null, t: (key: string) => string): string {
  if (error instanceof ApiError && error.code === 'TEST_ANSWER_NOT_REVIEWABLE') return t('tests.reviews.errors.stale')
  return t('tests.reviews.errors.action')
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
