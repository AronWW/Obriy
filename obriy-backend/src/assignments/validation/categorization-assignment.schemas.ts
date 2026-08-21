import { z } from 'zod';

import type {
  AssignmentValidationDefinition,
  AssignmentValidationIssue,
} from './assignment-validation.types';
import { assignmentPromptImageSchema } from './assignment-image.schemas';

export const CATEGORIZATION_SCHEMA_VERSION = 1;
const MAX_CATEGORIES = 12;
const MAX_ITEMS = 60;
const MAX_TEXT = 5_000;

const categorySchema = z
  .object({ id: z.string().uuid(), title: z.string().max(160) })
  .strict();
const itemSchema = z
  .object({ id: z.string().uuid(), text: z.string().max(MAX_TEXT) })
  .strict();
const assignmentSchema = z
  .object({ itemId: z.string().uuid(), categoryId: z.string().uuid() })
  .strict();
const scoringModeSchema = z.enum(['ALL_OR_NOTHING', 'PARTIAL']);

const categoriesDraftSchema = z
  .array(categorySchema)
  .max(MAX_CATEGORIES)
  .superRefine(uniqueById);
const itemsDraftSchema = z
  .array(itemSchema)
  .max(MAX_ITEMS)
  .superRefine(uniqueById);

export const categorizationDraftPublicConfigSchema = z
  .object({
    categories: categoriesDraftSchema,
    items: itemsDraftSchema,
    promptImage: assignmentPromptImageSchema.nullable().optional(),
  })
  .partial()
  .strict();

export const categorizationPublishPublicConfigSchema = z
  .object({
    categories: categoriesDraftSchema
      .refine((values) => values.length >= 2)
      .refine((values) => values.every((value) => value.title.trim() !== '')),
    items: itemsDraftSchema
      .refine((values) => values.length >= 2)
      .refine((values) => values.every((value) => value.text.trim() !== '')),
    promptImage: assignmentPromptImageSchema.nullable().optional(),
  })
  .strict();

const assignmentsSchema = z
  .array(assignmentSchema)
  .max(MAX_ITEMS)
  .superRefine((values, context) =>
    uniqueStrings(
      values.map((value) => value.itemId),
      context,
    ),
  );

export const categorizationSolutionSchema = z
  .object({ assignments: assignmentsSchema, scoringMode: scoringModeSchema })
  .strict();

export const categorizationStudentResponseSchema = z
  .object({ assignments: assignmentsSchema })
  .strict();

type DraftConfig = z.infer<typeof categorizationDraftPublicConfigSchema>;
export type CategorizationPublicConfig = z.infer<
  typeof categorizationPublishPublicConfigSchema
>;
export type CategorizationSolution = z.infer<
  typeof categorizationSolutionSchema
>;
export type CategorizationStudentResponse = z.infer<
  typeof categorizationStudentResponseSchema
>;

export const categorizationAssignmentValidationDefinition: AssignmentValidationDefinition<
  DraftConfig,
  CategorizationPublicConfig,
  CategorizationSolution,
  CategorizationSolution,
  CategorizationStudentResponse
> = {
  type: 'CATEGORIZATION',
  schemaVersion: CATEGORIZATION_SCHEMA_VERSION,
  draftPublicConfigSchema: categorizationDraftPublicConfigSchema,
  publishPublicConfigSchema: categorizationPublishPublicConfigSchema,
  draftSolutionSchema: categorizationSolutionSchema,
  publishSolutionSchema: categorizationSolutionSchema,
  studentResponseSchema: categorizationStudentResponseSchema,
  createDefaultDraftPublicConfig: () => ({ categories: [], items: [] }),
  createDefaultSolution: () => ({ assignments: [], scoringMode: 'PARTIAL' }),
  validatePublishPayload: validatePublish,
  validateStudentResponseAgainstConfig: validateResponse,
};

function validatePublish(
  config: CategorizationPublicConfig,
  solution: CategorizationSolution,
): AssignmentValidationIssue[] {
  const issues = validateReferences(config, solution.assignments, [
    'gradingConfig',
    'assignments',
  ]);
  const assigned = new Set(solution.assignments.map((value) => value.itemId));
  config.items.forEach((item, index) => {
    if (!assigned.has(item.id))
      issues.push(
        issue(
          ['gradingConfig', 'assignments', index],
          'Every item requires a category.',
        ),
      );
  });
  return issues;
}

function validateResponse(
  response: CategorizationStudentResponse,
  config: CategorizationPublicConfig,
): AssignmentValidationIssue[] {
  return validateReferences(config, response.assignments, ['assignments']);
}

function validateReferences(
  config: CategorizationPublicConfig,
  assignments: Array<{ itemId: string; categoryId: string }>,
  path: (string | number)[],
): AssignmentValidationIssue[] {
  const itemIds = new Set(config.items.map((value) => value.id));
  const categoryIds = new Set(config.categories.map((value) => value.id));
  const issues: AssignmentValidationIssue[] = [];
  assignments.forEach((value, index) => {
    if (!itemIds.has(value.itemId))
      issues.push(issue([...path, index, 'itemId'], 'Item does not exist.'));
    if (!categoryIds.has(value.categoryId))
      issues.push(
        issue([...path, index, 'categoryId'], 'Category does not exist.'),
      );
  });
  return issues;
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
