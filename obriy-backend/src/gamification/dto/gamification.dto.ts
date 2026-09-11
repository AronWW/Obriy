import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BadgeCriteriaType } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export enum AchievementBadgeStatus {
  EARNED = 'EARNED',
  LOCKED = 'LOCKED',
}

export class GamificationProgressDto {
  @ApiProperty({ minimum: 0 })
  totalXp: number;

  @ApiProperty({ minimum: 1 })
  level: number;

  @ApiProperty({ minimum: 0 })
  levelStartXp: number;

  @ApiProperty({ minimum: 1 })
  nextLevelXp: number;

  @ApiProperty({ minimum: 0 })
  xpIntoLevel: number;

  @ApiProperty({ minimum: 1 })
  xpForNextLevel: number;

  constructor(data: GamificationProgressDto) {
    Object.assign(this, data);
  }
}

export class EarnedBadgeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  iconKey: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: String, format: 'date-time' })
  earnedAt: Date;

  @ApiPropertyOptional({ minimum: 1, maximum: 3, nullable: true })
  showcasePosition: number | null;

  constructor(data: EarnedBadgeDto) {
    Object.assign(this, data);
  }
}

export class GamificationProfileDto {
  @ApiProperty({ type: GamificationProgressDto })
  progress: GamificationProgressDto;

  @ApiProperty({ type: EarnedBadgeDto, isArray: true })
  showcase: EarnedBadgeDto[];

  @ApiProperty({ type: EarnedBadgeDto, isArray: true })
  badges: EarnedBadgeDto[];

  constructor(data: GamificationProfileDto) {
    Object.assign(this, data);
  }
}

export class AchievementBadgeProgressDto {
  @ApiProperty({ minimum: 0 })
  current: number;

  @ApiProperty({ minimum: 1 })
  target: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  percent: number;

  constructor(data: AchievementBadgeProgressDto) {
    Object.assign(this, data);
  }
}

export class AchievementBadgeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  iconKey: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: AchievementBadgeStatus })
  status: AchievementBadgeStatus;

  @ApiProperty({ enum: BadgeCriteriaType })
  criteriaType: BadgeCriteriaType;

  @ApiProperty({ type: AchievementBadgeProgressDto })
  progress: AchievementBadgeProgressDto;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  earnedAt: Date | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 3, nullable: true })
  showcasePosition: number | null;

  constructor(data: AchievementBadgeDto) {
    Object.assign(this, data);
  }
}

export class AchievementSummaryDto {
  @ApiProperty({ minimum: 0 })
  earnedCount: number;

  @ApiProperty({ minimum: 0 })
  totalCount: number;

  constructor(data: AchievementSummaryDto) {
    Object.assign(this, data);
  }
}

export class StudentAchievementsDto {
  @ApiProperty({ type: GamificationProgressDto })
  progress: GamificationProgressDto;

  @ApiProperty({ type: AchievementSummaryDto })
  summary: AchievementSummaryDto;

  @ApiProperty({ type: EarnedBadgeDto, isArray: true, maxItems: 3 })
  showcase: EarnedBadgeDto[];

  @ApiProperty({ type: AchievementBadgeDto, isArray: true })
  badges: AchievementBadgeDto[];

  constructor(data: StudentAchievementsDto) {
    Object.assign(this, data);
  }
}

export class XPAwardDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ minimum: 1 })
  amount: number;

  @ApiProperty({ minimum: 0 })
  totalXpBefore: number;

  @ApiProperty({ minimum: 1 })
  totalXpAfter: number;

  @ApiProperty({ minimum: 1 })
  levelBefore: number;

  @ApiProperty({ minimum: 1 })
  levelAfter: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  constructor(data: XPAwardDto) {
    Object.assign(this, data);
  }
}

export class BadgeAwardDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: EarnedBadgeDto })
  badge: EarnedBadgeDto;

  constructor(data: BadgeAwardDto) {
    Object.assign(this, data);
  }
}

export class GamificationRewardDto {
  @ApiPropertyOptional({ type: XPAwardDto, nullable: true })
  xp: XPAwardDto | null;

  @ApiProperty({ type: BadgeAwardDto, isArray: true })
  badges: BadgeAwardDto[];

  constructor(data: GamificationRewardDto) {
    Object.assign(this, data);
  }
}

export class UnseenGamificationRewardsDto {
  @ApiProperty({ type: XPAwardDto, isArray: true })
  xp: XPAwardDto[];

  @ApiProperty({ type: BadgeAwardDto, isArray: true })
  badges: BadgeAwardDto[];

  constructor(data: UnseenGamificationRewardsDto) {
    Object.assign(this, data);
  }
}

export class UpdateBadgeShowcaseDto {
  @ApiProperty({ type: String, isArray: true, maxItems: 3 })
  @IsArray()
  @ArrayMaxSize(3)
  @IsUUID('4', { each: true })
  badgeIds: string[];
}

export class AcknowledgeGamificationRewardsDto {
  @ApiProperty({ type: String, isArray: true, maxItems: 50 })
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  xpLedgerIds: string[];

  @ApiProperty({ type: String, isArray: true, maxItems: 50 })
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  userBadgeIds: string[];
}
