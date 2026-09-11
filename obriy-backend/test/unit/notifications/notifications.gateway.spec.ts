import { UserStatus } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsGateway } from '../../../src/notifications/notifications.gateway';

describe('NotificationsGateway', () => {
  it('verifies the access token and joins only the authenticated user room', async () => {
    const verifyAsync = jest.fn().mockResolvedValue({ sub: 'student-1' });
    const gateway = new NotificationsGateway(
      { verifyAsync } as unknown as JwtService,
      { get: jest.fn().mockReturnValue('secret') } as unknown as ConfigService,
      {
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: 'student-1', status: UserStatus.ACTIVE }),
        },
      } as unknown as PrismaService,
    );
    const client = socket({ accessToken: 'valid-token' });

    await gateway.handleConnection(client.value);

    expect(verifyAsync).toHaveBeenCalledWith('valid-token', {
      secret: 'secret',
    });
    expect(client.join).toHaveBeenCalledTimes(1);
    expect(client.join).toHaveBeenCalledWith('user:student-1');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects an expired token before joining a room', async () => {
    const gateway = new NotificationsGateway(
      {
        verifyAsync: jest.fn().mockRejectedValue(new Error('expired')),
      } as unknown as JwtService,
      { get: jest.fn().mockReturnValue('secret') } as unknown as ConfigService,
      {} as PrismaService,
    );
    const client = socket({ accessToken: 'expired-token' });

    await gateway.handleConnection(client.value);

    expect(client.join).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('emits an event only into the target user room', () => {
    const gateway = new NotificationsGateway(
      {} as JwtService,
      {} as ConfigService,
      {} as PrismaService,
    );
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    Object.assign(gateway, { server: { to } });

    gateway.emitRead('student-1', 'notification-1');

    expect(to).toHaveBeenCalledWith('user:student-1');
    expect(to).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('notification.read', {
      notificationId: 'notification-1',
    });
  });
});

function socket(auth: Record<string, unknown>) {
  const join = jest.fn().mockResolvedValue(undefined);
  const disconnect = jest.fn();
  return {
    join,
    disconnect,
    value: {
      handshake: { auth, headers: {} },
      data: {},
      join,
      disconnect,
    } as never,
  };
}
