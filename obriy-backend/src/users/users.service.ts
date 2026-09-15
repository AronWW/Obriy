import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { extname } from 'node:path';
import type { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { LinkedChildDto } from './dto/linked-child.dto';
import { PrivateProfileDto, PublicProfileDto } from './dto/profile.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { AvatarStorageService } from './avatar-storage.service';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export type UploadedAvatar = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

type UserWithProfile = Awaited<ReturnType<UsersService['findUserWithProfile']>>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatarStorage: AvatarStorageService,
  ) {}

  async findMe(userId: string): Promise<PrivateProfileDto> {
    const user = await this.findUserWithProfile(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toPrivateProfile(user);
  }

  async findMyLinkedChildren(user: AuthUser): Promise<LinkedChildDto[]> {
    if (user.role !== UserRole.PARENT) {
      throw new ForbiddenException(
        'Only parent accounts can view linked children',
      );
    }

    const links = await this.prisma.parentChild.findMany({
      where: {
        parentId: user.id,
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
              },
            },
          },
        },
      },
    });

    return links.map(({ child }) => {
      // A profile is an application invariant. Fail the whole response instead
      // of hiding a linked child or inventing identity data when it is broken.
      if (!child.profile) {
        throw new InternalServerErrorException(
          'Linked child profile is unavailable',
        );
      }

      return new LinkedChildDto({
        id: child.id,
        displayName: child.profile.displayName,
        avatarUrl: child.profile.avatarUrl,
      });
    });
  }

  async updateMyProfile(
    userId: string,
    dto: UpdateMyProfileDto,
  ): Promise<PrivateProfileDto> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!current) throw new NotFoundException('User not found');
    if (dto.subjectArea !== undefined && current.role !== UserRole.TEACHER) {
      throw new BadRequestException({
        code: 'PROFILE_FIELD_NOT_ALLOWED',
        message: 'Subject area is available only to teachers',
      });
    }

    const displayName = dto.displayName?.trim();
    if (dto.displayName !== undefined && !displayName) {
      throw new BadRequestException({
        code: 'DISPLAY_NAME_REQUIRED',
        message: 'Display name cannot be blank',
      });
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        profile: {
          update: {
            displayName,
            bio: this.nullableText(dto.bio),
            subjectArea:
              current.role === UserRole.TEACHER
                ? this.nullableText(dto.subjectArea)
                : undefined,
            preferredLocale: dto.preferredLocale,
          },
        },
      },
      include: { profile: true },
    });

    return this.toPrivateProfile(user);
  }

  async uploadMyAvatar(
    userId: string,
    file?: UploadedAvatar,
  ): Promise<PrivateProfileDto> {
    this.validateAvatar(file);
    const uploaded = await this.avatarStorage.upload(file.buffer, userId);

    try {
      const current = await this.prisma.profile.findUnique({
        where: { userId },
        select: { avatarStorageKey: true },
      });
      if (!current) throw new NotFoundException('Profile not found');

      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          profile: {
            update: {
              avatarUrl: uploaded.secure_url,
              avatarStorageKey: uploaded.public_id,
            },
          },
        },
        include: { profile: true },
      });

      if (current.avatarStorageKey) {
        await this.avatarStorage
          .destroy(current.avatarStorageKey)
          .catch(() => undefined);
      }
      return this.toPrivateProfile(user);
    } catch (error) {
      await this.avatarStorage
        .destroy(uploaded.public_id)
        .catch(() => undefined);
      throw error;
    }
  }

  async removeMyAvatar(userId: string): Promise<PrivateProfileDto> {
    const current = await this.prisma.profile.findUnique({
      where: { userId },
      select: { avatarStorageKey: true },
    });
    if (!current) throw new NotFoundException('Profile not found');

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        profile: {
          update: { avatarUrl: null, avatarStorageKey: null },
        },
      },
      include: { profile: true },
    });
    if (current.avatarStorageKey) {
      await this.avatarStorage
        .destroy(current.avatarStorageKey)
        .catch(() => undefined);
    }
    return this.toPrivateProfile(user);
  }

  async findUserWithProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
  }

  toPrivateProfile(user: NonNullable<UserWithProfile>): PrivateProfileDto {
    if (!user.profile) {
      throw new NotFoundException('Profile not found');
    }

    return new PrivateProfileDto({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      hasPassword: Boolean(user.passwordHash),
      profile: {
        displayName: user.profile.displayName,
        avatarUrl: user.profile.avatarUrl,
        bio: user.profile.bio,
        subjectArea: user.profile.subjectArea,
        preferredLocale: user.profile.preferredLocale,
      },
    });
  }

  toPublicProfile(
    user: NonNullable<UserWithProfile>,
    gamification: { level: number; totalXp: number },
    rank: number | null = null,
  ): PublicProfileDto {
    if (!user.profile) {
      throw new NotFoundException('Profile not found');
    }

    return new PublicProfileDto({
      id: user.id,
      displayName: user.profile.displayName,
      avatarUrl: user.profile.avatarUrl,
      level: gamification.level,
      xp: gamification.totalXp,
      rank,
    });
  }

  private nullableText(
    value: string | null | undefined,
  ): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private validateAvatar(
    file?: UploadedAvatar,
  ): asserts file is UploadedAvatar {
    if (!file) {
      throw new BadRequestException({
        code: 'AVATAR_REQUIRED',
        message: 'Select an avatar image',
      });
    }
    if (file.size < 1 || file.size > MAX_AVATAR_BYTES) {
      throw new BadRequestException({
        code: 'AVATAR_SIZE_INVALID',
        message: 'Avatar must not exceed 5 MB',
      });
    }

    const extension = extname(file.originalname).toLowerCase();
    const expectedMime: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    if (!expectedMime[extension] || expectedMime[extension] !== file.mimetype) {
      throw new BadRequestException({
        code: 'AVATAR_TYPE_INVALID',
        message: 'Only JPG, PNG, and WebP avatars are supported',
      });
    }

    const signatureValid =
      extension === '.jpg' || extension === '.jpeg'
        ? file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
        : extension === '.png'
          ? file.buffer
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : file.buffer.subarray(0, 4).toString() === 'RIFF' &&
            file.buffer.subarray(8, 12).toString() === 'WEBP';
    if (!signatureValid) {
      throw new BadRequestException({
        code: 'AVATAR_SIGNATURE_INVALID',
        message: 'Avatar content does not match its file type',
      });
    }
  }
}
