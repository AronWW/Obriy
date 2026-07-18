import { UserRole } from '@prisma/client';
import request from 'supertest';
import { getResponseBody } from '../helpers/auth-test.helpers';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';

describe('Auth Google OAuth (e2e)', () => {
  let context: AuthTestContext;
  const email = `google-link.e2e.${Date.now()}@example.com`;

  beforeAll(async () => {
    context = await createAuthTestContext();
  });

  afterAll(async () => {
    await closeAuthTestContext(context, [email]);
  });

  it('links a verified Google identity without changing the existing role', async () => {
    await request(context.app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'StrongPassword123!',
        role: 'TEACHER',
        displayName: 'Existing Teacher',
      })
      .expect(201);

    const state = context.oauthStateService.create(UserRole.PARENT);
    const exchangeCode = await context.authService.handleGoogleCallback(
      {
        googleId: `google-${Date.now()}`,
        email,
        emailVerified: true,
        displayName: 'Google Name',
        avatarUrl: 'https://example.com/avatar.png',
      },
      state,
    );

    const exchangeResponse = await request(context.app.getHttpServer())
      .post('/auth/google/exchange')
      .send({ code: exchangeCode })
      .expect(201);
    expect(getResponseBody(exchangeResponse).user).toEqual(
      expect.objectContaining({
        email,
        role: 'TEACHER',
        status: 'ACTIVE',
      }),
    );

    await request(context.app.getHttpServer())
      .post('/auth/google/exchange')
      .send({ code: exchangeCode })
      .expect(401);
  });

  it('redirects callback failures with a safe error code', async () => {
    const response = await request(context.app.getHttpServer())
      .get('/auth/google/callback?state=invalid')
      .redirects(0)
      .expect(302);
    const redirect = new URL(response.headers.location);

    expect(redirect.origin).toBe('http://localhost:5173');
    expect(redirect.searchParams.get('error')).toMatch(/^[A-Z0-9_]+$/);
    expect(redirect.searchParams.has('code')).toBe(false);
  });
});
