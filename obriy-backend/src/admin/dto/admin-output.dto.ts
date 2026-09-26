import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdminAuditAction,
  AdminAuditTargetType,
  LessonModerationCaseStatus,
  LessonModerationStatus,
  LessonReportCategory,
  LessonStatus,
  Locale,
  UserRole,
  UserStatus,
  SuspensionAppealStatus,
} from '@prisma/client';

export class AdminDashboardDto {
  @ApiProperty() users: number;
  @ApiProperty() students: number;
  @ApiProperty() teachers: number;
  @ApiProperty() parents: number;
  @ApiProperty() pendingUsers: number;
  @ApiProperty() suspendedUsers: number;
  @ApiProperty() newUsersLast30Days: number;
  @ApiProperty() classes: number;
  @ApiProperty() publishedLessons: number;
  @ApiProperty() publishedReleases: number;
  @ApiProperty() messagesLast30Days: number;
  @ApiProperty() openModerationCases: number;
  @ApiProperty() pendingSuspensionAppeals: number;
  constructor(data: AdminDashboardDto) {
    Object.assign(this, data);
  }
}

export class AdminSuspensionAppealDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() displayName: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty({ enum: UserStatus }) userStatus: UserStatus;
  @ApiProperty({ enum: SuspensionAppealStatus }) status: SuspensionAppealStatus;
  @ApiProperty() suspensionReason: string;
  @ApiProperty({ type: String, format: 'date-time' }) suspendedAt: Date;
  @ApiProperty() message: string;
  @ApiPropertyOptional({ nullable: true }) resolutionNote: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  reviewedAt: Date | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  constructor(data: AdminSuspensionAppealDto) {
    Object.assign(this, data);
  }
}

export class AdminSuspensionAppealPageDto {
  @ApiProperty({ type: AdminSuspensionAppealDto, isArray: true })
  items: AdminSuspensionAppealDto[];
  @ApiPropertyOptional({ nullable: true }) nextCursor: string | null;
  constructor(data: AdminSuspensionAppealPageDto) {
    Object.assign(this, data);
  }
}

export class AdminUserStatsDto {
  @ApiProperty() classes: number;
  @ApiProperty() lessons: number;
  @ApiProperty() assignments: number;
  @ApiProperty() tests: number;
  @ApiProperty() children: number;
  @ApiProperty() guardians: number;
  constructor(data: AdminUserStatsDto) {
    Object.assign(this, data);
  }
}

export class AdminUserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty({ enum: UserStatus }) status: UserStatus;
  @ApiProperty() displayName: string;
  @ApiPropertyOptional({ nullable: true }) avatarUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) subjectArea: string | null;
  @ApiProperty({ enum: Locale }) preferredLocale: Locale;
  @ApiPropertyOptional({ nullable: true }) classId: string | null;
  @ApiPropertyOptional({ nullable: true }) className: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  emailVerifiedAt: Date | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt: Date;
  @ApiProperty({ type: AdminUserStatsDto }) stats: AdminUserStatsDto;
  constructor(data: AdminUserDto) {
    Object.assign(this, data);
  }
}

export class AdminUserPageDto {
  @ApiProperty({ type: AdminUserDto, isArray: true }) items: AdminUserDto[];
  @ApiPropertyOptional({ nullable: true }) nextCursor: string | null;
  constructor(data: AdminUserPageDto) {
    Object.assign(this, data);
  }
}

export class AdminClassDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() teacherId: string;
  @ApiProperty() teacherName: string;
  @ApiProperty() teacherEmail: string;
  @ApiProperty() studentCount: number;
  @ApiProperty() lessonCount: number;
  @ApiProperty() releaseCount: number;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt: Date;
  constructor(data: AdminClassDto) {
    Object.assign(this, data);
  }
}

export class AdminClassDetailDto extends AdminClassDto {
  @ApiProperty({ type: AdminUserDto, isArray: true }) students: AdminUserDto[];
  constructor(data: AdminClassDetailDto) {
    super(data);
    this.students = data.students;
  }
}

export class AdminClassPageDto {
  @ApiProperty({ type: AdminClassDto, isArray: true }) items: AdminClassDto[];
  @ApiPropertyOptional({ nullable: true }) nextCursor: string | null;
  constructor(data: AdminClassPageDto) {
    Object.assign(this, data);
  }
}

export class LessonReportDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: LessonReportCategory }) category: LessonReportCategory;
  @ApiProperty() details: string;
  @ApiProperty() reporterId: string;
  @ApiProperty() reporterName: string;
  @ApiProperty({ enum: UserRole }) reporterRole: UserRole;
  @ApiProperty() subjectStudentId: string;
  @ApiProperty() subjectStudentName: string;
  @ApiProperty() classId: string;
  @ApiProperty() className: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  constructor(data: LessonReportDto) {
    Object.assign(this, data);
  }
}

export class LessonModerationCaseDto {
  @ApiProperty() id: string;
  @ApiProperty() lessonId: string;
  @ApiProperty() lessonTitle: string;
  @ApiProperty() teacherId: string;
  @ApiProperty() teacherName: string;
  @ApiProperty({ enum: LessonModerationCaseStatus })
  status: LessonModerationCaseStatus;
  @ApiProperty({ enum: LessonModerationStatus })
  lessonModerationStatus: LessonModerationStatus;
  @ApiProperty({ enum: LessonStatus }) lessonStatus: LessonStatus;
  @ApiProperty() reportCount: number;
  @ApiProperty() editVersion: number;
  @ApiPropertyOptional({ nullable: true }) resolutionNote: string | null;
  @ApiProperty() initialSnapshot: Record<string, unknown>;
  @ApiProperty() currentSnapshot: Record<string, unknown>;
  @ApiProperty({ type: LessonReportDto, isArray: true })
  reports: LessonReportDto[];
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt: Date;
  constructor(data: LessonModerationCaseDto) {
    Object.assign(this, data);
  }
}

export class LessonModerationCasePageDto {
  @ApiProperty({ type: LessonModerationCaseDto, isArray: true })
  items: LessonModerationCaseDto[];
  @ApiPropertyOptional({ nullable: true }) nextCursor: string | null;
  constructor(data: LessonModerationCasePageDto) {
    Object.assign(this, data);
  }
}

export class LessonReportReceiptDto {
  @ApiProperty() caseId: string;
  @ApiProperty({ enum: LessonModerationCaseStatus })
  status: LessonModerationCaseStatus;
  @ApiProperty({ type: String, format: 'date-time' }) reportedAt: Date;
  constructor(data: LessonReportReceiptDto) {
    Object.assign(this, data);
  }
}

export class TeacherLessonModerationDto {
  @ApiProperty() caseId: string;
  @ApiProperty({ enum: LessonModerationStatus }) status: LessonModerationStatus;
  @ApiProperty() editVersion: number;
  @ApiPropertyOptional({ nullable: true }) resolutionNote: string | null;
  constructor(data: TeacherLessonModerationDto) {
    Object.assign(this, data);
  }
}

export class AdminAuditLogDto {
  @ApiProperty() id: string;
  @ApiProperty() actorId: string;
  @ApiProperty() actorName: string;
  @ApiProperty() actorEmail: string;
  @ApiProperty({ enum: AdminAuditAction }) action: AdminAuditAction;
  @ApiProperty({ enum: AdminAuditTargetType }) targetType: AdminAuditTargetType;
  @ApiProperty() targetId: string;
  @ApiProperty() reason: string;
  @ApiPropertyOptional({ nullable: true }) metadata: Record<
    string,
    unknown
  > | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  constructor(data: AdminAuditLogDto) {
    Object.assign(this, data);
  }
}

export class AdminAuditLogPageDto {
  @ApiProperty({ type: AdminAuditLogDto, isArray: true })
  items: AdminAuditLogDto[];
  @ApiPropertyOptional({ nullable: true }) nextCursor: string | null;
  constructor(data: AdminAuditLogPageDto) {
    Object.assign(this, data);
  }
}
