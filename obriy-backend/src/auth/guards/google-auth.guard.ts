import {
  BadRequestException,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { I18nService } from 'nestjs-i18n';
import { OAuthStateService } from '../oauth-state.service';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly oauthStateService: OAuthStateService,
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
    if (typeof request.query.code === 'string') {
      return { session: false };
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

    return {
      session: false,
      scope: ['email', 'profile'],
      state: this.oauthStateService.create(role as UserRole),
    };
  }
}
