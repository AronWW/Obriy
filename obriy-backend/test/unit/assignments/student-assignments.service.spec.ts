import { ForbiddenException } from '@nestjs/common';
import {
  AssignmentAttemptStatus,
  AssignmentLatePolicy,
  AssignmentReleaseStatus,
  AssignmentStudentStatus,
  AssignmentType,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import { StudentAssignmentsService } from '../../../src/assignments/student-assignments.service';

describe('StudentAssignmentsService', () => {
  const classLessonFindFirst = jest.fn();
  const classLessonFindUnique = jest.fn();
  const releaseFindMany = jest.fn();
  const releaseFindFirst = jest.fn();
  const stateFindMany = jest.fn();
  const stateFindUnique = jest.fn();
  const stateUpsert = jest.fn();
  const stateUpdate = jest.fn();
  const attemptCreate = jest.fn();
  const attemptUpdate = jest.fn();
  const queryRaw = jest.fn();
  const transaction = {
    $queryRaw: queryRaw,
    classLesson: {
      findUnique: classLessonFindUnique,
    },
    assignmentRelease: {
      findFirst: releaseFindFirst,
    },
    assignmentStudentState: {
      findUnique: stateFindUnique,
      upsert: stateUpsert,
      update: stateUpdate,
    },
    assignmentAttempt: {
      create: attemptCreate,
      update: attemptUpdate,
    },
  };
  const runTransaction = jest.fn();
  const prisma = {
    classLesson: { findFirst: classLessonFindFirst },
    assignmentRelease: { findMany: releaseFindMany },
    assignmentStudentState: { findMany: stateFindMany },
    $transaction: runTransaction,
  } as unknown as PrismaService;
  const service = new StudentAssignmentsService(prisma);

  const student: AuthUser = {
    id: 'student-1',
    email: 'student@example.com',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  };
  const teacher: AuthUser = {
    id: 'teacher-1',
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
    status: UserStatus.ACTIVE,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    runTransaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
    classLessonFindUnique.mockResolvedValue({ publishedAt: new Date() });
    releaseFindFirst.mockResolvedValue(studentRelease());
    stateUpsert.mockResolvedValue({ id: 'state-1' });
    queryRaw.mockResolvedValue([{ id: 'state-1' }]);
  });

  it('rejects a teacher before reading student assignment data', async () => {
    await expect(
      service.listLessonAssignments(teacher, 'lesson-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(classLessonFindFirst).not.toHaveBeenCalled();
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('lists only the student-safe revision data with the latest attempt', async () => {
    const now = new Date('2026-08-13T12:00:00.000Z');
    classLessonFindFirst.mockResolvedValue({ classId: 'class-1' });
    releaseFindMany.mockResolvedValue([studentRelease()]);
    stateFindMany.mockResolvedValue([
      {
        releaseId: 'release-1',
        status: AssignmentStudentStatus.IN_PROGRESS,
        attempts: [attemptRecord({ updatedAt: now })],
      },
    ]);

    const result = await service.listLessonAssignments(student, 'lesson-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      releaseId: 'release-1',
      title: 'Historical reflection',
      stateStatus: AssignmentStudentStatus.IN_PROGRESS,
    });
    expect(result[0]?.attempt).toMatchObject({ responseText: 'Saved answer' });
    expect(JSON.stringify(result)).not.toContain('gradingConfig');
    expect(JSON.stringify(result)).not.toContain('solution');
    const releaseCalls = releaseFindMany.mock.calls as unknown[][];
    const releaseQuery = releaseCalls[0]?.[0];
    expect(releaseQuery).toMatchObject({
      where: {
        classId: 'class-1',
        lessonId: 'lesson-1',
        status: AssignmentReleaseStatus.ACTIVE,
      },
    });
  });

  it('derives an expired state when late submissions are disallowed', async () => {
    classLessonFindFirst.mockResolvedValue({ classId: 'class-1' });
    releaseFindMany.mockResolvedValue([
      studentRelease({
        dueAt: new Date('2020-01-01T00:00:00.000Z'),
        latePolicy: AssignmentLatePolicy.DISALLOW,
      }),
    ]);
    stateFindMany.mockResolvedValue([]);

    const result = await service.listLessonAssignments(student, 'lesson-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      releaseId: 'release-1',
      stateStatus: AssignmentStudentStatus.EXPIRED,
    });
  });

  it('creates one in-progress attempt and saves a written draft', async () => {
    stateFindUnique.mockResolvedValue({
      id: 'state-1',
      status: AssignmentStudentStatus.NOT_STARTED,
      attemptCount: 0,
      startedAt: null,
      attempts: [],
    });
    attemptCreate.mockResolvedValue(
      attemptRecord({ responseData: { text: '' } }),
    );
    attemptUpdate.mockResolvedValue(
      attemptRecord({
        responseData: { text: 'Saved answer', attachmentIds: [] },
      }),
    );

    await expect(
      service.saveDraft(student, 'release-1', { text: 'Saved answer' }),
    ).resolves.toMatchObject({
      id: 'attempt-1',
      status: AssignmentAttemptStatus.IN_PROGRESS,
      responseText: 'Saved answer',
    });

    const createCalls = attemptCreate.mock.calls as unknown[][];
    const createInput = createCalls[0]?.[0];
    expect(createInput).toMatchObject({
      data: {
        attemptNumber: 1,
        revisionId: 'revision-1',
        studentStateId: 'state-1',
      },
    });
    const updateCalls = attemptUpdate.mock.calls as unknown[][];
    const updateInput = updateCalls[0]?.[0];
    expect(updateInput).toMatchObject({
      data: { responseData: { text: 'Saved answer', attachmentIds: [] } },
    });
  });

  it('rejects an empty final submission before creating an attempt', async () => {
    await expect(
      service.submit(student, 'release-1', { text: '   ' }),
    ).rejects.toMatchObject({
      response: { code: 'ASSIGNMENT_RESPONSE_REQUIRED' },
    });

    expect(stateUpsert).not.toHaveBeenCalled();
    expect(attemptCreate).not.toHaveBeenCalled();
  });

  it('returns the same attempt for an identical submission retry', async () => {
    stateFindUnique.mockResolvedValue({
      id: 'state-1',
      status: AssignmentStudentStatus.AWAITING_REVIEW,
      attempts: [
        attemptRecord({
          status: AssignmentAttemptStatus.AWAITING_REVIEW,
          submittedAt: new Date('2026-08-13T12:00:00.000Z'),
        }),
      ],
    });

    await expect(
      service.submit(student, 'release-1', { text: 'Saved answer' }),
    ).resolves.toMatchObject({
      id: 'attempt-1',
      status: AssignmentAttemptStatus.AWAITING_REVIEW,
      responseText: 'Saved answer',
    });

    expect(stateUpsert).not.toHaveBeenCalled();
    expect(attemptUpdate).not.toHaveBeenCalled();
  });
});

function studentRelease(overrides: Record<string, unknown> = {}) {
  return {
    id: 'release-1',
    assignmentId: 'assignment-1',
    revisionId: 'revision-1',
    status: AssignmentReleaseStatus.ACTIVE,
    maxPoints: new Prisma.Decimal(5),
    passingPercent: new Prisma.Decimal(60),
    isRequired: true,
    availableFrom: null,
    dueAt: null,
    maxAttempts: null,
    latePolicy: AssignmentLatePolicy.ALLOW,
    classId: 'class-1',
    lessonId: 'lesson-1',
    assignment: { type: AssignmentType.WRITTEN },
    revision: {
      title: 'Historical reflection',
      prompt: 'Explain why this event mattered.',
      instructions: null,
      publicConfig: {
        responseMode: 'LONG',
        minLength: 0,
        maxLength: 5_000,
        allowAttachments: false,
        rubric: [],
      },
      schemaVersion: 1,
    },
    ...overrides,
  };
}

function attemptRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'attempt-1',
    attemptNumber: 1,
    status: AssignmentAttemptStatus.IN_PROGRESS,
    responseData: { text: 'Saved answer', attachmentIds: [] },
    teacherComment: null,
    scorePoints: null,
    scorePercent: null,
    isPassed: null,
    submittedAt: null,
    reviewedAt: null,
    updatedAt: new Date('2026-08-13T12:00:00.000Z'),
    ...overrides,
  };
}
