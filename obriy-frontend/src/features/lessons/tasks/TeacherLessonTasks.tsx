import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import {
  Check,
  CheckCircle2,
  ClipboardList,
  MessageSquareText,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../shared/api/api-client'
import {
  createLessonTask,
  deleteLessonTask,
  listLessonTasks,
  listLessonTaskSubmissions,
  reviewLessonTaskSubmission,
  updateLessonTask,
} from '../api/lesson-tasks.api'
import type {
  LessonTask,
  LessonTaskInput,
  LessonTaskReviewInput,
  TaskSubmissionStatus,
  TeacherTaskSubmission,
} from '../model/lesson-task.types'
import { lessonQueryKeys } from '../model/lesson-query-keys'
import styles from './TeacherLessonTasks.module.css'

export interface TeacherLessonTasksProps {
  lessonId: string
  readOnly: boolean
}

interface TaskFormValues {
  prompt: string
  title: string
}

interface UpdateTaskVariables {
  input: LessonTaskInput
  taskId: string
}

interface ReviewSubmissionVariables {
  input: LessonTaskReviewInput
  submissionId: string
  taskId: string
}

const emptyTaskForm: TaskFormValues = { prompt: '', title: '' }

export function TeacherLessonTasks({
  lessonId,
  readOnly,
}: TeacherLessonTasksProps) {
  const { i18n, t } = useTranslation()
  const queryClient = useQueryClient()
  const createTitleId = useId()
  const createPromptId = useId()
  const tasksQueryKey = lessonQueryKeys.tasks(lessonId)
  const submissionsQueryKey = lessonQueryKeys.taskSubmissions(lessonId)
  const [createValues, setCreateValues] =
    useState<TaskFormValues>(emptyTaskForm)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editValues, setEditValues] =
    useState<TaskFormValues>(emptyTaskForm)
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, string>>({})

  const tasksQuery = useQuery({
    queryKey: tasksQueryKey,
    queryFn: () => listLessonTasks(lessonId),
    enabled: Boolean(lessonId),
  })
  const submissionsQuery = useQuery({
    queryKey: submissionsQueryKey,
    queryFn: () => listLessonTaskSubmissions(lessonId),
    enabled: Boolean(lessonId),
  })

  const createMutation = useMutation({
    mutationFn: (input: LessonTaskInput) => createLessonTask(lessonId, input),
    onSuccess: (createdTask) => {
      queryClient.setQueryData<LessonTask[]>(tasksQueryKey, (current) =>
        sortTasks([...(current ?? []), createdTask]),
      )
      setCreateValues(emptyTaskForm)
      void invalidateStudentLessonQueries(queryClient, lessonId)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ input, taskId }: UpdateTaskVariables) =>
      updateLessonTask(lessonId, taskId, input),
    onSuccess: (updatedTask) => {
      queryClient.setQueryData<LessonTask[]>(tasksQueryKey, (current) =>
        sortTasks(
          (current ?? []).map((task) =>
            task.id === updatedTask.id ? updatedTask : task,
          ),
        ),
      )
      setEditingTaskId(null)
      setEditValues(emptyTaskForm)
      void invalidateStudentLessonQueries(queryClient, lessonId)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => deleteLessonTask(lessonId, taskId),
    onSuccess: (_result, taskId) => {
      queryClient.setQueryData<LessonTask[]>(tasksQueryKey, (current) =>
        (current ?? []).filter((task) => task.id !== taskId),
      )
      queryClient.setQueryData<TeacherTaskSubmission[]>(
        submissionsQueryKey,
        (current) =>
          (current ?? []).filter((submission) => submission.taskId !== taskId),
      )
      setDeleteTaskId(null)
      void invalidateStudentLessonQueries(queryClient, lessonId)
    },
  })
  const reviewMutation = useMutation({
    mutationFn: ({
      input,
      submissionId,
      taskId,
    }: ReviewSubmissionVariables) =>
      reviewLessonTaskSubmission(
        lessonId,
        taskId,
        submissionId,
        input,
      ),
    onSuccess: (reviewedSubmission) => {
      queryClient.setQueryData<TeacherTaskSubmission[]>(
        submissionsQueryKey,
        (current) =>
          (current ?? []).map((submission) =>
            submission.id === reviewedSubmission.id
              ? reviewedSubmission
              : submission,
          ),
      )
      setComments((current) => ({
        ...current,
        [reviewedSubmission.id]: reviewedSubmission.teacherComment ?? '',
      }))
    },
  })

  const sortedTasks = useMemo(
    () => sortTasks(tasksQuery.data ?? []),
    [tasksQuery.data],
  )
  const submissionsByTask = useMemo(() => {
    const grouped = new Map<string, TeacherTaskSubmission[]>()
    for (const submission of submissionsQuery.data ?? []) {
      const taskSubmissions = grouped.get(submission.taskId) ?? []
      taskSubmissions.push(submission)
      grouped.set(submission.taskId, taskSubmissions)
    }
    return grouped
  }, [submissionsQuery.data])

  const submitNewTask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (readOnly || createMutation.isPending) {
      return
    }

    const input = normalizeTaskInput(createValues)
    if (!input) {
      return
    }
    createMutation.mutate(input)
  }

  const startEditing = (task: LessonTask) => {
    if (readOnly) {
      return
    }
    updateMutation.reset()
    setDeleteTaskId(null)
    setEditingTaskId(task.id)
    setEditValues({ prompt: task.prompt, title: task.title })
  }

  const submitTaskEdit = (
    event: React.FormEvent<HTMLFormElement>,
    taskId: string,
  ) => {
    event.preventDefault()
    if (readOnly || updateMutation.isPending) {
      return
    }

    const input = normalizeTaskInput(editValues)
    if (!input) {
      return
    }
    updateMutation.mutate({ input, taskId })
  }

  const requestDelete = (taskId: string) => {
    if (readOnly) {
      return
    }
    deleteMutation.reset()
    setEditingTaskId(null)
    setDeleteTaskId(taskId)
  }

  const reviewSubmission = (
    submission: TeacherTaskSubmission,
    status: LessonTaskReviewInput['status'],
  ) => {
    if (readOnly || reviewMutation.isPending) {
      return
    }

    const comment = (
      comments[submission.id] ??
      submission.teacherComment ??
      ''
    ).trim()
    reviewMutation.mutate({
      input: {
        status,
        teacherComment: comment || null,
      },
      submissionId: submission.id,
      taskId: submission.taskId,
    })
  }

  return (
    <section className={styles.section} aria-labelledby="lesson-tasks-title">
      <header className={styles.sectionHeader}>
        <div className={styles.headingIcon} aria-hidden="true">
          <ClipboardList size={22} />
        </div>
        <div>
          <p className={styles.eyebrow}>
            {t('lessonTasks.teacher.eyebrow')}
          </p>
          <h2 id="lesson-tasks-title">{t('lessonTasks.teacher.title')}</h2>
          <p className={styles.description}>
            {t('lessonTasks.teacher.description')}
          </p>
        </div>
      </header>

      {readOnly && (
        <p className={styles.readOnlyNotice} role="status">
          {t('lessonTasks.teacher.readOnly')}
        </p>
      )}

      <form className={styles.createForm} onSubmit={submitNewTask}>
        <div className={styles.formHeading}>
          <div>
            <h3>{t('lessonTasks.teacher.create.title')}</h3>
            <p>{t('lessonTasks.teacher.create.description')}</p>
          </div>
          <span className={styles.requiredBadge}>
            <Check size={13} aria-hidden="true" />
            {t('lessonTasks.teacher.required')}
          </span>
        </div>
        <fieldset disabled={readOnly || createMutation.isPending}>
          <label htmlFor={createTitleId}>
            <span>{t('lessonTasks.teacher.fields.title')}</span>
            <input
              id={createTitleId}
              maxLength={160}
              onChange={(event) =>
                setCreateValues((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder={t('lessonTasks.teacher.fields.titlePlaceholder')}
              required
              value={createValues.title}
            />
          </label>
          <label htmlFor={createPromptId}>
            <span>{t('lessonTasks.teacher.fields.prompt')}</span>
            <textarea
              id={createPromptId}
              maxLength={10000}
              onChange={(event) =>
                setCreateValues((current) => ({
                  ...current,
                  prompt: event.target.value,
                }))
              }
              placeholder={t('lessonTasks.teacher.fields.promptPlaceholder')}
              required
              rows={4}
              value={createValues.prompt}
            />
          </label>
          <div className={styles.formActions}>
            <button
              className={styles.primaryButton}
              disabled={
                !createValues.title.trim() || !createValues.prompt.trim()
              }
              type="submit"
            >
              <Plus size={16} aria-hidden="true" />
              {createMutation.isPending
                ? t('lessonTasks.teacher.create.creating')
                : t('lessonTasks.teacher.create.submit')}
            </button>
          </div>
        </fieldset>
        {createMutation.isError && (
          <p className={styles.error} role="alert">
            {t('lessonTasks.teacher.errors.create')}
          </p>
        )}
      </form>

      <div className={styles.taskSectionHeading}>
        <div>
          <h3>{t('lessonTasks.teacher.list.title')}</h3>
          <p>{t('lessonTasks.teacher.list.description')}</p>
        </div>
        {!tasksQuery.isLoading && !tasksQuery.isError && (
          <span className={styles.countBadge}>{sortedTasks.length}</span>
        )}
      </div>

      {tasksQuery.isLoading && (
        <p className={styles.stateMessage} role="status">
          {t('lessonTasks.teacher.list.loading')}
        </p>
      )}
      {tasksQuery.isError && (
        <div className={styles.errorState} role="alert">
          <p>{t('lessonTasks.teacher.errors.loadTasks')}</p>
          <button
            className={styles.secondaryButton}
            onClick={() => void tasksQuery.refetch()}
            type="button"
          >
            {t('lessonTasks.teacher.actions.retry')}
          </button>
        </div>
      )}
      {tasksQuery.isSuccess && sortedTasks.length === 0 && (
        <p className={styles.emptyState}>
          {t('lessonTasks.teacher.list.empty')}
        </p>
      )}

      {sortedTasks.length > 0 && (
        <div className={styles.taskList}>
          {sortedTasks.map((task, index) => {
            const taskSubmissions = submissionsByTask.get(task.id) ?? []
            const isEditing = editingTaskId === task.id
            const isDeleteCandidate = deleteTaskId === task.id

            return (
              <article className={styles.taskCard} key={task.id}>
                <div className={styles.taskHeader}>
                  <span className={styles.taskOrdinal} aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className={styles.taskCopy}>
                    <div className={styles.taskTitleRow}>
                      <h3>{task.title}</h3>
                      {task.isRequired && (
                        <span className={styles.requiredBadge}>
                          <Check size={13} aria-hidden="true" />
                          {t('lessonTasks.teacher.required')}
                        </span>
                      )}
                    </div>
                    <p>{task.prompt}</p>
                  </div>
                  <div className={styles.taskActions}>
                    <button
                      aria-label={t('lessonTasks.teacher.actions.editNamed', {
                        title: task.title,
                      })}
                      className={styles.iconButton}
                      disabled={readOnly || updateMutation.isPending}
                      onClick={() => startEditing(task)}
                      title={t('lessonTasks.teacher.actions.edit')}
                      type="button"
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      aria-label={t('lessonTasks.teacher.actions.deleteNamed', {
                        title: task.title,
                      })}
                      className={`${styles.iconButton} ${styles.dangerButton}`}
                      disabled={readOnly || deleteMutation.isPending}
                      onClick={() => requestDelete(task.id)}
                      title={t('lessonTasks.teacher.actions.delete')}
                      type="button"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <form
                    className={styles.editForm}
                    onSubmit={(event) => submitTaskEdit(event, task.id)}
                  >
                    <fieldset disabled={readOnly || updateMutation.isPending}>
                      <legend>{t('lessonTasks.teacher.edit.title')}</legend>
                      <label>
                        <span>{t('lessonTasks.teacher.fields.title')}</span>
                        <input
                          maxLength={160}
                          onChange={(event) =>
                            setEditValues((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                          required
                          value={editValues.title}
                        />
                      </label>
                      <label>
                        <span>{t('lessonTasks.teacher.fields.prompt')}</span>
                        <textarea
                          maxLength={10000}
                          onChange={(event) =>
                            setEditValues((current) => ({
                              ...current,
                              prompt: event.target.value,
                            }))
                          }
                          required
                          rows={4}
                          value={editValues.prompt}
                        />
                      </label>
                      <div className={styles.formActions}>
                        <button
                          className={styles.secondaryButton}
                          onClick={() => {
                            setEditingTaskId(null)
                            updateMutation.reset()
                          }}
                          type="button"
                        >
                          <X size={15} aria-hidden="true" />
                          {t('lessonTasks.teacher.actions.cancel')}
                        </button>
                        <button
                          className={styles.primaryButton}
                          disabled={
                            !editValues.title.trim() ||
                            !editValues.prompt.trim()
                          }
                          type="submit"
                        >
                          <Check size={15} aria-hidden="true" />
                          {updateMutation.isPending
                            ? t('lessonTasks.teacher.actions.saving')
                            : t('lessonTasks.teacher.actions.save')}
                        </button>
                      </div>
                    </fieldset>
                    {updateMutation.isError && (
                      <p className={styles.error} role="alert">
                        {t('lessonTasks.teacher.errors.update')}
                      </p>
                    )}
                  </form>
                )}

                {isDeleteCandidate && (
                  <div
                    aria-labelledby={`delete-task-${task.id}`}
                    className={styles.inlineConfirmation}
                    role="group"
                  >
                    <div>
                      <strong id={`delete-task-${task.id}`}>
                        {t('lessonTasks.teacher.delete.title')}
                      </strong>
                      <p>
                        {t('lessonTasks.teacher.delete.description', {
                          title: task.title,
                        })}
                      </p>
                      {deleteMutation.isError && (
                        <p className={styles.error} role="alert">
                          {getDeleteTaskError(deleteMutation.error, t)}
                        </p>
                      )}
                    </div>
                    <div className={styles.confirmationActions}>
                      <button
                        className={styles.secondaryButton}
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          setDeleteTaskId(null)
                          deleteMutation.reset()
                        }}
                        type="button"
                      >
                        {t('lessonTasks.teacher.actions.cancel')}
                      </button>
                      <button
                        className={styles.deleteButton}
                        disabled={readOnly || deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(task.id)}
                        type="button"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        {deleteMutation.isPending
                          ? t('lessonTasks.teacher.delete.deleting')
                          : t('lessonTasks.teacher.delete.confirm')}
                      </button>
                    </div>
                  </div>
                )}

                <div className={styles.submissionsSection}>
                  <div className={styles.submissionsHeading}>
                    <div>
                      <Users size={17} aria-hidden="true" />
                      <h4>{t('lessonTasks.teacher.submissions.title')}</h4>
                    </div>
                    <span>
                      {t('lessonTasks.teacher.submissions.count', {
                        count: taskSubmissions.length,
                      })}
                    </span>
                  </div>

                  {submissionsQuery.isLoading && (
                    <p className={styles.stateMessage} role="status">
                      {t('lessonTasks.teacher.submissions.loading')}
                    </p>
                  )}
                  {submissionsQuery.isError && (
                    <div className={styles.errorState} role="alert">
                      <p>
                        {t('lessonTasks.teacher.errors.loadSubmissions')}
                      </p>
                      <button
                        className={styles.secondaryButton}
                        onClick={() => void submissionsQuery.refetch()}
                        type="button"
                      >
                        {t('lessonTasks.teacher.actions.retry')}
                      </button>
                    </div>
                  )}
                  {submissionsQuery.isSuccess &&
                    taskSubmissions.length === 0 && (
                      <p className={styles.noSubmissions}>
                        {t('lessonTasks.teacher.submissions.empty')}
                      </p>
                    )}

                  {taskSubmissions.length > 0 && (
                    <div className={styles.submissionList}>
                      {taskSubmissions.map((submission) => {
                        const isReviewing =
                          reviewMutation.isPending &&
                          reviewMutation.variables?.submissionId ===
                            submission.id
                        const reviewFailed =
                          reviewMutation.isError &&
                          reviewMutation.variables?.submissionId ===
                            submission.id
                        const comment =
                          comments[submission.id] ??
                          submission.teacherComment ??
                          ''

                        return (
                          <article
                            className={styles.submissionCard}
                            key={submission.id}
                          >
                            <header className={styles.submissionHeader}>
                              <div>
                                <strong>{submission.student.displayName}</strong>
                                <span>{submission.class.name}</span>
                              </div>
                              <span
                                className={`${styles.statusBadge} ${getStatusClassName(
                                  submission.status,
                                )}`}
                              >
                                {t(
                                  `lessonTasks.teacher.status.${submission.status}`,
                                )}
                              </span>
                            </header>

                            <div className={styles.answerBlock}>
                              <span>
                                {t('lessonTasks.teacher.submissions.answer')}
                              </span>
                              <p>{submission.answerText}</p>
                              <time dateTime={submission.submittedAt}>
                                {t(
                                  'lessonTasks.teacher.submissions.submittedAt',
                                  {
                                    date: formatSubmissionDate(
                                      submission.submittedAt,
                                      i18n.resolvedLanguage ?? i18n.language,
                                    ),
                                  },
                                )}
                              </time>
                            </div>

                            <label className={styles.commentField}>
                              <span>
                                <MessageSquareText
                                  size={14}
                                  aria-hidden="true"
                                />
                                {t(
                                  'lessonTasks.teacher.submissions.comment',
                                )}
                              </span>
                              <textarea
                                aria-label={t(
                                  'lessonTasks.teacher.submissions.commentNamed',
                                  {
                                    student: submission.student.displayName,
                                  },
                                )}
                                disabled={
                                  readOnly || reviewMutation.isPending
                                }
                                maxLength={2000}
                                onChange={(event) =>
                                  setComments((current) => ({
                                    ...current,
                                    [submission.id]: event.target.value,
                                  }))
                                }
                                placeholder={t(
                                  'lessonTasks.teacher.submissions.commentPlaceholder',
                                )}
                                rows={3}
                                value={comment}
                              />
                            </label>

                            <div className={styles.reviewActions}>
                              <button
                                className={styles.returnButton}
                                disabled={
                                  readOnly || reviewMutation.isPending
                                }
                                onClick={() =>
                                  reviewSubmission(submission, 'RETURNED')
                                }
                                type="button"
                              >
                                <RotateCcw size={15} aria-hidden="true" />
                                {t('lessonTasks.teacher.review.return')}
                              </button>
                              <button
                                className={styles.approveButton}
                                disabled={
                                  readOnly || reviewMutation.isPending
                                }
                                onClick={() =>
                                  reviewSubmission(submission, 'APPROVED')
                                }
                                type="button"
                              >
                                <CheckCircle2 size={15} aria-hidden="true" />
                                {isReviewing
                                  ? t('lessonTasks.teacher.review.saving')
                                  : t('lessonTasks.teacher.review.approve')}
                              </button>
                            </div>
                            {reviewFailed && (
                              <p className={styles.error} role="alert">
                                {t('lessonTasks.teacher.errors.review')}
                              </p>
                            )}
                          </article>
                        )
                      })}
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function normalizeTaskInput(values: TaskFormValues): LessonTaskInput | null {
  const title = values.title.trim()
  const prompt = values.prompt.trim()
  return title && prompt ? { prompt, title } : null
}

function sortTasks(tasks: LessonTask[]): LessonTask[] {
  return [...tasks].sort((left, right) => {
    if (left.position !== right.position) {
      return left.position - right.position
    }
    return left.createdAt.localeCompare(right.createdAt)
  })
}

function getStatusClassName(status: TaskSubmissionStatus): string {
  switch (status) {
    case 'APPROVED':
      return styles.statusApproved
    case 'RETURNED':
      return styles.statusReturned
    case 'SUBMITTED':
      return styles.statusSubmitted
  }
}

function formatSubmissionDate(value: string, language: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(language === 'uk' ? 'uk-UA' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function invalidateStudentLessonQueries(
  queryClient: QueryClient,
  lessonId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: lessonQueryKeys.studentList }),
    queryClient.invalidateQueries({
      queryKey: lessonQueryKeys.studentDetail(lessonId),
    }),
  ])
}

function getDeleteTaskError(
  error: Error,
  t: (key: string) => string,
): string {
  if (
    error instanceof ApiError &&
    error.code === 'LESSON_TASK_HAS_SUBMISSIONS'
  ) {
    return t('lessonTasks.teacher.errors.deleteHasSubmissions')
  }
  return t('lessonTasks.teacher.errors.delete')
}
