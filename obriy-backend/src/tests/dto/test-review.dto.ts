import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AssignmentType,
  TestAnswerStatus,
  TestAttemptStatus,
} from '@prisma/client';
import { MapPresetDto } from '../../map-presets/dto/map-preset.dto';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export enum TestAnswerReviewDecision {
  APPROVED = 'APPROVED',
  RETURNED = 'RETURNED',
}

function trimNullableString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function toNumber({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? Number(input) : input;
}

export class ReviewTestAnswerDto {
  @ApiProperty({ enum: TestAnswerReviewDecision })
  @IsEnum(TestAnswerReviewDecision)
  decision: TestAnswerReviewDecision;

  @ApiPropertyOptional({ minimum: 0, maximum: 999_999.99 })
  @ValidateIf(
    (object: ReviewTestAnswerDto, value: unknown) =>
      object.decision === TestAnswerReviewDecision.APPROVED ||
      value !== undefined,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  scorePoints?: number;

  @ApiPropertyOptional({ maxLength: 5_000, nullable: true })
  @Transform(trimNullableString)
  @ValidateIf(
    (object: ReviewTestAnswerDto) =>
      object.decision === TestAnswerReviewDecision.RETURNED ||
      (object.teacherComment !== undefined && object.teacherComment !== null),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(5_000)
  teacherComment?: string | null;
}

export class TeacherTestAnswerReviewDto {
  @ApiProperty()
  answerId: string;

  @ApiProperty()
  testItemId: string;

  @ApiProperty({ enum: AssignmentType })
  type: AssignmentType;

  @ApiProperty()
  title: string;

  @ApiProperty()
  prompt: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  responseData: Record<string, unknown>;

  @ApiProperty({ enum: TestAnswerStatus })
  status: TestAnswerStatus;

  @ApiProperty()
  maxPoints: number;

  @ApiPropertyOptional({ nullable: true })
  scorePoints: number | null;

  @ApiPropertyOptional({ nullable: true })
  scorePercent: number | null;

  @ApiPropertyOptional({ nullable: true })
  isCorrect: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  teacherComment: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  publicConfig: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  gradingConfig: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  gradingData: Record<string, unknown>;

  @ApiPropertyOptional({ type: MapPresetDto, nullable: true })
  mapPreset: MapPresetDto | null;

  @ApiPropertyOptional({
    type: () => TeacherChoiceReviewOptionDto,
    isArray: true,
    nullable: true,
  })
  choiceOptions: TeacherChoiceReviewOptionDto[] | null;

  constructor(data: TeacherTestAnswerReviewDto) {
    Object.assign(this, data);
  }
}

export class TeacherChoiceReviewOptionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  text: string;

  @ApiProperty()
  selected: boolean;

  @ApiProperty()
  correct: boolean;

  constructor(data: TeacherChoiceReviewOptionDto) {
    Object.assign(this, data);
  }
}

export class TeacherTestAttemptReviewDto {
  @ApiProperty()
  attemptId: string;

  @ApiProperty()
  releaseId: string;

  @ApiProperty()
  testId: string;

  @ApiProperty()
  testTitle: string;

  @ApiProperty()
  attemptNumber: number;

  @ApiProperty({ enum: TestAttemptStatus })
  status: TestAttemptStatus;

  @ApiProperty()
  maxPoints: number;

  @ApiPropertyOptional({ nullable: true })
  scorePoints: number | null;

  @ApiPropertyOptional({ nullable: true })
  scorePercent: number | null;

  @ApiPropertyOptional({ nullable: true })
  isPassed: boolean | null;

  @ApiProperty()
  pendingReviewCount: number;

  @ApiProperty()
  studentId: string;

  @ApiProperty()
  studentName: string;

  @ApiProperty()
  classId: string;

  @ApiProperty()
  className: string;

  @ApiProperty({ type: TeacherTestAnswerReviewDto, isArray: true })
  answers: TeacherTestAnswerReviewDto[];

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  submittedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  gradedAt: Date | null;

  constructor(data: TeacherTestAttemptReviewDto) {
    Object.assign(this, data);
  }
}

export class ListTestReviewsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class TeacherTestReviewListDto {
  @ApiProperty({ type: TeacherTestAttemptReviewDto, isArray: true })
  items: TeacherTestAttemptReviewDto[];

  @ApiPropertyOptional({ nullable: true })
  nextCursor: string | null;

  constructor(data: TeacherTestReviewListDto) {
    Object.assign(this, data);
  }
}
