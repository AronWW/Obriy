import { AssignmentType } from '@prisma/client';
import {
  orderingPublishPublicConfigSchema,
  orderingSolutionSchema,
  orderingStudentResponseSchema,
} from '../validation';

export interface OrderingGradeResult {
  scorePoints: number;
  scorePercent: number;
  isCorrect: boolean;
  gradingData: {
    correctRelationCount: number;
    totalRelationCount: number;
    creditFraction: number;
    scoringMode: 'ALL_OR_NOTHING' | 'PARTIAL';
  };
}

export function gradeOrderingResponse(input: {
  type: AssignmentType;
  publicConfig: unknown;
  gradingConfig: unknown;
  responseData: unknown;
  maxPoints: number;
}): OrderingGradeResult {
  if (input.type !== AssignmentType.ORDERING) {
    throw new TypeError('Ordering grading received a non-ordering assignment');
  }

  const publicConfig = orderingPublishPublicConfigSchema.parse(
    input.publicConfig,
  );
  const solution = orderingSolutionSchema.parse(input.gradingConfig);
  const response = orderingStudentResponseSchema.parse(input.responseData);
  const validItemIds = new Set(publicConfig.items.map((item) => item.id));
  const expectedIds = solution.correctOrderIds.filter((id) =>
    validItemIds.has(id),
  );
  const responsePosition = new Map(
    response.orderedItemIds.map((id, index) => [id, index]),
  );

  let correctRelationCount = 0;
  for (let leftIndex = 0; leftIndex < expectedIds.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < expectedIds.length;
      rightIndex += 1
    ) {
      const leftPosition = responsePosition.get(expectedIds[leftIndex]);
      const rightPosition = responsePosition.get(expectedIds[rightIndex]);
      if (
        leftPosition !== undefined &&
        rightPosition !== undefined &&
        leftPosition < rightPosition
      ) {
        correctRelationCount += 1;
      }
    }
  }

  const totalRelationCount =
    (expectedIds.length * (expectedIds.length - 1)) / 2;
  const isCorrect =
    response.orderedItemIds.length === expectedIds.length &&
    response.orderedItemIds.every((id, index) => id === expectedIds[index]);
  const rawFraction =
    solution.scoringMode === 'PARTIAL'
      ? correctRelationCount / Math.max(totalRelationCount, 1)
      : isCorrect
        ? 1
        : 0;
  const creditFraction = Math.max(0, Math.min(1, rawFraction));

  return {
    scorePoints: roundScore(input.maxPoints * creditFraction),
    scorePercent: roundScore(creditFraction * 100),
    isCorrect,
    gradingData: {
      correctRelationCount,
      totalRelationCount,
      creditFraction,
      scoringMode: solution.scoringMode,
    },
  };
}

function roundScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
