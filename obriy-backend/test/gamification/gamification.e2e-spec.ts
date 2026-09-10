import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus, XPSourceType } from '@prisma/client';
import request from 'supertest';
import { seedBadges } from '../../prisma/seed-badges';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';

describe('Gamification (e2e)', () => {
  let context: AuthTestContext;
  let jwtService: JwtService;
  const stamp = Date.now();
  const emails = {
    teacher: `gamification.teacher.${stamp}@example.com`,
    student: `gamification.student.${stamp}@example.com`,
    classmate: `gamification.classmate.${stamp}@example.com`,
    outsider: `gamification.outsider.${stamp}@example.com`,
  };
  const ids = { teacher: '', student: '', classmate: '', outsider: '' };
  const tokens = { teacher: '', student: '', classmate: '', outsider: '' };

  beforeAll(async () => {
    context = await createAuthTestContext();
    jwtService = context.app.get(JwtService);
    await seedBadges(context.prisma);

    await createUser('teacher', UserRole.TEACHER);
    await createUser('student', UserRole.STUDENT);
    await createUser('classmate', UserRole.STUDENT);
    await createUser('outsider', UserRole.STUDENT);

    const classroom = await context.prisma.class.create({
      data: {
        teacherId: ids.teacher,
        name: 'Gamification class',
        inviteCode: `G${String(stamp).slice(-8)}`,
      },
    });
    await context.prisma.user.updateMany({
      where: { id: { in: [ids.student, ids.classmate] } },
      data: { studentClassId: classroom.id },
    });
  });

  afterAll(async () => {
    await closeAuthTestContext(context, Object.values(emails));
  });

  it('returns progress, manages the showcase, and acknowledges only owned rewards', async () => {
    const badges = await context.prisma.badge.findMany({
      where: { key: { in: ['FIRST_STEP', 'PERFECT_RESULT'] } },
      orderBy: { key: 'asc' },
    });
    expect(badges).toHaveLength(2);

    const xp = await context.prisma.xPLedger.create({
      data: {
        studentId: ids.student,
        sourceType: XPSourceType.TEST_RELEASE_PASS,
        sourceKey: `release-${stamp}`,
        amount: 500,
        totalXpBefore: 0,
        totalXpAfter: 500,
      },
    });
    const outsiderXp = await context.prisma.xPLedger.create({
      data: {
        studentId: ids.outsider,
        sourceType: XPSourceType.TEST_RELEASE_PASS,
        sourceKey: `outsider-release-${stamp}`,
        amount: 100,
        totalXpBefore: 0,
        totalXpAfter: 100,
      },
    });
    const awards = await Promise.all(
      badges.map((badge) =>
        context.prisma.userBadge.create({
          data: { studentId: ids.student, badgeId: badge.id },
        }),
      ),
    );

    await request(context.app.getHttpServer())
      .get('/gamification/me')
      .set('Authorization', bearer('student'))
      .expect(200)
      .expect((response) => {
        const body = responseBody(response.body);
        expect(body.progress).toEqual(
          expect.objectContaining({ totalXp: 500, level: 2 }),
        );
        expect(body.badges).toHaveLength(2);
        expect(body.showcase).toEqual([]);
      });

    await request(context.app.getHttpServer())
      .patch('/gamification/me/showcase')
      .set('Authorization', bearer('student'))
      .send({ badgeIds: badges.map((badge) => badge.id) })
      .expect(200)
      .expect((response) => {
        const showcase = recordArray(responseBody(response.body).showcase);
        expect(showcase.map((badge) => badge.id)).toEqual(
          badges.map((badge) => badge.id),
        );
      });

    await request(context.app.getHttpServer())
      .patch('/gamification/me/showcase')
      .set('Authorization', bearer('student'))
      .send({ badgeIds: [badges[0].id, badges[0].id] })
      .expect(400);

    const unseen = await request(context.app.getHttpServer())
      .get('/gamification/me/rewards/unseen')
      .set('Authorization', bearer('student'))
      .expect(200);
    const unseenBody = responseBody(unseen.body);
    expect(unseenBody.xp).toEqual([
      expect.objectContaining({ id: xp.id, amount: 500 }),
    ]);
    expect(unseenBody.badges).toHaveLength(2);

    await request(context.app.getHttpServer())
      .post('/gamification/me/rewards/acknowledge')
      .set('Authorization', bearer('student'))
      .send({
        xpLedgerIds: [xp.id, outsiderXp.id],
        userBadgeIds: awards.map((award) => award.id),
      })
      .expect(204);

    await request(context.app.getHttpServer())
      .get('/gamification/me/rewards/unseen')
      .set('Authorization', bearer('student'))
      .expect(200)
      .expect({ xp: [], badges: [] });
    expect(
      await context.prisma.xPLedger.findUniqueOrThrow({
        where: { id: outsiderXp.id },
        select: { seenAt: true },
      }),
    ).toEqual({ seenAt: null });
  });

  it('exposes safe rewards to classmates and enforces student access', async () => {
    await request(context.app.getHttpServer())
      .get(`/classes/classmates/${ids.student}`)
      .set('Authorization', bearer('classmate'))
      .expect(200)
      .expect((response) => {
        const gamification = responseBody(
          responseBody(response.body).gamification,
        );
        expect(gamification.progress).toEqual(
          expect.objectContaining({ totalXp: 500, level: 2 }),
        );
        expect(gamification.showcase).toHaveLength(2);
        expect(gamification.badges).toHaveLength(2);
        expect(gamification).not.toHaveProperty('history');
        expect(gamification).not.toHaveProperty('testResults');
      });

    await request(context.app.getHttpServer())
      .get(`/classes/classmates/${ids.student}`)
      .set('Authorization', bearer('outsider'))
      .expect(404);
    await request(context.app.getHttpServer())
      .get('/gamification/me')
      .set('Authorization', bearer('teacher'))
      .expect(403);
  });

  async function createUser(
    key: keyof typeof emails,
    role: UserRole,
  ): Promise<void> {
    const user = await context.prisma.user.create({
      data: {
        email: emails[key],
        role,
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
    throw new Error('Expected an object response body');
  }
  return value as Record<string, unknown>;
}

function recordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error('Expected an array');
  return value.map(responseBody);
}
