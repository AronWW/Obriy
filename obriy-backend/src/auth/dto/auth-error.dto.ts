import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthErrorDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'INVALID_EMAIL_VERIFICATION_TOKEN' })
  code: string;

  @ApiProperty({ example: 'The link is invalid or expired.' })
  message: string;

  @ApiPropertyOptional({ example: 'student@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: 42 })
  retryAfterSeconds?: number;
}
