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
          expect.objectContaining({
            email,
            role: 'STUDENT',
            hasPassword: true,
          }),
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
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    const passwordLogin = await request(context.app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'NewStrongPassword123!' })
      .expect(201);
    const passwordAccessToken = getStringField(passwordLogin, 'accessToken');
    const passwordCookie = getRefreshCookie(
      passwordLogin.headers['set-cookie'],
    );

    await request(context.app.getHttpServer())
      .patch('/users/me/profile')
      .set('Authorization', `Bearer ${passwordAccessToken}`)
      .send({ avatarUrl: 'https://example.com/untrusted.png' })
      .expect(400);
    await request(context.app.getHttpServer())
      .patch('/users/me/profile')
      .set('Authorization', `Bearer ${passwordAccessToken}`)
      .send({ subjectArea: 'History' })
      .expect(400)
      .expect((response) => {
        expect(getResponseBody(response).code).toBe(
          'PROFILE_FIELD_NOT_ALLOWED',
        );
      });
    await request(context.app.getHttpServer())
      .patch('/users/me/profile')
      .set('Authorization', `Bearer ${passwordAccessToken}`)
      .send({
        displayName: '  Updated Student  ',
        bio: '  ',
        preferredLocale: 'UK',
      })
      .expect(200)
      .expect((response) => {
        const body = getResponseBody(response);
        expect(body.profile).toEqual(
          expect.objectContaining({
            displayName: 'Updated Student',
            bio: null,
            preferredLocale: 'UK',
          }),
        );
        expect(body.profile).not.toHaveProperty('gradeLevel');
      });

    await request(context.app.getHttpServer())
      .put('/users/me/avatar')
      .set('Authorization', `Bearer ${passwordAccessToken}`)
      .attach('avatar', Buffer.from('not-a-png'), {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(400)
      .expect((response) => {
        expect(getResponseBody(response).code).toBe('AVATAR_SIGNATURE_INVALID');
      });

    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    await request(context.app.getHttpServer())
      .put('/users/me/avatar')
      .set('Authorization', `Bearer ${passwordAccessToken}`)
      .attach('avatar', png, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(200)
      .expect((response) => {
        const profile = getResponseBody(response).profile as Record<
          string,
          unknown
        >;
        expect(profile.avatarUrl).toEqual(
          expect.stringContaining('cdn.example'),
        );
      });
    const firstAvatarKey = context.avatarStorage.uploads[0];
    await request(context.app.getHttpServer())
      .put('/users/me/avatar')
      .set('Authorization', `Bearer ${passwordAccessToken}`)
      .attach('avatar', png, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(200);
    expect(context.avatarStorage.destroyed).toContain(firstAvatarKey);

    const secondAvatarKey = context.avatarStorage.uploads[1];
    await request(context.app.getHttpServer())
      .delete('/users/me/avatar')
      .set('Authorization', `Bearer ${passwordAccessToken}`)
      .expect(200)
      .expect((response) => {
        const profile = getResponseBody(response).profile as Record<
          string,
          unknown
        >;
        expect(profile.avatarUrl).toBeNull();
      });
    expect(context.avatarStorage.destroyed).toContain(secondAvatarKey);

    await request(context.app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${passwordAccessToken}`)
      .send({
        currentPassword: 'WrongPassword123!',
        newPassword: 'AnotherStrongPassword123!',
      })
      .expect(401);

    await request(context.app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${passwordAccessToken}`)
      .send({
        currentPassword: 'NewStrongPassword123!',
        newPassword: 'NewStrongPassword123!',
      })
      .expect(400)
      .expect((response) => {
        expect(getResponseBody(response).code).toBe('PASSWORD_REUSE_FORBIDDEN');
      });

    await request(context.app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${passwordAccessToken}`)
      .send({
        currentPassword: 'NewStrongPassword123!',
        newPassword: 'AnotherStrongPassword123!',
      })
      .expect(201)
      .expect('set-cookie', /obriy_refresh_token=;/);

    await request(context.app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${passwordAccessToken}`)
      .expect(401);
    await request(context.app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', passwordCookie)
      .expect(401);
    await request(context.app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'AnotherStrongPassword123!' })
      .expect(201);
  });
});
