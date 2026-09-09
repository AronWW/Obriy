import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  Prisma,
  TestLatePolicy,
  TestReleaseStatus,
  TestStudentStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  StudentAttentionReason,
  StudentContinueLessonDto,
  StudentDashboardDto,
  StudentTasksPageDto,
  StudentWorkAvailability,
  StudentWorkItemDto,
  StudentWorkspaceClassDto,
  StudentWorkspaceLessonDto,
  StudentWorkspaceMetricsDto,
} from './dto/student-workspace.dto';
import {
  StudentTasksQueryDto,
  StudentTasksRequiredFilter,
  StudentTasksStatusFilter,
} from './dto/student-workspace-query.dto';

const WORKSPACE_RELEASE_STATUSES = [
  TestReleaseStatus.SCHEDULED,
  TestReleaseStatus.ACTIVE,
  TestReleaseStatus.CLOSED,
];

const workspaceReleaseSelect = {
  id: true,
  testId: true,
  status: true,
  isRequired: true,
  availableFrom: true,
  dueAt: true,
  maxPoints: true,
  latePolicy: true,
  updatedAt: true,
  revision: {
    select: {
      title: true,
      description: true,
    },
  },
  lesson: {
    select: {
      id: true,
      title: true,
      classLinks: {
        select: { position: true },
      },
    },
  },
  studentStates: {
    select: {
      status: true,
      attemptCount: true,
      scorePoints: true,
      scorePercent: true,
      bestPoints: true,
      bestPercent: true,
      lastActivityAt: true,
    },
  },
} satisfies Prisma.TestReleaseSelect;

type WorkspaceRelease = Prisma.TestReleaseGetPayload<{
  select: typeof workspaceReleaseSelect;
}>;

interface RankedWork {
  dto: StudentWorkItemDto;
  priority: number;
  sortTime: number;
}

@Injectable()
export class StudentWorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(user: AuthUser): Promise<StudentDashboardDto> {
    this.assertStudent(user);
    const context = await this.loadContext(user.id);
    if (!context.classroom) return this.emptyDashboard();

    const ranked = this.toRankedWorks(context.releases);
    const required = ranked.filter(({ dto }) => dto.isRequired);
    const scoreable = required.filter(
      ({ dto }) => dto.stateStatus !== TestStudentStatus.AWAITING_REVIEW,
    );
    const completedCount = required.filter(
      ({ dto }) => dto.stateStatus === TestStudentStatus.COMPLETED,
    ).length;
    const attention = ranked.filter(({ dto }) => dto.attentionReason !== null);
    const now = Date.now();
    const nextDueAt = required
      .filter(
        ({ dto }) =>
          dto.dueAt !== null &&
          new Date(dto.dueAt).getTime() >= now &&
          dto.stateStatus !== TestStudentStatus.COMPLETED,
      )
      .map(({ dto }) => dto.dueAt as Date)
      .sort((left, right) => left.getTime() - right.getTime())[0];
    const attentionIds = new Set(attention.map(({ dto }) => dto.releaseId));
    const upcoming = ranked.filter(
      ({ dto }) =>
        !attentionIds.has(dto.releaseId) &&
        dto.stateStatus !== TestStudentStatus.COMPLETED &&
        dto.stateStatus !== TestStudentStatus.AWAITING_REVIEW &&
        dto.stateStatus !== TestStudentStatus.EXPIRED,
    );

    return new StudentDashboardDto({
      class: new StudentWorkspaceClassDto(context.classroom),
      metrics: new StudentWorkspaceMetricsDto({
        requiredReleaseCount: required.length,
        completedCount,
        completionPercent:
          required.length === 0
            ? null
            : this.round((completedCount / required.length) * 100),
        averagePercent:
          scoreable.length === 0
            ? null
            : this.round(
                scoreable.reduce(
                  (total, { dto }) => total + (dto.scorePercent ?? 0),
                  0,
                ) / scoreable.length,
              ),
        attentionCount: attention.length,
        nextDueAt: nextDueAt ?? null,
      }),
      attention: attention.slice(0, 5).map(({ dto }) => dto),
      upcoming: upcoming.slice(0, 5).map(({ dto }) => dto),
      continueLessons: this.toContinueLessons(ranked),
    });
  }

  async getTasks(
    user: AuthUser,
    query: StudentTasksQueryDto,
  ): Promise<StudentTasksPageDto> {
    this.assertStudent(user);
    const context = await this.loadContext(user.id);
    if (!context.classroom) {
      return new StudentTasksPageDto({
        class: null,
        items: [],
        nextCursor: null,
      });
    }

    const search = query.search?.toLocaleLowerCase() ?? '';
    const status = query.status ?? StudentTasksStatusFilter.ALL;
    const required = query.required ?? StudentTasksRequiredFilter.ALL;
    let ranked = this.toRankedWorks(context.releases).filter(({ dto }) => {
      if (
        search &&
        !`${dto.title} ${dto.lesson.title}`.toLocaleLowerCase().includes(search)
      ) {
        return false;
      }
      if (required === StudentTasksRequiredFilter.REQUIRED && !dto.isRequired) {
        return false;
      }
      if (required === StudentTasksRequiredFilter.OPTIONAL && dto.isRequired) {
        return false;
      }
      if (status === StudentTasksStatusFilter.ALL) return true;
      if (status === StudentTasksStatusFilter.ATTENTION) {
        return dto.attentionReason !== null;
      }
      if (status === StudentTasksStatusFilter.SCHEDULED) {
        return dto.availability === StudentWorkAvailability.SCHEDULED;
      }
      if (status === StudentTasksStatusFilter.NOT_STARTED) {
        return (
          dto.stateStatus === TestStudentStatus.NOT_STARTED &&
          dto.availability !== StudentWorkAvailability.SCHEDULED
        );
      }
      return String(dto.stateStatus) === String(status);
    });

    if (query.cursor) {
      const releaseId = this.decodeCursor(query.cursor);
      const index = ranked.findIndex(({ dto }) => dto.releaseId === releaseId);
      if (index < 0) throw this.invalidCursor();
      ranked = ranked.slice(index + 1);
    }

    const limit = query.limit ?? 20;
    const page = ranked.slice(0, limit);
    return new StudentTasksPageDto({
      class: new StudentWorkspaceClassDto(context.classroom),
      items: page.map(({ dto }) => dto),
      nextCursor:
        ranked.length > limit && page.length > 0
          ? this.encodeCursor(page[page.length - 1].dto.releaseId)
          : null,
    });
  }

  private async loadContext(studentId: string) {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: {
        studentClass: { select: { id: true, name: true } },
      },
    });
    if (!student?.studentClass) {
      return { classroom: null, releases: [] as WorkspaceRelease[] };
    }
    const classId = student.studentClass.id;
    const releases = await this.prisma.testRelease.findMany({
      where: {
        classId,
        lessonId: { not: null },
        status: { in: WORKSPACE_RELEASE_STATUSES },
        lesson: {
          classLinks: { some: { classId, publishedAt: { not: null } } },
        },
      },
      select: {
        ...workspaceReleaseSelect,
        lesson: {
          select: {
            id: true,
            title: true,
            classLinks: {
              where: { classId },
              select: { position: true },
            },
          },
        },
        studentStates: {
          where: { studentId },
          select: workspaceReleaseSelect.studentStates.select,
        },
      },
    });
    return { classroom: student.studentClass, releases };
  }

  private toRankedWorks(releases: WorkspaceRelease[]): RankedWork[] {
    const now = new Date();
    return releases
      .flatMap((release) => {
        if (!release.lesson || release.lesson.classLinks.length === 0)
          return [];
        const state = release.studentStates[0];
        const availability = this.availability(release, now);
        const stateStatus = this.effectiveStatus(release, state?.status, now);
        const isOverdue =
          release.dueAt !== null &&
          release.dueAt.getTime() < now.getTime() &&
          stateStatus !== TestStudentStatus.COMPLETED &&
          stateStatus !== TestStudentStatus.AWAITING_REVIEW;
        const attentionReason = !release.isRequired
          ? null
          : stateStatus === TestStudentStatus.NEEDS_REVISION
            ? StudentAttentionReason.NEEDS_REVISION
            : isOverdue
              ? StudentAttentionReason.OVERDUE
              : null;
        const dto = new StudentWorkItemDto({
          releaseId: release.id,
          testId: release.testId,
          title: release.revision.title,
          description: release.revision.description,
          lesson: new StudentWorkspaceLessonDto({
            id: release.lesson.id,
            title: release.lesson.title,
            position: release.lesson.classLinks[0].position,
          }),
          releaseStatus: release.status,
          isRequired: release.isRequired,
          availability,
          stateStatus,
          availableFrom: release.availableFrom,
          dueAt: release.dueAt,
          maxPoints: Number(release.maxPoints),
          scorePoints:
            state?.scorePoints === null || !state
              ? null
              : Number(state.scorePoints),
          scorePercent:
            state?.scorePercent === null || !state
              ? null
              : Number(state.scorePercent),
          bestPoints:
            state?.bestPoints === null || !state
              ? null
              : Number(state.bestPoints),
          bestPercent:
            state?.bestPercent === null || !state
              ? null
              : Number(state.bestPercent),
          attemptCount: state?.attemptCount ?? 0,
          lastActivityAt: state?.lastActivityAt ?? null,
          attentionReason,
          isOverdue,
          canOpen:
            availability === StudentWorkAvailability.AVAILABLE ||
            (availability === StudentWorkAvailability.CLOSED &&
              (state?.attemptCount ?? 0) > 0),
        });
        return [
          {
            dto,
            priority: this.priority(dto),
            sortTime: this.sortTime(dto),
          },
        ];
      })
      .sort(
        (left, right) =>
          left.priority - right.priority ||
          left.sortTime - right.sortTime ||
          Number(right.dto.isRequired) - Number(left.dto.isRequired) ||
          left.dto.lesson.position - right.dto.lesson.position ||
          left.dto.releaseId.localeCompare(right.dto.releaseId),
      );
  }

  private toContinueLessons(ranked: RankedWork[]): StudentContinueLessonDto[] {
    const groups = new Map<string, RankedWork[]>();
    for (const work of ranked) {
      const group = groups.get(work.dto.lesson.id) ?? [];
      group.push(work);
      groups.set(work.dto.lesson.id, group);
    }
    return [...groups.values()]
      .map((works) => {
        const required = works.filter(({ dto }) => dto.isRequired);
        const next = works.find(
          ({ dto }) =>
            dto.canOpen &&
            dto.stateStatus !== TestStudentStatus.COMPLETED &&
            dto.stateStatus !== TestStudentStatus.AWAITING_REVIEW,
        );
        return {
          works,
          next,
          priority: next?.priority ?? Number.MAX_SAFE_INTEGER,
          dto: new StudentContinueLessonDto({
            ...works[0].dto.lesson,
            workCount: works.length,
            requiredCount: required.length,
            completedRequiredCount: required.filter(
              ({ dto }) => dto.stateStatus === TestStudentStatus.COMPLETED,
            ).length,
            nextReleaseId: next?.dto.releaseId ?? null,
          }),
        };
      })
      .filter(({ next }) => next !== undefined)
      .sort(
        (left, right) =>
          left.priority - right.priority ||
          left.dto.position - right.dto.position ||
          left.dto.id.localeCompare(right.dto.id),
      )
      .slice(0, 3)
      .map(({ dto }) => dto);
  }

  private availability(
    release: WorkspaceRelease,
    now: Date,
  ): StudentWorkAvailability {
    if (release.status === TestReleaseStatus.CLOSED) {
      return StudentWorkAvailability.CLOSED;
    }
    if (
      release.status === TestReleaseStatus.SCHEDULED ||
      (release.availableFrom !== null && release.availableFrom > now)
    ) {
      return StudentWorkAvailability.SCHEDULED;
    }
    return StudentWorkAvailability.AVAILABLE;
  }

  private effectiveStatus(
    release: WorkspaceRelease,
    persisted: TestStudentStatus | undefined,
    now: Date,
  ): TestStudentStatus {
    const status = persisted ?? TestStudentStatus.NOT_STARTED;
    if (
      status === TestStudentStatus.COMPLETED ||
      status === TestStudentStatus.AWAITING_REVIEW ||
      status === TestStudentStatus.NEEDS_REVISION
    ) {
      return status;
    }
    if (
      release.status === TestReleaseStatus.CLOSED ||
      (release.dueAt !== null &&
        release.dueAt < now &&
        release.latePolicy === TestLatePolicy.DISALLOW)
    ) {
      return TestStudentStatus.EXPIRED;
    }
    return status;
  }

  private priority(dto: StudentWorkItemDto): number {
    if (dto.stateStatus === TestStudentStatus.NEEDS_REVISION) return 0;
    if (dto.isOverdue) return 1;
    if (dto.stateStatus === TestStudentStatus.IN_PROGRESS) return 2;
    if (dto.stateStatus === TestStudentStatus.AWAITING_REVIEW) return 5;
    if (
      dto.stateStatus === TestStudentStatus.COMPLETED ||
      dto.stateStatus === TestStudentStatus.EXPIRED
    ) {
      return 6;
    }
    if (dto.availability === StudentWorkAvailability.AVAILABLE) return 3;
    if (dto.availability === StudentWorkAvailability.SCHEDULED) return 4;
    return 6;
  }

  private sortTime(dto: StudentWorkItemDto): number {
    if (
      dto.stateStatus === TestStudentStatus.NEEDS_REVISION ||
      dto.stateStatus === TestStudentStatus.IN_PROGRESS ||
      dto.stateStatus === TestStudentStatus.AWAITING_REVIEW ||
      dto.stateStatus === TestStudentStatus.COMPLETED
    ) {
      return -(dto.lastActivityAt?.getTime() ?? 0);
    }
    if (dto.isOverdue) return dto.dueAt?.getTime() ?? 0;
    if (dto.availability === StudentWorkAvailability.SCHEDULED) {
      return dto.availableFrom?.getTime() ?? Number.MAX_SAFE_INTEGER;
    }
    return dto.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  }

  private encodeCursor(releaseId: string): string {
    return Buffer.from(releaseId, 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): string {
    try {
      const value = Buffer.from(cursor, 'base64url').toString('utf8');
      if (!value) throw new Error('empty');
      return value;
    } catch {
      throw this.invalidCursor();
    }
  }

  private invalidCursor(): BadRequestException {
    return new BadRequestException({
      code: 'INVALID_CURSOR',
      message: 'Task cursor is invalid for this result set',
    });
  }

  private emptyDashboard(): StudentDashboardDto {
    return new StudentDashboardDto({
      class: null,
      metrics: new StudentWorkspaceMetricsDto({
        requiredReleaseCount: 0,
        completedCount: 0,
        completionPercent: null,
        averagePercent: null,
        attentionCount: 0,
        nextDueAt: null,
      }),
      attention: [],
      upcoming: [],
      continueLessons: [],
    });
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private assertStudent(user: AuthUser): void {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only students can use the student workspace',
      });
    }
  }
}
