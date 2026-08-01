import { waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerWorkspaceNavigationGuard } from './workspace-navigation-guard'

let unregisterGuard: (() => void) | undefined

afterEach(() => {
  unregisterGuard?.()
  unregisterGuard = undefined
  window.history.replaceState({ idx: 0 }, '', '/')
})

describe('workspace navigation guard', () => {
  it('restores the guarded entry before handling browser Back', async () => {
    window.history.replaceState({ idx: 0 }, '', '/app/teacher/lessons')
    window.history.pushState(
      { idx: 1 },
      '',
      '/app/teacher/lessons/lesson-1/edit',
    )
    const handler = vi.fn()
    unregisterGuard = registerWorkspaceNavigationGuard(handler)

    window.history.back()

    await waitFor(() =>
      expect(handler).toHaveBeenCalledWith('/app/teacher/lessons'),
    )
    await waitFor(() =>
      expect(window.location.pathname).toBe(
        '/app/teacher/lessons/lesson-1/edit',
      ),
    )
  })
})
