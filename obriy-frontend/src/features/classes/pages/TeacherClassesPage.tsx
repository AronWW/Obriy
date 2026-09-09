import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Plus, School, UsersRound, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ApiError } from '../../../shared/api/api-client'
import {
  createTeacherClass,
  listTeacherClasses,
} from '../api/classes.api'
import { InvitePanel } from '../components/InvitePanel'
import type {
  ClassInvite,
  CreateClassInput,
} from '../model/class.types'
import styles from '../ClassesPage.module.css'

export function TeacherClassesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [createdInvite, setCreatedInvite] = useState<ClassInvite | null>(null)
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<CreateClassInput>({
    defaultValues: { name: '' },
  })

  const classesQuery = useQuery({
    queryKey: ['classes', 'teacher'],
    queryFn: listTeacherClasses,
  })

  const createMutation = useMutation({
    mutationFn: createTeacherClass,
    onSuccess: (created) => {
      setCreatedInvite(created.invite)
      setIsCreating(false)
      reset({ name: '' })
      void queryClient.invalidateQueries({ queryKey: ['classes', 'teacher'] })
    },
  })

  const onSubmit = handleSubmit((input) => {
    setCreatedInvite(null)
    createMutation.mutate({
      name: input.name.trim(),
    })
  })

  return (
    <section className={styles.page} aria-labelledby="teacher-classes-title">
      <div className={styles.content}>
        <header className={styles.intro}>
          <div>
            <h1 id="teacher-classes-title">{t('classes.teacher.title')}</h1>
            <p>{t('classes.teacher.description')}</p>
          </div>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => {
              setCreatedInvite(null)
              createMutation.reset()
              setIsCreating(true)
            }}
          >
            <Plus size={17} aria-hidden="true" />
            {t('classes.teacher.create.action')}
          </button>
        </header>

        {createdInvite && (
          <InvitePanel
            invite={createdInvite}
          />
        )}

        {isCreating && (
          <section
            className={styles.formPanel}
            aria-labelledby="create-class-title"
          >
            <div className={styles.formHeading}>
              <div>
                <h2 id="create-class-title">
                  {t('classes.teacher.create.title')}
                </h2>
                <span className={styles.formDescription}>
                  {t('classes.teacher.create.description')}
                </span>
              </div>
              <button
                className={styles.iconButton}
                type="button"
                aria-label={t('classes.common.close')}
                onClick={() => setIsCreating(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form
              className={styles.classForm}
              noValidate
              onSubmit={(event) => void onSubmit(event)}
            >
              <fieldset disabled={createMutation.isPending}>
                <label>
                  <span>{t('classes.teacher.create.name')}</span>
                  <input
                    {...register('name', {
                      required: t('classes.validation.nameRequired'),
                      minLength: {
                        value: 2,
                        message: t('classes.validation.nameMin'),
                      },
                      maxLength: {
                        value: 80,
                        message: t('classes.validation.nameMax'),
                      },
                    })}
                    maxLength={80}
                    placeholder={t('classes.teacher.create.namePlaceholder')}
                  />
                  {errors.name && (
                    <small className={styles.fieldError}>
                      {errors.name.message}
                    </small>
                  )}
                </label>
              </fieldset>

              {createMutation.isError && (
                <p className={styles.errorStatus} role="alert">
                  {getClassErrorMessage(createMutation.error, t)}
                </p>
              )}

              <div className={styles.formActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setIsCreating(false)}
                >
                  {t('classes.common.cancel')}
                </button>
                <button className={styles.primaryButton} type="submit">
                  {createMutation.isPending
                    ? t('classes.teacher.create.creating')
                    : t('classes.teacher.create.submit')}
                </button>
              </div>
            </form>
          </section>
        )}

        {classesQuery.isLoading && (
          <StatusPanel message={t('classes.teacher.states.loading')} />
        )}

        {classesQuery.isError && (
          <StatusPanel
            message={t('classes.teacher.states.error')}
            action={t('classes.common.retry')}
            onAction={() => void classesQuery.refetch()}
          />
        )}

        {classesQuery.data?.length === 0 && !isCreating && (
          <StatusPanel
            icon={<School size={30} />}
            title={t('classes.teacher.empty.title')}
            message={t('classes.teacher.empty.description')}
            action={t('classes.teacher.create.action')}
            onAction={() => setIsCreating(true)}
          />
        )}

        {classesQuery.data && classesQuery.data.length > 0 && (
          <div className={styles.classGrid}>
            {classesQuery.data.map((classroom) => (
              <article className={styles.classCard} key={classroom.id}>
                <div className={styles.classSeal} aria-hidden="true">
                  <School size={24} />
                </div>
                <div className={styles.classCardCopy}>
                  <h2>{classroom.name}</h2>
                  <span>
                    <UsersRound size={15} aria-hidden="true" />
                    {t('classes.common.students', {
                      count: classroom.studentCount,
                    })}
                  </span>
                </div>
                <Link
                  className={styles.cardLink}
                  to={`/app/teacher/classes/${classroom.id}`}
                >
                  {t('classes.teacher.open')}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function StatusPanel({
  action,
  icon,
  message,
  onAction,
  title,
}: {
  action?: string
  icon?: React.ReactNode
  message: string
  onAction?: () => void
  title?: string
}) {
  return (
    <div className={styles.statusPanel}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {title && <h2>{title}</h2>}
      <p>{message}</p>
      {action && onAction && (
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={onAction}
        >
          {action}
        </button>
      )}
    </div>
  )
}

function getClassErrorMessage(
  error: Error,
  t: (key: string) => string,
): string {
  if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
    return t('classes.errors.network')
  }

  return t('classes.errors.unexpected')
}
