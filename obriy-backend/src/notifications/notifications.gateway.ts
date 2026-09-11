import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import type { NotificationDto } from './dto/notification.dto';

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
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
        select: { id: true, status: true },
      });
      if (!user || user.status !== UserStatus.ACTIVE) throw new Error();
      client.data.userId = user.id;
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

  private accessToken(client: Socket): string {
    const fromAuth = client.handshake.auth?.accessToken;
    if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;
    const authorization = client.handshake.headers.authorization;
    if (authorization?.startsWith('Bearer ')) return authorization.slice(7);
    throw new Error('Missing access token');
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
