import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Locale, UserRole } from '@prisma/client';
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
    const state = service.create({
      intent: 'REGISTER',
      role: UserRole.TEACHER,
      locale: Locale.EN,
    });
    const payload = service.verify(state, state);

    expect(payload.intent).toBe('REGISTER');
    expect(payload.role).toBe(UserRole.TEACHER);
    expect(payload.locale).toBe(Locale.EN);
    expect(typeof payload.nonce).toBe('string');
    expect(typeof payload.expiresAt).toBe('number');
  });

  it('rejects a tampered signature', () => {
    const state = service.create({
      intent: 'REGISTER',
      role: UserRole.STUDENT,
      locale: Locale.UK,
    });
    const [payload, signature] = state.split('.');
    const replacement = signature.endsWith('a') ? 'b' : 'a';
    const tampered = `${payload}.${signature.slice(0, -1)}${replacement}`;

    expect(() => service.verify(tampered, tampered)).toThrow(
      BadRequestException,
    );
  });

  it('rejects expired state', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const state = service.create({
      intent: 'REGISTER',
      role: UserRole.PARENT,
      locale: Locale.UK,
    });
    jest.spyOn(Date, 'now').mockReturnValue(1_000 + 10 * 60 * 1000 + 1);

    expect(() => service.verify(state, state)).toThrow(BadRequestException);
  });

  it('does not allow public admin registration', () => {
    expect(() =>
      service.create({
        intent: 'REGISTER',
        role: UserRole.ADMIN,
        locale: Locale.UK,
      }),
    ).toThrow(BadRequestException);
  });

  it('creates a login state without inventing a registration role', () => {
    const state = service.create({ intent: 'LOGIN', locale: Locale.UK });

    const payload = service.verify(state, state);

    expect(payload).toEqual(
      expect.objectContaining({
        intent: 'LOGIN',
        locale: Locale.UK,
      }),
    );
    expect(payload.role).toBeUndefined();
  });

  it('rejects state that is not bound to the initiating browser', () => {
    const state = service.create({ intent: 'LOGIN', locale: Locale.UK });
    const anotherState = service.create({ intent: 'LOGIN', locale: Locale.UK });

    expect(() => service.verify(state, undefined)).toThrow(BadRequestException);
    expect(() => service.verify(state, anotherState)).toThrow(
      BadRequestException,
    );
  });
});
