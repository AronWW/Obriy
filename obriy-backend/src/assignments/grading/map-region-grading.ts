import { AssignmentType } from '@prisma/client';
import {
  mapRegionPublicConfigSchema,
  mapRegionPublishSolutionSchema,
  mapRegionStudentResponseSchema,
} from '../validation';

export function gradeMapRegionResponse(input: {
  type: AssignmentType;
  publicConfig: unknown;
  gradingConfig: unknown;
  responseData: unknown;
  maxPoints: number;
}) {
  if (input.type !== AssignmentType.MAP_REGION) {
    throw new TypeError('Invalid map-region type');
  }
  mapRegionPublicConfigSchema.parse(input.publicConfig);
  const solution = mapRegionPublishSolutionSchema.parse(input.gradingConfig);
  const response = mapRegionStudentResponseSchema.parse(input.responseData);
  const matches = response.regionId === solution.correctRegionId;

  return {
    scorePoints: matches ? input.maxPoints : 0,
    scorePercent: matches ? 100 : 0,
    isCorrect: matches,
    gradingData: { matches },
  };
}
