import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './theme-context'

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme()

  return (
    <>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme} type="button">Toggle theme</button>
    </>
  )
}

describe('ThemeProvider night default', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('starts in night mode for a new visitor', () => {
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>)

    expect(screen.getByTestId('theme')).toHaveTextContent('night')
    expect(document.documentElement).toHaveAttribute('data-theme', 'night')
    expect(localStorage.getItem('obriy-theme')).toBe('night')
  })

  it('migrates a previously saved day choice only once', async () => {
    localStorage.setItem('obriy-theme', 'day')
    const user = userEvent.setup()
    const view = render(<ThemeProvider><ThemeProbe /></ThemeProvider>)

    expect(screen.getByTestId('theme')).toHaveTextContent('night')
    expect(localStorage.getItem('obriy-night-default-v1')).toBe('done')

    await user.click(screen.getByRole('button', { name: 'Toggle theme' }))
    expect(screen.getByTestId('theme')).toHaveTextContent('day')
    view.unmount()

    render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
    expect(screen.getByTestId('theme')).toHaveTextContent('day')
    expect(document.documentElement).toHaveAttribute('data-theme', 'day')
  })
})
