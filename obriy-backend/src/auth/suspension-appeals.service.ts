import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AdminAuditAction,
  AdminAuditTargetType,
  SuspensionAppealStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SubmitSuspensionAppealDto,
  SuspensionAppealStateDto,
  SuspensionContextDto,
  SuspensionTokenDto,
} from './dto/suspension-appeal.dto';

const APPEAL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

type SuspensionTokenPayload = {
  sub: string;
  sessionVersion: number;
  purpose: 'SUSPENSION_APPEAL';
};

@Injectable()
export class SuspensionAppealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  throwSuspended(user: { id: string; sessionVersion: number }): never {
    const suspensionAccessToken = this.signToken(user);
    throw new ForbiddenException({
      code: 'USER_SUSPENDED',
      message: 'The account is suspended.',
      suspensionAccessToken,
    });
  }

  async context(dto: SuspensionTokenDto): Promise<SuspensionContextDto> {
    const userId = await this.verifyToken(dto.suspensionAccessToken);
    return this.loadContext(userId);
  }

  async submit(dto: SubmitSuspensionAppealDto): Promise<SuspensionContextDto> {
    const userId = await this.verifyToken(dto.suspensionAccessToken);
    const message = dto.message.trim();
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { status: true },
      });
      if (!user || user.status !== UserStatus.SUSPENDED) {
        throw this.invalidToken();
      }
      const suspension = await tx.adminAuditLog.findFirst({
        where: {
          action: AdminAuditAction.USER_SUSPENDED,
          targetType: AdminAuditTargetType.USER,
          targetId: userId,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true },
      });
      if (!suspension) throw this.invalidToken();
      const latest = await tx.suspensionAppeal.findFirst({
        where: { suspensionAuditLogId: suspension.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { status: true, reviewedAt: true },
      });
      if (latest?.status === SuspensionAppealStatus.PENDING) {
        throw new ConflictException({
          code: 'SUSPENSION_APPEAL_PENDING',
          message: 'An appeal is already awaiting review.',
        });
      }
      if (latest?.status === SuspensionAppealStatus.APPROVED) {
        throw new ConflictException({
          code: 'SUSPENSION_APPEAL_ALREADY_APPROVED',
          message: 'The appeal has already been approved.',
        });
      }
      if (
        latest?.status === SuspensionAppealStatus.REJECTED &&
        latest.reviewedAt &&
        latest.reviewedAt.getTime() + APPEAL_COOLDOWN_MS > Date.now()
      ) {
        throw new ConflictException({
          code: 'SUSPENSION_APPEAL_COOLDOWN',
          message: 'A new appeal can be submitted after the cooldown.',
          nextAppealAt: new Date(
            latest.reviewedAt.getTime() + APPEAL_COOLDOWN_MS,
          ),
        });
      }
      await tx.suspensionAppeal.create({
        data: { userId, suspensionAuditLogId: suspension.id, message },
      });
    });
    return this.loadContext(userId);
  }

  private async loadContext(userId: string): Promise<SuspensionContextDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!user || user.status !== UserStatus.SUSPENDED)
      throw this.invalidToken();
    const suspension = await this.prisma.adminAuditLog.findFirst({
      where: {
        action: AdminAuditAction.USER_SUSPENDED,
        targetType: AdminAuditTargetType.USER,
        targetId: userId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        reason: true,
        createdAt: true,
        sourceSuspensionAppeals: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: {
            status: true,
            createdAt: true,
            resolutionNote: true,
            reviewedAt: true,
          },
        },
      },
    });
    if (!suspension) throw this.invalidToken();
    const latest = suspension.sourceSuspensionAppeals[0] ?? null;
    const nextAppealAt =
      latest?.status === SuspensionAppealStatus.REJECTED && latest.reviewedAt
        ? new Date(latest.reviewedAt.getTime() + APPEAL_COOLDOWN_MS)
        : null;
    const canAppeal =
      latest === null ||
      (latest.status === SuspensionAppealStatus.REJECTED &&
        nextAppealAt !== null &&
        nextAppealAt.getTime() <= Date.now());
    return new SuspensionContextDto({
      reason: suspension.reason,
      suspendedAt: suspension.createdAt,
      canAppeal,
      nextAppealAt,
      appeal: latest
        ? new SuspensionAppealStateDto({
            status: latest.status,
            submittedAt: latest.createdAt,
            resolutionNote: latest.resolutionNote,
            reviewedAt: latest.reviewedAt,
          })
        : null,
    });
  }

  private signToken(user: { id: string; sessionVersion: number }): string {
    const payload: SuspensionTokenPayload = {
      sub: user.id,
      sessionVersion: user.sessionVersion,
      purpose: 'SUSPENSION_APPEAL',
    };
    return this.jwt.sign(payload, {
      secret: this.secret(),
      audience: 'obriy-suspension',
      expiresIn: 15 * 60,
    });
  }

  private async verifyToken(token: string): Promise<string> {
    let payload: SuspensionTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<SuspensionTokenPayload>(token, {
        secret: this.secret(),
        audience: 'obriy-suspension',
      });
    } catch {
      throw this.invalidToken();
    }
    if (payload.purpose !== 'SUSPENSION_APPEAL') throw this.invalidToken();
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true, sessionVersion: true },
    });
    if (
      !user ||
      user.status !== UserStatus.SUSPENDED ||
      user.sessionVersion !== payload.sessionVersion
    ) {
      throw this.invalidToken();
    }
    return payload.sub;
  }

  private secret(): string {
    return (
      this.config.get<string>('JWT_ACCESS_SECRET') ??
      'dev-access-secret-change-me'
    );
  }

  private invalidToken(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'INVALID_SUSPENSION_TOKEN',
      message: 'The suspension access token is invalid or expired.',
    });
  }
}
