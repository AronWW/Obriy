import { AssignmentType } from '@prisma/client';
import {
  mapMultiRegionPublishPublicConfigSchema,
  mapMultiRegionPublishSolutionSchema,
  mapMultiRegionStudentResponseSchema,
} from '../validation';

export interface MapMultiRegionGradeResult {
  scorePoints: number;
  scorePercent: number;
  isCorrect: boolean;
  gradingData: {
    correctSelectedCount: number;
    incorrectSelectedCount: number;
    expectedCorrectCount: number;
    creditFraction: number;
    scoringMode: 'ALL_OR_NOTHING' | 'PARTIAL';
  };
}

export function gradeMapMultiRegionResponse(input: {
  type: AssignmentType;
  publicConfig: unknown;
  gradingConfig: unknown;
  responseData: unknown;
  maxPoints: number;
}): MapMultiRegionGradeResult {
  if (input.type !== AssignmentType.MAP_MULTI_REGION) {
    throw new TypeError('Invalid map-multi-region type');
  }
  const publicConfig = mapMultiRegionPublishPublicConfigSchema.parse(
    input.publicConfig,
  );
  const solution = mapMultiRegionPublishSolutionSchema.parse(
    input.gradingConfig,
  );
  const response = mapMultiRegionStudentResponseSchema.parse(
    input.responseData,
  );
  if (
    publicConfig.requiredSelectionCount !== solution.correctRegionIds.length ||
    response.selectedRegionIds.length > publicConfig.requiredSelectionCount
  ) {
    throw new TypeError('Invalid map-multi-region configuration or response');
  }

  const correctRegionIds = new Set(solution.correctRegionIds);
  let correctSelectedCount = 0;
  let incorrectSelectedCount = 0;
  for (const regionId of response.selectedRegionIds) {
    if (correctRegionIds.has(regionId)) correctSelectedCount += 1;
    else incorrectSelectedCount += 1;
  }
  const isCorrect =
    correctSelectedCount === correctRegionIds.size &&
    incorrectSelectedCount === 0 &&
    response.selectedRegionIds.length === correctRegionIds.size;
  const rawFraction =
    solution.scoringMode === 'PARTIAL'
      ? correctSelectedCount / correctRegionIds.size
      : isCorrect
        ? 1
        : 0;
  const creditFraction = Math.max(0, Math.min(1, rawFraction));

  return {
    scorePoints: roundScore(input.maxPoints * creditFraction),
    scorePercent: roundScore(creditFraction * 100),
    isCorrect,
    gradingData: {
      correctSelectedCount,
      incorrectSelectedCount,
      expectedCorrectCount: correctRegionIds.size,
      creditFraction,
      scoringMode: solution.scoringMode,
    },
  };
}

function roundScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
