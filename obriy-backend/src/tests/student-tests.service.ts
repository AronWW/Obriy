import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentType,
  Prisma,
  TestAnswerStatus,
  TestAttemptStatus,
  TestLatePolicy,
  TestReleaseStatus,
  TestScorePolicy,
  TestStudentStatus,
  UserRole,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { gradeChoiceResponse } from '../assignments/grading/choice-grading';
import { gradeCategorizationResponse } from '../assignments/grading/categorization-grading';
import { gradeFillBlanksResponse } from '../assignments/grading/fill-blanks-grading';
import { gradeImageHotspotResponse } from '../assignments/grading/image-hotspot-grading';
import { gradeMatchingResponse } from '../assignments/grading/matching-grading';
import { gradeOrderingResponse } from '../assignments/grading/ordering-grading';
import { validateAssignmentStudentResponse } from '../assignments/validation';
import type { AuthUser } from '../common/types/auth-user.type';
import { SaveTestAnswerDto } from './dto/student-test.dto';
import {
  StudentLessonTestDto,
  StudentTestAnswerDto,
  StudentTestAttemptDto,
  StudentTestItemDto,
} from './dto/student-test.dto';
import { TestAttemptScoringService } from './test-attempt-scoring.service';

const studentReleaseSelect = {
  id: true,
  testId: true,
  testRevisionId: true,
  classId: true,
  lessonId: true,
  status: true,
  maxPoints: true,
  passingPercent: true,
  isRequired: true,
  availableFrom: true,
  dueAt: true,
  timeLimitSeconds: true,
  maxAttempts: true,
  scorePolicy: true,
  latePolicy: true,
  latePenaltyPercent: true,
  revision: {
    select: {
      title: true,
      description: true,
      instructions: true,
      shuffleItems: true,
      items: {
        orderBy: [{ position: 'asc' as const }],
        select: {
          id: true,
          position: true,
          maxPoints: true,
          assignmentId: true,
          assignmentRevisionId: true,
          assignment: { select: { type: true } },
          assignmentRevision: {
            select: {
              title: true,
              prompt: true,
              instructions: true,
              publicConfig: true,
              schemaVersion: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.TestReleaseSelect;

const answerSelect = {
  id: true,
  testItemId: true,
  status: true,
  responseData: true,
  maxPoints: true,
  scorePoints: true,
  scorePercent: true,
  isCorrect: true,
  teacherComment: true,
} satisfies Prisma.TestAnswerSelect;

const attemptSelect = {
  id: true,
  attemptNumber: true,
  status: true,
  maxPoints: true,
  scorePoints: true,
  scorePercent: true,
  isPassed: true,
  pendingReviewCount: true,
  startedAt: true,
  expiresAt: true,
  submittedAt: true,
  gradedAt: true,
  answers: {
    orderBy: { testItem: { position: 'asc' as const } },
    select: answerSelect,
  },
} satisfies Prisma.TestAttemptSelect;

const submissionAttemptSelect = {
  id: true,
  testRevisionId: true,
  status: true,
  expiresAt: true,
  studentState: {
    select: {
      id: true,
      studentId: true,
      attemptCount: true,
      bestPoints: true,
      bestPercent: true,
      release: {
        select: {
          id: true,
          classId: true,
          lessonId: true,
          status: true,
          availableFrom: true,
          dueAt: true,
          latePolicy: true,
          latePenaltyPercent: true,
          passingPercent: true,
          maxAttempts: true,
          scorePolicy: true,
        },
      },
    },
  },
  answers: {
    orderBy: { testItem: { position: 'asc' as const } },
    select: {
      id: true,
      responseData: true,
      maxPoints: true,
      testItem: {
        select: {
          id: true,
          assignment: { select: { type: true } },
          assignmentRevision: {
            select: {
              publicConfig: true,
              schemaVersion: true,
              solution: { select: { gradingConfig: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.TestAttemptSelect;

type StudentReleaseRecord = Prisma.TestReleaseGetPayload<{
  select: typeof studentReleaseSelect;
}>;
type AttemptRecord = Prisma.TestAttemptGetPayload<{
  select: typeof attemptSelect;
}>;
type SubmissionAttemptRecord = Prisma.TestAttemptGetPayload<{
  select: typeof submissionAttemptSelect;
}>;

@Injectable()
export class StudentTestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attemptScoring: TestAttemptScoringService,
  ) {}

  async listLessonTests(
    user: AuthUser,
    lessonId: string,
  ): Promise<StudentLessonTestDto[]> {
    this.assertStudent(user);
    const lessonAccess = await this.prisma.classLesson.findFirst({
      where: {
        lessonId,
        publishedAt: { not: null },
        class: { students: { some: { id: user.id } } },
      },
      select: { classId: true },
    });
    if (!lessonAccess) {
      throw this.lessonNotFound();
    }
    const now = new Date();
    const releases = await this.prisma.testRelease.findMany({
      where: {
        lessonId,
        classId: lessonAccess.classId,
        status: TestReleaseStatus.ACTIVE,
        OR: [{ availableFrom: null }, { availableFrom: { lte: now } }],
      },
      select: studentReleaseSelect,
    });
    const order = await this.prisma.lessonTest.findMany({
      where: {
        lessonId,
        testId: { in: releases.map((release) => release.testId) },
      },
      select: { testId: true, position: true },
    });
    const positionByTest = new Map(
      order.map((link) => [link.testId, link.position] as const),
    );
    releases.sort(
      (left, right) =>
        (positionByTest.get(left.testId) ?? Number.MAX_SAFE_INTEGER) -
          (positionByTest.get(right.testId) ?? Number.MAX_SAFE_INTEGER) ||
        left.id.localeCompare(right.id),
    );

    const states = await this.prisma.testStudentState.findMany({
      where: {
        studentId: user.id,
        releaseId: { in: releases.map((release) => release.id) },
      },
      select: {
        releaseId: true,
        status: true,
        attempts: {
          orderBy: { attemptNumber: 'desc' },
          take: 1,
          select: attemptSelect,
        },
      },
    });
    const stateByRelease = new Map(
      states.map((state) => [state.releaseId, state] as const),
    );
    return releases.map((release) => {
      const state = stateByRelease.get(release.id);
      return this.toReleaseDto(
        release,
        this.resolveStudentStatus(release, state?.status, now),
        state?.attempts[0] ?? null,
        user.id,
        Boolean(state?.attempts[0]),
      );
    });
  }

  async getRelease(
    user: AuthUser,
    releaseId: string,
  ): Promise<StudentLessonTestDto> {
    this.assertStudent(user);
    const release = await this.findAccessibleRelease(
      this.prisma,
      user.id,
      releaseId,
    );
    const state = await this.prisma.testStudentState.findUnique({
      where: { releaseId_studentId: { releaseId, studentId: user.id } },
      select: {
        status: true,
        attempts: {
          orderBy: { attemptNumber: 'desc' },
          take: 1,
          select: attemptSelect,
        },
      },
    });
    if (!state?.attempts[0]) {
      this.assertReleaseOpen(release);
    }
    return this.toReleaseDto(
      release,
      this.resolveStudentStatus(release, state?.status, new Date()),
      state?.attempts[0] ?? null,
      user.id,
      Boolean(state?.attempts[0]),
    );
  }

  async startAttempt(
    user: AuthUser,
    releaseId: string,
  ): Promise<StudentTestAttemptDto> {
    this.assertStudent(user);
    const result = await this.prisma.$transaction(async (transaction) => {
      await this.lockRelease(transaction, releaseId);
      const release = await this.findAccessibleRelease(
        transaction,
        user.id,
        releaseId,
      );
      const state = await transaction.testStudentState.upsert({
        where: { releaseId_studentId: { releaseId, studentId: user.id } },
        create: { releaseId, studentId: user.id },
        update: {},
        select: { id: true },
      });
      await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id"
        FROM "TestStudentState"
        WHERE "id" = ${state.id}
        FOR UPDATE
      `);
      const lockedState = await transaction.testStudentState.findUnique({
        where: { id: state.id },
        select: {
          id: true,
          status: true,
          attemptCount: true,
          startedAt: true,
          bestPercent: true,
          attempts: {
            where: { status: TestAttemptStatus.IN_PROGRESS },
            orderBy: { attemptNumber: 'desc' },
            take: 1,
            select: attemptSelect,
          },
        },
      });
      if (!lockedState) {
        throw this.releaseNotFound();
      }
      const current = lockedState.attempts[0];
      if (current) {
        if (
          !this.isAttemptExpired(current.expiresAt) &&
          !this.isClosedByDeadline(release) &&
          (release.status === TestReleaseStatus.ACTIVE ||
            release.status === TestReleaseStatus.CLOSED)
        ) {
          return {
            kind: 'attempt' as const,
            attempt: this.toAttemptDto(current),
          };
        }
        if (release.status === TestReleaseStatus.ARCHIVED) {
          await this.markAttemptCancelled(
            transaction,
            current.id,
            lockedState.id,
            lockedState.bestPercent,
            release,
          );
        } else {
          await this.markAttemptExpired(
            transaction,
            current.id,
            lockedState.id,
            lockedState.bestPercent,
            release,
          );
        }
      }
      if (lockedState.status === TestStudentStatus.AWAITING_REVIEW) {
        throw this.attemptLocked();
      }
      this.assertReleaseOpen(release);
      const usedAttempts = await transaction.testAttempt.count({
        where: {
          studentStateId: lockedState.id,
          status: {
            notIn: [TestAttemptStatus.RETURNED, TestAttemptStatus.CANCELLED],
          },
        },
      });
      if (release.maxAttempts !== null && usedAttempts >= release.maxAttempts) {
        return { kind: 'max-attempts' as const };
      }
      const now = new Date();
      const attemptNumber = lockedState.attemptCount + 1;
      const expiresAt = release.timeLimitSeconds
        ? new Date(now.getTime() + release.timeLimitSeconds * 1_000)
        : null;
      const createdAttempt = await transaction.testAttempt.create({
        data: {
          studentStateId: lockedState.id,
          testRevisionId: release.testRevisionId,
          attemptNumber,
          clientAttemptId: randomUUID(),
          maxPoints: release.maxPoints,
          expiresAt,
          isLate: Boolean(release.dueAt && release.dueAt < now),
        },
        select: { id: true },
      });
      await transaction.testAnswer.createMany({
        data: release.revision.items.map((item) => ({
          testAttemptId: createdAttempt.id,
          testRevisionId: release.testRevisionId,
          testItemId: item.id,
          maxPoints: item.maxPoints,
          responseData: this.emptyResponse(item.assignment.type),
        })),
      });
      await transaction.testStudentState.update({
        where: { id: lockedState.id },
        data: {
          status: this.preserveCompletedState(lockedState.bestPercent, release)
            ? TestStudentStatus.COMPLETED
            : TestStudentStatus.IN_PROGRESS,
          attemptCount: attemptNumber,
          isLate: Boolean(release.dueAt && release.dueAt < now),
          startedAt: lockedState.startedAt ?? now,
          lastActivityAt: now,
        },
      });
      return {
        kind: 'attempt' as const,
        attempt: await this.findAttemptDto(transaction, createdAttempt.id),
      };
    });
    if (result.kind === 'max-attempts') {
      throw new ConflictException({
        code: 'TEST_MAX_ATTEMPTS_REACHED',
        message: 'No test attempts remain',
      });
    }
    return result.attempt;
  }

  async saveAnswer(
    user: AuthUser,
    attemptId: string,
    testItemId: string,
    dto: SaveTestAnswerDto,
  ): Promise<StudentTestAttemptDto> {
    this.assertStudent(user);
    const result = await this.prisma.$transaction(async (transaction) => {
      const attempt = await this.findAccessibleSubmissionAttempt(
        transaction,
        user.id,
        attemptId,
      );
      if (this.isAttemptExpired(attempt.expiresAt)) {
        await this.markAttemptExpired(
          transaction,
          attempt.id,
          attempt.studentState.id,
          attempt.studentState.bestPercent,
          attempt.studentState.release,
        );
        return { kind: 'expired' as const };
      }
      if (this.isClosedByDeadline(attempt.studentState.release)) {
        await this.markAttemptExpired(
          transaction,
          attempt.id,
          attempt.studentState.id,
          attempt.studentState.bestPercent,
          attempt.studentState.release,
        );
        return { kind: 'closed' as const };
      }
      this.assertAttemptEditable(attempt);
      const answer = attempt.answers.find(
        (candidate) => candidate.testItem.id === testItemId,
      );
      if (!answer) {
        throw this.answerNotFound();
      }
      const responseData = this.validateResponse(
        answer.testItem.assignment.type,
        answer.testItem.assignmentRevision.schemaVersion,
        answer.testItem.assignmentRevision.publicConfig,
        dto.responseData,
        false,
      );
      await transaction.testAnswer.update({
        where: { id: answer.id },
        data: { responseData },
      });
      await transaction.testStudentState.update({
        where: { id: attempt.studentState.id },
        data: { lastActivityAt: new Date() },
      });
      return {
        kind: 'attempt' as const,
        attempt: await this.findAttemptDto(transaction, attemptId),
      };
    });
    if (result.kind === 'expired') {
      throw this.timeExpired();
    }
    if (result.kind === 'closed') {
      throw this.testClosed();
    }
    return result.attempt;
  }

  async submitAttempt(
    user: AuthUser,
    attemptId: string,
  ): Promise<StudentTestAttemptDto> {
    this.assertStudent(user);
    const result = await this.prisma.$transaction(async (transaction) => {
      const attempt = await this.findAccessibleSubmissionAttempt(
        transaction,
        user.id,
        attemptId,
      );
      if (
        attempt.status === TestAttemptStatus.AWAITING_REVIEW ||
        attempt.status === TestAttemptStatus.GRADED ||
        attempt.status === TestAttemptStatus.RETURNED
      ) {
        return {
          kind: 'attempt' as const,
          attempt: await this.findAttemptDto(transaction, attempt.id),
        };
      }
      if (this.isAttemptExpired(attempt.expiresAt)) {
        await this.markAttemptExpired(
          transaction,
          attempt.id,
          attempt.studentState.id,
          attempt.studentState.bestPercent,
          attempt.studentState.release,
        );
        return { kind: 'expired' as const };
      }
      if (this.isClosedByDeadline(attempt.studentState.release)) {
        await this.markAttemptExpired(
          transaction,
          attempt.id,
          attempt.studentState.id,
          attempt.studentState.bestPercent,
          attempt.studentState.release,
        );
        return { kind: 'closed' as const };
      }
      this.assertAttemptEditable(attempt);
      const submittedAt = new Date();
      const isLate = Boolean(
        attempt.studentState.release.dueAt &&
        attempt.studentState.release.dueAt < submittedAt,
      );
      let pendingReviewCount = 0;

      for (const answer of attempt.answers) {
        const assignmentType = answer.testItem.assignment.type;
        const revision = answer.testItem.assignmentRevision;
        const responseData = this.validateResponse(
          assignmentType,
          revision.schemaVersion,
          revision.publicConfig,
          answer.responseData,
          true,
        );
        if (assignmentType === AssignmentType.WRITTEN) {
          pendingReviewCount += 1;
          await transaction.testAnswer.update({
            where: { id: answer.id },
            data: {
              responseData,
              status: TestAnswerStatus.AWAITING_REVIEW,
            },
          });
          continue;
        }
        if (!revision.solution) {
          throw new ConflictException({
            code: 'TEST_ITEM_SOLUTION_NOT_FOUND',
            message: 'A test item has no grading solution',
          });
        }
        const gradingInput = {
          type: assignmentType,
          publicConfig: revision.publicConfig,
          gradingConfig: revision.solution.gradingConfig,
          responseData,
          maxPoints: Number(answer.maxPoints),
        };
        const grade =
          assignmentType === AssignmentType.MATCHING
            ? gradeMatchingResponse(gradingInput)
            : assignmentType === AssignmentType.ORDERING
              ? gradeOrderingResponse(gradingInput)
              : assignmentType === AssignmentType.CATEGORIZATION
                ? gradeCategorizationResponse(gradingInput)
                : assignmentType === AssignmentType.FILL_BLANKS
                  ? gradeFillBlanksResponse(gradingInput)
                  : assignmentType === AssignmentType.IMAGE_HOTSPOT
                    ? gradeImageHotspotResponse(gradingInput)
                    : gradeChoiceResponse(gradingInput);
        await transaction.testAnswer.update({
          where: { id: answer.id },
          data: {
            responseData,
            status: TestAnswerStatus.GRADED,
            scorePoints: grade.scorePoints,
            scorePercent: grade.scorePercent,
            isCorrect: grade.isCorrect,
            gradingData: grade.gradingData,
            gradedAt: submittedAt,
          },
        });
      }

      if (pendingReviewCount > 0) {
        await transaction.testAttempt.update({
          where: { id: attempt.id },
          data: {
            status: TestAttemptStatus.AWAITING_REVIEW,
            pendingReviewCount,
            isLate,
            submittedAt,
          },
        });
        await transaction.testStudentState.update({
          where: { id: attempt.studentState.id },
          data: {
            status: this.preserveCompletedState(
              attempt.studentState.bestPercent,
              attempt.studentState.release,
            )
              ? TestStudentStatus.COMPLETED
              : TestStudentStatus.AWAITING_REVIEW,
            isLate,
            submittedAt,
            lastActivityAt: submittedAt,
          },
        });
      } else {
        await transaction.testAttempt.update({
          where: { id: attempt.id },
          data: { submittedAt, isLate },
        });
        await this.attemptScoring.finalize(
          transaction,
          attempt.id,
          submittedAt,
        );
      }
      return {
        kind: 'attempt' as const,
        attempt: await this.findAttemptDto(transaction, attemptId),
      };
    });
    if (result.kind === 'expired') {
      throw this.timeExpired();
    }
    if (result.kind === 'closed') {
      throw this.testClosed();
    }
    return result.attempt;
  }

  private async findAccessibleRelease(
    client: PrismaService | Prisma.TransactionClient,
    studentId: string,
    releaseId: string,
  ): Promise<StudentReleaseRecord> {
    const release = await client.testRelease.findFirst({
      where: {
        id: releaseId,
        class: { students: { some: { id: studentId } } },
      },
      select: studentReleaseSelect,
    });
    if (!release) {
      throw this.releaseNotFound();
    }
    if (release.lessonId) {
      const visibleLesson = await client.classLesson.findUnique({
        where: {
          classId_lessonId: {
            classId: release.classId,
            lessonId: release.lessonId,
          },
        },
        select: { publishedAt: true },
      });
      if (!visibleLesson?.publishedAt) {
        throw this.releaseNotFound();
      }
    }
    return release;
  }

  private async findAccessibleSubmissionAttempt(
    transaction: Prisma.TransactionClient,
    studentId: string,
    attemptId: string,
  ): Promise<SubmissionAttemptRecord> {
    const accessible = await transaction.testAttempt.findFirst({
      where: {
        id: attemptId,
        studentState: {
          studentId,
          release: { class: { students: { some: { id: studentId } } } },
        },
      },
      select: { id: true },
    });
    if (!accessible) {
      throw this.attemptNotFound();
    }
    await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id"
      FROM "TestAttempt"
      WHERE "id" = ${attemptId}
      FOR UPDATE
    `);
    const attempt = await transaction.testAttempt.findFirst({
      where: {
        id: attemptId,
        studentState: {
          studentId,
          release: { class: { students: { some: { id: studentId } } } },
        },
      },
      select: submissionAttemptSelect,
    });
    if (!attempt) {
      throw this.attemptNotFound();
    }
    const release = attempt.studentState.release;
    if (release.lessonId) {
      const visible = await transaction.classLesson.findUnique({
        where: {
          classId_lessonId: {
            classId: release.classId,
            lessonId: release.lessonId,
          },
        },
        select: { publishedAt: true },
      });
      if (!visible?.publishedAt) {
        throw this.attemptNotFound();
      }
    }
    return attempt;
  }

  private assertAttemptEditable(attempt: SubmissionAttemptRecord): void {
    if (attempt.status !== TestAttemptStatus.IN_PROGRESS) {
      throw this.attemptLocked();
    }
    const release = attempt.studentState.release;
    if (
      release.status !== TestReleaseStatus.ACTIVE &&
      release.status !== TestReleaseStatus.CLOSED
    ) {
      throw this.attemptLocked();
    }
  }

  private assertReleaseOpen(release: StudentReleaseRecord): void {
    const now = new Date();
    if (release.status !== TestReleaseStatus.ACTIVE) {
      throw this.releaseNotFound();
    }
    if (release.availableFrom && release.availableFrom > now) {
      throw new ConflictException({
        code: 'TEST_NOT_AVAILABLE',
        message: 'This test is not available yet',
      });
    }
    if (
      release.dueAt &&
      release.dueAt < now &&
      release.latePolicy === TestLatePolicy.DISALLOW
    ) {
      throw new ConflictException({
        code: 'TEST_CLOSED',
        message: 'This test no longer accepts responses',
      });
    }
  }

  private isAttemptExpired(expiresAt: Date | null): boolean {
    return Boolean(expiresAt && expiresAt <= new Date());
  }

  private isClosedByDeadline(release: {
    dueAt: Date | null;
    latePolicy: TestLatePolicy;
  }): boolean {
    return Boolean(
      release.dueAt &&
      release.dueAt <= new Date() &&
      release.latePolicy === TestLatePolicy.DISALLOW,
    );
  }

  private async lockRelease(
    transaction: Prisma.TransactionClient,
    releaseId: string,
  ): Promise<void> {
    await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id"
      FROM "TestRelease"
      WHERE "id" = ${releaseId}
      FOR UPDATE
    `);
  }

  private validateResponse(
    type: AssignmentType,
    schemaVersion: number,
    publicConfig: Prisma.JsonValue,
    responseData: unknown,
    requireContent: boolean,
  ): Prisma.InputJsonValue {
    if (
      requireContent &&
      !this.hasResponseContent(type, responseData, publicConfig)
    ) {
      throw new BadRequestException({
        code: 'TEST_ANSWER_REQUIRED',
        message: 'Answer every question before submitting the test',
      });
    }
    const validationConfig =
      !requireContent &&
      type === AssignmentType.WRITTEN &&
      this.isRecord(publicConfig)
        ? { ...publicConfig, minLength: 0 }
        : publicConfig;
    const result = validateAssignmentStudentResponse(
      type,
      schemaVersion,
      responseData,
      validationConfig,
    );
    if (!result.success) {
      throw new BadRequestException({
        code: 'INVALID_TEST_ANSWER',
        message: 'The test answer is invalid',
        issues: result.issues,
      });
    }
    return result.data as Prisma.InputJsonValue;
  }

  private hasResponseContent(
    type: AssignmentType,
    response: unknown,
    publicConfig: Prisma.JsonValue,
  ): boolean {
    if (!this.isRecord(response)) {
      return false;
    }
    if (type === AssignmentType.WRITTEN) {
      return (
        typeof response.text === 'string' && response.text.trim().length > 0
      );
    }
    if (
      type === AssignmentType.SINGLE_CHOICE ||
      type === AssignmentType.MULTIPLE_CHOICE
    ) {
      return (
        Array.isArray(response.selectedOptionIds) &&
        response.selectedOptionIds.length > 0
      );
    }
    if (type === AssignmentType.MATCHING) {
      if (!Array.isArray(response.matches) || !this.isRecord(publicConfig)) {
        return false;
      }
      return (
        Array.isArray(publicConfig.leftItems) &&
        publicConfig.leftItems.length > 0 &&
        response.matches.length === publicConfig.leftItems.length
      );
    }
    if (type === AssignmentType.ORDERING) {
      if (
        !Array.isArray(response.orderedItemIds) ||
        !this.isRecord(publicConfig)
      ) {
        return false;
      }
      return (
        Array.isArray(publicConfig.items) &&
        publicConfig.items.length > 0 &&
        response.orderedItemIds.length === publicConfig.items.length
      );
    }
    if (type === AssignmentType.CATEGORIZATION) {
      return (
        Array.isArray(response.assignments) &&
        this.isRecord(publicConfig) &&
        Array.isArray(publicConfig.items) &&
        publicConfig.items.length > 0 &&
        response.assignments.length === publicConfig.items.length
      );
    }
    if (type === AssignmentType.FILL_BLANKS) {
      if (
        !Array.isArray(response.answers) ||
        !this.isRecord(publicConfig) ||
        !Array.isArray(publicConfig.segments)
      )
        return false;
      const blankCount = publicConfig.segments.filter(
        (segment) => this.isRecord(segment) && segment.type === 'BLANK',
      ).length;
      return (
        blankCount > 0 &&
        response.answers.length === blankCount &&
        response.answers.every(
          (answer) =>
            this.isRecord(answer) &&
            typeof answer.text === 'string' &&
            answer.text.trim().length > 0,
        )
      );
    }
    if (type === AssignmentType.IMAGE_HOTSPOT) {
      return typeof response.x === 'number' && typeof response.y === 'number';
    }
    return false;
  }

  private emptyResponse(type: AssignmentType): Prisma.InputJsonValue {
    if (type === AssignmentType.WRITTEN) {
      return { text: '', attachmentIds: [] };
    }
    if (
      type === AssignmentType.SINGLE_CHOICE ||
      type === AssignmentType.MULTIPLE_CHOICE
    ) {
      return { selectedOptionIds: [] };
    }
    if (type === AssignmentType.MATCHING) {
      return { matches: [] };
    }
    if (type === AssignmentType.ORDERING) {
      return { orderedItemIds: [] };
    }
    if (type === AssignmentType.CATEGORIZATION) return { assignments: [] };
    if (type === AssignmentType.FILL_BLANKS) return { answers: [] };
    if (type === AssignmentType.IMAGE_HOTSPOT) return {};
    return {};
  }

  private async findAttemptDto(
    transaction: Prisma.TransactionClient,
    attemptId: string,
  ): Promise<StudentTestAttemptDto> {
    const attempt = await transaction.testAttempt.findUnique({
      where: { id: attemptId },
      select: attemptSelect,
    });
    if (!attempt) {
      throw this.attemptNotFound();
    }
    return this.toAttemptDto(attempt);
  }

  private toReleaseDto(
    release: StudentReleaseRecord,
    stateStatus: TestStudentStatus,
    attempt: AttemptRecord | null,
    studentId: string,
    revealItems: boolean,
  ): StudentLessonTestDto {
    const items = [...release.revision.items];
    if (release.revision.shuffleItems) {
      items.sort((left, right) =>
        this.stableRank(`${release.id}:${studentId}`, left.id).localeCompare(
          this.stableRank(`${release.id}:${studentId}`, right.id),
        ),
      );
    }
    return new StudentLessonTestDto({
      releaseId: release.id,
      testId: release.testId,
      testRevisionId: release.testRevisionId,
      title: release.revision.title,
      description: release.revision.description,
      instructions: release.revision.instructions,
      maxPoints: Number(release.maxPoints),
      passingPercent: Number(release.passingPercent),
      isRequired: release.isRequired,
      maxAttempts: release.maxAttempts,
      timeLimitSeconds: release.timeLimitSeconds,
      dueAt: release.dueAt,
      stateStatus,
      itemCount: items.length,
      items: revealItems
        ? items.map(
            (item, index) =>
              new StudentTestItemDto({
                id: item.id,
                position: index,
                maxPoints: Number(item.maxPoints),
                assignmentId: item.assignmentId,
                assignmentRevisionId: item.assignmentRevisionId,
                type: item.assignment.type,
                title: item.assignmentRevision.title,
                prompt: item.assignmentRevision.prompt,
                instructions: item.assignmentRevision.instructions,
                publicConfig: this.toStudentPublicConfig(
                  item.assignment.type,
                  item.assignmentRevision.publicConfig,
                  `${release.id}:${studentId}:${item.id}`,
                ),
              }),
          )
        : [],
      attempt: attempt ? this.toAttemptDto(attempt) : null,
    });
  }

  private toAttemptDto(attempt: AttemptRecord): StudentTestAttemptDto {
    return new StudentTestAttemptDto({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      maxPoints: Number(attempt.maxPoints),
      scorePoints:
        attempt.scorePoints === null ? null : Number(attempt.scorePoints),
      scorePercent:
        attempt.scorePercent === null ? null : Number(attempt.scorePercent),
      isPassed: attempt.isPassed,
      pendingReviewCount: attempt.pendingReviewCount,
      answers: attempt.answers.map(
        (answer) =>
          new StudentTestAnswerDto({
            id: answer.id,
            testItemId: answer.testItemId,
            status: answer.status,
            responseData: this.toJsonObject(answer.responseData),
            maxPoints: Number(answer.maxPoints),
            scorePoints:
              answer.scorePoints === null ? null : Number(answer.scorePoints),
            scorePercent:
              answer.scorePercent === null ? null : Number(answer.scorePercent),
            isCorrect: answer.isCorrect,
            teacherComment: answer.teacherComment,
          }),
      ),
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      submittedAt: attempt.submittedAt,
      gradedAt: attempt.gradedAt,
    });
  }

  private resolveStudentStatus(
    release: StudentReleaseRecord,
    persisted: TestStudentStatus | undefined,
    now: Date,
  ): TestStudentStatus {
    const status = persisted ?? TestStudentStatus.NOT_STARTED;
    if (
      status !== TestStudentStatus.AWAITING_REVIEW &&
      status !== TestStudentStatus.COMPLETED &&
      release.dueAt &&
      release.dueAt < now &&
      release.latePolicy === TestLatePolicy.DISALLOW
    ) {
      return TestStudentStatus.EXPIRED;
    }
    return status;
  }

  private toJsonObject(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> {
    return this.isRecord(value) ? { ...value } : {};
  }

  private toStudentPublicConfig(
    type: AssignmentType,
    value: Prisma.JsonValue,
    seed: string,
  ): Record<string, unknown> {
    const config = this.toJsonObject(value);
    if (
      (type === AssignmentType.SINGLE_CHOICE ||
        type === AssignmentType.MULTIPLE_CHOICE) &&
      config.shuffleOptions === true &&
      Array.isArray(config.options)
    ) {
      const options = config.options
        .filter((option): option is Record<string, unknown> =>
          this.isRecord(option),
        )
        .map((option) => ({ ...option }));
      options.sort((left, right) =>
        this.stableRank(seed, String(left.id)).localeCompare(
          this.stableRank(seed, String(right.id)),
        ),
      );
      return { ...config, options };
    }
    if (
      type === AssignmentType.MATCHING &&
      config.shuffleRightItems === true &&
      Array.isArray(config.rightItems)
    ) {
      const rightItems = config.rightItems
        .filter((item): item is Record<string, unknown> => this.isRecord(item))
        .map((item) => ({ ...item }));
      rightItems.sort((left, right) =>
        this.stableRank(seed, String(left.id)).localeCompare(
          this.stableRank(seed, String(right.id)),
        ),
      );
      return { ...config, rightItems };
    }
    if (type === AssignmentType.ORDERING && Array.isArray(config.items)) {
      const sourceItems = config.items.filter(
        (item): item is Record<string, unknown> => this.isRecord(item),
      );
      const items = sourceItems.map((item) => ({ ...item }));
      items.sort((left, right) =>
        this.stableRank(seed, String(left.id)).localeCompare(
          this.stableRank(seed, String(right.id)),
        ),
      );
      if (
        items.length > 1 &&
        items.every((item, index) => item.id === sourceItems[index]?.id)
      ) {
        items.push(items.shift()!);
      }
      return { ...config, items };
    }
    if (type === AssignmentType.CATEGORIZATION && Array.isArray(config.items)) {
      const sourceItems = config.items.filter(
        (item): item is Record<string, unknown> => this.isRecord(item),
      );
      const items = this.shuffleRecords(sourceItems, seed);
      return { ...config, items };
    }
    if (
      type === AssignmentType.FILL_BLANKS &&
      config.wordBankEnabled === true &&
      Array.isArray(config.wordBank)
    ) {
      const words = config.wordBank.filter(
        (item): item is Record<string, unknown> => this.isRecord(item),
      );
      return { ...config, wordBank: this.shuffleRecords(words, seed) };
    }
    return config;
  }

  private shuffleRecords(
    source: Record<string, unknown>[],
    seed: string,
  ): Record<string, unknown>[] {
    const values = source.map((value) => ({ ...value }));
    values.sort((left, right) =>
      this.stableRank(seed, String(left.id)).localeCompare(
        this.stableRank(seed, String(right.id)),
      ),
    );
    if (
      values.length > 1 &&
      values.every((value, index) => value.id === source[index]?.id)
    ) {
      values.push(values.shift()!);
    }
    return values;
  }

  private stableRank(seed: string, value: string): string {
    return createHash('sha256').update(`${seed}:${value}`).digest('hex');
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private preserveCompletedState(
    bestPercent: Prisma.Decimal | null,
    release: {
      passingPercent: Prisma.Decimal;
      scorePolicy: TestScorePolicy;
    },
  ): boolean {
    return (
      release.scorePolicy === TestScorePolicy.BEST &&
      bestPercent !== null &&
      Number(bestPercent) >= Number(release.passingPercent)
    );
  }

  private async markAttemptExpired(
    transaction: Prisma.TransactionClient,
    attemptId: string,
    studentStateId: string,
    bestPercent: Prisma.Decimal | null,
    release: {
      passingPercent: Prisma.Decimal;
      scorePolicy: TestScorePolicy;
    },
  ): Promise<void> {
    const expiredAt = new Date();
    await transaction.testAttempt.updateMany({
      where: { id: attemptId, status: TestAttemptStatus.IN_PROGRESS },
      data: { status: TestAttemptStatus.EXPIRED },
    });
    await transaction.testStudentState.update({
      where: { id: studentStateId },
      data: {
        status: this.preserveCompletedState(bestPercent, release)
          ? TestStudentStatus.COMPLETED
          : TestStudentStatus.EXPIRED,
        lastActivityAt: expiredAt,
      },
    });
  }

  private async markAttemptCancelled(
    transaction: Prisma.TransactionClient,
    attemptId: string,
    studentStateId: string,
    bestPercent: Prisma.Decimal | null,
    release: {
      passingPercent: Prisma.Decimal;
      scorePolicy: TestScorePolicy;
    },
  ): Promise<void> {
    const cancelledAt = new Date();
    await transaction.testAttempt.updateMany({
      where: { id: attemptId, status: TestAttemptStatus.IN_PROGRESS },
      data: { status: TestAttemptStatus.CANCELLED },
    });
    await transaction.testStudentState.update({
      where: { id: studentStateId },
      data: {
        status: this.preserveCompletedState(bestPercent, release)
          ? TestStudentStatus.COMPLETED
          : TestStudentStatus.EXPIRED,
        lastActivityAt: cancelledAt,
      },
    });
  }

  private assertStudent(user: AuthUser): void {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only students can complete tests',
      });
    }
  }

  private lessonNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'LESSON_NOT_FOUND',
      message: 'Lesson not found',
    });
  }

  private releaseNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'TEST_RELEASE_NOT_FOUND',
      message: 'Test release not found',
    });
  }

  private attemptNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'TEST_ATTEMPT_NOT_FOUND',
      message: 'Test attempt not found',
    });
  }

  private answerNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'TEST_ANSWER_NOT_FOUND',
      message: 'Test answer not found',
    });
  }

  private attemptLocked(): ConflictException {
    return new ConflictException({
      code: 'TEST_ATTEMPT_LOCKED',
      message: 'This test attempt is locked',
    });
  }

  private timeExpired(): ConflictException {
    return new ConflictException({
      code: 'TEST_TIME_EXPIRED',
      message: 'The time limit for this attempt has expired',
    });
  }

  private testClosed(): ConflictException {
    return new ConflictException({
      code: 'TEST_CLOSED',
      message: 'This test no longer accepts responses',
    });
  }
}
