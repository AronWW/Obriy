import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Locale, UserRole } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type OAuthIntent = 'LOGIN' | 'REGISTER';

export type OAuthStatePayload = {
  intent: OAuthIntent;
  role?: UserRole;
  locale: Locale;
  nonce: string;
  expiresAt: number;
};

type CreateOAuthStateInput = {
  intent: OAuthIntent;
  role?: UserRole;
  locale: Locale;
};

@Injectable()
export class OAuthStateService {
  constructor(
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  create(input: CreateOAuthStateInput): string {
    if (
      (input.intent === 'REGISTER' && !input.role) ||
      input.role === UserRole.ADMIN ||
      !Object.values(Locale).includes(input.locale)
    ) {
      throw this.invalidState();
    }

    const payload: OAuthStatePayload = {
      intent: input.intent,
      ...(input.intent === 'REGISTER' ? { role: input.role } : {}),
      locale: input.locale,
      nonce: randomBytes(16).toString('base64url'),
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );

    return `${encodedPayload}.${this.sign(encodedPayload)}`;
  }

  verify(
    state: string | undefined,
    expectedState: string | undefined,
  ): OAuthStatePayload {
    if (!state || !expectedState || !this.matches(state, expectedState)) {
      throw this.invalidState();
    }

    const [encodedPayload, signature] = state.split('.');
    if (!encodedPayload || !signature) {
      throw this.invalidState();
    }

    const expectedSignature = this.sign(encodedPayload);
    const supplied = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);

    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      throw this.invalidState();
    }

    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as Partial<OAuthStatePayload>;

      if (
        (payload.intent !== 'LOGIN' && payload.intent !== 'REGISTER') ||
        (payload.intent === 'REGISTER' &&
          (!payload.role ||
            payload.role === UserRole.ADMIN ||
            !Object.values(UserRole).includes(payload.role))) ||
        !payload.locale ||
        !Object.values(Locale).includes(payload.locale) ||
        typeof payload.nonce !== 'string' ||
        typeof payload.expiresAt !== 'number' ||
        payload.expiresAt <= Date.now()
      ) {
        throw this.invalidState();
      }

      return payload as OAuthStatePayload;
    } catch {
      throw this.invalidState();
    }
  }

  private sign(value: string): string {
    const secret =
      this.configService.get<string>('GOOGLE_OAUTH_STATE_SECRET') ??
      this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');

    return createHmac('sha256', secret).update(value).digest('base64url');
  }

  private matches(value: string, expectedValue: string): boolean {
    const supplied = Buffer.from(value);
    const expected = Buffer.from(expectedValue);

    return (
      supplied.length === expected.length && timingSafeEqual(supplied, expected)
    );
  }

  private invalidState(): BadRequestException {
    return new BadRequestException({
      code: 'INVALID_OAUTH_STATE',
      message: this.i18n.t('auth.errors.invalidOAuthState'),
    });
  }
}
