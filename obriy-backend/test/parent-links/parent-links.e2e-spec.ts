import { JwtService } from '@nestjs/jwt';
import { NotificationType, UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';

describe('Parent links (e2e)', () => {
  let context: AuthTestContext;
  let jwtService: JwtService;
  const stamp = Date.now();
  const emails = {
    student: `parent-link.student.${stamp}@example.com`,
    parent: `parent-link.parent.${stamp}@example.com`,
    secondParent: `parent-link.second.${stamp}@example.com`,
  };
  const ids = { student: '', parent: '', secondParent: '' };
  const tokens = { student: '', parent: '', secondParent: '' };

  beforeAll(async () => {
    context = await createAuthTestContext();
    jwtService = context.app.get(JwtService);
    await Promise.all([
      createUser('student', UserRole.STUDENT, 'Марія'),
      createUser('parent', UserRole.PARENT, 'Олена'),
      createUser('secondParent', UserRole.PARENT, 'Тарас'),
    ]);
  });

  afterAll(async () => {
    await closeAuthTestContext(context, Object.values(emails));
  });

  it('creates, previews, accepts, revokes and unlinks secure invitations', async () => {
    const firstInvitation = await createInvitation();

    await request(context.app.getHttpServer())
      .post('/parent-links/invitation/preview')
      .set('Authorization', `Bearer ${tokens.student}`)
      .send({ token: firstInvitation })
      .expect(403);

    await request(context.app.getHttpServer())
      .post('/parent-links/invitation/preview')
      .set('Authorization', `Bearer ${tokens.parent}`)
      .send({ token: firstInvitation })
      .expect(200)
      .expect((response) => {
        const body: unknown = response.body;
        expect(body).toEqual({
          child: {
            id: ids.student,
            displayName: 'Марія',
            avatarUrl: null,
          },
          alreadyLinked: false,
        });
        expect(body).not.toHaveProperty('email');
        expect(getNestedValue(body, ['child'])).not.toHaveProperty(
          'gradeLevel',
        );
      });

    await request(context.app.getHttpServer())
      .post('/parent-links/invitation/accept')
      .set('Authorization', `Bearer ${tokens.parent}`)
      .send({ token: firstInvitation })
      .expect(201);

    await request(context.app.getHttpServer())
      .post('/parent-links/invitation/accept')
      .set('Authorization', `Bearer ${tokens.parent}`)
      .send({ token: firstInvitation })
      .expect(404);

    await request(context.app.getHttpServer())
      .get('/users/me/children')
      .set('Authorization', `Bearer ${tokens.parent}`)
      .expect(200)
      .expect((response) => {
        const body: unknown = response.body;
        expect(body).toEqual([
          expect.objectContaining({ id: ids.student, displayName: 'Марія' }),
        ]);
      });

    await request(context.app.getHttpServer())
      .get('/parent-links/me/guardians')
      .set('Authorization', `Bearer ${tokens.student}`)
      .expect(200)
      .expect((response) => {
        const body: unknown = response.body;
        expect(body).toEqual([
          expect.objectContaining({ id: ids.parent, displayName: 'Олена' }),
        ]);
        expect(getArrayItem(body, 0)).not.toHaveProperty('email');
      });

    const revokedInvitation = await createInvitation();
    const replacementInvitation = await createInvitation();
    expect(replacementInvitation).not.toBe(revokedInvitation);

    await request(context.app.getHttpServer())
      .post('/parent-links/invitation/accept')
      .set('Authorization', `Bearer ${tokens.secondParent}`)
      .send({ token: revokedInvitation })
      .expect(404);

    await request(context.app.getHttpServer())
      .post('/parent-links/invitation/accept')
      .set('Authorization', `Bearer ${tokens.secondParent}`)
      .send({ token: replacementInvitation })
      .expect(201);

    await context.prisma.notification.create({
      data: {
        recipientId: ids.secondParent,
        subjectStudentId: ids.student,
        type: NotificationType.TEST_ASSIGNED,
        deduplicationKey: `unlink-cleanup:${stamp}`,
        payload: { releaseId: 'release-for-unlink-test' },
      },
    });

    await request(context.app.getHttpServer())
      .delete(`/parent-links/children/${ids.student}`)
      .set('Authorization', `Bearer ${tokens.secondParent}`)
      .expect(204);
    expect(
      await context.prisma.notification.count({
        where: {
          recipientId: ids.secondParent,
          subjectStudentId: ids.student,
        },
      }),
    ).toBe(0);

    await request(context.app.getHttpServer())
      .delete(`/parent-links/guardians/${ids.parent}`)
      .set('Authorization', `Bearer ${tokens.student}`)
      .expect(204);

    await request(context.app.getHttpServer())
      .get('/parent-links/me/guardians')
      .set('Authorization', `Bearer ${tokens.student}`)
      .expect(200)
      .expect([]);
  });

  async function createInvitation(): Promise<string> {
    const response = await request(context.app.getHttpServer())
      .post('/parent-links/invitation')
      .set('Authorization', `Bearer ${tokens.student}`)
      .expect(201);
    const body: unknown = response.body;

    if (
      typeof body !== 'object' ||
      body === null ||
      !('token' in body) ||
      typeof body.token !== 'string'
    ) {
      throw new Error('Expected invitation token');
    }

    expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    return body.token;
  }

  async function createUser(
    key: keyof typeof emails,
    role: UserRole,
    displayName: string,
  ): Promise<void> {
    const user = await context.prisma.user.create({
      data: {
        email: emails[key],
        role,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            displayName,
            gradeLevel: role === UserRole.STUDENT ? 7 : null,
          },
        },
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
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      },
    );
  }
});

function getNestedValue(value: unknown, path: string[]): unknown {
  let current = value;

  for (const part of path) {
    if (typeof current !== 'object' || current === null || !(part in current)) {
      throw new Error(`Expected ${path.join('.')} to exist`);
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function getArrayItem(value: unknown, index: number): unknown {
  if (!Array.isArray(value) || index >= value.length) {
    throw new Error(`Expected array item ${index}`);
  }
  return value[index] as unknown;
}
