import { AssignmentRevisionStatus, Prisma } from '@prisma/client';
import {
  AssignmentEditorDto,
  AssignmentEditorRevisionDto,
  AssignmentPreviewDto,
  AssignmentRevisionSummaryDto,
  AssignmentSummaryDto,
  type AssignmentJsonObject,
} from '../dto/assignment-response.dto';
import { AssignmentRevisionSource } from '../dto/assignment-revision-source.dto';

const assignmentRevisionSummarySelect = {
  id: true,
  version: true,
  status: true,
  title: true,
  editVersion: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.AssignmentRevisionSelect;

const assignmentEditorRevisionSelect = {
  id: true,
  version: true,
  status: true,
  title: true,
  prompt: true,
  instructions: true,
  explanation: true,
  publicConfig: true,
  mapPresetId: true,
  schemaVersion: true,
  editVersion: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  solution: { select: { gradingConfig: true } },
} satisfies Prisma.AssignmentRevisionSelect;

const assignmentPreviewRevisionSelect = {
  id: true,
  version: true,
  title: true,
  prompt: true,
  instructions: true,
  publicConfig: true,
  mapPresetId: true,
} satisfies Prisma.AssignmentRevisionSelect;

export const assignmentListSelect = {
  id: true,
  type: true,
  contentLocale: true,
  status: true,
  defaultMaxPoints: true,
  defaultPassingPercent: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  revisions: {
    where: {
      status: {
        in: [
          AssignmentRevisionStatus.DRAFT,
          AssignmentRevisionStatus.PUBLISHED,
        ],
      },
    },
    orderBy: [{ version: 'desc' as const }],
    select: assignmentRevisionSummarySelect,
  },
} satisfies Prisma.AssignmentSelect;

export const assignmentEditorSelect = {
  id: true,
  type: true,
  contentLocale: true,
  status: true,
  defaultMaxPoints: true,
  defaultPassingPercent: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  revisions: {
    where: {
      status: {
        in: [
          AssignmentRevisionStatus.DRAFT,
          AssignmentRevisionStatus.PUBLISHED,
        ],
      },
    },
    orderBy: [{ version: 'desc' as const }],
    select: assignmentEditorRevisionSelect,
  },
} satisfies Prisma.AssignmentSelect;

export function createAssignmentPreviewSelect(
  source: AssignmentRevisionSource,
) {
  const status =
    source === AssignmentRevisionSource.DRAFT
      ? AssignmentRevisionStatus.DRAFT
      : AssignmentRevisionStatus.PUBLISHED;

  return {
    id: true,
    type: true,
    contentLocale: true,
    defaultMaxPoints: true,
    defaultPassingPercent: true,
    revisions: {
      where: { status },
      orderBy: [{ version: 'desc' as const }],
      take: 1,
      select: assignmentPreviewRevisionSelect,
    },
  } satisfies Prisma.AssignmentSelect;
}

export type AssignmentListRecord = Prisma.AssignmentGetPayload<{
  select: typeof assignmentListSelect;
}>;

export type AssignmentEditorRecord = Prisma.AssignmentGetPayload<{
  select: typeof assignmentEditorSelect;
}>;

export type AssignmentPreviewRecord = Prisma.AssignmentGetPayload<{
  select: ReturnType<typeof createAssignmentPreviewSelect>;
}>;

type AssignmentListRevisionRecord = AssignmentListRecord['revisions'][number];
type AssignmentEditorRevisionRecord =
  AssignmentEditorRecord['revisions'][number];

interface DecimalLike {
  toNumber(): number;
}

function decimalToNumber(value: DecimalLike): number {
  return value.toNumber();
}

function toJsonObject(value: Prisma.JsonValue): AssignmentJsonObject {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new TypeError('Assignment configuration must be a JSON object');
  }

  return { ...value };
}

function findRevision<T extends { status: AssignmentRevisionStatus }>(
  revisions: T[],
  status: AssignmentRevisionStatus,
): T | null {
  return revisions.find((revision) => revision.status === status) ?? null;
}

function toRevisionSummaryDto(
  revision: AssignmentListRevisionRecord | null,
): AssignmentRevisionSummaryDto | null {
  if (!revision) {
    return null;
  }

  return new AssignmentRevisionSummaryDto({ ...revision });
}

function toEditorRevisionDto(
  revision: AssignmentEditorRevisionRecord | null,
): AssignmentEditorRevisionDto | null {
  if (!revision) {
    return null;
  }

  return new AssignmentEditorRevisionDto({
    id: revision.id,
    version: revision.version,
    status: revision.status,
    title: revision.title,
    prompt: revision.prompt,
    instructions: revision.instructions,
    explanation: revision.explanation,
    publicConfig: toJsonObject(revision.publicConfig),
    gradingConfig: revision.solution
      ? toJsonObject(revision.solution.gradingConfig)
      : null,
    mapPresetId: revision.mapPresetId,
    schemaVersion: revision.schemaVersion,
    editVersion: revision.editVersion,
    publishedAt: revision.publishedAt,
    createdAt: revision.createdAt,
    updatedAt: revision.updatedAt,
  });
}

export function toAssignmentSummaryDto(
  assignment: AssignmentListRecord,
): AssignmentSummaryDto {
  const draftRevision = findRevision(
    assignment.revisions,
    AssignmentRevisionStatus.DRAFT,
  );
  const publishedRevision = findRevision(
    assignment.revisions,
    AssignmentRevisionStatus.PUBLISHED,
  );

  return new AssignmentSummaryDto({
    id: assignment.id,
    type: assignment.type,
    contentLocale: assignment.contentLocale,
    status: assignment.status,
    defaultMaxPoints: decimalToNumber(assignment.defaultMaxPoints),
    defaultPassingPercent: decimalToNumber(assignment.defaultPassingPercent),
    archivedAt: assignment.archivedAt,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    draftRevision: toRevisionSummaryDto(draftRevision),
    publishedRevision: toRevisionSummaryDto(publishedRevision),
  });
}

export function toAssignmentEditorDto(
  assignment: AssignmentEditorRecord,
): AssignmentEditorDto {
  const draftRevision = findRevision(
    assignment.revisions,
    AssignmentRevisionStatus.DRAFT,
  );
  const publishedRevision = findRevision(
    assignment.revisions,
    AssignmentRevisionStatus.PUBLISHED,
  );

  return new AssignmentEditorDto({
    id: assignment.id,
    type: assignment.type,
    contentLocale: assignment.contentLocale,
    status: assignment.status,
    defaultMaxPoints: decimalToNumber(assignment.defaultMaxPoints),
    defaultPassingPercent: decimalToNumber(assignment.defaultPassingPercent),
    archivedAt: assignment.archivedAt,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    draftRevision: toEditorRevisionDto(draftRevision),
    publishedRevision: toEditorRevisionDto(publishedRevision),
  });
}

export function toAssignmentPreviewDto(
  assignment: AssignmentPreviewRecord,
  source: AssignmentRevisionSource,
): AssignmentPreviewDto | null {
  const revision = assignment.revisions[0];

  if (!revision) {
    return null;
  }

  return new AssignmentPreviewDto({
    assignmentId: assignment.id,
    revisionId: revision.id,
    source,
    type: assignment.type,
    contentLocale: assignment.contentLocale,
    version: revision.version,
    title: revision.title,
    prompt: revision.prompt,
    instructions: revision.instructions,
    publicConfig: toJsonObject(revision.publicConfig),
    mapPresetId: revision.mapPresetId,
    defaultMaxPoints: decimalToNumber(assignment.defaultMaxPoints),
    defaultPassingPercent: decimalToNumber(assignment.defaultPassingPercent),
  });
}
