import { describe, expect, it } from 'vitest'
import {
  MAP_STYLE_DARK_URL,
  MAP_STYLE_LIGHT_URL,
} from '../../../shared/config/env'
import { mapStyleForTheme } from './map-style'

describe('map styles', () => {
  it('uses separate configurable styles for day and night themes', () => {
    expect(mapStyleForTheme('day')).toBe(MAP_STYLE_LIGHT_URL)
    expect(mapStyleForTheme('night')).toBe(MAP_STYLE_DARK_URL)
    expect(MAP_STYLE_LIGHT_URL).not.toBe(MAP_STYLE_DARK_URL)
  })
})
