import { IsString } from 'class-validator';
import { IsObriyPassword } from '../../common/validation/password.validation';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Opaque token received in the reset email.' })
  @IsString()
  token: string;

  @IsObriyPassword()
  password: string;
}
