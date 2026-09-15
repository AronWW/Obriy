import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsObriyPassword } from '../../common/validation/password.validation';

export class ChangePasswordDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  currentPassword: string;

  @IsObriyPassword()
  newPassword: string;
}
