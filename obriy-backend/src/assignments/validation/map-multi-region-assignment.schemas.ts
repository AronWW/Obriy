import { z } from 'zod';

import type {
  AssignmentValidationDefinition,
  AssignmentValidationIssue,
} from './assignment-validation.types';

export const MAP_MULTI_REGION_SCHEMA_VERSION = 1;
export const MAP_MULTI_REGION_MIN_SELECTIONS = 2;
export const MAP_MULTI_REGION_MAX_SELECTIONS = 50;
export const MAP_MULTI_REGION_ID_MAX_LENGTH = 200;

const regionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAP_MULTI_REGION_ID_MAX_LENGTH);

const regionIdsSchema = z
  .array(regionIdSchema)
  .max(MAP_MULTI_REGION_MAX_SELECTIONS)
  .superRefine(validateUniqueIds);

export const mapMultiRegionDraftPublicConfigSchema = z
  .object({
    initialProjection: z.enum(['MERCATOR', 'GLOBE']),
    requiredSelectionCount: z
      .number()
      .int()
      .min(0)
      .max(MAP_MULTI_REGION_MAX_SELECTIONS),
  })
  .strict();

export const mapMultiRegionPublishPublicConfigSchema = z
  .object({
    initialProjection: z.enum(['MERCATOR', 'GLOBE']),
    requiredSelectionCount: z
      .number()
      .int()
      .min(MAP_MULTI_REGION_MIN_SELECTIONS)
      .max(MAP_MULTI_REGION_MAX_SELECTIONS),
  })
  .strict();

export const mapMultiRegionDraftSolutionSchema = z
  .object({
    correctRegionIds: regionIdsSchema,
    scoringMode: z.enum(['ALL_OR_NOTHING', 'PARTIAL']),
  })
  .strict();

export const mapMultiRegionPublishSolutionSchema = z
  .object({
    correctRegionIds: regionIdsSchema
      .min(MAP_MULTI_REGION_MIN_SELECTIONS)
      .max(MAP_MULTI_REGION_MAX_SELECTIONS),
    scoringMode: z.enum(['ALL_OR_NOTHING', 'PARTIAL']),
  })
  .strict();

export const mapMultiRegionStudentResponseSchema = z
  .object({ selectedRegionIds: regionIdsSchema })
  .strict();

export type MapMultiRegionDraftPublicConfig = z.infer<
  typeof mapMultiRegionDraftPublicConfigSchema
>;
export type MapMultiRegionPublicConfig = z.infer<
  typeof mapMultiRegionPublishPublicConfigSchema
>;
export type MapMultiRegionSolution = z.infer<
  typeof mapMultiRegionPublishSolutionSchema
>;
export type MapMultiRegionStudentResponse = z.infer<
  typeof mapMultiRegionStudentResponseSchema
>;

export const mapMultiRegionAssignmentValidationDefinition: AssignmentValidationDefinition<
  MapMultiRegionDraftPublicConfig,
  MapMultiRegionPublicConfig,
  z.infer<typeof mapMultiRegionDraftSolutionSchema>,
  MapMultiRegionSolution,
  MapMultiRegionStudentResponse
> = {
  type: 'MAP_MULTI_REGION',
  schemaVersion: MAP_MULTI_REGION_SCHEMA_VERSION,
  draftPublicConfigSchema: mapMultiRegionDraftPublicConfigSchema,
  publishPublicConfigSchema: mapMultiRegionPublishPublicConfigSchema,
  draftSolutionSchema: mapMultiRegionDraftSolutionSchema,
  publishSolutionSchema: mapMultiRegionPublishSolutionSchema,
  studentResponseSchema: mapMultiRegionStudentResponseSchema,
  createDefaultDraftPublicConfig: () => ({
    initialProjection: 'MERCATOR',
    requiredSelectionCount: 0,
  }),
  createDefaultSolution: () => ({
    correctRegionIds: [],
    scoringMode: 'ALL_OR_NOTHING',
  }),
  validatePublishPayload: (publicConfig, solution) =>
    publicConfig.requiredSelectionCount === solution.correctRegionIds.length
      ? []
      : [
          issue(
            ['publicConfig', 'requiredSelectionCount'],
            'Selection count must match the number of correct regions.',
          ),
        ],
  validateStudentResponseAgainstConfig: (response, publicConfig) =>
    response.selectedRegionIds.length <= publicConfig.requiredSelectionCount
      ? []
      : [
          {
            path: ['selectedRegionIds'],
            code: 'TOO_BIG',
            message: 'Too many regions were selected.',
          },
        ],
};

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

function issue(
  path: Array<string | number>,
  message: string,
): AssignmentValidationIssue {
  return { path, code: 'INVALID_CONFIGURATION', message };
}
