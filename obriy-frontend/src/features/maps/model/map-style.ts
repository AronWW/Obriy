import {
  MAP_STYLE_DARK_URL,
  MAP_STYLE_LIGHT_URL,
} from '../../../shared/config/env'
import type { Theme } from '../../../shared/theme/theme-context'
import type { MapPreset } from './map.types'
import type { StyleSpecification } from 'maplibre-gl'

export function mapStyleForTheme(
  theme: Theme,
  mode: MapPreset['baseMapMode'] = 'STANDARD',
): string | StyleSpecification {
  if (mode === 'NEUTRAL') {
    return {
      version: 8,
      sources: {},
      layers: [
        {
          id: 'neutral-background',
          type: 'background',
          paint: {
            'background-color': theme === 'night' ? '#111a22' : '#e9e3d6',
          },
        },
      ],
    }
  }
  return theme === 'night' ? MAP_STYLE_DARK_URL : MAP_STYLE_LIGHT_URL
}
