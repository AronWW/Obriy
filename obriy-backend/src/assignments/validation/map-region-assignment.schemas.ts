import { z } from 'zod';

import type { AssignmentValidationDefinition } from './assignment-validation.types';

export const MAP_REGION_SCHEMA_VERSION = 1;
export const MAP_REGION_ID_MAX_LENGTH = 200;

const regionIdSchema = z.string().trim().min(1).max(MAP_REGION_ID_MAX_LENGTH);

export const mapRegionPublicConfigSchema = z
  .object({ initialProjection: z.enum(['MERCATOR', 'GLOBE']) })
  .strict();

export const mapRegionDraftSolutionSchema = z
  .object({ correctRegionId: regionIdSchema.nullable() })
  .strict();

export const mapRegionPublishSolutionSchema = z
  .object({ correctRegionId: regionIdSchema })
  .strict();

export const mapRegionStudentResponseSchema = z
  .object({ regionId: regionIdSchema })
  .strict();

export type MapRegionPublicConfig = z.infer<typeof mapRegionPublicConfigSchema>;
export type MapRegionDraftSolution = z.infer<
  typeof mapRegionDraftSolutionSchema
>;
export type MapRegionSolution = z.infer<typeof mapRegionPublishSolutionSchema>;
export type MapRegionStudentResponse = z.infer<
  typeof mapRegionStudentResponseSchema
>;

export const mapRegionAssignmentValidationDefinition: AssignmentValidationDefinition<
  MapRegionPublicConfig,
  MapRegionPublicConfig,
  MapRegionDraftSolution,
  MapRegionSolution,
  MapRegionStudentResponse
> = {
  type: 'MAP_REGION',
  schemaVersion: MAP_REGION_SCHEMA_VERSION,
  draftPublicConfigSchema: mapRegionPublicConfigSchema,
  publishPublicConfigSchema: mapRegionPublicConfigSchema,
  draftSolutionSchema: mapRegionDraftSolutionSchema,
  publishSolutionSchema: mapRegionPublishSolutionSchema,
  studentResponseSchema: mapRegionStudentResponseSchema,
  createDefaultDraftPublicConfig: () => ({ initialProjection: 'MERCATOR' }),
  createDefaultSolution: () => ({ correctRegionId: null }),
};
