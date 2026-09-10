import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EarnedBadgeDto } from '../../gamification/dto/gamification.dto';
import { LeaderboardPeriod } from './leaderboard-query.dto';

export class LeaderboardClassDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ minimum: 0 })
  studentCount: number;

  constructor(data: LeaderboardClassDto) {
    Object.assign(this, data);
  }
}

export class LeaderboardPeriodDto {
  @ApiProperty({ enum: LeaderboardPeriod })
  type: LeaderboardPeriod;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  startAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  endAt: Date | null;

  constructor(data: LeaderboardPeriodDto) {
    Object.assign(this, data);
  }
}

export class LeaderboardEntryDto {
  @ApiProperty({ minimum: 1 })
  rank: number;

  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ minimum: 0 })
  periodXp: number;

  @ApiProperty({ minimum: 0 })
  totalXp: number;

  @ApiProperty({ minimum: 1 })
  level: number;

  @ApiProperty({ type: EarnedBadgeDto, isArray: true, maxItems: 3 })
  showcase: EarnedBadgeDto[];

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  lastXpAt: Date | null;

  @ApiProperty()
  isCurrentUser: boolean;

  constructor(data: LeaderboardEntryDto) {
    Object.assign(this, data);
  }
}

export class LeaderboardPageDto {
  @ApiPropertyOptional({ type: LeaderboardClassDto, nullable: true })
  class: LeaderboardClassDto | null;

  @ApiProperty({ type: LeaderboardPeriodDto })
  period: LeaderboardPeriodDto;

  @ApiProperty({ type: LeaderboardEntryDto, isArray: true })
  entries: LeaderboardEntryDto[];

  @ApiPropertyOptional({ type: LeaderboardEntryDto, nullable: true })
  selfEntry: LeaderboardEntryDto | null;

  @ApiPropertyOptional({ nullable: true })
  nextCursor: string | null;

  constructor(data: LeaderboardPageDto) {
    Object.assign(this, data);
  }
}
