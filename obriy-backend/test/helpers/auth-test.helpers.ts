import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { SentMail, TestMailService } from './test-mail.service';

export function extractToken(link: string): string {
  const token = new URL(link).searchParams.get('token');
  if (!token) {
    throw new Error('Expected token in email link');
  }
  return token;
}

export function getRefreshCookie(
  header: string | string[] | undefined,
): string {
  const values = typeof header === 'string' ? [header] : header;
  const cookie = values?.find((value) =>
    value.startsWith('obriy_refresh_token='),
  );
  if (!cookie) {
    throw new Error('Expected refresh cookie');
  }
  return cookie.split(';')[0];
}

export function getResponseBody(
  response: request.Response,
): Record<string, unknown> {
  const body: unknown = response.body;
  if (typeof body !== 'object' || body === null) {
    throw new Error('Expected JSON response body');
  }
  return body as Record<string, unknown>;
}

export function getStringField(
  response: request.Response,
  field: string,
): string {
  const value = getResponseBody(response)[field];
  if (typeof value !== 'string') {
    throw new Error(`Expected ${field} to be a string`);
  }
  return value;
}

export function getLastVerificationMail(
  mail: TestMailService,
  email: string,
): SentMail {
  const result = [...mail.verificationEmails]
    .reverse()
    .find((item) => item.email === email);
  if (!result) {
    throw new Error(`Expected verification email for ${email}`);
  }
  return result;
}

export async function ageVerificationTokens(
  prisma: PrismaService,
  userId: string,
): Promise<void> {
  await prisma.emailVerificationToken.updateMany({
    where: { userId },
    data: { createdAt: new Date(Date.now() - 2 * 60 * 1000) },
  });
}
