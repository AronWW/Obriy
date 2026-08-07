import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookOpen,
  Clock,
  School,
  UserRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../../shared/api/api-client'
import { getStudentLesson } from '../api/lessons.api'
import { lessonQueryKeys } from '../model/lesson-query-keys'
import { StudentLessonTasks } from '../tasks/StudentLessonTasks'
import styles from '../Lessons.module.css'

export function StudentLessonReaderPage() {
  const { t } = useTranslation()
  const { lessonId = '' } = useParams()
  const lessonQuery = useQuery({
    queryKey: lessonQueryKeys.studentDetail(lessonId),
    queryFn: () => getStudentLesson(lessonId),
    enabled: Boolean(lessonId),
  })
  const isUnavailable =
    lessonQuery.error instanceof ApiError && lessonQuery.error.status === 404

  return (
    <section
      className={styles.page}
      aria-labelledby={lessonQuery.isLoading ? undefined : 'student-lesson-title'}
    >
      <div className={`${styles.content} ${styles.readerContent}`}>
        <Link className={styles.readerBackLink} to="/app/student/classes">
          <ArrowLeft size={16} aria-hidden="true" />
          {t('lessons.student.reader.back')}
        </Link>

        {lessonQuery.isLoading && (
          <div className={styles.readerState}>
            <BookOpen size={30} aria-hidden="true" />
            <p>{t('lessons.student.reader.loading')}</p>
          </div>
        )}

        {lessonQuery.isError && (
          <div className={styles.readerState} role="alert">
            <BookOpen size={30} aria-hidden="true" />
            <h1 id="student-lesson-title">
              {isUnavailable
                ? t('lessons.student.reader.unavailableTitle')
                : t('lessons.student.reader.loadErrorTitle')}
            </h1>
            <p>
              {isUnavailable
                ? t('lessons.student.reader.unavailableDescription')
                : t('lessons.student.reader.loadErrorDescription')}
            </p>
            {!isUnavailable && (
              <button
                className={styles.studentRetryButton}
                type="button"
                onClick={() => void lessonQuery.refetch()}
              >
                {t('lessons.common.retry')}
              </button>
            )}
          </div>
        )}

        {lessonQuery.data && (
          <>
            <header className={styles.readerHeader}>
              <p className={styles.eyebrow}>
                <BookOpen size={15} aria-hidden="true" />
                {t('lessons.student.reader.eyebrow')}
              </p>
              <h1 id="student-lesson-title">{lessonQuery.data.title}</h1>
              <p className={styles.readerSummary}>{lessonQuery.data.summary}</p>

              <div className={styles.readerInfoStrip}>
                <dl className={styles.readerContext}>
                  <div>
                    <dt>
                      <School size={15} aria-hidden="true" />
                      {t('lessons.student.reader.classLabel')}
                    </dt>
                    <dd>{lessonQuery.data.class.name}</dd>
                  </div>
                  <div>
                    <dt>
                      <UserRound size={15} aria-hidden="true" />
                      {t('lessons.student.reader.teacherLabel')}
                    </dt>
                    <dd>{lessonQuery.data.teacher.displayName}</dd>
                  </div>
                </dl>
                {lessonQuery.data.estimatedMinutes !== null && (
                  <span className={styles.readerDuration}>
                    <Clock size={15} aria-hidden="true" />
                    {t('lessons.common.minutes', {
                      count: lessonQuery.data.estimatedMinutes,
                    })}
                  </span>
                )}
              </div>
            </header>

            <article
              className={styles.readerArticle}
              aria-labelledby="student-lesson-content-title"
            >
              <h2 id="student-lesson-content-title">
                {t('lessons.student.reader.contentTitle')}
              </h2>
              <div className={styles.readerText} data-testid="lesson-content">
                {toParagraphs(lessonQuery.data.content).map(
                  (paragraph, index) => <p key={index}>{paragraph}</p>,
                )}
              </div>
            </article>

            <StudentLessonTasks
              lessonId={lessonQuery.data.id}
              progress={lessonQuery.data.progress}
              tasks={lessonQuery.data.tasks}
            />
          </>
        )}
      </div>
    </section>
  )
}

function toParagraphs(content: string): string[] {
  return content
    .split(/\r?\n\s*\r?\n/)
    .filter((paragraph) => paragraph.trim().length > 0)
}
