import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { OAuthStateService } from './oauth-state.service';
import { AuthTokenCleanupService } from './auth-token-cleanup.service';
import { GoogleOAuthExceptionFilter } from './filters/google-oauth-exception.filter';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MailModule,
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    GoogleAuthGuard,
    OAuthStateService,
    AuthTokenCleanupService,
    GoogleOAuthExceptionFilter,
  ],
})
export class AuthModule {}
