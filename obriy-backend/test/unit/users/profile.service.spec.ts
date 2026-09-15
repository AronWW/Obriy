import { BadRequestException } from '@nestjs/common';
import { Locale, UserRole, UserStatus } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AvatarStorageService } from '../../../src/users/avatar-storage.service';
import { UsersService } from '../../../src/users/users.service';

describe('UsersService profile security', () => {
  const userFindUnique = jest.fn();
  const userUpdate = jest.fn();
  const profileFindUnique = jest.fn();
  const upload = jest.fn();
  const destroy = jest.fn();
  const prisma = {
    user: { findUnique: userFindUnique, update: userUpdate },
    profile: { findUnique: profileFindUnique },
  } as unknown as PrismaService;
  const storage = { upload, destroy } as unknown as AvatarStorageService;
  const service = new UsersService(prisma, storage);

  beforeEach(() => {
    jest.resetAllMocks();
    destroy.mockResolvedValue(undefined);
  });

  it('rejects teacher-only profile fields for another role', async () => {
    userFindUnique.mockResolvedValue({ role: UserRole.PARENT });

    await expect(
      service.updateMyProfile('parent-1', { subjectArea: 'History' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('trims profile text and normalizes blank optional fields', async () => {
    userFindUnique.mockResolvedValue({ role: UserRole.TEACHER });
    userUpdate.mockResolvedValue(userRecord());

    await service.updateMyProfile('teacher-1', {
      displayName: '  Olena  ',
      bio: '   ',
      subjectArea: '  History  ',
      preferredLocale: Locale.EN,
    });

    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          profile: {
            update: {
              displayName: 'Olena',
              bio: null,
              subjectArea: 'History',
              preferredLocale: Locale.EN,
            },
          },
        },
      }),
    );
  });

  it('replaces a managed avatar and removes the previous file after DB success', async () => {
    upload.mockResolvedValue({
      public_id: 'obriy/avatars/new',
      secure_url: 'https://cdn.example/new.webp',
    });
    profileFindUnique.mockResolvedValue({
      avatarStorageKey: 'obriy/avatars/old',
    });
    userUpdate.mockResolvedValue(
      userRecord({
        avatarUrl: 'https://cdn.example/new.webp',
        avatarStorageKey: 'obriy/avatars/new',
      }),
    );

    const result = await service.uploadMyAvatar('teacher-1', {
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      mimetype: 'image/jpeg',
      originalname: 'portrait.jpg',
      size: 4,
    });

    expect(result.profile.avatarUrl).toBe('https://cdn.example/new.webp');
    expect(destroy).toHaveBeenCalledWith('obriy/avatars/old');
  });

  it('rejects a file whose signature does not match its extension', async () => {
    await expect(
      service.uploadMyAvatar('teacher-1', {
        buffer: Buffer.from('not-an-image'),
        mimetype: 'image/png',
        originalname: 'portrait.png',
        size: 12,
      }),
    ).rejects.toMatchObject({ response: { code: 'AVATAR_SIGNATURE_INVALID' } });
    expect(upload).not.toHaveBeenCalled();
  });

  it('does not delete an external avatar when removing it', async () => {
    profileFindUnique.mockResolvedValue({ avatarStorageKey: null });
    userUpdate.mockResolvedValue(userRecord());

    await service.removeMyAvatar('teacher-1');

    expect(destroy).not.toHaveBeenCalled();
  });
});

function userRecord(
  profile: Partial<{
    avatarUrl: string | null;
    avatarStorageKey: string | null;
  }> = {},
) {
  return {
    id: 'teacher-1',
    email: 'teacher@example.com',
    passwordHash: 'hash',
    googleId: null,
    role: UserRole.TEACHER,
    status: UserStatus.ACTIVE,
    sessionVersion: 0,
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    studentClassId: null,
    profile: {
      id: 'profile-1',
      userId: 'teacher-1',
      displayName: 'Olena',
      avatarUrl: profile.avatarUrl ?? null,
      avatarStorageKey: profile.avatarStorageKey ?? null,
      bio: null,
      subjectArea: 'History',
      preferredLocale: Locale.EN,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}
