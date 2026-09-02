const DEFAULT_API_URL = 'http://localhost:3000'

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_URL?.trim() || DEFAULT_API_URL,
)

export const MAP_STYLE_LIGHT_URL =
  import.meta.env.VITE_MAP_STYLE_LIGHT_URL?.trim() ||
  'https://tiles.openfreemap.org/styles/positron'

export const MAP_STYLE_DARK_URL =
  import.meta.env.VITE_MAP_STYLE_DARK_URL?.trim() ||
  'https://tiles.openfreemap.org/styles/dark'
