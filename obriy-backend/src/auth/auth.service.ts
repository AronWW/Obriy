import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { I18nService } from 'nestjs-i18n';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { Locale, Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { JwtPayload } from '../common/types/jwt-payload.type';
import { MailService } from '../mail/mail.service';
import { PrivateProfileDto } from '../users/dto/profile.dto';
import { UsersService } from '../users/users.service';
import { AuthMessageDto, AuthResponseDto } from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { OAuthStateService } from './oauth-state.service';
import { GoogleProfile } from './types/google-profile.type';
import { CompleteGoogleRegistrationDto } from './dto/complete-google-registration.dto';

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

type TokenUser = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

type UserWithProfile = Prisma.UserGetPayload<{
  include: { profile: true };
}>;

export type GoogleCallbackResult =
  | { type: 'SESSION'; code: string }
  | { type: 'REGISTRATION_REQUIRED'; code: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
    private readonly i18n: I18nService,
    private readonly oauthStateService: OAuthStateService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthMessageDto> {
    this.assertRegistrableRole(dto.role);

    const email = this.normalizeEmail(dto.email);
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (existingUser) {
      if (existingUser.status === UserStatus.PENDING) {
        const passwordHash = await argon2.hash(dto.password);

        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            passwordHash,
            role: dto.role,
            profile: {
              update: {
                displayName:
                  dto.displayName?.trim() ??
                  existingUser.profile?.displayName ??
                  this.getDefaultDisplayName(email),
                preferredLocale: dto.preferredLocale ?? Locale.UK,
              },
            },
          },
        });

        const retryAfterSeconds = await this.sendVerificationLink(
          existingUser.id,
          email,
          dto.preferredLocale ??
            existingUser.profile?.preferredLocale ??
            Locale.UK,
        );

        return new AuthMessageDto({
          code: 'EMAIL_VERIFICATION_SENT',
          message: this.t('auth.emailVerificationSent'),
          email,
          retryAfterSeconds,
        });
      }

      throw new ConflictException({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: this.t('auth.errors.emailAlreadyRegistered'),
      });
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: dto.role,
        status: UserStatus.PENDING,
        profile: {
          create: {
            displayName:
              dto.displayName?.trim() ?? this.getDefaultDisplayName(email),
            preferredLocale: dto.preferredLocale ?? Locale.UK,
          },
        },
      },
    });

    const retryAfterSeconds = await this.sendVerificationLink(
      user.id,
      email,
      dto.preferredLocale ?? Locale.UK,
    );

    return new AuthMessageDto({
      code: 'EMAIL_VERIFICATION_SENT',
      message: this.t('auth.emailVerificationSent'),
      email,
      retryAfterSeconds,
    });
  }

  async login(
    dto: LoginDto,
  ): Promise<AuthResponseDto & { refreshToken: string }> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: this.t('auth.errors.invalidCredentials'),
      });
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: this.t('auth.errors.invalidCredentials'),
      });
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException({
        code: 'USER_SUSPENDED',
        message: this.t('auth.errors.userSuspended'),
      });
    }

    if (user.status === UserStatus.PENDING || !user.emailVerifiedAt) {
      const retryAfterSeconds = await this.sendVerificationLink(
        user.id,
        user.email,
        user.profile?.preferredLocale ?? Locale.UK,
      );

      throw new ForbiddenException({
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: this.t('auth.errors.emailVerificationRequired'),
        email: user.email,
        retryAfterSeconds,
      });
    }

    const tokens = await this.issueTokenPair(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.usersService.toPrivateProfile(user),
    };
  }

  async refresh(
    refreshToken: string | undefined,
  ): Promise<AuthResponseDto & { refreshToken: string }> {
    if (!refreshToken) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_MISSING',
        message: this.t('auth.errors.refreshTokenMissing'),
      });
    }

    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { profile: true } } },
    });

    if (!storedToken) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: this.t('auth.errors.invalidRefreshToken'),
      });
    }

    if (storedToken.revokedAt) {
      await this.revokeAllRefreshTokens(storedToken.userId);

      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REUSED',
        message: this.t('auth.errors.refreshTokenReused'),
      });
    }

    if (storedToken.expiresAt.getTime() <= Date.now()) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_EXPIRED',
        message: this.t('auth.errors.refreshTokenExpired'),
      });
    }

    if (storedToken.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code: 'USER_NOT_ACTIVE',
        message: this.t('auth.errors.userNotActive'),
      });
    }

    const tokens = await this.issueTokenPair(storedToken.user, storedToken.id);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.usersService.toPrivateProfile(storedToken.user),
    };
  }

  async logout(refreshToken: string | undefined): Promise<AuthMessageDto> {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);

      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return new AuthMessageDto({
      code: 'LOGGED_OUT',
      message: this.t('auth.loggedOut'),
    });
  }

  async logoutAll(user: AuthUser): Promise<AuthMessageDto> {
    await this.revokeAllRefreshTokens(user.id);

    return new AuthMessageDto({
      code: 'LOGGED_OUT_ALL',
      message: this.t('auth.loggedOutAll'),
    });
  }

  async verifyEmail(token: string): Promise<AuthMessageDto> {
    const tokenHash = this.hashToken(token);
    const storedToken = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !storedToken ||
      storedToken.usedAt ||
      storedToken.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException({
        code: 'INVALID_EMAIL_VERIFICATION_TOKEN',
        message: this.t('auth.errors.invalidEmailVerificationToken'),
      });
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: storedToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: storedToken.userId },
        data: {
          status: UserStatus.ACTIVE,
          emailVerifiedAt: storedToken.user.emailVerifiedAt ?? new Date(),
        },
      }),
    ]);

    return new AuthMessageDto({
      code: 'EMAIL_VERIFIED',
      message: this.t('auth.emailVerified'),
      email: storedToken.user.email,
    });
  }

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<AuthMessageDto> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      return new AuthMessageDto({
        code: 'EMAIL_VERIFICATION_SENT',
        message: this.t('auth.emailVerificationSent'),
        email,
        retryAfterSeconds: this.getNumberConfig(
          'EMAIL_SEND_COOLDOWN_SECONDS',
          60,
        ),
      });
    }

    if (user.status === UserStatus.ACTIVE && user.emailVerifiedAt) {
      return new AuthMessageDto({
        code: 'EMAIL_ALREADY_VERIFIED',
        message: this.t('auth.emailAlreadyVerified'),
        email,
      });
    }

    const cooldownSeconds = await this.getEmailCooldownSeconds(
      'verification',
      user.id,
    );

    if (cooldownSeconds > 0) {
      throw new HttpException(
        {
          code: 'EMAIL_VERIFICATION_COOLDOWN',
          message: this.t('auth.errors.emailVerificationCooldown'),
          email,
          retryAfterSeconds: cooldownSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const retryAfterSeconds = await this.sendVerificationLink(
      user.id,
      user.email,
      user.profile?.preferredLocale ?? Locale.UK,
    );

    return new AuthMessageDto({
      code: 'EMAIL_VERIFICATION_SENT',
      message: this.t('auth.emailVerificationSent'),
      email,
      retryAfterSeconds,
    });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<AuthMessageDto> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (user?.status === UserStatus.ACTIVE && user.emailVerifiedAt) {
      await this.sendPasswordResetLink(
        user.id,
        user.email,
        user.profile?.preferredLocale ?? Locale.UK,
      );
    }

    return new AuthMessageDto({
      code: 'PASSWORD_RESET_SENT',
      message: this.t('auth.passwordResetSent'),
      email,
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<AuthMessageDto> {
    const tokenHash = this.hashToken(dto.token);
    const storedToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (
      !storedToken ||
      storedToken.usedAt ||
      storedToken.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException({
        code: 'INVALID_PASSWORD_RESET_TOKEN',
        message: this.t('auth.errors.invalidPasswordResetToken'),
      });
    }

    const passwordHash = await argon2.hash(dto.password);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: storedToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: storedToken.userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return new AuthMessageDto({
      code: 'PASSWORD_RESET',
      message: this.t('auth.passwordReset'),
    });
  }

  async getMe(user: AuthUser): Promise<PrivateProfileDto> {
    return this.usersService.findMe(user.id);
  }

  async handleGoogleCallback(
    profile: GoogleProfile,
    state: string | undefined,
    expectedState: string | undefined,
  ): Promise<GoogleCallbackResult> {
    const oauthState = this.oauthStateService.verify(state, expectedState);

    if (!profile.email || !profile.emailVerified) {
      throw new UnauthorizedException({
        code: 'GOOGLE_EMAIL_NOT_VERIFIED',
        message: this.t('auth.errors.googleEmailNotVerified'),
      });
    }

    const normalizedProfile = {
      ...profile,
      email: this.normalizeEmail(profile.email),
    };
    const existingUser = await this.findGoogleUser(normalizedProfile);

    if (existingUser) {
      const user = await this.prisma.$transaction((tx) =>
        this.linkExistingGoogleUser(
          tx,
          existingUser,
          normalizedProfile,
          oauthState.locale,
        ),
      );

      return {
        type: 'SESSION',
        code: await this.createOAuthExchangeCode(user.id),
      };
    }

    if (oauthState.intent === 'LOGIN') {
      return {
        type: 'REGISTRATION_REQUIRED',
        code: await this.createOAuthRegistrationTicket(
          normalizedProfile,
          oauthState.locale,
        ),
      };
    }

    if (!oauthState.role) {
      throw new BadRequestException({
        code: 'INVALID_OAUTH_STATE',
        message: this.t('auth.errors.invalidOAuthState'),
      });
    }

    this.assertRegistrableRole(oauthState.role);
    const user = await this.prisma.user.create({
      data: {
        email: normalizedProfile.email,
        googleId: normalizedProfile.googleId,
        role: oauthState.role,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            displayName:
              normalizedProfile.displayName ||
              this.getDefaultDisplayName(normalizedProfile.email),
            avatarUrl: normalizedProfile.avatarUrl,
            preferredLocale: oauthState.locale,
          },
        },
      },
      include: { profile: true },
    });

    return {
      type: 'SESSION',
      code: await this.createOAuthExchangeCode(user.id),
    };
  }

  async completeGoogleRegistration(
    dto: CompleteGoogleRegistrationDto,
  ): Promise<AuthResponseDto & { refreshToken: string }> {
    this.assertRegistrableRole(dto.role);
    const now = new Date();
    const tokenHash = this.hashToken(dto.code);

    const user = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.oAuthRegistrationTicket.findUnique({
        where: { tokenHash },
      });

      if (!ticket || ticket.usedAt || ticket.expiresAt <= now) {
        throw this.invalidOAuthRegistrationTicket();
      }

      const consumed = await tx.oAuthRegistrationTicket.updateMany({
        where: { id: ticket.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) {
        throw this.invalidOAuthRegistrationTicket();
      }

      const profile: GoogleProfile = {
        googleId: ticket.googleId,
        email: ticket.email,
        emailVerified: true,
        displayName: ticket.displayName,
        ...(ticket.avatarUrl ? { avatarUrl: ticket.avatarUrl } : {}),
      };
      const [userByGoogleId, userByEmail] = await Promise.all([
        tx.user.findUnique({
          where: { googleId: ticket.googleId },
          include: { profile: true },
        }),
        tx.user.findUnique({
          where: { email: ticket.email },
          include: { profile: true },
        }),
      ]);
      const existingUser = this.resolveGoogleUser(
        userByGoogleId,
        userByEmail,
        profile,
      );
      const locale = dto.preferredLocale ?? ticket.locale;

      if (existingUser) {
        return this.linkExistingGoogleUser(tx, existingUser, profile, locale);
      }

      return tx.user.create({
        data: {
          email: ticket.email,
          googleId: ticket.googleId,
          role: dto.role,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: now,
          profile: {
            create: {
              displayName:
                ticket.displayName || this.getDefaultDisplayName(ticket.email),
              avatarUrl: ticket.avatarUrl,
              preferredLocale: locale,
            },
          },
        },
        include: { profile: true },
      });
    });

    const tokens = await this.issueTokenPair(user);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.usersService.toPrivateProfile(user),
    };
  }

  async exchangeOAuthCode(
    code: string,
  ): Promise<AuthResponseDto & { refreshToken: string }> {
    const storedCode = await this.prisma.oAuthExchangeCode.findUnique({
      where: { tokenHash: this.hashToken(code) },
      include: { user: { include: { profile: true } } },
    });

    if (
      !storedCode ||
      storedCode.usedAt ||
      storedCode.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_OAUTH_EXCHANGE_CODE',
        message: this.t('auth.errors.invalidOAuthExchangeCode'),
      });
    }

    const consumed = await this.prisma.oAuthExchangeCode.updateMany({
      where: { id: storedCode.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    if (consumed.count !== 1) {
      throw new UnauthorizedException({
        code: 'INVALID_OAUTH_EXCHANGE_CODE',
        message: this.t('auth.errors.invalidOAuthExchangeCode'),
      });
    }

    const tokens = await this.issueTokenPair(storedCode.user);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.usersService.toPrivateProfile(storedCode.user),
    };
  }

  private async issueTokenPair(
    user: TokenUser,
    rotateFromTokenId?: string,
  ): Promise<TokenPair> {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = this.generateOpaqueToken();
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = this.addDays(
      new Date(),
      this.getNumberConfig('REFRESH_TOKEN_TTL_DAYS', 30),
    );

    await this.prisma.$transaction(async (tx) => {
      const newToken = await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      if (rotateFromTokenId) {
        await tx.refreshToken.update({
          where: { id: rotateFromTokenId },
          data: {
            revokedAt: new Date(),
            replacedByTokenId: newToken.id,
          },
        });
      }
    });

    return { accessToken, refreshToken };
  }

  private signAccessToken(user: TokenUser): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    return this.jwtService.signAsync(payload, {
      secret:
        this.configService.get<string>('JWT_ACCESS_SECRET') ??
        'dev-access-secret-change-me',
      expiresIn: this.getAccessTokenTtlSeconds(),
    });
  }

  private async sendVerificationLink(
    userId: string,
    email: string,
    locale: Locale,
  ): Promise<number> {
    const remainingCooldown = await this.getEmailCooldownSeconds(
      'verification',
      userId,
    );
    if (remainingCooldown > 0) {
      return remainingCooldown;
    }

    const token = this.generateOpaqueToken();
    const storedToken = await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        expiresAt: this.addHours(
          new Date(),
          this.getNumberConfig('EMAIL_VERIFICATION_TTL_HOURS', 24),
        ),
      },
    });

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const verificationLink = `${frontendUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;

    try {
      await this.mailService.sendEmailVerification(
        email,
        verificationLink,
        locale,
      );
    } catch (error: unknown) {
      await this.prisma.emailVerificationToken.delete({
        where: { id: storedToken.id },
      });
      throw error;
    }

    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, id: { not: storedToken.id }, usedAt: null },
      data: { usedAt: new Date() },
    });

    return this.getNumberConfig('EMAIL_SEND_COOLDOWN_SECONDS', 60);
  }

  private async sendPasswordResetLink(
    userId: string,
    email: string,
    locale: Locale,
  ): Promise<void> {
    if ((await this.getEmailCooldownSeconds('password-reset', userId)) > 0) {
      return;
    }

    const token = this.generateOpaqueToken();
    const storedToken = await this.prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        expiresAt: this.addMinutes(
          new Date(),
          this.getNumberConfig('PASSWORD_RESET_TTL_MINUTES', 30),
        ),
      },
    });

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const resetLink = `${frontendUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

    try {
      await this.mailService.sendPasswordReset(email, resetLink, locale);
    } catch (error: unknown) {
      await this.prisma.passwordResetToken.delete({
        where: { id: storedToken.id },
      });
      throw error;
    }

    await this.prisma.passwordResetToken.updateMany({
      where: { userId, id: { not: storedToken.id }, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  private async findGoogleUser(
    profile: GoogleProfile,
  ): Promise<UserWithProfile | null> {
    const [userByGoogleId, userByEmail] = await Promise.all([
      this.prisma.user.findUnique({
        where: { googleId: profile.googleId },
        include: { profile: true },
      }),
      this.prisma.user.findUnique({
        where: { email: profile.email },
        include: { profile: true },
      }),
    ]);

    return this.resolveGoogleUser(userByGoogleId, userByEmail, profile);
  }

  private resolveGoogleUser(
    userByGoogleId: UserWithProfile | null,
    userByEmail: UserWithProfile | null,
    profile: GoogleProfile,
  ): UserWithProfile | null {
    if (userByGoogleId && userByEmail && userByGoogleId.id !== userByEmail.id) {
      throw new ConflictException({
        code: 'GOOGLE_ACCOUNT_CONFLICT',
        message: this.t('auth.errors.googleAccountConflict'),
      });
    }

    const existingUser = userByGoogleId ?? userByEmail;
    if (existingUser?.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException({
        code: 'USER_SUSPENDED',
        message: this.t('auth.errors.userSuspended'),
      });
    }

    if (existingUser?.googleId && existingUser.googleId !== profile.googleId) {
      throw new ConflictException({
        code: 'GOOGLE_ACCOUNT_CONFLICT',
        message: this.t('auth.errors.googleAccountConflict'),
      });
    }

    return existingUser;
  }

  private async linkExistingGoogleUser(
    tx: Prisma.TransactionClient,
    existingUser: UserWithProfile,
    profile: GoogleProfile,
    fallbackLocale: Locale,
  ): Promise<UserWithProfile> {
    const avatarUpdate =
      existingUser.profile?.avatarUrl || !profile.avatarUrl
        ? {}
        : { avatarUrl: profile.avatarUrl };
    const user = await tx.user.update({
      where: { id: existingUser.id },
      data: {
        googleId: profile.googleId,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: existingUser.emailVerifiedAt ?? new Date(),
        profile: {
          upsert: {
            create: {
              displayName:
                profile.displayName ||
                this.getDefaultDisplayName(existingUser.email),
              avatarUrl: profile.avatarUrl,
              preferredLocale: fallbackLocale,
            },
            update: avatarUpdate,
          },
        },
      },
      include: { profile: true },
    });

    await tx.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    return user;
  }

  private async createOAuthRegistrationTicket(
    profile: GoogleProfile,
    locale: Locale,
  ): Promise<string> {
    const code = this.generateOpaqueToken();
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.oAuthRegistrationTicket.updateMany({
        where: {
          usedAt: null,
          OR: [{ googleId: profile.googleId }, { email: profile.email }],
        },
        data: { usedAt: now },
      }),
      this.prisma.oAuthRegistrationTicket.create({
        data: {
          tokenHash: this.hashToken(code),
          googleId: profile.googleId,
          email: profile.email,
          displayName:
            profile.displayName || this.getDefaultDisplayName(profile.email),
          avatarUrl: profile.avatarUrl,
          locale,
          expiresAt: this.addMinutes(
            now,
            this.getNumberConfig('OAUTH_REGISTRATION_TTL_MINUTES', 10),
          ),
        },
      }),
    ]);

    return code;
  }

  private invalidOAuthRegistrationTicket(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'INVALID_OAUTH_REGISTRATION_TICKET',
      message: this.t('auth.errors.invalidOAuthRegistrationTicket'),
    });
  }

  private async createOAuthExchangeCode(userId: string): Promise<string> {
    const code = this.generateOpaqueToken();
    await this.prisma.oAuthExchangeCode.create({
      data: {
        userId,
        tokenHash: this.hashToken(code),
        expiresAt: this.addSeconds(
          new Date(),
          this.getNumberConfig('OAUTH_EXCHANGE_TTL_SECONDS', 60),
        ),
      },
    });

    return code;
  }

  private async getEmailCooldownSeconds(
    type: 'verification' | 'password-reset',
    userId: string,
  ): Promise<number> {
    const cooldownSeconds = this.getNumberConfig(
      'EMAIL_SEND_COOLDOWN_SECONDS',
      60,
    );
    const token =
      type === 'verification'
        ? await this.prisma.emailVerificationToken.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          })
        : await this.prisma.passwordResetToken.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          });

    if (!token) {
      return 0;
    }

    const elapsedSeconds = (Date.now() - token.createdAt.getTime()) / 1000;
    return Math.max(
      0,
      Math.min(cooldownSeconds, Math.ceil(cooldownSeconds - elapsedSeconds)),
    );
  }

  private revokeAllRefreshTokens(userId: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private assertRegistrableRole(role: UserRole): void {
    if (role === UserRole.ADMIN) {
      throw new BadRequestException({
        code: 'ADMIN_REGISTRATION_FORBIDDEN',
        message: this.t('auth.errors.adminRegistrationForbidden'),
      });
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private getDefaultDisplayName(email: string): string {
    return email.split('@')[0] || 'Obriy user';
  }

  private getNumberConfig(key: string, fallback: number): number {
    const value = this.configService.get<string | number>(key);
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  private getAccessTokenTtlSeconds(): number {
    const value = this.configService.get<string>('ACCESS_TOKEN_TTL') ?? '15m';
    const match = value.match(/^(\d+)([smhd])$/);

    if (!match) {
      return 15 * 60;
    }

    const amount = Number(match[1]);
    const unit = match[2];

    if (unit === 's') {
      return amount;
    }

    if (unit === 'm') {
      return amount * 60;
    }

    if (unit === 'h') {
      return amount * 60 * 60;
    }

    return amount * 24 * 60 * 60;
  }

  private generateOpaqueToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private addDays(date: Date, days: number): Date {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  }

  private addHours(date: Date, hours: number): Date {
    const nextDate = new Date(date);
    nextDate.setHours(nextDate.getHours() + hours);
    return nextDate;
  }

  private addMinutes(date: Date, minutes: number): Date {
    const nextDate = new Date(date);
    nextDate.setMinutes(nextDate.getMinutes() + minutes);
    return nextDate;
  }

  private addSeconds(date: Date, seconds: number): Date {
    const nextDate = new Date(date);
    nextDate.setSeconds(nextDate.getSeconds() + seconds);
    return nextDate;
  }

  private t(key: string): string {
    return this.i18n.t(key);
  }
}
