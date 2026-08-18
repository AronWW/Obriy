import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AssignmentType,
  TestAnswerStatus,
  TestAttemptStatus,
  TestStudentStatus,
} from '@prisma/client';
import { IsObject } from 'class-validator';

export class SaveTestAnswerDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  responseData: Record<string, unknown>;
}

export class StudentTestAnswerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  testItemId: string;

  @ApiProperty({ enum: TestAnswerStatus })
  status: TestAnswerStatus;

  @ApiProperty({ type: 'object', additionalProperties: true })
  responseData: Record<string, unknown>;

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

  constructor(data: StudentTestAnswerDto) {
    Object.assign(this, data);
  }
}

export class StudentTestAttemptDto {
  @ApiProperty()
  id: string;

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

  @ApiProperty({ type: StudentTestAnswerDto, isArray: true })
  answers: StudentTestAnswerDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  startedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  expiresAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  submittedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  gradedAt: Date | null;

  constructor(data: StudentTestAttemptDto) {
    Object.assign(this, data);
  }
}

export class StudentTestItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  position: number;

  @ApiProperty()
  maxPoints: number;

  @ApiProperty()
  assignmentId: string;

  @ApiProperty()
  assignmentRevisionId: string;

  @ApiProperty({ enum: AssignmentType })
  type: AssignmentType;

  @ApiProperty()
  title: string;

  @ApiProperty()
  prompt: string;

  @ApiPropertyOptional({ nullable: true })
  instructions: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  publicConfig: Record<string, unknown>;

  constructor(data: StudentTestItemDto) {
    Object.assign(this, data);
  }
}

export class StudentLessonTestDto {
  @ApiProperty()
  releaseId: string;

  @ApiProperty()
  testId: string;

  @ApiProperty()
  testRevisionId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional({ nullable: true })
  instructions: string | null;

  @ApiProperty()
  maxPoints: number;

  @ApiProperty()
  passingPercent: number;

  @ApiProperty()
  isRequired: boolean;

  @ApiPropertyOptional({ nullable: true })
  maxAttempts: number | null;

  @ApiPropertyOptional({ nullable: true })
  timeLimitSeconds: number | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  dueAt: Date | null;

  @ApiProperty({ enum: TestStudentStatus })
  stateStatus: TestStudentStatus;

  @ApiProperty({ minimum: 1 })
  itemCount: number;

  @ApiProperty({ type: StudentTestItemDto, isArray: true })
  items: StudentTestItemDto[];

  @ApiPropertyOptional({ type: StudentTestAttemptDto, nullable: true })
  attempt: StudentTestAttemptDto | null;

  constructor(data: StudentLessonTestDto) {
    Object.assign(this, data);
  }
}
