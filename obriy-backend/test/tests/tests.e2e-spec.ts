import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import {
  AssignmentType,
  LessonStatus,
  Locale,
  MapPresetSourceType,
  MapPresetStatus,
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
  let mapPresetId = '';

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
    const mapPreset = await context.prisma.mapPreset.create({
      data: {
        key: `e2e-world-${stamp}`,
        name: 'E2E world map',
        contentLocale: Locale.UK,
        sourceType: MapPresetSourceType.BUILT_IN,
        status: MapPresetStatus.ACTIVE,
        geojsonUrl: '/maps/world-adm0.geojson',
        idProperty: 'featureId',
        attribution: 'geoBoundaries test fixture',
        bounds: { west: -180, south: -85, east: 180, north: 85 },
        defaultViewport: { longitude: 15, latitude: 20, zoom: 1.25 },
      },
    });
    mapPresetId = mapPreset.id;
  });

  afterAll(async () => {
    await context.prisma.testRelease.deleteMany({
      where: { test: { teacherId } },
    });
    await context.prisma.lessonTest.deleteMany({
      where: { test: { teacherId } },
    });
    await context.prisma.test.deleteMany({ where: { teacherId } });
    await context.prisma.assignment.deleteMany({ where: { teacherId } });
    await context.prisma.mapPreset.deleteMany({ where: { id: mapPresetId } });
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
        allowAttachments: false,
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
        allowAttachments: false,
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
    await publishRelease(testId);

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
    const closedReleaseResponse = await request(context.app.getHttpServer())
      .post(`/test-releases/${releaseId}/close`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    expect(getResponseBody(closedReleaseResponse)).toEqual(
      expect.objectContaining({ status: 'CLOSED' }),
    );
    await saveAnswer(
      attemptId,
      getStringValue(itemByType.get(AssignmentType.WRITTEN)!, 'id'),
      { text: 'Saved while the release is closed.', attachmentIds: [] },
    );
    const resumedClosedAttempt = await request(context.app.getHttpServer())
      .post(`/test-releases/${releaseId}/attempts`)
      .set('Authorization', bearer('student'))
      .expect(200);
    expect(getStringField(resumedClosedAttempt, 'id')).toBe(attemptId);
    await request(context.app.getHttpServer())
      .post(`/test-releases/${releaseId}/reopen`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    await request(context.app.getHttpServer())
      .patch(`/test-releases/${releaseId}`)
      .set('Authorization', bearer('student'))
      .send({ xpReward: 999 })
      .expect(403);
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

    const dashboardResponse = await request(context.app.getHttpServer())
      .get('/teacher/dashboard')
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const dashboardBody = getResponseBody(dashboardResponse);
    expect(
      getNumberValue(getRecordField(dashboardBody, 'stats'), 'pendingReviews'),
    ).toBe(1);
    const dashboardReview = getRecordArray(dashboardBody, 'pendingReviews')[0];
    expect(dashboardReview).toBeDefined();
    expect(getStringValue(dashboardReview, 'attemptId')).toBe(attemptId);
    expect(getStringValue(dashboardReview, 'lessonId')).toBe(lessonId);
    expect(getNumberValue(dashboardReview, 'pendingReviewCount')).toBe(1);
    await request(context.app.getHttpServer())
      .get('/teacher/dashboard')
      .set('Authorization', bearer('student'))
      .expect(403);

    const reviewsResponse = await request(context.app.getHttpServer())
      .get(`/lessons/${lessonId}/test-attempts`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const reviews = getRecordArray(getResponseBody(reviewsResponse), 'items');
    expect(reviews).toHaveLength(1);
    const exactReviewResponse = await request(context.app.getHttpServer())
      .get(`/lessons/${lessonId}/test-attempts/${attemptId}`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    expect(getResponseBody(exactReviewResponse)).toEqual(
      expect.objectContaining({ attemptId, pendingReviewCount: 1 }),
    );
    await request(context.app.getHttpServer())
      .get(`/lessons/${lessonId}/test-attempts/${attemptId}`)
      .set('Authorization', bearer('student'))
      .expect(403);
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

  it('grades one-to-one matching with an optional right distractor', async () => {
    const leftA = '823e4567-e89b-42d3-a456-426614174000';
    const leftB = '923e4567-e89b-42d3-a456-426614174000';
    const leftC = 'a23e4567-e89b-42d3-a456-426614174000';
    const rightA = 'b23e4567-e89b-42d3-a456-426614174000';
    const rightB = 'c23e4567-e89b-42d3-a456-426614174000';
    const rightC = 'd23e4567-e89b-42d3-a456-426614174000';
    const distractor = 'e23e4567-e89b-42d3-a456-426614174000';
    const correctMatches = [
      { leftItemId: leftA, rightItemId: rightA },
      { leftItemId: leftB, rightItemId: rightB },
      { leftItemId: leftC, rightItemId: rightC },
    ];
    const matchingAssignmentId = await createAssignment({
      type: AssignmentType.MATCHING,
      maxPoints: 6,
      title: 'Match countries and capitals',
      publicConfig: {
        leftItems: [
          { id: leftA, text: 'Ukraine' },
          { id: leftB, text: 'France' },
          { id: leftC, text: 'Italy' },
        ],
        rightItems: [
          { id: rightA, text: 'Kyiv' },
          { id: rightB, text: 'Paris' },
          { id: rightC, text: 'Rome' },
          { id: distractor, text: 'Warsaw' },
        ],
        shuffleRightItems: true,
      },
      gradingConfig: { matches: correctMatches, scoringMode: 'PARTIAL' },
    });
    const testResponse = await request(context.app.getHttpServer())
      .post('/tests')
      .set('Authorization', bearer('teacher'))
      .send({
        contentLocale: Locale.UK,
        title: 'Matching check',
        passingPercent: 60,
        maxAttempts: 1,
      })
      .expect(201);
    const testId = getStringField(testResponse, 'id');
    let draft = getRecordField(getResponseBody(testResponse), 'draftRevision');
    const addResponse = await request(context.app.getHttpServer())
      .post(`/tests/${testId}/draft/items`)
      .set('Authorization', bearer('teacher'))
      .send({
        assignmentId: matchingAssignmentId,
        expectedRevisionId: getStringValue(draft, 'id'),
        expectedEditVersion: getNumberValue(draft, 'editVersion'),
      })
      .expect(201);
    draft = getRecordField(getResponseBody(addResponse), 'draftRevision');
    await request(context.app.getHttpServer())
      .post(`/tests/${testId}/publish`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: getStringValue(draft, 'id'),
        expectedEditVersion: getNumberValue(draft, 'editVersion'),
      })
      .expect(200);
    await request(context.app.getHttpServer())
      .post(`/lessons/${lessonId}/tests`)
      .set('Authorization', bearer('teacher'))
      .send({ testId })
      .expect(201);
    await publishRelease(testId);

    const studentListResponse = await request(context.app.getHttpServer())
      .get(`/classes/me/lessons/${lessonId}/tests`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const studentTest = getResponseArray(studentListResponse).find(
      (candidate) => getStringValue(candidate, 'testId') === testId,
    );
    if (!studentTest) throw new Error('Expected matching test release');
    expect(studentTest).toEqual(
      expect.objectContaining({ itemCount: 1, items: [] }),
    );
    const releaseId = getStringValue(studentTest, 'releaseId');
    const attemptResponse = await request(context.app.getHttpServer())
      .post(`/test-releases/${releaseId}/attempts`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const attemptId = getStringField(attemptResponse, 'id');
    const activeResponse = await request(context.app.getHttpServer())
      .get(`/test-releases/${releaseId}`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const matchingItem = getRecordArray(
      getResponseBody(activeResponse),
      'items',
    )[0];
    if (!matchingItem) throw new Error('Expected matching test item');
    expect(getStringValue(matchingItem, 'type')).toBe(AssignmentType.MATCHING);
    expect(JSON.stringify(activeResponse.body)).not.toContain('gradingConfig');
    const deliveredConfig = getRecordField(matchingItem, 'publicConfig');
    const deliveredRightIds = getRecordArray(deliveredConfig, 'rightItems').map(
      (item) => getStringValue(item, 'id'),
    );
    const expectedRightIds = [rightA, rightB, rightC, distractor].sort(
      (left, right) =>
        stableRank(
          `${releaseId}:${studentId}:${getStringValue(matchingItem, 'id')}`,
          left,
        ).localeCompare(
          stableRank(
            `${releaseId}:${studentId}:${getStringValue(matchingItem, 'id')}`,
            right,
          ),
        ),
    );
    expect(deliveredRightIds).toEqual(expectedRightIds);

    await saveAnswer(attemptId, getStringValue(matchingItem, 'id'), {
      matches: [
        correctMatches[0],
        { leftItemId: leftB, rightItemId: distractor },
        correctMatches[2],
      ],
    });
    const submitResponse = await request(context.app.getHttpServer())
      .post(`/test-attempts/${attemptId}/submit`)
      .set('Authorization', bearer('student'))
      .expect(200);
    expect(getResponseBody(submitResponse)).toEqual(
      expect.objectContaining({
        status: TestAttemptStatus.GRADED,
        scorePoints: 4,
        scorePercent: 66.67,
        isPassed: true,
      }),
    );
  });

  it('always shuffles ordering items and awards pairwise partial credit', async () => {
    const itemA = 'f23e4567-e89b-42d3-a456-426614174000';
    const itemB = '123e4567-e89b-42d3-b456-426614174000';
    const itemC = '223e4567-e89b-42d3-b456-426614174000';
    const itemD = '323e4567-e89b-42d3-b456-426614174000';
    const correctOrderIds = [itemA, itemB, itemC, itemD];
    const orderingAssignmentId = await createAssignment({
      type: AssignmentType.ORDERING,
      maxPoints: 6,
      title: 'Order historical events',
      publicConfig: {
        items: [
          { id: itemA, text: 'First event' },
          { id: itemB, text: 'Second event' },
          { id: itemC, text: 'Third event' },
          { id: itemD, text: 'Fourth event' },
        ],
      },
      gradingConfig: { correctOrderIds, scoringMode: 'PARTIAL' },
    });
    const testResponse = await request(context.app.getHttpServer())
      .post('/tests')
      .set('Authorization', bearer('teacher'))
      .send({
        contentLocale: Locale.UK,
        title: 'Ordering check',
        passingPercent: 60,
        maxAttempts: 1,
      })
      .expect(201);
    const testId = getStringField(testResponse, 'id');
    let draft = getRecordField(getResponseBody(testResponse), 'draftRevision');
    const addResponse = await request(context.app.getHttpServer())
      .post(`/tests/${testId}/draft/items`)
      .set('Authorization', bearer('teacher'))
      .send({
        assignmentId: orderingAssignmentId,
        expectedRevisionId: getStringValue(draft, 'id'),
        expectedEditVersion: getNumberValue(draft, 'editVersion'),
      })
      .expect(201);
    draft = getRecordField(getResponseBody(addResponse), 'draftRevision');
    await request(context.app.getHttpServer())
      .post(`/tests/${testId}/publish`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: getStringValue(draft, 'id'),
        expectedEditVersion: getNumberValue(draft, 'editVersion'),
      })
      .expect(200);
    await request(context.app.getHttpServer())
      .post(`/lessons/${lessonId}/tests`)
      .set('Authorization', bearer('teacher'))
      .send({ testId })
      .expect(201);
    await publishRelease(testId);

    const studentListResponse = await request(context.app.getHttpServer())
      .get(`/classes/me/lessons/${lessonId}/tests`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const studentTest = getResponseArray(studentListResponse).find(
      (candidate) => getStringValue(candidate, 'testId') === testId,
    );
    if (!studentTest) throw new Error('Expected ordering test release');
    const releaseId = getStringValue(studentTest, 'releaseId');
    const attemptResponse = await request(context.app.getHttpServer())
      .post(`/test-releases/${releaseId}/attempts`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const attemptId = getStringField(attemptResponse, 'id');
    const activeResponse = await request(context.app.getHttpServer())
      .get(`/test-releases/${releaseId}`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const orderingItem = getRecordArray(
      getResponseBody(activeResponse),
      'items',
    )[0];
    if (!orderingItem) throw new Error('Expected ordering test item');
    expect(getStringValue(orderingItem, 'type')).toBe(AssignmentType.ORDERING);
    const deliveredItems = getRecordArray(
      getRecordField(orderingItem, 'publicConfig'),
      'items',
    );
    expect(
      deliveredItems.map((item) => getStringValue(item, 'id')),
    ).not.toEqual(correctOrderIds);
    expect(
      new Set(deliveredItems.map((item) => getStringValue(item, 'id'))),
    ).toEqual(new Set(correctOrderIds));
    expect(JSON.stringify(activeResponse.body)).not.toContain(
      'correctOrderIds',
    );

    await saveAnswer(attemptId, getStringValue(orderingItem, 'id'), {
      orderedItemIds: [itemA, itemC, itemB, itemD],
    });
    const submitResponse = await request(context.app.getHttpServer())
      .post(`/test-attempts/${attemptId}/submit`)
      .set('Authorization', bearer('student'))
      .expect(200);
    expect(getResponseBody(submitResponse)).toEqual(
      expect.objectContaining({
        status: TestAttemptStatus.GRADED,
        scorePoints: 5,
        scorePercent: 83.33,
        isPassed: true,
      }),
    );
  });

  it('runs MAP_POINT end to end without revealing the solution before the final attempt', async () => {
    const target = { longitude: 30.5234, latitude: 50.4501 };
    const assignmentResponse = await request(context.app.getHttpServer())
      .post('/assignments')
      .set('Authorization', bearer('teacher'))
      .send({
        type: AssignmentType.MAP_POINT,
        contentLocale: Locale.UK,
        defaultMaxPoints: 5,
        draft: {
          title: 'Find Kyiv on the map',
          prompt: 'Mark Kyiv.',
          mapPresetId,
          publicConfig: { initialProjection: 'MERCATOR' },
          gradingConfig: { target, radiusKm: 100 },
        },
      })
      .expect(201);
    const assignmentId = getStringField(assignmentResponse, 'id');
    const assignmentDraft = getRecordField(
      getResponseBody(assignmentResponse),
      'draftRevision',
    );
    await request(context.app.getHttpServer())
      .post(`/assignments/${assignmentId}/publish`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: getStringValue(assignmentDraft, 'id'),
        expectedEditVersion: getNumberValue(assignmentDraft, 'editVersion'),
      })
      .expect(200);

    const testResponse = await request(context.app.getHttpServer())
      .post('/tests')
      .set('Authorization', bearer('teacher'))
      .send({
        contentLocale: Locale.UK,
        title: 'Map point check',
        passingPercent: 50,
        maxAttempts: 2,
      })
      .expect(201);
    const testId = getStringField(testResponse, 'id');
    let testDraft = getRecordField(
      getResponseBody(testResponse),
      'draftRevision',
    );
    const addResponse = await request(context.app.getHttpServer())
      .post(`/tests/${testId}/draft/items`)
      .set('Authorization', bearer('teacher'))
      .send({
        assignmentId,
        expectedRevisionId: getStringValue(testDraft, 'id'),
        expectedEditVersion: getNumberValue(testDraft, 'editVersion'),
      })
      .expect(201);
    testDraft = getRecordField(getResponseBody(addResponse), 'draftRevision');
    await request(context.app.getHttpServer())
      .post(`/tests/${testId}/publish`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: getStringValue(testDraft, 'id'),
        expectedEditVersion: getNumberValue(testDraft, 'editVersion'),
      })
      .expect(200);
    await request(context.app.getHttpServer())
      .post(`/lessons/${lessonId}/tests`)
      .set('Authorization', bearer('teacher'))
      .send({ testId })
      .expect(201);
    await publishRelease(testId);

    const studentListResponse = await request(context.app.getHttpServer())
      .get(`/classes/me/lessons/${lessonId}/tests`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const studentTest = getResponseArray(studentListResponse).find(
      (candidate) => getStringValue(candidate, 'testId') === testId,
    );
    if (!studentTest) throw new Error('Expected MAP_POINT test release');
    const releaseId = getStringValue(studentTest, 'releaseId');

    await context.prisma.mapPreset.update({
      where: { id: mapPresetId },
      data: { status: MapPresetStatus.ARCHIVED, archivedAt: new Date() },
    });
    const firstAttemptResponse = await request(context.app.getHttpServer())
      .post(`/test-releases/${releaseId}/attempts`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const firstAttemptId = getStringField(firstAttemptResponse, 'id');
    const activeResponse = await request(context.app.getHttpServer())
      .get(`/test-releases/${releaseId}`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const activeBody = getResponseBody(activeResponse);
    const mapItem = getRecordArray(activeBody, 'items')[0];
    if (!mapItem) throw new Error('Expected MAP_POINT test item');
    expect(getStringValue(mapItem, 'type')).toBe(AssignmentType.MAP_POINT);
    expect(getRecordField(mapItem, 'mapPreset')).toEqual(
      expect.objectContaining({
        id: mapPresetId,
        geojsonUrl: '/maps/world-adm0.geojson',
      }),
    );
    expect(JSON.stringify(activeBody)).not.toContain('gradingConfig');
    expect(JSON.stringify(activeBody)).not.toContain('radiusKm');
    expect(JSON.stringify(activeBody)).not.toContain('30.5234');

    const testItemId = getStringValue(mapItem, 'id');
    await saveAnswer(firstAttemptId, testItemId, {
      longitude: 30.5,
      latitude: 50.45,
    });
    const firstSubmitResponse = await request(context.app.getHttpServer())
      .post(`/test-attempts/${firstAttemptId}/submit`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const firstAnswer = getRecordArray(
      getResponseBody(firstSubmitResponse),
      'answers',
    )[0];
    if (!firstAnswer) throw new Error('Expected first MAP_POINT answer');
    expect(firstAnswer).toEqual(
      expect.objectContaining({
        scorePoints: 5,
        scorePercent: 100,
        isCorrect: true,
        solutionFeedback: null,
      }),
    );
    const retryableResultResponse = await request(context.app.getHttpServer())
      .get(`/test-releases/${releaseId}`)
      .set('Authorization', bearer('student'))
      .expect(200);
    expect(JSON.stringify(retryableResultResponse.body)).not.toContain(
      'radiusKm',
    );

    const secondAttemptResponse = await request(context.app.getHttpServer())
      .post(`/test-releases/${releaseId}/attempts`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const secondAttemptId = getStringField(secondAttemptResponse, 'id');
    await saveAnswer(secondAttemptId, testItemId, {
      longitude: 0,
      latitude: 0,
    });
    const finalSubmitResponse = await request(context.app.getHttpServer())
      .post(`/test-attempts/${secondAttemptId}/submit`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const finalAnswer = getRecordArray(
      getResponseBody(finalSubmitResponse),
      'answers',
    )[0];
    if (!finalAnswer) throw new Error('Expected final MAP_POINT answer');
    expect(finalAnswer).toMatchObject({
      scorePoints: 0,
      scorePercent: 0,
      isCorrect: false,
    });
    const solutionFeedback = getRecordField(finalAnswer, 'solutionFeedback');
    expect(solutionFeedback).toMatchObject({
      target,
      radiusKm: 100,
      withinRadius: false,
    });
    expect(getNumberValue(solutionFeedback, 'distanceKm')).toBeGreaterThan(0);

    const reviewsResponse = await request(context.app.getHttpServer())
      .get(`/lessons/${lessonId}/test-attempts`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const finalReview = getRecordArray(
      getResponseBody(reviewsResponse),
      'items',
    ).find((review) => getStringValue(review, 'attemptId') === secondAttemptId);
    if (!finalReview) throw new Error('Expected MAP_POINT teacher review');
    const reviewAnswer = getRecordArray(finalReview, 'answers')[0];
    if (!reviewAnswer) throw new Error('Expected MAP_POINT review answer');
    expect(getRecordField(reviewAnswer, 'mapPreset')).toEqual(
      expect.objectContaining({ id: mapPresetId }),
    );
    expect(getRecordField(reviewAnswer, 'gradingConfig')).toEqual({
      target,
      radiusKm: 100,
    });
    const reviewGradingData = getRecordField(reviewAnswer, 'gradingData');
    expect(reviewGradingData).toMatchObject({ withinRadius: false });
    expect(getNumberValue(reviewGradingData, 'distanceKm')).toBeGreaterThan(0);
    await context.prisma.mapPreset.update({
      where: { id: mapPresetId },
      data: { status: MapPresetStatus.ACTIVE, archivedAt: null },
    });
  });

  it('runs MAP_REGION end to end and reveals the correct region only after the final attempt', async () => {
    const assignmentResponse = await request(context.app.getHttpServer())
      .post('/assignments')
      .set('Authorization', bearer('teacher'))
      .send({
        type: AssignmentType.MAP_REGION,
        contentLocale: Locale.UK,
        defaultMaxPoints: 4,
        draft: {
          title: 'Find India',
          prompt: 'Choose India on the map.',
          mapPresetId,
          publicConfig: { initialProjection: 'GLOBE' },
          gradingConfig: { correctRegionId: 'IND' },
        },
      })
      .expect(201);
    const assignmentId = getStringField(assignmentResponse, 'id');
    const assignmentDraft = getRecordField(
      getResponseBody(assignmentResponse),
      'draftRevision',
    );
    await request(context.app.getHttpServer())
      .post(`/assignments/${assignmentId}/publish`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: getStringValue(assignmentDraft, 'id'),
        expectedEditVersion: getNumberValue(assignmentDraft, 'editVersion'),
      })
      .expect(200);

    const testResponse = await request(context.app.getHttpServer())
      .post('/tests')
      .set('Authorization', bearer('teacher'))
      .send({
        contentLocale: Locale.UK,
        title: 'Map region check',
        maxAttempts: 1,
      })
      .expect(201);
    const testId = getStringField(testResponse, 'id');
    let testDraft = getRecordField(
      getResponseBody(testResponse),
      'draftRevision',
    );
    const addResponse = await request(context.app.getHttpServer())
      .post(`/tests/${testId}/draft/items`)
      .set('Authorization', bearer('teacher'))
      .send({
        assignmentId,
        expectedRevisionId: getStringValue(testDraft, 'id'),
        expectedEditVersion: getNumberValue(testDraft, 'editVersion'),
      })
      .expect(201);
    testDraft = getRecordField(getResponseBody(addResponse), 'draftRevision');
    await request(context.app.getHttpServer())
      .post(`/tests/${testId}/publish`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: getStringValue(testDraft, 'id'),
        expectedEditVersion: getNumberValue(testDraft, 'editVersion'),
      })
      .expect(200);
    await request(context.app.getHttpServer())
      .post(`/lessons/${lessonId}/tests`)
      .set('Authorization', bearer('teacher'))
      .send({ testId })
      .expect(201);
    await publishRelease(testId);

    const studentListResponse = await request(context.app.getHttpServer())
      .get(`/classes/me/lessons/${lessonId}/tests`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const studentTest = getResponseArray(studentListResponse).find(
      (candidate) => getStringValue(candidate, 'testId') === testId,
    );
    if (!studentTest) throw new Error('Expected MAP_REGION test release');
    const releaseId = getStringValue(studentTest, 'releaseId');
    const attemptResponse = await request(context.app.getHttpServer())
      .post(`/test-releases/${releaseId}/attempts`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const attemptId = getStringField(attemptResponse, 'id');
    const activeResponse = await request(context.app.getHttpServer())
      .get(`/test-releases/${releaseId}`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const activeBody = getResponseBody(activeResponse);
    const mapItem = getRecordArray(activeBody, 'items')[0];
    if (!mapItem) throw new Error('Expected MAP_REGION test item');
    expect(getStringValue(mapItem, 'type')).toBe(AssignmentType.MAP_REGION);
    expect(getRecordField(mapItem, 'mapPreset')).toEqual(
      expect.objectContaining({ id: mapPresetId }),
    );
    expect(JSON.stringify(activeBody)).not.toContain('correctRegionId');

    const testItemId = getStringValue(mapItem, 'id');
    const saveResponse = await request(context.app.getHttpServer())
      .put(`/test-attempts/${attemptId}/answers/${testItemId}`)
      .set('Authorization', bearer('student'))
      .send({ responseData: { regionId: 'PRI' } })
      .expect(200);
    expect(JSON.stringify(saveResponse.body)).not.toContain('IND');
    const submitResponse = await request(context.app.getHttpServer())
      .post(`/test-attempts/${attemptId}/submit`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const answer = getRecordArray(
      getResponseBody(submitResponse),
      'answers',
    )[0];
    if (!answer) throw new Error('Expected MAP_REGION answer');
    expect(answer).toMatchObject({
      responseData: { regionId: 'PRI' },
      scorePoints: 0,
      scorePercent: 0,
      isCorrect: false,
    });
    expect(getRecordField(answer, 'solutionFeedback')).toEqual({
      correctRegionId: 'IND',
      matches: false,
    });

    const reviewsResponse = await request(context.app.getHttpServer())
      .get(`/lessons/${lessonId}/test-attempts`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const review = getRecordArray(
      getResponseBody(reviewsResponse),
      'items',
    ).find((candidate) => getStringValue(candidate, 'attemptId') === attemptId);
    if (!review) throw new Error('Expected MAP_REGION teacher review');
    const reviewAnswer = getRecordArray(review, 'answers')[0];
    if (!reviewAnswer) throw new Error('Expected MAP_REGION review answer');
    expect(getRecordField(reviewAnswer, 'gradingConfig')).toEqual({
      correctRegionId: 'IND',
    });
    expect(getRecordField(reviewAnswer, 'gradingData')).toEqual({
      matches: false,
    });
  });

  it('runs MAP_MULTI_REGION end to end with partial credit and a hidden solution', async () => {
    const correctRegionIds = ['FRA', 'DEU', 'ITA'];
    const assignmentResponse = await request(context.app.getHttpServer())
      .post('/assignments')
      .set('Authorization', bearer('teacher'))
      .send({
        type: AssignmentType.MAP_MULTI_REGION,
        contentLocale: Locale.UK,
        defaultMaxPoints: 9,
        draft: {
          title: 'Find three countries',
          prompt: 'Choose France, Germany and Italy.',
          mapPresetId,
          publicConfig: {
            initialProjection: 'MERCATOR',
            requiredSelectionCount: 3,
          },
          gradingConfig: { correctRegionIds, scoringMode: 'PARTIAL' },
        },
      })
      .expect(201);
    const assignmentId = getStringField(assignmentResponse, 'id');
    const assignmentDraft = getRecordField(
      getResponseBody(assignmentResponse),
      'draftRevision',
    );
    await request(context.app.getHttpServer())
      .post(`/assignments/${assignmentId}/publish`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: getStringValue(assignmentDraft, 'id'),
        expectedEditVersion: getNumberValue(assignmentDraft, 'editVersion'),
      })
      .expect(200);

    const testResponse = await request(context.app.getHttpServer())
      .post('/tests')
      .set('Authorization', bearer('teacher'))
      .send({
        contentLocale: Locale.UK,
        title: 'Multiple regions check',
        maxAttempts: 1,
      })
      .expect(201);
    const testId = getStringField(testResponse, 'id');
    let testDraft = getRecordField(
      getResponseBody(testResponse),
      'draftRevision',
    );
    const addResponse = await request(context.app.getHttpServer())
      .post(`/tests/${testId}/draft/items`)
      .set('Authorization', bearer('teacher'))
      .send({
        assignmentId,
        expectedRevisionId: getStringValue(testDraft, 'id'),
        expectedEditVersion: getNumberValue(testDraft, 'editVersion'),
      })
      .expect(201);
    testDraft = getRecordField(getResponseBody(addResponse), 'draftRevision');
    await request(context.app.getHttpServer())
      .post(`/tests/${testId}/publish`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: getStringValue(testDraft, 'id'),
        expectedEditVersion: getNumberValue(testDraft, 'editVersion'),
      })
      .expect(200);
    await request(context.app.getHttpServer())
      .post(`/lessons/${lessonId}/tests`)
      .set('Authorization', bearer('teacher'))
      .send({ testId })
      .expect(201);
    await publishRelease(testId);

    const studentListResponse = await request(context.app.getHttpServer())
      .get(`/classes/me/lessons/${lessonId}/tests`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const studentTest = getResponseArray(studentListResponse).find(
      (candidate) => getStringValue(candidate, 'testId') === testId,
    );
    if (!studentTest) throw new Error('Expected MAP_MULTI_REGION release');
    const releaseId = getStringValue(studentTest, 'releaseId');
    const attemptResponse = await request(context.app.getHttpServer())
      .post(`/test-releases/${releaseId}/attempts`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const attemptId = getStringField(attemptResponse, 'id');
    const activeResponse = await request(context.app.getHttpServer())
      .get(`/test-releases/${releaseId}`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const activeBody = getResponseBody(activeResponse);
    const mapItem = getRecordArray(activeBody, 'items')[0];
    if (!mapItem) throw new Error('Expected MAP_MULTI_REGION item');
    expect(getStringValue(mapItem, 'type')).toBe(
      AssignmentType.MAP_MULTI_REGION,
    );
    expect(getRecordField(mapItem, 'mapPreset')).toEqual(
      expect.objectContaining({ id: mapPresetId }),
    );
    expect(getRecordField(mapItem, 'publicConfig')).toEqual({
      initialProjection: 'MERCATOR',
      requiredSelectionCount: 3,
    });
    expect(JSON.stringify(activeBody)).not.toContain('correctRegionIds');
    expect(JSON.stringify(activeBody)).not.toContain('scoringMode');

    const testItemId = getStringValue(mapItem, 'id');
    const selectedRegionIds = ['FRA', 'DEU', 'ESP'];
    const saveResponse = await request(context.app.getHttpServer())
      .put(`/test-attempts/${attemptId}/answers/${testItemId}`)
      .set('Authorization', bearer('student'))
      .send({ responseData: { selectedRegionIds } })
      .expect(200);
    expect(saveResponse.body).toMatchObject({
      answers: [
        expect.objectContaining({
          testItemId,
          responseData: { selectedRegionIds },
          solutionFeedback: null,
        }),
      ],
    });
    expect(JSON.stringify(saveResponse.body)).not.toContain('ITA');

    const submitResponse = await request(context.app.getHttpServer())
      .post(`/test-attempts/${attemptId}/submit`)
      .set('Authorization', bearer('student'))
      .expect(200);
    const answer = getRecordArray(
      getResponseBody(submitResponse),
      'answers',
    )[0];
    if (!answer) throw new Error('Expected MAP_MULTI_REGION answer');
    expect(answer).toMatchObject({
      responseData: { selectedRegionIds },
      scorePoints: 6,
      scorePercent: 66.67,
      isCorrect: false,
    });
    expect(getRecordField(answer, 'solutionFeedback')).toEqual({
      correctRegionIds,
      correctSelectedCount: 2,
      incorrectSelectedCount: 1,
      expectedCorrectCount: 3,
      creditFraction: 2 / 3,
      scoringMode: 'PARTIAL',
    });

    const reviewsResponse = await request(context.app.getHttpServer())
      .get(`/lessons/${lessonId}/test-attempts`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const review = getRecordArray(
      getResponseBody(reviewsResponse),
      'items',
    ).find((candidate) => getStringValue(candidate, 'attemptId') === attemptId);
    if (!review) throw new Error('Expected MAP_MULTI_REGION teacher review');
    const reviewAnswer = getRecordArray(review, 'answers')[0];
    if (!reviewAnswer)
      throw new Error('Expected MAP_MULTI_REGION review answer');
    expect(getRecordField(reviewAnswer, 'gradingConfig')).toEqual({
      correctRegionIds,
      scoringMode: 'PARTIAL',
    });
    expect(getRecordField(reviewAnswer, 'gradingData')).toEqual({
      correctSelectedCount: 2,
      incorrectSelectedCount: 1,
      expectedCorrectCount: 3,
      creditFraction: 2 / 3,
      scoringMode: 'PARTIAL',
    });
  });

  it('updates a test item to the latest assignment revision in place', async () => {
    const assignmentId = await createAssignment({
      type: AssignmentType.SINGLE_CHOICE,
      maxPoints: 3,
      title: 'Original assignment title',
      publicConfig: choiceConfig(),
      gradingConfig: {
        correctOptionIds: [optionA],
        scoringMode: 'ALL_OR_NOTHING',
      },
    });
    const testResponse = await request(context.app.getHttpServer())
      .post('/tests')
      .set('Authorization', bearer('teacher'))
      .send({ contentLocale: Locale.UK, title: 'Revision update check' })
      .expect(201);
    const testId = getStringField(testResponse, 'id');
    let testDraft = getRecordField(
      getResponseBody(testResponse),
      'draftRevision',
    );
    const addResponse = await request(context.app.getHttpServer())
      .post(`/tests/${testId}/draft/items`)
      .set('Authorization', bearer('teacher'))
      .send({
        assignmentId,
        maxPoints: 7,
        expectedRevisionId: getStringValue(testDraft, 'id'),
        expectedEditVersion: getNumberValue(testDraft, 'editVersion'),
      })
      .expect(201);
    testDraft = getRecordField(getResponseBody(addResponse), 'draftRevision');
    const originalItem = getRecordArray(testDraft, 'items')[0];
    if (!originalItem) throw new Error('Expected the original test item');
    expect(originalItem).toEqual(
      expect.objectContaining({
        position: 0,
        maxPoints: 7,
        hasUpdate: false,
        title: 'Original assignment title',
      }),
    );

    const startEditResponse = await request(context.app.getHttpServer())
      .post(`/assignments/${assignmentId}/start-edit`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    let assignmentDraft = getRecordField(
      getResponseBody(startEditResponse),
      'draftRevision',
    );
    const updateAssignmentResponse = await request(context.app.getHttpServer())
      .patch(`/assignments/${assignmentId}/draft`)
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: getStringValue(assignmentDraft, 'id'),
        expectedEditVersion: getNumberValue(assignmentDraft, 'editVersion'),
        title: 'Updated assignment title',
      })
      .expect(200);
    assignmentDraft = getRecordField(
      getResponseBody(updateAssignmentResponse),
      'draftRevision',
    );

    const staleTestResponse = await request(context.app.getHttpServer())
      .get(`/tests/${testId}`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const staleDraft = getRecordField(
      getResponseBody(staleTestResponse),
      'draftRevision',
    );
    const staleItem = getRecordArray(staleDraft, 'items')[0];
    if (!staleItem) throw new Error('Expected a stale test item');
    expect(staleItem).toEqual(expect.objectContaining({ hasUpdate: true }));

    const updateItemResponse = await request(context.app.getHttpServer())
      .post(
        `/tests/${testId}/draft/items/${getStringValue(staleItem, 'id')}/update-revision`,
      )
      .set('Authorization', bearer('teacher'))
      .send({
        expectedRevisionId: getStringValue(staleDraft, 'id'),
        expectedEditVersion: getNumberValue(staleDraft, 'editVersion'),
      })
      .expect(200);
    const updatedDraft = getRecordField(
      getResponseBody(updateItemResponse),
      'draftRevision',
    );
    const updatedItem = getRecordArray(updatedDraft, 'items')[0];
    if (!updatedItem) throw new Error('Expected the updated test item');
    expect(updatedItem).toEqual(
      expect.objectContaining({
        id: getStringValue(originalItem, 'id'),
        position: 0,
        maxPoints: 7,
        hasUpdate: false,
        title: 'Updated assignment title',
      }),
    );
    expect(getStringValue(updatedItem, 'assignmentRevisionId')).toBe(
      getStringValue(assignmentDraft, 'id'),
    );
    expect(getStringValue(updatedItem, 'assignmentRevisionId')).not.toBe(
      getStringValue(originalItem, 'assignmentRevisionId'),
    );
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

  async function publishRelease(testId: string): Promise<string> {
    const listResponse = await request(context.app.getHttpServer())
      .get(`/lessons/${lessonId}/tests/${testId}/releases`)
      .set('Authorization', bearer('teacher'))
      .expect(200);
    const draft = getResponseArray(listResponse).find(
      (release) => release.status === 'DRAFT',
    );
    if (!draft) throw new Error('Expected a draft test release');
    const releaseId = getStringValue(draft, 'id');
    await request(context.app.getHttpServer())
      .patch(`/lessons/${lessonId}/tests/${testId}/releases/bulk`)
      .set('Authorization', bearer('teacher'))
      .send({ releaseIds: [releaseId], settings: { xpReward: 100 } })
      .expect(200);
    await request(context.app.getHttpServer())
      .post(`/lessons/${lessonId}/tests/${testId}/releases/publish`)
      .set('Authorization', bearer('teacher'))
      .send({ releaseIds: [releaseId] })
      .expect(200);
    return releaseId;
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

function stableRank(seed: string, value: string): string {
  return createHash('sha256').update(`${seed}:${value}`).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
