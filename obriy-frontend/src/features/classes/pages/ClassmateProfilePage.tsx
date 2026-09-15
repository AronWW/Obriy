import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Award,
  Brush,
  Compass,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import profileStyles from '../../student-profile/StudentProfilePage.module.css'
import { getClassmateProfile } from '../api/classes.api'
import styles from '../ClassesPage.module.css'
import {
  BadgeCollectionDialog,
  BadgeShowcase,
  GamificationProgressCard,
} from '../../gamification'

export function ClassmateProfilePage() {
  const { t } = useTranslation()
  const { studentId = '' } = useParams()
  const [collectionOpen, setCollectionOpen] = useState(false)
  const profileQuery = useQuery({
    queryKey: ['classes', 'student', 'classmates', studentId],
    queryFn: () => getClassmateProfile(studentId),
    enabled: Boolean(studentId),
  })

  if (profileQuery.isLoading) {
    return (
      <section className={styles.page}>
        <div className={styles.content}>
          <div className={styles.statusPanel}>
            <p>{t('classes.student.profile.loading')}</p>
          </div>
        </div>
      </section>
    )
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <section className={styles.page}>
        <div className={styles.content}>
          <Link className={styles.backLink} to="/app/student/classes">
            <ArrowLeft size={16} />
            {t('classes.student.profile.back')}
          </Link>
          <div className={styles.statusPanel}>
            <h1>{t('classes.student.profile.notFoundTitle')}</h1>
            <p>{t('classes.student.profile.notFound')}</p>
          </div>
        </div>
      </section>
    )
  }

  const profile = profileQuery.data
  return (
    <section
      className={profileStyles.page}
      aria-labelledby="classmate-profile-title"
    >
      <div className={profileStyles.profile}>
        <Link className={styles.backLink} to="/app/student/classes">
          <ArrowLeft size={16} aria-hidden="true" />
          {t('classes.student.profile.back')}
        </Link>

        <header className={profileStyles.cover}>
          <div className={profileStyles.coverOrbit} aria-hidden="true" />
          <div className={profileStyles.coverStars} aria-hidden="true">
            <span>✦</span>
            <span>✧</span>
            <span>✦</span>
          </div>
          <p className={profileStyles.coverEyebrow}>
            <Compass size={15} aria-hidden="true" />
            {t('studentProfile.eyebrow')}
          </p>
          <div className={profileStyles.identity}>
            <ProfileAvatar
              avatarUrl={profile.avatarUrl}
              displayName={profile.displayName}
            />
            <div>
              <h1 id="classmate-profile-title">{profile.displayName}</h1>
              <span>{t('studentProfile.titleEmpty')}</span>
            </div>
          </div>
        </header>

        <GamificationProgressCard progress={profile.gamification.progress} />

        <div className={profileStyles.profileBody}>
          <main className={profileStyles.mainColumn}>
            <section className={profileStyles.profileSection}>
              <div className={profileStyles.sectionHeading}>
                <Sparkles size={19} aria-hidden="true" />
                <div>
                  <h2>{t('studentProfile.about.title')}</h2>
                  <p>{t('studentProfile.about.description')}</p>
                </div>
              </div>
              <p
                className={
                  profile.bio
                    ? profileStyles.aboutCopy
                    : profileStyles.emptyCopy
                }
              >
                {profile.bio || t('classes.student.profile.aboutEmpty')}
              </p>
            </section>

            <section className={profileStyles.profileSection}>
              <div className={profileStyles.sectionHeading}>
                <Award size={19} aria-hidden="true" />
                <div>
                  <h2>{t('studentProfile.showcase.title')}</h2>
                  <p>{t('studentProfile.showcase.description')}</p>
                </div>
              </div>
              <BadgeShowcase badges={profile.gamification.showcase} />
            </section>

            <section className={profileStyles.profileSection}>
              <div className={profileStyles.sectionHeading}>
                <ShieldCheck size={19} aria-hidden="true" />
                <div>
                  <h2>{t('studentProfile.collection.title')}</h2>
                  <p>{t('studentProfile.collection.description')}</p>
                </div>
              </div>
              <button
                className={profileStyles.collectionAction}
                onClick={() => setCollectionOpen(true)}
                type="button"
              >
                <Award size={20} aria-hidden="true" />
                {profile.gamification.badges.length
                  ? t('gamification.badges.openCollection', {
                      count: profile.gamification.badges.length,
                    })
                  : t('studentProfile.collection.empty')}
              </button>
            </section>
          </main>

          <div className={profileStyles.sideColumn}>
            <section className={profileStyles.appearanceSection}>
              <Brush size={19} aria-hidden="true" />
              <h2>{t('studentProfile.appearance.title')}</h2>
              <p>{t('studentProfile.appearance.description')}</p>
              <div
                className={profileStyles.appearancePreview}
                aria-hidden="true"
              >
                <span />
                <span />
                <span />
              </div>
              <small>{t('studentProfile.appearance.unavailable')}</small>
            </section>

            <section className={profileStyles.visibilitySection}>
              <ShieldCheck size={19} aria-hidden="true" />
              <h2>{t('studentProfile.visibility.title')}</h2>
              <p>{t('classes.student.profile.visibility')}</p>
            </section>
          </div>
        </div>
        {collectionOpen && (
          <BadgeCollectionDialog
            badges={profile.gamification.badges}
            onClose={() => setCollectionOpen(false)}
          />
        )}
      </div>
    </section>
  )
}

function ProfileAvatar({
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
    <div className={profileStyles.avatar} aria-hidden="true">
      {avatarUrl ? <img alt="" src={avatarUrl} /> : initials || 'O'}
    </div>
  )
}
