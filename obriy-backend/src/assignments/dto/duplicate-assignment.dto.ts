import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AssignmentRevisionSource } from './assignment-revision-source.dto';

function trimString({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
}

export class DuplicateAssignmentDto {
  @ApiPropertyOptional({
    enum: AssignmentRevisionSource,
    description: 'Defaults to PUBLISHED with a fallback to DRAFT',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(AssignmentRevisionSource)
  source?: AssignmentRevisionSource;

  @ApiPropertyOptional({
    maxLength: 160,
    description: 'Optional title override for the new draft',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;
}
