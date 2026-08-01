import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { LinkedChildDto } from './dto/linked-child.dto';
import { PrivateProfileDto, PublicProfileDto } from './dto/profile.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

const publicGamificationPlaceholder = {
  level: 1,
  xp: 0,
  rank: null,
};

type UserWithProfile = Awaited<ReturnType<UsersService['findUserWithProfile']>>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
                gradeLevel: true,
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
        gradeLevel: child.profile.gradeLevel,
      });
    });
  }

  async updateMyProfile(
    userId: string,
    dto: UpdateMyProfileDto,
  ): Promise<PrivateProfileDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        profile: {
          update: {
            displayName: dto.displayName,
            avatarUrl: dto.avatarUrl,
            bio: dto.bio,
            gradeLevel: dto.gradeLevel,
            subjectArea: dto.subjectArea,
            preferredLocale: dto.preferredLocale,
          },
        },
      },
      include: { profile: true },
    });

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
      profile: {
        displayName: user.profile.displayName,
        avatarUrl: user.profile.avatarUrl,
        bio: user.profile.bio,
        gradeLevel: user.profile.gradeLevel,
        subjectArea: user.profile.subjectArea,
        preferredLocale: user.profile.preferredLocale,
      },
    });
  }

  toPublicProfile(user: NonNullable<UserWithProfile>): PublicProfileDto {
    if (!user.profile) {
      throw new NotFoundException('Profile not found');
    }

    return new PublicProfileDto({
      id: user.id,
      displayName: user.profile.displayName,
      avatarUrl: user.profile.avatarUrl,
      ...publicGamificationPlaceholder,
    });
  }
}
