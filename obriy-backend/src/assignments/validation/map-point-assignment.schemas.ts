import { z } from 'zod';

import type { AssignmentValidationDefinition } from './assignment-validation.types';

export const MAP_POINT_SCHEMA_VERSION = 1;
export const MAP_POINT_DEFAULT_RADIUS_KM = 100;
export const MAP_POINT_MIN_RADIUS_KM = 1;
export const MAP_POINT_MAX_RADIUS_KM = 5_000;

const mapPointSchema = z
  .object({
    longitude: z.number().min(-180).max(180),
    latitude: z.number().min(-90).max(90),
  })
  .strict();

export const mapPointPublicConfigSchema = z
  .object({ initialProjection: z.enum(['MERCATOR', 'GLOBE']) })
  .strict();

export const mapPointDraftSolutionSchema = z
  .object({
    target: mapPointSchema.nullable(),
    radiusKm: z
      .number()
      .min(MAP_POINT_MIN_RADIUS_KM)
      .max(MAP_POINT_MAX_RADIUS_KM),
  })
  .strict();

export const mapPointPublishSolutionSchema = z
  .object({
    target: mapPointSchema,
    radiusKm: z
      .number()
      .min(MAP_POINT_MIN_RADIUS_KM)
      .max(MAP_POINT_MAX_RADIUS_KM),
  })
  .strict();

export const mapPointStudentResponseSchema = mapPointSchema;

export type MapPointPublicConfig = z.infer<typeof mapPointPublicConfigSchema>;
export type MapPointDraftSolution = z.infer<typeof mapPointDraftSolutionSchema>;
export type MapPointSolution = z.infer<typeof mapPointPublishSolutionSchema>;
export type MapPointStudentResponse = z.infer<
  typeof mapPointStudentResponseSchema
>;

export const mapPointAssignmentValidationDefinition: AssignmentValidationDefinition<
  MapPointPublicConfig,
  MapPointPublicConfig,
  MapPointDraftSolution,
  MapPointSolution,
  MapPointStudentResponse
> = {
  type: 'MAP_POINT',
  schemaVersion: MAP_POINT_SCHEMA_VERSION,
  draftPublicConfigSchema: mapPointPublicConfigSchema,
  publishPublicConfigSchema: mapPointPublicConfigSchema,
  draftSolutionSchema: mapPointDraftSolutionSchema,
  publishSolutionSchema: mapPointPublishSolutionSchema,
  studentResponseSchema: mapPointStudentResponseSchema,
  createDefaultDraftPublicConfig: () => ({ initialProjection: 'MERCATOR' }),
  createDefaultSolution: () => ({
    target: null,
    radiusKm: MAP_POINT_DEFAULT_RADIUS_KM,
  }),
};
