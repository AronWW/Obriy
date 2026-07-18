import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Locale } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { Resend } from 'resend';

type MailContent = {
  subject: string;
  html: string;
  text: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendEmailVerification(
    email: string,
    verificationLink: string,
    locale: Locale,
  ): Promise<void> {
    const hours = this.getNumberConfig('EMAIL_VERIFICATION_TTL_HOURS', 24);
    await this.send(
      email,
      this.getContent('verification', verificationLink, locale, hours),
      locale,
    );
  }

  async sendPasswordReset(
    email: string,
    resetLink: string,
    locale: Locale,
  ): Promise<void> {
    const minutes = this.getNumberConfig('PASSWORD_RESET_TTL_MINUTES', 30);
    await this.send(
      email,
      this.getContent('passwordReset', resetLink, locale, minutes),
      locale,
    );
  }

  private async send(
    to: string,
    content: MailContent,
    locale: Locale,
  ): Promise<void> {
    if (!this.resend) {
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        throw new InternalServerErrorException({
          code: 'MAIL_NOT_CONFIGURED',
          message: this.t('auth.errors.mailNotConfigured', locale),
        });
      }

      this.logger.warn(
        `RESEND_API_KEY is missing. Email to ${to} was not sent. Link: ${this.extractLink(content.text)}`,
      );
      return;
    }

    const from = this.configService.getOrThrow<string>('MAIL_FROM');
    const { error } = await this.resend.emails.send({
      from,
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });

    if (error) {
      this.logger.error(`Resend failed for ${to}: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'EMAIL_DELIVERY_FAILED',
        message: this.t('auth.errors.emailDeliveryFailed', locale),
      });
    }
  }

  private getContent(
    type: 'verification' | 'passwordReset',
    link: string,
    locale: Locale,
    ttl: number,
  ): MailContent {
    const prefix = `mail.${type}`;
    const args = { link, ttl };
    return {
      subject: this.t(`${prefix}.subject`, locale, args),
      text: this.t(`${prefix}.text`, locale, args),
      html: this.renderTemplate(
        this.t(`${prefix}.title`, locale, args),
        this.t(`${prefix}.description`, locale, args),
        this.t(`${prefix}.action`, locale, args),
        link,
        this.t(`${prefix}.footer`, locale, args),
        locale,
      ),
    };
  }

  private renderTemplate(
    title: string,
    description: string,
    action: string,
    link: string,
    footer: string,
    locale: Locale,
  ): string {
    const lang = this.toLanguage(locale);
    return `<!doctype html>
<html lang="${lang}">
  <body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#17202a">
    <div style="max-width:560px;margin:0 auto;padding:40px 20px">
      <div style="background:#ffffff;border:1px solid #dfe4ea;border-radius:8px;padding:32px">
        <div style="font-size:20px;font-weight:700;margin-bottom:24px">Obriy</div>
        <h1 style="font-size:24px;margin:0 0 12px">${title}</h1>
        <p style="font-size:16px;line-height:1.5;margin:0 0 24px">${description}</p>
        <a href="${link}" style="display:inline-block;background:#176b51;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">${action}</a>
        <p style="font-size:13px;line-height:1.5;color:#667085;margin:24px 0 0">${footer}</p>
      </div>
    </div>
  </body>
</html>`;
  }

  private t(
    key: string,
    locale: Locale,
    args?: Record<string, string | number>,
  ): string {
    return this.i18n.t(key, { lang: this.toLanguage(locale), args });
  }

  private toLanguage(locale: Locale): 'en' | 'uk' {
    return locale === Locale.EN ? 'en' : 'uk';
  }

  private getNumberConfig(key: string, fallback: number): number {
    const value = Number(this.configService.get<string | number>(key));
    return Number.isFinite(value) ? value : fallback;
  }

  private extractLink(text: string): string {
    return text.match(/https?:\/\/\S+/)?.[0] ?? 'no link';
  }
}
