import { ApiProperty } from '@nestjs/swagger';
import { TestReleaseStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

export class LinkLessonTestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  testId: string;
}

export class ReorderLessonTestsDto {
  @ApiProperty({ type: String, isArray: true, format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  testIds: string[];
}

export class LessonTestDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  lessonId: string;

  @ApiProperty()
  testId: string;

  @ApiProperty()
  testRevisionId: string;

  @ApiProperty()
  revisionVersion: number;

  @ApiProperty()
  position: number;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  itemCount: number;

  @ApiProperty()
  maxPoints: number;

  @ApiProperty()
  hasUpdate: boolean;

  @ApiProperty()
  activeReleaseCount: number;

  @ApiProperty()
  releaseCount: number;

  @ApiProperty({ enum: TestReleaseStatus, isArray: true })
  releaseStatuses: TestReleaseStatus[];

  @ApiProperty({ type: String, format: 'date-time' })
  linkedAt: Date;

  constructor(data: LessonTestDto) {
    Object.assign(this, data);
  }
}
