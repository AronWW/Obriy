import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MapPresetBaseMapMode,
  MapPresetSourceType,
  MapPresetStatus,
  Prisma,
  TestReleaseStatus,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { CustomGeoJsonProcessor } from './custom-geojson.processor';
import {
  CreateCustomMapPresetDto,
  InspectCustomMapDto,
  ReplaceCustomMapGeoJsonDto,
  UpdateCustomMapPresetDto,
  type UploadedCustomMap,
} from './dto/custom-map-preset.dto';
import { MapPresetDto } from './dto/map-preset.dto';
import { mapPresetSelect, toMapPresetDto } from './map-preset.mapper';
import { MapStorageService } from './map-storage.service';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(['.geojson', '.json']);

@Injectable()
export class MapPresetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: CustomGeoJsonProcessor,
    private readonly storage: MapStorageService,
  ) {}

  async listActive(user: AuthUser): Promise<MapPresetDto[]> {
    this.assertTeacher(user);
    const presets = await this.prisma.mapPreset.findMany({
      where: {
        status: MapPresetStatus.ACTIVE,
        OR: [
          { sourceType: MapPresetSourceType.BUILT_IN },
          {
            sourceType: MapPresetSourceType.CUSTOM_GEOJSON,
            createdById: user.id,
          },
        ],
      },
      orderBy: [{ sourceType: 'asc' }, { name: 'asc' }],
      select: mapPresetSelect,
    });
    return presets.map(toMapPresetDto);
  }

  async listMine(
    user: AuthUser,
    status?: MapPresetStatus,
  ): Promise<MapPresetDto[]> {
    this.assertTeacher(user);
    const presets = await this.prisma.mapPreset.findMany({
      where: {
        createdById: user.id,
        sourceType: MapPresetSourceType.CUSTOM_GEOJSON,
        ...(status ? { status } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      select: mapPresetSelect,
    });
    return presets.map(toMapPresetDto);
  }

  async findActive(user: AuthUser, presetId: string): Promise<MapPresetDto> {
    this.assertTeacher(user);
    const preset = await this.prisma.mapPreset.findFirst({
      where: {
        id: presetId,
        status: MapPresetStatus.ACTIVE,
        OR: [
          { sourceType: MapPresetSourceType.BUILT_IN },
          {
            sourceType: MapPresetSourceType.CUSTOM_GEOJSON,
            createdById: user.id,
          },
        ],
      },
      select: mapPresetSelect,
    });
    if (!preset) throw this.notFound();
    return toMapPresetDto(preset);
  }

  inspect(user: AuthUser, file?: UploadedCustomMap): InspectCustomMapDto {
    this.assertTeacher(user);
    this.validateFile(file);
    return this.processor.inspect(file.buffer);
  }

  async create(
    user: AuthUser,
    dto: CreateCustomMapPresetDto,
    file?: UploadedCustomMap,
  ): Promise<MapPresetDto> {
    this.assertTeacher(user);
    this.validateFile(file);
    const processed = await this.processor.process(
      file.buffer,
      dto.labelProperty,
    );
    const id = randomUUID();
    const uploaded = await this.storage.uploadGeoJson(
      processed.buffer,
      `obriy/maps/${user.id}/${id}`,
    );
    try {
      const preset = await this.prisma.mapPreset.create({
        data: {
          id,
          createdById: user.id,
          key: `custom-${id}`,
          name: dto.name.trim(),
          contentLocale: dto.contentLocale,
          sourceType: MapPresetSourceType.CUSTOM_GEOJSON,
          status: MapPresetStatus.ACTIVE,
          baseMapMode: MapPresetBaseMapMode.NEUTRAL,
          geojsonUrl: `/map-presets/${id}/geojson`,
          storageKey: uploaded.public_id,
          originalFileName: this.fileName(file.originalname),
          fileSizeBytes: processed.buffer.byteLength,
          featureCount: processed.featureCount,
          vertexCount: processed.vertexCount,
          idProperty: processed.idProperty,
          periodLabel: this.optionalText(dto.periodLabel),
          attribution: this.optionalText(dto.attribution) ?? '',
          bounds: processed.bounds,
          defaultViewport: processed.defaultViewport,
        },
        select: mapPresetSelect,
      });
      return toMapPresetDto(preset);
    } catch (error) {
      await this.storage
        .destroyGeoJson(uploaded.public_id)
        .catch(() => undefined);
      throw error;
    }
  }

  async update(
    user: AuthUser,
    presetId: string,
    dto: UpdateCustomMapPresetDto,
  ): Promise<MapPresetDto> {
    this.assertTeacher(user);
    await this.ownedCustomPreset(user.id, presetId);
    const data: Prisma.MapPresetUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.contentLocale !== undefined) data.contentLocale = dto.contentLocale;
    if (dto.periodLabel !== undefined)
      data.periodLabel = this.optionalText(dto.periodLabel);
    if (dto.attribution !== undefined)
      data.attribution = this.optionalText(dto.attribution) ?? '';
    const preset = await this.prisma.mapPreset.update({
      where: { id: presetId },
      data,
      select: mapPresetSelect,
    });
    return toMapPresetDto(preset);
  }

  async replaceGeoJson(
    user: AuthUser,
    presetId: string,
    dto: ReplaceCustomMapGeoJsonDto,
    file?: UploadedCustomMap,
  ): Promise<MapPresetDto> {
    this.assertTeacher(user);
    this.validateFile(file);
    const current = await this.ownedCustomPreset(user.id, presetId);
    if (current._count.revisions > 0) {
      throw new ConflictException({
        code: 'MAP_GEOMETRY_LOCKED',
        message:
          'Геометрія карти заблокована після першої прив’язки до завдання.',
      });
    }
    const processed = await this.processor.process(
      file.buffer,
      dto.labelProperty,
    );
    const uploaded = await this.storage.uploadGeoJson(
      processed.buffer,
      `obriy/maps/${user.id}/${presetId}`,
    );
    try {
      const preset = await this.prisma.mapPreset.update({
        where: { id: presetId },
        data: {
          storageKey: uploaded.public_id,
          originalFileName: this.fileName(file.originalname),
          fileSizeBytes: processed.buffer.byteLength,
          featureCount: processed.featureCount,
          vertexCount: processed.vertexCount,
          idProperty: processed.idProperty,
          bounds: processed.bounds,
          defaultViewport: processed.defaultViewport,
        },
        select: mapPresetSelect,
      });
      if (current.storageKey) {
        await this.storage
          .destroyGeoJson(current.storageKey)
          .catch(() => undefined);
      }
      return toMapPresetDto(preset);
    } catch (error) {
      await this.storage
        .destroyGeoJson(uploaded.public_id)
        .catch(() => undefined);
      throw error;
    }
  }

  archive(user: AuthUser, presetId: string): Promise<MapPresetDto> {
    return this.setStatus(user, presetId, MapPresetStatus.ARCHIVED);
  }

  restore(user: AuthUser, presetId: string): Promise<MapPresetDto> {
    return this.setStatus(user, presetId, MapPresetStatus.ACTIVE);
  }

  async delete(user: AuthUser, presetId: string): Promise<void> {
    this.assertTeacher(user);
    const preset = await this.ownedCustomPreset(user.id, presetId);
    if (preset.status !== MapPresetStatus.ARCHIVED) {
      throw new ConflictException({
        code: 'MAP_MUST_BE_ARCHIVED',
        message: 'Перед остаточним видаленням карту потрібно архівувати.',
      });
    }
    if (preset._count.revisions > 0) {
      throw new ConflictException({
        code: 'MAP_IS_IN_USE',
        message: 'Карта використовується в завданнях і не може бути видалена.',
      });
    }
    if (preset.storageKey) await this.storage.destroyGeoJson(preset.storageKey);
    await this.prisma.mapPreset.delete({ where: { id: presetId } });
  }

  async deliveryUrl(
    user: AuthUser,
    presetId: string,
    attemptId?: string,
    releaseId?: string,
    childId?: string,
  ): Promise<string> {
    const preset = await this.prisma.mapPreset.findUnique({
      where: { id: presetId },
      select: {
        sourceType: true,
        createdById: true,
        storageKey: true,
      },
    });
    if (
      !preset ||
      preset.sourceType !== MapPresetSourceType.CUSTOM_GEOJSON ||
      !preset.storageKey
    )
      throw this.notFound();
    let allowed =
      user.role === UserRole.TEACHER && preset.createdById === user.id;
    if (!allowed && user.role === UserRole.STUDENT && attemptId) {
      const attempt = await this.prisma.testAttempt.findFirst({
        where: {
          id: attemptId,
          studentState: { studentId: user.id },
          testRevision: {
            items: {
              some: { assignmentRevision: { mapPresetId: presetId } },
            },
          },
        },
        select: { id: true },
      });
      allowed = Boolean(attempt);
    }
    if (!allowed && user.role === UserRole.PARENT && releaseId && childId) {
      const release = await this.prisma.testRelease.findFirst({
        where: {
          id: releaseId,
          status: {
            in: [
              TestReleaseStatus.SCHEDULED,
              TestReleaseStatus.ACTIVE,
              TestReleaseStatus.CLOSED,
            ],
          },
          lessonId: { not: null },
          class: {
            students: {
              some: {
                id: childId,
                childLinks: { some: { parentId: user.id } },
              },
            },
          },
          lesson: {
            moderationStatus: 'CLEAR',
          },
          revision: {
            items: {
              some: { assignmentRevision: { mapPresetId: presetId } },
            },
          },
        },
        select: { classId: true, lessonId: true },
      });
      if (release?.lessonId) {
        const published = await this.prisma.classLesson.findUnique({
          where: {
            classId_lessonId: {
              classId: release.classId,
              lessonId: release.lessonId,
            },
          },
          select: { publishedAt: true },
        });
        allowed = Boolean(published?.publishedAt);
      }
    }
    if (!allowed) throw this.notFound();
    return this.storage.deliveryUrl(preset.storageKey);
  }

  private async setStatus(
    user: AuthUser,
    presetId: string,
    status: MapPresetStatus,
  ): Promise<MapPresetDto> {
    this.assertTeacher(user);
    await this.ownedCustomPreset(user.id, presetId);
    const preset = await this.prisma.mapPreset.update({
      where: { id: presetId },
      data: {
        status,
        archivedAt: status === MapPresetStatus.ARCHIVED ? new Date() : null,
      },
      select: mapPresetSelect,
    });
    return toMapPresetDto(preset);
  }

  private async ownedCustomPreset(userId: string, presetId: string) {
    const preset = await this.prisma.mapPreset.findFirst({
      where: {
        id: presetId,
        createdById: userId,
        sourceType: MapPresetSourceType.CUSTOM_GEOJSON,
      },
      select: {
        id: true,
        status: true,
        storageKey: true,
        _count: { select: { revisions: true } },
      },
    });
    if (!preset) throw this.notFound();
    return preset;
  }

  private validateFile(
    file?: UploadedCustomMap,
  ): asserts file is UploadedCustomMap {
    if (!file)
      throw new BadRequestException({
        code: 'MAP_FILE_REQUIRED',
        message: 'Оберіть GeoJSON-файл.',
      });
    if (file.size > MAX_FILE_BYTES)
      throw new BadRequestException({
        code: 'MAP_FILE_TOO_LARGE',
        message: 'Максимальний розмір GeoJSON — 20 МБ.',
      });
    if (!ACCEPTED_EXTENSIONS.has(extname(file.originalname).toLowerCase())) {
      throw new BadRequestException({
        code: 'INVALID_MAP_FILE_TYPE',
        message: 'Підтримуються лише файли .geojson та .json.',
      });
    }
  }

  private fileName(value: string): string {
    return basename(value).slice(0, 255);
  }

  private optionalText(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private assertTeacher(user: AuthUser): void {
    if (user.role !== UserRole.TEACHER)
      throw new ForbiddenException({
        code: 'TEACHER_ONLY',
        message: 'Teacher role required',
      });
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'MAP_PRESET_NOT_FOUND',
      message: 'Map preset not found',
    });
  }
}
