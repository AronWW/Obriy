import { Locale } from '@prisma/client';
import request from 'supertest';
import {
  extractToken,
  getRefreshCookie,
  getResponseBody,
  getStringField,
} from '../helpers/auth-test.helpers';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';

describe('Auth session (e2e)', () => {
  let context: AuthTestContext;
  const email = `session.e2e.${Date.now()}@example.com`;
  const password = 'StrongPassword123!';

  beforeAll(async () => {
    context = await createAuthTestContext();
  });

  afterAll(async () => {
    await closeAuthTestContext(context, [email]);
  });

  it('completes registration, verification, login, refresh and reset', async () => {
    await request(context.app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password,
        role: 'STUDENT',
        displayName: 'E2E Student',
        preferredLocale: 'EN',
      })
      .expect(201)
      .expect((response) => {
        const body = getResponseBody(response);
        expect(body.code).toBe('EMAIL_VERIFICATION_SENT');
        expect(body.retryAfterSeconds).toBe(60);
      });

    expect(context.mail.verificationEmails).toHaveLength(1);
    expect(context.mail.verificationEmails[0].locale).toBe(Locale.EN);
    const verificationToken = extractToken(
      context.mail.verificationEmails[0].link,
    );

    await request(context.app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(403)
      .expect((response) => {
        const body = getResponseBody(response);
        expect(body.code).toBe('EMAIL_VERIFICATION_REQUIRED');
        expect(body.retryAfterSeconds).toEqual(expect.any(Number));
      });

    await request(context.app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: verificationToken })
      .expect(201);

    const loginResponse = await request(context.app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    const accessToken = getStringField(loginResponse, 'accessToken');
    const firstCookie = getRefreshCookie(loginResponse.headers['set-cookie']);

    await request(context.app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(getResponseBody(response)).toEqual(
          expect.objectContaining({ email, role: 'STUDENT' }),
        );
      });

    const refreshResponse = await request(context.app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(201);
    const secondCookie = getRefreshCookie(
      refreshResponse.headers['set-cookie'],
    );
    expect(secondCookie).not.toBe(firstCookie);

    await request(context.app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(401)
      .expect((response) => {
        expect(getResponseBody(response).code).toBe('REFRESH_TOKEN_REUSED');
      });

    await request(context.app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', secondCookie)
      .expect(401);

    await request(context.app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email })
      .expect(201);
    const resetToken = extractToken(context.mail.passwordResetEmails[0].link);

    await request(context.app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: resetToken, password: 'NewStrongPassword123!' })
      .expect(201);

    await request(context.app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'NewStrongPassword123!' })
      .expect(201);
  });
});
