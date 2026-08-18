import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestScorePolicy } from '@prisma/client';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class TestDraftVersionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  expectedRevisionId: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedEditVersion: number;
}

export class UpdateTestDraftDto extends TestDraftVersionDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ maxLength: 50_000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  instructions?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  passingPercent?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, nullable: true })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxAttempts?: number | null;

  @ApiPropertyOptional({ minimum: 30, maximum: 86_400, nullable: true })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(86_400)
  timeLimitSeconds?: number | null;

  @ApiPropertyOptional({ enum: TestScorePolicy })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(TestScorePolicy)
  scorePolicy?: TestScorePolicy;

  @ApiPropertyOptional()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  shuffleItems?: boolean;
}
