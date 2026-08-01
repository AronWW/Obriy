import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';

describe('Classes (e2e)', () => {
  let context: AuthTestContext;
  let jwtService: JwtService;
  const stamp = Date.now();
  const emails = {
    teacher: `class.teacher.${stamp}@example.com`,
    otherTeacher: `class.other-teacher.${stamp}@example.com`,
    student: `class.student.${stamp}@example.com`,
    classmate: `class.classmate.${stamp}@example.com`,
    outsider: `class.outsider.${stamp}@example.com`,
    lateStudent: `class.late-student.${stamp}@example.com`,
  };
  const ids: Record<keyof typeof emails, string> = {
    teacher: '',
    otherTeacher: '',
    student: '',
    classmate: '',
    outsider: '',
    lateStudent: '',
  };
  const tokens: Record<keyof typeof emails, string> = {
    teacher: '',
    otherTeacher: '',
    student: '',
    classmate: '',
    outsider: '',
    lateStudent: '',
  };

  beforeAll(async () => {
    context = await createAuthTestContext();
    jwtService = context.app.get(JwtService);

    await Promise.all([
      createUser('teacher', UserRole.TEACHER, 'Пані Олена'),
      createUser('otherTeacher', UserRole.TEACHER, 'Інший учитель'),
      createUser('student', UserRole.STUDENT, 'Андрій'),
      createUser('classmate', UserRole.STUDENT, 'Марія'),
      createUser('outsider', UserRole.STUDENT, 'Учень з іншого класу'),
      createUser('lateStudent', UserRole.STUDENT, 'Пізній учасник'),
    ]);
  });

  afterAll(async () => {
    await closeAuthTestContext(context, Object.values(emails));
  });

  it('supports the complete teacher invitation and classmate profile flow', async () => {
    const createResponse = await request(context.app.getHttpServer())
      .post('/classes')
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ name: '8-А', gradeLevel: 8 })
      .expect(201);

    const classId = getNestedString(createResponse.body, ['class', 'id']);
    const inviteCode = getNestedString(createResponse.body, ['invite', 'code']);
    expect(inviteCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    await request(context.app.getHttpServer())
      .get('/classes')
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual([
          expect.objectContaining({
            id: classId,
            name: '8-А',
            gradeLevel: 8,
            studentCount: 0,
          }),
        ]);
      });

    await request(context.app.getHttpServer())
      .get(`/classes/${classId}`)
      .set('Authorization', `Bearer ${tokens.otherTeacher}`)
      .expect(404);

    await request(context.app.getHttpServer())
      .patch(`/classes/${classId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ name: '8-Б', gradeLevel: 8 })
      .expect(200)
      .expect((response) => {
        expect(getNestedString(response.body, ['name'])).toBe('8-Б');
      });

    await joinWithCode('student', inviteCode);
    await joinWithCode('classmate', inviteCode);

    await request(context.app.getHttpServer())
      .post('/classes/join')
      .set('Authorization', `Bearer ${tokens.student}`)
      .send({ code: inviteCode })
      .expect(409)
      .expect((response) => {
        expect(getNestedString(response.body, ['code'])).toBe(
          'STUDENT_ALREADY_IN_CLASS',
        );
      });

    await request(context.app.getHttpServer())
      .get(`/classes/${classId}/members`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(2);
      });

    await request(context.app.getHttpServer())
      .get('/classes/me/classmates')
      .set('Authorization', `Bearer ${tokens.student}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual([
          expect.objectContaining({
            id: ids.classmate,
            displayName: 'Марія',
          }),
        ]);
      });

    await request(context.app.getHttpServer())
      .get(`/classes/classmates/${ids.classmate}`)
      .set('Authorization', `Bearer ${tokens.student}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          id: ids.classmate,
          displayName: 'Марія',
          avatarUrl: null,
          gradeLevel: 8,
          bio: null,
        });
        expect(response.body).not.toHaveProperty('email');
        expect(response.body).not.toHaveProperty('xp');
        expect(response.body).not.toHaveProperty('level');
      });

    await request(context.app.getHttpServer())
      .get(`/classes/classmates/${ids.classmate}`)
      .set('Authorization', `Bearer ${tokens.outsider}`)
      .expect(404);

    const rotateResponse = await request(context.app.getHttpServer())
      .post(`/classes/${classId}/invite`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(201);
    const rotatedCode = getNestedString(rotateResponse.body, ['code']);
    expect(rotatedCode).not.toBe(inviteCode);

    await request(context.app.getHttpServer())
      .post('/classes/join')
      .set('Authorization', `Bearer ${tokens.lateStudent}`)
      .send({ code: inviteCode })
      .expect(404);

    await request(context.app.getHttpServer())
      .post('/classes/join')
      .set('Authorization', `Bearer ${tokens.lateStudent}`)
      .send({ code: rotatedCode })
      .expect(201);
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
        profile: {
          create: {
            displayName,
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

  async function joinWithCode(
    key: 'student' | 'classmate',
    code: string,
  ): Promise<void> {
    await request(context.app.getHttpServer())
      .post('/classes/join')
      .set('Authorization', `Bearer ${tokens[key]}`)
      .send({ code })
      .expect(201);
  }
});

function getNestedString(value: unknown, path: string[]): string {
  let current = value;

  for (const part of path) {
    if (typeof current !== 'object' || current === null) {
      throw new Error(`Expected ${path.join('.')} to be a string`);
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (typeof current !== 'string') {
    throw new Error(`Expected ${path.join('.')} to be a string`);
  }

  return current;
}
