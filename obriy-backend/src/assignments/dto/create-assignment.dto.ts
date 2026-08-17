import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentType, Locale } from '@prisma/client';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
}

export class CreateAssignmentDraftDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ maxLength: 50_000 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(50_000)
  prompt?: string;

  @ApiPropertyOptional({ maxLength: 50_000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  instructions?: string | null;

  @ApiPropertyOptional({ maxLength: 50_000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  explanation?: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsObject()
  publicConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsObject()
  gradingConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  mapPresetId?: string | null;
}

export class CreateAssignmentDto {
  @ApiProperty({ enum: AssignmentType })
  @IsEnum(AssignmentType)
  type: AssignmentType;

  @ApiPropertyOptional({
    enum: Locale,
    description: "Defaults to the teacher's preferred locale",
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(Locale)
  contentLocale?: Locale;

  @ApiPropertyOptional({ minimum: 0.01, maximum: 999_999.99, default: 1 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999.99)
  defaultMaxPoints?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, default: 100 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  defaultPassingPercent?: number;

  @ApiPropertyOptional({ type: CreateAssignmentDraftDto })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => CreateAssignmentDraftDto)
  draft?: CreateAssignmentDraftDto;
}
