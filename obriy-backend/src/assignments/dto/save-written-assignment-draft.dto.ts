import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class SaveWrittenAssignmentDraftDto {
  @ApiProperty({ maxLength: 20_000 })
  @IsString()
  @MaxLength(20_000)
  text: string;
}
