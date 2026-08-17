import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentReleaseStatus,
  AssignmentRevisionStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { LessonAssignmentResponseDto } from './dto/lesson-assignment-response.dto';
import { AssignmentsService } from './assignments.service';

const openReleaseStatuses: AssignmentReleaseStatus[] = [
  AssignmentReleaseStatus.DRAFT,
  AssignmentReleaseStatus.SCHEDULED,
  AssignmentReleaseStatus.ACTIVE,
];

const lessonAssignmentSelect = {
  id: true,
  lessonId: true,
  assignmentId: true,
  revisionId: true,
  createdAt: true,
  revision: {
    select: {
      version: true,
      title: true,
      prompt: true,
    },
  },
  assignment: {
    select: {
      type: true,
      contentLocale: true,
      defaultMaxPoints: true,
      defaultPassingPercent: true,
      revisions: {
        where: {
          status: {
            in: [
              AssignmentRevisionStatus.DRAFT,
              AssignmentRevisionStatus.PUBLISHED,
            ],
          },
        },
        select: { id: true, status: true },
      },
    },
  },
} satisfies Prisma.LessonAssignmentSelect;

type LessonAssignmentRecord = Prisma.LessonAssignmentGetPayload<{
  select: typeof lessonAssignmentSelect;
}>;

@Injectable()
export class LessonAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentsService: AssignmentsService,
  ) {}

  async list(
    user: AuthUser,
    lessonId: string,
  ): Promise<LessonAssignmentResponseDto[]> {
    this.assertTeacher(user);
    await this.assertOwnedLesson(user.id, lessonId);
    const links = await this.prisma.lessonAssignment.findMany({
      where: { lessonId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: lessonAssignmentSelect,
    });
    const releases = await this.prisma.assignmentRelease.findMany({
      where: {
        lessonId,
        assignmentId: { in: links.map((link) => link.assignmentId) },
      },
      select: { assignmentId: true, status: true },
    });
    const releaseStatusesByAssignment = new Map<
      string,
      AssignmentReleaseStatus[]
    >();
    for (const release of releases) {
      const statuses =
        releaseStatusesByAssignment.get(release.assignmentId) ?? [];
      statuses.push(release.status);
      releaseStatusesByAssignment.set(release.assignmentId, statuses);
    }

    return links.map((link) =>
      this.toDto(
        link,
        releaseStatusesByAssignment.get(link.assignmentId) ?? [],
      ),
    );
  }

  async link(
    user: AuthUser,
    lessonId: string,
    assignmentId: string,
  ): Promise<LessonAssignmentResponseDto> {
    this.assertTeacher(user);
    await this.assertOwnedLesson(user.id, lessonId);
    const publishedRevisionId = await this.publishCurrentDraft(
      user,
      assignmentId,
    );

    const linkId = await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedLesson(transaction, user.id, lessonId);
      const duplicate = await transaction.lessonAssignment.findUnique({
        where: { lessonId_assignmentId: { lessonId, assignmentId } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'LESSON_ASSIGNMENT_ALREADY_LINKED',
          message: 'This assignment is already linked to the lesson',
        });
      }

      const assignment = await transaction.assignment.findFirst({
        where: { id: assignmentId, teacherId: user.id },
        select: {
          id: true,
          defaultMaxPoints: true,
          defaultPassingPercent: true,
        },
      });
      if (!assignment) {
        throw this.assignmentNotFound();
      }

      const link = await transaction.lessonAssignment.create({
        data: {
          lessonId,
          assignmentId,
          revisionId: publishedRevisionId,
        },
        select: { id: true },
      });
      await this.createReleasesForPublishedClasses(
        transaction,
        lessonId,
        assignmentId,
        publishedRevisionId,
        Number(assignment.defaultMaxPoints),
        Number(assignment.defaultPassingPercent),
      );
      return link.id;
    });

    return this.findLink(user.id, lessonId, assignmentId, linkId);
  }

  async updateVersion(
    user: AuthUser,
    lessonId: string,
    assignmentId: string,
  ): Promise<LessonAssignmentResponseDto> {
    this.assertTeacher(user);
    await this.assertOwnedLesson(user.id, lessonId);
    const existing = await this.prisma.lessonAssignment.findUnique({
      where: { lessonId_assignmentId: { lessonId, assignmentId } },
      select: { id: true, revisionId: true },
    });
    if (!existing) {
      throw this.linkNotFound();
    }

    const publishedRevisionId = await this.publishCurrentDraft(
      user,
      assignmentId,
    );
    if (publishedRevisionId === existing.revisionId) {
      return this.findLink(user.id, lessonId, assignmentId, existing.id);
    }

    await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedLesson(transaction, user.id, lessonId);
      const assignment = await transaction.assignment.findFirst({
        where: { id: assignmentId, teacherId: user.id },
        select: {
          defaultMaxPoints: true,
          defaultPassingPercent: true,
        },
      });
      if (!assignment) {
        throw this.assignmentNotFound();
      }

      const current = await transaction.lessonAssignment.findUnique({
        where: { lessonId_assignmentId: { lessonId, assignmentId } },
        select: { id: true, revisionId: true },
      });
      if (!current) {
        throw this.linkNotFound();
      }
      if (current.revisionId === publishedRevisionId) {
        return;
      }

      await this.archiveOpenReleases(transaction, lessonId, assignmentId);
      await transaction.lessonAssignment.update({
        where: { id: current.id },
        data: { revisionId: publishedRevisionId },
      });
      await this.createReleasesForPublishedClasses(
        transaction,
        lessonId,
        assignmentId,
        publishedRevisionId,
        Number(assignment.defaultMaxPoints),
        Number(assignment.defaultPassingPercent),
      );
    });

    return this.findLink(user.id, lessonId, assignmentId, existing.id);
  }

  async unlink(
    user: AuthUser,
    lessonId: string,
    assignmentId: string,
  ): Promise<void> {
    this.assertTeacher(user);
    await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedLesson(transaction, user.id, lessonId);
      const link = await transaction.lessonAssignment.findUnique({
        where: { lessonId_assignmentId: { lessonId, assignmentId } },
        select: { id: true },
      });
      if (!link) {
        throw this.linkNotFound();
      }

      await transaction.assignmentRelease.deleteMany({
        where: {
          lessonId,
          assignmentId,
          studentStates: { none: {} },
        },
      });
      await this.archiveOpenReleases(transaction, lessonId, assignmentId);
      await transaction.lessonAssignment.delete({ where: { id: link.id } });
    });
  }

  private async publishCurrentDraft(
    user: AuthUser,
    assignmentId: string,
  ): Promise<string> {
    const editor = await this.assignmentsService.getAssignment(
      user,
      assignmentId,
    );
    const candidate = editor.draftRevision ?? editor.publishedRevision;
    if (!candidate) {
      throw new ConflictException({
        code: 'ASSIGNMENT_REVISION_NOT_FOUND',
        message: 'The assignment has no revision to link',
      });
    }
    const published = await this.assignmentsService.publish(
      user,
      assignmentId,
      {
        expectedRevisionId: candidate.id,
        expectedEditVersion: candidate.editVersion,
      },
    );
    if (!published.publishedRevision) {
      throw new ConflictException({
        code: 'ASSIGNMENT_PUBLISHED_REVISION_NOT_FOUND',
        message: 'The assignment has no published revision to link',
      });
    }
    return published.publishedRevision.id;
  }

  private async createReleasesForPublishedClasses(
    transaction: Prisma.TransactionClient,
    lessonId: string,
    assignmentId: string,
    revisionId: string,
    maxPoints: number,
    passingPercent: number,
  ): Promise<void> {
    const classLinks = await transaction.classLesson.findMany({
      where: { lessonId, publishedAt: { not: null } },
      select: { classId: true, publishedAt: true },
    });
    if (classLinks.length === 0) {
      return;
    }
    await transaction.assignmentRelease.createMany({
      data: classLinks.map((classLink) => ({
        assignmentId,
        revisionId,
        lessonId,
        classId: classLink.classId,
        status: AssignmentReleaseStatus.ACTIVE,
        maxPoints,
        passingPercent,
        isRequired: true,
        publishedAt: classLink.publishedAt ?? new Date(),
      })),
      skipDuplicates: true,
    });
  }

  private async archiveOpenReleases(
    transaction: Prisma.TransactionClient,
    lessonId: string,
    assignmentId: string,
  ): Promise<void> {
    await transaction.assignmentRelease.updateMany({
      where: {
        lessonId,
        assignmentId,
        status: { in: openReleaseStatuses },
      },
      data: {
        status: AssignmentReleaseStatus.ARCHIVED,
        closedAt: new Date(),
      },
    });
  }

  private async findLink(
    teacherId: string,
    lessonId: string,
    assignmentId: string,
    linkId: string,
  ): Promise<LessonAssignmentResponseDto> {
    const link = await this.prisma.lessonAssignment.findFirst({
      where: {
        id: linkId,
        lessonId,
        assignmentId,
        lesson: { teacherId },
        assignment: { teacherId },
      },
      select: lessonAssignmentSelect,
    });
    if (!link) {
      throw this.linkNotFound();
    }
    const releases = await this.prisma.assignmentRelease.findMany({
      where: { lessonId, assignmentId },
      select: { status: true },
    });
    return this.toDto(
      link,
      releases.map((release) => release.status),
    );
  }

  private toDto(
    link: LessonAssignmentRecord,
    releaseStatuses: AssignmentReleaseStatus[],
  ): LessonAssignmentResponseDto {
    const currentRevision = link.assignment.revisions.find(
      (revision) => revision.status === AssignmentRevisionStatus.PUBLISHED,
    );
    const hasDraft = link.assignment.revisions.some(
      (revision) => revision.status === AssignmentRevisionStatus.DRAFT,
    );
    return new LessonAssignmentResponseDto({
      id: link.id,
      lessonId: link.lessonId,
      assignmentId: link.assignmentId,
      revisionId: link.revisionId,
      revisionVersion: link.revision.version,
      type: link.assignment.type,
      contentLocale: link.assignment.contentLocale,
      title: link.revision.title,
      prompt: link.revision.prompt,
      maxPoints: Number(link.assignment.defaultMaxPoints),
      passingPercent: Number(link.assignment.defaultPassingPercent),
      hasUpdate:
        hasDraft ||
        Boolean(currentRevision && currentRevision.id !== link.revisionId),
      activeReleaseCount: releaseStatuses.filter(
        (status) => status === AssignmentReleaseStatus.ACTIVE,
      ).length,
      releaseCount: releaseStatuses.length,
      linkedAt: link.createdAt,
    });
  }

  private async assertOwnedLesson(
    teacherId: string,
    lessonId: string,
  ): Promise<void> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, teacherId },
      select: { id: true },
    });
    if (!lesson) {
      throw this.lessonNotFound();
    }
  }

  private async lockOwnedLesson(
    transaction: Prisma.TransactionClient,
    teacherId: string,
    lessonId: string,
  ): Promise<void> {
    const rows = await transaction.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "Lesson"
      WHERE "id" = ${lessonId} AND "teacherId" = ${teacherId}
      FOR UPDATE
    `;
    if (rows.length === 0) {
      throw this.lessonNotFound();
    }
  }

  private assertTeacher(user: AuthUser): void {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only teachers can manage lesson assignments',
      });
    }
  }

  private lessonNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'LESSON_NOT_FOUND',
      message: 'Lesson not found',
    });
  }

  private assignmentNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'ASSIGNMENT_NOT_FOUND',
      message: 'Assignment not found',
    });
  }

  private linkNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'LESSON_ASSIGNMENT_NOT_FOUND',
      message: 'Lesson assignment link not found',
    });
  }
}
