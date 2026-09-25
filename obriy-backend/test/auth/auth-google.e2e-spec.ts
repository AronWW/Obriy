import { Locale, UserRole } from '@prisma/client';
import request from 'supertest';
import {
  extractToken,
  getLastVerificationMail,
  getResponseBody,
} from '../helpers/auth-test.helpers';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';

describe('Auth Google OAuth (e2e)', () => {
  let context: AuthTestContext;
  const linkedEmail = `google-link.e2e.${Date.now()}@example.com`;
  const ticketEmail = `google-ticket.e2e.${Date.now()}@example.com`;
  const directEmail = `google-direct.e2e.${Date.now()}@example.com`;

  beforeAll(async () => {
    context = await createAuthTestContext();
  });

  afterAll(async () => {
    await closeAuthTestContext(context, [
      linkedEmail,
      ticketEmail,
      directEmail,
    ]);
  });

  it('starts login without a role and binds state to an httpOnly cookie', async () => {
    const response = await request(context.app.getHttpServer())
      .get('/auth/google?intent=LOGIN&locale=UK')
      .redirects(0)
      .expect(302);
    const setCookie = response.headers['set-cookie'];
    const cookies = typeof setCookie === 'string' ? [setCookie] : setCookie;

    expect(response.headers.location).toContain('accounts.google.com');
    expect(cookies?.join(';')).toContain('obriy_oauth_state=');
    expect(cookies?.join(';')).toContain('HttpOnly');
  });

  it('links a verified Google identity without replacing profile data or role', async () => {
    await request(context.app.getHttpServer())
      .post('/auth/register')
      .send({
        email: linkedEmail,
        password: 'StrongPassword123!',
        role: 'TEACHER',
        displayName: 'Existing Teacher',
      })
      .expect(201);
    const verificationToken = extractToken(
      getLastVerificationMail(context.mail, linkedEmail).link,
    );
    await context.prisma.profile.update({
      where: { userId: (await findUser(linkedEmail)).id },
      data: { avatarUrl: 'https://example.com/custom-avatar.png' },
    });

    const googleId = `google-linked-${Date.now()}`;
    const state = context.oauthStateService.create({
      intent: 'LOGIN',
      locale: Locale.EN,
    });
    const callback = await context.authService.handleGoogleCallback(
      {
        googleId,
        email: linkedEmail,
        emailVerified: true,
        displayName: 'Google Name',
        avatarUrl: 'https://example.com/google-avatar.png',
      },
      state,
      state,
    );
    expect(callback.type).toBe('SESSION');
    if (callback.type !== 'SESSION') {
      throw new Error('Expected a Google session exchange code');
    }

    const exchangeResponse = await request(context.app.getHttpServer())
      .post('/auth/google/exchange')
      .send({ code: callback.code })
      .expect(201);
    const linkedUser = getRecordField(
      getResponseBody(exchangeResponse),
      'user',
    );
    expect(linkedUser).toEqual(
      expect.objectContaining({
        email: linkedEmail,
        role: 'TEACHER',
        status: 'ACTIVE',
      }),
    );
    expect(getRecordField(linkedUser, 'profile')).toEqual(
      expect.objectContaining({
        displayName: 'Existing Teacher',
        avatarUrl: 'https://example.com/custom-avatar.png',
      }),
    );

    // Removing an avatar is an intentional preference, not a missing Google value.
    await context.prisma.profile.update({
      where: { userId: (await findUser(linkedEmail)).id },
      data: { avatarUrl: null },
    });
    const nextState = context.oauthStateService.create({
      intent: 'LOGIN',
      locale: Locale.EN,
    });
    const nextCallback = await context.authService.handleGoogleCallback(
      {
        googleId,
        email: linkedEmail,
        emailVerified: true,
        displayName: 'Google Name',
        avatarUrl: 'https://example.com/google-avatar.png',
      },
      nextState,
      nextState,
    );
    expect(nextCallback.type).toBe('SESSION');
    if (nextCallback.type !== 'SESSION') {
      throw new Error('Expected a Google session exchange code');
    }
    const nextExchange = await request(context.app.getHttpServer())
      .post('/auth/google/exchange')
      .send({ code: nextCallback.code })
      .expect(201);
    const nextUser = getRecordField(getResponseBody(nextExchange), 'user');
    expect(getRecordField(nextUser, 'profile').avatarUrl).toBeNull();

    await request(context.app.getHttpServer())
      .post('/auth/login')
      .send({ email: linkedEmail, password: 'StrongPassword123!' })
      .expect(201);
    await request(context.app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: verificationToken })
      .expect(400);
    await request(context.app.getHttpServer())
      .post('/auth/google/exchange')
      .send({ code: callback.code })
      .expect(401);
  });

  it('asks an unknown Google login for a role without a second Google round trip', async () => {
    const state = context.oauthStateService.create({
      intent: 'LOGIN',
      locale: Locale.UK,
    });
    const callback = await context.authService.handleGoogleCallback(
      {
        googleId: `google-ticket-${Date.now()}`,
        email: ticketEmail,
        emailVerified: true,
        displayName: 'New Google Parent',
        avatarUrl: 'https://example.com/parent-avatar.png',
      },
      state,
      state,
    );
    expect(callback.type).toBe('REGISTRATION_REQUIRED');
    if (callback.type !== 'REGISTRATION_REQUIRED') {
      throw new Error('Expected a Google registration ticket');
    }

    const response = await request(context.app.getHttpServer())
      .post('/auth/google/complete-registration')
      .send({
        code: callback.code,
        role: UserRole.PARENT,
        preferredLocale: Locale.EN,
      })
      .expect(201);
    const registeredUser = getRecordField(getResponseBody(response), 'user');
    expect(registeredUser).toEqual(
      expect.objectContaining({
        email: ticketEmail,
        role: 'PARENT',
        status: 'ACTIVE',
      }),
    );
    expect(getRecordField(registeredUser, 'profile')).toEqual(
      expect.objectContaining({
        displayName: 'New Google Parent',
        preferredLocale: 'EN',
      }),
    );

    await request(context.app.getHttpServer())
      .post('/auth/google/complete-registration')
      .send({ code: callback.code, role: UserRole.STUDENT })
      .expect(401);
  });

  it('creates an active account directly when Google registration already has a role', async () => {
    const state = context.oauthStateService.create({
      intent: 'REGISTER',
      role: UserRole.STUDENT,
      locale: Locale.EN,
    });
    const callback = await context.authService.handleGoogleCallback(
      {
        googleId: `google-direct-${Date.now()}`,
        email: directEmail,
        emailVerified: true,
        displayName: 'Google Student',
      },
      state,
      state,
    );
    expect(callback.type).toBe('SESSION');
    if (callback.type !== 'SESSION') {
      throw new Error('Expected a Google session exchange code');
    }

    await request(context.app.getHttpServer())
      .post('/auth/google/exchange')
      .send({ code: callback.code })
      .expect(201)
      .expect((response) => {
        expect(getResponseBody(response).user).toEqual(
          expect.objectContaining({
            email: directEmail,
            role: 'STUDENT',
            status: 'ACTIVE',
          }),
        );
      });

    await request(context.app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: directEmail })
      .expect(201);
    const resetMail = [...context.mail.passwordResetEmails]
      .reverse()
      .find((mail) => mail.email === directEmail);
    if (!resetMail) {
      throw new Error('Expected a password reset email for Google account');
    }
    const resetToken = extractToken(resetMail.link);

    await request(context.app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: resetToken, password: 'GooglePassword123!' })
      .expect(201);
    await request(context.app.getHttpServer())
      .post('/auth/login')
      .send({ email: directEmail, password: 'GooglePassword123!' })
      .expect(201);
  });

  it('redirects callback failures with a safe localized error code', async () => {
    const response = await request(context.app.getHttpServer())
      .get('/auth/google/callback?state=invalid')
      .redirects(0)
      .expect(302);
    const redirect = new URL(response.headers.location);

    expect(redirect.origin).toBe('http://localhost:5173');
    expect(redirect.searchParams.get('error')).toMatch(/^[A-Z0-9_]+$/);
    expect(redirect.searchParams.has('code')).toBe(false);
    expect(redirect.searchParams.has('registration')).toBe(false);
  });

  it('maps provider cancellation to a stable frontend error', async () => {
    const response = await request(context.app.getHttpServer())
      .get('/auth/google/callback?error=access_denied&state=cancelled')
      .redirects(0)
      .expect(302);
    const redirect = new URL(response.headers.location);

    expect(redirect.origin).toBe('http://localhost:5173');
    expect(redirect.searchParams.get('error')).toBe('GOOGLE_OAUTH_CANCELLED');
  });

  function findUser(email: string) {
    return context.prisma.user.findUniqueOrThrow({ where: { email } });
  }

  function getRecordField(
    record: Record<string, unknown>,
    field: string,
  ): Record<string, unknown> {
    const value = record[field];
    if (typeof value !== 'object' || value === null) {
      throw new Error(`Expected ${field} to be an object`);
    }

    return value as Record<string, unknown>;
  }
});
