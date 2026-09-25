import { ClipboardCheck, Gauge, History, Menu, School, Shield, User, Users, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { ObriyBackground } from '../../shared/backgrounds/ObriyBackground'
import { BrandLogo } from '../../shared/brand/BrandLogo'
import { adminCopy } from './admin.copy'
import styles from './Admin.module.css'

const items = [
  { to: '/app/admin', end: true, icon: Gauge },
  { to: '/app/admin/users', icon: Users },
  { to: '/app/admin/classes', icon: School },
  { to: '/app/admin/moderation', icon: ClipboardCheck },
  { to: '/app/admin/audit', icon: History },
  { to: '/app/admin/profile', icon: User },
]

export function AdminLayout() {
  const { i18n } = useTranslation()
  const copy = adminCopy[i18n.resolvedLanguage === 'en' ? 'en' : 'uk']
  const [open, setOpen] = useState(false)
  return (
    <div className={styles.shell} data-menu-open={open || undefined}>
      <ObriyBackground />
      <button className={styles.scrim} aria-label="Close" onClick={() => setOpen(false)} />
      <aside className={styles.sidebar}>
        <div className={styles.brand}><Link to="/app/admin" onClick={() => setOpen(false)}><BrandLogo large /></Link><button aria-label="Close" onClick={() => setOpen(false)}><X size={19} /></button></div>
        <div className={styles.adminMark}><Shield size={17} /><span>Obriy Admin</span></div>
        <nav aria-label="Admin">
          {items.map(({ to, end, icon: Icon }, index) => (
            <NavLink end={end} key={to} onClick={() => setOpen(false)} to={to}>
              <Icon size={17} /><span>{copy.nav[index]}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className={styles.workspace}>
        <button className={styles.menuButton} aria-label="Menu" onClick={() => setOpen(true)}><Menu size={20} /></button>
        <main><Outlet /></main>
      </div>
    </div>
  )
}
