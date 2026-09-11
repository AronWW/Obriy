import { Injectable } from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  TestAttemptStatus,
  TestReleaseStatus,
  TestStudentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { GamificationRewardDto } from '../gamification/dto/gamification.dto';
import { levelForXp } from '../gamification/gamification.service';
import type { CreateNotificationInput } from './notifications.service';
import { NotificationsService } from './notifications.service';

const releaseNotificationSelect = {
  id: true,
  classId: true,
  lessonId: true,
  isRequired: true,
  availableFrom: true,
  dueAt: true,
  revision: { select: { title: true } },
  class: {
    select: {
      teacherId: true,
      students: {
        select: {
          id: true,
          profile: { select: { displayName: true } },
          childLinks: { select: { parentId: true } },
          testStates: {
            select: { releaseId: true, status: true },
          },
        },
      },
    },
  },
} satisfies Prisma.TestReleaseSelect;

type ReleaseNotificationRecord = Prisma.TestReleaseGetPayload<{
  select: typeof releaseNotificationSelect;
}>;

@Injectable()
export class NotificationProducerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async notifyReleasePublished(releaseId: string): Promise<void> {
    const release = await this.findRelease(releaseId);
    if (!release) return;
    await this.notifyReleaseAudience(release, NotificationType.TEST_ASSIGNED);
  }

  async notifyReleaseAvailable(releaseId: string): Promise<void> {
    const release = await this.findRelease(releaseId);
    if (!release || release.availableFrom === null) return;
    await this.notifyReleaseAudience(release, NotificationType.TEST_AVAILABLE);
  }

  async notifyReviewRequired(attemptId: string): Promise<void> {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        studentState: {
          select: {
            studentId: true,
            student: { select: { profile: { select: { displayName: true } } } },
            release: {
              select: {
                classId: true,
                lessonId: true,
                class: { select: { teacherId: true } },
                revision: { select: { title: true } },
              },
            },
          },
        },
      },
    });
    if (!attempt || attempt.status !== TestAttemptStatus.AWAITING_REVIEW)
      return;
    const release = attempt.studentState.release;
    await this.notifications.createMany([
      {
        recipientId: release.class.teacherId,
        subjectStudentId: attempt.studentState.studentId,
        type: NotificationType.TEST_REVIEW_REQUIRED,
        deduplicationKey: `TEST_REVIEW_REQUIRED:${attempt.id}:${attempt.submittedAt?.toISOString() ?? 'unknown'}`,
        payload: this.payload({
          attemptId: attempt.id,
          studentId: attempt.studentState.studentId,
          studentDisplayName:
            attempt.studentState.student.profile?.displayName ?? 'Student',
          testTitle: release.revision.title,
          classId: release.classId,
          lessonId: release.lessonId,
        }),
      },
    ]);
  }

  async notifyAttemptFinalized(
    attemptId: string,
    reward?: GamificationRewardDto | null,
  ): Promise<void> {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        status: true,
        gradedAt: true,
        updatedAt: true,
        studentState: {
          select: {
            status: true,
            student: {
              select: {
                id: true,
                profile: { select: { displayName: true } },
                childLinks: { select: { parentId: true } },
              },
            },
            release: {
              select: {
                id: true,
                classId: true,
                lessonId: true,
                revision: { select: { title: true } },
              },
            },
          },
        },
      },
    });
    if (
      !attempt ||
      (attempt.status !== TestAttemptStatus.GRADED &&
        attempt.status !== TestAttemptStatus.RETURNED)
    ) {
      return;
    }
    const student = attempt.studentState.student;
    const release = attempt.studentState.release;
    const resultType =
      attempt.status === TestAttemptStatus.GRADED &&
      attempt.studentState.status === TestStudentStatus.COMPLETED
        ? NotificationType.TEST_GRADED
        : NotificationType.TEST_NEEDS_REVISION;
    const resultPayload = this.payload({
      attemptId: attempt.id,
      releaseId: release.id,
      classId: release.classId,
      lessonId: release.lessonId,
      testTitle: release.revision.title,
      studentId: student.id,
      studentDisplayName: student.profile?.displayName ?? 'Student',
    });
    await this.notifications.createMany(
      this.studentAndParents(
        student,
        resultType,
        `TEST_RESULT:${attempt.id}:${attempt.status}:${attempt.updatedAt.toISOString()}`,
        resultPayload,
      ),
    );
    if (reward) {
      await this.notifyReward(student, reward);
    } else if (attempt.status === TestAttemptStatus.GRADED) {
      await this.notifyPersistedRewards(student, attempt.id);
    }
  }

  async scanScheduledNotifications(now = new Date()): Promise<void> {
    const dueSoonEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const releases = await this.prisma.testRelease.findMany({
      where: {
        publishedAt: { not: null },
        OR: [
          {
            status: TestReleaseStatus.ACTIVE,
            availableFrom: { not: null, lte: now },
          },
          {
            isRequired: true,
            status: {
              in: [TestReleaseStatus.SCHEDULED, TestReleaseStatus.ACTIVE],
            },
            dueAt: { gt: now, lte: dueSoonEnd },
          },
          {
            isRequired: true,
            status: {
              in: [TestReleaseStatus.ACTIVE, TestReleaseStatus.CLOSED],
            },
            dueAt: { lte: now },
          },
        ],
      },
      select: releaseNotificationSelect,
    });
    for (const release of releases) {
      if (release.availableFrom && release.availableFrom <= now) {
        await this.notifyReleaseAudience(
          release,
          NotificationType.TEST_AVAILABLE,
        );
      }
      if (!release.isRequired || !release.dueAt) continue;
      if (release.dueAt <= now) {
        await this.notifyReleaseAudience(
          release,
          NotificationType.TEST_OVERDUE,
          true,
        );
      } else if (release.dueAt <= dueSoonEnd) {
        await this.notifyReleaseAudience(
          release,
          NotificationType.TEST_DUE_SOON,
          true,
        );
      }
    }
  }

  private async notifyReward(
    student: {
      id: string;
      profile: { displayName: string } | null;
      childLinks: { parentId: string }[];
    },
    reward: GamificationRewardDto,
  ): Promise<void> {
    const basePayload = {
      studentId: student.id,
      studentDisplayName: student.profile?.displayName ?? 'Student',
    };
    for (const award of reward.badges) {
      await this.notifications.createMany(
        this.studentAndParents(
          student,
          NotificationType.BADGE_UNLOCKED,
          `BADGE_UNLOCKED:${award.id}`,
          this.payload({
            ...basePayload,
            badgeId: award.badge.id,
            badgeKey: award.badge.key,
            iconKey: award.badge.iconKey,
          }),
        ),
      );
    }
    if (reward.xp && reward.xp.levelAfter > reward.xp.levelBefore) {
      await this.notifications.createMany(
        this.studentAndParents(
          student,
          NotificationType.LEVEL_UP,
          `LEVEL_UP:${reward.xp.id}:${reward.xp.levelAfter}`,
          this.payload({ ...basePayload, level: reward.xp.levelAfter }),
        ),
      );
    }
  }

  private async notifyPersistedRewards(
    student: {
      id: string;
      profile: { displayName: string } | null;
      childLinks: { parentId: string }[];
    },
    attemptId: string,
  ): Promise<void> {
    const [xp, awards] = await Promise.all([
      this.prisma.xPLedger.findMany({
        where: { attemptId },
        select: {
          id: true,
          totalXpBefore: true,
          totalXpAfter: true,
        },
      }),
      this.prisma.userBadge.findMany({
        where: { sourceAttemptId: attemptId },
        select: {
          id: true,
          badge: { select: { id: true, key: true, iconKey: true } },
        },
      }),
    ]);
    const basePayload = {
      studentId: student.id,
      studentDisplayName: student.profile?.displayName ?? 'Student',
    };
    for (const award of awards) {
      await this.notifications.createMany(
        this.studentAndParents(
          student,
          NotificationType.BADGE_UNLOCKED,
          `BADGE_UNLOCKED:${award.id}`,
          this.payload({
            ...basePayload,
            badgeId: award.badge.id,
            badgeKey: award.badge.key,
            iconKey: award.badge.iconKey,
          }),
        ),
      );
    }
    for (const entry of xp) {
      const levelBefore = levelForXp(entry.totalXpBefore);
      const levelAfter = levelForXp(entry.totalXpAfter);
      if (levelAfter <= levelBefore) continue;
      await this.notifications.createMany(
        this.studentAndParents(
          student,
          NotificationType.LEVEL_UP,
          `LEVEL_UP:${entry.id}:${levelAfter}`,
          this.payload({ ...basePayload, level: levelAfter }),
        ),
      );
    }
  }

  private async notifyReleaseAudience(
    release: ReleaseNotificationRecord,
    type: NotificationType,
    unfinishedOnly = false,
  ): Promise<void> {
    const inputs: CreateNotificationInput[] = [];
    for (const student of release.class.students) {
      const state = student.testStates.find(
        (entry) => entry.releaseId === release.id,
      );
      if (
        unfinishedOnly &&
        (state?.status === TestStudentStatus.COMPLETED ||
          state?.status === TestStudentStatus.AWAITING_REVIEW)
      ) {
        continue;
      }
      const payload = this.payload({
        releaseId: release.id,
        classId: release.classId,
        lessonId: release.lessonId,
        testTitle: release.revision.title,
        dueAt: release.dueAt?.toISOString() ?? null,
        availableFrom: release.availableFrom?.toISOString() ?? null,
        studentId: student.id,
        studentDisplayName: student.profile?.displayName ?? 'Student',
      });
      inputs.push(
        ...this.studentAndParents(
          student,
          type,
          `${type}:${release.id}:${student.id}`,
          payload,
        ),
      );
    }
    await this.notifications.createMany(inputs);
  }

  private studentAndParents(
    student: { id: string; childLinks: { parentId: string }[] },
    type: NotificationType,
    deduplicationKey: string,
    payload: Prisma.InputJsonObject,
  ): CreateNotificationInput[] {
    return [student.id, ...student.childLinks.map((link) => link.parentId)].map(
      (recipientId) => ({
        recipientId,
        subjectStudentId: student.id,
        type,
        payload,
        deduplicationKey,
      }),
    );
  }

  private findRelease(
    releaseId: string,
  ): Promise<ReleaseNotificationRecord | null> {
    return this.prisma.testRelease.findUnique({
      where: { id: releaseId },
      select: releaseNotificationSelect,
    });
  }

  private payload(
    value: Record<string, string | number | boolean | null>,
  ): Prisma.InputJsonObject {
    return value;
  }
}
