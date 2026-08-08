import { ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentStatus, AssignmentType, Locale } from '@prisma/client';
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

export class ListAssignmentsQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque value returned as nextCursor by the previous page',
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

  @ApiPropertyOptional({ enum: AssignmentStatus })
  @IsOptional()
  @IsEnum(AssignmentStatus)
  status?: AssignmentStatus;

  @ApiPropertyOptional({ enum: AssignmentType })
  @IsOptional()
  @IsEnum(AssignmentType)
  type?: AssignmentType;

  @ApiPropertyOptional({ enum: Locale })
  @IsOptional()
  @IsEnum(Locale)
  contentLocale?: Locale;
}
