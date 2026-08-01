import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Edit3,
  Eye,
  EyeOff,
  Link2Off,
  Plus,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ApiError } from '../../../shared/api/api-client'
import {
  listClassLessons,
  listTeacherLessons,
  moveClassLesson,
  setClassLesson,
  unlinkClassLesson,
} from '../api/lessons.api'
import { lessonQueryKeys } from '../model/lesson-query-keys'
import type { LessonMoveDirection } from '../model/lesson.types'
import styles from '../Lessons.module.css'
import { ConfirmationDialog } from './ConfirmationDialog'

interface ClassLessonsPanelProps {
  classId: string
}

type RowAction = 'hide' | 'publish' | 'unlink'

interface RowActionInput {
  lessonId: string
  type: RowAction
}

export function ClassLessonsPanel({ classId }: ClassLessonsPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedLessonId, setSelectedLessonId] = useState('')
  const [unlinkLessonId, setUnlinkLessonId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const classLessonsQuery = useQuery({
    queryKey: lessonQueryKeys.class(classId),
    queryFn: () => listClassLessons(classId),
    enabled: Boolean(classId),
  })
  const libraryQuery = useQuery({
    queryKey: lessonQueryKeys.list({}),
    queryFn: () => listTeacherLessons(),
  })

  const assignedIds = useMemo(
    () => new Set(classLessonsQuery.data?.map((lesson) => lesson.id) ?? []),
    [classLessonsQuery.data],
  )
  const availableLessons =
    libraryQuery.data?.filter(
      (lesson) => lesson.status !== 'ARCHIVED' && !assignedIds.has(lesson.id),
    ) ?? []

  const refreshLessons = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: lessonQueryKeys.class(classId) }),
      queryClient.invalidateQueries({ queryKey: lessonQueryKeys.lists }),
    ])
  }

  const addMutation = useMutation({
    mutationFn: (lessonId: string) => setClassLesson(classId, lessonId, false),
    onMutate: () => setActionError(null),
    onSuccess: async () => {
      setSelectedLessonId('')
      await refreshLessons()
    },
    onError: (error) => setActionError(getPanelError(error, t)),
  })
  const rowMutation = useMutation({
    mutationFn: async ({ lessonId, type }: RowActionInput) => {
      if (type === 'unlink') {
        await unlinkClassLesson(classId, lessonId)
        return
      }
      await setClassLesson(classId, lessonId, type === 'publish')
    },
    onMutate: () => setActionError(null),
    onSuccess: async () => {
      setUnlinkLessonId(null)
      await refreshLessons()
    },
    onError: (error) => setActionError(getPanelError(error, t)),
  })
  const moveMutation = useMutation({
    mutationFn: ({
      direction,
      lessonId,
    }: {
      direction: LessonMoveDirection
      lessonId: string
    }) => moveClassLesson(classId, lessonId, direction),
    onMutate: () => setActionError(null),
    onSuccess: (orderedLessons) => {
      queryClient.setQueryData(
        lessonQueryKeys.class(classId),
        orderedLessons,
      )
      void queryClient.invalidateQueries({ queryKey: lessonQueryKeys.lists })
    },
    onError: (error) => setActionError(getPanelError(error, t)),
  })

  return (
    <section className={styles.classLessonsPanel} aria-labelledby="class-lessons-title">
      <div className={styles.sectionHeading}>
        <BookOpen size={19} aria-hidden="true" />
        <div>
          <h2 id="class-lessons-title">{t('lessons.classPanel.title')}</h2>
          <p>{t('lessons.classPanel.description')}</p>
        </div>
      </div>

      <div className={styles.classLessonToolbar}>
        <label>
          <span className={styles.srOnly}>{t('lessons.classPanel.choose')}</span>
          <select
            className={styles.classLibrarySelect}
            disabled={libraryQuery.isLoading || availableLessons.length === 0}
            onChange={(event) => setSelectedLessonId(event.target.value)}
            value={selectedLessonId}
          >
            <option value="">
              {libraryQuery.isLoading
                ? t('lessons.classPanel.libraryLoading')
                : availableLessons.length === 0
                  ? t('lessons.classPanel.noneAvailable')
                  : t('lessons.classPanel.choose')}
            </option>
            {availableLessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title.trim() || t('lessons.common.untitled')}
              </option>
            ))}
          </select>
        </label>
        <button
          className={styles.secondaryButton}
          disabled={!selectedLessonId || addMutation.isPending}
          onClick={() => addMutation.mutate(selectedLessonId)}
          type="button"
        >
          <Plus size={16} aria-hidden="true" />
          {t('lessons.classPanel.add')}
        </button>
      </div>

      {(libraryQuery.isError || classLessonsQuery.isError) && (
        <p className={styles.errorStatus} role="alert">
          {t('lessons.classPanel.loadError')}
        </p>
      )}
      {actionError && (
        <p className={styles.errorStatus} role="alert">
          {actionError}
        </p>
      )}
      {classLessonsQuery.isLoading && (
        <p className={styles.quietNotice}>{t('lessons.classPanel.loading')}</p>
      )}
      {classLessonsQuery.data?.length === 0 && (
        <p className={styles.quietNotice}>{t('lessons.classPanel.empty')}</p>
      )}

      {classLessonsQuery.data && classLessonsQuery.data.length > 0 && (
        <ol className={styles.compactLessonList}>
          {classLessonsQuery.data.map((lesson, index, lessons) => {
            const rowPending =
              rowMutation.isPending &&
              rowMutation.variables?.lessonId === lesson.id
            return (
              <li className={styles.compactLessonRow} key={lesson.id}>
                <div className={styles.compactLessonCopy}>
                  <strong>
                    {lesson.title.trim() || t('lessons.common.untitled')}
                  </strong>
                  <div className={styles.classLessonMeta}>
                    <span
                      className={`${styles.classLessonState} ${lesson.publishedAt ? styles.classLessonStatePublished : ''}`}
                    >
                      {lesson.status === 'ARCHIVED'
                        ? t('lessons.status.ARCHIVED')
                        : lesson.publishedAt
                        ? t('lessons.classPanel.published')
                        : t('lessons.classPanel.hidden')}
                    </span>
                    <span>{t(`lessons.locale.${lesson.contentLocale}`)}</span>
                    {lesson.estimatedMinutes !== null && (
                      <span>
                        {t('lessons.common.minutes', {
                          count: lesson.estimatedMinutes,
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.compactLessonActions}>
                  {lesson.status !== 'ARCHIVED' && (
                    <>
                      <button
                        aria-label={t('lessons.classPanel.moveUpNamed', {
                          title: lesson.title || t('lessons.common.untitled'),
                        })}
                        disabled={index === 0 || moveMutation.isPending}
                        onClick={() =>
                          moveMutation.mutate({
                            direction: 'UP',
                            lessonId: lesson.id,
                          })
                        }
                        title={t('lessons.classPanel.moveUp')}
                        type="button"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        aria-label={t('lessons.classPanel.moveDownNamed', {
                          title: lesson.title || t('lessons.common.untitled'),
                        })}
                        disabled={
                          index === lessons.length - 1 ||
                          moveMutation.isPending
                        }
                        onClick={() =>
                          moveMutation.mutate({
                            direction: 'DOWN',
                            lessonId: lesson.id,
                          })
                        }
                        title={t('lessons.classPanel.moveDown')}
                        type="button"
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        aria-label={
                          lesson.publishedAt
                            ? t('lessons.classPanel.hideNamed', {
                                title:
                                  lesson.title || t('lessons.common.untitled'),
                              })
                            : t('lessons.classPanel.publishNamed', {
                                title:
                                  lesson.title || t('lessons.common.untitled'),
                              })
                        }
                        disabled={rowMutation.isPending}
                        onClick={() =>
                          rowMutation.mutate({
                            lessonId: lesson.id,
                            type: lesson.publishedAt ? 'hide' : 'publish',
                          })
                        }
                        title={
                          lesson.publishedAt
                            ? t('lessons.classPanel.hide')
                            : t('lessons.classPanel.publish')
                        }
                        type="button"
                      >
                        {lesson.publishedAt ? (
                          <EyeOff size={15} />
                        ) : (
                          <Eye size={15} />
                        )}
                      </button>
                    </>
                  )}
                  <Link
                    aria-label={t('lessons.classPanel.editNamed', {
                      title: lesson.title || t('lessons.common.untitled'),
                    })}
                    title={t('lessons.actions.edit')}
                    to={`/app/teacher/lessons/${lesson.id}/edit`}
                  >
                    <Edit3 size={15} />
                  </Link>
                  <button
                    aria-label={t('lessons.classPanel.unlinkNamed', {
                      title: lesson.title || t('lessons.common.untitled'),
                    })}
                    className={styles.unlinkButton}
                    disabled={rowPending}
                    onClick={() => setUnlinkLessonId(lesson.id)}
                    title={t('lessons.classPanel.unlink')}
                    type="button"
                  >
                    <Link2Off size={15} />
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {unlinkLessonId && (
        <ConfirmationDialog
          cancelLabel={t('lessons.common.cancel')}
          confirmLabel={t('lessons.confirm.unlink.confirm')}
          description={t('lessons.confirm.unlink.description')}
          error={
            rowMutation.isError
              ? getPanelError(rowMutation.error, t)
              : undefined
          }
          isPending={rowMutation.isPending}
          onCancel={() => {
            rowMutation.reset()
            setActionError(null)
            setUnlinkLessonId(null)
          }}
          onConfirm={() =>
            rowMutation.mutate({ lessonId: unlinkLessonId, type: 'unlink' })
          }
          title={t('lessons.confirm.unlink.title')}
        />
      )}
    </section>
  )
}

function getPanelError(error: Error, t: (key: string) => string): string {
  if (error instanceof ApiError) {
    if (
      error.status === 400 ||
      error.code === 'LESSON_INCOMPLETE' ||
      error.code === 'LESSON_NOT_READY'
    ) {
      return t('lessons.errors.publishIncomplete')
    }
    if (error.code === 'NETWORK_ERROR') {
      return t('lessons.errors.network')
    }
  }
  return t('lessons.errors.classAction')
}
