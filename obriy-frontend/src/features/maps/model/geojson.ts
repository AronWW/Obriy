import type {
  FeatureCollection,
  GeoJsonProperties,
  MultiPolygon,
  Polygon,
} from 'geojson'

export type MapFeatureCollection = FeatureCollection<
  Polygon | MultiPolygon,
  GeoJsonProperties
>

export function parseMapFeatureCollection(
  value: unknown,
  idProperty: string,
): MapFeatureCollection {
  if (!isRecord(value) || value.type !== 'FeatureCollection') {
    throw new Error('MAP_GEOJSON_INVALID')
  }
  if (!Array.isArray(value.features) || value.features.length === 0) {
    throw new Error('MAP_GEOJSON_INVALID')
  }

  const ids = new Set<string>()
  for (const candidate of value.features) {
    if (!isRecord(candidate) || candidate.type !== 'Feature') {
      throw new Error('MAP_GEOJSON_INVALID')
    }
    const geometry = candidate.geometry
    if (
      !isRecord(geometry) ||
      (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')
    ) {
      throw new Error('MAP_GEOJSON_GEOMETRY_UNSUPPORTED')
    }
    validateCoordinates(geometry.coordinates)

    const properties = candidate.properties
    if (!isRecord(properties)) throw new Error('MAP_GEOJSON_INVALID')
    const featureId = properties[idProperty]
    if (typeof featureId !== 'string' || featureId.trim().length === 0) {
      throw new Error('MAP_GEOJSON_ID_MISSING')
    }
    if (ids.has(featureId)) throw new Error('MAP_GEOJSON_ID_DUPLICATE')
    ids.add(featureId)
  }

  return value as unknown as MapFeatureCollection
}

function validateCoordinates(value: unknown): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('MAP_GEOJSON_INVALID')
  }
  if (typeof value[0] === 'number') {
    const longitude = value[0]
    const latitude = value[1]
    if (
      typeof latitude !== 'number' ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    ) {
      throw new Error('MAP_GEOJSON_COORDINATE_INVALID')
    }
    return
  }
  value.forEach(validateCoordinates)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
