import { JwtService } from '@nestjs/jwt';
import {
  AssignmentStatus,
  AssignmentType,
  Locale,
  UserRole,
  UserStatus,
} from '@prisma/client';
import request from 'supertest';
import { getResponseBody, getStringField } from '../helpers/auth-test.helpers';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';

jest.setTimeout(30_000);

describe('Assignments (e2e)', () => {
  let context: AuthTestContext;
  let jwtService: JwtService;
  const stamp = Date.now();
  const emails = {
    teacher: `assignments.teacher.${stamp}@example.com`,
    otherTeacher: `assignments.other-teacher.${stamp}@example.com`,
    student: `assignments.student.${stamp}@example.com`,
  };
  const tokens: Record<keyof typeof emails, string> = {
    teacher: '',
    otherTeacher: '',
    student: '',
  };
  const userIds: Record<keyof typeof emails, string> = {
    teacher: '',
    otherTeacher: '',
    student: '',
  };
  let lifecycleAssignmentId = '';

  beforeAll(async () => {
    context = await createAuthTestContext();
    jwtService = context.app.get(JwtService);

    await createUser('teacher', UserRole.TEACHER, Locale.EN);
    await createUser('otherTeacher', UserRole.TEACHER, Locale.UK);
    await createUser('student', UserRole.STUDENT, Locale.UK);
  });

  afterAll(async () => {
    await closeAuthTestContext(context, Object.values(emails));
  });

  it('enforces teacher ownership and creates localized drafts with defaults', async () => {
    await request(context.app.getHttpServer())
      .post('/assignments')
      .set('Authorization', bearer('student'))
      .send({ type: AssignmentType.WRITTEN })
      .expect(403)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('ROLE_FORBIDDEN');
      });

    await request(context.app.getHttpServer())
      .post('/assignments')
      .set('Authorization', bearer('teacher'))
      .send({
        type: AssignmentType.WRITTEN,
        defaultMaxPoints: null,
      })
      .expect(400);

    const createResponse = await request(context.app.getHttpServer())
      .post('/assignments')
      .set('Authorization', bearer('teacher'))
      .send({ type: AssignmentType.WRITTEN })
      .expect(201);
    const assignmentId = getStringField(createResponse, 'id');
    const createBody = getResponseBody(createResponse);
    const draft = getRecordField(createBody, 'draftRevision');

    expect(createBody).toEqual(
      expect.objectContaining({
        type: AssignmentType.WRITTEN,
        contentLocale: Locale.EN,
        status: AssignmentStatus.DRAFT,
        defaultMaxPoints: 1,
        defaultPassingPercent: 100,
        publishedRevision: null,
      }),
    );
    expect(createBody).not.toHaveProperty('teacherId');
    expect(draft).toEqual(
      expect.objectContaining({
        version: 1,
        status: 'DRAFT',
        title: '',
        prompt: '',
        editVersion: 1,
        publicConfig: defaultWrittenConfig(),
        gradingConfig: { mode: 'MANUAL' },
      }),
    );

    await request(context.app.getHttpServer())
      .get(`/assignments/${assignmentId}`)
      .set('Authorization', bearer('otherTeacher'))
      .expect(404)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('ASSIGNMENT_NOT_FOUND');
      });

    await request(context.app.getHttpServer())
      .get(`/assignments/${assignmentId}`)
      .set('Authorization', bearer('student'))
      .expect(403)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('ROLE_FORBIDDEN');
      });

    const explicitLocaleResponse = await request(context.app.getHttpServer())
      .post('/assignments')
      .set('Authorization', bearer('teacher'))
      .send({
        type: AssignmentType.WRITTEN,
        contentLocale: Locale.UK,
        defaultMaxPoints: 7.5,
        defaultPassingPercent: 60,
      })
      .expect(201);
    expect(getResponseBody(explicitLocaleResponse)).toEqual(
      expect.objectContaining({
        contentLocale: Locale.UK,
        defaultMaxPoints: 7.5,
        defaultPassingPercent: 60,
      }),
    );

    const atomicCreateResponse = await request(context.app.getHttpServer())
      .post('/assignments')
      .set('Authorization', bearer('teacher'))
      .send({
        type: AssignmentType.WRITTEN,
        defaultMaxPoints: 5,
        draft: {
          title: '  Atomic first save  ',
          prompt: 'Explain the event.',
          instructions: 'Use two sources.',
          publicConfig: defaultWrittenConfig(),
          gradingConfig: { mode: 'MANUAL' },
        },
      })
      .expect(201);
    expect(
      getRecordField(getResponseBody(atomicCreateResponse), 'draftRevision'),
    ).toEqual(
      expect.objectContaining({
        title: 'Atomic first save',
        prompt: 'Explain the event.',
        instructions: 'Use two sources.',
        publicConfig: defaultWrittenConfig(),
      }),
    );
  });

  it('autosaves atomically, rejects stale writes and keeps preview student-safe', async () => {
    const createResponse = await createAssignment('teacher');
    const assignmentId = getStringField(createResponse, 'id');
    const revisionId = getStringValue(
      getRecordField(getResponseBody(createResponse), 'draftRevision'),
      'id',
    );
    const privateExplanation = `private-explanation-${stamp}`;
    const prompt = 'Explain how the source supports the conclusion.';

    const updateResponse = await request(context.app.getHttpServer())
      .patch(`/assignments/${assignmentId}/draft`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: revisionId,
        expectedEditVersion: 1,
        title: '  Source analysis  ',
        prompt,
        instructions: 'Use two arguments.',
        explanation: privateExplanation,
        publicConfig: validWrittenConfig(),
        gradingConfig: { mode: 'MANUAL' },
        defaultMaxPoints: 8.25,
        defaultPassingPercent: 70,
      })
      .expect(200);
    const updateBody = getResponseBody(updateResponse);
    const updatedDraft = getRecordField(updateBody, 'draftRevision');
    expect(updateBody).toEqual(
      expect.objectContaining({
        defaultMaxPoints: 8.25,
        defaultPassingPercent: 70,
      }),
    );
    expect(updatedDraft).toEqual(
      expect.objectContaining({
        title: 'Source analysis',
        prompt,
        explanation: privateExplanation,
        editVersion: 2,
      }),
    );

    await request(context.app.getHttpServer())
      .patch(`/assignments/${assignmentId}/draft`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: revisionId,
        expectedEditVersion: 2,
        title: null,
      })
      .expect(400);

    await request(context.app.getHttpServer())
      .patch(`/assignments/${assignmentId}/draft`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: revisionId,
        expectedEditVersion: 1,
        prompt: 'Stale overwrite',
      })
      .expect(409)
      .expect((response) => {
        expect(getResponseBody(response)).toEqual(
          expect.objectContaining({
            code: 'ASSIGNMENT_DRAFT_VERSION_CONFLICT',
            currentEditVersion: 2,
          }),
        );
      });

    await request(context.app.getHttpServer())
      .get(`/assignments/${assignmentId}`)
      .set('Authorization', bearer('teacher'))
      .expect(200)
      .expect((response) => {
        const currentDraft = getRecordField(
          getResponseBody(response),
          'draftRevision',
        );
        expect(currentDraft.prompt).toBe(prompt);
        expect(currentDraft.editVersion).toBe(2);
      });

    const previewResponse = await request(context.app.getHttpServer())
      .get(`/assignments/${assignmentId}/preview`)
      .query({ source: 'DRAFT' })
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const preview = getResponseBody(previewResponse);
    expect(preview).toEqual(
      expect.objectContaining({
        assignmentId,
        source: 'DRAFT',
        title: 'Source analysis',
        prompt,
        publicConfig: validWrittenConfig(),
        defaultMaxPoints: 8.25,
      }),
    );
    expect(preview).not.toHaveProperty('gradingConfig');
    expect(preview).not.toHaveProperty('solution');
    expect(preview).not.toHaveProperty('explanation');
    expect(JSON.stringify(preview)).not.toContain(privateExplanation);

    await request(context.app.getHttpServer())
      .get(`/assignments/${assignmentId}/preview`)
      .set('Authorization', bearer('otherTeacher'))
      .expect(404)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('ASSIGNMENT_NOT_FOUND');
      });
  });

  it('publishes immutable revisions and starts an idempotent next draft', async () => {
    const createResponse = await createAssignment('teacher');
    lifecycleAssignmentId = getStringField(createResponse, 'id');
    const firstRevisionId = getStringValue(
      getRecordField(getResponseBody(createResponse), 'draftRevision'),
      'id',
    );

    await request(context.app.getHttpServer())
      .post(`/assignments/${lifecycleAssignmentId}/publish`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: firstRevisionId,
        expectedEditVersion: 1,
      })
      .expect(409)
      .expect((response) => {
        const body = getResponseBody(response);
        expect(body.code).toBe('ASSIGNMENT_INCOMPLETE');
        expect(body.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ path: ['title'] }),
            expect.objectContaining({ path: ['prompt'] }),
          ]),
        );
      });

    const firstTitle = `Published essay ${stamp}`;
    const updateResponse = await updateCompleteDraft(
      lifecycleAssignmentId,
      firstRevisionId,
      1,
      firstTitle,
    );
    expect(
      getNumberField(
        getRecordField(getResponseBody(updateResponse), 'draftRevision'),
        'editVersion',
      ),
    ).toBe(2);

    const firstPublishResponse = await request(context.app.getHttpServer())
      .post(`/assignments/${lifecycleAssignmentId}/publish`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: firstRevisionId,
        expectedEditVersion: 2,
      })
      .expect(200);
    const firstPublishBody = getResponseBody(firstPublishResponse);
    const firstPublished = getRecordField(
      firstPublishBody,
      'publishedRevision',
    );
    expect(firstPublishBody).toEqual(
      expect.objectContaining({
        status: AssignmentStatus.PUBLISHED,
        draftRevision: null,
      }),
    );
    expect(firstPublished).toEqual(
      expect.objectContaining({
        version: 1,
        status: 'PUBLISHED',
        title: firstTitle,
      }),
    );

    await request(context.app.getHttpServer())
      .post(`/assignments/${lifecycleAssignmentId}/publish`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: firstRevisionId,
        expectedEditVersion: 2,
      })
      .expect(200)
      .expect((response) => {
        const published = getRecordField(
          getResponseBody(response),
          'publishedRevision',
        );
        expect(published.id).toBe(firstRevisionId);
      });

    await request(context.app.getHttpServer())
      .patch(`/assignments/${lifecycleAssignmentId}/draft`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: firstRevisionId,
        expectedEditVersion: 2,
        title: 'Illegal mutation',
      })
      .expect(404)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe(
          'ASSIGNMENT_DRAFT_NOT_FOUND',
        );
      });

    const startEditResponse = await request(context.app.getHttpServer())
      .post(`/assignments/${lifecycleAssignmentId}/start-edit`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const startedDraft = getRecordField(
      getResponseBody(startEditResponse),
      'draftRevision',
    );
    expect(startedDraft).toEqual(
      expect.objectContaining({
        version: 2,
        editVersion: 1,
        title: firstTitle,
      }),
    );
    const secondRevisionId = getStringValue(startedDraft, 'id');

    await request(context.app.getHttpServer())
      .post(`/assignments/${lifecycleAssignmentId}/start-edit`)
      .set('Authorization', bearer('teacher'))
      .expect(200)
      .expect((response) => {
        const sameDraft = getRecordField(
          getResponseBody(response),
          'draftRevision',
        );
        expect(sameDraft.id).toBe(startedDraft.id);
      });

    await request(context.app.getHttpServer())
      .patch(`/assignments/${lifecycleAssignmentId}/draft`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: firstRevisionId,
        expectedEditVersion: 1,
        title: 'Stale revision overwrite',
      })
      .expect(409)
      .expect((response) => {
        expect(getResponseBody(response)).toEqual(
          expect.objectContaining({
            code: 'ASSIGNMENT_DRAFT_VERSION_CONFLICT',
            currentRevisionId: secondRevisionId,
            currentEditVersion: 1,
          }),
        );
      });

    const secondTitle = `Revised essay ${stamp}`;
    await request(context.app.getHttpServer())
      .patch(`/assignments/${lifecycleAssignmentId}/draft`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: secondRevisionId,
        expectedEditVersion: 1,
        title: secondTitle,
        explanation: 'A private second-version explanation',
      })
      .expect(200);

    await expectPreviewTitle(lifecycleAssignmentId, 'DRAFT', secondTitle);
    await expectPreviewTitle(lifecycleAssignmentId, 'PUBLISHED', firstTitle);

    const secondPublishResponse = await request(context.app.getHttpServer())
      .post(`/assignments/${lifecycleAssignmentId}/publish`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: secondRevisionId,
        expectedEditVersion: 2,
      })
      .expect(200);
    const secondPublished = getRecordField(
      getResponseBody(secondPublishResponse),
      'publishedRevision',
    );
    expect(secondPublished).toEqual(
      expect.objectContaining({
        version: 2,
        status: 'PUBLISHED',
        title: secondTitle,
      }),
    );

    await request(context.app.getHttpServer())
      .post(`/assignments/${lifecycleAssignmentId}/publish`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: firstRevisionId,
        expectedEditVersion: 2,
      })
      .expect(409)
      .expect((response) => {
        expect(getResponseBody(response)).toEqual(
          expect.objectContaining({
            code: 'ASSIGNMENT_DRAFT_VERSION_CONFLICT',
            currentRevisionId: secondRevisionId,
            currentEditVersion: 2,
          }),
        );
      });

    const historyResponse = await request(context.app.getHttpServer())
      .get(`/assignments/${lifecycleAssignmentId}/revisions`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const history = getResponseRecordArray(historyResponse);
    expect(history).toEqual([
      expect.objectContaining({
        id: secondPublished.id,
        version: 2,
        status: 'PUBLISHED',
        title: secondTitle,
      }),
      expect.objectContaining({
        id: firstPublished.id,
        version: 1,
        status: 'ARCHIVED',
        title: firstTitle,
      }),
    ]);

    await request(context.app.getHttpServer())
      .delete(
        `/assignments/${lifecycleAssignmentId}/revisions/${String(secondPublished.id)}`,
      )
      .set('Authorization', bearer('teacher'))
      .expect(409)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe(
          'ASSIGNMENT_PUBLISHED_REVISION_IMMUTABLE',
        );
      });

    await request(context.app.getHttpServer())
      .delete(
        `/assignments/${lifecycleAssignmentId}/revisions/${String(firstPublished.id)}`,
      )
      .set('Authorization', bearer('teacher'))
      .expect(204);
  });

  it('duplicates published content, archives/restores, and hard-deletes an unused draft', async () => {
    const duplicateResponse = await request(context.app.getHttpServer())
      .post(`/assignments/${lifecycleAssignmentId}/duplicate`)
      .set('Authorization', bearer('teacher'))
      .expect(201);
    const duplicateBody = getResponseBody(duplicateResponse);
    const duplicateId = getStringField(duplicateResponse, 'id');
    const duplicateDraft = getRecordField(duplicateBody, 'draftRevision');
    expect(duplicateId).not.toBe(lifecycleAssignmentId);
    expect(duplicateBody).toEqual(
      expect.objectContaining({
        status: AssignmentStatus.DRAFT,
        publishedRevision: null,
      }),
    );
    expect(duplicateDraft).toEqual(
      expect.objectContaining({
        version: 1,
        editVersion: 1,
        title: `Revised essay ${stamp}`,
        gradingConfig: { mode: 'MANUAL' },
      }),
    );

    await request(context.app.getHttpServer())
      .post(`/assignments/${lifecycleAssignmentId}/archive`)
      .set('Authorization', bearer('teacher'))
      .expect(200)
      .expect((response) => {
        const body = getResponseBody(response);
        expect(body.status).toBe(AssignmentStatus.ARCHIVED);
        expect(typeof body.archivedAt).toBe('string');
      });

    await request(context.app.getHttpServer())
      .post(`/assignments/${lifecycleAssignmentId}/start-edit`)
      .set('Authorization', bearer('teacher'))
      .expect(409)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('ASSIGNMENT_ARCHIVED');
      });

    await request(context.app.getHttpServer())
      .post(`/assignments/${lifecycleAssignmentId}/restore`)
      .set('Authorization', bearer('teacher'))
      .expect(200)
      .expect((response) => {
        const body = getResponseBody(response);
        expect(body.status).toBe(AssignmentStatus.PUBLISHED);
        expect(body.archivedAt).toBeNull();
      });

    await request(context.app.getHttpServer())
      .post(`/assignments/${lifecycleAssignmentId}/restore`)
      .set('Authorization', bearer('teacher'))
      .expect(409)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe(
          'ASSIGNMENT_NOT_ARCHIVED',
        );
      });

    await request(context.app.getHttpServer())
      .delete(`/assignments/${duplicateId}`)
      .set('Authorization', bearer('teacher'))
      .expect(204);

    await request(context.app.getHttpServer())
      .get(`/assignments/${duplicateId}`)
      .set('Authorization', bearer('teacher'))
      .expect(404);
  });

  it('filters the private library and traverses a stable cursor', async () => {
    const prefix = `Cursor library ${stamp}`;
    const firstId = await createCompleteDraft(`${prefix} Alpha`, Locale.UK);
    const secondId = await createCompleteDraft(`${prefix} Beta`, Locale.UK);
    const archivedId = await createCompleteDraft(
      `${prefix} Archived`,
      Locale.UK,
    );

    await request(context.app.getHttpServer())
      .post(`/assignments/${archivedId}/archive`)
      .set('Authorization', bearer('teacher'))
      .expect(200);

    const firstPageResponse = await request(context.app.getHttpServer())
      .get('/assignments')
      .query({
        limit: 1,
        search: prefix.toLocaleLowerCase(),
        status: AssignmentStatus.DRAFT,
        type: AssignmentType.WRITTEN,
        contentLocale: Locale.UK,
      })
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const firstPage = getResponseBody(firstPageResponse);
    const firstPageItems = getRecordArrayField(firstPage, 'items');
    const nextCursor = getStringValue(firstPage, 'nextCursor');
    expect(firstPageItems).toHaveLength(1);

    const secondPageResponse = await request(context.app.getHttpServer())
      .get('/assignments')
      .query({
        cursor: nextCursor,
        limit: 1,
        search: prefix,
        status: AssignmentStatus.DRAFT,
        type: AssignmentType.WRITTEN,
        contentLocale: Locale.UK,
      })
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const secondPage = getResponseBody(secondPageResponse);
    const secondPageItems = getRecordArrayField(secondPage, 'items');
    expect(secondPageItems).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
    expect(
      [...firstPageItems, ...secondPageItems]
        .map((item) => getStringValue(item, 'id'))
        .sort(),
    ).toEqual([firstId, secondId].sort());

    await request(context.app.getHttpServer())
      .get('/assignments')
      .query({
        search: prefix,
        status: AssignmentStatus.ARCHIVED,
        contentLocale: Locale.UK,
      })
      .set('Authorization', bearer('teacher'))
      .expect(200)
      .expect((response) => {
        const items = getRecordArrayField(getResponseBody(response), 'items');
        expect(items.map((item) => item.id)).toEqual([archivedId]);
      });

    await request(context.app.getHttpServer())
      .get('/assignments')
      .query({ search: prefix, contentLocale: Locale.EN })
      .set('Authorization', bearer('teacher'))
      .expect(200)
      .expect((response) => {
        expect(getRecordArrayField(getResponseBody(response), 'items')).toEqual(
          [],
        );
      });

    const foreignAssignmentResponse = await createAssignment('otherTeacher');
    const foreignAssignmentId = getStringField(foreignAssignmentResponse, 'id');
    await request(context.app.getHttpServer())
      .get('/assignments')
      .query({ cursor: foreignAssignmentId })
      .set('Authorization', bearer('teacher'))
      .expect(400)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe(
          'INVALID_ASSIGNMENT_CURSOR',
        );
      });

    await request(context.app.getHttpServer())
      .get('/assignments')
      .set('Authorization', bearer('student'))
      .expect(403)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('ROLE_FORBIDDEN');
      });
  });

  async function createUser(
    actor: keyof typeof emails,
    role: UserRole,
    preferredLocale: Locale,
  ): Promise<void> {
    const user = await context.prisma.user.create({
      data: {
        email: emails[actor],
        role,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            displayName: actor,
            preferredLocale,
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
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      },
    );
    userIds[actor] = user.id;
  }

  function bearer(actor: keyof typeof tokens): string {
    return `Bearer ${tokens[actor]}`;
  }

  function createAssignment(
    actor: 'teacher' | 'otherTeacher',
    overrides: Record<string, unknown> = {},
  ): Promise<request.Response> {
    return request(context.app.getHttpServer())
      .post('/assignments')
      .set('Authorization', bearer(actor))
      .send({ type: AssignmentType.WRITTEN, ...overrides })
      .expect(201);
  }

  function updateCompleteDraft(
    assignmentId: string,
    expectedRevisionId: string,
    expectedEditVersion: number,
    title: string,
  ): Promise<request.Response> {
    return request(context.app.getHttpServer())
      .patch(`/assignments/${assignmentId}/draft`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId,
        expectedEditVersion,
        title,
        prompt: `Prompt for ${title}`,
        instructions: 'Write a structured response.',
        publicConfig: validWrittenConfig(),
        gradingConfig: { mode: 'MANUAL' },
      })
      .expect(200);
  }

  async function createCompleteDraft(
    title: string,
    contentLocale: Locale,
  ): Promise<string> {
    const createResponse = await createAssignment('teacher', {
      contentLocale,
    });
    const assignmentId = getStringField(createResponse, 'id');
    const revisionId = getStringValue(
      getRecordField(getResponseBody(createResponse), 'draftRevision'),
      'id',
    );
    await updateCompleteDraft(assignmentId, revisionId, 1, title);
    return assignmentId;
  }

  async function expectPreviewTitle(
    assignmentId: string,
    source: 'DRAFT' | 'PUBLISHED',
    title: string,
  ): Promise<void> {
    await request(context.app.getHttpServer())
      .get(`/assignments/${assignmentId}/preview`)
      .query({ source })
      .set('Authorization', bearer('teacher'))
      .expect(200)
      .expect((response) => {
        const body = getResponseBody(response);
        expect(body).toEqual(expect.objectContaining({ source, title }));
        expect(body).not.toHaveProperty('gradingConfig');
        expect(body).not.toHaveProperty('explanation');
      });
  }
});

function validWrittenConfig(): Record<string, unknown> {
  return {
    responseMode: 'LONG',
    minLength: 0,
    maxLength: 20_000,
    allowAttachments: false,
    rubric: [],
  };
}

function defaultWrittenConfig(): Record<string, unknown> {
  return {
    responseMode: 'LONG',
    minLength: 0,
    maxLength: 5_000,
    allowAttachments: false,
    rubric: [],
  };
}

function getResponseRecordArray(
  response: request.Response,
): Record<string, unknown>[] {
  const body: unknown = response.body;
  if (!Array.isArray(body) || !body.every(isRecord)) {
    throw new Error('Expected an array of response objects');
  }
  return body;
}

function getRecordField(
  record: Record<string, unknown>,
  field: string,
): Record<string, unknown> {
  const value = record[field];
  if (!isRecord(value)) {
    throw new Error(`Expected ${field} to be an object`);
  }
  return value;
}

function getRecordArrayField(
  record: Record<string, unknown>,
  field: string,
): Record<string, unknown>[] {
  const value = record[field];
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error(`Expected ${field} to be an array of objects`);
  }
  return value;
}

function getStringValue(
  record: Record<string, unknown>,
  field: string,
): string {
  const value = record[field];
  if (typeof value !== 'string') {
    throw new Error(`Expected ${field} to be a string`);
  }
  return value;
}

function getNumberField(
  record: Record<string, unknown>,
  field: string,
): number {
  const value = record[field];
  if (typeof value !== 'number') {
    throw new Error(`Expected ${field} to be a number`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
