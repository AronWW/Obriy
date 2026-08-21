import { z } from 'zod';

import type {
  AssignmentValidationDefinition,
  AssignmentValidationIssue,
} from './assignment-validation.types';

export const ORDERING_SCHEMA_VERSION = 1;
export const ORDERING_MAX_ITEMS = 50;
export const ORDERING_MAX_ITEM_TEXT_LENGTH = 5_000;

export const orderingScoringModeSchema = z.enum(['ALL_OR_NOTHING', 'PARTIAL']);

const orderingDraftItemSchema = z
  .object({
    id: z.string().uuid(),
    text: z.string().max(ORDERING_MAX_ITEM_TEXT_LENGTH),
  })
  .strict();

const orderingPublishItemSchema = orderingDraftItemSchema.refine(
  (item) => item.text.trim().length > 0,
  { path: ['text'], message: 'INVALID_CONFIGURATION' },
);

const orderingDraftItemsSchema = z
  .array(orderingDraftItemSchema)
  .max(ORDERING_MAX_ITEMS)
  .superRefine(validateUniqueIds);

const orderingPublishItemsSchema = z
  .array(orderingPublishItemSchema)
  .min(2)
  .max(ORDERING_MAX_ITEMS)
  .superRefine(validateUniqueIds);

export const orderingDraftPublicConfigSchema = z
  .object({ items: orderingDraftItemsSchema })
  .partial()
  .strict();

export const orderingPublishPublicConfigSchema = z
  .object({ items: orderingPublishItemsSchema })
  .strict();

const orderedIdsSchema = z
  .array(z.string().uuid())
  .max(ORDERING_MAX_ITEMS)
  .superRefine(validateUniqueIds);

export const orderingSolutionSchema = z
  .object({
    correctOrderIds: orderedIdsSchema,
    scoringMode: orderingScoringModeSchema,
  })
  .strict();

export const orderingStudentResponseSchema = z
  .object({ orderedItemIds: orderedIdsSchema })
  .strict();

export type OrderingDraftPublicConfig = z.infer<
  typeof orderingDraftPublicConfigSchema
>;
export type OrderingPublishPublicConfig = z.infer<
  typeof orderingPublishPublicConfigSchema
>;
export type OrderingSolution = z.infer<typeof orderingSolutionSchema>;
export type OrderingStudentResponse = z.infer<
  typeof orderingStudentResponseSchema
>;

export const orderingAssignmentValidationDefinition: AssignmentValidationDefinition<
  OrderingDraftPublicConfig,
  OrderingPublishPublicConfig,
  OrderingSolution,
  OrderingSolution,
  OrderingStudentResponse
> = {
  type: 'ORDERING',
  schemaVersion: ORDERING_SCHEMA_VERSION,
  draftPublicConfigSchema: orderingDraftPublicConfigSchema,
  publishPublicConfigSchema: orderingPublishPublicConfigSchema,
  draftSolutionSchema: orderingSolutionSchema,
  publishSolutionSchema: orderingSolutionSchema,
  studentResponseSchema: orderingStudentResponseSchema,
  createDefaultDraftPublicConfig: () => ({ items: [] }),
  createDefaultSolution: () => ({
    correctOrderIds: [],
    scoringMode: 'PARTIAL',
  }),
  validatePublishPayload: validateOrderingPublishPayload,
  validateStudentResponseAgainstConfig: (response, publicConfig) =>
    validateOrderingReferences(response.orderedItemIds, publicConfig, [
      'orderedItemIds',
    ]),
};

function validateOrderingPublishPayload(
  publicConfig: OrderingPublishPublicConfig,
  solution: OrderingSolution,
): AssignmentValidationIssue[] {
  const issues = validateOrderingReferences(
    solution.correctOrderIds,
    publicConfig,
    ['gradingConfig', 'correctOrderIds'],
  );

  if (solution.correctOrderIds.length !== publicConfig.items.length) {
    issues.push({
      path: ['gradingConfig', 'correctOrderIds'],
      code: 'INVALID_CONFIGURATION',
      message: 'The correct order must contain every item exactly once.',
    });
  }

  return issues;
}

function validateOrderingReferences(
  orderedIds: string[],
  publicConfig: OrderingPublishPublicConfig,
  basePath: (string | number)[],
): AssignmentValidationIssue[] {
  const itemIds = new Set(publicConfig.items.map((item) => item.id));
  const issues: AssignmentValidationIssue[] = [];

  orderedIds.forEach((itemId, index) => {
    if (!itemIds.has(itemId)) {
      issues.push({
        path: [...basePath, index],
        code: 'INVALID_VALUE',
        message: 'The selected ordering item does not exist.',
      });
    }
  });

  return issues;
}

function validateUniqueIds(
  values: Array<string | { id: string }>,
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    const id = typeof value === 'string' ? value : value.id;
    if (seen.has(id)) {
      context.addIssue({
        code: 'custom',
        path: [index, typeof value === 'string' ? undefined : 'id'].filter(
          (segment): segment is string | number => segment !== undefined,
        ),
        message: 'DUPLICATE_ID',
      });
    }
    seen.add(id);
  });
}
