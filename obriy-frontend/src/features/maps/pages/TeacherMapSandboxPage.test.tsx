import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n/config'
import { API_BASE_URL } from '../../../shared/config/env'
import { ThemeProvider } from '../../../shared/theme/ThemeProvider'
import { server } from '../../../test/server'
import type { MapPreset } from '../model/map.types'
import { TeacherMapSandboxPage } from './TeacherMapSandboxPage'

vi.mock('../components/MapCanvas', () => ({
  MapCanvas: ({
    onInspect,
    preset,
    projection,
  }: {
    onInspect: (value: unknown) => void
    preset: MapPreset
    projection: string
  }) => (
    <div
      data-testid="map-canvas"
      data-preset={preset.key}
      data-projection={projection}
    >
      <button
        onClick={() =>
          onInspect({
            longitude: 30.5234,
            latitude: 50.4501,
            featureId: 'UKR-ADM1-test',
            featureName: 'Kyiv',
          })
        }
        type="button"
      >
        Simulate map click
      </button>
    </div>
  ),
}))

describe('TeacherMapSandboxPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('switches presets and projections and exposes click inspection', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API_BASE_URL}/map-presets/mine`, () =>
        HttpResponse.json([]),
      ),
      http.get(`${API_BASE_URL}/map-presets`, () =>
        HttpResponse.json(mapPresets()),
      ),
    )
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Map laboratory' }),
    ).toBeInTheDocument()
    const canvas = await screen.findByTestId('map-canvas')
    expect(canvas).toHaveAttribute('data-preset', 'world-adm0')
    expect(canvas).toHaveAttribute('data-projection', 'MERCATOR')

    await user.click(screen.getByRole('button', { name: 'Globe' }))
    expect(canvas).toHaveAttribute('data-projection', 'GLOBE')
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Geographic dataset' }),
      'preset-ukraine',
    )
    expect(screen.getByTestId('map-canvas')).toHaveAttribute(
      'data-preset',
      'ukraine-adm1',
    )

    await user.click(screen.getByRole('button', { name: 'Simulate map click' }))
    expect(screen.getByText('Kyiv')).toBeInTheDocument()
    expect(screen.getByText('UKR-ADM1-test')).toBeInTheDocument()
    expect(screen.getByText('30.52340\u00B0')).toBeInTheDocument()
  })

  it('renders an API error and retries the catalog request', async () => {
    const user = userEvent.setup()
    let attempts = 0
    server.use(
      http.get(`${API_BASE_URL}/map-presets/mine`, () =>
        HttpResponse.json([]),
      ),
      http.get(`${API_BASE_URL}/map-presets`, () => {
        attempts += 1
        return attempts === 1
          ? HttpResponse.json({ code: 'FAIL' }, { status: 500 })
          : HttpResponse.json(mapPresets())
      }),
    )
    renderPage()

    expect(
      await screen.findByText('Could not load the map catalog.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('map-canvas')).toBeInTheDocument()
    expect(attempts).toBe(2)
  })
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TeacherMapSandboxPage />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

function mapPresets(): MapPreset[] {
  return [
    preset('preset-world', 'world-adm0', 'World countries'),
    preset('preset-ukraine', 'ukraine-adm1', 'Regions of Ukraine'),
  ]
}

function preset(id: string, key: string, name: string): MapPreset {
  return {
    id,
    key,
    name,
    contentLocale: 'UK',
    sourceType: 'BUILT_IN',
    status: 'ACTIVE',
    baseMapMode: 'STANDARD',
    geojsonUrl: `/maps/${key}.geojson`,
    idProperty: 'featureId',
    year: null,
    periodLabel: null,
    attribution: 'geoBoundaries',
    bounds: { west: -180, south: -85, east: 180, north: 85 },
    defaultViewport: { longitude: 15, latitude: 20, zoom: 1.25 },
    originalFileName: null,
    fileSizeBytes: null,
    featureCount: null,
    vertexCount: null,
    geometryLocked: false,
  }
}
