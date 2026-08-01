import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit3, Save, School, UsersRound, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import {
  createClassInvite,
  getTeacherClass,
  listTeacherClassMembers,
  updateTeacherClass,
} from '../api/classes.api'
import { InvitePanel } from '../components/InvitePanel'
import { MemberAvatar } from '../components/MemberAvatar'
import type { ClassInvite } from '../model/class.types'
import type { CreateClassInput } from '../model/class.types'
import styles from '../ClassesPage.module.css'

export function TeacherClassDetailPage() {
  const { t } = useTranslation()
  const { classId = '' } = useParams()
  const queryClient = useQueryClient()
  const [invite, setInvite] = useState<ClassInvite | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<CreateClassInput>()

  const classQuery = useQuery({
    queryKey: ['classes', 'teacher', classId],
    queryFn: () => getTeacherClass(classId),
    enabled: Boolean(classId),
  })
  const membersQuery = useQuery({
    queryKey: ['classes', 'teacher', classId, 'members'],
    queryFn: () => listTeacherClassMembers(classId),
    enabled: Boolean(classId),
  })
  const inviteMutation = useMutation({
    mutationFn: () => createClassInvite(classId),
    onSuccess: setInvite,
  })
  const updateMutation = useMutation({
    mutationFn: (input: CreateClassInput) =>
      updateTeacherClass(classId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(['classes', 'teacher', classId], updated)
      void queryClient.invalidateQueries({ queryKey: ['classes', 'teacher'] })
      setIsEditing(false)
    },
  })

  if (classQuery.isLoading) {
    return (
      <section className={styles.page}>
        <div className={styles.content}>
          <div className={styles.statusPanel}>
            <p>{t('classes.teacher.states.loading')}</p>
          </div>
        </div>
      </section>
    )
  }

  if (classQuery.isError || !classQuery.data) {
    return (
      <section className={styles.page}>
        <div className={styles.content}>
          <Link className={styles.backLink} to="/app/teacher/classes">
            <ArrowLeft size={16} />
            {t('classes.teacher.detail.back')}
          </Link>
          <div className={styles.statusPanel}>
            <h1>{t('classes.teacher.detail.notFoundTitle')}</h1>
            <p>{t('classes.teacher.detail.notFound')}</p>
          </div>
        </div>
      </section>
    )
  }

  const classroom = classQuery.data
  const openEditor = () => {
    reset({
      name: classroom.name,
      gradeLevel: classroom.gradeLevel,
    })
    updateMutation.reset()
    setIsEditing(true)
  }
  const onSubmit = handleSubmit((input) => {
    updateMutation.mutate({
      name: input.name.trim(),
      gradeLevel: Number(input.gradeLevel),
    })
  })

  return (
    <section className={styles.page} aria-labelledby="class-detail-title">
      <div className={styles.content}>
        <Link className={styles.backLink} to="/app/teacher/classes">
          <ArrowLeft size={16} aria-hidden="true" />
          {t('classes.teacher.detail.back')}
        </Link>

        <header className={styles.detailHero}>
          <div className={styles.classSeal} aria-hidden="true">
            {classroom.gradeLevel}
          </div>
          <div>
            <p className={styles.eyebrow}>
              <School size={15} aria-hidden="true" />
              {t('classes.teacher.detail.eyebrow')}
            </p>
            <h1 id="class-detail-title">{classroom.name}</h1>
            <p>
              {t('classes.common.grade', { grade: classroom.gradeLevel })}
              {' · '}
              {t('classes.common.students', {
                count: classroom.studentCount,
              })}
            </p>
          </div>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={openEditor}
          >
            <Edit3 size={16} aria-hidden="true" />
            {t('classes.teacher.edit.action')}
          </button>
        </header>

        {isEditing && (
          <section
            className={styles.formPanel}
            aria-labelledby="edit-class-title"
          >
            <div className={styles.formHeading}>
              <div>
                <p>{t('classes.teacher.edit.eyebrow')}</p>
                <h2 id="edit-class-title">
                  {t('classes.teacher.edit.title')}
                </h2>
              </div>
              <button
                className={styles.iconButton}
                type="button"
                aria-label={t('classes.common.close')}
                onClick={() => setIsEditing(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form
              className={styles.classForm}
              noValidate
              onSubmit={(event) => void onSubmit(event)}
            >
              <fieldset disabled={updateMutation.isPending}>
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
                  />
                  {errors.name && (
                    <small className={styles.fieldError}>
                      {errors.name.message}
                    </small>
                  )}
                </label>
                <label>
                  <span>{t('classes.teacher.create.grade')}</span>
                  <select
                    {...register('gradeLevel', {
                      required: true,
                      valueAsNumber: true,
                    })}
                  >
                    {Array.from({ length: 12 }, (_, index) => index + 1).map(
                      (grade) => (
                        <option value={grade} key={grade}>
                          {t('classes.common.grade', { grade })}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </fieldset>
              {updateMutation.isError && (
                <p className={styles.errorStatus} role="alert">
                  {t('classes.teacher.edit.error')}
                </p>
              )}
              <div className={styles.formActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setIsEditing(false)}
                >
                  {t('classes.common.cancel')}
                </button>
                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={updateMutation.isPending}
                >
                  <Save size={16} aria-hidden="true" />
                  {updateMutation.isPending
                    ? t('classes.teacher.edit.saving')
                    : t('classes.teacher.edit.save')}
                </button>
              </div>
            </form>
          </section>
        )}

        <div className={styles.detailGrid}>
          <section className={styles.membersPanel}>
            <div className={styles.sectionHeading}>
              <UsersRound size={19} aria-hidden="true" />
              <div>
                <h2>{t('classes.teacher.members.title')}</h2>
                <p>{t('classes.teacher.members.description')}</p>
              </div>
            </div>

            {membersQuery.isLoading && (
              <p className={styles.quietCopy}>
                {t('classes.teacher.members.loading')}
              </p>
            )}
            {membersQuery.isError && (
              <p className={styles.errorStatus} role="alert">
                {t('classes.teacher.members.error')}
              </p>
            )}
            {membersQuery.data?.length === 0 && (
              <div className={styles.membersEmpty}>
                <UsersRound size={28} aria-hidden="true" />
                <p>{t('classes.teacher.members.empty')}</p>
              </div>
            )}
            {membersQuery.data && membersQuery.data.length > 0 && (
              <ul className={styles.memberList}>
                {membersQuery.data.map((member) => (
                  <li key={member.id}>
                    <MemberAvatar
                      avatarUrl={member.avatarUrl}
                      displayName={member.displayName}
                    />
                    <div>
                      <strong>{member.displayName}</strong>
                      <span>
                        {member.gradeLevel === null
                          ? t('classes.common.gradeUnknown')
                          : t('classes.common.grade', {
                              grade: member.gradeLevel,
                            })}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div>
            <InvitePanel
              invite={invite}
              isRefreshing={inviteMutation.isPending}
              onRefresh={() => inviteMutation.mutate()}
            />
            {inviteMutation.isError && (
              <p className={styles.errorStatus} role="alert">
                {t('classes.teacher.invite.error')}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
