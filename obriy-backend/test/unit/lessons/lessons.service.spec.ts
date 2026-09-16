import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  LessonStatus,
  Locale,
  TestLatePolicy,
  TestReleaseStatus,
  TestStudentStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import { LessonsService } from '../../../src/lessons/lessons.service';

describe('LessonsService access and draft boundaries', () => {
  const userFindUnique = jest.fn();
  const lessonCreate = jest.fn<
    Promise<unknown>,
    [{ data: Record<string, unknown>; include: unknown }]
  >();
  const lessonFindFirst = jest.fn();
  const lessonFindMany = jest.fn();
  const classLessonFindMany = jest.fn();
  const classLessonFindFirst = jest.fn();
  const testReleaseFindMany = jest.fn();
  const prisma = {
    user: { findUnique: userFindUnique },
    lesson: {
      create: lessonCreate,
      findFirst: lessonFindFirst,
      findMany: lessonFindMany,
    },
    classLesson: {
      findMany: classLessonFindMany,
      findFirst: classLessonFindFirst,
    },
    testRelease: { findMany: testReleaseFindMany },
  } as unknown as PrismaService;
  const service = new LessonsService(prisma);
  const teacher: AuthUser = {
    id: 'teacher-1',
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
    status: UserStatus.ACTIVE,
  };
  const student: AuthUser = {
    ...teacher,
    id: 'student-1',
    email: 'student@example.com',
    role: UserRole.STUDENT,
  };

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('rejects non-teachers before reading lesson data', async () => {
    await expect(service.listMyLessons(student, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(lessonFindMany).not.toHaveBeenCalled();
  });

  it('does not create an empty or locale-only draft', async () => {
    await expect(service.createLesson(teacher, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.createLesson(teacher, {
        title: '   ',
        summary: '\n',
        content: '',
        contentLocale: Locale.EN,
      }),
    ).rejects.toMatchObject({ response: { code: 'EMPTY_LESSON_DRAFT' } });
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it('creates an incomplete meaningful draft in the profile locale', async () => {
    const createdAt = new Date('2026-08-01T12:00:00.000Z');
    userFindUnique.mockResolvedValue({
      profile: { preferredLocale: Locale.EN },
    });
    lessonCreate.mockResolvedValue({
      id: 'lesson-1',
      teacherId: teacher.id,
      title: 'First lesson',
      summary: '',
      content: '',
      contentLocale: Locale.EN,
      estimatedMinutes: null,
      status: LessonStatus.DRAFT,
      moderationStatus: 'CLEAR',
      moderationCases: [],
      createdAt,
      updatedAt: createdAt,
      classLinks: [],
    });

    await expect(
      service.createLesson(teacher, { title: '  First lesson  ' }),
    ).resolves.toEqual({
      id: 'lesson-1',
      title: 'First lesson',
      summary: '',
      content: '',
      contentLocale: Locale.EN,
      estimatedMinutes: null,
      status: LessonStatus.DRAFT,
      moderationStatus: 'CLEAR',
      moderation: null,
      createdAt,
      updatedAt: createdAt,
      classLinks: [],
    });
    const createCall = lessonCreate.mock.calls[0]?.[0];
    if (!createCall) {
      throw new Error('Expected Prisma lesson.create arguments');
    }
    const data = createCall.data;
    expect(data).toEqual(
      expect.objectContaining({
        teacherId: teacher.id,
        title: 'First lesson',
        summary: '',
        content: '',
        contentLocale: Locale.EN,
        estimatedMinutes: null,
      }),
    );
  });

  it('does not reveal a lesson owned by another teacher', async () => {
    lessonFindFirst.mockResolvedValue(null);

    await expect(
      service.findMyLesson(teacher, 'foreign-lesson'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(lessonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'foreign-lesson', teacherId: teacher.id },
      }),
    );
  });

  it('rejects non-students before reading student class data', async () => {
    await expect(service.listMyStudentLessons(teacher)).rejects.toMatchObject({
      response: { code: 'ROLE_FORBIDDEN' },
    });
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(classLessonFindMany).not.toHaveBeenCalled();
  });

  it('returns an empty lesson list when the student has no class', async () => {
    userFindUnique.mockResolvedValue({ studentClassId: null });

    await expect(service.listMyStudentLessons(student)).resolves.toEqual([]);
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: student.id },
      select: { studentClassId: true },
    });
    expect(classLessonFindMany).not.toHaveBeenCalled();
  });

  it('lists only explicitly selected published lesson summaries in stable order', async () => {
    userFindUnique.mockResolvedValue({ studentClassId: 'class-1' });
    classLessonFindMany.mockResolvedValue([
      {
        lessonId: 'lesson-a',
        position: 1,
        lesson: {
          id: 'lesson-a',
          title: 'First lesson',
          summary: 'First summary',
          contentLocale: Locale.UK,
          estimatedMinutes: null,
          content: 'must not leak',
          teacherId: 'must not leak',
        },
      },
      {
        lessonId: 'lesson-b',
        position: 2,
        lesson: {
          id: 'lesson-b',
          title: 'Second lesson',
          summary: 'Second summary',
          contentLocale: Locale.EN,
          estimatedMinutes: 20,
        },
      },
    ]);
    testReleaseFindMany.mockResolvedValue([
      {
        lessonId: 'lesson-a',
        dueAt: null,
        latePolicy: TestLatePolicy.DISALLOW,
        studentStates: [{ status: TestStudentStatus.AWAITING_REVIEW }],
      },
      {
        lessonId: 'lesson-b',
        dueAt: null,
        latePolicy: TestLatePolicy.DISALLOW,
        studentStates: [{ status: TestStudentStatus.COMPLETED }],
      },
    ]);

    await expect(service.listMyStudentLessons(student)).resolves.toEqual([
      {
        id: 'lesson-a',
        title: 'First lesson',
        summary: 'First summary',
        contentLocale: Locale.UK,
        estimatedMinutes: null,
        position: 1,
        progress: {
          status: 'IN_PROGRESS',
          requiredTotal: 1,
          completed: 0,
          awaitingReview: 1,
          needsRevision: 0,
          inProgress: 0,
          expired: 0,
        },
      },
      {
        id: 'lesson-b',
        title: 'Second lesson',
        summary: 'Second summary',
        contentLocale: Locale.EN,
        estimatedMinutes: 20,
        position: 2,
        progress: {
          status: 'COMPLETED',
          requiredTotal: 1,
          completed: 1,
          awaitingReview: 0,
          needsRevision: 0,
          inProgress: 0,
          expired: 0,
        },
      },
    ]);

    expect(classLessonFindMany).toHaveBeenCalledWith({
      where: {
        classId: 'class-1',
        publishedAt: { not: null },
        lesson: {
          status: LessonStatus.PUBLISHED,
          moderationStatus: 'CLEAR',
        },
      },
      orderBy: [{ position: 'asc' }, { lessonId: 'asc' }],
      select: {
        lessonId: true,
        position: true,
        lesson: {
          select: {
            id: true,
            title: true,
            summary: true,
            contentLocale: true,
            estimatedMinutes: true,
          },
        },
      },
    });
    expect(testReleaseFindMany).toHaveBeenCalledWith({
      where: {
        lessonId: { in: ['lesson-a', 'lesson-b'] },
        classId: 'class-1',
        status: TestReleaseStatus.ACTIVE,
        isRequired: true,
      },
      select: {
        lessonId: true,
        dueAt: true,
        latePolicy: true,
        studentStates: {
          where: { studentId: student.id },
          take: 1,
          select: { status: true },
        },
      },
    });
  });

  it('returns a non-disclosing 404 when a student lesson is unavailable', async () => {
    userFindUnique.mockResolvedValue({ studentClassId: 'class-1' });
    classLessonFindFirst.mockResolvedValue(null);

    await expect(
      service.findMyStudentLesson(student, 'hidden-lesson'),
    ).rejects.toMatchObject({ response: { code: 'LESSON_NOT_FOUND' } });
    expect(classLessonFindFirst).toHaveBeenCalledWith({
      where: {
        classId: 'class-1',
        lessonId: 'hidden-lesson',
        publishedAt: { not: null },
        lesson: {
          status: LessonStatus.PUBLISHED,
          moderationStatus: 'CLEAR',
        },
      },
      select: {
        position: true,
        class: { select: { id: true, name: true } },
        lesson: {
          select: {
            id: true,
            title: true,
            summary: true,
            content: true,
            contentLocale: true,
            estimatedMinutes: true,
            teacher: {
              select: {
                id: true,
                profile: { select: { displayName: true } },
              },
            },
          },
        },
      },
    });
  });

  it('maps a student lesson detail explicitly without teacher email', async () => {
    const content = 'First paragraph\n\n  Second paragraph  ';
    userFindUnique.mockResolvedValue({ studentClassId: 'class-1' });
    classLessonFindFirst.mockResolvedValue({
      position: 3,
      class: { id: 'class-1', name: 'Robotics' },
      lesson: {
        id: 'lesson-1',
        title: 'Circuits',
        summary: 'A practical introduction',
        content,
        contentLocale: Locale.EN,
        estimatedMinutes: 15,
        teacher: {
          id: 'teacher-1',
          email: 'must-not-leak@example.com',
          profile: { displayName: 'Ms Rivera' },
        },
      },
    });
    testReleaseFindMany.mockResolvedValue([
      {
        lessonId: 'lesson-1',
        dueAt: null,
        latePolicy: TestLatePolicy.DISALLOW,
        studentStates: [],
      },
    ]);

    await expect(
      service.findMyStudentLesson(student, 'lesson-1'),
    ).resolves.toEqual({
      id: 'lesson-1',
      title: 'Circuits',
      summary: 'A practical introduction',
      contentLocale: Locale.EN,
      estimatedMinutes: 15,
      position: 3,
      progress: {
        status: 'NOT_STARTED',
        requiredTotal: 1,
        completed: 0,
        awaitingReview: 0,
        needsRevision: 0,
        inProgress: 0,
        expired: 0,
      },
      content,
      class: { id: 'class-1', name: 'Robotics' },
      teacher: { id: 'teacher-1', displayName: 'Ms Rivera' },
    });
  });
});
