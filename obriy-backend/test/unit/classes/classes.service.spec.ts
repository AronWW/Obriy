import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import { ClassesService } from '../../../src/classes/classes.service';
import type { GamificationService } from '../../../src/gamification/gamification.service';

describe('ClassesService access boundaries', () => {
  const userFindUnique = jest.fn();
  const userFindFirst = jest.fn();
  const userFindMany = jest.fn();
  const classCreate = jest.fn();
  const classFindFirst = jest.fn();
  const classFindUnique = jest.fn();
  const prisma = {
    user: {
      findUnique: userFindUnique,
      findFirst: userFindFirst,
      findMany: userFindMany,
    },
    class: {
      create: classCreate,
      findFirst: classFindFirst,
      findUnique: classFindUnique,
    },
  } as unknown as PrismaService;
  const service = new ClassesService(prisma, {} as GamificationService);
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

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('rejects a non-teacher before listing teacher classes', async () => {
    await expect(service.listMyClasses(student)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('creates one permanent invite code together with the class', async () => {
    classCreate.mockImplementation(
      ({ data }: { data: { inviteCode: string; name: string } }) =>
        Promise.resolve({
          id: 'class-1',
          name: data.name,
          inviteCode: data.inviteCode,
          createdAt: new Date('2026-08-05T12:00:00.000Z'),
          updatedAt: new Date('2026-08-05T12:00:00.000Z'),
          _count: { students: 0 },
        }),
    );

    const created = await service.createClass(teacher, {
      name: 'Conversation club',
    });

    expect(created.invite.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(classCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          teacherId: teacher.id,
          name: 'Conversation club',
          inviteCode: created.invite.code,
        },
      }),
    );
  });

  it('returns the same stored invite code without rotating it', async () => {
    classFindFirst.mockResolvedValue({
      id: 'class-1',
      inviteCode: 'ABCD-EFGH',
      _count: { students: 0 },
    });

    await expect(service.findInvite(teacher, 'class-1')).resolves.toEqual({
      code: 'ABCD-EFGH',
    });
    await expect(service.findInvite(teacher, 'class-1')).resolves.toEqual({
      code: 'ABCD-EFGH',
    });
    expect(classCreate).not.toHaveBeenCalled();
  });

  it('returns only other students from the signed-in student class', async () => {
    userFindUnique.mockResolvedValue({ studentClassId: 'class-1' });
    userFindMany.mockResolvedValue([
      {
        id: 'student-2',
        profile: {
          displayName: 'Марія',
          avatarUrl: null,
        },
      },
    ]);

    await expect(service.listMyClassmates(student)).resolves.toEqual([
      {
        id: 'student-2',
        displayName: 'Марія',
        avatarUrl: null,
      },
    ]);

    expect(userFindMany).toHaveBeenCalledWith({
      where: {
        studentClassId: 'class-1',
        role: UserRole.STUDENT,
        id: { not: 'student-1' },
      },
      orderBy: [{ profile: { displayName: 'asc' } }, { id: 'asc' }],
      select: {
        id: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
  });

  it('does not reveal a profile outside the signed-in student class', async () => {
    userFindUnique.mockResolvedValue({ studentClassId: 'class-1' });
    userFindFirst.mockResolvedValue(null);

    await expect(
      service.findClassmateProfile(student, 'student-outside'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'student-outside',
          role: UserRole.STUDENT,
          studentClassId: 'class-1',
        },
      }),
    );
  });

  it('rejects an unknown or expired invitation without changing the user', async () => {
    userFindUnique.mockResolvedValue({ studentClassId: null });
    classFindUnique.mockResolvedValue(null);

    await expect(
      service.joinClass(student, 'ABCD-EFGH'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
