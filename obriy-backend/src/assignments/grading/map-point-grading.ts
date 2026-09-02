import { AssignmentType } from '@prisma/client';
import {
  mapPointPublishSolutionSchema,
  mapPointPublicConfigSchema,
  mapPointStudentResponseSchema,
} from '../validation';

const EARTH_MEAN_RADIUS_KM = 6_371.0088;

export function gradeMapPointResponse(input: {
  type: AssignmentType;
  publicConfig: unknown;
  gradingConfig: unknown;
  responseData: unknown;
  maxPoints: number;
}) {
  if (input.type !== AssignmentType.MAP_POINT) {
    throw new TypeError('Invalid map-point type');
  }
  mapPointPublicConfigSchema.parse(input.publicConfig);
  const solution = mapPointPublishSolutionSchema.parse(input.gradingConfig);
  const response = mapPointStudentResponseSchema.parse(input.responseData);
  const distanceKm = haversineDistanceKm(response, solution.target);
  const isCorrect = distanceKm <= solution.radiusKm;

  return {
    scorePoints: isCorrect ? input.maxPoints : 0,
    scorePercent: isCorrect ? 100 : 0,
    isCorrect,
    gradingData: {
      distanceKm: roundDistance(distanceKm),
      withinRadius: isCorrect,
    },
  };
}

export function haversineDistanceKm(
  left: { longitude: number; latitude: number },
  right: { longitude: number; latitude: number },
): number {
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(
    normalizeLongitudeDelta(right.longitude - left.longitude),
  );
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const angularDistance =
    2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return EARTH_MEAN_RADIUS_KM * angularDistance;
}

function normalizeLongitudeDelta(value: number): number {
  return ((value + 540) % 360) - 180;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function roundDistance(value: number): number {
  return Math.round(value * 100) / 100;
}
