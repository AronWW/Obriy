import { z } from 'zod';

import type {
  AssignmentValidationDefinition,
  AssignmentValidationIssue,
} from './assignment-validation.types';
import { assignmentPromptImageSchema } from './assignment-image.schemas';

export const FILL_BLANKS_SCHEMA_VERSION = 1;
const MAX_SEGMENTS = 100;
const MAX_BLANKS = 30;
const MAX_ANSWER_LENGTH = 500;

const textSegmentSchema = z
  .object({
    id: z.string().uuid(),
    type: z.literal('TEXT'),
    text: z.string().max(10_000),
  })
  .strict();
const blankSegmentSchema = z
  .object({ id: z.string().uuid(), type: z.literal('BLANK') })
  .strict();
const segmentSchema = z.discriminatedUnion('type', [
  textSegmentSchema,
  blankSegmentSchema,
]);
const wordSchema = z
  .object({ id: z.string().uuid(), text: z.string().max(MAX_ANSWER_LENGTH) })
  .strict();
const blankSolutionSchema = z
  .object({
    blankId: z.string().uuid(),
    acceptedAnswers: z.array(z.string().max(MAX_ANSWER_LENGTH)).min(1).max(20),
  })
  .strict();
const blankAnswerSchema = z
  .object({
    blankId: z.string().uuid(),
    text: z.string().max(MAX_ANSWER_LENGTH),
  })
  .strict();

const segmentsSchema = z
  .array(segmentSchema)
  .max(MAX_SEGMENTS)
  .superRefine(uniqueById);
const wordsSchema = z.array(wordSchema).max(100).superRefine(uniqueById);

export const fillBlanksDraftPublicConfigSchema = z
  .object({
    segments: segmentsSchema,
    wordBankEnabled: z.boolean(),
    wordBank: wordsSchema,
    promptImage: assignmentPromptImageSchema.nullable().optional(),
  })
  .partial()
  .strict();

export const fillBlanksPublishPublicConfigSchema = z
  .object({
    segments: segmentsSchema.refine(
      (segments) =>
        segments.filter((segment) => segment.type === 'BLANK').length >= 1 &&
        segments.filter((segment) => segment.type === 'BLANK').length <=
          MAX_BLANKS,
    ),
    wordBankEnabled: z.boolean(),
    wordBank: wordsSchema.refine((words) =>
      words.every((word) => word.text.trim() !== ''),
    ),
    promptImage: assignmentPromptImageSchema.nullable().optional(),
  })
  .strict();

const blankSolutionsSchema = z
  .array(blankSolutionSchema)
  .max(MAX_BLANKS)
  .superRefine((values, context) =>
    uniqueStrings(
      values.map((value) => value.blankId),
      context,
    ),
  );
const blankAnswersSchema = z
  .array(blankAnswerSchema)
  .max(MAX_BLANKS)
  .superRefine((values, context) =>
    uniqueStrings(
      values.map((value) => value.blankId),
      context,
    ),
  );

export const fillBlanksSolutionSchema = z
  .object({
    blanks: blankSolutionsSchema,
    scoringMode: z.enum(['ALL_OR_NOTHING', 'PARTIAL']),
  })
  .strict();
export const fillBlanksStudentResponseSchema = z
  .object({ answers: blankAnswersSchema })
  .strict();

type DraftConfig = z.infer<typeof fillBlanksDraftPublicConfigSchema>;
export type FillBlanksPublicConfig = z.infer<
  typeof fillBlanksPublishPublicConfigSchema
>;
export type FillBlanksSolution = z.infer<typeof fillBlanksSolutionSchema>;
export type FillBlanksStudentResponse = z.infer<
  typeof fillBlanksStudentResponseSchema
>;

export const fillBlanksAssignmentValidationDefinition: AssignmentValidationDefinition<
  DraftConfig,
  FillBlanksPublicConfig,
  FillBlanksSolution,
  FillBlanksSolution,
  FillBlanksStudentResponse
> = {
  type: 'FILL_BLANKS',
  schemaVersion: FILL_BLANKS_SCHEMA_VERSION,
  draftPublicConfigSchema: fillBlanksDraftPublicConfigSchema,
  publishPublicConfigSchema: fillBlanksPublishPublicConfigSchema,
  draftSolutionSchema: fillBlanksSolutionSchema,
  publishSolutionSchema: fillBlanksSolutionSchema,
  studentResponseSchema: fillBlanksStudentResponseSchema,
  createDefaultDraftPublicConfig: () => ({
    segments: [],
    wordBankEnabled: false,
    wordBank: [],
  }),
  createDefaultSolution: () => ({ blanks: [], scoringMode: 'PARTIAL' }),
  validatePublishPayload: validatePublish,
  validateStudentResponseAgainstConfig: (response, config) =>
    validateReferences(
      response.answers.map((answer) => answer.blankId),
      config,
      ['answers'],
    ),
};

function validatePublish(
  config: FillBlanksPublicConfig,
  solution: FillBlanksSolution,
): AssignmentValidationIssue[] {
  const blankIds = config.segments
    .filter((segment) => segment.type === 'BLANK')
    .map((segment) => segment.id);
  const issues = validateReferences(
    solution.blanks.map((blank) => blank.blankId),
    config,
    ['gradingConfig', 'blanks'],
  );
  const solutionById = new Map(
    solution.blanks.map((blank) => [blank.blankId, blank]),
  );
  blankIds.forEach((blankId, index) => {
    const blank = solutionById.get(blankId);
    if (
      !blank ||
      blank.acceptedAnswers.every((answer) => normalize(answer) === '')
    ) {
      issues.push(
        issue(
          ['gradingConfig', 'blanks', index],
          'Every blank requires an accepted answer.',
        ),
      );
    }
    if (
      config.wordBankEnabled &&
      blank &&
      !config.wordBank.some((word) =>
        blank.acceptedAnswers.some(
          (answer) => normalize(answer) === normalize(word.text),
        ),
      )
    ) {
      issues.push(
        issue(
          ['publicConfig', 'wordBank'],
          'The word bank must contain an answer for every blank.',
        ),
      );
    }
  });
  return issues;
}

function validateReferences(
  ids: string[],
  config: FillBlanksPublicConfig,
  path: (string | number)[],
): AssignmentValidationIssue[] {
  const blankIds = new Set(
    config.segments
      .filter((segment) => segment.type === 'BLANK')
      .map((segment) => segment.id),
  );
  return ids.flatMap((id, index) =>
    blankIds.has(id)
      ? []
      : [issue([...path, index, 'blankId'], 'Blank does not exist.')],
  );
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function uniqueById(
  values: Array<{ id: string }>,
  context: z.RefinementCtx,
): void {
  uniqueStrings(
    values.map((value) => value.id),
    context,
  );
}

function uniqueStrings(values: string[], context: z.RefinementCtx): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value))
      context.addIssue({
        code: 'custom',
        path: [index],
        message: 'DUPLICATE_ID',
      });
    seen.add(value);
  });
}

function issue(
  path: (string | number)[],
  message: string,
): AssignmentValidationIssue {
  return { path, code: 'INVALID_CONFIGURATION', message };
}
