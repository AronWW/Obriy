import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  KeyRound,
  School,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ApiError } from '../../../shared/api/api-client'
import { StudentClassLessonsSection } from '../../lessons/components/StudentClassLessonsSection'
import {
  getStudentClass,
  joinClass,
  listClassmates,
} from '../api/classes.api'
import { MemberAvatar } from '../components/MemberAvatar'
import styles from '../ClassesPage.module.css'

interface JoinForm {
  code: string
}

export function StudentClassesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<JoinForm>({ defaultValues: { code: '' } })

  const classQuery = useQuery({
    queryKey: ['classes', 'student'],
    queryFn: getStudentClass,
  })
  const classmatesQuery = useQuery({
    queryKey: ['classes', 'student', 'classmates'],
    queryFn: listClassmates,
    enabled: Boolean(classQuery.data),
  })
  const joinMutation = useMutation({
    mutationFn: joinClass,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['classes', 'student'] })
    },
  })

  const onSubmit = handleSubmit(({ code }) => {
    joinMutation.mutate(code.trim())
  })

  if (classQuery.isLoading) {
    return (
      <section className={styles.page}>
        <div className={styles.content}>
          <div className={styles.statusPanel}>
            <p>{t('classes.student.states.loading')}</p>
          </div>
        </div>
      </section>
    )
  }

  if (classQuery.isError) {
    return (
      <section className={styles.page}>
        <div className={styles.content}>
          <div className={styles.statusPanel}>
            <h1>{t('classes.student.states.errorTitle')}</h1>
            <p>{t('classes.student.states.error')}</p>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => void classQuery.refetch()}
            >
              {t('classes.common.retry')}
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (!classQuery.data) {
    return (
      <section className={styles.page} aria-labelledby="student-class-title">
        <div className={styles.content}>
          <header className={styles.intro}>
            <div>
              <p className={styles.eyebrow}>
                <School size={15} aria-hidden="true" />
                {t('classes.student.eyebrow')}
              </p>
              <h1 id="student-class-title">{t('classes.student.title')}</h1>
              <p>{t('classes.student.description')}</p>
            </div>
          </header>

          <section className={styles.joinPanel}>
            <span className={styles.joinIcon} aria-hidden="true">
              <KeyRound size={30} />
            </span>
            <div>
              <h2>{t('classes.student.join.title')}</h2>
              <p>{t('classes.student.join.description')}</p>
            </div>
            <form
              className={styles.joinForm}
              noValidate
              onSubmit={(event) => void onSubmit(event)}
            >
              <label htmlFor="class-invite-code">
                {t('classes.student.join.label')}
              </label>
              <div>
                <input
                  {...register('code', {
                    required: t('classes.validation.codeRequired'),
                    pattern: {
                      value: /^[A-Za-z2-9 -]{8,12}$/,
                      message: t('classes.validation.codeInvalid'),
                    },
                  })}
                  id="class-invite-code"
                  maxLength={12}
                  autoCapitalize="characters"
                  autoComplete="off"
                  placeholder="ABCD-EFGH"
                  aria-invalid={Boolean(errors.code)}
                />
                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={joinMutation.isPending}
                >
                  {joinMutation.isPending
                    ? t('classes.student.join.joining')
                    : t('classes.student.join.action')}
                </button>
              </div>
              {errors.code && (
                <small className={styles.fieldError}>
                  {errors.code.message}
                </small>
              )}
              {joinMutation.isError && (
                <p className={styles.errorStatus} role="alert">
                  {getJoinError(joinMutation.error, t)}
                </p>
              )}
            </form>
          </section>
        </div>
      </section>
    )
  }

  const classroom = classQuery.data

  return (
    <section className={styles.page} aria-labelledby="student-class-title">
      <div className={styles.content}>
        <header className={styles.detailHero}>
          <div className={styles.classSeal} aria-hidden="true">
            <School size={24} />
          </div>
          <div>
            <p className={styles.eyebrow}>
              <School size={15} aria-hidden="true" />
              {t('classes.student.current')}
            </p>
            <h1 id="student-class-title">{classroom.name}</h1>
            <p className={styles.detailMeta}>
              {t('classes.student.teacher', {
                name: classroom.teacher.displayName,
              })}
            </p>
          </div>
        </header>

        <StudentClassLessonsSection />

        <section className={styles.membersPanel}>
          <div className={styles.sectionHeading}>
            <UsersRound size={19} aria-hidden="true" />
            <div>
              <h2>{t('classes.student.classmates.title')}</h2>
              <p>{t('classes.student.classmates.description')}</p>
            </div>
          </div>

          {classmatesQuery.isLoading && (
            <p className={styles.quietCopy}>
              {t('classes.student.classmates.loading')}
            </p>
          )}
          {classmatesQuery.isError && (
            <p className={styles.errorStatus} role="alert">
              {t('classes.student.classmates.error')}
            </p>
          )}
          {classmatesQuery.data?.length === 0 && (
            <div className={styles.membersEmpty}>
              <UserRound size={28} aria-hidden="true" />
              <p>{t('classes.student.classmates.empty')}</p>
            </div>
          )}
          {classmatesQuery.data && classmatesQuery.data.length > 0 && (
            <ul className={styles.classmateGrid}>
              {classmatesQuery.data.map((classmate) => (
                <li key={classmate.id}>
                  <MemberAvatar
                    avatarUrl={classmate.avatarUrl}
                    displayName={classmate.displayName}
                    large
                  />
                  <div>
                    <strong>{classmate.displayName}</strong>
                  </div>
                  <Link to={`/app/student/classmates/${classmate.id}`}>
                    {t('classes.student.classmates.open')}
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  )
}

function getJoinError(
  error: Error,
  t: (key: string) => string,
): string {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_CLASS_INVITE') {
      return t('classes.student.join.invalid')
    }

    if (error.code === 'STUDENT_ALREADY_IN_CLASS') {
      return t('classes.student.join.alreadyJoined')
    }

    if (error.code === 'NETWORK_ERROR') {
      return t('classes.errors.network')
    }
  }

  return t('classes.errors.unexpected')
}
