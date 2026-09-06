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
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { CustomGeoJsonProcessor } from './custom-geojson.processor';
import {
  CreateMapDraftDto,
  ImportMapDraftDto,
  MapDraftDto,
  PublishMapDraftResultDto,
  UpdateMapDraftDto,
  type UploadedCustomMap,
} from './dto/map-draft.dto';
import { mapDraftSelect, toMapDraftDto } from './map-draft.mapper';
import { mapPresetSelect, toMapPresetDto } from './map-preset.mapper';
import { MapStorageService } from './map-storage.service';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(['.geojson', '.json']);
const EMPTY_COLLECTION = Buffer.from(
  JSON.stringify({ type: 'FeatureCollection', features: [] }),
);

@Injectable()
export class MapDraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: CustomGeoJsonProcessor,
    private readonly storage: MapStorageService,
  ) {}

  async list(user: AuthUser): Promise<MapDraftDto[]> {
    this.assertTeacher(user);
    const drafts = await this.prisma.mapDraft.findMany({
      where: { teacherId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: mapDraftSelect,
    });
    return drafts.map(toMapDraftDto);
  }

  async find(user: AuthUser, draftId: string): Promise<MapDraftDto> {
    this.assertTeacher(user);
    return toMapDraftDto(await this.owned(user.id, draftId));
  }

  async create(user: AuthUser, dto: CreateMapDraftDto): Promise<MapDraftDto> {
    this.assertTeacher(user);
    const draft = await this.prisma.mapDraft.create({
      data: {
        teacherId: user.id,
        name: this.requiredText(dto.name),
        contentLocale: dto.contentLocale,
        periodLabel: this.optionalText(dto.periodLabel),
        attribution: this.optionalText(dto.attribution) ?? '',
      },
      select: mapDraftSelect,
    });
    return toMapDraftDto(draft);
  }

  async import(
    user: AuthUser,
    dto: ImportMapDraftDto,
    file?: UploadedCustomMap,
  ): Promise<MapDraftDto> {
    this.assertTeacher(user);
    this.validateFile(file);
    const processed = await this.processor.process(
      file.buffer,
      dto.labelProperty,
    );
    const id = randomUUID();
    const storageKey = this.draftStorageKey(user.id, id, 1);
    await this.storage.uploadDraftGeoJson(processed.buffer, storageKey);
    try {
      const draft = await this.prisma.mapDraft.create({
        data: {
          id,
          teacherId: user.id,
          name: this.requiredText(dto.name),
          contentLocale: dto.contentLocale,
          periodLabel: this.optionalText(dto.periodLabel),
          attribution: this.optionalText(dto.attribution) ?? '',
          storageKey,
          originalFileName: this.fileName(file.originalname),
          fileSizeBytes: processed.buffer.byteLength,
          featureCount: processed.featureCount,
          vertexCount: processed.vertexCount,
          bounds: processed.bounds,
          defaultViewport: processed.defaultViewport,
        },
        select: mapDraftSelect,
      });
      return toMapDraftDto(draft);
    } catch (error) {
      await this.storage.destroyGeoJson(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async fromPreset(user: AuthUser, presetId: string): Promise<MapDraftDto> {
    this.assertTeacher(user);
    const preset = await this.prisma.mapPreset.findFirst({
      where: {
        id: presetId,
        createdById: user.id,
        sourceType: MapPresetSourceType.CUSTOM_GEOJSON,
      },
      select: {
        id: true,
        name: true,
        contentLocale: true,
        periodLabel: true,
        attribution: true,
        storageKey: true,
        originalFileName: true,
      },
    });
    if (!preset?.storageKey) throw this.notFound();
    const source = await this.storage.downloadGeoJson(preset.storageKey);
    const processed = await this.processor.process(source, 'name');
    const id = randomUUID();
    const storageKey = this.draftStorageKey(user.id, id, 1);
    await this.storage.uploadDraftGeoJson(processed.buffer, storageKey);
    try {
      const draft = await this.prisma.mapDraft.create({
        data: {
          id,
          teacherId: user.id,
          sourcePresetId: preset.id,
          name: preset.name,
          contentLocale: preset.contentLocale,
          periodLabel: preset.periodLabel,
          attribution: preset.attribution,
          storageKey,
          originalFileName: preset.originalFileName,
          fileSizeBytes: processed.buffer.byteLength,
          featureCount: processed.featureCount,
          vertexCount: processed.vertexCount,
          bounds: processed.bounds,
          defaultViewport: processed.defaultViewport,
        },
        select: mapDraftSelect,
      });
      return toMapDraftDto(draft);
    } catch (error) {
      await this.storage.destroyGeoJson(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async update(
    user: AuthUser,
    draftId: string,
    dto: UpdateMapDraftDto,
  ): Promise<MapDraftDto> {
    this.assertTeacher(user);
    await this.owned(user.id, draftId);
    const data: Prisma.MapDraftUpdateManyMutationInput = {
      editVersion: { increment: 1 },
    };
    if (dto.name !== undefined) data.name = this.requiredText(dto.name);
    if (dto.contentLocale !== undefined) data.contentLocale = dto.contentLocale;
    if (dto.periodLabel !== undefined)
      data.periodLabel = this.optionalText(dto.periodLabel);
    if (dto.attribution !== undefined)
      data.attribution = this.optionalText(dto.attribution) ?? '';
    const update = await this.prisma.mapDraft.updateMany({
      where: {
        id: draftId,
        teacherId: user.id,
        editVersion: dto.expectedEditVersion,
      },
      data,
    });
    if (update.count !== 1) throw this.conflict();
    return this.find(user, draftId);
  }

  async saveGeometry(
    user: AuthUser,
    draftId: string,
    expectedEditVersion: number,
    file?: UploadedCustomMap,
  ): Promise<MapDraftDto> {
    this.assertTeacher(user);
    this.validateFile(file);
    const current = await this.owned(user.id, draftId);
    if (current.editVersion !== expectedEditVersion) throw this.conflict();
    const empty = this.isEmptyCollection(file.buffer);
    const processed = empty
      ? null
      : await this.processor.process(file.buffer, 'name');
    const nextVersion = expectedEditVersion + 1;
    const storageKey = this.draftStorageKey(user.id, draftId, nextVersion);
    const output = processed?.buffer ?? EMPTY_COLLECTION;
    await this.storage.uploadDraftGeoJson(output, storageKey);
    try {
      const updated = await this.prisma.mapDraft.updateMany({
        where: {
          id: draftId,
          teacherId: user.id,
          editVersion: expectedEditVersion,
        },
        data: {
          storageKey,
          originalFileName: this.fileName(file.originalname),
          fileSizeBytes: output.byteLength,
          featureCount: processed?.featureCount ?? 0,
          vertexCount: processed?.vertexCount ?? 0,
          bounds: processed?.bounds ?? Prisma.JsonNull,
          defaultViewport: processed?.defaultViewport ?? Prisma.JsonNull,
          editVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw this.conflict();
      if (current.storageKey && current.storageKey !== storageKey) {
        await this.storage
          .destroyGeoJson(current.storageKey)
          .catch(() => undefined);
      }
      return this.find(user, draftId);
    } catch (error) {
      await this.storage.destroyGeoJson(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async publish(
    user: AuthUser,
    draftId: string,
    expectedEditVersion: number,
  ): Promise<PublishMapDraftResultDto> {
    this.assertTeacher(user);
    const draft = await this.owned(user.id, draftId);
    if (draft.editVersion !== expectedEditVersion) throw this.conflict();
    if (!draft.storageKey || draft.featureCount < 1) {
      throw new BadRequestException({
        code: 'MAP_DRAFT_EMPTY',
        message: 'Додайте хоча б один регіон перед публікацією.',
      });
    }
    const source = await this.storage.downloadGeoJson(draft.storageKey);
    const processed = await this.processor.process(source, 'name');
    const presetId = randomUUID();
    const uploaded = await this.storage.uploadGeoJson(
      processed.buffer,
      `obriy/maps/${user.id}/${presetId}`,
    );
    let replacedStorageKey: string | null = null;
    try {
      const preset = await this.prisma.$transaction(async (transaction) => {
        const sourcePreset = draft.sourcePresetId
          ? await transaction.mapPreset.findFirst({
              where: {
                id: draft.sourcePresetId,
                createdById: user.id,
                sourceType: MapPresetSourceType.CUSTOM_GEOJSON,
              },
              select: {
                id: true,
                storageKey: true,
                _count: { select: { revisions: true } },
              },
            })
          : null;
        const data = {
          name: draft.name,
          contentLocale: draft.contentLocale,
          status: MapPresetStatus.ACTIVE,
          baseMapMode: MapPresetBaseMapMode.NEUTRAL,
          storageKey: uploaded.public_id,
          originalFileName: draft.originalFileName ?? 'map.geojson',
          fileSizeBytes: processed.buffer.byteLength,
          featureCount: processed.featureCount,
          vertexCount: processed.vertexCount,
          idProperty: processed.idProperty,
          periodLabel: draft.periodLabel,
          attribution: draft.attribution,
          bounds: processed.bounds,
          defaultViewport: processed.defaultViewport,
          archivedAt: null,
        } satisfies Prisma.MapPresetUpdateInput;
        const record =
          sourcePreset && sourcePreset._count.revisions === 0
            ? await transaction.mapPreset.update({
                where: { id: sourcePreset.id },
                data,
                select: mapPresetSelect,
              })
            : await transaction.mapPreset.create({
                data: {
                  ...data,
                  id: presetId,
                  createdById: user.id,
                  key: `custom-${presetId}`,
                  sourceType: MapPresetSourceType.CUSTOM_GEOJSON,
                  geojsonUrl: `/map-presets/${presetId}/geojson`,
                },
                select: mapPresetSelect,
              });
        if (sourcePreset && sourcePreset._count.revisions === 0)
          replacedStorageKey = sourcePreset.storageKey;
        const removed = await transaction.mapDraft.deleteMany({
          where: {
            id: draftId,
            teacherId: user.id,
            editVersion: expectedEditVersion,
          },
        });
        if (removed.count !== 1) throw this.conflict();
        return record;
      });
      await this.storage
        .destroyGeoJson(draft.storageKey)
        .catch(() => undefined);
      if (replacedStorageKey && replacedStorageKey !== uploaded.public_id)
        await this.storage
          .destroyGeoJson(replacedStorageKey)
          .catch(() => undefined);
      return { preset: toMapPresetDto(preset) };
    } catch (error) {
      await this.storage
        .destroyGeoJson(uploaded.public_id)
        .catch(() => undefined);
      throw error;
    }
  }

  async delete(user: AuthUser, draftId: string): Promise<void> {
    this.assertTeacher(user);
    const draft = await this.owned(user.id, draftId);
    await this.prisma.mapDraft.delete({ where: { id: draftId } });
    if (draft.storageKey)
      await this.storage
        .destroyGeoJson(draft.storageKey)
        .catch(() => undefined);
  }

  async deliveryUrl(user: AuthUser, draftId: string): Promise<string> {
    this.assertTeacher(user);
    const draft = await this.owned(user.id, draftId);
    if (!draft.storageKey) throw this.notFound();
    return this.storage.deliveryUrl(draft.storageKey);
  }

  private owned(teacherId: string, draftId: string) {
    return this.prisma.mapDraft
      .findFirst({
        where: { id: draftId, teacherId },
        select: mapDraftSelect,
      })
      .then((draft) => {
        if (!draft) throw this.notFound();
        return draft;
      });
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
    if (!ACCEPTED_EXTENSIONS.has(extname(file.originalname).toLowerCase()))
      throw new BadRequestException({
        code: 'INVALID_MAP_FILE_TYPE',
        message: 'Підтримуються лише файли .geojson та .json.',
      });
  }

  private isEmptyCollection(buffer: Buffer): boolean {
    try {
      const value = JSON.parse(buffer.toString('utf8')) as {
        type?: unknown;
        features?: unknown;
      };
      return (
        value.type === 'FeatureCollection' &&
        Array.isArray(value.features) &&
        value.features.length === 0
      );
    } catch {
      return false;
    }
  }

  private draftStorageKey(
    teacherId: string,
    draftId: string,
    version: number,
  ): string {
    return `obriy/map-drafts/${teacherId}/${draftId}/v-${version}-${randomUUID()}`;
  }

  private requiredText(value: string): string {
    const normalized = value.trim();
    if (!normalized)
      throw new BadRequestException({
        code: 'MAP_NAME_REQUIRED',
        message: 'Назва карти обов’язкова.',
      });
    return normalized;
  }

  private optionalText(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private fileName(value: string): string {
    return basename(value).slice(0, 255);
  }

  private assertTeacher(user: AuthUser): void {
    if (user.role !== UserRole.TEACHER)
      throw new ForbiddenException({
        code: 'TEACHER_ONLY',
        message: 'Teacher role required',
      });
  }

  private conflict(): ConflictException {
    return new ConflictException({
      code: 'MAP_DRAFT_EDIT_CONFLICT',
      message: 'Чернетку вже змінено в іншій вкладці. Оновіть сторінку.',
    });
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'MAP_DRAFT_NOT_FOUND',
      message: 'Map draft not found',
    });
  }
}
