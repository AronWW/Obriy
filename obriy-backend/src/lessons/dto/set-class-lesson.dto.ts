import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetClassLessonDto {
  @ApiProperty({ description: 'Whether students can see this lesson' })
  @IsBoolean()
  published: boolean;
}
