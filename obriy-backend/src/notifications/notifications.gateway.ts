import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import type { NotificationDto } from './dto/notification.dto';
import type { ChatMessageDto } from '../chat/dto/chat-output.dto';

const realtimeFrontendOrigin = new URL(
  process.env.FRONTEND_URL ?? 'http://localhost:5173',
).origin;

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: realtimeFrontendOrigin,
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.accessToken(client);
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret:
          this.config.get<string>('JWT_ACCESS_SECRET') ??
          'dev-access-secret-change-me',
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, status: true, role: true, sessionVersion: true },
      });
      if (
        !user ||
        user.status !== UserStatus.ACTIVE ||
        (user.sessionVersion ?? 0) !== (payload.sessionVersion ?? 0)
      )
        throw new Error();
      (client.data as Record<string, unknown>).userId = user.id;
      (client.data as Record<string, unknown>).role = user.role;
      await client.join(this.userRoom(user.id));
    } catch {
      client.disconnect(true);
    }
  }

  emitCreated(userId: string, notification: NotificationDto): void {
    this.server
      .to(this.userRoom(userId))
      .emit('notification.created', notification);
  }

  emitRead(userId: string, notificationId: string): void {
    this.server.to(this.userRoom(userId)).emit('notification.read', {
      notificationId,
    });
  }

  emitReadAll(userId: string, readAt: Date): void {
    this.server.to(this.userRoom(userId)).emit('notification.read-all', {
      readAt,
    });
  }

  emitChatMessage(userId: string, message: ChatMessageDto): void {
    this.server.to(this.userRoom(userId)).emit('chat.message.created', message);
  }

  emitChatUpdated(userId: string, message: ChatMessageDto): void {
    this.server.to(this.userRoom(userId)).emit('chat.message.updated', message);
  }

  emitChatRead(
    userId: string,
    payload: { conversationId: string; userId: string; readAt: Date },
  ): void {
    this.server.to(this.userRoom(userId)).emit('chat.read', payload);
  }

  async disconnectUser(userId: string): Promise<void> {
    const sockets = await this.server.in(this.userRoom(userId)).fetchSockets();
    for (const socket of sockets) socket.disconnect(true);
  }

  async isViewingConversation(
    userId: string,
    conversationId: string,
  ): Promise<boolean> {
    const sockets = await this.server.in(this.userRoom(userId)).fetchSockets();
    return sockets.some((socket) => {
      const data = socket.data as Record<string, unknown>;
      return (
        data.activeConversationId === conversationId &&
        data.chatFocused === true
      );
    });
  }

  @SubscribeMessage('chat.watch')
  async watchConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const data = this.socketUser(client);
    const input = this.watchPayload(payload);
    if (!data || !input) return;
    if (!input.focused) {
      (client.data as Record<string, unknown>).activeConversationId = null;
      (client.data as Record<string, unknown>).chatFocused = false;
      return;
    }
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: input.conversationId,
        OR: [{ teacherId: data.userId }, { studentId: data.userId }],
      },
      select: { id: true },
    });
    if (!conversation) return;
    (client.data as Record<string, unknown>).activeConversationId =
      conversation.id;
    (client.data as Record<string, unknown>).chatFocused = true;
  }

  @SubscribeMessage('chat.typing')
  async typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const data = this.socketUser(client);
    const input = this.typingPayload(payload);
    if (!data || !input || !this.consumeTypingToken(client)) return;
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: input.conversationId,
        OR: [{ teacherId: data.userId }, { studentId: data.userId }],
        teacher: { status: UserStatus.ACTIVE },
        student: {
          status: UserStatus.ACTIVE,
        },
      },
      select: {
        teacherId: true,
        studentId: true,
        student: { select: { studentClass: { select: { teacherId: true } } } },
      },
    });
    if (
      !conversation ||
      conversation.student.studentClass?.teacherId !== conversation.teacherId
    )
      return;
    const recipientId =
      data.userId === conversation.teacherId
        ? conversation.studentId
        : conversation.teacherId;
    this.server.to(this.userRoom(recipientId)).emit('chat.typing', {
      conversationId: input.conversationId,
      userId: data.userId,
      isTyping: input.isTyping,
    });
  }

  private accessToken(client: Socket): string {
    const handshakeAuth: unknown = client.handshake.auth;
    const fromAuth =
      typeof handshakeAuth === 'object' && handshakeAuth !== null
        ? (handshakeAuth as Record<string, unknown>).accessToken
        : undefined;
    if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;
    const authorization = client.handshake.headers.authorization;
    if (authorization?.startsWith('Bearer ')) return authorization.slice(7);
    throw new Error('Missing access token');
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private socketUser(
    client: Socket,
  ): { userId: string; role: UserRole } | null {
    const data = client.data as Record<string, unknown>;
    return typeof data.userId === 'string' &&
      (data.role === UserRole.STUDENT || data.role === UserRole.TEACHER)
      ? { userId: data.userId, role: data.role }
      : null;
  }

  private watchPayload(
    payload: unknown,
  ): { conversationId: string; focused: boolean } | null {
    if (!payload || typeof payload !== 'object') return null;
    const data = payload as Record<string, unknown>;
    return typeof data.conversationId === 'string' &&
      typeof data.focused === 'boolean'
      ? { conversationId: data.conversationId, focused: data.focused }
      : null;
  }

  private typingPayload(
    payload: unknown,
  ): { conversationId: string; isTyping: boolean } | null {
    if (!payload || typeof payload !== 'object') return null;
    const data = payload as Record<string, unknown>;
    return typeof data.conversationId === 'string' &&
      typeof data.isTyping === 'boolean'
      ? { conversationId: data.conversationId, isTyping: data.isTyping }
      : null;
  }

  private consumeTypingToken(client: Socket): boolean {
    const data = client.data as Record<string, unknown>;
    const now = Date.now();
    const windowStartedAt =
      typeof data.typingWindowStartedAt === 'number'
        ? data.typingWindowStartedAt
        : now;
    const count = typeof data.typingCount === 'number' ? data.typingCount : 0;
    if (now - windowStartedAt >= 10_000) {
      data.typingWindowStartedAt = now;
      data.typingCount = 1;
      return true;
    }
    if (count >= 60) return false;
    data.typingWindowStartedAt = windowStartedAt;
    data.typingCount = count + 1;
    return true;
  }
}
