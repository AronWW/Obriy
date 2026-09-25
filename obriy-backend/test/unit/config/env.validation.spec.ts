import { validateEnvironment } from '../../../src/config/env.validation';

describe('validateEnvironment', () => {
  const validEnvironment = {
    DATABASE_URL: 'postgresql://user:password@localhost:5432/obriy',
    JWT_ACCESS_SECRET: 'a-secure-access-secret',
    FRONTEND_URL: 'http://localhost:5173',
  };
  const validProductionEnvironment = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:password@db.example.com:5432/obriy',
    DATABASE_SSL: 'true',
    DATABASE_POOL_MAX: '5',
    API_PUBLIC_URL: 'https://api.obriy.me',
    FRONTEND_URL: 'https://obriy.me',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    COOKIE_SECURE: 'true',
    COOKIE_SAME_SITE: 'lax',
    COOKIE_DOMAIN: '',
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_CALLBACK_URL: 'https://api.obriy.me/auth/google/callback',
    GOOGLE_OAUTH_STATE_SECRET: 'b'.repeat(32),
    CLOUDINARY_CLOUD_NAME: 'obriy',
    CLOUDINARY_API_KEY: 'cloudinary-key',
    CLOUDINARY_API_SECRET: 'cloudinary-secret',
    RESEND_API_KEY: 'resend-key',
    MAIL_FROM: 'Obriy <hello@obriy.me>',
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

  it('requires the complete Cloudinary credential group', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        CLOUDINARY_CLOUD_NAME: 'obriy',
      }),
    ).toThrow(
      'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET',
    );
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        CLOUDINARY_CLOUD_NAME: 'obriy',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
      }),
    ).not.toThrow();
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

  it('accepts a complete production environment', () => {
    expect(() =>
      validateEnvironment({ ...validProductionEnvironment }),
    ).not.toThrow();
  });

  it('requires public HTTPS endpoints and database TLS in production', () => {
    expect(() =>
      validateEnvironment({
        ...validProductionEnvironment,
        FRONTEND_URL: 'http://localhost:5173',
      }),
    ).toThrow('FRONTEND_URL must be a public HTTPS URL');

    expect(() =>
      validateEnvironment({
        ...validProductionEnvironment,
        DATABASE_SSL: 'false',
      }),
    ).toThrow('DATABASE_SSL must be true in production');
  });

  it('keeps the production refresh cookie secure and host-only', () => {
    expect(() =>
      validateEnvironment({
        ...validProductionEnvironment,
        COOKIE_SECURE: 'false',
      }),
    ).toThrow('COOKIE_SECURE must be true in production');

    expect(() =>
      validateEnvironment({
        ...validProductionEnvironment,
        COOKIE_DOMAIN: '.obriy.me',
      }),
    ).toThrow('COOKIE_DOMAIN must be empty in production');
  });

  it('requires the Google callback to match the public API URL', () => {
    expect(() =>
      validateEnvironment({
        ...validProductionEnvironment,
        GOOGLE_CALLBACK_URL: 'https://example.com/auth/google/callback',
      }),
    ).toThrow('GOOGLE_CALLBACK_URL must match API_PUBLIC_URL');
  });
});
