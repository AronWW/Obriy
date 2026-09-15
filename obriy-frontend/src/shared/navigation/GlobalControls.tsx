import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Globe2, LogOut, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { logoutSession } from '../../features/auth/model/session.service'
import { useSessionStore } from '../../features/auth/model/session.store'
import { NotificationCenter } from '../../features/notifications'
import { useTheme } from '../theme/theme-context'
import styles from './GlobalControls.module.css'
import { profileApi } from '../../features/profile'

export function GlobalControls() {
  const { i18n, t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const status = useSessionStore((state) => state.status)
  const updateUser = useSessionStore((state) => state.updateUser)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isDay = theme === 'day'
  const currentLanguage = i18n.resolvedLanguage === 'en' ? 'en' : 'uk'

  const logoutMutation = useMutation({
    mutationFn: logoutSession,
    onSettled: () => {
      queryClient.clear()
      navigate('/', { replace: true })
    },
  })
  const localeMutation = useMutation({
    mutationFn: profileApi.update,
    onSuccess: updateUser,
  })

  const toggleLanguage = async () => {
    const nextLanguage = currentLanguage === 'uk' ? 'en' : 'uk'
    localStorage.setItem('obriy-language', nextLanguage)
    document.documentElement.lang = nextLanguage
    await i18n.changeLanguage(nextLanguage)
    if (status === 'authenticated') {
      localeMutation.mutate({
        preferredLocale: nextLanguage === 'en' ? 'EN' : 'UK',
      })
    }
  }

  const themeLabel = isDay ? t('theme.switchToNight') : t('theme.switchToDay')

  return (
    <div className={styles.controls} aria-label={t('global.controls')}>
      {status === 'authenticated' && <NotificationCenter />}
      <button
        className={styles.button}
        type="button"
        aria-label={themeLabel}
        title={themeLabel}
        onClick={toggleTheme}
      >
        {isDay ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <button
        id="global-language-toggle"
        className={`${styles.button} ${styles.languageButton}`}
        type="button"
        aria-label={t('language.label')}
        title={t('language.label')}
        onClick={() => void toggleLanguage()}
      >
        <Globe2 size={17} />
        <span>{t('language.short')}</span>
      </button>

      {status === 'authenticated' && (
        <button
          className={styles.button}
          type="button"
          aria-label={t('auth.session.logout')}
          title={t('auth.session.logout')}
          disabled={logoutMutation.isPending}
          onClick={() => logoutMutation.mutate()}
        >
          <LogOut size={18} />
        </button>
      )}
    </div>
  )
}
