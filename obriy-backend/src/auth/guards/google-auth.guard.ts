import {
  BadRequestException,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Locale, UserRole } from '@prisma/client';
import type { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { OAuthStateService } from '../oauth-state.service';
import { AuthCookieService } from '../auth-cookie.service';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly oauthStateService: OAuthStateService,
    private readonly authCookieService: AuthCookieService,
    private readonly i18n: I18nService,
  ) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext): Record<string, unknown> {
    if (!this.configService.get<string>('GOOGLE_CLIENT_ID')) {
      throw new ServiceUnavailableException({
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
        message: this.i18n.t('auth.errors.googleOAuthNotConfigured'),
      });
    }

    const request = context.switchToHttp().getRequest<Request>();
    if (this.isCallbackRequest(request)) {
      if (
        typeof request.query.code !== 'string' &&
        typeof request.query.error !== 'string'
      ) {
        throw new BadRequestException({
          code: 'INVALID_OAUTH_STATE',
          message: this.i18n.t('auth.errors.invalidOAuthState'),
        });
      }

      return { session: false };
    }

    const intent = request.query.intent;
    if (intent !== 'LOGIN' && intent !== 'REGISTER') {
      throw new BadRequestException({
        code: 'INVALID_OAUTH_INTENT',
        message: this.i18n.t('auth.errors.invalidOAuthIntent'),
      });
    }

    const role = this.getRegistrationRole(request, intent);
    const locale = request.query.locale === Locale.EN ? Locale.EN : Locale.UK;
    const state = this.oauthStateService.create({ intent, role, locale });
    const response = context.switchToHttp().getResponse<Response>();
    this.authCookieService.setOAuthState(response, state);

    return {
      session: false,
      scope: ['email', 'profile'],
      state,
    };
  }

  private getRegistrationRole(
    request: Request,
    intent: 'LOGIN' | 'REGISTER',
  ): UserRole | undefined {
    if (intent === 'LOGIN') {
      return undefined;
    }

    const role = request.query.role;
    if (
      typeof role !== 'string' ||
      !Object.values(UserRole).includes(role as UserRole) ||
      role === UserRole.ADMIN
    ) {
      throw new BadRequestException({
        code: 'INVALID_REGISTRATION_ROLE',
        message: this.i18n.t('auth.errors.invalidRegistrationRole'),
      });
    }

    return role as UserRole;
  }

  private isCallbackRequest(request: Request): boolean {
    return [request.originalUrl, request.url, request.path].some((value) => {
      const path = value.split('?')[0].replace(/\/+$/, '');
      return path.endsWith('/callback');
    });
  }
}
