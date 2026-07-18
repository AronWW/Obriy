import { Locale, UserRole, UserStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicProfileDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  rank: number | null;

  constructor(data: PublicProfileDto) {
    this.id = data.id;
    this.displayName = data.displayName;
    this.avatarUrl = data.avatarUrl;
    this.level = data.level;
    this.xp = data.xp;
    this.rank = data.rank;
  }
}

export class PrivateProfileDto {
  @ApiProperty()
  id: string;
  @ApiProperty({ example: 'student@example.com' })
  email: string;
  @ApiProperty({ enum: UserRole })
  role: UserRole;
  @ApiProperty({ enum: UserStatus })
  status: UserStatus;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  emailVerifiedAt: Date | null;
  @ApiProperty({
    example: {
      displayName: 'Olena',
      avatarUrl: null,
      bio: null,
      gradeLevel: 9,
      subjectArea: null,
      preferredLocale: 'UK',
    },
  })
  profile: {
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    gradeLevel: number | null;
    subjectArea: string | null;
    preferredLocale: Locale;
  };

  constructor(data: PrivateProfileDto) {
    this.id = data.id;
    this.email = data.email;
    this.role = data.role;
    this.status = data.status;
    this.emailVerifiedAt = data.emailVerifiedAt;
    this.profile = data.profile;
  }
}
