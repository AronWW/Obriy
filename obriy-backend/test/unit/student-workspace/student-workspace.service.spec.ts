import { ForbiddenException } from '@nestjs/common';
import {
  TestLatePolicy,
  TestReleaseStatus,
  TestStudentStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import { StudentWorkspaceService } from '../../../src/student-workspace/student-workspace.service';
import type { TestReleaseLifecycleService } from '../../../src/tests/test-release-lifecycle.service';
import {
  StudentTasksRequiredFilter,
  StudentTasksStatusFilter,
} from '../../../src/student-workspace/dto/student-workspace-query.dto';

describe('StudentWorkspaceService', () => {
  const userFindUnique = jest.fn();
  const releaseFindMany = jest.fn();
  const prisma = {
    user: { findUnique: userFindUnique },
    testRelease: { findMany: releaseFindMany },
  } as unknown as PrismaService;
  const releaseLifecycle = {
    synchronizeClass: jest.fn().mockResolvedValue(undefined),
  } as unknown as TestReleaseLifecycleService;
  const service = new StudentWorkspaceService(prisma, releaseLifecycle);
  const student: AuthUser = {
    id: 'student-1',
    email: 'student@example.com',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  };

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-09T12:00:00.000Z'));
  });

  afterAll(() => jest.useRealTimers());

  beforeEach(() => {
    userFindUnique.mockResolvedValue({
      studentClass: { id: 'class-1', name: 'History class' },
    });
    releaseFindMany.mockResolvedValue([]);
  });

  afterEach(() => jest.clearAllMocks());

  it('rejects non-students before querying the database', async () => {
    await expect(
      service.getDashboard({ ...student, role: UserRole.TEACHER }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it('returns a valid empty workspace for a student without a class', async () => {
    userFindUnique.mockResolvedValue({ studentClass: null });

    const dashboard = await service.getDashboard(student);
    const tasks = await service.getTasks(student, {});

    expect(dashboard.class).toBeNull();
    expect(dashboard.attention).toEqual([]);
    expect(dashboard.upcoming).toEqual([]);
    expect(dashboard.continueLessons).toEqual([]);
    expect(dashboard.metrics.completionPercent).toBeNull();
    expect(dashboard.metrics.averagePercent).toBeNull();
    expect(dashboard.metrics.attentionCount).toBe(0);
    expect(tasks).toEqual(
      expect.objectContaining({ class: null, items: [], nextCursor: null }),
    );
    expect(releaseFindMany).not.toHaveBeenCalled();
  });

  it('uses required work for metrics and excludes awaiting review from average', async () => {
    releaseFindMany.mockResolvedValue([
      release('completed', {
        status: TestStudentStatus.COMPLETED,
        scorePercent: 80,
      }),
      release('scheduled', {
        releaseStatus: TestReleaseStatus.SCHEDULED,
        availableFrom: new Date('2026-09-12T12:00:00.000Z'),
      }),
      release('review', { status: TestStudentStatus.AWAITING_REVIEW }),
      release('optional', {
        isRequired: false,
        status: TestStudentStatus.NEEDS_REVISION,
        scorePercent: 20,
      }),
    ]);

    const result = await service.getDashboard(student);

    expect(result.metrics).toEqual(
      expect.objectContaining({
        requiredReleaseCount: 3,
        completedCount: 1,
        completionPercent: 33.33,
        averagePercent: 40,
        attentionCount: 0,
      }),
    );
    expect(result.upcoming.map(({ releaseId }) => releaseId)).toContain(
      'scheduled',
    );
  });

  it('orders revision, overdue, active, scheduled, review and completed work', async () => {
    releaseFindMany.mockResolvedValue([
      release('completed', { status: TestStudentStatus.COMPLETED }),
      release('review', { status: TestStudentStatus.AWAITING_REVIEW }),
      release('scheduled', {
        releaseStatus: TestReleaseStatus.SCHEDULED,
        availableFrom: new Date('2026-09-12T12:00:00.000Z'),
      }),
      release('available'),
      release('progress', { status: TestStudentStatus.IN_PROGRESS }),
      release('overdue', {
        dueAt: new Date('2026-09-08T12:00:00.000Z'),
        latePolicy: TestLatePolicy.ALLOW,
      }),
      release('revision', { status: TestStudentStatus.NEEDS_REVISION }),
    ]);

    const result = await service.getTasks(student, {});

    expect(result.items.map(({ releaseId }) => releaseId)).toEqual([
      'revision',
      'overdue',
      'progress',
      'available',
      'scheduled',
      'review',
      'completed',
    ]);
    expect(result.items[4]).toEqual(
      expect.objectContaining({ canOpen: false, availability: 'SCHEDULED' }),
    );
  });

  it('filters search, attention and optional work and paginates by cursor', async () => {
    releaseFindMany.mockResolvedValue([
      release('revision', {
        title: 'Kyivan Rus quiz',
        status: TestStudentStatus.NEEDS_REVISION,
      }),
      release('optional', {
        title: 'Rome practice',
        isRequired: false,
      }),
      release('second', { title: 'Kyivan Rus map' }),
    ]);

    const attention = await service.getTasks(student, {
      status: StudentTasksStatusFilter.ATTENTION,
    });
    const optional = await service.getTasks(student, {
      required: StudentTasksRequiredFilter.OPTIONAL,
    });
    const first = await service.getTasks(student, {
      search: 'kyivan',
      limit: 1,
    });
    const second = await service.getTasks(student, {
      search: 'kyivan',
      limit: 1,
      cursor: first.nextCursor ?? undefined,
    });

    expect(attention.items.map(({ releaseId }) => releaseId)).toEqual([
      'revision',
    ]);
    expect(optional.items.map(({ releaseId }) => releaseId)).toEqual([
      'optional',
    ]);
    expect(first.nextCursor).not.toBeNull();
    expect(second.items).toHaveLength(1);
    expect(second.items[0]?.releaseId).not.toBe(first.items[0]?.releaseId);
    const query = JSON.stringify(releaseFindMany.mock.calls[0]);
    expect(query).not.toContain('items');
    expect(query).not.toContain('solution');
    expect(query).toContain(TestReleaseStatus.SCHEDULED);
    expect(query).not.toContain(TestReleaseStatus.DRAFT);
    expect(query).not.toContain(TestReleaseStatus.ARCHIVED);
  });
});

function release(
  id: string,
  options: {
    availableFrom?: Date;
    dueAt?: Date;
    isRequired?: boolean;
    latePolicy?: TestLatePolicy;
    releaseStatus?: TestReleaseStatus;
    scorePercent?: number;
    status?: TestStudentStatus;
    title?: string;
  } = {},
) {
  const status = options.status;
  const hasState = status !== undefined;
  return {
    id,
    testId: `test-${id}`,
    status: options.releaseStatus ?? TestReleaseStatus.ACTIVE,
    isRequired: options.isRequired ?? true,
    availableFrom: options.availableFrom ?? null,
    dueAt: options.dueAt ?? null,
    maxPoints: 10,
    latePolicy: options.latePolicy ?? TestLatePolicy.DISALLOW,
    updatedAt: new Date('2026-09-09T10:00:00.000Z'),
    revision: { title: options.title ?? id, description: `${id} description` },
    lesson: {
      id: 'lesson-1',
      title: 'Early states',
      classLinks: [{ position: 1 }],
    },
    studentStates: hasState
      ? [
          {
            status,
            attemptCount: 1,
            scorePoints: options.scorePercent ? 8 : null,
            scorePercent: options.scorePercent ?? null,
            bestPoints: options.scorePercent ? 8 : null,
            bestPercent: options.scorePercent ?? null,
            lastActivityAt: new Date('2026-09-09T10:00:00.000Z'),
          },
        ]
      : [],
  };
}
