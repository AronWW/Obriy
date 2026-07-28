import request from 'supertest';
import {
  ageVerificationTokens,
  extractToken,
  getLastVerificationMail,
  getResponseBody,
} from '../helpers/auth-test.helpers';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';

describe('Auth registration and verification (e2e)', () => {
  let context: AuthTestContext;
  const resendEmail = `resend.e2e.${Date.now()}@example.com`;
  const failedResendEmail = `failed-resend.e2e.${Date.now()}@example.com`;
  const password = 'StrongPassword123!';

  beforeAll(async () => {
    context = await createAuthTestContext();
  });

  afterAll(async () => {
    await closeAuthTestContext(context, [resendEmail, failedResendEmail]);
  });

  it('invalidates the previous link only after a successful resend', async () => {
    await registerUser(resendEmail);
    const firstToken = extractToken(
      getLastVerificationMail(context.mail, resendEmail).link,
    );

    await request(context.app.getHttpServer())
      .post('/auth/resend-verification')
      .send({ email: resendEmail })
      .expect(429)
      .expect((response) => {
        const body = getResponseBody(response);
        expect(body.code).toBe('EMAIL_VERIFICATION_COOLDOWN');
        expect(body.retryAfterSeconds).toEqual(expect.any(Number));
      });
    expect(
      context.mail.verificationEmails.filter(
        (item) => item.email === resendEmail,
      ),
    ).toHaveLength(1);

    const user = await context.prisma.user.findUniqueOrThrow({
      where: { email: resendEmail },
    });
    await ageVerificationTokens(context.prisma, user.id);

    await request(context.app.getHttpServer())
      .post('/auth/resend-verification')
      .send({ email: resendEmail })
      .expect(201)
      .expect((response) => {
        expect(getResponseBody(response).retryAfterSeconds).toBe(60);
      });

    const secondToken = extractToken(
      getLastVerificationMail(context.mail, resendEmail).link,
    );
    expect(secondToken).not.toBe(firstToken);

    await request(context.app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: firstToken })
      .expect(400)
      .expect((response) => {
        expect(getResponseBody(response).code).toBe(
          'INVALID_EMAIL_VERIFICATION_TOKEN',
        );
      });

    await request(context.app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: secondToken })
      .expect(201);
  });

  it('keeps the previous link valid when resend delivery fails', async () => {
    await registerUser(failedResendEmail);
    const firstToken = extractToken(
      getLastVerificationMail(context.mail, failedResendEmail).link,
    );
    const user = await context.prisma.user.findUniqueOrThrow({
      where: { email: failedResendEmail },
    });
    await ageVerificationTokens(context.prisma, user.id);

    context.mail.failNextVerification = true;
    await request(context.app.getHttpServer())
      .post('/auth/resend-verification')
      .send({ email: failedResendEmail })
      .expect(500)
      .expect((response) => {
        expect(getResponseBody(response).code).toBe('EMAIL_DELIVERY_FAILED');
      });

    await expect(
      context.prisma.emailVerificationToken.count({
        where: { userId: user.id, usedAt: null },
      }),
    ).resolves.toBe(1);

    await request(context.app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: firstToken })
      .expect(201);
  });

  it('rejects weak passwords during registration and reset', async () => {
    await request(context.app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'weak-password@example.com',
        password: 'onlyletters',
        role: 'STUDENT',
      })
      .expect(400);

    await request(context.app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'not-a-real-token', password: '1234567890' })
      .expect(400);
  });

  function registerUser(email: string): Promise<request.Response> {
    return request(context.app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password,
        role: 'STUDENT',
        displayName: 'Verification Test',
      })
      .expect(201);
  }
});
