import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
}

export class UpdateAssignmentDraftDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'The draft revision last read by the client; protects against stale tabs editing a newer draft',
  })
  @IsUUID()
  expectedRevisionId: string;

  @ApiProperty({
    minimum: 1,
    description:
      'The editVersion last read by the client; stale updates return HTTP 409',
  })
  @IsInt()
  @Min(1)
  expectedEditVersion: number;

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

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Private grading configuration; never returned in preview',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsObject()
  gradingConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  mapPresetId?: string | null;

  @ApiPropertyOptional({ minimum: 0.01, maximum: 999_999.99 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999.99)
  defaultMaxPoints?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  defaultPassingPercent?: number;
}
