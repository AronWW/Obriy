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
  const emitCreated = jest.fn();
  const gateway = {
    emitCreated,
    emitRead: jest.fn(),
    emitReadAll: jest.fn(),
  } as unknown as NotificationsGateway;

  beforeEach(() => jest.clearAllMocks());

  it('lists only the current recipient and returns an opaque cursor', async () => {
    const records = [
      notification('notification-2', new Date('2026-09-11T12:00:00.000Z')),
      notification('notification-1', new Date('2026-09-11T11:00:00.000Z')),
    ];
    const findMany = jest
      .fn<Promise<typeof records>, [Record<string, unknown>]>()
      .mockResolvedValue(records);
    const prisma = {
      notification: {
        findMany,
        count: jest.fn().mockResolvedValue(2),
      },
    } as unknown as PrismaService;
    const service = new NotificationsService(prisma, gateway);

    const result = await service.list(user, { limit: 1, unreadOnly: true });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toEqual(expect.any(String));
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { recipientId: user.id, readAt: null },
      take: 2,
    });
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
    expect(emitCreated).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ id: created.id }),
    );
  });

  it('groups chat notifications by conversation without storing message text', async () => {
    const created = {
      ...notification('notification-chat', new Date()),
      type: NotificationType.CHAT_MESSAGE,
      payload: {
        conversationId: 'conversation-1',
        senderDisplayName: 'Teacher',
        unreadCount: 2,
      },
    };
    const upsert = jest
      .fn<Promise<typeof created>, [Record<string, unknown>]>()
      .mockResolvedValue(created);
    const chatGateway = {
      ...gateway,
      isViewingConversation: jest.fn().mockResolvedValue(false),
    } as unknown as NotificationsGateway;
    const service = new NotificationsService(
      { notification: { upsert } } as unknown as PrismaService,
      chatGateway,
    );

    await service.notifyChatMessage({
      recipientId: 'student-1',
      studentId: 'student-1',
      conversationId: 'conversation-1',
      senderDisplayName: 'Teacher',
      unreadCount: 2,
    });

    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0]?.[0];
    expect(call?.where).toEqual({
      recipientId_deduplicationKey: {
        recipientId: 'student-1',
        deduplicationKey: 'CHAT_MESSAGE:conversation-1',
      },
    });
    const update = call?.update as { payload?: Record<string, unknown> };
    expect(update.payload).toEqual({
      conversationId: 'conversation-1',
      senderDisplayName: 'Teacher',
      unreadCount: 2,
    });
    expect(update.payload).not.toHaveProperty('message');
  });

  it('suppresses a chat notification while that conversation is focused', async () => {
    const upsert = jest.fn();
    const chatGateway = {
      ...gateway,
      isViewingConversation: jest.fn().mockResolvedValue(true),
    } as unknown as NotificationsGateway;
    const service = new NotificationsService(
      { notification: { upsert } } as unknown as PrismaService,
      chatGateway,
    );

    await service.notifyChatMessage({
      recipientId: 'student-1',
      studentId: 'student-1',
      conversationId: 'conversation-1',
      senderDisplayName: 'Teacher',
      unreadCount: 1,
    });

    expect(upsert).not.toHaveBeenCalled();
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
