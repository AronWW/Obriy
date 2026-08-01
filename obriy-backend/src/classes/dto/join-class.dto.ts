import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class JoinClassDto {
  @ApiProperty({ example: '7KXM-P9QD' })
  @IsString()
  @Matches(/^[A-Za-z2-9 -]{8,12}$/)
  code: string;
}
