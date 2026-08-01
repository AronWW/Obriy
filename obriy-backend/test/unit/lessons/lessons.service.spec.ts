import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { LessonStatus, Locale, UserRole, UserStatus } from '@prisma/client';
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
  const prisma = {
    user: { findUnique: userFindUnique },
    lesson: {
      create: lessonCreate,
      findFirst: lessonFindFirst,
      findMany: lessonFindMany,
    },
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
});
