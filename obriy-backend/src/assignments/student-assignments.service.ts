import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentAttemptStatus,
  AssignmentLatePolicy,
  AssignmentReleaseStatus,
  AssignmentStudentStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { SaveWrittenAssignmentDraftDto } from './dto/save-written-assignment-draft.dto';
import {
  StudentAssignmentAttemptDto,
  StudentLessonAssignmentDto,
} from './dto/student-assignment-response.dto';
import { validateAssignmentStudentResponse } from './validation';

const studentReleaseSelect = {
  id: true,
  assignmentId: true,
  revisionId: true,
  status: true,
  maxPoints: true,
  passingPercent: true,
  isRequired: true,
  availableFrom: true,
  dueAt: true,
  maxAttempts: true,
  latePolicy: true,
  classId: true,
  lessonId: true,
  assignment: { select: { type: true } },
  revision: {
    select: {
      title: true,
      prompt: true,
      instructions: true,
      publicConfig: true,
      schemaVersion: true,
    },
  },
} satisfies Prisma.AssignmentReleaseSelect;

const attemptSelect = {
  id: true,
  attemptNumber: true,
  status: true,
  responseData: true,
  teacherComment: true,
  scorePoints: true,
  scorePercent: true,
  isPassed: true,
  submittedAt: true,
  reviewedAt: true,
  updatedAt: true,
} satisfies Prisma.AssignmentAttemptSelect;

type StudentReleaseRecord = Prisma.AssignmentReleaseGetPayload<{
  select: typeof studentReleaseSelect;
}>;
type AttemptRecord = Prisma.AssignmentAttemptGetPayload<{
  select: typeof attemptSelect;
}>;

@Injectable()
export class StudentAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listLessonAssignments(
    user: AuthUser,
    lessonId: string,
  ): Promise<StudentLessonAssignmentDto[]> {
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
    const releases = await this.prisma.assignmentRelease.findMany({
      where: {
        lessonId,
        classId: lessonAccess.classId,
        status: AssignmentReleaseStatus.ACTIVE,
        OR: [{ availableFrom: null }, { availableFrom: { lte: now } }],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: studentReleaseSelect,
    });
    if (releases.length === 0) {
      return [];
    }

    const states = await this.prisma.assignmentStudentState.findMany({
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
    const stateByReleaseId = new Map(
      states.map((state) => [state.releaseId, state]),
    );

    return releases.map((release) => {
      const state = stateByReleaseId.get(release.id);
      return new StudentLessonAssignmentDto({
        releaseId: release.id,
        assignmentId: release.assignmentId,
        revisionId: release.revisionId,
        type: release.assignment.type,
        title: release.revision.title,
        prompt: release.revision.prompt,
        instructions: release.revision.instructions,
        publicConfig: this.toJsonObject(release.revision.publicConfig),
        maxPoints: Number(release.maxPoints),
        passingPercent: Number(release.passingPercent),
        isRequired: release.isRequired,
        dueAt: release.dueAt,
        stateStatus: this.resolveStudentStatus(release, state?.status, now),
        attempt: state?.attempts[0]
          ? this.toAttemptDto(state.attempts[0])
          : null,
      });
    });
  }

  async saveDraft(
    user: AuthUser,
    releaseId: string,
    dto: SaveWrittenAssignmentDraftDto,
  ): Promise<StudentAssignmentAttemptDto> {
    this.assertStudent(user);
    return this.prisma.$transaction(async (transaction) => {
      const release = await this.findAccessibleRelease(
        transaction,
        user.id,
        releaseId,
      );
      this.assertReleaseOpen(release);
      const responseData = this.validateResponse(release, dto.text, false);
      const { attempt, stateId } = await this.findOrCreateDraftAttempt(
        transaction,
        user.id,
        release,
      );
      const updated = await transaction.assignmentAttempt.update({
        where: { id: attempt.id },
        data: { responseData },
        select: attemptSelect,
      });
      await transaction.assignmentStudentState.update({
        where: { id: stateId },
        data: { lastActivityAt: new Date() },
      });
      return this.toAttemptDto(updated);
    });
  }

  async submit(
    user: AuthUser,
    releaseId: string,
    dto: SaveWrittenAssignmentDraftDto,
  ): Promise<StudentAssignmentAttemptDto> {
    this.assertStudent(user);
    return this.prisma.$transaction(async (transaction) => {
      const release = await this.findAccessibleRelease(
        transaction,
        user.id,
        releaseId,
      );
      this.assertReleaseOpen(release);
      const responseData = this.validateResponse(release, dto.text, true);
      const existingState = await transaction.assignmentStudentState.findUnique(
        {
          where: {
            releaseId_studentId: { releaseId: release.id, studentId: user.id },
          },
          select: {
            id: true,
            status: true,
            attempts: {
              orderBy: { attemptNumber: 'desc' },
              take: 1,
              select: attemptSelect,
            },
          },
        },
      );
      if (existingState?.status === AssignmentStudentStatus.AWAITING_REVIEW) {
        const latest = existingState.attempts[0];
        if (latest && this.readResponseText(latest.responseData) === dto.text) {
          return this.toAttemptDto(latest);
        }
        throw this.attemptLocked();
      }

      const { attempt, stateId } = await this.findOrCreateDraftAttempt(
        transaction,
        user.id,
        release,
      );
      const submittedAt = new Date();
      const updated = await transaction.assignmentAttempt.update({
        where: { id: attempt.id },
        data: {
          responseData,
          status: AssignmentAttemptStatus.AWAITING_REVIEW,
          submittedAt,
        },
        select: attemptSelect,
      });
      await transaction.assignmentStudentState.update({
        where: { id: stateId },
        data: {
          status: AssignmentStudentStatus.AWAITING_REVIEW,
          lastActivityAt: submittedAt,
          submittedAt,
        },
      });
      return this.toAttemptDto(updated);
    });
  }

  private async findAccessibleRelease(
    transaction: Prisma.TransactionClient,
    studentId: string,
    releaseId: string,
  ): Promise<StudentReleaseRecord> {
    const release = await transaction.assignmentRelease.findFirst({
      where: {
        id: releaseId,
        class: { students: { some: { id: studentId } } },
      },
      select: studentReleaseSelect,
    });
    if (!release || !release.lessonId) {
      throw this.releaseNotFound();
    }
    const visibleLesson = await transaction.classLesson.findUnique({
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
    return release;
  }

  private async findOrCreateDraftAttempt(
    transaction: Prisma.TransactionClient,
    studentId: string,
    release: StudentReleaseRecord,
  ): Promise<{ attempt: AttemptRecord; stateId: string }> {
    const now = new Date();
    const state = await transaction.assignmentStudentState.upsert({
      where: {
        releaseId_studentId: { releaseId: release.id, studentId },
      },
      create: {
        releaseId: release.id,
        studentId,
        status: AssignmentStudentStatus.NOT_STARTED,
      },
      update: {},
      select: { id: true },
    });
    await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id"
      FROM "AssignmentStudentState"
      WHERE "id" = ${state.id}
      FOR UPDATE
    `);
    const lockedState = await transaction.assignmentStudentState.findUnique({
      where: { id: state.id },
      select: {
        id: true,
        status: true,
        attemptCount: true,
        startedAt: true,
        attempts: {
          where: { status: AssignmentAttemptStatus.IN_PROGRESS },
          orderBy: { attemptNumber: 'desc' },
          take: 1,
          select: attemptSelect,
        },
      },
    });
    if (!lockedState) {
      throw this.releaseNotFound();
    }
    if (
      lockedState.status === AssignmentStudentStatus.AWAITING_REVIEW ||
      lockedState.status === AssignmentStudentStatus.COMPLETED ||
      lockedState.status === AssignmentStudentStatus.EXPIRED
    ) {
      throw this.attemptLocked();
    }
    const existingAttempt = lockedState.attempts[0];
    if (existingAttempt) {
      return { attempt: existingAttempt, stateId: lockedState.id };
    }
    if (
      release.maxAttempts !== null &&
      lockedState.attemptCount >= release.maxAttempts
    ) {
      throw new ConflictException({
        code: 'ASSIGNMENT_MAX_ATTEMPTS_REACHED',
        message: 'No assignment attempts remain',
      });
    }

    const attemptNumber = lockedState.attemptCount + 1;
    const attempt = await transaction.assignmentAttempt.create({
      data: {
        studentStateId: lockedState.id,
        revisionId: release.revisionId,
        attemptNumber,
        clientAttemptId: randomUUID(),
        status: AssignmentAttemptStatus.IN_PROGRESS,
        maxPoints: release.maxPoints,
        isLate: Boolean(release.dueAt && release.dueAt < now),
        responseData: { text: '', attachmentIds: [] },
      },
      select: attemptSelect,
    });
    await transaction.assignmentStudentState.update({
      where: { id: lockedState.id },
      data: {
        status: AssignmentStudentStatus.IN_PROGRESS,
        attemptCount: attemptNumber,
        isLate: Boolean(release.dueAt && release.dueAt < now),
        startedAt: lockedState.startedAt ?? now,
        lastActivityAt: now,
      },
    });
    return { attempt, stateId: lockedState.id };
  }

  private assertReleaseOpen(release: StudentReleaseRecord): void {
    const now = new Date();
    if (release.status !== AssignmentReleaseStatus.ACTIVE) {
      throw this.releaseNotFound();
    }
    if (release.availableFrom && release.availableFrom > now) {
      throw new ConflictException({
        code: 'ASSIGNMENT_NOT_AVAILABLE',
        message: 'This assignment is not available yet',
      });
    }
    if (
      release.dueAt &&
      release.dueAt < now &&
      release.latePolicy === AssignmentLatePolicy.DISALLOW
    ) {
      throw new ConflictException({
        code: 'ASSIGNMENT_CLOSED',
        message: 'This assignment no longer accepts responses',
      });
    }
  }

  private validateResponse(
    release: StudentReleaseRecord,
    text: string,
    requireContent: boolean,
  ): Prisma.InputJsonObject {
    if (requireContent && text.trim().length === 0) {
      throw new BadRequestException({
        code: 'ASSIGNMENT_RESPONSE_REQUIRED',
        message: 'Write an answer before submitting',
      });
    }
    const result = validateAssignmentStudentResponse(
      release.assignment.type,
      release.revision.schemaVersion,
      { text, attachmentIds: [] },
      release.revision.publicConfig,
    );
    if (!result.success) {
      throw new BadRequestException({
        code: 'INVALID_ASSIGNMENT_RESPONSE',
        message: 'The assignment response is invalid',
        issues: result.issues,
      });
    }
    return result.data as Prisma.InputJsonObject;
  }

  private toAttemptDto(attempt: AttemptRecord): StudentAssignmentAttemptDto {
    return new StudentAssignmentAttemptDto({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      responseText: this.readResponseText(attempt.responseData),
      teacherComment: attempt.teacherComment,
      scorePoints:
        attempt.scorePoints === null ? null : Number(attempt.scorePoints),
      scorePercent:
        attempt.scorePercent === null ? null : Number(attempt.scorePercent),
      isPassed: attempt.isPassed,
      submittedAt: attempt.submittedAt,
      reviewedAt: attempt.reviewedAt,
      updatedAt: attempt.updatedAt,
    });
  }

  private resolveStudentStatus(
    release: StudentReleaseRecord,
    persistedStatus: AssignmentStudentStatus | undefined,
    now: Date,
  ): AssignmentStudentStatus {
    const status = persistedStatus ?? AssignmentStudentStatus.NOT_STARTED;
    const preservesFinishedState =
      status === AssignmentStudentStatus.AWAITING_REVIEW ||
      status === AssignmentStudentStatus.COMPLETED;
    if (
      !preservesFinishedState &&
      release.dueAt &&
      release.dueAt < now &&
      release.latePolicy === AssignmentLatePolicy.DISALLOW
    ) {
      return AssignmentStudentStatus.EXPIRED;
    }
    return status;
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

  private toJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value;
    }
    return {};
  }

  private assertStudent(user: AuthUser): void {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only students can complete assignments',
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
      code: 'ASSIGNMENT_RELEASE_NOT_FOUND',
      message: 'Assignment release not found',
    });
  }

  private attemptLocked(): ConflictException {
    return new ConflictException({
      code: 'ASSIGNMENT_ATTEMPT_LOCKED',
      message: 'This assignment response is locked',
    });
  }
}
