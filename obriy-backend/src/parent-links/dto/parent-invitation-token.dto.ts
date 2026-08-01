import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ParentInvitationTokenDto {
  @ApiProperty({
    example: 'Lx3oR2V8m7N6s5T4u3W2x1Y0z9A8b7C6d5E4f3G2h1I',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token: string;
}
