import { Locale, UserRole, UserStatus, XPSourceType } from '@prisma/client';
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
