import { JwtService } from '@nestjs/jwt';
import { Locale, UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';

jest.setTimeout(40_000);

describe('Supervised direct chat (e2e)', () => {
  let context: AuthTestContext;
  let jwt: JwtService;
  const stamp = Date.now();
  const emails = {
    teacher: `chat.teacher.${stamp}@example.com`,
    student: `chat.student.${stamp}@example.com`,
    parent: `chat.parent.${stamp}@example.com`,
    otherParent: `chat.other-parent.${stamp}@example.com`,
  };
  const ids = Object.fromEntries(
    Object.keys(emails).map((key) => [key, '']),
  ) as Record<keyof typeof emails, string>;
  const tokens = Object.fromEntries(
    Object.keys(emails).map((key) => [key, '']),
  ) as Record<keyof typeof emails, string>;
  let classId = '';
  let conversationId = '';

  beforeAll(async () => {
    context = await createAuthTestContext();
    jwt = context.app.get(JwtService);
    await createUser('teacher', UserRole.TEACHER);
    await createUser('student', UserRole.STUDENT);
    await createUser('parent', UserRole.PARENT);
    await createUser('otherParent', UserRole.PARENT);
    classId = (
      await context.prisma.class.create({
        data: {
          teacherId: ids.teacher,
          name: 'Chat class',
          inviteCode: `C${String(stamp).slice(-8)}`,
        },
      })
    ).id;
    await context.prisma.user.update({
      where: { id: ids.student },
      data: { studentClassId: classId },
    });
    await context.prisma.parentChild.create({
      data: { parentId: ids.parent, childId: ids.student },
    });
  });

  afterAll(async () => {
    await context.prisma.user.updateMany({
      where: { id: ids.student },
      data: { studentClassId: null },
    });
    await context.prisma.class.deleteMany({ where: { id: classId } });
    await closeAuthTestContext(context, Object.values(emails));
  });

  it('creates one conversation and sends an idempotent safe message', async () => {
    const created = await request(context.app.getHttpServer())
      .post('/chat/conversations')
      .set('Authorization', bearer('student'))
      .send({ counterpartId: ids.teacher })
      .expect(201);
    conversationId = stringField(created.body, 'id');

    const clientMessageId = '6418c683-86a4-461b-a5b5-1e1ab4e3797f';
    const first = await request(context.app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/messages`)
      .set('Authorization', bearer('student'))
      .field('clientMessageId', clientMessageId)
      .field('body', 'Hello teacher')
      .expect(201);
    const duplicate = await request(context.app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/messages`)
      .set('Authorization', bearer('student'))
      .field('clientMessageId', clientMessageId)
      .field('body', 'Hello teacher')
      .expect(201);
    expect(stringField(duplicate.body, 'id')).toBe(
      stringField(first.body, 'id'),
    );
    expect(JSON.stringify(first.body)).not.toContain(emails.student);

    const teacherList = await request(context.app.getHttpServer())
      .get('/chat/conversations')
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const conversations = arrayField(teacherList.body, 'items');
    expect(conversations).toHaveLength(1);
    expect(conversations[0]).toMatchObject({ unreadCount: 1 });
  });

  it('lets a current parent inspect the full history without changing receipts', async () => {
    const before = await request(context.app.getHttpServer())
      .get('/chat/unread-count')
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const messages = await request(context.app.getHttpServer())
      .get(
        `/parent/children/${ids.student}/conversations/${conversationId}/messages`,
      )
      .set('Authorization', bearer('parent'))
      .expect(200);
    expect(arrayField(messages.body, 'items')[0]).toMatchObject({
      body: 'Hello teacher',
    });
    expect(JSON.stringify(messages.body)).not.toContain(emails.student);
    await request(context.app.getHttpServer())
      .get(`/parent/children/${ids.student}/conversations`)
      .set('Authorization', bearer('otherParent'))
      .expect(404);
    const after = await request(context.app.getHttpServer())
      .get('/chat/unread-count')
      .set('Authorization', bearer('teacher'))
      .expect(200);
    expect(after.body).toEqual(before.body);
  });

  it('preserves history read-only after leaving class and revokes parent access on unlink', async () => {
    await context.prisma.user.update({
      where: { id: ids.student },
      data: { studentClassId: null },
    });
    await request(context.app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/messages`)
      .set('Authorization', bearer('teacher'))
      .field('clientMessageId', 'f5199294-9e34-40a3-8a76-9f0011159782')
      .field('body', 'No longer writable')
      .expect(403);
    const history = await request(context.app.getHttpServer())
      .get(`/chat/conversations/${conversationId}/messages`)
      .set('Authorization', bearer('student'))
      .expect(200);
    expect(objectField(history.body, 'conversation')).toMatchObject({
      isWritable: false,
    });

    await context.prisma.parentChild.delete({
      where: {
        parentId_childId: { parentId: ids.parent, childId: ids.student },
      },
    });
    await request(context.app.getHttpServer())
      .get(
        `/parent/children/${ids.student}/conversations/${conversationId}/messages`,
      )
      .set('Authorization', bearer('parent'))
      .expect(404);
  });

  async function createUser(key: keyof typeof emails, role: UserRole) {
    const user = await context.prisma.user.create({
      data: {
        email: emails[key],
        role,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        profile: { create: { displayName: key, preferredLocale: Locale.UK } },
      },
    });
    ids[key] = user.id;
    tokens[key] = await jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, status: user.status },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
  }

  function bearer(key: keyof typeof tokens): string {
    return `Bearer ${tokens[key]}`;
  }
});

function stringField(value: unknown, key: string): string {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected response object');
  const field = (value as Record<string, unknown>)[key];
  if (typeof field !== 'string') throw new Error(`Expected string ${key}`);
  return field;
}

function objectField(value: unknown, key: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected response object');
  const field = (value as Record<string, unknown>)[key];
  if (!field || typeof field !== 'object' || Array.isArray(field))
    throw new Error(`Expected object ${key}`);
  return field as Record<string, unknown>;
}

function arrayField(value: unknown, key: string): Record<string, unknown>[] {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected response object');
  const field = (value as Record<string, unknown>)[key];
  if (!Array.isArray(field)) throw new Error(`Expected array ${key}`);
  return field as Record<string, unknown>[];
}
