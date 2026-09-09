import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AssignmentStatus,
  AssignmentType,
  LessonStatus,
  TestStatus,
} from '@prisma/client';

export class TeacherDashboardClassStatsDto {
  @ApiProperty({ minimum: 0 })
  total: number;

  @ApiProperty({ minimum: 0 })
  studentCount: number;

  constructor(data: TeacherDashboardClassStatsDto) {
    Object.assign(this, data);
  }
}

export class TeacherDashboardResourceStatsDto {
  @ApiProperty({ minimum: 0 })
  total: number;

  @ApiProperty({ minimum: 0 })
  drafts: number;

  constructor(data: TeacherDashboardResourceStatsDto) {
    Object.assign(this, data);
  }
}

export class TeacherDashboardStatsDto {
  @ApiProperty({ type: TeacherDashboardClassStatsDto })
  classes: TeacherDashboardClassStatsDto;

  @ApiProperty({ type: TeacherDashboardResourceStatsDto })
  lessons: TeacherDashboardResourceStatsDto;

  @ApiProperty({ type: TeacherDashboardResourceStatsDto })
  assignments: TeacherDashboardResourceStatsDto;

  @ApiProperty({ type: TeacherDashboardResourceStatsDto })
  tests: TeacherDashboardResourceStatsDto;

  @ApiProperty({ minimum: 0 })
  pendingReviews: number;

  constructor(data: TeacherDashboardStatsDto) {
    Object.assign(this, data);
  }
}

export class TeacherDashboardReviewDto {
  @ApiProperty()
  attemptId: string;

  @ApiProperty()
  lessonId: string;

  @ApiProperty()
  lessonTitle: string;

  @ApiProperty()
  testTitle: string;

  @ApiProperty()
  studentId: string;

  @ApiProperty()
  studentName: string;

  @ApiProperty()
  classId: string;

  @ApiProperty()
  className: string;

  @ApiProperty({ minimum: 1 })
  pendingReviewCount: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  submittedAt: Date | null;

  constructor(data: TeacherDashboardReviewDto) {
    Object.assign(this, data);
  }
}

export class TeacherDashboardRecentLessonDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: LessonStatus })
  status: LessonStatus;

  @ApiProperty({ minimum: 0 })
  classCount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(data: TeacherDashboardRecentLessonDto) {
    Object.assign(this, data);
  }
}

export class TeacherDashboardRecentAssignmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: AssignmentType })
  type: AssignmentType;

  @ApiProperty({ enum: AssignmentStatus })
  status: AssignmentStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(data: TeacherDashboardRecentAssignmentDto) {
    Object.assign(this, data);
  }
}

export class TeacherDashboardRecentTestDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: TestStatus })
  status: TestStatus;

  @ApiProperty({ minimum: 0 })
  itemCount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(data: TeacherDashboardRecentTestDto) {
    Object.assign(this, data);
  }
}

export class TeacherDashboardRecentDto {
  @ApiProperty({ type: TeacherDashboardRecentLessonDto, isArray: true })
  lessons: TeacherDashboardRecentLessonDto[];

  @ApiProperty({ type: TeacherDashboardRecentAssignmentDto, isArray: true })
  assignments: TeacherDashboardRecentAssignmentDto[];

  @ApiProperty({ type: TeacherDashboardRecentTestDto, isArray: true })
  tests: TeacherDashboardRecentTestDto[];

  constructor(data: TeacherDashboardRecentDto) {
    Object.assign(this, data);
  }
}

export class TeacherDashboardDto {
  @ApiProperty({ type: TeacherDashboardStatsDto })
  stats: TeacherDashboardStatsDto;

  @ApiProperty({ type: TeacherDashboardReviewDto, isArray: true })
  pendingReviews: TeacherDashboardReviewDto[];

  @ApiProperty({ type: TeacherDashboardRecentDto })
  recent: TeacherDashboardRecentDto;

  constructor(data: TeacherDashboardDto) {
    Object.assign(this, data);
  }
}
