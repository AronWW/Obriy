import { AssignmentType } from '@prisma/client';
import {
  categorizationPublishPublicConfigSchema,
  categorizationSolutionSchema,
  categorizationStudentResponseSchema,
} from '../validation';

export function gradeCategorizationResponse(input: {
  type: AssignmentType;
  publicConfig: unknown;
  gradingConfig: unknown;
  responseData: unknown;
  maxPoints: number;
}) {
  if (input.type !== AssignmentType.CATEGORIZATION)
    throw new TypeError('Invalid categorization type');
  const config = categorizationPublishPublicConfigSchema.parse(
    input.publicConfig,
  );
  const solution = categorizationSolutionSchema.parse(input.gradingConfig);
  const response = categorizationStudentResponseSchema.parse(
    input.responseData,
  );
  const expected = new Map(
    solution.assignments.map((value) => [value.itemId, value.categoryId]),
  );
  const received = new Map(
    response.assignments.map((value) => [value.itemId, value.categoryId]),
  );
  const correctCount = config.items.filter(
    (item) => expected.get(item.id) === received.get(item.id),
  ).length;
  const isCorrect = correctCount === config.items.length;
  const fraction =
    solution.scoringMode === 'PARTIAL'
      ? correctCount / config.items.length
      : isCorrect
        ? 1
        : 0;
  return {
    scorePoints: round(input.maxPoints * fraction),
    scorePercent: round(fraction * 100),
    isCorrect,
    gradingData: {
      correctCount,
      totalCount: config.items.length,
      creditFraction: fraction,
      scoringMode: solution.scoringMode,
    },
  };
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
