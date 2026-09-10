import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  BadgeCriteriaType,
  Locale,
  Prisma,
  TestStudentStatus,
  UserRole,
  XPSourceType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  AcknowledgeGamificationRewardsDto,
  BadgeAwardDto,
  EarnedBadgeDto,
  GamificationProfileDto,
  GamificationProgressDto,
  GamificationRewardDto,
  UnseenGamificationRewardsDto,
  UpdateBadgeShowcaseDto,
  XPAwardDto,
} from './dto/gamification.dto';

const badgeInclude = {
  badge: { include: { translations: true } },
} satisfies Prisma.UserBadgeInclude;

type BadgeAwardRecord = Prisma.UserBadgeGetPayload<{
  include: typeof badgeInclude;
}>;

export interface FinalizedAttemptRewardInput {
  attemptId: string;
  awardedAt?: Date;
}

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(user: AuthUser): Promise<GamificationProfileDto> {
    this.assertStudent(user);
    const locale = await this.findLocale(this.prisma, user.id);
    return this.getProfile(this.prisma, user.id, locale);
  }

  async getPublicProfile(
    studentId: string,
    viewerId: string,
  ): Promise<GamificationProfileDto> {
    const locale = await this.findLocale(this.prisma, viewerId);
    return this.getProfile(this.prisma, studentId, locale);
  }

  async updateShowcase(
    user: AuthUser,
    dto: UpdateBadgeShowcaseDto,
  ): Promise<GamificationProfileDto> {
    this.assertStudent(user);
    if (new Set(dto.badgeIds).size !== dto.badgeIds.length) {
      throw new BadRequestException({
        code: 'BADGE_SHOWCASE_DUPLICATE',
        message: 'The badge showcase cannot contain duplicates',
      });
    }

    await this.prisma.$transaction(async (transaction) => {
      const owned = await transaction.userBadge.findMany({
        where: { studentId: user.id, badgeId: { in: dto.badgeIds } },
        select: { badgeId: true },
      });
      if (owned.length !== dto.badgeIds.length) {
        throw new BadRequestException({
          code: 'BADGE_NOT_EARNED',
          message: 'Only earned badges can be added to the showcase',
        });
      }

      await transaction.userBadge.updateMany({
        where: { studentId: user.id, showcasePosition: { not: null } },
        data: { showcasePosition: null },
      });
      for (const [index, badgeId] of dto.badgeIds.entries()) {
        await transaction.userBadge.update({
          where: {
            studentId_badgeId: { studentId: user.id, badgeId },
          },
          data: { showcasePosition: index + 1 },
        });
      }
    });

    return this.getMyProfile(user);
  }

  async getUnseenRewards(
    user: AuthUser,
  ): Promise<UnseenGamificationRewardsDto> {
    this.assertStudent(user);
    const locale = await this.findLocale(this.prisma, user.id);
    const [xp, badges] = await Promise.all([
      this.prisma.xPLedger.findMany({
        where: { studentId: user.id, seenAt: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 50,
      }),
      this.prisma.userBadge.findMany({
        where: { studentId: user.id, seenAt: null },
        include: badgeInclude,
        orderBy: [{ earnedAt: 'asc' }, { id: 'asc' }],
        take: 50,
      }),
    ]);
    return new UnseenGamificationRewardsDto({
      xp: xp.map((entry) => this.toXpAward(entry)),
      badges: badges.map((entry) => this.toBadgeAward(entry, locale)),
    });
  }

  async acknowledgeRewards(
    user: AuthUser,
    dto: AcknowledgeGamificationRewardsDto,
  ): Promise<void> {
    this.assertStudent(user);
    const seenAt = new Date();
    await this.prisma.$transaction([
      this.prisma.xPLedger.updateMany({
        where: { id: { in: dto.xpLedgerIds }, studentId: user.id },
        data: { seenAt },
      }),
      this.prisma.userBadge.updateMany({
        where: { id: { in: dto.userBadgeIds }, studentId: user.id },
        data: { seenAt },
      }),
    ]);
  }

  async awardFinalizedAttempt(
    transaction: Prisma.TransactionClient,
    input: FinalizedAttemptRewardInput,
  ): Promise<GamificationRewardDto | null> {
    const attempt = await transaction.testAttempt.findUnique({
      where: { id: input.attemptId },
      select: {
        id: true,
        isPassed: true,
        scorePercent: true,
        studentState: {
          select: {
            studentId: true,
            releaseId: true,
            release: { select: { xpReward: true } },
            student: {
              select: {
                profile: { select: { preferredLocale: true } },
              },
            },
          },
        },
      },
    });
    if (!attempt?.isPassed) return null;

    const awardedAt = input.awardedAt ?? new Date();
    const studentId = attempt.studentState.studentId;
    await transaction.$queryRaw`
      SELECT "id" FROM "User" WHERE "id" = ${studentId} FOR UPDATE
    `;

    let xpAward: XPAwardDto | null = null;
    const xpReward = attempt.studentState.release.xpReward;
    if (xpReward > 0) {
      const sourceKey = attempt.studentState.releaseId;
      const existing = await transaction.xPLedger.findUnique({
        where: {
          studentId_sourceType_sourceKey: {
            studentId,
            sourceType: XPSourceType.TEST_RELEASE_PASS,
            sourceKey,
          },
        },
      });
      if (!existing) {
        const aggregate = await transaction.xPLedger.aggregate({
          where: { studentId },
          _sum: { amount: true },
        });
        const totalXpBefore = aggregate._sum.amount ?? 0;
        const created = await transaction.xPLedger.create({
          data: {
            studentId,
            sourceType: XPSourceType.TEST_RELEASE_PASS,
            sourceKey,
            releaseId: attempt.studentState.releaseId,
            attemptId: attempt.id,
            amount: xpReward,
            totalXpBefore,
            totalXpAfter: totalXpBefore + xpReward,
            createdAt: awardedAt,
          },
        });
        xpAward = this.toXpAward(created);
      }
    }

    const unlockedBadges = await this.unlockEligibleBadges(
      transaction,
      studentId,
      attempt.id,
      Number(attempt.scorePercent ?? 0),
      awardedAt,
      attempt.studentState.student.profile?.preferredLocale ?? Locale.UK,
    );
    if (!xpAward && unlockedBadges.length === 0) return null;
    return new GamificationRewardDto({ xp: xpAward, badges: unlockedBadges });
  }

  private async unlockEligibleBadges(
    transaction: Prisma.TransactionClient,
    studentId: string,
    attemptId: string,
    scorePercent: number,
    earnedAt: Date,
    locale: Locale,
  ): Promise<BadgeAwardDto[]> {
    const [passedTestCount, badges, existingAwards] = await Promise.all([
      transaction.testStudentState.count({
        where: { studentId, status: TestStudentStatus.COMPLETED },
      }),
      transaction.badge.findMany({
        where: { isActive: true },
        orderBy: [{ criteriaValue: 'asc' }, { key: 'asc' }],
      }),
      transaction.userBadge.findMany({
        where: { studentId },
        select: { badgeId: true },
      }),
    ]);
    const existingIds = new Set(existingAwards.map((award) => award.badgeId));
    const eligibleIds = badges
      .filter((badge) => {
        if (existingIds.has(badge.id)) return false;
        if (badge.criteriaType === BadgeCriteriaType.PASSED_TEST_COUNT) {
          return passedTestCount >= badge.criteriaValue;
        }
        return (
          badge.criteriaType === BadgeCriteriaType.PERFECT_SCORE_COUNT &&
          scorePercent >= 100
        );
      })
      .map((badge) => badge.id);
    if (eligibleIds.length === 0) return [];

    await transaction.userBadge.createMany({
      data: eligibleIds.map((badgeId) => ({
        studentId,
        badgeId,
        sourceAttemptId: attemptId,
        earnedAt,
      })),
      skipDuplicates: true,
    });
    const created = await transaction.userBadge.findMany({
      where: {
        studentId,
        badgeId: { in: eligibleIds },
        sourceAttemptId: attemptId,
        earnedAt,
      },
      include: badgeInclude,
      orderBy: [{ earnedAt: 'asc' }, { id: 'asc' }],
    });
    return created.map((award) => this.toBadgeAward(award, locale));
  }

  private async getProfile(
    client: PrismaService | Prisma.TransactionClient,
    studentId: string,
    locale: Locale,
  ): Promise<GamificationProfileDto> {
    const [aggregate, awards] = await Promise.all([
      client.xPLedger.aggregate({
        where: { studentId },
        _sum: { amount: true },
      }),
      client.userBadge.findMany({
        where: { studentId },
        include: badgeInclude,
        orderBy: [{ earnedAt: 'desc' }, { id: 'asc' }],
      }),
    ]);
    const badges = awards.map((award) => this.toEarnedBadge(award, locale));
    return new GamificationProfileDto({
      progress: gamificationProgress(aggregate._sum.amount ?? 0),
      showcase: badges
        .filter((badge) => badge.showcasePosition !== null)
        .sort(
          (left, right) =>
            (left.showcasePosition ?? 0) - (right.showcasePosition ?? 0),
        ),
      badges,
    });
  }

  private async findLocale(
    client: PrismaService | Prisma.TransactionClient,
    userId: string,
  ): Promise<Locale> {
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { profile: { select: { preferredLocale: true } } },
    });
    return user?.profile?.preferredLocale ?? Locale.UK;
  }

  private toEarnedBadge(
    award: BadgeAwardRecord,
    locale: Locale,
  ): EarnedBadgeDto {
    const translation =
      award.badge.translations.find((item) => item.locale === locale) ??
      award.badge.translations.find((item) => item.locale === Locale.UK) ??
      award.badge.translations[0];
    return new EarnedBadgeDto({
      id: award.badge.id,
      key: award.badge.key,
      iconKey: award.badge.iconKey,
      name: translation?.name ?? award.badge.key,
      description: translation?.description ?? '',
      earnedAt: award.earnedAt,
      showcasePosition: award.showcasePosition,
    });
  }

  private toBadgeAward(award: BadgeAwardRecord, locale: Locale): BadgeAwardDto {
    return new BadgeAwardDto({
      id: award.id,
      badge: this.toEarnedBadge(award, locale),
    });
  }

  private toXpAward(entry: {
    id: string;
    amount: number;
    totalXpBefore: number;
    totalXpAfter: number;
    createdAt: Date;
  }): XPAwardDto {
    return new XPAwardDto({
      ...entry,
      levelBefore: levelForXp(entry.totalXpBefore),
      levelAfter: levelForXp(entry.totalXpAfter),
    });
  }

  private assertStudent(user: AuthUser): void {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only student accounts can use gamification endpoints',
      });
    }
  }
}

export function xpThresholdForLevel(level: number): number {
  const normalized = Math.max(1, Math.floor(level));
  return 250 * (normalized - 1) * normalized;
}

export function levelForXp(totalXp: number): number {
  const normalized = Math.max(0, Math.floor(totalXp));
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + normalized / 62.5)) / 2));
}

export function gamificationProgress(totalXp: number): GamificationProgressDto {
  const normalized = Math.max(0, Math.floor(totalXp));
  const level = levelForXp(normalized);
  const levelStartXp = xpThresholdForLevel(level);
  const nextLevelXp = xpThresholdForLevel(level + 1);
  return new GamificationProgressDto({
    totalXp: normalized,
    level,
    levelStartXp,
    nextLevelXp,
    xpIntoLevel: normalized - levelStartXp,
    xpForNextLevel: nextLevelXp - levelStartXp,
  });
}
