import { Locale, MapPresetSourceType, MapPresetStatus } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { MapPresetsService } from '../../../src/map-presets/map-presets.service';

describe('MapPresetsService', () => {
  const findMany = jest.fn<Promise<unknown[]>, [query: unknown]>();
  const findFirst = jest.fn();
  const prisma = {
    mapPreset: { findMany, findFirst },
  } as unknown as PrismaService;
  const service = new MapPresetsService(prisma);

  beforeEach(() => jest.resetAllMocks());

  it('lists only active presets in a stable order', async () => {
    findMany.mockResolvedValue([presetRecord()]);

    await expect(service.listActive()).resolves.toEqual([
      expect.objectContaining({
        key: 'world-adm0',
        bounds: { west: -180, south: -85, east: 180, north: 85 },
        defaultViewport: { longitude: 15, latitude: 20, zoom: 1.25 },
      }),
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
    const query: unknown = findMany.mock.calls[0]?.[0];
    expect(query).toMatchObject({
      where: { status: MapPresetStatus.ACTIVE },
      orderBy: [{ sourceType: 'asc' }, { name: 'asc' }],
    });
    expect((query as { select?: unknown }).select).toBeDefined();
  });

  it('returns a non-disclosing 404 for a missing or archived preset', async () => {
    findFirst.mockResolvedValue(null);

    await expect(service.findActive('missing')).rejects.toMatchObject({
      response: { code: 'MAP_PRESET_NOT_FOUND' },
    });
  });

  it('rejects malformed persisted viewport configuration', async () => {
    findFirst.mockResolvedValue({
      ...presetRecord(),
      defaultViewport: { longitude: 500, latitude: 20, zoom: 1 },
    });

    await expect(service.findActive('preset-1')).rejects.toMatchObject({
      response: { code: 'MAP_PRESET_CONFIG_INVALID' },
    });
  });

  it('rejects reversed or empty persisted bounds', async () => {
    findFirst.mockResolvedValue({
      ...presetRecord(),
      bounds: { west: 40, south: 52, east: 20, north: 44 },
    });

    await expect(service.findActive('preset-1')).rejects.toMatchObject({
      response: { code: 'MAP_PRESET_CONFIG_INVALID' },
    });
  });
});

function presetRecord() {
  return {
    id: 'preset-1',
    key: 'world-adm0',
    name: 'Країни світу',
    contentLocale: Locale.UK,
    sourceType: MapPresetSourceType.BUILT_IN,
    geojsonUrl: '/maps/world-adm0.geojson',
    idProperty: 'featureId',
    year: null,
    attribution: 'geoBoundaries',
    bounds: { west: -180, south: -85, east: 180, north: 85 },
    defaultViewport: { longitude: 15, latitude: 20, zoom: 1.25 },
  };
}
