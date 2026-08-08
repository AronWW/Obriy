import { z } from 'zod';

import type {
  AssignmentValidationDefinition,
  AssignmentValidationIssue,
} from './assignment-validation.types';

export const WRITTEN_SCHEMA_VERSION = 1;
export const WRITTEN_ABSOLUTE_MAX_TEXT_LENGTH = 20_000;
export const WRITTEN_MAX_RUBRIC_ITEMS = 50;
export const WRITTEN_MAX_ATTACHMENTS = 20;

export const writtenResponseModeSchema = z.enum(['SHORT', 'LONG']);

const writtenLengthSchema = z
  .number()
  .int()
  .min(0)
  .max(WRITTEN_ABSOLUTE_MAX_TEXT_LENGTH);

const writtenDraftRubricItemSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().max(160),
    description: z.string().max(2_000),
    weight: z.number().positive(),
  })
  .strict();

const writtenPublishRubricItemSchema = writtenDraftRubricItemSchema.refine(
  (value) => value.title.trim().length > 0,
  { path: ['title'], message: 'INVALID_CONFIGURATION' },
);

const writtenDraftRubricSchema = z
  .array(writtenDraftRubricItemSchema)
  .max(WRITTEN_MAX_RUBRIC_ITEMS)
  .superRefine(validateUniqueRubricIds);

const writtenPublishRubricSchema = z
  .array(writtenPublishRubricItemSchema)
  .max(WRITTEN_MAX_RUBRIC_ITEMS)
  .superRefine(validateUniqueRubricIds);

const writtenSharedPublicConfigShape = {
  responseMode: writtenResponseModeSchema,
  minLength: writtenLengthSchema,
  maxLength: writtenLengthSchema,
  allowAttachments: z.boolean(),
};

export const writtenDraftPublicConfigSchema = z
  .object({
    ...writtenSharedPublicConfigShape,
    rubric: writtenDraftRubricSchema,
  })
  .partial()
  .strict()
  .superRefine(validateLengthRange);

export const writtenPublishPublicConfigSchema = z
  .object({
    ...writtenSharedPublicConfigShape,
    rubric: writtenPublishRubricSchema,
  })
  .strict()
  .superRefine(validateLengthRange);

export const writtenSolutionSchema = z
  .object({
    mode: z.literal('MANUAL'),
  })
  .strict();

export const writtenStudentResponseSchema = z
  .object({
    text: z.string().max(WRITTEN_ABSOLUTE_MAX_TEXT_LENGTH),
    attachmentIds: z
      .array(z.string().uuid())
      .max(WRITTEN_MAX_ATTACHMENTS)
      .superRefine((ids, context) => {
        addDuplicateIdIssues(ids, (index) => [index], context);
      }),
  })
  .strict();

export type WrittenDraftPublicConfig = z.infer<
  typeof writtenDraftPublicConfigSchema
>;
export type WrittenPublishPublicConfig = z.infer<
  typeof writtenPublishPublicConfigSchema
>;
export type WrittenSolution = z.infer<typeof writtenSolutionSchema>;
export type WrittenStudentResponse = z.infer<
  typeof writtenStudentResponseSchema
>;

export const WRITTEN_DEFAULT_PUBLIC_CONFIG = Object.freeze({
  responseMode: 'LONG' as const,
  minLength: 0,
  maxLength: WRITTEN_ABSOLUTE_MAX_TEXT_LENGTH,
  allowAttachments: true,
  rubric: Object.freeze([]),
});

export const WRITTEN_DEFAULT_SOLUTION = Object.freeze({
  mode: 'MANUAL' as const,
});

export const writtenAssignmentValidationDefinition: AssignmentValidationDefinition<
  WrittenDraftPublicConfig,
  WrittenPublishPublicConfig,
  WrittenSolution,
  WrittenSolution,
  WrittenStudentResponse
> = {
  type: 'WRITTEN',
  schemaVersion: WRITTEN_SCHEMA_VERSION,
  draftPublicConfigSchema: writtenDraftPublicConfigSchema,
  publishPublicConfigSchema: writtenPublishPublicConfigSchema,
  draftSolutionSchema: writtenSolutionSchema,
  publishSolutionSchema: writtenSolutionSchema,
  studentResponseSchema: writtenStudentResponseSchema,
  createDefaultDraftPublicConfig: () => ({
    ...WRITTEN_DEFAULT_PUBLIC_CONFIG,
    rubric: [],
  }),
  createDefaultSolution: () => ({ ...WRITTEN_DEFAULT_SOLUTION }),
  validateStudentResponseAgainstConfig: (response, publicConfig) => {
    const issues: AssignmentValidationIssue[] = [];

    if (response.text.length < publicConfig.minLength) {
      issues.push({
        path: ['text'],
        code: 'TEXT_TOO_SHORT',
        message: 'Text is shorter than the configured minimum.',
      });
    }

    if (response.text.length > publicConfig.maxLength) {
      issues.push({
        path: ['text'],
        code: 'TEXT_TOO_LONG',
        message: 'Text is longer than the configured maximum.',
      });
    }

    if (!publicConfig.allowAttachments && response.attachmentIds.length > 0) {
      issues.push({
        path: ['attachmentIds'],
        code: 'ATTACHMENTS_NOT_ALLOWED',
        message: 'Attachments are not allowed for this assignment.',
      });
    }

    return issues;
  },
};

function validateLengthRange(
  value: { minLength?: number; maxLength?: number },
  context: z.RefinementCtx,
): void {
  if (
    value.minLength !== undefined &&
    value.maxLength !== undefined &&
    value.minLength > value.maxLength
  ) {
    context.addIssue({
      code: 'custom',
      path: ['minLength'],
      message: 'MIN_LENGTH_EXCEEDS_MAX_LENGTH',
    });
  }
}

function addDuplicateIdIssues(
  ids: string[],
  pathForIndex: (index: number) => (string | number)[],
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();

  ids.forEach((id, index) => {
    if (seen.has(id)) {
      context.addIssue({
        code: 'custom',
        path: pathForIndex(index),
        message: 'DUPLICATE_ID',
      });
    }
    seen.add(id);
  });
}

function validateUniqueRubricIds(
  items: { id: string }[],
  context: z.RefinementCtx,
): void {
  addDuplicateIdIssues(
    items.map((item) => item.id),
    (index) => [index, 'id'],
    context,
  );
}
