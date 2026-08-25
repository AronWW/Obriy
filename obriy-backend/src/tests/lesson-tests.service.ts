import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TestAttemptStatus,
  TestReleaseStatus,
  TestRevisionStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { LessonTestDto } from './dto/lesson-test.dto';
import { TestsService } from './tests.service';

const openReleaseStatuses: TestReleaseStatus[] = [
  TestReleaseStatus.DRAFT,
  TestReleaseStatus.SCHEDULED,
  TestReleaseStatus.ACTIVE,
];

const lessonTestSelect = {
  id: true,
  lessonId: true,
  testId: true,
  testRevisionId: true,
  position: true,
  createdAt: true,
  revision: {
    select: {
      version: true,
      title: true,
      description: true,
      passingPercent: true,
      maxAttempts: true,
      timeLimitSeconds: true,
      scorePolicy: true,
      items: { select: { maxPoints: true } },
    },
  },
  test: {
    select: {
      revisions: {
        where: {
          status: {
            in: [TestRevisionStatus.DRAFT, TestRevisionStatus.PUBLISHED],
          },
        },
        select: { id: true, status: true },
      },
    },
  },
} satisfies Prisma.LessonTestSelect;

type LessonTestRecord = Prisma.LessonTestGetPayload<{
  select: typeof lessonTestSelect;
}>;

@Injectable()
export class LessonTestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly testsService: TestsService,
  ) {}

  async list(user: AuthUser, lessonId: string): Promise<LessonTestDto[]> {
    this.assertTeacher(user);
    await this.assertOwnedLesson(user.id, lessonId);
    const links = await this.prisma.lessonTest.findMany({
      where: { lessonId },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: lessonTestSelect,
    });
    const releases = await this.prisma.testRelease.findMany({
      where: { lessonId, testId: { in: links.map((link) => link.testId) } },
      select: { testId: true, status: true },
    });
    const statuses = new Map<string, TestReleaseStatus[]>();
    for (const release of releases) {
      const current = statuses.get(release.testId) ?? [];
      current.push(release.status);
      statuses.set(release.testId, current);
    }
    return links.map((link) =>
      this.toDto(link, statuses.get(link.testId) ?? []),
    );
  }

  async link(
    user: AuthUser,
    lessonId: string,
    testId: string,
  ): Promise<LessonTestDto> {
    this.assertTeacher(user);
    const lesson = await this.assertOwnedLesson(user.id, lessonId);
    const editor = await this.testsService.getTest(user, testId);
    this.assertMatchingLocale(lesson.contentLocale, editor.contentLocale);
    const existingLink = await this.prisma.lessonTest.findUnique({
      where: { lessonId_testId: { lessonId, testId } },
      select: { id: true },
    });
    if (existingLink) {
      throw new ConflictException({
        code: 'LESSON_TEST_ALREADY_LINKED',
        message: 'This test is already linked to the lesson',
      });
    }
    const revisionId = await this.publishCurrentDraft(user, testId, editor);
    const link = await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedLesson(transaction, user.id, lessonId);
      const duplicate = await transaction.lessonTest.findUnique({
        where: { lessonId_testId: { lessonId, testId } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'LESSON_TEST_ALREADY_LINKED',
          message: 'This test is already linked to the lesson',
        });
      }
      const revision = await this.findOwnedPublishedRevision(
        transaction,
        user.id,
        testId,
        revisionId,
      );
      const last = await transaction.lessonTest.aggregate({
        where: { lessonId },
        _max: { position: true },
      });
      const created = await transaction.lessonTest.create({
        data: {
          lessonId,
          testId,
          testRevisionId: revisionId,
          position: (last._max.position ?? -1) + 1,
        },
        select: { id: true },
      });
      await this.createReleasesForPublishedClasses(
        transaction,
        lessonId,
        testId,
        revision,
      );
      return created;
    });
    return this.findLink(user.id, lessonId, testId, link.id);
  }

  async updateVersion(
    user: AuthUser,
    lessonId: string,
    testId: string,
  ): Promise<LessonTestDto> {
    this.assertTeacher(user);
    const lesson = await this.assertOwnedLesson(user.id, lessonId);
    const editor = await this.testsService.getTest(user, testId);
    this.assertMatchingLocale(lesson.contentLocale, editor.contentLocale);
    const link = await this.prisma.lessonTest.findUnique({
      where: { lessonId_testId: { lessonId, testId } },
      select: { id: true, testRevisionId: true },
    });
    if (!link) {
      throw this.linkNotFound();
    }
    await this.assertNoOpenAttempts(this.prisma, lessonId, testId);
    const revisionId = await this.publishCurrentDraft(user, testId, editor);
    if (link.testRevisionId !== revisionId) {
      await this.prisma.$transaction(async (transaction) => {
        await this.lockOwnedLesson(transaction, user.id, lessonId);
        await this.lockLessonTestReleases(transaction, lessonId, testId);
        await this.assertNoOpenAttempts(transaction, lessonId, testId);
        const revision = await this.findOwnedPublishedRevision(
          transaction,
          user.id,
          testId,
          revisionId,
        );
        await this.archiveOpenReleases(transaction, lessonId, testId);
        await transaction.lessonTest.update({
          where: { id: link.id },
          data: { testRevisionId: revisionId },
        });
        await this.createReleasesForPublishedClasses(
          transaction,
          lessonId,
          testId,
          revision,
        );
      });
    }
    return this.findLink(user.id, lessonId, testId, link.id);
  }

  async reorder(
    user: AuthUser,
    lessonId: string,
    testIds: string[],
  ): Promise<LessonTestDto[]> {
    this.assertTeacher(user);
    await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedLesson(transaction, user.id, lessonId);
      const links = await transaction.lessonTest.findMany({
        where: { lessonId },
        orderBy: { position: 'asc' },
        select: { id: true, testId: true },
      });
      const currentIds = new Set(links.map((link) => link.testId));
      if (
        currentIds.size !== testIds.length ||
        testIds.some((testId) => !currentIds.has(testId))
      ) {
        throw new BadRequestException({
          code: 'INVALID_LESSON_TEST_ORDER',
          message: 'The order must contain every lesson test exactly once',
        });
      }
      const linksByTest = new Map(
        links.map((link) => [link.testId, link.id] as const),
      );
      await transaction.lessonTest.updateMany({
        where: { id: { in: links.map((link) => link.id) } },
        data: { position: { increment: links.length + 1 } },
      });
      for (const [position, testId] of testIds.entries()) {
        await transaction.lessonTest.update({
          where: { id: linksByTest.get(testId) },
          data: { position },
        });
      }
    });
    return this.list(user, lessonId);
  }

  async unlink(
    user: AuthUser,
    lessonId: string,
    testId: string,
  ): Promise<void> {
    this.assertTeacher(user);
    await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedLesson(transaction, user.id, lessonId);
      await this.lockLessonTestReleases(transaction, lessonId, testId);
      const link = await transaction.lessonTest.findUnique({
        where: { lessonId_testId: { lessonId, testId } },
        select: { id: true },
      });
      if (!link) {
        throw this.linkNotFound();
      }
      await this.assertNoOpenAttempts(transaction, lessonId, testId);
      await transaction.testRelease.deleteMany({
        where: { lessonId, testId, studentStates: { none: {} } },
      });
      await this.archiveOpenReleases(transaction, lessonId, testId);
      await transaction.lessonTest.delete({ where: { id: link.id } });
      await this.normalizePositions(transaction, lessonId);
    });
  }

  private async publishCurrentDraft(
    user: AuthUser,
    testId: string,
    current?: Awaited<ReturnType<TestsService['getTest']>>,
  ): Promise<string> {
    const editor = current ?? (await this.testsService.getTest(user, testId));
    const candidate = editor.draftRevision ?? editor.publishedRevision;
    if (!candidate) {
      throw new ConflictException({
        code: 'TEST_REVISION_NOT_FOUND',
        message: 'The test has no revision to link',
      });
    }
    const published = await this.testsService.publish(user, testId, {
      expectedRevisionId: candidate.id,
      expectedEditVersion: candidate.editVersion,
    });
    if (!published.publishedRevision) {
      throw new ConflictException({
        code: 'TEST_PUBLISHED_REVISION_NOT_FOUND',
        message: 'The test has no published revision to link',
      });
    }
    return published.publishedRevision.id;
  }

  private async findOwnedPublishedRevision(
    transaction: Prisma.TransactionClient,
    teacherId: string,
    testId: string,
    revisionId: string,
  ) {
    const revision = await transaction.testRevision.findFirst({
      where: {
        id: revisionId,
        testId,
        status: TestRevisionStatus.PUBLISHED,
        test: { teacherId },
      },
      select: {
        id: true,
        passingPercent: true,
        maxAttempts: true,
        timeLimitSeconds: true,
        scorePolicy: true,
        items: { select: { maxPoints: true } },
      },
    });
    if (!revision) {
      throw new NotFoundException({
        code: 'TEST_PUBLISHED_REVISION_NOT_FOUND',
        message: 'Published test revision not found',
      });
    }
    return revision;
  }

  private async createReleasesForPublishedClasses(
    transaction: Prisma.TransactionClient,
    lessonId: string,
    testId: string,
    revision: Awaited<
      ReturnType<LessonTestsService['findOwnedPublishedRevision']>
    >,
  ): Promise<void> {
    const classLinks = await transaction.classLesson.findMany({
      where: { lessonId, publishedAt: { not: null } },
      select: { classId: true, publishedAt: true },
    });
    if (classLinks.length === 0) {
      return;
    }
    const maxPoints = revision.items.reduce(
      (sum, item) => sum + Number(item.maxPoints),
      0,
    );
    await transaction.testRelease.createMany({
      data: classLinks.map((classLink) => ({
        testId,
        testRevisionId: revision.id,
        lessonId,
        classId: classLink.classId,
        status: TestReleaseStatus.ACTIVE,
        maxPoints,
        passingPercent: revision.passingPercent,
        isRequired: true,
        timeLimitSeconds: revision.timeLimitSeconds,
        maxAttempts: revision.maxAttempts,
        scorePolicy: revision.scorePolicy,
        publishedAt: classLink.publishedAt ?? new Date(),
      })),
    });
  }

  private async archiveOpenReleases(
    transaction: Prisma.TransactionClient,
    lessonId: string,
    testId: string,
  ): Promise<void> {
    await transaction.testRelease.updateMany({
      where: {
        lessonId,
        testId,
        status: { in: openReleaseStatuses },
      },
      data: { status: TestReleaseStatus.ARCHIVED, closedAt: new Date() },
    });
  }

  private async normalizePositions(
    transaction: Prisma.TransactionClient,
    lessonId: string,
  ): Promise<void> {
    const links = await transaction.lessonTest.findMany({
      where: { lessonId },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    if (links.length === 0) return;
    await transaction.lessonTest.updateMany({
      where: { id: { in: links.map((link) => link.id) } },
      data: { position: { increment: links.length + 1 } },
    });
    for (const [position, link] of links.entries()) {
      await transaction.lessonTest.update({
        where: { id: link.id },
        data: { position },
      });
    }
  }

  private async findLink(
    teacherId: string,
    lessonId: string,
    testId: string,
    linkId: string,
  ): Promise<LessonTestDto> {
    const link = await this.prisma.lessonTest.findFirst({
      where: {
        id: linkId,
        lessonId,
        testId,
        lesson: { teacherId },
        test: { teacherId },
      },
      select: lessonTestSelect,
    });
    if (!link) {
      throw this.linkNotFound();
    }
    const releases = await this.prisma.testRelease.findMany({
      where: { lessonId, testId },
      select: { status: true },
    });
    return this.toDto(
      link,
      releases.map((release) => release.status),
    );
  }

  private toDto(
    link: LessonTestRecord,
    releaseStatuses: TestReleaseStatus[],
  ): LessonTestDto {
    const currentPublished = link.test.revisions.find(
      (revision) => revision.status === TestRevisionStatus.PUBLISHED,
    );
    const hasDraft = link.test.revisions.some(
      (revision) => revision.status === TestRevisionStatus.DRAFT,
    );
    return new LessonTestDto({
      id: link.id,
      lessonId: link.lessonId,
      testId: link.testId,
      testRevisionId: link.testRevisionId,
      revisionVersion: link.revision.version,
      position: link.position,
      title: link.revision.title,
      description: link.revision.description,
      itemCount: link.revision.items.length,
      maxPoints: link.revision.items.reduce(
        (sum, item) => sum + Number(item.maxPoints),
        0,
      ),
      hasUpdate:
        hasDraft ||
        Boolean(
          currentPublished && currentPublished.id !== link.testRevisionId,
        ),
      activeReleaseCount: releaseStatuses.filter(
        (status) => status === TestReleaseStatus.ACTIVE,
      ).length,
      releaseCount: releaseStatuses.length,
      releaseStatuses,
      linkedAt: link.createdAt,
    });
  }

  private async assertOwnedLesson(
    teacherId: string,
    lessonId: string,
  ): Promise<{ contentLocale: string }> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, teacherId },
      select: { contentLocale: true },
    });
    if (!lesson) {
      throw this.lessonNotFound();
    }
    return lesson;
  }

  private assertMatchingLocale(lessonLocale: string, testLocale: string): void {
    if (lessonLocale !== testLocale) {
      throw new ConflictException({
        code: 'TEST_CONTENT_LOCALE_MISMATCH',
        message: 'The test language must match the lesson language',
      });
    }
  }

  private async assertNoOpenAttempts(
    client: PrismaService | Prisma.TransactionClient,
    lessonId: string,
    testId: string,
  ): Promise<void> {
    const openAttempts = await client.testAttempt.count({
      where: {
        status: TestAttemptStatus.IN_PROGRESS,
        studentState: { release: { lessonId, testId } },
      },
    });
    if (openAttempts > 0) {
      throw new ConflictException({
        code: 'TEST_RELEASE_HAS_OPEN_ATTEMPTS',
        message: 'Wait for open attempts before updating the test version',
      });
    }
  }

  private async lockLessonTestReleases(
    transaction: Prisma.TransactionClient,
    lessonId: string,
    testId: string,
  ): Promise<void> {
    await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id"
      FROM "TestRelease"
      WHERE "lessonId" = ${lessonId} AND "testId" = ${testId}
      ORDER BY "id"
      FOR UPDATE
    `);
  }

  private async lockOwnedLesson(
    transaction: Prisma.TransactionClient,
    teacherId: string,
    lessonId: string,
  ): Promise<void> {
    const rows = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id"
      FROM "Lesson"
      WHERE "id" = ${lessonId} AND "teacherId" = ${teacherId}
      FOR UPDATE
    `);
    if (rows.length === 0) {
      throw this.lessonNotFound();
    }
  }

  private assertTeacher(user: AuthUser): void {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only teachers can manage lesson tests',
      });
    }
  }

  private lessonNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'LESSON_NOT_FOUND',
      message: 'Lesson not found',
    });
  }

  private linkNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'LESSON_TEST_NOT_FOUND',
      message: 'Lesson test link not found',
    });
  }
}
