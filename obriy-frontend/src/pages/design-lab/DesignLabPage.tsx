import {
  Award,
  Compass,
  Library,
  Map,
  Menu,
  Route,
  Settings,
  Sparkles,
  Trophy,
  User,
  UsersRound,
  X,
} from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { ObriyBackground } from '../../shared/backgrounds/ObriyBackground'
import { BrandLogo } from '../../shared/brand/BrandLogo'
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
  const { t } = useTranslation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

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
        <button className={styles.mobileMenu} type="button" onClick={() => setIsSidebarOpen(true)} aria-label={t('navigation.openMenu')}>
          <Menu size={20} />
        </button>
        <main className={styles.emptyPage} id="overview" />
      </div>
    </div>
  )
}
