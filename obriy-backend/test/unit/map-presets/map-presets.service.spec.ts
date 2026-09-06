import {
  Locale,
  MapPresetBaseMapMode,
  MapPresetSourceType,
  MapPresetStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import type { CustomGeoJsonProcessor } from '../../../src/map-presets/custom-geojson.processor';
import type { MapStorageService } from '../../../src/map-presets/map-storage.service';
import { MapPresetsService } from '../../../src/map-presets/map-presets.service';

describe('MapPresetsService', () => {
  const findMany = jest.fn<Promise<unknown[]>, [query: unknown]>();
  const findFirst = jest.fn();
  const findUnique = jest.fn();
  const findAttempt = jest.fn();
  const deliveryUrl = jest.fn();
  const prisma = {
    mapPreset: { findMany, findFirst, findUnique },
    testAttempt: { findFirst: findAttempt },
  } as unknown as PrismaService;
  const service = new MapPresetsService(
    prisma,
    {} as CustomGeoJsonProcessor,
    { deliveryUrl } as unknown as MapStorageService,
  );
  const teacher = {
    id: 'teacher-1',
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
    status: UserStatus.ACTIVE,
  } satisfies AuthUser;
  const student = {
    id: 'student-1',
    email: 'student@example.com',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  } satisfies AuthUser;

  beforeEach(() => jest.resetAllMocks());

  it('lists only active presets in a stable order', async () => {
    findMany.mockResolvedValue([presetRecord()]);

    await expect(service.listActive(teacher)).resolves.toEqual([
      expect.objectContaining({
        key: 'world-adm0',
        bounds: { west: -180, south: -85, east: 180, north: 85 },
        defaultViewport: { longitude: 15, latitude: 20, zoom: 1.25 },
      }),
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
    const query: unknown = findMany.mock.calls[0]?.[0];
    expect(query).toMatchObject({
      where: {
        status: MapPresetStatus.ACTIVE,
        OR: [
          { sourceType: MapPresetSourceType.BUILT_IN },
          {
            sourceType: MapPresetSourceType.CUSTOM_GEOJSON,
            createdById: teacher.id,
          },
        ],
      },
      orderBy: [{ sourceType: 'asc' }, { name: 'asc' }],
    });
    expect((query as { select?: unknown }).select).toBeDefined();
  });

  it('returns a non-disclosing 404 for a missing or archived preset', async () => {
    findFirst.mockResolvedValue(null);

    await expect(service.findActive(teacher, 'missing')).rejects.toMatchObject({
      response: { code: 'MAP_PRESET_NOT_FOUND' },
    });
  });

  it('rejects malformed persisted viewport configuration', async () => {
    findFirst.mockResolvedValue({
      ...presetRecord(),
      defaultViewport: { longitude: 500, latitude: 20, zoom: 1 },
    });

    await expect(service.findActive(teacher, 'preset-1')).rejects.toMatchObject(
      {
        response: { code: 'MAP_PRESET_CONFIG_INVALID' },
      },
    );
  });

  it('rejects reversed or empty persisted bounds', async () => {
    findFirst.mockResolvedValue({
      ...presetRecord(),
      bounds: { west: 40, south: 52, east: 20, north: 44 },
    });

    await expect(service.findActive(teacher, 'preset-1')).rejects.toMatchObject(
      {
        response: { code: 'MAP_PRESET_CONFIG_INVALID' },
      },
    );
  });

  it('delivers a private map to the owning teacher', async () => {
    findUnique.mockResolvedValue({
      sourceType: MapPresetSourceType.CUSTOM_GEOJSON,
      createdById: teacher.id,
      storageKey: 'obriy/maps/private-map',
    });
    deliveryUrl.mockReturnValue('https://storage.example/private-map');

    await expect(service.deliveryUrl(teacher, 'private-map')).resolves.toBe(
      'https://storage.example/private-map',
    );
    expect(findAttempt).not.toHaveBeenCalled();
  });

  it('delivers a private map to a student only through their attempt', async () => {
    findUnique.mockResolvedValue({
      sourceType: MapPresetSourceType.CUSTOM_GEOJSON,
      createdById: teacher.id,
      storageKey: 'obriy/maps/private-map',
    });
    findAttempt.mockResolvedValue({ id: 'attempt-1' });
    deliveryUrl.mockReturnValue('https://storage.example/private-map');

    await expect(
      service.deliveryUrl(student, 'private-map', 'attempt-1'),
    ).resolves.toBe('https://storage.example/private-map');
    expect(findAttempt).toHaveBeenCalledWith({
      where: {
        id: 'attempt-1',
        studentState: { studentId: student.id },
        testRevision: {
          items: {
            some: { assignmentRevision: { mapPresetId: 'private-map' } },
          },
        },
      },
      select: { id: true },
    });
  });

  it('does not disclose a private map without an eligible attempt', async () => {
    findUnique.mockResolvedValue({
      sourceType: MapPresetSourceType.CUSTOM_GEOJSON,
      createdById: teacher.id,
      storageKey: 'obriy/maps/private-map',
    });

    await expect(
      service.deliveryUrl(student, 'private-map'),
    ).rejects.toMatchObject({ response: { code: 'MAP_PRESET_NOT_FOUND' } });
    expect(deliveryUrl).not.toHaveBeenCalled();
  });
});

function presetRecord() {
  return {
    id: 'preset-1',
    key: 'world-adm0',
    name: 'Країни світу',
    contentLocale: Locale.UK,
    sourceType: MapPresetSourceType.BUILT_IN,
    status: MapPresetStatus.ACTIVE,
    baseMapMode: MapPresetBaseMapMode.STANDARD,
    geojsonUrl: '/maps/world-adm0.geojson',
    idProperty: 'featureId',
    year: null,
    periodLabel: null,
    originalFileName: null,
    fileSizeBytes: null,
    featureCount: null,
    vertexCount: null,
    attribution: 'geoBoundaries',
    bounds: { west: -180, south: -85, east: 180, north: 85 },
    defaultViewport: { longitude: 15, latitude: 20, zoom: 1.25 },
    _count: { revisions: 0 },
  };
}
