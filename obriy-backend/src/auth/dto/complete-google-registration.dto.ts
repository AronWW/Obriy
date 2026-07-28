import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale, UserRole } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CompleteGoogleRegistrationDto {
  @ApiProperty({ description: 'Short-lived registration code.' })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  code: string;

  @ApiProperty({ enum: [UserRole.STUDENT, UserRole.TEACHER, UserRole.PARENT] })
  @IsIn([UserRole.STUDENT, UserRole.TEACHER, UserRole.PARENT])
  role: UserRole;

  @ApiPropertyOptional({ enum: Locale })
  @IsOptional()
  @IsEnum(Locale)
  preferredLocale?: Locale;
}
