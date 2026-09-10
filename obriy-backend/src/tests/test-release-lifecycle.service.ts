import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TestLatePolicy, TestReleaseStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TestReleaseLifecycleService {
  private readonly logger = new Logger(TestReleaseLifecycleService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    return { activated: activated.count, closed: closed.count };
  }
}
