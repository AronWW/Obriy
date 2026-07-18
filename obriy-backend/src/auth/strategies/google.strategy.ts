import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { GoogleProfile } from '../types/google-profile.type';

type GoogleProfileJson = {
  email_verified?: boolean;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') ?? 'disabled',
      clientSecret:
        configService.get<string>('GOOGLE_CLIENT_SECRET') ?? 'disabled',
      callbackURL:
        configService.get<string>('GOOGLE_CALLBACK_URL') ??
        'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): GoogleProfile {
    const email = profile.emails?.[0]?.value;
    const rawProfile = profile._json as GoogleProfileJson;

    return {
      googleId: profile.id,
      email: email?.trim().toLowerCase() ?? '',
      emailVerified: rawProfile.email_verified === true,
      displayName: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
    };
  }
}
