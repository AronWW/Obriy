import { JwtService } from '@nestjs/jwt';
import {
  LessonStatus,
  Locale,
  TestLatePolicy,
  TestReleaseStatus,
  TestRevisionStatus,
  TestScorePolicy,
  TestStatus,
  TestStudentStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import request from 'supertest';
import { getResponseBody } from '../helpers/auth-test.helpers';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';

jest.setTimeout(40_000);

describe('Student workspace (e2e)', () => {
  let context: AuthTestContext;
  let jwtService: JwtService;
  const stamp = Date.now();
  const emails = {
    teacher: `workspace.teacher.${stamp}@example.com`,
    student: `workspace.student.${stamp}@example.com`,
    noClass: `workspace.noclass.${stamp}@example.com`,
  };
  const tokens = { teacher: '', student: '', noClass: '' };
  let teacherId = '';
  let studentId = '';
  let classId = '';
  let lessonId = '';
  const releaseIds: string[] = [];

  beforeAll(async () => {
    context = await createAuthTestContext();
    jwtService = context.app.get(JwtService);
    teacherId = await createUser('teacher', UserRole.TEACHER);
    studentId = await createUser('student', UserRole.STUDENT);
    await createUser('noClass', UserRole.STUDENT);
    classId = (
      await context.prisma.class.create({
        data: {
          teacherId,
          name: 'Student workspace class',
          inviteCode: `W${String(stamp).slice(-8)}`,
        },
      })
    ).id;
    await context.prisma.user.update({
      where: { id: studentId },
      data: { studentClassId: classId },
    });
    lessonId = (
      await context.prisma.lesson.create({
        data: {
          teacherId,
          title: 'Early states',
          summary: 'Summary',
          content: '<p>Content</p>',
          contentLocale: Locale.UK,
          status: LessonStatus.PUBLISHED,
        },
      })
    ).id;
    await context.prisma.classLesson.create({
      data: { classId, lessonId, position: 1, publishedAt: new Date() },
    });

    const revision = await createRelease(
      'Revise chronology',
      TestReleaseStatus.ACTIVE,
      true,
      { dueAt: future(3) },
    );
    const overdue = await createRelease(
      'Overdue sources',
      TestReleaseStatus.ACTIVE,
      true,
      { dueAt: past(2), latePolicy: TestLatePolicy.ALLOW },
    );
    await createRelease('Scheduled map', TestReleaseStatus.SCHEDULED, true, {
      availableFrom: future(2),
      dueAt: future(5),
    });
    const review = await createRelease(
      'Awaiting essay',
      TestReleaseStatus.ACTIVE,
      true,
      { dueAt: future(4) },
    );
    const completed = await createRelease(
      'Completed quiz',
      TestReleaseStatus.CLOSED,
      true,
    );
    await createRelease('Optional practice', TestReleaseStatus.ACTIVE, false);
    await createRelease('Hidden draft', TestReleaseStatus.DRAFT, true);
    await createRelease('Hidden archive', TestReleaseStatus.ARCHIVED, true);

    await createState(revision.id, TestStudentStatus.NEEDS_REVISION, 40);
    await createState(overdue.id, TestStudentStatus.NOT_STARTED, null);
    await createState(review.id, TestStudentStatus.AWAITING_REVIEW, null);
    await createState(completed.id, TestStudentStatus.COMPLETED, 80);
  });

  afterAll(async () => {
    await context.prisma.testRelease.deleteMany({ where: { classId } });
    await context.prisma.lessonTest.deleteMany({ where: { lessonId } });
    await context.prisma.test.deleteMany({ where: { teacherId } });
    await context.prisma.lesson.deleteMany({ where: { id: lessonId } });
    await context.prisma.class.deleteMany({ where: { id: classId } });
    await closeAuthTestContext(context, Object.values(emails));
  });

  it('returns safe dashboard metrics and prioritised work', async () => {
    const response = await request(context.app.getHttpServer())
      .get('/student/dashboard')
      .set('Authorization', bearer('student'))
      .expect(200);
    const body = getResponseBody(response);
    expect(body.metrics).toEqual(
      expect.objectContaining({
        requiredReleaseCount: 5,
        completedCount: 1,
        completionPercent: 20,
        averagePercent: 30,
        attentionCount: 2,
      }),
    );
    expect(
      (body.attention as Record<string, unknown>[]).map(({ title }) => title),
    ).toEqual(['Revise chronology', 'Overdue sources']);
    expect(JSON.stringify(body)).not.toContain('items');
    expect(JSON.stringify(body)).not.toContain('solution');
    expect(JSON.stringify(body)).not.toContain('Hidden draft');
    expect(JSON.stringify(body)).not.toContain('Hidden archive');
  });

  it('supports task filters and cursor pagination', async () => {
    const firstResponse = await request(context.app.getHttpServer())
      .get('/student/tasks?required=REQUIRED&limit=2')
      .set('Authorization', bearer('student'))
      .expect(200);
    const first = getResponseBody(firstResponse);
    expect((first.items as unknown[]).length).toBe(2);
    expect(first.nextCursor).toEqual(expect.any(String));

    const nextResponse = await request(context.app.getHttpServer())
      .get(
        `/student/tasks?required=REQUIRED&limit=2&cursor=${String(first.nextCursor)}`,
      )
      .set('Authorization', bearer('student'))
      .expect(200);
    const next = getResponseBody(nextResponse);
    expect(
      (next.items as Record<string, unknown>[]).map(
        ({ releaseId }) => releaseId,
      ),
    ).not.toContain((first.items as Record<string, unknown>[])[0]?.releaseId);

    const scheduledResponse = await request(context.app.getHttpServer())
      .get('/student/tasks?status=SCHEDULED&search=map')
      .set('Authorization', bearer('student'))
      .expect(200);
    const scheduled = getResponseBody(scheduledResponse);
    expect(scheduled.items).toEqual([
      expect.objectContaining({
        title: 'Scheduled map',
        availability: 'SCHEDULED',
        canOpen: false,
      }),
    ]);
  });

  it('returns an empty workspace without a class and enforces role access', async () => {
    const dashboardResponse = await request(context.app.getHttpServer())
      .get('/student/dashboard')
      .set('Authorization', bearer('noClass'))
      .expect(200);
    const dashboard = getResponseBody(dashboardResponse);
    expect(dashboard).toEqual(
      expect.objectContaining({ class: null, attention: [], upcoming: [] }),
    );
    await request(context.app.getHttpServer())
      .get('/student/dashboard')
      .set('Authorization', bearer('teacher'))
      .expect(403);
  });

  async function createRelease(
    title: string,
    status: TestReleaseStatus,
    isRequired: boolean,
    dates: {
      availableFrom?: Date;
      dueAt?: Date;
      latePolicy?: TestLatePolicy;
    } = {},
  ) {
    const test = await context.prisma.test.create({
      data: {
        teacherId,
        contentLocale: Locale.UK,
        status: TestStatus.PUBLISHED,
        revisions: {
          create: {
            version: 1,
            status: TestRevisionStatus.PUBLISHED,
            title,
            description: `${title} description`,
            passingPercent: 60,
            maxAttempts: 2,
            scorePolicy: TestScorePolicy.BEST,
            publishedAt: new Date(),
          },
        },
      },
      include: { revisions: true },
    });
    const revisionId = test.revisions[0]?.id;
    if (!revisionId) throw new Error('Test revision was not created');
    await context.prisma.lessonTest.create({
      data: {
        lessonId,
        testId: test.id,
        testRevisionId: revisionId,
        position: releaseIds.length + 1,
      },
    });
    const release = await context.prisma.testRelease.create({
      data: {
        testId: test.id,
        testRevisionId: revisionId,
        classId,
        lessonId,
        status,
        maxPoints: 10,
        passingPercent: 60,
        isRequired,
        availableFrom: dates.availableFrom,
        dueAt: dates.dueAt,
        latePolicy: dates.latePolicy ?? TestLatePolicy.DISALLOW,
        publishedAt: status === TestReleaseStatus.DRAFT ? null : new Date(),
      },
    });
    releaseIds.push(release.id);
    return release;
  }

  async function createState(
    releaseId: string,
    status: TestStudentStatus,
    scorePercent: number | null,
  ) {
    await context.prisma.testStudentState.create({
      data: {
        releaseId,
        studentId,
        status,
        attemptCount: status === TestStudentStatus.NOT_STARTED ? 0 : 1,
        scorePoints: scorePercent === null ? null : scorePercent / 10,
        scorePercent,
        bestPoints: scorePercent === null ? null : scorePercent / 10,
        bestPercent: scorePercent,
        lastActivityAt: new Date(),
      },
    });
  }

  async function createUser(
    actor: keyof typeof emails,
    role: UserRole,
  ): Promise<string> {
    const user = await context.prisma.user.create({
      data: {
        email: emails[actor],
        role,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            displayName: actor,
            preferredLocale: Locale.UK,
            gradeLevel: role === UserRole.STUDENT ? 8 : null,
          },
        },
      },
    });
    tokens[actor] = await jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
    return user.id;
  }

  function bearer(actor: keyof typeof tokens): string {
    return `Bearer ${tokens[actor]}`;
  }
});

function future(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

function past(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}
