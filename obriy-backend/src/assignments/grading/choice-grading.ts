import { AssignmentType } from '@prisma/client';
import {
  choiceDraftSolutionSchema,
  choicePublishPublicConfigSchema,
  choiceStudentResponseSchema,
} from '../validation';

export interface ChoiceGradeResult {
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

export function gradeChoiceResponse(input: {
  type: AssignmentType;
  publicConfig: unknown;
  gradingConfig: unknown;
  responseData: unknown;
  maxPoints: number;
}): ChoiceGradeResult {
  if (
    input.type !== AssignmentType.SINGLE_CHOICE &&
    input.type !== AssignmentType.MULTIPLE_CHOICE
  ) {
    throw new TypeError('Choice grading received a non-choice assignment');
  }
  const publicConfig = choicePublishPublicConfigSchema.parse(
    input.publicConfig,
  );
  const solution = choiceDraftSolutionSchema.parse(input.gradingConfig);
  const response = choiceStudentResponseSchema.parse(input.responseData);
  const validOptionIds = new Set(
    publicConfig.options.map((option) => option.id),
  );
  const correctOptionIds = new Set(solution.correctOptionIds);
  const selectedOptionIds = new Set(
    response.selectedOptionIds.filter((id) => validOptionIds.has(id)),
  );

  let correctSelectedCount = 0;
  let incorrectSelectedCount = 0;
  for (const optionId of selectedOptionIds) {
    if (correctOptionIds.has(optionId)) {
      correctSelectedCount += 1;
    } else {
      incorrectSelectedCount += 1;
    }
  }
  const isCorrect =
    incorrectSelectedCount === 0 &&
    correctSelectedCount === correctOptionIds.size &&
    selectedOptionIds.size === correctOptionIds.size;
  const usesPartialCredit =
    input.type === AssignmentType.MULTIPLE_CHOICE &&
    solution.scoringMode === 'PARTIAL';
  const incorrectOptionCount = Math.max(
    validOptionIds.size - correctOptionIds.size,
    1,
  );
  const rawFraction = usesPartialCredit
    ? correctSelectedCount / Math.max(correctOptionIds.size, 1) -
      incorrectSelectedCount / incorrectOptionCount
    : isCorrect
      ? 1
      : 0;
  const creditFraction = Math.max(0, Math.min(1, rawFraction));
  const scorePoints = roundScore(input.maxPoints * creditFraction);
  const scorePercent = roundScore(creditFraction * 100);

  return {
    scorePoints,
    scorePercent,
    isCorrect,
    gradingData: {
      correctSelectedCount,
      incorrectSelectedCount,
      expectedCorrectCount: correctOptionIds.size,
      creditFraction,
      scoringMode: usesPartialCredit ? 'PARTIAL' : 'ALL_OR_NOTHING',
    },
  };
}

function roundScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
