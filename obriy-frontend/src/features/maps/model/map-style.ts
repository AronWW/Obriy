import {
  MAP_STYLE_DARK_URL,
  MAP_STYLE_LIGHT_URL,
} from '../../../shared/config/env'
import type { Theme } from '../../../shared/theme/theme-context'

export function mapStyleForTheme(theme: Theme): string {
  return theme === 'night' ? MAP_STYLE_DARK_URL : MAP_STYLE_LIGHT_URL
}
