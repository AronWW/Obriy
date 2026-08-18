import { JwtService } from '@nestjs/jwt';
import {
  AssignmentType,
  LessonStatus,
  Locale,
  TestAnswerStatus,
  TestAttemptStatus,
  TestStudentStatus,
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

jest.setTimeout(40_000);

describe('Tests module (e2e)', () => {
  let context: AuthTestContext;
  let jwtService: JwtService;
  const stamp = Date.now();
  const emails = {
    teacher: `tests.teacher.${stamp}@example.com`,
    student: `tests.student.${stamp}@example.com`,
  };
  const tokens = { teacher: '', student: '' };
  let teacherId = '';
  let studentId = '';
  let classId = '';
  let lessonId = '';

  const optionA = '123e4567-e89b-42d3-a456-426614174000';
  const optionB = '223e4567-e89b-42d3-a456-426614174000';
  const optionC = '323e4567-e89b-42d3-a456-426614174000';
  const optionD = '423e4567-e89b-42d3-a456-426614174000';

  beforeAll(async () => {
    context = await createAuthTestContext();
    jwtService = context.app.get(JwtService);
    teacherId = await createUser('teacher', UserRole.TEACHER);
    studentId = await createUser('student', UserRole.STUDENT);
    const classroom = await context.prisma.class.create({
      data: {
        teacherId,
        name: 'Test class',
        inviteCode: `T${String(stamp).slice(-8)}`,
      },
    });
    classId = classroom.id;
    await context.prisma.user.update({
      where: { id: studentId },
      data: { studentClassId: classId },
    });
    const lesson = await context.prisma.lesson.create({
      data: {
        teacherId,
        title: 'Test lesson',
        summary: 'Lesson with one complete test.',
        content: '<p>Read before answering.</p>',
        contentLocale: Locale.UK,
        status: LessonStatus.DRAFT,
      },
    });
    lessonId = lesson.id;
  });

  afterAll(async () => {
    await context.prisma.testRelease.deleteMany({
      where: { test: { teacherId } },
    });
    await context.prisma.lessonTest.deleteMany({
      where: { test: { teacherId } },
    });
    await context.prisma.test.deleteMany({ where: { teacherId } });
    await closeAuthTestContext(context, Object.values(emails));
  });

  it('runs a mixed whole-test attempt with objective and manual grading', async () => {
    const singleAssignmentId = await createAssignment({
      type: AssignmentType.SINGLE_CHOICE,
      maxPoints: 5,
      title: 'Single answer',
      publicConfig: choiceConfig(),
      gradingConfig: {
        correctOptionIds: [optionA],
        scoringMode: 'ALL_OR_NOTHING',
      },
    });
    const multipleAssignmentId = await createAssignment({
      type: AssignmentType.MULTIPLE_CHOICE,
      maxPoints: 6,
      title: 'Several answers',
      publicConfig: choiceConfig(),
      gradingConfig: {
        correctOptionIds: [optionA, optionB, optionC],
        scoringMode: 'PARTIAL',
      },
    });
    const writtenAssignmentId = await createAssignment({
      type: AssignmentType.WRITTEN,
      maxPoints: 4,
      title: 'Written answer',
      publicConfig: {
        responseMode: 'LONG',
        minLength: 0,
        maxLength: 5_000,
        allowAttachments: true,
        rubric: [],
      },
      gradingConfig: { mode: 'MANUAL' },
    });
    const englishAssignmentId = await createAssignment({
      type: AssignmentType.WRITTEN,
      maxPoints: 1,
      title: 'English-only question',
      contentLocale: Locale.EN,
      publicConfig: {
        responseMode: 'LONG',
        minLength: 0,
        maxLength: 5_000,
        allowAttachments: true,
        rubric: [],
      },
      gradingConfig: { mode: 'MANUAL' },
    });

    const testResponse = await request(context.app.getHttpServer())
      .post('/tests')
      .set('Authorization', bearer('teacher'))
      .send({
        contentLocale: Locale.UK,
        title: 'Mixed knowledge check',
        description: 'Three independently authored questions.',
        instructions: 'Complete the whole test before submitting.',
        passingPercent: 40,
        maxAttempts: 3,
        timeLimitSeconds: 300,
        scorePolicy: 'BEST',
        shuffleItems: false,
      })
      .expect(201);
    const testId = getStringField(testResponse, 'id');
    let draft = getRecordField(getResponseBody(testResponse), 'draftRevision');
    expect(draft).toEqual(
      expect.objectContaining({
        instructions: 'Complete the whole test before submitting.',
        passingPercent: 40,
        maxAttempts: 3,
        timeLimitSeconds: 300,
        scorePolicy: 'BEST',
        shuffleItems: false,
      }),
    );
    const wrongAssignmentResponse = await request(context.app.getHttpServer())
      .post(`/tests/${testId}/draft/items`)
      .set('Authorization', bearer('teacher'))
      .send({
        assignmentId: englishAssignmentId,
        expectedRevisionId: getStringValue(draft, 'id'),
        expectedEditVersion: getNumberValue(draft, 'editVersion'),
      })
      .expect(409);
    expect(getResponseBody(wrongAssignmentResponse)).toEqual(
      expect.objectContaining({ code: 'ASSIGNMENT_CONTENT_LOCALE_MISMATCH' }),
    );
    const untouchedEnglishAssignment = await request(
      context.app.getHttpServer(),
    )
      .get(`/assignments/${englishAssignmentId}`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    expect(getResponseBody(untouchedEnglishAssignment)).toEqual(
      expect.objectContaining({
        status: 'DRAFT',
        publishedRevision: null,
      }),
    );

    const englishTestResponse = await request(context.app.getHttpServer())
      .post('/tests')
      .set('Authorization', bearer('teacher'))
      .send({ contentLocale: Locale.EN, title: 'English test' })
      .expect(201);
    const englishTestId = getStringField(englishTestResponse, 'id');
    const wrongTestResponse = await request(context.app.getHttpServer())
      .post(`/lessons/${lessonId}/tests`)
      .set('Authorization', bearer('teacher'))
      .send({ testId: englishTestId })
      .expect(409);
    expect(getResponseBody(wrongTestResponse)).toEqual(
      expect.objectContaining({ code: 'TEST_CONTENT_LOCALE_MISMATCH' }),
    );

    for (const assignmentId of [
      singleAssignmentId,
      multipleAssignmentId,
      writtenAssignmentId,
    ]) {
      const addResponse = await request(context.app.getHttpServer())
        .post(`/tests/${testId}/draft/items`)
        .set('Authorization', bearer('teacher'))
        .send({
          assignmentId,
          expectedRevisionId: getStringValue(draft, 'id'),
          expectedEditVersion: getNumberValue(draft, 'editVersion'),
        })
        .expect((response) => {
          if (response.status !== 201) {
            throw new Error(
              `Expected assignment ${assignmentId} to be added, received ${response.status}: ${JSON.stringify(response.body)}`,
            );
          }
        });
      draft = getRecordField(getResponseBody(addResponse), 'draftRevision');
    }
    const items = getRecordArray(draft, 'items');
    const itemsByAssignment = new Map(
      items.map(
        (item) => [getStringValue(item, 'assignmentId'), item] as const,
      ),
    );
    const reorderResponse = await request(context.app.getHttpServer())
      .put(`/tests/${testId}/draft/items/order`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: getStringValue(draft, 'id'),
        expectedEditVersion: getNumberValue(draft, 'editVersion'),
        itemIds: [
          getStringValue(itemsByAssignment.get(writtenAssignmentId)!, 'id'),
          getStringValue(itemsByAssignment.get(singleAssignmentId)!, 'id'),
          getStringValue(itemsByAssignment.get(multipleAssignmentId)!, 'id'),
        ],
      })
      .expect(200);
    draft = getRecordField(getResponseBody(reorderResponse), 'draftRevision');
    const settingsResponse = await request(context.app.getHttpServer())
      .patch(`/tests/${testId}/draft`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: getStringValue(draft, 'id'),
        expectedEditVersion: getNumberValue(draft, 'editVersion'),
        passingPercent: 50,
        maxAttempts: 1,
      })
      .expect(200);
    draft = getRecordField(getResponseBody(settingsResponse), 'draftRevision');
    await request(context.app.getHttpServer())
      .post(`/tests/${testId}/publish`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: getStringValue(draft, 'id'),
        expectedEditVersion: getNumberValue(draft, 'editVersion'),
      })
      .expect(200);

    const libraryResponse = await request(context.app.getHttpServer())
      .get('/tests?search=Mixed&limit=1&contentLocale=UK')
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const libraryItem = getRecordArray(
      getResponseBody(libraryResponse),
      'items',
    )[0];
    if (!libraryItem) throw new Error('Expected test library summary');
    const publishedSummary = getRecordField(libraryItem, 'publishedRevision');
    expect(publishedSummary).toEqual(
      expect.objectContaining({ itemCount: 3, totalMaxPoints: 15 }),
    );
    expect(publishedSummary).not.toHaveProperty('items');

    await request(context.app.getHttpServer())
      .post(`/lessons/${lessonId}/tests`)
      .set('Authorization', bearer('teacher'))
      .send({ testId })
      .expect(201);
    await request(context.app.getHttpServer())
      .put(`/classes/${classId}/lessons/${lessonId}`)
      .set('Authorization', bearer('teacher'))
      .send({ published: true })
      .expect(200);

    const studentListResponse = await request(context.app.getHttpServer())
      .get(`/classes/me/lessons/${lessonId}/tests`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const studentTests = getResponseArray(studentListResponse);
    expect(studentTests).toHaveLength(1);
    expect(JSON.stringify(studentTests)).not.toContain('correctOptionIds');
    expect(JSON.stringify(studentTests)).not.toContain('gradingConfig');
    const studentTest = studentTests[0];
    const releaseId = getStringValue(studentTest, 'releaseId');
    expect(getRecordArray(studentTest, 'items')).toHaveLength(0);
    expect(studentTest).toEqual(expect.objectContaining({ itemCount: 3 }));

    const attemptResponse = await request(context.app.getHttpServer())
      .post(`/test-releases/${releaseId}/attempts`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const attemptId = getStringField(attemptResponse, 'id');
    await request(context.app.getHttpServer())
      .post(`/tests/${testId}/start-edit`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const blockedVersionResponse = await request(context.app.getHttpServer())
      .post(`/lessons/${lessonId}/tests/${testId}/update-version`)
      .set('Authorization', bearer('teacher'))
      .expect(409);
    expect(getResponseBody(blockedVersionResponse)).toEqual(
      expect.objectContaining({ code: 'TEST_RELEASE_HAS_OPEN_ATTEMPTS' }),
    );
    const activeTestResponse = await request(context.app.getHttpServer())
      .get(`/test-releases/${releaseId}`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const studentItems = getRecordArray(
      getResponseBody(activeTestResponse),
      'items',
    );
    expect(studentItems.map((item) => getStringValue(item, 'type'))).toEqual([
      AssignmentType.WRITTEN,
      AssignmentType.SINGLE_CHOICE,
      AssignmentType.MULTIPLE_CHOICE,
    ]);
    const itemByType = new Map(
      studentItems.map((item) => [getStringValue(item, 'type'), item] as const),
    );
    await saveAnswer(
      attemptId,
      getStringValue(itemByType.get(AssignmentType.WRITTEN)!, 'id'),
      { text: 'A reasoned response.', attachmentIds: [] },
    );
    await saveAnswer(
      attemptId,
      getStringValue(itemByType.get(AssignmentType.SINGLE_CHOICE)!, 'id'),
      { selectedOptionIds: [optionA] },
    );
    await saveAnswer(
      attemptId,
      getStringValue(itemByType.get(AssignmentType.MULTIPLE_CHOICE)!, 'id'),
      { selectedOptionIds: [optionA, optionB, optionD] },
    );

    const submitResponse = await request(context.app.getHttpServer())
      .post(`/test-attempts/${attemptId}/submit`)
      .set('Authorization', bearer('student'))
      .expect(200);
    expect(getResponseBody(submitResponse)).toEqual(
      expect.objectContaining({
        status: TestAttemptStatus.AWAITING_REVIEW,
        pendingReviewCount: 1,
        scorePoints: null,
      }),
    );

    const reviewsResponse = await request(context.app.getHttpServer())
      .get(`/lessons/${lessonId}/test-attempts`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const reviews = getRecordArray(getResponseBody(reviewsResponse), 'items');
    expect(reviews).toHaveLength(1);
    const writtenAnswer = getRecordArray(reviews[0], 'answers').find(
      (answer) => getStringValue(answer, 'type') === AssignmentType.WRITTEN,
    );
    const multipleAnswer = getRecordArray(reviews[0], 'answers').find(
      (answer) =>
        getStringValue(answer, 'type') === AssignmentType.MULTIPLE_CHOICE,
    );
    if (!writtenAnswer) {
      throw new Error('Expected written answer in review');
    }
    if (!multipleAnswer) {
      throw new Error('Expected multiple-choice answer in review');
    }
    expect(getRecordArray(multipleAnswer, 'choiceOptions')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: optionA, selected: true, correct: true }),
        expect.objectContaining({
          id: optionD,
          selected: true,
          correct: false,
        }),
      ]),
    );

    const returnedResponse = await request(context.app.getHttpServer())
      .patch(
        `/test-answers/${getStringValue(writtenAnswer, 'answerId')}/review`,
      )
      .set('Authorization', bearer('teacher'))
      .send({ decision: 'RETURNED', teacherComment: 'Please add evidence.' })
      .expect(200);
    expect(getResponseBody(returnedResponse)).toEqual(
      expect.objectContaining({
        status: TestAttemptStatus.RETURNED,
        pendingReviewCount: 0,
      }),
    );

    // A returned attempt is a correction cycle, not a consumed attempt. This
    // remains retryable even though the test allows only one scored attempt.
    const retryResponse = await request(context.app.getHttpServer())
      .post(`/test-releases/${releaseId}/attempts`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const retryAttemptId = getStringField(retryResponse, 'id');
    expect(getResponseBody(retryResponse)).toEqual(
      expect.objectContaining({ attemptNumber: 2, status: 'IN_PROGRESS' }),
    );
    await saveAnswer(
      retryAttemptId,
      getStringValue(itemByType.get(AssignmentType.WRITTEN)!, 'id'),
      { text: 'A revised response with evidence.', attachmentIds: [] },
    );
    await saveAnswer(
      retryAttemptId,
      getStringValue(itemByType.get(AssignmentType.SINGLE_CHOICE)!, 'id'),
      { selectedOptionIds: [optionA] },
    );
    await saveAnswer(
      retryAttemptId,
      getStringValue(itemByType.get(AssignmentType.MULTIPLE_CHOICE)!, 'id'),
      { selectedOptionIds: [optionA, optionB, optionD] },
    );
    await request(context.app.getHttpServer())
      .post(`/test-attempts/${retryAttemptId}/submit`)
      .set('Authorization', bearer('student'))
      .expect(200);

    const retryReviewsResponse = await request(context.app.getHttpServer())
      .get(`/lessons/${lessonId}/test-attempts`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const retryReview = getRecordArray(
      getResponseBody(retryReviewsResponse),
      'items',
    ).find(
      (review) =>
        getStringValue(review, 'status') === TestAttemptStatus.AWAITING_REVIEW,
    );
    if (!retryReview) throw new Error('Expected retry awaiting review');
    const retryWrittenAnswer = getRecordArray(retryReview, 'answers').find(
      (answer) => getStringValue(answer, 'type') === AssignmentType.WRITTEN,
    );
    if (!retryWrittenAnswer) throw new Error('Expected retry written answer');
    const reviewResponse = await request(context.app.getHttpServer())
      .patch(
        `/test-answers/${getStringValue(retryWrittenAnswer, 'answerId')}/review`,
      )
      .set('Authorization', bearer('teacher'))
      .send({ decision: 'APPROVED', scorePoints: 4 })
      .expect(200);
    expect(getResponseBody(reviewResponse)).toEqual(
      expect.objectContaining({
        status: TestAttemptStatus.GRADED,
        pendingReviewCount: 0,
        scorePoints: 9,
        scorePercent: 60,
        isPassed: true,
      }),
    );

    const resultResponse = await request(context.app.getHttpServer())
      .get(`/test-releases/${releaseId}`)
      .set('Authorization', bearer('student'))
      .expect(200);
    expect(getResponseBody(resultResponse)).toEqual(
      expect.objectContaining({ stateStatus: TestStudentStatus.COMPLETED }),
    );
    expect(JSON.stringify(resultResponse.body)).not.toContain(
      'correctOptionIds',
    );

    // Expiration is persisted and no longer leaves the learner stuck on the
    // same IN_PROGRESS row. Returned attempts do not count against this cap.
    await context.prisma.testRelease.update({
      where: { id: releaseId },
      data: { maxAttempts: 3 },
    });
    const expiringResponse = await request(context.app.getHttpServer())
      .post(`/test-releases/${releaseId}/attempts`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const expiringAttemptId = getStringField(expiringResponse, 'id');
    const now = Date.now();
    await context.prisma.testAttempt.update({
      where: { id: expiringAttemptId },
      data: {
        startedAt: new Date(now - 120_000),
        expiresAt: new Date(now - 60_000),
      },
    });
    const afterExpiryResponse = await request(context.app.getHttpServer())
      .post(`/test-releases/${releaseId}/attempts`)
      .set('Authorization', bearer('student'))
      .expect(200);
    expect(getResponseBody(afterExpiryResponse)).toEqual(
      expect.objectContaining({ attemptNumber: 4, status: 'IN_PROGRESS' }),
    );
    expect(
      await context.prisma.testAttempt.findUniqueOrThrow({
        where: { id: expiringAttemptId },
        select: { status: true },
      }),
    ).toEqual({ status: TestAttemptStatus.EXPIRED });

    const activeRetakeId = getStringField(afterExpiryResponse, 'id');
    await context.prisma.user.update({
      where: { id: studentId },
      data: { studentClassId: null },
    });
    await request(context.app.getHttpServer())
      .put(
        `/test-attempts/${activeRetakeId}/answers/${getStringValue(itemByType.get(AssignmentType.WRITTEN)!, 'id')}`,
      )
      .set('Authorization', bearer('student'))
      .send({ responseData: { text: 'No longer a class member.' } })
      .expect(404);
    await context.prisma.user.update({
      where: { id: studentId },
      data: { studentClassId: classId },
    });

    const writtenItemId = getStringValue(
      itemByType.get(AssignmentType.WRITTEN)!,
      'id',
    );
    await saveAnswer(activeRetakeId, writtenItemId, {
      text: 'Original answer before submit.',
      attachmentIds: [],
    });
    await saveAnswer(
      activeRetakeId,
      getStringValue(itemByType.get(AssignmentType.SINGLE_CHOICE)!, 'id'),
      { selectedOptionIds: [optionA] },
    );
    await saveAnswer(
      activeRetakeId,
      getStringValue(itemByType.get(AssignmentType.MULTIPLE_CHOICE)!, 'id'),
      { selectedOptionIds: [optionA] },
    );
    const [lateSaveResponse, concurrentSubmitResponse] = await Promise.all([
      request(context.app.getHttpServer())
        .put(`/test-attempts/${activeRetakeId}/answers/${writtenItemId}`)
        .set('Authorization', bearer('student'))
        .send({
          responseData: {
            text: 'Concurrent answer at submit.',
            attachmentIds: [],
          },
        }),
      request(context.app.getHttpServer())
        .post(`/test-attempts/${activeRetakeId}/submit`)
        .set('Authorization', bearer('student')),
    ]);
    expect(concurrentSubmitResponse.status).toBe(200);
    expect([200, 409]).toContain(lateSaveResponse.status);
    const storedConcurrentAnswer =
      await context.prisma.testAnswer.findUniqueOrThrow({
        where: {
          testAttemptId_testItemId: {
            testAttemptId: activeRetakeId,
            testItemId: writtenItemId,
          },
        },
        select: { responseData: true, status: true },
      });
    expect(storedConcurrentAnswer.status).toBe(
      TestAnswerStatus.AWAITING_REVIEW,
    );
    expect(storedConcurrentAnswer.responseData).toEqual(
      lateSaveResponse.status === 200
        ? { text: 'Concurrent answer at submit.', attachmentIds: [] }
        : { text: 'Original answer before submit.', attachmentIds: [] },
    );

    await context.prisma.testRelease.update({
      where: { id: releaseId },
      data: { status: 'ARCHIVED', closedAt: new Date() },
    });
    const scheduledRelease = await context.prisma.testRelease.create({
      data: {
        testId,
        testRevisionId: getStringValue(studentTest, 'testRevisionId'),
        classId,
        lessonId,
        status: 'SCHEDULED',
        maxPoints: 15,
        passingPercent: 50,
        maxAttempts: 1,
        scorePolicy: 'BEST',
        availableFrom: new Date(Date.now() + 3_600_000),
      },
    });
    await request(context.app.getHttpServer())
      .get(`/test-releases/${scheduledRelease.id}`)
      .set('Authorization', bearer('student'))
      .expect(404);
  });

  async function createUser(
    actor: keyof typeof tokens,
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

  async function createAssignment(input: {
    type: AssignmentType;
    maxPoints: number;
    title: string;
    publicConfig: Record<string, unknown>;
    gradingConfig: Record<string, unknown>;
    contentLocale?: Locale;
  }): Promise<string> {
    const response = await request(context.app.getHttpServer())
      .post('/assignments')
      .set('Authorization', bearer('teacher'))
      .send({
        type: input.type,
        contentLocale: input.contentLocale ?? Locale.UK,
        defaultMaxPoints: input.maxPoints,
        draft: {
          title: input.title,
          prompt: `Prompt for ${input.title}`,
          publicConfig: input.publicConfig,
          gradingConfig: input.gradingConfig,
        },
      })
      .expect(201);
    return getStringField(response, 'id');
  }

  async function saveAnswer(
    attemptId: string,
    testItemId: string,
    responseData: Record<string, unknown>,
  ): Promise<void> {
    await request(context.app.getHttpServer())
      .put(`/test-attempts/${attemptId}/answers/${testItemId}`)
      .set('Authorization', bearer('student'))
      .send({ responseData })
      .expect(200);
  }

  function choiceConfig(): Record<string, unknown> {
    return {
      options: [
        { id: optionA, text: 'A' },
        { id: optionB, text: 'B' },
        { id: optionC, text: 'C' },
        { id: optionD, text: 'D' },
      ],
      shuffleOptions: false,
    };
  }

  function bearer(actor: keyof typeof tokens): string {
    return `Bearer ${tokens[actor]}`;
  }
});

function getResponseArray(
  response: request.Response,
): Record<string, unknown>[] {
  const body: unknown = response.body;
  if (!Array.isArray(body) || !body.every(isRecord)) {
    throw new Error('Expected an array response');
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

function getRecordArray(
  record: Record<string, unknown>,
  field: string,
): Record<string, unknown>[] {
  const value = record[field];
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error(`Expected ${field} to be an array`);
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

function getNumberValue(
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
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
