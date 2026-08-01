import { ApiPropertyOptional } from '@nestjs/swagger';
import { LessonStatus } from '@prisma/client';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
}

export class ListLessonsQueryDto {
  @ApiPropertyOptional({ enum: LessonStatus })
  @IsOptional()
  @IsEnum(LessonStatus)
  status?: LessonStatus;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(160)
  search?: string;
}
