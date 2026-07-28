import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { SessionBootstrap } from '../features/auth/components/SessionBootstrap'
import { GlobalControls } from '../shared/navigation/GlobalControls'
import { ThemeProvider } from '../shared/theme/ThemeProvider'
import { AppRouter } from './router/AppRouter'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
    mutations: { retry: false },
  },
})

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SessionBootstrap>
            <GlobalControls />
            <AppRouter />
          </SessionBootstrap>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
