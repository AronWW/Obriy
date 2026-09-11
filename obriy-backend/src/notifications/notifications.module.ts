import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationProducerService } from './notification-producer.service';
import { NotificationsListener } from './notifications.listener';
import { NotificationsSchedulerService } from './notifications-scheduler.service';

@Module({
  imports: [ConfigModule, JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [
    NotificationsGateway,
    NotificationsService,
    NotificationProducerService,
    NotificationsListener,
    NotificationsSchedulerService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
