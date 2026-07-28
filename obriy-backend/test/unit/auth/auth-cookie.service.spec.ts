import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthCookieService } from '../../../src/auth/auth-cookie.service';

describe('AuthCookieService', () => {
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        COOKIE_SAME_SITE: 'lax',
        COOKIE_SECURE: 'false',
        REFRESH_TOKEN_TTL_DAYS: '30',
      };
      return values[key];
    }),
  } as unknown as ConfigService;
  const service = new AuthCookieService(config);

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('stores OAuth state in a short-lived httpOnly callback cookie', () => {
    const cookie = jest.fn();
    const response = {
      cookie,
    } as unknown as Response;

    service.setOAuthState(response, 'signed-state');

    expect(cookie).toHaveBeenCalledWith(
      'obriy_oauth_state',
      'signed-state',
      expect.objectContaining({
        httpOnly: true,
        maxAge: 10 * 60 * 1000,
        path: '/auth/google',
        sameSite: 'lax',
        secure: false,
      }),
    );
  });

  it('reads only string cookie values', () => {
    expect(
      service.getOAuthState({
        cookies: { obriy_oauth_state: 'signed-state' },
      } as unknown as Request),
    ).toBe('signed-state');
    expect(
      service.getOAuthState({
        cookies: { obriy_oauth_state: { unsafe: true } },
      } as unknown as Request),
    ).toBeUndefined();
  });
});
