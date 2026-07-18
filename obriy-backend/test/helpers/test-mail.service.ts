import { InternalServerErrorException } from '@nestjs/common';
import { Locale } from '@prisma/client';

export type SentMail = {
  email: string;
  link: string;
  locale: Locale;
};

export class TestMailService {
  readonly verificationEmails: SentMail[] = [];
  readonly passwordResetEmails: SentMail[] = [];
  failNextVerification = false;

  sendEmailVerification(
    email: string,
    link: string,
    locale: Locale,
  ): Promise<void> {
    if (this.failNextVerification) {
      this.failNextVerification = false;
      throw new InternalServerErrorException({
        code: 'EMAIL_DELIVERY_FAILED',
        message: 'Delivery failed.',
      });
    }

    this.verificationEmails.push({ email, link, locale });
    return Promise.resolve();
  }

  sendPasswordReset(
    email: string,
    link: string,
    locale: Locale,
  ): Promise<void> {
    this.passwordResetEmails.push({ email, link, locale });
    return Promise.resolve();
  }
}
