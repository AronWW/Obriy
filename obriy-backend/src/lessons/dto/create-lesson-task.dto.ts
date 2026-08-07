import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
}

export class CreateLessonTaskDto {
  @ApiProperty({ maxLength: 160 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title: string;

  @ApiProperty({ maxLength: 10_000 })
  @IsString()
  @Matches(/\S/, { message: 'prompt must contain non-whitespace text' })
  @MaxLength(10_000)
  prompt: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
