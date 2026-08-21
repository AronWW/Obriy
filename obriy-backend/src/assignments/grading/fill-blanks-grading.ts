import { AssignmentType } from '@prisma/client';
import {
  fillBlanksPublishPublicConfigSchema,
  fillBlanksSolutionSchema,
  fillBlanksStudentResponseSchema,
} from '../validation';

export function gradeFillBlanksResponse(input: {
  type: AssignmentType;
  publicConfig: unknown;
  gradingConfig: unknown;
  responseData: unknown;
  maxPoints: number;
}) {
  if (input.type !== AssignmentType.FILL_BLANKS)
    throw new TypeError('Invalid fill-blanks type');
  const config = fillBlanksPublishPublicConfigSchema.parse(input.publicConfig);
  const solution = fillBlanksSolutionSchema.parse(input.gradingConfig);
  const response = fillBlanksStudentResponseSchema.parse(input.responseData);
  const answers = new Map(
    response.answers.map((answer) => [answer.blankId, normalize(answer.text)]),
  );
  const blanks = config.segments.filter((segment) => segment.type === 'BLANK');
  const accepted = new Map(
    solution.blanks.map((blank) => [
      blank.blankId,
      new Set(blank.acceptedAnswers.map(normalize)),
    ]),
  );
  const correctCount = blanks.filter((blank) =>
    accepted.get(blank.id)?.has(answers.get(blank.id) ?? ''),
  ).length;
  const isCorrect = correctCount === blanks.length;
  const fraction =
    solution.scoringMode === 'PARTIAL'
      ? correctCount / blanks.length
      : isCorrect
        ? 1
        : 0;
  return {
    scorePoints: round(input.maxPoints * fraction),
    scorePercent: round(fraction * 100),
    isCorrect,
    gradingData: {
      correctCount,
      totalCount: blanks.length,
      creditFraction: fraction,
      scoringMode: solution.scoringMode,
    },
  };
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
