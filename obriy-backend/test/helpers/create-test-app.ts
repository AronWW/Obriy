import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { App } from 'supertest/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AppModule } from '../../src/app.module';
import { AuthTokenCleanupService } from '../../src/auth/auth-token-cleanup.service';
import { AuthService } from '../../src/auth/auth.service';
import { OAuthStateService } from '../../src/auth/oauth-state.service';
import { MailService } from '../../src/mail/mail.service';
import { TestMailService } from './test-mail.service';
import { MapStorageService } from '../../src/map-presets/map-storage.service';
import { TestMapStorageService } from './test-map-storage.service';

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://obriy:obriy_password@127.0.0.1:5433/obriy_test?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-32-characters';
process.env.GOOGLE_CLIENT_ID ??= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ??= 'test-google-client-secret';
process.env.GOOGLE_CALLBACK_URL ??=
  'http://localhost:3000/auth/google/callback';
process.env.GOOGLE_OAUTH_STATE_SECRET ??=
  'test-google-state-secret-at-least-32-characters';

export type AuthTestContext = {
  app: INestApplication<App>;
  prisma: PrismaService;
  mail: TestMailService;
  authService: AuthService;
  oauthStateService: OAuthStateService;
  tokenCleanupService: AuthTokenCleanupService;
};

export async function createAuthTestContext(): Promise<AuthTestContext> {
  const mail = new TestMailService();
  const mapStorage = new TestMapStorageService();
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MailService)
    .useValue(mail)
    .overrideProvider(MapStorageService)
    .useValue(mapStorage)
    .compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  return {
    app,
    mail,
    prisma: app.get(PrismaService),
    authService: app.get(AuthService),
    oauthStateService: app.get(OAuthStateService),
    tokenCleanupService: app.get(AuthTokenCleanupService),
  };
}

export async function closeAuthTestContext(
  context: AuthTestContext,
  emails: string[],
): Promise<void> {
  await context.prisma.oAuthRegistrationTicket.deleteMany({
    where: { email: { in: emails } },
  });
  await context.prisma.user.deleteMany({
    where: { email: { in: emails } },
  });
  await context.app.close();
}
