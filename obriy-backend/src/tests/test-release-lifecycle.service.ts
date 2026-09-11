import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TestLatePolicy, TestReleaseStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { notificationEvents } from '../notifications/notifications.events';

@Injectable()
export class TestReleaseLifecycleService {
  private readonly logger = new Logger(TestReleaseLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly events?: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async synchronize(): Promise<void> {
    const { activated, closed } = await this.synchronizeWhere({});
    if (activated + closed > 0) {
      this.logger.log(
        `Synchronized ${activated} scheduled and ${closed} overdue test releases.`,
      );
    }
  }

  async synchronizeLessonClass(
    lessonId: string,
    classId: string,
  ): Promise<void> {
    await this.synchronizeWhere({ lessonId, classId });
  }

  async synchronizeClass(classId: string): Promise<void> {
    await this.synchronizeWhere({ classId });
  }

  async synchronizeRelease(releaseId: string): Promise<void> {
    await this.synchronizeWhere({ id: releaseId });
  }

  private async synchronizeWhere(scope: {
    id?: string;
    lessonId?: string;
    classId?: string;
  }): Promise<{ activated: number; closed: number }> {
    const now = new Date();
    const activating = this.events
      ? await this.prisma.testRelease.findMany({
          where: {
            ...scope,
            status: TestReleaseStatus.SCHEDULED,
            availableFrom: { lte: now },
          },
          select: { id: true },
        })
      : [];
    const [activated, closed] = await this.prisma.$transaction([
      this.prisma.testRelease.updateMany({
        where: {
          ...scope,
          status: TestReleaseStatus.SCHEDULED,
          availableFrom: { lte: now },
        },
        data: { status: TestReleaseStatus.ACTIVE },
      }),
      this.prisma.testRelease.updateMany({
        where: {
          ...scope,
          status: TestReleaseStatus.ACTIVE,
          latePolicy: TestLatePolicy.DISALLOW,
          dueAt: { lte: now },
        },
        data: { status: TestReleaseStatus.CLOSED, closedAt: now },
      }),
    ]);
    for (const release of activating) {
      this.events?.emit(notificationEvents.releaseAvailable, {
        releaseId: release.id,
      });
    }
    return { activated: activated.count, closed: closed.count };
  }
}
