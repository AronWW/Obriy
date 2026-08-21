import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentAttachmentKind,
  AssignmentAttachmentStatus,
  AssignmentRevisionStatus,
  AssignmentStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { AssignmentEditorDto } from './dto/assignment-response.dto';
import { UploadAssignmentImageDto } from './dto/upload-assignment-image.dto';
import {
  assignmentEditorSelect,
  toAssignmentEditorDto,
} from './mappers/assignment.mapper';
import { validateAssignmentDraftPublicConfig } from './validation';
import { CloudinaryMediaService } from './cloudinary-media.service';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface UploadedAssignmentImage {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

@Injectable()
export class AssignmentImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryMediaService,
  ) {}

  async upload(
    user: AuthUser,
    assignmentId: string,
    dto: UploadAssignmentImageDto,
    file?: UploadedAssignmentImage,
  ): Promise<AssignmentEditorDto> {
    this.assertTeacher(user);
    this.validateFile(file);
    const owned = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, teacherId: user.id },
      select: {
        id: true,
        type: true,
        status: true,
        revisions: {
          where: { status: AssignmentRevisionStatus.DRAFT },
          take: 1,
          select: { id: true, schemaVersion: true, editVersion: true },
        },
      },
    });
    if (!owned) throw this.notFound();
    if (owned.status === AssignmentStatus.ARCHIVED) throw this.archived();
    const draft = owned.revisions[0];
    if (!draft) throw this.draftNotFound();
    this.assertVersion(draft.id, draft.editVersion, dto);

    const uploaded = await this.cloudinary.uploadImage(
      file.buffer,
      `obriy/assignments/${assignmentId}/${draft.id}`,
    );
    const attachmentId = randomUUID();

    try {
      const saved = await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.assignmentRevision.findFirst({
          where: {
            id: draft.id,
            assignmentId,
            status: AssignmentRevisionStatus.DRAFT,
          },
          select: {
            id: true,
            publicConfig: true,
            schemaVersion: true,
            editVersion: true,
          },
        });
        if (!current) throw this.draftNotFound();
        this.assertVersion(current.id, current.editVersion, dto);
        const publicConfig = this.toObject(current.publicConfig);
        const previousAttachmentId = this.promptImageId(publicConfig);
        const nextConfig = {
          ...publicConfig,
          promptImage: {
            attachmentId,
            width: uploaded.width,
            height: uploaded.height,
          },
        };
        const validation = validateAssignmentDraftPublicConfig(
          owned.type,
          current.schemaVersion,
          nextConfig,
        );
        if (!validation.success) {
          throw new BadRequestException({
            code: 'INVALID_ASSIGNMENT_CONFIG',
            issues: validation.issues,
          });
        }
        await transaction.assignmentAttachment.create({
          data: {
            id: attachmentId,
            revisionId: current.id,
            uploadedById: user.id,
            kind: AssignmentAttachmentKind.PROMPT,
            status: AssignmentAttachmentStatus.READY,
            storageKey: uploaded.public_id,
            originalName: file.originalname.slice(0, 255),
            mimeType: file.mimetype,
            sizeBytes: file.size,
            checksumSha256: createHash('sha256')
              .update(file.buffer)
              .digest('hex'),
          },
        });
        const updated = await transaction.assignmentRevision.updateMany({
          where: { id: current.id, editVersion: dto.expectedEditVersion },
          data: {
            publicConfig: validation.data as Prisma.InputJsonValue,
            editVersion: { increment: 1 },
          },
        });
        if (updated.count !== 1)
          throw this.conflict(current.id, current.editVersion);
        let obsoleteStorageKey: string | null = null;
        if (previousAttachmentId && previousAttachmentId !== attachmentId) {
          const obsolete = await transaction.assignmentAttachment.findFirst({
            where: { id: previousAttachmentId, revisionId: current.id },
            select: { id: true, storageKey: true },
          });
          if (obsolete) {
            await transaction.assignmentAttachment.delete({
              where: { id: obsolete.id },
            });
            obsoleteStorageKey = obsolete.storageKey;
          }
        }
        await transaction.assignment.update({
          where: { id: assignmentId },
          data: { updatedAt: new Date() },
        });
        const result = await transaction.assignment.findFirst({
          where: { id: assignmentId, teacherId: user.id },
          select: assignmentEditorSelect,
        });
        if (!result) throw this.notFound();
        return {
          editor: toAssignmentEditorDto(result),
          obsoleteStorageKey,
        };
      });
      if (saved.obsoleteStorageKey) {
        await this.cloudinary
          .destroyImage(saved.obsoleteStorageKey)
          .catch(() => undefined);
      }
      return saved.editor;
    } catch (error) {
      await this.cloudinary
        .destroyImage(uploaded.public_id)
        .catch(() => undefined);
      throw error;
    }
  }

  async deliveryUrl(attachmentId: string): Promise<string> {
    const attachment = await this.prisma.assignmentAttachment.findFirst({
      where: {
        id: attachmentId,
        kind: AssignmentAttachmentKind.PROMPT,
        status: AssignmentAttachmentStatus.READY,
      },
      select: { storageKey: true },
    });
    if (!attachment)
      throw new NotFoundException({
        code: 'ASSIGNMENT_IMAGE_NOT_FOUND',
        message: 'Image not found',
      });
    return this.cloudinary.deliveryUrl(attachment.storageKey);
  }

  async remove(
    user: AuthUser,
    assignmentId: string,
    dto: UploadAssignmentImageDto,
  ): Promise<AssignmentEditorDto> {
    this.assertTeacher(user);
    const saved = await this.prisma.$transaction(async (transaction) => {
      const assignment = await transaction.assignment.findFirst({
        where: { id: assignmentId, teacherId: user.id },
        select: {
          id: true,
          type: true,
          status: true,
          revisions: {
            where: { status: AssignmentRevisionStatus.DRAFT },
            take: 1,
            select: {
              id: true,
              publicConfig: true,
              schemaVersion: true,
              editVersion: true,
            },
          },
        },
      });
      if (!assignment) throw this.notFound();
      if (assignment.status === AssignmentStatus.ARCHIVED)
        throw this.archived();
      const draft = assignment.revisions[0];
      if (!draft) throw this.draftNotFound();
      this.assertVersion(draft.id, draft.editVersion, dto);
      const publicConfig = this.toObject(draft.publicConfig);
      const previousAttachmentId = this.promptImageId(publicConfig);
      const validation = validateAssignmentDraftPublicConfig(
        assignment.type,
        draft.schemaVersion,
        { ...publicConfig, promptImage: null },
      );
      if (!validation.success) {
        throw new BadRequestException({
          code: 'INVALID_ASSIGNMENT_CONFIG',
          issues: validation.issues,
        });
      }
      const updated = await transaction.assignmentRevision.updateMany({
        where: { id: draft.id, editVersion: dto.expectedEditVersion },
        data: {
          publicConfig: validation.data as Prisma.InputJsonValue,
          editVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw this.conflict(draft.id, draft.editVersion);
      let obsoleteStorageKey: string | null = null;
      if (previousAttachmentId) {
        const obsolete = await transaction.assignmentAttachment.findFirst({
          where: { id: previousAttachmentId, revisionId: draft.id },
          select: { id: true, storageKey: true },
        });
        if (obsolete) {
          await transaction.assignmentAttachment.delete({
            where: { id: obsolete.id },
          });
          obsoleteStorageKey = obsolete.storageKey;
        }
      }
      await transaction.assignment.update({
        where: { id: assignmentId },
        data: { updatedAt: new Date() },
      });
      const result = await transaction.assignment.findFirst({
        where: { id: assignmentId, teacherId: user.id },
        select: assignmentEditorSelect,
      });
      if (!result) throw this.notFound();
      return { editor: toAssignmentEditorDto(result), obsoleteStorageKey };
    });
    if (saved.obsoleteStorageKey) {
      await this.cloudinary
        .destroyImage(saved.obsoleteStorageKey)
        .catch(() => undefined);
    }
    return saved.editor;
  }

  private validateFile(
    file?: UploadedAssignmentImage,
  ): asserts file is UploadedAssignmentImage {
    if (!file)
      throw new BadRequestException({
        code: 'ASSIGNMENT_IMAGE_REQUIRED',
        message: 'Select an image',
      });
    if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException({
        code: 'ASSIGNMENT_IMAGE_TYPE_INVALID',
        message: 'Only JPEG, PNG, and WebP images are supported',
      });
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException({
        code: 'ASSIGNMENT_IMAGE_SIZE_INVALID',
        message: 'Image must not exceed 10 MB',
      });
    }
  }

  private assertTeacher(user: AuthUser): void {
    if (user.role !== UserRole.TEACHER)
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Teacher role required',
      });
  }

  private assertVersion(
    id: string,
    version: number,
    dto: UploadAssignmentImageDto,
  ): void {
    if (id !== dto.expectedRevisionId || version !== dto.expectedEditVersion)
      throw this.conflict(id, version);
  }

  private toObject(value: Prisma.JsonValue): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? { ...value }
      : {};
  }

  private promptImageId(config: Record<string, unknown>): string | null {
    const image = this.toObjectOrNull(config.promptImage);
    return typeof image?.attachmentId === 'string' ? image.attachmentId : null;
  }

  private toObjectOrNull(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private notFound() {
    return new NotFoundException({
      code: 'ASSIGNMENT_NOT_FOUND',
      message: 'Assignment not found',
    });
  }
  private draftNotFound() {
    return new NotFoundException({
      code: 'ASSIGNMENT_DRAFT_NOT_FOUND',
      message: 'Draft not found',
    });
  }
  private archived() {
    return new ConflictException({
      code: 'ASSIGNMENT_ARCHIVED',
      message: 'Assignment is archived',
    });
  }
  private conflict(id: string, version: number) {
    return new ConflictException({
      code: 'ASSIGNMENT_DRAFT_VERSION_CONFLICT',
      message: 'Draft changed',
      currentRevisionId: id,
      currentEditVersion: version,
    });
  }
}
