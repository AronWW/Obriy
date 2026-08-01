import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum ClassLessonMoveDirection {
  UP = 'UP',
  DOWN = 'DOWN',
}

export class MoveClassLessonDto {
  @ApiProperty({ enum: ClassLessonMoveDirection })
  @IsEnum(ClassLessonMoveDirection)
  direction: ClassLessonMoveDirection;
}
