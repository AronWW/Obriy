import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TestReleaseStatus,
  TestStudentStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  TeacherAnalyticsClassDto,
  TeacherAnalyticsLessonDto,
  TeacherAnalyticsMetricsDto,
  TeacherAnalyticsStatusCountsDto,
  TeacherAnalyticsStudentDto,
  TeacherAnalyticsTestDto,
  TeacherClassAnalyticsDto,
  TeacherStudentAnalyticsDto,
  TeacherStudentAttemptDto,
  TeacherStudentLessonResultDto,
  TeacherStudentTestResultDto,
} from './dto/teacher-analytics.dto';

const ANALYTICS_RELEASE_STATUSES = [
  TestReleaseStatus.SCHEDULED,
  TestReleaseStatus.ACTIVE,
  TestReleaseStatus.CLOSED,
];

const studentSelect = {
  id: true,
  profile: {
    select: { displayName: true, avatarUrl: true, gradeLevel: true },
  },
} satisfies Prisma.UserSelect;

const classLessonSelect = {
  position: true,
  lessonId: true,
  lesson: {
    select: {
      id: true,
      title: true,
      testLinks: {
        select: { testId: true, position: true },
        orderBy: [{ position: 'asc' as const }, { testId: 'asc' as const }],
      },
    },
  },
} satisfies Prisma.ClassLessonSelect;

const stateSelect = {
  studentId: true,
  status: true,
  attemptCount: true,
  scorePoints: true,
  scorePercent: true,
  bestPoints: true,
  bestPercent: true,
  isLate: true,
  lastActivityAt: true,
  submittedAt: true,
  completedAt: true,
} satisfies Prisma.TestStudentStateSelect;

const releaseSelect = {
  id: true,
  testId: true,
  lessonId: true,
  status: true,
  isRequired: true,
  availableFrom: true,
  dueAt: true,
  maxPoints: true,
  passingPercent: true,
  updatedAt: true,
  revision: { select: { title: true } },
  studentStates: { select: stateSelect },
} satisfies Prisma.TestReleaseSelect;

const releaseDetailSelect = {
  ...releaseSelect,
  studentStates: {
    select: {
      ...stateSelect,
      attempts: {
        orderBy: [{ attemptNumber: 'desc' as const }, { id: 'desc' as const }],
        select: {
          id: true,
          attemptNumber: true,
          status: true,
          maxPoints: true,
          scorePoints: true,
          scorePercent: true,
          isPassed: true,
          pendingReviewCount: true,
          isLate: true,
          startedAt: true,
          submittedAt: true,
          gradedAt: true,
        },
      },
    },
  },
} satisfies Prisma.TestReleaseSelect;

type StudentRecord = Prisma.UserGetPayload<{ select: typeof studentSelect }>;
type ClassLessonRecord = Prisma.ClassLessonGetPayload<{
  select: typeof classLessonSelect;
}>;
type ReleaseRecord = Prisma.TestReleaseGetPayload<{
  select: typeof releaseSelect;
}>;
type ReleaseDetailRecord = Prisma.TestReleaseGetPayload<{
  select: typeof releaseDetailSelect;
}>;
type StateRecord = ReleaseRecord['studentStates'][number];

interface PairMetrics {
  averagePercent: number | null;
  awaitingReviewCount: number;
  completedCount: number;
  completionPercent: number | null;
  statuses: TeacherAnalyticsStatusCountsDto;
  totalCount: number;
}

@Injectable()
export class TeacherAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getClassAnalytics(
    user: AuthUser,
    classId: string,
  ): Promise<TeacherClassAnalyticsDto> {
    this.assertTeacher(user);
    const classroom = await this.findOwnedClass(user.id, classId);
    const [students, classLessons, releases] = await this.prisma.$transaction([
      this.findStudents(classId),
      this.findClassLessons(classId),
      this.findReleases(user.id, classId, releaseSelect),
    ]);
    const includedReleases = releases;
    const states = this.stateMap(
      includedReleases,
      new Set(students.map(({ id }) => id)),
    );
    const requiredReleases = includedReleases.filter(
      ({ isRequired }) => isRequired,
    );
    const overall = this.calculatePairs(
      students.map(({ id }) => id),
      requiredReleases,
      states,
    );

    return new TeacherClassAnalyticsDto({
      class: new TeacherAnalyticsClassDto(classroom),
      metrics: new TeacherAnalyticsMetricsDto({
        studentCount: students.length,
        requiredReleaseCount: requiredReleases.length,
        requiredWorkCount: overall.totalCount,
        completedWorkCount: overall.completedCount,
        completionPercent: overall.completionPercent,
        averagePercent: overall.averagePercent,
        awaitingReviewCount: overall.awaitingReviewCount,
      }),
      students: students.map((student) =>
        this.toStudentDto(student, includedReleases, states),
      ),
      lessons: this.toLessonDtos(
        classLessons,
        includedReleases,
        students.map(({ id }) => id),
        states,
      ),
    });
  }

  async getStudentAnalytics(
    user: AuthUser,
    classId: string,
    studentId: string,
  ): Promise<TeacherStudentAnalyticsDto> {
    this.assertTeacher(user);
    const classroom = await this.findOwnedClass(user.id, classId);
    const [student, classLessons, releases] = await this.prisma.$transaction([
      this.prisma.user.findFirst({
        where: {
          id: studentId,
          studentClassId: classId,
          role: UserRole.STUDENT,
        },
        select: studentSelect,
      }),
      this.findClassLessons(classId),
      this.findReleases(user.id, classId, releaseDetailSelect, studentId),
    ]);
    if (!student) throw this.studentNotFound();
    const includedReleases = releases;
    const overviewReleases = includedReleases as ReleaseRecord[];
    const states = this.stateMap(overviewReleases, new Set([studentId]));

    return new TeacherStudentAnalyticsDto({
      class: new TeacherAnalyticsClassDto(classroom),
      student: this.toStudentDto(student, overviewReleases, states),
      lessons: this.toStudentLessonDtos(
        classLessons,
        includedReleases,
        studentId,
      ),
    });
  }

  private findStudents(classId: string) {
    return this.prisma.user.findMany({
      where: { studentClassId: classId, role: UserRole.STUDENT },
      orderBy: [{ profile: { displayName: 'asc' } }, { id: 'asc' }],
      select: studentSelect,
    });
  }

  private findClassLessons(classId: string) {
    return this.prisma.classLesson.findMany({
      where: { classId },
      orderBy: [{ position: 'asc' }, { lessonId: 'asc' }],
      select: classLessonSelect,
    });
  }

  private findReleases<T extends Prisma.TestReleaseSelect>(
    teacherId: string,
    classId: string,
    select: T,
    studentId?: string,
  ) {
    const selected = studentId
      ? {
          ...select,
          studentStates: {
            ...(select.studentStates as object),
            where: { studentId },
          },
        }
      : select;
    return this.prisma.testRelease.findMany({
      where: {
        classId,
        lessonId: { not: null },
        status: { in: ANALYTICS_RELEASE_STATUSES },
        test: { teacherId },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: selected,
    });
  }

  private async findOwnedClass(teacherId: string, classId: string) {
    const classroom = await this.prisma.class.findFirst({
      where: { id: classId, teacherId },
      select: { id: true, name: true },
    });
    if (!classroom) throw this.classNotFound();
    return classroom;
  }

  private stateMap(releases: ReleaseRecord[], studentIds: Set<string>) {
    const states = new Map<string, StateRecord>();
    for (const release of releases) {
      for (const state of release.studentStates) {
        if (studentIds.has(state.studentId)) {
          states.set(this.pairKey(release.id, state.studentId), state);
        }
      }
    }
    return states;
  }

  private calculatePairs(
    studentIds: string[],
    releases: ReleaseRecord[],
    states: Map<string, StateRecord>,
  ): PairMetrics {
    const statuses = this.emptyStatuses();
    let completedCount = 0;
    let awaitingReviewCount = 0;
    let scoreTotal = 0;
    let scoreCount = 0;
    for (const release of releases) {
      for (const studentId of studentIds) {
        const state = states.get(this.pairKey(release.id, studentId));
        const status = state?.status ?? TestStudentStatus.NOT_STARTED;
        this.incrementStatus(statuses, status);
        if (status === TestStudentStatus.COMPLETED) completedCount += 1;
        if (status === TestStudentStatus.AWAITING_REVIEW) {
          awaitingReviewCount += 1;
          continue;
        }
        scoreTotal += Number(state?.scorePercent ?? 0);
        scoreCount += 1;
      }
    }
    const totalCount = studentIds.length * releases.length;
    return {
      averagePercent:
        scoreCount === 0 ? null : this.round(scoreTotal / scoreCount),
      awaitingReviewCount,
      completedCount,
      completionPercent:
        totalCount === 0
          ? null
          : this.round((completedCount / totalCount) * 100),
      statuses,
      totalCount,
    };
  }

  private toStudentDto(
    student: StudentRecord,
    releases: ReleaseRecord[],
    states: Map<string, StateRecord>,
  ): TeacherAnalyticsStudentDto {
    const required = releases.filter(({ isRequired }) => isRequired);
    const metrics = this.calculatePairs([student.id], required, states);
    const lastActivityAt = releases.reduce<Date | null>((latest, release) => {
      const activity = states.get(
        this.pairKey(release.id, student.id),
      )?.lastActivityAt;
      return activity && (!latest || activity > latest) ? activity : latest;
    }, null);
    return new TeacherAnalyticsStudentDto({
      id: student.id,
      displayName: student.profile?.displayName ?? 'Student',
      avatarUrl: student.profile?.avatarUrl ?? null,
      gradeLevel: student.profile?.gradeLevel ?? null,
      requiredCount: metrics.totalCount,
      completedCount: metrics.completedCount,
      completionPercent: metrics.completionPercent,
      averagePercent: metrics.averagePercent,
      statuses: metrics.statuses,
      lastActivityAt,
    });
  }

  private toLessonDtos(
    classLessons: ClassLessonRecord[],
    releases: ReleaseRecord[],
    studentIds: string[],
    states: Map<string, StateRecord>,
  ): TeacherAnalyticsLessonDto[] {
    const releasesByLesson = this.releasesByLesson(releases);
    return classLessons.flatMap((link) => {
      const lessonReleases = releasesByLesson.get(link.lessonId) ?? [];
      if (lessonReleases.length === 0) return [];
      const ordered = this.orderLessonReleases(link, lessonReleases);
      const required = ordered.filter(({ isRequired }) => isRequired);
      const metrics = this.calculatePairs(studentIds, required, states);
      return [
        new TeacherAnalyticsLessonDto({
          id: link.lesson.id,
          title: link.lesson.title,
          position: link.position,
          requiredTestCount: required.length,
          completionPercent: metrics.completionPercent,
          averagePercent: metrics.averagePercent,
          tests: ordered.map((release) =>
            this.toTestDto(release, studentIds, states),
          ),
        }),
      ];
    });
  }

  private toTestDto(
    release: ReleaseRecord,
    studentIds: string[],
    states: Map<string, StateRecord>,
  ): TeacherAnalyticsTestDto {
    const metrics = this.calculatePairs(studentIds, [release], states);
    return new TeacherAnalyticsTestDto({
      releaseId: release.id,
      testId: release.testId,
      title: release.revision.title,
      releaseStatus: release.status,
      isRequired: release.isRequired,
      availableFrom: release.availableFrom,
      dueAt: release.dueAt,
      maxPoints: Number(release.maxPoints),
      passingPercent: Number(release.passingPercent),
      studentCount: studentIds.length,
      completionPercent: metrics.completionPercent,
      averagePercent: metrics.averagePercent,
      statuses: metrics.statuses,
    });
  }

  private toStudentLessonDtos(
    classLessons: ClassLessonRecord[],
    releases: ReleaseDetailRecord[],
    studentId: string,
  ): TeacherStudentLessonResultDto[] {
    const releasesByLesson = this.releasesByLesson(releases);
    return classLessons.flatMap((link) => {
      const lessonReleases = releasesByLesson.get(link.lessonId) ?? [];
      if (lessonReleases.length === 0) return [];
      return [
        new TeacherStudentLessonResultDto({
          id: link.lesson.id,
          title: link.lesson.title,
          position: link.position,
          tests: this.orderLessonReleases(link, lessonReleases).map((release) =>
            this.toStudentTestDto(release, studentId),
          ),
        }),
      ];
    });
  }

  private toStudentTestDto(
    release: ReleaseDetailRecord,
    studentId: string,
  ): TeacherStudentTestResultDto {
    const state = release.studentStates.find(
      (entry) => entry.studentId === studentId,
    );
    return new TeacherStudentTestResultDto({
      releaseId: release.id,
      testId: release.testId,
      title: release.revision.title,
      releaseStatus: release.status,
      isRequired: release.isRequired,
      status: state?.status ?? TestStudentStatus.NOT_STARTED,
      maxPoints: Number(release.maxPoints),
      passingPercent: Number(release.passingPercent),
      scorePoints:
        state?.scorePoints === null || !state
          ? null
          : Number(state.scorePoints),
      scorePercent:
        state?.scorePercent === null || !state
          ? null
          : Number(state.scorePercent),
      bestPoints:
        state?.bestPoints === null || !state ? null : Number(state.bestPoints),
      bestPercent:
        state?.bestPercent === null || !state
          ? null
          : Number(state.bestPercent),
      attemptCount: state?.attemptCount ?? 0,
      isLate: state?.isLate ?? false,
      availableFrom: release.availableFrom,
      dueAt: release.dueAt,
      lastActivityAt: state?.lastActivityAt ?? null,
      attempts: (state?.attempts ?? []).map(
        (attempt) =>
          new TeacherStudentAttemptDto({
            id: attempt.id,
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
            pendingReviewCount: attempt.pendingReviewCount,
            isLate: attempt.isLate,
            startedAt: attempt.startedAt,
            submittedAt: attempt.submittedAt,
            gradedAt: attempt.gradedAt,
          }),
      ),
    });
  }

  private releasesByLesson<T extends ReleaseRecord>(releases: T[]) {
    const byLesson = new Map<string, T[]>();
    for (const release of releases) {
      if (!release.lessonId) continue;
      const current = byLesson.get(release.lessonId) ?? [];
      current.push(release);
      byLesson.set(release.lessonId, current);
    }
    return byLesson;
  }

  private orderLessonReleases<T extends ReleaseRecord>(
    lesson: ClassLessonRecord,
    releases: T[],
  ): T[] {
    const positions = new Map(
      lesson.lesson.testLinks.map((link) => [link.testId, link.position]),
    );
    return [...releases].sort(
      (left, right) =>
        (positions.get(left.testId) ?? Number.MAX_SAFE_INTEGER) -
          (positions.get(right.testId) ?? Number.MAX_SAFE_INTEGER) ||
        left.revision.title.localeCompare(right.revision.title) ||
        left.id.localeCompare(right.id),
    );
  }

  private emptyStatuses(): TeacherAnalyticsStatusCountsDto {
    return new TeacherAnalyticsStatusCountsDto({
      notStarted: 0,
      inProgress: 0,
      awaitingReview: 0,
      needsRevision: 0,
      completed: 0,
      expired: 0,
    });
  }

  private incrementStatus(
    statuses: TeacherAnalyticsStatusCountsDto,
    status: TestStudentStatus,
  ): void {
    const keys: Record<
      TestStudentStatus,
      keyof TeacherAnalyticsStatusCountsDto
    > = {
      [TestStudentStatus.NOT_STARTED]: 'notStarted',
      [TestStudentStatus.IN_PROGRESS]: 'inProgress',
      [TestStudentStatus.AWAITING_REVIEW]: 'awaitingReview',
      [TestStudentStatus.NEEDS_REVISION]: 'needsRevision',
      [TestStudentStatus.COMPLETED]: 'completed',
      [TestStudentStatus.EXPIRED]: 'expired',
    };
    statuses[keys[status]] += 1;
  }

  private pairKey(releaseId: string, studentId: string): string {
    return `${releaseId}:${studentId}`;
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private assertTeacher(user: AuthUser): void {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only teachers can view class analytics',
      });
    }
  }

  private classNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'CLASS_NOT_FOUND',
      message: 'Class not found',
    });
  }

  private studentNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'CLASS_STUDENT_NOT_FOUND',
      message: 'Student not found in this class',
    });
  }
}
