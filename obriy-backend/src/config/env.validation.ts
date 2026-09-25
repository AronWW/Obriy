type Environment = Record<string, unknown>;

const numericVariables = [
  'PORT',
  'DATABASE_POOL_MAX',
  'REFRESH_TOKEN_TTL_DAYS',
  'EMAIL_VERIFICATION_TTL_HOURS',
  'PASSWORD_RESET_TTL_MINUTES',
  'EMAIL_SEND_COOLDOWN_SECONDS',
  'OAUTH_EXCHANGE_TTL_SECONDS',
  'OAUTH_REGISTRATION_TTL_MINUTES',
  'AUTH_TRANSIENT_TOKEN_RETENTION_DAYS',
  'OAUTH_CODE_RETENTION_DAYS',
  'REFRESH_TOKEN_RETENTION_DAYS',
] as const;

export function validateEnvironment(config: Environment): Environment {
  requireString(config, 'DATABASE_URL');
  requireString(config, 'JWT_ACCESS_SECRET');

  validateEnum(config, 'NODE_ENV', ['development', 'test', 'production']);
  validateUrl(config, 'DATABASE_URL');
  validateUrl(config, 'API_PUBLIC_URL');
  validateUrl(config, 'FRONTEND_URL');
  validateUrl(config, 'GOOGLE_CALLBACK_URL');

  for (const key of numericVariables) {
    validatePositiveNumber(config, key);
  }

  validateOptionalGroup(config, ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);
  validateOptionalGroup(config, [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ]);
  requireWhenConfigured(config, 'GOOGLE_CLIENT_ID', 'GOOGLE_CALLBACK_URL');
  requireWhenConfigured(
    config,
    'GOOGLE_CLIENT_ID',
    'GOOGLE_OAUTH_STATE_SECRET',
  );
  requireWhenConfigured(config, 'RESEND_API_KEY', 'MAIL_FROM');
  validateEnum(config, 'COOKIE_SAME_SITE', ['lax', 'strict', 'none']);
  validateBoolean(config, 'COOKIE_SECURE');
  validateBoolean(config, 'DATABASE_SSL');

  if (config.COOKIE_SAME_SITE === 'none' && config.COOKIE_SECURE !== 'true') {
    throw new Error('COOKIE_SECURE must be true when COOKIE_SAME_SITE is none');
  }

  if (config.NODE_ENV === 'production') {
    validateProductionEnvironment(config);
  }

  return config;
}

function validateProductionEnvironment(config: Environment): void {
  const requiredVariables = [
    'API_PUBLIC_URL',
    'FRONTEND_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_CALLBACK_URL',
    'GOOGLE_OAUTH_STATE_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'RESEND_API_KEY',
    'MAIL_FROM',
  ];
  for (const key of requiredVariables) {
    requireString(config, key);
  }

  requireHttpsUrl(config, 'API_PUBLIC_URL');
  requireHttpsUrl(config, 'FRONTEND_URL');
  requireHttpsUrl(config, 'GOOGLE_CALLBACK_URL');
  rejectLocalDatabase(config);

  if (config.DATABASE_SSL !== 'true') {
    throw new Error('DATABASE_SSL must be true in production');
  }
  if (config.COOKIE_SECURE !== 'true') {
    throw new Error('COOKIE_SECURE must be true in production');
  }
  if ((config.COOKIE_SAME_SITE ?? 'lax') !== 'lax') {
    throw new Error('COOKIE_SAME_SITE must be lax in production');
  }
  if (typeof config.COOKIE_DOMAIN === 'string' && config.COOKIE_DOMAIN.trim()) {
    throw new Error('COOKIE_DOMAIN must be empty in production');
  }

  requireMinimumLength(config, 'JWT_ACCESS_SECRET', 32);
  requireMinimumLength(config, 'GOOGLE_OAUTH_STATE_SECRET', 32);

  const apiUrl = new URL(String(config.API_PUBLIC_URL));
  const callbackUrl = new URL(String(config.GOOGLE_CALLBACK_URL));
  const expectedCallback = new URL('/auth/google/callback', apiUrl);
  if (callbackUrl.toString() !== expectedCallback.toString()) {
    throw new Error(
      'GOOGLE_CALLBACK_URL must match API_PUBLIC_URL/auth/google/callback',
    );
  }
}

function validateEnum(
  config: Environment,
  key: string,
  values: string[],
): void {
  const value = config[key];
  if (value === undefined || value === '') {
    return;
  }
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new Error(`${key} must be one of: ${values.join(', ')}`);
  }
}

function validateBoolean(config: Environment, key: string): void {
  const value = config[key];
  if (
    value !== undefined &&
    value !== '' &&
    value !== 'true' &&
    value !== 'false'
  ) {
    throw new Error(`${key} must be true or false`);
  }
}

function requireString(config: Environment, key: string): void {
  if (typeof config[key] !== 'string' || config[key].trim() === '') {
    throw new Error(`${key} is required`);
  }
}

function validateUrl(config: Environment, key: string): void {
  const value = config[key];

  if (value === undefined || value === '') {
    return;
  }

  if (typeof value !== 'string') {
    throw new Error(`${key} must be a valid URL`);
  }

  try {
    new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL`);
  }
}

function requireHttpsUrl(config: Environment, key: string): void {
  const url = new URL(String(config[key]));
  if (url.protocol !== 'https:' || isLocalHostname(url.hostname)) {
    throw new Error(`${key} must be a public HTTPS URL in production`);
  }
}

function rejectLocalDatabase(config: Environment): void {
  const url = new URL(String(config.DATABASE_URL));
  if (isLocalHostname(url.hostname)) {
    throw new Error('DATABASE_URL must not point to localhost in production');
  }
}

function isLocalHostname(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname);
}

function requireMinimumLength(
  config: Environment,
  key: string,
  minimumLength: number,
): void {
  const value = String(config[key]);
  if (value.length < minimumLength) {
    throw new Error(`${key} must contain at least ${minimumLength} characters`);
  }
}

function requireWhenConfigured(
  config: Environment,
  triggerKey: string,
  requiredKey: string,
): void {
  const trigger = config[triggerKey];
  const required = config[requiredKey];

  if (
    typeof trigger === 'string' &&
    trigger.trim() !== '' &&
    (typeof required !== 'string' || required.trim() === '')
  ) {
    throw new Error(`${requiredKey} is required when ${triggerKey} is set`);
  }
}

function validatePositiveNumber(config: Environment, key: string): void {
  const value = config[key];

  if (value === undefined || value === '') {
    return;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${key} must be a positive number`);
  }
}

function validateOptionalGroup(config: Environment, keys: string[]): void {
  const configuredKeys = keys.filter(
    (key) => typeof config[key] === 'string' && config[key].trim() !== '',
  );

  if (configuredKeys.length !== 0 && configuredKeys.length !== keys.length) {
    throw new Error(`${keys.join(', ')} must be configured together`);
  }
}
