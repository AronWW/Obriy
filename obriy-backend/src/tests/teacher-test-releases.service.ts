import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
  TeacherTestReleaseClassDto,
  TeacherTestReleaseDto,
  UpdateTestReleaseSettingsDto,
} from './dto/test-release.dto';

const mutableStatuses: TestReleaseStatus[] = [
  TestReleaseStatus.DRAFT,
  TestReleaseStatus.SCHEDULED,
  TestReleaseStatus.ACTIVE,
  TestReleaseStatus.CLOSED,
];

const teacherReleaseSelect = {
  id: true,
  lessonId: true,
  testId: true,
  testRevisionId: true,
  status: true,
  isRequired: true,
  availableFrom: true,
  dueAt: true,
  maxAttempts: true,
  latePolicy: true,
  latePenaltyPercent: true,
  xpReward: true,
  publishedAt: true,
  closedAt: true,
  updatedAt: true,
  class: { select: { id: true, name: true } },
  studentStates: {
    select: {
      attemptCount: true,
      status: true,
    },
  },
} satisfies Prisma.TestReleaseSelect;

type TeacherReleaseRecord = Prisma.TestReleaseGetPayload<{
  select: typeof teacherReleaseSelect;
}>;

type ReleaseClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class TeacherTestReleasesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: AuthUser,
    lessonId: string,
    testId: string,
  ): Promise<TeacherTestReleaseDto[]> {
    this.assertTeacher(user);
    await this.assertOwnedLink(this.prisma, user.id, lessonId, testId);
    const releases = await this.prisma.testRelease.findMany({
      where: {
        lessonId,
        testId,
        status: { in: mutableStatuses },
      },
      orderBy: [{ class: { name: 'asc' } }, { id: 'asc' }],
      select: teacherReleaseSelect,
    });
    return releases.map((release) => this.toDto(release));
  }

  async update(
    user: AuthUser,
    releaseId: string,
    settings: UpdateTestReleaseSettingsDto,
  ): Promise<TeacherTestReleaseDto> {
    this.assertTeacher(user);
    return this.prisma.$transaction(async (transaction) => {
      await this.lockReleases(transaction, [releaseId]);
      const release = await this.findOwnedRelease(
        transaction,
        user.id,
        releaseId,
      );
      await this.applySettings(transaction, release, settings);
      return this.findDto(transaction, user.id, releaseId);
    });
  }

  async updateMany(
    user: AuthUser,
    lessonId: string,
    testId: string,
    releaseIds: string[],
    settings: UpdateTestReleaseSettingsDto,
  ): Promise<TeacherTestReleaseDto[]> {
    this.assertTeacher(user);
    return this.prisma.$transaction(async (transaction) => {
      await this.assertOwnedLink(transaction, user.id, lessonId, testId);
      await this.lockReleases(transaction, releaseIds);
      const releases = await transaction.testRelease.findMany({
        where: {
          id: { in: releaseIds },
          lessonId,
          testId,
          status: { in: mutableStatuses },
          lesson: { teacherId: user.id },
          test: { teacherId: user.id },
        },
        select: teacherReleaseSelect,
      });
      if (releases.length !== releaseIds.length) {
        throw this.releaseNotFound();
      }
      for (const release of releases) {
        await this.applySettings(transaction, release, settings);
      }
      const updated = await transaction.testRelease.findMany({
        where: { id: { in: releaseIds } },
        orderBy: [{ class: { name: 'asc' } }, { id: 'asc' }],
        select: teacherReleaseSelect,
      });
      return updated.map((release) => this.toDto(release));
    });
  }

  async publish(
    user: AuthUser,
    releaseId: string,
  ): Promise<TeacherTestReleaseDto> {
    this.assertTeacher(user);
    return this.prisma.$transaction(async (transaction) => {
      await this.lockReleases(transaction, [releaseId]);
      const release = await this.findOwnedRelease(
        transaction,
        user.id,
        releaseId,
      );
      await this.assertCanPublish(transaction, release);
      const now = new Date();
      const status = this.publishedStatus(release, now);
      await transaction.testRelease.update({
        where: { id: release.id },
        data: {
          status,
          publishedAt: release.publishedAt ?? now,
          closedAt: status === TestReleaseStatus.CLOSED ? now : null,
        },
      });
      return this.findDto(transaction, user.id, release.id);
    });
  }

  async publishMany(
    user: AuthUser,
    lessonId: string,
    testId: string,
    releaseIds: string[],
  ): Promise<TeacherTestReleaseDto[]> {
    this.assertTeacher(user);
    return this.prisma.$transaction(async (transaction) => {
      await this.assertOwnedLink(transaction, user.id, lessonId, testId);
      await this.lockReleases(transaction, releaseIds);
      const releases = await transaction.testRelease.findMany({
        where: {
          id: { in: releaseIds },
          lessonId,
          testId,
          status: { in: mutableStatuses },
          lesson: { teacherId: user.id },
          test: { teacherId: user.id },
        },
        select: teacherReleaseSelect,
      });
      if (releases.length !== releaseIds.length) {
        throw this.releaseNotFound();
      }
      for (const release of releases) {
        await this.assertCanPublish(transaction, release);
      }
      const now = new Date();
      for (const release of releases) {
        const status = this.publishedStatus(release, now);
        await transaction.testRelease.update({
          where: { id: release.id },
          data: {
            status,
            publishedAt: release.publishedAt ?? now,
            closedAt: status === TestReleaseStatus.CLOSED ? now : null,
          },
        });
      }
      const updated = await transaction.testRelease.findMany({
        where: { id: { in: releaseIds } },
        orderBy: [{ class: { name: 'asc' } }, { id: 'asc' }],
        select: teacherReleaseSelect,
      });
      return updated.map((release) => this.toDto(release));
    });
  }

  async close(
    user: AuthUser,
    releaseId: string,
  ): Promise<TeacherTestReleaseDto> {
    this.assertTeacher(user);
    return this.prisma.$transaction(async (transaction) => {
      await this.lockReleases(transaction, [releaseId]);
      const release = await this.findOwnedRelease(
        transaction,
        user.id,
        releaseId,
      );
      if (release.status === TestReleaseStatus.DRAFT) {
        throw new ConflictException({
          code: 'TEST_RELEASE_NOT_PUBLISHED',
          message: 'A draft release cannot be closed',
        });
      }
      if (release.status !== TestReleaseStatus.CLOSED) {
        await transaction.testRelease.update({
          where: { id: release.id },
          data: { status: TestReleaseStatus.CLOSED, closedAt: new Date() },
        });
      }
      return this.findDto(transaction, user.id, release.id);
    });
  }

  async reopen(
    user: AuthUser,
    releaseId: string,
  ): Promise<TeacherTestReleaseDto> {
    this.assertTeacher(user);
    return this.prisma.$transaction(async (transaction) => {
      await this.lockReleases(transaction, [releaseId]);
      const release = await this.findOwnedRelease(
        transaction,
        user.id,
        releaseId,
      );
      if (release.status !== TestReleaseStatus.CLOSED) {
        throw new ConflictException({
          code: 'TEST_RELEASE_NOT_CLOSED',
          message: 'Only a closed release can be reopened',
        });
      }
      await this.assertPublishedClassLesson(transaction, release);
      const now = new Date();
      if (
        release.latePolicy === TestLatePolicy.DISALLOW &&
        release.dueAt !== null &&
        release.dueAt <= now
      ) {
        throw new ConflictException({
          code: 'TEST_RELEASE_DEADLINE_PASSED',
          message: 'Move the deadline or allow late submissions first',
        });
      }
      await transaction.testRelease.update({
        where: { id: release.id },
        data: {
          status:
            release.availableFrom && release.availableFrom > now
              ? TestReleaseStatus.SCHEDULED
              : TestReleaseStatus.ACTIVE,
          closedAt: null,
          publishedAt: release.publishedAt ?? now,
        },
      });
      return this.findDto(transaction, user.id, release.id);
    });
  }

  private async applySettings(
    transaction: Prisma.TransactionClient,
    release: TeacherReleaseRecord,
    settings: UpdateTestReleaseSettingsDto,
  ): Promise<void> {
    const availableFrom = this.dateValue(
      settings.availableFrom,
      release.availableFrom,
    );
    const dueAt = this.dateValue(settings.dueAt, release.dueAt);
    const maxAttempts =
      settings.maxAttempts === undefined
        ? release.maxAttempts
        : settings.maxAttempts;
    const latePolicy = settings.latePolicy ?? release.latePolicy;
    let latePenaltyPercent =
      settings.latePenaltyPercent === undefined
        ? release.latePenaltyPercent === null
          ? null
          : Number(release.latePenaltyPercent)
        : settings.latePenaltyPercent;

    if (availableFrom && dueAt && availableFrom >= dueAt) {
      throw new BadRequestException({
        code: 'TEST_RELEASE_DATE_ORDER_INVALID',
        message: 'The deadline must be later than the opening date',
      });
    }
    if (latePolicy === TestLatePolicy.ALLOW_WITH_PENALTY) {
      if (latePenaltyPercent === null) {
        throw new BadRequestException({
          code: 'TEST_RELEASE_PENALTY_REQUIRED',
          message: 'A late penalty is required for this policy',
        });
      }
    } else {
      latePenaltyPercent = null;
    }

    const attemptCount = release.studentStates.reduce(
      (maximum, state) => Math.max(maximum, state.attemptCount),
      0,
    );
    if (attemptCount > 0) {
      if (availableFrom && availableFrom > new Date()) {
        throw new ConflictException({
          code: 'TEST_RELEASE_ALREADY_STARTED',
          message:
            'The opening date cannot be moved into the future after an attempt',
        });
      }
      if (maxAttempts !== null && maxAttempts < attemptCount) {
        throw new ConflictException({
          code: 'TEST_RELEASE_ATTEMPT_LIMIT_TOO_LOW',
          message: 'The attempt limit is lower than the number already used',
        });
      }
    }

    const nextStatus = this.statusAfterSettings(
      release.status,
      availableFrom,
      dueAt,
      latePolicy,
    );
    await transaction.testRelease.update({
      where: { id: release.id },
      data: {
        isRequired: settings.isRequired,
        availableFrom,
        dueAt,
        maxAttempts,
        latePolicy,
        latePenaltyPercent,
        xpReward: settings.xpReward,
        status: nextStatus,
        closedAt:
          nextStatus === TestReleaseStatus.CLOSED
            ? (release.closedAt ?? new Date())
            : nextStatus === TestReleaseStatus.DRAFT
              ? release.closedAt
              : null,
      },
    });
  }

  private statusAfterSettings(
    current: TestReleaseStatus,
    availableFrom: Date | null,
    dueAt: Date | null,
    latePolicy: TestLatePolicy,
  ): TestReleaseStatus {
    if (
      current === TestReleaseStatus.DRAFT ||
      current === TestReleaseStatus.CLOSED
    ) {
      return current;
    }
    const now = new Date();
    if (dueAt && dueAt <= now && latePolicy === TestLatePolicy.DISALLOW) {
      return TestReleaseStatus.CLOSED;
    }
    return availableFrom && availableFrom > now
      ? TestReleaseStatus.SCHEDULED
      : TestReleaseStatus.ACTIVE;
  }

  private publishedStatus(
    release: Pick<
      TeacherReleaseRecord,
      'availableFrom' | 'dueAt' | 'latePolicy'
    >,
    now: Date,
  ): TestReleaseStatus {
    if (
      release.dueAt &&
      release.dueAt <= now &&
      release.latePolicy === TestLatePolicy.DISALLOW
    ) {
      throw new ConflictException({
        code: 'TEST_RELEASE_DEADLINE_PASSED',
        message:
          'Move the deadline or allow late submissions before publishing',
      });
    }
    return release.availableFrom && release.availableFrom > now
      ? TestReleaseStatus.SCHEDULED
      : TestReleaseStatus.ACTIVE;
  }

  private async assertCanPublish(
    transaction: Prisma.TransactionClient,
    release: TeacherReleaseRecord,
  ): Promise<void> {
    if (release.status !== TestReleaseStatus.DRAFT) {
      throw new ConflictException({
        code: 'TEST_RELEASE_NOT_DRAFT',
        message: 'Only a draft release can be published',
      });
    }
    await this.assertPublishedClassLesson(transaction, release);
    this.publishedStatus(release, new Date());
  }

  private async assertPublishedClassLesson(
    client: ReleaseClient,
    release: Pick<TeacherReleaseRecord, 'class' | 'lessonId'>,
  ): Promise<void> {
    if (!release.lessonId) {
      throw this.releaseNotFound();
    }
    const link = await client.classLesson.findUnique({
      where: {
        classId_lessonId: {
          classId: release.class.id,
          lessonId: release.lessonId,
        },
      },
      select: { publishedAt: true },
    });
    if (!link?.publishedAt) {
      throw new ConflictException({
        code: 'TEST_RELEASE_LESSON_NOT_PUBLISHED',
        message: 'Publish the lesson to this class first',
      });
    }
  }

  private async assertOwnedLink(
    client: ReleaseClient,
    teacherId: string,
    lessonId: string,
    testId: string,
  ): Promise<void> {
    const link = await client.lessonTest.findFirst({
      where: {
        lessonId,
        testId,
        lesson: { teacherId },
        test: { teacherId },
      },
      select: { id: true },
    });
    if (!link) {
      throw new NotFoundException({
        code: 'LESSON_TEST_NOT_FOUND',
        message: 'Lesson test link not found',
      });
    }
  }

  private async findOwnedRelease(
    client: ReleaseClient,
    teacherId: string,
    releaseId: string,
  ): Promise<TeacherReleaseRecord> {
    const release = await client.testRelease.findFirst({
      where: {
        id: releaseId,
        status: { in: mutableStatuses },
        lesson: { teacherId },
        test: { teacherId },
      },
      select: teacherReleaseSelect,
    });
    if (!release) throw this.releaseNotFound();
    return release;
  }

  private async findDto(
    client: ReleaseClient,
    teacherId: string,
    releaseId: string,
  ): Promise<TeacherTestReleaseDto> {
    return this.toDto(
      await this.findOwnedRelease(client, teacherId, releaseId),
    );
  }

  private async lockReleases(
    transaction: Prisma.TransactionClient,
    releaseIds: string[],
  ): Promise<void> {
    if (releaseIds.length === 0) return;
    await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id"
      FROM "TestRelease"
      WHERE "id" IN (${Prisma.join(releaseIds)})
      ORDER BY "id"
      FOR UPDATE
    `);
  }

  private dateValue(
    input: string | null | undefined,
    current: Date | null,
  ): Date | null {
    if (input === undefined) return current;
    return input === null ? null : new Date(input);
  }

  private toDto(release: TeacherReleaseRecord): TeacherTestReleaseDto {
    return new TeacherTestReleaseDto({
      id: release.id,
      lessonId: release.lessonId ?? '',
      testId: release.testId,
      testRevisionId: release.testRevisionId,
      class: new TeacherTestReleaseClassDto(release.class),
      status: release.status,
      isRequired: release.isRequired,
      availableFrom: release.availableFrom,
      dueAt: release.dueAt,
      maxAttempts: release.maxAttempts,
      latePolicy: release.latePolicy,
      latePenaltyPercent:
        release.latePenaltyPercent === null
          ? null
          : Number(release.latePenaltyPercent),
      xpReward: release.xpReward,
      attemptCount: release.studentStates.reduce(
        (sum, state) => sum + state.attemptCount,
        0,
      ),
      inProgressCount: release.studentStates.filter(
        (state) => state.status === TestStudentStatus.IN_PROGRESS,
      ).length,
      publishedAt: release.publishedAt,
      closedAt: release.closedAt,
      updatedAt: release.updatedAt,
    });
  }

  private assertTeacher(user: AuthUser): void {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only teachers can manage test releases',
      });
    }
  }

  private releaseNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'TEST_RELEASE_NOT_FOUND',
      message: 'Test release not found',
    });
  }
}
