import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonStatus, Locale } from '@prisma/client';
import {
  StudentLessonProgressDto,
  StudentLessonTaskDto,
} from './lesson-task.dto';

export class LessonClassLinkDto {
  @ApiProperty()
  classId: string;

  @ApiProperty()
  className: string;

  @ApiProperty({ minimum: 1 })
  position: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  publishedAt: Date | null;

  constructor(data: LessonClassLinkDto) {
    Object.assign(this, data);
  }
}

export class LessonSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ maxLength: 160 })
  title: string;

  @ApiProperty({ maxLength: 500 })
  summary: string;

  @ApiProperty({ enum: Locale })
  contentLocale: Locale;

  @ApiPropertyOptional({ minimum: 1, maximum: 180, nullable: true })
  estimatedMinutes: number | null;

  @ApiProperty({ enum: LessonStatus })
  status: LessonStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({ type: LessonClassLinkDto, isArray: true })
  classLinks: LessonClassLinkDto[];

  constructor(data: LessonSummaryDto) {
    Object.assign(this, data);
  }
}

export class LessonDetailDto extends LessonSummaryDto {
  @ApiProperty()
  content: string;

  constructor(data: LessonDetailDto) {
    super(data);
    this.content = data.content;
  }
}

export class ClassLessonItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ maxLength: 160 })
  title: string;

  @ApiProperty({ maxLength: 500 })
  summary: string;

  @ApiProperty({ enum: Locale })
  contentLocale: Locale;

  @ApiPropertyOptional({ minimum: 1, maximum: 180, nullable: true })
  estimatedMinutes: number | null;

  @ApiProperty({ enum: LessonStatus })
  status: LessonStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiProperty()
  classId: string;

  @ApiProperty({ minimum: 1 })
  position: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  publishedAt: Date | null;

  constructor(data: ClassLessonItemDto) {
    Object.assign(this, data);
  }
}

export class StudentLessonSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ maxLength: 160 })
  title: string;

  @ApiProperty({ maxLength: 500 })
  summary: string;

  @ApiProperty({ enum: Locale })
  contentLocale: Locale;

  @ApiPropertyOptional({ minimum: 1, maximum: 180, nullable: true })
  estimatedMinutes: number | null;

  @ApiProperty({ minimum: 1 })
  position: number;

  @ApiProperty({ type: StudentLessonProgressDto })
  progress: StudentLessonProgressDto;

  constructor(data: StudentLessonSummaryDto) {
    Object.assign(this, data);
  }
}

export class StudentLessonClassDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  constructor(data: StudentLessonClassDto) {
    Object.assign(this, data);
  }
}

export class StudentLessonTeacherDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  constructor(data: StudentLessonTeacherDto) {
    Object.assign(this, data);
  }
}

export class StudentLessonDetailDto extends StudentLessonSummaryDto {
  @ApiProperty()
  content: string;

  @ApiProperty({ type: StudentLessonClassDto })
  class: StudentLessonClassDto;

  @ApiProperty({ type: StudentLessonTeacherDto })
  teacher: StudentLessonTeacherDto;

  @ApiProperty({ type: StudentLessonTaskDto, isArray: true })
  tasks: StudentLessonTaskDto[];

  constructor(data: StudentLessonDetailDto) {
    super(data);
    this.content = data.content;
    this.class = data.class;
    this.teacher = data.teacher;
    this.tasks = data.tasks;
  }
}
