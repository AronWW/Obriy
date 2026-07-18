import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Opaque token received in the verification email.',
  })
  @IsString()
  token: string;
}
