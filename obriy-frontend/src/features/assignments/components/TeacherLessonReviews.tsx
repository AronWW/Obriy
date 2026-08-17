import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  RotateCcw,
  UserRound,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../shared/api/api-client'
import {
  listLessonAssignmentReviews,
  reviewAssignmentAttempt,
} from '../api/assignments.api'
import { assignmentQueryKeys } from '../model/assignment-query-keys'
import type {
  ReviewAssignmentAttemptInput,
  TeacherAssignmentReview,
} from '../model/assignment.types'
import { AssignmentDialog } from './AssignmentDialog'
import styles from '../Assignments.module.css'

type ReviewFilter = 'ALL' | TeacherAssignmentReview['status']

export function TeacherLessonReviews({ lessonId }: { lessonId: string }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<ReviewFilter>('ALL')
  const [selected, setSelected] = useState<TeacherAssignmentReview | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const reviewsQuery = useQuery({
    queryKey: assignmentQueryKeys.lessonReviews(lessonId),
    queryFn: () => listLessonAssignmentReviews(lessonId),
  })
  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data])
  const filtered = useMemo(
    () =>
      filter === 'ALL'
        ? reviews
        : reviews.filter((review) => review.status === filter),
    [filter, reviews],
  )
  const counts = {
    ALL: reviews.length,
    AWAITING_REVIEW: reviews.filter(
      (review) => review.status === 'AWAITING_REVIEW',
    ).length,
    GRADED: reviews.filter((review) => review.status === 'GRADED').length,
    RETURNED: reviews.filter((review) => review.status === 'RETURNED').length,
  }

  return (
    <section className={styles.lessonReviews} aria-labelledby="lesson-reviews-title">
      <header className={styles.lessonReviewsHeader}>
        <div>
          <p className={styles.eyebrow}>
            <ClipboardCheck size={15} aria-hidden="true" />
            {t('assignments.reviews.eyebrow')}
          </p>
          <h2 id="lesson-reviews-title">{t('assignments.reviews.title')}</h2>
          <p>{t('assignments.reviews.description')}</p>
        </div>
        {counts.AWAITING_REVIEW > 0 && (
          <span className={styles.reviewPendingCount}>
            {t('assignments.reviews.pendingCount', {
              count: counts.AWAITING_REVIEW,
            })}
          </span>
        )}
      </header>

      {successMessage && (
        <p className={styles.reviewSuccess} role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          {successMessage}
        </p>
      )}

      {reviewsQuery.isLoading && (
        <p className={styles.pickerStatus}>{t('assignments.reviews.loading')}</p>
      )}
      {reviewsQuery.isError && (
        <div className={styles.pickerStatus} role="alert">
          <p>{t('assignments.reviews.loadError')}</p>
          <button
            className={styles.secondaryButton}
            onClick={() => void reviewsQuery.refetch()}
            type="button"
          >
            {t('assignments.common.retry')}
          </button>
        </div>
      )}

      {!reviewsQuery.isLoading && !reviewsQuery.isError && reviews.length === 0 && (
        <div className={styles.lessonReviewsEmpty}>
          <ClipboardCheck size={26} aria-hidden="true" />
          <div>
            <strong>{t('assignments.reviews.emptyTitle')}</strong>
            <p>{t('assignments.reviews.emptyDescription')}</p>
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <>
          <div className={styles.reviewFilters} aria-label={t('assignments.reviews.filtersLabel')}>
            {(['ALL', 'AWAITING_REVIEW', 'GRADED', 'RETURNED'] as const).map(
              (value) => (
                <button
                  aria-pressed={filter === value}
                  className={filter === value ? styles.reviewFilterActive : undefined}
                  key={value}
                  onClick={() => setFilter(value)}
                  type="button"
                >
                  {t(`assignments.reviews.filters.${value}`)}
                  <span>{counts[value]}</span>
                </button>
              ),
            )}
          </div>

          {filtered.length === 0 ? (
            <p className={styles.reviewFilterEmpty}>
              {t('assignments.reviews.filterEmpty')}
            </p>
          ) : (
            <div className={styles.reviewList}>
              {filtered.map((review) => (
                <ReviewRow
                  key={review.attemptId}
                  onOpen={() => {
                    setSuccessMessage(null)
                    setSelected(review)
                  }}
                  review={review}
                />
              ))}
            </div>
          )}
        </>
      )}

      {selected && (
        <ReviewDialog
          lessonId={lessonId}
          onClose={() => setSelected(null)}
          onReviewed={(review) => {
            setSelected(null)
            setSuccessMessage(
              review.status === 'GRADED'
                ? t('assignments.reviews.successApproved')
                : t('assignments.reviews.successReturned'),
            )
          }}
          review={selected}
        />
      )}
    </section>
  )
}

function ReviewRow({
  onOpen,
  review,
}: {
  onOpen: () => void
  review: TeacherAssignmentReview
}) {
  const { t } = useTranslation()
  return (
    <article className={styles.reviewRow}>
      <span className={styles.reviewStudentIcon} aria-hidden="true">
        <UserRound size={19} />
      </span>
      <div className={styles.reviewRowCopy}>
        <div className={styles.reviewRowMeta}>
          <span>{review.student.displayName}</span>
          <span>{review.class.name}</span>
          {review.submittedAt && (
            <span>
              <Clock3 size={13} aria-hidden="true" />
              {formatReviewDate(review.submittedAt)}
            </span>
          )}
        </div>
        <h3>{review.assignmentTitle}</h3>
        <p>{review.responseText}</p>
      </div>
      <div className={styles.reviewRowAction}>
        <span className={`${styles.reviewStatus} ${styles[`reviewStatus${review.status}`]}`}>
          {t(`assignments.reviews.status.${review.status}`)}
        </span>
        {review.scorePoints !== null && (
          <small>
            {t('assignments.reviews.scoreValue', {
              score: review.scorePoints,
              max: review.maxPoints,
            })}
          </small>
        )}
        <button className={styles.secondaryButton} onClick={onOpen} type="button">
          {review.status === 'AWAITING_REVIEW'
            ? t('assignments.reviews.review')
            : t('assignments.reviews.view')}
        </button>
      </div>
    </article>
  )
}

function ReviewDialog({
  lessonId,
  onClose,
  onReviewed,
  review,
}: {
  lessonId: string
  onClose: () => void
  onReviewed: (review: TeacherAssignmentReview) => void
  review: TeacherAssignmentReview
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [score, setScore] = useState(
    review.scorePoints === null
      ? review.status === 'AWAITING_REVIEW'
        ? String(review.maxPoints)
        : ''
      : String(review.scorePoints),
  )
  const [comment, setComment] = useState(review.teacherComment ?? '')
  const [localError, setLocalError] = useState<string | null>(null)
  const isPendingReview = review.status === 'AWAITING_REVIEW'
  const numericScore = Number(score)
  const scoreIsValid =
    score.trim() !== '' &&
    Number.isFinite(numericScore) &&
    numericScore >= 0 &&
    numericScore <= review.maxPoints
  const mutation = useMutation({
    mutationFn: (input: ReviewAssignmentAttemptInput) =>
      reviewAssignmentAttempt(review.attemptId, input),
    onMutate: () => setLocalError(null),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({
        queryKey: assignmentQueryKeys.lessonReviews(lessonId),
      })
      onReviewed(updated)
    },
    onError: (error) => setLocalError(getReviewError(error, t)),
  })

  const submitReview = (decision: ReviewAssignmentAttemptInput['decision']) => {
    if (decision === 'APPROVED' && !scoreIsValid) {
      setLocalError(t('assignments.reviews.errors.score'))
      return
    }
    if (decision === 'RETURNED' && comment.trim().length === 0) {
      setLocalError(t('assignments.reviews.errors.comment'))
      return
    }
    mutation.mutate({
      decision,
      ...(decision === 'APPROVED' ? { scorePoints: numericScore } : {}),
      teacherComment: comment.trim() || null,
    })
  }

  return (
    <AssignmentDialog
      closeLabel={t('assignments.common.close')}
      description={t('assignments.reviews.dialogDescription', {
        student: review.student.displayName,
        class: review.class.name,
      })}
      onClose={onClose}
      title={review.assignmentTitle}
      wide
    >
      <div className={styles.reviewDialogBody}>
        <section className={styles.reviewPrompt}>
          <span>{t('assignments.reviews.prompt')}</span>
          <p>{review.prompt}</p>
        </section>
        <section className={styles.reviewAnswer}>
          <span>{t('assignments.reviews.answer')}</span>
          <p>{review.responseText}</p>
        </section>

        <div className={styles.reviewFormGrid}>
          <label className={styles.field}>
            <span>{t('assignments.reviews.score')}</span>
            <div className={styles.reviewScoreInput}>
              <input
                aria-label={t('assignments.reviews.score')}
                disabled={!isPendingReview || mutation.isPending}
                max={review.maxPoints}
                min={0}
                onChange={(event) => setScore(event.target.value)}
                step="0.01"
                type="number"
                value={score}
              />
              <span>/ {review.maxPoints}</span>
            </div>
            <small>
              {t('assignments.reviews.passing', {
                percent: review.passingPercent,
              })}
            </small>
          </label>
          <label className={styles.field}>
            <span>{t('assignments.reviews.comment')}</span>
            <textarea
              aria-label={t('assignments.reviews.comment')}
              disabled={!isPendingReview || mutation.isPending}
              maxLength={5_000}
              onChange={(event) => setComment(event.target.value)}
              placeholder={t('assignments.reviews.commentPlaceholder')}
              rows={5}
              value={comment}
            />
          </label>
        </div>

        {localError && (
          <p className={styles.inlineError} role="alert">
            {localError}
          </p>
        )}

        <footer className={styles.reviewDialogActions}>
          <button className={styles.secondaryButton} onClick={onClose} type="button">
            {t('assignments.common.close')}
          </button>
          {isPendingReview && (
            <>
              <button
                className={styles.returnButton}
                disabled={mutation.isPending}
                onClick={() => submitReview('RETURNED')}
                type="button"
              >
                <RotateCcw size={16} aria-hidden="true" />
                {t('assignments.reviews.return')}
              </button>
              <button
                className={styles.primaryButton}
                disabled={mutation.isPending}
                onClick={() => submitReview('APPROVED')}
                type="button"
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                {mutation.isPending
                  ? t('assignments.reviews.saving')
                  : t('assignments.reviews.approve')}
              </button>
            </>
          )}
        </footer>
      </div>
    </AssignmentDialog>
  )
}

function formatReviewDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getReviewError(
  error: Error | null,
  t: (key: string) => string,
): string {
  if (error instanceof ApiError) {
    if (error.code === 'ASSIGNMENT_REVIEW_SCORE_OUT_OF_RANGE') {
      return t('assignments.reviews.errors.score')
    }
    if (error.code === 'ASSIGNMENT_REVIEW_COMMENT_REQUIRED') {
      return t('assignments.reviews.errors.comment')
    }
    if (error.code === 'ASSIGNMENT_ATTEMPT_NOT_REVIEWABLE') {
      return t('assignments.reviews.errors.stale')
    }
    if (error.code === 'NETWORK_ERROR') {
      return t('assignments.errors.network')
    }
  }
  return t('assignments.reviews.errors.action')
}
