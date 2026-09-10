import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  TestLatePolicy,
  TestReleaseStatus,
  TestStudentStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import { TeacherTestReleasesService } from '../../../src/tests/teacher-test-releases.service';

describe('TeacherTestReleasesService', () => {
  const lessonTestFindFirst = jest.fn();
  const releaseFindMany = jest.fn();
  const releaseFindFirst = jest.fn();
  const releaseUpdate = jest.fn();
  const classLessonFindUnique = jest.fn();
  const queryRaw = jest.fn().mockResolvedValue([]);
  const prisma = {
    lessonTest: { findFirst: lessonTestFindFirst },
    testRelease: {
      findMany: releaseFindMany,
      findFirst: releaseFindFirst,
      update: releaseUpdate,
    },
    classLesson: { findUnique: classLessonFindUnique },
    $queryRaw: queryRaw,
    $transaction: jest.fn(
      (callback: (client: PrismaService) => Promise<unknown>) =>
        callback(prisma),
    ),
  } as unknown as PrismaService;
  const service = new TeacherTestReleasesService(prisma);
  const teacher: AuthUser = {
    id: 'teacher-1',
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
    status: UserStatus.ACTIVE,
  };

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-10T12:00:00.000Z'));
  });

  afterAll(() => jest.useRealTimers());
  afterEach(() => jest.clearAllMocks());

  it('rejects non-teachers before reading a release', async () => {
    await expect(
      service.list(
        { ...teacher, role: UserRole.STUDENT },
        'lesson-1',
        'test-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(lessonTestFindFirst).not.toHaveBeenCalled();
  });

  it('hides a foreign lesson-test link behind 404', async () => {
    lessonTestFindFirst.mockResolvedValue(null);
    await expect(
      service.list(teacher, 'lesson-1', 'test-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(JSON.stringify(lessonTestFindFirst.mock.calls[0])).toContain(
      teacher.id,
    );
  });

  it('rejects an invalid date order without updating the release', async () => {
    const release = releaseRecord();
    releaseFindFirst.mockResolvedValue(release);

    await expect(
      service.update(teacher, release.id, {
        availableFrom: '2026-09-12T12:00:00.000Z',
        dueAt: '2026-09-11T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(releaseUpdate).not.toHaveBeenCalled();
  });

  it('does not move opening into the future after attempts have started', async () => {
    const release = releaseRecord({
      studentStates: [
        { attemptCount: 1, status: TestStudentStatus.IN_PROGRESS },
      ],
    });
    releaseFindFirst.mockResolvedValue(release);

    await expect(
      service.update(teacher, release.id, {
        availableFrom: '2026-09-12T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(releaseUpdate).not.toHaveBeenCalled();
  });

  it('publishes a configured future release as scheduled', async () => {
    const draft = releaseRecord({
      availableFrom: new Date('2026-09-12T12:00:00.000Z'),
    });
    const scheduled = releaseRecord({
      ...draft,
      status: TestReleaseStatus.SCHEDULED,
      publishedAt: new Date('2026-09-10T12:00:00.000Z'),
    });
    releaseFindFirst
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(scheduled);
    classLessonFindUnique.mockResolvedValue({
      publishedAt: new Date('2026-09-01T12:00:00.000Z'),
    });
    releaseUpdate.mockResolvedValue(scheduled);

    await expect(service.publish(teacher, draft.id)).resolves.toMatchObject({
      status: TestReleaseStatus.SCHEDULED,
      xpReward: 100,
    });
    expect(releaseUpdate).toHaveBeenCalledWith({
      where: { id: draft.id },
      data: {
        status: TestReleaseStatus.SCHEDULED,
        publishedAt: new Date('2026-09-10T12:00:00.000Z'),
        closedAt: null,
      },
    });
  });
});

function releaseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'release-1',
    lessonId: 'lesson-1',
    testId: 'test-1',
    testRevisionId: 'revision-1',
    status: TestReleaseStatus.DRAFT,
    isRequired: true,
    availableFrom: null,
    dueAt: null,
    maxAttempts: 1,
    latePolicy: TestLatePolicy.DISALLOW,
    latePenaltyPercent: null,
    xpReward: 100,
    publishedAt: null,
    closedAt: null,
    updatedAt: new Date('2026-09-10T10:00:00.000Z'),
    class: { id: 'class-1', name: 'History class' },
    studentStates: [],
    ...overrides,
  };
}
