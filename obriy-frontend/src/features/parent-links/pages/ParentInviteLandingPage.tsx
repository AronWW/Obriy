import { ArrowRight, Link2Off, LogIn, ShieldCheck, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useSessionStore } from '../../auth/model/session.store'
import { ObriyBackground } from '../../../shared/backgrounds/ObriyBackground'
import { BrandLogo } from '../../../shared/brand/BrandLogo'
import {
  getPendingParentInvitation,
  rememberParentInvitation,
} from '../model/parent-invitation-session'
import styles from './ParentInviteLandingPage.module.css'

export function ParentInviteLandingPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const status = useSessionStore((state) => state.status)
  const role = useSessionStore((state) => state.user?.role)
  const token = searchParams.get('token')?.trim() ?? ''
  const [isValid, setIsValid] = useState<boolean | null>(null)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsValid(
        token
          ? rememberParentInvitation(token)
          : getPendingParentInvitation() !== null,
      )
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [token])

  if (isValid === null || status === 'checking') {
    return <InviteShell><span className={styles.spinner} /></InviteShell>
  }

  if (!isValid) {
    return (
      <InviteShell>
        <span className={styles.icon} aria-hidden="true">
          <Link2Off size={29} />
        </span>
        <h1>{t('parentLinks.landing.invalidTitle')}</h1>
        <p>{t('parentLinks.landing.invalidDescription')}</p>
        <Link className={styles.secondaryButton} to="/">
          {t('parentLinks.landing.home')}
        </Link>
      </InviteShell>
    )
  }

  if (status === 'authenticated' && role === 'PARENT') {
    return <Navigate to="/app/parent/connect" replace />
  }

  if (status === 'authenticated') {
    return (
      <InviteShell>
        <span className={styles.icon} aria-hidden="true">
          <ShieldCheck size={29} />
        </span>
        <h1>{t('parentLinks.landing.wrongRoleTitle')}</h1>
        <p>{t('parentLinks.landing.wrongRoleDescription')}</p>
        <Link className={styles.secondaryButton} to="/app">
          {t('parentLinks.landing.workspace')}
        </Link>
      </InviteShell>
    )
  }

  return (
    <InviteShell>
      <span className={styles.icon} aria-hidden="true">
        <ShieldCheck size={29} />
      </span>
      <p className={styles.eyebrow}>{t('parentLinks.landing.eyebrow')}</p>
      <h1>{t('parentLinks.landing.title')}</h1>
      <p>{t('parentLinks.landing.description')}</p>
      <div className={styles.actions}>
        <Link className={styles.primaryButton} to="/auth/login">
          <LogIn size={17} />
          {t('parentLinks.landing.login')}
        </Link>
        <Link className={styles.secondaryButton} to="/auth/register/parent">
          <UserPlus size={17} />
          {t('parentLinks.landing.register')}
          <ArrowRight size={16} />
        </Link>
      </div>
      <small>{t('parentLinks.landing.privacy')}</small>
    </InviteShell>
  )
}

function InviteShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()

  return (
    <div className={styles.page}>
      <ObriyBackground compactHorizon />
      <header className={styles.header}>
        <Link to="/" aria-label={t('parentLinks.landing.home')}>
          <BrandLogo />
        </Link>
      </header>
      <main className={styles.main}>
        <section className={styles.card}>{children}</section>
      </main>
    </div>
  )
}
