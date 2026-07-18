import { ApiProperty } from '@nestjs/swagger';

export class AuthErrorDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'INVALID_EMAIL_VERIFICATION_TOKEN' })
  code: string;

  @ApiProperty({ example: 'The link is invalid or expired.' })
  message: string;
}
