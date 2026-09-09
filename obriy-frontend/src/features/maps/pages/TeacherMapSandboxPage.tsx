import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ArrowLeft,
  Box,
  FileJson,
  Map as MapIcon,
  MousePointer2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import {
  archiveCustomMap,
  createMapDraft,
  createMapDraftFromPreset,
  deleteCustomMap,
  deleteMapDraft,
  importMapDraft,
  inspectCustomMap,
  listMapDrafts,
  listMapPresets,
  listMyMapPresets,
  replaceCustomMap,
  restoreCustomMap,
  updateCustomMap,
} from '../api/map-presets.api'
import { MapCanvas } from '../components/MapCanvas'
import { createCustomMapPreview } from '../model/custom-map-preview'
import { mapQueryKeys } from '../model/map-query-keys'
import type {
  CustomMapInspection,
  MapInspection,
  MapDraft,
  MapPreset,
  MapProjection,
} from '../model/map.types'
import styles from '../Maps.module.css'

export function TeacherMapSandboxPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const presetsQuery = useQuery({
    queryKey: mapQueryKeys.presets,
    queryFn: listMapPresets,
  })
  const mineQuery = useQuery({
    queryKey: [...mapQueryKeys.presets, 'mine'],
    queryFn: () => listMyMapPresets(),
  })
  const draftsQuery = useQuery({
    queryKey: ['map-drafts'],
    queryFn: listMapDrafts,
  })
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [projection, setProjection] = useState<MapProjection>('MERCATOR')
  const [inspection, setInspection] = useState<MapInspection | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: mapQueryKeys.presets }),
      queryClient.invalidateQueries({
        queryKey: [...mapQueryKeys.presets, 'mine'],
      }),
      queryClient.invalidateQueries({ queryKey: ['map-drafts'] }),
    ])
  }

  const lifecycleMutation = useMutation({
    mutationFn: async ({ action, preset }: LifecycleAction) => {
      if (action === 'archive') return archiveCustomMap(preset.id)
      if (action === 'restore') return restoreCustomMap(preset.id)
      await deleteCustomMap(preset.id)
      return null
    },
    onSuccess: () => void refresh(),
  })

  const builtIns = (presetsQuery.data ?? []).filter(
    (preset) => preset.sourceType === 'BUILT_IN',
  )
  const customMaps = (mineQuery.data ?? []).filter(
    (preset) => showArchived || preset.status === 'ACTIVE',
  )
  const selectableMaps = [
    ...builtIns,
    ...(mineQuery.data ?? []).filter((preset) => preset.status === 'ACTIVE'),
  ]
  const selectedPreset =
    [...selectableMaps, ...customMaps].find(
      (preset) => preset.id === selectedPresetId,
    ) ?? selectableMaps[0] ?? null

  const selectPreset = (presetId: string) => {
    setSelectedPresetId(presetId)
    setInspection(null)
  }

  return (
    <section className={styles.page} aria-labelledby="map-sandbox-title">
      <div className={styles.content}>
        <Link className={styles.backLink} to="/app/teacher/tasks">
          <ArrowLeft size={16} aria-hidden="true" />
          {t('maps.sandbox.back')}
        </Link>

        <header className={styles.introWithAction}>
          <div className={styles.intro}>
            <h1 id="map-sandbox-title">{t('maps.sandbox.title')}</h1>
            <p>{t('maps.sandbox.description')}</p>
          </div>
          <button
            className={styles.primaryMapAction}
            onClick={() => setShowCreate(true)}
            type="button"
          >
            <Plus size={17} aria-hidden="true" />
            {t('maps.library.add')}
          </button>
        </header>

        {showCreate && (
          <CustomMapCreator
            onCancel={() => setShowCreate(false)}
            onCreated={(draft) => {
              void refresh().then(() =>
                navigate(`/app/teacher/maps/editor/${draft.id}`),
              )
            }}
          />
        )}

        {(draftsQuery.data?.length ?? 0) > 0 && (
          <MapDraftSection
            drafts={draftsQuery.data ?? []}
            onDelete={(draftId) =>
              void deleteMapDraft(draftId).then(() => refresh())
            }
          />
        )}

        <div className={styles.mapLibraryGrid}>
          <MapLibrarySection
            empty={t('maps.library.noBuiltIns')}
            maps={builtIns}
            onSelect={selectPreset}
            selectedId={selectedPreset?.id}
            title={t('maps.library.builtIns')}
          />
          <MapLibrarySection
            actions
            empty={t('maps.library.noCustom')}
            maps={customMaps}
            onAction={(action, preset) =>
              lifecycleMutation.mutate({ action, preset })
            }
            onSelect={selectPreset}
            selectedId={selectedPreset?.id}
            title={t('maps.library.mine')}
            toolbar={
              <label className={styles.archiveToggle}>
                <input
                  checked={showArchived}
                  onChange={(event) => setShowArchived(event.target.checked)}
                  type="checkbox"
                />
                {t('maps.library.showArchived')}
              </label>
            }
          />
        </div>

        {(presetsQuery.isLoading || mineQuery.isLoading) && (
          <StatusPanel message={t('maps.sandbox.loadingPresets')} />
        )}
        {(presetsQuery.isError || mineQuery.isError) && (
          <StatusPanel
            action={t('maps.sandbox.retry')}
            message={t('maps.sandbox.loadPresetsError')}
            onAction={() => void refresh()}
          />
        )}

        {selectedPreset && (
          <div className={styles.workspace}>
            <div className={styles.toolbar}>
              <label className={styles.presetField}>
                <span>{t('maps.sandbox.presetLabel')}</span>
                <select
                  onChange={(event) => selectPreset(event.target.value)}
                  value={selectedPreset.id}
                >
                  {selectableMaps.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {mapName(preset, t)}
                    </option>
                  ))}
                  {selectedPreset.status === 'ARCHIVED' && (
                    <option value={selectedPreset.id}>
                      {selectedPreset.name} · {t('maps.library.archived')}
                    </option>
                  )}
                </select>
              </label>

              <fieldset className={styles.projectionField}>
                <legend>{t('maps.sandbox.projectionLabel')}</legend>
                <div>
                  <button
                    aria-pressed={projection === 'MERCATOR'}
                    onClick={() => setProjection('MERCATOR')}
                    type="button"
                  >
                    <MapIcon size={16} aria-hidden="true" />
                    {t('maps.projection.mercator')}
                  </button>
                  <button
                    aria-pressed={projection === 'GLOBE'}
                    onClick={() => setProjection('GLOBE')}
                    type="button"
                  >
                    <Box size={16} aria-hidden="true" />
                    {t('maps.projection.globe')}
                  </button>
                </div>
              </fieldset>
            </div>

            <div className={styles.mapLayout}>
              <MapCanvas
                key={selectedPreset.id}
                onInspect={setInspection}
                preset={selectedPreset}
                projection={projection}
              />

              <aside className={styles.inspector} aria-live="polite">
                <div className={styles.inspectorHeading}>
                  <span aria-hidden="true">
                    <MousePointer2 size={18} />
                  </span>
                  <div>
                    <h2>{t('maps.sandbox.inspectorTitle')}</h2>
                    <p>{t('maps.sandbox.inspectHint')}</p>
                  </div>
                </div>
                {inspection ? (
                  <dl className={styles.inspectionList}>
                    <div>
                      <dt>{t('maps.sandbox.selectedFeature')}</dt>
                      <dd>
                        {inspection.featureName ??
                          t('maps.sandbox.emptySelection')}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('maps.sandbox.featureId')}</dt>
                      <dd>{inspection.featureId ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>{t('maps.sandbox.longitude')}</dt>
                      <dd>{`${inspection.longitude.toFixed(5)}°`}</dd>
                    </div>
                    <div>
                      <dt>{t('maps.sandbox.latitude')}</dt>
                      <dd>{`${inspection.latitude.toFixed(5)}°`}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className={styles.emptyInspection}>
                    {t('maps.sandbox.emptyInspection')}
                  </p>
                )}
                <MapDatasetMeta preset={selectedPreset} />
              </aside>
            </div>
            {selectedPreset.sourceType === 'CUSTOM_GEOJSON' && (
              <CustomMapSettings
                key={selectedPreset.id}
                preset={selectedPreset}
                onSaved={refresh}
                onEdit={() =>
                  void createMapDraftFromPreset(selectedPreset.id).then(
                    (draft) =>
                      navigate(`/app/teacher/maps/editor/${draft.id}`),
                  )
                }
              />
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function CustomMapCreator({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: (draft: MapDraft) => void
}) {
  const { i18n, t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [inspection, setInspection] = useState<CustomMapInspection | null>(null)
  const [labelProperty, setLabelProperty] = useState('')
  const [name, setName] = useState('')
  const [periodLabel, setPeriodLabel] = useState('')
  const [attribution, setAttribution] = useState('')
  const [contentLocale, setContentLocale] = useState<'UK' | 'EN'>(
    i18n.language.startsWith('en') ? 'EN' : 'UK',
  )
  const [preview, setPreview] = useState<MapPreset | null>(null)
  const [previewError, setPreviewError] = useState(false)
  const [duplicateNames, setDuplicateNames] = useState<string[]>([])

  const inspectMutation = useMutation({
    mutationFn: inspectCustomMap,
    onSuccess: (result) => {
      setInspection(result)
      setLabelProperty(result.labelProperties[0] ?? '')
    },
  })
  const createMutation = useMutation({
    mutationFn: () =>
      importMapDraft(file!, labelProperty, {
        name,
        contentLocale,
        periodLabel,
        attribution,
      }),
    onSuccess: onCreated,
  })
  const blankMutation = useMutation({
    mutationFn: () =>
      createMapDraft({
        name: name.trim() || t('maps.editor.untitled'),
        contentLocale,
        periodLabel,
        attribution,
      }),
    onSuccess: onCreated,
  })

  useEffect(() => {
    let active = true
    let url = ''
    if (!file || !labelProperty) return
    void createCustomMapPreview(file, labelProperty)
      .then((result) => {
        url = result.url
        if (active) {
          setPreview(result.preset)
          setDuplicateNames(result.duplicateNames)
        }
      })
      .catch(() => active && setPreviewError(true))
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [file, labelProperty])

  return (
    <section className={styles.importPanel} aria-labelledby="custom-map-title">
      <div className={styles.panelHeading}>
        <div>
          <h2 id="custom-map-title">{t('maps.import.title')}</h2>
        </div>
        <button aria-label={t('maps.import.cancel')} onClick={onCancel} type="button">
          <X size={19} />
        </button>
      </div>
      <div className={styles.importGrid}>
        <div className={styles.importForm}>
          <button
            className={styles.blankMapChoice}
            disabled={blankMutation.isPending}
            onClick={() => blankMutation.mutate()}
            type="button"
          >
            <Plus size={19} />
            <span>
              <strong>{t('maps.import.blankTitle')}</strong>
              <small>{t('maps.import.blankDescription')}</small>
            </span>
          </button>
          <div className={styles.importDivider}>
            <span>{t('maps.import.orImport')}</span>
          </div>
          <label className={styles.fileDrop}>
            <Upload size={22} aria-hidden="true" />
            <span>{file?.name ?? t('maps.import.chooseFile')}</span>
            <small>{t('maps.import.fileHint')}</small>
            <input
              accept=".geojson,.json,application/geo+json,application/json"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null
                setFile(nextFile)
                setInspection(null)
                setLabelProperty('')
                setPreview(null)
                setPreviewError(false)
                setDuplicateNames([])
                if (nextFile) {
                  if (!name) setName(nextFile.name.replace(/\.(geojson|json)$/i, ''))
                  inspectMutation.mutate(nextFile)
                }
              }}
              type="file"
            />
          </label>
          {inspectMutation.isPending && <p>{t('maps.import.inspecting')}</p>}
          {inspectMutation.isError && (
            <p className={styles.formError}>{t('maps.import.invalidFile')}</p>
          )}
          {inspection && (
            <div className={styles.importStats}>
              <span>{t('maps.import.regions', { count: inspection.featureCount })}</span>
              <span>{t('maps.import.vertices', { count: inspection.vertexCount })}</span>
              <span>{formatBytes(file?.size ?? 0)}</span>
            </div>
          )}
          <label className={styles.mapFormField}>
            <span>{t('maps.import.name')}</span>
            <input maxLength={160} onChange={(event) => setName(event.target.value)} value={name} />
          </label>
          <label className={styles.mapFormField}>
            <span>{t('maps.import.period')}</span>
            <input maxLength={120} onChange={(event) => setPeriodLabel(event.target.value)} placeholder={t('maps.import.periodPlaceholder')} value={periodLabel} />
          </label>
          <label className={styles.mapFormField}>
            <span>{t('maps.import.labelProperty')}</span>
            <select
              disabled={!inspection}
              onChange={(event) => {
                setPreview(null)
                setPreviewError(false)
                setDuplicateNames([])
                setLabelProperty(event.target.value)
              }}
              value={labelProperty}
            >
              <option value="">{t('maps.import.chooseProperty')}</option>
              {inspection?.labelProperties.map((property) => <option key={property}>{property}</option>)}
            </select>
          </label>
          {duplicateNames.length > 0 && (
            <p className={styles.formWarning}>
              {t('maps.import.duplicateNames', {
                names: duplicateNames.slice(0, 3).join(', '),
              })}
            </p>
          )}
          {inspection?.labelProperties.length === 0 && (
            <p className={styles.formError}>{t('maps.import.noLabelProperty')}</p>
          )}
          <label className={styles.mapFormField}>
            <span>{t('maps.import.language')}</span>
            <select
              onChange={(event) =>
                setContentLocale(event.target.value as 'UK' | 'EN')
              }
              value={contentLocale}
            >
              <option value="UK">Українська</option>
              <option value="EN">English</option>
            </select>
          </label>
          <label className={styles.mapFormField}>
            <span>{t('maps.import.attribution')}</span>
            <input maxLength={1000} onChange={(event) => setAttribution(event.target.value)} value={attribution} />
          </label>
          {createMutation.isError && <p className={styles.formError}>{t('maps.import.saveError')}</p>}
          <div className={styles.formActions}>
            <button className={styles.secondaryMapAction} onClick={onCancel} type="button">{t('maps.import.cancel')}</button>
            <button
              className={styles.primaryMapAction}
              disabled={!file || !labelProperty || !name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              type="button"
            >
              {createMutation.isPending ? t('maps.import.saving') : t('maps.import.save')}
            </button>
          </div>
        </div>
        <div className={styles.importPreview}>
          {preview ? (
            <MapCanvas preset={preview} projection="MERCATOR" variant="ASSIGNMENT" />
          ) : (
            <div className={styles.previewPlaceholder}>
              <FileJson size={32} aria-hidden="true" />
              <p>{previewError ? t('maps.import.invalidPreview') : t('maps.import.previewHint')}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function MapLibrarySection({
  actions = false,
  empty,
  maps,
  onAction,
  onSelect,
  selectedId,
  title,
  toolbar,
}: {
  actions?: boolean
  empty: string
  maps: MapPreset[]
  onAction?: (action: LifecycleAction['action'], preset: MapPreset) => void
  onSelect: (id: string) => void
  selectedId?: string
  title: string
  toolbar?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <section className={styles.librarySection}>
      <div className={styles.libraryHeading}>
        <h2>{title}</h2>
        {toolbar}
      </div>
      {maps.length === 0 ? (
        <p className={styles.libraryEmpty}>{empty}</p>
      ) : (
        <div className={styles.mapCards}>
          {maps.map((preset) => (
            <article className={styles.mapCard} data-selected={preset.id === selectedId} key={preset.id}>
              <button className={styles.mapCardMain} onClick={() => onSelect(preset.id)} type="button">
                <span className={styles.mapCardIcon}><MapIcon size={19} /></span>
                <span><strong>{mapName(preset, t)}</strong><small>{preset.periodLabel ?? (preset.featureCount ? t('maps.import.regions', { count: preset.featureCount }) : preset.attribution)}</small></span>
              </button>
              {actions && (
                <div className={styles.cardActions}>
                  {preset.status === 'ACTIVE' ? (
                    <button aria-label={t('maps.library.archive')} onClick={() => onAction?.('archive', preset)} type="button"><Archive size={15} /></button>
                  ) : (
                    <>
                      <button aria-label={t('maps.library.restore')} onClick={() => onAction?.('restore', preset)} type="button"><RotateCcw size={15} /></button>
                      {!preset.geometryLocked && <button aria-label={t('maps.library.delete')} onClick={() => window.confirm(t('maps.library.deleteConfirm')) && onAction?.('delete', preset)} type="button"><Trash2 size={15} /></button>}
                    </>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function CustomMapSettings({ preset, onEdit, onSaved }: { preset: MapPreset; onEdit: () => void; onSaved: () => Promise<void> }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(preset.name)
  const [periodLabel, setPeriodLabel] = useState(preset.periodLabel ?? '')
  const [attribution, setAttribution] = useState(preset.attribution)
  const [contentLocale, setContentLocale] = useState<'UK' | 'EN'>(
    preset.contentLocale,
  )
  const [replacement, setReplacement] = useState<File | null>(null)
  const [replacementInspection, setReplacementInspection] = useState<CustomMapInspection | null>(null)
  const [labelProperty, setLabelProperty] = useState('')
  const saveMutation = useMutation({
    mutationFn: () =>
      updateCustomMap(preset.id, {
        name,
        periodLabel,
        attribution,
        contentLocale,
      }),
    onSuccess: () => { setEditing(false); void onSaved() },
  })
  const inspectMutation = useMutation({
    mutationFn: inspectCustomMap,
    onSuccess: (result) => { setReplacementInspection(result); setLabelProperty(result.labelProperties[0] ?? '') },
  })
  const replaceMutation = useMutation({
    mutationFn: () => replaceCustomMap(preset.id, replacement!, labelProperty),
    onSuccess: () => { setReplacement(null); setReplacementInspection(null); setLabelProperty(''); void onSaved() },
  })
  return (
    <section className={styles.mapSettings}>
      <div className={styles.libraryHeading}>
        <div><h2>{t('maps.settings.title')}</h2><p>{preset.geometryLocked ? t('maps.settings.locked') : t('maps.settings.editable')}</p></div>
        <div className={styles.editorHeaderActions}>
          <button className={styles.secondaryMapAction} onClick={onEdit} type="button"><MapIcon size={15} />{preset.geometryLocked ? t('maps.settings.editCopy') : t('maps.settings.editGeometry')}</button>
          <button className={styles.secondaryMapAction} onClick={() => setEditing((value) => !value)} type="button"><Pencil size={15} />{t('maps.settings.edit')}</button>
        </div>
      </div>
      {editing && (
        <div className={styles.settingsForm}>
          <label className={styles.mapFormField}><span>{t('maps.import.name')}</span><input maxLength={160} onChange={(event) => setName(event.target.value)} value={name} /></label>
          <label className={styles.mapFormField}><span>{t('maps.import.period')}</span><input maxLength={120} onChange={(event) => setPeriodLabel(event.target.value)} value={periodLabel} /></label>
          <label className={styles.mapFormField}><span>{t('maps.import.attribution')}</span><input maxLength={1000} onChange={(event) => setAttribution(event.target.value)} value={attribution} /></label>
          <label className={styles.mapFormField}>
            <span>{t('maps.import.language')}</span>
            <select onChange={(event) => setContentLocale(event.target.value as 'UK' | 'EN')} value={contentLocale}>
              <option value="UK">Українська</option>
              <option value="EN">English</option>
            </select>
          </label>
          <button className={styles.primaryMapAction} disabled={!name.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()} type="button">{t('maps.settings.save')}</button>
        </div>
      )}
      {!preset.geometryLocked && (
        <div className={styles.replaceMapRow}>
          <label className={styles.secondaryMapAction}><Upload size={15} />{replacement?.name ?? t('maps.settings.replace')}<input accept=".geojson,.json" onChange={(event) => { const file = event.target.files?.[0] ?? null; setReplacement(file); setReplacementInspection(null); if (file) inspectMutation.mutate(file) }} type="file" /></label>
          {replacementInspection && <select onChange={(event) => setLabelProperty(event.target.value)} value={labelProperty}>{replacementInspection.labelProperties.map((property) => <option key={property}>{property}</option>)}</select>}
          {replacement && labelProperty && <button className={styles.primaryMapAction} disabled={replaceMutation.isPending} onClick={() => replaceMutation.mutate()} type="button">{t('maps.settings.applyReplacement')}</button>}
        </div>
      )}
    </section>
  )
}

function MapDraftSection({ drafts, onDelete }: { drafts: MapDraft[]; onDelete: (draftId: string) => void }) {
  const { t } = useTranslation()
  return (
    <section className={styles.librarySection}>
      <div className={styles.libraryHeading}>
        <h2>{t('maps.editor.drafts')}</h2>
        <span>{drafts.length}</span>
      </div>
      <div className={styles.mapCards}>
        {drafts.map((draft) => (
          <article className={styles.mapCard} key={draft.id}>
            <Link className={styles.mapCardMain} to={`/app/teacher/maps/editor/${draft.id}`}>
              <span className={styles.mapCardIcon}><Pencil size={18} /></span>
              <span><strong>{draft.name}</strong><small>{t('maps.editor.regionCount', { count: draft.featureCount })}</small></span>
            </Link>
            <div className={styles.cardActions}>
              <button aria-label={t('maps.editor.deleteDraft', { name: draft.name })} onClick={() => window.confirm(t('maps.editor.deleteDraftConfirm')) && onDelete(draft.id)} type="button"><Trash2 size={15} /></button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function MapDatasetMeta({ preset }: { preset: MapPreset }) {
  const { t } = useTranslation()
  return (
    <div className={styles.datasetMeta}>
      <strong>{mapName(preset, t)}</strong>
      {preset.periodLabel && <span>{preset.periodLabel}</span>}
      {preset.featureCount !== null && <span>{t('maps.import.regions', { count: preset.featureCount })}</span>}
      {preset.fileSizeBytes !== null && <span>{formatBytes(preset.fileSizeBytes)}</span>}
      {preset.attribution && <span>{preset.attribution}</span>}
    </div>
  )
}

function StatusPanel({ action, message, onAction }: { action?: string; message: string; onAction?: () => void }) {
  return <div className={styles.statusPanel} role="status"><MapIcon size={28} aria-hidden="true" /><p>{message}</p>{action && onAction && <button onClick={onAction} type="button">{action}</button>}</div>
}

type LifecycleAction = { action: 'archive' | 'restore' | 'delete'; preset: MapPreset }

function mapName(preset: MapPreset, t: ReturnType<typeof useTranslation>['t']): string {
  return t(`maps.presets.${preset.key}`, { defaultValue: preset.name })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
