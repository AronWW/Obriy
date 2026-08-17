import { JwtService } from '@nestjs/jwt';
import { LessonStatus, Locale, UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';
import { getResponseBody, getStringField } from '../helpers/auth-test.helpers';

describe('Student lessons (e2e)', () => {
  let context: AuthTestContext;
  let jwtService: JwtService;
  const stamp = Date.now();
  const emails = {
    teacher: `student-lessons.teacher.${stamp}@example.com`,
    student: `student-lessons.student.${stamp}@example.com`,
    studentWithoutClass: `student-lessons.no-class.${stamp}@example.com`,
  };
  const ids: Record<keyof typeof emails, string> = {
    teacher: '',
    student: '',
    studentWithoutClass: '',
  };
  const tokens: Record<keyof typeof emails, string> = {
    teacher: '',
    student: '',
    studentWithoutClass: '',
  };
  let currentClassId = '';
  let otherClassId = '';
  const lessonIds = {
    first: `${stamp}-student-lesson-a`,
    second: `${stamp}-student-lesson-b`,
    third: `${stamp}-student-lesson-c`,
    hidden: `${stamp}-student-lesson-hidden`,
    draft: `${stamp}-student-lesson-draft`,
    archived: `${stamp}-student-lesson-archived`,
    otherClass: `${stamp}-student-lesson-other-class`,
  };

  beforeAll(async () => {
    context = await createAuthTestContext();
    jwtService = context.app.get(JwtService);

    await createUser('teacher', UserRole.TEACHER, Locale.UK);

    const [currentClass, otherClass] = await Promise.all([
      context.prisma.class.create({
        data: {
          teacherId: ids.teacher,
          name: 'Current class',
          inviteCode: 'STUD-AAA2',
        },
      }),
      context.prisma.class.create({
        data: {
          teacherId: ids.teacher,
          name: 'Other class',
          inviteCode: 'STUD-BBB2',
        },
      }),
    ]);
    currentClassId = currentClass.id;
    otherClassId = otherClass.id;

    await Promise.all([
      createUser('student', UserRole.STUDENT, Locale.UK, currentClassId),
      createUser('studentWithoutClass', UserRole.STUDENT, Locale.EN),
    ]);
    await createLessonFixtures();
  });

  afterAll(async () => {
    await closeAuthTestContext(context, Object.values(emails));
  });

  it('routes the exact static path to student logic and rejects a teacher', async () => {
    await request(context.app.getHttpServer())
      .get('/classes/me/lessons')
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(403)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('ROLE_FORBIDDEN');
      });

    await request(context.app.getHttpServer())
      .get(`/classes/me/lessons/${lessonIds.first}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(403)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('ROLE_FORBIDDEN');
      });
  });

  it('returns an empty list when the student has no class', async () => {
    await request(context.app.getHttpServer())
      .get('/classes/me/lessons')
      .set('Authorization', `Bearer ${tokens.studentWithoutClass}`)
      .expect(200)
      .expect([]);
  });

  it('lists only published lessons of the current class in stable order', async () => {
    await request(context.app.getHttpServer())
      .get('/classes/me/lessons')
      .set('Authorization', `Bearer ${tokens.student}`)
      .expect(200)
      .expect((response) => {
        const body = getRecordArray(response);
        expect(body.map((lesson) => lesson.id)).toEqual([
          lessonIds.second,
          lessonIds.first,
          lessonIds.third,
        ]);
        expect(body.map((lesson) => lesson.position)).toEqual([1, 2, 2]);
        expect(body[0]).toEqual({
          id: lessonIds.second,
          title: 'Second published lesson',
          summary: 'Second summary',
          contentLocale: Locale.EN,
          estimatedMinutes: null,
          position: 1,
          progress: {
            status: 'NO_TASKS',
            requiredTotal: 0,
            completed: 0,
            awaitingReview: 0,
            needsRevision: 0,
            inProgress: 0,
            expired: 0,
          },
        });
        for (const lesson of body) {
          expect(Object.keys(lesson).sort()).toEqual(
            [
              'contentLocale',
              'estimatedMinutes',
              'id',
              'position',
              'progress',
              'summary',
              'title',
            ].sort(),
          );
          expect(lesson).not.toHaveProperty('content');
          expect(lesson).not.toHaveProperty('teacherId');
          expect(lesson).not.toHaveProperty('status');
          expect(lesson).not.toHaveProperty('classLinks');
        }
      });
  });

  it('returns explicit detail data and preserves plain-text content', async () => {
    const content = 'First paragraph\n\n  Indented paragraph  ';

    await request(context.app.getHttpServer())
      .get(`/classes/me/lessons/${lessonIds.first}`)
      .set('Authorization', `Bearer ${tokens.student}`)
      .expect(200)
      .expect((response) => {
        expect(getResponseBody(response)).toEqual({
          id: lessonIds.first,
          title: 'First published lesson',
          summary: 'First summary',
          contentLocale: Locale.UK,
          estimatedMinutes: 15,
          position: 2,
          progress: {
            status: 'NO_TASKS',
            requiredTotal: 0,
            completed: 0,
            awaitingReview: 0,
            needsRevision: 0,
            inProgress: 0,
            expired: 0,
          },
          content,
          class: { id: currentClassId, name: 'Current class' },
          teacher: { id: ids.teacher, displayName: 'Teacher Example' },
        });
        expect(getResponseBody(response).teacher).not.toHaveProperty('email');
      });
  });

  it.each([
    ['hidden', lessonIds.hidden],
    ['draft', lessonIds.draft],
    ['archived', lessonIds.archived],
    ['other-class', lessonIds.otherClass],
    ['missing', `${stamp}-missing-lesson`],
  ])(
    'does not disclose a %s lesson by direct URL',
    async (_label, lessonId) => {
      await request(context.app.getHttpServer())
        .get(`/classes/me/lessons/${lessonId}`)
        .set('Authorization', `Bearer ${tokens.student}`)
        .expect(404)
        .expect((response) => {
          expect(getStringField(response, 'code')).toBe('LESSON_NOT_FOUND');
        });
    },
  );

  it('returns 404 for lesson detail when the student has no class', async () => {
    await request(context.app.getHttpServer())
      .get(`/classes/me/lessons/${lessonIds.first}`)
      .set('Authorization', `Bearer ${tokens.studentWithoutClass}`)
      .expect(404)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('LESSON_NOT_FOUND');
      });
  });

  async function createUser(
    key: keyof typeof emails,
    role: UserRole,
    preferredLocale: Locale,
    studentClassId?: string,
  ): Promise<void> {
    const user = await context.prisma.user.create({
      data: {
        email: emails[key],
        role,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        studentClassId,
        profile: {
          create: {
            displayName:
              key === 'teacher' ? 'Teacher Example' : 'Student Example',
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

  async function createLessonFixtures(): Promise<void> {
    await Promise.all([
      createLesson(
        lessonIds.first,
        'First published lesson',
        'First summary',
        LessonStatus.PUBLISHED,
        Locale.UK,
        15,
        'First paragraph\n\n  Indented paragraph  ',
      ),
      createLesson(
        lessonIds.second,
        'Second published lesson',
        'Second summary',
        LessonStatus.PUBLISHED,
        Locale.EN,
        null,
      ),
      createLesson(
        lessonIds.third,
        'Third published lesson',
        'Third summary',
        LessonStatus.PUBLISHED,
        Locale.UK,
        30,
      ),
      createLesson(
        lessonIds.hidden,
        'Hidden lesson',
        'Hidden summary',
        LessonStatus.PUBLISHED,
      ),
      createLesson(
        lessonIds.draft,
        'Draft lesson',
        'Draft summary',
        LessonStatus.DRAFT,
      ),
      createLesson(
        lessonIds.archived,
        'Archived lesson',
        'Archived summary',
        LessonStatus.ARCHIVED,
      ),
      createLesson(
        lessonIds.otherClass,
        'Other class lesson',
        'Other class summary',
        LessonStatus.PUBLISHED,
      ),
    ]);

    const publishedAt = new Date();
    await context.prisma.classLesson.createMany({
      data: [
        {
          classId: currentClassId,
          lessonId: lessonIds.first,
          position: 2,
          publishedAt,
        },
        {
          classId: currentClassId,
          lessonId: lessonIds.second,
          position: 1,
          publishedAt,
        },
        {
          classId: currentClassId,
          lessonId: lessonIds.third,
          position: 2,
          publishedAt,
        },
        {
          classId: currentClassId,
          lessonId: lessonIds.hidden,
          position: 3,
          publishedAt: null,
        },
        {
          classId: currentClassId,
          lessonId: lessonIds.draft,
          position: 4,
          publishedAt,
        },
        {
          classId: currentClassId,
          lessonId: lessonIds.archived,
          position: 5,
          publishedAt,
        },
        {
          classId: otherClassId,
          lessonId: lessonIds.otherClass,
          position: 1,
          publishedAt,
        },
      ],
    });
  }

  async function createLesson(
    id: string,
    title: string,
    summary: string,
    status: LessonStatus,
    contentLocale: Locale = Locale.UK,
    estimatedMinutes: number | null = 10,
    content = `${title} content`,
  ): Promise<void> {
    await context.prisma.lesson.create({
      data: {
        id,
        teacherId: ids.teacher,
        title,
        summary,
        content,
        contentLocale,
        estimatedMinutes,
        status,
      },
    });
  }
});

function getRecordArray(response: request.Response): Record<string, unknown>[] {
  const body: unknown = response.body;
  if (!Array.isArray(body) || !body.every(isRecord)) {
    throw new Error('Expected an array of response objects');
  }
  return body;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
