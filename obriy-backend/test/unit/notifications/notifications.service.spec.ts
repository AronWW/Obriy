import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationType, UserRole, UserStatus } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import type { NotificationsGateway } from '../../../src/notifications/notifications.gateway';
import { NotificationsService } from '../../../src/notifications/notifications.service';

describe('NotificationsService', () => {
  const user: AuthUser = {
    id: 'student-1',
    email: 'student@example.com',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  };
  const gateway = {
    emitCreated: jest.fn(),
    emitRead: jest.fn(),
    emitReadAll: jest.fn(),
  } as unknown as NotificationsGateway;

  beforeEach(() => jest.clearAllMocks());

  it('lists only the current recipient and returns an opaque cursor', async () => {
    const records = [
      notification('notification-2', new Date('2026-09-11T12:00:00.000Z')),
      notification('notification-1', new Date('2026-09-11T11:00:00.000Z')),
    ];
    const prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue(records),
        count: jest.fn().mockResolvedValue(2),
      },
    } as unknown as PrismaService;
    const service = new NotificationsService(prisma, gateway);

    const result = await service.list(user, { limit: 1, unreadOnly: true });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toEqual(expect.any(String));
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ recipientId: user.id, readAt: null }),
        take: 2,
      }),
    );
  });

  it('rejects malformed cursors', async () => {
    const service = new NotificationsService({} as PrismaService, gateway);
    await expect(
      service.list(user, {
        cursor: 'not-a-cursor',
        limit: 20,
        unreadOnly: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not let a user read another recipient notification', async () => {
    const prisma = {
      notification: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new NotificationsService(prisma, gateway);
    await expect(service.markRead(user, 'foreign-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('emits only records actually inserted after deduplication', async () => {
    const created = notification('notification-1', new Date());
    const prisma = {
      notification: {
        createManyAndReturn: jest.fn().mockResolvedValue([created]),
      },
    } as unknown as PrismaService;
    const service = new NotificationsService(prisma, gateway);
    const result = await service.createMany([
      {
        recipientId: user.id,
        type: NotificationType.TEST_ASSIGNED,
        payload: { releaseId: 'release-1' },
        deduplicationKey: 'TEST_ASSIGNED:release-1:student-1',
      },
    ]);

    expect(result).toHaveLength(1);
    expect(gateway.emitCreated).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ id: created.id }),
    );
  });
});

function notification(id: string, createdAt: Date) {
  return {
    id,
    recipientId: 'student-1',
    subjectStudentId: 'student-1',
    type: NotificationType.TEST_ASSIGNED,
    payload: { releaseId: 'release-1' },
    deduplicationKey: `key-${id}`,
    readAt: null,
    createdAt,
  };
}
