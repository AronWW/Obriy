import { JwtService } from '@nestjs/jwt';
import { NotificationType, UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';

describe('Notifications (e2e)', () => {
  let context: AuthTestContext;
  let jwtService: JwtService;
  const stamp = Date.now();
  const emails = {
    student: `notifications.student.${stamp}@example.com`,
    other: `notifications.other.${stamp}@example.com`,
  };
  const ids = { student: '', other: '' };
  const tokens = { student: '', other: '' };

  beforeAll(async () => {
    context = await createAuthTestContext();
    jwtService = context.app.get(JwtService);
    await createUser('student');
    await createUser('other');
  });

  afterAll(async () => {
    await closeAuthTestContext(context, Object.values(emails));
  });

  it('lists, paginates, and reads only owned notifications', async () => {
    await context.prisma.notification.createMany({
      data: Array.from({ length: 22 }, (_, index) => ({
        recipientId: ids.student,
        subjectStudentId: ids.student,
        type: NotificationType.TEST_ASSIGNED,
        deduplicationKey: `e2e:${stamp}:${index}`,
        payload: { releaseId: `release-${index}`, testTitle: `Test ${index}` },
        createdAt: new Date(Date.now() + index * 1000),
      })),
    });
    const foreign = await context.prisma.notification.create({
      data: {
        recipientId: ids.other,
        type: NotificationType.LEVEL_UP,
        deduplicationKey: `foreign:${stamp}`,
        payload: { level: 2 },
      },
    });

    const first = await request(context.app.getHttpServer())
      .get('/notifications?limit=20&unreadOnly=true')
      .set('Authorization', bearer('student'))
      .expect(200);
    const firstBody = responseBody(first.body);
    const firstItems = recordArray(firstBody.items);
    expect(firstItems).toHaveLength(20);
    expect(firstBody.unreadCount).toBe(22);
    expect(firstBody.nextCursor).toEqual(expect.any(String));
    expect(JSON.stringify(firstBody)).not.toContain(emails.student);
    expect(JSON.stringify(firstBody)).not.toContain(foreign.id);

    const second = await request(context.app.getHttpServer())
      .get(`/notifications?limit=20&cursor=${String(firstBody.nextCursor)}`)
      .set('Authorization', bearer('student'))
      .expect(200);
    expect(recordArray(responseBody(second.body).items)).toHaveLength(2);

    await request(context.app.getHttpServer())
      .patch(`/notifications/${foreign.id}/read`)
      .set('Authorization', bearer('student'))
      .expect(404);

    const ownedId = String(firstItems[0].id);
    await request(context.app.getHttpServer())
      .patch(`/notifications/${ownedId}/read`)
      .set('Authorization', bearer('student'))
      .expect(200)
      .expect((response) => {
        expect(responseBody(response.body)).toEqual(
          expect.objectContaining({ id: ownedId, isRead: true }),
        );
      });

    await request(context.app.getHttpServer())
      .post('/notifications/read-all')
      .set('Authorization', bearer('student'))
      .expect(204);
    await request(context.app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Authorization', bearer('student'))
      .expect(200)
      .expect({ unreadCount: 0 });
    expect(
      await context.prisma.notification.count({
        where: { recipientId: ids.other, readAt: null },
      }),
    ).toBe(1);
  });

  async function createUser(key: keyof typeof emails): Promise<void> {
    const user = await context.prisma.user.create({
      data: {
        email: emails[key],
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        profile: { create: { displayName: key } },
      },
    });
    ids[key] = user.id;
    tokens[key] = await jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
  }

  function bearer(key: keyof typeof tokens): string {
    return `Bearer ${tokens[key]}`;
  }
});

function responseBody(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected object response');
  }
  return value as Record<string, unknown>;
}

function recordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error('Expected array');
  return value.map(responseBody);
}
