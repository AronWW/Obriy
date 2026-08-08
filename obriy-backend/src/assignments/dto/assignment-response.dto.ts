import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AssignmentRevisionStatus,
  AssignmentStatus,
  AssignmentType,
  Locale,
} from '@prisma/client';
import { AssignmentRevisionSource } from './assignment-revision-source.dto';

export type AssignmentJsonObject = Record<string, unknown>;

export class AssignmentRevisionSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ minimum: 1 })
  version: number;

  @ApiProperty({ enum: AssignmentRevisionStatus })
  status: AssignmentRevisionStatus;

  @ApiProperty({ maxLength: 160 })
  title: string;

  @ApiProperty({ minimum: 1 })
  editVersion: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  publishedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(data: AssignmentRevisionSummaryDto) {
    Object.assign(this, data);
  }
}

export class AssignmentSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: AssignmentType })
  type: AssignmentType;

  @ApiProperty({ enum: Locale })
  contentLocale: Locale;

  @ApiProperty({ enum: AssignmentStatus })
  status: AssignmentStatus;

  @ApiProperty({ minimum: 0.01, maximum: 999_999.99 })
  defaultMaxPoints: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  defaultPassingPercent: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  archivedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: AssignmentRevisionSummaryDto, nullable: true })
  draftRevision: AssignmentRevisionSummaryDto | null;

  @ApiPropertyOptional({ type: AssignmentRevisionSummaryDto, nullable: true })
  publishedRevision: AssignmentRevisionSummaryDto | null;

  constructor(data: AssignmentSummaryDto) {
    Object.assign(this, data);
  }
}

export class AssignmentListResponseDto {
  @ApiProperty({ type: AssignmentSummaryDto, isArray: true })
  items: AssignmentSummaryDto[];

  @ApiPropertyOptional({ nullable: true, description: 'Opaque list cursor' })
  nextCursor: string | null;

  constructor(data: AssignmentListResponseDto) {
    this.items = data.items;
    this.nextCursor = data.nextCursor;
  }
}

export class AssignmentEditorRevisionDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ minimum: 1 })
  version: number;

  @ApiProperty({ enum: AssignmentRevisionStatus })
  status: AssignmentRevisionStatus;

  @ApiProperty({ maxLength: 160 })
  title: string;

  @ApiProperty({ maxLength: 50_000 })
  prompt: string;

  @ApiPropertyOptional({ nullable: true })
  instructions: string | null;

  @ApiPropertyOptional({ nullable: true })
  explanation: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  publicConfig: AssignmentJsonObject;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Owner-only grading configuration',
  })
  gradingConfig: AssignmentJsonObject | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  mapPresetId: string | null;

  @ApiProperty({ minimum: 1 })
  schemaVersion: number;

  @ApiProperty({ minimum: 1 })
  editVersion: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  publishedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(data: AssignmentEditorRevisionDto) {
    Object.assign(this, data);
  }
}

export class AssignmentEditorDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: AssignmentType })
  type: AssignmentType;

  @ApiProperty({ enum: Locale })
  contentLocale: Locale;

  @ApiProperty({ enum: AssignmentStatus })
  status: AssignmentStatus;

  @ApiProperty({ minimum: 0.01, maximum: 999_999.99 })
  defaultMaxPoints: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  defaultPassingPercent: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  archivedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: AssignmentEditorRevisionDto, nullable: true })
  draftRevision: AssignmentEditorRevisionDto | null;

  @ApiPropertyOptional({ type: AssignmentEditorRevisionDto, nullable: true })
  publishedRevision: AssignmentEditorRevisionDto | null;

  constructor(data: AssignmentEditorDto) {
    Object.assign(this, data);
  }
}

export class AssignmentPreviewDto {
  @ApiProperty()
  assignmentId: string;

  @ApiProperty()
  revisionId: string;

  @ApiProperty({ enum: AssignmentRevisionSource })
  source: AssignmentRevisionSource;

  @ApiProperty({ enum: AssignmentType })
  type: AssignmentType;

  @ApiProperty({ enum: Locale })
  contentLocale: Locale;

  @ApiProperty({ minimum: 1 })
  version: number;

  @ApiProperty({ maxLength: 160 })
  title: string;

  @ApiProperty({ maxLength: 50_000 })
  prompt: string;

  @ApiPropertyOptional({ nullable: true })
  instructions: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  publicConfig: AssignmentJsonObject;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  mapPresetId: string | null;

  @ApiProperty({ minimum: 0.01, maximum: 999_999.99 })
  defaultMaxPoints: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  defaultPassingPercent: number;

  constructor(data: AssignmentPreviewDto) {
    Object.assign(this, data);
  }
}
