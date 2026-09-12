import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChatAttachmentResourceType,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { extname } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  ChatPageQueryDto,
  CreateConversationDto,
  EditMessageDto,
  SendMessageDto,
  UploadedChatFile,
} from './dto/chat-input.dto';
import {
  ChatAttachmentDownloadDto,
  ChatAttachmentDto,
  ChatContactDto,
  ChatContactPageDto,
  ChatConversationDto,
  ChatConversationPageDto,
  ChatMessageDto,
  ChatMessagePageDto,
  ChatPersonDto,
  ChatUnreadCountDto,
} from './dto/chat-output.dto';
import { ChatStorageService } from './chat-storage.service';

const conversationSelect = {
  id: true,
  teacherId: true,
  studentId: true,
  teacherLastReadAt: true,
  studentLastReadAt: true,
  lastMessageAt: true,
  createdAt: true,
  teacher: {
    select: {
      status: true,
      profile: { select: { displayName: true, avatarUrl: true } },
    },
  },
  student: {
    select: {
      status: true,
      profile: { select: { displayName: true, avatarUrl: true } },
      studentClass: {
        select: { id: true, name: true, teacherId: true },
      },
    },
  },
  messages: {
    take: 1,
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      body: true,
      editedAt: true,
      createdAt: true,
      sender: { select: { role: true } },
      attachments: true,
    },
  },
} satisfies Prisma.ConversationSelect;

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  body: true,
  editedAt: true,
  createdAt: true,
  sender: { select: { role: true } },
  attachments: true,
} satisfies Prisma.MessageSelect;

type ConversationRecord = Prisma.ConversationGetPayload<{
  select: typeof conversationSelect;
}>;
type MessageRecord = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

interface Cursor {
  at: string | null;
  id: string;
}

interface ValidatedFile {
  file: UploadedChatFile;
  resourceType: ChatAttachmentResourceType;
  fileName: string;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ChatStorageService,
    private readonly notifications: NotificationsService,
    private readonly realtime: NotificationsGateway,
  ) {}

  async listConversations(
    user: AuthUser,
    query: ChatPageQueryDto,
  ): Promise<ChatConversationPageDto> {
    this.assertChatRole(user);
    return this.findConversationPage(user, query);
  }

  async listParentConversations(
    user: AuthUser,
    childId: string,
    query: ChatPageQueryDto,
  ): Promise<ChatConversationPageDto> {
    await this.assertParentLink(user, childId);
    return this.findConversationPage(user, query, childId);
  }

  async listContacts(
    user: AuthUser,
    query: ChatPageQueryDto,
  ): Promise<ChatContactPageDto> {
    this.assertChatRole(user);
    const search = query.search?.trim();
    if (user.role === UserRole.STUDENT) {
      const student = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: {
          studentClass: {
            select: {
              id: true,
              name: true,
              teacher: {
                select: {
                  id: true,
                  status: true,
                  profile: { select: { displayName: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      });
      const classroom = student?.studentClass;
      if (
        !classroom ||
        classroom.teacher.status !== UserStatus.ACTIVE ||
        !classroom.teacher.profile ||
        (search &&
          !classroom.teacher.profile.displayName
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()))
      )
        return new ChatContactPageDto({ items: [], nextCursor: null });
      const existing = await this.prisma.conversation.findUnique({
        where: {
          teacherId_studentId: {
            teacherId: classroom.teacher.id,
            studentId: user.id,
          },
        },
        select: { id: true },
      });
      return new ChatContactPageDto({
        items: [
          new ChatContactDto({
            id: classroom.teacher.id,
            displayName: classroom.teacher.profile.displayName,
            avatarUrl: classroom.teacher.profile.avatarUrl,
            classId: classroom.id,
            className: classroom.name,
            conversationId: existing?.id ?? null,
          }),
        ],
        nextCursor: null,
      });
    }

    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;
    const students = await this.prisma.user.findMany({
      where: {
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        studentClass: { teacherId: user.id },
        ...(search
          ? {
              profile: {
                displayName: { contains: search, mode: 'insensitive' as const },
              },
            }
          : {}),
        ...(cursor?.at
          ? {
              OR: [
                { profile: { displayName: { gt: cursor.at } } },
                { profile: { displayName: cursor.at }, id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ profile: { displayName: 'asc' } }, { id: 'asc' }],
      take: query.limit + 1,
      select: {
        id: true,
        profile: { select: { displayName: true, avatarUrl: true } },
        studentClass: { select: { id: true, name: true } },
      },
    });
    const page = students.slice(0, query.limit);
    const conversations = await this.prisma.conversation.findMany({
      where: {
        teacherId: user.id,
        studentId: { in: page.map(({ id }) => id) },
      },
      select: { id: true, studentId: true },
    });
    const byStudent = new Map(
      conversations.map((conversation) => [
        conversation.studentId,
        conversation.id,
      ]),
    );
    const last = page.at(-1);
    return new ChatContactPageDto({
      items: page.flatMap((student) =>
        student.profile && student.studentClass
          ? [
              new ChatContactDto({
                id: student.id,
                displayName: student.profile.displayName,
                avatarUrl: student.profile.avatarUrl,
                classId: student.studentClass.id,
                className: student.studentClass.name,
                conversationId: byStudent.get(student.id) ?? null,
              }),
            ]
          : [],
      ),
      nextCursor:
        students.length > query.limit && last?.profile
          ? this.encodeCursor({ at: last.profile.displayName, id: last.id })
          : null,
    });
  }

  async createConversation(
    user: AuthUser,
    dto: CreateConversationDto,
  ): Promise<ChatConversationDto> {
    this.assertChatRole(user);
    const pair =
      user.role === UserRole.TEACHER
        ? { teacherId: user.id, studentId: dto.counterpartId }
        : { teacherId: dto.counterpartId, studentId: user.id };
    await this.assertWritablePair(pair.teacherId, pair.studentId);
    const conversation = await this.prisma.conversation.upsert({
      where: { teacherId_studentId: pair },
      create: pair,
      update: {},
      select: conversationSelect,
    });
    return this.toConversationDto(conversation, user, 0);
  }

  async listMessages(
    user: AuthUser,
    conversationId: string,
    query: ChatPageQueryDto,
  ): Promise<ChatMessagePageDto> {
    this.assertChatRole(user);
    return this.findMessagePage(user, conversationId, query);
  }

  async listParentMessages(
    user: AuthUser,
    childId: string,
    conversationId: string,
    query: ChatPageQueryDto,
  ): Promise<ChatMessagePageDto> {
    await this.assertParentLink(user, childId);
    return this.findMessagePage(user, conversationId, query, childId);
  }

  async sendMessage(
    user: AuthUser,
    conversationId: string,
    dto: SendMessageDto,
    files: UploadedChatFile[] = [],
  ): Promise<ChatMessageDto> {
    this.assertChatRole(user);
    const conversation = await this.findParticipantConversation(
      user,
      conversationId,
    );
    if (!this.isWritable(conversation)) throw this.readOnlyException();
    const body = dto.body?.trim() || null;
    if (!body && files.length === 0)
      throw new BadRequestException({
        code: 'CHAT_MESSAGE_EMPTY',
        message: 'A message requires text or an attachment',
      });
    if (files.length > 5)
      throw new BadRequestException({
        code: 'CHAT_TOO_MANY_ATTACHMENTS',
        message: 'A message may contain up to five attachments',
      });
    const existing = await this.prisma.message.findUnique({
      where: {
        senderId_clientMessageId: {
          senderId: user.id,
          clientMessageId: dto.clientMessageId,
        },
      },
      select: messageSelect,
    });
    if (existing) {
      if (existing.conversationId !== conversationId)
        throw new BadRequestException({
          code: 'CHAT_CLIENT_MESSAGE_ID_REUSED',
          message:
            'This client message ID was already used in another conversation',
        });
      return this.toMessageDto(existing, conversation);
    }

    const validated = files.map((file) => this.validateFile(file));
    const uploaded: Array<{
      storageKey: string;
      resourceType: ChatAttachmentResourceType;
      fileName: string;
      mimeType: string;
      size: number;
    }> = [];
    try {
      for (const value of validated) {
        const result = await this.storage.upload(
          value.file.buffer,
          `obriy/chat/${conversation.id}`,
          value.resourceType,
        );
        uploaded.push({
          storageKey: result.public_id,
          resourceType: value.resourceType,
          fileName: value.fileName,
          mimeType: value.file.mimetype,
          size: value.file.size,
        });
      }
      const now = new Date();
      const created = await this.prisma.$transaction(async (transaction) => {
        await this.assertWritablePair(
          conversation.teacherId,
          conversation.studentId,
          transaction,
        );
        const message = await transaction.message.create({
          data: {
            conversationId,
            senderId: user.id,
            clientMessageId: dto.clientMessageId,
            body,
            attachments: {
              create: uploaded.map((file) => ({
                storageKey: file.storageKey,
                resourceType: file.resourceType,
                originalFileName: file.fileName,
                mimeType: file.mimeType,
                sizeBytes: file.size,
              })),
            },
          },
          select: messageSelect,
        });
        await transaction.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessageAt: now,
            ...(user.role === UserRole.TEACHER
              ? { teacherLastReadAt: now }
              : { studentLastReadAt: now }),
          },
        });
        return message;
      });
      const message = this.toMessageDto(created, conversation);
      const recipientId =
        user.id === conversation.teacherId
          ? conversation.studentId
          : conversation.teacherId;
      this.realtime.emitChatMessage(recipientId, message);
      this.realtime.emitChatMessage(user.id, message);
      const unreadCount = await this.countConversationUnread(
        conversation,
        recipientId,
      );
      await this.notifications.notifyChatMessage({
        recipientId,
        studentId: conversation.studentId,
        conversationId,
        senderDisplayName: this.displayNameFor(conversation, user.id),
        unreadCount,
      });
      return message;
    } catch (error: unknown) {
      await Promise.allSettled(
        uploaded.map((file) =>
          this.storage.destroy(file.storageKey, file.resourceType),
        ),
      );
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.prisma.message.findUnique({
          where: {
            senderId_clientMessageId: {
              senderId: user.id,
              clientMessageId: dto.clientMessageId,
            },
          },
          select: messageSelect,
        });
        if (duplicate?.conversationId === conversationId)
          return this.toMessageDto(duplicate, conversation);
      }
      throw error;
    }
  }

  async editMessage(
    user: AuthUser,
    messageId: string,
    dto: EditMessageDto,
  ): Promise<ChatMessageDto> {
    this.assertChatRole(user);
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, senderId: user.id },
      select: {
        ...messageSelect,
        conversation: { select: conversationSelect },
      },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (!this.isWritable(message.conversation)) throw this.readOnlyException();
    if (Date.now() - message.createdAt.getTime() > 15 * 60 * 1000)
      throw new BadRequestException({
        code: 'CHAT_EDIT_WINDOW_EXPIRED',
        message: 'The message can no longer be edited',
      });
    const body = dto.body.trim();
    if (!body)
      throw new BadRequestException({
        code: 'CHAT_MESSAGE_EMPTY',
        message: 'Message text cannot be empty',
      });
    const updated = await this.prisma.message.update({
      where: { id: message.id },
      data: { body, editedAt: new Date() },
      select: messageSelect,
    });
    const result = this.toMessageDto(updated, message.conversation);
    this.realtime.emitChatUpdated(message.conversation.teacherId, result);
    this.realtime.emitChatUpdated(message.conversation.studentId, result);
    return result;
  }

  async markRead(user: AuthUser, conversationId: string): Promise<void> {
    this.assertChatRole(user);
    const conversation = await this.findParticipantConversation(
      user,
      conversationId,
    );
    const readAt = new Date();
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data:
        user.role === UserRole.TEACHER
          ? { teacherLastReadAt: readAt }
          : { studentLastReadAt: readAt },
    });
    await this.notifications.markChatNotificationRead(user.id, conversationId);
    const counterpartId =
      user.id === conversation.teacherId
        ? conversation.studentId
        : conversation.teacherId;
    this.realtime.emitChatRead(counterpartId, {
      conversationId,
      userId: user.id,
      readAt,
    });
  }

  async unreadCount(user: AuthUser): Promise<ChatUnreadCountDto> {
    this.assertChatRole(user);
    const conversations = await this.prisma.conversation.findMany({
      where:
        user.role === UserRole.TEACHER
          ? { teacherId: user.id }
          : { studentId: user.id },
      select: {
        id: true,
        teacherId: true,
        studentId: true,
        teacherLastReadAt: true,
        studentLastReadAt: true,
      },
    });
    if (conversations.length === 0) return new ChatUnreadCountDto(0);
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: { in: conversations.map(({ id }) => id) },
        senderId: { not: user.id },
      },
      select: { conversationId: true, createdAt: true },
    });
    const byId = new Map(conversations.map((value) => [value.id, value]));
    return new ChatUnreadCountDto(
      messages.filter((message) => {
        const conversation = byId.get(message.conversationId);
        const readAt =
          user.role === UserRole.TEACHER
            ? conversation?.teacherLastReadAt
            : conversation?.studentLastReadAt;
        return !readAt || message.createdAt > readAt;
      }).length,
    );
  }

  async attachmentDownload(
    user: AuthUser,
    attachmentId: string,
  ): Promise<ChatAttachmentDownloadDto> {
    const attachment = await this.prisma.messageAttachment.findFirst({
      where: {
        id: attachmentId,
        message: {
          conversation:
            user.role === UserRole.PARENT
              ? { student: { childLinks: { some: { parentId: user.id } } } }
              : {
                  OR: [{ teacherId: user.id }, { studentId: user.id }],
                },
        },
      },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    return new ChatAttachmentDownloadDto(this.storage.deliveryUrl(attachment));
  }

  private async findConversationPage(
    user: AuthUser,
    query: ChatPageQueryDto,
    parentChildId?: string,
  ): Promise<ChatConversationPageDto> {
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;
    const participantWhere: Prisma.ConversationWhereInput = parentChildId
      ? { studentId: parentChildId }
      : user.role === UserRole.TEACHER
        ? { teacherId: user.id }
        : { studentId: user.id };
    const search = query.search?.trim();
    const counterpartSearch: Prisma.ConversationWhereInput = !search
      ? {}
      : parentChildId || user.role === UserRole.STUDENT
        ? {
            teacher: {
              profile: {
                displayName: { contains: search, mode: 'insensitive' },
              },
            },
          }
        : {
            student: {
              profile: {
                displayName: { contains: search, mode: 'insensitive' },
              },
            },
          };
    const cursorWhere: Prisma.ConversationWhereInput = !cursor
      ? {}
      : cursor.at
        ? {
            OR: [
              { lastMessageAt: { lt: new Date(cursor.at) } },
              { lastMessageAt: new Date(cursor.at), id: { lt: cursor.id } },
              { lastMessageAt: null },
            ],
          }
        : { lastMessageAt: null, id: { lt: cursor.id } };
    const records = await this.prisma.conversation.findMany({
      where: { AND: [participantWhere, counterpartSearch, cursorWhere] },
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { id: 'desc' },
      ],
      take: query.limit + 1,
      select: conversationSelect,
    });
    const page = records.slice(0, query.limit);
    const unread = parentChildId
      ? new Map<string, number>()
      : await this.unreadByConversation(page, user);
    const last = page.at(-1);
    return new ChatConversationPageDto({
      items: page.map((record) =>
        this.toConversationDto(record, user, unread.get(record.id) ?? 0),
      ),
      nextCursor:
        records.length > query.limit && last
          ? this.encodeCursor({
              at: last.lastMessageAt?.toISOString() ?? null,
              id: last.id,
            })
          : null,
    });
  }

  private async findMessagePage(
    user: AuthUser,
    conversationId: string,
    query: ChatPageQueryDto,
    parentChildId?: string,
  ): Promise<ChatMessagePageDto> {
    const conversation = parentChildId
      ? await this.findParentConversation(parentChildId, conversationId)
      : await this.findParticipantConversation(user, conversationId);
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor?.at
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.at) } },
                { createdAt: new Date(cursor.at), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: messageSelect,
    });
    const page = messages.slice(0, query.limit);
    const last = page.at(-1);
    return new ChatMessagePageDto({
      conversation: this.toConversationDto(conversation, user, 0),
      items: page
        .reverse()
        .map((message) => this.toMessageDto(message, conversation)),
      nextCursor:
        messages.length > query.limit && last
          ? this.encodeCursor({ at: last.createdAt.toISOString(), id: last.id })
          : null,
    });
  }

  private async findParticipantConversation(
    user: AuthUser,
    conversationId: string,
  ): Promise<ConversationRecord> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ teacherId: user.id }, { studentId: user.id }],
      },
      select: conversationSelect,
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  private async findParentConversation(
    childId: string,
    conversationId: string,
  ): Promise<ConversationRecord> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, studentId: childId },
      select: conversationSelect,
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  private async assertParentLink(
    user: AuthUser,
    childId: string,
  ): Promise<void> {
    if (user.role !== UserRole.PARENT) throw new NotFoundException();
    const link = await this.prisma.parentChild.findUnique({
      where: { parentId_childId: { parentId: user.id, childId } },
      select: { childId: true },
    });
    if (!link) throw new NotFoundException('Linked child not found');
  }

  private async assertWritablePair(
    teacherId: string,
    studentId: string,
    prisma: Pick<PrismaService, 'user'> = this.prisma,
  ): Promise<void> {
    const student = await prisma.user.findFirst({
      where: {
        id: studentId,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        studentClass: {
          teacherId,
          teacher: { role: UserRole.TEACHER, status: UserStatus.ACTIVE },
        },
      },
      select: { id: true },
    });
    if (!student) throw this.readOnlyException();
  }

  private isWritable(conversation: ConversationRecord): boolean {
    return (
      conversation.teacher.status === UserStatus.ACTIVE &&
      conversation.student.status === UserStatus.ACTIVE &&
      conversation.student.studentClass?.teacherId === conversation.teacherId
    );
  }

  private toConversationDto(
    conversation: ConversationRecord,
    viewer: AuthUser,
    unreadCount: number,
  ): ChatConversationDto {
    const parentView = viewer.role === UserRole.PARENT;
    const counterpart =
      parentView || viewer.id === conversation.studentId
        ? conversation.teacher
        : conversation.student;
    const classroom =
      conversation.student.studentClass?.teacherId === conversation.teacherId
        ? conversation.student.studentClass
        : null;
    return new ChatConversationDto({
      id: conversation.id,
      counterpart: new ChatPersonDto({
        id:
          parentView || viewer.id === conversation.studentId
            ? conversation.teacherId
            : conversation.studentId,
        displayName: counterpart.profile?.displayName ?? 'User',
        avatarUrl: counterpart.profile?.avatarUrl ?? null,
        classId: classroom?.id ?? null,
        className: classroom?.name ?? null,
      }),
      isWritable: !parentView && this.isWritable(conversation),
      unreadCount: parentView ? 0 : unreadCount,
      lastMessage: conversation.messages[0]
        ? this.toMessageDto(conversation.messages[0], conversation)
        : null,
      createdAt: conversation.createdAt,
      lastMessageAt: conversation.lastMessageAt,
    });
  }

  private toMessageDto(
    message: MessageRecord,
    conversation: ConversationRecord,
  ): ChatMessageDto {
    const counterpartReadAt =
      message.senderId === conversation.teacherId
        ? conversation.studentLastReadAt
        : conversation.teacherLastReadAt;
    return new ChatMessageDto({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderRole: message.sender.role,
      body: message.body,
      editedAt: message.editedAt,
      createdAt: message.createdAt,
      isReadByCounterpart:
        counterpartReadAt !== null && counterpartReadAt >= message.createdAt,
      attachments: message.attachments.map(
        (attachment) =>
          new ChatAttachmentDto({
            id: attachment.id,
            originalFileName: attachment.originalFileName,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            resourceType: attachment.resourceType,
          }),
      ),
    });
  }

  private async unreadByConversation(
    conversations: ConversationRecord[],
    user: AuthUser,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (conversations.length === 0) return result;
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: { in: conversations.map(({ id }) => id) },
        senderId: { not: user.id },
      },
      select: { conversationId: true, createdAt: true },
    });
    const byId = new Map(conversations.map((value) => [value.id, value]));
    for (const message of messages) {
      const conversation = byId.get(message.conversationId);
      const readAt =
        user.role === UserRole.TEACHER
          ? conversation?.teacherLastReadAt
          : conversation?.studentLastReadAt;
      if (!readAt || message.createdAt > readAt)
        result.set(
          message.conversationId,
          (result.get(message.conversationId) ?? 0) + 1,
        );
    }
    return result;
  }

  private async countConversationUnread(
    conversation: ConversationRecord,
    recipientId: string,
  ): Promise<number> {
    const readAt =
      recipientId === conversation.teacherId
        ? conversation.teacherLastReadAt
        : conversation.studentLastReadAt;
    return this.prisma.message.count({
      where: {
        conversationId: conversation.id,
        senderId: { not: recipientId },
        ...(readAt ? { createdAt: { gt: readAt } } : {}),
      },
    });
  }

  private displayNameFor(
    conversation: ConversationRecord,
    userId: string,
  ): string {
    return userId === conversation.teacherId
      ? (conversation.teacher.profile?.displayName ?? 'Teacher')
      : (conversation.student.profile?.displayName ?? 'Student');
  }

  private validateFile(file: UploadedChatFile): ValidatedFile {
    if (file.size < 1 || file.size > 20 * 1024 * 1024)
      throw new BadRequestException({
        code: 'CHAT_ATTACHMENT_SIZE_INVALID',
        message: 'Attachment size must be between 1 byte and 20 MB',
      });
    const extension = extname(file.originalname).toLowerCase();
    const image = ['.jpg', '.jpeg', '.png', '.webp'].includes(extension);
    const expectedMime: Record<string, string[]> = {
      '.jpg': ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.png': ['image/png'],
      '.webp': ['image/webp'],
      '.pdf': ['application/pdf'],
      '.docx': [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      '.pptx': [
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ],
      '.xlsx': [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
    };
    if (!expectedMime[extension]?.includes(file.mimetype))
      throw new BadRequestException({
        code: 'CHAT_ATTACHMENT_TYPE_INVALID',
        message: 'Attachment type is not supported',
      });
    const officeKind =
      extension === '.docx'
        ? 'word/'
        : extension === '.pptx'
          ? 'ppt/'
          : extension === '.xlsx'
            ? 'xl/'
            : null;
    const signatureValid =
      extension === '.jpg' || extension === '.jpeg'
        ? file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
        : extension === '.png'
          ? file.buffer
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : extension === '.webp'
            ? file.buffer.subarray(0, 4).toString() === 'RIFF' &&
              file.buffer.subarray(8, 12).toString() === 'WEBP'
            : extension === '.pdf'
              ? file.buffer.subarray(0, 5).toString() === '%PDF-'
              : this.isSafeOfficePackage(file.buffer, officeKind);
    if (!signatureValid)
      throw new BadRequestException({
        code: 'CHAT_ATTACHMENT_SIGNATURE_INVALID',
        message: 'Attachment content does not match its file type',
      });
    return {
      file,
      resourceType: image
        ? ChatAttachmentResourceType.IMAGE
        : ChatAttachmentResourceType.RAW,
      fileName: this.safeFileName(file.originalname, extension),
    };
  }

  private safeFileName(value: string, extension: string): string {
    const normalized = Array.from(value, (character) => {
      const code = character.charCodeAt(0);
      return character === '/' ||
        character === '\\' ||
        code < 32 ||
        code === 127
        ? '_'
        : character;
    })
      .join('')
      .trim()
      .slice(0, 255);
    return normalized || `attachment${extension}`;
  }

  private isSafeOfficePackage(
    buffer: Buffer,
    expectedRoot: string | null,
  ): boolean {
    if (
      !expectedRoot ||
      !buffer.subarray(0, 4).equals(Buffer.from('PK\u0003\u0004'))
    )
      return false;
    const directory = buffer.toString('latin1');
    return (
      directory.includes('[Content_Types].xml') &&
      directory.includes(expectedRoot) &&
      !directory.toLocaleLowerCase().includes('vbaproject.bin')
    );
  }

  private assertChatRole(user: AuthUser): void {
    if (user.role !== UserRole.STUDENT && user.role !== UserRole.TEACHER)
      throw new ForbiddenException('Only students and teachers can use chat');
  }

  private readOnlyException(): ForbiddenException {
    return new ForbiddenException({
      code: 'CHAT_READ_ONLY',
      message: 'This conversation is read-only',
    });
  }

  private encodeCursor(cursor: Cursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
  }

  private decodeCursor(value: string): Cursor {
    try {
      const parsed = JSON.parse(
        Buffer.from(value, 'base64url').toString(),
      ) as unknown;
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('at' in parsed) ||
        !('id' in parsed) ||
        (parsed.at !== null &&
          (typeof parsed.at !== 'string' ||
            Number.isNaN(new Date(parsed.at).getTime()))) ||
        typeof parsed.id !== 'string'
      )
        throw new Error();
      return { at: parsed.at, id: parsed.id };
    } catch {
      throw new BadRequestException('Invalid chat cursor');
    }
  }
}
