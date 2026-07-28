import { UserRole } from '@prisma/client';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';

describe('Auth token cleanup (e2e)', () => {
  let context: AuthTestContext;
  const email = `cleanup.e2e.${Date.now()}@example.com`;

  beforeAll(async () => {
    context = await createAuthTestContext();
  });

  afterAll(async () => {
    await closeAuthTestContext(context, [email, 'seed.admin.e2e@example.com']);
  });

  it('removes old expired and used auth tokens', async () => {
    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const user = await context.prisma.user.create({
      data: {
        email,
        role: UserRole.STUDENT,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        profile: { create: { displayName: 'Cleanup Test' } },
      },
    });

    await context.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: `verification-cleanup-${Date.now()}`,
        expiresAt: oldDate,
        createdAt: oldDate,
      },
    });
    await context.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: `reset-cleanup-${Date.now()}`,
        expiresAt: oldDate,
        createdAt: oldDate,
      },
    });
    await context.prisma.oAuthExchangeCode.create({
      data: {
        userId: user.id,
        tokenHash: `oauth-cleanup-${Date.now()}`,
        expiresAt: oldDate,
        createdAt: oldDate,
      },
    });
    await context.prisma.oAuthRegistrationTicket.create({
      data: {
        tokenHash: `oauth-registration-cleanup-${Date.now()}`,
        googleId: `cleanup-google-${Date.now()}`,
        email,
        displayName: 'Cleanup Registration',
        expiresAt: oldDate,
        createdAt: oldDate,
      },
    });
    await context.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: `refresh-cleanup-${Date.now()}`,
        expiresAt: oldDate,
        createdAt: oldDate,
      },
    });

    await context.tokenCleanupService.cleanup();

    const remaining = await Promise.all([
      context.prisma.emailVerificationToken.count({
        where: { userId: user.id },
      }),
      context.prisma.passwordResetToken.count({
        where: { userId: user.id },
      }),
      context.prisma.oAuthExchangeCode.count({ where: { userId: user.id } }),
      context.prisma.oAuthRegistrationTicket.count({ where: { email } }),
      context.prisma.refreshToken.count({ where: { userId: user.id } }),
    ]);
    expect(remaining).toEqual([0, 0, 0, 0, 0]);
  });
});
