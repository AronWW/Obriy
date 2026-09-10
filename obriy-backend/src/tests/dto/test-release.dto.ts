import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestLatePolicy, TestReleaseStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class UpdateTestReleaseSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsDateString()
  availableFrom?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsDateString()
  dueAt?: string | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, nullable: true })
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  maxAttempts?: number | null;

  @ApiPropertyOptional({ enum: TestLatePolicy })
  @IsOptional()
  @IsEnum(TestLatePolicy)
  latePolicy?: TestLatePolicy;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsInt()
  @Min(0)
  @Max(100)
  latePenaltyPercent?: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  xpReward?: number;
}

export class BulkUpdateTestReleaseSettingsDto {
  @ApiProperty({ type: String, isArray: true, format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  releaseIds: string[];

  @ApiProperty({ type: UpdateTestReleaseSettingsDto })
  @ValidateNested()
  @Type(() => UpdateTestReleaseSettingsDto)
  settings: UpdateTestReleaseSettingsDto;
}

export class TestReleaseIdsDto {
  @ApiProperty({ type: String, isArray: true, format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  releaseIds: string[];
}

export class TeacherTestReleaseClassDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  constructor(data: TeacherTestReleaseClassDto) {
    Object.assign(this, data);
  }
}

export class TeacherTestReleaseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  lessonId: string;

  @ApiProperty()
  testId: string;

  @ApiProperty()
  testRevisionId: string;

  @ApiProperty({ type: TeacherTestReleaseClassDto })
  class: TeacherTestReleaseClassDto;

  @ApiProperty({ enum: TestReleaseStatus })
  status: TestReleaseStatus;

  @ApiProperty()
  isRequired: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  availableFrom: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  dueAt: Date | null;

  @ApiPropertyOptional({ nullable: true, minimum: 1, maximum: 100 })
  maxAttempts: number | null;

  @ApiProperty({ enum: TestLatePolicy })
  latePolicy: TestLatePolicy;

  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 100 })
  latePenaltyPercent: number | null;

  @ApiProperty({ minimum: 0, maximum: 1000 })
  xpReward: number;

  @ApiProperty({ minimum: 0 })
  attemptCount: number;

  @ApiProperty({ minimum: 0 })
  inProgressCount: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  publishedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  closedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(data: TeacherTestReleaseDto) {
    Object.assign(this, data);
  }
}
