import type {
  EditorFeatureCollection,
  EditorRegionFeature,
} from './map.types'

export interface DrawingPolygonFeature {
  type: 'Feature'
  id: string | number
  properties: {
    mode: 'polygon'
    regionId: string
    name: string
  }
  geometry: { type: 'Polygon'; coordinates: number[][][] }
}

export interface MapEditorDiagnostics {
  regionCount: number
  polygonCount: number
  vertexCount: number
  duplicateNames: string[]
  selfIntersectionCount: number
  overlapCount: number
  possibleGapCount: number
}

export function toDrawingFeatures(
  collection: EditorFeatureCollection,
): DrawingPolygonFeature[] {
  return collection.features.flatMap((feature, featureIndex) => {
    const regionId = feature.properties.regionId || createRegionId()
    const name = feature.properties.name || `Region ${featureIndex + 1}`
    const polygons =
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates as number[][][]]
        : (feature.geometry.coordinates as number[][][][])
    return polygons.map((coordinates) => ({
      type: 'Feature' as const,
      // Terra Draw's default store only accepts UUID feature IDs. The stable
      // domain identity remains in regionId, including across MultiPolygon parts.
      id: crypto.randomUUID(),
      properties: { mode: 'polygon' as const, regionId, name },
      geometry: { type: 'Polygon' as const, coordinates },
    }))
  })
}

export function toEditorCollection(
  features: readonly DrawingPolygonFeature[],
): EditorFeatureCollection {
  const groups = new Map<string, DrawingPolygonFeature[]>()
  features.forEach((feature) => {
    const list = groups.get(feature.properties.regionId) ?? []
    list.push(feature)
    groups.set(feature.properties.regionId, list)
  })
  return {
    type: 'FeatureCollection',
    features: [...groups.entries()].map(([regionId, parts]) => {
      const first = parts[0]!
      const geometries = parts.map((part) => part.geometry.coordinates)
      return {
        type: 'Feature',
        properties: { regionId, name: first.properties.name },
        geometry:
          geometries.length === 1
            ? { type: 'Polygon', coordinates: geometries[0]! }
            : { type: 'MultiPolygon', coordinates: geometries },
      } as EditorRegionFeature
    }),
  }
}

export function drawingSnapshot(
  value: readonly unknown[],
): DrawingPolygonFeature[] {
  return value.flatMap((candidate) => {
    if (!isRecord(candidate) || !isRecord(candidate.geometry)) return []
    if (
      candidate.geometry.type !== 'Polygon' ||
      !Array.isArray(candidate.geometry.coordinates)
    )
      return []
    const properties = isRecord(candidate.properties) ? candidate.properties : {}
    if (properties.currentlyDrawing === true) return []
    if (
      typeof properties.regionId !== 'string' ||
      !properties.regionId ||
      typeof properties.name !== 'string' ||
      !properties.name
    )
      return []
    const id =
      typeof candidate.id === 'string' || typeof candidate.id === 'number'
        ? candidate.id
        : crypto.randomUUID()
    return [
      {
        type: 'Feature',
        id,
        properties: {
          mode: 'polygon',
          regionId: properties.regionId,
          name: properties.name,
        },
        geometry: {
          type: 'Polygon',
          coordinates: candidate.geometry.coordinates as number[][][],
        },
      },
    ]
  })
}

export function provisionalPolygonVertexCount(
  value: readonly unknown[],
): number {
  const provisional = value.find((candidate) => {
    if (!isRecord(candidate) || !isRecord(candidate.properties)) return false
    return candidate.properties.currentlyDrawing === true
  })
  if (!isRecord(provisional) || !isRecord(provisional.geometry)) return 0
  if (
    provisional.geometry.type !== 'Polygon' ||
    !Array.isArray(provisional.geometry.coordinates)
  )
    return 0
  const properties = isRecord(provisional.properties)
    ? provisional.properties
    : {}
  const outerRing = provisional.geometry.coordinates[0]
  if (!Array.isArray(outerRing)) return 0
  const unique = new Set(
    outerRing
      .filter(
        (coordinate): coordinate is number[] =>
          Array.isArray(coordinate) &&
          typeof coordinate[0] === 'number' &&
          typeof coordinate[1] === 'number',
      )
      .map((coordinate) => `${coordinate[0]}:${coordinate[1]}`),
  )
  const committedCount =
    typeof properties.committedCoordinateCount === 'number' &&
    Number.isFinite(properties.committedCoordinateCount)
      ? Math.max(0, Math.trunc(properties.committedCoordinateCount))
      : 0
  return Math.max(committedCount, unique.size)
}

export function diagnoseMap(
  features: readonly DrawingPolygonFeature[],
): MapEditorDiagnostics {
  const collection = toEditorCollection(features)
  const names = new Map<string, number>()
  collection.features.forEach((feature) => {
    const normalized = feature.properties.name.trim().toLocaleLowerCase()
    names.set(normalized, (names.get(normalized) ?? 0) + 1)
  })
  const rings = features.flatMap((feature) => feature.geometry.coordinates)
  let overlapCount = 0
  let possibleGapCount = 0
  for (let left = 0; left < features.length; left += 1) {
    for (let right = left + 1; right < features.length; right += 1) {
      const first = features[left]!
      const second = features[right]!
      if (first.properties.regionId === second.properties.regionId) continue
      if (polygonsOverlap(first, second)) overlapCount += 1
      else if (polygonsHavePossibleGap(first, second)) possibleGapCount += 1
    }
  }
  return {
    regionCount: collection.features.length,
    polygonCount: features.length,
    vertexCount: rings.reduce((total, ring) => total + ring.length, 0),
    duplicateNames: [...names.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => name),
    selfIntersectionCount: rings.filter(ringSelfIntersects).length,
    overlapCount,
    possibleGapCount,
  }
}

export function createRegionId(): string {
  return `region-${crypto.randomUUID()}`
}

function polygonsOverlap(
  first: DrawingPolygonFeature,
  second: DrawingPolygonFeature,
): boolean {
  const a = first.geometry.coordinates[0] ?? []
  const b = second.geometry.coordinates[0] ?? []
  if (!boxesOverlap(bounds(a), bounds(b))) return false
  for (let left = 0; left < a.length - 1; left += 1) {
    for (let right = 0; right < b.length - 1; right += 1) {
      if (segmentsCross(a[left]!, a[left + 1]!, b[right]!, b[right + 1]!))
        return true
    }
  }
  return pointInRing(a[0], b) || pointInRing(b[0], a)
}

function polygonsHavePossibleGap(
  first: DrawingPolygonFeature,
  second: DrawingPolygonFeature,
): boolean {
  const a = first.geometry.coordinates[0] ?? []
  const b = second.geometry.coordinates[0] ?? []
  const firstBounds = bounds(a)
  const secondBounds = bounds(b)
  const expanded = {
    west: firstBounds.west - 0.02,
    east: firstBounds.east + 0.02,
    south: firstBounds.south - 0.02,
    north: firstBounds.north + 0.02,
  }
  if (!boxesOverlap(expanded, secondBounds)) return false
  const sharedVertex = a.some((point) =>
    b.some((candidate) => samePoint(point, candidate)),
  )
  if (sharedVertex) return false
  return a.some((point) =>
    b.some((candidate) => squaredDistance(point, candidate) < 0.0004),
  )
}

function ringSelfIntersects(ring: number[][]): boolean {
  const lastSegment = ring.length - 2
  for (let left = 0; left <= lastSegment; left += 1) {
    for (let right = left + 1; right <= lastSegment; right += 1) {
      if (right === left + 1 || (left === 0 && right === lastSegment)) continue
      if (segmentsIntersect(ring[left]!, ring[left + 1]!, ring[right]!, ring[right + 1]!))
        return true
    }
  }
  return false
}

function segmentsCross(a: number[], b: number[], c: number[], d: number[]) {
  const o1 = orientation(a, b, c)
  const o2 = orientation(a, b, d)
  const o3 = orientation(c, d, a)
  const o4 = orientation(c, d, b)
  return o1 * o2 < 0 && o3 * o4 < 0
}

function segmentsIntersect(a: number[], b: number[], c: number[], d: number[]) {
  if (segmentsCross(a, b, c, d)) return true
  const epsilon = 1e-12
  return (
    (Math.abs(orientation(a, b, c)) <= epsilon && onSegment(a, c, b)) ||
    (Math.abs(orientation(a, b, d)) <= epsilon && onSegment(a, d, b)) ||
    (Math.abs(orientation(c, d, a)) <= epsilon && onSegment(c, a, d)) ||
    (Math.abs(orientation(c, d, b)) <= epsilon && onSegment(c, b, d))
  )
}

function orientation(a: number[], b: number[], c: number[]) {
  return (b[1]! - a[1]!) * (c[0]! - b[0]!) -
    (b[0]! - a[0]!) * (c[1]! - b[1]!)
}

function onSegment(a: number[], b: number[], c: number[]) {
  return b[0]! >= Math.min(a[0]!, c[0]!) &&
    b[0]! <= Math.max(a[0]!, c[0]!) &&
    b[1]! >= Math.min(a[1]!, c[1]!) &&
    b[1]! <= Math.max(a[1]!, c[1]!)
}

function pointInRing(point: number[] | undefined, ring: number[][]): boolean {
  if (!point) return false
  let inside = false
  for (let left = 0, right = ring.length - 1; left < ring.length; right = left++) {
    const a = ring[left]!
    const b = ring[right]!
    if (
      a[1]! > point[1]! !== b[1]! > point[1]! &&
      point[0]! <
        ((b[0]! - a[0]!) * (point[1]! - a[1]!)) / (b[1]! - a[1]!) + a[0]!
    )
      inside = !inside
  }
  return inside
}

function bounds(points: number[][]) {
  return points.reduce(
    (value, point) => ({
      west: Math.min(value.west, point[0]!),
      east: Math.max(value.east, point[0]!),
      south: Math.min(value.south, point[1]!),
      north: Math.max(value.north, point[1]!),
    }),
    { west: 180, east: -180, south: 90, north: -90 },
  )
}

function boxesOverlap(
  first: { west: number; east: number; south: number; north: number },
  second: { west: number; east: number; south: number; north: number },
) {
  return first.west <= second.east && first.east >= second.west &&
    first.south <= second.north && first.north >= second.south
}

function samePoint(first: number[], second: number[]) {
  return first[0] === second[0] && first[1] === second[1]
}

function squaredDistance(first: number[], second: number[]) {
  return (first[0]! - second[0]!) ** 2 + (first[1]! - second[1]!) ** 2
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
