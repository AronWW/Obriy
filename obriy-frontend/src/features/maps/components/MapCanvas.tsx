import {
  AttributionControl,
  FullscreenControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type MapMouseEvent,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../../shared/theme/theme-context'
import { mapRegionOptions, parseMapFeatureCollection } from '../model/geojson'
import {
  clampMapRadius,
  destinationPoint,
  geodesicCircle,
  haversineDistanceKm,
} from '../model/map-geometry'
import { mapStyleForTheme } from '../model/map-style'
import type {
  MapInspection,
  MapPoint,
  MapPreset,
  MapProjection,
  MapRegionOption,
} from '../model/map.types'
import styles from '../Maps.module.css'

setWorkerUrl(workerUrl)

const SOURCE_ID = 'obriy-preset-source'
const FILL_LAYER_ID = 'obriy-preset-fill'
const LINE_LAYER_ID = 'obriy-preset-line'
const RADIUS_SOURCE_ID = 'obriy-map-radius-source'
const RADIUS_FILL_LAYER_ID = 'obriy-map-radius-fill'
const RADIUS_LINE_LAYER_ID = 'obriy-map-radius-line'

export interface MapCanvasProps {
  comparisonPoint?: MapPoint | null
  comparisonRegionIds?: readonly string[]
  mapLabel?: string
  onInspect?: (inspection: MapInspection) => void
  onPointChange?: (point: MapPoint) => void
  onRadiusChange?: (radiusKm: number) => void
  onRegionChange?: (region: MapRegionOption) => void
  onRegionsLoad?: (regions: MapRegionOption[]) => void
  point?: MapPoint | null
  pointKind?: 'TARGET' | 'ANSWER'
  preset: MapPreset
  projection: MapProjection
  radiusKm?: number | null
  selectedRegionIds?: readonly string[]
  variant?: 'SANDBOX' | 'ASSIGNMENT'
}

export function MapCanvas({
  comparisonPoint = null,
  comparisonRegionIds = [],
  mapLabel,
  onInspect,
  onPointChange,
  onRadiusChange,
  onRegionChange,
  onRegionsLoad,
  point = null,
  pointKind = 'TARGET',
  preset,
  projection,
  radiusKm = null,
  selectedRegionIds = [],
  variant = 'SANDBOX',
}: MapCanvasProps) {
  const { i18n, t } = useTranslation()
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const pointMarkerRef = useRef<Marker | null>(null)
  const comparisonMarkerRef = useRef<Marker | null>(null)
  const radiusMarkerRef = useRef<Marker | null>(null)
  const inspectRef = useRef(onInspect)
  const pointChangeRef = useRef(onPointChange)
  const radiusChangeRef = useRef(onRadiusChange)
  const regionChangeRef = useRef(onRegionChange)
  const regionsLoadRef = useRef(onRegionsLoad)
  const pointRef = useRef(point)
  const projectionRef = useRef(projection)
  const hoveredIdRef = useRef<string | number | null>(null)
  const selectedIdRef = useRef<string | number | null>(null)
  const selectedRegionIdsRef = useRef(new Set<string>())
  const comparisonRegionIdsRef = useRef(new Set<string>())
  const snapshotKey = `${preset.geojsonUrl}:${preset.idProperty}`
  const [snapshot, setSnapshot] = useState<MapSnapshotState>(() => ({
    key: snapshotKey,
    status: 'LOADING',
    data: null,
  }))
  const [runtimeErrorKey, setRuntimeErrorKey] = useState<string | null>(null)
  const [readyMapKey, setReadyMapKey] = useState<string | null>(null)
  const [webglAvailable] = useState(supportsWebGl)
  const isCurrentSnapshot = snapshot.key === snapshotKey
  const geojson = isCurrentSnapshot ? snapshot.data : null
  const dataState = isCurrentSnapshot ? snapshot.status : 'LOADING'
  const mapInstanceKey = `${snapshotKey}:${theme}`
  const runtimeError = runtimeErrorKey === mapInstanceKey
  const mapReady = readyMapKey === mapInstanceKey
  const regions = useMemo(
    () =>
      geojson
        ? mapRegionOptions(
            geojson,
            i18n.resolvedLanguage ?? i18n.language,
            preset.idProperty,
          )
        : [],
    [geojson, i18n.language, i18n.resolvedLanguage, preset.idProperty],
  )
  const regionsRef = useRef(regions)

  useEffect(() => {
    inspectRef.current = onInspect
    pointChangeRef.current = onPointChange
    radiusChangeRef.current = onRadiusChange
    regionChangeRef.current = onRegionChange
    regionsLoadRef.current = onRegionsLoad
    pointRef.current = point
  }, [
    onInspect,
    onPointChange,
    onRadiusChange,
    onRegionChange,
    onRegionsLoad,
    point,
  ])

  useEffect(() => {
    regionsRef.current = regions
    if (regions.length > 0) regionsLoadRef.current?.(regions)
  }, [regions])

  useEffect(() => {
    projectionRef.current = projection
    mapRef.current?.setProjection({
      type: projection === 'GLOBE' ? 'globe' : 'mercator',
    })
  }, [projection])

  useEffect(() => {
    const abortController = new AbortController()

    void fetch(new URL(preset.geojsonUrl, window.location.origin), {
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('MAP_GEOJSON_LOAD_FAILED')
        return response.json() as Promise<unknown>
      })
      .then((value) => {
        if (abortController.signal.aborted) return
        setSnapshot({
          key: snapshotKey,
          status: 'READY',
          data: parseMapFeatureCollection(value, preset.idProperty),
        })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setSnapshot({ key: snapshotKey, status: 'ERROR', data: null })
      })

    return () => abortController.abort()
  }, [preset.geojsonUrl, preset.idProperty, snapshotKey])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !geojson || dataState !== 'READY' || !webglAvailable) {
      return
    }
    selectedIdRef.current = null
    selectedRegionIdsRef.current = new Set()
    comparisonRegionIdsRef.current = new Set()
    hoveredIdRef.current = null

    const map = new MapLibreMap({
      container,
      style: mapStyleForTheme(theme),
      center: [
        preset.defaultViewport.longitude,
        preset.defaultViewport.latitude,
      ],
      zoom: preset.defaultViewport.zoom,
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
      locale: {
        'NavigationControl.ZoomIn': t('maps.controls.zoomIn'),
        'NavigationControl.ZoomOut': t('maps.controls.zoomOut'),
        'NavigationControl.ResetBearing': t('maps.controls.resetBearing'),
        'FullscreenControl.Enter': t('maps.controls.fullscreen'),
        'FullscreenControl.Exit': t('maps.controls.exitFullscreen'),
      },
    })
    mapRef.current = map
    let didLoad = false

    map.addControl(new NavigationControl({ showCompass: true }), 'top-right')
    map.addControl(new FullscreenControl(), 'top-right')
    map.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: preset.attribution,
      }),
      'bottom-right',
    )

    map.on('load', () => {
      didLoad = true
      setReadyMapKey(mapInstanceKey)
      map.setProjection({
        type: projectionRef.current === 'GLOBE' ? 'globe' : 'mercator',
      })
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: geojson,
        promoteId: preset.idProperty,
      })
      map.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': [
            'case',
            [
              'all',
              ['boolean', ['feature-state', 'selected'], false],
              ['boolean', ['feature-state', 'comparison'], false],
            ],
            '#3c9b72',
            ['boolean', ['feature-state', 'comparison'], false],
            '#d99235',
            ['boolean', ['feature-state', 'selected'], false],
            '#2775a7',
            ['boolean', ['feature-state', 'hover'], false],
            '#e8b45f',
            theme === 'night' ? '#5b7590' : '#7897aa',
          ],
          'fill-opacity': [
            'case',
            [
              'any',
              ['boolean', ['feature-state', 'selected'], false],
              ['boolean', ['feature-state', 'comparison'], false],
            ],
            0.72,
            ['boolean', ['feature-state', 'hover'], false],
            0.58,
            0.28,
          ],
        },
      })
      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': theme === 'night' ? '#d8c59d' : '#725a3c',
          'line-width': 1.1,
          'line-opacity': 0.78,
        },
      })
      map.addSource(RADIUS_SOURCE_ID, {
        type: 'geojson',
        data: emptyFeatureCollection(),
      })
      map.addLayer({
        id: RADIUS_FILL_LAYER_ID,
        type: 'fill',
        source: RADIUS_SOURCE_ID,
        paint: { 'fill-color': '#d99235', 'fill-opacity': 0.2 },
      })
      map.addLayer({
        id: RADIUS_LINE_LAYER_ID,
        type: 'line',
        source: RADIUS_SOURCE_ID,
        paint: {
          'line-color': '#d99235',
          'line-width': 2.2,
          'line-opacity': 0.95,
        },
      })
    })

    map.on('mousemove', FILL_LAYER_ID, (event) => {
      map.getCanvas().style.cursor = pointChangeRef.current
        ? 'crosshair'
        : 'pointer'
      const feature = event.features?.[0]
      const nextId = feature?.id ?? null
      updateFeatureState(map, hoveredIdRef.current, 'hover', false)
      updateFeatureState(map, nextId, 'hover', true)
      hoveredIdRef.current = nextId
    })
    map.on('mouseleave', FILL_LAYER_ID, () => {
      map.getCanvas().style.cursor = pointChangeRef.current ? 'crosshair' : ''
      updateFeatureState(map, hoveredIdRef.current, 'hover', false)
      hoveredIdRef.current = null
    })
    map.on('click', (event) => {
      const feature = firstMapFeature(
        map.queryRenderedFeatures(event.point, { layers: [FILL_LAYER_ID] }),
      )
      const nextId = feature?.id ?? null
      const inspection = toInspection(event, feature, preset.idProperty)
      inspectRef.current?.(inspection)
      if (regionChangeRef.current && inspection.featureId) {
        const region = regionsRef.current.find(
          (candidate) => candidate.id === inspection.featureId,
        )
        if (region) regionChangeRef.current(region)
      } else if (!pointChangeRef.current) {
        updateFeatureState(map, selectedIdRef.current, 'selected', false)
        updateFeatureState(map, nextId, 'selected', true)
        selectedIdRef.current = nextId
      }
      pointChangeRef.current?.({
        longitude: inspection.longitude,
        latitude: inspection.latitude,
      })
    })
    map.on('error', () => {
      if (!didLoad) setRuntimeErrorKey(mapInstanceKey)
    })

    return () => {
      pointMarkerRef.current?.remove()
      comparisonMarkerRef.current?.remove()
      radiusMarkerRef.current?.remove()
      pointMarkerRef.current = null
      comparisonMarkerRef.current = null
      radiusMarkerRef.current = null
      mapRef.current = null
      map.remove()
    }
  }, [dataState, geojson, mapInstanceKey, preset, t, theme, webglAvailable])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    selectedRegionIdsRef.current = syncRegionStates(
      map,
      selectedRegionIdsRef.current,
      selectedRegionIds,
      'selected',
    )
    comparisonRegionIdsRef.current = syncRegionStates(
      map,
      comparisonRegionIdsRef.current,
      comparisonRegionIds,
      'comparison',
    )
  }, [comparisonRegionIds, mapReady, selectedRegionIds])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    pointMarkerRef.current = syncMarker({
      current: pointMarkerRef.current,
      map,
      point,
      kind: pointKind === 'ANSWER' ? 'answer' : 'target',
      draggable: Boolean(onPointChange),
      label: t(
        pointKind === 'ANSWER'
          ? 'maps.point.answerMarker'
          : 'maps.point.targetMarker',
      ),
      onDrag: (nextPoint) => pointChangeRef.current?.(nextPoint),
    })
    comparisonMarkerRef.current = syncMarker({
      current: comparisonMarkerRef.current,
      map,
      point: comparisonPoint,
      kind: 'answer',
      draggable: false,
      label: t('maps.point.answerMarker'),
    })

    const radiusSource = map.getSource(RADIUS_SOURCE_ID) as
      GeoJSONSource | undefined
    radiusSource?.setData(
      point && radiusKm !== null
        ? geodesicCircle(point, radiusKm)
        : emptyFeatureCollection(),
    )
    radiusMarkerRef.current = syncRadiusMarker({
      current: radiusMarkerRef.current,
      map,
      point,
      radiusKm,
      editable: Boolean(onRadiusChange),
      label: t('maps.point.radiusHandle'),
      onDrag: (position) => {
        const center = pointRef.current
        if (!center) return
        radiusChangeRef.current?.(
          clampMapRadius(haversineDistanceKm(center, position)),
        )
      },
    })
  }, [
    comparisonPoint,
    mapReady,
    onPointChange,
    onRadiusChange,
    point,
    pointKind,
    radiusKm,
    t,
  ])

  const resetViewport = () => {
    mapRef.current?.easeTo({
      center: [
        preset.defaultViewport.longitude,
        preset.defaultViewport.latitude,
      ],
      zoom: preset.defaultViewport.zoom,
      bearing: 0,
      pitch: 0,
      duration: 500,
    })
  }

  return (
    <div
      className={`${styles.mapFrame} ${
        variant === 'ASSIGNMENT' ? styles.mapFrameAssignment : ''
      }`}
    >
      <div
        aria-label={mapLabel ?? t('maps.sandbox.mapLabel')}
        className={styles.mapCanvas}
        ref={containerRef}
        role="region"
      />
      {(dataState === 'LOADING' ||
        (dataState === 'READY' &&
          webglAvailable &&
          !runtimeError &&
          !mapReady)) && (
        <MapOverlay loading message={t('maps.sandbox.loadingMap')} />
      )}
      {(dataState === 'ERROR' || runtimeError) && (
        <MapOverlay message={t('maps.sandbox.mapLoadError')} />
      )}
      {!webglAvailable && (
        <MapOverlay message={t('maps.sandbox.webglUnsupported')} />
      )}
      {dataState === 'READY' && webglAvailable && !runtimeError && mapReady && (
        <button
          className={styles.resetMapButton}
          onClick={resetViewport}
          type="button"
        >
          <RotateCcw size={15} aria-hidden="true" />
          {t('maps.controls.reset')}
        </button>
      )}
    </div>
  )
}

interface MapSnapshotState {
  key: string
  status: 'LOADING' | 'READY' | 'ERROR'
  data: ReturnType<typeof parseMapFeatureCollection> | null
}

function syncMarker({
  current,
  draggable,
  kind,
  label,
  map,
  onDrag,
  point,
}: {
  current: Marker | null
  draggable: boolean
  kind: 'target' | 'answer'
  label: string
  map: MapLibreMap
  onDrag?: (point: MapPoint) => void
  point: MapPoint | null
}): Marker | null {
  if (!point) {
    current?.remove()
    return null
  }
  if (!current) {
    const element = document.createElement('button')
    element.type = 'button'
    element.className = `${styles.mapPointMarker} ${
      kind === 'answer' ? styles.mapPointMarkerAnswer : ''
    }`
    element.setAttribute('aria-label', label)
    current = new Marker({ element, draggable, anchor: 'center' })
      .setLngLat([point.longitude, point.latitude])
      .addTo(map)
    if (draggable && onDrag) {
      current.on('dragend', () => {
        if (!current) return
        const position = current.getLngLat()
        onDrag({ longitude: position.lng, latitude: position.lat })
      })
    }
  } else {
    current.setLngLat([point.longitude, point.latitude])
  }
  return current
}

function syncRadiusMarker({
  current,
  editable,
  label,
  map,
  onDrag,
  point,
  radiusKm,
}: {
  current: Marker | null
  editable: boolean
  label: string
  map: MapLibreMap
  onDrag: (point: MapPoint) => void
  point: MapPoint | null
  radiusKm: number | null
}): Marker | null {
  if (!point || radiusKm === null || !editable) {
    current?.remove()
    return null
  }
  const handlePoint = destinationPoint(point, radiusKm, 90)
  if (!current) {
    const element = document.createElement('button')
    element.type = 'button'
    element.className = styles.mapRadiusHandle
    element.setAttribute('aria-label', label)
    current = new Marker({ element, draggable: true, anchor: 'center' })
      .setLngLat([handlePoint.longitude, handlePoint.latitude])
      .addTo(map)
    current.on('drag', () => {
      if (!current) return
      const position = current.getLngLat()
      onDrag({ longitude: position.lng, latitude: position.lat })
    })
  } else {
    current.setLngLat([handlePoint.longitude, handlePoint.latitude])
  }
  return current
}

function emptyFeatureCollection() {
  return { type: 'FeatureCollection' as const, features: [] }
}

function MapOverlay({
  loading = false,
  message,
}: {
  loading?: boolean
  message: string
}) {
  return (
    <div className={styles.mapOverlay} role="status">
      {loading && <span className={styles.mapSpinner} aria-hidden="true" />}
      <p>{message}</p>
    </div>
  )
}

function supportsWebGl(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function updateFeatureState(
  map: MapLibreMap,
  id: string | number | null,
  key: 'comparison' | 'hover' | 'selected',
  value: boolean,
) {
  if (id === null || !map.getSource(SOURCE_ID)) return
  map.setFeatureState({ source: SOURCE_ID, id }, { [key]: value })
}

function syncRegionStates(
  map: MapLibreMap,
  previous: Set<string>,
  nextValues: readonly string[],
  key: 'comparison' | 'selected',
): Set<string> {
  const next = new Set(nextValues)
  for (const id of previous) {
    if (!next.has(id)) updateFeatureState(map, id, key, false)
  }
  for (const id of next) {
    if (!previous.has(id)) updateFeatureState(map, id, key, true)
  }
  return next
}

function firstMapFeature(
  features: MapGeoJSONFeature[],
): MapGeoJSONFeature | null {
  return features[0] ?? null
}

function toInspection(
  event: MapMouseEvent,
  feature: MapGeoJSONFeature | null,
  idProperty: string,
): MapInspection {
  const rawId = feature?.properties?.[idProperty]
  const rawName = feature?.properties?.name
  return {
    longitude: event.lngLat.lng,
    latitude: event.lngLat.lat,
    featureId:
      typeof rawId === 'string'
        ? rawId
        : feature?.id !== undefined
          ? String(feature.id)
          : null,
    featureName: typeof rawName === 'string' ? rawName : null,
  }
}
