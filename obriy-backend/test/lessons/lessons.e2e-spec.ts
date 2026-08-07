import { JwtService } from '@nestjs/jwt';
import { Locale, UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';
import { getResponseBody, getStringField } from '../helpers/auth-test.helpers';

describe('Teacher lessons (e2e)', () => {
  let context: AuthTestContext;
  let jwtService: JwtService;
  const stamp = Date.now();
  const emails = {
    teacher: `lesson.teacher.${stamp}@example.com`,
    otherTeacher: `lesson.other-teacher.${stamp}@example.com`,
    student: `lesson.student.${stamp}@example.com`,
  };
  const ids: Record<keyof typeof emails, string> = {
    teacher: '',
    otherTeacher: '',
    student: '',
  };
  const tokens: Record<keyof typeof emails, string> = {
    teacher: '',
    otherTeacher: '',
    student: '',
  };
  let firstClassId = '';
  let secondClassId = '';
  let foreignClassId = '';

  beforeAll(async () => {
    context = await createAuthTestContext();
    jwtService = context.app.get(JwtService);

    await Promise.all([
      createUser('teacher', UserRole.TEACHER, Locale.EN),
      createUser('otherTeacher', UserRole.TEACHER, Locale.UK),
      createUser('student', UserRole.STUDENT, Locale.UK),
    ]);

    const [firstClass, secondClass, foreignClass] = await Promise.all([
      context.prisma.class.create({
        data: {
          teacherId: ids.teacher,
          name: 'First class',
          inviteCode: 'LESS-AAA2',
        },
      }),
      context.prisma.class.create({
        data: {
          teacherId: ids.teacher,
          name: 'Second class',
          inviteCode: 'LESS-BBB2',
        },
      }),
      context.prisma.class.create({
        data: {
          teacherId: ids.otherTeacher,
          name: 'Foreign class',
          inviteCode: 'LESS-CCC2',
        },
      }),
    ]);
    firstClassId = firstClass.id;
    secondClassId = secondClass.id;
    foreignClassId = foreignClass.id;
  });

  afterAll(async () => {
    await closeAuthTestContext(context, Object.values(emails));
  });

  it('supports autosaved drafts while enforcing role, validation and privacy', async () => {
    await request(context.app.getHttpServer())
      .post('/lessons')
      .set('Authorization', `Bearer ${tokens.student}`)
      .send({ title: 'Student lesson' })
      .expect(403)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('ROLE_FORBIDDEN');
      });

    await request(context.app.getHttpServer())
      .post('/lessons')
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({})
      .expect(400)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('EMPTY_LESSON_DRAFT');
      });

    await request(context.app.getHttpServer())
      .post('/lessons')
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ title: 'Duration', estimatedMinutes: 181 })
      .expect(400);

    const content = 'First paragraph\n\n  Indented paragraph  ';
    const createResponse = await request(context.app.getHttpServer())
      .post('/lessons')
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ title: '  First Lesson  ', content })
      .expect(201);
    const lessonId = getStringField(createResponse, 'id');
    const createBody = getResponseBody(createResponse);
    expect(createBody).toEqual(
      expect.objectContaining({
        title: 'First Lesson',
        summary: '',
        content,
        contentLocale: Locale.EN,
        estimatedMinutes: null,
        status: 'DRAFT',
        classLinks: [],
      }),
    );
    expect(createBody).not.toHaveProperty('teacherId');

    await request(context.app.getHttpServer())
      .get('/lessons?status=DRAFT&search=fIrSt')
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(200)
      .expect((response) => {
        const body = getRecordArray(response);
        expect(body).toHaveLength(1);
        expect(body[0]).toEqual(
          expect.objectContaining({ id: lessonId, title: 'First Lesson' }),
        );
        expect(body[0]).not.toHaveProperty('content');
      });

    await request(context.app.getHttpServer())
      .get(`/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${tokens.otherTeacher}`)
      .expect(404)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('LESSON_NOT_FOUND');
      });

    const updatedContent = 'Kept exactly\n\n  with indentation  ';
    await request(context.app.getHttpServer())
      .patch(`/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ summary: '', content: updatedContent, estimatedMinutes: null })
      .expect(200)
      .expect((response) => {
        expect(getStringField(response, 'content')).toBe(updatedContent);
      });

    await request(context.app.getHttpServer())
      .delete(`/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(204);

    await request(context.app.getHttpServer())
      .get(`/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(404);
  });

  it('assigns, publishes, reorders, archives and restores lessons per class', async () => {
    const firstLessonId = await createLesson('Incomplete lesson');

    await request(context.app.getHttpServer())
      .put(`/classes/${firstClassId}/lessons/${firstLessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ published: true })
      .expect(409)
      .expect((response) => {
        const body = getResponseBody(response);
        expect(body.code).toBe('LESSON_INCOMPLETE');
        expect(body.missingFields).toEqual(['summary', 'content']);
      });

    const hiddenResponse = await request(context.app.getHttpServer())
      .put(`/classes/${firstClassId}/lessons/${firstLessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ published: false })
      .expect(200);
    const hiddenBody = getResponseBody(hiddenResponse);
    expect(hiddenBody).toEqual(
      expect.objectContaining({
        id: firstLessonId,
        classId: firstClassId,
        position: 1,
        publishedAt: null,
        status: 'DRAFT',
      }),
    );
    expect(hiddenBody).not.toHaveProperty('lesson');
    expect(hiddenBody).not.toHaveProperty('content');
    expect(hiddenBody).not.toHaveProperty('classLinks');

    await request(context.app.getHttpServer())
      .put(`/classes/${firstClassId}/lessons/${firstLessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ published: false })
      .expect(200)
      .expect((response) => {
        expect(getResponseBody(response).position).toBe(1);
      });

    await request(context.app.getHttpServer())
      .delete(`/lessons/${firstLessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(409)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe(
          'LESSON_DELETE_NOT_ALLOWED',
        );
      });

    await request(context.app.getHttpServer())
      .patch(`/lessons/${firstLessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({
        summary: 'A complete summary',
        content: 'A complete lesson body',
        estimatedMinutes: 25,
      })
      .expect(200);

    const publishFirstClassResponse = await request(context.app.getHttpServer())
      .put(`/classes/${firstClassId}/lessons/${firstLessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ published: true })
      .expect(200);
    const publishFirstClassBody = getResponseBody(publishFirstClassResponse);
    expect(publishFirstClassBody.status).toBe('PUBLISHED');
    expect(typeof publishFirstClassBody.publishedAt).toBe('string');

    await request(context.app.getHttpServer())
      .put(`/classes/${secondClassId}/lessons/${firstLessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ published: true })
      .expect(200);

    await request(context.app.getHttpServer())
      .put(`/classes/${firstClassId}/lessons/${firstLessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ published: false })
      .expect(200)
      .expect((response) => {
        const body = getResponseBody(response);
        expect(body.status).toBe('PUBLISHED');
        expect(body.publishedAt).toBeNull();
      });

    await request(context.app.getHttpServer())
      .get(`/lessons/${firstLessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(200)
      .expect((response) => {
        const links = getRecordArrayField(response, 'classLinks');
        expect(links).toHaveLength(2);
        const firstLink = findRecord(links, 'classId', firstClassId);
        const secondLink = findRecord(links, 'classId', secondClassId);
        expect(firstLink).toEqual(
          expect.objectContaining({
            className: 'First class',
            publishedAt: null,
          }),
        );
        expect(secondLink.className).toBe('Second class');
        expect(typeof secondLink.publishedAt).toBe('string');
      });

    await request(context.app.getHttpServer())
      .patch(`/lessons/${firstLessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ content: '   ' })
      .expect(409)
      .expect((response) => {
        const body = getResponseBody(response);
        expect(body.code).toBe('LESSON_INCOMPLETE');
        expect(body.missingFields).toEqual(['content']);
      });

    const secondLessonId = await createLesson('Second lesson', true);
    await request(context.app.getHttpServer())
      .put(`/classes/${firstClassId}/lessons/${secondLessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ published: false })
      .expect(200)
      .expect((response) => {
        expect(getResponseBody(response).position).toBe(2);
      });

    await request(context.app.getHttpServer())
      .post(`/classes/${firstClassId}/lessons/${secondLessonId}/move`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ direction: 'UP' })
      .expect(200)
      .expect((response) => {
        const body = getRecordArray(response);
        expect(body.map((item) => item.id)).toEqual([
          secondLessonId,
          firstLessonId,
        ]);
        expect(body.map((item) => item.position)).toEqual([1, 2]);
      });

    await request(context.app.getHttpServer())
      .get(`/classes/${firstClassId}/lessons`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(200)
      .expect((response) => {
        const body = getRecordArray(response);
        expect(body.map((item) => item.id)).toEqual([
          secondLessonId,
          firstLessonId,
        ]);
        expect(body[0]).not.toHaveProperty('lesson');
        expect(body[0]).not.toHaveProperty('content');
      });

    await request(context.app.getHttpServer())
      .get(`/classes/${foreignClassId}/lessons`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(404);

    const foreignLessonId = await createLesson(
      'Foreign lesson',
      true,
      'otherTeacher',
    );
    await request(context.app.getHttpServer())
      .put(`/classes/${firstClassId}/lessons/${foreignLessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ published: false })
      .expect(404)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('LESSON_NOT_FOUND');
      });

    await request(context.app.getHttpServer())
      .post(`/lessons/${firstLessonId}/archive`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(200)
      .expect((response) => {
        const body = getResponseBody(response);
        const links = getRecordArrayField(response, 'classLinks');
        expect(body.status).toBe('ARCHIVED');
        expect(links.every((link) => link.publishedAt === null)).toBe(true);
      });

    await request(context.app.getHttpServer())
      .put(`/classes/${firstClassId}/lessons/${firstLessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ published: false })
      .expect(409)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('LESSON_ARCHIVED');
      });

    await request(context.app.getHttpServer())
      .post(`/lessons/${firstLessonId}/restore`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(200)
      .expect((response) => {
        const body = getResponseBody(response);
        const links = getRecordArrayField(response, 'classLinks');
        expect(body.status).toBe('DRAFT');
        expect(links).toHaveLength(2);
        expect(links.every((link) => link.publishedAt === null)).toBe(true);
      });

    await unlinkLesson(firstClassId, firstLessonId);
    await unlinkLesson(secondClassId, firstLessonId);
    await request(context.app.getHttpServer())
      .delete(`/lessons/${firstLessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(204);

    await unlinkLesson(firstClassId, secondLessonId);
    await request(context.app.getHttpServer())
      .delete(`/classes/${firstClassId}/lessons/${secondLessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(404)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('CLASS_LESSON_NOT_FOUND');
      });
    await request(context.app.getHttpServer())
      .delete(`/lessons/${secondLessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(204);
  });

  async function createUser(
    key: keyof typeof emails,
    role: UserRole,
    preferredLocale: Locale,
  ): Promise<void> {
    const user = await context.prisma.user.create({
      data: {
        email: emails[key],
        role,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            displayName: key,
            preferredLocale,
            gradeLevel: role === UserRole.STUDENT ? 8 : null,
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

  async function createLesson(
    title: string,
    complete = false,
    actor: 'teacher' | 'otherTeacher' = 'teacher',
  ): Promise<string> {
    const response = await request(context.app.getHttpServer())
      .post('/lessons')
      .set('Authorization', `Bearer ${tokens[actor]}`)
      .send({
        title,
        ...(complete
          ? { summary: `${title} summary`, content: `${title} content` }
          : {}),
      })
      .expect(201);
    return getStringField(response, 'id');
  }

  async function unlinkLesson(
    classId: string,
    lessonId: string,
  ): Promise<void> {
    await request(context.app.getHttpServer())
      .delete(`/classes/${classId}/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(204);
  }
});

function getRecordArray(response: request.Response): Record<string, unknown>[] {
  const body: unknown = response.body;
  if (!Array.isArray(body) || !body.every(isRecord)) {
    throw new Error('Expected an array of response objects');
  }
  return body;
}

function getRecordArrayField(
  response: request.Response,
  field: string,
): Record<string, unknown>[] {
  const value = getResponseBody(response)[field];
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error(`Expected ${field} to be an array of objects`);
  }
  return value;
}

function findRecord(
  records: Record<string, unknown>[],
  field: string,
  value: unknown,
): Record<string, unknown> {
  const record = records.find((item) => item[field] === value);
  if (!record) {
    throw new Error(`Expected a record with ${field}`);
  }
  return record;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
