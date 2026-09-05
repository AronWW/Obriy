import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n/config'
import { ThemeProvider } from '../../../shared/theme/ThemeProvider'
import { server } from '../../../test/server'
import type { MapInspection, MapPreset } from '../model/map.types'
import { MapCanvas } from './MapCanvas'

type MapHandler = (...args: unknown[]) => void

interface MapMockInstance {
  handlers: Map<string, MapHandler>
  easeTo: ReturnType<typeof vi.fn>
  setProjection: ReturnType<typeof vi.fn>
  addSource: ReturnType<typeof vi.fn>
  addLayer: ReturnType<typeof vi.fn>
  queryRenderedFeatures: ReturnType<typeof vi.fn>
  radiusSetData: ReturnType<typeof vi.fn>
  setFeatureState: ReturnType<typeof vi.fn>
}

interface MarkerMockInstance {
  handlers: Map<string, MapHandler>
  position: { lng: number; lat: number }
}

const maplibreState = vi.hoisted(() => ({
  constructor: vi.fn(),
  instances: [] as MapMockInstance[],
  markers: [] as MarkerMockInstance[],
}))

vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({
  default: '/maplibre-worker.js',
}))

vi.mock('maplibre-gl', () => {
  class MapMock implements MapMockInstance {
    handlers = new globalThis.Map<string, MapHandler>()
    easeTo = vi.fn()
    setProjection = vi.fn()
    addSource = vi.fn()
    addLayer = vi.fn()
    queryRenderedFeatures = vi.fn(() => [])
    radiusSetData = vi.fn()
    addControl = vi.fn()
    getCanvas = vi.fn(() => ({ style: { cursor: '' } }))
    getSource = vi.fn(() => ({ setData: this.radiusSetData }))
    setFeatureState = vi.fn()
    loaded = vi.fn(() => true)
    remove = vi.fn()

    constructor(options: unknown) {
      maplibreState.constructor(options)
      maplibreState.instances.push(this)
    }

    on(
      event: string,
      layerOrHandler: string | MapHandler,
      handler?: MapHandler,
    ) {
      const listener =
        typeof layerOrHandler === 'function' ? layerOrHandler : handler
      if (listener) this.handlers.set(event, listener)
      return this
    }
  }

  class MarkerMock implements MarkerMockInstance {
    handlers = new globalThis.Map<string, MapHandler>()
    position = { lng: 0, lat: 0 }

    constructor() {
      maplibreState.markers.push(this)
    }

    setLngLat(position: [number, number]) {
      this.position = { lng: position[0], lat: position[1] }
      return this
    }

    addTo() {
      return this
    }

    on(event: string, handler: MapHandler) {
      this.handlers.set(event, handler)
      return this
    }

    getLngLat() {
      return this.position
    }

    remove() {}
  }

  return {
    AttributionControl: class AttributionControlMock {},
    FullscreenControl: class FullscreenControlMock {},
    Map: MapMock,
    Marker: MarkerMock,
    NavigationControl: class NavigationControlMock {},
    setWorkerUrl: vi.fn(),
  }
})

describe('MapCanvas', () => {
  beforeEach(async () => {
    maplibreState.constructor.mockClear()
    maplibreState.instances.length = 0
    maplibreState.markers.length = 0
    await i18n.changeLanguage('en')
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as never,
    )
  })

  it('loads the selected snapshot, supports reset, projection, and click inspection', async () => {
    const user = userEvent.setup()
    const onInspect = vi.fn<(inspection: MapInspection) => void>()
    server.use(
      http.get('*/maps/test.geojson', () =>
        HttpResponse.json(featureCollection()),
      ),
    )

    const view = renderCanvas(onInspect, 'MERCATOR')
    expect(screen.getByText('Preparing geographic data…')).toBeInTheDocument()

    await waitFor(() =>
      expect(maplibreState.constructor).toHaveBeenCalledTimes(1),
    )
    const map = maplibreState.instances[0]

    act(() => map.handlers.get('load')?.())
    const reset = await screen.findByRole('button', { name: 'Initial view' })
    expect(map.addSource).toHaveBeenCalledTimes(2)
    expect(map.addLayer).toHaveBeenCalledTimes(4)

    await user.click(reset)
    expect(map.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [31.2, 48.8], zoom: 4.6 }),
    )

    view.rerender(canvasTree(onInspect, 'GLOBE'))
    expect(maplibreState.constructor).toHaveBeenCalledTimes(1)
    expect(map.setProjection).toHaveBeenLastCalledWith({ type: 'globe' })

    map.queryRenderedFeatures.mockReturnValue([
      {
        id: 'region-1',
        properties: { featureId: 'region-1', name: 'Kyiv region' },
      },
    ])
    act(() =>
      map.handlers.get('click')?.({
        lngLat: { lng: 30.5, lat: 50.4 },
        point: { x: 20, y: 30 },
      }),
    )
    expect(onInspect).toHaveBeenCalledWith({
      longitude: 30.5,
      latitude: 50.4,
      featureId: 'region-1',
      featureName: 'Kyiv region',
    })
  })

  it('shows a snapshot network error without constructing a map', async () => {
    server.use(
      http.get('*/maps/test.geojson', () =>
        HttpResponse.json({ code: 'FAILED' }, { status: 503 }),
      ),
    )

    renderCanvas(vi.fn(), 'MERCATOR')

    expect(
      await screen.findByText(
        'Could not load the map or its background. Check your connection and try again.',
      ),
    ).toBeInTheDocument()
    expect(maplibreState.constructor).not.toHaveBeenCalled()
  })

  it('moves the point marker and radius edge through MapLibre drag events', async () => {
    const onPointChange = vi.fn()
    const onRadiusChange = vi.fn()
    server.use(
      http.get('*/maps/test.geojson', () =>
        HttpResponse.json(featureCollection()),
      ),
    )

    render(
      <ThemeProvider>
        <MapCanvas
          onPointChange={onPointChange}
          onRadiusChange={onRadiusChange}
          point={{ longitude: 30.5, latitude: 50.45 }}
          preset={preset}
          projection="MERCATOR"
          radiusKm={100}
        />
      </ThemeProvider>,
    )
    await waitFor(() =>
      expect(maplibreState.constructor).toHaveBeenCalledTimes(1),
    )
    act(() => maplibreState.instances[0].handlers.get('load')?.())
    await waitFor(() => expect(maplibreState.markers).toHaveLength(2))

    const pointMarker = maplibreState.markers[0]
    pointMarker.position = { lng: 31, lat: 51 }
    act(() => pointMarker.handlers.get('dragend')?.())
    expect(onPointChange).toHaveBeenCalledWith({
      longitude: 31,
      latitude: 51,
    })

    const radiusMarker = maplibreState.markers[1]
    radiusMarker.position = { lng: 31.5, lat: 50.45 }
    act(() => radiusMarker.handlers.get('drag')?.())
    expect(onRadiusChange).toHaveBeenCalledWith(expect.any(Number))
    expect(onRadiusChange.mock.calls[0][0]).toBeGreaterThan(70)
    expect(maplibreState.instances[0].radiusSetData).toHaveBeenCalled()
  })

  it('loads localized regions and keeps controlled answer and solution states', async () => {
    const onRegionChange = vi.fn()
    const onRegionsLoad = vi.fn()
    server.use(
      http.get('*/maps/test.geojson', () =>
        HttpResponse.json(featureCollection()),
      ),
    )

    const view = render(
      <ThemeProvider>
        <MapCanvas
          comparisonRegionIds={['region-1']}
          onRegionChange={onRegionChange}
          onRegionsLoad={onRegionsLoad}
          preset={preset}
          projection="MERCATOR"
          selectedRegionIds={['region-1']}
        />
      </ThemeProvider>,
    )
    await waitFor(() => expect(maplibreState.constructor).toHaveBeenCalled())
    const map = maplibreState.instances[0]
    act(() => map.handlers.get('load')?.())
    await waitFor(() =>
      expect(onRegionsLoad).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'region-1',
          isoCode: 'UA-30',
          name: 'Kyiv',
        }),
      ]),
    )
    await waitFor(() => {
      expect(map.setFeatureState).toHaveBeenCalledWith(
        { source: 'obriy-preset-source', id: 'region-1' },
        { selected: true },
      )
      expect(map.setFeatureState).toHaveBeenCalledWith(
        { source: 'obriy-preset-source', id: 'region-1' },
        { comparison: true },
      )
    })

    map.queryRenderedFeatures.mockReturnValue([
      {
        id: 'region-1',
        properties: {
          featureId: 'region-1',
          isoCode: 'UA-30',
          name: 'Kyiv region',
          nameEn: 'Kyiv',
          nameUk: 'Київ',
        },
      },
    ])
    act(() =>
      map.handlers.get('click')?.({
        lngLat: { lng: 30.5, lat: 50.4 },
        point: { x: 20, y: 30 },
      }),
    )
    expect(onRegionChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'region-1', name: 'Kyiv' }),
    )

    view.unmount()
  })

  it('reports unavailable WebGL before MapLibre initialization', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
    server.use(
      http.get('*/maps/test.geojson', () =>
        HttpResponse.json(featureCollection()),
      ),
    )

    renderCanvas(vi.fn(), 'MERCATOR')

    expect(
      await screen.findByText(
        'This browser or device does not support the WebGL required for the interactive map.',
      ),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(maplibreState.constructor).not.toHaveBeenCalled(),
    )
  })
})

function renderCanvas(
  onInspect: (inspection: MapInspection) => void,
  projection: 'MERCATOR' | 'GLOBE',
) {
  return render(canvasTree(onInspect, projection))
}

function canvasTree(
  onInspect: (inspection: MapInspection) => void,
  projection: 'MERCATOR' | 'GLOBE',
) {
  return (
    <ThemeProvider>
      <MapCanvas
        onInspect={onInspect}
        preset={preset}
        projection={projection}
      />
    </ThemeProvider>
  )
}

const preset: MapPreset = {
  id: 'preset-test',
  key: 'ukraine-adm1',
  name: 'Regions of Ukraine',
  contentLocale: 'UK',
  sourceType: 'BUILT_IN',
  geojsonUrl: '/maps/test.geojson',
  idProperty: 'featureId',
  year: 2017,
  attribution: 'geoBoundaries',
  bounds: { west: 21.8, south: 44.2, east: 40.3, north: 52.5 },
  defaultViewport: { longitude: 31.2, latitude: 48.8, zoom: 4.6 },
}

function featureCollection() {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          featureId: 'region-1',
          isoCode: 'UA-30',
          name: 'Kyiv region',
          nameEn: 'Kyiv',
          nameUk: 'Київ',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [30, 50],
              [31, 50],
              [31, 51],
              [30, 50],
            ],
          ],
        },
      },
    ],
  }
}
