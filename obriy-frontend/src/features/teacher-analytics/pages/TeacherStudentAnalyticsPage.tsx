import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { UserAvatarImage } from '../../../shared/ui/UserAvatarImage'
import { getTeacherStudentAnalytics } from '../api/teacher-analytics.api'
import { teacherAnalyticsQueryKeys } from '../model/teacher-analytics-query-keys'
import {
  formatAnalyticsDate,
  formatAnalyticsDateTime,
  formatAnalyticsPercent,
  formatAnalyticsScore,
} from '../model/teacher-analytics-format'
import type {
  TeacherStudentAttempt,
  TeacherStudentTestResult,
} from '../model/teacher-analytics.types'
import styles from '../TeacherAnalytics.module.css'

export function TeacherStudentAnalyticsPage() {
  const { classId = '', studentId = '' } = useParams()
  const { i18n, t } = useTranslation()
  const analyticsQuery = useQuery({
    queryKey: teacherAnalyticsQueryKeys.student(classId, studentId),
    queryFn: () => getTeacherStudentAnalytics(classId, studentId),
    enabled: Boolean(classId && studentId),
  })
  const backHref = `/app/teacher/analytics?classId=${encodeURIComponent(classId)}&tab=students`

  return (
    <main className={styles.page} aria-labelledby="student-analytics-title">
      <div className={styles.content}>
        <Link className={styles.backLink} to={backHref}>
          <ArrowLeft aria-hidden="true" size={16} />
          {t('teacherAnalytics.studentDetail.back')}
        </Link>

        {analyticsQuery.isLoading && <DetailLoading />}
        {analyticsQuery.isError && (
          <div className={styles.errorState} role="alert">
            <div><strong>{t('teacherAnalytics.error.title')}</strong><p>{t('teacherAnalytics.error.description')}</p></div>
            <button onClick={() => void analyticsQuery.refetch()} type="button"><RefreshCw aria-hidden="true" size={15} />{t('teacherAnalytics.error.retry')}</button>
          </div>
        )}

        {analyticsQuery.data && (
          <>
            <header className={styles.studentHero}>
              <div className={styles.studentAvatar} aria-hidden="true">
                <UserAvatarImage avatarUrl={analyticsQuery.data.student.avatarUrl} displayName={analyticsQuery.data.student.displayName} />
              </div>
              <div>
                <h1 id="student-analytics-title">{analyticsQuery.data.student.displayName}</h1>
                <p>{analyticsQuery.data.class.name}</p>
              </div>
            </header>

            <section className={styles.metricsGrid} aria-label={t('teacherAnalytics.summary.label')}>
              <DetailMetric label={t('teacherAnalytics.studentDetail.required')} value={String(analyticsQuery.data.student.requiredCount)} />
              <DetailMetric label={t('teacherAnalytics.studentDetail.completed')} value={String(analyticsQuery.data.student.completedCount)} />
              <DetailMetric label={t('teacherAnalytics.summary.completion')} value={formatAnalyticsPercent(analyticsQuery.data.student.completionPercent, t('teacherAnalytics.common.noData'))} />
              <DetailMetric label={t('teacherAnalytics.summary.average')} value={formatAnalyticsPercent(analyticsQuery.data.student.averagePercent, t('teacherAnalytics.common.noData'))} />
              <DetailMetric label={t('teacherAnalytics.studentDetail.lastActivity')} value={analyticsQuery.data.student.lastActivityAt ? formatAnalyticsDate(analyticsQuery.data.student.lastActivityAt, i18n.resolvedLanguage) : t('teacherAnalytics.common.noActivity')} />
            </section>

            <section className={styles.studentResults} aria-labelledby="student-results-title">
              <header className={styles.materialsHeader}>
                <h2 id="student-results-title">{t('teacherAnalytics.studentDetail.results')}</h2>
                <p>{t('teacherAnalytics.studentDetail.resultsDescription')}</p>
              </header>
              {analyticsQuery.data.lessons.length === 0 ? (
                <div className={styles.emptyState}><p>{t('teacherAnalytics.studentDetail.empty')}</p></div>
              ) : analyticsQuery.data.lessons.map((lesson) => (
                <article className={styles.studentLesson} key={lesson.id}>
                  <h3>{lesson.title}</h3>
                  <div className={styles.studentTestList}>
                    {lesson.tests.map((test) => (
                      <StudentTestCard key={test.releaseId} lessonId={lesson.id} test={test} />
                    ))}
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return <article className={styles.metricCard}><span aria-hidden="true"><CheckCircle2 size={20} /></span><div><strong>{value}</strong><p>{label}</p></div></article>
}

function StudentTestCard({ lessonId, test }: { lessonId: string; test: TeacherStudentTestResult }) {
  const { i18n, t } = useTranslation()
  return (
    <section className={styles.studentTest}>
      <header>
        <div>
          <h4>{test.title}</h4>
          <div className={styles.testBadges}>
            <span data-release={test.releaseStatus}>{t(`teacherAnalytics.releaseStatus.${test.releaseStatus}`)}</span>
            <span>{t(test.isRequired ? 'teacherAnalytics.materials.required' : 'teacherAnalytics.materials.optional')}</span>
            <span data-student-status={test.status}>{t(`teacherAnalytics.studentStatus.${statusKey(test.status)}`)}</span>
          </div>
        </div>
        <div className={styles.studentTestScore}>
          <strong>{formatAnalyticsScore(test.scorePoints, test.maxPoints, test.scorePercent, t('teacherAnalytics.common.noData'))}</strong>
          <span>{t('teacherAnalytics.studentDetail.currentScore')}</span>
        </div>
      </header>
      <dl className={styles.testFacts}>
        <div><dt>{t('teacherAnalytics.studentDetail.bestScore')}</dt><dd>{formatAnalyticsScore(test.bestPoints, test.maxPoints, test.bestPercent, t('teacherAnalytics.common.noData'))}</dd></div>
        <div><dt>{t('teacherAnalytics.studentDetail.attemptCount')}</dt><dd>{test.attemptCount}</dd></div>
        <div><dt>{t('teacherAnalytics.studentDetail.deadline')}</dt><dd>{test.dueAt ? formatAnalyticsDate(test.dueAt, i18n.resolvedLanguage) : t('teacherAnalytics.common.noDeadline')}</dd></div>
        <div><dt>{t('teacherAnalytics.studentDetail.late')}</dt><dd>{t(test.isLate ? 'teacherAnalytics.common.yes' : 'teacherAnalytics.common.no')}</dd></div>
      </dl>
      <div className={styles.attemptsBlock}>
        <h5>{t('teacherAnalytics.studentDetail.attempts')}</h5>
        {test.attempts.length === 0 ? <p className={styles.noAttempts}>{t('teacherAnalytics.studentDetail.noAttempts')}</p> : (
          <div className={styles.attemptList}>
            {test.attempts.map((attempt) => <AttemptRow attempt={attempt} key={attempt.id} lessonId={lessonId} />)}
          </div>
        )}
      </div>
    </section>
  )
}

function AttemptRow({ attempt, lessonId }: { attempt: TeacherStudentAttempt; lessonId: string }) {
  const { i18n, t } = useTranslation()
  const canReview = ['AWAITING_REVIEW', 'GRADED', 'RETURNED'].includes(attempt.status)
  return (
    <div className={styles.attemptRow}>
      <span className={styles.attemptNumber}>{t('teacherAnalytics.studentDetail.attemptNumber', { number: attempt.attemptNumber })}</span>
      <span data-attempt-status={attempt.status}>{t(`teacherAnalytics.attemptStatus.${attempt.status}`)}</span>
      <span>{formatAnalyticsScore(attempt.scorePoints, attempt.maxPoints, attempt.scorePercent, t('teacherAnalytics.common.noData'))}</span>
      <div className={styles.attemptDates}>
        <span>{t('teacherAnalytics.studentDetail.started')} <time dateTime={attempt.startedAt}>{formatAnalyticsDateTime(attempt.startedAt, i18n.resolvedLanguage)}</time></span>
        {attempt.submittedAt && <span>{t('teacherAnalytics.studentDetail.submitted')} <time dateTime={attempt.submittedAt}>{formatAnalyticsDateTime(attempt.submittedAt, i18n.resolvedLanguage)}</time></span>}
        {attempt.gradedAt && <span>{t('teacherAnalytics.studentDetail.graded')} <time dateTime={attempt.gradedAt}>{formatAnalyticsDateTime(attempt.gradedAt, i18n.resolvedLanguage)}</time></span>}
      </div>
      {canReview ? (
        <Link className={styles.reviewAttemptLink} to={`/app/teacher/lessons/${lessonId}/edit?reviewAttempt=${attempt.id}`}>
          <ClipboardCheck aria-hidden="true" size={15} />
          {t('teacherAnalytics.studentDetail.review')}
          <ArrowRight aria-hidden="true" size={14} />
        </Link>
      ) : <span className={styles.noReview}><CalendarClock aria-hidden="true" size={15} /></span>}
    </div>
  )
}

function DetailLoading() {
  const { t } = useTranslation()
  return <div aria-live="polite" className={styles.loading}><span /><span /><span /><p>{t('teacherAnalytics.loading')}</p></div>
}

function statusKey(status: string): string {
  const camel = status.toLowerCase().replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
  return camel
}
