import {
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import { UsersService } from '../../../src/users/users.service';

describe('UsersService.findMyLinkedChildren', () => {
  const findMany = jest.fn();
  const prisma = {
    parentChild: { findMany },
  } as unknown as PrismaService;
  const service = new UsersService(prisma);
  const parent: AuthUser = {
    id: 'parent-1',
    email: 'parent@example.com',
    role: UserRole.PARENT,
    status: UserStatus.ACTIVE,
  };

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns only the permitted child identity fields from parent-scoped student links', async () => {
    findMany.mockResolvedValue([
      {
        child: {
          id: 'child-1',
          profile: {
            displayName: 'Марія',
            avatarUrl: 'https://example.com/maria.png',
            gradeLevel: 7,
          },
        },
      },
    ]);

    await expect(service.findMyLinkedChildren(parent)).resolves.toEqual([
      {
        id: 'child-1',
        displayName: 'Марія',
        avatarUrl: 'https://example.com/maria.png',
        gradeLevel: 7,
      },
    ]);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        parentId: 'parent-1',
        child: {
          role: UserRole.STUDENT,
        },
      },
      orderBy: [{ createdAt: 'asc' }, { childId: 'asc' }],
      select: {
        child: {
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
        },
      },
    });
  });

  it('returns an empty list when the parent has no linked students', async () => {
    findMany.mockResolvedValue([]);

    await expect(service.findMyLinkedChildren(parent)).resolves.toEqual([]);
  });

  it.each([UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN])(
    'rejects %s before querying linked children',
    async (role) => {
      await expect(
        service.findMyLinkedChildren({ ...parent, role }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(findMany).not.toHaveBeenCalled();
    },
  );

  it('fails closed if a linked child unexpectedly has no profile', async () => {
    findMany.mockResolvedValue([{ child: { id: 'child-1', profile: null } }]);

    await expect(service.findMyLinkedChildren(parent)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
