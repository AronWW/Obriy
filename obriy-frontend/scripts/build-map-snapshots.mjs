import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const API_ROOT = 'https://www.geoboundaries.org/api/current/gbOpen'
const GITHUB_CONTENTS_ROOT =
  'https://api.github.com/repos/wmgeolab/geoBoundaries/contents/releaseData/gbOpen'
const OUTPUT_DIRECTORY = resolve('public/maps')
const EXPECTED_WORLD_FEATURE_COUNT = 232
const REQUIRED_WORLD_FEATURE_IDS = ['IND', 'PRI']

async function main() {
  const [aggregatedWorldMetadata, ukraineMetadata] = await Promise.all([
    fetchJson(`${API_ROOT}/ALL/ADM0/`),
    fetchJson(`${API_ROOT}/UKR/ADM1/`),
  ])
  if (!Array.isArray(aggregatedWorldMetadata) || !isRecord(ukraineMetadata)) {
    throw new Error('geoBoundaries returned unexpected metadata')
  }
  const worldMetadata = await completeWorldMetadata(aggregatedWorldMetadata)

  const worldCollections = await concurrentMap(
    worldMetadata,
    8,
    async (entry) => {
      if (!isRecord(entry)) throw new Error('Invalid world boundary metadata')
      const collection = await fetchGeoJson(
        requiredString(entry, 'simplifiedGeometryGeoJSON'),
      )
      const iso = requiredString(entry, 'boundaryISO')
      if (entry.composeAdm0 === true) {
        return [
          normalizeComposedAdm0(
            collection.features,
            iso,
            stringValue(entry.boundaryName) || iso,
          ),
        ]
      }
      return collection.features.map((feature) =>
        normalizeFeature(feature, iso, {
          preferFallbackId: true,
          tolerance: 0.03,
        }),
      )
    },
  )
  const ukraineCollection = await fetchGeoJson(
    requiredString(ukraineMetadata, 'simplifiedGeometryGeoJSON'),
  )

  const world = featureCollection(worldCollections.flat())
  validateWorldCollection(world)
  const ukraine = featureCollection(
    ukraineCollection.features.map((feature) => {
      const properties = record(feature.properties)
      return normalizeFeature(feature, requiredString(properties, 'shapeID'), {
        preferFallbackId: false,
        tolerance: 0.01,
      })
    }),
  )

  await mkdir(OUTPUT_DIRECTORY, { recursive: true })
  await Promise.all([
    writeJson('world-adm0.geojson', world),
    writeJson('ukraine-adm1.geojson', ukraine),
    writeFile(
      resolve(OUTPUT_DIRECTORY, 'ATTRIBUTION.md'),
      attribution(worldMetadata, ukraineMetadata),
      'utf8',
    ),
  ])

  process.stdout.write(
    `Map snapshots ready: ${world.features.length} countries, ${ukraine.features.length} Ukrainian regions\n`,
  )
}

async function completeWorldMetadata(aggregatedMetadata) {
  const firstEntry = record(aggregatedMetadata[0])
  const releaseRef = releaseRefFromUrl(
    requiredString(firstEntry, 'simplifiedGeometryGeoJSON'),
  )
  const catalog = await fetchJson(
    `${GITHUB_CONTENTS_ROOT}?ref=${encodeURIComponent(releaseRef)}`,
  )
  if (!Array.isArray(catalog)) {
    throw new Error('geoBoundaries release catalog returned an invalid value')
  }

  const releaseIsos = catalog
    .filter(isRecord)
    .filter((entry) => entry.type === 'dir')
    .map((entry) => stringValue(entry.name))
    .filter((name) => /^[A-Z]{3}$/.test(name))
    .sort()
  const metadataByIso = new Map(
    aggregatedMetadata.map((entry) => {
      const metadata = record(entry)
      return [requiredString(metadata, 'boundaryISO'), metadata]
    }),
  )
  const missingIsos = releaseIsos.filter((iso) => !metadataByIso.has(iso))
  const supplements = await concurrentMap(missingIsos, 4, (iso) =>
    fetchMissingTerritoryMetadata(iso, releaseRef),
  )
  for (const metadata of supplements) {
    metadataByIso.set(requiredString(metadata, 'boundaryISO'), metadata)
  }

  const complete = releaseIsos.map((iso) => {
    const metadata = metadataByIso.get(iso)
    if (!metadata) throw new Error(`Missing ADM0 metadata for ${iso}`)
    return metadata
  })
  if (complete.length !== EXPECTED_WORLD_FEATURE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_WORLD_FEATURE_COUNT} ADM0 territories in release ${releaseRef}, received ${complete.length}`,
    )
  }
  return complete
}

async function fetchMissingTerritoryMetadata(iso, releaseRef) {
  try {
    const metadata = await fetchJson(`${API_ROOT}/${iso}/ADM0/`)
    if (!isRecord(metadata) || metadata.boundaryISO !== iso) {
      throw new Error(`Invalid ADM0 metadata for missing territory ${iso}`)
    }
    return metadata
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('(404)')) {
      throw error
    }
  }

  const territoryDirectory = await fetchJson(
    `${GITHUB_CONTENTS_ROOT}/${iso}?ref=${encodeURIComponent(releaseRef)}`,
  )
  if (!Array.isArray(territoryDirectory)) {
    throw new Error(`Invalid release directory for missing territory ${iso}`)
  }
  const fallbackBoundaryType = territoryDirectory
    .filter(isRecord)
    .filter((entry) => entry.type === 'dir')
    .map((entry) => stringValue(entry.name))
    .filter((name) => /^ADM[1-9]$/.test(name))
    .sort()[0]
  if (!fallbackBoundaryType) {
    throw new Error(`No boundary geometry found for ${iso}`)
  }
  const metadata = await fetchJson(
    `${API_ROOT}/${iso}/${fallbackBoundaryType}/`,
  )
  if (!isRecord(metadata)) {
    throw new Error(`Invalid ${fallbackBoundaryType} metadata for ${iso}`)
  }
  return {
    ...metadata,
    boundaryISO: iso,
    composeAdm0: true,
    compositionSource: fallbackBoundaryType,
  }
}

function releaseRefFromUrl(url) {
  const match = url.match(
    /github\.com\/wmgeolab\/geoBoundaries\/raw\/([^/]+)\/releaseData\//,
  )
  if (!match)
    throw new Error('Cannot determine geoBoundaries release reference')
  return match[1]
}

function validateWorldCollection(collection) {
  const ids = new Set(collection.features.map((feature) => feature.id))
  for (const requiredId of REQUIRED_WORLD_FEATURE_IDS) {
    if (!ids.has(requiredId)) {
      throw new Error(
        `World snapshot is missing required territory ${requiredId}`,
      )
    }
  }
  if (collection.features.length !== EXPECTED_WORLD_FEATURE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_WORLD_FEATURE_COUNT} world features, received ${collection.features.length}`,
    )
  }
}

async function fetchGeoJson(url) {
  const value = await fetchJson(url)
  if (
    !isRecord(value) ||
    value.type !== 'FeatureCollection' ||
    !Array.isArray(value.features)
  ) {
    throw new Error(`Invalid GeoJSON FeatureCollection from ${url}`)
  }
  return value
}

async function fetchJson(url) {
  let response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Obriy-map-snapshot-builder' },
  })
  if (!response.ok)
    throw new Error(`Request failed (${response.status}): ${url}`)
  let text = await response.text()

  if (text.startsWith('version https://git-lfs.github.com/spec/v1')) {
    const mediaUrl = url
      .replace(
        'https://github.com/',
        'https://media.githubusercontent.com/media/',
      )
      .replace('/raw/', '/')
    response = await fetch(mediaUrl)
    if (!response.ok) {
      throw new Error(
        `Git LFS request failed (${response.status}): ${mediaUrl}`,
      )
    }
    text = await response.text()
  }

  return JSON.parse(text)
}

function normalizeFeature(value, fallbackId, options) {
  const feature = record(value)
  if (feature.type !== 'Feature') throw new Error('Expected a GeoJSON feature')
  const geometry = record(feature.geometry)
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
    throw new Error(`Unsupported geometry: ${String(geometry.type)}`)
  }
  validateCoordinates(geometry.coordinates)

  const properties = record(feature.properties)
  const featureId = options.preferFallbackId
    ? fallbackId
    : stringValue(properties.shapeID) || fallbackId
  const name =
    stringValue(properties.shapeName) ||
    stringValue(properties.shapeISO) ||
    featureId

  return {
    type: 'Feature',
    id: featureId,
    properties: {
      featureId,
      name,
      isoCode: stringValue(properties.shapeISO) || fallbackId,
    },
    geometry: {
      type: geometry.type,
      coordinates: simplifyGeometry(
        geometry.type,
        geometry.coordinates,
        options.tolerance,
      ),
    },
  }
}

function normalizeComposedAdm0(features, iso, name) {
  const polygons = []
  for (const value of features) {
    const feature = record(value)
    const geometry = record(feature.geometry)
    validateCoordinates(geometry.coordinates)
    if (geometry.type === 'Polygon') {
      polygons.push(geometry.coordinates)
    } else if (geometry.type === 'MultiPolygon') {
      polygons.push(...geometry.coordinates)
    } else {
      throw new Error(`Unsupported geometry: ${String(geometry.type)}`)
    }
  }
  return normalizeFeature(
    {
      type: 'Feature',
      properties: { shapeName: name, shapeISO: iso },
      geometry: { type: 'MultiPolygon', coordinates: polygons },
    },
    iso,
    { preferFallbackId: true, tolerance: 0.03 },
  )
}

function simplifyGeometry(type, coordinates, tolerance) {
  if (type === 'Polygon') {
    return coordinates.map((ring) => simplifyRing(ring, tolerance))
  }
  return coordinates.map((polygon) =>
    polygon.map((ring) => simplifyRing(ring, tolerance)),
  )
}

function simplifyRing(value, tolerance) {
  if (!Array.isArray(value) || value.length < 4) {
    throw new Error('A polygon ring must contain at least four positions')
  }
  const points = value.map((position) => {
    validateCoordinates(position)
    return [round(position[0]), round(position[1])]
  })
  const open = samePosition(points[0], points.at(-1))
    ? points.slice(0, -1)
    : points
  if (open.length < 3) return closeRing(open)

  const simplified = simplifyLine(open, tolerance)
  return closeRing(simplified.length >= 3 ? simplified : open.slice(0, 3))
}

function simplifyLine(points, tolerance) {
  if (points.length <= 2) return points
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  const squareTolerance = tolerance * tolerance

  while (stack.length) {
    const [first, last] = stack.pop()
    let furthestIndex = -1
    let furthestDistance = squareTolerance
    for (let index = first + 1; index < last; index += 1) {
      const distance = segmentDistanceSquared(
        points[index],
        points[first],
        points[last],
      )
      if (distance > furthestDistance) {
        furthestDistance = distance
        furthestIndex = index
      }
    }
    if (furthestIndex !== -1) {
      keep[furthestIndex] = 1
      stack.push([first, furthestIndex], [furthestIndex, last])
    }
  }

  return points.filter((_, index) => keep[index] === 1)
}

function segmentDistanceSquared(point, start, end) {
  let x = start[0]
  let y = start[1]
  let dx = end[0] - x
  let dy = end[1] - y

  if (dx !== 0 || dy !== 0) {
    const ratio =
      ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy)
    if (ratio > 1) {
      x = end[0]
      y = end[1]
    } else if (ratio > 0) {
      x += dx * ratio
      y += dy * ratio
    }
  }
  dx = point[0] - x
  dy = point[1] - y
  return dx * dx + dy * dy
}

function closeRing(points) {
  const result = [...points]
  if (!samePosition(result[0], result.at(-1))) result.push([...result[0]])
  return result
}

function samePosition(left, right) {
  return Boolean(left && right && left[0] === right[0] && left[1] === right[1])
}

function round(value) {
  return Math.round(value * 100_000) / 100_000
}

function featureCollection(features) {
  const ids = new Set()
  for (const feature of features) {
    if (ids.has(feature.id))
      throw new Error(`Duplicate featureId: ${feature.id}`)
    ids.add(feature.id)
  }
  return {
    type: 'FeatureCollection',
    features: [...features].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  }
}

function validateCoordinates(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Geometry coordinates must not be empty')
  }
  if (typeof value[0] === 'number') {
    if (
      value.length < 2 ||
      !Number.isFinite(value[0]) ||
      !Number.isFinite(value[1]) ||
      value[0] < -180 ||
      value[0] > 180 ||
      value[1] < -90 ||
      value[1] > 90
    ) {
      throw new Error('GeoJSON coordinate is outside WGS84 bounds')
    }
    return
  }
  for (const child of value) validateCoordinates(child)
}

async function writeJson(filename, value) {
  await writeFile(
    resolve(OUTPUT_DIRECTORY, filename),
    JSON.stringify(value),
    'utf8',
  )
}

function attribution(worldMetadata, ukraineMetadata) {
  const licenses = new Set(
    worldMetadata
      .filter(isRecord)
      .map((entry) => stringValue(entry.boundaryLicense))
      .filter(Boolean),
  )
  const composedTerritories = worldMetadata
    .filter((entry) => isRecord(entry) && entry.composeAdm0 === true)
    .map(
      (entry) =>
        `${requiredString(entry, 'boundaryISO')} from ${requiredString(entry, 'compositionSource')}`,
    )
  return `# Map snapshot attribution

Generated from the geoBoundaries gbOpen API on ${new Date().toISOString()}.

- \`world-adm0.geojson\`: geoBoundaries gbOpen ADM0. Source licenses represented in this snapshot: ${[...licenses].sort().join(', ')}.
- Territories without ADM0 geometry in the release were composed from their lowest available official boundary layer: ${composedTerritories.join(', ') || 'none'}.
- \`ukraine-adm1.geojson\`: geoBoundaries UKR ADM1, represented year ${requiredString(ukraineMetadata, 'boundaryYearRepresented')}, Open Data Commons Open Database License 1.0; source OpenStreetMap/Wambacher.
- Geometry was sourced from the simplified GeoJSON downloads and normalized by Obriy. Feature properties were reduced to \`featureId\`, \`name\`, and \`isoCode\`.

Source: https://www.geoboundaries.org/
License details: https://www.geoboundaries.org/api.html
OpenStreetMap attribution: https://www.openstreetmap.org/copyright
`
}

async function concurrentMap(values, concurrency, mapper) {
  const results = new Array(values.length)
  let nextIndex = 0
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(values[index], index)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return results
}

function record(value) {
  if (!isRecord(value)) throw new Error('Expected an object')
  return value
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function requiredString(object, key) {
  const value = stringValue(object[key])
  if (!value) throw new Error(`Expected ${key}`)
  return value
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
