import { AssignmentType } from '@prisma/client';
import {
  imageHotspotPublishPublicConfigSchema,
  imageHotspotSolutionSchema,
  imageHotspotStudentResponseSchema,
} from '../validation';

export function gradeImageHotspotResponse(input: {
  type: AssignmentType;
  publicConfig: unknown;
  gradingConfig: unknown;
  responseData: unknown;
  maxPoints: number;
}) {
  if (input.type !== AssignmentType.IMAGE_HOTSPOT)
    throw new TypeError('Invalid image-hotspot type');
  const config = imageHotspotPublishPublicConfigSchema.parse(
    input.publicConfig,
  );
  const solution = imageHotspotSolutionSchema.parse(input.gradingConfig);
  const response = imageHotspotStudentResponseSchema.parse(input.responseData);
  const shorterSide = Math.min(
    config.promptImage.width,
    config.promptImage.height,
  );
  const dx =
    ((response.x - solution.target.x) * config.promptImage.width) / shorterSide;
  const dy =
    ((response.y - solution.target.y) * config.promptImage.height) /
    shorterSide;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const isCorrect = distance <= solution.target.radius;
  const fraction = isCorrect ? 1 : 0;
  return {
    scorePoints: input.maxPoints * fraction,
    scorePercent: fraction * 100,
    isCorrect,
    gradingData: {
      distance,
      radius: solution.target.radius,
      creditFraction: fraction,
    },
  };
}
