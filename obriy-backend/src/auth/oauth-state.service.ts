import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

type OAuthStatePayload = {
  role: UserRole;
  nonce: string;
  expiresAt: number;
};

@Injectable()
export class OAuthStateService {
  constructor(
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  create(role: UserRole): string {
    if (role === UserRole.ADMIN) {
      throw this.invalidState();
    }

    const payload: OAuthStatePayload = {
      role,
      nonce: randomBytes(16).toString('base64url'),
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );

    return `${encodedPayload}.${this.sign(encodedPayload)}`;
  }

  verify(state: string | undefined): OAuthStatePayload {
    if (!state) {
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
        !payload.role ||
        payload.role === UserRole.ADMIN ||
        !Object.values(UserRole).includes(payload.role) ||
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

  private invalidState(): BadRequestException {
    return new BadRequestException({
      code: 'INVALID_OAUTH_STATE',
      message: this.i18n.t('auth.errors.invalidOAuthState'),
    });
  }
}
