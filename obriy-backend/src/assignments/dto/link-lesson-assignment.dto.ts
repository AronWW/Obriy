import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class LinkLessonAssignmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  assignmentId: string;
}
