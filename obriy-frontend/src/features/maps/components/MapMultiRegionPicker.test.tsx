import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n/config'
import type { MapRegionOption } from '../model/map.types'
import { MapMultiRegionPicker } from './MapMultiRegionPicker'

const regions: MapRegionOption[] = [
  {
    id: 'IND',
    isoCode: 'IND',
    name: 'India',
    nameEn: 'India',
    nameUk: 'Індія',
  },
  {
    id: 'FRA',
    isoCode: 'FRA',
    name: 'France',
    nameEn: 'France',
    nameUk: 'Франція',
  },
  {
    id: 'DEU',
    isoCode: 'DEU',
    name: 'Germany',
    nameEn: 'Germany',
    nameUk: 'Німеччина',
  },
]

describe('MapMultiRegionPicker', () => {
  beforeEach(async () => i18n.changeLanguage('en'))

  it('searches both locales, toggles rows, enforces the cap, and clears', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const onClear = vi.fn()
    const { rerender } = render(
      <MapMultiRegionPicker
        maxSelections={2}
        onClear={onClear}
        onToggle={onToggle}
        regions={regions}
        selectedRegionIds={['IND', 'FRA']}
      />,
    )

    expect(screen.getByText('2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Germany/ })).toBeDisabled()
    await user.type(
      screen.getByRole('searchbox', { name: 'Region search' }),
      'Індія',
    )
    expect(screen.getByRole('checkbox', { name: /India/ })).toBeChecked()
    expect(screen.queryByRole('checkbox', { name: /France/ })).toBeNull()
    await user.click(screen.getByRole('checkbox', { name: /India/ }))
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'IND' }))
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalled()

    rerender(
      <MapMultiRegionPicker
        maxSelections={2}
        onClear={onClear}
        onToggle={onToggle}
        regions={regions}
        selectedRegionIds={['FRA']}
      />,
    )
    expect(screen.getByRole('button', { name: /Remove “France”/ })).toBeEnabled()
  })
})
