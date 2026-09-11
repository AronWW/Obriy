import {
  NotificationType,
  TestReleaseStatus,
  TestStudentStatus,
} from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { NotificationProducerService } from '../../../src/notifications/notification-producer.service';
import type { NotificationsService } from '../../../src/notifications/notifications.service';

describe('NotificationProducerService', () => {
  it('creates due-soon messages for an unfinished required test only', async () => {
    const now = new Date('2026-09-11T12:00:00.000Z');
    const createMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      testRelease: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            release({ dueAt: new Date('2026-09-12T11:59:00.000Z') }),
          ]),
      },
    } as unknown as PrismaService;
    const service = new NotificationProducerService(prisma, {
      createMany,
    } as unknown as NotificationsService);

    await service.scanScheduledNotifications(now);

    expect(createMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          recipientId: 'student-1',
          type: NotificationType.TEST_DUE_SOON,
        }),
        expect.objectContaining({
          recipientId: 'parent-1',
          subjectStudentId: 'student-1',
        }),
      ]),
    );
  });

  it('skips reminders for completed students', async () => {
    const createMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      testRelease: {
        findMany: jest.fn().mockResolvedValue([
          release({
            dueAt: new Date('2026-09-12T11:00:00.000Z'),
            studentStatus: TestStudentStatus.COMPLETED,
          }),
        ]),
      },
    } as unknown as PrismaService;
    const service = new NotificationProducerService(prisma, {
      createMany,
    } as unknown as NotificationsService);

    await service.scanScheduledNotifications(
      new Date('2026-09-11T12:00:00.000Z'),
    );

    expect(createMany).toHaveBeenCalledWith([]);
  });
});

function release({
  dueAt,
  studentStatus = TestStudentStatus.NOT_STARTED,
}: {
  dueAt: Date;
  studentStatus?: TestStudentStatus;
}) {
  return {
    id: 'release-1',
    classId: 'class-1',
    lessonId: 'lesson-1',
    isRequired: true,
    availableFrom: null,
    dueAt,
    status: TestReleaseStatus.ACTIVE,
    revision: { title: 'Test one' },
    class: {
      teacherId: 'teacher-1',
      students: [
        {
          id: 'student-1',
          profile: { displayName: 'Student' },
          childLinks: [{ parentId: 'parent-1' }],
          testStates: [{ releaseId: 'release-1', status: studentStatus }],
        },
      ],
    },
  };
}
