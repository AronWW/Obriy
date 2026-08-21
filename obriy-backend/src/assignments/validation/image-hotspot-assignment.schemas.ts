import { z } from 'zod';

import type { AssignmentValidationDefinition } from './assignment-validation.types';
import { assignmentPromptImageSchema } from './assignment-image.schemas';

export const IMAGE_HOTSPOT_SCHEMA_VERSION = 1;

const pointSchema = z
  .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
  .strict();

export const imageHotspotDraftPublicConfigSchema = z
  .object({ promptImage: assignmentPromptImageSchema.nullable() })
  .partial()
  .strict();
export const imageHotspotPublishPublicConfigSchema = z
  .object({ promptImage: assignmentPromptImageSchema })
  .strict();
export const imageHotspotSolutionSchema = z
  .object({
    target: pointSchema.extend({ radius: z.number().min(0.005).max(0.5) }),
  })
  .strict();
export const imageHotspotStudentResponseSchema = pointSchema;

type DraftConfig = z.infer<typeof imageHotspotDraftPublicConfigSchema>;
export type ImageHotspotPublicConfig = z.infer<
  typeof imageHotspotPublishPublicConfigSchema
>;
export type ImageHotspotSolution = z.infer<typeof imageHotspotSolutionSchema>;
export type ImageHotspotStudentResponse = z.infer<
  typeof imageHotspotStudentResponseSchema
>;

export const imageHotspotAssignmentValidationDefinition: AssignmentValidationDefinition<
  DraftConfig,
  ImageHotspotPublicConfig,
  ImageHotspotSolution,
  ImageHotspotSolution,
  ImageHotspotStudentResponse
> = {
  type: 'IMAGE_HOTSPOT',
  schemaVersion: IMAGE_HOTSPOT_SCHEMA_VERSION,
  draftPublicConfigSchema: imageHotspotDraftPublicConfigSchema,
  publishPublicConfigSchema: imageHotspotPublishPublicConfigSchema,
  draftSolutionSchema: imageHotspotSolutionSchema,
  publishSolutionSchema: imageHotspotSolutionSchema,
  studentResponseSchema: imageHotspotStudentResponseSchema,
  createDefaultDraftPublicConfig: () => ({ promptImage: null }),
  createDefaultSolution: () => ({ target: { x: 0.5, y: 0.5, radius: 0.08 } }),
};
