import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  Compass,
  Globe2,
  Library,
  Map,
  Menu,
  Moon,
  Route,
  Settings,
  Sparkles,
  Sun,
  Trophy,
  User,
  UsersRound,
  X,
} from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { ObriyBackground } from '../../shared/backgrounds/ObriyBackground'
import { BrandLogo } from '../../shared/brand/BrandLogo'
import { useTheme } from '../../shared/theme/theme-context'
import styles from './DesignLabPage.module.css'

interface NavigationItem {
  key: string
  href: string
  icon: ComponentType<{ size?: number }>
}

const navigationItems: NavigationItem[] = [
  { key: 'overview', href: '#overview', icon: Compass },
  { key: 'journey', href: '#journey', icon: Route },
  { key: 'map', href: '#map', icon: Map },
  { key: 'codex', href: '#codex', icon: Library },
  { key: 'badges', href: '#badges', icon: Award },
  { key: 'leaderboard', href: '#leaderboard', icon: Trophy },
  { key: 'classes', href: '#classes', icon: UsersRound },
  { key: 'profile', href: '#profile', icon: User },
  { key: 'settings', href: '#settings', icon: Settings },
]

export function DesignLabPage() {
  const { i18n, t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const isDay = theme === 'day'
  const currentLanguage = i18n.resolvedLanguage === 'en' ? 'en' : 'uk'

  const toggleLanguage = async () => {
    const nextLanguage = currentLanguage === 'uk' ? 'en' : 'uk'
    localStorage.setItem('obriy-language', nextLanguage)
    await i18n.changeLanguage(nextLanguage)
  }

  return (
    <div className={styles.page}>
      <ObriyBackground />

      <button
        className={`${styles.sidebarScrim} ${isSidebarOpen ? styles.sidebarScrimVisible : ''}`}
        type="button"
        aria-label={t('navigation.closeMenu')}
        onClick={() => setIsSidebarOpen(false)}
      />

      <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <a href="#overview" onClick={() => setIsSidebarOpen(false)}>
            <BrandLogo large />
          </a>
          <button className={styles.sidebarClose} type="button" onClick={() => setIsSidebarOpen(false)} aria-label={t('navigation.closeMenu')}>
            <X size={19} />
          </button>
        </div>

        <nav className={styles.navigation} aria-label={t('navigation.label')}>
          {navigationItems.map((item, index) => {
            const Icon = item.icon
            return (
              <a
                className={index === 0 ? styles.activeNav : undefined}
                href={item.href}
                key={item.key}
                onClick={() => setIsSidebarOpen(false)}
              >
                <Icon size={17} />
                <span>{t(`navigation.${item.key}`)}</span>
              </a>
            )
          })}
        </nav>

        <div className={styles.sidebarQuote}>
          <Sparkles className={styles.quoteSparkle} size={15} />
          <p>{t('quote.text')}</p>
          <div className={styles.quoteDivider} aria-hidden="true">
            <span />
            <Sparkles size={12} />
            <span />
          </div>
          <svg className={styles.quoteLandscape} viewBox="0 0 150 58" aria-hidden="true">
            <path d="M4 51 23 36 34 43 58 19 72 38 84 30 108 48 124 36 146 53" />
            <path d="m31 43 9-12 5 6 13-18 14 19 8-7 9 12" />
            <path d="M4 52c24-4 39-3 57 1 18 3 33 2 47-1 14-4 25-3 38 2" />
            <path d="M18 49h11m67 1h18m9 3h15" />
          </svg>
        </div>
      </aside>

      <div className={styles.appShell}>
        <header className={styles.topbar}>
          <button className={`${styles.iconButton} ${styles.mobileMenu}`} type="button" onClick={() => setIsSidebarOpen(true)} aria-label={t('navigation.openMenu')}>
            <Menu size={20} />
          </button>

          <div className={styles.mobileBrand}><BrandLogo compact /></div>

          <div className={styles.profileSummary}>
            <span className={styles.avatar}>{t('profile.initials')}</span>
            <span className={styles.profileText}>
              <strong>{t('profile.demoName')}</strong>
              <small>{t('progress.level')} · {t('progress.xp')}</small>
            </span>
          </div>

          <div className={styles.headerActions}>
            <button className={styles.iconButton} type="button" onClick={toggleTheme} aria-label={isDay ? t('theme.switchToNight') : t('theme.switchToDay')} title={isDay ? t('theme.switchToNight') : t('theme.switchToDay')}>
              {isDay ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className={styles.languageButton} type="button" onClick={() => void toggleLanguage()} aria-label={t('language.label')}>
              <Globe2 size={17} /><span>{t('language.short')}</span>
            </button>
          </div>
        </header>

        <main className={styles.main}>
          <section className={styles.intro} id="overview">
            <div className={styles.introCopy}>
              <p className={styles.eyebrow}><Sparkles size={15} />{t('greeting.eyebrow')}</p>
              <h1>{t('greeting.title')}</h1>
              <p className={styles.description}>{t('greeting.description')}</p>
              <button className={styles.primaryButton} type="button">
                {t('actions.continue')}<ArrowRight size={18} />
              </button>
            </div>

            <div className={styles.progressPanel} id="journey">
              <span className={styles.panelLabel}>{t('progress.title')}</span>
              <div className={styles.progressTopline}>
                <div className={styles.progressRing}><span>7</span></div>
                <div><strong>{t('progress.xp').split('/')[0]}</strong><small>{t('progress.level')}</small></div>
              </div>
              <div className={styles.progressTrack}><span /></div>
              <p className={styles.xpLabel}>{t('progress.xp')}</p>
            </div>
          </section>

          <section className={styles.contentGrid}>
            <article className={`${styles.surface} ${styles.lessonCard}`}>
              <div className={styles.lessonIcon}><BookOpen size={23} /></div>
              <div className={styles.lessonCopy}>
                <span className={styles.panelLabel}>{t('lesson.label')}</span>
                <h2>{t('lesson.title')}</h2>
                <p>{t('lesson.meta')}</p>
              </div>
              <button className={styles.secondaryButton} type="button">{t('actions.openLesson')}<ArrowRight size={17} /></button>
            </article>

            <article className={`${styles.surface} ${styles.badgeCard}`} id="badges">
              <div className={styles.badgeIcon}><span className={styles.badgeOrbit} /><Sparkles size={25} /></div>
              <div><span className={styles.panelLabel}>{t('badge.unlocked')}</span><h2>{t('badge.name')}</h2></div>
              <span className={styles.checkmark}><Check size={15} /></span>
            </article>
          </section>
        </main>
      </div>
    </div>
  )
}
