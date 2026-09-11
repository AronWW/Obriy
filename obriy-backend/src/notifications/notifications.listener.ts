import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type {
  AttemptNotificationEvent,
  ReleaseNotificationEvent,
} from './notifications.events';
import { notificationEvents } from './notifications.events';
import { NotificationProducerService } from './notification-producer.service';

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(private readonly producer: NotificationProducerService) {}

  @OnEvent(notificationEvents.releasePublished, { async: true })
  async releasePublished(event: ReleaseNotificationEvent): Promise<void> {
    await this.run(() => this.producer.notifyReleasePublished(event.releaseId));
  }

  @OnEvent(notificationEvents.releaseAvailable, { async: true })
  async releaseAvailable(event: ReleaseNotificationEvent): Promise<void> {
    await this.run(() => this.producer.notifyReleaseAvailable(event.releaseId));
  }

  @OnEvent(notificationEvents.reviewRequired, { async: true })
  async reviewRequired(event: AttemptNotificationEvent): Promise<void> {
    await this.run(() => this.producer.notifyReviewRequired(event.attemptId));
  }

  @OnEvent(notificationEvents.attemptFinalized, { async: true })
  async attemptFinalized(event: AttemptNotificationEvent): Promise<void> {
    await this.run(() =>
      this.producer.notifyAttemptFinalized(event.attemptId, event.reward),
    );
  }

  private async run(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : 'Notification event failed',
      );
    }
  }
}
