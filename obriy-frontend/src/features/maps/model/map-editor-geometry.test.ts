import { describe, expect, it } from 'vitest'
import {
  diagnoseMap,
  drawingSnapshot,
  provisionalPolygonVertexCount,
  toDrawingFeatures,
  toEditorCollection,
} from './map-editor-geometry'
import type { EditorFeatureCollection } from './map.types'

describe('map editor geometry', () => {
  it('splits and restores a multipolygon without changing its region ID', () => {
    const source: EditorFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { regionId: 'empire', name: 'Empire' },
          geometry: {
            type: 'MultiPolygon',
            coordinates: [square(0, 0, 1, 1), square(3, 0, 4, 1)],
          },
        },
      ],
    }
    const drawing = toDrawingFeatures(source)
    expect(drawing).toHaveLength(2)
    expect(drawing.every((feature) => /^[0-9a-f-]{36}$/i.test(String(feature.id))))
      .toBe(true)
    expect(toEditorCollection(drawing).features[0]).toMatchObject({
      properties: { regionId: 'empire', name: 'Empire' },
      geometry: { type: 'MultiPolygon' },
    })
  })

  it('reports duplicates, self-intersections and overlaps', () => {
    const drawing = toDrawingFeatures({
      type: 'FeatureCollection',
      features: [
        region('a', 'Same', square(0, 0, 2, 2)),
        region('b', 'Same', square(1, 1, 3, 3)),
        region('c', 'Bow', [
          [
            [5, 0],
            [7, 2],
            [5, 2],
            [7, 0],
            [5, 0],
          ],
        ]),
      ],
    })
    const diagnostics = diagnoseMap(drawing)
    expect(diagnostics.duplicateNames).toEqual(['same'])
    expect(diagnostics.overlapCount).toBe(1)
    expect(diagnostics.selfIntersectionCount).toBe(1)
  })

  it('keeps provisional Terra Draw geometry out of autosave snapshots', () => {
    const provisional = {
      type: 'Feature',
      id: crypto.randomUUID(),
      properties: {
        mode: 'polygon',
        currentlyDrawing: true,
        committedCoordinateCount: 3,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
    }

    expect(provisionalPolygonVertexCount([provisional])).toBe(3)
    expect(drawingSnapshot([provisional])).toEqual([])
  })
})

function region(
  regionId: string,
  name: string,
  coordinates: number[][][],
) {
  return {
    type: 'Feature' as const,
    properties: { regionId, name },
    geometry: { type: 'Polygon' as const, coordinates },
  }
}

function square(west: number, south: number, east: number, north: number) {
  return [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ]
}
