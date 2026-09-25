const DEFAULT_POOL_SIZE = 5;

export function getDatabaseConnectionString(): string {
  const configuredUrl = process.env.DATABASE_URL;
  if (!configuredUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (process.env.DATABASE_SSL !== 'true') {
    return configuredUrl;
  }

  const url = new URL(configuredUrl);
  url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}

export function getDatabasePoolSize(): number {
  const configuredSize = process.env.DATABASE_POOL_MAX;
  if (!configuredSize) {
    return DEFAULT_POOL_SIZE;
  }

  const poolSize = Number(configuredSize);
  if (!Number.isSafeInteger(poolSize) || poolSize <= 0) {
    throw new Error('DATABASE_POOL_MAX must be a positive integer');
  }

  return poolSize;
}

export function getDatabaseAdapterConfig() {
  return {
    connectionString: getDatabaseConnectionString(),
    max: getDatabasePoolSize(),
    connectionTimeoutMillis: 10_000,
  };
}
