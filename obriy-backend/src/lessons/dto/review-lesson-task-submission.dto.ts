import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonTaskSubmissionStatus } from '@prisma/client';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const reviewStatuses = [
  LessonTaskSubmissionStatus.APPROVED,
  LessonTaskSubmissionStatus.RETURNED,
] as const;

function trimString({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
}

export class ReviewLessonTaskSubmissionDto {
  @ApiProperty({ enum: reviewStatuses })
  @IsIn(reviewStatuses)
  status:
    | typeof LessonTaskSubmissionStatus.APPROVED
    | typeof LessonTaskSubmissionStatus.RETURNED;

  @ApiPropertyOptional({ maxLength: 2_000, nullable: true })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2_000)
  teacherComment?: string | null;
}
