import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

type ErrorBody = {
  code?: unknown;
};

@Catch()
@Injectable()
export class GoogleOAuthExceptionFilter implements ExceptionFilter {
  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const redirectUrl = new URL('/auth/google/callback', frontendUrl);
    redirectUrl.searchParams.set('error', this.getSafeCode(exception));
    response.redirect(redirectUrl.toString());
  }

  private getSafeCode(exception: unknown): string {
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
}
