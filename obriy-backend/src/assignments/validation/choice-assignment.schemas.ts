import { z } from 'zod';
import type {
  AssignmentValidationDefinition,
  AssignmentValidationIssue,
} from './assignment-validation.types';
import { assignmentPromptImageSchema } from './assignment-image.schemas';

export const CHOICE_SCHEMA_VERSION = 1;
export const CHOICE_MAX_OPTIONS = 50;
export const CHOICE_MAX_OPTION_TEXT_LENGTH = 5_000;

export const choiceScoringModeSchema = z.enum(['ALL_OR_NOTHING', 'PARTIAL']);

const choiceDraftOptionSchema = z
  .object({
    id: z.string().uuid(),
    text: z.string().max(CHOICE_MAX_OPTION_TEXT_LENGTH),
  })
  .strict();

const choicePublishOptionSchema = choiceDraftOptionSchema.refine(
  (option) => option.text.trim().length > 0,
  { path: ['text'], message: 'INVALID_CONFIGURATION' },
);

const choiceDraftOptionsSchema = z
  .array(choiceDraftOptionSchema)
  .max(CHOICE_MAX_OPTIONS)
  .superRefine(validateUniqueOptionIds);

const choicePublishOptionsSchema = z
  .array(choicePublishOptionSchema)
  .min(2)
  .max(CHOICE_MAX_OPTIONS)
  .superRefine(validateUniqueOptionIds);

export const choiceDraftPublicConfigSchema = z
  .object({
    options: choiceDraftOptionsSchema,
    shuffleOptions: z.boolean(),
    promptImage: assignmentPromptImageSchema.nullable().optional(),
  })
  .partial()
  .strict();

export const choicePublishPublicConfigSchema = z
  .object({
    options: choicePublishOptionsSchema,
    shuffleOptions: z.boolean(),
    promptImage: assignmentPromptImageSchema.nullable().optional(),
  })
  .strict();

export const choiceDraftSolutionSchema = z
  .object({
    correctOptionIds: z
      .array(z.string().uuid())
      .max(CHOICE_MAX_OPTIONS)
      .superRefine(validateUniqueIds),
    scoringMode: choiceScoringModeSchema,
  })
  .strict();

const singleChoicePublishSolutionSchema = choiceDraftSolutionSchema.refine(
  (solution) => solution.correctOptionIds.length === 1,
  { path: ['correctOptionIds'], message: 'INVALID_CONFIGURATION' },
);

const multipleChoicePublishSolutionSchema = choiceDraftSolutionSchema.refine(
  (solution) => solution.correctOptionIds.length > 0,
  { path: ['correctOptionIds'], message: 'INVALID_CONFIGURATION' },
);

export const choiceStudentResponseSchema = z
  .object({
    selectedOptionIds: z
      .array(z.string().uuid())
      .max(CHOICE_MAX_OPTIONS)
      .superRefine(validateUniqueIds),
  })
  .strict();

export type ChoiceDraftPublicConfig = z.infer<
  typeof choiceDraftPublicConfigSchema
>;
export type ChoicePublishPublicConfig = z.infer<
  typeof choicePublishPublicConfigSchema
>;
export type ChoiceSolution = z.infer<typeof choiceDraftSolutionSchema>;
export type ChoiceStudentResponse = z.infer<typeof choiceStudentResponseSchema>;

const DEFAULT_PUBLIC_CONFIG = Object.freeze({
  options: Object.freeze([]),
  shuffleOptions: false,
});

function createDefinition(
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE',
): AssignmentValidationDefinition<
  ChoiceDraftPublicConfig,
  ChoicePublishPublicConfig,
  ChoiceSolution,
  ChoiceSolution,
  ChoiceStudentResponse
> {
  const isSingle = type === 'SINGLE_CHOICE';
  return {
    type,
    schemaVersion: CHOICE_SCHEMA_VERSION,
    draftPublicConfigSchema: choiceDraftPublicConfigSchema,
    publishPublicConfigSchema: choicePublishPublicConfigSchema,
    draftSolutionSchema: choiceDraftSolutionSchema,
    publishSolutionSchema: isSingle
      ? singleChoicePublishSolutionSchema
      : multipleChoicePublishSolutionSchema,
    studentResponseSchema: choiceStudentResponseSchema,
    createDefaultDraftPublicConfig: () => ({
      ...DEFAULT_PUBLIC_CONFIG,
      options: [],
    }),
    createDefaultSolution: () => ({
      correctOptionIds: [],
      scoringMode: 'ALL_OR_NOTHING',
    }),
    validatePublishPayload: (publicConfig, solution) => {
      const optionIds = new Set(
        publicConfig.options.map((option) => option.id),
      );
      const issues: AssignmentValidationIssue[] = [];
      solution.correctOptionIds.forEach((optionId, index) => {
        if (!optionIds.has(optionId)) {
          issues.push({
            path: ['gradingConfig', 'correctOptionIds', index],
            code: 'INVALID_CONFIGURATION',
            message: 'Correct answer must reference an existing option.',
          });
        }
      });
      if (isSingle && solution.scoringMode !== 'ALL_OR_NOTHING') {
        issues.push({
          path: ['gradingConfig', 'scoringMode'],
          code: 'INVALID_CONFIGURATION',
          message: 'Single-choice assignments use all-or-nothing scoring.',
        });
      }
      if (
        !isSingle &&
        solution.correctOptionIds.length >= publicConfig.options.length
      ) {
        issues.push({
          path: ['gradingConfig', 'correctOptionIds'],
          code: 'INVALID_CONFIGURATION',
          message:
            'Multiple-choice assignments require at least one incorrect option.',
        });
      }
      return issues;
    },
    validateStudentResponseAgainstConfig: (response, publicConfig) => {
      const optionIds = new Set(
        publicConfig.options.map((option) => option.id),
      );
      const issues: AssignmentValidationIssue[] = [];
      response.selectedOptionIds.forEach((optionId, index) => {
        if (!optionIds.has(optionId)) {
          issues.push({
            path: ['selectedOptionIds', index],
            code: 'INVALID_VALUE',
            message: 'Selected answer does not exist.',
          });
        }
      });
      if (isSingle && response.selectedOptionIds.length > 1) {
        issues.push({
          path: ['selectedOptionIds'],
          code: 'INVALID_VALUE',
          message: 'Select only one answer.',
        });
      }
      return issues;
    },
  };
}

export const singleChoiceAssignmentValidationDefinition =
  createDefinition('SINGLE_CHOICE');
export const multipleChoiceAssignmentValidationDefinition =
  createDefinition('MULTIPLE_CHOICE');

function validateUniqueOptionIds(
  options: { id: string }[],
  context: z.RefinementCtx,
): void {
  validateUniqueIds(
    options.map((option) => option.id),
    context,
  );
}

function validateUniqueIds(ids: string[], context: z.RefinementCtx): void {
  const seen = new Set<string>();
  ids.forEach((id, index) => {
    if (seen.has(id)) {
      context.addIssue({
        code: 'custom',
        path: [index],
        message: 'DUPLICATE_ID',
      });
    }
    seen.add(id);
  });
}
