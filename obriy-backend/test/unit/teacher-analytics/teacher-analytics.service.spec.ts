import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  TestAttemptStatus,
  TestReleaseStatus,
  TestStudentStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import { TeacherAnalyticsService } from '../../../src/teacher-analytics/teacher-analytics.service';

describe('TeacherAnalyticsService', () => {
  const classFindFirst = jest.fn();
  const userFindMany = jest.fn();
  const userFindFirst = jest.fn();
  const classLessonFindMany = jest.fn();
  const releaseFindMany = jest.fn();
  const transaction = jest.fn((operations: Promise<unknown>[]) =>
    Promise.all(operations),
  );
  const prisma = {
    class: { findFirst: classFindFirst },
    user: { findMany: userFindMany, findFirst: userFindFirst },
    classLesson: { findMany: classLessonFindMany },
    testRelease: { findMany: releaseFindMany },
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new TeacherAnalyticsService(prisma);
  const teacher: AuthUser = {
    id: 'teacher-1',
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
    status: UserStatus.ACTIVE,
  };

  beforeEach(() => {
    classFindFirst.mockResolvedValue({ id: 'class-1', name: 'History club' });
    classLessonFindMany.mockResolvedValue([lessonLink()]);
  });

  afterEach(() => jest.clearAllMocks());

  it('rejects non-teachers before reading a class', async () => {
    await expect(
      service.getClassAnalytics(
        { ...teacher, role: UserRole.STUDENT },
        'class-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(classFindFirst).not.toHaveBeenCalled();
  });

  it('hides a class that is not owned by the teacher', async () => {
    classFindFirst.mockResolvedValue(null);
    await expect(
      service.getClassAnalytics(teacher, 'foreign-class'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(userFindMany).not.toHaveBeenCalled();
  });

  it('calculates required completion, zero scores and review exclusions', async () => {
    userFindMany.mockResolvedValue([
      student('student-1', 'Marta'),
      student('student-2', 'Oleh'),
    ]);
    releaseFindMany.mockResolvedValue(overviewReleases());

    const result = await service.getClassAnalytics(teacher, 'class-1');

    expect(result.metrics).toEqual(
      expect.objectContaining({
        studentCount: 2,
        requiredReleaseCount: 2,
        requiredWorkCount: 4,
        completedWorkCount: 1,
        completionPercent: 25,
        averagePercent: 26.67,
        awaitingReviewCount: 1,
      }),
    );
    expect(result.students[0]).toEqual(
      expect.objectContaining({
        id: 'student-1',
        requiredCount: 2,
        completedCount: 1,
        completionPercent: 50,
        averagePercent: 40,
      }),
    );
    expect(result.students[1]).toEqual(
      expect.objectContaining({
        id: 'student-2',
        completionPercent: 0,
        averagePercent: 0,
      }),
    );
    expect(result.students[1]?.statuses.awaitingReview).toBe(1);
    expect(result.students[1]?.statuses.notStarted).toBe(1);
    expect(result.lessons[0]?.tests.map(({ testId }) => testId)).toEqual([
      'test-required',
      'test-scheduled',
      'test-optional',
    ]);
    expect(result.lessons[0]?.tests[2]).toEqual(
      expect.objectContaining({
        isRequired: false,
        completionPercent: 0,
        averagePercent: 25,
      }),
    );
    const query = JSON.stringify(releaseFindMany.mock.calls[0]);
    expect(query).toContain(TestReleaseStatus.SCHEDULED);
    expect(query).toContain(TestReleaseStatus.ACTIVE);
    expect(query).toContain(TestReleaseStatus.CLOSED);
    expect(query).not.toContain(TestReleaseStatus.ARCHIVED);
    expect(query).not.toContain(TestReleaseStatus.DRAFT);
  });

  it('returns null percentages when there are no required student-work pairs', async () => {
    userFindMany.mockResolvedValue([]);
    releaseFindMany.mockResolvedValue([overviewReleases()[2]]);

    const result = await service.getClassAnalytics(teacher, 'class-1');

    expect(result.metrics).toEqual(
      expect.objectContaining({
        requiredReleaseCount: 0,
        requiredWorkCount: 0,
        completionPercent: null,
        averagePercent: null,
      }),
    );
  });

  it('keeps every included release and its attempt history', async () => {
    userFindMany.mockResolvedValue([student('student-1', 'Marta')]);
    const first = overviewReleases()[0];
    releaseFindMany.mockResolvedValue([
      first,
      {
        ...first,
        id: 'release-required-older',
        status: TestReleaseStatus.CLOSED,
        studentStates: [],
      },
    ]);

    const result = await service.getClassAnalytics(teacher, 'class-1');

    expect(result.metrics.requiredReleaseCount).toBe(2);
    expect(result.metrics.completionPercent).toBe(50);
    expect(result.lessons[0]?.tests.map(({ releaseId }) => releaseId)).toEqual([
      'release-required',
      'release-required-older',
    ]);
  });

  it('returns all attempts for an owned current student', async () => {
    userFindFirst.mockResolvedValue(student('student-1', 'Marta'));
    releaseFindMany.mockResolvedValue([
      {
        ...overviewReleases()[0],
        studentStates: [
          {
            ...overviewReleases()[0].studentStates[0],
            attempts: [
              {
                id: 'attempt-2',
                attemptNumber: 2,
                status: TestAttemptStatus.GRADED,
                maxPoints: 10,
                scorePoints: 8,
                scorePercent: 80,
                isPassed: true,
                pendingReviewCount: 0,
                isLate: false,
                startedAt: new Date('2026-09-02T09:00:00.000Z'),
                submittedAt: new Date('2026-09-02T09:30:00.000Z'),
                gradedAt: new Date('2026-09-02T09:30:00.000Z'),
              },
              {
                id: 'attempt-1',
                attemptNumber: 1,
                status: TestAttemptStatus.RETURNED,
                maxPoints: 10,
                scorePoints: null,
                scorePercent: null,
                isPassed: null,
                pendingReviewCount: 0,
                isLate: false,
                startedAt: new Date('2026-09-01T09:00:00.000Z'),
                submittedAt: new Date('2026-09-01T09:30:00.000Z'),
                gradedAt: null,
              },
            ],
          },
        ],
      },
    ]);

    const result = await service.getStudentAnalytics(
      teacher,
      'class-1',
      'student-1',
    );

    expect(result.student.displayName).toBe('Marta');
    expect(result.lessons[0]?.tests[0]?.attempts.map(({ id }) => id)).toEqual([
      'attempt-2',
      'attempt-1',
    ]);
    const query = JSON.stringify(releaseFindMany.mock.calls[0]);
    expect(query).toContain('"where":{"studentId":"student-1"}');
  });

  it('hides a student who no longer belongs to the class', async () => {
    userFindFirst.mockResolvedValue(null);
    releaseFindMany.mockResolvedValue([]);
    await expect(
      service.getStudentAnalytics(teacher, 'class-1', 'foreign-student'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function student(id: string, displayName: string) {
  return {
    id,
    profile: { displayName, avatarUrl: null },
  };
}

function lessonLink() {
  return {
    position: 1,
    lessonId: 'lesson-1',
    lesson: {
      id: 'lesson-1',
      title: 'Kyivan Rus',
      testLinks: [
        { testId: 'test-required', position: 1 },
        { testId: 'test-scheduled', position: 2 },
        { testId: 'test-optional', position: 3 },
      ],
    },
  };
}

function overviewReleases() {
  const date = new Date('2026-09-02T10:00:00.000Z');
  return [
    {
      id: 'release-required',
      testId: 'test-required',
      lessonId: 'lesson-1',
      status: TestReleaseStatus.ACTIVE,
      isRequired: true,
      availableFrom: null,
      dueAt: null,
      maxPoints: 10,
      passingPercent: 60,
      updatedAt: date,
      revision: { title: 'Required test' },
      studentStates: [
        {
          studentId: 'student-1',
          status: TestStudentStatus.COMPLETED,
          attemptCount: 1,
          scorePoints: 8,
          scorePercent: 80,
          bestPoints: 8,
          bestPercent: 80,
          isLate: false,
          lastActivityAt: date,
          submittedAt: date,
          completedAt: date,
        },
        {
          studentId: 'student-2',
          status: TestStudentStatus.AWAITING_REVIEW,
          attemptCount: 1,
          scorePoints: null,
          scorePercent: null,
          bestPoints: null,
          bestPercent: null,
          isLate: false,
          lastActivityAt: date,
          submittedAt: date,
          completedAt: null,
        },
      ],
    },
    {
      id: 'release-scheduled',
      testId: 'test-scheduled',
      lessonId: 'lesson-1',
      status: TestReleaseStatus.SCHEDULED,
      isRequired: true,
      availableFrom: new Date('2026-10-01T09:00:00.000Z'),
      dueAt: null,
      maxPoints: 10,
      passingPercent: 60,
      updatedAt: date,
      revision: { title: 'Scheduled test' },
      studentStates: [],
    },
    {
      id: 'release-optional',
      testId: 'test-optional',
      lessonId: 'lesson-1',
      status: TestReleaseStatus.CLOSED,
      isRequired: false,
      availableFrom: null,
      dueAt: date,
      maxPoints: 10,
      passingPercent: 60,
      updatedAt: date,
      revision: { title: 'Optional test' },
      studentStates: [
        {
          studentId: 'student-1',
          status: TestStudentStatus.NEEDS_REVISION,
          attemptCount: 1,
          scorePoints: 5,
          scorePercent: 50,
          bestPoints: 5,
          bestPercent: 50,
          isLate: false,
          lastActivityAt: date,
          submittedAt: date,
          completedAt: null,
        },
      ],
    },
  ];
}
