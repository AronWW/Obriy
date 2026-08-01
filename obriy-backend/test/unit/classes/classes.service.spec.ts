import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import { ClassesService } from '../../../src/classes/classes.service';

describe('ClassesService access boundaries', () => {
  const userFindUnique = jest.fn();
  const userFindFirst = jest.fn();
  const userFindMany = jest.fn();
  const inviteFindUnique = jest.fn();
  const prisma = {
    user: {
      findUnique: userFindUnique,
      findFirst: userFindFirst,
      findMany: userFindMany,
    },
    classInvite: { findUnique: inviteFindUnique },
  } as unknown as PrismaService;
  const service = new ClassesService(prisma);
  const student: AuthUser = {
    id: 'student-1',
    email: 'student@example.com',
    role: UserRole.STUDENT,
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

  it('returns only other students from the signed-in student class', async () => {
    userFindUnique.mockResolvedValue({ studentClassId: 'class-1' });
    userFindMany.mockResolvedValue([
      {
        id: 'student-2',
        profile: {
          displayName: 'Марія',
          avatarUrl: null,
          gradeLevel: 8,
        },
      },
    ]);

    await expect(service.listMyClassmates(student)).resolves.toEqual([
      {
        id: 'student-2',
        displayName: 'Марія',
        avatarUrl: null,
        gradeLevel: 8,
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
            gradeLevel: true,
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
    inviteFindUnique.mockResolvedValue(null);

    await expect(
      service.joinClass(student, 'ABCD-EFGH'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
