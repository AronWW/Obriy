import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationProducerService } from './notification-producer.service';
import { NotificationsListener } from './notifications.listener';
import { NotificationsSchedulerService } from './notifications-scheduler.service';
import { AuthSessionListener } from './auth-session.listener';

@Module({
  imports: [ConfigModule, JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [
    NotificationsGateway,
    NotificationsService,
    NotificationProducerService,
    NotificationsListener,
    NotificationsSchedulerService,
    AuthSessionListener,
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
