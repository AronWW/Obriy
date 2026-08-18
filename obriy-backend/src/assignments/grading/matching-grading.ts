import { AssignmentType } from '@prisma/client';
import {
  matchingPublishPublicConfigSchema,
  matchingSolutionSchema,
  matchingStudentResponseSchema,
} from '../validation';

export interface MatchingGradeResult {
  scorePoints: number;
  scorePercent: number;
  isCorrect: boolean;
  gradingData: {
    correctMatchCount: number;
    incorrectMatchCount: number;
    expectedMatchCount: number;
    creditFraction: number;
    scoringMode: 'ALL_OR_NOTHING' | 'PARTIAL';
  };
}

export function gradeMatchingResponse(input: {
  type: AssignmentType;
  publicConfig: unknown;
  gradingConfig: unknown;
  responseData: unknown;
  maxPoints: number;
}): MatchingGradeResult {
  if (input.type !== AssignmentType.MATCHING) {
    throw new TypeError('Matching grading received a non-matching assignment');
  }

  const publicConfig = matchingPublishPublicConfigSchema.parse(
    input.publicConfig,
  );
  const solution = matchingSolutionSchema.parse(input.gradingConfig);
  const response = matchingStudentResponseSchema.parse(input.responseData);
  const validLeftIds = new Set(publicConfig.leftItems.map((item) => item.id));
  const validRightIds = new Set(publicConfig.rightItems.map((item) => item.id));
  const expectedByLeftId = new Map(
    solution.matches.map((pair) => [pair.leftItemId, pair.rightItemId]),
  );

  let correctMatchCount = 0;
  for (const pair of response.matches) {
    if (
      validLeftIds.has(pair.leftItemId) &&
      validRightIds.has(pair.rightItemId) &&
      expectedByLeftId.get(pair.leftItemId) === pair.rightItemId
    ) {
      correctMatchCount += 1;
    }
  }

  const expectedMatchCount = expectedByLeftId.size;
  const incorrectMatchCount = Math.max(
    0,
    expectedMatchCount - correctMatchCount,
  );
  const isCorrect =
    correctMatchCount === expectedMatchCount &&
    response.matches.length === expectedMatchCount;
  const rawFraction =
    solution.scoringMode === 'PARTIAL'
      ? correctMatchCount / Math.max(expectedMatchCount, 1)
      : isCorrect
        ? 1
        : 0;
  const creditFraction = Math.max(0, Math.min(1, rawFraction));

  return {
    scorePoints: roundScore(input.maxPoints * creditFraction),
    scorePercent: roundScore(creditFraction * 100),
    isCorrect,
    gradingData: {
      correctMatchCount,
      incorrectMatchCount,
      expectedMatchCount,
      creditFraction,
      scoringMode: solution.scoringMode,
    },
  };
}

function roundScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
