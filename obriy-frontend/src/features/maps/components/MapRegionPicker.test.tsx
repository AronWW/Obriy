import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n/config'
import type { MapRegionOption } from '../model/map.types'
import { MapRegionPicker } from './MapRegionPicker'

const regions: MapRegionOption[] = [
  {
    id: 'IND',
    isoCode: 'IND',
    name: 'India',
    nameEn: 'India',
    nameUk: 'Індія',
  },
  {
    id: 'PRI',
    isoCode: 'PRI',
    name: 'Puerto Rico',
    nameEn: 'Puerto Rico',
    nameUk: 'Пуерто-Рико',
  },
]

describe('MapRegionPicker', () => {
  beforeEach(async () => i18n.changeLanguage('en'))

  it('searches both locales and selects the matching stable ID', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <MapRegionPicker
        onChange={onChange}
        regions={regions}
        selectedRegionId={null}
      />,
    )

    await user.type(
      screen.getByRole('searchbox', { name: 'Region search' }),
      'Індія',
    )
    const list = screen.getByRole('combobox', { name: 'Region list' })
    expect(list).toHaveTextContent('India · IND')
    expect(list).not.toHaveTextContent('Puerto Rico')
    await user.selectOptions(list, 'IND')
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'IND' }),
    )
  })
})
