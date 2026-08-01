import { useMutation } from '@tanstack/react-query'
import {
  Award,
  Brush,
  Check,
  Compass,
  Edit3,
  Frame,
  Save,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../auth/model/session.store'
import { ApiError } from '../../shared/api/api-client'
import {
  updateStudentProfile,
  type UpdateStudentProfileInput,
} from './api/student-profile.api'
import styles from './StudentProfilePage.module.css'

type StudentProfileFormValues = UpdateStudentProfileInput

export function StudentProfilePage() {
  const { t } = useTranslation()
  const user = useSessionStore((state) => state.user)
  const updateUser = useSessionStore((state) => state.updateUser)
  const [isEditing, setIsEditing] = useState(false)
  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
  } = useForm<StudentProfileFormValues>({
    defaultValues: {
      bio: user?.profile.bio ?? '',
      displayName: user?.profile.displayName ?? '',
    },
  })

  useEffect(() => {
    if (user) {
      reset({
        bio: user.profile.bio ?? '',
        displayName: user.profile.displayName,
      })
    }
  }, [reset, user])

  const saveMutation = useMutation({
    mutationFn: updateStudentProfile,
    onSuccess: (updatedUser) => {
      updateUser(updatedUser)
      reset({
        bio: updatedUser.profile.bio ?? '',
        displayName: updatedUser.profile.displayName,
      })
      setIsEditing(false)
    },
  })

  if (!user) {
    return (
      <section className={styles.page} aria-labelledby="student-profile-title">
        <div className={styles.unavailable}>
          <h1 id="student-profile-title">{t('studentProfile.title')}</h1>
          <p>{t('studentProfile.unavailable')}</p>
        </div>
      </section>
    )
  }

  const grade =
    user.profile.gradeLevel === null
      ? t('studentProfile.gradeUnavailable')
      : t('studentProfile.grade', { grade: user.profile.gradeLevel })

  const openEditor = () => {
    reset({
      bio: user.profile.bio ?? '',
      displayName: user.profile.displayName,
    })
    saveMutation.reset()
    setIsEditing(true)
  }

  const closeEditor = () => {
    reset({
      bio: user.profile.bio ?? '',
      displayName: user.profile.displayName,
    })
    saveMutation.reset()
    setIsEditing(false)
  }

  const onSubmit = handleSubmit((values) => {
    saveMutation.mutate({
      bio: values.bio.trim(),
      displayName: values.displayName.trim(),
    })
  })

  return (
    <section className={styles.page} aria-labelledby="student-profile-title">
      <div className={styles.profile}>
        <header className={styles.cover}>
          <div className={styles.coverOrbit} aria-hidden="true" />
          <div className={styles.coverStars} aria-hidden="true">
            <span>✦</span>
            <span>✧</span>
            <span>✦</span>
          </div>
          <p className={styles.coverEyebrow}>
            <Compass size={15} aria-hidden="true" />
            {t('studentProfile.eyebrow')}
          </p>
          <button
            className={styles.editButton}
            type="button"
            onClick={openEditor}
          >
            <Edit3 size={16} aria-hidden="true" />
            {t('studentProfile.customize')}
          </button>

          <div className={styles.identity}>
            <StudentAvatar
              avatarUrl={user.profile.avatarUrl}
              displayName={user.profile.displayName}
            />
            <div>
              <h1 id="student-profile-title">{user.profile.displayName}</h1>
              <p>{grade}</p>
              <span>{t('studentProfile.titleEmpty')}</span>
            </div>
          </div>
        </header>

        {saveMutation.isSuccess && !isEditing && (
          <p className={styles.savedStatus} role="status">
            <Check size={17} aria-hidden="true" />
            {t('studentProfile.saved')}
          </p>
        )}

        {isEditing && (
          <section
            className={styles.editor}
            aria-labelledby="student-profile-editor-title"
          >
            <div className={styles.editorHeading}>
              <div>
                <p>{t('studentProfile.editor.eyebrow')}</p>
                <h2 id="student-profile-editor-title">
                  {t('studentProfile.editor.title')}
                </h2>
              </div>
              <button
                className={styles.closeButton}
                type="button"
                aria-label={t('studentProfile.editor.close')}
                onClick={closeEditor}
              >
                <X size={18} />
              </button>
            </div>

            <form
              className={styles.form}
              noValidate
              onSubmit={(event) => void onSubmit(event)}
            >
              <fieldset disabled={saveMutation.isPending}>
                <label className={styles.field} htmlFor="student-display-name">
                  <span>{t('studentProfile.editor.displayName')}</span>
                  <input
                    {...register('displayName', {
                      required: t(
                        'studentProfile.validation.displayNameRequired',
                      ),
                      validate: (value) =>
                        value.trim().length >= 2 ||
                        t('studentProfile.validation.displayNameMin'),
                      maxLength: {
                        value: 80,
                        message: t(
                          'studentProfile.validation.displayNameMax',
                        ),
                      },
                    })}
                    autoComplete="name"
                    id="student-display-name"
                    maxLength={80}
                    aria-describedby={
                      errors.displayName
                        ? 'student-display-name-error'
                        : undefined
                    }
                    aria-invalid={Boolean(errors.displayName)}
                  />
                  {errors.displayName && (
                    <small
                      className={styles.fieldError}
                      id="student-display-name-error"
                    >
                      {errors.displayName.message}
                    </small>
                  )}
                </label>

                <label className={styles.field} htmlFor="student-bio">
                  <span>{t('studentProfile.editor.bio')}</span>
                  <textarea
                    {...register('bio', {
                      maxLength: {
                        value: 500,
                        message: t('studentProfile.validation.bioMax'),
                      },
                    })}
                    id="student-bio"
                    maxLength={500}
                    placeholder={t('studentProfile.editor.bioPlaceholder')}
                    rows={4}
                    aria-describedby={
                      errors.bio ? 'student-bio-error' : undefined
                    }
                    aria-invalid={Boolean(errors.bio)}
                  />
                  {errors.bio && (
                    <small
                      className={styles.fieldError}
                      id="student-bio-error"
                    >
                      {errors.bio.message}
                    </small>
                  )}
                </label>

                <p className={styles.avatarHint}>
                  <Frame size={16} aria-hidden="true" />
                  {t('studentProfile.editor.avatarHint')}
                </p>
              </fieldset>

              {saveMutation.isError && (
                <p className={styles.errorStatus} role="alert">
                  {getSaveErrorMessage(saveMutation.error, t)}
                </p>
              )}

              <div className={styles.editorActions}>
                <button
                  className={styles.cancelButton}
                  type="button"
                  onClick={closeEditor}
                >
                  {t('studentProfile.editor.cancel')}
                </button>
                <button
                  className={styles.saveButton}
                  type="submit"
                  disabled={!isDirty || saveMutation.isPending}
                >
                  <Save size={16} aria-hidden="true" />
                  {saveMutation.isPending
                    ? t('studentProfile.editor.saving')
                    : t('studentProfile.editor.save')}
                </button>
              </div>
            </form>
          </section>
        )}

        <div className={styles.profileBody}>
          <main className={styles.mainColumn}>
            <section className={styles.profileSection}>
              <div className={styles.sectionHeading}>
                <Sparkles size={19} aria-hidden="true" />
                <div>
                  <h2>{t('studentProfile.about.title')}</h2>
                  <p>{t('studentProfile.about.description')}</p>
                </div>
              </div>
              <p
                className={
                  user.profile.bio ? styles.aboutCopy : styles.emptyCopy
                }
              >
                {user.profile.bio || t('studentProfile.about.empty')}
              </p>
            </section>

            <section className={styles.profileSection}>
              <div className={styles.sectionHeading}>
                <Award size={19} aria-hidden="true" />
                <div>
                  <h2>{t('studentProfile.showcase.title')}</h2>
                  <p>{t('studentProfile.showcase.description')}</p>
                </div>
              </div>
              <div
                className={styles.badgeShowcase}
                aria-label={t('studentProfile.showcase.label')}
              >
                {[0, 1, 2].map((slot) => (
                  <span className={styles.badgeSlot} key={slot}>
                    <Award size={24} aria-hidden="true" />
                  </span>
                ))}
              </div>
              <p className={styles.emptyCopy}>
                {t('studentProfile.showcase.empty')}
              </p>
            </section>

            <section className={styles.profileSection}>
              <div className={styles.sectionHeading}>
                <ShieldCheck size={19} aria-hidden="true" />
                <div>
                  <h2>{t('studentProfile.collection.title')}</h2>
                  <p>{t('studentProfile.collection.description')}</p>
                </div>
              </div>
              <div className={styles.collectionEmpty}>
                <Award size={30} aria-hidden="true" />
                <p>{t('studentProfile.collection.empty')}</p>
              </div>
            </section>
          </main>

          <div className={styles.sideColumn}>
            <section className={styles.appearanceSection}>
              <Brush size={19} aria-hidden="true" />
              <h2>{t('studentProfile.appearance.title')}</h2>
              <p>{t('studentProfile.appearance.description')}</p>
              <div className={styles.appearancePreview} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <small>{t('studentProfile.appearance.unavailable')}</small>
            </section>

            <section className={styles.visibilitySection}>
              <ShieldCheck size={19} aria-hidden="true" />
              <h2>{t('studentProfile.visibility.title')}</h2>
              <p>{t('studentProfile.visibility.description')}</p>
            </section>
          </div>
        </div>
      </div>
    </section>
  )
}

function StudentAvatar({
  avatarUrl,
  displayName,
}: {
  avatarUrl: string | null
  displayName: string
}) {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <div className={styles.avatar} aria-hidden="true">
      {avatarUrl ? <img alt="" src={avatarUrl} /> : initials || 'O'}
    </div>
  )
}

function getSaveErrorMessage(error: Error, t: (key: string) => string) {
  if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
    return t('studentProfile.errors.network')
  }

  return t('studentProfile.errors.save')
}
