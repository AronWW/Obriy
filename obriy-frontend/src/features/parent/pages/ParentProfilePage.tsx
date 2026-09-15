import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../../auth/model/session.store'
import { AvatarEditor, SecuritySection, profileApi } from '../../profile'
import styles from './ParentProfilePage.module.css'

type FormValues = { displayName: string; bio: string }

export function ParentProfilePage() {
  const { t } = useTranslation()
  const user = useSessionStore((state) => state.user)
  const updateUser = useSessionStore((state) => state.updateUser)
  const { register, reset, handleSubmit, formState } = useForm<FormValues>({
    defaultValues: {
      displayName: user?.profile.displayName ?? '',
      bio: user?.profile.bio ?? '',
    },
  })

  useEffect(() => {
    if (user) reset({ displayName: user.profile.displayName, bio: user.profile.bio ?? '' })
  }, [reset, user])

  const save = useMutation({
    mutationFn: profileApi.update,
    onSuccess: (updated) => {
      updateUser(updated)
      reset({ displayName: updated.profile.displayName, bio: updated.profile.bio ?? '' })
    },
  })

  if (!user) return null
  const initials = user.profile.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  const submit = handleSubmit((values) =>
    save.mutate({
      displayName: values.displayName.trim(),
      bio: values.bio.trim(),
    }),
  )

  return (
    <section className={styles.page} aria-labelledby="parent-profile-title">
      <div className={styles.document}>
        <header className={styles.heading}>
          <h1 id="parent-profile-title">{t('profileSettings.parent.title')}</h1>
          <p>{t('profileSettings.parent.description')}</p>
        </header>

        <div className={styles.identity}>
          <div className={styles.avatar} aria-hidden="true">
            {user.profile.avatarUrl ? <img src={user.profile.avatarUrl} alt="" /> : initials || 'O'}
          </div>
          <AvatarEditor hasAvatar={Boolean(user.profile.avatarUrl)} />
        </div>

        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <fieldset className={styles.fieldset} disabled={save.isPending}>
            <label className={styles.field}>
              <span>{t('profileSettings.displayName')}</span>
              <input
                {...register('displayName', { required: true, minLength: 2, maxLength: 80 })}
                autoComplete="name"
              />
            </label>
            <label className={styles.field}>
              <span>{t('profileSettings.bio')}</span>
              <textarea {...register('bio', { maxLength: 500 })} rows={4} />
            </label>
            <label className={styles.field}>
              <span>{t('profileSettings.email')}</span>
              <input type="email" value={user.email} readOnly />
            </label>
          </fieldset>
          {save.isSuccess && <p className={styles.success}>{t('profileSettings.saved')}</p>}
          {save.isError && <p className={styles.error} role="alert">{t('profileSettings.saveError')}</p>}
          <div className={styles.actions}>
            <button className={styles.save} type="submit" disabled={!formState.isDirty || save.isPending}>
              {save.isPending ? t('profileSettings.saving') : t('profileSettings.save')}
            </button>
          </div>
        </form>
        <SecuritySection />
      </div>
    </section>
  )
}
