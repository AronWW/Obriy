import { ApiProperty } from '@nestjs/swagger';

export enum StudentLessonProgressStatus {
  NO_TASKS = 'NO_TASKS',
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export class StudentLessonProgressDto {
  @ApiProperty({ enum: StudentLessonProgressStatus })
  status: StudentLessonProgressStatus;

  @ApiProperty({ minimum: 0 })
  requiredTotal: number;

  @ApiProperty({ minimum: 0 })
  completed: number;

  @ApiProperty({ minimum: 0 })
  awaitingReview: number;

  @ApiProperty({ minimum: 0 })
  needsRevision: number;

  @ApiProperty({ minimum: 0 })
  inProgress: number;

  @ApiProperty({ minimum: 0 })
  expired: number;

  constructor(data: StudentLessonProgressDto) {
    Object.assign(this, data);
  }
}
