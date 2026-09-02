import { describe, expect, it } from 'vitest'
import {
  clampMapRadius,
  destinationPoint,
  geodesicCircle,
  haversineDistanceKm,
} from './map-geometry'

describe('map geometry', () => {
  it('creates a closed geodesic circle at the requested distance', () => {
    const center = { longitude: 30.5234, latitude: 50.4501 }
    const circle = geodesicCircle(center, 100, 32)
    const ring = circle.features[0].geometry.coordinates[0]
    const first = { longitude: ring[0][0], latitude: ring[0][1] }

    expect(ring).toHaveLength(33)
    expect(ring[0]).toEqual(ring.at(-1))
    expect(haversineDistanceKm(center, first)).toBeCloseTo(100, 5)
  })

  it('keeps destination and distance correct across the antimeridian', () => {
    const origin = { longitude: 179.9, latitude: 0 }
    const destination = destinationPoint(origin, 100, 90)

    expect(destination.longitude).toBeLessThan(0)
    expect(haversineDistanceKm(origin, destination)).toBeCloseTo(100, 5)
  })

  it('clamps the editable radius to backend boundaries', () => {
    expect(clampMapRadius(0)).toBe(1)
    expect(clampMapRadius(120)).toBe(120)
    expect(clampMapRadius(9_000)).toBe(5_000)
  })
})
