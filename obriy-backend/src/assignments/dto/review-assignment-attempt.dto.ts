import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export enum AssignmentReviewDecision {
  APPROVED = 'APPROVED',
  RETURNED = 'RETURNED',
}

function trimNullableString({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
}

export class ReviewAssignmentAttemptDto {
  @ApiProperty({ enum: AssignmentReviewDecision })
  @IsEnum(AssignmentReviewDecision)
  decision: AssignmentReviewDecision;

  @ApiPropertyOptional({ minimum: 0, maximum: 999_999.99 })
  @ValidateIf(
    (object: ReviewAssignmentAttemptDto, value: unknown) =>
      object.decision === AssignmentReviewDecision.APPROVED ||
      value !== undefined,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  scorePoints?: number;

  @ApiPropertyOptional({ maxLength: 5_000, nullable: true })
  @Transform(trimNullableString)
  @ValidateIf(
    (object: ReviewAssignmentAttemptDto) =>
      object.decision === AssignmentReviewDecision.RETURNED ||
      (object.teacherComment !== undefined && object.teacherComment !== null),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(5_000)
  teacherComment?: string | null;
}
