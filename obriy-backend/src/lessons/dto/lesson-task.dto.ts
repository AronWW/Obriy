import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonTaskSubmissionStatus } from '@prisma/client';

export enum StudentLessonProgressStatus {
  NO_TASKS = 'NO_TASKS',
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export class LessonTaskDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  lessonId: string;

  @ApiProperty({ maxLength: 160 })
  title: string;

  @ApiProperty()
  prompt: string;

  @ApiProperty({ minimum: 1 })
  position: number;

  @ApiProperty()
  isRequired: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(data: LessonTaskDto) {
    Object.assign(this, data);
  }
}

export class StudentLessonProgressDto {
  @ApiProperty({ enum: StudentLessonProgressStatus })
  status: StudentLessonProgressStatus;

  @ApiProperty({ minimum: 0 })
  requiredTotal: number;

  @ApiProperty({ minimum: 0 })
  approved: number;

  @ApiProperty({ minimum: 0 })
  submitted: number;

  @ApiProperty({ minimum: 0 })
  returned: number;

  constructor(data: StudentLessonProgressDto) {
    Object.assign(this, data);
  }
}

export class StudentTaskSubmissionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  taskId: string;

  @ApiProperty()
  answerText: string;

  @ApiProperty({ enum: LessonTaskSubmissionStatus })
  status: LessonTaskSubmissionStatus;

  @ApiPropertyOptional({ nullable: true })
  teacherComment: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  submittedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  reviewedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(data: StudentTaskSubmissionDto) {
    Object.assign(this, data);
  }
}

export class StudentLessonTaskDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ maxLength: 160 })
  title: string;

  @ApiProperty()
  prompt: string;

  @ApiProperty({ minimum: 1 })
  position: number;

  @ApiProperty()
  isRequired: boolean;

  @ApiPropertyOptional({
    type: StudentTaskSubmissionDto,
    nullable: true,
  })
  submission: StudentTaskSubmissionDto | null;

  constructor(data: StudentLessonTaskDto) {
    Object.assign(this, data);
  }
}

export class TeacherSubmissionStudentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  constructor(data: TeacherSubmissionStudentDto) {
    Object.assign(this, data);
  }
}

export class TeacherSubmissionClassDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  constructor(data: TeacherSubmissionClassDto) {
    Object.assign(this, data);
  }
}

export class TeacherTaskSubmissionDto extends StudentTaskSubmissionDto {
  @ApiProperty()
  taskTitle: string;

  @ApiProperty({ minimum: 1 })
  taskPosition: number;

  @ApiProperty()
  taskIsRequired: boolean;

  @ApiProperty({ type: TeacherSubmissionStudentDto })
  student: TeacherSubmissionStudentDto;

  @ApiProperty({ type: TeacherSubmissionClassDto })
  class: TeacherSubmissionClassDto;

  constructor(data: TeacherTaskSubmissionDto) {
    super(data);
    this.taskTitle = data.taskTitle;
    this.taskPosition = data.taskPosition;
    this.taskIsRequired = data.taskIsRequired;
    this.student = data.student;
    this.class = data.class;
  }
}
