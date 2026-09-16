import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Locale, PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
} from '../src/common/validation/password.validation';

async function main(): Promise<void> {
  const databaseUrl = requiredEnvironment('DATABASE_URL');
  const email = requiredEnvironment('ADMIN_EMAIL').trim().toLowerCase();
  const password = requiredEnvironment('ADMIN_PASSWORD');
  const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || 'Obriy Admin';

  assertPassword(password);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && existingUser.role !== UserRole.ADMIN) {
      throw new Error(
        `Cannot create admin: ${email} belongs to a non-admin account.`,
      );
    }

    const passwordHash = await argon2.hash(password);
    const admin = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        profile: {
          create: { displayName, preferredLocale: Locale.UK },
        },
      },
      update: {
        passwordHash,
        status: UserStatus.ACTIVE,
        sessionVersion: { increment: 1 },
        emailVerifiedAt: existingUser?.emailVerifiedAt ?? new Date(),
        profile: {
          upsert: {
            create: { displayName, preferredLocale: Locale.UK },
            update: { displayName },
          },
        },
      },
    });
    if (existingUser) {
      await prisma.refreshToken.updateMany({
        where: { userId: admin.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    console.log(`Admin account is ready: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

function requiredEnvironment(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function assertPassword(password: string): void {
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH ||
    !PASSWORD_PATTERN.test(password)
  ) {
    throw new Error(
      `ADMIN_PASSWORD must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters and contain a letter and a number.`,
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(message);
  process.exitCode = 1;
});
