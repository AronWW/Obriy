import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentAttemptStatus,
  AssignmentReviewAction,
  AssignmentStudentStatus,
  AssignmentType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  AssignmentReviewDecision,
  ReviewAssignmentAttemptDto,
} from './dto/review-assignment-attempt.dto';
import {
  AssignmentReviewClassDto,
  AssignmentReviewStudentDto,
  TeacherAssignmentReviewDto,
} from './dto/teacher-assignment-review-response.dto';

const reviewableAttemptStatuses: AssignmentAttemptStatus[] = [
  AssignmentAttemptStatus.AWAITING_REVIEW,
  AssignmentAttemptStatus.GRADED,
  AssignmentAttemptStatus.RETURNED,
];

const teacherAttemptSelect = {
  id: true,
  attemptNumber: true,
  status: true,
  responseData: true,
  scorePoints: true,
  scorePercent: true,
  isPassed: true,
  teacherComment: true,
  submittedAt: true,
  reviewedAt: true,
  updatedAt: true,
} satisfies Prisma.AssignmentAttemptSelect;

const reviewStateSelect = {
  id: true,
  status: true,
  bestPoints: true,
  bestPercent: true,
  student: {
    select: {
      id: true,
      profile: { select: { displayName: true } },
    },
  },
  release: {
    select: {
      id: true,
      assignmentId: true,
      maxPoints: true,
      passingPercent: true,
      class: { select: { id: true, name: true } },
      assignment: { select: { type: true } },
      revision: { select: { title: true, prompt: true } },
    },
  },
  attempts: {
    where: { status: { in: reviewableAttemptStatuses } },
    orderBy: { attemptNumber: 'desc' },
    take: 1,
    select: teacherAttemptSelect,
  },
} satisfies Prisma.AssignmentStudentStateSelect;

const reviewAttemptDetailSelect = {
  ...teacherAttemptSelect,
  studentStateId: true,
  studentState: {
    select: {
      id: true,
      status: true,
      bestPoints: true,
      bestPercent: true,
      student: {
        select: {
          id: true,
          profile: { select: { displayName: true } },
        },
      },
      release: {
        select: {
          id: true,
          lessonId: true,
          assignmentId: true,
          maxPoints: true,
          passingPercent: true,
          class: { select: { id: true, name: true } },
          assignment: {
            select: { type: true, teacherId: true },
          },
          revision: { select: { title: true, prompt: true } },
          lesson: { select: { teacherId: true } },
        },
      },
    },
  },
} satisfies Prisma.AssignmentAttemptSelect;

type ReviewStateRecord = Prisma.AssignmentStudentStateGetPayload<{
  select: typeof reviewStateSelect;
}>;
type ReviewAttemptRecord = Prisma.AssignmentAttemptGetPayload<{
  select: typeof reviewAttemptDetailSelect;
}>;

@Injectable()
export class AssignmentReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listLessonReviews(
    user: AuthUser,
    lessonId: string,
  ): Promise<TeacherAssignmentReviewDto[]> {
    this.assertTeacher(user);
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, teacherId: user.id },
      select: { id: true },
    });
    if (!lesson) {
      throw this.lessonNotFound();
    }

    const states = await this.prisma.assignmentStudentState.findMany({
      where: {
        status: {
          in: [
            AssignmentStudentStatus.AWAITING_REVIEW,
            AssignmentStudentStatus.NEEDS_REVISION,
            AssignmentStudentStatus.COMPLETED,
          ],
        },
        release: { lessonId },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: reviewStateSelect,
    });

    return states.flatMap((state) => {
      const attempt = state.attempts[0];
      return attempt ? [this.toListDto(state, attempt)] : [];
    });
  }

  async review(
    user: AuthUser,
    attemptId: string,
    dto: ReviewAssignmentAttemptDto,
  ): Promise<TeacherAssignmentReviewDto> {
    this.assertTeacher(user);
    this.validateReviewInput(dto);

    return this.prisma.$transaction(async (transaction) => {
      const ownedAttempt = await transaction.assignmentAttempt.findFirst({
        where: {
          id: attemptId,
          studentState: {
            release: {
              OR: [
                { lesson: { teacherId: user.id } },
                { assignment: { teacherId: user.id } },
              ],
            },
          },
        },
        select: { studentStateId: true },
      });
      if (!ownedAttempt) {
        throw this.attemptNotFound();
      }

      await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id"
        FROM "AssignmentStudentState"
        WHERE "id" = ${ownedAttempt.studentStateId}
        FOR UPDATE
      `);
      await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id"
        FROM "AssignmentAttempt"
        WHERE "id" = ${attemptId}
        FOR UPDATE
      `);

      const current = await transaction.assignmentAttempt.findUnique({
        where: { id: attemptId },
        select: reviewAttemptDetailSelect,
      });
      if (!current || !this.isOwnedBy(current, user.id)) {
        throw this.attemptNotFound();
      }
      if (
        current.status !== AssignmentAttemptStatus.AWAITING_REVIEW ||
        current.studentState.status !== AssignmentStudentStatus.AWAITING_REVIEW
      ) {
        throw new ConflictException({
          code: 'ASSIGNMENT_ATTEMPT_NOT_REVIEWABLE',
          message: 'This assignment attempt is not awaiting review',
        });
      }
      if (
        current.studentState.release.assignment.type !== AssignmentType.WRITTEN
      ) {
        throw new ConflictException({
          code: 'ASSIGNMENT_REVIEW_NOT_MANUAL',
          message: 'This assignment type is not reviewed manually',
        });
      }

      const reviewedAt = new Date();
      const previousData: Prisma.InputJsonObject = {
        status: current.status,
        scorePoints: current.scorePoints?.toString() ?? null,
        scorePercent: current.scorePercent?.toString() ?? null,
        teacherComment: current.teacherComment,
      };

      if (dto.decision === AssignmentReviewDecision.RETURNED) {
        await transaction.assignmentAttempt.update({
          where: { id: current.id },
          data: {
            status: AssignmentAttemptStatus.RETURNED,
            reviewedById: user.id,
            teacherComment: dto.teacherComment,
            scorePoints: null,
            scorePercent: null,
            isPassed: null,
            reviewedAt,
          },
        });
        await transaction.assignmentStudentState.update({
          where: { id: current.studentStateId },
          data: {
            status: AssignmentStudentStatus.NEEDS_REVISION,
            scorePoints: null,
            scorePercent: null,
            completedAt: null,
          },
        });
        await transaction.assignmentReviewEvent.create({
          data: {
            attemptId: current.id,
            reviewerId: user.id,
            action: AssignmentReviewAction.RETURNED,
            previousData,
            nextData: {
              status: AssignmentAttemptStatus.RETURNED,
              teacherComment: dto.teacherComment ?? null,
            },
            comment: dto.teacherComment,
          },
        });
      } else {
        const maxPoints = Number(current.studentState.release.maxPoints);
        const scorePoints = this.normalizeScore(dto.scorePoints, maxPoints);
        const scorePercent = this.toPercent(scorePoints, maxPoints);
        const isPassed =
          scorePercent >= Number(current.studentState.release.passingPercent);
        const bestPoints = Math.max(
          scorePoints,
          Number(current.studentState.bestPoints ?? 0),
        );
        const bestPercent = Math.max(
          scorePercent,
          Number(current.studentState.bestPercent ?? 0),
        );

        await transaction.assignmentAttempt.update({
          where: { id: current.id },
          data: {
            status: AssignmentAttemptStatus.GRADED,
            reviewedById: user.id,
            gradingData: { mode: 'MANUAL' },
            scorePoints,
            scorePercent,
            isPassed,
            teacherComment: dto.teacherComment ?? null,
            gradedAt: reviewedAt,
            reviewedAt,
          },
        });
        await transaction.assignmentStudentState.update({
          where: { id: current.studentStateId },
          data: {
            status: AssignmentStudentStatus.COMPLETED,
            scorePoints,
            scorePercent,
            bestPoints,
            bestPercent,
            completedAt: reviewedAt,
          },
        });
        await transaction.assignmentReviewEvent.create({
          data: {
            attemptId: current.id,
            reviewerId: user.id,
            action: AssignmentReviewAction.APPROVED,
            previousData,
            nextData: {
              status: AssignmentAttemptStatus.GRADED,
              scorePoints,
              scorePercent,
              isPassed,
              teacherComment: dto.teacherComment ?? null,
            },
            comment: dto.teacherComment ?? null,
          },
        });
      }

      const reviewed = await transaction.assignmentAttempt.findUnique({
        where: { id: current.id },
        select: reviewAttemptDetailSelect,
      });
      if (!reviewed) {
        throw this.attemptNotFound();
      }
      return this.toDetailDto(reviewed);
    });
  }

  private validateReviewInput(dto: ReviewAssignmentAttemptDto): void {
    if (
      dto.decision === AssignmentReviewDecision.APPROVED &&
      dto.scorePoints === undefined
    ) {
      throw new BadRequestException({
        code: 'ASSIGNMENT_REVIEW_SCORE_REQUIRED',
        message: 'A score is required to approve this attempt',
      });
    }
    if (
      dto.decision === AssignmentReviewDecision.RETURNED &&
      (!dto.teacherComment || dto.teacherComment.trim().length === 0)
    ) {
      throw new BadRequestException({
        code: 'ASSIGNMENT_REVIEW_COMMENT_REQUIRED',
        message: 'A comment is required when returning an attempt',
      });
    }
    if (
      dto.decision === AssignmentReviewDecision.RETURNED &&
      dto.scorePoints !== undefined
    ) {
      throw new BadRequestException({
        code: 'ASSIGNMENT_REVIEW_SCORE_NOT_ALLOWED',
        message: 'A returned attempt cannot receive a final score',
      });
    }
  }

  private normalizeScore(score: number | undefined, maxPoints: number): number {
    if (score === undefined || !Number.isFinite(score)) {
      throw new BadRequestException({
        code: 'ASSIGNMENT_REVIEW_SCORE_REQUIRED',
        message: 'A score is required to approve this attempt',
      });
    }
    if (score < 0 || score > maxPoints) {
      throw new BadRequestException({
        code: 'ASSIGNMENT_REVIEW_SCORE_OUT_OF_RANGE',
        message: 'The score must be within the assignment point range',
        maxPoints,
      });
    }
    return Math.round(score * 100) / 100;
  }

  private toPercent(scorePoints: number, maxPoints: number): number {
    return Math.round((scorePoints / maxPoints) * 10_000) / 100;
  }

  private toListDto(
    state: ReviewStateRecord,
    attempt: ReviewStateRecord['attempts'][number],
  ): TeacherAssignmentReviewDto {
    return this.createDto({ state, attempt });
  }

  private toDetailDto(
    attempt: ReviewAttemptRecord,
  ): TeacherAssignmentReviewDto {
    return this.createDto({ state: attempt.studentState, attempt });
  }

  private createDto({
    state,
    attempt,
  }: {
    state: {
      student: ReviewStateRecord['student'];
      release: ReviewStateRecord['release'];
    };
    attempt: ReviewStateRecord['attempts'][number];
  }): TeacherAssignmentReviewDto {
    return new TeacherAssignmentReviewDto({
      attemptId: attempt.id,
      releaseId: state.release.id,
      assignmentId: state.release.assignmentId,
      type: state.release.assignment.type,
      assignmentTitle: state.release.revision.title,
      prompt: state.release.revision.prompt,
      responseText: this.readResponseText(attempt.responseData),
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      maxPoints: Number(state.release.maxPoints),
      passingPercent: Number(state.release.passingPercent),
      scorePoints:
        attempt.scorePoints === null ? null : Number(attempt.scorePoints),
      scorePercent:
        attempt.scorePercent === null ? null : Number(attempt.scorePercent),
      isPassed: attempt.isPassed,
      teacherComment: attempt.teacherComment,
      submittedAt: attempt.submittedAt,
      reviewedAt: attempt.reviewedAt,
      updatedAt: attempt.updatedAt,
      student: new AssignmentReviewStudentDto({
        id: state.student.id,
        displayName: state.student.profile?.displayName ?? 'Student',
      }),
      class: new AssignmentReviewClassDto({
        id: state.release.class.id,
        name: state.release.class.name,
      }),
    });
  }

  private readResponseText(responseData: Prisma.JsonValue | null): string {
    if (
      responseData &&
      typeof responseData === 'object' &&
      !Array.isArray(responseData) &&
      typeof responseData.text === 'string'
    ) {
      return responseData.text;
    }
    return '';
  }

  private isOwnedBy(attempt: ReviewAttemptRecord, teacherId: string): boolean {
    const release = attempt.studentState.release;
    return (
      release.lesson?.teacherId === teacherId ||
      release.assignment.teacherId === teacherId
    );
  }

  private assertTeacher(user: AuthUser): void {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only teachers can review assignment attempts',
      });
    }
  }

  private lessonNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'LESSON_NOT_FOUND',
      message: 'Lesson not found',
    });
  }

  private attemptNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'ASSIGNMENT_ATTEMPT_NOT_FOUND',
      message: 'Assignment attempt not found',
    });
  }
}
