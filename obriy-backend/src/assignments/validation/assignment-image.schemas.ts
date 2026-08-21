import { z } from 'zod';

export const assignmentPromptImageSchema = z
  .object({
    attachmentId: z.string().uuid(),
    width: z.number().int().positive().max(20_000),
    height: z.number().int().positive().max(20_000),
  })
  .strict();

export type AssignmentPromptImage = z.infer<typeof assignmentPromptImageSchema>;
