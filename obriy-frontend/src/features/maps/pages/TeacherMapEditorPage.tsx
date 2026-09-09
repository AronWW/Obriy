import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Combine,
  LoaderCircle,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getMapDraft,
  loadMapDraftGeometry,
  publishMapDraft,
  saveMapDraftGeometry,
  updateMapDraft,
} from '../api/map-presets.api'
import {
  MapDrawingCanvas,
  type MapDrawingCanvasHandle,
} from '../components/MapDrawingCanvas'
import {
  diagnoseMap,
  type DrawingPolygonFeature,
} from '../model/map-editor-geometry'
import type {
  EditorFeatureCollection,
  MapDraft,
} from '../model/map.types'
import styles from '../Maps.module.css'

export function TeacherMapEditorPage() {
  const { draftId = '' } = useParams()
  const { t } = useTranslation()
  const draftQuery = useQuery({
    queryKey: ['map-drafts', draftId],
    queryFn: () => getMapDraft(draftId),
    enabled: Boolean(draftId),
  })
  const geometryQuery = useQuery({
    queryKey: ['map-drafts', draftId, 'geojson'],
    queryFn: () => loadMapDraftGeometry(draftQuery.data!),
    enabled: Boolean(draftQuery.data),
  })

  if (draftQuery.isLoading || geometryQuery.isLoading)
    return <EditorStatus message={t('maps.editor.loading')} />
  if (
    draftQuery.isError ||
    geometryQuery.isError ||
    !draftQuery.data ||
    !geometryQuery.data
  )
    return <EditorStatus message={t('maps.editor.loadError')} />

  return (
    <LoadedMapEditor
      initialCollection={geometryQuery.data}
      initialDraft={draftQuery.data}
      key={draftQuery.data.id}
    />
  )
}

function LoadedMapEditor({
  initialCollection,
  initialDraft,
}: {
  initialCollection: EditorFeatureCollection
  initialDraft: MapDraft
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const draftId = initialDraft.id
  const editorRef = useRef<MapDrawingCanvasHandle | null>(null)
  const receivedInitialSnapshot = useRef(false)
  const savingRef = useRef(false)
  const [draft, setDraft] = useState(initialDraft)
  const [collection, setCollection] = useState(initialCollection)
  const [drawingFeatures, setDrawingFeatures] = useState<
    DrawingPolygonFeature[]
  >([])
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [checkedRegionIds, setCheckedRegionIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [name, setName] = useState(initialDraft.name)
  const [periodLabel, setPeriodLabel] = useState(initialDraft.periodLabel ?? '')
  const [attribution, setAttribution] = useState(initialDraft.attribution)
  const [contentLocale, setContentLocale] = useState<'UK' | 'EN'>(
    initialDraft.contentLocale,
  )
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<
    'IDLE' | 'SAVING' | 'SAVED' | 'ERROR' | 'CONFLICT'
  >('IDLE')
  const [publishing, setPublishing] = useState(false)
  const [regionNaming, setRegionNaming] = useState<{
    id: string
    name: string
  } | null>(null)

  const diagnostics = useMemo(
    () => diagnoseMap(drawingFeatures),
    [drawingFeatures],
  )
  const regions = collection.features
  const filteredRegions = regions.filter((region) =>
    region.properties.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  )

  const persist = useCallback(async (): Promise<MapDraft | null> => {
    const current = draft
    if (savingRef.current) return current
    savingRef.current = true
    setSaveState('SAVING')
    try {
      let saved = await updateMapDraft(current.id, current.editVersion, {
        name,
        periodLabel,
        attribution,
        contentLocale,
      })
      saved = await saveMapDraftGeometry(
        current.id,
        saved.editVersion,
        collection,
      )
      queryClient.setQueryData(['map-drafts', draftId], saved)
      setDraft(saved)
      setDirty(false)
      setSaveState('SAVED')
      return saved
    } catch (error) {
      const status = (error as { status?: number }).status
      setSaveState(status === 409 ? 'CONFLICT' : 'ERROR')
      return null
    } finally {
      savingRef.current = false
    }
  }, [
    attribution,
    collection,
    contentLocale,
    draftId,
    draft,
    name,
    periodLabel,
    queryClient,
  ])

  useEffect(() => {
    if (!dirty) return
    const timeout = window.setTimeout(() => void persist(), 8_000)
    return () => window.clearTimeout(timeout)
  }, [dirty, persist])

  useEffect(() => {
    if (!regionNaming) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRegionNaming(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [regionNaming])

  const handleGeometryChange = useCallback(
    (
      nextCollection: EditorFeatureCollection,
      nextFeatures: DrawingPolygonFeature[],
    ) => {
      setCollection(nextCollection)
      setDrawingFeatures(nextFeatures)
      if (receivedInitialSnapshot.current) setDirty(true)
      else receivedInitialSnapshot.current = true
    },
    [],
  )

  const publish = async () => {
    setPublishing(true)
    const saved = await persist()
    if (!saved) {
      setPublishing(false)
      return
    }
    try {
      await publishMapDraft(saved.id, saved.editVersion)
      await queryClient.invalidateQueries({ queryKey: ['map-drafts'] })
      await queryClient.invalidateQueries({ queryKey: ['map-presets'] })
      navigate('/app/teacher/maps')
    } catch (error) {
      const status = (error as { status?: number }).status
      setSaveState(status === 409 ? 'CONFLICT' : 'ERROR')
      setPublishing(false)
    }
  }

  const blockingErrors =
    diagnostics.selfIntersectionCount > 0 || diagnostics.overlapCount > 0

  return (
    <main className={styles.mapEditorPage}>
      <header className={styles.mapEditorHeader}>
        <div>
          <Link className={styles.backLink} to="/app/teacher/maps">
            <ArrowLeft size={16} />
            {t('maps.editor.back')}
          </Link>
          <h1>{name || t('maps.editor.untitled')}</h1>
          <SaveIndicator state={saveState} />
        </div>
        <div className={styles.editorHeaderActions}>
          <button
            className={styles.secondaryMapAction}
            disabled={saveState === 'SAVING'}
            onClick={() => void persist()}
            type="button"
          >
            <Save size={16} />
            {t('maps.editor.save')}
          </button>
          <button
            className={styles.primaryMapAction}
            disabled={
              publishing ||
              saveState === 'SAVING' ||
              !name.trim() ||
              diagnostics.regionCount === 0 ||
              blockingErrors
            }
            onClick={() => void publish()}
            type="button"
          >
            {publishing ? <LoaderCircle className={styles.spin} size={16} /> : <Check size={16} />}
            {t('maps.editor.publish')}
          </button>
        </div>
      </header>

      {saveState === 'CONFLICT' && (
        <div className={styles.editorConflict} role="alert">
          <AlertTriangle size={18} />
          <span>{t('maps.editor.conflict')}</span>
          <button onClick={() => window.location.reload()} type="button">
            {t('maps.editor.reload')}
          </button>
        </div>
      )}

      <div className={styles.mapEditorLayout}>
        <aside className={styles.editorSidebar}>
          <section className={styles.editorMetadata}>
            <label className={styles.mapFormField}>
              <span>{t('maps.import.name')}</span>
              <input
                maxLength={160}
                onChange={(event) => {
                  setName(event.target.value)
                  setDirty(true)
                }}
                value={name}
              />
            </label>
            <label className={styles.mapFormField}>
              <span>{t('maps.import.period')}</span>
              <input
                maxLength={120}
                onChange={(event) => {
                  setPeriodLabel(event.target.value)
                  setDirty(true)
                }}
                value={periodLabel}
              />
            </label>
            <label className={styles.mapFormField}>
              <span>{t('maps.import.language')}</span>
              <select
                onChange={(event) => {
                  setContentLocale(event.target.value as 'UK' | 'EN')
                  setDirty(true)
                }}
                value={contentLocale}
              >
                <option value="UK">Українська</option>
                <option value="EN">English</option>
              </select>
            </label>
            <label className={styles.mapFormField}>
              <span>{t('maps.import.attribution')}</span>
              <input
                maxLength={1000}
                onChange={(event) => {
                  setAttribution(event.target.value)
                  setDirty(true)
                }}
                value={attribution}
              />
            </label>
          </section>

          <section className={styles.regionPanel}>
            <div className={styles.regionPanelHeading}>
              <h2>{t('maps.editor.regions')}</h2>
              <span>{diagnostics.regionCount}</span>
            </div>
            <label className={styles.regionSearch}>
              <Search size={15} />
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('maps.editor.search')}
                value={search}
              />
            </label>
            {checkedRegionIds.length >= 2 && (
              <button
                className={styles.combineButton}
                onClick={() => {
                  const first = regions.find((region) =>
                    checkedRegionIds.includes(region.properties.regionId),
                  )
                  editorRef.current?.combineRegions(
                    checkedRegionIds,
                    first?.properties.name ?? t('maps.editor.combinedRegion'),
                  )
                  setCheckedRegionIds([])
                }}
                type="button"
              >
                <Combine size={15} />
                {t('maps.editor.combine', { count: checkedRegionIds.length })}
              </button>
            )}
            <div className={styles.regionList}>
              {filteredRegions.map((region) => {
                const regionId = region.properties.regionId
                return (
                  <div
                    className={styles.regionRow}
                    data-selected={selectedRegionId === regionId}
                    key={regionId}
                  >
                    <input
                      aria-label={t('maps.editor.chooseForCombine', {
                        name: region.properties.name,
                      })}
                      checked={checkedRegionIds.includes(regionId)}
                      onChange={(event) =>
                        setCheckedRegionIds((current) =>
                          event.target.checked
                            ? [...current, regionId]
                            : current.filter((id) => id !== regionId),
                        )
                      }
                      type="checkbox"
                    />
                    <input
                      aria-label={t('maps.editor.regionName')}
                      onChange={(event) =>
                        editorRef.current?.renameRegion(
                          regionId,
                          event.target.value,
                        )
                      }
                      onFocus={() => editorRef.current?.selectRegion(regionId)}
                      value={region.properties.name}
                    />
                    <button
                      aria-label={t('maps.editor.deleteRegion', {
                        name: region.properties.name,
                      })}
                      onClick={() => editorRef.current?.removeRegion(regionId)}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
              {filteredRegions.length === 0 && (
                <p className={styles.libraryEmpty}>{t('maps.editor.noRegions')}</p>
              )}
            </div>
          </section>
        </aside>

        <section className={styles.editorMapColumn}>
          <MapDrawingCanvas
            initialCollection={initialCollection}
            initialViewport={initialDraft.defaultViewport}
            onChange={handleGeometryChange}
            onRegionCreated={(id, suggestedName) =>
              setRegionNaming({ id, name: suggestedName })
            }
            onSelectedRegion={setSelectedRegionId}
            ref={editorRef}
          />
          <DiagnosticsPanel diagnostics={diagnostics} />
        </section>
      </div>

      {regionNaming && (
        <div
          className={styles.editorDialogBackdrop}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setRegionNaming(null)
          }}
        >
          <form
            aria-labelledby="region-naming-title"
            aria-modal="true"
            className={styles.editorDialog}
            onSubmit={(event) => {
              event.preventDefault()
              const nextName = regionNaming.name.trim()
              if (!nextName) return
              editorRef.current?.renameRegion(regionNaming.id, nextName)
              setRegionNaming(null)
            }}
            role="dialog"
          >
            <div className={styles.editorDialogHeading}>
              <h2 id="region-naming-title">{t('maps.editor.nameNewRegion')}</h2>
              <button
                aria-label={t('maps.editor.closeNaming')}
                onClick={() => setRegionNaming(null)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <label className={styles.mapFormField}>
              <span>{t('maps.editor.regionName')}</span>
              <input
                autoFocus
                maxLength={160}
                onChange={(event) =>
                  setRegionNaming((current) =>
                    current ? { ...current, name: event.target.value } : null,
                  )
                }
                onFocus={(event) => event.currentTarget.select()}
                value={regionNaming.name}
              />
            </label>
            <p>{t('maps.editor.namingHint')}</p>
            <div className={styles.formActions}>
              <button
                className={styles.secondaryMapAction}
                onClick={() => setRegionNaming(null)}
                type="button"
              >
                {t('maps.editor.keepDefaultName')}
              </button>
              <button
                className={styles.primaryMapAction}
                disabled={!regionNaming.name.trim()}
                type="submit"
              >
                {t('maps.editor.saveRegionName')}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}

function SaveIndicator({
  state,
}: {
  state: 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR' | 'CONFLICT'
}) {
  const { t } = useTranslation()
  return (
    <p className={styles.saveIndicator} data-state={state}>
      {state === 'SAVING' && <LoaderCircle className={styles.spin} size={14} />}
      {t(`maps.editor.saveStates.${state.toLocaleLowerCase()}`)}
    </p>
  )
}

function DiagnosticsPanel({
  diagnostics,
}: {
  diagnostics: ReturnType<typeof diagnoseMap>
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.diagnosticsPanel}>
      <span>{t('maps.editor.regionCount', { count: diagnostics.regionCount })}</span>
      <span>{t('maps.editor.polygonCount', { count: diagnostics.polygonCount })}</span>
      <span>{t('maps.editor.vertexCount', { count: diagnostics.vertexCount })}</span>
      {diagnostics.duplicateNames.length > 0 && (
        <strong>{t('maps.editor.duplicateWarning')}</strong>
      )}
      {diagnostics.selfIntersectionCount > 0 && (
        <strong>{t('maps.editor.selfIntersectionWarning')}</strong>
      )}
      {diagnostics.overlapCount > 0 && (
        <strong>{t('maps.editor.overlapWarning', { count: diagnostics.overlapCount })}</strong>
      )}
      {diagnostics.possibleGapCount > 0 && (
        <em>{t('maps.editor.gapWarning', { count: diagnostics.possibleGapCount })}</em>
      )}
    </div>
  )
}

function EditorStatus({ message }: { message: string }) {
  return (
    <main className={styles.mapEditorPage}>
      <div className={styles.statusPanel} role="status">
        <LoaderCircle className={styles.spin} size={24} />
        <p>{message}</p>
      </div>
    </main>
  )
}
