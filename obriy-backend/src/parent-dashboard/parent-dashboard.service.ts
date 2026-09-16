import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LessonModerationStatus,
  Prisma,
  TestLatePolicy,
  TestReleaseStatus,
  TestStudentStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { TestReleaseLifecycleService } from '../tests/test-release-lifecycle.service';
import {
  ParentAttemptDto,
  ParentAttentionReason,
  ParentChildIdentityDto,
  ParentChildOverviewDto,
  ParentChildProgressDto,
  ParentChildSummaryDto,
  ParentClassDto,
  ParentDashboardDto,
  ParentLessonProgressDto,
  ParentLessonRefDto,
  ParentMetricsDto,
  ParentTestProgressDto,
  ParentWorkAvailability,
  ParentWorkItemDto,
} from './dto/parent-dashboard.dto';

const RELEASE_STATUSES = [
  TestReleaseStatus.SCHEDULED,
  TestReleaseStatus.ACTIVE,
  TestReleaseStatus.CLOSED,
];

const childSelect = {
  id: true,
  profile: {
    select: { displayName: true, avatarUrl: true },
  },
  studentClass: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

const stateSelect = {
  studentId: true,
  status: true,
  attemptCount: true,
  scorePoints: true,
  scorePercent: true,
  bestPoints: true,
  bestPercent: true,
  lastActivityAt: true,
} satisfies Prisma.TestStudentStateSelect;

const releaseSelect = {
  id: true,
  testId: true,
  classId: true,
  lessonId: true,
  status: true,
  isRequired: true,
  availableFrom: true,
  dueAt: true,
  maxPoints: true,
  latePolicy: true,
  revision: { select: { title: true } },
  lesson: {
    select: {
      id: true,
      title: true,
      classLinks: {
        select: { classId: true, position: true, publishedAt: true },
      },
    },
  },
  studentStates: { select: stateSelect },
} satisfies Prisma.TestReleaseSelect;

const detailReleaseSelect = {
  ...releaseSelect,
  studentStates: {
    select: {
      ...stateSelect,
      attempts: {
        orderBy: [{ attemptNumber: 'desc' as const }, { id: 'desc' as const }],
        select: {
          attemptNumber: true,
          status: true,
          maxPoints: true,
          scorePoints: true,
          scorePercent: true,
          isPassed: true,
          isLate: true,
          startedAt: true,
          submittedAt: true,
          gradedAt: true,
        },
      },
    },
  },
} satisfies Prisma.TestReleaseSelect;

const classLessonSelect = {
  position: true,
  lesson: {
    select: {
      id: true,
      title: true,
      testLinks: { select: { testId: true, position: true } },
    },
  },
} satisfies Prisma.ClassLessonSelect;

type ChildRecord = Prisma.UserGetPayload<{ select: typeof childSelect }>;
type ReleaseRecord = Prisma.TestReleaseGetPayload<{
  select: typeof releaseSelect;
}>;
type DetailReleaseRecord = Prisma.TestReleaseGetPayload<{
  select: typeof detailReleaseSelect;
}>;
type ClassLessonRecord = Prisma.ClassLessonGetPayload<{
  select: typeof classLessonSelect;
}>;

interface RankedWork {
  dto: ParentWorkItemDto;
  priority: number;
  sortTime: number;
}

@Injectable()
export class ParentDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly releaseLifecycle: TestReleaseLifecycleService,
  ) {}

  async getDashboard(user: AuthUser): Promise<ParentDashboardDto> {
    this.assertParent(user);
    const links = await this.prisma.parentChild.findMany({
      where: { parentId: user.id, child: { role: UserRole.STUDENT } },
      orderBy: [{ createdAt: 'asc' }, { childId: 'asc' }],
      select: { child: { select: childSelect } },
    });
    const children = links.map(({ child }) => child);
    const classIds = this.unique(
      children.flatMap(({ studentClass }) =>
        studentClass ? [studentClass.id] : [],
      ),
    );
    await this.releaseLifecycle.synchronizeClasses(classIds);
    const releases = await this.findSummaryReleases(
      classIds,
      children.map(({ id }) => id),
    );

    return new ParentDashboardDto({
      children: children.map((child) => {
        const works = child.studentClass
          ? this.toRankedWorks(
              releases.filter(
                ({ classId }) => classId === child.studentClass?.id,
              ),
              child.id,
            )
          : [];
        return this.toChildSummary(child, works);
      }),
    });
  }

  async getChildOverview(
    user: AuthUser,
    childId: string,
  ): Promise<ParentChildOverviewDto> {
    const child = await this.findLinkedChild(user, childId);
    if (!child.studentClass) {
      return new ParentChildOverviewDto({
        child: this.toChildSummary(child, []),
        attention: [],
        upcoming: [],
        recentActivity: [],
      });
    }
    await this.releaseLifecycle.synchronizeClass(child.studentClass.id);
    const releases = await this.findSummaryReleases(
      [child.studentClass.id],
      [child.id],
    );
    const ranked = this.toRankedWorks(releases, child.id);
    const attention = ranked.filter(({ dto }) => dto.attentionReason !== null);
    const attentionIds = new Set(attention.map(({ dto }) => dto.releaseId));
    const upcoming = ranked.filter(
      ({ dto }) =>
        !attentionIds.has(dto.releaseId) &&
        dto.status !== TestStudentStatus.COMPLETED &&
        dto.status !== TestStudentStatus.AWAITING_REVIEW &&
        dto.status !== TestStudentStatus.EXPIRED,
    );
    const recentActivity = [...ranked]
      .filter(({ dto }) => dto.lastActivityAt !== null)
      .sort(
        (left, right) =>
          (right.dto.lastActivityAt?.getTime() ?? 0) -
          (left.dto.lastActivityAt?.getTime() ?? 0),
      );

    return new ParentChildOverviewDto({
      child: this.toChildSummary(child, ranked),
      attention: attention.slice(0, 5).map(({ dto }) => dto),
      upcoming: upcoming.slice(0, 5).map(({ dto }) => dto),
      recentActivity: recentActivity.slice(0, 5).map(({ dto }) => dto),
    });
  }

  async getChildProgress(
    user: AuthUser,
    childId: string,
  ): Promise<ParentChildProgressDto> {
    const child = await this.findLinkedChild(user, childId);
    if (!child.studentClass) {
      return new ParentChildProgressDto({
        child: this.toChildSummary(child, []),
        lessons: [],
      });
    }
    const classId = child.studentClass.id;
    await this.releaseLifecycle.synchronizeClass(classId);
    const [classLessons, releases] = await this.prisma.$transaction([
      this.prisma.classLesson.findMany({
        where: {
          classId,
          publishedAt: { not: null },
          lesson: { moderationStatus: LessonModerationStatus.CLEAR },
        },
        orderBy: [{ position: 'asc' }, { lessonId: 'asc' }],
        select: classLessonSelect,
      }),
      this.findDetailReleases(classId, child.id),
    ]);
    const ranked = this.toRankedWorks(releases, child.id);

    return new ParentChildProgressDto({
      child: this.toChildSummary(child, ranked),
      lessons: classLessons.map((link) =>
        this.toLessonProgress(link, releases, child.id),
      ),
    });
  }

  private async findLinkedChild(
    user: AuthUser,
    childId: string,
  ): Promise<ChildRecord> {
    this.assertParent(user);
    const link = await this.prisma.parentChild.findFirst({
      where: {
        parentId: user.id,
        childId,
        child: { role: UserRole.STUDENT },
      },
      select: { child: { select: childSelect } },
    });
    if (!link) {
      throw new NotFoundException({
        code: 'PARENT_CHILD_NOT_FOUND',
        message: 'Linked child not found',
      });
    }
    return link.child;
  }

  private findSummaryReleases(classIds: string[], studentIds: string[]) {
    if (classIds.length === 0 || studentIds.length === 0) {
      return Promise.resolve([] as ReleaseRecord[]);
    }
    return this.prisma.testRelease.findMany({
      where: {
        status: { in: RELEASE_STATUSES },
        lessonId: { not: null },
        OR: classIds.map((classId) => ({
          classId,
          lesson: {
            moderationStatus: LessonModerationStatus.CLEAR,
            classLinks: {
              some: { classId, publishedAt: { not: null } },
            },
          },
        })),
      },
      select: {
        ...releaseSelect,
        studentStates: {
          where: { studentId: { in: studentIds } },
          select: stateSelect,
        },
      },
    });
  }

  private findDetailReleases(classId: string, studentId: string) {
    return this.prisma.testRelease.findMany({
      where: {
        classId,
        status: { in: RELEASE_STATUSES },
        lessonId: { not: null },
        lesson: {
          moderationStatus: LessonModerationStatus.CLEAR,
          classLinks: { some: { classId, publishedAt: { not: null } } },
        },
      },
      select: {
        ...detailReleaseSelect,
        studentStates: {
          where: { studentId },
          select: detailReleaseSelect.studentStates.select,
        },
      },
    });
  }

  private toRankedWorks(
    releases: Array<ReleaseRecord | DetailReleaseRecord>,
    studentId: string,
  ): RankedWork[] {
    const now = new Date();
    return releases
      .flatMap((release) => {
        const classLink = release.lesson?.classLinks.find(
          (link) =>
            link.classId === release.classId && link.publishedAt !== null,
        );
        if (!release.lesson || !classLink) return [];
        const state = release.studentStates.find(
          (entry) => entry.studentId === studentId,
        );
        const status = this.effectiveStatus(release, state?.status, now);
        const availability = this.availability(release, now);
        const unfinished =
          status !== TestStudentStatus.COMPLETED &&
          status !== TestStudentStatus.AWAITING_REVIEW;
        const overdue =
          unfinished && release.dueAt !== null && release.dueAt < now;
        const dueSoon =
          unfinished &&
          release.dueAt !== null &&
          release.dueAt >= now &&
          release.dueAt.getTime() <= now.getTime() + 24 * 60 * 60 * 1000;
        const attentionReason = !release.isRequired
          ? null
          : status === TestStudentStatus.NEEDS_REVISION
            ? ParentAttentionReason.NEEDS_REVISION
            : overdue
              ? ParentAttentionReason.OVERDUE
              : dueSoon
                ? ParentAttentionReason.DUE_SOON
                : null;
        const dto = new ParentWorkItemDto({
          releaseId: release.id,
          testId: release.testId,
          title: release.revision.title,
          lesson: new ParentLessonRefDto({
            id: release.lesson.id,
            title: release.lesson.title,
            position: classLink.position,
          }),
          releaseStatus: release.status,
          isRequired: release.isRequired,
          availability,
          status,
          availableFrom: release.availableFrom,
          dueAt: release.dueAt,
          maxPoints: Number(release.maxPoints),
          scorePoints:
            !state || state.scorePoints === null
              ? null
              : Number(state.scorePoints),
          scorePercent:
            !state || state.scorePercent === null
              ? null
              : Number(state.scorePercent),
          bestPoints:
            !state || state.bestPoints === null
              ? null
              : Number(state.bestPoints),
          bestPercent:
            !state || state.bestPercent === null
              ? null
              : Number(state.bestPercent),
          attemptCount: state?.attemptCount ?? 0,
          lastActivityAt: state?.lastActivityAt ?? null,
          attentionReason,
        });
        return [
          { dto, priority: this.priority(dto), sortTime: this.sortTime(dto) },
        ];
      })
      .sort(
        (left, right) =>
          left.priority - right.priority ||
          left.sortTime - right.sortTime ||
          left.dto.lesson.position - right.dto.lesson.position ||
          left.dto.releaseId.localeCompare(right.dto.releaseId),
      );
  }

  private toChildSummary(
    child: ChildRecord,
    works: RankedWork[],
  ): ParentChildSummaryDto {
    return new ParentChildSummaryDto({
      ...this.toIdentity(child),
      class: child.studentClass ? new ParentClassDto(child.studentClass) : null,
      metrics: this.metrics(works),
    });
  }

  private toIdentity(child: ChildRecord): ParentChildIdentityDto {
    return new ParentChildIdentityDto({
      id: child.id,
      displayName: child.profile?.displayName ?? 'Student',
      avatarUrl: child.profile?.avatarUrl ?? null,
    });
  }

  private metrics(works: RankedWork[]): ParentMetricsDto {
    const required = works.filter(({ dto }) => dto.isRequired);
    const completedCount = required.filter(
      ({ dto }) => dto.status === TestStudentStatus.COMPLETED,
    ).length;
    const scoreable = required.filter(
      ({ dto }) => dto.status !== TestStudentStatus.AWAITING_REVIEW,
    );
    const nextDueAt = required
      .filter(
        ({ dto }) =>
          dto.dueAt !== null &&
          dto.dueAt >= new Date() &&
          dto.status !== TestStudentStatus.COMPLETED,
      )
      .map(({ dto }) => dto.dueAt as Date)
      .sort((left, right) => left.getTime() - right.getTime())[0];
    return new ParentMetricsDto({
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
      attentionCount: required.filter(({ dto }) => dto.attentionReason !== null)
        .length,
      nextDueAt: nextDueAt ?? null,
    });
  }

  private toLessonProgress(
    link: ClassLessonRecord,
    releases: DetailReleaseRecord[],
    studentId: string,
  ): ParentLessonProgressDto {
    const positions = new Map(
      link.lesson.testLinks.map(({ testId, position }) => [testId, position]),
    );
    const lessonReleases = releases
      .filter(({ lessonId }) => lessonId === link.lesson.id)
      .sort(
        (left, right) =>
          (positions.get(left.testId) ?? Number.MAX_SAFE_INTEGER) -
            (positions.get(right.testId) ?? Number.MAX_SAFE_INTEGER) ||
          left.id.localeCompare(right.id),
      );
    const works = this.toRankedWorks(lessonReleases, studentId);
    const required = works.filter(({ dto }) => dto.isRequired);
    const metrics = this.metrics(works);
    return new ParentLessonProgressDto({
      id: link.lesson.id,
      title: link.lesson.title,
      position: link.position,
      requiredTestCount: required.length,
      completedRequiredCount: required.filter(
        ({ dto }) => dto.status === TestStudentStatus.COMPLETED,
      ).length,
      completionPercent: metrics.completionPercent,
      averagePercent: metrics.averagePercent,
      tests: lessonReleases.map((release) =>
        this.toTestProgress(release, studentId),
      ),
    });
  }

  private toTestProgress(
    release: DetailReleaseRecord,
    studentId: string,
  ): ParentTestProgressDto {
    const work = this.toRankedWorks([release], studentId)[0]?.dto;
    if (!work) {
      throw new NotFoundException('Released lesson is unavailable');
    }
    const state = release.studentStates.find(
      (entry) => entry.studentId === studentId,
    );
    return new ParentTestProgressDto({
      ...work,
      attempts: (state?.attempts ?? []).map(
        (attempt) =>
          new ParentAttemptDto({
            attemptNumber: attempt.attemptNumber,
            status: attempt.status,
            maxPoints: Number(attempt.maxPoints),
            scorePoints:
              attempt.scorePoints === null ? null : Number(attempt.scorePoints),
            scorePercent:
              attempt.scorePercent === null
                ? null
                : Number(attempt.scorePercent),
            isPassed: attempt.isPassed,
            isLate: attempt.isLate,
            startedAt: attempt.startedAt,
            submittedAt: attempt.submittedAt,
            gradedAt: attempt.gradedAt,
          }),
      ),
    });
  }

  private availability(
    release: ReleaseRecord,
    now: Date,
  ): ParentWorkAvailability {
    if (release.status === TestReleaseStatus.CLOSED) {
      return ParentWorkAvailability.CLOSED;
    }
    if (
      release.status === TestReleaseStatus.SCHEDULED ||
      (release.availableFrom !== null && release.availableFrom > now)
    ) {
      return ParentWorkAvailability.SCHEDULED;
    }
    return ParentWorkAvailability.AVAILABLE;
  }

  private effectiveStatus(
    release: ReleaseRecord,
    persisted: TestStudentStatus | undefined,
    now: Date,
  ): TestStudentStatus {
    const status = persisted ?? TestStudentStatus.NOT_STARTED;
    if (
      status === TestStudentStatus.IN_PROGRESS ||
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

  private priority(dto: ParentWorkItemDto): number {
    if (dto.attentionReason === ParentAttentionReason.NEEDS_REVISION) return 0;
    if (dto.attentionReason === ParentAttentionReason.OVERDUE) return 1;
    if (dto.attentionReason === ParentAttentionReason.DUE_SOON) return 2;
    if (dto.status === TestStudentStatus.IN_PROGRESS) return 3;
    if (dto.availability === ParentWorkAvailability.AVAILABLE) return 4;
    if (dto.availability === ParentWorkAvailability.SCHEDULED) return 5;
    if (dto.status === TestStudentStatus.AWAITING_REVIEW) return 6;
    return 7;
  }

  private sortTime(dto: ParentWorkItemDto): number {
    if (
      dto.status === TestStudentStatus.NEEDS_REVISION ||
      dto.status === TestStudentStatus.IN_PROGRESS ||
      dto.status === TestStudentStatus.AWAITING_REVIEW ||
      dto.status === TestStudentStatus.COMPLETED
    ) {
      return -(dto.lastActivityAt?.getTime() ?? 0);
    }
    if (dto.availability === ParentWorkAvailability.SCHEDULED) {
      return dto.availableFrom?.getTime() ?? Number.MAX_SAFE_INTEGER;
    }
    return dto.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  }

  private unique(values: string[]): string[] {
    return [...new Set(values)];
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private assertParent(user: AuthUser): void {
    if (user.role !== UserRole.PARENT) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only parents can use the parent dashboard',
      });
    }
  }
}
