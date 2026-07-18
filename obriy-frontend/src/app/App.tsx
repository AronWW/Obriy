import { DesignLabPage } from '../pages/design-lab/DesignLabPage'
import { ThemeProvider } from '../shared/theme/ThemeProvider'

export function App() {
  return (
    <ThemeProvider>
      <DesignLabPage />
    </ThemeProvider>
  )
}
