import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdminAuditAction,
  LessonModerationCaseStatus,
  LessonReportCategory,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AdminPageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(/^[A-Za-z0-9_-]+$/)
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}

export class AdminUsersQueryDto extends AdminPageQueryDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class AdminModerationQueryDto extends AdminPageQueryDto {
  @ApiPropertyOptional({ enum: LessonModerationCaseStatus })
  @IsOptional()
  @IsEnum(LessonModerationCaseStatus)
  status?: LessonModerationCaseStatus;
}

export class AdminAuditQueryDto extends AdminPageQueryDto {
  @ApiPropertyOptional({ enum: AdminAuditAction })
  @IsOptional()
  @IsEnum(AdminAuditAction)
  action?: AdminAuditAction;
}

export class AdminReasonDto {
  @ApiProperty({ minLength: 10, maxLength: 500 })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason: string;
}

export class AdminModerationActionDto extends AdminReasonDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedEditVersion: number;
}

export class ReportLessonDto {
  @ApiProperty({ enum: LessonReportCategory })
  @IsEnum(LessonReportCategory)
  category: LessonReportCategory;

  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  details: string;
}

export class ResubmitLessonModerationDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedEditVersion: number;
}
