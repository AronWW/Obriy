import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n/config'
import { LessonReportDialog } from './LessonReportDialog'

describe('LessonReportDialog', () => {
  beforeEach(async () => i18n.changeLanguage('en'))

  it('keeps submission disabled until the report is meaningful and sends the selected category', async () => {
    const user = userEvent.setup()
    const submit = vi.fn().mockResolvedValue({})
    render(<QueryClientProvider client={new QueryClient()}><LessonReportDialog submit={submit} /></QueryClientProvider>)
    await user.click(screen.getByRole('button', { name: 'Report' }))
    const send = screen.getByRole('button', { name: 'Submit report' })
    expect(send).toBeDisabled()
    await user.selectOptions(screen.getByRole('combobox'), 'PERSONAL_DATA')
    await user.type(screen.getByRole('textbox'), 'This lesson exposes private contact details.')
    await user.click(send)
    expect(submit.mock.calls[0]?.[0]).toEqual({ category: 'PERSONAL_DATA', details: 'This lesson exposes private contact details.' })
    expect(await screen.findByText('The report was sent for review.')).toBeInTheDocument()
  })
})
