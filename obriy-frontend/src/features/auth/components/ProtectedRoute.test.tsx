import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionStore } from '../model/session.store'
import { ProtectedRoute } from './ProtectedRoute'

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useSessionStore.setState({ accessToken: null, status: 'anonymous', user: null })
  })

  it('redirects an anonymous visitor to login', () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<div>Protected workspace</div>} />
          </Route>
          <Route path="/auth/login" element={<div>Login route</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Login route')).toBeInTheDocument()
    expect(screen.queryByText('Protected workspace')).not.toBeInTheDocument()
  })

  it('renders the protected route for an authenticated user', () => {
    useSessionStore.setState({
      accessToken: 'token',
      status: 'authenticated',
      user: null,
    })

    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<div>Protected workspace</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Protected workspace')).toBeInTheDocument()
  })
})
