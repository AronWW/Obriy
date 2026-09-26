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
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
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
import { AuthCookieService } from './auth-cookie.service';
import { CompleteGoogleRegistrationDto } from './dto/complete-google-registration.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  SubmitSuspensionAppealDto,
  SuspensionContextDto,
  SuspensionTokenDto,
} from './dto/suspension-appeal.dto';
import { SuspensionAppealsService } from './suspension-appeals.service';

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
    private readonly authCookieService: AuthCookieService,
    private readonly suspensionAppeals: SuspensionAppealsService,
  ) {}

  @ApiOperation({ summary: 'Get safe context for a suspended account' })
  @ApiOkResponse({ type: SuspensionContextDto })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('suspension-context')
  suspensionContext(@Body() dto: SuspensionTokenDto) {
    return this.suspensionAppeals.context(dto);
  }

  @ApiOperation({ summary: 'Submit an appeal for the current suspension' })
  @ApiCreatedResponse({ type: SuspensionContextDto })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('suspension-appeals')
  submitSuspensionAppeal(@Body() dto: SubmitSuspensionAppealDto) {
    return this.suspensionAppeals.submit(dto);
  }

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

    this.authCookieService.setRefreshToken(response, result.refreshToken);

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
      this.authCookieService.getRefreshToken(request),
    );

    this.authCookieService.setRefreshToken(response, result.refreshToken);

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
      this.authCookieService.getRefreshToken(request),
    );

    this.authCookieService.clearRefreshToken(response);

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

    this.authCookieService.clearRefreshToken(response);

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

  @ApiOperation({
    summary: 'Change the local password and revoke all sessions',
  })
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: AuthMessageDto })
  @ApiBadRequestResponse({ type: AuthErrorDto })
  @ApiUnauthorizedResponse({ type: AuthErrorDto })
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthMessageDto> {
    const result = await this.authService.changePassword(user, dto);
    this.authCookieService.clearRefreshToken(response);
    return result;
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
  @ApiTooManyRequestsResponse({
    description: 'The 60-second email cooldown is still active.',
    type: AuthErrorDto,
  })
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

  @ApiOperation({ summary: 'Start a Google login or registration flow' })
  @ApiQuery({ name: 'intent', enum: ['LOGIN', 'REGISTER'] })
  @ApiQuery({
    name: 'role',
    enum: ['STUDENT', 'TEACHER', 'PARENT'],
    required: false,
  })
  @ApiQuery({ name: 'locale', enum: ['UK', 'EN'], required: false })
  @ApiFoundResponse({ description: 'Redirects to Google.' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseFilters(GoogleOAuthExceptionFilter)
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
    const result = await this.authService.handleGoogleCallback(
      request.user,
      state,
      this.authCookieService.getOAuthState(request),
    );
    this.authCookieService.clearOAuthState(response);
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const redirectUrl = new URL('/auth/google/callback', frontendUrl);
    redirectUrl.searchParams.set(
      result.type === 'SESSION' ? 'code' : 'registration',
      result.code,
    );

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
    this.authCookieService.setRefreshToken(response, result.refreshToken);

    return new AuthResponseDto({
      accessToken: result.accessToken,
      user: result.user,
    });
  }

  @ApiOperation({ summary: 'Finish Google registration after choosing a role' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ type: AuthErrorDto })
  @ApiUnauthorizedResponse({ type: AuthErrorDto })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google/complete-registration')
  async completeGoogleRegistration(
    @Body() dto: CompleteGoogleRegistrationDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.completeGoogleRegistration(dto);
    this.authCookieService.setRefreshToken(response, result.refreshToken);

    return new AuthResponseDto({
      accessToken: result.accessToken,
      user: result.user,
    });
  }
}
