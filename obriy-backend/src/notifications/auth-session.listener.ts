import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { authEvents, type SessionsRevokedEvent } from '../auth/auth.events';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class AuthSessionListener {
  constructor(private readonly gateway: NotificationsGateway) {}

  @OnEvent(authEvents.sessionsRevoked, { async: true })
  disconnectSockets(event: SessionsRevokedEvent): Promise<void> {
    return this.gateway.disconnectUser(event.userId);
  }
}
