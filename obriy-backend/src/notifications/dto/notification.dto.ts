import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class NotificationDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiPropertyOptional({ nullable: true })
  subjectStudentId: string | null;

  @ApiProperty({ type: Object, additionalProperties: true })
  payload: Record<string, unknown>;

  @ApiProperty()
  isRead: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  readAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  constructor(data: NotificationDto) {
    Object.assign(this, data);
  }
}

export class NotificationPageDto {
  @ApiProperty({ type: NotificationDto, isArray: true })
  items: NotificationDto[];

  @ApiPropertyOptional({ nullable: true })
  nextCursor: string | null;

  @ApiProperty({ minimum: 0 })
  unreadCount: number;

  constructor(data: NotificationPageDto) {
    Object.assign(this, data);
  }
}

export class NotificationUnreadCountDto {
  @ApiProperty({ minimum: 0 })
  unreadCount: number;

  constructor(count: number) {
    this.unreadCount = count;
  }
}
