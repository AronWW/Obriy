import type { MapPreset } from './map.types'

interface PreviewResult {
  preset: MapPreset
  url: string
  duplicateNames: string[]
}

export async function createCustomMapPreview(
  file: File,
  labelProperty: string,
): Promise<PreviewResult> {
  const value = JSON.parse(await file.text()) as unknown
  if (!isRecord(value) || value.type !== 'FeatureCollection' || !Array.isArray(value.features)) {
    throw new Error('INVALID_GEOJSON')
  }
  const sourceIds = value.features.map((candidate) =>
    isRecord(candidate) ? candidate.id : undefined,
  )
  const reuseIds = sourceIds.every(
    (id, index) =>
      (typeof id === 'string' || typeof id === 'number') &&
      String(id).trim() !== '' &&
      sourceIds.findIndex((candidate) => String(candidate) === String(id)) ===
        index,
  )
  const names = new Map<string, number>()
  let west = 180
  let south = 90
  let east = -180
  let north = -90
  const features = value.features.map((candidate, index) => {
    if (!isRecord(candidate) || !isRecord(candidate.properties)) {
      throw new Error('INVALID_GEOJSON')
    }
    const label = candidate.properties[labelProperty]
    if (
      (typeof label !== 'string' && typeof label !== 'number') ||
      String(label).trim() === ''
    ) {
      throw new Error('INVALID_LABEL_PROPERTY')
    }
    const name = String(label).trim()
    names.set(name, (names.get(name) ?? 0) + 1)
    visitCoordinates(candidate.geometry, (longitude, latitude) => {
      west = Math.min(west, longitude)
      east = Math.max(east, longitude)
      south = Math.min(south, latitude)
      north = Math.max(north, latitude)
    })
    return {
      ...candidate,
      id: undefined,
      properties: {
        regionId: reuseIds ? String(sourceIds[index]) : `region-${index + 1}`,
        name,
      },
    }
  })
  if (west >= east || south >= north) throw new Error('INVALID_BOUNDS')
  const normalized = { type: 'FeatureCollection', features }
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(normalized)], { type: 'application/geo+json' }),
  )
  const span = Math.max(east - west, (north - south) * 1.7, 0.01)
  return {
    url,
    duplicateNames: [...names.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => name),
    preset: {
      id: 'custom-map-preview',
      key: 'custom-map-preview',
      name: file.name,
      contentLocale: 'UK',
      sourceType: 'CUSTOM_GEOJSON',
      status: 'ACTIVE',
      baseMapMode: 'NEUTRAL',
      geojsonUrl: url,
      idProperty: 'regionId',
      year: null,
      periodLabel: null,
      attribution: '',
      bounds: { west, south, east, north },
      defaultViewport: {
        longitude: (west + east) / 2,
        latitude: (south + north) / 2,
        zoom: Math.max(0, Math.min(12, Math.log2(360 / span) - 0.35)),
      },
      originalFileName: file.name,
      fileSizeBytes: file.size,
      featureCount: features.length,
      vertexCount: null,
      geometryLocked: false,
    },
  }
}

function visitCoordinates(
  geometry: unknown,
  visit: (longitude: number, latitude: number) => void,
): void {
  if (!isRecord(geometry) || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
    throw new Error('UNSUPPORTED_GEOMETRY')
  }
  const walk = (value: unknown): void => {
    if (!Array.isArray(value) || value.length === 0) throw new Error('INVALID_GEOMETRY')
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
        throw new Error('INVALID_COORDINATES')
      }
      visit(longitude, latitude)
      return
    }
    value.forEach(walk)
  }
  walk(geometry.coordinates)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
