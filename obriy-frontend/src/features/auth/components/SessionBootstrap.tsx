import { useEffect, type PropsWithChildren } from 'react'
import { restoreSession } from '../model/session.service'
import { useSessionStore } from '../model/session.store'
import i18n from '../../../i18n/config'

export function SessionBootstrap({ children }: PropsWithChildren) {
  const status = useSessionStore((state) => state.status)
  const preferredLocale = useSessionStore(
    (state) => state.user?.profile.preferredLocale,
  )

  useEffect(() => {
    if (status === 'checking') {
      void restoreSession()
    }
  }, [status])

  useEffect(() => {
    if (status !== 'authenticated' || !preferredLocale) return
    const language = preferredLocale === 'EN' ? 'en' : 'uk'
    localStorage.setItem('obriy-language', language)
    document.documentElement.lang = language
    if (i18n.resolvedLanguage !== language) void i18n.changeLanguage(language)
  }, [preferredLocale, status])

  return children
}
