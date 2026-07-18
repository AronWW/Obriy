import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthTokenCleanupService {
  private readonly logger = new Logger(AuthTokenCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanup(): Promise<void> {
    const now = new Date();
    const transientCutoff = this.subtractDays(
      now,
      this.getNumberConfig('AUTH_TRANSIENT_TOKEN_RETENTION_DAYS', 7),
    );
    const oauthCutoff = this.subtractDays(
      now,
      this.getNumberConfig('OAUTH_CODE_RETENTION_DAYS', 1),
    );
    const refreshCutoff = this.subtractDays(
      now,
      this.getNumberConfig('REFRESH_TOKEN_RETENTION_DAYS', 30),
    );

    const [verification, passwordReset, oauth, refresh] =
      await this.prisma.$transaction([
        this.prisma.emailVerificationToken.deleteMany({
          where: {
            createdAt: { lt: transientCutoff },
            OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }],
          },
        }),
        this.prisma.passwordResetToken.deleteMany({
          where: {
            createdAt: { lt: transientCutoff },
            OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }],
          },
        }),
        this.prisma.oAuthExchangeCode.deleteMany({
          where: {
            createdAt: { lt: oauthCutoff },
            OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }],
          },
        }),
        this.prisma.refreshToken.deleteMany({
          where: {
            createdAt: { lt: refreshCutoff },
            OR: [{ revokedAt: { not: null } }, { expiresAt: { lt: now } }],
          },
        }),
      ]);

    const total =
      verification.count + passwordReset.count + oauth.count + refresh.count;
    if (total > 0) {
      this.logger.log(`Removed ${total} expired or used auth tokens.`);
    }
  }

  private getNumberConfig(key: string, fallback: number): number {
    const value = Number(this.configService.get<string | number>(key));
    return Number.isFinite(value) ? value : fallback;
  }

  private subtractDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  }
}
