import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
}

export enum StudentTasksStatusFilter {
  ALL = 'ALL',
  ATTENTION = 'ATTENTION',
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  AWAITING_REVIEW = 'AWAITING_REVIEW',
  NEEDS_REVISION = 'NEEDS_REVISION',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  SCHEDULED = 'SCHEDULED',
}

export enum StudentTasksRequiredFilter {
  ALL = 'ALL',
  REQUIRED = 'REQUIRED',
  OPTIONAL = 'OPTIONAL',
}

export class StudentTasksQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor returned by the previous page',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(/^[A-Za-z0-9_-]+$/)
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: StudentTasksStatusFilter, default: 'ALL' })
  @IsOptional()
  @IsEnum(StudentTasksStatusFilter)
  status?: StudentTasksStatusFilter;

  @ApiPropertyOptional({ enum: StudentTasksRequiredFilter, default: 'ALL' })
  @IsOptional()
  @IsEnum(StudentTasksRequiredFilter)
  required?: StudentTasksRequiredFilter;
}
