import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { OAuthStateService } from '../../../src/auth/oauth-state.service';

describe('OAuthStateService', () => {
  let service: OAuthStateService;

  beforeEach(() => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'GOOGLE_OAUTH_STATE_SECRET' ? 'oauth-state-secret' : undefined,
      ),
      getOrThrow: jest.fn(() => 'fallback-secret'),
    } as unknown as ConfigService;
    const i18n = {
      t: jest.fn(() => 'Invalid OAuth state.'),
    } as unknown as I18nService;

    service = new OAuthStateService(config, i18n);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates and verifies a signed role payload', () => {
    const state = service.create(UserRole.TEACHER);
    const payload = service.verify(state);

    expect(payload.role).toBe(UserRole.TEACHER);
    expect(typeof payload.nonce).toBe('string');
    expect(typeof payload.expiresAt).toBe('number');
  });

  it('rejects a tampered signature', () => {
    const state = service.create(UserRole.STUDENT);
    const [payload, signature] = state.split('.');
    const replacement = signature.endsWith('a') ? 'b' : 'a';
    const tampered = `${payload}.${signature.slice(0, -1)}${replacement}`;

    expect(() => service.verify(tampered)).toThrow(BadRequestException);
  });

  it('rejects expired state', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const state = service.create(UserRole.PARENT);
    jest.spyOn(Date, 'now').mockReturnValue(1_000 + 10 * 60 * 1000 + 1);

    expect(() => service.verify(state)).toThrow(BadRequestException);
  });

  it('does not allow public admin registration', () => {
    expect(() => service.create(UserRole.ADMIN)).toThrow(BadRequestException);
  });
});
