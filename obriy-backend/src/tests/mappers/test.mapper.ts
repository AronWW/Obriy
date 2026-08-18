import { Prisma, TestRevisionStatus } from '@prisma/client';
import {
  TestEditorDto,
  TestItemDto,
  TestRevisionDto,
  TestRevisionSummaryDto,
  TestSummaryDto,
} from '../dto/test-response.dto';

const testItemSelect = {
  id: true,
  position: true,
  maxPoints: true,
  assignmentId: true,
  assignmentRevisionId: true,
  assignment: { select: { type: true } },
  assignmentRevision: { select: { title: true } },
} satisfies Prisma.TestItemSelect;

const testRevisionSelect = {
  id: true,
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
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: [{ position: 'asc' as const }],
    select: testItemSelect,
  },
} satisfies Prisma.TestRevisionSelect;

export const testEditorSelect = {
  id: true,
  contentLocale: true,
  status: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  revisions: {
    where: {
      status: {
        in: [TestRevisionStatus.DRAFT, TestRevisionStatus.PUBLISHED],
      },
    },
    orderBy: [{ version: 'desc' as const }],
    select: testRevisionSelect,
  },
} satisfies Prisma.TestSelect;

const testRevisionSummarySelect = {
  id: true,
  version: true,
  status: true,
  title: true,
  description: true,
  publishedAt: true,
  updatedAt: true,
  _count: { select: { items: true } },
} satisfies Prisma.TestRevisionSelect;

export const testListSelect = {
  id: true,
  contentLocale: true,
  status: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  revisions: {
    where: {
      status: {
        in: [TestRevisionStatus.DRAFT, TestRevisionStatus.PUBLISHED],
      },
    },
    orderBy: [{ version: 'desc' as const }],
    select: testRevisionSummarySelect,
  },
} satisfies Prisma.TestSelect;

export type TestEditorRecord = Prisma.TestGetPayload<{
  select: typeof testEditorSelect;
}>;

export type TestListRecord = Prisma.TestGetPayload<{
  select: typeof testListSelect;
}>;

type TestRevisionRecord = TestEditorRecord['revisions'][number];
type TestItemRecord = TestRevisionRecord['items'][number];

function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

function toItemDto(item: TestItemRecord): TestItemDto {
  return new TestItemDto({
    id: item.id,
    position: item.position,
    maxPoints: decimalToNumber(item.maxPoints),
    assignmentId: item.assignmentId,
    assignmentRevisionId: item.assignmentRevisionId,
    assignmentType: item.assignment.type,
    title: item.assignmentRevision.title,
  });
}

function toRevisionDto(
  revision: TestRevisionRecord | null,
): TestRevisionDto | null {
  if (!revision) {
    return null;
  }

  const items = revision.items.map(toItemDto);
  return new TestRevisionDto({
    id: revision.id,
    version: revision.version,
    status: revision.status,
    title: revision.title,
    description: revision.description,
    instructions: revision.instructions,
    passingPercent: decimalToNumber(revision.passingPercent),
    maxAttempts: revision.maxAttempts,
    timeLimitSeconds: revision.timeLimitSeconds,
    scorePolicy: revision.scorePolicy,
    shuffleItems: revision.shuffleItems,
    schemaVersion: revision.schemaVersion,
    editVersion: revision.editVersion,
    items,
    totalMaxPoints: items.reduce((sum, item) => sum + item.maxPoints, 0),
    publishedAt: revision.publishedAt,
    createdAt: revision.createdAt,
    updatedAt: revision.updatedAt,
  });
}

export function toTestEditorDto(test: TestEditorRecord): TestEditorDto {
  const draft =
    test.revisions.find(
      (revision) => revision.status === TestRevisionStatus.DRAFT,
    ) ?? null;
  const published =
    test.revisions.find(
      (revision) => revision.status === TestRevisionStatus.PUBLISHED,
    ) ?? null;

  return new TestEditorDto({
    id: test.id,
    contentLocale: test.contentLocale,
    status: test.status,
    archivedAt: test.archivedAt,
    createdAt: test.createdAt,
    updatedAt: test.updatedAt,
    draftRevision: toRevisionDto(draft),
    publishedRevision: toRevisionDto(published),
  });
}

export function toTestSummaryDto(
  test: TestListRecord,
  pointsByRevision: ReadonlyMap<string, number>,
): TestSummaryDto {
  const toSummary = (
    revision: TestListRecord['revisions'][number] | null,
  ): TestRevisionSummaryDto | null => {
    if (!revision) return null;
    return new TestRevisionSummaryDto({
      id: revision.id,
      version: revision.version,
      status: revision.status,
      title: revision.title,
      description: revision.description,
      itemCount: revision._count.items,
      totalMaxPoints: pointsByRevision.get(revision.id) ?? 0,
      publishedAt: revision.publishedAt,
      updatedAt: revision.updatedAt,
    });
  };
  return new TestSummaryDto({
    id: test.id,
    contentLocale: test.contentLocale,
    status: test.status,
    archivedAt: test.archivedAt,
    createdAt: test.createdAt,
    updatedAt: test.updatedAt,
    draftRevision: toSummary(
      test.revisions.find(
        (revision) => revision.status === TestRevisionStatus.DRAFT,
      ) ?? null,
    ),
    publishedRevision: toSummary(
      test.revisions.find(
        (revision) => revision.status === TestRevisionStatus.PUBLISHED,
      ) ?? null,
    ),
  });
}
