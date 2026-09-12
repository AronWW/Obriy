import { JwtService } from '@nestjs/jwt';
import {
  LessonStatus,
  Locale,
  TestReleaseStatus,
  TestRevisionStatus,
  TestScorePolicy,
  TestStatus,
  TestStudentStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import request from 'supertest';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';

jest.setTimeout(40_000);

describe('Parent dashboard (e2e)', () => {
  let context: AuthTestContext;
  let jwt: JwtService;
  const stamp = Date.now();
  const emails = {
    teacher: `parent.dashboard.teacher.${stamp}@example.com`,
    parent: `parent.dashboard.parent.${stamp}@example.com`,
    otherParent: `parent.dashboard.other.${stamp}@example.com`,
    child: `parent.dashboard.child.${stamp}@example.com`,
    secondChild: `parent.dashboard.second.${stamp}@example.com`,
  };
  const ids = Object.fromEntries(
    Object.keys(emails).map((key) => [key, '']),
  ) as Record<keyof typeof emails, string>;
  const tokens = { teacher: '', parent: '', otherParent: '' };
  let classId = '';
  let lessonId = '';
  let testPosition = 0;

  beforeAll(async () => {
    context = await createAuthTestContext();
    jwt = context.app.get(JwtService);
    await createUser('teacher', UserRole.TEACHER);
    await createUser('parent', UserRole.PARENT);
    await createUser('otherParent', UserRole.PARENT);
    await createUser('child', UserRole.STUDENT);
    await createUser('secondChild', UserRole.STUDENT);
    classId = (
      await context.prisma.class.create({
        data: {
          teacherId: ids.teacher,
          name: 'Parent dashboard class',
          inviteCode: `P${String(stamp).slice(-8)}`,
        },
      })
    ).id;
    await context.prisma.user.update({
      where: { id: ids.child },
      data: { studentClassId: classId },
    });
    await context.prisma.parentChild.createMany({
      data: [
        { parentId: ids.parent, childId: ids.child },
        { parentId: ids.parent, childId: ids.secondChild },
      ],
    });
    lessonId = (
      await context.prisma.lesson.create({
        data: {
          teacherId: ids.teacher,
          title: 'Ancient cities',
          summary: 'Summary',
          content: '<p>Private lesson body</p>',
          contentLocale: Locale.UK,
          status: LessonStatus.PUBLISHED,
        },
      })
    ).id;
    await context.prisma.classLesson.create({
      data: { classId, lessonId, position: 1, publishedAt: new Date() },
    });
    const completed = await createRelease('Completed work', true);
    await createRelease(
      'Due soon',
      true,
      new Date(Date.now() + 60 * 60 * 1000),
    );
    await createRelease('Optional practice', false);
    await createRelease(
      'Hidden draft',
      true,
      undefined,
      TestReleaseStatus.DRAFT,
    );
    const state = await context.prisma.testStudentState.create({
      data: {
        releaseId: completed.id,
        studentId: ids.child,
        status: TestStudentStatus.COMPLETED,
        attemptCount: 1,
        scorePoints: 8,
        scorePercent: 80,
        bestPoints: 9,
        bestPercent: 90,
        lastActivityAt: new Date(),
        completedAt: new Date(),
      },
    });
    await context.prisma.testAttempt.create({
      data: {
        studentStateId: state.id,
        testRevisionId: completed.testRevisionId,
        attemptNumber: 1,
        clientAttemptId: `parent-e2e-${stamp}`,
        status: 'GRADED',
        maxPoints: 10,
        scorePoints: 8,
        scorePercent: 80,
        isPassed: true,
        submittedAt: new Date(),
        gradedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await context.prisma.testRelease.deleteMany({ where: { classId } });
    await context.prisma.lessonTest.deleteMany({ where: { lessonId } });
    await context.prisma.test.deleteMany({ where: { teacherId: ids.teacher } });
    await context.prisma.lesson.deleteMany({ where: { id: lessonId } });
    await context.prisma.class.deleteMany({ where: { id: classId } });
    await closeAuthTestContext(context, Object.values(emails));
  });

  it('returns multiple child summaries and safe linked-child details', async () => {
    const dashboard = body(
      await request(context.app.getHttpServer())
        .get('/parent/dashboard')
        .set('Authorization', bearer('parent'))
        .expect(200),
    );
    expect(array(dashboard.children)).toHaveLength(2);
    expect(JSON.stringify(dashboard)).not.toContain(emails.child);

    const overview = body(
      await request(context.app.getHttpServer())
        .get(`/parent/children/${ids.child}/overview`)
        .set('Authorization', bearer('parent'))
        .expect(200),
    );
    const child = record(overview.child);
    expect(record(child.metrics)).toMatchObject({
      requiredReleaseCount: 2,
      completedCount: 1,
      completionPercent: 50,
      averagePercent: 40,
      attentionCount: 1,
    });
    expect(array(overview.attention)).toEqual([
      expect.objectContaining({
        title: 'Due soon',
        attentionReason: 'DUE_SOON',
      }),
    ]);
    expect(JSON.stringify(overview)).not.toContain('Private lesson body');

    const progress = body(
      await request(context.app.getHttpServer())
        .get(`/parent/children/${ids.child}/progress`)
        .set('Authorization', bearer('parent'))
        .expect(200),
    );
    const serialized = JSON.stringify(progress);
    expect(serialized).toContain('Optional practice');
    expect(serialized).not.toContain('Hidden draft');
    expect(serialized).not.toContain('answers');
    expect(serialized).not.toContain('pendingReviewCount');
    expect(serialized).not.toContain('testRevisionId');
  });

  it('enforces parent role and current link ownership', async () => {
    await request(context.app.getHttpServer())
      .get(`/parent/children/${ids.child}/overview`)
      .set('Authorization', bearer('otherParent'))
      .expect(404);
    await request(context.app.getHttpServer())
      .get('/parent/dashboard')
      .set('Authorization', bearer('teacher'))
      .expect(403);
  });

  async function createRelease(
    title: string,
    isRequired: boolean,
    dueAt?: Date,
    status: TestReleaseStatus = TestReleaseStatus.ACTIVE,
  ) {
    const test = await context.prisma.test.create({
      data: {
        teacherId: ids.teacher,
        contentLocale: Locale.UK,
        status: TestStatus.PUBLISHED,
        revisions: {
          create: {
            version: 1,
            status: TestRevisionStatus.PUBLISHED,
            title,
            description: 'Description',
            passingPercent: 60,
            scorePolicy: TestScorePolicy.BEST,
            publishedAt: new Date(),
          },
        },
      },
      include: { revisions: true },
    });
    const revision = test.revisions[0];
    if (!revision) throw new Error('Missing test revision');
    await context.prisma.lessonTest.create({
      data: {
        lessonId,
        testId: test.id,
        testRevisionId: revision.id,
        position: ++testPosition,
      },
    });
    return context.prisma.testRelease.create({
      data: {
        testId: test.id,
        testRevisionId: revision.id,
        classId,
        lessonId,
        status,
        maxPoints: 10,
        passingPercent: 60,
        isRequired,
        dueAt,
        publishedAt: status === TestReleaseStatus.DRAFT ? null : new Date(),
      },
    });
  }

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
    if (key in tokens) {
      tokens[key as keyof typeof tokens] = await jwt.signAsync(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
        },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
      );
    }
  }

  function bearer(key: keyof typeof tokens) {
    return `Bearer ${tokens[key]}`;
  }
});

function body(response: { body: unknown }): Record<string, unknown> {
  if (
    !response.body ||
    typeof response.body !== 'object' ||
    Array.isArray(response.body)
  ) {
    throw new Error('Expected response object');
  }
  return response.body as Record<string, unknown>;
}

function array(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error('Expected response array');
  return value as Record<string, unknown>[];
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected object');
  }
  return value as Record<string, unknown>;
}
