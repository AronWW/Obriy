import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { LinkedChildDto } from '../users/dto/linked-child.dto';
import {
  ActiveParentInvitationDto,
  LinkedGuardianDto,
  ParentInvitationDto,
  ParentInvitationPreviewDto,
} from './dto/parent-link.dto';

const INVITATION_LIFETIME_HOURS = 24;
const MAX_GUARDIANS_PER_CHILD = 4;

@Injectable()
export class ParentLinksService {
  constructor(private readonly prisma: PrismaService) {}

  async listMyGuardians(user: AuthUser): Promise<LinkedGuardianDto[]> {
    this.assertRole(user, UserRole.STUDENT);

    const links = await this.prisma.parentChild.findMany({
      where: {
        childId: user.id,
        parent: { role: UserRole.PARENT },
      },
      orderBy: [{ createdAt: 'asc' }, { parentId: 'asc' }],
      select: {
        createdAt: true,
        parent: {
          select: {
            id: true,
            profile: {
              select: { displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    return links.map(({ createdAt, parent }) => {
      if (!parent.profile) {
        throw new InternalServerErrorException(
          'Linked guardian profile is unavailable',
        );
      }

      return new LinkedGuardianDto({
        id: parent.id,
        displayName: parent.profile.displayName,
        avatarUrl: parent.profile.avatarUrl,
        linkedAt: createdAt,
      });
    });
  }

  async findActiveInvitation(
    user: AuthUser,
  ): Promise<ActiveParentInvitationDto | null> {
    this.assertRole(user, UserRole.STUDENT);

    const invitation = await this.prisma.parentInvitation.findFirst({
      where: {
        childId: user.id,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: { expiresAt: true },
    });

    return invitation
      ? new ActiveParentInvitationDto({ expiresAt: invitation.expiresAt })
      : null;
  }

  async createInvitation(user: AuthUser): Promise<ParentInvitationDto> {
    this.assertRole(user, UserRole.STUDENT);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + INVITATION_LIFETIME_HOURS * 60 * 60 * 1000,
    );

    await this.prisma.$transaction(async (transaction) => {
      // Updating the owner row serializes concurrent invitation creation for
      // the same child, ensuring only the latest invitation stays active.
      await transaction.user.update({
        where: { id: user.id },
        data: { updatedAt: new Date() },
        select: { id: true },
      });

      const guardianCount = await transaction.parentChild.count({
        where: { childId: user.id },
      });

      if (guardianCount >= MAX_GUARDIANS_PER_CHILD) {
        throw new ConflictException({
          code: 'PARENT_LIMIT_REACHED',
          message: 'The child already has the maximum number of guardians',
        });
      }

      await transaction.parentInvitation.updateMany({
        where: {
          childId: user.id,
          usedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      await transaction.parentInvitation.create({
        data: {
          childId: user.id,
          tokenHash: this.hashToken(token),
          expiresAt,
        },
      });
    });

    return new ParentInvitationDto({ token, expiresAt });
  }

  async revokeActiveInvitation(user: AuthUser): Promise<void> {
    this.assertRole(user, UserRole.STUDENT);
    await this.prisma.parentInvitation.updateMany({
      where: {
        childId: user.id,
        usedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async previewInvitation(
    user: AuthUser,
    token: string,
  ): Promise<ParentInvitationPreviewDto> {
    this.assertRole(user, UserRole.PARENT);
    const invitation = await this.findValidInvitation(token);
    const alreadyLinked = Boolean(
      await this.prisma.parentChild.findUnique({
        where: {
          parentId_childId: {
            parentId: user.id,
            childId: invitation.childId,
          },
        },
        select: { parentId: true },
      }),
    );

    return new ParentInvitationPreviewDto({
      child: {
        id: invitation.child.id,
        displayName: invitation.child.profile.displayName,
        avatarUrl: invitation.child.profile.avatarUrl,
      },
      alreadyLinked,
    });
  }

  async acceptInvitation(
    user: AuthUser,
    token: string,
  ): Promise<LinkedChildDto> {
    this.assertRole(user, UserRole.PARENT);
    const tokenHash = this.hashToken(token);

    const child = await this.prisma.$transaction(async (transaction) => {
      const invitation = await transaction.parentInvitation.findUnique({
        where: { tokenHash },
        include: {
          child: {
            include: { profile: true },
          },
        },
      });

      this.assertInvitationIsValid(invitation);

      const existingLink = await transaction.parentChild.findUnique({
        where: {
          parentId_childId: {
            parentId: user.id,
            childId: invitation.childId,
          },
        },
        select: { parentId: true },
      });

      if (existingLink) {
        throw new ConflictException({
          code: 'PARENT_ALREADY_LINKED',
          message: 'This parent is already linked to the child',
        });
      }

      const guardianCount = await transaction.parentChild.count({
        where: { childId: invitation.childId },
      });

      if (guardianCount >= MAX_GUARDIANS_PER_CHILD) {
        throw new ConflictException({
          code: 'PARENT_LIMIT_REACHED',
          message: 'The child already has the maximum number of guardians',
        });
      }

      const claimed = await transaction.parentInvitation.updateMany({
        where: {
          id: invitation.id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (claimed.count !== 1) {
        throw this.invalidInvitationException();
      }

      await transaction.parentChild.create({
        data: { parentId: user.id, childId: invitation.childId },
      });

      return invitation.child;
    });

    if (!child.profile) {
      throw new InternalServerErrorException('Child profile is unavailable');
    }

    return new LinkedChildDto({
      id: child.id,
      displayName: child.profile.displayName,
      avatarUrl: child.profile.avatarUrl,
      gradeLevel: child.profile.gradeLevel,
    });
  }

  async unlinkGuardian(user: AuthUser, parentId: string): Promise<void> {
    this.assertRole(user, UserRole.STUDENT);
    const deleted = await this.prisma.parentChild.deleteMany({
      where: { parentId, childId: user.id },
    });

    if (deleted.count !== 1) {
      throw new NotFoundException({
        code: 'PARENT_LINK_NOT_FOUND',
        message: 'Parent link not found',
      });
    }
  }

  async unlinkChild(user: AuthUser, childId: string): Promise<void> {
    this.assertRole(user, UserRole.PARENT);
    const deleted = await this.prisma.parentChild.deleteMany({
      where: { parentId: user.id, childId },
    });

    if (deleted.count !== 1) {
      throw new NotFoundException({
        code: 'PARENT_LINK_NOT_FOUND',
        message: 'Child link not found',
      });
    }
  }

  private async findValidInvitation(token: string) {
    const invitation = await this.prisma.parentInvitation.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: {
        child: {
          select: {
            id: true,
            role: true,
            profile: {
              select: { displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (
      !invitation ||
      invitation.usedAt ||
      invitation.revokedAt ||
      invitation.expiresAt.getTime() <= Date.now() ||
      invitation.child.role !== UserRole.STUDENT ||
      !invitation.child.profile
    ) {
      throw this.invalidInvitationException();
    }

    return {
      ...invitation,
      child: { ...invitation.child, profile: invitation.child.profile },
    };
  }

  private assertInvitationIsValid(
    invitation: {
      usedAt: Date | null;
      revokedAt: Date | null;
      expiresAt: Date;
      child: { role: UserRole; profile: unknown };
    } | null,
  ): asserts invitation is NonNullable<typeof invitation> {
    if (
      !invitation ||
      invitation.usedAt ||
      invitation.revokedAt ||
      invitation.expiresAt.getTime() <= Date.now() ||
      invitation.child.role !== UserRole.STUDENT ||
      !invitation.child.profile
    ) {
      throw this.invalidInvitationException();
    }
  }

  private invalidInvitationException(): NotFoundException {
    return new NotFoundException({
      code: 'INVALID_PARENT_INVITATION',
      message: 'Parent invitation is invalid or expired',
    });
  }

  private assertRole(user: AuthUser, role: UserRole): void {
    if (user.role !== role) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: `Only ${role.toLowerCase()} accounts may use this endpoint`,
      });
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
