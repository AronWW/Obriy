import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AssignmentType,
  Locale,
  TestRevisionStatus,
  TestScorePolicy,
  TestStatus,
} from '@prisma/client';

export class TestItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ minimum: 0 })
  position: number;

  @ApiProperty({ minimum: 0.01 })
  maxPoints: number;

  @ApiProperty()
  assignmentId: string;

  @ApiProperty()
  assignmentRevisionId: string;

  @ApiProperty({ enum: AssignmentType })
  assignmentType: AssignmentType;

  @ApiProperty()
  title: string;

  @ApiProperty({
    description:
      'Whether the assignment has a newer draft or published revision',
  })
  hasUpdate: boolean;

  constructor(data: TestItemDto) {
    Object.assign(this, data);
  }
}

export class TestRevisionDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ minimum: 1 })
  version: number;

  @ApiProperty({ enum: TestRevisionStatus })
  status: TestRevisionStatus;

  @ApiProperty({ maxLength: 160 })
  title: string;

  @ApiProperty({ maxLength: 500 })
  description: string;

  @ApiPropertyOptional({ nullable: true })
  instructions: string | null;

  @ApiProperty({ minimum: 0, maximum: 100 })
  passingPercent: number;

  @ApiPropertyOptional({ nullable: true, minimum: 1 })
  maxAttempts: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 30 })
  timeLimitSeconds: number | null;

  @ApiProperty({ enum: TestScorePolicy })
  scorePolicy: TestScorePolicy;

  @ApiProperty()
  shuffleItems: boolean;

  @ApiProperty({ minimum: 1 })
  schemaVersion: number;

  @ApiProperty({ minimum: 1 })
  editVersion: number;

  @ApiProperty({ type: TestItemDto, isArray: true })
  items: TestItemDto[];

  @ApiProperty()
  totalMaxPoints: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  publishedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(data: TestRevisionDto) {
    Object.assign(this, data);
  }
}

export class TestEditorDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: Locale })
  contentLocale: Locale;

  @ApiProperty({ enum: TestStatus })
  status: TestStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  archivedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: TestRevisionDto, nullable: true })
  draftRevision: TestRevisionDto | null;

  @ApiPropertyOptional({ type: TestRevisionDto, nullable: true })
  publishedRevision: TestRevisionDto | null;

  constructor(data: TestEditorDto) {
    Object.assign(this, data);
  }
}

export class TestListResponseDto {
  @ApiProperty({ type: () => TestSummaryDto, isArray: true })
  items: TestSummaryDto[];

  @ApiPropertyOptional({ nullable: true })
  nextCursor: string | null;

  constructor(data: TestListResponseDto) {
    Object.assign(this, data);
  }
}

export class TestRevisionSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ minimum: 1 })
  version: number;

  @ApiProperty({ enum: TestRevisionStatus })
  status: TestRevisionStatus;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ minimum: 0 })
  itemCount: number;

  @ApiProperty({ minimum: 0 })
  totalMaxPoints: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  publishedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(data: TestRevisionSummaryDto) {
    Object.assign(this, data);
  }
}

export class TestSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: Locale })
  contentLocale: Locale;

  @ApiProperty({ enum: TestStatus })
  status: TestStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  archivedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: () => TestRevisionSummaryDto, nullable: true })
  draftRevision: TestRevisionSummaryDto | null;

  @ApiPropertyOptional({ type: () => TestRevisionSummaryDto, nullable: true })
  publishedRevision: TestRevisionSummaryDto | null;

  constructor(data: TestSummaryDto) {
    Object.assign(this, data);
  }
}
