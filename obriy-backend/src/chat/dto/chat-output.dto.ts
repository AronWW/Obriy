import { ChatAttachmentResourceType, UserRole } from '@prisma/client';

export class ChatPersonDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  classId: string | null;
  className: string | null;

  constructor(data: ChatPersonDto) {
    Object.assign(this, data);
  }
}

export class ChatAttachmentDto {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  resourceType: ChatAttachmentResourceType;

  constructor(data: ChatAttachmentDto) {
    Object.assign(this, data);
  }
}

export class ChatMessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: UserRole;
  body: string | null;
  editedAt: Date | null;
  createdAt: Date;
  isReadByCounterpart: boolean;
  attachments: ChatAttachmentDto[];

  constructor(data: ChatMessageDto) {
    Object.assign(this, data);
  }
}

export class ChatConversationDto {
  id: string;
  counterpart: ChatPersonDto;
  isWritable: boolean;
  unreadCount: number;
  lastMessage: ChatMessageDto | null;
  createdAt: Date;
  lastMessageAt: Date | null;

  constructor(data: ChatConversationDto) {
    Object.assign(this, data);
  }
}

export class ChatConversationPageDto {
  items: ChatConversationDto[];
  nextCursor: string | null;

  constructor(data: ChatConversationPageDto) {
    Object.assign(this, data);
  }
}

export class ChatContactDto extends ChatPersonDto {
  conversationId: string | null;

  constructor(data: ChatContactDto) {
    super(data);
    Object.assign(this, data);
  }
}

export class ChatContactPageDto {
  items: ChatContactDto[];
  nextCursor: string | null;

  constructor(data: ChatContactPageDto) {
    Object.assign(this, data);
  }
}

export class ChatMessagePageDto {
  conversation: ChatConversationDto;
  items: ChatMessageDto[];
  nextCursor: string | null;

  constructor(data: ChatMessagePageDto) {
    Object.assign(this, data);
  }
}

export class ChatUnreadCountDto {
  unreadCount: number;

  constructor(unreadCount: number) {
    this.unreadCount = unreadCount;
  }
}

export class ChatAttachmentDownloadDto {
  url: string;

  constructor(url: string) {
    this.url = url;
  }
}
