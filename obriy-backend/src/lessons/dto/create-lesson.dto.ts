import { ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@prisma/client';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
}

export class CreateLessonDto {
  @ApiPropertyOptional({ maxLength: 160, default: '' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ maxLength: 500, default: '' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  summary?: string;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ enum: Locale })
  @IsOptional()
  @IsEnum(Locale)
  contentLocale?: Locale;

  @ApiPropertyOptional({ minimum: 1, maximum: 180, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsInt()
  @Min(1)
  @Max(180)
  estimatedMinutes?: number | null;
}
