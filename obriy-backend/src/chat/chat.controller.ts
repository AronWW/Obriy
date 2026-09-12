import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { ChatService } from './chat.service';
import {
  ChatPageQueryDto,
  CreateConversationDto,
  EditMessageDto,
  SendMessageDto,
  type UploadedChatFile,
} from './dto/chat-input.dto';

const attachmentInterceptor = FilesInterceptor('files', 5, {
  limits: { files: 5, fileSize: 20 * 1024 * 1024 },
});

@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  listConversations(
    @CurrentUser() user: AuthUser,
    @Query() query: ChatPageQueryDto,
  ) {
    return this.chat.listConversations(user, query);
  }

  @Get('contacts')
  listContacts(
    @CurrentUser() user: AuthUser,
    @Query() query: ChatPageQueryDto,
  ) {
    return this.chat.listContacts(user, query);
  }

  @Post('conversations')
  createConversation(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateConversationDto,
  ) {
    return this.chat.createConversation(user, dto);
  }

  @Get('conversations/:conversationId/messages')
  listMessages(
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
    @Query() query: ChatPageQueryDto,
  ) {
    return this.chat.listMessages(user, conversationId, query);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(attachmentInterceptor)
  @Post('conversations/:conversationId/messages')
  sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
    @UploadedFiles() files?: UploadedChatFile[],
  ) {
    return this.chat.sendMessage(user, conversationId, dto, files);
  }

  @Patch('messages/:messageId')
  editMessage(
    @CurrentUser() user: AuthUser,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.chat.editMessage(user, messageId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('conversations/:conversationId/read')
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
  ) {
    return this.chat.markRead(user, conversationId);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.chat.unreadCount(user);
  }

  @Get('attachments/:attachmentId')
  attachment(
    @CurrentUser() user: AuthUser,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.chat.attachmentDownload(user, attachmentId);
  }
}

@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('Parent chat supervision')
@Controller('parent/children/:childId')
export class ParentChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  list(
    @CurrentUser() user: AuthUser,
    @Param('childId') childId: string,
    @Query() query: ChatPageQueryDto,
  ) {
    return this.chat.listParentConversations(user, childId, query);
  }

  @Get('conversations/:conversationId/messages')
  messages(
    @CurrentUser() user: AuthUser,
    @Param('childId') childId: string,
    @Param('conversationId') conversationId: string,
    @Query() query: ChatPageQueryDto,
  ) {
    return this.chat.listParentMessages(user, childId, conversationId, query);
  }
}
