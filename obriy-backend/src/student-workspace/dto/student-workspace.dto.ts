import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestReleaseStatus, TestStudentStatus } from '@prisma/client';

export enum StudentWorkAvailability {
  SCHEDULED = 'SCHEDULED',
  AVAILABLE = 'AVAILABLE',
  CLOSED = 'CLOSED',
}

export enum StudentAttentionReason {
  NEEDS_REVISION = 'NEEDS_REVISION',
  OVERDUE = 'OVERDUE',
}

export class StudentWorkspaceClassDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  constructor(data: StudentWorkspaceClassDto) {
    Object.assign(this, data);
  }
}

export class StudentWorkspaceLessonDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ minimum: 0 })
  position: number;

  constructor(data: StudentWorkspaceLessonDto) {
    Object.assign(this, data);
  }
}

export class StudentWorkItemDto {
  @ApiProperty()
  releaseId: string;

  @ApiProperty()
  testId: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty({ type: StudentWorkspaceLessonDto })
  lesson: StudentWorkspaceLessonDto;

  @ApiProperty({ enum: TestReleaseStatus })
  releaseStatus: TestReleaseStatus;

  @ApiProperty()
  isRequired: boolean;

  @ApiProperty({ enum: StudentWorkAvailability })
  availability: StudentWorkAvailability;

  @ApiProperty({ enum: TestStudentStatus })
  stateStatus: TestStudentStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  availableFrom: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  dueAt: Date | null;

  @ApiProperty()
  maxPoints: number;

  @ApiPropertyOptional({ nullable: true })
  scorePoints: number | null;

  @ApiPropertyOptional({ nullable: true })
  scorePercent: number | null;

  @ApiPropertyOptional({ nullable: true })
  bestPoints: number | null;

  @ApiPropertyOptional({ nullable: true })
  bestPercent: number | null;

  @ApiProperty({ minimum: 0 })
  attemptCount: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  lastActivityAt: Date | null;

  @ApiPropertyOptional({ enum: StudentAttentionReason, nullable: true })
  attentionReason: StudentAttentionReason | null;

  @ApiProperty()
  isOverdue: boolean;

  @ApiProperty()
  canOpen: boolean;

  constructor(data: StudentWorkItemDto) {
    Object.assign(this, data);
  }
}

export class StudentWorkspaceMetricsDto {
  @ApiProperty({ minimum: 0 })
  requiredReleaseCount: number;

  @ApiProperty({ minimum: 0 })
  completedCount: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  completionPercent: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  averagePercent: number | null;

  @ApiProperty({ minimum: 0 })
  attentionCount: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  nextDueAt: Date | null;

  constructor(data: StudentWorkspaceMetricsDto) {
    Object.assign(this, data);
  }
}

export class StudentContinueLessonDto extends StudentWorkspaceLessonDto {
  @ApiProperty({ minimum: 0 })
  workCount: number;

  @ApiProperty({ minimum: 0 })
  requiredCount: number;

  @ApiProperty({ minimum: 0 })
  completedRequiredCount: number;

  @ApiPropertyOptional({ nullable: true })
  nextReleaseId: string | null;

  constructor(data: StudentContinueLessonDto) {
    super(data);
    Object.assign(this, data);
  }
}

export class StudentDashboardDto {
  @ApiPropertyOptional({ type: StudentWorkspaceClassDto, nullable: true })
  class: StudentWorkspaceClassDto | null;

  @ApiProperty({ type: StudentWorkspaceMetricsDto })
  metrics: StudentWorkspaceMetricsDto;

  @ApiProperty({ type: StudentWorkItemDto, isArray: true })
  attention: StudentWorkItemDto[];

  @ApiProperty({ type: StudentWorkItemDto, isArray: true })
  upcoming: StudentWorkItemDto[];

  @ApiProperty({ type: StudentContinueLessonDto, isArray: true })
  continueLessons: StudentContinueLessonDto[];

  constructor(data: StudentDashboardDto) {
    Object.assign(this, data);
  }
}

export class StudentTasksPageDto {
  @ApiPropertyOptional({ type: StudentWorkspaceClassDto, nullable: true })
  class: StudentWorkspaceClassDto | null;

  @ApiProperty({ type: StudentWorkItemDto, isArray: true })
  items: StudentWorkItemDto[];

  @ApiPropertyOptional({ nullable: true })
  nextCursor: string | null;

  constructor(data: StudentTasksPageDto) {
    Object.assign(this, data);
  }
}
