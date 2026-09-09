import { JwtService } from '@nestjs/jwt';
import {
  LessonStatus,
  Locale,
  TestAttemptStatus,
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

describe('Teacher analytics (e2e)', () => {
  let context: AuthTestContext;
  let jwtService: JwtService;
  const stamp = Date.now();
  const emails = {
    teacher: `analytics.teacher.${stamp}@example.com`,
    otherTeacher: `analytics.other.${stamp}@example.com`,
    student: `analytics.student.${stamp}@example.com`,
    outsider: `analytics.outsider.${stamp}@example.com`,
  };
  const tokens = { teacher: '', otherTeacher: '', student: '' };
  let teacherId = '';
  let studentId = '';
  let outsiderId = '';
  let classId = '';
  let otherClassId = '';
  let lessonId = '';

  beforeAll(async () => {
    context = await createAuthTestContext();
    jwtService = context.app.get(JwtService);
    teacherId = await createUser('teacher', UserRole.TEACHER);
    const otherTeacherId = await createUser('otherTeacher', UserRole.TEACHER);
    studentId = await createUser('student', UserRole.STUDENT);
    outsiderId = await createUser('outsider', UserRole.STUDENT, false);
    const classroom = await context.prisma.class.create({
      data: {
        teacherId,
        name: 'Analytics class',
        inviteCode: `A${String(stamp).slice(-8)}`,
      },
    });
    classId = classroom.id;
    otherClassId = (
      await context.prisma.class.create({
        data: {
          teacherId: otherTeacherId,
          name: 'Private class',
          inviteCode: `B${String(stamp).slice(-8)}`,
        },
      })
    ).id;
    await context.prisma.user.update({
      where: { id: studentId },
      data: { studentClassId: classId },
    });
    const lesson = await context.prisma.lesson.create({
      data: {
        teacherId,
        title: 'Analytics lesson',
        summary: 'Summary',
        content: '<p>Content</p>',
        contentLocale: Locale.UK,
        status: LessonStatus.PUBLISHED,
      },
    });
    lessonId = lesson.id;
    await context.prisma.classLesson.create({
      data: { classId, lessonId, position: 1, publishedAt: new Date() },
    });

    const completed = await createReleasedTest(
      'Completed required',
      1,
      TestReleaseStatus.ACTIVE,
      true,
    );
    const scheduled = await createReleasedTest(
      'Scheduled required',
      2,
      TestReleaseStatus.SCHEDULED,
      true,
    );
    const review = await createReleasedTest(
      'Manual review',
      3,
      TestReleaseStatus.CLOSED,
      true,
    );
    await createReleasedTest(
      'Optional practice',
      4,
      TestReleaseStatus.ACTIVE,
      false,
    );
    await createReleasedTest('Hidden draft', 5, TestReleaseStatus.DRAFT, true);
    await createReleasedTest(
      'Hidden archive',
      6,
      TestReleaseStatus.ARCHIVED,
      true,
    );

    const completedState = await context.prisma.testStudentState.create({
      data: {
        releaseId: completed.releaseId,
        studentId,
        status: TestStudentStatus.COMPLETED,
        attemptCount: 2,
        scorePoints: 8,
        scorePercent: 80,
        bestPoints: 8,
        bestPercent: 80,
        lastActivityAt: new Date('2026-09-08T10:00:00.000Z'),
        submittedAt: new Date('2026-09-08T10:00:00.000Z'),
        completedAt: new Date('2026-09-08T11:00:00.000Z'),
      },
    });
    await context.prisma.testAttempt.createMany({
      data: [
        {
          studentStateId: completedState.id,
          testRevisionId: completed.revisionId,
          attemptNumber: 1,
          clientAttemptId: `analytics-${stamp}-1`,
          status: TestAttemptStatus.GRADED,
          maxPoints: 10,
          scorePoints: 6,
          scorePercent: 60,
          isPassed: true,
          startedAt: new Date('2026-09-07T09:00:00.000Z'),
          submittedAt: new Date('2026-09-07T10:00:00.000Z'),
          gradedAt: new Date('2026-09-07T11:00:00.000Z'),
        },
        {
          studentStateId: completedState.id,
          testRevisionId: completed.revisionId,
          attemptNumber: 2,
          clientAttemptId: `analytics-${stamp}-2`,
          status: TestAttemptStatus.GRADED,
          maxPoints: 10,
          scorePoints: 8,
          scorePercent: 80,
          isPassed: true,
          startedAt: new Date('2026-09-08T09:00:00.000Z'),
          submittedAt: new Date('2026-09-08T10:00:00.000Z'),
          gradedAt: new Date('2026-09-08T11:00:00.000Z'),
        },
      ],
    });
    const reviewState = await context.prisma.testStudentState.create({
      data: {
        releaseId: review.releaseId,
        studentId,
        status: TestStudentStatus.AWAITING_REVIEW,
        attemptCount: 1,
        lastActivityAt: new Date('2026-09-09T10:00:00.000Z'),
        submittedAt: new Date('2026-09-09T10:00:00.000Z'),
      },
    });
    await context.prisma.testAttempt.create({
      data: {
        studentStateId: reviewState.id,
        testRevisionId: review.revisionId,
        attemptNumber: 1,
        clientAttemptId: `analytics-${stamp}-review`,
        status: TestAttemptStatus.AWAITING_REVIEW,
        maxPoints: 10,
        pendingReviewCount: 1,
        submittedAt: new Date('2026-09-09T10:00:00.000Z'),
      },
    });
    expect(scheduled.releaseId).toBeTruthy();
  });

  afterAll(async () => {
    await context.prisma.testRelease.deleteMany({ where: { classId } });
    await context.prisma.lessonTest.deleteMany({ where: { lessonId } });
    await context.prisma.test.deleteMany({ where: { teacherId } });
    await context.prisma.lesson.deleteMany({ where: { id: lessonId } });
    await context.prisma.class.deleteMany({
      where: { id: { in: [classId, otherClassId] } },
    });
    await closeAuthTestContext(context, Object.values(emails));
  });

  it('returns exact required aggregates and ordered visible materials', async () => {
    const response = await request(context.app.getHttpServer())
      .get(`/teacher/analytics/classes/${classId}`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const body = getResponseBody(response);
    expect(body.metrics).toEqual(
      expect.objectContaining({
        studentCount: 1,
        requiredReleaseCount: 3,
        requiredWorkCount: 3,
        completedWorkCount: 1,
        completionPercent: 33.33,
        averagePercent: 40,
        awaitingReviewCount: 1,
      }),
    );
    const lessons = body.lessons;
    expect(Array.isArray(lessons)).toBe(true);
    const lesson = (lessons as Record<string, unknown>[])[0];
    const tests = lesson?.tests as Record<string, unknown>[];
    expect(tests.map(({ title }) => title)).toEqual([
      'Completed required',
      'Scheduled required',
      'Manual review',
      'Optional practice',
    ]);
  });

  it('returns a student history with every attempt', async () => {
    const response = await request(context.app.getHttpServer())
      .get(`/teacher/analytics/classes/${classId}/students/${studentId}`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const body = getResponseBody(response);
    const lessons = body.lessons as Record<string, unknown>[];
    const tests = lessons[0]?.tests as Record<string, unknown>[];
    const completed = tests.find(({ title }) => title === 'Completed required');
    const attempts = completed?.attempts as Record<string, unknown>[];
    expect(attempts.map(({ attemptNumber }) => attemptNumber)).toEqual([2, 1]);
  });

  it('hides foreign classes and students and enforces the teacher role', async () => {
    await request(context.app.getHttpServer())
      .get(`/teacher/analytics/classes/${classId}`)
      .set('Authorization', bearer('otherTeacher'))
      .expect(404);
    await request(context.app.getHttpServer())
      .get(`/teacher/analytics/classes/${classId}/students/${outsiderId}`)
      .set('Authorization', bearer('teacher'))
      .expect(404);
    await request(context.app.getHttpServer())
      .get(`/teacher/analytics/classes/${classId}`)
      .set('Authorization', bearer('student'))
      .expect(403);
  });

  async function createReleasedTest(
    title: string,
    position: number,
    releaseStatus: TestReleaseStatus,
    isRequired: boolean,
  ): Promise<{ releaseId: string; revisionId: string }> {
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
        position,
      },
    });
    const release = await context.prisma.testRelease.create({
      data: {
        testId: test.id,
        testRevisionId: revisionId,
        classId,
        lessonId,
        status: releaseStatus,
        maxPoints: 10,
        passingPercent: 60,
        isRequired,
        availableFrom:
          releaseStatus === TestReleaseStatus.SCHEDULED
            ? new Date('2027-01-01T10:00:00.000Z')
            : null,
        publishedAt:
          releaseStatus === TestReleaseStatus.DRAFT ? null : new Date(),
      },
    });
    return { releaseId: release.id, revisionId };
  }

  async function createUser(
    actor: keyof typeof emails,
    role: UserRole,
    issueToken = true,
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
    if (issueToken && actor in tokens) {
      tokens[actor as keyof typeof tokens] = await jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
        },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
      );
    }
    return user.id;
  }

  function bearer(actor: keyof typeof tokens): string {
    return `Bearer ${tokens[actor]}`;
  }
});
