import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class PublishAssignmentDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The current draft revision expected by the client',
  })
  @IsUUID()
  expectedRevisionId: string;

  @ApiProperty({
    minimum: 1,
    description: 'The current draft editVersion expected by the client',
  })
  @IsInt()
  @Min(1)
  expectedEditVersion: number;
}
