import {
  Award,
  Beaker,
  ChartBar,
  ClipboardList,
  Compass,
  Library,
  Map,
  Menu,
  MessageCircle,
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
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useSessionStore } from '../../features/auth/model/session.store'
import { GamificationRewardNotifier } from '../../features/gamification'
import { ChatUnreadBadge } from '../../features/chat'
import { ObriyBackground } from '../../shared/backgrounds/ObriyBackground'
import { BrandLogo } from '../../shared/brand/BrandLogo'
import { requestWorkspaceNavigation } from '../../shared/navigation/workspace-navigation-guard'
import styles from './DesignLabPage.module.css'

interface NavigationItemBase {
  key: string
  icon: ComponentType<{ size?: number }>
}

type NavigationItem =
  | (NavigationItemBase & { href: string; to?: never })
  | (NavigationItemBase & { end?: boolean; href?: never; to: string })

const designNavigationItems: NavigationItem[] = [
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

const studentNavigationItems: NavigationItem[] = [
  {
    key: 'studentOverview',
    to: '/app/student',
    end: true,
    icon: Compass,
  },
  {
    key: 'studentClasses',
    to: '/app/student/classes',
    icon: UsersRound,
  },
  {
    key: 'studentTasks',
    to: '/app/student/tasks',
    icon: Library,
  },
  {
    key: 'studentMessages',
    to: '/app/student/messages',
    icon: MessageCircle,
  },
  {
    key: 'studentAchievements',
    to: '/app/student/achievements',
    icon: Award,
  },
  {
    key: 'studentLeaderboard',
    to: '/app/student/leaderboard',
    icon: Trophy,
  },
  {
    key: 'studentProfile',
    to: '/app/student/profile',
    icon: User,
  },
]

const teacherNavigationItems: NavigationItem[] = [
  {
    key: 'teacherOverview',
    to: '/app/teacher',
    end: true,
    icon: Compass,
  },
  {
    key: 'teacherClasses',
    to: '/app/teacher/classes',
    icon: UsersRound,
  },
  {
    key: 'teacherLessons',
    to: '/app/teacher/lessons',
    icon: Library,
  },
  {
    key: 'teacherTasks',
    to: '/app/teacher/tasks',
    icon: ClipboardList,
  },
  {
    key: 'teacherTests',
    to: '/app/teacher/tests',
    icon: Beaker,
  },
  {
    key: 'teacherAnalytics',
    to: '/app/teacher/analytics',
    icon: ChartBar,
  },
  {
    key: 'teacherMessages',
    to: '/app/teacher/messages',
    icon: MessageCircle,
  },
  {
    key: 'teacherProfile',
    to: '/app/teacher/profile',
    icon: User,
  },
]

export function DesignLabPage() {
  const { t } = useTranslation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const role = useSessionStore((state) => state.user?.role)
  const navigationItems =
    role === 'STUDENT'
      ? studentNavigationItems
      : role === 'TEACHER'
        ? teacherNavigationItems
        : designNavigationItems
  const roleHomePath =
    role === 'TEACHER' ? '/app/teacher' : '/app/student'

  return (
    <div
      className={`${styles.page} ${isSidebarOpen ? styles.pageMenuOpen : ''}`}
    >
      <ObriyBackground />

      <button
        className={`${styles.sidebarScrim} ${isSidebarOpen ? styles.sidebarScrimVisible : ''}`}
        type="button"
        aria-label={t('navigation.closeMenu')}
        onClick={() => setIsSidebarOpen(false)}
      />

      <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <Link
            to={roleHomePath}
            onClick={(event) => {
              if (requestWorkspaceNavigation(roleHomePath)) {
                event.preventDefault()
              }
              setIsSidebarOpen(false)
            }}
          >
            <BrandLogo large />
          </Link>
          <button className={styles.sidebarClose} type="button" onClick={() => setIsSidebarOpen(false)} aria-label={t('navigation.closeMenu')}>
            <X size={19} />
          </button>
        </div>

        <nav className={styles.navigation} aria-label={t('navigation.label')}>
          {navigationItems.map((item, index) => {
            const Icon = item.icon

            if (item.to) {
              return (
                <NavLink
                  className={({ isActive }) =>
                    isActive ? styles.activeNav : undefined
                  }
                  end={item.end}
                  key={item.key}
                  to={item.to}
                  onClick={(event) => {
                    if (requestWorkspaceNavigation(item.to)) {
                      event.preventDefault()
                      setIsSidebarOpen(false)
                      return
                    }
                    setIsSidebarOpen(false)
                  }}
                >
                  <Icon size={17} />
                  <span>{t(`navigation.${item.key}`)}</span>
                  {(item.key === 'studentMessages' || item.key === 'teacherMessages') && <ChatUnreadBadge />}
                </NavLink>
              )
            }

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
        <main className={styles.emptyPage} id="overview">
          <Outlet />
        </main>
        {role === 'STUDENT' && <GamificationRewardNotifier />}
      </div>
    </div>
  )
}
