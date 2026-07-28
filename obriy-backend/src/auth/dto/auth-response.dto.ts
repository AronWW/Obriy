import { PrivateProfileDto } from '../../users/dto/profile.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ description: 'Short-lived JWT access token.' })
  accessToken: string;

  @ApiProperty({ type: PrivateProfileDto })
  user: PrivateProfileDto;

  constructor(data: AuthResponseDto) {
    this.accessToken = data.accessToken;
    this.user = data.user;
  }
}

export class AuthMessageDto {
  @ApiProperty({ example: 'EMAIL_VERIFICATION_SENT' })
  code: string;

  @ApiProperty({ example: 'We sent an email verification link.' })
  message: string;

  @ApiPropertyOptional({ example: 'student@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: 60 })
  retryAfterSeconds?: number;

  constructor(data: AuthMessageDto) {
    this.code = data.code;
    this.message = data.message;
    this.email = data.email;
    this.retryAfterSeconds = data.retryAfterSeconds;
  }
}
