import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AssignmentAttemptStatus,
  AssignmentStudentStatus,
  AssignmentType,
} from '@prisma/client';

export class StudentAssignmentAttemptDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ minimum: 1 })
  attemptNumber: number;

  @ApiProperty({ enum: AssignmentAttemptStatus })
  status: AssignmentAttemptStatus;

  @ApiProperty()
  responseText: string;

  @ApiPropertyOptional({ nullable: true })
  teacherComment: string | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  scorePoints: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  scorePercent: number | null;

  @ApiPropertyOptional({ nullable: true })
  isPassed: boolean | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  submittedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  reviewedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(data: StudentAssignmentAttemptDto) {
    Object.assign(this, data);
  }
}

export class StudentLessonAssignmentDto {
  @ApiProperty({ format: 'uuid' })
  releaseId: string;

  @ApiProperty({ format: 'uuid' })
  assignmentId: string;

  @ApiProperty({ format: 'uuid' })
  revisionId: string;

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

  @ApiProperty({ minimum: 0.01 })
  maxPoints: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  passingPercent: number;

  @ApiProperty()
  isRequired: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  dueAt: Date | null;

  @ApiProperty({ enum: AssignmentStudentStatus })
  stateStatus: AssignmentStudentStatus;

  @ApiPropertyOptional({ type: StudentAssignmentAttemptDto, nullable: true })
  attempt: StudentAssignmentAttemptDto | null;

  constructor(data: StudentLessonAssignmentDto) {
    Object.assign(this, data);
  }
}
