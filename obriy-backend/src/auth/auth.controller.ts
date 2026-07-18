import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { PrivateProfileDto } from '../users/dto/profile.dto';
import { AuthMessageDto, AuthResponseDto } from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { OAuthExchangeDto } from './dto/oauth-exchange.dto';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import type { GoogleProfile } from './types/google-profile.type';
import { GoogleOAuthExceptionFilter } from './filters/google-oauth-exception.filter';
import { AuthErrorDto } from './dto/auth-error.dto';

type CookieRequest = Request & {
  cookies?: unknown;
};

type GoogleCallbackRequest = Request & {
  user: GoogleProfile;
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Register a student, teacher, or parent account' })
  @ApiCreatedResponse({ type: AuthMessageDto })
  @ApiBadRequestResponse({ type: AuthErrorDto })
  @ApiConflictResponse({ type: AuthErrorDto })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthMessageDto> {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ type: AuthErrorDto })
  @ApiForbiddenResponse({ type: AuthErrorDto })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(dto);

    this.setRefreshCookie(response, result.refreshToken);

    return new AuthResponseDto({
      accessToken: result.accessToken,
      user: result.user,
    });
  }

  @ApiOperation({
    summary: 'Rotate the refresh token and obtain a new access token',
  })
  @ApiCookieAuth('obriy_refresh_token')
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ type: AuthErrorDto })
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  async refresh(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.refresh(
      this.getRefreshCookie(request),
    );

    this.setRefreshCookie(response, result.refreshToken);

    return new AuthResponseDto({
      accessToken: result.accessToken,
      user: result.user,
    });
  }

  @ApiOperation({ summary: 'Revoke the current refresh token' })
  @ApiCookieAuth('obriy_refresh_token')
  @ApiCreatedResponse({ type: AuthMessageDto })
  @Post('logout')
  async logout(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthMessageDto> {
    const result = await this.authService.logout(
      this.getRefreshCookie(request),
    );

    this.clearRefreshCookie(response);

    return result;
  }

  @ApiOperation({ summary: 'Revoke all refresh tokens for the current user' })
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: AuthMessageDto })
  @ApiUnauthorizedResponse({ type: AuthErrorDto })
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthMessageDto> {
    const result = await this.authService.logoutAll(user);

    this.clearRefreshCookie(response);

    return result;
  }

  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiCreatedResponse({ type: AuthMessageDto })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<AuthMessageDto> {
    return this.authService.forgotPassword(dto);
  }

  @ApiOperation({ summary: 'Set a new password using a reset token' })
  @ApiCreatedResponse({ type: AuthMessageDto })
  @ApiBadRequestResponse({ type: AuthErrorDto })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto): Promise<AuthMessageDto> {
    return this.authService.resetPassword(dto);
  }

  @ApiOperation({ summary: 'Verify an email using a request body token' })
  @ApiCreatedResponse({ type: AuthMessageDto })
  @ApiBadRequestResponse({ type: AuthErrorDto })
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<AuthMessageDto> {
    return this.authService.verifyEmail(dto.token);
  }

  @ApiOperation({ summary: 'Verify an email using a query token' })
  @ApiQuery({ name: 'token', type: String })
  @ApiOkResponse({ type: AuthMessageDto })
  @ApiBadRequestResponse({ type: AuthErrorDto })
  @Get('verify-email')
  verifyEmailByQuery(@Query('token') token: string): Promise<AuthMessageDto> {
    return this.authService.verifyEmail(token);
  }

  @ApiOperation({ summary: 'Resend an email verification link' })
  @ApiCreatedResponse({ type: AuthMessageDto })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('resend-verification')
  resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<AuthMessageDto> {
    return this.authService.resendVerification(dto);
  }

  @ApiOperation({ summary: 'Get the current private profile' })
  @ApiBearerAuth()
  @ApiOkResponse({ type: PrivateProfileDto })
  @ApiUnauthorizedResponse({ type: AuthErrorDto })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: AuthUser): Promise<PrivateProfileDto> {
    return this.authService.getMe(user);
  }

  @ApiOperation({ summary: 'Start Google OAuth for a selected role' })
  @ApiQuery({ name: 'role', enum: ['STUDENT', 'TEACHER', 'PARENT'] })
  @ApiFoundResponse({ description: 'Redirects to Google.' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleLogin(): void {}

  @ApiOperation({ summary: 'Handle the Google OAuth callback' })
  @ApiFoundResponse({
    description: 'Redirects to the frontend with code or error.',
  })
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseFilters(GoogleOAuthExceptionFilter)
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleCallback(
    @Req() request: GoogleCallbackRequest,
    @Query('state') state: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const code = await this.authService.handleGoogleCallback(
      request.user,
      state,
    );
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const redirectUrl = new URL('/auth/google/callback', frontendUrl);
    redirectUrl.searchParams.set('code', code);

    response.redirect(redirectUrl.toString());
  }

  @ApiOperation({
    summary: 'Exchange a single-use Google code for an Obriy session',
  })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ type: AuthErrorDto })
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('google/exchange')
  async exchangeGoogleCode(
    @Body() dto: OAuthExchangeDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.exchangeOAuthCode(dto.code);
    this.setRefreshCookie(response, result.refreshToken);

    return new AuthResponseDto({
      accessToken: result.accessToken,
      user: result.user,
    });
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(this.getRefreshCookieName(), refreshToken, {
      ...this.getRefreshCookieOptions(),
      maxAge: this.getRefreshCookieMaxAgeMs(),
    });
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(
      this.getRefreshCookieName(),
      this.getRefreshCookieOptions(),
    );
  }

  private getRefreshCookieOptions(): CookieOptions {
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
      path: '/auth',
      ...(configuredDomain ? { domain: configuredDomain } : {}),
    };
  }

  private isSameSiteValue(value: string): value is 'lax' | 'strict' | 'none' {
    return value === 'lax' || value === 'strict' || value === 'none';
  }

  private getRefreshCookie(request: CookieRequest): string | undefined {
    if (!this.isCookieRecord(request.cookies)) {
      return undefined;
    }

    const refreshToken = request.cookies[this.getRefreshCookieName()];

    return typeof refreshToken === 'string' ? refreshToken : undefined;
  }

  private isCookieRecord(cookies: unknown): cookies is Record<string, unknown> {
    return typeof cookies === 'object' && cookies !== null;
  }

  private getRefreshCookieName(): string {
    return (
      this.configService.get<string>('REFRESH_TOKEN_COOKIE_NAME') ??
      'obriy_refresh_token'
    );
  }

  private getRefreshCookieMaxAgeMs(): number {
    const daysValue = this.configService.get<string | number>(
      'REFRESH_TOKEN_TTL_DAYS',
    );
    const days = Number(daysValue);
    const ttlDays = Number.isFinite(days) ? days : 30;
    return ttlDays * 24 * 60 * 60 * 1000;
  }
}
