import { validateEnvironment } from '../../../src/config/env.validation';

describe('validateEnvironment', () => {
  const validEnvironment = {
    DATABASE_URL: 'postgresql://user:password@localhost:5432/obriy',
    JWT_ACCESS_SECRET: 'a-secure-access-secret',
    FRONTEND_URL: 'http://localhost:5173',
  };

  it('accepts a valid minimal environment', () => {
    expect(validateEnvironment({ ...validEnvironment })).toEqual(
      validEnvironment,
    );
  });

  it('requires database and JWT configuration', () => {
    expect(() => validateEnvironment({ JWT_ACCESS_SECRET: 'secret' })).toThrow(
      'DATABASE_URL is required',
    );
  });

  it('requires Google credentials as a pair', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        GOOGLE_CLIENT_ID: 'client-id',
      }),
    ).toThrow('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET');
  });

  it('requires callback and independent state secrets for Google OAuth', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        GOOGLE_CLIENT_ID: 'client-id',
        GOOGLE_CLIENT_SECRET: 'client-secret',
      }),
    ).toThrow('GOOGLE_CALLBACK_URL is required');

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        GOOGLE_CLIENT_ID: 'client-id',
        GOOGLE_CLIENT_SECRET: 'client-secret',
        GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
      }),
    ).toThrow('GOOGLE_OAUTH_STATE_SECRET is required');
  });

  it('requires secure cookies for SameSite none', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        COOKIE_SAME_SITE: 'none',
        COOKIE_SECURE: 'false',
      }),
    ).toThrow('COOKIE_SECURE must be true');
  });

  it('rejects invalid positive numeric values', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        REFRESH_TOKEN_TTL_DAYS: '0',
      }),
    ).toThrow('REFRESH_TOKEN_TTL_DAYS must be a positive number');
  });
});
