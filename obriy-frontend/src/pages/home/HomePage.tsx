import { ArrowDown, ArrowRight, LogIn, UserPlus } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useSessionStore } from '../../features/auth/model/session.store'
import { ObriyBackground } from '../../shared/backgrounds/ObriyBackground'
import { BrandLogo } from '../../shared/brand/BrandLogo'
import { JourneyAtlas } from './JourneyAtlas'
import { RoleAstrolabe } from './RoleAstrolabe'
import styles from './HomePage.module.css'

export function HomePage() {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const status = useSessionStore((state) => state.status)
  const isAuthenticated = status === 'authenticated'
  const heroActionsRef = useRef<HTMLDivElement>(null)
  const [showHeaderActions, setShowHeaderActions] = useState(false)
  const primaryDestination = isAuthenticated ? '/app' : '/auth/register'
  const primaryLabel = isAuthenticated ? t('home.continue') : t('home.hero.start')

  const reveal = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        animate: { opacity: 1, y: 0 },
      }

  useEffect(() => {
    const heroActions = heroActionsRef.current

    if (!heroActions) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowHeaderActions(!entry.isIntersecting)
      },
      {
        rootMargin: '0px',
        threshold: 0,
      },
    )

    observer.observe(heroActions)

    return () => observer.disconnect()
  }, [])

  return (
    <div className={styles.page}>
      <ObriyBackground compactHorizon />

      <header
        className={`${styles.header} ${showHeaderActions ? styles.headerScrolled : ''}`}
        data-surface={showHeaderActions ? 'visible' : 'hidden'}
      >
        <div className={styles.headerInner}>
          <Link className={styles.brandLink} to="/" aria-label={t('home.openHome')}>
            <BrandLogo large />
          </Link>

          <AnimatePresence initial={false}>
            {showHeaderActions && (
              <motion.div
                className={styles.headerActions}
                id="home-header-actions"
                initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.48,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {isAuthenticated ? (
                  <Link className={`${styles.headerAction} ${styles.headerRegister}`} to="/app">
                    <span>{t('home.continue')}</span>
                    <ArrowRight size={16} />
                  </Link>
                ) : (
                  <>
                    <Link
                      className={`${styles.headerAction} ${styles.headerRegister}`}
                      to="/auth/register"
                    >
                      <UserPlus size={16} />
                      <span>{t('home.register')}</span>
                    </Link>
                    <Link
                      className={`${styles.headerAction} ${styles.headerLogin}`}
                      to="/auth/login"
                    >
                      <LogIn size={16} />
                      <span>{t('home.signIn')}</span>
                    </Link>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main>
        <section
          className={styles.hero}
          aria-labelledby="home-title"
          aria-describedby="home-description"
        >
          <div className={styles.heroReadability} aria-hidden="true" />

          <motion.div
            className={styles.heroContent}
            {...reveal}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <h1 id="home-title" className={styles.title}>
              <span>{t('home.hero.titleLine1')}</span>
              <span className={styles.titleAccent}>{t('home.hero.titleLine2')}</span>
            </h1>
            <span className={styles.titleDivider} aria-hidden="true" />
            <p className={styles.description} id="home-description">
              {t('home.hero.description')}
            </p>

            <div
              className={styles.actions}
              id="home-actions"
              ref={heroActionsRef}
              role="group"
              aria-label={t('home.hero.actionsLabel')}
            >
              <Link className={styles.primaryAction} to={primaryDestination}>
                {primaryLabel}
                <ArrowRight size={18} />
              </Link>
              {!isAuthenticated && (
                <Link className={styles.secondaryAction} to="/auth/login">
                  {t('home.signIn')}
                </Link>
              )}
            </div>
          </motion.div>

          <a className={styles.scrollCue} href="#journey" aria-label={t('home.hero.explore')}>
            <ArrowDown size={18} />
          </a>
        </section>

        <JourneyAtlas />
        <RoleAstrolabe />
      </main>

      <footer id="page-footer" className={styles.footer}>
        <div className={styles.footerInner}>
          <p>{t('home.footer.tagline')}</p>
          <span>{t('home.footer.copyright', { year: new Date().getFullYear() })}</span>
        </div>
      </footer>
    </div>
  )
}
