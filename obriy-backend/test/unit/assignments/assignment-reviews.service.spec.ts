import { ForbiddenException } from '@nestjs/common';
import {
  AssignmentAttemptStatus,
  AssignmentReviewAction,
  AssignmentStudentStatus,
  AssignmentType,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import { AssignmentReviewsService } from '../../../src/assignments/assignment-reviews.service';
import { AssignmentReviewDecision } from '../../../src/assignments/dto/review-assignment-attempt.dto';

describe('AssignmentReviewsService', () => {
  const lessonFindFirst = jest.fn();
  const stateFindMany = jest.fn();
  const attemptFindFirst = jest.fn();
  const attemptFindUnique = jest.fn();
  const attemptUpdate = jest.fn();
  const stateUpdate = jest.fn();
  const reviewEventCreate = jest.fn();
  const queryRaw = jest.fn();
  const transaction = {
    $queryRaw: queryRaw,
    assignmentAttempt: {
      findFirst: attemptFindFirst,
      findUnique: attemptFindUnique,
      update: attemptUpdate,
    },
    assignmentStudentState: { update: stateUpdate },
    assignmentReviewEvent: { create: reviewEventCreate },
  };
  const runTransaction = jest.fn();
  const prisma = {
    lesson: { findFirst: lessonFindFirst },
    assignmentStudentState: { findMany: stateFindMany },
    $transaction: runTransaction,
  } as unknown as PrismaService;
  const service = new AssignmentReviewsService(prisma);
  const teacher: AuthUser = {
    id: 'teacher-1',
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
    status: UserStatus.ACTIVE,
  };
  const student: AuthUser = {
    ...teacher,
    id: 'student-1',
    role: UserRole.STUDENT,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    runTransaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
    queryRaw.mockResolvedValue([{ id: 'locked' }]);
  });

  it('rejects a student before reading review data', async () => {
    await expect(
      service.listLessonReviews(student, 'lesson-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(lessonFindFirst).not.toHaveBeenCalled();
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('lists the latest submitted work without private student fields', async () => {
    lessonFindFirst.mockResolvedValue({ id: 'lesson-1' });
    stateFindMany.mockResolvedValue([listStateRecord()]);

    const result = await service.listLessonReviews(teacher, 'lesson-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      attemptId: 'attempt-1',
      assignmentTitle: 'Historical reflection',
      responseText: 'A submitted answer',
      status: AssignmentAttemptStatus.AWAITING_REVIEW,
      student: { id: 'student-1', displayName: 'Maksym Bondar' },
      class: { id: 'class-1', name: 'Grade 9-A' },
    });
    expect(JSON.stringify(result)).not.toContain('email');
    expect(JSON.stringify(result)).not.toContain('gradingConfig');
    expect(JSON.stringify(result)).not.toContain('solution');
  });

  it('awards a partial score, completes the state, and records an audit event', async () => {
    const awaiting = detailAttemptRecord();
    const graded = detailAttemptRecord({
      status: AssignmentAttemptStatus.GRADED,
      scorePoints: new Prisma.Decimal(3),
      scorePercent: new Prisma.Decimal(60),
      isPassed: true,
      teacherComment: 'Clear reasoning.',
      reviewedAt: new Date('2026-08-13T11:00:00.000Z'),
      studentState: {
        ...detailAttemptRecord().studentState,
        status: AssignmentStudentStatus.COMPLETED,
      },
    });
    attemptFindFirst.mockResolvedValue({ studentStateId: 'state-1' });
    attemptFindUnique
      .mockResolvedValueOnce(awaiting)
      .mockResolvedValueOnce(graded);

    await expect(
      service.review(teacher, 'attempt-1', {
        decision: AssignmentReviewDecision.APPROVED,
        scorePoints: 3,
        teacherComment: 'Clear reasoning.',
      }),
    ).resolves.toMatchObject({
      status: AssignmentAttemptStatus.GRADED,
      scorePoints: 3,
      scorePercent: 60,
      isPassed: true,
    });

    const attemptUpdateInput = getFirstCallArgument(attemptUpdate);
    expect(attemptUpdateInput).toMatchObject({
      where: { id: 'attempt-1' },
      data: {
        status: AssignmentAttemptStatus.GRADED,
        reviewedById: teacher.id,
        scorePoints: 3,
        scorePercent: 60,
        isPassed: true,
        teacherComment: 'Clear reasoning.',
      },
    });
    const stateUpdateInput = getFirstCallArgument(stateUpdate);
    expect(stateUpdateInput).toMatchObject({
      where: { id: 'state-1' },
      data: {
        status: AssignmentStudentStatus.COMPLETED,
        scorePoints: 3,
        scorePercent: 60,
        bestPoints: 3,
        bestPercent: 60,
      },
    });
    const eventInput = getFirstCallArgument(reviewEventCreate);
    expect(eventInput).toMatchObject({
      data: {
        attemptId: 'attempt-1',
        reviewerId: teacher.id,
        action: AssignmentReviewAction.APPROVED,
        comment: 'Clear reasoning.',
      },
    });
  });

  it('requires an actionable comment before returning work', async () => {
    await expect(
      service.review(teacher, 'attempt-1', {
        decision: AssignmentReviewDecision.RETURNED,
        teacherComment: '   ',
      }),
    ).rejects.toMatchObject({
      response: { code: 'ASSIGNMENT_REVIEW_COMMENT_REQUIRED' },
    });

    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('hides a foreign attempt behind a not-found response', async () => {
    attemptFindFirst.mockResolvedValue(null);

    await expect(
      service.review(teacher, 'foreign-attempt', {
        decision: AssignmentReviewDecision.APPROVED,
        scorePoints: 1,
      }),
    ).rejects.toMatchObject({
      response: { code: 'ASSIGNMENT_ATTEMPT_NOT_FOUND' },
    });

    expect(attemptUpdate).not.toHaveBeenCalled();
  });
});

function listStateRecord() {
  return {
    id: 'state-1',
    status: AssignmentStudentStatus.AWAITING_REVIEW,
    bestPoints: null,
    bestPercent: null,
    student: {
      id: 'student-1',
      profile: { displayName: 'Maksym Bondar' },
    },
    release: releaseRecord(),
    attempts: [baseAttemptRecord()],
  };
}

function detailAttemptRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...baseAttemptRecord(),
    studentStateId: 'state-1',
    studentState: {
      id: 'state-1',
      status: AssignmentStudentStatus.AWAITING_REVIEW,
      bestPoints: null,
      bestPercent: null,
      student: {
        id: 'student-1',
        profile: { displayName: 'Maksym Bondar' },
      },
      release: {
        ...releaseRecord(),
        lessonId: 'lesson-1',
        assignment: { type: AssignmentType.WRITTEN, teacherId: 'teacher-1' },
        lesson: { teacherId: 'teacher-1' },
      },
    },
    ...overrides,
  };
}

function releaseRecord() {
  return {
    id: 'release-1',
    assignmentId: 'assignment-1',
    maxPoints: new Prisma.Decimal(5),
    passingPercent: new Prisma.Decimal(60),
    class: { id: 'class-1', name: 'Grade 9-A' },
    assignment: { type: AssignmentType.WRITTEN },
    revision: {
      title: 'Historical reflection',
      prompt: 'Explain why the event mattered.',
    },
  };
}

function baseAttemptRecord() {
  return {
    id: 'attempt-1',
    attemptNumber: 1,
    status: AssignmentAttemptStatus.AWAITING_REVIEW,
    responseData: { text: 'A submitted answer', attachmentIds: [] },
    scorePoints: null,
    scorePercent: null,
    isPassed: null,
    teacherComment: null,
    submittedAt: new Date('2026-08-13T10:00:00.000Z'),
    reviewedAt: null,
    updatedAt: new Date('2026-08-13T10:00:00.000Z'),
  };
}

function getFirstCallArgument(mock: jest.Mock): unknown {
  const calls = mock.mock.calls as unknown[][];
  return calls[0]?.[0];
}
