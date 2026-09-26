import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Locale,
  TestAttemptStatus,
  TestReleaseStatus,
  TestStudentStatus,
} from '@prisma/client';

export enum ParentAttentionReason {
  NEEDS_REVISION = 'NEEDS_REVISION',
  OVERDUE = 'OVERDUE',
  DUE_SOON = 'DUE_SOON',
}

export enum ParentWorkAvailability {
  SCHEDULED = 'SCHEDULED',
  AVAILABLE = 'AVAILABLE',
  CLOSED = 'CLOSED',
}

export class ParentClassDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  constructor(data: ParentClassDto) {
    Object.assign(this, data);
  }
}

export class ParentChildIdentityDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl: string | null;

  constructor(data: ParentChildIdentityDto) {
    Object.assign(this, data);
  }
}

export class ParentMetricsDto {
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

  constructor(data: ParentMetricsDto) {
    Object.assign(this, data);
  }
}

export class ParentChildSummaryDto extends ParentChildIdentityDto {
  @ApiPropertyOptional({ type: ParentClassDto, nullable: true })
  class: ParentClassDto | null;

  @ApiProperty({ type: ParentMetricsDto })
  metrics: ParentMetricsDto;

  constructor(data: ParentChildSummaryDto) {
    super(data);
    Object.assign(this, data);
  }
}

export class ParentDashboardDto {
  @ApiProperty({ type: ParentChildSummaryDto, isArray: true })
  children: ParentChildSummaryDto[];

  constructor(data: ParentDashboardDto) {
    Object.assign(this, data);
  }
}

export class ParentLessonRefDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ minimum: 0 })
  position: number;

  constructor(data: ParentLessonRefDto) {
    Object.assign(this, data);
  }
}

export class ParentWorkItemDto {
  @ApiProperty()
  releaseId: string;

  @ApiProperty()
  testId: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ type: ParentLessonRefDto })
  lesson: ParentLessonRefDto;

  @ApiProperty({ enum: TestReleaseStatus })
  releaseStatus: TestReleaseStatus;

  @ApiProperty()
  isRequired: boolean;

  @ApiProperty({ enum: ParentWorkAvailability })
  availability: ParentWorkAvailability;

  @ApiProperty({ enum: TestStudentStatus })
  status: TestStudentStatus;

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

  @ApiPropertyOptional({ enum: ParentAttentionReason, nullable: true })
  attentionReason: ParentAttentionReason | null;

  constructor(data: ParentWorkItemDto) {
    Object.assign(this, data);
  }
}

export class ParentChildOverviewDto {
  @ApiProperty({ type: ParentChildSummaryDto })
  child: ParentChildSummaryDto;

  @ApiProperty({ type: ParentWorkItemDto, isArray: true })
  attention: ParentWorkItemDto[];

  @ApiProperty({ type: ParentWorkItemDto, isArray: true })
  upcoming: ParentWorkItemDto[];

  @ApiProperty({ type: ParentWorkItemDto, isArray: true })
  recentActivity: ParentWorkItemDto[];

  constructor(data: ParentChildOverviewDto) {
    Object.assign(this, data);
  }
}

export class ParentAttemptDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ minimum: 1 })
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
  isLate: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  startedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  submittedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  gradedAt: Date | null;

  constructor(data: ParentAttemptDto) {
    Object.assign(this, data);
  }
}

export class ParentTestProgressDto extends ParentWorkItemDto {
  @ApiProperty({ type: ParentAttemptDto, isArray: true })
  attempts: ParentAttemptDto[];

  constructor(data: ParentTestProgressDto) {
    super(data);
    Object.assign(this, data);
  }
}

export class ParentLessonProgressDto extends ParentLessonRefDto {
  @ApiPropertyOptional({ nullable: true })
  summary: string | null;

  @ApiProperty()
  content: string;

  @ApiProperty({ enum: Locale })
  contentLocale: Locale;

  @ApiPropertyOptional({ nullable: true })
  estimatedMinutes: number | null;

  @ApiProperty({ minimum: 0 })
  requiredTestCount: number;

  @ApiProperty({ minimum: 0 })
  completedRequiredCount: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  completionPercent: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  averagePercent: number | null;

  @ApiProperty({ type: ParentTestProgressDto, isArray: true })
  tests: ParentTestProgressDto[];

  constructor(data: ParentLessonProgressDto) {
    super(data);
    Object.assign(this, data);
  }
}

export class ParentChildProgressDto {
  @ApiProperty({ type: ParentChildSummaryDto })
  child: ParentChildSummaryDto;

  @ApiProperty({ type: ParentLessonProgressDto, isArray: true })
  lessons: ParentLessonProgressDto[];

  constructor(data: ParentChildProgressDto) {
    Object.assign(this, data);
  }
}
