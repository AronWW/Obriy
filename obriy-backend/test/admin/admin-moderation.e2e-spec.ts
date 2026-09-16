import { JwtService } from '@nestjs/jwt';
import { Locale, UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';
import { getResponseBody, getStringField } from '../helpers/auth-test.helpers';

describe('Admin moderation console (e2e)', () => {
  let context: AuthTestContext;
  let jwt: JwtService;
  const stamp = Date.now();
  const emails = {
    admin: `admin.console.${stamp}@example.com`,
    teacher: `admin.teacher.${stamp}@example.com`,
    student: `admin.student.${stamp}@example.com`,
    outsider: `admin.outsider.${stamp}@example.com`,
  };
  const ids = { admin: '', teacher: '', student: '', outsider: '' };
  const tokens = { admin: '', teacher: '', student: '', outsider: '' };
  let classId = '';
  let lessonId = '';
  let caseId = '';

  beforeAll(async () => {
    context = await createAuthTestContext();
    jwt = context.app.get(JwtService);
    await createUser('admin', UserRole.ADMIN);
    await createUser('teacher', UserRole.TEACHER);
    await createUser('student', UserRole.STUDENT);
    await createUser('outsider', UserRole.STUDENT);
    const classroom = await context.prisma.class.create({
      data: {
        teacherId: ids.teacher,
        name: 'Moderation class',
        inviteCode: `ADM-${String(stamp).slice(-5)}`,
        students: { connect: { id: ids.student } },
      },
    });
    classId = classroom.id;
    const lesson = await context.prisma.lesson.create({
      data: {
        teacherId: ids.teacher,
        title: 'Reported lesson',
        summary: 'Published summary',
        content: 'Published lesson content',
        contentLocale: Locale.EN,
        status: 'PUBLISHED',
        classLinks: {
          create: { classId, position: 1, publishedAt: new Date() },
        },
      },
    });
    lessonId = lesson.id;
  });

  afterAll(async () => {
    await context.prisma.notification.deleteMany({
      where: { recipientId: { in: Object.values(ids) } },
    });
    await context.prisma.adminAuditLog.deleteMany({
      where: { actorId: ids.admin },
    });
    await context.prisma.lessonModerationCase.deleteMany({
      where: { lessonId },
    });
    await closeAuthTestContext(context, Object.values(emails));
  });

  it('enforces admin role and returns safe searchable resources', async () => {
    await request(context.app.getHttpServer())
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(403);
    const dashboard = await request(context.app.getHttpServer())
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(200);
    const dashboardBody = getResponseBody(dashboard);
    expect(typeof dashboardBody.users).toBe('number');
    expect(typeof dashboardBody.classes).toBe('number');
    const users = await request(context.app.getHttpServer())
      .get(`/admin/users?search=${encodeURIComponent(emails.student)}`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(200);
    expect(JSON.stringify(getResponseBody(users))).not.toMatch(
      /password|tokenHash/i,
    );
    const classes = await request(context.app.getHttpServer())
      .get('/admin/classes?search=Moderation')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(200);
    expect(pageItems(classes).some((item) => item.id === classId)).toBe(true);
  });

  it('queues a report without hiding the lesson and prevents duplicates or foreign reports', async () => {
    const report = await request(context.app.getHttpServer())
      .post(`/student/lessons/${lessonId}/report`)
      .set('Authorization', `Bearer ${tokens.student}`)
      .send({
        category: 'MISINFORMATION',
        details: 'This historical statement needs verification.',
      })
      .expect(201);
    caseId = getStringField(report, 'caseId');
    await request(context.app.getHttpServer())
      .get(`/classes/me/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${tokens.student}`)
      .expect(200);
    await request(context.app.getHttpServer())
      .post(`/student/lessons/${lessonId}/report`)
      .set('Authorization', `Bearer ${tokens.student}`)
      .send({
        category: 'OTHER',
        details: 'This is another description of the same issue.',
      })
      .expect(409);
    await request(context.app.getHttpServer())
      .post(`/student/lessons/${lessonId}/report`)
      .set('Authorization', `Bearer ${tokens.outsider}`)
      .send({
        category: 'OTHER',
        details: 'The outsider cannot report this class lesson.',
      })
      .expect(404);
  });

  it('hides, requests changes, resubmits and approves without disclosing the reporter', async () => {
    const hidden = await moderate(
      'hide',
      1,
      'Hide this lesson while the report is reviewed.',
    );
    expect(getResponseBody(hidden)).toEqual(
      expect.objectContaining({ status: 'UNDER_REVIEW', editVersion: 2 }),
    );
    await request(context.app.getHttpServer())
      .get(`/classes/me/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${tokens.student}`)
      .expect(404);
    const changes = await moderate(
      'request-changes',
      2,
      'Correct the disputed statement and cite it clearly.',
    );
    expect(getResponseBody(changes)).toEqual(
      expect.objectContaining({ status: 'CHANGES_REQUESTED', editVersion: 3 }),
    );
    const teacherLesson = await request(context.app.getHttpServer())
      .get(`/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(200);
    const teacherBody = getResponseBody(teacherLesson);
    expect(teacherBody).toEqual(
      expect.objectContaining({ moderationStatus: 'CHANGES_REQUESTED' }),
    );
    expect(JSON.stringify(teacherBody)).not.toContain(emails.student);
    await request(context.app.getHttpServer())
      .patch(`/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ content: 'Corrected and cited lesson content' })
      .expect(200);
    await request(context.app.getHttpServer())
      .post(`/lessons/${lessonId}/moderation/resubmit`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ expectedEditVersion: 3 })
      .expect(200)
      .expect((response) =>
        expect(getResponseBody(response)).toEqual(
          expect.objectContaining({ status: 'UNDER_REVIEW', editVersion: 4 }),
        ),
      );
    await moderate(
      'approve',
      4,
      'The requested correction is complete and acceptable.',
    );
    await request(context.app.getHttpServer())
      .get(`/classes/me/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${tokens.student}`)
      .expect(200);
  });

  it('suspends ordinary users, revokes their session and records the reason', async () => {
    await request(context.app.getHttpServer())
      .post(`/admin/users/${ids.admin}/suspend`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ reason: 'An administrator cannot suspend their own account.' })
      .expect(403);
    await request(context.app.getHttpServer())
      .post(`/admin/users/${ids.teacher}/suspend`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({
        reason: 'Temporary suspension for the moderation integration test.',
      })
      .expect(200)
      .expect((response) =>
        expect(getStringField(response, 'status')).toBe('SUSPENDED'),
      );
    await request(context.app.getHttpServer())
      .get('/lessons')
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(401);
    await request(context.app.getHttpServer())
      .post(`/admin/users/${ids.teacher}/restore`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({
        reason: 'Restore the teacher after completing the integration test.',
      })
      .expect(200);
    const audit = await request(context.app.getHttpServer())
      .get('/admin/audit-logs')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(200);
    expect(pageItems(audit).some((item) => item.targetId === ids.teacher)).toBe(
      true,
    );
  });

  async function moderate(action: string, version: number, reason: string) {
    return request(context.app.getHttpServer())
      .post(`/admin/moderation/lessons/${caseId}/${action}`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ expectedEditVersion: version, reason })
      .expect(200);
  }

  async function createUser(key: keyof typeof emails, role: UserRole) {
    const user = await context.prisma.user.create({
      data: {
        email: emails[key],
        role,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        profile: { create: { displayName: key, preferredLocale: Locale.EN } },
      },
    });
    ids[key] = user.id;
    tokens[key] = await jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        role,
        status: user.status,
        sessionVersion: 0,
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
  }
});

function pageItems(response: request.Response): Record<string, unknown>[] {
  const items = getResponseBody(response).items;
  if (
    !Array.isArray(items) ||
    !items.every(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null,
    )
  ) {
    throw new Error('Expected a cursor page');
  }
  return items;
}
