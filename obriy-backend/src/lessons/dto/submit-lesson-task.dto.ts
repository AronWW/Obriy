import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class SubmitLessonTaskDto {
  @ApiProperty({ maxLength: 20_000 })
  @IsString()
  @Matches(/\S/, { message: 'answerText must contain non-whitespace text' })
  @MaxLength(20_000)
  answerText: string;
}
