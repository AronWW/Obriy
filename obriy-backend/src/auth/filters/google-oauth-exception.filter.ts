import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthCookieService } from '../auth-cookie.service';

type ErrorBody = {
  code?: unknown;
  suspensionAccessToken?: unknown;
};

@Catch()
@Injectable()
export class GoogleOAuthExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly configService: ConfigService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    this.authCookieService.clearOAuthState(response);
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const redirectUrl = new URL('/auth/google/callback', frontendUrl);
    redirectUrl.searchParams.set('error', this.getSafeCode(exception, request));
    const suspensionAccessToken = this.getSuspensionToken(exception);
    if (suspensionAccessToken) {
      redirectUrl.searchParams.set('suspension', suspensionAccessToken);
    }
    response.redirect(redirectUrl.toString());
  }

  private getSafeCode(exception: unknown, request: Request): string {
    if (request.query.error === 'access_denied') {
      return 'GOOGLE_OAUTH_CANCELLED';
    }

    if (!(exception instanceof HttpException)) {
      return 'GOOGLE_OAUTH_FAILED';
    }

    const body: unknown = exception.getResponse();
    if (typeof body !== 'object' || body === null) {
      return 'GOOGLE_OAUTH_FAILED';
    }

    const code = (body as ErrorBody).code;
    return typeof code === 'string' && /^[A-Z0-9_]+$/.test(code)
      ? code
      : 'GOOGLE_OAUTH_FAILED';
  }

  private getSuspensionToken(exception: unknown): string | null {
    if (!(exception instanceof HttpException)) return null;
    const body: unknown = exception.getResponse();
    if (typeof body !== 'object' || body === null) return null;
    const token = (body as ErrorBody).suspensionAccessToken;
    return typeof token === 'string' ? token : null;
  }
}
