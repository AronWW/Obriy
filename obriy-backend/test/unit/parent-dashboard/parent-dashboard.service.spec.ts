import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  TestLatePolicy,
  TestReleaseStatus,
  TestStudentStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import { ParentDashboardService } from '../../../src/parent-dashboard/parent-dashboard.service';
import type { TestReleaseLifecycleService } from '../../../src/tests/test-release-lifecycle.service';

describe('ParentDashboardService', () => {
  const parent: AuthUser = {
    id: 'parent-1',
    email: 'parent@example.com',
    role: UserRole.PARENT,
    status: UserStatus.ACTIVE,
  };
  const child = {
    id: 'student-1',
    profile: { displayName: 'Marta', avatarUrl: null, gradeLevel: 8 },
    studentClass: { id: 'class-1', name: 'History' },
  };
  const lifecycle = {
    synchronizeClass: jest.fn().mockResolvedValue({ activated: 0, closed: 0 }),
    synchronizeClasses: jest
      .fn()
      .mockResolvedValue({ activated: 0, closed: 0 }),
  } as unknown as TestReleaseLifecycleService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-11T12:00:00.000Z'));
    jest.clearAllMocks();
  });

  afterEach(() => jest.useRealTimers());

  it('calculates required progress and flags a deadline within 24 hours', async () => {
    const prisma = {
      parentChild: { findFirst: jest.fn().mockResolvedValue({ child }) },
      testRelease: {
        findMany: jest.fn().mockResolvedValue([
          release('completed', {
            status: TestStudentStatus.COMPLETED,
            scorePercent: 80,
          }),
          release('review', { status: TestStudentStatus.AWAITING_REVIEW }),
          release('soon', {
            dueAt: new Date('2026-09-12T11:59:00.000Z'),
          }),
          release('optional', {
            isRequired: false,
            dueAt: new Date('2026-09-10T12:00:00.000Z'),
          }),
        ]),
      },
    } as unknown as PrismaService;
    const result = await new ParentDashboardService(
      prisma,
      lifecycle,
    ).getChildOverview(parent, child.id);

    expect(result.child.metrics).toEqual({
      requiredReleaseCount: 3,
      completedCount: 1,
      completionPercent: 33.33,
      averagePercent: 40,
      attentionCount: 1,
      nextDueAt: new Date('2026-09-12T11:59:00.000Z'),
    });
    expect(result.attention).toEqual([
      expect.objectContaining({
        releaseId: 'soon',
        attentionReason: 'DUE_SOON',
      }),
    ]);
    expect(
      result.attention.find(({ releaseId }) => releaseId === 'optional'),
    ).toBeUndefined();
  });

  it('returns 404 for a child without a current parent link', async () => {
    const prisma = {
      parentChild: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    await expect(
      new ParentDashboardService(prisma, lifecycle).getChildOverview(
        parent,
        'other-child',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects non-parent roles before querying child data', async () => {
    const prisma = {} as PrismaService;
    await expect(
      new ParentDashboardService(prisma, lifecycle).getDashboard({
        ...parent,
        role: UserRole.TEACHER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

function release(
  id: string,
  input: {
    status?: TestStudentStatus;
    scorePercent?: number;
    dueAt?: Date;
    isRequired?: boolean;
  } = {},
) {
  return {
    id,
    testId: `test-${id}`,
    classId: 'class-1',
    lessonId: 'lesson-1',
    status: TestReleaseStatus.ACTIVE,
    isRequired: input.isRequired ?? true,
    availableFrom: null,
    dueAt: input.dueAt ?? null,
    maxPoints: 10,
    latePolicy: TestLatePolicy.ALLOW,
    revision: { title: `Test ${id}` },
    lesson: {
      id: 'lesson-1',
      title: 'Ancient cities',
      classLinks: [
        { classId: 'class-1', position: 1, publishedAt: new Date() },
      ],
    },
    studentStates:
      input.status || input.scorePercent !== undefined
        ? [
            {
              studentId: 'student-1',
              status: input.status ?? TestStudentStatus.NOT_STARTED,
              attemptCount: 1,
              scorePoints:
                input.scorePercent === undefined
                  ? null
                  : input.scorePercent / 10,
              scorePercent: input.scorePercent ?? null,
              bestPoints: null,
              bestPercent: input.scorePercent ?? null,
              lastActivityAt: new Date(),
            },
          ]
        : [],
  };
}
