import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationProducerService } from './notification-producer.service';

@Injectable()
export class NotificationsSchedulerService {
  private readonly logger = new Logger(NotificationsSchedulerService.name);
  private running = false;

  constructor(private readonly producer: NotificationProducerService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchScheduledNotifications(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.producer.scanScheduledNotifications();
    } catch (error) {
      this.logger.error(
        error instanceof Error
          ? error.message
          : 'Scheduled notification scan failed',
      );
    } finally {
      this.running = false;
    }
  }
}
