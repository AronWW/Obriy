import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ParentLinksController } from './parent-links.controller';
import { ParentLinksService } from './parent-links.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ParentLinksController],
  providers: [ParentLinksService],
})
export class ParentLinksModule {}
