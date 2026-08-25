import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Locale,
  Prisma,
  TestRevisionStatus,
  TestStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { AssignmentsService } from '../assignments/assignments.service';
import { CreateTestDto } from './dto/create-test.dto';
import { ListTestsQueryDto } from './dto/list-tests-query.dto';
import { PublishTestDto } from './dto/publish-test.dto';
import {
  AddTestItemDto,
  RemoveTestItemDto,
  ReorderTestItemsDto,
  UpdateTestItemDto,
  UpdateTestItemRevisionDto,
} from './dto/test-items.dto';
import { TestEditorDto, TestListResponseDto } from './dto/test-response.dto';
import { UpdateTestDraftDto } from './dto/update-test-draft.dto';
import {
  testEditorSelect,
  testListSelect,
  toTestEditorDto,
  toTestSummaryDto,
} from './mappers/test.mapper';

const CURRENT_TEST_SCHEMA_VERSION = 1;
const DEFAULT_TEST_PAGE_SIZE = 20;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const mutableRevisionSelect = {
  id: true,
  testId: true,
  version: true,
  status: true,
  title: true,
  description: true,
  instructions: true,
  passingPercent: true,
  maxAttempts: true,
  timeLimitSeconds: true,
  scorePolicy: true,
  shuffleItems: true,
  schemaVersion: true,
  editVersion: true,
  publishedAt: true,
  items: {
    orderBy: [{ position: 'asc' as const }],
    select: {
      id: true,
      assignmentId: true,
      assignmentRevisionId: true,
      position: true,
      maxPoints: true,
    },
  },
} satisfies Prisma.TestRevisionSelect;

type MutableRevisionRecord = Prisma.TestRevisionGetPayload<{
  select: typeof mutableRevisionSelect;
}>;

@Injectable()
export class TestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentsService: AssignmentsService,
  ) {}

  async createTest(user: AuthUser, dto: CreateTestDto): Promise<TestEditorDto> {
    this.assertTeacher(user);
    this.assertTimeSettings(dto.maxAttempts, dto.timeLimitSeconds);
    const contentLocale =
      dto.contentLocale ?? (await this.findPreferredLocale(user.id));
    const test = await this.prisma.test.create({
      data: {
        teacherId: user.id,
        contentLocale,
        revisions: {
          create: {
            version: 1,
            title: dto.title ?? '',
            description: dto.description ?? '',
            instructions: this.normalizeOptionalText(dto.instructions ?? null),
            passingPercent: dto.passingPercent,
            maxAttempts: dto.maxAttempts,
            timeLimitSeconds: dto.timeLimitSeconds,
            scorePolicy: dto.scorePolicy,
            shuffleItems: dto.shuffleItems,
            schemaVersion: CURRENT_TEST_SCHEMA_VERSION,
          },
        },
      },
      select: { id: true },
    });

    return this.findOwnedEditor(user.id, test.id);
  }

  async listTests(
    user: AuthUser,
    query: ListTestsQueryDto,
  ): Promise<TestListResponseDto> {
    this.assertTeacher(user);
    const limit = query.limit ?? DEFAULT_TEST_PAGE_SIZE;
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;
    const records = await this.prisma.test.findMany({
      where: {
        teacherId: user.id,
        status: query.status ?? { not: TestStatus.ARCHIVED },
        ...(query.contentLocale ? { contentLocale: query.contentLocale } : {}),
        ...(query.search
          ? {
              revisions: {
                some: {
                  status: {
                    in: [
                      TestRevisionStatus.DRAFT,
                      TestRevisionStatus.PUBLISHED,
                    ],
                  },
                  title: {
                    contains: query.search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            }
          : {}),
        ...(cursor
          ? {
              OR: [
                { updatedAt: { lt: cursor.updatedAt } },
                { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: testListSelect,
    });
    const hasNextPage = records.length > limit;
    const page = records.slice(0, limit);
    const revisionIds = page.flatMap((test) =>
      test.revisions.map((revision) => revision.id),
    );
    const pointTotals =
      revisionIds.length === 0
        ? []
        : await this.prisma.testItem.groupBy({
            by: ['testRevisionId'],
            where: { testRevisionId: { in: revisionIds } },
            _sum: { maxPoints: true },
          });
    const pointsByRevision = new Map(
      pointTotals.map((total) => [
        total.testRevisionId,
        total._sum.maxPoints?.toNumber() ?? 0,
      ]),
    );

    return new TestListResponseDto({
      items: page.map((test) => toTestSummaryDto(test, pointsByRevision)),
      nextCursor: hasNextPage ? this.encodeCursor(page.at(-1) ?? null) : null,
    });
  }

  async getTest(user: AuthUser, testId: string): Promise<TestEditorDto> {
    this.assertTeacher(user);
    return this.findOwnedEditor(user.id, testId);
  }

  async updateDraft(
    user: AuthUser,
    testId: string,
    dto: UpdateTestDraftDto,
  ): Promise<TestEditorDto> {
    this.assertTeacher(user);
    this.assertTimeSettings(dto.maxAttempts, dto.timeLimitSeconds);

    return this.prisma.$transaction(async (transaction) => {
      const test = await this.lockOwnedTest(transaction, user.id, testId);
      this.assertNotArchived(test.status);
      const draft = await this.findDraft(transaction, testId);
      this.assertDraftVersion(draft, dto);

      const updated = await transaction.testRevision.updateMany({
        where: {
          id: draft.id,
          status: TestRevisionStatus.DRAFT,
          editVersion: dto.expectedEditVersion,
        },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.instructions !== undefined
            ? { instructions: this.normalizeOptionalText(dto.instructions) }
            : {}),
          ...(dto.passingPercent !== undefined
            ? { passingPercent: dto.passingPercent }
            : {}),
          ...(dto.maxAttempts !== undefined
            ? { maxAttempts: dto.maxAttempts }
            : {}),
          ...(dto.timeLimitSeconds !== undefined
            ? { timeLimitSeconds: dto.timeLimitSeconds }
            : {}),
          ...(dto.scorePolicy !== undefined
            ? { scorePolicy: dto.scorePolicy }
            : {}),
          ...(dto.shuffleItems !== undefined
            ? { shuffleItems: dto.shuffleItems }
            : {}),
          editVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw this.editConflict(draft.id, draft.editVersion);
      }
      await this.touchTest(transaction, testId);

      return this.findOwnedEditorInTransaction(transaction, user.id, testId);
    });
  }

  async addItem(
    user: AuthUser,
    testId: string,
    dto: AddTestItemDto,
  ): Promise<TestEditorDto> {
    this.assertTeacher(user);
    const assignment = await this.assignmentsService.getAssignment(
      user,
      dto.assignmentId,
    );
    await this.prisma.$transaction(async (transaction) => {
      const test = await this.lockOwnedTest(transaction, user.id, testId);
      this.assertNotArchived(test.status);
      if (test.contentLocale !== assignment.contentLocale) {
        throw new ConflictException({
          code: 'ASSIGNMENT_CONTENT_LOCALE_MISMATCH',
          message: 'The assignment language must match the test language',
        });
      }
      const draft = await this.findDraft(transaction, testId);
      this.assertDraftVersion(draft, dto);
      if (draft.items.some((item) => item.assignmentId === assignment.id)) {
        throw new ConflictException({
          code: 'TEST_ITEM_ALREADY_ADDED',
          message: 'This assignment is already part of the test',
        });
      }
    });
    const revision = assignment.draftRevision
      ? (
          await this.assignmentsService.publish(user, assignment.id, {
            expectedRevisionId: assignment.draftRevision.id,
            expectedEditVersion: assignment.draftRevision.editVersion,
          })
        ).publishedRevision
      : assignment.publishedRevision;
    if (!revision) {
      throw new ConflictException({
        code: 'TEST_ITEM_ASSIGNMENT_NOT_PUBLISHED',
        message: 'The assignment must be complete before adding it to a test',
      });
    }

    return this.prisma.$transaction(async (transaction) => {
      const test = await this.lockOwnedTest(transaction, user.id, testId);
      this.assertNotArchived(test.status);
      if (test.contentLocale !== assignment.contentLocale) {
        throw new ConflictException({
          code: 'ASSIGNMENT_CONTENT_LOCALE_MISMATCH',
          message: 'The assignment language must match the test language',
        });
      }
      const draft = await this.findDraft(transaction, testId);
      this.assertDraftVersion(draft, dto);
      const duplicate = draft.items.some(
        (item) => item.assignmentId === assignment.id,
      );
      if (duplicate) {
        throw new ConflictException({
          code: 'TEST_ITEM_ALREADY_ADDED',
          message: 'This assignment is already part of the test',
        });
      }

      await transaction.testItem.create({
        data: {
          testRevisionId: draft.id,
          assignmentId: assignment.id,
          assignmentRevisionId: revision.id,
          position: draft.items.length,
          maxPoints: dto.maxPoints ?? assignment.defaultMaxPoints,
        },
      });
      await this.incrementDraftVersion(transaction, draft, testId);

      return this.findOwnedEditorInTransaction(transaction, user.id, testId);
    });
  }

  async updateItem(
    user: AuthUser,
    testId: string,
    itemId: string,
    dto: UpdateTestItemDto,
  ): Promise<TestEditorDto> {
    this.assertTeacher(user);
    return this.prisma.$transaction(async (transaction) => {
      const test = await this.lockOwnedTest(transaction, user.id, testId);
      this.assertNotArchived(test.status);
      const draft = await this.findDraft(transaction, testId);
      this.assertDraftVersion(draft, dto);
      this.assertDraftItem(draft, itemId);

      await transaction.testItem.update({
        where: { id: itemId },
        data: { maxPoints: dto.maxPoints },
      });
      await this.incrementDraftVersion(transaction, draft, testId);

      return this.findOwnedEditorInTransaction(transaction, user.id, testId);
    });
  }

  async updateItemRevision(
    user: AuthUser,
    testId: string,
    itemId: string,
    dto: UpdateTestItemRevisionDto,
  ): Promise<TestEditorDto> {
    this.assertTeacher(user);
    const assignmentId = await this.prisma.$transaction(async (transaction) => {
      const test = await this.lockOwnedTest(transaction, user.id, testId);
      this.assertNotArchived(test.status);
      const draft = await this.findDraft(transaction, testId);
      this.assertDraftVersion(draft, dto);
      return this.assertDraftItem(draft, itemId).assignmentId;
    });
    const assignment = await this.assignmentsService.getAssignment(
      user,
      assignmentId,
    );
    const revision = assignment.draftRevision
      ? (
          await this.assignmentsService.publish(user, assignment.id, {
            expectedRevisionId: assignment.draftRevision.id,
            expectedEditVersion: assignment.draftRevision.editVersion,
          })
        ).publishedRevision
      : assignment.publishedRevision;
    if (!revision) {
      throw new ConflictException({
        code: 'TEST_ITEM_ASSIGNMENT_NOT_PUBLISHED',
        message: 'The assignment must be complete before updating it',
      });
    }

    return this.prisma.$transaction(async (transaction) => {
      const test = await this.lockOwnedTest(transaction, user.id, testId);
      this.assertNotArchived(test.status);
      if (test.contentLocale !== assignment.contentLocale) {
        throw new ConflictException({
          code: 'ASSIGNMENT_CONTENT_LOCALE_MISMATCH',
          message: 'The assignment language must match the test language',
        });
      }
      const draft = await this.findDraft(transaction, testId);
      this.assertDraftVersion(draft, dto);
      const item = this.assertDraftItem(draft, itemId);
      if (item.assignmentId !== assignment.id) {
        throw new ConflictException({
          code: 'TEST_ITEM_ASSIGNMENT_CHANGED',
          message: 'The test item assignment changed during the update',
        });
      }
      if (item.assignmentRevisionId === revision.id) {
        return this.findOwnedEditorInTransaction(transaction, user.id, testId);
      }

      await transaction.testItem.update({
        where: { id: itemId },
        data: { assignmentRevisionId: revision.id },
      });
      await this.incrementDraftVersion(transaction, draft, testId);

      return this.findOwnedEditorInTransaction(transaction, user.id, testId);
    });
  }

  async reorderItems(
    user: AuthUser,
    testId: string,
    dto: ReorderTestItemsDto,
  ): Promise<TestEditorDto> {
    this.assertTeacher(user);
    return this.prisma.$transaction(async (transaction) => {
      const test = await this.lockOwnedTest(transaction, user.id, testId);
      this.assertNotArchived(test.status);
      const draft = await this.findDraft(transaction, testId);
      this.assertDraftVersion(draft, dto);
      const currentIds = new Set(draft.items.map((item) => item.id));
      if (
        currentIds.size !== dto.itemIds.length ||
        dto.itemIds.some((itemId) => !currentIds.has(itemId))
      ) {
        throw new BadRequestException({
          code: 'INVALID_TEST_ITEM_ORDER',
          message:
            'The order must contain every current test item exactly once',
        });
      }

      await this.writeItemOrder(transaction, dto.itemIds);
      await this.incrementDraftVersion(transaction, draft, testId);

      return this.findOwnedEditorInTransaction(transaction, user.id, testId);
    });
  }

  async removeItem(
    user: AuthUser,
    testId: string,
    itemId: string,
    dto: RemoveTestItemDto,
  ): Promise<TestEditorDto> {
    this.assertTeacher(user);
    return this.prisma.$transaction(async (transaction) => {
      const test = await this.lockOwnedTest(transaction, user.id, testId);
      this.assertNotArchived(test.status);
      const draft = await this.findDraft(transaction, testId);
      this.assertDraftVersion(draft, dto);
      this.assertDraftItem(draft, itemId);

      await transaction.testItem.delete({ where: { id: itemId } });
      await this.writeItemOrder(
        transaction,
        draft.items.filter((item) => item.id !== itemId).map((item) => item.id),
      );
      await this.incrementDraftVersion(transaction, draft, testId);

      return this.findOwnedEditorInTransaction(transaction, user.id, testId);
    });
  }

  async startEdit(user: AuthUser, testId: string): Promise<TestEditorDto> {
    this.assertTeacher(user);
    return this.prisma.$transaction(async (transaction) => {
      const test = await this.lockOwnedTest(transaction, user.id, testId);
      this.assertNotArchived(test.status);
      const existing = await transaction.testRevision.findFirst({
        where: { testId, status: TestRevisionStatus.DRAFT },
        select: { id: true },
      });
      if (!existing) {
        const published = await transaction.testRevision.findFirst({
          where: { testId, status: TestRevisionStatus.PUBLISHED },
          orderBy: { version: 'desc' },
          select: mutableRevisionSelect,
        });
        if (!published) {
          throw new ConflictException({
            code: 'TEST_PUBLISHED_REVISION_NOT_FOUND',
            message: 'A published test revision is required to start editing',
          });
        }
        const versions = await transaction.testRevision.aggregate({
          where: { testId },
          _max: { version: true },
        });
        await transaction.testRevision.create({
          data: {
            testId,
            version: (versions._max.version ?? 0) + 1,
            title: published.title,
            description: published.description,
            instructions: published.instructions,
            passingPercent: published.passingPercent,
            maxAttempts: published.maxAttempts,
            timeLimitSeconds: published.timeLimitSeconds,
            scorePolicy: published.scorePolicy,
            shuffleItems: published.shuffleItems,
            schemaVersion: published.schemaVersion,
            items: {
              create: published.items.map((item) => ({
                assignmentId: item.assignmentId,
                assignmentRevisionId: item.assignmentRevisionId,
                position: item.position,
                maxPoints: item.maxPoints,
              })),
            },
          },
        });
        await this.touchTest(transaction, testId);
      }

      return this.findOwnedEditorInTransaction(transaction, user.id, testId);
    });
  }

  async publish(
    user: AuthUser,
    testId: string,
    dto: PublishTestDto,
  ): Promise<TestEditorDto> {
    this.assertTeacher(user);
    return this.prisma.$transaction(async (transaction) => {
      const test = await this.lockOwnedTest(transaction, user.id, testId);
      this.assertNotArchived(test.status);
      const draft = await transaction.testRevision.findFirst({
        where: { testId, status: TestRevisionStatus.DRAFT },
        select: mutableRevisionSelect,
      });
      if (!draft) {
        const published = await transaction.testRevision.findFirst({
          where: { testId, status: TestRevisionStatus.PUBLISHED },
          select: { id: true, editVersion: true },
        });
        if (!published) {
          throw this.draftNotFound();
        }
        this.assertDraftVersion(published, dto);
        return this.findOwnedEditorInTransaction(transaction, user.id, testId);
      }
      this.assertDraftVersion(draft, dto);
      const issues = this.getPublishIssues(draft);
      if (issues.length > 0) {
        throw new ConflictException({
          code: 'TEST_INCOMPLETE',
          message: 'Complete the test before publishing it',
          issues,
        });
      }

      const publishedAt = new Date();
      await transaction.testRevision.updateMany({
        where: { testId, status: TestRevisionStatus.PUBLISHED },
        data: { status: TestRevisionStatus.ARCHIVED },
      });
      const updated = await transaction.testRevision.updateMany({
        where: {
          id: draft.id,
          status: TestRevisionStatus.DRAFT,
          editVersion: dto.expectedEditVersion,
        },
        data: {
          status: TestRevisionStatus.PUBLISHED,
          publishedAt,
        },
      });
      if (updated.count !== 1) {
        throw this.editConflict(draft.id, draft.editVersion);
      }
      await transaction.test.update({
        where: { id: testId },
        data: {
          status: TestStatus.PUBLISHED,
          archivedAt: null,
          updatedAt: publishedAt,
        },
      });

      return this.findOwnedEditorInTransaction(transaction, user.id, testId);
    });
  }

  async archive(user: AuthUser, testId: string): Promise<TestEditorDto> {
    this.assertTeacher(user);
    await this.prisma.test.updateMany({
      where: { id: testId, teacherId: user.id },
      data: { status: TestStatus.ARCHIVED, archivedAt: new Date() },
    });
    return this.findOwnedEditor(user.id, testId);
  }

  async restore(user: AuthUser, testId: string): Promise<TestEditorDto> {
    this.assertTeacher(user);
    const owned = await this.prisma.test.findFirst({
      where: { id: testId, teacherId: user.id },
      select: {
        id: true,
        revisions: {
          where: { status: TestRevisionStatus.PUBLISHED },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!owned) {
      throw this.testNotFound();
    }
    await this.prisma.test.update({
      where: { id: testId },
      data: {
        status:
          owned.revisions.length > 0 ? TestStatus.PUBLISHED : TestStatus.DRAFT,
        archivedAt: null,
      },
    });
    return this.findOwnedEditor(user.id, testId);
  }

  async deleteTest(user: AuthUser, testId: string): Promise<void> {
    this.assertTeacher(user);
    await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedTest(transaction, user.id, testId);
      const usage = await transaction.test.findUnique({
        where: { id: testId },
        select: {
          _count: { select: { lessonLinks: true, releases: true } },
          revisions: {
            select: { _count: { select: { attempts: true } } },
          },
        },
      });
      if (
        !usage ||
        usage._count.lessonLinks > 0 ||
        usage._count.releases > 0 ||
        usage.revisions.some((revision) => revision._count.attempts > 0)
      ) {
        throw new ConflictException({
          code: 'TEST_IN_USE',
          message: 'A linked or attempted test must be archived instead',
        });
      }
      await transaction.test.delete({ where: { id: testId } });
    });
  }

  private getPublishIssues(
    revision: MutableRevisionRecord,
  ): { path: string[]; code: string; message: string }[] {
    const issues: { path: string[]; code: string; message: string }[] = [];
    if (revision.title.trim().length === 0) {
      issues.push({
        path: ['title'],
        code: 'TOO_SMALL',
        message: 'Title is required.',
      });
    }
    if (revision.items.length === 0) {
      issues.push({
        path: ['items'],
        code: 'TOO_SMALL',
        message: 'Add at least one assignment.',
      });
    }
    return issues;
  }

  private assertTimeSettings(
    maxAttempts: number | null | undefined,
    timeLimitSeconds: number | null | undefined,
  ): void {
    if (maxAttempts === 0 || timeLimitSeconds === 0) {
      throw new BadRequestException({
        code: 'INVALID_TEST_SETTINGS',
        message: 'Attempt and time limits must be positive or null',
      });
    }
  }

  private assertDraftItem(
    draft: MutableRevisionRecord,
    itemId: string,
  ): MutableRevisionRecord['items'][number] {
    const item = draft.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      throw new NotFoundException({
        code: 'TEST_ITEM_NOT_FOUND',
        message: 'Test item not found',
      });
    }
    return item;
  }

  private async writeItemOrder(
    transaction: Prisma.TransactionClient,
    itemIds: string[],
  ): Promise<void> {
    if (itemIds.length === 0) return;
    await transaction.testItem.updateMany({
      where: { id: { in: itemIds } },
      data: { position: { increment: itemIds.length + 1 } },
    });
    for (const [position, itemId] of itemIds.entries()) {
      await transaction.testItem.update({
        where: { id: itemId },
        data: { position },
      });
    }
  }

  private async incrementDraftVersion(
    transaction: Prisma.TransactionClient,
    draft: MutableRevisionRecord,
    testId: string,
  ): Promise<void> {
    const update = await transaction.testRevision.updateMany({
      where: {
        id: draft.id,
        status: TestRevisionStatus.DRAFT,
        editVersion: draft.editVersion,
      },
      data: { editVersion: { increment: 1 } },
    });
    if (update.count !== 1) {
      throw this.editConflict(draft.id, draft.editVersion);
    }
    await this.touchTest(transaction, testId);
  }

  private async touchTest(
    transaction: Prisma.TransactionClient,
    testId: string,
  ): Promise<void> {
    await transaction.test.update({
      where: { id: testId },
      data: { updatedAt: new Date() },
    });
  }

  private async findDraft(
    transaction: Prisma.TransactionClient,
    testId: string,
  ): Promise<MutableRevisionRecord> {
    const draft = await transaction.testRevision.findFirst({
      where: { testId, status: TestRevisionStatus.DRAFT },
      select: mutableRevisionSelect,
    });
    if (!draft) {
      throw this.draftNotFound();
    }
    return draft;
  }

  private assertDraftVersion(
    revision: { id: string; editVersion: number },
    expected: { expectedRevisionId: string; expectedEditVersion: number },
  ): void {
    if (
      revision.id !== expected.expectedRevisionId ||
      revision.editVersion !== expected.expectedEditVersion
    ) {
      throw this.editConflict(revision.id, revision.editVersion);
    }
  }

  private editConflict(
    currentRevisionId: string,
    currentEditVersion: number,
  ): ConflictException {
    return new ConflictException({
      code: 'TEST_DRAFT_VERSION_CONFLICT',
      message: 'The test draft was changed by another request',
      currentRevisionId,
      currentEditVersion,
    });
  }

  private async lockOwnedTest(
    transaction: Prisma.TransactionClient,
    teacherId: string,
    testId: string,
  ): Promise<{ id: string; status: TestStatus; contentLocale: Locale }> {
    const rows = await transaction.$queryRaw<
      { id: string; status: TestStatus; contentLocale: string }[]
    >(Prisma.sql`
      SELECT "id", "status", "contentLocale"
      FROM "Test"
      WHERE "id" = ${testId} AND "teacherId" = ${teacherId}
      FOR UPDATE
    `);
    const test = rows[0];
    if (!test) {
      throw this.testNotFound();
    }
    return {
      ...test,
      // Raw PostgreSQL queries return the mapped enum values (`uk` / `en`),
      // while Prisma Client exposes the schema enum names (`UK` / `EN`).
      contentLocale: test.contentLocale === 'uk' ? Locale.UK : Locale.EN,
    };
  }

  private async findOwnedEditor(
    teacherId: string,
    testId: string,
  ): Promise<TestEditorDto> {
    const test = await this.prisma.test.findFirst({
      where: { id: testId, teacherId },
      select: testEditorSelect,
    });
    if (!test) {
      throw this.testNotFound();
    }
    return toTestEditorDto(test);
  }

  private async findOwnedEditorInTransaction(
    transaction: Prisma.TransactionClient,
    teacherId: string,
    testId: string,
  ): Promise<TestEditorDto> {
    const test = await transaction.test.findFirst({
      where: { id: testId, teacherId },
      select: testEditorSelect,
    });
    if (!test) {
      throw this.testNotFound();
    }
    return toTestEditorDto(test);
  }

  private async findPreferredLocale(teacherId: string): Promise<Locale> {
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
      select: { profile: { select: { preferredLocale: true } } },
    });
    if (!teacher?.profile) {
      throw new NotFoundException({
        code: 'TEACHER_PROFILE_NOT_FOUND',
        message: 'Teacher profile not found',
      });
    }
    return teacher.profile.preferredLocale;
  }

  private normalizeOptionalText(value: string | null): string | null {
    return value === null || value.trim().length === 0 ? null : value;
  }

  private assertNotArchived(status: TestStatus): void {
    if (status === TestStatus.ARCHIVED) {
      throw new ConflictException({
        code: 'TEST_ARCHIVED',
        message: 'Restore the test before changing it',
      });
    }
  }

  private assertTeacher(user: AuthUser): void {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only teacher accounts may use this endpoint',
      });
    }
  }

  private encodeCursor(
    test: { id: string; updatedAt: Date } | null,
  ): string | null {
    if (!test) {
      return null;
    }
    return Buffer.from(
      JSON.stringify({
        version: 1,
        id: test.id,
        updatedAt: test.updatedAt.toISOString(),
      }),
    ).toString('base64url');
  }

  private decodeCursor(cursor: string): { id: string; updatedAt: Date } {
    try {
      const parsed: unknown = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      );
      if (
        !this.isRecord(parsed) ||
        parsed.version !== 1 ||
        typeof parsed.id !== 'string' ||
        !UUID_PATTERN.test(parsed.id) ||
        typeof parsed.updatedAt !== 'string'
      ) {
        throw new Error('Invalid cursor');
      }
      const updatedAt = new Date(parsed.updatedAt);
      if (
        !Number.isFinite(updatedAt.getTime()) ||
        updatedAt.toISOString() !== parsed.updatedAt
      ) {
        throw new Error('Invalid cursor date');
      }
      return { id: parsed.id, updatedAt };
    } catch {
      throw new BadRequestException({
        code: 'INVALID_TEST_CURSOR',
        message: 'Test cursor is invalid',
      });
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private testNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'TEST_NOT_FOUND',
      message: 'Test not found',
    });
  }

  private draftNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'TEST_DRAFT_NOT_FOUND',
      message: 'Test draft not found',
    });
  }
}
