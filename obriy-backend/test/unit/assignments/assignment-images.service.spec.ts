import {
  AssignmentRevisionStatus,
  AssignmentStatus,
  AssignmentType,
  Locale,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { AssignmentImagesService } from '../../../src/assignments/assignment-images.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

describe('AssignmentImagesService', () => {
  const teacher: AuthUser = {
    id: 'teacher-1',
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
    status: UserStatus.ACTIVE,
  };

  it('rejects invalid image content before database or Cloudinary access', async () => {
    const prisma = { assignment: { findFirst: jest.fn() } };
    const cloudinary = { uploadImage: jest.fn() };
    const service = new AssignmentImagesService(
      prisma as never,
      cloudinary as never,
    );

    await expect(
      service.upload(teacher, 'assignment-1', versionDto(), {
        buffer: Buffer.from('not-an-image'),
        mimetype: 'text/plain',
        originalname: 'answer.txt',
        size: 12,
      }),
    ).rejects.toMatchObject({
      response: { code: 'ASSIGNMENT_IMAGE_TYPE_INVALID' },
    });
    expect(prisma.assignment.findFirst).not.toHaveBeenCalled();
    expect(cloudinary.uploadImage).not.toHaveBeenCalled();
  });

  it('uploads a valid image and atomically pins it to the current draft', async () => {
    const attachmentCreate = jest.fn();
    const revisionUpdate = jest.fn().mockResolvedValue({ count: 1 });
    const assignmentUpdate = jest.fn();
    const editorRecord = assignmentEditorRecord();
    const transaction = {
      assignmentRevision: {
        findFirst: jest.fn().mockResolvedValue({
          id: versionDto().expectedRevisionId,
          publicConfig: writtenConfig(),
          schemaVersion: 1,
          editVersion: 1,
        }),
        updateMany: revisionUpdate,
      },
      assignmentAttachment: {
        create: attachmentCreate,
        findFirst: jest.fn().mockResolvedValue(null),
      },
      assignment: {
        update: assignmentUpdate,
        findFirst: jest.fn().mockResolvedValue(editorRecord),
      },
    };
    const prisma = {
      assignment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'assignment-1',
          type: AssignmentType.WRITTEN,
          status: AssignmentStatus.DRAFT,
          revisions: [
            {
              id: versionDto().expectedRevisionId,
              schemaVersion: 1,
              editVersion: 1,
            },
          ],
        }),
      },
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    };
    const cloudinary = {
      uploadImage: jest.fn().mockResolvedValue({
        public_id: 'obriy/image-1',
        width: 1200,
        height: 800,
      }),
      destroyImage: jest.fn(),
    };
    const service = new AssignmentImagesService(
      prisma as never,
      cloudinary as never,
    );

    const result = await service.upload(teacher, 'assignment-1', versionDto(), {
      buffer: Buffer.from('valid-image'),
      mimetype: 'image/png',
      originalname: 'map.png',
      size: 11,
    });

    expect(result.id).toBe('assignment-1');
    expect(attachmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storageKey: 'obriy/image-1',
        mimeType: 'image/png',
      }),
    });
    expect(revisionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publicConfig: expect.objectContaining({
            promptImage: expect.objectContaining({ width: 1200, height: 800 }),
          }),
        }),
      }),
    );
    expect(cloudinary.destroyImage).not.toHaveBeenCalled();
  });
});

function versionDto() {
  return {
    expectedRevisionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    expectedEditVersion: 1,
  };
}

function writtenConfig() {
  return {
    responseMode: 'LONG',
    minLength: 0,
    maxLength: 5_000,
    allowAttachments: false,
    rubric: [],
  };
}

function assignmentEditorRecord() {
  const date = new Date('2026-08-21T10:00:00.000Z');
  return {
    id: 'assignment-1',
    type: AssignmentType.WRITTEN,
    contentLocale: Locale.UK,
    status: AssignmentStatus.DRAFT,
    defaultMaxPoints: { toNumber: () => 1 },
    defaultPassingPercent: { toNumber: () => 100 },
    archivedAt: null,
    createdAt: date,
    updatedAt: date,
    revisions: [
      {
        id: versionDto().expectedRevisionId,
        version: 1,
        status: AssignmentRevisionStatus.DRAFT,
        title: 'Question',
        prompt: 'Prompt',
        instructions: null,
        explanation: null,
        publicConfig: writtenConfig(),
        mapPresetId: null,
        schemaVersion: 1,
        editVersion: 2,
        publishedAt: null,
        createdAt: date,
        updatedAt: date,
        solution: { gradingConfig: { mode: 'MANUAL' } },
      },
    ],
  };
}
