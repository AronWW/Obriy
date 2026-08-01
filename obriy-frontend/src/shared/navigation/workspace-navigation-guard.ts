type NavigationRequestHandler = (target: string) => void

let activeHandler: NavigationRequestHandler | null = null
let guardedHistoryIndex: number | null = null
let isRestoringHistory = false

function getHistoryIndex(state: unknown): number | null {
  if (
    typeof state === 'object' &&
    state !== null &&
    'idx' in state &&
    typeof state.idx === 'number'
  ) {
    return state.idx
  }

  return null
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (event) => {
    if (isRestoringHistory) {
      isRestoringHistory = false
      guardedHistoryIndex = getHistoryIndex(event.state)
      event.stopImmediatePropagation()
      return
    }

    if (!activeHandler) {
      return
    }

    const target = `${window.location.pathname}${window.location.search}${window.location.hash}`
    const targetIndex = getHistoryIndex(event.state)
    const currentIndex = guardedHistoryIndex

    // popstate fires after the browser has already moved through history.
    // Restore the guarded editor entry before React Router sees the event,
    // then let the editor's own confirmation dialog decide whether to leave.
    event.stopImmediatePropagation()
    isRestoringHistory = true
    if (currentIndex !== null && targetIndex !== null) {
      window.history.go(currentIndex - targetIndex)
    } else {
      window.history.forward()
    }
    activeHandler(target)
  })
}

export function registerWorkspaceNavigationGuard(
  handler: NavigationRequestHandler,
): () => void {
  activeHandler = handler
  guardedHistoryIndex =
    typeof window === 'undefined' ? null : getHistoryIndex(window.history.state)

  return () => {
    if (activeHandler === handler) {
      activeHandler = null
      guardedHistoryIndex = null
    }
  }
}

export function requestWorkspaceNavigation(target: string): boolean {
  if (!activeHandler) {
    return false
  }

  activeHandler(target)
  return true
}
