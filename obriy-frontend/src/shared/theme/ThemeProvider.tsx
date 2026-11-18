import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { ThemeContext, type Theme } from './theme-context'
const STORAGE_KEY = 'obriy-theme'
const NIGHT_DEFAULT_MIGRATION_KEY = 'obriy-night-default-v1'

function getInitialTheme(): Theme {
  if (localStorage.getItem(NIGHT_DEFAULT_MIGRATION_KEY) !== 'done') {
    localStorage.setItem(STORAGE_KEY, 'night')
    localStorage.setItem(NIGHT_DEFAULT_MIGRATION_KEY, 'done')
    return 'night'
  }

  return localStorage.getItem(STORAGE_KEY) === 'day' ? 'day' : 'night'
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme === 'night' ? 'dark' : 'light'
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'day' ? 'night' : 'day'))
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [setTheme, theme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
