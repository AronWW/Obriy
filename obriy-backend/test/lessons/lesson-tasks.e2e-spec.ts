import { JwtService } from '@nestjs/jwt';
import {
  LessonStatus,
  LessonTaskSubmissionStatus,
  Locale,
  UserRole,
  UserStatus,
} from '@prisma/client';
import request from 'supertest';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';
import { getResponseBody, getStringField } from '../helpers/auth-test.helpers';

describe('Lesson tasks and student submissions (e2e)', () => {
  let context: AuthTestContext;
  let jwtService: JwtService;
  const stamp = Date.now();
  const emails = {
    teacher: `lesson-tasks.teacher.${stamp}@example.com`,
    otherTeacher: `lesson-tasks.other-teacher.${stamp}@example.com`,
    student: `lesson-tasks.student.${stamp}@example.com`,
    outsideStudent: `lesson-tasks.outside-student.${stamp}@example.com`,
  };
  const ids: Record<keyof typeof emails, string> = {
    teacher: '',
    otherTeacher: '',
    student: '',
    outsideStudent: '',
  };
  const tokens: Record<keyof typeof emails, string> = {
    teacher: '',
    otherTeacher: '',
    student: '',
    outsideStudent: '',
  };
  const lessonIds = {
    main: `${stamp}-task-flow-main`,
    noTasks: `${stamp}-task-flow-no-tasks`,
    hidden: `${stamp}-task-flow-hidden`,
    archived: `${stamp}-task-flow-archived`,
    foreign: `${stamp}-task-flow-foreign`,
  };
  let currentClassId = '';
  let outsideClassId = '';
  let archivedTaskId = '';
  let hiddenTaskId = '';
  let firstRequiredTaskId = '';
  let secondRequiredTaskId = '';
  let optionalTaskId = '';

  beforeAll(async () => {
    context = await createAuthTestContext();
    jwtService = context.app.get(JwtService);

    await Promise.all([
      createUser('teacher', UserRole.TEACHER),
      createUser('otherTeacher', UserRole.TEACHER),
    ]);

    const [currentClass, outsideClass] = await Promise.all([
      context.prisma.class.create({
        data: {
          teacherId: ids.teacher,
          name: 'Task flow class',
          inviteCode: 'TASK-FLOW',
        },
      }),
      context.prisma.class.create({
        data: {
          teacherId: ids.otherTeacher,
          name: 'Outside class',
          inviteCode: 'OUTS-IDE2',
        },
      }),
    ]);
    currentClassId = currentClass.id;
    outsideClassId = outsideClass.id;

    await Promise.all([
      createUser('student', UserRole.STUDENT, currentClassId),
      createUser('outsideStudent', UserRole.STUDENT, outsideClassId),
    ]);
    await createLessonFixtures();

    const [archivedTask, hiddenTask] = await Promise.all([
      context.prisma.lessonTask.create({
        data: {
          lessonId: lessonIds.archived,
          title: 'Archived question',
          prompt: 'This task is read-only.',
          position: 1,
        },
      }),
      context.prisma.lessonTask.create({
        data: {
          lessonId: lessonIds.hidden,
          title: 'Hidden question',
          prompt: 'This task must not be disclosed.',
          position: 1,
        },
      }),
    ]);
    archivedTaskId = archivedTask.id;
    hiddenTaskId = hiddenTask.id;
  });

  afterAll(async () => {
    await closeAuthTestContext(context, Object.values(emails));
  });

  it('enforces teacher role, ownership, validation and archived read-only rules', async () => {
    await request(context.app.getHttpServer())
      .get(`/lessons/${lessonIds.main}/tasks`)
      .set('Authorization', `Bearer ${tokens.student}`)
      .expect(403)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('ROLE_FORBIDDEN');
      });

    await request(context.app.getHttpServer())
      .get(`/lessons/${lessonIds.main}/tasks`)
      .set('Authorization', `Bearer ${tokens.otherTeacher}`)
      .expect(404)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('LESSON_NOT_FOUND');
      });

    await request(context.app.getHttpServer())
      .get(`/lessons/${lessonIds.foreign}/tasks`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(404)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('LESSON_NOT_FOUND');
      });

    await request(context.app.getHttpServer())
      .post(`/lessons/${lessonIds.main}/tasks`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ title: '   ', prompt: '\n\t' })
      .expect(400);

    await request(context.app.getHttpServer())
      .post(`/lessons/${lessonIds.main}/tasks`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ title: 'Question', prompt: 'Answer it', unexpected: true })
      .expect(400);

    await request(context.app.getHttpServer())
      .post(`/lessons/${lessonIds.archived}/tasks`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ title: 'New question', prompt: 'Answer it' })
      .expect(409)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('LESSON_ARCHIVED');
      });

    await request(context.app.getHttpServer())
      .patch(`/lessons/${lessonIds.archived}/tasks/${archivedTaskId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ title: 'Changed question' })
      .expect(409)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('LESSON_ARCHIVED');
      });

    await request(context.app.getHttpServer())
      .delete(`/lessons/${lessonIds.archived}/tasks/${archivedTaskId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(409)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('LESSON_ARCHIVED');
      });
  });

  it('creates ordered task cards, updates them and safely deletes an unused task', async () => {
    const firstTask = await createTask({
      title: '  First required task  ',
      prompt: 'First line\n\n  Keep indentation  ',
    });
    firstRequiredTaskId = getString(firstTask, 'id');
    expect(firstTask).toEqual(
      expect.objectContaining({
        lessonId: lessonIds.main,
        title: 'First required task',
        prompt: 'First line\n\n  Keep indentation  ',
        position: 1,
        isRequired: true,
      }),
    );
    expect(Object.keys(firstTask).sort()).toEqual(
      [
        'createdAt',
        'id',
        'isRequired',
        'lessonId',
        'position',
        'prompt',
        'title',
        'updatedAt',
      ].sort(),
    );

    const secondTask = await createTask({
      title: 'Second required task',
      prompt: 'Give a second answer.',
    });
    secondRequiredTaskId = getString(secondTask, 'id');
    expect(secondTask.position).toBe(2);
    expect(secondTask.isRequired).toBe(true);

    const optionalTask = await createTask({
      title: 'Optional reflection',
      prompt: 'Share an optional thought.',
      isRequired: false,
    });
    optionalTaskId = getString(optionalTask, 'id');
    expect(optionalTask.position).toBe(3);
    expect(optionalTask.isRequired).toBe(false);

    const disposableTask = await createTask({
      title: 'Temporary task',
      prompt: 'Temporary prompt',
    });
    const disposableTaskId = getString(disposableTask, 'id');
    expect(disposableTask.position).toBe(4);

    await request(context.app.getHttpServer())
      .patch(`/lessons/${lessonIds.main}/tasks/${disposableTaskId}`)
      .set('Authorization', `Bearer ${tokens.otherTeacher}`)
      .send({ title: 'Must not update' })
      .expect(404)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('LESSON_NOT_FOUND');
      });

    await request(context.app.getHttpServer())
      .patch(`/lessons/${lessonIds.main}/tasks/${disposableTaskId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({
        title: '  Updated temporary task  ',
        prompt: 'Updated prompt',
        isRequired: false,
      })
      .expect(200)
      .expect((response) => {
        expect(getResponseBody(response)).toEqual(
          expect.objectContaining({
            title: 'Updated temporary task',
            prompt: 'Updated prompt',
            position: 4,
            isRequired: false,
          }),
        );
      });

    await request(context.app.getHttpServer())
      .patch(`/lessons/${lessonIds.main}/tasks/${hiddenTaskId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ title: 'Cross-lesson update' })
      .expect(404)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('LESSON_TASK_NOT_FOUND');
      });

    await request(context.app.getHttpServer())
      .delete(`/lessons/${lessonIds.main}/tasks/${disposableTaskId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(204);

    await request(context.app.getHttpServer())
      .get(`/lessons/${lessonIds.main}/tasks`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(200)
      .expect((response) => {
        const tasks = getRecordArray(response);
        expect(tasks.map((task) => task.id)).toEqual([
          firstRequiredTaskId,
          secondRequiredTaskId,
          optionalTaskId,
        ]);
        expect(tasks.map((task) => task.position)).toEqual([1, 2, 3]);
      });

    await request(context.app.getHttpServer())
      .get(`/classes/me/lessons/${lessonIds.main}`)
      .set('Authorization', `Bearer ${tokens.student}`)
      .expect(200)
      .expect((response) => {
        const body = getResponseBody(response);
        expect(body.progress).toEqual({
          status: 'NOT_STARTED',
          requiredTotal: 2,
          approved: 0,
          submitted: 0,
          returned: 0,
        });
        const tasks = getRecordArrayField(response, 'tasks');
        expect(tasks.map((task) => task.id)).toEqual([
          firstRequiredTaskId,
          secondRequiredTaskId,
          optionalTaskId,
        ]);
        expect(tasks.every((task) => task.submission === null)).toBe(true);
        expect(tasks[0]).toEqual({
          id: firstRequiredTaskId,
          title: 'First required task',
          prompt: 'First line\n\n  Keep indentation  ',
          position: 1,
          isRequired: true,
          submission: null,
        });
      });
  });

  it('reports NO_TASKS for a published lesson without required tasks', async () => {
    await request(context.app.getHttpServer())
      .get(`/classes/me/lessons/${lessonIds.noTasks}`)
      .set('Authorization', `Bearer ${tokens.student}`)
      .expect(200)
      .expect((response) => {
        const body = getResponseBody(response);
        expect(body.progress).toEqual({
          status: 'NO_TASKS',
          requiredTotal: 0,
          approved: 0,
          submitted: 0,
          returned: 0,
        });
        expect(body.tasks).toEqual([]);
      });
  });

  it('runs submit, return, resubmit and approve while keeping progress private and accurate', async () => {
    await request(context.app.getHttpServer())
      .put(
        `/classes/me/lessons/${lessonIds.main}/tasks/${firstRequiredTaskId}/submission`,
      )
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ answerText: 'Teacher answer' })
      .expect(403)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('ROLE_FORBIDDEN');
      });

    await request(context.app.getHttpServer())
      .put(
        `/classes/me/lessons/${lessonIds.main}/tasks/${firstRequiredTaskId}/submission`,
      )
      .set('Authorization', `Bearer ${tokens.outsideStudent}`)
      .send({ answerText: 'Outside answer' })
      .expect(404)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('LESSON_NOT_FOUND');
      });

    await request(context.app.getHttpServer())
      .put(
        `/classes/me/lessons/${lessonIds.hidden}/tasks/${hiddenTaskId}/submission`,
      )
      .set('Authorization', `Bearer ${tokens.student}`)
      .send({ answerText: 'Hidden answer' })
      .expect(404)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('LESSON_NOT_FOUND');
      });

    await request(context.app.getHttpServer())
      .put(
        `/classes/me/lessons/${lessonIds.main}/tasks/${firstRequiredTaskId}/submission`,
      )
      .set('Authorization', `Bearer ${tokens.student}`)
      .send({ answerText: '  \n ' })
      .expect(400);

    const firstSubmissionResponse = await request(context.app.getHttpServer())
      .put(
        `/classes/me/lessons/${lessonIds.main}/tasks/${firstRequiredTaskId}/submission`,
      )
      .set('Authorization', `Bearer ${tokens.student}`)
      .send({ answerText: 'First answer\n\n  With indentation  ' })
      .expect(200);
    const firstSubmission = getResponseBody(firstSubmissionResponse);
    const firstSubmissionId = getString(firstSubmission, 'id');
    expect(firstSubmission).toEqual(
      expect.objectContaining({
        taskId: firstRequiredTaskId,
        answerText: 'First answer\n\n  With indentation  ',
        status: LessonTaskSubmissionStatus.SUBMITTED,
        teacherComment: null,
        reviewedAt: null,
      }),
    );
    expect(Object.keys(firstSubmission).sort()).toEqual(
      [
        'answerText',
        'id',
        'reviewedAt',
        'status',
        'submittedAt',
        'taskId',
        'teacherComment',
        'updatedAt',
      ].sort(),
    );

    await expectStudentProgress({
      status: 'IN_PROGRESS',
      requiredTotal: 2,
      approved: 0,
      submitted: 1,
      returned: 0,
    });

    const submissionsResponse = await request(context.app.getHttpServer())
      .get(`/lessons/${lessonIds.main}/task-submissions`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(200);
    const teacherSubmissions = getRecordArray(submissionsResponse);
    expect(teacherSubmissions).toHaveLength(1);
    expect(teacherSubmissions[0]).toEqual(
      expect.objectContaining({
        id: firstSubmissionId,
        taskId: firstRequiredTaskId,
        taskTitle: 'First required task',
        taskPosition: 1,
        taskIsRequired: true,
        student: { id: ids.student, displayName: 'Student Example' },
        class: { id: currentClassId, name: 'Task flow class' },
        answerText: 'First answer\n\n  With indentation  ',
        status: LessonTaskSubmissionStatus.SUBMITTED,
        teacherComment: null,
        reviewedAt: null,
      }),
    );
    expect(Object.keys(teacherSubmissions[0]).sort()).toEqual(
      [
        'answerText',
        'class',
        'id',
        'reviewedAt',
        'status',
        'student',
        'submittedAt',
        'taskId',
        'taskIsRequired',
        'taskPosition',
        'taskTitle',
        'teacherComment',
        'updatedAt',
      ].sort(),
    );
    expect(JSON.stringify(teacherSubmissions[0])).not.toContain('@example.com');

    await request(context.app.getHttpServer())
      .get(`/lessons/${lessonIds.main}/task-submissions`)
      .set('Authorization', `Bearer ${tokens.otherTeacher}`)
      .expect(404)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('LESSON_NOT_FOUND');
      });

    await request(context.app.getHttpServer())
      .patch(
        `/lessons/${lessonIds.main}/tasks/${firstRequiredTaskId}/submissions/${firstSubmissionId}`,
      )
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ status: LessonTaskSubmissionStatus.SUBMITTED })
      .expect(400);

    await request(context.app.getHttpServer())
      .patch(
        `/lessons/${lessonIds.main}/tasks/${firstRequiredTaskId}/submissions/${firstSubmissionId}`,
      )
      .set('Authorization', `Bearer ${tokens.otherTeacher}`)
      .send({ status: LessonTaskSubmissionStatus.RETURNED })
      .expect(404)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('LESSON_NOT_FOUND');
      });

    await request(context.app.getHttpServer())
      .patch(
        `/lessons/${lessonIds.main}/tasks/${firstRequiredTaskId}/submissions/${firstSubmissionId}`,
      )
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({
        status: LessonTaskSubmissionStatus.RETURNED,
        teacherComment: '  Add one concrete example.  ',
      })
      .expect(200)
      .expect((response) => {
        expect(getResponseBody(response)).toEqual(
          expect.objectContaining({
            status: LessonTaskSubmissionStatus.RETURNED,
            teacherComment: 'Add one concrete example.',
          }),
        );
        expect(typeof getResponseBody(response).reviewedAt).toBe('string');
      });

    await expectStudentProgress({
      status: 'IN_PROGRESS',
      requiredTotal: 2,
      approved: 0,
      submitted: 0,
      returned: 1,
    });
    await expectStudentTaskSubmission(firstRequiredTaskId, {
      status: LessonTaskSubmissionStatus.RETURNED,
      teacherComment: 'Add one concrete example.',
    });

    await request(context.app.getHttpServer())
      .put(
        `/classes/me/lessons/${lessonIds.main}/tasks/${firstRequiredTaskId}/submission`,
      )
      .set('Authorization', `Bearer ${tokens.student}`)
      .send({ answerText: 'Improved first answer' })
      .expect(200)
      .expect((response) => {
        expect(getResponseBody(response)).toEqual(
          expect.objectContaining({
            id: firstSubmissionId,
            status: LessonTaskSubmissionStatus.SUBMITTED,
            answerText: 'Improved first answer',
            teacherComment: null,
            reviewedAt: null,
          }),
        );
      });

    await expectStudentProgress({
      status: 'IN_PROGRESS',
      requiredTotal: 2,
      approved: 0,
      submitted: 1,
      returned: 0,
    });

    await approveSubmission(firstRequiredTaskId, firstSubmissionId);
    await expectStudentProgress({
      status: 'IN_PROGRESS',
      requiredTotal: 2,
      approved: 1,
      submitted: 0,
      returned: 0,
    });

    await request(context.app.getHttpServer())
      .put(
        `/classes/me/lessons/${lessonIds.main}/tasks/${firstRequiredTaskId}/submission`,
      )
      .set('Authorization', `Bearer ${tokens.student}`)
      .send({ answerText: 'Attempt to change approved answer' })
      .expect(409)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe(
          'TASK_SUBMISSION_APPROVED',
        );
      });

    const optionalSubmissionId = await submitTask(
      optionalTaskId,
      'Optional answer',
    );
    await approveSubmission(optionalTaskId, optionalSubmissionId);
    await expectStudentProgress({
      status: 'IN_PROGRESS',
      requiredTotal: 2,
      approved: 1,
      submitted: 0,
      returned: 0,
    });

    const secondSubmissionId = await submitTask(
      secondRequiredTaskId,
      'Second answer',
    );
    await expectStudentProgress({
      status: 'IN_PROGRESS',
      requiredTotal: 2,
      approved: 1,
      submitted: 1,
      returned: 0,
    });
    await approveSubmission(secondRequiredTaskId, secondSubmissionId);
    await expectStudentProgress({
      status: 'COMPLETED',
      requiredTotal: 2,
      approved: 2,
      submitted: 0,
      returned: 0,
    });

    await request(context.app.getHttpServer())
      .get('/classes/me/lessons')
      .set('Authorization', `Bearer ${tokens.student}`)
      .expect(200)
      .expect((response) => {
        const lesson = findRecord(
          getRecordArray(response),
          'id',
          lessonIds.main,
        );
        expect(lesson.progress).toEqual({
          status: 'COMPLETED',
          requiredTotal: 2,
          approved: 2,
          submitted: 0,
          returned: 0,
        });
      });

    await request(context.app.getHttpServer())
      .delete(`/lessons/${lessonIds.main}/tasks/${firstRequiredTaskId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .expect(409)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe(
          'LESSON_TASK_HAS_SUBMISSIONS',
        );
      });
  });

  async function createUser(
    key: keyof typeof emails,
    role: UserRole,
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
              key === 'student'
                ? 'Student Example'
                : key === 'outsideStudent'
                  ? 'Outside Student'
                  : key,
            preferredLocale: Locale.UK,
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
      createLesson(lessonIds.main, ids.teacher, LessonStatus.PUBLISHED),
      createLesson(lessonIds.noTasks, ids.teacher, LessonStatus.PUBLISHED),
      createLesson(lessonIds.hidden, ids.teacher, LessonStatus.PUBLISHED),
      createLesson(lessonIds.archived, ids.teacher, LessonStatus.ARCHIVED),
      createLesson(lessonIds.foreign, ids.otherTeacher, LessonStatus.PUBLISHED),
    ]);

    await context.prisma.classLesson.createMany({
      data: [
        {
          classId: currentClassId,
          lessonId: lessonIds.main,
          position: 1,
          publishedAt: new Date(),
        },
        {
          classId: currentClassId,
          lessonId: lessonIds.noTasks,
          position: 2,
          publishedAt: new Date(),
        },
        {
          classId: currentClassId,
          lessonId: lessonIds.hidden,
          position: 3,
          publishedAt: null,
        },
      ],
    });
  }

  async function createLesson(
    id: string,
    teacherId: string,
    status: LessonStatus,
  ): Promise<void> {
    await context.prisma.lesson.create({
      data: {
        id,
        teacherId,
        title: `Lesson ${id}`,
        summary: 'Complete summary',
        content: 'Complete content',
        contentLocale: Locale.UK,
        estimatedMinutes: null,
        status,
      },
    });
  }

  async function createTask(
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const response = await request(context.app.getHttpServer())
      .post(`/lessons/${lessonIds.main}/tasks`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send(body)
      .expect(201);
    return getResponseBody(response);
  }

  async function submitTask(
    taskId: string,
    answerText: string,
  ): Promise<string> {
    const response = await request(context.app.getHttpServer())
      .put(`/classes/me/lessons/${lessonIds.main}/tasks/${taskId}/submission`)
      .set('Authorization', `Bearer ${tokens.student}`)
      .send({ answerText })
      .expect(200);
    const body = getResponseBody(response);
    expect(body.status).toBe(LessonTaskSubmissionStatus.SUBMITTED);
    return getString(body, 'id');
  }

  async function approveSubmission(
    taskId: string,
    submissionId: string,
  ): Promise<void> {
    await request(context.app.getHttpServer())
      .patch(
        `/lessons/${lessonIds.main}/tasks/${taskId}/submissions/${submissionId}`,
      )
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ status: LessonTaskSubmissionStatus.APPROVED })
      .expect(200)
      .expect((response) => {
        expect(getResponseBody(response)).toEqual(
          expect.objectContaining({
            id: submissionId,
            taskId,
            status: LessonTaskSubmissionStatus.APPROVED,
            teacherComment: null,
          }),
        );
      });
  }

  async function expectStudentProgress(
    expected: Record<string, unknown>,
  ): Promise<void> {
    await request(context.app.getHttpServer())
      .get(`/classes/me/lessons/${lessonIds.main}`)
      .set('Authorization', `Bearer ${tokens.student}`)
      .expect(200)
      .expect((response) => {
        expect(getResponseBody(response).progress).toEqual(expected);
      });
  }

  async function expectStudentTaskSubmission(
    taskId: string,
    expected: Record<string, unknown>,
  ): Promise<void> {
    await request(context.app.getHttpServer())
      .get(`/classes/me/lessons/${lessonIds.main}`)
      .set('Authorization', `Bearer ${tokens.student}`)
      .expect(200)
      .expect((response) => {
        const task = findRecord(
          getRecordArrayField(response, 'tasks'),
          'id',
          taskId,
        );
        expect(task.submission).toEqual(expect.objectContaining(expected));
        expect(JSON.stringify(task.submission)).not.toContain('@example.com');
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

function getString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== 'string') {
    throw new Error(`Expected ${field} to be a string`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
