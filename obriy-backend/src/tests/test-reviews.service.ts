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
  TestReviewAction,
  TestStudentStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  mapPresetSelect,
  toMapPresetDto,
} from '../map-presets/map-preset.mapper';
import {
  ReviewTestAnswerDto,
  ListTestReviewsQueryDto,
  TeacherChoiceReviewOptionDto,
  TeacherTestReviewListDto,
  TeacherTestAnswerReviewDto,
  TeacherTestAttemptReviewDto,
  TestAnswerReviewDecision,
} from './dto/test-review.dto';
import { TestAttemptScoringService } from './test-attempt-scoring.service';

const reviewableAttemptStatuses: TestAttemptStatus[] = [
  TestAttemptStatus.AWAITING_REVIEW,
  TestAttemptStatus.GRADED,
  TestAttemptStatus.RETURNED,
];
const DEFAULT_REVIEW_PAGE_SIZE = 20;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const teacherAttemptSelect = {
  id: true,
  attemptNumber: true,
  status: true,
  maxPoints: true,
  scorePoints: true,
  scorePercent: true,
  isPassed: true,
  pendingReviewCount: true,
  submittedAt: true,
  gradedAt: true,
  createdAt: true,
  studentState: {
    select: {
      student: {
        select: {
          id: true,
          profile: { select: { displayName: true } },
        },
      },
      release: {
        select: {
          id: true,
          testId: true,
          lessonId: true,
          class: { select: { id: true, name: true } },
          test: { select: { teacherId: true } },
          revision: { select: { title: true } },
          lesson: { select: { teacherId: true } },
        },
      },
    },
  },
  answers: {
    orderBy: { testItem: { position: 'asc' as const } },
    select: {
      id: true,
      testItemId: true,
      status: true,
      responseData: true,
      maxPoints: true,
      scorePoints: true,
      scorePercent: true,
      isCorrect: true,
      gradingData: true,
      teacherComment: true,
      testItem: {
        select: {
          assignment: { select: { type: true } },
          assignmentRevision: {
            select: {
              title: true,
              prompt: true,
              publicConfig: true,
              mapPreset: { select: mapPresetSelect },
              solution: { select: { gradingConfig: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.TestAttemptSelect;

type TeacherAttemptRecord = Prisma.TestAttemptGetPayload<{
  select: typeof teacherAttemptSelect;
}>;

@Injectable()
export class TestReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attemptScoring: TestAttemptScoringService,
  ) {}

  async listLessonReviews(
    user: AuthUser,
    lessonId: string,
    query: ListTestReviewsQueryDto,
  ): Promise<TeacherTestReviewListDto> {
    this.assertTeacher(user);
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, teacherId: user.id },
      select: { id: true },
    });
    if (!lesson) {
      throw this.lessonNotFound();
    }
    const limit = query.limit ?? DEFAULT_REVIEW_PAGE_SIZE;
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;
    const attempts = await this.prisma.testAttempt.findMany({
      where: {
        status: { in: reviewableAttemptStatuses },
        studentState: { release: { lessonId } },
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: teacherAttemptSelect,
    });
    const hasNextPage = attempts.length > limit;
    const page = attempts.slice(0, limit);
    return new TeacherTestReviewListDto({
      items: page.map((attempt) => this.toDto(attempt)),
      nextCursor: hasNextPage ? this.encodeCursor(page.at(-1) ?? null) : null,
    });
  }

  async reviewAnswer(
    user: AuthUser,
    answerId: string,
    dto: ReviewTestAnswerDto,
  ): Promise<TeacherTestAttemptReviewDto> {
    this.assertTeacher(user);
    this.validateReviewInput(dto);
    return this.prisma.$transaction(async (transaction) => {
      const owned = await transaction.testAnswer.findFirst({
        where: {
          id: answerId,
          testAttempt: {
            studentState: {
              release: {
                OR: [
                  { lesson: { teacherId: user.id } },
                  { test: { teacherId: user.id } },
                ],
              },
            },
          },
        },
        select: { id: true, testAttemptId: true },
      });
      if (!owned) {
        throw this.answerNotFound();
      }
      await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id"
        FROM "TestAttempt"
        WHERE "id" = ${owned.testAttemptId}
        FOR UPDATE
      `);
      await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id"
        FROM "TestAnswer"
        WHERE "id" = ${answerId}
        FOR UPDATE
      `);
      const answer = await transaction.testAnswer.findUnique({
        where: { id: answerId },
        select: {
          id: true,
          testAttemptId: true,
          status: true,
          maxPoints: true,
          scorePoints: true,
          scorePercent: true,
          teacherComment: true,
          testItem: { select: { assignment: { select: { type: true } } } },
          testAttempt: {
            select: {
              status: true,
              pendingReviewCount: true,
              studentState: {
                select: {
                  id: true,
                  bestPercent: true,
                  release: {
                    select: {
                      passingPercent: true,
                      scorePolicy: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!answer) {
        throw this.answerNotFound();
      }
      if (
        answer.status !== TestAnswerStatus.AWAITING_REVIEW ||
        answer.testAttempt.status !== TestAttemptStatus.AWAITING_REVIEW
      ) {
        throw new ConflictException({
          code: 'TEST_ANSWER_NOT_REVIEWABLE',
          message: 'This test answer is not awaiting review',
        });
      }
      if (answer.testItem.assignment.type !== AssignmentType.WRITTEN) {
        throw new ConflictException({
          code: 'TEST_ANSWER_REVIEW_NOT_MANUAL',
          message: 'This answer type is graded automatically',
        });
      }

      const reviewedAt = new Date();
      const previousData: Prisma.InputJsonObject = {
        status: answer.status,
        scorePoints: answer.scorePoints?.toString() ?? null,
        scorePercent: answer.scorePercent?.toString() ?? null,
        teacherComment: answer.teacherComment,
      };
      if (dto.decision === TestAnswerReviewDecision.RETURNED) {
        await transaction.testAnswer.update({
          where: { id: answer.id },
          data: {
            status: TestAnswerStatus.RETURNED,
            reviewedById: user.id,
            teacherComment: dto.teacherComment,
            scorePoints: null,
            scorePercent: null,
            isCorrect: null,
            reviewedAt,
          },
        });
        await transaction.testAnswer.updateMany({
          where: {
            testAttemptId: answer.testAttemptId,
            id: { not: answer.id },
            status: TestAnswerStatus.AWAITING_REVIEW,
          },
          data: { status: TestAnswerStatus.RETURNED },
        });
        await transaction.testAttempt.update({
          where: { id: answer.testAttemptId },
          data: {
            status: TestAttemptStatus.RETURNED,
            pendingReviewCount: 0,
          },
        });
        const priorBestStillPasses =
          answer.testAttempt.studentState.release.scorePolicy === 'BEST' &&
          answer.testAttempt.studentState.bestPercent !== null &&
          Number(answer.testAttempt.studentState.bestPercent) >=
            Number(answer.testAttempt.studentState.release.passingPercent);
        await transaction.testStudentState.update({
          where: { id: answer.testAttempt.studentState.id },
          data: {
            status: priorBestStillPasses
              ? TestStudentStatus.COMPLETED
              : TestStudentStatus.NEEDS_REVISION,
            completedAt: priorBestStillPasses ? undefined : null,
          },
        });
        await transaction.testAnswerReviewEvent.create({
          data: {
            testAnswerId: answer.id,
            reviewerId: user.id,
            action: TestReviewAction.RETURNED,
            previousData,
            nextData: {
              status: TestAnswerStatus.RETURNED,
              teacherComment: dto.teacherComment ?? null,
            },
            comment: dto.teacherComment,
          },
        });
      } else {
        const maxPoints = Number(answer.maxPoints);
        const scorePoints = this.normalizeScore(dto.scorePoints, maxPoints);
        const scorePercent =
          maxPoints > 0
            ? Math.round((scorePoints / maxPoints) * 10_000) / 100
            : 0;
        await transaction.testAnswer.update({
          where: { id: answer.id },
          data: {
            status: TestAnswerStatus.GRADED,
            reviewedById: user.id,
            gradingData: { mode: 'MANUAL' },
            scorePoints,
            scorePercent,
            isCorrect: scorePoints === maxPoints,
            teacherComment: dto.teacherComment ?? null,
            gradedAt: reviewedAt,
            reviewedAt,
          },
        });
        const pendingReviewCount = Math.max(
          0,
          answer.testAttempt.pendingReviewCount - 1,
        );
        await transaction.testAttempt.update({
          where: { id: answer.testAttemptId },
          data: { pendingReviewCount },
        });
        await transaction.testAnswerReviewEvent.create({
          data: {
            testAnswerId: answer.id,
            reviewerId: user.id,
            action: TestReviewAction.APPROVED,
            previousData,
            nextData: {
              status: TestAnswerStatus.GRADED,
              scorePoints,
              scorePercent,
              teacherComment: dto.teacherComment ?? null,
            },
            comment: dto.teacherComment ?? null,
          },
        });
        if (pendingReviewCount === 0) {
          await this.attemptScoring.finalize(
            transaction,
            answer.testAttemptId,
            reviewedAt,
          );
        }
      }

      const reviewed = await transaction.testAttempt.findUnique({
        where: { id: answer.testAttemptId },
        select: teacherAttemptSelect,
      });
      if (!reviewed) {
        throw this.answerNotFound();
      }
      return this.toDto(reviewed);
    });
  }

  private validateReviewInput(dto: ReviewTestAnswerDto): void {
    if (
      dto.decision === TestAnswerReviewDecision.APPROVED &&
      dto.scorePoints === undefined
    ) {
      throw new BadRequestException({
        code: 'TEST_REVIEW_SCORE_REQUIRED',
        message: 'A score is required to approve this answer',
      });
    }
    if (
      dto.decision === TestAnswerReviewDecision.RETURNED &&
      (!dto.teacherComment || dto.teacherComment.trim().length === 0)
    ) {
      throw new BadRequestException({
        code: 'TEST_REVIEW_COMMENT_REQUIRED',
        message: 'A comment is required when returning an answer',
      });
    }
    if (
      dto.decision === TestAnswerReviewDecision.RETURNED &&
      dto.scorePoints !== undefined
    ) {
      throw new BadRequestException({
        code: 'TEST_REVIEW_SCORE_NOT_ALLOWED',
        message: 'A returned answer cannot receive a final score',
      });
    }
  }

  private normalizeScore(score: number | undefined, maxPoints: number): number {
    if (score === undefined || !Number.isFinite(score)) {
      throw new BadRequestException({
        code: 'TEST_REVIEW_SCORE_REQUIRED',
        message: 'A score is required to approve this answer',
      });
    }
    if (score < 0 || score > maxPoints) {
      throw new BadRequestException({
        code: 'TEST_REVIEW_SCORE_OUT_OF_RANGE',
        message: 'The score must be within the question point range',
        maxPoints,
      });
    }
    return Math.round(score * 100) / 100;
  }

  private toDto(attempt: TeacherAttemptRecord): TeacherTestAttemptReviewDto {
    const release = attempt.studentState.release;
    return new TeacherTestAttemptReviewDto({
      attemptId: attempt.id,
      releaseId: release.id,
      testId: release.testId,
      testTitle: release.revision.title,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      maxPoints: Number(attempt.maxPoints),
      scorePoints:
        attempt.scorePoints === null ? null : Number(attempt.scorePoints),
      scorePercent:
        attempt.scorePercent === null ? null : Number(attempt.scorePercent),
      isPassed: attempt.isPassed,
      pendingReviewCount: attempt.pendingReviewCount,
      studentId: attempt.studentState.student.id,
      studentName:
        attempt.studentState.student.profile?.displayName ?? 'Student',
      classId: release.class.id,
      className: release.class.name,
      answers: attempt.answers.map(
        (answer) =>
          new TeacherTestAnswerReviewDto({
            answerId: answer.id,
            testItemId: answer.testItemId,
            type: answer.testItem.assignment.type,
            title: answer.testItem.assignmentRevision.title,
            prompt: answer.testItem.assignmentRevision.prompt,
            responseData: this.toJsonObject(answer.responseData),
            status: answer.status,
            maxPoints: Number(answer.maxPoints),
            scorePoints:
              answer.scorePoints === null ? null : Number(answer.scorePoints),
            scorePercent:
              answer.scorePercent === null ? null : Number(answer.scorePercent),
            isCorrect: answer.isCorrect,
            teacherComment: answer.teacherComment,
            publicConfig: this.toJsonObject(
              answer.testItem.assignmentRevision.publicConfig,
            ),
            mapPreset: answer.testItem.assignmentRevision.mapPreset
              ? toMapPresetDto(answer.testItem.assignmentRevision.mapPreset)
              : null,
            gradingConfig: this.toJsonObject(
              answer.testItem.assignmentRevision.solution?.gradingConfig ??
                null,
            ),
            gradingData: this.toJsonObject(answer.gradingData),
            choiceOptions: this.toChoiceReviewOptions(
              answer.testItem.assignment.type,
              answer.responseData,
              answer.testItem.assignmentRevision.publicConfig,
              answer.testItem.assignmentRevision.solution?.gradingConfig,
            ),
          }),
      ),
      submittedAt: attempt.submittedAt,
      gradedAt: attempt.gradedAt,
    });
  }

  private toJsonObject(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? { ...value }
      : {};
  }

  private toChoiceReviewOptions(
    type: AssignmentType,
    responseData: Prisma.JsonValue | null,
    publicConfig: Prisma.JsonValue,
    gradingConfig: Prisma.JsonValue | undefined,
  ): TeacherChoiceReviewOptionDto[] | null {
    if (
      type !== AssignmentType.SINGLE_CHOICE &&
      type !== AssignmentType.MULTIPLE_CHOICE
    ) {
      return null;
    }
    const response = this.toJsonObject(responseData);
    const config = this.toJsonObject(publicConfig);
    const grading = this.toJsonObject(gradingConfig ?? null);
    const selected = new Set(
      Array.isArray(response.selectedOptionIds)
        ? response.selectedOptionIds.filter(
            (value): value is string => typeof value === 'string',
          )
        : [],
    );
    const correct = new Set(
      Array.isArray(grading.correctOptionIds)
        ? grading.correctOptionIds.filter(
            (value): value is string => typeof value === 'string',
          )
        : [],
    );
    if (!Array.isArray(config.options)) {
      return [];
    }
    return config.options.flatMap((value) => {
      const option = this.toJsonObject(value as Prisma.JsonValue);
      if (typeof option.id !== 'string' || typeof option.text !== 'string') {
        return [];
      }
      return [
        new TeacherChoiceReviewOptionDto({
          id: option.id,
          text: option.text,
          selected: selected.has(option.id),
          correct: correct.has(option.id),
        }),
      ];
    });
  }

  private encodeCursor(
    attempt: { id: string; createdAt: Date } | null,
  ): string | null {
    if (!attempt) return null;
    return Buffer.from(
      JSON.stringify({
        createdAt: attempt.createdAt.toISOString(),
        id: attempt.id,
      }),
      'utf8',
    ).toString('base64url');
  }

  private decodeCursor(cursor: string): { createdAt: Date; id: string } {
    try {
      const decoded: unknown = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      );
      if (
        typeof decoded !== 'object' ||
        decoded === null ||
        Array.isArray(decoded) ||
        !('createdAt' in decoded) ||
        !('id' in decoded) ||
        typeof decoded.createdAt !== 'string' ||
        typeof decoded.id !== 'string' ||
        !UUID_PATTERN.test(decoded.id)
      ) {
        throw new Error('Invalid review cursor');
      }
      const createdAt = new Date(decoded.createdAt);
      if (Number.isNaN(createdAt.getTime())) {
        throw new Error('Invalid review cursor date');
      }
      return { createdAt, id: decoded.id };
    } catch {
      throw new BadRequestException({
        code: 'INVALID_TEST_REVIEW_CURSOR',
        message: 'The review cursor is invalid',
      });
    }
  }

  private assertTeacher(user: AuthUser): void {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only teachers can review test attempts',
      });
    }
  }

  private lessonNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'LESSON_NOT_FOUND',
      message: 'Lesson not found',
    });
  }

  private answerNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'TEST_ANSWER_NOT_FOUND',
      message: 'Test answer not found',
    });
  }
}
