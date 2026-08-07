import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ClipboardList, RotateCcw, Send } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../shared/api/api-client'
import { submitStudentLessonTask } from '../api/lesson-tasks.api'
import { lessonQueryKeys } from '../model/lesson-query-keys'
import type {
  StudentLessonProgress,
  StudentLessonTask,
} from '../model/lesson-task.types'
import styles from './StudentLessonTasks.module.css'

interface StudentLessonTasksProps {
  lessonId: string
  progress: StudentLessonProgress
  tasks: StudentLessonTask[]
}

interface SubmitInput {
  answerText: string
  taskId: string
}

export function StudentLessonTasks({
  lessonId,
  progress,
  tasks,
}: StudentLessonTasksProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      tasks.map((task) => [task.id, task.submission?.answerText ?? '']),
    ),
  )
  const submissionMutation = useMutation({
    mutationFn: ({ answerText, taskId }: SubmitInput) =>
      submitStudentLessonTask(lessonId, taskId, answerText),
    onError: async (error) => {
      if (
        error instanceof ApiError &&
        error.code === 'TASK_SUBMISSION_APPROVED'
      ) {
        await invalidateStudentLessonQueries(queryClient, lessonId)
      }
    },
    onSuccess: async () => {
      await invalidateStudentLessonQueries(queryClient, lessonId)
    },
  })

  if (tasks.length === 0) {
    return (
      <section className={styles.emptyPanel} aria-labelledby="lesson-tasks-title">
        <ClipboardList size={24} aria-hidden="true" />
        <div>
          <h2 id="lesson-tasks-title">{t('lessonTasks.student.title')}</h2>
          <p>{t('lessonTasks.student.noTasks')}</p>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.section} aria-labelledby="lesson-tasks-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            <ClipboardList size={15} aria-hidden="true" />
            {t('lessonTasks.student.eyebrow')}
          </p>
          <h2 id="lesson-tasks-title">{t('lessonTasks.student.title')}</h2>
          <p>{t('lessonTasks.student.description')}</p>
        </div>
        <div className={styles.progressSummary}>
          <strong>
            {progress.status === 'NO_TASKS'
              ? t('lessonTasks.student.noRequiredTasks')
              : t('lessonTasks.student.progressFraction', {
                  approved: progress.approved,
                  total: progress.requiredTotal,
                })}
          </strong>
          <span className={styles[`progress${progress.status}`]}>
            {t(`lessonTasks.progress.${progress.status}`)}
          </span>
        </div>
      </header>

      <div className={styles.progressDetails}>
        <span>
          {t('lessonTasks.student.submittedCount', {
            count: progress.submitted,
          })}
        </span>
        {progress.returned > 0 && (
          <span className={styles.returnedCount}>
            {t('lessonTasks.student.returnedCount', {
              count: progress.returned,
            })}
          </span>
        )}
      </div>

      <ol className={styles.taskList}>
        {tasks.map((task, index) => {
          const submission = task.submission
          const isEditable = !submission || submission.status === 'RETURNED'
          const isPending =
            submissionMutation.isPending &&
            submissionMutation.variables?.taskId === task.id
          const answer = answers[task.id] ?? submission?.answerText ?? ''
          const errorThisTask =
            submissionMutation.isError &&
            submissionMutation.variables?.taskId === task.id

          return (
            <li className={styles.taskCard} key={task.id}>
              <div className={styles.taskHeading}>
                <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{task.title}</h3>
                  <p>{task.prompt}</p>
                </div>
                <small>
                  {task.isRequired
                    ? t('lessonTasks.student.required')
                    : t('lessonTasks.student.optional')}
                </small>
              </div>

              {submission && (
                <div
                  className={`${styles.submissionState} ${styles[`submission${submission.status}`]}`}
                >
                  {submission.status === 'APPROVED' ? (
                    <CheckCircle2 size={17} aria-hidden="true" />
                  ) : submission.status === 'RETURNED' ? (
                    <RotateCcw size={17} aria-hidden="true" />
                  ) : (
                    <Send size={17} aria-hidden="true" />
                  )}
                  <span>{t(`lessonTasks.submission.${submission.status}`)}</span>
                </div>
              )}

              {submission?.teacherComment && (
                <div className={styles.teacherComment}>
                  <strong>{t('lessonTasks.student.teacherComment')}</strong>
                  <p>{submission.teacherComment}</p>
                </div>
              )}

              {isEditable ? (
                <form
                  className={styles.answerForm}
                  onSubmit={(event) => {
                    event.preventDefault()
                    submissionMutation.mutate({
                      answerText: answer.trim(),
                      taskId: task.id,
                    })
                  }}
                >
                  <label htmlFor={`lesson-task-answer-${task.id}`}>
                    {submission?.status === 'RETURNED'
                      ? t('lessonTasks.student.reviseAnswer')
                      : t('lessonTasks.student.answer')}
                  </label>
                  <textarea
                    id={`lesson-task-answer-${task.id}`}
                    maxLength={20000}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [task.id]: event.target.value,
                      }))
                    }
                    placeholder={t('lessonTasks.student.answerPlaceholder')}
                    rows={5}
                    value={answer}
                  />
                  {errorThisTask && (
                    <p className={styles.error} role="alert">
                      {getSubmissionError(submissionMutation.error, t)}
                    </p>
                  )}
                  <button
                    disabled={
                      !answer.trim() || submissionMutation.isPending || isPending
                    }
                    type="submit"
                  >
                    <Send size={15} aria-hidden="true" />
                    {isPending
                      ? t('lessonTasks.student.sending')
                      : submission?.status === 'RETURNED'
                        ? t('lessonTasks.student.resubmit')
                        : t('lessonTasks.student.submit')}
                  </button>
                </form>
              ) : (
                <div className={styles.lockedAnswer}>
                  <strong>{t('lessonTasks.student.yourAnswer')}</strong>
                  <p>{submission.answerText}</p>
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function invalidateStudentLessonQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  lessonId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: lessonQueryKeys.studentDetail(lessonId),
    }),
    queryClient.invalidateQueries({
      queryKey: lessonQueryKeys.studentList,
    }),
  ])
}

function getSubmissionError(
  error: Error,
  t: (key: string) => string,
): string {
  if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
    return t('lessonTasks.errors.network')
  }
  if (
    error instanceof ApiError &&
    error.code === 'TASK_SUBMISSION_APPROVED'
  ) {
    return t('lessonTasks.errors.approvedLocked')
  }
  return t('lessonTasks.errors.submit')
}
