import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Box, Map as MapIcon, MousePointer2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { listMapPresets } from '../api/map-presets.api'
import { MapCanvas } from '../components/MapCanvas'
import { mapQueryKeys } from '../model/map-query-keys'
import type { MapInspection, MapProjection } from '../model/map.types'
import styles from '../Maps.module.css'

export function TeacherMapSandboxPage() {
  const { t } = useTranslation()
  const presetsQuery = useQuery({
    queryKey: mapQueryKeys.presets,
    queryFn: listMapPresets,
  })
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [projection, setProjection] = useState<MapProjection>('MERCATOR')
  const [inspection, setInspection] = useState<MapInspection | null>(null)

  const selectedPreset = useMemo(() => {
    const presets = presetsQuery.data ?? []
    return (
      presets.find((preset) => preset.id === selectedPresetId) ??
      presets[0] ??
      null
    )
  }, [presetsQuery.data, selectedPresetId])

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

        <header className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>
              <MapIcon size={15} aria-hidden="true" />
              {t('maps.sandbox.eyebrow')}
            </p>
            <h1 id="map-sandbox-title">{t('maps.sandbox.title')}</h1>
            <p>{t('maps.sandbox.description')}</p>
          </div>
        </header>

        {presetsQuery.isLoading && (
          <StatusPanel message={t('maps.sandbox.loadingPresets')} />
        )}
        {presetsQuery.isError && (
          <StatusPanel
            action={t('maps.sandbox.retry')}
            message={t('maps.sandbox.loadPresetsError')}
            onAction={() => void presetsQuery.refetch()}
          />
        )}
        {!presetsQuery.isLoading &&
          !presetsQuery.isError &&
          presetsQuery.data?.length === 0 && (
            <StatusPanel message={t('maps.sandbox.noPresets')} />
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
                  {presetsQuery.data?.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {t(`maps.presets.${preset.key}`, {
                        defaultValue: preset.name,
                      })}
                    </option>
                  ))}
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
                      <dd>{inspection.featureId ?? '\u2014'}</dd>
                    </div>
                    <div>
                      <dt>{t('maps.sandbox.longitude')}</dt>
                      <dd>{`${inspection.longitude.toFixed(5)}\u00B0`}</dd>
                    </div>
                    <div>
                      <dt>{t('maps.sandbox.latitude')}</dt>
                      <dd>{`${inspection.latitude.toFixed(5)}\u00B0`}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className={styles.emptyInspection}>
                    {t('maps.sandbox.emptyInspection')}
                  </p>
                )}

                <div className={styles.datasetMeta}>
                  <strong>
                    {t(`maps.presets.${selectedPreset.key}`, {
                      defaultValue: selectedPreset.name,
                    })}
                  </strong>
                  <span>{selectedPreset.attribution}</span>
                </div>
              </aside>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function StatusPanel({
  action,
  message,
  onAction,
}: {
  action?: string
  message: string
  onAction?: () => void
}) {
  return (
    <div className={styles.statusPanel} role="status">
      <MapIcon size={28} aria-hidden="true" />
      <p>{message}</p>
      {action && onAction && (
        <button onClick={onAction} type="button">
          {action}
        </button>
      )}
    </div>
  )
}
