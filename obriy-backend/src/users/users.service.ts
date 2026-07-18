import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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
