import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  NotificationDto,
  NotificationPageDto,
  NotificationUnreadCountDto,
} from './dto/notification.dto';
import type { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsGateway } from './notifications.gateway';

interface NotificationCursor {
  createdAt: string;
  id: string;
}

export interface CreateNotificationInput {
  recipientId: string;
  subjectStudentId?: string | null;
  type: NotificationType;
  payload: Prisma.InputJsonObject;
  deduplicationKey: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async list(
    user: AuthUser,
    query: NotificationQueryDto,
  ): Promise<NotificationPageDto> {
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;
    const where: Prisma.NotificationWhereInput = {
      recipientId: user.id,
      ...(query.unreadOnly ? { readAt: null } : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              {
                createdAt: new Date(cursor.createdAt),
                id: { lt: cursor.id },
              },
            ],
          }
        : {}),
    };
    const [records, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      }),
      this.prisma.notification.count({
        where: { recipientId: user.id, readAt: null },
      }),
    ]);
    const hasMore = records.length > query.limit;
    const page = records.slice(0, query.limit);
    const last = page.at(-1);
    return new NotificationPageDto({
      items: page.map((record) => this.toDto(record)),
      nextCursor:
        hasMore && last
          ? this.encodeCursor({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : null,
      unreadCount,
    });
  }

  async unreadCount(user: AuthUser): Promise<NotificationUnreadCountDto> {
    return new NotificationUnreadCountDto(
      await this.prisma.notification.count({
        where: { recipientId: user.id, readAt: null },
      }),
    );
  }

  async markRead(
    user: AuthUser,
    notificationId: string,
  ): Promise<NotificationDto> {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientId: user.id },
    });
    if (!existing) throw new NotFoundException('Notification not found');
    const updated = existing.readAt
      ? existing
      : await this.prisma.notification.update({
          where: { id: existing.id },
          data: { readAt: new Date() },
        });
    const dto = this.toDto(updated);
    this.gateway.emitRead(user.id, dto.id);
    return dto;
  }

  async markAllRead(user: AuthUser): Promise<void> {
    const readAt = new Date();
    await this.prisma.notification.updateMany({
      where: { recipientId: user.id, readAt: null },
      data: { readAt },
    });
    this.gateway.emitReadAll(user.id, readAt);
  }

  async createMany(
    inputs: CreateNotificationInput[],
  ): Promise<NotificationDto[]> {
    if (inputs.length === 0) return [];
    const created = await this.prisma.notification.createManyAndReturn({
      data: inputs.map((input) => ({
        recipientId: input.recipientId,
        subjectStudentId: input.subjectStudentId ?? null,
        type: input.type,
        payload: input.payload,
        deduplicationKey: input.deduplicationKey,
      })),
      skipDuplicates: true,
    });
    const result = created.map((record) => this.toDto(record));
    result.forEach((notification, index) => {
      const recipientId = created[index]?.recipientId;
      if (recipientId) this.gateway.emitCreated(recipientId, notification);
    });
    return result;
  }

  async deleteParentSubjectNotifications(
    parentId: string,
    childId: string,
  ): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: { recipientId: parentId, subjectStudentId: childId },
    });
  }

  private toDto(record: {
    id: string;
    type: NotificationType;
    subjectStudentId: string | null;
    payload: Prisma.JsonValue;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationDto {
    return new NotificationDto({
      id: record.id,
      type: record.type,
      subjectStudentId: record.subjectStudentId,
      payload: this.jsonObject(record.payload),
      isRead: record.readAt !== null,
      readAt: record.readAt,
      createdAt: record.createdAt,
    });
  }

  private jsonObject(value: Prisma.JsonValue): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value
      : {};
  }

  private encodeCursor(cursor: NotificationCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
  }

  private decodeCursor(value: string): NotificationCursor {
    try {
      const parsed = JSON.parse(
        Buffer.from(value, 'base64url').toString(),
      ) as unknown;
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('createdAt' in parsed) ||
        !('id' in parsed) ||
        typeof parsed.createdAt !== 'string' ||
        typeof parsed.id !== 'string' ||
        Number.isNaN(new Date(parsed.createdAt).getTime())
      ) {
        throw new Error();
      }
      return { createdAt: parsed.createdAt, id: parsed.id };
    } catch {
      throw new BadRequestException('Invalid notification cursor');
    }
  }
}
