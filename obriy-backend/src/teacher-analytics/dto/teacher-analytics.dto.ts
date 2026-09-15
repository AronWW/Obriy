import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TestAttemptStatus,
  TestReleaseStatus,
  TestStudentStatus,
} from '@prisma/client';

export class TeacherAnalyticsClassDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  constructor(data: TeacherAnalyticsClassDto) {
    Object.assign(this, data);
  }
}

export class TeacherAnalyticsMetricsDto {
  @ApiProperty({ minimum: 0 })
  studentCount: number;

  @ApiProperty({ minimum: 0 })
  requiredReleaseCount: number;

  @ApiProperty({ minimum: 0 })
  requiredWorkCount: number;

  @ApiProperty({ minimum: 0 })
  completedWorkCount: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  completionPercent: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  averagePercent: number | null;

  @ApiProperty({ minimum: 0 })
  awaitingReviewCount: number;

  constructor(data: TeacherAnalyticsMetricsDto) {
    Object.assign(this, data);
  }
}

export class TeacherAnalyticsStatusCountsDto {
  @ApiProperty({ minimum: 0 })
  notStarted: number;

  @ApiProperty({ minimum: 0 })
  inProgress: number;

  @ApiProperty({ minimum: 0 })
  awaitingReview: number;

  @ApiProperty({ minimum: 0 })
  needsRevision: number;

  @ApiProperty({ minimum: 0 })
  completed: number;

  @ApiProperty({ minimum: 0 })
  expired: number;

  constructor(data: TeacherAnalyticsStatusCountsDto) {
    Object.assign(this, data);
  }
}

export class TeacherAnalyticsStudentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ minimum: 0 })
  requiredCount: number;

  @ApiProperty({ minimum: 0 })
  completedCount: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  completionPercent: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  averagePercent: number | null;

  @ApiProperty({ type: TeacherAnalyticsStatusCountsDto })
  statuses: TeacherAnalyticsStatusCountsDto;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  lastActivityAt: Date | null;

  constructor(data: TeacherAnalyticsStudentDto) {
    Object.assign(this, data);
  }
}

export class TeacherAnalyticsTestDto {
  @ApiProperty()
  releaseId: string;

  @ApiProperty()
  testId: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: TestReleaseStatus })
  releaseStatus: TestReleaseStatus;

  @ApiProperty()
  isRequired: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  availableFrom: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  dueAt: Date | null;

  @ApiProperty()
  maxPoints: number;

  @ApiProperty()
  passingPercent: number;

  @ApiProperty({ minimum: 0 })
  studentCount: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  completionPercent: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  averagePercent: number | null;

  @ApiProperty({ type: TeacherAnalyticsStatusCountsDto })
  statuses: TeacherAnalyticsStatusCountsDto;

  constructor(data: TeacherAnalyticsTestDto) {
    Object.assign(this, data);
  }
}

export class TeacherAnalyticsLessonDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ minimum: 0 })
  position: number;

  @ApiProperty({ minimum: 0 })
  requiredTestCount: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  completionPercent: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  averagePercent: number | null;

  @ApiProperty({ type: TeacherAnalyticsTestDto, isArray: true })
  tests: TeacherAnalyticsTestDto[];

  constructor(data: TeacherAnalyticsLessonDto) {
    Object.assign(this, data);
  }
}

export class TeacherClassAnalyticsDto {
  @ApiProperty({ type: TeacherAnalyticsClassDto })
  class: TeacherAnalyticsClassDto;

  @ApiProperty({ type: TeacherAnalyticsMetricsDto })
  metrics: TeacherAnalyticsMetricsDto;

  @ApiProperty({ type: TeacherAnalyticsStudentDto, isArray: true })
  students: TeacherAnalyticsStudentDto[];

  @ApiProperty({ type: TeacherAnalyticsLessonDto, isArray: true })
  lessons: TeacherAnalyticsLessonDto[];

  constructor(data: TeacherClassAnalyticsDto) {
    Object.assign(this, data);
  }
}

export class TeacherStudentAttemptDto {
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

  @ApiProperty({ minimum: 0 })
  pendingReviewCount: number;

  @ApiProperty()
  isLate: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  startedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  submittedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  gradedAt: Date | null;

  constructor(data: TeacherStudentAttemptDto) {
    Object.assign(this, data);
  }
}

export class TeacherStudentTestResultDto {
  @ApiProperty()
  releaseId: string;

  @ApiProperty()
  testId: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: TestReleaseStatus })
  releaseStatus: TestReleaseStatus;

  @ApiProperty()
  isRequired: boolean;

  @ApiProperty({ enum: TestStudentStatus })
  status: TestStudentStatus;

  @ApiProperty()
  maxPoints: number;

  @ApiProperty()
  passingPercent: number;

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

  @ApiProperty()
  isLate: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  availableFrom: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  dueAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  lastActivityAt: Date | null;

  @ApiProperty({ type: TeacherStudentAttemptDto, isArray: true })
  attempts: TeacherStudentAttemptDto[];

  constructor(data: TeacherStudentTestResultDto) {
    Object.assign(this, data);
  }
}

export class TeacherStudentLessonResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ minimum: 0 })
  position: number;

  @ApiProperty({ type: TeacherStudentTestResultDto, isArray: true })
  tests: TeacherStudentTestResultDto[];

  constructor(data: TeacherStudentLessonResultDto) {
    Object.assign(this, data);
  }
}

export class TeacherStudentAnalyticsDto {
  @ApiProperty({ type: TeacherAnalyticsClassDto })
  class: TeacherAnalyticsClassDto;

  @ApiProperty({ type: TeacherAnalyticsStudentDto })
  student: TeacherAnalyticsStudentDto;

  @ApiProperty({ type: TeacherStudentLessonResultDto, isArray: true })
  lessons: TeacherStudentLessonResultDto[];

  constructor(data: TeacherStudentAnalyticsDto) {
    Object.assign(this, data);
  }
}
