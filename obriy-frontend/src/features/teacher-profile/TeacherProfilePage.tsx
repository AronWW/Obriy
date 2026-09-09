import { useMutation } from '@tanstack/react-query'
import { BookOpen, Check, FileText, Mail, RotateCcw, Save, UserRound } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { PrivateProfile } from '../auth/model/auth.types'
import { useSessionStore } from '../auth/model/session.store'
import { ApiError } from '../../shared/api/api-client'
import { updateTeacherProfile, type UpdateTeacherProfileInput } from './api/teacher-profile.api'
import styles from './TeacherProfilePage.module.css'

type TeacherProfileFormValues = UpdateTeacherProfileInput

function toFormValues(user: PrivateProfile): TeacherProfileFormValues {
  return {
    displayName: user.profile.displayName,
    subjectArea: user.profile.subjectArea ?? '',
    bio: user.profile.bio ?? '',
  }
}

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('')

  return initials || 'O'
}

export function TeacherProfilePage() {
  const { t } = useTranslation()
  const user = useSessionStore((state) => state.user)
  const updateUser = useSessionStore((state) => state.updateUser)
  const currentValues = useMemo(
    () => (user ? toFormValues(user) : null),
    [user],
  )
  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
    control,
  } = useForm<TeacherProfileFormValues>({
    defaultValues: currentValues ?? {
      bio: '',
      displayName: '',
      subjectArea: '',
    },
  })

  useEffect(() => {
    if (currentValues) {
      reset(currentValues)
    }
  }, [currentValues, reset])

  const saveMutation = useMutation({
    mutationFn: updateTeacherProfile,
    onSuccess: (updatedUser) => {
      // Keep the visible shell and future screens consistent without replacing
      // the session token or forcing a refresh.
      updateUser(updatedUser)
      reset(toFormValues(updatedUser))
    },
  })

  const displayName =
    useWatch({ control, name: 'displayName' }) || user?.profile.displayName || ''

  if (!user) {
    return (
      <section className={styles.page} aria-labelledby="teacher-profile-title">
        <div className={styles.document} data-testid="teacher-profile-document">
          <h1 id="teacher-profile-title">{t('teacherProfile.title')}</h1>
          <p className={styles.unavailable} role="status">
            {t('teacherProfile.unavailable')}
          </p>
        </div>
      </section>
    )
  }

  const onSubmit = handleSubmit((values) => {
    saveMutation.mutate({
      bio: values.bio.trim(),
      displayName: values.displayName.trim(),
      subjectArea: values.subjectArea.trim(),
    })
  })

  const errorMessage = saveMutation.isError
    ? getSaveErrorMessage(saveMutation.error, t)
    : null

  return (
    <section className={styles.page} aria-labelledby="teacher-profile-title">
      <div className={styles.document} data-testid="teacher-profile-document">
        <header className={styles.heading}>
          <h1 id="teacher-profile-title">{t('teacherProfile.title')}</h1>
          <p>{t('teacherProfile.description')}</p>
        </header>

        <div className={styles.identity}>
          <div className={styles.avatar} aria-hidden="true">
            {user.profile.avatarUrl ? (
              <img alt="" src={user.profile.avatarUrl} />
            ) : (
              getInitials(displayName)
            )}
          </div>
          <div>
            <p className={styles.identityName}>{displayName}</p>
            <p className={styles.identityHint}>{t('teacherProfile.avatarHint')}</p>
          </div>
        </div>

        <form className={styles.form} noValidate onSubmit={(event) => void onSubmit(event)}>
          <fieldset disabled={saveMutation.isPending}>
            <legend className={styles.srOnly}>{t('teacherProfile.formLegend')}</legend>

            <label className={styles.field} htmlFor="teacher-display-name">
              <span className={styles.fieldLabel}>
                <UserRound size={17} aria-hidden="true" />
                {t('teacherProfile.displayName')}
              </span>
              <input
                {...register('displayName', {
                  required: t('teacherProfile.validation.displayNameRequired'),
                  validate: (value) =>
                    value.trim().length >= 2 || t('teacherProfile.validation.displayNameMin'),
                  maxLength: {
                    value: 80,
                    message: t('teacherProfile.validation.displayNameMax'),
                  },
                })}
                autoComplete="name"
                id="teacher-display-name"
                maxLength={80}
                aria-describedby={errors.displayName ? 'teacher-display-name-error' : undefined}
                aria-invalid={Boolean(errors.displayName)}
              />
              {errors.displayName && (
                <span className={styles.fieldError} id="teacher-display-name-error">
                  {errors.displayName.message}
                </span>
              )}
            </label>

            <label className={styles.field} htmlFor="teacher-subject-area">
              <span className={styles.fieldLabel}>
                <BookOpen size={17} aria-hidden="true" />
                {t('teacherProfile.subjectArea')}
              </span>
              <input
                {...register('subjectArea', {
                  maxLength: {
                    value: 80,
                    message: t('teacherProfile.validation.subjectAreaMax'),
                  },
                })}
                autoComplete="organization-title"
                id="teacher-subject-area"
                maxLength={80}
                placeholder={t('teacherProfile.subjectAreaPlaceholder')}
                aria-describedby={errors.subjectArea ? 'teacher-subject-area-error' : undefined}
                aria-invalid={Boolean(errors.subjectArea)}
              />
              {errors.subjectArea && (
                <span className={styles.fieldError} id="teacher-subject-area-error">
                  {errors.subjectArea.message}
                </span>
              )}
            </label>

            <label className={styles.field} htmlFor="teacher-bio">
              <span className={styles.fieldLabel}>
                <FileText size={17} aria-hidden="true" />
                {t('teacherProfile.bio')}
              </span>
              <textarea
                {...register('bio', {
                  maxLength: {
                    value: 500,
                    message: t('teacherProfile.validation.bioMax'),
                  },
                })}
                id="teacher-bio"
                maxLength={500}
                placeholder={t('teacherProfile.bioPlaceholder')}
                rows={5}
                aria-describedby={errors.bio ? 'teacher-bio-error' : undefined}
                aria-invalid={Boolean(errors.bio)}
              />
              {errors.bio && (
                <span className={styles.fieldError} id="teacher-bio-error">
                  {errors.bio.message}
                </span>
              )}
            </label>

            <div className={styles.readOnlyField}>
              <label className={styles.fieldLabel} htmlFor="teacher-email">
                <Mail size={17} aria-hidden="true" />
                {t('teacherProfile.email')}
              </label>
              <input
                id="teacher-email"
                type="email"
                value={user.email}
                readOnly
                aria-describedby="teacher-email-hint"
              />
              <p id="teacher-email-hint">{t('teacherProfile.emailHint')}</p>
            </div>
          </fieldset>

          <div className={styles.statusArea} aria-live="polite">
            {saveMutation.isSuccess && (
              <p className={styles.success} role="status">
                <Check size={17} aria-hidden="true" />
                {t('teacherProfile.saved')}
              </p>
            )}
            {errorMessage && <p className={styles.error} role="alert">{errorMessage}</p>}
          </div>

          <div className={styles.actions}>
            <button
              className={styles.resetButton}
              type="button"
              disabled={!isDirty || saveMutation.isPending}
              onClick={() => {
                reset(toFormValues(user))
                saveMutation.reset()
              }}
            >
              <RotateCcw size={16} aria-hidden="true" />
              {t('teacherProfile.reset')}
            </button>
            <button
              className={styles.saveButton}
              type="submit"
              disabled={!isDirty || saveMutation.isPending}
            >
              <Save size={16} aria-hidden="true" />
              {saveMutation.isPending
                ? t('teacherProfile.saving')
                : t('teacherProfile.save')}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

function getSaveErrorMessage(error: Error, t: (key: string) => string): string {
  if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
    return t('teacherProfile.errors.network')
  }

  return t('teacherProfile.errors.save')
}
