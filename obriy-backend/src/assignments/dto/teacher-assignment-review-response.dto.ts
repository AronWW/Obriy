import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentAttemptStatus, AssignmentType } from '@prisma/client';

export class AssignmentReviewStudentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  displayName: string;

  constructor(data: AssignmentReviewStudentDto) {
    Object.assign(this, data);
  }
}

export class AssignmentReviewClassDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  constructor(data: AssignmentReviewClassDto) {
    Object.assign(this, data);
  }
}

export class TeacherAssignmentReviewDto {
  @ApiProperty({ format: 'uuid' })
  attemptId: string;

  @ApiProperty({ format: 'uuid' })
  releaseId: string;

  @ApiProperty({ format: 'uuid' })
  assignmentId: string;

  @ApiProperty({ enum: AssignmentType })
  type: AssignmentType;

  @ApiProperty()
  assignmentTitle: string;

  @ApiProperty()
  prompt: string;

  @ApiProperty()
  responseText: string;

  @ApiProperty({ minimum: 1 })
  attemptNumber: number;

  @ApiProperty({ enum: AssignmentAttemptStatus })
  status: AssignmentAttemptStatus;

  @ApiProperty({ minimum: 0.01 })
  maxPoints: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  passingPercent: number;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  scorePoints: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  scorePercent: number | null;

  @ApiPropertyOptional({ nullable: true })
  isPassed: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  teacherComment: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  submittedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  reviewedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({ type: AssignmentReviewStudentDto })
  student: AssignmentReviewStudentDto;

  @ApiProperty({ type: AssignmentReviewClassDto })
  class: AssignmentReviewClassDto;

  constructor(data: TeacherAssignmentReviewDto) {
    Object.assign(this, data);
  }
}
