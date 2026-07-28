import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';

type CookieRequest = Request & {
  cookies?: unknown;
};

const OAUTH_STATE_COOKIE_NAME = 'obriy_oauth_state';

@Injectable()
export class AuthCookieService {
  constructor(private readonly configService: ConfigService) {}

  setRefreshToken(response: Response, token: string): void {
    response.cookie(this.getRefreshCookieName(), token, {
      ...this.getCookieOptions('/auth'),
      maxAge: this.getRefreshCookieMaxAgeMs(),
    });
  }

  getRefreshToken(request: CookieRequest): string | undefined {
    return this.getCookie(request, this.getRefreshCookieName());
  }

  clearRefreshToken(response: Response): void {
    response.clearCookie(
      this.getRefreshCookieName(),
      this.getCookieOptions('/auth'),
    );
  }

  setOAuthState(response: Response, state: string): void {
    response.cookie(OAUTH_STATE_COOKIE_NAME, state, {
      ...this.getCookieOptions('/auth/google'),
      maxAge: 10 * 60 * 1000,
    });
  }

  getOAuthState(request: CookieRequest): string | undefined {
    return this.getCookie(request, OAUTH_STATE_COOKIE_NAME);
  }

  clearOAuthState(response: Response): void {
    response.clearCookie(
      OAUTH_STATE_COOKIE_NAME,
      this.getCookieOptions('/auth/google'),
    );
  }

  private getCookieOptions(path: string): CookieOptions {
    const configuredSameSite =
      this.configService.get<string>('COOKIE_SAME_SITE') ?? 'lax';
    const sameSite = this.isSameSiteValue(configuredSameSite)
      ? configuredSameSite
      : 'lax';
    const configuredDomain = this.configService.get<string>('COOKIE_DOMAIN');

    return {
      httpOnly: true,
      secure:
        this.configService.get<string>('COOKIE_SECURE') === 'true' ||
        this.configService.get<string>('NODE_ENV') === 'production',
      sameSite,
      path,
      ...(configuredDomain ? { domain: configuredDomain } : {}),
    };
  }

  private getCookie(request: CookieRequest, name: string): string | undefined {
    if (typeof request.cookies !== 'object' || request.cookies === null) {
      return undefined;
    }

    const value = (request.cookies as Record<string, unknown>)[name];
    return typeof value === 'string' ? value : undefined;
  }

  private getRefreshCookieName(): string {
    return (
      this.configService.get<string>('REFRESH_TOKEN_COOKIE_NAME') ??
      'obriy_refresh_token'
    );
  }

  private getRefreshCookieMaxAgeMs(): number {
    const days = Number(
      this.configService.get<string | number>('REFRESH_TOKEN_TTL_DAYS'),
    );
    const ttlDays = Number.isFinite(days) ? days : 30;
    return ttlDays * 24 * 60 * 60 * 1000;
  }

  private isSameSiteValue(value: string): value is 'lax' | 'strict' | 'none' {
    return value === 'lax' || value === 'strict' || value === 'none';
  }
}
