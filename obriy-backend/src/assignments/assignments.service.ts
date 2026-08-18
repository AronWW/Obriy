import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentRevisionStatus,
  AssignmentStatus,
  AssignmentType,
  Locale,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { AssignmentPreviewQueryDto } from './dto/assignment-preview-query.dto';
import {
  AssignmentEditorDto,
  AssignmentListResponseDto,
  AssignmentPreviewDto,
  AssignmentRevisionSummaryDto,
} from './dto/assignment-response.dto';
import { AssignmentRevisionSource } from './dto/assignment-revision-source.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { DuplicateAssignmentDto } from './dto/duplicate-assignment.dto';
import { ListAssignmentsQueryDto } from './dto/list-assignments-query.dto';
import { PublishAssignmentDto } from './dto/publish-assignment.dto';
import { UpdateAssignmentDraftDto } from './dto/update-assignment-draft.dto';
import {
  assignmentEditorSelect,
  assignmentListSelect,
  createAssignmentPreviewSelect,
  toAssignmentEditorDto,
  toAssignmentPreviewDto,
  toAssignmentSummaryDto,
} from './mappers/assignment.mapper';
import {
  createAssignmentValidationDefaults,
  type AssignmentValidationIssue,
  validateAssignmentDraftPublicConfig,
  validateAssignmentPublishPayload,
  validateAssignmentSolution,
} from './validation';

const CURRENT_ASSIGNMENT_SCHEMA_VERSION = 1;
const DEFAULT_ASSIGNMENT_PAGE_SIZE = 20;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const editableRevisionSelect = {
  id: true,
  assignmentId: true,
  mapPresetId: true,
  version: true,
  status: true,
  title: true,
  prompt: true,
  instructions: true,
  explanation: true,
  publicConfig: true,
  schemaVersion: true,
  editVersion: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  solution: { select: { gradingConfig: true } },
} satisfies Prisma.AssignmentRevisionSelect;

const revisionHistorySelect = {
  id: true,
  version: true,
  status: true,
  title: true,
  editVersion: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.AssignmentRevisionSelect;

type EditableRevisionRecord = Prisma.AssignmentRevisionGetPayload<{
  select: typeof editableRevisionSelect;
}>;

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAssignment(
    user: AuthUser,
    dto: CreateAssignmentDto,
  ): Promise<AssignmentEditorDto> {
    this.assertTeacher(user);
    const defaults = createAssignmentValidationDefaults(
      dto.type,
      CURRENT_ASSIGNMENT_SCHEMA_VERSION,
    );

    if (!defaults.success) {
      throw new BadRequestException({
        code: 'ASSIGNMENT_TYPE_NOT_IMPLEMENTED',
        message: 'This assignment type is not available yet',
        issues: defaults.issues,
      });
    }

    const publicConfigResult = validateAssignmentDraftPublicConfig(
      dto.type,
      CURRENT_ASSIGNMENT_SCHEMA_VERSION,
      dto.draft?.publicConfig ?? defaults.data.publicConfig,
    );
    if (!publicConfigResult.success) {
      throw this.invalidConfig(publicConfigResult.issues);
    }
    const solutionResult = validateAssignmentSolution(
      dto.type,
      CURRENT_ASSIGNMENT_SCHEMA_VERSION,
      dto.draft?.gradingConfig ?? defaults.data.gradingConfig,
    );
    if (!solutionResult.success) {
      throw this.invalidConfig(solutionResult.issues, 'gradingConfig');
    }
    if (dto.type === AssignmentType.WRITTEN && dto.draft?.mapPresetId) {
      throw this.invalidConfig([
        {
          path: ['mapPresetId'],
          code: 'INVALID_CONFIGURATION',
          message: 'Written assignments cannot use a map preset.',
        },
      ]);
    }

    const contentLocale =
      dto.contentLocale ?? (await this.findPreferredLocale(user.id));
    const assignmentId = await this.prisma.$transaction(async (transaction) => {
      const assignment = await transaction.assignment.create({
        data: {
          teacherId: user.id,
          type: dto.type,
          contentLocale,
          defaultMaxPoints: dto.defaultMaxPoints,
          defaultPassingPercent: dto.defaultPassingPercent,
          revisions: {
            create: {
              version: 1,
              status: AssignmentRevisionStatus.DRAFT,
              mapPresetId: dto.draft?.mapPresetId,
              title: dto.draft?.title ?? '',
              prompt: dto.draft?.prompt ?? '',
              instructions: this.normalizeOptionalText(
                dto.draft?.instructions ?? null,
              ),
              explanation: this.normalizeOptionalText(
                dto.draft?.explanation ?? null,
              ),
              publicConfig: this.toInputJsonValue(publicConfigResult.data),
              schemaVersion: CURRENT_ASSIGNMENT_SCHEMA_VERSION,
              solution: {
                create: {
                  gradingConfig: this.toInputJsonValue(solutionResult.data),
                },
              },
            },
          },
        },
        select: { id: true },
      });

      return assignment.id;
    });

    return this.findOwnedEditor(user.id, assignmentId);
  }

  async listAssignments(
    user: AuthUser,
    query: ListAssignmentsQueryDto,
  ): Promise<AssignmentListResponseDto> {
    this.assertTeacher(user);
    const limit = query.limit ?? DEFAULT_ASSIGNMENT_PAGE_SIZE;
    const cursor = query.cursor ? this.decodeListCursor(query.cursor) : null;
    const where: Prisma.AssignmentWhereInput = {
      teacherId: user.id,
      status: query.status ?? { not: AssignmentStatus.ARCHIVED },
      ...(query.type ? { type: query.type } : {}),
      ...(query.contentLocale ? { contentLocale: query.contentLocale } : {}),
      ...(query.search
        ? {
            revisions: {
              some: {
                status: {
                  in: [
                    AssignmentRevisionStatus.DRAFT,
                    AssignmentRevisionStatus.PUBLISHED,
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
              {
                updatedAt: cursor.updatedAt,
                id: { lt: cursor.id },
              },
            ],
          }
        : {}),
    };
    const records = await this.prisma.assignment.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: assignmentListSelect,
    });
    const hasNextPage = records.length > limit;
    const page = records.slice(0, limit);

    return new AssignmentListResponseDto({
      items: page.map(toAssignmentSummaryDto),
      nextCursor: hasNextPage
        ? this.encodeListCursor(page.at(-1) ?? null)
        : null,
    });
  }

  async getAssignment(
    user: AuthUser,
    assignmentId: string,
  ): Promise<AssignmentEditorDto> {
    this.assertTeacher(user);
    return this.findOwnedEditor(user.id, assignmentId);
  }

  async listRevisions(
    user: AuthUser,
    assignmentId: string,
  ): Promise<AssignmentRevisionSummaryDto[]> {
    this.assertTeacher(user);
    await this.assertOwnedAssignment(user.id, assignmentId);
    const revisions = await this.prisma.assignmentRevision.findMany({
      where: { assignmentId },
      orderBy: [{ version: 'desc' }],
      select: revisionHistorySelect,
    });

    return revisions.map(
      (revision) => new AssignmentRevisionSummaryDto({ ...revision }),
    );
  }

  async updateDraft(
    user: AuthUser,
    assignmentId: string,
    dto: UpdateAssignmentDraftDto,
  ): Promise<AssignmentEditorDto> {
    this.assertTeacher(user);

    return this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedAssignment(transaction, user.id, assignmentId);
      const assignment = await transaction.assignment.findUnique({
        where: { id: assignmentId },
        select: { id: true, type: true, status: true },
      });

      if (!assignment) {
        throw this.assignmentNotFound();
      }
      this.assertNotArchived(assignment.status);

      const draft = await transaction.assignmentRevision.findFirst({
        where: {
          assignmentId,
          status: AssignmentRevisionStatus.DRAFT,
        },
        select: editableRevisionSelect,
      });

      if (!draft) {
        throw this.draftNotFound();
      }
      this.assertDraftVersion(
        draft.id,
        draft.editVersion,
        dto.expectedRevisionId,
        dto.expectedEditVersion,
      );

      const publicConfigResult = validateAssignmentDraftPublicConfig(
        assignment.type,
        draft.schemaVersion,
        dto.publicConfig ?? draft.publicConfig,
      );
      if (!publicConfigResult.success) {
        throw this.invalidConfig(publicConfigResult.issues);
      }

      const gradingConfig = dto.gradingConfig ?? draft.solution?.gradingConfig;
      const solutionResult = validateAssignmentSolution(
        assignment.type,
        draft.schemaVersion,
        gradingConfig,
      );
      if (!solutionResult.success) {
        throw this.invalidConfig(solutionResult.issues, 'gradingConfig');
      }

      if (assignment.type === AssignmentType.WRITTEN && dto.mapPresetId) {
        throw this.invalidConfig(
          [
            {
              path: ['mapPresetId'],
              code: 'INVALID_CONFIGURATION',
              message: 'Written assignments cannot use a map preset.',
            },
          ],
          undefined,
        );
      }

      const update = await transaction.assignmentRevision.updateMany({
        where: {
          id: draft.id,
          status: AssignmentRevisionStatus.DRAFT,
          editVersion: dto.expectedEditVersion,
        },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.prompt !== undefined ? { prompt: dto.prompt } : {}),
          ...(dto.instructions !== undefined
            ? { instructions: this.normalizeOptionalText(dto.instructions) }
            : {}),
          ...(dto.explanation !== undefined
            ? { explanation: this.normalizeOptionalText(dto.explanation) }
            : {}),
          ...(dto.mapPresetId !== undefined
            ? { mapPresetId: dto.mapPresetId }
            : {}),
          publicConfig: this.toInputJsonValue(publicConfigResult.data),
          editVersion: { increment: 1 },
        },
      });

      if (update.count !== 1) {
        throw this.editConflict(draft.id, draft.editVersion);
      }

      await transaction.assignmentSolution.upsert({
        where: { revisionId: draft.id },
        create: {
          revisionId: draft.id,
          gradingConfig: this.toInputJsonValue(solutionResult.data),
        },
        update: {
          gradingConfig: this.toInputJsonValue(solutionResult.data),
        },
      });
      await transaction.assignment.update({
        where: { id: assignmentId },
        data: {
          updatedAt: new Date(),
          ...(dto.defaultMaxPoints !== undefined
            ? { defaultMaxPoints: dto.defaultMaxPoints }
            : {}),
          ...(dto.defaultPassingPercent !== undefined
            ? { defaultPassingPercent: dto.defaultPassingPercent }
            : {}),
        },
      });

      return this.findOwnedEditorInTransaction(
        transaction,
        user.id,
        assignmentId,
      );
    });
  }

  async startEdit(
    user: AuthUser,
    assignmentId: string,
  ): Promise<AssignmentEditorDto> {
    this.assertTeacher(user);

    return this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedAssignment(transaction, user.id, assignmentId);
      const assignment = await transaction.assignment.findUnique({
        where: { id: assignmentId },
        select: { id: true, status: true },
      });

      if (!assignment) {
        throw this.assignmentNotFound();
      }
      this.assertNotArchived(assignment.status);

      const existingDraft = await transaction.assignmentRevision.findFirst({
        where: {
          assignmentId,
          status: AssignmentRevisionStatus.DRAFT,
        },
        select: { id: true },
      });
      if (!existingDraft) {
        const published = await transaction.assignmentRevision.findFirst({
          where: {
            assignmentId,
            status: AssignmentRevisionStatus.PUBLISHED,
          },
          select: editableRevisionSelect,
        });
        if (!published?.solution) {
          throw new ConflictException({
            code: 'ASSIGNMENT_PUBLISHED_REVISION_NOT_FOUND',
            message: 'A published revision is required to start editing',
          });
        }

        const versions = await transaction.assignmentRevision.aggregate({
          where: { assignmentId },
          _max: { version: true },
        });
        await transaction.assignmentRevision.create({
          data: {
            assignmentId,
            mapPresetId: published.mapPresetId,
            version: (versions._max.version ?? 0) + 1,
            status: AssignmentRevisionStatus.DRAFT,
            title: published.title,
            prompt: published.prompt,
            instructions: published.instructions,
            explanation: published.explanation,
            publicConfig: this.toInputJsonValue(published.publicConfig),
            schemaVersion: published.schemaVersion,
            editVersion: 1,
            solution: {
              create: {
                gradingConfig: this.toInputJsonValue(
                  published.solution.gradingConfig,
                ),
              },
            },
          },
        });
        await transaction.assignment.update({
          where: { id: assignmentId },
          data: { updatedAt: new Date() },
        });
      }

      return this.findOwnedEditorInTransaction(
        transaction,
        user.id,
        assignmentId,
      );
    });
  }

  async publish(
    user: AuthUser,
    assignmentId: string,
    dto: PublishAssignmentDto,
  ): Promise<AssignmentEditorDto> {
    this.assertTeacher(user);

    return this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedAssignment(transaction, user.id, assignmentId);
      const assignment = await transaction.assignment.findUnique({
        where: { id: assignmentId },
        select: { id: true, type: true, status: true },
      });

      if (!assignment) {
        throw this.assignmentNotFound();
      }
      this.assertNotArchived(assignment.status);

      const draft = await transaction.assignmentRevision.findFirst({
        where: {
          assignmentId,
          status: AssignmentRevisionStatus.DRAFT,
        },
        select: editableRevisionSelect,
      });
      if (!draft) {
        const published = await transaction.assignmentRevision.findFirst({
          where: {
            assignmentId,
            status: AssignmentRevisionStatus.PUBLISHED,
          },
          select: { id: true, editVersion: true },
        });
        if (!published) {
          throw this.draftNotFound();
        }

        this.assertDraftVersion(
          published.id,
          published.editVersion,
          dto.expectedRevisionId,
          dto.expectedEditVersion,
        );

        return this.findOwnedEditorInTransaction(
          transaction,
          user.id,
          assignmentId,
        );
      }

      this.assertDraftVersion(
        draft.id,
        draft.editVersion,
        dto.expectedRevisionId,
        dto.expectedEditVersion,
      );
      const issues = this.getPublishIssues(assignment.type, draft);
      if (issues.length > 0) {
        throw new ConflictException({
          code: 'ASSIGNMENT_INCOMPLETE',
          message: 'Complete the assignment before publishing it',
          issues,
        });
      }

      const publishedAt = new Date();
      await transaction.assignmentRevision.updateMany({
        where: {
          assignmentId,
          status: AssignmentRevisionStatus.PUBLISHED,
        },
        data: { status: AssignmentRevisionStatus.ARCHIVED },
      });
      const publishResult = await transaction.assignmentRevision.updateMany({
        where: {
          id: draft.id,
          status: AssignmentRevisionStatus.DRAFT,
          editVersion: dto.expectedEditVersion,
        },
        data: {
          status: AssignmentRevisionStatus.PUBLISHED,
          publishedAt,
        },
      });
      if (publishResult.count !== 1) {
        throw this.editConflict(draft.id, draft.editVersion);
      }

      await transaction.assignment.update({
        where: { id: assignmentId },
        data: {
          status: AssignmentStatus.PUBLISHED,
          archivedAt: null,
          updatedAt: publishedAt,
        },
      });

      return this.findOwnedEditorInTransaction(
        transaction,
        user.id,
        assignmentId,
      );
    });
  }

  async preview(
    user: AuthUser,
    assignmentId: string,
    query: AssignmentPreviewQueryDto,
  ): Promise<AssignmentPreviewDto> {
    this.assertTeacher(user);

    return this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedAssignment(transaction, user.id, assignmentId);
      const owned = await transaction.assignment.findUnique({
        where: { id: assignmentId },
        select: {
          id: true,
          revisions: {
            where: { status: AssignmentRevisionStatus.DRAFT },
            take: 1,
            select: { id: true },
          },
        },
      });
      if (!owned) {
        throw this.assignmentNotFound();
      }

      const source =
        query.source ??
        (owned.revisions.length > 0
          ? AssignmentRevisionSource.DRAFT
          : AssignmentRevisionSource.PUBLISHED);
      const assignment = await transaction.assignment.findUnique({
        where: { id: assignmentId },
        select: createAssignmentPreviewSelect(source),
      });
      const preview = assignment
        ? toAssignmentPreviewDto(assignment, source)
        : null;

      if (!preview) {
        throw new NotFoundException({
          code:
            source === AssignmentRevisionSource.DRAFT
              ? 'ASSIGNMENT_DRAFT_NOT_FOUND'
              : 'ASSIGNMENT_PUBLISHED_REVISION_NOT_FOUND',
          message: 'The requested assignment revision was not found',
        });
      }

      return preview;
    });
  }

  async duplicate(
    user: AuthUser,
    assignmentId: string,
    dto: DuplicateAssignmentDto = {},
  ): Promise<AssignmentEditorDto> {
    this.assertTeacher(user);
    const duplicateId = await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedAssignment(transaction, user.id, assignmentId);
      const sourceAssignment = await transaction.assignment.findUnique({
        where: { id: assignmentId },
        select: {
          id: true,
          teacherId: true,
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
            select: editableRevisionSelect,
          },
        },
      });
      if (!sourceAssignment) {
        throw this.assignmentNotFound();
      }

      const source = this.selectDuplicateRevision(
        sourceAssignment.revisions,
        dto.source,
      );
      if (!source?.solution) {
        throw new ConflictException({
          code: 'ASSIGNMENT_SOURCE_REVISION_NOT_FOUND',
          message: 'The requested source revision is unavailable',
        });
      }

      const duplicate = await transaction.assignment.create({
        data: {
          teacherId: user.id,
          type: sourceAssignment.type,
          contentLocale: sourceAssignment.contentLocale,
          defaultMaxPoints: sourceAssignment.defaultMaxPoints,
          defaultPassingPercent: sourceAssignment.defaultPassingPercent,
          revisions: {
            create: {
              mapPresetId: source.mapPresetId,
              version: 1,
              status: AssignmentRevisionStatus.DRAFT,
              title: dto.title ?? source.title,
              prompt: source.prompt,
              instructions: source.instructions,
              explanation: source.explanation,
              publicConfig: this.toInputJsonValue(source.publicConfig),
              schemaVersion: source.schemaVersion,
              solution: {
                create: {
                  gradingConfig: this.toInputJsonValue(
                    source.solution.gradingConfig,
                  ),
                },
              },
            },
          },
        },
        select: { id: true },
      });

      return duplicate.id;
    });

    return this.findOwnedEditor(user.id, duplicateId);
  }

  async archive(
    user: AuthUser,
    assignmentId: string,
  ): Promise<AssignmentEditorDto> {
    this.assertTeacher(user);

    return this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedAssignment(transaction, user.id, assignmentId);
      const assignment = await transaction.assignment.findUnique({
        where: { id: assignmentId },
        select: { status: true },
      });
      if (!assignment) {
        throw this.assignmentNotFound();
      }

      if (assignment.status !== AssignmentStatus.ARCHIVED) {
        await transaction.assignment.update({
          where: { id: assignmentId },
          data: {
            status: AssignmentStatus.ARCHIVED,
            archivedAt: new Date(),
          },
        });
      }

      return this.findOwnedEditorInTransaction(
        transaction,
        user.id,
        assignmentId,
      );
    });
  }

  async restore(
    user: AuthUser,
    assignmentId: string,
  ): Promise<AssignmentEditorDto> {
    this.assertTeacher(user);

    return this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedAssignment(transaction, user.id, assignmentId);
      const assignment = await transaction.assignment.findUnique({
        where: { id: assignmentId },
        select: { status: true },
      });
      if (!assignment) {
        throw this.assignmentNotFound();
      }
      if (assignment.status !== AssignmentStatus.ARCHIVED) {
        throw new ConflictException({
          code: 'ASSIGNMENT_NOT_ARCHIVED',
          message: 'Only archived assignments can be restored',
        });
      }

      const published = await transaction.assignmentRevision.findFirst({
        where: {
          assignmentId,
          status: AssignmentRevisionStatus.PUBLISHED,
        },
        select: { id: true },
      });
      await transaction.assignment.update({
        where: { id: assignmentId },
        data: {
          status: published
            ? AssignmentStatus.PUBLISHED
            : AssignmentStatus.DRAFT,
          archivedAt: null,
        },
      });

      return this.findOwnedEditorInTransaction(
        transaction,
        user.id,
        assignmentId,
      );
    });
  }

  async deleteAssignment(user: AuthUser, assignmentId: string): Promise<void> {
    this.assertTeacher(user);

    await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedAssignment(transaction, user.id, assignmentId);
      const assignment = await transaction.assignment.findUnique({
        where: { id: assignmentId },
        select: {
          id: true,
          _count: {
            select: { testItems: true },
          },
        },
      });
      if (!assignment) {
        throw this.assignmentNotFound();
      }
      if (assignment._count.testItems > 0) {
        throw new ConflictException({
          code: 'ASSIGNMENT_IN_USE',
          message: 'An assignment in use must be archived instead',
        });
      }

      await transaction.assignment.delete({ where: { id: assignmentId } });
    });
  }

  async deleteRevision(
    user: AuthUser,
    assignmentId: string,
    revisionId: string,
  ): Promise<void> {
    this.assertTeacher(user);

    await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedAssignment(transaction, user.id, assignmentId);
      const revision = await transaction.assignmentRevision.findFirst({
        where: { id: revisionId, assignmentId },
        select: {
          id: true,
          status: true,
          _count: {
            select: {
              testItems: true,
            },
          },
        },
      });
      if (!revision) {
        throw new NotFoundException({
          code: 'ASSIGNMENT_REVISION_NOT_FOUND',
          message: 'Assignment revision not found',
        });
      }
      if (revision.status === AssignmentRevisionStatus.PUBLISHED) {
        throw new ConflictException({
          code: 'ASSIGNMENT_PUBLISHED_REVISION_IMMUTABLE',
          message: 'The current published revision cannot be deleted',
        });
      }
      if (revision._count.testItems > 0) {
        throw new ConflictException({
          code: 'ASSIGNMENT_REVISION_IN_USE',
          message: 'A revision used by a test cannot be deleted',
        });
      }

      const revisionCount = await transaction.assignmentRevision.count({
        where: { assignmentId },
      });
      if (revisionCount <= 1) {
        throw new ConflictException({
          code: 'DELETE_ASSIGNMENT_INSTEAD',
          message: 'Delete the assignment instead of its only revision',
        });
      }

      await transaction.assignmentRevision.delete({
        where: { id: revision.id },
      });
      await transaction.assignment.update({
        where: { id: assignmentId },
        data: { updatedAt: new Date() },
      });
    });
  }

  private getPublishIssues(
    type: AssignmentType,
    draft: EditableRevisionRecord,
  ): AssignmentValidationIssue[] {
    const issues: AssignmentValidationIssue[] = [];

    if (draft.title.trim().length === 0) {
      issues.push({
        path: ['title'],
        code: 'TOO_SMALL',
        message: 'Title is required.',
      });
    }
    if (draft.prompt.trim().length === 0) {
      issues.push({
        path: ['prompt'],
        code: 'TOO_SMALL',
        message: 'Prompt is required.',
      });
    }
    if (type === AssignmentType.WRITTEN && draft.mapPresetId) {
      issues.push({
        path: ['mapPresetId'],
        code: 'INVALID_CONFIGURATION',
        message: 'Written assignments cannot use a map preset.',
      });
    }

    const validation = validateAssignmentPublishPayload(
      type,
      draft.schemaVersion,
      {
        publicConfig: draft.publicConfig,
        gradingConfig: draft.solution?.gradingConfig,
      },
    );
    if (!validation.success) {
      issues.push(...validation.issues);
    }

    return issues;
  }

  private selectDuplicateRevision(
    revisions: EditableRevisionRecord[],
    requested?: AssignmentRevisionSource,
  ): EditableRevisionRecord | null {
    const draft = revisions.find(
      (revision) => revision.status === AssignmentRevisionStatus.DRAFT,
    );
    const published = revisions.find(
      (revision) => revision.status === AssignmentRevisionStatus.PUBLISHED,
    );

    if (requested === AssignmentRevisionSource.DRAFT) {
      return draft ?? null;
    }
    if (requested === AssignmentRevisionSource.PUBLISHED) {
      return published ?? null;
    }

    return published ?? draft ?? null;
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

  private encodeListCursor(
    assignment: { id: string; updatedAt: Date } | null,
  ): string | null {
    if (!assignment) {
      return null;
    }

    return Buffer.from(
      JSON.stringify({
        version: 1,
        id: assignment.id,
        updatedAt: assignment.updatedAt.toISOString(),
      }),
    ).toString('base64url');
  }

  private decodeListCursor(cursor: string): { id: string; updatedAt: Date } {
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
        throw new Error('Invalid cursor payload');
      }

      const updatedAt = new Date(parsed.updatedAt);
      if (
        !Number.isFinite(updatedAt.getTime()) ||
        updatedAt.toISOString() !== parsed.updatedAt
      ) {
        throw new Error('Invalid cursor timestamp');
      }

      return { id: parsed.id, updatedAt };
    } catch {
      throw new BadRequestException({
        code: 'INVALID_ASSIGNMENT_CURSOR',
        message: 'Assignment cursor is invalid',
      });
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private async assertOwnedAssignment(
    teacherId: string,
    assignmentId: string,
  ): Promise<void> {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, teacherId },
      select: { id: true },
    });
    if (!assignment) {
      throw this.assignmentNotFound();
    }
  }

  private async findOwnedEditor(
    teacherId: string,
    assignmentId: string,
  ): Promise<AssignmentEditorDto> {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, teacherId },
      select: assignmentEditorSelect,
    });
    if (!assignment) {
      throw this.assignmentNotFound();
    }

    return toAssignmentEditorDto(assignment);
  }

  private async findOwnedEditorInTransaction(
    transaction: Prisma.TransactionClient,
    teacherId: string,
    assignmentId: string,
  ): Promise<AssignmentEditorDto> {
    const assignment = await transaction.assignment.findFirst({
      where: { id: assignmentId, teacherId },
      select: assignmentEditorSelect,
    });
    if (!assignment) {
      throw this.assignmentNotFound();
    }

    return toAssignmentEditorDto(assignment);
  }

  private async lockOwnedAssignment(
    transaction: Prisma.TransactionClient,
    teacherId: string,
    assignmentId: string,
  ): Promise<void> {
    const rows = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id"
      FROM "Assignment"
      WHERE "id" = ${assignmentId} AND "teacherId" = ${teacherId}
      FOR UPDATE
    `);
    if (rows.length === 0) {
      throw this.assignmentNotFound();
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

  private assertNotArchived(status: AssignmentStatus): void {
    if (status === AssignmentStatus.ARCHIVED) {
      throw new ConflictException({
        code: 'ASSIGNMENT_ARCHIVED',
        message: 'Restore the assignment before changing it',
      });
    }
  }

  private assertDraftVersion(
    currentRevisionId: string,
    currentEditVersion: number,
    expectedRevisionId: string,
    expectedEditVersion: number,
  ): void {
    if (
      currentRevisionId !== expectedRevisionId ||
      currentEditVersion !== expectedEditVersion
    ) {
      throw this.editConflict(currentRevisionId, currentEditVersion);
    }
  }

  private editConflict(
    currentRevisionId: string,
    currentEditVersion: number,
  ): ConflictException {
    return new ConflictException({
      code: 'ASSIGNMENT_DRAFT_VERSION_CONFLICT',
      message: 'The assignment draft was changed by another request',
      currentRevisionId,
      currentEditVersion,
    });
  }

  private invalidConfig(
    issues: AssignmentValidationIssue[],
    prefix?: string,
  ): BadRequestException {
    return new BadRequestException({
      code: 'INVALID_ASSIGNMENT_CONFIG',
      message: 'Assignment configuration is invalid',
      issues: prefix
        ? issues.map((issue) => ({
            ...issue,
            path: [prefix, ...issue.path],
          }))
        : issues,
    });
  }

  private normalizeOptionalText(value: string | null): string | null {
    if (value === null || value.trim().length === 0) {
      return null;
    }

    return value;
  }

  private toInputJsonValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private assignmentNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'ASSIGNMENT_NOT_FOUND',
      message: 'Assignment not found',
    });
  }

  private draftNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'ASSIGNMENT_DRAFT_NOT_FOUND',
      message: 'Assignment draft not found',
    });
  }
}
