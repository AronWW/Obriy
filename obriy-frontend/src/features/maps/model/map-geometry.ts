import type { MapPoint } from './map.types'

const EARTH_MEAN_RADIUS_KM = 6_371.0088

export function haversineDistanceKm(left: MapPoint, right: MapPoint): number {
  const latitudeDelta = toRadians(right.latitude - left.latitude)
  const longitudeDelta = toRadians(
    normalizeLongitude(right.longitude - left.longitude),
  )
  const leftLatitude = toRadians(left.latitude)
  const rightLatitude = toRadians(right.latitude)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) ** 2
  const angularDistance =
    2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  return EARTH_MEAN_RADIUS_KM * angularDistance
}

export function destinationPoint(
  origin: MapPoint,
  distanceKm: number,
  bearingDegrees: number,
): MapPoint {
  const angularDistance = distanceKm / EARTH_MEAN_RADIUS_KM
  const bearing = toRadians(bearingDegrees)
  const latitude = toRadians(origin.latitude)
  const longitude = toRadians(origin.longitude)
  const destinationLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
  )
  const destinationLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) -
        Math.sin(latitude) * Math.sin(destinationLatitude),
    )
  return {
    longitude: normalizeLongitude(toDegrees(destinationLongitude)),
    latitude: toDegrees(destinationLatitude),
  }
}

export function geodesicCircle(
  center: MapPoint,
  radiusKm: number,
  steps = 128,
) {
  const coordinates = Array.from({ length: steps + 1 }, (_, index) => {
    const point = destinationPoint(center, radiusKm, (index / steps) * 360)
    return [point.longitude, point.latitude]
  })
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Polygon' as const, coordinates: [coordinates] },
      },
    ],
  }
}

export function clampMapRadius(radiusKm: number): number {
  return Math.min(5_000, Math.max(1, radiusKm))
}

function normalizeLongitude(value: number): number {
  return ((value + 540) % 360) - 180
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI
}
