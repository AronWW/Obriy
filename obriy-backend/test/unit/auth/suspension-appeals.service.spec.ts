import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { SuspensionAppealStatus, UserStatus } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { SuspensionAppealsService } from '../../../src/auth/suspension-appeals.service';

describe('SuspensionAppealsService', () => {
  const user = {
    id: 'user-1',
    status: UserStatus.SUSPENDED,
    sessionVersion: 4,
  };
  const suspension = {
    id: 'audit-1',
    reason: 'Repeated harmful conduct in class communication.',
    createdAt: new Date('2026-09-20T10:00:00.000Z'),
    sourceSuspensionAppeals: [],
  };
  let prisma: {
    user: { findUnique: jest.Mock };
    adminAuditLog: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let jwt: { sign: jest.Mock; verifyAsync: jest.Mock };
  let service: SuspensionAppealsService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      adminAuditLog: { findFirst: jest.fn().mockResolvedValue(suspension) },
      $transaction: jest.fn(),
    };
    jwt = {
      sign: jest.fn().mockReturnValue('signed-suspension-token'),
      verifyAsync: jest.fn().mockResolvedValue({
        sub: user.id,
        sessionVersion: user.sessionVersion,
        purpose: 'SUSPENSION_APPEAL',
      }),
    };
    const config = {
      get: jest.fn().mockReturnValue('test-access-secret'),
    } as unknown as ConfigService;
    service = new SuspensionAppealsService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config,
    );
  });

  it('issues a short-lived token without exposing the suspension reason', () => {
    let thrown: unknown;
    try {
      service.throwSuspended(user);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ForbiddenException);
    expect((thrown as ForbiddenException).getResponse()).toEqual({
      code: 'USER_SUSPENDED',
      message: 'The account is suspended.',
      suspensionAccessToken: 'signed-suspension-token',
    });
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: user.id,
        sessionVersion: user.sessionVersion,
        purpose: 'SUSPENSION_APPEAL',
      }),
      expect.objectContaining({ audience: 'obriy-suspension', expiresIn: 900 }),
    );
  });

  it('returns the exact current suspension and an empty appeal state', async () => {
    await expect(
      service.context({ suspensionAccessToken: 'token' }),
    ).resolves.toMatchObject({
      reason: suspension.reason,
      suspendedAt: suspension.createdAt,
      canAppeal: true,
      nextAppealAt: null,
      appeal: null,
    });
  });

  it('rejects a token after the account session version changes', async () => {
    prisma.user.findUnique.mockResolvedValue({
      status: UserStatus.SUSPENDED,
      sessionVersion: user.sessionVersion + 1,
    });

    await expect(
      service.context({ suspensionAccessToken: 'token' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('creates one appeal while holding the suspended user lock', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: user.id }]),
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      adminAuditLog: {
        findFirst: jest.fn().mockResolvedValue({ id: suspension.id }),
      },
      suspensionAppeal: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'appeal-1' }),
      },
    };
    prisma.$transaction.mockImplementation(
      async (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    );

    await service.submit({
      suspensionAccessToken: 'token',
      message: '  Please review the full context of this incident.  ',
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.suspensionAppeal.create).toHaveBeenCalledWith({
      data: {
        userId: user.id,
        suspensionAuditLogId: suspension.id,
        message: 'Please review the full context of this incident.',
      },
    });
  });

  it('enforces the seven-day cooldown after rejection', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: user.id }]),
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      adminAuditLog: {
        findFirst: jest.fn().mockResolvedValue({ id: suspension.id }),
      },
      suspensionAppeal: {
        findFirst: jest.fn().mockResolvedValue({
          status: SuspensionAppealStatus.REJECTED,
          reviewedAt: new Date(),
        }),
        create: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(
      async (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    );

    await expect(
      service.submit({
        suspensionAccessToken: 'token',
        message: 'Please review the full context of this incident.',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.suspensionAppeal.create).not.toHaveBeenCalled();
  });
});
