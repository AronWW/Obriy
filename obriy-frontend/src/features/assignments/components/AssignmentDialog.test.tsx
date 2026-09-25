import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AssignmentDialog } from './AssignmentDialog'

describe('AssignmentDialog', () => {
  it('renders a portaled dialog above the workspace and closes it', async () => {
    const onClose = vi.fn()
    const { container, unmount } = render(
      <div>
        <aside>Workspace sidebar</aside>
        <AssignmentDialog
          closeLabel="Close"
          onClose={onClose}
          portal
          title="Test"
        >
          <p>Test instructions</p>
        </AssignmentDialog>
      </div>,
    )

    const dialog = screen.getByRole('dialog', { name: 'Test' })
    expect(container).not.toContainElement(dialog)
    expect(dialog.parentElement?.parentElement).toBe(document.body)
    expect(document.body.style.overflow).toBe('hidden')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()

    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
