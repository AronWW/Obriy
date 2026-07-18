type Environment = Record<string, unknown>;

const numericVariables = [
  'PORT',
  'REFRESH_TOKEN_TTL_DAYS',
  'EMAIL_VERIFICATION_TTL_HOURS',
  'PASSWORD_RESET_TTL_MINUTES',
  'EMAIL_SEND_COOLDOWN_SECONDS',
  'OAUTH_EXCHANGE_TTL_SECONDS',
  'AUTH_TRANSIENT_TOKEN_RETENTION_DAYS',
  'OAUTH_CODE_RETENTION_DAYS',
  'REFRESH_TOKEN_RETENTION_DAYS',
] as const;

export function validateEnvironment(config: Environment): Environment {
  requireString(config, 'DATABASE_URL');
  requireString(config, 'JWT_ACCESS_SECRET');

  validateUrl(config, 'FRONTEND_URL');

  for (const key of numericVariables) {
    validatePositiveNumber(config, key);
  }

  validateOptionalGroup(config, ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);
  requireWhenConfigured(config, 'RESEND_API_KEY', 'MAIL_FROM');
  validateEnum(config, 'COOKIE_SAME_SITE', ['lax', 'strict', 'none']);
  validateBoolean(config, 'COOKIE_SECURE');

  if (config.COOKIE_SAME_SITE === 'none' && config.COOKIE_SECURE !== 'true') {
    throw new Error('COOKIE_SECURE must be true when COOKIE_SAME_SITE is none');
  }

  return config;
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
