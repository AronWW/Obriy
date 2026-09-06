import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  TerraDrawSessionUndoRedo,
  ValidateNotSelfIntersecting,
} from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import {
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
} from 'maplibre-gl'
import type { FeatureCollection, Geometry } from 'geojson'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MousePointer2, Pencil, Redo2, Undo2 } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../../shared/theme/theme-context'
import {
  createRegionId,
  drawingSnapshot,
  toDrawingFeatures,
  toEditorCollection,
  type DrawingPolygonFeature,
} from '../model/map-editor-geometry'
import { mapStyleForTheme } from '../model/map-style'
import type {
  EditorFeatureCollection,
  MapViewport,
} from '../model/map.types'
import styles from '../Maps.module.css'

setWorkerUrl(workerUrl)

const LABEL_SOURCE_ID = 'obriy-editor-label-source'
const LABEL_LAYER_ID = 'obriy-editor-label-layer'

export interface MapDrawingCanvasHandle {
  combineRegions: (regionIds: string[], name: string) => void
  removeRegion: (regionId: string) => void
  renameRegion: (regionId: string, name: string) => void
  selectRegion: (regionId: string) => void
}

interface MapDrawingCanvasProps {
  initialCollection: EditorFeatureCollection
  initialViewport?: MapViewport | null
  onChange: (
    collection: EditorFeatureCollection,
    drawingFeatures: DrawingPolygonFeature[],
  ) => void
  onSelectedRegion: (regionId: string | null) => void
}

export const MapDrawingCanvas = forwardRef<
  MapDrawingCanvasHandle,
  MapDrawingCanvasProps
>(function MapDrawingCanvas(
  { initialCollection, initialViewport, onChange, onSelectedRegion },
  ref,
) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const initialCollectionRef = useRef(initialCollection)
  const initialViewportRef = useRef(initialViewport)
  const drawRef = useRef<TerraDraw | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const changeRef = useRef(onChange)
  const selectRef = useRef(onSelectedRegion)
  const [mode, setMode] = useState<'select' | 'polygon'>('select')
  const [historyState, setHistoryState] = useState({ undo: false, redo: false })
  const [error, setError] = useState(false)

  useEffect(() => {
    changeRef.current = onChange
    selectRef.current = onSelectedRegion
  }, [onChange, onSelectedRegion])

  const emitSnapshot = () => {
    const draw = drawRef.current
    if (!draw) return
    const features = drawingSnapshot(draw.getSnapshot())
    const collection = toEditorCollection(features)
    changeRef.current(collection, features)
    const source = mapRef.current?.getSource(LABEL_SOURCE_ID) as
      | GeoJSONSource
      | undefined
    source?.setData(collection as FeatureCollection<Geometry>)
  }

  useImperativeHandle(ref, () => ({
    combineRegions(regionIds, name) {
      const draw = drawRef.current
      if (!draw || regionIds.length < 2) return
      const nextId = createRegionId()
      draw.getSnapshot().forEach((feature) => {
        if (
          typeof feature.id !== 'undefined' &&
          regionIds.includes(String(feature.properties.regionId ?? ''))
        ) {
          draw.updateFeatureProperties(feature.id, {
            ...feature.properties,
            regionId: nextId,
            name,
          })
        }
      })
      emitSnapshot()
      selectRef.current(nextId)
    },
    removeRegion(regionId) {
      const draw = drawRef.current
      if (!draw) return
      const ids = draw
        .getSnapshot()
        .filter((feature) => feature.properties.regionId === regionId)
        .map((feature) => feature.id)
        .filter((id): id is string | number => id !== undefined)
      draw.removeFeatures(ids)
      emitSnapshot()
      selectRef.current(null)
    },
    renameRegion(regionId, name) {
      const draw = drawRef.current
      if (!draw) return
      draw.getSnapshot().forEach((feature) => {
        if (feature.properties.regionId === regionId && feature.id !== undefined)
          draw.updateFeatureProperties(feature.id, {
            ...feature.properties,
            name,
          })
      })
      emitSnapshot()
    },
    selectRegion(regionId) {
      const draw = drawRef.current
      const feature = draw
        ?.getSnapshot()
        .find((candidate) => candidate.properties.regionId === regionId)
      if (draw && feature?.id !== undefined) draw.selectFeature(feature.id)
    },
  }))

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    setError(false)
    const map = new MapLibreMap({
      container,
      style: mapStyleForTheme(theme, 'NEUTRAL'),
      center: [
        initialViewportRef.current?.longitude ?? 15,
        initialViewportRef.current?.latitude ?? 25,
      ],
      zoom: initialViewportRef.current?.zoom ?? 1.5,
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
    })
    mapRef.current = map
    map.addControl(new NavigationControl(), 'top-right')
    map.on('error', () => setError(true))
    map.on('load', () => {
      const history = new TerraDrawSessionUndoRedo({ maxStackSize: 100 })
      const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [
          new TerraDrawPolygonMode({
            snapping: {
              toFeature: {
                filter: () => true,
                toCoordinate: true,
                toLine: true,
              },
            },
            validation: ValidateNotSelfIntersecting,
          }),
          new TerraDrawSelectMode({
            flags: {
              polygon: {
                feature: {
                  draggable: true,
                  selfIntersectable: false,
                  validation: ValidateNotSelfIntersecting,
                  coordinates: {
                    draggable: true,
                    deletable: true,
                    midpoints: { draggable: true },
                    snappable: { toCoordinate: true, toLine: true },
                  },
                },
              },
            },
          }),
        ],
        undoRedo: { sessionLevel: history },
      })
      drawRef.current = draw
      draw.start()
      const initialFeatures = toDrawingFeatures(initialCollectionRef.current)
      if (initialFeatures.length)
        draw.addFeatures(
          initialFeatures as Parameters<TerraDraw['addFeatures']>[0],
        )
      map.addSource(LABEL_SOURCE_ID, {
        type: 'geojson',
        data: toEditorCollection(initialFeatures) as FeatureCollection<Geometry>,
      })
      map.addLayer({
        id: LABEL_LAYER_ID,
        type: 'symbol',
        source: LABEL_SOURCE_ID,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 13,
          'text-max-width': 9,
        },
        paint: {
          'text-color': theme === 'night' ? '#f2e8d1' : '#342a20',
          'text-halo-color': theme === 'night' ? '#111a22' : '#f6f0e4',
          'text-halo-width': 1.4,
        },
      })
      draw.on('change', emitSnapshot)
      draw.on('finish', (id) => {
        const feature = draw.getSnapshotFeature(id)
        if (feature) {
          const regionCount = new Set(
            draw
              .getSnapshot()
              .map((candidate) => candidate.properties.regionId)
              .filter(Boolean),
          ).size
          draw.updateFeatureProperties(id, {
            ...feature.properties,
            regionId: createRegionId(),
            name: t('maps.editor.defaultRegionName', {
              number: regionCount + 1,
            }),
          })
        }
        draw.setMode('select')
        setMode('select')
        emitSnapshot()
      })
      draw.on('select', (id) => {
        const feature = draw.getSnapshotFeature(id)
        selectRef.current(String(feature?.properties.regionId ?? '') || null)
      })
      draw.on('deselect', () => selectRef.current(null))
      draw.on('history', () =>
        setHistoryState({ undo: history.canUndo(), redo: history.canRedo() }),
      )
      emitSnapshot()
    })
    return () => {
      drawRef.current?.stop()
      drawRef.current = null
      mapRef.current = null
      map.remove()
    }
  }, [t, theme])

  const chooseMode = (nextMode: 'select' | 'polygon') => {
    drawRef.current?.setMode(nextMode)
    setMode(nextMode)
  }

  return (
    <div className={styles.drawingCanvasShell}>
      <div className={styles.drawingToolbar}>
        <button
          aria-pressed={mode === 'select'}
          onClick={() => chooseMode('select')}
          type="button"
        >
          <MousePointer2 size={16} />
          {t('maps.editor.select')}
        </button>
        <button
          aria-pressed={mode === 'polygon'}
          onClick={() => chooseMode('polygon')}
          type="button"
        >
          <Pencil size={16} />
          {t('maps.editor.draw')}
        </button>
        <button
          aria-label={t('maps.editor.undo')}
          disabled={!historyState.undo}
          onClick={() => drawRef.current?.undo()}
          type="button"
        >
          <Undo2 size={16} />
        </button>
        <button
          aria-label={t('maps.editor.redo')}
          disabled={!historyState.redo}
          onClick={() => drawRef.current?.redo()}
          type="button"
        >
          <Redo2 size={16} />
        </button>
      </div>
      <div
        aria-label={t('maps.editor.canvasLabel')}
        className={styles.drawingCanvas}
        ref={containerRef}
        role="application"
      />
      {error && <p className={styles.formError}>{t('maps.editor.mapError')}</p>}
    </div>
  )
})
