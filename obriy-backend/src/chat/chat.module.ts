import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatController, ParentChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatStorageService } from './chat-storage.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ChatController, ParentChatController],
  providers: [ChatService, ChatStorageService],
  exports: [ChatService],
})
export class ChatModule {}
