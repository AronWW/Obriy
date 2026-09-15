import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import { ParentLinksService } from '../../../src/parent-links/parent-links.service';

describe('ParentLinksService', () => {
  let persistedInvitation: unknown;
  let invitationUpdate: unknown;
  const transaction = {
    user: { update: jest.fn() },
    parentChild: {
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    parentInvitation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const runTransaction = jest.fn(
    (callback: (tx: typeof transaction) => unknown) =>
      Promise.resolve(callback(transaction)),
  );
  const invitationFindUnique = jest.fn();
  const linkFindUnique = jest.fn();
  const prisma = {
    $transaction: runTransaction,
    parentInvitation: { findUnique: invitationFindUnique },
    parentChild: { findUnique: linkFindUnique },
  } as unknown as PrismaService;
  const service = new ParentLinksService(prisma);
  const student: AuthUser = {
    id: 'student-1',
    email: 'student@example.com',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  };
  const parent: AuthUser = {
    id: 'parent-1',
    email: 'parent@example.com',
    role: UserRole.PARENT,
    status: UserStatus.ACTIVE,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    persistedInvitation = undefined;
    invitationUpdate = undefined;
    runTransaction.mockImplementation(
      (callback: (tx: typeof transaction) => unknown) =>
        Promise.resolve(callback(transaction)),
    );
    transaction.user.update.mockResolvedValue({ id: student.id });
    transaction.parentChild.count.mockResolvedValue(0);
    transaction.parentInvitation.updateMany.mockImplementation(
      (args: unknown) => {
        invitationUpdate = args;
        return Promise.resolve({ count: 1 });
      },
    );
    transaction.parentInvitation.create.mockImplementation((args: unknown) => {
      persistedInvitation = args;
      return Promise.resolve({ id: 'invite-1' });
    });
  });

  it('creates a 24-hour invitation while persisting only its hash', async () => {
    const before = Date.now();
    const result = await service.createInvitation(student);
    const after = Date.now();

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 24 * 60 * 60 * 1000,
    );
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(
      after + 24 * 60 * 60 * 1000,
    );
    expect(transaction.parentInvitation.updateMany).toHaveBeenCalled();
    expect(getNestedValue(invitationUpdate, ['where', 'childId'])).toBe(
      student.id,
    );
    expect(
      getNestedValue(invitationUpdate, ['data', 'revokedAt']),
    ).toBeInstanceOf(Date);
    expect(getNestedValue(persistedInvitation, ['data', 'childId'])).toBe(
      student.id,
    );
    expect(getNestedValue(persistedInvitation, ['data', 'tokenHash'])).toEqual(
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(getNestedValue(persistedInvitation, ['data', 'expiresAt'])).toEqual(
      result.expiresAt,
    );
    expect(JSON.stringify(persistedInvitation)).not.toContain(result.token);
  });

  it('blocks invitation creation after four guardians are linked', async () => {
    transaction.parentChild.count.mockResolvedValue(4);

    await expect(service.createInvitation(student)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction.parentInvitation.create).not.toHaveBeenCalled();
  });

  it('allows only parents to preview an invitation', async () => {
    await expect(
      service.previewInvitation(student, 'A'.repeat(43)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(invitationFindUnique).not.toHaveBeenCalled();
  });

  it('accepts a valid invitation once and returns the linked child', async () => {
    const future = new Date(Date.now() + 60_000);
    transaction.parentInvitation.findUnique.mockResolvedValue({
      id: 'invite-1',
      childId: student.id,
      usedAt: null,
      revokedAt: null,
      expiresAt: future,
      child: {
        id: student.id,
        role: UserRole.STUDENT,
        profile: {
          displayName: 'Марія',
          avatarUrl: null,
        },
      },
    });
    transaction.parentChild.findUnique.mockResolvedValue(null);
    transaction.parentChild.create.mockResolvedValue({
      parentId: parent.id,
      childId: student.id,
    });

    await expect(
      service.acceptInvitation(parent, 'B'.repeat(43)),
    ).resolves.toEqual({
      id: student.id,
      displayName: 'Марія',
      avatarUrl: null,
    });
    expect(getNestedValue(invitationUpdate, ['where', 'id'])).toBe('invite-1');
    expect(getNestedValue(invitationUpdate, ['data', 'usedAt'])).toBeInstanceOf(
      Date,
    );
    expect(transaction.parentChild.create).toHaveBeenCalledWith({
      data: { parentId: parent.id, childId: student.id },
    });
  });
});

function getNestedValue(value: unknown, path: string[]): unknown {
  let current = value;

  for (const part of path) {
    if (typeof current !== 'object' || current === null || !(part in current)) {
      throw new Error(`Expected ${path.join('.')} to exist`);
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
