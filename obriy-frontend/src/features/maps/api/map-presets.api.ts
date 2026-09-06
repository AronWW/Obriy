import {
  authorizedFetch,
  authorizedRequest,
} from '../../auth/model/session.service'
import type {
  CustomMapInspection,
  CustomMapMetadata,
  EditorFeatureCollection,
  MapDraft,
  MapDraftMetadata,
  MapPreset,
} from '../model/map.types'

export function listMapPresets(): Promise<MapPreset[]> {
  return authorizedRequest<MapPreset[]>('/map-presets')
}

export function getMapPreset(presetId: string): Promise<MapPreset> {
  return authorizedRequest<MapPreset>(`/map-presets/${presetId}`)
}

export function listMyMapPresets(
  status?: 'ACTIVE' | 'ARCHIVED',
): Promise<MapPreset[]> {
  return authorizedRequest<MapPreset[]>(
    `/map-presets/mine${status ? `?status=${status}` : ''}`,
  )
}

export function inspectCustomMap(file: File): Promise<CustomMapInspection> {
  const body = new FormData()
  body.append('file', file)
  return authorizedRequest<CustomMapInspection>('/map-presets/custom/inspect', {
    method: 'POST',
    body,
  })
}

export function createCustomMap(
  file: File,
  labelProperty: string,
  metadata: CustomMapMetadata,
): Promise<MapPreset> {
  const body = mapFormData(file, labelProperty, metadata)
  return authorizedRequest<MapPreset>('/map-presets/custom', {
    method: 'POST',
    body,
  })
}

export function updateCustomMap(
  presetId: string,
  metadata: Partial<CustomMapMetadata>,
): Promise<MapPreset> {
  return authorizedRequest<MapPreset>(`/map-presets/${presetId}`, {
    method: 'PATCH',
    body: metadata,
  })
}

export function replaceCustomMap(
  presetId: string,
  file: File,
  labelProperty: string,
): Promise<MapPreset> {
  const body = new FormData()
  body.append('file', file)
  body.append('labelProperty', labelProperty)
  return authorizedRequest<MapPreset>(`/map-presets/${presetId}/geojson`, {
    method: 'PUT',
    body,
  })
}

export function archiveCustomMap(presetId: string): Promise<MapPreset> {
  return authorizedRequest<MapPreset>(`/map-presets/${presetId}/archive`, {
    method: 'POST',
  })
}

export function restoreCustomMap(presetId: string): Promise<MapPreset> {
  return authorizedRequest<MapPreset>(`/map-presets/${presetId}/restore`, {
    method: 'POST',
  })
}

export function deleteCustomMap(presetId: string): Promise<void> {
  return authorizedRequest<void>(`/map-presets/${presetId}`, {
    method: 'DELETE',
  })
}

export function listMapDrafts(): Promise<MapDraft[]> {
  return authorizedRequest<MapDraft[]>('/map-drafts')
}

export function getMapDraft(draftId: string): Promise<MapDraft> {
  return authorizedRequest<MapDraft>(`/map-drafts/${draftId}`)
}

export function createMapDraft(metadata: MapDraftMetadata): Promise<MapDraft> {
  return authorizedRequest<MapDraft>('/map-drafts', {
    method: 'POST',
    body: metadata,
  })
}

export function importMapDraft(
  file: File,
  labelProperty: string,
  metadata: MapDraftMetadata,
): Promise<MapDraft> {
  const body = draftFormData(file, { ...metadata, labelProperty })
  return authorizedRequest<MapDraft>('/map-drafts/import', {
    method: 'POST',
    body,
  })
}

export function createMapDraftFromPreset(presetId: string): Promise<MapDraft> {
  return authorizedRequest<MapDraft>(`/map-drafts/from-preset/${presetId}`, {
    method: 'POST',
  })
}

export function updateMapDraft(
  draftId: string,
  expectedEditVersion: number,
  metadata: Partial<MapDraftMetadata>,
): Promise<MapDraft> {
  return authorizedRequest<MapDraft>(`/map-drafts/${draftId}`, {
    method: 'PATCH',
    body: { ...metadata, expectedEditVersion },
  })
}

export function saveMapDraftGeometry(
  draftId: string,
  expectedEditVersion: number,
  collection: EditorFeatureCollection,
): Promise<MapDraft> {
  const file = new File([JSON.stringify(collection)], 'map.geojson', {
    type: 'application/geo+json',
  })
  const body = draftFormData(file, { expectedEditVersion })
  return authorizedRequest<MapDraft>(`/map-drafts/${draftId}/geojson`, {
    method: 'PUT',
    body,
  })
}

export async function loadMapDraftGeometry(
  draft: MapDraft,
): Promise<EditorFeatureCollection> {
  if (!draft.geojsonUrl) return { type: 'FeatureCollection', features: [] }
  const response = await authorizedFetch(draft.geojsonUrl)
  if (!response.ok) throw new Error('MAP_DRAFT_GEOJSON_LOAD_FAILED')
  return response.json() as Promise<EditorFeatureCollection>
}

export function publishMapDraft(
  draftId: string,
  expectedEditVersion: number,
): Promise<{ preset: MapPreset }> {
  return authorizedRequest<{ preset: MapPreset }>(
    `/map-drafts/${draftId}/publish`,
    {
      method: 'POST',
      body: { expectedEditVersion },
    },
  )
}

export function deleteMapDraft(draftId: string): Promise<void> {
  return authorizedRequest<void>(`/map-drafts/${draftId}`, {
    method: 'DELETE',
  })
}

function draftFormData(
  file: File,
  values: Record<string, string | number | undefined>,
): FormData {
  const body = new FormData()
  body.append('file', file)
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) body.append(key, String(value))
  })
  return body
}

function mapFormData(
  file: File,
  labelProperty: string,
  metadata: CustomMapMetadata,
): FormData {
  const body = new FormData()
  body.append('file', file)
  body.append('labelProperty', labelProperty)
  body.append('name', metadata.name)
  body.append('contentLocale', metadata.contentLocale)
  if (metadata.periodLabel) body.append('periodLabel', metadata.periodLabel)
  if (metadata.attribution) body.append('attribution', metadata.attribution)
  return body
}
