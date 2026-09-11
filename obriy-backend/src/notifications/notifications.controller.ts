import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  NotificationDto,
  NotificationPageDto,
  NotificationUnreadCountDto,
} from './dto/notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @ApiOkResponse({ type: NotificationPageDto })
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: NotificationQueryDto,
  ): Promise<NotificationPageDto> {
    return this.notifications.list(user, query);
  }

  @ApiOkResponse({ type: NotificationUnreadCountDto })
  @Get('unread-count')
  unreadCount(
    @CurrentUser() user: AuthUser,
  ): Promise<NotificationUnreadCountDto> {
    return this.notifications.unreadCount(user);
  }

  @ApiOkResponse({ type: NotificationDto })
  @Patch(':notificationId/read')
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('notificationId') notificationId: string,
  ): Promise<NotificationDto> {
    return this.notifications.markRead(user, notificationId);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@CurrentUser() user: AuthUser): Promise<void> {
    return this.notifications.markAllRead(user);
  }
}
