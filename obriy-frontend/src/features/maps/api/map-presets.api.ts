import { authorizedRequest } from '../../auth/model/session.service'
import type { MapPreset } from '../model/map.types'

export function listMapPresets(): Promise<MapPreset[]> {
  return authorizedRequest<MapPreset[]>('/map-presets')
}

export function getMapPreset(presetId: string): Promise<MapPreset> {
  return authorizedRequest<MapPreset>(`/map-presets/${presetId}`)
}
