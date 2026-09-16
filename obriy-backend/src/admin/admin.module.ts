import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { LessonModerationController } from './lesson-moderation.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [AdminController, LessonModerationController],
  providers: [AdminService, AdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
