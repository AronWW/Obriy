import { ForbiddenException } from '@nestjs/common';
import {
  LessonStatus,
  LessonTaskSubmissionStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import { LessonTasksService } from '../../../src/lessons/lesson-tasks.service';

describe('LessonTasksService boundaries', () => {
  const lessonFindFirst = jest.fn();
  const taskFindMany = jest.fn();
  const taskFindFirst = jest.fn();
  const taskAggregate = jest.fn();
  const taskCreate = jest.fn();
  const taskDelete = jest.fn();
  const userFindUnique = jest.fn();
  const classLessonFindFirst = jest.fn();
  const submissionFindUnique = jest.fn();
  const submissionFindMany = jest.fn();
  const queryRaw = jest.fn();
  const transaction = {
    $queryRaw: queryRaw,
    lessonTask: {
      findFirst: taskFindFirst,
      aggregate: taskAggregate,
      create: taskCreate,
      delete: taskDelete,
    },
    user: { findUnique: userFindUnique },
    classLesson: { findFirst: classLessonFindFirst },
    lessonTaskSubmission: { findUnique: submissionFindUnique },
  };
  const runTransaction = jest.fn(
    async (callback: (client: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
  );
  const prisma = {
    lesson: { findFirst: lessonFindFirst },
    lessonTask: { findMany: taskFindMany },
    lessonTaskSubmission: { findMany: submissionFindMany },
    $transaction: runTransaction,
  } as unknown as PrismaService;
  const service = new LessonTasksService(prisma);
  const teacher: AuthUser = {
    id: 'teacher-1',
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
    status: UserStatus.ACTIVE,
  };
  const student: AuthUser = {
    id: 'student-1',
    email: 'student@example.com',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    runTransaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
  });

  it('rejects a non-teacher before listing task data', async () => {
    await expect(
      service.listLessonTasks(student, 'lesson-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(lessonFindFirst).not.toHaveBeenCalled();
  });

  it('does not disclose tasks of a foreign lesson', async () => {
    lessonFindFirst.mockResolvedValue(null);

    await expect(
      service.listLessonTasks(teacher, 'foreign-lesson'),
    ).rejects.toMatchObject({ response: { code: 'LESSON_NOT_FOUND' } });
    expect(taskFindMany).not.toHaveBeenCalled();
  });

  it('guards deletion when a task already has submissions', async () => {
    queryRaw.mockResolvedValue([
      { id: 'lesson-1', status: LessonStatus.PUBLISHED },
    ]);
    taskFindFirst.mockResolvedValue({
      id: 'task-1',
      _count: { submissions: 1 },
    });

    await expect(
      service.deleteLessonTask(teacher, 'lesson-1', 'task-1'),
    ).rejects.toMatchObject({
      response: { code: 'LESSON_TASK_HAS_SUBMISSIONS' },
    });
    expect(taskDelete).not.toHaveBeenCalled();
  });

  it('does not create tasks in an archived lesson', async () => {
    queryRaw.mockResolvedValue([
      { id: 'lesson-1', status: LessonStatus.ARCHIVED },
    ]);

    await expect(
      service.createLessonTask(teacher, 'lesson-1', {
        title: 'Question',
        prompt: 'Answer it',
      }),
    ).rejects.toMatchObject({ response: { code: 'LESSON_ARCHIVED' } });
    expect(taskAggregate).not.toHaveBeenCalled();
    expect(taskCreate).not.toHaveBeenCalled();
  });

  it('locks an approved submission against student resubmission', async () => {
    userFindUnique.mockResolvedValue({ studentClassId: 'class-1' });
    queryRaw.mockResolvedValue([
      { id: 'lesson-1', status: LessonStatus.PUBLISHED },
    ]);
    classLessonFindFirst.mockResolvedValue({ classId: 'class-1' });
    taskFindFirst.mockResolvedValue({ id: 'task-1' });
    submissionFindUnique.mockResolvedValue({
      id: 'submission-1',
      status: LessonTaskSubmissionStatus.APPROVED,
    });

    await expect(
      service.submitLessonTask(student, 'lesson-1', 'task-1', {
        answerText: 'Updated answer',
      }),
    ).rejects.toMatchObject({
      response: { code: 'TASK_SUBMISSION_APPROVED' },
    });
  });

  it('maps teacher submissions without private student fields', async () => {
    const now = new Date('2026-08-01T12:00:00.000Z');
    lessonFindFirst.mockResolvedValue({ id: 'lesson-1' });
    submissionFindMany.mockResolvedValue([
      {
        id: 'submission-1',
        taskId: 'task-1',
        answerText: 'Student answer',
        status: LessonTaskSubmissionStatus.SUBMITTED,
        teacherComment: null,
        submittedAt: now,
        reviewedAt: null,
        updatedAt: now,
        task: { title: 'Question', position: 1, isRequired: true },
        student: {
          id: student.id,
          email: 'must-not-leak@example.com',
          profile: { displayName: 'Student Example' },
        },
        class: { id: 'class-1', name: '8-A' },
      },
    ]);

    await expect(
      service.listLessonTaskSubmissions(teacher, 'lesson-1'),
    ).resolves.toEqual([
      {
        id: 'submission-1',
        taskId: 'task-1',
        taskTitle: 'Question',
        taskPosition: 1,
        taskIsRequired: true,
        student: { id: student.id, displayName: 'Student Example' },
        class: { id: 'class-1', name: '8-A' },
        answerText: 'Student answer',
        status: LessonTaskSubmissionStatus.SUBMITTED,
        teacherComment: null,
        submittedAt: now,
        reviewedAt: null,
        updatedAt: now,
      },
    ]);
  });
});
