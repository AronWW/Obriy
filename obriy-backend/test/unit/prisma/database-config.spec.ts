import {
  getDatabaseAdapterConfig,
  getDatabaseConnectionString,
  getDatabasePoolSize,
} from '../../../prisma/database-config';

describe('database configuration', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnvironment,
      DATABASE_URL:
        'postgresql://user:password@localhost:5432/obriy?schema=public',
    };
    delete process.env.DATABASE_SSL;
    delete process.env.DATABASE_POOL_MAX;
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it('keeps the local connection string unchanged', () => {
    expect(getDatabaseConnectionString()).toBe(process.env.DATABASE_URL);
  });

  it('requires certificate and hostname verification when TLS is enabled', () => {
    process.env.DATABASE_SSL = 'true';

    const url = new URL(getDatabaseConnectionString());
    expect(url.searchParams.get('sslmode')).toBe('verify-full');
  });

  it('uses a conservative pool size and supports an explicit override', () => {
    expect(getDatabasePoolSize()).toBe(5);

    process.env.DATABASE_POOL_MAX = '8';
    expect(getDatabaseAdapterConfig()).toMatchObject({
      max: 8,
      connectionTimeoutMillis: 10_000,
    });
  });

  it('rejects an invalid pool size', () => {
    process.env.DATABASE_POOL_MAX = '1.5';
    expect(() => getDatabasePoolSize()).toThrow(
      'DATABASE_POOL_MAX must be a positive integer',
    );
  });
});
