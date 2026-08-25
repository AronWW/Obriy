import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentRevisionStatus,
  AssignmentStatus,
  AssignmentType,
  Locale,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import { AssignmentsService } from '../../../src/assignments/assignments.service';
import { AssignmentRevisionSource } from '../../../src/assignments/dto/assignment-revision-source.dto';
import { createAssignmentPreviewSelect } from '../../../src/assignments/mappers/assignment.mapper';

describe('AssignmentsService boundaries', () => {
  const assignmentFindFirst = jest.fn();
  const assignmentFindMany = jest.fn();
  const assignmentFindUnique = jest.fn();
  const assignmentUpdate = jest.fn();
  const assignmentDelete = jest.fn();
  const revisionFindFirst = jest.fn();
  const revisionUpdateMany = jest.fn();
  const revisionPromptImageFindUnique = jest.fn();
  const solutionUpsert = jest.fn();
  const queryRaw = jest.fn();
  const transaction = {
    $queryRaw: queryRaw,
    assignment: {
      findUnique: assignmentFindUnique,
      findFirst: assignmentFindFirst,
      update: assignmentUpdate,
      delete: assignmentDelete,
    },
    assignmentRevision: {
      findFirst: revisionFindFirst,
      updateMany: revisionUpdateMany,
    },
    assignmentRevisionPromptImage: {
      findUnique: revisionPromptImageFindUnique,
    },
    assignmentSolution: { upsert: solutionUpsert },
  };
  const runTransaction = jest.fn();
  const userFindUnique = jest.fn();
  const prisma = {
    assignment: {
      findFirst: assignmentFindFirst,
      findMany: assignmentFindMany,
    },
    user: { findUnique: userFindUnique },
    $transaction: runTransaction,
  } as unknown as PrismaService;
  const cloudinary = { destroyImage: jest.fn() };
  const service = new AssignmentsService(prisma, cloudinary as never);

  const teacher: AuthUser = {
    id: 'teacher-1',
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
    status: UserStatus.ACTIVE,
  };
  const student: AuthUser = {
    id: 'student-1',
    email: 'student@example.com',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    queryRaw.mockResolvedValue([{ id: 'assignment-1' }]);
    revisionPromptImageFindUnique.mockResolvedValue(null);
    runTransaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
  });

  it('rejects a student before any assignment database access', async () => {
    await expect(service.listAssignments(student, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(assignmentFindFirst).not.toHaveBeenCalled();
    expect(assignmentFindMany).not.toHaveBeenCalled();
    expect(runTransaction).not.toHaveBeenCalled();
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it('returns a non-disclosing 404 for an assignment owned by another teacher', async () => {
    assignmentFindFirst.mockResolvedValue(null);

    await expect(
      service.getAssignment(teacher, 'foreign-assignment'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.getAssignment(teacher, 'foreign-assignment'),
    ).rejects.toMatchObject({
      response: { code: 'ASSIGNMENT_NOT_FOUND' },
    });

    expect(assignmentFindFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: 'foreign-assignment',
          teacherId: teacher.id,
        },
      }),
    );
  });

  it('rejects an unsupported assignment type before reading or writing data', async () => {
    await expect(
      service.createAssignment(teacher, {
        type: AssignmentType.MAP_POINT,
        contentLocale: Locale.UK,
      }),
    ).rejects.toMatchObject({
      response: { code: 'ASSIGNMENT_TYPE_NOT_IMPLEMENTED' },
    });

    expect(runTransaction).not.toHaveBeenCalled();
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it('rejects a stale draft editVersion before applying updates', async () => {
    assignmentFindUnique.mockResolvedValue({
      id: 'assignment-1',
      type: AssignmentType.WRITTEN,
      status: AssignmentStatus.DRAFT,
    });
    revisionFindFirst.mockResolvedValue({
      id: 'revision-1',
      editVersion: 4,
    });
    const staleUpdate = {
      expectedRevisionId: 'revision-1',
      expectedEditVersion: 3,
      title: 'A stale update',
    };

    await expect(
      service.updateDraft(teacher, 'assignment-1', staleUpdate),
    ).rejects.toMatchObject({
      response: {
        code: 'ASSIGNMENT_DRAFT_VERSION_CONFLICT',
        currentEditVersion: 4,
      },
    });

    expect(revisionUpdateMany).not.toHaveBeenCalled();
    expect(solutionUpsert).not.toHaveBeenCalled();
    expect(assignmentUpdate).not.toHaveBeenCalled();
  });

  it('does not publish an incomplete WRITTEN configuration', async () => {
    assignmentFindUnique.mockResolvedValue({
      id: 'assignment-1',
      type: AssignmentType.WRITTEN,
      status: AssignmentStatus.DRAFT,
    });
    revisionFindFirst.mockResolvedValue({
      id: 'revision-1',
      assignmentId: 'assignment-1',
      mapPresetId: null,
      version: 1,
      status: AssignmentRevisionStatus.DRAFT,
      title: 'Essay',
      prompt: 'Explain your position.',
      instructions: null,
      explanation: null,
      publicConfig: {},
      schemaVersion: 1,
      editVersion: 1,
      publishedAt: null,
      createdAt: new Date('2026-08-08T10:00:00.000Z'),
      updatedAt: new Date('2026-08-08T10:00:00.000Z'),
      solution: { gradingConfig: { mode: 'MANUAL' } },
    });
    const publishRequest = {
      expectedRevisionId: 'revision-1',
      expectedEditVersion: 1,
    };

    let thrown: unknown;
    try {
      await service.publish(teacher, 'assignment-1', publishRequest);
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConflictException);
    if (!(thrown instanceof ConflictException)) {
      throw new Error('Expected publish to throw ConflictException');
    }
    const response = thrown.getResponse();
    if (!isRecord(response) || !Array.isArray(response.issues)) {
      throw new Error('Expected structured publish validation issues');
    }
    expect(response.code).toBe('ASSIGNMENT_INCOMPLETE');
    expect(
      response.issues.some(
        (issue) =>
          isRecord(issue) &&
          Array.isArray(issue.path) &&
          issue.path.includes('publicConfig'),
      ),
    ).toBe(true);

    expect(revisionUpdateMany).not.toHaveBeenCalled();
    expect(assignmentUpdate).not.toHaveBeenCalled();
  });

  it('maps preview through a student-safe select and omits grading secrets', async () => {
    const secret = 'private-correct-answer';
    assignmentFindUnique
      .mockResolvedValueOnce({
        id: 'assignment-1',
        revisions: [{ id: 'revision-1' }],
      })
      .mockResolvedValueOnce({
        id: 'assignment-1',
        type: AssignmentType.WRITTEN,
        contentLocale: Locale.UK,
        defaultMaxPoints: decimal(5),
        defaultPassingPercent: decimal(60),
        revisions: [
          {
            id: 'revision-1',
            version: 1,
            title: 'Essay',
            prompt: 'Explain your position.',
            instructions: null,
            publicConfig: {
              responseMode: 'LONG',
              minLength: 0,
              maxLength: 20_000,
              allowAttachments: true,
              rubric: [],
            },
            mapPresetId: null,
            solution: {
              gradingConfig: { mode: 'MANUAL', correctText: secret },
            },
          },
        ],
      });

    const preview = await service.preview(teacher, 'assignment-1', {});

    expect(preview).toMatchObject({
      assignmentId: 'assignment-1',
      revisionId: 'revision-1',
      type: AssignmentType.WRITTEN,
      title: 'Essay',
      defaultMaxPoints: 5,
      defaultPassingPercent: 60,
    });
    expect(JSON.stringify(preview)).not.toContain(secret);
    const safeSelect = createAssignmentPreviewSelect(
      AssignmentRevisionSource.DRAFT,
    );
    expect(safeSelect.revisions.select).not.toHaveProperty('solution');
    expect(assignmentFindUnique).toHaveBeenLastCalledWith({
      where: { id: 'assignment-1' },
      select: safeSelect,
    });
  });

  it('requires an assignment used by a test to be archived', async () => {
    assignmentFindUnique.mockResolvedValue({
      id: 'assignment-1',
      _count: { testItems: 1 },
    });

    await expect(
      service.deleteAssignment(teacher, 'assignment-1'),
    ).rejects.toMatchObject({
      response: { code: 'ASSIGNMENT_IN_USE' },
    });

    expect(assignmentDelete).not.toHaveBeenCalled();
  });
});

function decimal(value: number): { toNumber(): number } {
  return { toNumber: () => value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
