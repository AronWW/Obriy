import {
  BadgeCriteriaType,
  Locale,
  UserRole,
  UserStatus,
  XPSourceType,
} from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import {
  GamificationService,
  gamificationProgress,
  levelForXp,
  xpThresholdForLevel,
} from '../../../src/gamification/gamification.service';

describe('gamification level formula', () => {
  it.each([
    [0, 1],
    [499, 1],
    [500, 2],
    [1499, 2],
    [1500, 3],
    [3000, 4],
  ])('maps %i XP to level %i', (xp, level) => {
    expect(levelForXp(xp)).toBe(level);
  });

  it('returns stable level thresholds and progress', () => {
    expect(xpThresholdForLevel(1)).toBe(0);
    expect(xpThresholdForLevel(2)).toBe(500);
    expect(xpThresholdForLevel(3)).toBe(1500);
    expect(gamificationProgress(700)).toEqual({
      totalXp: 700,
      level: 2,
      levelStartXp: 500,
      nextLevelXp: 1500,
      xpIntoLevel: 200,
      xpForNextLevel: 1000,
    });
  });
});

describe('GamificationService rewards', () => {
  const student: AuthUser = {
    id: 'student-1',
    email: 'student@example.com',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  };

  it('creates one immutable release XP entry with balance snapshots', async () => {
    const transaction = rewardTransaction({ xpReward: 100 });
    const service = new GamificationService({} as PrismaService);

    const reward = await service.awardFinalizedAttempt(transaction.client, {
      attemptId: 'attempt-1',
      awardedAt: new Date('2026-09-10T10:00:00.000Z'),
    });

    expect(transaction.xpCreate).toHaveBeenCalledWith({
      // Jest's asymmetric matcher is intentionally typed as any.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        studentId: student.id,
        sourceType: XPSourceType.TEST_RELEASE_PASS,
        sourceKey: 'release-1',
        amount: 100,
        totalXpBefore: 400,
        totalXpAfter: 500,
      }),
    });
    expect(reward?.xp).toEqual(
      expect.objectContaining({ amount: 100, levelBefore: 1, levelAfter: 2 }),
    );
  });

  it('does not grant XP again when the release already has a ledger entry', async () => {
    const transaction = rewardTransaction({
      xpReward: 100,
      alreadyAwarded: true,
    });
    const service = new GamificationService({} as PrismaService);

    await expect(
      service.awardFinalizedAttempt(transaction.client, {
        attemptId: 'attempt-1',
      }),
    ).resolves.toBeNull();
    expect(transaction.xpCreate).not.toHaveBeenCalled();
  });
});

describe('GamificationService achievements', () => {
  const student: AuthUser = {
    id: 'student-1',
    email: 'student@example.com',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  };

  it('returns earned and locked badges with criterion progress', async () => {
    const earnedAt = new Date('2026-09-10T10:00:00.000Z');
    const badgeFindMany = jest.fn().mockResolvedValue([
      achievementBadge({
        id: 'earned',
        key: 'FIRST_STEP',
        criteriaValue: 1,
        isActive: false,
        award: { earnedAt, showcasePosition: 1 },
      }),
      achievementBadge({
        id: 'locked',
        key: 'STEADY_PATH',
        criteriaValue: 5,
      }),
      achievementBadge({
        id: 'perfect',
        key: 'PERFECT_RESULT',
        criteriaType: BadgeCriteriaType.PERFECT_SCORE_COUNT,
        criteriaValue: 1,
      }),
    ]);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          profile: { preferredLocale: Locale.EN },
        }),
      },
      xPLedger: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 700 } }),
      },
      testStudentState: { count: jest.fn().mockResolvedValue(3) },
      testAttempt: { count: jest.fn().mockResolvedValue(0) },
      badge: { findMany: badgeFindMany },
    } as unknown as PrismaService;
    const result = await new GamificationService(prisma).getMyAchievements(
      student,
    );

    expect(result.progress).toEqual(
      expect.objectContaining({ totalXp: 700, level: 2 }),
    );
    expect(result.summary).toEqual({ earnedCount: 1, totalCount: 3 });
    expect(result.showcase).toEqual([
      expect.objectContaining({ id: 'earned', showcasePosition: 1 }),
    ]);
    expect(result.badges).toEqual([
      expect.objectContaining({
        id: 'earned',
        status: 'EARNED',
        progress: { current: 1, target: 1, percent: 100 },
      }),
      expect.objectContaining({
        id: 'perfect',
        status: 'LOCKED',
        progress: { current: 0, target: 1, percent: 0 },
      }),
      expect.objectContaining({
        id: 'locked',
        status: 'LOCKED',
        progress: { current: 3, target: 5, percent: 60 },
      }),
    ]);
    expect(badgeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { isActive: true },
            { awards: { some: { studentId: student.id } } },
          ],
        },
      }),
    );
  });
});

function achievementBadge(input: {
  id: string;
  key: string;
  criteriaType?: BadgeCriteriaType;
  criteriaValue: number;
  isActive?: boolean;
  award?: { earnedAt: Date; showcasePosition: number | null };
}) {
  return {
    id: input.id,
    key: input.key,
    iconKey: 'award',
    criteriaType: input.criteriaType ?? BadgeCriteriaType.PASSED_TEST_COUNT,
    criteriaValue: input.criteriaValue,
    isActive: input.isActive ?? true,
    translations: [
      {
        locale: Locale.EN,
        name: input.key,
        description: `${input.key} description`,
      },
    ],
    awards: input.award ? [input.award] : [],
  };
}

function rewardTransaction(input: {
  xpReward: number;
  alreadyAwarded?: boolean;
}) {
  const xpCreate = jest.fn().mockResolvedValue({
    id: 'ledger-1',
    amount: input.xpReward,
    totalXpBefore: 400,
    totalXpAfter: 400 + input.xpReward,
    createdAt: new Date('2026-09-10T10:00:00.000Z'),
  });
  const client = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'student-1' }]),
    testAttempt: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'attempt-1',
        isPassed: true,
        scorePercent: 80,
        studentState: {
          studentId: 'student-1',
          releaseId: 'release-1',
          release: { xpReward: input.xpReward },
          student: { profile: { preferredLocale: Locale.UK } },
        },
      }),
    },
    xPLedger: {
      findUnique: jest
        .fn()
        .mockResolvedValue(input.alreadyAwarded ? { id: 'existing' } : null),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 400 } }),
      create: xpCreate,
    },
    testStudentState: { count: jest.fn().mockResolvedValue(1) },
    badge: { findMany: jest.fn().mockResolvedValue([]) },
    userBadge: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn(),
    },
  } as unknown as Parameters<GamificationService['awardFinalizedAttempt']>[0];
  return { client, xpCreate };
}
