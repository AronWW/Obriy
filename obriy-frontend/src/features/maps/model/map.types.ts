export type MapProjection = 'MERCATOR' | 'GLOBE'

export interface MapPoint {
  longitude: number
  latitude: number
}

export interface MapBounds {
  west: number
  south: number
  east: number
  north: number
}

export interface MapViewport {
  longitude: number
  latitude: number
  zoom: number
}

export interface MapPreset {
  id: string
  key: string
  name: string
  contentLocale: 'UK' | 'EN'
  sourceType: 'BUILT_IN' | 'CUSTOM_GEOJSON'
  status: 'ACTIVE' | 'ARCHIVED'
  baseMapMode: 'STANDARD' | 'NEUTRAL'
  geojsonUrl: string
  idProperty: string
  year: number | null
  periodLabel: string | null
  attribution: string
  bounds: MapBounds
  defaultViewport: MapViewport
  originalFileName: string | null
  fileSizeBytes: number | null
  featureCount: number | null
  vertexCount: number | null
  geometryLocked: boolean
}

export interface CustomMapInspection {
  labelProperties: string[]
  featureCount: number
  vertexCount: number
}

export interface MapDraft {
  id: string
  sourcePresetId: string | null
  name: string
  contentLocale: 'UK' | 'EN'
  periodLabel: string | null
  attribution: string
  geojsonUrl: string | null
  originalFileName: string | null
  fileSizeBytes: number | null
  featureCount: number
  vertexCount: number
  bounds: MapBounds | null
  defaultViewport: MapViewport | null
  editVersion: number
  updatedAt: string
}

export interface MapDraftMetadata {
  name: string
  contentLocale: 'UK' | 'EN'
  periodLabel?: string
  attribution?: string
}

export interface EditorRegionFeature {
  type: 'Feature'
  id?: string | number
  properties: {
    regionId: string
    name: string
    mode?: string
    [key: string]: unknown
  }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

export interface EditorFeatureCollection {
  type: 'FeatureCollection'
  features: EditorRegionFeature[]
}

export interface CustomMapMetadata {
  name: string
  contentLocale: 'UK' | 'EN'
  periodLabel?: string
  attribution?: string
}

export interface MapInspection {
  longitude: number
  latitude: number
  featureId: string | null
  featureName: string | null
}

export interface MapRegionOption {
  id: string
  isoCode: string
  name: string
  nameEn: string
  nameUk: string
}
