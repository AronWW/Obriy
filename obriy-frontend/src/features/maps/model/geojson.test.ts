/// <reference types="node" />

import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mapRegionOptions, parseMapFeatureCollection } from './geojson'

describe('map GeoJSON snapshots', () => {
  it.each([
    ['world-adm0.geojson', 232, 6_000_000],
    ['ukraine-adm1.geojson', 27, 200_000],
  ])(
    'validates %s and keeps it within the size budget',
    (filename, count, maximumBytes) => {
      const path = resolve('public/maps', filename)
      const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
      const collection = parseMapFeatureCollection(value, 'featureId')

      expect(collection.features).toHaveLength(count)
      expect(statSync(path).size).toBeLessThan(maximumBytes)
      expect(
        collection.features.every((feature) =>
          ['Polygon', 'MultiPolygon'].includes(feature.geometry.type),
        ),
      ).toBe(true)
      expect(
        collection.features.every(
          (feature) =>
            typeof feature.properties?.nameEn === 'string' &&
            feature.properties.nameEn.length > 0 &&
            typeof feature.properties?.nameUk === 'string' &&
            feature.properties.nameUk.length > 0,
        ),
      ).toBe(true)
    },
  )

  it('contains India and Puerto Rico in the complete ADM0 snapshot', () => {
    const value: unknown = JSON.parse(
      readFileSync(resolve('public/maps/world-adm0.geojson'), 'utf8'),
    )
    const collection = parseMapFeatureCollection(value, 'featureId')
    const ids = new Set(
      collection.features.map((feature) => feature.properties?.featureId),
    )

    expect(ids.has('IND')).toBe(true)
    expect(ids.has('PRI')).toBe(true)
  })

  it('builds localized, sorted region options with stable IDs', () => {
    const parsed = parseMapFeatureCollection(
      collection([
        feature('PRI', 'Puerto Rico', 'Puerto Rico', 'Пуерто-Рико'),
        feature('IND', 'India', 'India', 'Індія'),
      ]),
      'featureId',
    )

    expect(mapRegionOptions(parsed, 'en', 'featureId')).toEqual([
      expect.objectContaining({ id: 'IND', name: 'India' }),
      expect.objectContaining({ id: 'PRI', name: 'Puerto Rico' }),
    ])
    expect(mapRegionOptions(parsed, 'uk', 'featureId')).toEqual([
      expect.objectContaining({ id: 'IND', name: 'Індія' }),
      expect.objectContaining({ id: 'PRI', name: 'Пуерто-Рико' }),
    ])
  })

  it('rejects duplicate IDs, unsupported geometry, and invalid coordinates', () => {
    expect(() =>
      parseMapFeatureCollection(
        collection([feature('same'), feature('same')]),
        'featureId',
      ),
    ).toThrow('MAP_GEOJSON_ID_DUPLICATE')
    expect(() =>
      parseMapFeatureCollection(
        collection([
          {
            ...feature('point'),
            geometry: { type: 'Point', coordinates: [30, 50] },
          },
        ]),
        'featureId',
      ),
    ).toThrow('MAP_GEOJSON_GEOMETRY_UNSUPPORTED')
    expect(() =>
      parseMapFeatureCollection(
        collection([
          {
            ...feature('invalid'),
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [181, 50],
                  [30, 50],
                  [30, 51],
                  [181, 50],
                ],
              ],
            },
          },
        ]),
        'featureId',
      ),
    ).toThrow('MAP_GEOJSON_COORDINATE_INVALID')
  })
})

function collection(features: unknown[]) {
  return { type: 'FeatureCollection', features }
}

function feature(
  featureId: string,
  name = featureId,
  nameEn?: string,
  nameUk?: string,
) {
  return {
    type: 'Feature',
    properties: { featureId, name, nameEn, nameUk, isoCode: featureId },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [30, 50],
          [31, 50],
          [31, 51],
          [30, 50],
        ],
      ],
    },
  }
}
