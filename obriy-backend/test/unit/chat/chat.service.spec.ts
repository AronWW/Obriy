import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import type { NotificationsGateway } from '../../../src/notifications/notifications.gateway';
import type { NotificationsService } from '../../../src/notifications/notifications.service';
import type { ChatStorageService } from '../../../src/chat/chat-storage.service';
import { ChatService } from '../../../src/chat/chat.service';

describe('ChatService', () => {
  const student: AuthUser = {
    id: 'student-1',
    email: 'student@example.com',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  };
  const storageUpload = jest.fn();
  const storage = {
    upload: storageUpload,
    destroy: jest.fn(),
    deliveryUrl: jest.fn(),
  } as unknown as ChatStorageService;
  const notifications = {
    notifyChatMessage: jest.fn(),
    markChatNotificationRead: jest.fn(),
  } as unknown as NotificationsService;
  const realtime = {
    emitChatMessage: jest.fn(),
    emitChatUpdated: jest.fn(),
    emitChatRead: jest.fn(),
  } as unknown as NotificationsGateway;

  beforeEach(() => jest.clearAllMocks());

  it('returns an idempotent message only from the requested conversation', async () => {
    const existing = message('conversation-1');
    const prisma = prismaMock({
      conversation: { findFirst: jest.fn().mockResolvedValue(conversation()) },
      message: { findUnique: jest.fn().mockResolvedValue(existing) },
    });
    const service = new ChatService(prisma, storage, notifications, realtime);

    const result = await service.sendMessage(student, 'conversation-1', {
      clientMessageId: '0c915906-b961-492b-a3b7-37f5aaea1549',
      body: 'Hello',
    });

    expect(result.id).toBe(existing.id);
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('rejects a reused client message ID from another conversation', async () => {
    const prisma = prismaMock({
      conversation: { findFirst: jest.fn().mockResolvedValue(conversation()) },
      message: {
        findUnique: jest.fn().mockResolvedValue(message('conversation-2')),
      },
    });
    const service = new ChatService(prisma, storage, notifications, realtime);

    await expect(
      service.sendMessage(student, 'conversation-1', {
        clientMessageId: '0c915906-b961-492b-a3b7-37f5aaea1549',
        body: 'Hello',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps a former-teacher conversation read-only', async () => {
    const record = conversation();
    record.student.studentClass = {
      id: 'class-2',
      name: 'Other class',
      teacherId: 'teacher-2',
    };
    const prisma = prismaMock({
      conversation: { findFirst: jest.fn().mockResolvedValue(record) },
    });
    const service = new ChatService(prisma, storage, notifications, realtime);

    await expect(
      service.sendMessage(student, 'conversation-1', {
        clientMessageId: '0c915906-b961-492b-a3b7-37f5aaea1549',
        body: 'Hello',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a ZIP archive renamed as an Office document', async () => {
    const prisma = prismaMock({
      conversation: { findFirst: jest.fn().mockResolvedValue(conversation()) },
      message: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const service = new ChatService(prisma, storage, notifications, realtime);

    await expect(
      service.sendMessage(
        student,
        'conversation-1',
        {
          clientMessageId: '0c915906-b961-492b-a3b7-37f5aaea1549',
        },
        [
          {
            originalname: 'archive.docx',
            mimetype:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            size: 8,
            buffer: Buffer.from('PK\u0003\u0004junk'),
          },
        ],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('revokes parent access as soon as the parent-child link is gone', async () => {
    const prisma = prismaMock({
      parentChild: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const service = new ChatService(prisma, storage, notifications, realtime);
    const parent = { ...student, id: 'parent-1', role: UserRole.PARENT };

    await expect(
      service.listParentMessages(parent, 'student-1', 'conversation-1', {
        limit: 30,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function prismaMock(parts: Record<string, unknown>): PrismaService {
  return parts as unknown as PrismaService;
}

function conversation() {
  return {
    id: 'conversation-1',
    teacherId: 'teacher-1',
    studentId: 'student-1',
    teacherLastReadAt: null,
    studentLastReadAt: null,
    lastMessageAt: null,
    createdAt: new Date('2026-09-12T10:00:00.000Z'),
    teacher: {
      status: UserStatus.ACTIVE,
      profile: { displayName: 'Teacher', avatarUrl: null },
    },
    student: {
      status: UserStatus.ACTIVE,
      profile: { displayName: 'Student', avatarUrl: null },
      studentClass: { id: 'class-1', name: 'Class', teacherId: 'teacher-1' },
    },
    messages: [],
  };
}

function message(conversationId: string) {
  return {
    id: 'message-1',
    conversationId,
    senderId: 'student-1',
    body: 'Hello',
    editedAt: null,
    createdAt: new Date('2026-09-12T10:01:00.000Z'),
    sender: { role: UserRole.STUDENT },
    attachments: [],
  };
}
