import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { listStudentLessons } from '../api/lessons.api'
import { lessonQueryKeys } from '../model/lesson-query-keys'
import styles from '../Lessons.module.css'

export function StudentClassLessonsSection() {
  const { t } = useTranslation()
  const lessonsQuery = useQuery({
    queryKey: lessonQueryKeys.studentList,
    queryFn: listStudentLessons,
  })

  return (
    <section
      className={styles.studentLessonsPanel}
      aria-labelledby="student-class-lessons-title"
    >
      <div className={styles.studentSectionHeading}>
        <BookOpen size={20} aria-hidden="true" />
        <div>
          <h2 id="student-class-lessons-title">
            {t('lessons.student.section.title')}
          </h2>
          <p>{t('lessons.student.section.description')}</p>
        </div>
      </div>

      {lessonsQuery.isLoading && (
        <p className={styles.studentLessonsStatus}>
          {t('lessons.student.section.loading')}
        </p>
      )}

      {lessonsQuery.isError && (
        <div className={styles.studentLessonsStatus} role="alert">
          <p>{t('lessons.student.section.loadError')}</p>
          <button
            className={styles.studentRetryButton}
            type="button"
            onClick={() => void lessonsQuery.refetch()}
          >
            {t('lessons.common.retry')}
          </button>
        </div>
      )}

      {lessonsQuery.data?.length === 0 && (
        <div className={styles.studentLessonsEmpty}>
          <BookOpen size={28} aria-hidden="true" />
          <div>
            <h3>{t('lessons.student.section.emptyTitle')}</h3>
            <p>{t('lessons.student.section.emptyDescription')}</p>
          </div>
        </div>
      )}

      {lessonsQuery.data && lessonsQuery.data.length > 0 && (
        <ol className={styles.studentLessonList}>
          {lessonsQuery.data.map((lesson, index) => (
            <li className={styles.studentLessonRow} key={lesson.id}>
              <span className={styles.studentLessonNumber} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>

              <div className={styles.studentLessonCopy}>
                <h3>{lesson.title}</h3>
                <p>{lesson.summary}</p>
                <div className={styles.studentLessonMeta}>
                  {lesson.estimatedMinutes !== null && (
                    <span>
                      <Clock size={14} aria-hidden="true" />
                      {t('lessons.common.minutes', {
                        count: lesson.estimatedMinutes,
                      })}
                    </span>
                  )}
                  <span
                    className={`${styles.studentProgressBadge} ${styles[`studentProgress${lesson.progress.status}`]}`}
                  >
                    {lesson.progress.status === 'COMPLETED' && (
                      <CheckCircle2 size={13} aria-hidden="true" />
                    )}
                    {lesson.progress.status === 'NO_TASKS'
                      ? t('lessonTasks.progress.NO_TASKS')
                      : t('lessonTasks.student.rowProgress', {
                          approved: lesson.progress.approved,
                          total: lesson.progress.requiredTotal,
                          status: t(
                            `lessonTasks.progress.${lesson.progress.status}`,
                          ),
                        })}
                  </span>
                </div>
              </div>

              <Link
                className={styles.studentLessonLink}
                to={`/app/student/lessons/${lesson.id}`}
                aria-label={t('lessons.student.section.openNamed', {
                  title: lesson.title,
                })}
              >
                {t('lessons.student.section.open')}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
