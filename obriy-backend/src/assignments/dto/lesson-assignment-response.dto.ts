import { ApiProperty } from '@nestjs/swagger';
import { AssignmentType, Locale } from '@prisma/client';

export class LessonAssignmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  lessonId: string;

  @ApiProperty({ format: 'uuid' })
  assignmentId: string;

  @ApiProperty({ format: 'uuid' })
  revisionId: string;

  @ApiProperty({ minimum: 1 })
  revisionVersion: number;

  @ApiProperty({ enum: AssignmentType })
  type: AssignmentType;

  @ApiProperty({ enum: Locale })
  contentLocale: Locale;

  @ApiProperty()
  title: string;

  @ApiProperty()
  prompt: string;

  @ApiProperty({ minimum: 0.01 })
  maxPoints: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  passingPercent: number;

  @ApiProperty()
  hasUpdate: boolean;

  @ApiProperty({ minimum: 0 })
  activeReleaseCount: number;

  @ApiProperty({ minimum: 0 })
  releaseCount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  linkedAt: Date;

  constructor(data: LessonAssignmentResponseDto) {
    Object.assign(this, data);
  }
}
