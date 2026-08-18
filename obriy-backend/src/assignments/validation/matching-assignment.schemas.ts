import { z } from 'zod';

import type {
  AssignmentValidationDefinition,
  AssignmentValidationIssue,
} from './assignment-validation.types';

export const MATCHING_SCHEMA_VERSION = 1;
export const MATCHING_MAX_ITEMS_PER_COLUMN = 50;
export const MATCHING_MAX_ITEM_TEXT_LENGTH = 5_000;

export const matchingScoringModeSchema = z.enum(['ALL_OR_NOTHING', 'PARTIAL']);

const matchingDraftItemSchema = z
  .object({
    id: z.string().uuid(),
    text: z.string().max(MATCHING_MAX_ITEM_TEXT_LENGTH),
  })
  .strict();

const matchingPublishItemSchema = matchingDraftItemSchema.refine(
  (item) => item.text.trim().length > 0,
  { path: ['text'], message: 'INVALID_CONFIGURATION' },
);

const matchingDraftItemsSchema = z
  .array(matchingDraftItemSchema)
  .max(MATCHING_MAX_ITEMS_PER_COLUMN)
  .superRefine(validateUniqueItemIds);

const matchingPublishItemsSchema = z
  .array(matchingPublishItemSchema)
  .min(2)
  .max(MATCHING_MAX_ITEMS_PER_COLUMN)
  .superRefine(validateUniqueItemIds);

export const matchingDraftPublicConfigSchema = z
  .object({
    leftItems: matchingDraftItemsSchema,
    rightItems: matchingDraftItemsSchema,
    shuffleRightItems: z.boolean(),
  })
  .partial()
  .strict()
  .superRefine(validateUniqueIdsAcrossColumns);

export const matchingPublishPublicConfigSchema = z
  .object({
    leftItems: matchingPublishItemsSchema,
    rightItems: matchingPublishItemsSchema,
    shuffleRightItems: z.boolean(),
  })
  .strict()
  .superRefine(validateUniqueIdsAcrossColumns);

const matchingPairSchema = z
  .object({
    leftItemId: z.string().uuid(),
    rightItemId: z.string().uuid(),
  })
  .strict();

const matchingPairsSchema = z
  .array(matchingPairSchema)
  .max(MATCHING_MAX_ITEMS_PER_COLUMN)
  .superRefine(validateOneToOnePairs);

export const matchingSolutionSchema = z
  .object({
    matches: matchingPairsSchema,
    scoringMode: matchingScoringModeSchema,
  })
  .strict();

export const matchingStudentResponseSchema = z
  .object({
    matches: matchingPairsSchema,
  })
  .strict();

export type MatchingDraftPublicConfig = z.infer<
  typeof matchingDraftPublicConfigSchema
>;
export type MatchingPublishPublicConfig = z.infer<
  typeof matchingPublishPublicConfigSchema
>;
export type MatchingSolution = z.infer<typeof matchingSolutionSchema>;
export type MatchingStudentResponse = z.infer<
  typeof matchingStudentResponseSchema
>;

const DEFAULT_PUBLIC_CONFIG = Object.freeze({
  leftItems: Object.freeze([]),
  rightItems: Object.freeze([]),
  shuffleRightItems: false,
});

const DEFAULT_SOLUTION = Object.freeze({
  matches: Object.freeze([]),
  scoringMode: 'PARTIAL' as const,
});

export const matchingAssignmentValidationDefinition: AssignmentValidationDefinition<
  MatchingDraftPublicConfig,
  MatchingPublishPublicConfig,
  MatchingSolution,
  MatchingSolution,
  MatchingStudentResponse
> = {
  type: 'MATCHING',
  schemaVersion: MATCHING_SCHEMA_VERSION,
  draftPublicConfigSchema: matchingDraftPublicConfigSchema,
  publishPublicConfigSchema: matchingPublishPublicConfigSchema,
  draftSolutionSchema: matchingSolutionSchema,
  publishSolutionSchema: matchingSolutionSchema,
  studentResponseSchema: matchingStudentResponseSchema,
  createDefaultDraftPublicConfig: () => ({
    ...DEFAULT_PUBLIC_CONFIG,
    leftItems: [],
    rightItems: [],
  }),
  createDefaultSolution: () => ({
    ...DEFAULT_SOLUTION,
    matches: [],
  }),
  validatePublishPayload: validateMatchingPublishPayload,
  validateStudentResponseAgainstConfig: (response, publicConfig) =>
    validateMatchingReferences(response.matches, publicConfig, 'matches'),
};

function validateMatchingPublishPayload(
  publicConfig: MatchingPublishPublicConfig,
  solution: MatchingSolution,
): AssignmentValidationIssue[] {
  const issues = validateMatchingReferences(
    solution.matches,
    publicConfig,
    'gradingConfig',
  );
  const matchedLeftIds = new Set(
    solution.matches.map((pair) => pair.leftItemId),
  );

  if (publicConfig.rightItems.length < publicConfig.leftItems.length) {
    issues.push({
      path: ['publicConfig', 'rightItems'],
      code: 'INVALID_CONFIGURATION',
      message:
        'Matching assignments require at least one right item per left item.',
    });
  }

  publicConfig.leftItems.forEach((item, index) => {
    if (!matchedLeftIds.has(item.id)) {
      issues.push({
        path: ['gradingConfig', 'matches', index],
        code: 'INVALID_CONFIGURATION',
        message: 'Every left item must have exactly one correct match.',
      });
    }
  });

  return issues;
}

function validateMatchingReferences(
  matches: { leftItemId: string; rightItemId: string }[],
  publicConfig: MatchingPublishPublicConfig,
  pathPrefix: 'gradingConfig' | 'matches',
): AssignmentValidationIssue[] {
  const leftIds = new Set(publicConfig.leftItems.map((item) => item.id));
  const rightIds = new Set(publicConfig.rightItems.map((item) => item.id));
  const issues: AssignmentValidationIssue[] = [];
  const basePath =
    pathPrefix === 'gradingConfig' ? ['gradingConfig', 'matches'] : ['matches'];

  matches.forEach((pair, index) => {
    if (!leftIds.has(pair.leftItemId)) {
      issues.push({
        path: [...basePath, index, 'leftItemId'],
        code: 'INVALID_VALUE',
        message: 'The selected left item does not exist.',
      });
    }
    if (!rightIds.has(pair.rightItemId)) {
      issues.push({
        path: [...basePath, index, 'rightItemId'],
        code: 'INVALID_VALUE',
        message: 'The selected right item does not exist.',
      });
    }
  });

  return issues;
}

function validateUniqueItemIds(
  items: { id: string }[],
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      context.addIssue({
        code: 'custom',
        path: [index, 'id'],
        message: 'DUPLICATE_ID',
      });
    }
    seen.add(item.id);
  });
}

function validateUniqueIdsAcrossColumns(
  config: {
    leftItems?: { id: string }[];
    rightItems?: { id: string }[];
  },
  context: z.RefinementCtx,
): void {
  const leftIds = new Set((config.leftItems ?? []).map((item) => item.id));
  (config.rightItems ?? []).forEach((item, index) => {
    if (leftIds.has(item.id)) {
      context.addIssue({
        code: 'custom',
        path: ['rightItems', index, 'id'],
        message: 'DUPLICATE_ID',
      });
    }
  });
}

function validateOneToOnePairs(
  pairs: { leftItemId: string; rightItemId: string }[],
  context: z.RefinementCtx,
): void {
  const leftIds = new Set<string>();
  const rightIds = new Set<string>();

  pairs.forEach((pair, index) => {
    if (leftIds.has(pair.leftItemId)) {
      context.addIssue({
        code: 'custom',
        path: [index, 'leftItemId'],
        message: 'DUPLICATE_ID',
      });
    }
    if (rightIds.has(pair.rightItemId)) {
      context.addIssue({
        code: 'custom',
        path: [index, 'rightItemId'],
        message: 'DUPLICATE_ID',
      });
    }
    leftIds.add(pair.leftItemId);
    rightIds.add(pair.rightItemId);
  });
}
