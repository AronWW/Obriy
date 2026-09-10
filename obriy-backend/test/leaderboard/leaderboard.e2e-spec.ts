import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus, XPSourceType } from '@prisma/client';
import request from 'supertest';
import { seedBadges } from '../../prisma/seed-badges';
import { getKyivWeekBounds } from '../../src/leaderboard/leaderboard.service';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';

describe('Leaderboard (e2e)', () => {
  let context: AuthTestContext;
  let jwt: JwtService;
  const stamp = Date.now();
  const emails = {
    teacher: `leaderboard.teacher.${stamp}@example.com`,
    otherTeacher: `leaderboard.other-teacher.${stamp}@example.com`,
    student: `leaderboard.student.${stamp}@example.com`,
    early: `leaderboard.early.${stamp}@example.com`,
    later: `leaderboard.later.${stamp}@example.com`,
    historic: `leaderboard.historic.${stamp}@example.com`,
    zero: `leaderboard.zero.${stamp}@example.com`,
    noClass: `leaderboard.no-class.${stamp}@example.com`,
  };
  const ids = Object.fromEntries(
    Object.keys(emails).map((key) => [key, '']),
  ) as Record<keyof typeof emails, string>;
  const tokens = { ...ids };
  let classId = '';

  beforeAll(async () => {
    context = await createAuthTestContext();
    jwt = context.app.get(JwtService);
    await seedBadges(context.prisma);
    await createUser('teacher', UserRole.TEACHER, 'Teacher');
    await createUser('otherTeacher', UserRole.TEACHER, 'Other teacher');
    await createUser('student', UserRole.STUDENT, 'Zed');
    await createUser('early', UserRole.STUDENT, 'Anna');
    await createUser('later', UserRole.STUDENT, 'Bohdan');
    await createUser('historic', UserRole.STUDENT, 'Charlie');
    await createUser('zero', UserRole.STUDENT, 'Diana');
    await createUser('noClass', UserRole.STUDENT, 'No class');

    const classroom = await context.prisma.class.create({
      data: {
        teacherId: ids.teacher,
        name: 'Leaderboard class',
        inviteCode: `L${String(stamp).slice(-8)}`,
      },
    });
    classId = classroom.id;
    await context.prisma.user.updateMany({
      where: {
        id: {
          in: [ids.student, ids.early, ids.later, ids.historic, ids.zero],
        },
      },
      data: { studentClassId: classId },
    });

    const { startAt } = getKyivWeekBounds(new Date());
    await Promise.all([
      createXp('early', 100, new Date(startAt.getTime() + 60 * 60 * 1000)),
      createXp('later', 100, new Date(startAt.getTime() + 2 * 60 * 60 * 1000)),
      createXp('historic', 200, new Date(startAt.getTime() - 60 * 60 * 1000)),
    ]);
    const firstBadge = await context.prisma.badge.findUniqueOrThrow({
      where: { key: 'FIRST_STEP' },
    });
    await context.prisma.userBadge.create({
      data: {
        studentId: ids.early,
        badgeId: firstBadge.id,
        showcasePosition: 1,
      },
    });
  });

  afterAll(async () => {
    await closeAuthTestContext(context, Object.values(emails));
  });

  it('returns a private, paginated weekly class ranking and a pinned self entry', async () => {
    const first = await request(context.app.getHttpServer())
      .get('/leaderboard/me?period=WEEK&limit=2')
      .set('Authorization', bearer('student'))
      .expect(200);
    const firstBody = record(first.body);
    const firstEntries = records(firstBody.entries);
    expect(firstEntries.map((entry) => entry.displayName)).toEqual([
      'Anna',
      'Bohdan',
    ]);
    expect(firstEntries.map((entry) => entry.rank)).toEqual([1, 2]);
    expect(firstEntries[0].showcase).toHaveLength(1);
    expect(JSON.stringify(firstBody)).not.toContain('@example.com');
    expect(JSON.stringify(firstBody)).not.toContain('testResults');
    expect(record(firstBody.selfEntry).rank).toBe(5);
    expect(typeof firstBody.nextCursor).toBe('string');

    const second = await request(context.app.getHttpServer())
      .get(
        `/leaderboard/me?period=WEEK&limit=2&cursor=${String(firstBody.nextCursor)}`,
      )
      .set('Authorization', bearer('student'))
      .expect(200);
    expect(
      records(record(second.body).entries).map((entry) => entry.rank),
    ).toEqual([3, 4]);

    await request(context.app.getHttpServer())
      .get('/leaderboard/me?period=WEEK&cursor=not-a-cursor')
      .set('Authorization', bearer('student'))
      .expect(400);
  });

  it('supports lifetime ranking and teacher ownership', async () => {
    await request(context.app.getHttpServer())
      .get(`/teacher/leaderboard/classes/${classId}?period=ALL_TIME`)
      .set('Authorization', bearer('teacher'))
      .expect(200)
      .expect((response) => {
        const body = record(response.body);
        expect(records(body.entries)[0]).toEqual(
          expect.objectContaining({ displayName: 'Charlie', periodXp: 200 }),
        );
        expect(body.selfEntry).toBeNull();
      });
    await request(context.app.getHttpServer())
      .get(`/teacher/leaderboard/classes/${classId}`)
      .set('Authorization', bearer('otherTeacher'))
      .expect(404);
    await request(context.app.getHttpServer())
      .get(`/teacher/leaderboard/classes/${classId}`)
      .set('Authorization', bearer('student'))
      .expect(403);
    await request(context.app.getHttpServer())
      .get('/leaderboard/me')
      .set('Authorization', bearer('teacher'))
      .expect(403);
  });

  it('returns an empty summary for a student without a class', async () => {
    await request(context.app.getHttpServer())
      .get('/leaderboard/me')
      .set('Authorization', bearer('noClass'))
      .expect(200)
      .expect((response) => {
        expect(record(response.body)).toEqual(
          expect.objectContaining({
            class: null,
            entries: [],
            selfEntry: null,
            nextCursor: null,
          }),
        );
      });
  });

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
        profile: { create: { displayName } },
      },
    });
    ids[key] = user.id;
    tokens[key] = await jwt.signAsync(
      { sub: user.id, email: user.email, role, status: user.status },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
  }

  async function createXp(
    key: 'early' | 'later' | 'historic',
    amount: number,
    createdAt: Date,
  ): Promise<void> {
    await context.prisma.xPLedger.create({
      data: {
        studentId: ids[key],
        sourceType: XPSourceType.TEST_RELEASE_PASS,
        sourceKey: `${key}-${stamp}`,
        amount,
        totalXpBefore: 0,
        totalXpAfter: amount,
        createdAt,
      },
    });
  }

  function bearer(key: keyof typeof tokens): string {
    return `Bearer ${tokens[key]}`;
  }
});

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected an object');
  }
  return value as Record<string, unknown>;
}

function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error('Expected an array');
  return value.map(record);
}
