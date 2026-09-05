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
  geojsonUrl: string
  idProperty: string
  year: number | null
  attribution: string
  bounds: MapBounds
  defaultViewport: MapViewport
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
